import React, { createContext, useContext, useReducer } from 'react';
import { shopifyCompanyDirectory } from './data/directory.js';
import { policyUsageCount, slotIds, hasOwnSlot } from './pricing.js';
import { newRule, newBaseBuilder, newQuantityBuilder } from './builders.js';
import { buildInitialState } from './initialState.js';
import { todayISO, registrationDuplicates } from './registrations.js';
import {
  clone,
  companySlotArray,
  locationSlotArray,
  addPricingToLocations,
  addCompanySlot,
  removeCompanySlot,
  demoPolicyId,
  recomputeBuyers,
  applyQuotePricingTransfer,
} from './dbHelpers.js';

// The B2B god file rebuilt #app from a single `state` on every action. Here that
// is a reducer over a view state machine + the mutable demo db. The db helpers,
// builders and initial-state assembly live in sibling modules (dbHelpers.js,
// builders.js, initialState.js).

// Re-exported so screens keep one import surface (e.g. BuildFromQuotes needs newBaseBuilder).
export { newRule, newBaseBuilder, newQuantityBuilder } from './builders.js';

// ----- "Who this pricing serves" (god-file assignmentAdapter) -----
const locKey = (companyId, locationId) => `${companyId}::${locationId}`;
// Does this location get the pricing — its own list if it has one, else the company's.
// Read-only (slotIds / hasOwnSlot never normalize in place).
const locationHolds = (c, l, kind, policyId) => (hasOwnSlot(l, kind) ? slotIds(l, kind) : slotIds(c, kind)).includes(policyId);

// Read a saved policy's current assignment back into builder fields, so opening it
// shows who it serves and re-saving preserves that unless the merchant changes it.
// A company whose every location gets it is a company pick; otherwise its
// locations that get it are location picks.
function seedAssignment(policy, db) {
  const kind = policy.priceKind === 'quantity' ? 'quantity' : 'base';
  if (policy.audienceType !== 'd2c') {
    const b2bCompanyIds = [];
    const b2bLocationKeys = [];
    (db.companies || []).forEach((c) => {
      const locs = c.locations || [];
      const held = locs.filter((l) => locationHolds(c, l, kind, policy.id));
      if (locs.length ? held.length === locs.length : slotIds(c, kind).includes(policy.id)) b2bCompanyIds.push(c.id);
      else held.forEach((l) => b2bLocationKeys.push(locKey(c.id, l.id)));
    });
    return { b2bCompanyIds, b2bLocationKeys, customerTarget: 'none', assignmentTargetIds: [] };
  }
  const tags = (db.tagPricing || []).filter((t) => t.defaultPolicyId === policy.id).map((t) => t.id);
  const none = { b2bCompanyIds: [], b2bLocationKeys: [] };
  if (tags.length) return { ...none, customerTarget: 'tags', assignmentTargetIds: tags };
  const specific = (db.customers || []).filter((cu) => cu.policyId === policy.id).map((cu) => cu.id);
  if (specific.length) return { ...none, customerTarget: 'specific', assignmentTargetIds: specific };
  if (db.defaults?.wholesalePolicyId === policy.id) return { ...none, customerTarget: 'all', assignmentTargetIds: [] };
  return { ...none, customerTarget: 'none', assignmentTargetIds: [] };
}

// Push the builder's assignment choices into the db on save. B2B syncs exactly
// which locations get this pricing (of its kind); D2C sets the chosen customer /
// tag / global target. A full sync — unticking removes the pricing — and it is
// cleared from the other audience so a policy is never assigned as both.
function applyAssignment(db, policyId, b) {
  const kind = b.priceKind === 'quantity' ? 'quantity' : 'base';
  const audience = b.audienceType === 'd2c' ? 'd2c' : 'b2b';

  if (audience !== 'b2b') {
    (db.companies || []).forEach((c) => {
      [c, ...(c.locations || [])].forEach((holder) => {
        if (!holder.pricing) return;
        removeCompanySlot(holder, 'quantity', policyId);
        removeCompanySlot(holder, 'base', policyId);
      });
    });
    // Nor the store-wide B2B default ("All Companies").
    if (db.defaults?.b2bPolicyId === policyId) db.defaults.b2bPolicyId = null;
  }
  if (audience !== 'd2c') {
    (db.customers || []).forEach((cu) => { if (cu.policyId === policyId) cu.policyId = null; });
    (db.tagPricing || []).forEach((t) => { if (t.defaultPolicyId === policyId) t.defaultPolicyId = null; });
    if (db.defaults?.wholesalePolicyId === policyId) db.defaults.wholesalePolicyId = null;
  }

  if (audience === 'b2b') {
    const wantCompany = new Set(b.b2bCompanyIds || []);
    const wantLoc = new Set(b.b2bLocationKeys || []);
    const ensure = (list) => {
      if (!list.some((e) => e.id === policyId)) list.push({ id: policyId, priority: b.priority || list.length + 1 });
    };
    (db.companies || []).forEach((c) => {
      const locs = c.locations || [];
      if (!locs.length) {
        const holds = slotIds(c, kind).includes(policyId);
        if (wantCompany.has(c.id) && !holds) addCompanySlot(c, kind, policyId, b.priority);
        else if (!wantCompany.has(c.id) && holds) removeCompanySlot(c, kind, policyId);
        return;
      }
      const wanted = (l) => wantCompany.has(c.id) || wantLoc.has(locKey(c.id, l.id));
      // Only touch a company whose locations actually change, so re-saving an
      // unchanged pick never reshapes where the pricing is stored.
      if (locs.every((l) => wanted(l) === locationHolds(c, l, kind, policyId))) return;
      if (locs.every(wanted)) {
        // Every location: the company holds it (locations added later get it too),
        // and so does any location keeping its own list.
        addCompanySlot(c, kind, policyId, b.priority);
        locs.forEach((l) => hasOwnSlot(l, kind) && ensure(locationSlotArray(c, l, kind)));
        return;
      }
      // Some locations: each ticked one holds it in its own list (starting from what
      // it inherited — copied before the company lets go), the company doesn't.
      locs.forEach((l) => wanted(l) && ensure(locationSlotArray(c, l, kind)));
      removeCompanySlot(c, kind, policyId);
      locs.forEach((l) => !wanted(l) && hasOwnSlot(l, kind) && removeCompanySlot(l, kind, policyId));
    });
    return;
  }

  const target = b.customerTarget || 'none';
  const ids = new Set(b.assignmentTargetIds || []);
  (db.customers || []).forEach((cu) => {
    if (target === 'specific') cu.policyId = ids.has(cu.id) ? policyId : cu.policyId === policyId ? null : cu.policyId;
    else if (cu.policyId === policyId) cu.policyId = null;
  });
  (db.tagPricing || []).forEach((t) => {
    if (target === 'tags') t.defaultPolicyId = ids.has(t.id) ? policyId : t.defaultPolicyId === policyId ? null : t.defaultPolicyId;
    else if (t.defaultPolicyId === policyId) t.defaultPolicyId = null;
  });
  db.defaults = db.defaults || {};
  if (['all', 'logged_in', 'logged_out'].includes(target)) db.defaults.wholesalePolicyId = policyId;
  else if (db.defaults.wholesalePolicyId === policyId) db.defaults.wholesalePolicyId = null;
}

// Approve = activate the buyer as the main contact of a new Company. Duplicates are
// resolved first (see registrationDuplicates / joinRegistration). Mutates `db`.
function approveRegistration(db, reg) {
  const name = `${reg.firstName} ${reg.lastName}`.trim();
  const when = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  let n = db.companies.length + 1;
  while (db.companies.some((c) => c.id === `c${n}`)) n += 1;
  const id = `c${n}`;
  const company = {
    id,
    name: reg.company,
    mainContact: name,
    source: 'Registration form',
    pricing: { base: [], quantity: null },
    revenue: 0,
    // One starting location with the same defaults normalizeDb gives seeded ones.
    locations: [{
      id: `${id}-l1`, name: 'Head office', terms: 'Not set', ordering: 'Buys directly', buyers: 1, lastOrder: '—',
      status: 'Active', paymentTerms: 'No payment terms', purchasingMode: 'DIRECT', externalId: '',
      shipping: { country: reg.country || '', address1: '', address2: '', city: '', postal: '', phone: '' },
      billingSameAsShipping: true, editableShipping: false, taxId: reg.taxId || '', taxSettings: 'collect',
      pricing: { base: null, quantity: null },
    }],
    contacts: [{ name, email: reg.email, role: 'Location admin', access: 'Buys directly', locations: 'Head office' }],
    quotes: [],
    exceptions: [],
    activity: [{ when, what: `Created from ${name}'s B2B registration` }],
    orders: [],
  };
  db.companies.push(company);
  Object.assign(reg, { status: 'approved', decidedAt: todayISO(), companyId: company.id });
}

// An email belongs to one Company only: take the buyer off the Company they're a
// contact at before they land in another one. Mutates `db`.
function removeContactFrom(db, company, email, movedTo) {
  const c = db.companies.find((x) => x.id === company.id);
  if (!c) return;
  const key = (email || '').trim().toLowerCase();
  const leaving = (c.contacts || []).find((ct) => (ct.email || '').trim().toLowerCase() === key);
  if (!leaving) return;
  c.contacts = c.contacts.filter((ct) => ct !== leaving);
  recomputeBuyers(c);
  if (c.mainContact === leaving.name) c.mainContact = c.contacts[0]?.name || '';
  const when = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  c.activity = [{ when, what: `${leaving.name} moved to ${movedTo} from a B2B registration` }, ...(c.activity || [])];
}

// Merge a registration's buyer into an existing Company, at the picked location and
// role: added as a contact, or — already one there — their location / role updated.
// No new Company. Mutates `db`; returns the Company.
function joinRegistration(db, reg, companyId, locationId, role) {
  const target = db.companies.find((c) => c.id === companyId);
  if (!target) return null;
  const name = `${reg.firstName} ${reg.lastName}`.trim();
  const when = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const loc = (target.locations || []).find((l) => l.id === locationId) || (target.locations || [])[0] || null;
  const email = (reg.email || '').trim().toLowerCase();
  target.contacts = target.contacts || [];
  const existing = target.contacts.find((ct) => (ct.email || '').trim().toLowerCase() === email);
  if (existing) {
    Object.assign(existing, { role: role || existing.role, locations: loc?.name || existing.locations, access: loc?.ordering || existing.access });
    target.activity = [{ when, what: `${existing.name}'s access updated from a B2B registration` }, ...(target.activity || [])];
  } else {
    target.contacts.push({ name, email: reg.email, role: role || 'Ordering only', access: loc?.ordering || 'Buys directly', locations: loc?.name || '' });
    target.activity = [{ when, what: `${name} added from a B2B registration` }, ...(target.activity || [])];
  }
  recomputeBuyers(target);
  Object.assign(reg, { status: 'approved', decidedAt: todayISO(), companyId: target.id, mergedInto: target.id });
  return target;
}

// Approve into a new Company; an existing Shopify customer with the email is
// reused as its main contact (never a second customer). Mutates `db`.
function approveReusingCustomer(db, reg, customer) {
  approveRegistration(db, reg);
  const created = db.companies.find((c) => c.id === reg.companyId);
  if (created && customer) created.activity[0].what += ` (existing customer ${customer.name})`;
  reg.linkedCustomerId = customer ? customer.id : null;
}

function reducer(state, action) {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, view: action.view, ...(action.patch || {}) };
    case 'OPEN_COMPANY':
      return { ...state, view: 'company', selectedCompany: action.id, companyTab: action.tab || 'pricing' };
    case 'SET_COMPANY_TAB':
      return { ...state, companyTab: action.tab };
    // ----- Registrations (storefront form submissions) -----
    // Picking a template in the form builder creates the registration form.
    case 'CREATE_REGISTRATION_FORM':
      return { ...state, db: { ...state.db, hasRegistrationForm: true, registrationFormPublished: false, registrationFormOff: false } };
    // Adding the form to a storefront place (Theme Editor) publishes it — app home shows Draft until then.
    case 'PUBLISH_REGISTRATION_FORM':
      return { ...state, db: { ...state.db, registrationFormPublished: true } };
    // "Turn form off" in the builder: buyers can't apply until it's turned back on. Where
    // it's published is kept, so turning it on goes straight back to Live (or Draft).
    case 'SET_REGISTRATION_FORM_OFF':
      return { ...state, db: { ...state.db, registrationFormOff: action.off }, toast: action.off ? 'Form turned off' : 'Form turned on' };
    case 'SET_HOME_GUIDE':
      return { ...state, homeGuideHidden: action.hidden };
    case 'OPEN_REGISTRATION':
      return { ...state, view: 'registration', selectedRegistration: action.id };
    case 'SET_REGISTRATION_FILTER':
      return { ...state, registrationFilter: action.filter };
    case 'SET_REGISTRATION_SEARCH':
      return { ...state, registrationSearch: action.value };
    case 'SET_REGISTRATION_SORT':
      return { ...state, registrationSort: action.value };
    // One registration, into the Company the merchant picked (null → new Company).
    case 'APPROVE_REGISTRATION': {
      const db = clone(state.db);
      const reg = (db.registrations || []).find((r) => r.id === action.id);
      if (!reg || reg.status !== 'pending') return state;
      // Matches need the merchant's choice: a new Company is created only when they
      // pick it (case 2 — the contact moves there; case 3 — same name allowed).
      // Case 1 (same email, same company) is merge or decline only.
      const d = registrationDuplicates(db, reg);
      if (d.kind === 'same' || ((d.kind === 'contact' || d.kind === 'company') && !action.createNew)) {
        return { ...state, toast: 'This registration matches existing records — choose how to handle it' };
      }
      // A contact elsewhere moves to the new Company (an email belongs to one Company).
      if (d.contactOf) removeContactFrom(db, d.contactOf, reg.email, reg.company);
      approveReusingCustomer(db, reg, d.customer);
      return {
        ...state,
        db,
        toast: d.contactOf ? `Registration approved · ${reg.firstName} moved from ${d.contactOf.name}` : d.customer ? 'Registration approved · existing customer reused' : 'Registration approved',
      };
    }
    // Merge into an existing Company (the email's, or the same-name one) at a location + role.
    case 'MERGE_REGISTRATION': {
      const db = clone(state.db);
      const reg = (db.registrations || []).find((r) => r.id === action.id);
      if (!reg || reg.status !== 'pending') return state;
      const d = registrationDuplicates(db, reg);
      if (!d.mergeTargets.some((c) => c.id === action.companyId)) return state;
      // Joining a different Company than the one they're a contact at moves them.
      const moving = d.contactOf && d.contactOf.id !== action.companyId;
      const targetName = db.companies.find((c) => c.id === action.companyId)?.name;
      const already = d.contactOf && d.contactOf.id === action.companyId;
      if (moving) removeContactFrom(db, d.contactOf, reg.email, targetName);
      const target = joinRegistration(db, reg, action.companyId, action.locationId, action.role);
      const toast = moving ? `Moved to ${target.name} from ${d.contactOf.name}` : already ? `Merged into ${target.name}` : `Added to ${target.name}`;
      return { ...state, db, toast };
    }
    // Bulk: each buyer gets a new Company (reusing an existing customer); registrations
    // matching an existing contact or company name are skipped (open one to choose).
    case 'APPROVE_REGISTRATIONS': {
      const db = clone(state.db);
      const regs = (db.registrations || []).filter((r) => action.ids.includes(r.id) && r.status === 'pending');
      // One by one, so two in the same batch for the same new company don't both create it.
      const ok = [];
      const dupes = [];
      regs.forEach((reg) => {
        const d = registrationDuplicates(db, reg);
        if (d.blocking) dupes.push(reg);
        else {
          approveReusingCustomer(db, reg, d.customer);
          ok.push(reg);
        }
      });
      const approved = ok.length === 1 ? '1 registration approved' : `${ok.length} registrations approved`;
      const skipped = dupes.length ? ` · ${dupes.length} duplicate${dupes.length === 1 ? '' : 's'} to review` : '';
      return { ...state, db, toast: `${approved}${skipped}` };
    }
    case 'DECLINE_REGISTRATIONS': {
      const db = clone(state.db);
      const today = todayISO();
      const regs = (db.registrations || []).filter((r) => action.ids.includes(r.id) && r.status === 'pending');
      regs.forEach((reg) => Object.assign(reg, { status: 'declined', decidedAt: today }));
      return { ...state, db, toast: regs.length === 1 ? 'Registration declined' : `${regs.length} registrations declined` };
    }
    // Removes the submissions only — Companies created by approving them stay.
    case 'DELETE_REGISTRATIONS': {
      const db = clone(state.db);
      const before = (db.registrations || []).length;
      db.registrations = (db.registrations || []).filter((r) => !action.ids.includes(r.id));
      const n = before - db.registrations.length;
      const leave = state.view === 'registration' && action.ids.includes(state.selectedRegistration);
      return {
        ...state,
        db,
        ...(leave ? { view: 'registrations', selectedRegistration: null } : {}),
        toast: n === 1 ? 'Registration deleted' : `${n} registrations deleted`,
      };
    }
    case 'OPEN_QUOTE':
      return { ...state, view: 'quote', selectedQuote: action.id };
    case 'OPEN_LOCATION':
      return { ...state, view: 'location', selectedCompany: action.companyId, selectedLocation: action.locationId };
    case 'ASSIGN_BUYER': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      const l = c?.locations?.find((x) => x.id === action.locationId);
      const ct = c?.contacts?.find((x) => x.email === action.email);
      if (c && l && ct) {
        ct.locations = l.name;
        if (action.role) ct.role = action.role;
        recomputeBuyers(c);
      }
      return { ...state, db, toast: 'Buyer assigned' };
    }
    case 'UNASSIGN_BUYER': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      const ct = c?.contacts?.find((x) => x.email === action.email);
      if (c && ct) {
        ct.locations = '';
        recomputeBuyers(c);
      }
      return { ...state, db, toast: 'Buyer removed' };
    }
    case 'ADD_LOCATION': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      if (c) {
        c.locations = c.locations || [];
        const id = `${c.id}-l${c.locations.length + 1}`;
        const approval = action.purchasingMode === 'REQUIRE_APPROVAL';
        c.locations.push({
          id,
          name: action.name,
          status: 'Active',
          paymentTerms: action.paymentTerms || 'No payment terms',
          purchasingMode: action.purchasingMode || 'DIRECT',
          ordering: approval ? 'You approve first' : 'Buys directly',
          terms: action.paymentTerms || 'Not set',
          externalId: action.externalId || '',
          shipping: { country: 'VN', address1: '', address2: '', city: '', postal: '', phone: '' },
          billingSameAsShipping: true,
          editableShipping: false,
          taxId: '',
          taxSettings: 'collect',
          pricing: { base: null, quantity: null },
          buyers: 0,
          lastOrder: null,
        });
      }
      return { ...state, db, toast: 'Location added' };
    }
    // Live edit of a location's fields (general / shipping / commerce settings).
    case 'SET_LOCATION_FIELD': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      const l = c?.locations?.find((x) => x.id === action.locationId);
      if (l) Object.assign(l, action.patch);
      return { ...state, db, ...(action.silent ? {} : { toast: 'Location updated' }) };
    }
    case 'OPEN_PRICE_BOARD':
      return { ...state, priceBoard: { companyId: action.companyId } };
    case 'CLOSE_PRICE_BOARD':
      return { ...state, priceBoard: null };
    // ----- Assign / swap base pricing -----
    case 'OPEN_ASSIGN':
      // applyTo / locationIds: from a company page, add to all its locations or some.
      return {
        ...state,
        assign: {
          companyId: action.companyId,
          locationId: action.locationId || null,
          mode: action.mode,
          kind: action.kind || 'base',
          swapId: action.swapId || null,
          selectedIds: [],
          applyTo: 'all',
          locationIds: [],
        },
      };
    // Editor context tweaks made inside the editor (e.g. which of the company's
    // locations a new pricing goes to).
    case 'EDITOR_CONTEXT_PATCH':
      return { ...state, editorContext: { ...(state.editorContext || {}), ...action.patch } };
    case 'ASSIGN_PATCH':
      return { ...state, assign: { ...state.assign, ...action.patch } };
    case 'ASSIGN_SET':
      // The picker's OptionList returns the full selection; add is multi (base and
      // quantity alike), swap is single (allowMultiple off ⇒ at most one id).
      return { ...state, assign: { ...state.assign, selectedIds: action.ids || [] } };
    case 'CLOSE_ASSIGN':
      return { ...state, assign: null };
    case 'ASSIGN_CONFIRM': {
      const a = state.assign;
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === a.companyId);
      const ids = a.selectedIds || [];
      // Assigning to a location (from its page) writes the location's own list;
      // adding from a company page goes to all its locations or the picked ones.
      const loc = a.locationId ? c?.locations?.find((x) => x.id === a.locationId) : null;
      const kind = a.kind === 'quantity' ? 'quantity' : 'base';
      if (c && ids.length && !a.locationId && a.mode !== 'swap') {
        const locIds = a.applyTo === 'some' ? a.locationIds || [] : null;
        ids.forEach((id) => {
          const pol = db.policies.find((p) => p.id === id);
          addPricingToLocations(c, kind, id, pol?.priority, locIds);
        });
      } else if (c && ids.length && (!a.locationId || loc)) {
        const list = loc ? locationSlotArray(c, loc, kind) : companySlotArray(c, kind);
        if (a.mode === 'swap') {
          const pol = db.policies.find((p) => p.id === ids[0]);
          const idx = list.findIndex((e) => e.id === a.swapId);
          if (idx >= 0) list[idx] = { id: ids[0], priority: pol?.priority ?? list[idx].priority };
        } else {
          // Multi-select: add each picked pricing that isn't already assigned.
          ids.forEach((id) => {
            if (!list.some((e) => e.id === id)) {
              const pol = db.policies.find((p) => p.id === id);
              list.push({ id, priority: pol?.priority ?? list.length + 1 });
            }
          });
        }
      }
      const label = a.kind === 'quantity' ? 'Quantity pricing' : 'Base pricing';
      const toast = a.mode === 'swap' ? `${label} changed` : ids.length > 1 ? `${ids.length} pricings added` : `${label} added`;
      return { ...state, db, assign: null, toast };
    }
    // Remove one pricing from a location (from its page). Inherited pricing is
    // copied into the location's own list first, so only this one goes.
    case 'REMOVE_LOCATION_PRICING': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      const loc = c?.locations?.find((x) => x.id === action.locationId);
      if (loc) {
        const list = locationSlotArray(c, loc, action.kind);
        loc.pricing[action.kind] = list.filter((e) => e.id !== action.policyId);
      }
      return { ...state, db, toast: `${action.kind === 'quantity' ? 'Quantity' : 'Base'} pricing removed` };
    }
    case 'REMOVE_COMPANY_QUANTITY': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      if (c) removeCompanySlot(c, 'quantity', action.policyId);
      return { ...state, db, toast: 'Quantity pricing removed' };
    }
    // ----- Assign one policy to many targets (companies / customers / tags / global) -----
    case 'OPEN_MULTI_ASSIGN':
      return { ...state, assignMulti: { policyId: action.policyId } };
    case 'CLOSE_MULTI_ASSIGN':
      return { ...state, assignMulti: null };
    case 'MULTI_ASSIGN': {
      const db = clone(state.db);
      const pol = db.policies.find((p) => p.id === action.policyId);
      if (!pol) return { ...state, assignMulti: null };
      const kind = pol.priceKind === 'quantity' ? 'quantity' : 'base';
      const ids = action.ids || [];
      if (action.targetType === 'company') {
        ids.forEach((id) => {
          const c = db.companies.find((x) => x.id === id);
          if (c) addPricingToLocations(c, kind, pol.id, pol.priority);
        });
      } else if (action.targetType === 'location') {
        ids.forEach((key) => {
          const [cid, lid] = key.split('::');
          const c = db.companies.find((x) => x.id === cid);
          const l = c?.locations?.find((x) => x.id === lid);
          if (!l) return;
          const list = locationSlotArray(c, l, kind);
          if (!list.some((e) => e.id === pol.id)) list.push({ id: pol.id, priority: pol.priority || list.length + 1 });
        });
      } else if (action.targetType === 'customer') {
        ids.forEach((id) => {
          const cu = (db.customers || []).find((x) => x.id === id);
          if (cu) cu.policyId = pol.id;
        });
      } else if (action.targetType === 'tag') {
        ids.forEach((id) => {
          const t = (db.tagPricing || []).find((x) => x.id === id);
          if (t) t.defaultPolicyId = pol.id;
        });
      } else if (action.targetType === 'global') {
        db.defaults = { ...(db.defaults || {}), [pol.audienceType === 'd2c' ? 'wholesalePolicyId' : 'b2bPolicyId']: pol.id };
      }
      return { ...state, db, assignMulti: null, toast: 'Pricing assigned' };
    }
    // ----- Add-company wizard -----
    // Add a Shopify company: pick it, add it — pricing is set afterwards.
    case 'OPEN_ADD_COMPANY':
      return { ...state, addCompany: { shopifyId: null, search: '' } };
    case 'ADD_COMPANY_PATCH':
      return { ...state, addCompany: { ...state.addCompany, ...action.patch } };
    case 'CLOSE_ADD_COMPANY':
      return { ...state, addCompany: null };
    case 'ADD_COMPANY_CONFIRM': {
      const ac = state.addCompany;
      const shp = Object.values(shopifyCompanyDirectory).find((s) => s.id === ac.shopifyId);
      if (!shp) return { ...state, addCompany: null };
      const db = clone(state.db);
      // Only the ticked locations come in, each with the contacts at it (a contact
      // with no location comes with the company). New locations follow the
      // company's pricing until given their own.
      const picked = (shp.locations || []).filter((l) => (ac.locationIds || []).includes(l.id));
      if (!picked.length) return state;
      const toLocation = (l) => ({
        id: l.id, name: l.name, terms: l.terms, ordering: l.ordering, buyers: 0, lastOrder: '—',
        pricing: { base: null, quantity: null },
      });
      const contactsAt = (names, withUnplaced) =>
        (shp.contacts || [])
          .filter((c) => names.includes(c.location) || (withUnplaced && !c.location))
          .map((c) => ({ name: c.name, email: c.email, role: c.role, access: c.access, locations: c.location }));
      // Already in the app (added before with some locations): add the rest to it.
      const existing = db.companies.find((c) => c.shopifyCompanyId === shp.id || c.name === shp.name);
      if (existing) {
        existing.locations = [...(existing.locations || []), ...picked.map(toLocation)];
        const known = new Set((existing.contacts || []).map((c) => c.email));
        existing.contacts = [...(existing.contacts || []), ...contactsAt(picked.map((l) => l.name), false).filter((c) => !known.has(c.email))];
        const n = picked.length;
        return { ...state, db, addCompany: null, view: 'company', selectedCompany: existing.id, companyTab: 'locations', toast: `${n} location${n === 1 ? '' : 's'} added` };
      }
      const id = `c${db.companies.length + 1}`;
      const contacts = contactsAt(picked.map((l) => l.name), true);
      db.companies.push({
        id,
        name: shp.name,
        mainContact: contacts[0]?.name || '',
        source: 'Company application',
        pricing: { base: null, quantity: null },
        revenue: 0,
        locations: picked.map(toLocation),
        contacts,
        quotes: [],
        exceptions: [],
        activity: [],
        orders: [],
        shopifyCompanyId: ac.shopifyId,
      });
      // Land on its Pricing tab — the empty states there offer Add base / quantity pricing.
      return { ...state, db, addCompany: null, view: 'company', selectedCompany: id, companyTab: 'pricing', toast: 'Company added' };
    }
    case 'SET_LIST_FILTER':
      return { ...state, listFilter: action.filter };
    case 'SET_COMPANY_SEARCH':
      return { ...state, companySearch: action.value };
    case 'SET_COMPANY_SORT':
      return { ...state, companySortField: action.field, companySortDir: action.dir };
    case 'DELETE_COMPANY': {
      const db = clone(state.db);
      db.companies = db.companies.filter((c) => c.id !== action.id);
      db.quotes = (db.quotes || []).filter((q) => q.company !== action.id);
      const goList = state.selectedCompany === action.id;
      return {
        ...state,
        db,
        ...(goList ? { view: 'customers', selectedCompany: db.companies[0]?.id || null } : {}),
        toast: 'Company deleted',
      };
    }
    // Base pricing pagination
    case 'BASE_SEARCH':
      return { ...state, basePricingSearch: action.value, basePage: 1 };
    case 'BASE_PAGE_SIZE':
      return { ...state, basePageSize: action.size, basePage: 1 };
    case 'BASE_PAGE':
      return { ...state, basePage: action.page };
    // ----- Pricing editor -----
    case 'OPEN_EDITOR': {
      const builder = action.policy
        ? {
            // God-file appearanceEditor defaults for older policies that lack them.
            appearanceTitle: 'Wholesale pricing',
            appearanceLabel: 'Special price',
            ...clone(action.policy),
            ...seedAssignment(action.policy, state.db),
          }
        : action.kind === 'quantity'
        ? newQuantityBuilder()
        : newBaseBuilder();
      return {
        ...state,
        builder,
        pricingBuilderTab: 'settings', // always land on Settings when the editor opens
        ruleEdit: null,
        addRuleMenu: false,
        editorContext: action.context || null,
      };
    }
    case 'SET_BUILDER_TAB':
      return { ...state, pricingBuilderTab: action.tab };
    case 'CLOSE_EDITOR':
      return { ...state, builder: null, ruleEdit: null, addRuleMenu: false, editorContext: null };
    case 'BUILDER_PATCH':
      return { ...state, builder: { ...state.builder, ...action.patch } };
    case 'SET_RULE_EDIT':
      return { ...state, ruleEdit: action.index, addRuleMenu: false };
    case 'TOGGLE_ADD_RULE_MENU':
      return { ...state, addRuleMenu: action.open != null ? action.open : !state.addRuleMenu };
    case 'ADD_RULE': {
      const rules = [...(state.builder.conditionalRules || []), newRule(action.field)];
      return { ...state, builder: { ...state.builder, conditionalRules: rules }, ruleEdit: rules.length - 1, addRuleMenu: false };
    }
    case 'UPDATE_RULE': {
      const rules = (state.builder.conditionalRules || []).map((r, i) =>
        i === action.index ? { ...r, ...action.patch } : r,
      );
      return { ...state, builder: { ...state.builder, conditionalRules: rules } };
    }
    case 'DELETE_RULE': {
      const rules = (state.builder.conditionalRules || []).filter((_, i) => i !== action.index);
      let ruleEdit = state.ruleEdit;
      if (ruleEdit === action.index) ruleEdit = null;
      else if (ruleEdit != null && ruleEdit > action.index) ruleEdit -= 1;
      return { ...state, builder: { ...state.builder, conditionalRules: rules }, ruleEdit };
    }
    case 'MOVE_RULE': {
      const rules = [...(state.builder.conditionalRules || [])];
      const { from, to } = action;
      if (from < 0 || from >= rules.length || to < 0 || to >= rules.length || from === to) return state;
      const edited = state.ruleEdit != null ? rules[state.ruleEdit] : null;
      const [it] = rules.splice(from, 1);
      rules.splice(to, 0, it);
      const ruleEdit = edited ? rules.indexOf(edited) : state.ruleEdit;
      return { ...state, builder: { ...state.builder, conditionalRules: rules }, ruleEdit: ruleEdit >= 0 ? ruleEdit : null };
    }
    case 'SAVE_EDITOR': {
      const b = state.builder;
      // Prune conditional rules with no chosen value or no real adjustment
      // (legacy validConditionalRule), and derive explicitEnabled from overrides.
      const cleanRules = (b.conditionalRules || []).filter(
        (r) =>
          (r.conditions || []).some((c) =>
            Array.isArray(c.values) ? c.values.filter(Boolean).length : c.value != null && c.value !== '',
          ) && r.rule && r.rule !== 'keep',
      );
      const draft = {
        ...b,
        conditionalRules: cleanRules,
        explicitEnabled: Object.keys(b.variantAdjustments || {}).length > 0,
      };
      if (!draft.name || !draft.name.trim()) {
        return { ...state, toast: 'Name required' };
      }
      const db = clone(state.db);
      const existing = db.policies.find((p) => p.id === b.id);
      if (!existing) {
        const id = `pN${db.policies.length + 1}`;
        db.policies.push({ ...newBaseBuilder(), ...draft, id });
        // Created from a Company page → land in that Company's slot (existing
        // behavior). From the Pricing library → apply the "Who this pricing serves"
        // choices the merchant made in the builder.
        if (state.editorContext?.companyId) {
          const c = db.companies.find((x) => x.id === state.editorContext.companyId);
          const kind = draft.priceKind === 'quantity' ? 'quantity' : 'base';
          const loc = state.editorContext.locationId ? c?.locations?.find((x) => x.id === state.editorContext.locationId) : null;
          // From a Location page → that location's own list.
          if (loc) {
            const list = locationSlotArray(c, loc, kind);
            if (!list.some((e) => e.id === id)) list.push({ id, priority: draft.priority || list.length + 1 });
          } else if (c) addPricingToLocations(c, kind, id, draft.priority, state.editorContext.locationIds);
        } else {
          applyAssignment(db, id, draft);
        }
        return { ...state, db, builder: null, ruleEdit: null, addRuleMenu: false, editorContext: null, toast: 'Pricing saved' };
      }
      // Editing an existing profile. If it is SHARED (assigned beyond the company
      // we are editing from) and we are editing from a company scope, fork an
      // account-specific copy so the edit does not silently change every assignee
      // — unless the merchant explicitly chose "apply to all" (action.applyToAll).
      const scopeCompany = state.editorContext?.companyId
        ? db.companies.find((x) => x.id === state.editorContext.companyId)
        : null;
      // Opened from a Location page: "here" is that location (its own list).
      const scopeLoc =
        scopeCompany && state.editorContext.locationId
          ? (scopeCompany.locations || []).find((x) => x.id === state.editorContext.locationId)
          : null;
      const kind = existing.priceKind === 'quantity' ? 'quantity' : 'base';
      const usage = policyUsageCount({ id: b.id }, db);
      const usesHere = scopeLoc
        ? slotIds(scopeLoc, kind).includes(b.id)
        : scopeCompany
          ? companySlotArray(scopeCompany, kind).some((e) => e.id === b.id)
          : false;
      const sharedElsewhere = usage - (usesHere ? 1 : 0) > 0;
      if (scopeCompany && sharedElsewhere && !action.applyToAll) {
        const fork = JSON.parse(JSON.stringify(existing));
        Object.assign(fork, draft, { id: demoPolicyId(db), type: 'Account-specific' });
        if (fork.name === existing.name) fork.name = `${(scopeLoc || scopeCompany).name} ${existing.name}`;
        db.policies.push(fork);
        if (scopeLoc) {
          // The copy takes the original's place in this location's own list.
          const list = locationSlotArray(scopeCompany, scopeLoc, kind);
          const idx = list.findIndex((e) => e.id === existing.id);
          if (idx >= 0) list[idx] = { id: fork.id, priority: list[idx].priority };
          else list.push({ id: fork.id, priority: draft.priority || list.length + 1 });
        } else {
          removeCompanySlot(scopeCompany, kind, existing.id);
          addCompanySlot(scopeCompany, kind, fork.id, draft.priority);
        }
        return { ...state, db, builder: null, ruleEdit: null, addRuleMenu: false, editorContext: null, toast: 'Pricing forked' };
      }
      Object.assign(existing, draft, { id: existing.id });
      // Library edit (not scoped to a Company) → sync the assignment choices.
      if (!state.editorContext?.companyId) applyAssignment(db, existing.id, draft);
      return { ...state, db, builder: null, ruleEdit: null, addRuleMenu: false, editorContext: null, toast: 'Pricing saved' };
    }
    // ----- Pricing library actions -----
    case 'DELETE_POLICY': {
      const db = clone(state.db);
      db.policies = db.policies.filter((p) => p.id !== action.id);
      db.companies.forEach((c) => {
        [c, ...(c.locations || [])].forEach((holder) => {
          if (!holder.pricing) return;
          removeCompanySlot(holder, 'base', action.id);
          removeCompanySlot(holder, 'quantity', action.id);
        });
      });
      return { ...state, db, toast: 'Pricing deleted' };
    }
    case 'TOGGLE_POLICY_STATUS': {
      const db = clone(state.db);
      const p = db.policies.find((x) => x.id === action.id);
      if (p) p.status = p.status === 'Inactive' ? 'Active' : 'Inactive';
      return { ...state, db, toast: p && p.status === 'Inactive' ? 'Pricing turned off' : 'Pricing turned on' };
    }
    // Store-wide default pricing (All Companies / All customers) — consulted by
    // the resolution engine when no company/customer pricing matches
    // (resolvePricing / companyNeedsPrice).
    case 'SET_DEFAULT_POLICY': {
      const db = clone(state.db);
      db.defaults = { ...(db.defaults || {}), [action.key]: action.value || null };
      return { ...state, db, toast: 'Default pricing updated' };
    }
    // "Show the app with no data": clear app-owned records (companies, pricing,
    // customers, tags, defaults, quotes, registrations, the registration form) to reveal the fresh-install empty states;
    // toggling off restores the sample data (legacy setEmptyMode / demoBackup).
    case 'SET_EMPTY_MODE': {
      if (action.on && !state.emptyMode) {
        const emptyBackup = state.db;
        const db = clone(state.db);
        db.companies = [];
        db.policies = [];
        db.customers = [];
        db.tagPricing = [];
        db.quotes = [];
        db.registrations = [];
        db.hasRegistrationForm = false;
        db.registrationFormPublished = false;
        db.registrationFormOff = false;
        db.defaults = { b2bPolicyId: null, wholesalePolicyId: null };
        return { ...state, db, emptyBackup, emptyMode: true, view: 'customers', selectedCompany: null, toast: 'Sample data hidden' };
      }
      if (!action.on && state.emptyMode) {
        return { ...state, db: state.emptyBackup || state.db, emptyBackup: null, emptyMode: false, view: 'customers', toast: 'Sample data restored' };
      }
      return state;
    }
    // ----- Base pricing card actions -----
    case 'REMOVE_COMPANY_BASE': {
      const db = clone(state.db);
      const c = db.companies.find((x) => x.id === action.companyId);
      if (c && Array.isArray(c.pricing.base)) {
        c.pricing.base = c.pricing.base.filter((e) => e.id !== action.policyId);
      }
      return { ...state, db, toast: 'Base pricing removed' };
    }
    // ----- Build from closed quotes -----
    case 'OPEN_BUILD_QUOTES':
      return { ...state, buildQuotes: action.payload };
    case 'CLOSE_BUILD_QUOTES':
      return { ...state, buildQuotes: null };
    case 'BUILD_QUOTES_PATCH':
      return { ...state, buildQuotes: { ...state.buildQuotes, ...action.patch } };
    // Dev: simulate a merchant without the RFQ app (closed quotes come from it).
    case 'SET_RFQ_INSTALLED':
      return { ...state, db: { ...state.db, rfqAppInstalled: action.installed } };
    case 'APPLY_BUILD_QUOTES': {
      const db = clone(state.db);
      const companyId = state.buildQuotes?.companyId;
      const co = db.companies.find((c) => c.id === companyId);
      const lines = (action.rows || [])
        .filter((r) => Number(r.proposed) > 0)
        .map((r) => ({ sku: r.sku, quoted: Number(r.proposed) }));
      const loc = action.locationId ? co?.locations?.find((l) => l.id === action.locationId) : null;
      const transfer = {
        targetId: action.dest,
        newName: action.dest === '__new__' ? `${(co && co.name) || 'Company'}${loc ? ` · ${loc.name}` : ''} quote prices` : '',
        newPriority: 1,
        locationId: loc ? loc.id : null,
        // Build from quotes adds into the chosen pricing where it's used (the modal
        // warns first); the RFQ handoff still forks a shared pricing.
        updateShared: !!action.updateShared,
      };
      // Same engine as the RFQ→B2B handoff: create a scoped base, or merge into
      // the chosen base — forking it first if it is shared with other companies.
      // With a location, it lands in that location's own base list.
      const msg = applyQuotePricingTransfer(db, companyId, lines, transfer) || 'No prices added';
      return { ...state, db, buildQuotes: null, toast: msg };
    }
    case 'TOAST':
      return { ...state, toast: action.message };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

export const currentCompany = (state) =>
  state.db.companies.find((c) => c.id === state.selectedCompany) || null;
