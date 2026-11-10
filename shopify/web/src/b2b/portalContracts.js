// The B2B Portal's contract cards for the prototype's storefront, built the way the
// real portal's backend builds them (qs-b2b-portal backend/api/customer/portal.js),
// here from the B2B app's own data. The B2B app publishes them (persistence.js
// CONTRACTS_KEY) and the storefront falls back to the seed's.
//
// For a company location: { contract, upcoming, proposal }, each null when there's none.
//   contract: the Active contract it buys under — { number, name, version, start, end,
//     pricing (names), rules + details (contractRules), limits (each limit's line),
//     limitDetails (contractLimits), prices (Preview prices), history (Version
//     history: contractHistory) }.
//   upcoming: the next Scheduled contract there, the one starting soonest, read-only —
//     { number, name, version, start, end, pricing, rules, limits, limitDetails, prices }.
//   proposal: a contract sent to its buyers to approve (Proposed) there, not expired —
//     the one starting soonest — as `upcoming`.
// Each also carries `startDate`, `approval`, and its buyers' answers and the seller's
// declines, raw (`buyerResponses`, `declines`), for the storefront to work out its
// answer and Activities log (activitiesOf).
import { activeAt, appliesAt, agreementDatesLabel, termSummary, termSettings, liveContractPricing, companyAfterAgreement, contractPricingAfter, fmtDay, responseKey } from './agreements.js';
import { kindOf, baseInScope, policyPriceBreakdown, productVariants, resolveDetail, withContractPricing, TODAY } from './pricing.js';
import { limitRules } from './limits.js';
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

// Each of its pricings' rule on the card, by pricing name — a quantity pricing's
// ranges ("10–49 units: 5% off · 50+ units: 10% off"), a base pricing's adjustment
// then how many rules ("All products: 15% off · 3 rules") — and every rule, for its
// View details, in `details` (portal.js contractRules).
function contractRules(db, ag) {
  const read = pricingReader(db);
  const rules = {};
  const details = {};
  ag.terms.quantity.map((id) => policyOf(db, id)).filter(Boolean).forEach((p) => {
    const { rows } = read(p);
    if (!rows.length) return;
    rules[p.name] = rows.map((r) => `${r.on}: ${r.adjust}`).join(' · ');
    details[p.name] = { rows, own: [] };
  });
  ag.terms.base.map((id) => policyOf(db, id)).filter(Boolean).forEach((p) => {
    const { rows, own, all } = read(p);
    const parts = [];
    if (all) parts.push(`${rows[0].on}: ${rows[0].adjust}`);
    const n = rows.length - (all ? 1 : 0) + own.length;
    if (n) parts.push(`${n} rule${n === 1 ? '' : 's'}`);
    if (!parts.length) return;
    rules[p.name] = parts.join(' · ');
    details[p.name] = { rows, own };
  });
  return { rules, details };
}

// Its order limits in full, for their View details (portal.js contractLimits):
// [{text, name, rows [{on, note, limit}]}], `text` the limit's line on the card.
function contractLimits(db, ag) {
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
  return ag.terms.limits
    .map((id) => (db.limits || []).find((l) => l.id === id))
    .filter((l) => l && l.status === 'Active')
    .map((l) => {
      const rules = limitRules(l, db);
      const rows =
        l.kind === 'order'
          ? rules.map((r) => ({ on: PER[r.key?.split('@')[1]] || 'Each order', note: null, limit: words(r) }))
          : rules.map((r) => ({ ...appliesTo(r.rule), limit: quantities(r.rule, l.maxAction === 'review') }));
      return { text: rules.map(words).join(' · '), name: l.name, rows };
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
// once it starts.
function contractPrices(db, ag, company, locationId, upcoming) {
  const change = upcoming ? { start: ag } : null;
  const c = upcoming ? companyAfterAgreement(db, change, ag.companyId) : company;
  const location = (c?.locations || []).find((l) => l.id === locationId) || null;
  const pricing = pricingOf(db, ag);
  const names = new Set(pricing.map((p) => p.name));
  const covers = (p, product) => (kindOf(p) === 'base' ? baseInScope(p, product) : policyPriceBreakdown(p, product)?.inScope);
  const products = (db.products || []).filter((product) => pricing.some((p) => covers(p, product)));
  const entries = withContractPricing(upcoming ? contractPricingAfter(db, change, ag) : liveContractPricing(db), () =>
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
  return entries.filter((e) => e.pays != null && (upcoming || names.has(e.pricing)));
}

// `kind`: 'contract' (Active), 'upcoming' (Scheduled) or 'proposal' (Proposed).
function cardOf(db, ag, company, locationId, kind) {
  const upcoming = kind !== 'contract';
  const limitDetails = contractLimits(db, ag);
  const { rules, details } = contractRules(db, ag);
  return {
    number: ag.number,
    name: ag.name,
    version: ag.version || 1,
    start: day(ag.startDate),
    end: day(ag.endDate),
    pricing: pricingOf(db, ag).map((p) => p.name),
    rules,
    ...(upcoming ? {} : { details }),
    limits: limitDetails.map((l) => l.text),
    limitDetails,
    prices: contractPrices(db, ag, company, locationId, upcoming),
    ...(kind === 'contract' ? { history: contractHistory(db, ag, company) } : {}),
    startDate: ag.startDate || null,
    // Saved with Buyer must approve: an upcoming one can be asked to cancel.
    approval: !!ag.approval,
    // The buyers' answers and the seller's declines, raw: the storefront adds what it
    // sent since and works out the card's answer, its decline and its Activities log
    // from them (storefront/data/products.js contractsForSession, activitiesOf).
    buyerResponses: ag.buyerResponses || [],
    declines: ag.declines || [],
  };
}

// A contract's Activities log, as the real portal's backend's (portal.js
// activitiesOf): every answer its buyers sent, newest first — Approve, Request changes,
// Request cancellation — raw ({ kind, message, buyer, email, at, version }) with
// `status` for a request (Awaiting review: the latest answer to its version;
// Rejected: the seller declined it, `reply` { message, at }; New version sent; Closed:
// they answered again on that version) and none for an approval. `ag`: { version,
// buyerResponses, declines }.
export function activitiesOf(ag) {
  const latest = latestBuyerResponse(ag);
  return (ag.buyerResponses || [])
    .map((r) => {
      if (r.kind === 'approve') return { ...r, status: null, reply: null };
      const d = (ag.declines || []).find((x) => x.responseKey === responseKey(r));
      const status = d ? 'Rejected' : r === latest ? 'Awaiting review' : r.version < (ag.version || 1) ? 'New version sent' : 'Closed';
      return { ...r, status, reply: d ? { message: d.message, at: d.at } : null };
    })
    .reverse();
}

// The cards for one company location: { contract, upcoming, proposal }.
export function portalContracts(db, companyId, locationId) {
  const company = (db.companies || []).find((c) => c.id === companyId);
  if (!company || !(company.locations || []).some((l) => l.id === locationId)) return { contract: null, upcoming: null, proposal: null };
  const active = activeAt(db, company, locationId);
  // The company's contracts there with this status, the one starting soonest.
  const soonest = (status, ok = () => true) =>
    (db.agreements || [])
      .filter((a) => a.status === status && a.companyId === companyId && appliesAt(company, a, locationId) && ok(a))
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))[0];
  const next = soonest('Scheduled');
  // Its start date passed, a proposal has expired (the B2B app closes it when it loads).
  const proposed = soonest('Proposed', (a) => !a.startDate || a.startDate >= TODAY);
  return {
    contract: active ? cardOf(db, active, company, locationId, 'contract') : null,
    upcoming: next ? cardOf(db, next, company, locationId, 'upcoming') : null,
    proposal: proposed ? cardOf(db, proposed, company, locationId, 'proposal') : null,
  };
}

// Every company location with a card, keyed "<companyId>:<locationId>", as the B2B
// app publishes them: { v: 2, at }.
export function publishablePortalContracts(db) {
  const at = {};
  (db.companies || []).forEach((c) => {
    if (!(db.agreements || []).some((a) => a.companyId === c.id && ['Active', 'Scheduled', 'Proposed'].includes(a.status))) return;
    (c.locations || []).forEach((l) => {
      const cards = portalContracts(db, c.id, l.id);
      if (cards.contract || cards.upcoming || cards.proposal) at[`${c.id}:${l.id}`] = cards;
    });
  });
  return { v: 2, at };
}
