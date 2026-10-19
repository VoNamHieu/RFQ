// Contracts (shown as "Contracts"; called agreements in code): a company's terms —
// its pricing (base + quantity) and order limits — set up and applied together,
// for all its locations or some, from a start date to an optional end date.
//   Draft     — being set up; nothing applied yet.
//   Scheduled — activated with a start date still to come; applied on that date.
//   Active    — its pricing and limits are assigned to the company. Saving an
//               active contract applies the change right away as a new version.
//   Expired   — the end date passed: its terms came off and the company is back
//               on the pricing and limits outside the contract.
//   Ended     — ended by hand, or replaced by the next contract; its terms came
//               off. Expired and Ended stay as history.
// A company has at most one Active contract, and one next contract (Draft or
// Scheduled) set up ahead beside it: on its start date the next one takes over and
// the Active one ends ("Replaced by …").
// Every version keeps a snapshot of its terms as they were then (names and what
// each sets), so any version — and contracts that are over — can be read again.
// A live contract's pricing and limits change only through it: elsewhere they can't
// be taken off where it applies, turned off or deleted (missingTerms / newlyBroken),
// and editing what one sets adds a version to the contracts holding it
// (recordTermEdit).
// In production a daily job starts and expires contracts (syncContractDates) and
// reminds the merchant RENEW_NOTICE_DAYS before the end date; Renew moves the end
// date and keeps the terms, as a new version. The demo's "today" is TODAY.
// Pricing and limits stay reusable in their libraries and can still be assigned
// directly, outside any contract — ending one takes off only what it added.
import { addPricingToLocations, removeCompanySlot, companySlotArray } from './dbHelpers.js';
import { hasOwnSlot, slotIds, scopeLabel, ruleAdjustmentLabel, ruleValuesSummary, TODAY } from './pricing.js';
import { limitKey, limitSummary, limitLevel, isD2CLimit } from './limits.js';
import { versionFlags } from '../shared/versions.js';

const KINDS = ['base', 'quantity'];
const termIds = (ag) => [...ag.terms.base, ...ag.terms.quantity, ...ag.terms.limits];

export function nextAgreementNumber(db) {
  const max = (db.agreements || []).reduce((m, a) => Math.max(m, Number(String(a.number).replace(/\D/g, '')) || 0), 300);
  return `CT-${max + 1}`;
}

// ── Dates ─────────────────────────────────────────────────────────────────────
// Dates are YYYY-MM-DD, so string comparison matches date order.
export const RENEW_NOTICE_DAYS = 30;
export const fmtDay = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
export const daysUntil = (iso) => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${TODAY}T00:00:00`)) / 86400000);
export const addYear = (iso) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4) === '-02-29' ? '-02-28' : iso.slice(4)}`;
export function addDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// What going live gives it: Scheduled while its start date is still to come.
export const liveStatus = (ag) => (ag.startDate && ag.startDate > TODAY ? 'Scheduled' : 'Active');
export function agreementDatesLabel(ag) {
  if (!ag.startDate) return ag.endDate ? `Until ${fmtDay(ag.endDate)}` : 'No dates';
  return ag.endDate ? `${fmtDay(ag.startDate)} – ${fmtDay(ag.endDate)}` : `From ${fmtDay(ag.startDate)}, no end date`;
}

export const PAST_STATUSES = ['Expired', 'Ended'];
// Activated: Scheduled or Active.
export const isLive = (ag) => ag?.status === 'Active' || ag?.status === 'Scheduled';

// The company's Active contract, if any.
export const activeAgreement = (db, companyId) => (db.agreements || []).find((a) => a.companyId === companyId && a.status === 'Active') || null;
// The company's next contract (Draft or Scheduled), if any — beside an Active one or not.
export const nextAgreement = (db, companyId) =>
  (db.agreements || []).find((a) => a.companyId === companyId && (a.status === 'Draft' || a.status === 'Scheduled')) || null;
// The contract the company's page leads with: the Active one, else the next one.
export const currentAgreement = (db, companyId) => activeAgreement(db, companyId) || nextAgreement(db, companyId);
// A new contract can be set up while the company has no next one yet.
export const canCreateAgreement = (db, companyId) => !nextAgreement(db, companyId);

// A new draft. Beside an Active contract it's the next one: it starts the day after
// the Active one ends (today when that has no end date).
export function newAgreement(db, company) {
  const active = activeAgreement(db, company.id);
  return {
    id: null,
    number: nextAgreementNumber(db),
    name: '',
    companyId: company.id,
    locationIds: null, // null = all locations (and ones added later); array = only those
    status: 'Draft',
    startDate: active?.endDate && addDay(active.endDate) > TODAY ? addDay(active.endDate) : TODAY,
    endDate: '', // '' = no end date
    version: 0,
    terms: { base: [], quantity: [], limits: [] },
    history: [],
  };
}

// The Scheduled contract that takes over from an Active one by the day after it
// ends (or at any time, when it has no end date), if any.
export function takeoverOf(db, ag) {
  const next = nextAgreement(db, ag.companyId);
  if (next?.status !== 'Scheduled') return null;
  return !ag.endDate || next.startDate <= addDay(ag.endDate) ? next : null;
}
// An active contract ending within RENEW_NOTICE_DAYS with nothing set to take over:
// the merchant gets a reminder.
export const expiringSoon = (ag, db) =>
  ag?.status === 'Active' && !!ag.endDate && daysUntil(ag.endDate) <= RENEW_NOTICE_DAYS && !takeoverOf(db, ag);

// ── Scope ─────────────────────────────────────────────────────────────────────
// Picking every location counts as all.
function scopeLocationIds(company, ag) {
  const locs = company.locations || [];
  return ag.locationIds && ag.locationIds.length < locs.length ? ag.locationIds : null;
}
const scopeLocations = (company, ag) => {
  const ids = scopeLocationIds(company, ag);
  return (company.locations || []).filter((l) => !ids || ids.includes(l.id));
};
// Does the contract apply at this location of its company?
export const appliesAt = (company, ag, locationId) => {
  const ids = scopeLocationIds(company, ag);
  return !ids || ids.includes(locationId);
};

export function agreementScopeLabel(company, ag) {
  const ids = scopeLocationIds(company, ag);
  if (!ids) return 'All locations';
  return (company.locations || []).filter((l) => ids.includes(l.id)).map((l) => l.name).join(', ');
}

// ── Applying ──────────────────────────────────────────────────────────────────
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
    // All locations: the company's list, so locations added later get it too. Some:
    // only their own lists — not the company's, so locations outside the contract
    // (and ones added later) never get it, and keep following the company's list.
    addPricingToLocations(c, kind, id, policy?.priority, locIds, !locIds);
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
// `on` on (either can be null) — to show how its limits overlap others before it happens.
export function limitsAfterAgreement(db, { off = null, on = null }) {
  const copy = JSON.parse(JSON.stringify({ companies: db.companies, policies: db.policies, limits: db.limits || [] }));
  if (off) unapplyAgreement(copy, JSON.parse(JSON.stringify(off)));
  if (on) applyAgreement(copy, JSON.parse(JSON.stringify(on)));
  return copy.limits;
}

// ── Versions ──────────────────────────────────────────────────────────────────
// What a pricing or limit sets, in one line — kept in each version's snapshot.
const range = (r) => `${r.from}${r.to ? `–${r.to}` : '+'} units`;
const datesNote = (x) => [x.startDate && `from ${fmtDay(x.startDate)}`, x.endDate && `until ${fmtDay(x.endDate)}`].filter(Boolean).join(' ');
export function pricingTermSummary(p) {
  const parts =
    p.priceKind === 'quantity'
      ? [
          scopeLabel(p),
          (p.volumeRanges || [])
            .filter((r) => Number(r.value))
            .map((r) => `${range(r)}: ${ruleAdjustmentLabel({ rule: 'decrease', valueType: r.valueType, value: r.value })}`)
            .join(', '),
        ]
      : [
          `${ruleAdjustmentLabel({ rule: p.pricingRule, valueType: p.valueType, value: p.value })} · ${scopeLabel(p)}`,
          (p.conditionalRules || []).map((r) => `${ruleValuesSummary(r)}: ${ruleAdjustmentLabel(r)}`).join(', '),
          Object.entries(p.variantAdjustments || {}).map(([v, a]) => `${v}: ${ruleAdjustmentLabel(a)}`).join(', '),
          `Priority ${p.priority ?? 0}`,
        ];
  return [...parts, datesNote(p), p.status === 'Inactive' && 'Turned off'].filter(Boolean).join(' · ');
}
export const limitTermSummary = (l, db) => [limitSummary(l, db), datesNote(l), l.status !== 'Active' && 'Turned off'].filter(Boolean).join(' · ');

// The contract's terms as they are now, for a version's snapshot.
export function snapshotTerms(db, ag) {
  const c = db.companies.find((x) => x.id === ag.companyId);
  const pol = (id) => db.policies.find((p) => p.id === id);
  const lim = (id) => (db.limits || []).find((l) => l.id === id);
  return {
    name: ag.name,
    startDate: ag.startDate,
    endDate: ag.endDate,
    scope: c ? agreementScopeLabel(c, ag) : '',
    base: ag.terms.base.map(pol).filter(Boolean).map((p) => ({ id: p.id, name: p.name, summary: pricingTermSummary(p) })),
    quantity: ag.terms.quantity.map(pol).filter(Boolean).map((p) => ({ id: p.id, name: p.name, summary: pricingTermSummary(p) })),
    limits: ag.terms.limits.map(lim).filter(Boolean).map((l) => ({ id: l.id, name: l.name, summary: limitTermSummary(l, db) })),
  };
}
// A new version: its number, the note and a snapshot of the terms (mutates `ag`).
export function addVersion(db, ag, note, date = TODAY) {
  ag.version = (ag.version || 0) + 1;
  ag.history = [{ version: ag.version, date, note, snapshot: snapshotTerms(db, ag) }, ...(ag.history || [])];
}
// The snapshot a version was saved with (the entry that made it; later ones of the
// same version — started, expired, ended — don't carry one).
export const versionSnapshot = (ag, version) => [...(ag.history || [])].reverse().find((h) => h.version === version && h.snapshot)?.snapshot || null;
// The seed's version entries name their terms by id: snapshot them on load.
export function seedSnapshots(db) {
  (db.agreements || []).forEach((ag) =>
    (ag.history || []).forEach((h) => {
      if (!h.terms || h.snapshot) return;
      h.snapshot = snapshotTerms(db, { ...ag, terms: h.terms });
      delete h.terms;
    }),
  );
  return db;
}

// ── Starting and ending ───────────────────────────────────────────────────────
// Take a contract's terms off and close it (mutates `db`).
export function closeAgreement(db, ag, status, note, date = TODAY) {
  if (ag.status === 'Active') unapplyAgreement(db, ag);
  ag.status = status;
  ag.history = [{ version: ag.version, date, note }, ...(ag.history || [])];
}
// A contract taking effect: the company's Active one (if another) ends — expired
// already if its end date came first — and this one's terms go on (mutates `db`).
export function takeEffect(db, ag, date = TODAY) {
  const old = activeAgreement(db, ag.companyId);
  if (old && old.id !== ag.id) {
    if (old.endDate && addDay(old.endDate) < date) closeAgreement(db, old, 'Expired', 'Expired', addDay(old.endDate));
    else closeAgreement(db, old, 'Ended', `Replaced by ${ag.number}`, date);
  }
  applyAgreement(db, ag);
  ag.status = 'Active';
}

// The daily job: start Scheduled contracts whose start date has come (replacing the
// Active one), and expire Active ones whose end date has passed (their terms come
// off). Mutates `db`.
export function syncContractDates(db) {
  (db.agreements || []).forEach((ag) => {
    if (ag.status !== 'Scheduled' || liveStatus(ag) !== 'Active') return;
    takeEffect(db, ag, ag.startDate);
    ag.history = [{ version: ag.version, date: ag.startDate, note: 'Started' }, ...(ag.history || [])];
  });
  (db.agreements || []).forEach((ag) => {
    if (ag.status === 'Active' && ag.endDate && ag.endDate < TODAY) closeAgreement(db, ag, 'Expired', 'Expired', addDay(ag.endDate));
  });
  return db;
}

// ── Terms held elsewhere ──────────────────────────────────────────────────────
const locationGets = (c, l, kind, id) => (hasOwnSlot(l, kind) ? slotIds(l, kind) : slotIds(c, kind)).includes(id);
// A live contract's terms that aren't in place: deleted or turned off, or — once
// it's Active — no longer reaching every location it applies to.
export function missingTerms(db, ag) {
  const c = (db.companies || []).find((x) => x.id === ag.companyId);
  if (!c) return [];
  const locs = scopeLocations(c, ag);
  const active = ag.status === 'Active';
  const missing = [];
  KINDS.forEach((kind) => ag.terms[kind].forEach((id) => {
    const p = (db.policies || []).find((x) => x.id === id);
    const reaches = locs.length ? locs.every((l) => locationGets(c, l, kind, id)) : slotIds(c, kind).includes(id);
    if (!p || p.status === 'Inactive' || (active && !reaches)) missing.push(id);
  }));
  ag.terms.limits.forEach((id) => {
    const l = (db.limits || []).find((x) => x.id === id);
    const reaches = (loc) => ['company', 'location'].includes(limitLevel(l, c.id, loc.id));
    const covered = l && (locs.length ? locs.every(reaches) : (l.companyIds || []).includes(c.id));
    if (!l || l.status !== 'Active' || isD2CLimit(l) || (active && !covered)) missing.push(id);
  });
  return missing;
}
// The live contracts `next` leaves without a term `prev` had in place — a pricing or
// limit taken off, turned off or deleted outside the contract.
export function newlyBroken(prev, next) {
  return (next.agreements || []).filter(isLive).filter((ag) => {
    const before = (prev.agreements || []).find((a) => a.id === ag.id);
    const was = before && isLive(before) ? missingTerms(prev, before) : [];
    return missingTerms(next, ag).some((id) => !was.includes(id));
  });
}
// The live contracts holding a pricing or limit. None in a version without
// Contracts, so nothing outside them shows or locks for one.
export const contractsHolding = (db, id) =>
  versionFlags().agreements ? (db.agreements || []).filter((a) => isLive(a) && termIds(a).includes(id)) : [];
// The Active contract giving a company — or one of its locations — a pricing or limit.
export function contractGiving(db, company, id, locationId = null) {
  if (!versionFlags().agreements) return null;
  return (
    (db.agreements || []).find(
      (a) => a.status === 'Active' && a.companyId === company.id && termIds(a).includes(id) && (!locationId || appliesAt(company, a, locationId)),
    ) || null
  );
}
// "CT-301 · ABC Construction", for the contracts holding something.
export const contractNames = (db, list) =>
  list.map((a) => `${a.number} · ${(db.companies || []).find((c) => c.id === a.companyId)?.name || 'Company'}`).join(', ');
// Why a term's remove / turn off / delete is locked.
export const lockedTip = (list, verb) => `Part of ${list.map((a) => a.number).join(', ')} · edit the contract to ${verb} it`;

// Editing a pricing or limit live contracts hold: when what it sets (or its name)
// changed, each of them gets a version with the new terms (mutates `db`).
export function recordTermEdit(db, before, after, isLimit) {
  const sum = (x) => (isLimit ? limitTermSummary(x, db) : pricingTermSummary(x));
  if (sum(before) === sum(after) && before.name === after.name) return;
  const note = before.name !== after.name ? `${before.name} renamed to ${after.name}${sum(before) === sum(after) ? '' : ' and changed'}` : `${after.name} changed`;
  contractsHolding(db, after.id).forEach((ag) => addVersion(db, ag, note));
}

// Terms that won't apply for the whole contract: turned off, or dated to start
// after it starts or end before it ends.
export function termWarnings(db, ag) {
  const out = [];
  const check = (x) => {
    if (!x) return;
    if ((x.status || 'Active') === 'Inactive') return out.push(`${x.name} is turned off`);
    if (x.startDate && x.startDate > (ag.startDate || TODAY)) out.push(`${x.name} starts ${fmtDay(x.startDate)}, after the contract starts`);
    if (x.endDate && (!ag.endDate || x.endDate < ag.endDate)) out.push(`${x.name} ends ${fmtDay(x.endDate)}, before the contract ends`);
  };
  [...ag.terms.base, ...ag.terms.quantity].forEach((id) => check(db.policies.find((p) => p.id === id)));
  ag.terms.limits.forEach((id) => check((db.limits || []).find((l) => l.id === id)));
  return out;
}

// What the storefront shows a buyer: each Active contract, its pricing names and
// the ids of its order limits (published by the B2B app, see persistence.js).
export function storefrontContracts(db) {
  return (db.agreements || [])
    .filter((a) => a.status === 'Active')
    .map((a) => {
      const c = (db.companies || []).find((x) => x.id === a.companyId);
      return {
        number: a.number,
        name: a.name,
        version: a.version,
        companyId: a.companyId,
        locationIds: c ? scopeLocationIds(c, a) : a.locationIds,
        dates: agreementDatesLabel(a),
        pricing: [...a.terms.base, ...a.terms.quantity].map((id) => (db.policies || []).find((p) => p.id === id)?.name).filter(Boolean),
        limitIds: a.terms.limits,
      };
    });
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
// Saving would change nothing: same name, dates, locations and terms.
export function sameAgreement(a, b, db) {
  const c = db.companies.find((x) => x.id === b.companyId);
  return agreementChanges(a, b, db) === 'No changes to terms' && (!c || agreementScopeLabel(c, a) === agreementScopeLabel(c, b));
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

// "3 pricings · 1 limit" — the terms still in the libraries.
export function agreementTermCount(db, ag) {
  const t = agreementTermLines(db, ag);
  const pricing = t.base.length + t.quantity.length;
  const limits = t.limits.length;
  return [`${pricing} pricing${pricing === 1 ? '' : 's'}`, `${limits} limit${limits === 1 ? '' : 's'}`].join(' · ');
}
