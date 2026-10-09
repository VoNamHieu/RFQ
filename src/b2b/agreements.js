// Contracts (shown as "Contracts"; called agreements in code): a company's terms —
// its pricing (base + quantity) and order limits — set up and applied together.
// One current contract per company (Draft, Scheduled or Active), for all its
// locations or some, from a start date to an optional end date.
//   Draft     — being set up; nothing applied yet.
//   Scheduled — activated with a start date still to come; applied on that date.
//   Active    — its pricing and limits are assigned to the company. Saving an
//               active contract applies the change right away as a new version.
//   Expired   — the end date passed: its terms came off and the company is back
//               on the pricing and limits outside the contract.
//   Ended     — ended by hand; its terms came off. Expired and Ended stay as history.
// In production a daily job starts and expires contracts (syncContractDates) and
// reminds the merchant RENEW_NOTICE_DAYS before the end date; Renew moves the end
// date and keeps the terms, as a new version. The demo's "today" is TODAY.
// Pricing and limits stay reusable in their libraries and can still be assigned
// directly, outside any contract — ending one takes off only what it added.
import { addPricingToLocations, removeCompanySlot, companySlotArray } from './dbHelpers.js';
import { hasOwnSlot, slotIds, TODAY } from './pricing.js';
import { limitKey, limitSummary } from './limits.js';

const KINDS = ['base', 'quantity'];

export function nextAgreementNumber(db) {
  const max = (db.agreements || []).reduce((m, a) => Math.max(m, Number(String(a.number).replace(/\D/g, '')) || 0), 300);
  return `CT-${max + 1}`;
}

export function newAgreement(db, company) {
  return {
    id: null,
    number: nextAgreementNumber(db),
    name: '',
    companyId: company.id,
    locationIds: null, // null = all locations (and ones added later); array = only those
    status: 'Draft',
    startDate: TODAY,
    endDate: '', // '' = no end date
    version: 0,
    terms: { base: [], quantity: [], limits: [] },
    history: [],
  };
}

export const PAST_STATUSES = ['Expired', 'Ended'];
// Activated: Scheduled or Active.
export const isLive = (ag) => ag?.status === 'Active' || ag?.status === 'Scheduled';

// The company's current contract (Draft, Scheduled or Active), if any.
export const currentAgreement = (db, companyId) =>
  (db.agreements || []).find((a) => a.companyId === companyId && !PAST_STATUSES.includes(a.status)) || null;

// ── Dates ─────────────────────────────────────────────────────────────────────
// Dates are YYYY-MM-DD, so string comparison matches date order.
export const RENEW_NOTICE_DAYS = 30;
export const fmtDay = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
export const daysUntil = (iso) => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${TODAY}T00:00:00`)) / 86400000);
export const addYear = (iso) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4) === '-02-29' ? '-02-28' : iso.slice(4)}`;
// What going live gives it: Scheduled while its start date is still to come.
export const liveStatus = (ag) => (ag.startDate && ag.startDate > TODAY ? 'Scheduled' : 'Active');
// An active contract ending within RENEW_NOTICE_DAYS: the merchant gets a reminder.
export const expiringSoon = (ag) => ag?.status === 'Active' && !!ag.endDate && daysUntil(ag.endDate) <= RENEW_NOTICE_DAYS;
export function agreementDatesLabel(ag) {
  if (!ag.startDate) return ag.endDate ? `Until ${fmtDay(ag.endDate)}` : 'No dates';
  return ag.endDate ? `${fmtDay(ag.startDate)} – ${fmtDay(ag.endDate)}` : `From ${fmtDay(ag.startDate)}, no end date`;
}

// The daily job: start Scheduled contracts whose start date has come, and expire
// Active ones whose end date has passed (their terms come off). Mutates `db`.
export function syncContractDates(db) {
  (db.agreements || []).forEach((ag) => {
    if (ag.status === 'Scheduled' && liveStatus(ag) === 'Active') {
      applyAgreement(db, ag);
      ag.status = 'Active';
      ag.history = [{ version: ag.version, date: ag.startDate, note: 'Started' }, ...(ag.history || [])];
    }
    if (ag.status === 'Active' && ag.endDate && ag.endDate < TODAY) {
      unapplyAgreement(db, ag);
      ag.status = 'Expired';
      ag.history = [{ version: ag.version, date: ag.endDate, note: 'Expired' }, ...(ag.history || [])];
    }
  });
  return db;
}

// Picking every location counts as all.
function scopeLocationIds(company, ag) {
  const locs = company.locations || [];
  return ag.locationIds && ag.locationIds.length < locs.length ? ag.locationIds : null;
}

export function agreementScopeLabel(company, ag) {
  const ids = scopeLocationIds(company, ag);
  if (!ids) return 'All locations';
  return (company.locations || []).filter((l) => ids.includes(l.id)).map((l) => l.name).join(', ');
}

// Assign an agreement's pricing and limits to its company (mutates `db`).
export function applyAgreement(db, ag) {
  const c = db.companies.find((x) => x.id === ag.companyId);
  if (!c) return;
  const locIds = scopeLocationIds(c, ag);
  // Remember what this adds — to the company's list and to each location's own
  // list (`created`: the location got its own list for it; `inherited`: it already
  // had the pricing from the company) — so ending it takes off only that.
  ag.pricingAdded = { base: {}, quantity: {} };
  KINDS.forEach((kind) => ag.terms[kind].forEach((id) => {
    const policy = db.policies.find((p) => p.id === id);
    const hadCompany = slotIds(c, kind).includes(id);
    const hadOwn = Object.fromEntries((c.locations || []).map((l) => [l.id, hasOwnSlot(l, kind) ? slotIds(l, kind).includes(id) : null]));
    addPricingToLocations(c, kind, id, policy?.priority, locIds);
    ag.pricingAdded[kind][id] = {
      company: !hadCompany && slotIds(c, kind).includes(id),
      locations: (c.locations || [])
        .filter((l) => hadOwn[l.id] !== true && hasOwnSlot(l, kind) && slotIds(l, kind).includes(id))
        .map((l) => ({ id: l.id, created: hadOwn[l.id] === null, inherited: hadOwn[l.id] === null && hadCompany })),
    };
  }));
  // Remember what this adds to each limit, so ending it takes off only that.
  ag.limitsAdded = {};
  ag.terms.limits.forEach((id) => {
    const l = (db.limits || []).find((x) => x.id === id);
    if (!l) return;
    const added = locIds
      ? { companyIds: [], locationKeys: locIds.map((lid) => limitKey(c.id, lid)).filter((k) => !(l.locationKeys || []).includes(k)) }
      : { companyIds: (l.companyIds || []).includes(c.id) ? [] : [c.id], locationKeys: [] };
    l.companyIds = [...(l.companyIds || []), ...added.companyIds];
    l.locationKeys = [...(l.locationKeys || []), ...added.locationKeys];
    ag.limitsAdded[id] = added;
  });
}

// Take an agreement's pricing and limits off its company again (mutates `db`).
export function unapplyAgreement(db, ag) {
  const c = db.companies.find((x) => x.id === ag.companyId);
  if (!c) return;
  const locIds = scopeLocationIds(c, ag);
  const locs = (c.locations || []).filter((l) => !locIds || locIds.includes(l.id));
  const sameIds = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  KINDS.forEach((kind) => ag.terms[kind].forEach((id) => {
    const added = ag.pricingAdded?.[kind]?.[id];
    if (!added) {
      // Activated before this was tracked: take it off the company and every location's own list.
      if (!locIds) removeCompanySlot(c, kind, id);
      locs.forEach((l) => {
        if (!hasOwnSlot(l, kind)) return;
        const own = l.pricing[kind];
        l.pricing[kind] = (Array.isArray(own) ? own : [{ id: own, priority: 1 }]).filter((e) => ((e && e.id) || e) !== id);
      });
      return;
    }
    if (added.company) removeCompanySlot(c, kind, id);
    added.locations.forEach((a) => {
      const l = (c.locations || []).find((x) => x.id === a.id);
      if (!l || !hasOwnSlot(l, kind)) return;
      const keep = a.inherited ? companySlotArray(l, kind) : companySlotArray(l, kind).filter((e) => e.id !== id);
      // An own list made only for this goes back to inheriting the company's, if it still matches.
      l.pricing[kind] = a.created && sameIds(keep.map((e) => e.id), slotIds(c, kind)) ? null : keep;
    });
  }));
  // Only what activating it added: a company or location the limit had before
  // stays. (An agreement activated before this was tracked takes off all of it.)
  ag.terms.limits.forEach((id) => {
    const l = (db.limits || []).find((x) => x.id === id);
    if (!l) return;
    const added = ag.limitsAdded?.[id] || (locIds ? { companyIds: [], locationKeys: locIds.map((lid) => limitKey(c.id, lid)) } : { companyIds: [c.id], locationKeys: [] });
    l.companyIds = (l.companyIds || []).filter((x) => !added.companyIds.includes(x));
    l.locationKeys = (l.locationKeys || []).filter((k) => !added.locationKeys.includes(k));
  });
}

// The order limits as they'd be after taking `off` off its company and putting
// `on` on (either can be null) — to check for conflicts before it happens.
export function limitsAfterAgreement(db, { off = null, on = null }) {
  const copy = JSON.parse(JSON.stringify({ companies: db.companies, policies: db.policies, limits: db.limits || [] }));
  if (off) unapplyAgreement(copy, JSON.parse(JSON.stringify(off)));
  if (on) applyAgreement(copy, JSON.parse(JSON.stringify(on)));
  return copy.limits;
}

const nameOf = (list, id) => (list || []).find((x) => x.id === id)?.name || id;

// One line on what changed between two versions, for the version history.
export function agreementChanges(prev, next, db) {
  const parts = [];
  const diff = (a, b, list) => ({ added: b.filter((x) => !a.includes(x)).map((x) => nameOf(list, x)), removed: a.filter((x) => !b.includes(x)).map((x) => nameOf(list, x)) });
  const all = [
    diff([...prev.terms.base, ...prev.terms.quantity], [...next.terms.base, ...next.terms.quantity], db.policies),
    diff(prev.terms.limits, next.terms.limits, db.limits),
  ];
  const added = all.flatMap((d) => d.added);
  const removed = all.flatMap((d) => d.removed);
  if (added.length) parts.push(`Added ${added.join(', ')}`);
  if (removed.length) parts.push(`Removed ${removed.join(', ')}`);
  const c = db.companies.find((x) => x.id === next.companyId);
  if (c && agreementScopeLabel(c, prev) !== agreementScopeLabel(c, next)) parts.push(`Now applies to ${agreementScopeLabel(c, next)}`);
  if (prev.name !== next.name) parts.push(`Renamed to ${next.name}`);
  if ((prev.startDate || '') !== (next.startDate || '')) parts.push(`Now starts ${fmtDay(next.startDate)}`);
  if ((prev.endDate || '') !== (next.endDate || '')) parts.push(next.endDate ? `Now ends ${fmtDay(next.endDate)}` : 'No end date now');
  return parts.join(' · ') || 'No changes to terms';
}

// Short lines describing the terms, for the agreement document and lists.
export function agreementTermLines(db, ag) {
  const pol = (id) => db.policies.find((p) => p.id === id);
  return {
    base: ag.terms.base.map(pol).filter(Boolean).sort((a, b) => (a.priority || 0) - (b.priority || 0)),
    quantity: ag.terms.quantity.map(pol).filter(Boolean),
    limits: ag.terms.limits.map((id) => (db.limits || []).find((l) => l.id === id)).filter(Boolean).map((l) => ({ limit: l, summary: limitSummary(l, db) })),
  };
}

export function agreementTermCount(ag) {
  const pricing = ag.terms.base.length + ag.terms.quantity.length;
  const limits = ag.terms.limits.length;
  return [`${pricing} pricing${pricing === 1 ? '' : 's'}`, `${limits} limit${limits === 1 ? '' : 's'}`].join(' · ');
}
