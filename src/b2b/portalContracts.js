// The B2B Portal's contract cards for the prototype's storefront, built the way the
// real portal's backend builds them (qs-b2b-portal backend/api/customer/portal.js),
// here from the B2B app's own data. The B2B app publishes them (persistence.js
// CONTRACTS_KEY) and the storefront falls back to the seed's.
//
// For a company location: { contract, upcoming, proposal, regular }, each null when
// there's none.
//   contract: the Active contract it buys under — { number, name, version, start, end,
//     pricing (names), rules + details + basePricing + quantityPricing (contractRules),
//     limits (each limit's line), limitDetails (contractLimits), prices (Preview
//     prices), history (Version history: contractHistory) }.
//   upcoming: the next Scheduled contract there, the one starting soonest, read-only —
//     as `contract`, without its history.
//   proposal: a contract sent to its buyers to approve (Proposed) there, not expired —
//     the one starting soonest — as `upcoming`.
//   regular: what it buys under outside its contract, for Business account (regularCard).
// Each also carries `startDate`, `approval`, and its buyers' answers and the seller's
// declines, raw (`buyerResponses`, `declines`), for the storefront to work out its
// answer and Activities log (activitiesOf).
import { activeAt, appliesAt, agreementDatesLabel, termSummary, termSettings, liveContractPricing, companyAfterAgreement, contractPricingAfter, fmtDay, responseKey, pendingVersionOf, withStagedTerms, lastUpdateOf, isContractTerm, openChangeRequests } from './agreements.js';
import { kindOf, baseInScope, policyPriceBreakdown, productVariants, resolveDetail, withContractPricing, companyBaseEntries, companyQuantityEntries, hasOwnSlot, basePriceableNow, TODAY } from './pricing.js';
import { limitRules, locationLimits, limitKey } from './limits.js';
import { money } from './format.js';
import { latestBuyerResponse } from './buyerEvents.js';

const policyOf = (db, id) => (db.policies || []).find((p) => p.id === id) || null;
const pricingOf = (db, ag) => [...ag.terms.base, ...ag.terms.quantity].map((id) => policyOf(db, id)).filter(Boolean);
const day = (iso) => (iso ? fmtDay(iso) : null);

// A product, or one of its variants, by name: "Reinforced hose, 12m · 18 m" — the
// variant only when the product has more than one.
const variantTitle = (p, v) => (productVariants(p).length > 1 && v?.title ? `${p.title} · ${v.title}` : p.title);
function variantNamed(db, key) {
  const p = (db.products || []).find((x) => x.sku === key || productVariants(x).some((v) => v.id === key));
  if (!p) return key;
  return variantTitle(p, productVariants(p).find((v) => v.id === key));
}

// How a pricing reads to the buyer (portal.js pricingReader):
//   rows [{on, adjust}]: a quantity pricing's ranges with a discount ("10–49 units" ·
//     "5% off"); a base pricing's adjustment on what it covers ("All products" · "15%
//     off", then `all` is true), then its rules;
//   own [{title, image, adjust}]: a base pricing's products' own prices.
function pricingReader(db) {
  const amount = (valueType, value) => (valueType === 'percentage' ? `${Number(value)}%` : money(Number(value)));
  const adjust = (rule, valueType, value) =>
    !rule || rule === 'keep' || !Number(value)
      ? null
      : rule === 'set'
        ? amount(valueType === 'percentage' ? 'amount' : valueType, value)
        : rule === 'increase'
          ? `+${amount(valueType, value)}`
          : `${amount(valueType, value)} off`;
  const covers = (p) => {
    const st = p.scopeType || 'all';
    if (st === 'all') return 'All products';
    if (st === 'products') {
      const n = (p.selectedProducts || []).length;
      return `${n} product${n === 1 ? '' : 's'}`;
    }
    return [].concat(p.collections || p.collection || []).filter(Boolean).join(' or ') || 'Some products';
  };
  const matches = (r) =>
    (r.conditions || [])
      .map((c) => {
        const values = [].concat(c.values ?? c.value ?? []).filter(Boolean);
        if (c.field === 'all') return 'All products';
        if (!values.length) return null;
        return c.field === 'tag' ? `Tagged ${values.join(' or ')}` : values.join(' or ');
      })
      .filter(Boolean)
      .join(r.match === 'ANY' ? ' or ' : ' and ');

  return (p) => {
    if (kindOf(p) === 'quantity') {
      const rows = (p.volumeRanges || [])
        .filter((r) => Number(r.value) > 0)
        .map((r) => {
          const from = Number(r.from) || 1;
          const to = r.to == null || r.to === '' ? null : Number(r.to);
          const units = to == null ? `${from}+ units` : from === to ? `${from} units` : `${from}–${to} units`;
          return { on: units, adjust: `${amount(r.valueType, r.value)} off` };
        });
      return { rows, own: [], all: false };
    }
    const all = adjust(p.pricingRule, p.valueType, p.value);
    const ruleRows = (p.conditionalRules || []).map((r) => ({ on: matches(r), adjust: adjust(r.rule, r.valueType, r.value) })).filter((r) => r.on && r.adjust);
    const own = Object.entries(p.variantAdjustments || {})
      .filter(([, a]) => adjust(a.rule, a.valueType, a.value))
      .map(([key, a]) => ({ title: variantNamed(db, key), image: null, adjust: adjust(a.rule, a.valueType, a.value) }));
    return { rows: [...(all ? [{ on: covers(p), adjust: all }] : []), ...ruleRows], own, all: !!all };
  };
}

// Each pricing's rule on the card, by pricing name — a quantity pricing's ranges
// ("10–49 units: 5% off · 50+ units: 10% off"), a base pricing's adjustment then how
// many rules ("All products: 15% off · 3 rules") — and every rule, for its View
// details, in `details`: a quantity pricing's also in full as the admin's version
// view words it (`sections`: termSettings — its products, its quantity ranges, the
// price the discount comes off). `basePricing`, `quantityPricing`: which are which (the
// card shows each kind as one line, listed in its View details). `base`, `quantity`:
// the pricings' configs — a contract's terms, or what a location buys under outside
// it (Business account). As portal.js pricingRules.
function pricingRules(db, base, quantity) {
  const read = pricingReader(db);
  const rules = {};
  const details = {};
  quantity.forEach((p) => {
    const { rows } = read(p);
    if (!rows.length) return;
    rules[p.name] = rows.map((r) => `${r.on}: ${r.adjust}`).join(' · ');
    details[p.name] = { rows, own: [], sections: termSettings(db, { ...p, priceKind: 'quantity' }, false) };
  });
  base.forEach((p) => {
    const { rows, own, all } = read(p);
    const parts = [];
    if (all) parts.push(`${rows[0].on}: ${rows[0].adjust}`);
    const n = rows.length - (all ? 1 : 0) + own.length;
    if (n) parts.push(`${n} rule${n === 1 ? '' : 's'}`);
    if (!parts.length) return;
    rules[p.name] = parts.join(' · ');
    details[p.name] = { rows, own };
  });
  return { rules, details, basePricing: base.map((p) => p.name), quantityPricing: quantity.map((p) => p.name) };
}
const contractRules = (db, ag) =>
  pricingRules(
    db,
    ag.terms.base.map((id) => policyOf(db, id)).filter(Boolean),
    ag.terms.quantity.map((id) => policyOf(db, id)).filter(Boolean),
  );

// Its order limits in full, for their View details (portal.js contractLimits).
const contractLimits = (db, ag) =>
  limitCards(
    db,
    ag.terms.limits.map((id) => (db.limits || []).find((l) => l.id === id)).filter((l) => l && l.status === 'Active'),
  );

// Any limits (their configs) in full — a contract's, or the ones a location buys under
// outside it (Business account) — as portal.js limitCards: [{id, text, name, kind,
// rows [{on, note, limit}], quota}], `text` the limit's line; `quota`, an order limit's
// maximum counted per week or month — { period, cap, review (sent for review) } — for
// the Contract card to show what's left of it.
function limitCards(db, limits) {
  const words = (r) =>
    r.key === 'thresholdQty' && r.value != null
      ? `Orders over ${r.value} units are sent for approval`
      : r.key?.startsWith('threshold') && r.value != null
        ? `Orders over ${money(r.value).replace(/\.00$/, '')}${r.key.includes('@') ? ` a ${r.key.split('@')[1]}` : ''} are sent for approval`
        : r.text;
  const PER = { week: 'Each week', month: 'Each month' };
  const many = (list, one, more) => ({ on: list.join(', ') || '—', note: list.length === 1 ? one : more });
  const appliesTo = (r) => {
    if (r.scopeType === 'all') return { on: 'All products', note: null };
    if (r.scopeType === 'collection') return many(Array.isArray(r.selectedCollections) ? r.selectedCollections : r.collection ? [r.collection] : [], 'Collection', 'Collections');
    if (r.scopeType === 'tags') return many(r.selectedTags || [], 'Product tag', 'Product tags');
    if (r.scopeType === 'vendors') return many(r.selectedVendors || [], 'Vendor', 'Vendors');
    if (r.scopeType === 'productTypes') return many(r.selectedProductTypes || [], 'Product type', 'Product types');
    return many((r.selectedProducts || []).map((key) => variantNamed(db, key)), 'Product', 'Products');
  };
  const set = (s) => s && typeof s === 'object' && s.mode !== 'inherit' && s;
  const quantities = (r, review) => {
    const text = [
      set(r.min) && (r.min.mode === 'set' ? `min ${r.min.value}` : 'no minimum'),
      set(r.max) && (r.max.mode === 'set' ? `max ${r.max.value}${review ? ' without review' : ''}` : 'no maximum'),
      set(r.increment) && (r.increment.mode === 'set' ? `multiples of ${r.increment.value}` : 'no pack size'),
    ]
      .filter(Boolean)
      .join(', ');
    return text ? text[0].toUpperCase() + text.slice(1) : '';
  };
  return limits.map((l) => {
    const rules = limitRules(l, db);
    const rows =
      l.kind === 'order'
        ? rules.map((r) => ({ on: PER[r.key?.split('@')[1]] || 'Each order', note: null, limit: words(r) }))
        : rules.map((r) => ({ ...appliesTo(r.rule), limit: quantities(r.rule, l.maxAction === 'review') }));
    // Not when the limit turned its counting badge off (periodBadge).
    const per = l.kind === 'order' && l.periodBadge !== false ? rules.find((r) => r.key?.includes('@') && r.value != null) : null;
    const quota = per ? { period: per.key.split('@')[1], cap: per.value, review: per.key.startsWith('threshold') } : null;
    return { id: l.id, text: rules.map(words).join(' · '), name: l.name, kind: l.kind, rows, ...(quota ? { quota } : {}) };
  });
}

// Its Version history, newest first (portal.js contractHistory): [{version, date,
// note, view}] — `view` that version as the admin's version view reads it from its
// snapshot (name, status, dates, appliesTo, latest, groups, changed: what it changed
// against the version before it, null on the first).
function contractHistory(db, ag, company) {
  const settingsOf = (config, isLimit) => termSettings(db, config, isLimit).filter((sec) => sec.label !== 'Buyer message');
  const configOf = (t, isLimit) => t.config || (isLimit ? db.limits || [] : db.policies || []).find((x) => x.id === t.id);
  const rowsOf = (items, isLimit) =>
    (isLimit ? items || [] : [...(items || [])].sort((a, b) => (configOf(a)?.priority ?? 0) - (configOf(b)?.priority ?? 0))).map((t) => {
      const config = configOf(t, isLimit);
      return {
        id: t.id,
        name: t.name,
        priority: config && !isLimit ? config.priority ?? 0 : null,
        summary: config ? termSummary(db, config, isLimit) : t.summary || '',
        settings: config ? settingsOf(config, isLimit) : [],
      };
    });
  const groupsOf = (snap) => [
    { title: 'Base pricing', terms: rowsOf(snap.base, false) },
    { title: 'Quantity pricing', terms: rowsOf(snap.quantity, false) },
    { title: 'Order limits', terms: rowsOf(snap.limits, true) },
  ];
  const appliesOf = (snap) => (snap.scope && company ? `${snap.scope} of ${company.name}` : snap.scope) || '—';
  const linesChanged = (was, now) => {
    const out = [];
    [...new Set([...was.map((s) => s.label), ...now.map((s) => s.label)])].forEach((section) => {
      const a = was.find((s) => s.label === section)?.items || [];
      const b = now.find((s) => s.label === section)?.items || [];
      if (a.length === 1 && b.length === 1 && !a[0].value && !b[0].value) {
        if (a[0].text !== b[0].text || (a[0].note || '') !== (b[0].note || '')) out.push({ section, text: b[0].text, note: b[0].note || null, before: a[0].text, change: 'Changed' });
        return;
      }
      const key = (it) => `${it.text}|${it.note || ''}`;
      b.forEach((it) => {
        const o = a.find((x) => key(x) === key(it));
        if (!o) out.push({ section, text: it.text, note: it.note || null, value: it.value || null, change: 'Added' });
        else if ((o.value || '') !== (it.value || '')) out.push({ section, text: it.text, note: it.note || null, before: o.value || null, value: it.value || null, change: 'Changed' });
      });
      a.filter((o) => !b.some((it) => key(it) === key(o))).forEach((o) => out.push({ section, text: o.text, note: o.note || null, value: o.value || null, change: 'Removed' }));
    });
    return out;
  };
  const changedOf = (snap, prev) => {
    const flat = (s) => groupsOf(s).flatMap((g) => g.terms.map((t) => ({ ...t, group: g.title })));
    const now = flat(snap);
    const was = flat(prev);
    const terms = [];
    now.forEach((t) => {
      const o = was.find((x) => x.id === t.id);
      if (!o) return terms.push({ name: t.name, was: null, group: t.group, change: 'Added', lines: [] });
      const lines = linesChanged(o.settings, t.settings);
      if (lines.length || o.name !== t.name) terms.push({ name: t.name, was: o.name !== t.name ? o.name : null, group: t.group, change: 'Changed', lines });
    });
    was.filter((o) => !now.some((t) => t.id === o.id)).forEach((o) => terms.push({ name: o.name, was: null, group: o.group, change: 'Removed', lines: [] }));
    const contract = [
      ['Name', prev.name, snap.name],
      ['Dates', agreementDatesLabel(prev, ' to '), agreementDatesLabel(snap, ' to ')],
      ['Applies to', appliesOf(prev), appliesOf(snap)],
    ]
      .filter(([, a, b]) => (a || '') !== (b || ''))
      .map(([label, before, value]) => ({ label, before: before || '—', value: value || '—' }));
    return { contract, terms };
  };
  const viewOf = (snap, version, prev) => ({
    name: snap.name || ag.name,
    status: ag.status,
    dates: agreementDatesLabel(snap, ' to '),
    appliesTo: appliesOf(snap),
    latest: version === ag.version,
    groups: groupsOf(snap),
    changed: prev ? changedOf(snap, prev) : null,
  });
  const history = ag.history || [];
  return history.map((h, i) => {
    const prev = history.slice(i + 1).find((x) => x.snapshot && x.version < h.version);
    return { version: h.version, date: day(h.date) || '', note: h.note || '', view: h.snapshot ? viewOf(h.snapshot, h.version, prev?.snapshot) : null };
  });
}

// Its Preview prices at the location, as the admin's contract editor → Preview prices
// (AgreementEditor ContractPricePreview): each variant of the products its pricing
// covers, with its store price, what the buyer pays and the pricing that decides it —
// [{id, title, sku, image, store, pays, pricing, off}]. An Active contract lists the
// ones its own pricing decides; an upcoming or proposed one, what the buyer will pay
// once it starts — or, a new version of an Active one (`change` { off, on }), once
// it applies.
function contractPrices(db, ag, company, locationId, upcoming, change = upcoming ? { start: ag } : null) {
  const c = upcoming ? companyAfterAgreement(db, change, ag.companyId) : company;
  const pricing = pricingOf(db, ag);
  const names = new Set(pricing.map((p) => p.name));
  const entries = pricedEntries(db, c, locationId, pricing, upcoming ? contractPricingAfter(db, change, ag) : liveContractPricing(db));
  return entries.filter((e) => e.pays != null && (upcoming || names.has(e.pricing)));
}
// Each variant of the products `pricing` (configs) covers, priced for company `c` at
// `locationId` with the contracts' pricing `contractPricing` in force.
function pricedEntries(db, c, locationId, pricing, contractPricing) {
  const location = (c?.locations || []).find((l) => l.id === locationId) || null;
  const covers = (p, product) => (kindOf(p) === 'base' ? baseInScope(p, product) : policyPriceBreakdown(p, product)?.inScope);
  const products = (db.products || []).filter((product) => pricing.some((p) => covers(p, product)));
  return withContractPricing(contractPricing, () =>
    products.flatMap((p) =>
      productVariants(p).map((v) => {
        const d = resolveDetail(c, p, db.policies, v, location);
        const store = v.list ?? p.list;
        return {
          id: v.id,
          title: variantTitle(p, v),
          sku: v.id,
          image: null,
          store,
          pays: d.price,
          pricing: d.policy?.name || null,
          off: store > 0 && d.price != null ? Math.round((1 - d.price / store) * 100) : 0,
        };
      }),
    ),
  );
}

// A company location's own pricing and limits — what it buys under outside its
// contract — as the admin's Location page reads them (CompanyPricingCard,
// LocationLimitsCard), for the B2B Portal's Business account (the real portal's
// backend regularTermsAt):
//   base, quantity: the base and quantity pricings in force there (the location's own
//     list, else its company's), leaving out what a contract gives it;
//   limits [{ limit, replacedBy }]: the order and product limits in force there that no
//     contract gives; `replacedBy` the number of the contract whose limit applies
//     instead (a contract's order limit replaces the location's), else null. One a
//     limit outside any contract replaces doesn't apply, so it isn't listed.
export function regularTermsAt(db, companyId, locationId) {
  const none = { base: [], quantity: [], limits: [] };
  const company = (db.companies || []).find((c) => c.id === companyId);
  const location = (company?.locations || []).find((l) => l.id === locationId);
  if (!company || !location) return none;
  const holder = (kind) => (hasOwnSlot(location, kind) ? location : company);
  const own = (e) => !e.byContract && !isContractTerm(e.policy);
  // With the live contracts' pricing in (restored after), so what they give is known.
  const { base, quantity } = withContractPricing(liveContractPricing(db), () => ({
    base: companyBaseEntries(holder('base'), db.policies)
      .filter((e) => own(e) && basePriceableNow(e.policy, holder('base')))
      .map((e) => e.policy),
    quantity: companyQuantityEntries(holder('quantity'), db.policies)
      .filter((e) => own(e) && e.policy.status !== 'Inactive')
      .map((e) => e.policy),
  }));
  const contractOfLimit = (l) => {
    const at = l?.contractAt || {};
    return at[limitKey(companyId, locationId)] || at[`${companyId}::*`] || null;
  };
  const limits = locationLimits(db, companyId, locationId)
    .filter((x) => !x.contract)
    .map((x) => {
      const by = x.rules.length && x.rules.every((r) => r.replacedBy) ? x.rules[0].replacedBy : null;
      return { limit: x.limit, by, replacedBy: by ? contractOfLimit(by) : null };
    })
    .filter((x) => !x.by || x.replacedBy)
    .map(({ limit, replacedBy }) => ({ limit, replacedBy }));
  return { base, quantity, limits };
}

// Business account's terms outside its contract, shaped as a contract card (portal.js
// business.regular): { pricing (names), rules, details, basePricing, quantityPricing,
// prices (what its own base pricings price there), limits, limitDetails (each with
// `replacedBy`) } — or null when it has none.
function regularCard(db, company, locationId) {
  const own = regularTermsAt(db, company.id, locationId);
  const cards = limitCards(db, own.limits.map((x) => x.limit)).map((c, i) => ({ ...c, replacedBy: own.limits[i].replacedBy }));
  if (!own.base.length && !own.quantity.length && !cards.length) return null;
  const names = new Set(own.base.map((p) => p.name));
  return {
    pricing: [...own.base, ...own.quantity].map((p) => p.name),
    ...pricingRules(db, own.base, own.quantity),
    prices: pricedEntries(db, company, locationId, own.base, liveContractPricing(db)).filter((e) => e.pays != null && names.has(e.pricing)),
    limits: cards.map((c) => c.text),
    limitDetails: cards,
  };
}

// `kind`: 'contract' (Active), 'upcoming' (Scheduled) or 'proposal' (Proposed). `change`:
// for a new version of an Active one, what approving it does ({ off, on }).
function cardOf(db, ag, company, locationId, kind, change) {
  const upcoming = kind !== 'contract';
  const limitDetails = contractLimits(db, ag);
  return {
    number: ag.number,
    name: ag.name,
    version: ag.version || 1,
    // Sent again without a new version (agreements.js logProposalUpdate): answers go to it.
    revision: ag.revision || 0,
    start: day(ag.startDate),
    end: day(ag.endDate),
    pricing: pricingOf(db, ag).map((p) => p.name),
    // Its pricings' rules, in full, and which are base or quantity pricings — every card
    // lists each kind in its View details.
    ...contractRules(db, ag),
    limits: limitDetails.map((l) => l.text),
    limitDetails,
    prices: contractPrices(db, ag, company, locationId, upcoming, change),
    ...(kind === 'contract' ? { history: contractHistory(db, ag, company) } : {}),
    startDate: ag.startDate || null,
    // Saved with Buyer must approve: an upcoming one can be asked to cancel.
    approval: !!ag.approval,
    // The buyers' answers and the seller's declines, raw: the storefront adds what it
    // sent since and works out the card's answer, its decline and its Activities log
    // from them (storefront/data/products.js contractsForSession, activitiesOf).
    buyerResponses: ag.buyerResponses || [],
    declines: ag.declines || [],
    // What the seller changed before activating it, for its Activities log.
    sellerUpdates: ag.sellerUpdates || [],
    // When it last changed: the B2B Portal lists the newest first (lastUpdateOf).
    lastUpdate: lastUpdateOf(ag),
  };
}

// A contract's Activities log, as the real portal's backend's (portal.js
// activitiesOf): every answer its buyers sent — Approve, Request changes, Request
// cancellation — raw ({ kind, message, buyer, email, at, version }) with `status` for
// a request (Awaiting review: the latest answer to its version; Rejected: the seller
// declined it, `reply` { message, at }; New version sent; Updated by seller: sent
// again without a new version; Closed: they answered again on it) and none for an
// approval — and each change the seller made before activating it ({ kind: 'updated',
// note, at, version }), newest first. `ag`: { version, revision, buyerResponses,
// declines, sellerUpdates }.
export function activitiesOf(ag) {
  const latest = latestBuyerResponse(ag);
  // Requests for changes sent one after another, none answered yet: all waiting.
  const open = new Set(openChangeRequests(ag));
  const answers = (ag.buyerResponses || []).map((r) => {
    if (r.kind === 'approve') return { ...r, status: null, reply: null };
    const d = (ag.declines || []).find((x) => x.responseKey === responseKey(r));
    const status = d
      ? 'Rejected'
      : r === latest || open.has(r)
        ? 'Awaiting review'
        : r.version < (ag.version || 1)
          ? 'New version sent'
          : (r.revision || 0) < (ag.revision || 0)
            ? 'Updated by seller'
            : 'Closed';
    return { ...r, status, reply: d ? { message: d.message, at: d.at } : null };
  });
  const updates = (ag.sellerUpdates || []).map((u) => ({ kind: 'updated', note: u.note || '', at: String(u.at || '').slice(0, 10), version: u.version, revision: u.revision, status: null, reply: null }));
  // In order: by version, then revision — the seller's change opens its revision, the
  // answers to it follow — then as they came.
  const key = (x, i) => [x.version || 1, x.revision || 0, x.kind === 'updated' ? 0 : 1, i];
  return [...updates, ...answers]
    .map((x, i) => ({ x, k: key(x, i) }))
    .sort((a, b) => a.k.reduce((d, v, j) => d || v - b.k[j], 0))
    .map(({ x }) => x)
    .reverse();
}

// The cards for one company location: { contract, upcoming, proposal, regular }
// (`regular`: Business account's terms outside its contract, regularCard).
export function portalContracts(db, companyId, locationId) {
  const company = (db.companies || []).find((c) => c.id === companyId);
  if (!company || !(company.locations || []).some((l) => l.id === locationId)) return { contract: null, upcoming: null, proposal: null, regular: null };
  const active = activeAt(db, company, locationId);
  // The company's contracts there with this status, the one starting soonest.
  const soonest = (status, ok = () => true) =>
    (db.agreements || [])
      .filter((a) => a.status === status && a.companyId === companyId && appliesAt(company, a, locationId) && ok(a))
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))[0];
  const next = soonest('Scheduled');
  // Its start date passed, a proposal has expired (the B2B app closes it when it loads).
  const proposed = soonest('Proposed', (a) => !a.startDate || a.startDate >= TODAY);
  // A new version of an Active one there (or one it would apply at) waiting for its
  // buyers: the proposal before any other — approved, it applies right away
  // (`startDate` null), and it can't be asked to cancel (`update`).
  const updating = (db.agreements || [])
    .map(pendingVersionOf)
    .find((v) => v && v.companyId === companyId && (appliesAt(company, v, locationId) || appliesAt(company, (db.agreements || []).find((a) => a.id === v.id), locationId)));
  const update = updating
    ? {
        ...cardOf(withStagedTerms(db, updating.pending.staged), updating, company, locationId, 'proposal', { off: (db.agreements || []).find((a) => a.id === updating.id), on: updating }),
        startDate: null,
        update: true,
      }
    : null;
  return {
    contract: active ? cardOf(db, active, company, locationId, 'contract') : null,
    upcoming: next ? cardOf(db, next, company, locationId, 'upcoming') : null,
    proposal: update || (proposed ? cardOf(db, proposed, company, locationId, 'proposal') : null),
    regular: regularCard(db, company, locationId),
  };
}

// Every company location with a card or terms of its own, keyed
// "<companyId>:<locationId>", as the B2B app publishes them: { v: 4, at } (4: base and
// quantity pricing kinds, every card's pricing details, a limit's `kind`, `regular`).
export function publishablePortalContracts(db) {
  const at = {};
  (db.companies || []).forEach((c) => {
    (c.locations || []).forEach((l) => {
      const cards = portalContracts(db, c.id, l.id);
      if (cards.contract || cards.upcoming || cards.proposal || cards.regular) at[`${c.id}:${l.id}`] = cards;
    });
  });
  return { v: 4, at };
}
