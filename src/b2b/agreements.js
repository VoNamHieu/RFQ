// Contracts (shown as "Contracts"; called agreements in code): a company's terms —
// its pricing (base + quantity) and order limits — set up and applied together,
// for all its locations or some, from a start date to an optional end date.
//   Inactive  — saved, not activated yet; nothing applied.
//   Scheduled — activated with a start date still to come; applied on that date.
//   Active    — its pricing and limits are assigned to the company. Saving an
//               active contract applies the change right away as a new version.
//   Expired   — the end date passed: its terms came off and the company is back
//               on the pricing and limits outside the contract.
//   Ended     — ended by hand, or replaced by the next contract; its terms came
//               off. Expired and Ended stay as history.
// A company can have several contracts, each for all its locations or some. A
// location is in one contract at a time: an activated one (Active or Scheduled)
// never overlaps another there in time (clashesAt) — a next one starts after the
// Active one ends. Inactive ones are drafts: they hold no location, so any number can
// be set up, as long as none overlaps an Active or Scheduled one at its locations.
// On its start date a next contract takes its locations over from the Active ones
// there: one left with no locations ends ("Replaced by …"), one with others left
// keeps those, as a new version.
// Every version keeps a snapshot of its terms as they were then (names and what
// each sets), so any version — and contracts that are over — can be read again.
// A live contract's pricing and limits change only through it: elsewhere they can't
// be taken off where it applies, turned off or deleted (missingTerms / newlyBroken),
// and editing what one sets adds a version to the contracts holding it
// (recordTermEdit).
// In production a daily job starts and expires contracts (syncContractDates) and
// reminds the merchant reminderDays before the end date; Extend moves the end date
// and keeps the terms, as a new version. The demo's "today" is TODAY.
// Pricing and limits stay reusable in their libraries and can still be assigned
// directly, outside any contract — ending one takes off only what it added.
import { addPricingToLocations, removeCompanySlot, companySlotArray } from './dbHelpers.js';
import { hasOwnSlot, slotIds, scopeLabel, ruleAdjustmentLabel, ruleValuesSummary, TODAY } from './pricing.js';
import { limitKey, limitSummary, limitLevel, isD2CLimit } from './limits.js';
import { versionFlags } from '../shared/versions.js';

const KINDS = ['base', 'quantity'];
const termIds = (ag) => [...ag.terms.base, ...ag.terms.quantity, ...ag.terms.limits];

// Contracts are numbered from CT-1000 on, and a number is never given out again:
// `db.contractSeq` keeps the highest one saved, even once that contract is deleted
// (recordContractNumber).
const numberOf = (number) => Number(String(number).replace(/\D/g, '')) || 0;
export function nextAgreementNumber(db) {
  const max = (db.agreements || []).reduce((m, a) => Math.max(m, numberOf(a.number)), Math.max(999, db.contractSeq || 0));
  return `CT-${max + 1}`;
}
export function recordContractNumber(db, ag) {
  db.contractSeq = Math.max(db.contractSeq || 0, numberOf(ag.number));
}

// ── Dates ─────────────────────────────────────────────────────────────────────
// Dates are YYYY-MM-DD, so string comparison matches date order.
export const RENEW_NOTICE_DAYS = 30;
// A contract shorter than this gets no renewal reminder.
export const MIN_REMINDER_DAYS = 7;
export const fmtDay = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
export const daysUntil = (iso) => daysBetween(TODAY, iso);
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const addDay = (iso) => addDays(iso, 1);
// How long a contract runs, its start and end dates included.
export const termDays = (ag) => daysBetween(ag.startDate, ag.endDate) + 1;
// Extend's default end date: the contract runs one more term of the same length.
export const extendedEndDate = (ag) => addDays(ag.endDate, termDays(ag));
// The renewal reminder starts RENEW_NOTICE_DAYS before the end date, or halfway
// through a contract shorter than twice that; one shorter than MIN_REMINDER_DAYS
// gets none (0).
export function reminderDays(ag) {
  const days = termDays(ag);
  return days < MIN_REMINDER_DAYS ? 0 : Math.min(RENEW_NOTICE_DAYS, Math.floor(days / 2));
}
// Do two contracts' dates overlap? No end date runs on.
export const datesOverlap = (a, b) =>
  (!a.endDate || !b.startDate || b.startDate <= a.endDate) && (!b.endDate || !a.startDate || a.startDate <= b.endDate);
// What going live gives it: Scheduled while its start date is still to come.
export const liveStatus = (ag) => (ag.startDate && ag.startDate > TODAY ? 'Scheduled' : 'Active');
export function agreementDatesLabel(ag) {
  if (!ag.startDate) return ag.endDate ? `Until ${fmtDay(ag.endDate)}` : 'No dates';
  return ag.endDate ? `${fmtDay(ag.startDate)} – ${fmtDay(ag.endDate)}` : `From ${fmtDay(ag.startDate)}, no end date`;
}

export const PAST_STATUSES = ['Expired', 'Ended'];
// Activated: Scheduled or Active.
export const isLive = (ag) => ag?.status === 'Active' || ag?.status === 'Scheduled';
// A live contract left without pricing or order limits (one switched to D2C came off
// it) keeps its status, dates and locations, flagged "No terms" until terms are added
// or it's over. It gets no reminder and doesn't show on the storefront.
export const noTerms = (ag) => isLive(ag) && !termIds(ag).length;

const companyOf = (db, ag) => (db.companies || []).find((c) => c.id === ag.companyId) || null;
// The company's Active contracts, and its next ones (Inactive or Scheduled).
export const activeAgreements = (db, companyId) => (db.agreements || []).filter((a) => a.companyId === companyId && a.status === 'Active');
export const nextAgreements = (db, companyId) =>
  (db.agreements || []).filter((a) => a.companyId === companyId && (a.status === 'Inactive' || a.status === 'Scheduled'));
// The company's contracts that aren't over: Active first, then Scheduled, then Inactive.
const OPEN_ORDER = { Active: 0, Scheduled: 1, Inactive: 2 };
export const openAgreements = (db, companyId) =>
  [...activeAgreements(db, companyId), ...nextAgreements(db, companyId)].sort(
    (a, b) => OPEN_ORDER[a.status] - OPEN_ORDER[b.status] || String(a.number).localeCompare(String(b.number)),
  );
// The Active contract at a location.
export const activeAt = (db, company, locationId) => activeAgreements(db, company.id).find((a) => appliesAt(company, a, locationId)) || null;
// A new contract can always be set up: it's saved only while it overlaps no Active or
// Scheduled contract at its locations (clashesAt).
export const canCreateAgreement = (db, companyId) => (db.companies || []).some((c) => c.id === companyId);

// The company's other contracts that keep `ag` from having a location — a location
// is in one contract at a time (null: a company without locations). A started one
// (`started`): another Active one there, or a Scheduled one in its dates. Any other:
// an Active or Scheduled one there in force on its dates — it can only start after
// that one ends. Inactive ones (drafts) never clash. `dates` stands in for its own
// dates.
export function clashesAt(db, company, ag, locationId, started, dates = ag) {
  const here = (a) => a.id !== ag.id && appliesAt(company, a, locationId);
  const active = activeAgreements(db, company.id).filter(here);
  const scheduled = nextAgreements(db, company.id).filter((a) => here(a) && a.status === 'Scheduled' && datesOverlap(a, dates));
  return started ? [...active, ...scheduled] : [...active.filter((a) => datesOverlap(a, dates)), ...scheduled];
}
// The contracts `ag` clashes with at any of its locations, each once.
export function agreementClashes(db, ag, started, dates = ag) {
  const c = companyOf(db, ag);
  if (!c) return [];
  const ids = (c.locations || []).length ? scopeLocations(c, ag).map((l) => l.id) : [null];
  return [...new Set(ids.flatMap((id) => clashesAt(db, c, ag, id, started, dates)))];
}

// The Active contracts sharing a location with `ag` and still in force on its start
// date: when it starts, it takes those locations over.
export function takenOver(db, ag) {
  const c = companyOf(db, ag);
  if (!c) return [];
  return activeAgreements(db, ag.companyId).filter(
    (a) => a.id !== ag.id && overlaps(c, a, ag) && (!a.endDate || !ag.startDate || ag.startDate <= addDay(a.endDate)),
  );
}
// What `ag` starting does to each of them: "replaces CT-301" (it has no other
// locations), "takes Hanoi from CT-310" (it keeps its others).
export function takeoverParts(db, ag) {
  const c = companyOf(db, ag);
  return takenOver(db, ag).map((old) =>
    keptLocations(c, old, ag).length ? `takes ${namesOf(sharedLocations(c, old, ag))} from ${old.number}` : `replaces ${old.number}`,
  );
}
// "a", "a and b", "a, b and c".
export const joinAnd = (parts) => (parts.length < 2 ? parts[0] || '' : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

// A new contract. Where Active or Scheduled contracts hold its locations, it starts
// the day after the last of them ends, so it overlaps none (today when one there has
// no end date). `company` is null when it's picked in the editor.
export function defaultStartDate(db, companyId, locationIds = null) {
  const c = companyOf(db, { companyId });
  if (!c) return TODAY;
  const probe = { id: null, companyId, locationIds };
  const live = (db.agreements || []).filter((a) => a.companyId === companyId && isLive(a) && overlaps(c, a, probe));
  if (live.some((a) => !a.endDate)) return TODAY;
  const ends = live.map((a) => addDay(a.endDate)).filter((d) => d > TODAY).sort();
  return ends[ends.length - 1] || TODAY;
}
export function newAgreement(db, company) {
  return {
    id: null,
    number: nextAgreementNumber(db),
    name: '',
    companyId: company?.id || '',
    locationIds: null, // null = all locations (and ones added later); array = only those
    status: 'Inactive',
    startDate: defaultStartDate(db, company?.id),
    endDate: '', // '' = no end date
    version: 0,
    terms: { base: [], quantity: [], limits: [] },
    // Terms that apply for the contract's own dates here, not theirs ("Use the
    // contract’s dates" — offered where a term's dates don't cover the contract).
    followDates: [],
    history: [],
  };
}
// Does the contract apply this term on its own dates instead of the term's?
export const followsContractDates = (ag, id) => (ag?.followDates || []).includes(id);

// A new contract with another one's terms and locations — `ag` can be open or over:
// the pricing and limits still in the libraries (and still offered for a contract),
// and the locations its company still has. Its start date follows the Active
// contracts at those locations, as a new one's does; no end date.
export function duplicateAgreement(db, ag) {
  const c = companyOf(db, ag);
  const pricing = (id) => (db.policies || []).some((p) => p.id === id && p.audienceType !== 'd2c');
  const limit = (id) => (db.limits || []).some((l) => l.id === id && !l.storeWide && !isD2CLimit(l));
  const locationIds = ag.locationIds ? ag.locationIds.filter((id) => (c?.locations || []).some((l) => l.id === id)) : null;
  return {
    ...newAgreement(db, c),
    name: ag.name ? `Copy of ${ag.name}` : '',
    locationIds,
    startDate: defaultStartDate(db, ag.companyId, locationIds),
    terms: { base: ag.terms.base.filter(pricing), quantity: ag.terms.quantity.filter(pricing), limits: ag.terms.limits.filter(limit) },
    followDates: (ag.followDates || []).filter((id) => pricing(id) || limit(id)),
  };
}

// A Scheduled contract that takes over (some of) an Active one's locations by the
// day after it ends (or at any time, when it has no end date), if any.
export function takeoverOf(db, ag) {
  const c = companyOf(db, ag);
  return (
    nextAgreements(db, ag.companyId).find(
      (n) => n.status === 'Scheduled' && c && overlaps(c, n, ag) && (!ag.endDate || n.startDate <= addDay(ag.endDate)),
    ) || null
  );
}
// An active contract ending within its reminderDays with nothing set to take over:
// the merchant gets a reminder.
export const expiringSoon = (ag, db) =>
  ag?.status === 'Active' && !noTerms(ag) && !!ag.endDate && reminderDays(ag) > 0 && daysUntil(ag.endDate) <= reminderDays(ag) && !takeoverOf(db, ag);

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
// The locations two of a company's contracts share, and those `a` keeps beside `b`.
export const sharedLocations = (company, a, b) => scopeLocations(company, a).filter((l) => appliesAt(company, b, l.id));
export const keptLocations = (company, a, b) => scopeLocations(company, a).filter((l) => !appliesAt(company, b, l.id));
// Do they share a location? (A company without locations: always.)
export const overlaps = (company, a, b) => !(company.locations || []).length || sharedLocations(company, a, b).length > 0;
export const namesOf = (locations) => joinAnd(locations.map((l) => l.name));

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
  // Remember what this adds to each limit, so ending it takes off only that. One on
  // the contract's dates also gets where it does (`contractDatesAt`, read by the
  // limit checks in limits.js): its locations, or `companyId::*` for all of them.
  ag.limitsAdded = {};
  ag.terms.limits.forEach((id) => {
    const l = (db.limits || []).find((x) => x.id === id);
    if (!l) return;
    const added = locIds
      ? { companyIds: [], locationKeys: locIds.map((lid) => limitKey(c.id, lid)).filter((k) => !(l.locationKeys || []).includes(k)) }
      : { companyIds: (l.companyIds || []).includes(c.id) ? [] : [c.id], locationKeys: [] };
    l.companyIds = [...(l.companyIds || []), ...added.companyIds];
    l.locationKeys = [...(l.locationKeys || []), ...added.locationKeys];
    const followKeys = followsContractDates(ag, id)
      ? (locIds ? locIds.map((lid) => limitKey(c.id, lid)) : [`${c.id}::*`]).filter((k) => !(l.contractDatesAt || []).includes(k))
      : [];
    l.contractDatesAt = [...(l.contractDatesAt || []), ...followKeys];
    ag.limitsAdded[id] = { ...added, followKeys };
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
    l.contractDatesAt = (l.contractDatesAt || []).filter((k) => !(added.followKeys || []).includes(k));
  });
}

// The companies and order limits as they'd be after taking `off` off its company
// and putting `on` on (either can be null) — or after `start` takes effect, taking
// its locations over from the Active contracts there — on a copy.
function afterAgreement(db, { off = null, on = null, start = null }) {
  const copy = JSON.parse(JSON.stringify({ companies: db.companies, policies: db.policies, limits: db.limits || [], agreements: db.agreements || [] }));
  if (off) unapplyAgreement(copy, JSON.parse(JSON.stringify(off)));
  if (on) applyAgreement(copy, JSON.parse(JSON.stringify(on)));
  if (start) takeEffect(copy, JSON.parse(JSON.stringify(start)));
  return copy;
}
// Pricing each company and location gets from its Active contracts, picked by
// `idsOf(contract)`: holder id (company or location) → pricing ids. None in a
// version without Contracts.
function contractHolderMap(db, idsOf) {
  const map = {};
  if (!versionFlags().agreements) return map;
  const add = (holderId, ids) => {
    map[holderId] = [...(map[holderId] || []), ...ids];
  };
  (db.agreements || [])
    .filter((a) => a.status === 'Active')
    .forEach((a) => {
      const c = companyOf(db, a);
      const ids = idsOf(a);
      if (!c || !ids.length) return;
      // All locations: the company's list, and any location keeping its own.
      if (!scopeLocationIds(c, a)) add(c.id, ids);
      scopeLocations(c, a).forEach((l) => add(l.id, ids));
    });
  return map;
}
// All of it applies before any other pricing there (pricing.js setContractPricing);
// the ones on the contract's dates apply whatever their own dates.
export const liveContractPricing = (db) => contractHolderMap(db, (a) => [...a.terms.base, ...a.terms.quantity]);
export const liveContractDates = (db) => contractHolderMap(db, (a) => [...a.terms.base, ...a.terms.quantity].filter((id) => followsContractDates(a, id)));
// The same once the change happens, with `draft` in force (Active).
const withDraftInForce = (db, change, draft) => {
  const copy = afterAgreement(db, change);
  return { ...copy, agreements: [...copy.agreements.filter((a) => a.id !== draft.id), { ...draft, status: 'Active' }] };
};
export const contractPricingAfter = (db, change, draft) => liveContractPricing(withDraftInForce(db, change, draft));
export const contractDatesAfter = (db, change, draft) => liveContractDates(withDraftInForce(db, change, draft));
// The order limits after the change — to check for conflicts before it happens.
export const limitsAfterAgreement = (db, change) => afterAgreement(db, change).limits;
// The company after the change — to preview what its buyers would pay.
export const companyAfterAgreement = (db, change, companyId) => afterAgreement(db, change).companies.find((c) => c.id === companyId) || null;

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
  const onDates = (x, summary) => (followsContractDates(ag, x.id) ? `${summary} · Uses the contract’s dates` : summary);
  return {
    name: ag.name,
    startDate: ag.startDate,
    endDate: ag.endDate,
    scope: c ? agreementScopeLabel(c, ag) : '',
    base: ag.terms.base.map(pol).filter(Boolean).map((p) => ({ id: p.id, name: p.name, summary: onDates(p, pricingTermSummary(p)) })),
    quantity: ag.terms.quantity.map(pol).filter(Boolean).map((p) => ({ id: p.id, name: p.name, summary: onDates(p, pricingTermSummary(p)) })),
    limits: ag.terms.limits.map(lim).filter(Boolean).map((l) => ({ id: l.id, name: l.name, summary: onDates(l, limitTermSummary(l, db)) })),
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
// A contract taking effect: it takes its locations over from the company's Active
// contracts there — one left with none ends (expired already if its end date came
// first), one with others left keeps those as a new version — and its terms go on
// (mutates `db`).
export function takeEffect(db, ag, date = TODAY) {
  const c = companyOf(db, ag);
  activeAgreements(db, ag.companyId)
    .filter((old) => old.id !== ag.id && c && overlaps(c, old, ag))
    .forEach((old) => {
      if (old.endDate && addDay(old.endDate) < date) return closeAgreement(db, old, 'Expired', 'Expired', addDay(old.endDate));
      const kept = keptLocations(c, old, ag);
      if (!kept.length) return closeAgreement(db, old, 'Ended', `Replaced by ${ag.number}`, date);
      // Run out by then: it expires as it is (syncContractDates), with all its locations.
      if (old.endDate && old.endDate < date) return;
      const moved = sharedLocations(c, old, ag);
      unapplyAgreement(db, old);
      old.locationIds = kept.map((l) => l.id);
      applyAgreement(db, old);
      addVersion(db, old, `${namesOf(moved)} moved to ${ag.number}`, date);
    });
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
// The Active contracts giving a company — or any of these locations — a pricing.
export function contractsGiving(db, company, id, locationIds = null) {
  if (!versionFlags().agreements) return [];
  return (db.agreements || []).filter(
    (a) => a.status === 'Active' && a.companyId === company.id && termIds(a).includes(id) && (!locationIds || locationIds.some((l) => appliesAt(company, a, l))),
  );
}
// The Inactive contracts holding a pricing or limit: deleting it takes it off them.
export const draftsHolding = (db, id) =>
  versionFlags().agreements ? (db.agreements || []).filter((a) => a.status === 'Inactive' && termIds(a).includes(id)) : [];
// The contracts that aren't over holding a pricing or limit (Active, Scheduled or
// Inactive): switching it to D2C Wholesale takes it off all of them (dropTerm).
export const openContractsHolding = (db, id) =>
  versionFlags().agreements ? (db.agreements || []).filter((a) => (isLive(a) || a.status === 'Inactive') && termIds(a).includes(id)) : [];
// The ones it's the last term of: they'd be left with no terms.
export const lastTermOf = (db, id) => openContractsHolding(db, id).filter((a) => termIds(a).length === 1);
// Take a pricing or limit off every contract that isn't over (it went D2C, where
// contracts don't reach); a live one records it as a new version. Its assignments
// already came off with the switch (mutates `db`).
export function dropTerm(db, id) {
  const name = nameOf([...(db.policies || []), ...(db.limits || [])], id);
  openContractsHolding(db, id).forEach((ag) => {
    ag.terms = { base: ag.terms.base.filter((x) => x !== id), quantity: ag.terms.quantity.filter((x) => x !== id), limits: ag.terms.limits.filter((x) => x !== id) };
    ag.followDates = (ag.followDates || []).filter((x) => x !== id);
    KINDS.forEach((kind) => {
      if (ag.pricingAdded?.[kind]) delete ag.pricingAdded[kind][id];
    });
    const lim = (db.limits || []).find((l) => l.id === id);
    const followKeys = ag.limitsAdded?.[id]?.followKeys || [];
    if (lim) lim.contractDatesAt = (lim.contractDatesAt || []).filter((k) => !followKeys.includes(k));
    if (ag.limitsAdded) delete ag.limitsAdded[id];
    if (isLive(ag)) addVersion(db, ag, `Removed ${name}`);
  });
}
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

const termSummary = (db, x, isLimit) => (isLimit ? limitTermSummary(x, db) : pricingTermSummary(x));
// Do live contracts holding a pricing or limit record this edit: a change to what it
// sets, or to its name?
export const termChanged = (db, before, after, isLimit) =>
  termSummary(db, before, isLimit) !== termSummary(db, after, isLimit) || before.name !== after.name;
// Editing a pricing or limit live contracts hold: when what it sets (or its name)
// changed, each of them gets a version with the new terms (mutates `db`).
export function recordTermEdit(db, before, after, isLimit) {
  if (!termChanged(db, before, after, isLimit)) return;
  const same = termSummary(db, before, isLimit) === termSummary(db, after, isLimit);
  const note = before.name !== after.name ? `${before.name} renamed to ${after.name}${same ? '' : ' and changed'}` : `${after.name} changed`;
  contractsHolding(db, after.id).forEach((ag) => addVersion(db, ag, note));
}

// A term dated to start after `from` (when the contract starts) or to end before the
// contract ends; `label` names the contract.
export function termDateWarnings(x, ag, from = ag.startDate || TODAY, label = 'the contract') {
  const out = [];
  if (x.startDate && x.startDate > from) out.push(`${x.name} starts ${fmtDay(x.startDate)}, after ${label} starts`);
  if (x.endDate && (!ag.endDate || x.endDate < ag.endDate)) out.push(`${x.name} ${x.endDate < TODAY ? 'ended' : 'ends'} ${fmtDay(x.endDate)}, before ${label} ends`);
  return out;
}
// A term its own dates leave out today — not started yet, or past its end date — as
// "Starts Aug 5, 2026" / "Ended Aug 1, 2026"; null while it's in its dates.
export function termOutOfDates(x, at = TODAY) {
  if (x.startDate && x.startDate > at) return `Starts ${fmtDay(x.startDate)}`;
  if (x.endDate && x.endDate < at) return `Ended ${fmtDay(x.endDate)}`;
  return null;
}
// From when a term's dates are checked against a contract: its start date, or today
// once it has started (what's past doesn't matter any more).
export const coverFrom = (ag) => (ag.status === 'Active' ? (ag.startDate > TODAY ? ag.startDate : TODAY) : ag.startDate || TODAY);
// Where a term's own dates don't cover the contract (from `from` to its end), for
// its row on the Contract tab: "Ended Jul 20, 2026", "Starts Aug 5, 2026", "Ends
// Aug 10, 2026". None for one on the contract's dates.
export function termDateBadges(x, ag, from = coverFrom(ag)) {
  if (!x || followsContractDates(ag, x.id)) return [];
  const out = [];
  if (x.endDate && x.endDate < TODAY) out.push(`Ended ${fmtDay(x.endDate)}`);
  if (x.startDate && x.startDate > from) out.push(`Starts ${fmtDay(x.startDate)}`);
  if (x.endDate && x.endDate >= TODAY && (!ag.endDate || x.endDate < ag.endDate)) out.push(`Ends ${fmtDay(x.endDate)}`);
  return out;
}
// Terms that won't apply for the whole contract: turned off, or dated to start
// after it starts or end before it ends (from `from` on; not ones on its dates).
export function termWarnings(db, ag, from = coverFrom(ag)) {
  const out = [];
  const check = (x) => {
    if (!x) return;
    if ((x.status || 'Active') === 'Inactive') return out.push(`${x.name} is turned off`);
    if (!followsContractDates(ag, x.id)) out.push(...termDateWarnings(x, ag, from));
  };
  [...ag.terms.base, ...ag.terms.quantity].forEach((id) => check(db.policies.find((p) => p.id === id)));
  ag.terms.limits.forEach((id) => check((db.limits || []).find((l) => l.id === id)));
  return out;
}

// What the storefront shows a buyer: each Active contract with terms, the names of
// its pricing in their dates and the ids of its order limits in theirs — or on the
// contract's dates (`followIds`) — published by the B2B app, see persistence.js.
export function storefrontContracts(db) {
  const applies = (a) => (x) => x && (followsContractDates(a, x.id) || !termOutOfDates(x));
  return (db.agreements || [])
    .filter((a) => a.status === 'Active' && !noTerms(a))
    .map((a) => {
      const c = (db.companies || []).find((x) => x.id === a.companyId);
      return {
        number: a.number,
        name: a.name,
        version: a.version,
        companyId: a.companyId,
        locationIds: c ? scopeLocationIds(c, a) : a.locationIds,
        dates: agreementDatesLabel(a),
        startDate: a.startDate || null,
        endDate: a.endDate || null,
        pricing: [...a.terms.base, ...a.terms.quantity].map((id) => (db.policies || []).find((p) => p.id === id)).filter(applies(a)).map((p) => p.name),
        limitIds: a.terms.limits.filter((id) => applies(a)((db.limits || []).find((l) => l.id === id))),
        followIds: a.followDates || [],
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
  // A term kept in both that switched between its own dates and the contract's.
  const kept = termIds(prev).filter((id) => termIds(next).includes(id));
  const nameIn = (id) => nameOf([...(db.policies || []), ...(db.limits || [])], id);
  const onDates = kept.filter((id) => followsContractDates(next, id) && !followsContractDates(prev, id)).map(nameIn);
  const offDates = kept.filter((id) => !followsContractDates(next, id) && followsContractDates(prev, id)).map(nameIn);
  if (onDates.length) parts.push(`${onDates.join(', ')} now ${onDates.length === 1 ? 'uses' : 'use'} the contract’s dates`);
  if (offDates.length) parts.push(`${offDates.join(', ')} ${offDates.length === 1 ? 'uses its' : 'use their'} own dates again`);
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
