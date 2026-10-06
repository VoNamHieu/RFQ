// Agreements: a company's terms — its pricing (base + quantity) and order limits —
// set up and applied together, like a digital contract. One current agreement per
// company (Draft or Active), for all its locations or some.
//   Draft  — being set up; nothing applied yet.
//   Active — Activate assigns its pricing and limits to the company. Saving an
//            active agreement applies the change right away as a new version.
//   Ended  — its terms are taken off the company; it stays as history.
// No dates in v1: an agreement applies from Activate until it's changed or ended.
// Pricing and limits stay reusable in their libraries and can still be assigned
// directly, outside any agreement.
import { addPricingToLocations, removeCompanySlot } from './dbHelpers.js';
import { hasOwnSlot } from './pricing.js';
import { limitKey, limitSummary } from './limits.js';

const KINDS = ['base', 'quantity'];

export function nextAgreementNumber(db) {
  const max = (db.agreements || []).reduce((m, a) => Math.max(m, Number(String(a.number).replace(/\D/g, '')) || 0), 300);
  return `AG-${max + 1}`;
}

export function newAgreement(db, company) {
  return {
    id: null,
    number: nextAgreementNumber(db),
    name: '',
    companyId: company.id,
    locationIds: null, // null = all locations (and ones added later); array = only those
    status: 'Draft',
    version: 0,
    terms: { base: [], quantity: [], limits: [] },
    history: [],
  };
}

// The company's current agreement (Draft or Active), if any.
export const currentAgreement = (db, companyId) =>
  (db.agreements || []).find((a) => a.companyId === companyId && a.status !== 'Ended') || null;

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
  KINDS.forEach((kind) => ag.terms[kind].forEach((id) => {
    const policy = db.policies.find((p) => p.id === id);
    addPricingToLocations(c, kind, id, policy?.priority, locIds);
  }));
  ag.terms.limits.forEach((id) => {
    const l = (db.limits || []).find((x) => x.id === id);
    if (!l) return;
    if (!locIds) l.companyIds = [...new Set([...(l.companyIds || []), c.id])];
    else l.locationKeys = [...new Set([...(l.locationKeys || []), ...locIds.map((lid) => limitKey(c.id, lid))])];
  });
}

// Take an agreement's pricing and limits off its company again (mutates `db`).
export function unapplyAgreement(db, ag) {
  const c = db.companies.find((x) => x.id === ag.companyId);
  if (!c) return;
  const locIds = scopeLocationIds(c, ag);
  const locs = (c.locations || []).filter((l) => !locIds || locIds.includes(l.id));
  KINDS.forEach((kind) => ag.terms[kind].forEach((id) => {
    if (!locIds) removeCompanySlot(c, kind, id);
    // Locations on their own list got it there too; a location that inherits keeps inheriting.
    locs.forEach((l) => {
      if (!hasOwnSlot(l, kind)) return;
      const own = l.pricing[kind];
      l.pricing[kind] = (Array.isArray(own) ? own : [{ id: own, priority: 1 }]).filter((e) => ((e && e.id) || e) !== id);
    });
  }));
  ag.terms.limits.forEach((id) => {
    const l = (db.limits || []).find((x) => x.id === id);
    if (!l) return;
    if (!locIds) l.companyIds = (l.companyIds || []).filter((x) => x !== c.id);
    else l.locationKeys = (l.locationKeys || []).filter((k) => !locIds.some((lid) => k === limitKey(c.id, lid)));
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
