// Contracts (shown as "Contracts"; called agreements in code): a company's terms —
// its pricing (base + quantity) and order limits — set up and applied together,
// for all its locations or some, from a start date to an optional end date. Saving a
// new one puts it in force: Active, or Scheduled until its start date.
//   Scheduled — saved with a start date still to come; applied on that date.
//   Active    — its pricing and limits are assigned to the company. Saving an
//               active contract applies the change right away as a new version.
//   Expired   — the end date passed: its terms came off and the company is back
//               on the pricing and limits outside the contract.
//   Ended     — ended by hand, or replaced by the next contract; its terms came
//               off. Expired and Ended stay as history.
// A company can have several contracts, each for all its locations or some. A
// location is in one contract at a time: one saved, or saved as a version, over Active
// or Scheduled ones there in time (clashesAt) is allowed — where they overlap, the one
// that starts later runs from its start date (handOver); starting the same day as a
// Scheduled one, the one saved last does (`takesOver`).
// On its start date a contract takes its locations over from the Active ones there,
// whatever their end dates, and from the Scheduled ones starting that day it was saved
// over: one left with no locations ends ("Replaced by …", "… before it started"), one
// with others left keeps those, as a new version.
// Every version keeps a snapshot of its terms as they were then (names and what
// each sets), so any version — and contracts that are over — can be read again.
// A contract's pricing and limits are its own (`forContracts`, `contractId`): made in
// the contract editor, new or copied from the Pricing and Order limits lists
// (copyTerms), with no dates, status or assignments of their own — the contract
// decides who gets them and when. They aren't in those lists, and each is in one
// contract only. They're edited in the contract editor, staged there (`staged`) and
// saved with the contract (saveStagedTerms): saving a live one applies the edits as a
// new version. Elsewhere they can't be taken off where it applies (missingTerms /
// newlyBroken); editing one from a company or location page opens its contract.
// In production a daily job starts and expires contracts (syncContractDates) and
// reminds the merchant reminderDays before the end date; Extend moves the end date
// and keeps the terms, as a new version. The demo's "today" is TODAY.
// Ending a contract takes off only what it added.
import { addPricingToLocations, removeCompanySlot, companySlotArray, demoPolicyId } from './dbHelpers.js';
import { hasOwnSlot, slotIds, scopeLabel, ruleAdjustmentLabel, ruleValuesSummary, ruleValues, ruleField, productVariants, TODAY } from './pricing.js';
import { money2 } from './format.js';
import { limitKey, limitSummary, limitLevel, isD2CLimit, limitRules, defaultLimitMessage } from './limits.js';
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
// `between` joins the two dates: " – " by default, " to " where the copy says so
// (the contract viewer).
export function agreementDatesLabel(ag, between = ' – ') {
  if (!ag.startDate) return ag.endDate ? `Until ${fmtDay(ag.endDate)}` : 'No dates';
  return ag.endDate ? `${fmtDay(ag.startDate)}${between}${fmtDay(ag.endDate)}` : `From ${fmtDay(ag.startDate)}, no end date`;
}

export const PAST_STATUSES = ['Expired', 'Ended'];
// Activated: Scheduled or Active.
export const isLive = (ag) => ag?.status === 'Active' || ag?.status === 'Scheduled';

const companyOf = (db, ag) => (db.companies || []).find((c) => c.id === ag.companyId) || null;
// The company's Active contracts, and its next ones (Scheduled).
export const activeAgreements = (db, companyId) => (db.agreements || []).filter((a) => a.companyId === companyId && a.status === 'Active');
export const nextAgreements = (db, companyId) => (db.agreements || []).filter((a) => a.companyId === companyId && a.status === 'Scheduled');
// The company's contracts that aren't over: Active first, then Scheduled.
const OPEN_ORDER = { Active: 0, Scheduled: 1 };
export const openAgreements = (db, companyId) =>
  [...activeAgreements(db, companyId), ...nextAgreements(db, companyId)].sort(
    (a, b) => OPEN_ORDER[a.status] - OPEN_ORDER[b.status] || String(a.number).localeCompare(String(b.number)),
  );
// When it last changed: saved or given a new version (`updatedAt`), or, for a seeded
// one, its latest version entry.
export const lastChange = (ag) => ag.updatedAt || ag.history?.[0]?.date || '';
// The Active contract at a location.
export const activeAt = (db, company, locationId) => activeAgreements(db, company.id).find((a) => appliesAt(company, a, locationId)) || null;
// A new contract can always be set up: one overlapping Active or Scheduled contracts at
// its locations takes those locations over when it goes live (handOver).
export const canCreateAgreement = (db, companyId) => (db.companies || []).some((c) => c.id === companyId);

// The company's other contracts that keep `ag` from having a location — a location
// is in one contract at a time (null: a company without locations). A started one
// (`started`): another Active one there, or a Scheduled one in its dates. Any other:
// an Active or Scheduled one there in force on its dates — it can only start after
// that one ends. `dates` stands in for its own dates.
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

// Saving `ag` (a new one, or a version of it) over the contracts it overlaps
// (agreementClashes): where they overlap, the one that starts later runs, and the one
// before it runs until that day. `from` is `ag`'s start date, or today once it has
// started. Neither's end date changes: on the later start date (takeEffect) the one
// before, left with no other locations, ends ("Replaced by …"), otherwise it keeps
// those and the shared ones move. A Scheduled one starting on `from` too (`before`):
// `ag`, saved last, runs there — on that day that one ends before it started, or
// gives those locations up.
export function overlapHandover(db, ag, started) {
  const c = companyOf(db, ag);
  if (!c) return [];
  const from = started ? TODAY : ag.startDate;
  return agreementClashes(db, ag, started).map((old) => ({
    old,
    shared: sharedLocations(c, old, ag),
    kept: keptLocations(c, old, ag),
    from,
    before: old.status === 'Scheduled' && old.startDate === from,
  }));
}
// Saving it over them, before its own terms go on (mutates `db`): what happens today
// — an Active one it replaces right away. A later start date is takeEffect's, on that
// day; a Scheduled one starting the same day is noted (`takesOver`, taken off that
// one's) for then.
export function handOver(db, ag, started) {
  overlapHandover(db, ag, started).forEach(({ old, shared, kept, from, before }) => {
    if (before) {
      ag.takesOver = [...new Set([...(ag.takesOver || []), old.id])];
      old.takesOver = (old.takesOver || []).filter((id) => id !== ag.id);
      return;
    }
    if (old.status !== 'Active' || from > TODAY) return;
    if (!kept.length) {
      closeAgreement(db, old, 'Ended', `Replaced by ${ag.number}`);
      return;
    }
    unapplyAgreement(db, old);
    old.locationIds = kept.map((l) => l.id);
    applyAgreement(db, old);
    addVersion(db, old, `${namesOf(shared)} moved to ${ag.number}`);
  });
}

// The Overlaps box (Activate / Save as version) and Extend's Overlaps banner: one line
// per contract — where they share locations, and its dates there ("Hanoi is in CT-301
// until Aug 20, 2026.", "Can Tho is in CT-304 from Feb 1, 2027 until Jan 31, 2028.");
// two at most, then "… and N more". `list`: [{ old, shared }].
export function overlapLines(company, list) {
  const line = ({ old, shared }) => {
    const where = shared.length ? namesOf(shared) : company.name;
    const is = shared.length <= 1 ? 'is' : 'are';
    if (old.status === 'Scheduled') return `${where} ${is} in ${old.number} from ${fmtDay(old.startDate)}${old.endDate ? ` until ${fmtDay(old.endDate)}` : ''}.`;
    return old.endDate ? `${where} ${is} in ${old.number} until ${fmtDay(old.endDate)}.` : `${where} ${is} in ${old.number}, which has no end date.`;
  };
  return list.length > 2 ? [...list.slice(0, 2).map(line), `… and ${list.length - 2} more`] : list.map(line);
}
// "Overlaps 1 contract", "Overlaps 3 contracts".
export const overlapsHeading = (n) => `Overlaps ${n} contract${n === 1 ? '' : 's'}`;

// The Active contracts sharing a location with `ag` and still in force on its start
// date: when it starts, it takes those locations over.
export function takenOver(db, ag) {
  const c = companyOf(db, ag);
  if (!c) return [];
  return activeAgreements(db, ag.companyId).filter(
    (a) => a.id !== ag.id && overlaps(c, a, ag) && (!a.endDate || !ag.startDate || ag.startDate <= addDay(a.endDate)),
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
    locationIds: null, // null = all locations; array = only those
    // "Automatically apply this contract to locations added later" (from Shopify or
    // by hand): on by default for all locations, off for some.
    applyLater: true,
    status: null, // not saved yet: saving makes it Active or Scheduled
    startDate: defaultStartDate(db, company?.id),
    endDate: '', // '' = no end date
    version: 0,
    // Its pricing and limits apply on its dates, whatever their own.
    terms: { base: [], quantity: [], limits: [] },
    history: [],
  };
}
// Do locations added to its company later join it? Contracts saved before the choice
// existed: those on all locations do.
export const addsLaterLocations = (ag) => ag.applyLater ?? !ag.locationIds;

// A new contract with another one's terms and locations — `ag` can be open or over:
// its own copies of that one's pricing and limits (staged until it's saved), and the
// locations its company still has. Its start date follows the Active contracts at
// those locations, as a new one's does; no end date. { draft, staged }
export function duplicateAgreement(db, ag) {
  const c = companyOf(db, ag);
  const locationIds = ag.locationIds ? ag.locationIds.filter((id) => (c?.locations || []).some((l) => l.id === id)) : null;
  const draft = {
    ...newAgreement(db, c),
    name: ag.name ? `Copy of ${ag.name}` : '',
    locationIds,
    applyLater: addsLaterLocations(ag),
    startDate: defaultStartDate(db, ag.companyId, locationIds),
  };
  const staged = noStagedTerms();
  ['base', 'quantity', 'limits'].forEach((key) => copyTerms(db, draft, staged, key, ag.terms[key]));
  return { draft, staged };
}

// ── A contract's own pricing and limits ───────────────────────────────────────
// What a pricing or limit has of its own that the contract decides instead: dates,
// status and who gets it.
const CONTRACT_PRICING = { forContracts: true, audienceType: 'b2b', status: 'Active', validityType: 'evergreen', startDate: '', hasEndDate: false, endDate: '', b2bCompanyIds: [], b2bLocationKeys: [], customerTarget: 'none', assignmentTargetIds: [] };
const CONTRACT_LIMIT = { forContracts: true, audienceType: 'b2b', storeWide: false, companyIds: [], locationKeys: [], contractAt: {}, customerTarget: 'all', customerTargetIds: [], status: 'Active', startDate: null, endDate: null };
const copyOf = (x) => JSON.parse(JSON.stringify(x));
export const asContractPricing = (p) => ({ ...copyOf(p), ...CONTRACT_PRICING });
export const asContractLimit = (l) => ({ ...copyOf(l), ...CONTRACT_LIMIT, createdAt: TODAY, updatedAt: TODAY });
// The contract editor's pricing and limits not saved yet: id → the term as edited,
// or a new one.
export const noStagedTerms = () => ({ policies: {}, limits: {} });
// The db with those in place, as the contract editor shows them.
export function withStagedTerms(db, staged) {
  const over = (list, map) => {
    const terms = Object.values(map || {});
    if (!terms.length) return list;
    return [...list.map((x) => map[x.id] || x), ...terms.filter((x) => !list.some((y) => y.id === x.id))];
  };
  return staged ? { ...db, policies: over(db.policies || [], staged.policies), limits: over(db.limits || [], staged.limits) } : db;
}
export function newLimitId(db) {
  let n = Date.now();
  while ((db.limits || []).some((l) => l.id === `ol${n}`)) n += 1;
  return `ol${n}`;
}
// Copies of pricing or limits (`ids`, in the terms' `key`: base, quantity or limits)
// as the draft's own, staged until it's saved (mutates `draft` and `staged`).
export function copyTerms(db, draft, staged, key, ids) {
  const isLimit = key === 'limits';
  ids.forEach((id) => {
    const all = withStagedTerms(db, staged);
    const from = (isLimit ? all.limits : all.policies).find((x) => x.id === id);
    if (!from) return;
    const copy = isLimit ? { ...asContractLimit(from), id: newLimitId(all) } : { ...asContractPricing(from), id: demoPolicyId(all) };
    delete copy.contractId;
    staged[isLimit ? 'limits' : 'policies'][copy.id] = copy;
    draft.terms = { ...draft.terms, [key]: [...draft.terms[key], copy.id] };
  });
}
// Saving the contract: its staged pricing and limits go in the lists as its own — the
// ones its terms still name. A limit keeps where the contract put it (its companies
// and locations), which the editor doesn't set. Then its own ones it no longer names
// (taken out in the editor) go. Mutates `db`.
export function saveStagedTerms(db, ag, staged) {
  const ids = termIds(ag);
  const put = (key, map, placed = []) =>
    Object.values(map || {})
      .filter((x) => ids.includes(x.id))
      .forEach((x) => {
        const list = db[key] || (db[key] = []);
        const i = list.findIndex((y) => y.id === x.id);
        const term = { ...copyOf(x), forContracts: true, contractId: ag.id };
        if (i < 0) return list.push(term);
        placed.forEach((k) => {
          term[k] = list[i][k];
        });
        list[i] = term;
      });
  put('policies', staged?.policies);
  put('limits', staged?.limits, ['companyIds', 'locationKeys', 'contractAt']);
}
export function dropOwnTerms(db, ag, keep = termIds(ag)) {
  const gone = (x) => x.contractId === ag.id && !keep.includes(x.id);
  db.policies = (db.policies || []).filter((p) => !gone(p));
  db.limits = (db.limits || []).filter((l) => !gone(l));
}
// The contract a pricing or limit is in (its own: one at most).
export const contractOf = (db, id) => (db.agreements || []).find((a) => termIds(a).includes(id)) || null;
// The seed's contracts share some pricing and limits: each gets its own copies, so
// every contract's terms are its own — in its versions too (mutates `db`).
export function ownContractTerms(db) {
  if (!versionFlags().agreements) return db;
  const claimed = new Set();
  (db.agreements || []).forEach((ag) => {
    const moved = {};
    ['base', 'quantity', 'limits'].forEach((key) => {
      const isLimit = key === 'limits';
      if (isLimit && !db.limits) db.limits = [];
      const list = isLimit ? db.limits : db.policies;
      ag.terms[key].forEach((id) => {
        const x = list.find((y) => y.id === id);
        if (!x) return;
        if (x.forContracts && !claimed.has(id)) {
          claimed.add(id);
          x.contractId = ag.id;
          return;
        }
        const copy = { ...(isLimit ? asContractLimit(x) : asContractPricing(x)), id: `${id}-${String(ag.number).toLowerCase()}`, contractId: ag.id };
        list.push(copy);
        claimed.add(copy.id);
        moved[id] = copy.id;
      });
    });
    [ag.terms, ...(ag.history || []).map((h) => h.terms)].filter(Boolean).forEach((t) =>
      ['base', 'quantity', 'limits'].forEach((k) => {
        t[k] = (t[k] || []).map((id) => moved[id] || id);
      }),
    );
  });
  return db;
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
  ag?.status === 'Active' && !!ag.endDate && reminderDays(ag) > 0 && daysUntil(ag.endDate) <= reminderDays(ag) && !takeoverOf(db, ag);

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
// The same, saying whether locations added later (from Shopify or by hand) join it,
// for the contract list, the editor's Overview and the Contract tab: "All locations"
// (every location today, and new ones), "Hanoi, Bac Ninh site + new locations" (some,
// and new ones), or only the names when new ones don't join — every location today
// included — as "3 locations" past two.
export function agreementAppliesToLabel(company, ag) {
  if (!(company.locations || []).length) return agreementScopeLabel(company, ag);
  const later = addsLaterLocations(ag);
  if (later && !scopeLocationIds(company, ag)) return 'All locations';
  const names = scopeLocations(company, ag).map((l) => l.name);
  if (later) return `${names.join(', ')} + new locations`;
  return names.length > 2 ? `${names.length} locations` : names.join(', ');
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

// Locations added to a company later (auto-added from Shopify, or added in the
// app): they join the company's contracts that apply to locations added later; the
// others keep the locations they had (one on all locations now lists them). With
// Auto-add locations off they join none, whatever the contracts say. An
// Active contract they join gives them its terms right away, as a new version
// ("Added <location>"); a Scheduled one adds a version too and gives them its terms
// when it starts. They join the Active and Scheduled ones in that order, leaving out
// one whose dates would overlap a contract they already joined (mutates `db`).
export function joinLaterLocations(db, c, locations) {
  if (!versionFlags().agreements) {
    c.locations = [...(c.locations || []), ...locations];
    return;
  }
  const open = (db.agreements || []).filter((a) => a.companyId === c.id && isLive(a));
  const active = open.filter((a) => a.status === 'Active');
  // Off first: one on all locations sits on the company's list, which the new
  // location would inherit.
  active.forEach((a) => unapplyAgreement(db, a));
  const had = (c.locations || []).map((l) => l.id);
  c.locations = [...(c.locations || []), ...locations];
  const rank = { Active: 0, Scheduled: 1 };
  const meet = (a, b) => a.startDate <= (b.endDate || '9999-12-31') && b.startDate <= (a.endDate || '9999-12-31');
  const joined = [];
  [...open]
    .sort((a, b) => rank[a.status] - rank[b.status] || String(a.startDate).localeCompare(String(b.startDate)))
    .forEach((a) => {
      const joins = !!c.autoAddLocations && addsLaterLocations(a) && !joined.some((x) => meet(a, x));
      if (joins) {
        if (a.locationIds) a.locationIds = [...a.locationIds, ...locations.map((l) => l.id)];
        joined.push(a);
      } else if (!a.locationIds) a.locationIds = had;
    });
  active.forEach((a) => applyAgreement(db, a));
  joined.filter(isLive).forEach((a) => addVersion(db, a, `Added ${joinAnd(locations.map((l) => l.name))}`));
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
// All of it applies before any other pricing there, on the contract's dates whatever
// its own (pricing.js setContractPricing).
export const liveContractPricing = (db) => contractHolderMap(db, (a) => [...a.terms.base, ...a.terms.quantity]);
// The same once the change happens, with `draft` in force (Active).
const withDraftInForce = (db, change, draft) => {
  const copy = afterAgreement(db, change);
  return { ...copy, agreements: [...copy.agreements.filter((a) => a.id !== draft.id), { ...draft, status: 'Active' }] };
};
export const contractPricingAfter = (db, change, draft) => liveContractPricing(withDraftInForce(db, change, draft));
// Where Active contracts give each order limit — location keys, or `companyId::*` for
// all of a company's — with the contract's number (`contractAt`): the limit checks
// rank those above every other limit there (limits.js). Worked out from the
// contracts after every change; a new list only when something moved.
export function stampContractLimits(db) {
  const want = new Map();
  if (versionFlags().agreements) {
    (db.agreements || [])
      .filter((a) => a.status === 'Active')
      .forEach((a) => {
        const c = companyOf(db, a);
        if (!c) return;
        const ids = scopeLocationIds(c, a);
        const keys = ids ? ids.map((lid) => limitKey(c.id, lid)) : [`${c.id}::*`];
        a.terms.limits.forEach((id) => {
          const at = want.get(id) || {};
          keys.forEach((k) => {
            at[k] = a.number;
          });
          want.set(id, at);
        });
      });
  }
  let moved = false;
  const limits = (db.limits || []).map((l) => {
    const at = want.get(l.id) || {};
    if (JSON.stringify(at) === JSON.stringify(l.contractAt || {})) return l;
    moved = true;
    return { ...l, contractAt: at };
  });
  return moved ? { ...db, limits } : db;
}
// The company after the change — to preview what its buyers would pay.
export const companyAfterAgreement = (db, change, companyId) => afterAgreement(db, change).companies.find((c) => c.id === companyId) || null;

// ── Versions ──────────────────────────────────────────────────────────────────
// What a pricing or limit sets, in one line — kept in each version's snapshot. Not
// its own dates: in a contract it follows the contract's.
const range = (r) => `${r.from}${r.to ? `–${r.to}` : '+'} units`;
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
  return [...parts, p.status === 'Inactive' && 'Turned off'].filter(Boolean).join(' · ');
}
export const limitTermSummary = (l, db) => [limitSummary(l, db), l.status !== 'Active' && 'Turned off'].filter(Boolean).join(' · ');

// The contract's terms as they are now, for a version's snapshot: names, what each
// sets in a line, and the whole pricing or limit (`config`, see termSettings), so a
// version — and a contract that's over — can be read again in full.
export function snapshotTerms(db, ag) {
  const c = db.companies.find((x) => x.id === ag.companyId);
  const pol = (id) => db.policies.find((p) => p.id === id);
  const lim = (id) => (db.limits || []).find((l) => l.id === id);
  return {
    name: ag.name,
    startDate: ag.startDate,
    endDate: ag.endDate,
    scope: c ? agreementScopeLabel(c, ag) : '',
    base: ag.terms.base.map(pol).filter(Boolean).map((p) => ({ id: p.id, name: p.name, summary: pricingTermSummary(p), config: copyOf(p) })),
    quantity: ag.terms.quantity.map(pol).filter(Boolean).map((p) => ({ id: p.id, name: p.name, summary: pricingTermSummary(p), config: copyOf(p) })),
    limits: ag.terms.limits.map(lim).filter(Boolean).map((l) => ({ id: l.id, name: l.name, summary: limitTermSummary(l, db), config: copyOf(l) })),
  };
}
// ── Reading a version's terms (ContractVersionModal) ─────────────────────────
// An adjustment as plain text, amounts with cents: "10% off", "$6.90 off", "+5%",
// "Set to $50.00" — or for a fixed price (`fixed`) the price alone, "$6.90".
function adjustText(a, fixed = false) {
  if (!a || a.rule === 'keep' || !Number(a.value)) return 'No change';
  const amount = a.valueType === 'amount' ? money2(a.value) : `${a.value}%`;
  if (a.rule === 'set') return fixed ? amount : `Set to ${amount}`;
  return a.rule === 'increase' ? `+${amount}` : `${amount} off`;
}
// What a pricing covers, mid-sentence: "all products", "3 products", "Contractor assortment".
function scopePhrase(p) {
  const st = p.scopeType || (p.priceKind === 'quantity' ? 'products' : 'all');
  if (st === 'all') return 'all products';
  if (st === 'products') {
    const n = (p.selectedProducts || []).length;
    return `${n} product${n === 1 ? '' : 's'}`;
  }
  return scopeLabel(p);
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const capital = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const isFixed = (a) => a?.rule === 'set';
// A quantity range: "1 to 9 units", "50 units or more".
const rangeText = (r) => (r.to ? `${r.from} to ${r.to} units` : `${r.from} units or more`);

// What a pricing or limit does, in one line, so a contract reads at a glance:
// "10% off all products, 12 rules, 5 fixed prices".
export function termSummary(db, x, isLimit) {
  if (isLimit) return limitSummary(x, db);
  if (x.priceKind === 'quantity') {
    const ranges = (x.volumeRanges || []).filter((r) => Number(r.value));
    const top = ranges.reduce((m, r) => (!m || Number(r.value) > Number(m.value) ? r : m), null);
    return capital([plural((x.volumeRanges || []).length, 'quantity range'), top ? `up to ${adjustText({ rule: 'decrease', valueType: top.valueType, value: top.value })}` : 'no discounts', scopePhrase(x)].join(', '));
  }
  const overrides = Object.values(x.variantAdjustments || {});
  const fixed = overrides.filter(isFixed).length;
  const parts = [
    x.pricingRule && x.pricingRule !== 'keep' ? `${adjustText({ rule: x.pricingRule, valueType: x.valueType, value: x.value })} ${scopePhrase(x)}` : null,
    (x.conditionalRules || []).length ? plural(x.conditionalRules.length, 'rule') : null,
    fixed ? plural(fixed, 'fixed price') : null,
    overrides.length - fixed ? plural(overrides.length - fixed, 'product discount') : null,
  ].filter(Boolean);
  return capital(parts.join(', ')) || 'Shopify prices';
}

// A pricing's or limit's settings, as sections of lines (`text`, under it a `note`,
// and its `value` on the right) — what its editor sets, for reading a version's terms
// in full. A base pricing has two: its pricing rules (the default price first, then
// each rule in order, noted with what it targets) and its product overrides.
const RULE_TARGET = { collection: 'Collection', tag: 'Product tag', vendor: 'Vendor', productType: 'Product type' };
export function termSettings(db, x, isLimit) {
  const section = (label, items) => (items.length ? { label, items } : null);
  if (isLimit) {
    const message = x.message || defaultLimitMessage(x);
    return [
      section('Sets', limitRules(x, db).map((r) => ({ text: r.text }))),
      section('Buyer message', message ? [{ text: `“${message}”`, note: x.message ? null : 'Suggested message' }] : []),
    ].filter(Boolean);
  }
  if (x.priceKind === 'quantity') {
    return [
      section('Products', [{ text: capital(scopePhrase(x)) }]),
      section('Quantity ranges', (x.volumeRanges || []).map((r) => ({ text: rangeText(r), value: adjustText({ rule: 'decrease', valueType: r.valueType, value: r.value }) }))),
      section('Discount off', [{ text: x.volumeBasis === 'base' ? 'The base price' : 'The Shopify price' }]),
    ].filter(Boolean);
  }
  // A product override is keyed by its variant: "Industrial filter, XL · Heavy-duty".
  const variantName = (id) => {
    const product = (db.products || []).find((p) => productVariants(p).some((v) => v.id === id));
    const v = productVariants(product).find((y) => y.id === id);
    return product ? `${product.title}${v && v.title !== 'Default' && productVariants(product).length > 1 ? ` · ${v.title}` : ''}` : id;
  };
  const rules = x.conditionalRules || [];
  const overrides = Object.entries(x.variantAdjustments || {});
  return [
    section('Pricing rules', [
      ...(x.pricingRule && x.pricingRule !== 'keep'
        ? [{ text: capital(scopePhrase(x)), note: 'Default price', value: adjustText({ rule: x.pricingRule, valueType: x.valueType, value: x.value }) }]
        : []),
      ...rules.map((r) =>
        ruleField(r) === 'all'
          ? { text: 'All products', value: adjustText(r) }
          : { text: ruleValues(r).join(', ') || 'Nothing selected', note: RULE_TARGET[ruleField(r)], value: adjustText(r) },
      ),
    ]),
    // A fixed price reads as the price ("$6.90"), a discount as one ("12% off").
    section('Product overrides', overrides.map(([id, a]) => ({ text: variantName(id), value: adjustText(a, true) }))),
  ].filter(Boolean);
}
// A new version: its number, the note and a snapshot of the terms (mutates `ag`).
export function addVersion(db, ag, note, date = TODAY) {
  ag.version = (ag.version || 0) + 1;
  ag.updatedAt = new Date().toISOString();
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
  // Scheduled ones starting that day it was saved over (`takesOver`): it runs there —
  // one left with no locations ends before it started, one with others keeps those.
  (ag.takesOver || []).forEach((id) => {
    const old = (db.agreements || []).find((a) => a.id === id);
    if (!c || !old || old.status !== 'Scheduled' || !overlaps(c, old, ag)) return;
    const kept = keptLocations(c, old, ag);
    if (!kept.length) return closeAgreement(db, old, 'Ended', `Replaced by ${ag.number} before it started`, date);
    const moved = sharedLocations(c, old, ag);
    old.locationIds = kept.map((l) => l.id);
    addVersion(db, old, `${namesOf(moved)} moved to ${ag.number}`, date);
  });
  delete ag.takesOver;
  applyAgreement(db, ag);
  ag.status = 'Active';
}

// The daily job: start Scheduled contracts whose start date has come (replacing the
// Active one), and expire Active ones whose end date has passed (their terms come
// off). Mutates `db`.
export function syncContractDates(db) {
  // By start date; on the same day, the ones saved over others first (takesOver).
  (db.agreements || [])
    .filter((ag) => ag.status === 'Scheduled' && liveStatus(ag) === 'Active')
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)) || (b.takesOver?.length ? 1 : 0) - (a.takesOver?.length ? 1 : 0))
    .forEach((ag) => {
      if (ag.status !== 'Scheduled') return; // ended before it started, by one that took over
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
// A contract's own pricing or limit? None in a version without Contracts.
export const isContractTerm = (x) => !!x?.forContracts && !!versionFlags().agreements;
// The same pricing or limit, leaving out what its contract sets (where a limit applies).
const TERM_PLACED = ['companyIds', 'locationKeys', 'contractAt', 'contractId', 'createdAt', 'updatedAt'];
const canon = (v) =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canon(v[k])]))
      : v;
export const sameTerm = (a, b) => {
  const strip = (x) => Object.fromEntries(Object.entries(x).filter(([k]) => !TERM_PLACED.includes(k)));
  return JSON.stringify(canon(strip(a))) === JSON.stringify(canon(strip(b)));
};

// Terms that won't apply for the contract: turned off. (Their own dates don't
// count: they apply on the contract's.)
export function termWarnings(db, ag) {
  const out = [];
  const check = (x) => {
    if (x && (x.status || 'Active') === 'Inactive') out.push(`${x.name} is turned off`);
  };
  [...ag.terms.base, ...ag.terms.quantity].forEach((id) => check(db.policies.find((p) => p.id === id)));
  ag.terms.limits.forEach((id) => check((db.limits || []).find((l) => l.id === id)));
  return out;
}

// What the storefront shows a buyer: each Active contract, the names of its pricing
// and the ids of its order limits — all of them for the contract's whole term,
// whatever their own dates — published by the B2B app, see persistence.js.
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
        startDate: a.startDate || null,
        endDate: a.endDate || null,
        pricing: [...a.terms.base, ...a.terms.quantity].map((id) => (db.policies || []).find((p) => p.id === id)).filter(Boolean).map((p) => p.name),
        limitIds: a.terms.limits.filter((id) => (db.limits || []).some((l) => l.id === id)),
      };
    });
}

const nameOf = (list, id) => (list || []).find((x) => x.id === id)?.name || id;

// One line on what changed between two versions, for the version history. `db` has
// `next`'s pricing and limits as edited, `before` `prev`'s.
export function agreementChanges(prev, next, db, before = db) {
  const parts = [];
  // Kept ones edited in the contract editor: "Changed Contract Base", or with its new
  // name "Changed Contract Base (now 2027 Base)".
  const edited = (ids, list, was) =>
    ids.flatMap((id) => {
      const now = (list || []).find((x) => x.id === id);
      const then = (was || []).find((x) => x.id === id);
      if (!now || !then || sameTerm(now, then)) return [];
      return [now.name === then.name ? now.name : `${then.name} (now ${now.name})`];
    });
  const diff = (a, b, list, was) => ({
    added: b.filter((x) => !a.includes(x)).map((x) => nameOf(list, x)),
    removed: a.filter((x) => !b.includes(x)).map((x) => nameOf(was, x)),
    changed: edited(a.filter((x) => b.includes(x)), list, was),
  });
  const all = [
    diff([...prev.terms.base, ...prev.terms.quantity], [...next.terms.base, ...next.terms.quantity], db.policies, before.policies),
    diff(prev.terms.limits, next.terms.limits, db.limits, before.limits),
  ];
  const added = all.flatMap((d) => d.added);
  const removed = all.flatMap((d) => d.removed);
  const changed = all.flatMap((d) => d.changed);
  if (added.length) parts.push(`Added ${added.join(', ')}`);
  if (removed.length) parts.push(`Removed ${removed.join(', ')}`);
  if (changed.length) parts.push(`Changed ${changed.join(', ')}`);
  const c = db.companies.find((x) => x.id === next.companyId);
  if (c && agreementScopeLabel(c, prev) !== agreementScopeLabel(c, next)) parts.push(`Now applies to ${agreementScopeLabel(c, next)}`);
  if (addsLaterLocations(prev) !== addsLaterLocations(next)) {
    parts.push(addsLaterLocations(next) ? 'Enabled auto-apply for new locations' : 'Disabled auto-apply for new locations');
  }
  if (prev.name !== next.name) parts.push(`Renamed to ${next.name}`);
  if ((prev.startDate || '') !== (next.startDate || '')) parts.push(`Now starts ${fmtDay(next.startDate)}`);
  if ((prev.endDate || '') !== (next.endDate || '')) parts.push(next.endDate ? `Now ends ${fmtDay(next.endDate)}` : 'No end date now');
  return parts.join(' · ') || 'No changes to terms';
}
// Saving would change nothing: same name, dates, locations and terms.
export function sameAgreement(a, b, db, before = db) {
  const c = db.companies.find((x) => x.id === b.companyId);
  return agreementChanges(a, b, db, before) === 'No changes to terms' && (!c || agreementScopeLabel(c, a) === agreementScopeLabel(c, b));
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
