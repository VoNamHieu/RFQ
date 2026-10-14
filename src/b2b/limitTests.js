// Order-limit test cases for the test console (screens/LimitTestConsole.jsx). Each
// one builds a fresh copy of the sample data (as the app loads it), sets up its
// case, runs it through the real code — the limits engine, the held-order reason,
// the storefront's quantity check — and compares what comes out with what should.
import { dbSeed } from './data/db.js';
import { clone } from './dbHelpers.js';
import { makeBaseState } from './initialState.js';
import {
  newLimit, normalizeLimit, upgradeLimits, limitConflicts, cartProblems, productRuleFor, effectiveRules,
  locationLimits, limitSummary, limitState, spentSoFar, inheritedSetting, warmPriceIndex,
  newConflicts, blockingOf, notesOf,
} from './limits.js';
import { withCatalog } from './limitCatalog.js';
import { heldReason } from './components/HeldOrders.jsx';
import { quantityProblem } from '../storefront/quantityProblem.js';

// ── Set-up ──────────────────────────────────────────────────────────────────
// The sample data exactly as the app starts with it (live contracts applied).
const fresh = () => {
  const db = makeBaseState().db;
  db.limits = upgradeLimits(db.limits);
  return withCatalog(db);
};
const draftOf = (d) => ({ ...newLimit(d.kind || 'order'), ...d });
const withLimit = (db, d, id) => ({ ...db, limits: [...db.limits, { ...normalizeLimit(draftOf(d)), id }] });
const warningsFor = (db, d) => limitConflicts(db, draftOf(d)).map((c) => c.text);
const rule = (sku, o) => ({ id: `r_${sku}`, scopeType: 'products', collection: '', selectedProducts: [sku], min: null, max: null, increment: null, ...o });
const allProducts = (o) => ({ id: 'r_all', scopeType: 'all', collection: '', selectedProducts: [], min: null, max: null, increment: null, ...o });
const hoses = (amount) => [[{ sku: 'HOS-12', title: 'Reinforced hose', qty: 10 }], amount];
const filters = (qty) => [[{ sku: 'FIL-XL', title: 'Industrial filter, XL', qty }], qty * 100];
const messages = (problems) => problems.map((p) => p.message);
const quantities = (r) => (r ? { min: r.min, max: r.max, pack: r.increment } : null);

// ── Checks ──────────────────────────────────────────────────────────────────
const shown = (v) => (v == null ? 'nothing' : typeof v === 'string' ? v : JSON.stringify(v));
const listed = (list) => (list.length ? list.join(' | ') : 'nothing');
const equals = (label, actual, expected) => ({ label, expected: shown(expected), actual: shown(actual), pass: JSON.stringify(actual) === JSON.stringify(expected) });
const includes = (label, list, text) => ({ label, expected: `includes “${text}”`, actual: listed(list), pass: list.some((x) => x.includes(text)) });
const excludes = (label, list, text) => ({ label, expected: `no “${text}”`, actual: listed(list), pass: !list.some((x) => x.includes(text)) });
const under = (label, ms, limit) => ({ label, expected: `under ${limit} ms`, actual: `${Math.round(ms)} ms`, pass: ms < limit });

// ── Cases ───────────────────────────────────────────────────────────────────
const CASES = [
  {
    code: 'OL-01', title: 'Sample rules at Hanoi', ref: 'Baseline',
    expect: '$400 is under the $500 minimum; $12,400 goes to review at Hanoi’s own $10,000',
    run() {
      const db = fresh();
      return [
        equals('$400 cart', messages(cartProblems(db, 'c1', 'l1', ...hoses(400))), ['Your order must be at least $500 to check out. Add $100 more.']),
        equals('$12,400 cart', messages(cartProblems(db, 'c1', 'l1', ...hoses(12400))), ['Your current limit is $10,000. Reduce your order or send an order request.']),
        equals('Review maximum in effect', (({ value, limit }) => `${value} · ${limit.name}`)(effectiveRules(db, 'c1', 'l1').settings.threshold), '10000 · ABC Hanoi review'),
      ];
    },
  },
  {
    code: 'OL-02', title: 'A location maximum keeps the company’s pack', ref: '#7',
    expect: 'Hanoi “max 100” keeps min 12 and packs of 12; warns that buyers can order at most 96',
    run() {
      const d = { kind: 'product', name: 'Hanoi filter cap', storeWide: false, locationKeys: ['c1::l1'], rules: [rule('FIL-XL', { max: '100' })] };
      const base = fresh();
      const db = withLimit(base, d, 'cap');
      return [
        equals('Industrial filter, XL at Hanoi', quantities(productRuleFor(db, 'c1', 'l1', 'FIL-XL')), { min: 12, max: 100, pack: 12 }),
        equals('Cart: 5 filters', messages(cartProblems(db, 'c1', 'l1', ...filters(5))), ['Industrial filter, XL: order at least 12.']),
        includes('Warning on save', warningsFor(base, d), 'so buyers can order at most 96'),
      ];
    },
  },
  {
    code: 'OL-03', title: 'Lift a pack size at one location', ref: 'Set to none',
    expect: 'Pack set to none (1) at Hanoi: 13 filters check out, the company minimum of 12 stays',
    run() {
      const db = withLimit(fresh(), { kind: 'product', name: 'Hanoi loose filters', storeWide: false, locationKeys: ['c1::l1'], rules: [rule('FIL-XL', { increment: '1' })] }, 'loose');
      const card = locationLimits(db, 'c1', 'l1').find((r) => r.limit.name === 'Filter case packs');
      return [
        equals('Industrial filter, XL at Hanoi', quantities(productRuleFor(db, 'c1', 'l1', 'FIL-XL')), { min: 12, max: null, pack: 1 }),
        equals('Cart: 13 filters', messages(cartProblems(db, 'c1', 'l1', ...filters(13))), []),
        equals('Cart: 5 filters', messages(cartProblems(db, 'c1', 'l1', ...filters(5))), ['Industrial filter, XL: order at least 12.']),
        includes('Location card', (card?.rules[0]?.partly || []).map((p) => `${p.label} replaced here by ${p.by?.name}`), 'Pack size for Industrial filter, XL replaced here by Hanoi loose filters'),
      ];
    },
  },
  {
    code: 'OL-04', title: 'Exempt one location from a minimum', ref: '#5',
    expect: 'Bac Ninh minimum set to none (0): a $100 cart checks out there, still blocked at Hanoi',
    run() {
      const db = withLimit(fresh(), { name: 'Bac Ninh no minimum', storeWide: false, locationKeys: ['c1::l2'], minValue: '0' }, 'nomin');
      return [
        equals('Bac Ninh, $100', messages(cartProblems(db, 'c1', 'l2', ...hoses(100))), []),
        equals('Hanoi, $100', messages(cartProblems(db, 'c1', 'l1', ...hoses(100))), ['Your order must be at least $500 to check out. Add $400 more.']),
        equals('How the limit reads', limitSummary(db.limits.at(-1), db), 'No minimum order'),
      ];
    },
  },
  {
    code: 'OL-05', title: 'Two store-wide minimums', ref: 'Gap 1',
    expect: 'A second store-wide minimum ($300) warns that only the stricter $500 applies',
    run() {
      const base = fresh();
      const d = { name: 'Promo minimum', minValue: '300' };
      return [
        includes('Warning on save', warningsFor(base, d), 'The minimum order is set by 2 limits at the same level: “Wholesale minimum” ($500) and “Promo minimum” ($300). Only the stricter one, “Wholesale minimum”, applies.'),
        equals('Minimum in effect at Bac Ninh', effectiveRules(withLimit(base, d, 'promo'), 'c1', 'l2').settings.minValue.value, 500),
      ];
    },
  },
  {
    code: 'OL-06', title: 'Two company rules on one product', ref: 'Gap 1',
    expect: 'Company minimum 24 wins over 12, the pack of 12 stays; 30 filters are blocked',
    run() {
      const base = fresh();
      const d = { kind: 'product', name: 'Big filter minimum', storeWide: false, companyIds: ['c1'], rules: [rule('FIL-XL', { min: '24' })] };
      const db = withLimit(base, d, 'big');
      return [
        equals('Industrial filter, XL at Hanoi', quantities(productRuleFor(db, 'c1', 'l1', 'FIL-XL')), { min: 24, max: null, pack: 12 }),
        equals('Cart: 30 filters', messages(cartProblems(db, 'c1', 'l1', ...filters(30))), ['Industrial filter, XL is sold in packs of 12.']),
        includes('Warning on save', warningsFor(base, d), 'Only the stricter one, “Big filter minimum”, applies.'),
      ];
    },
  },
  {
    code: 'OL-07', title: 'A rule on all products', ref: 'Record',
    expect: 'Store-wide packs of 6 stay one entry; hoses go in sixes, Industrial filter, XL keeps 12',
    run() {
      const db = withLimit(fresh(), { kind: 'product', name: 'Store packs of 6', rules: [allProducts({ increment: '6' })] }, 'six');
      return [
        equals('Product entries kept for Hanoi', Object.keys(effectiveRules(db, 'c1', 'l1').products), ['*', 'FIL-XL', 'FIL-STD']),
        equals('Cart: 10 hoses', messages(cartProblems(db, 'c1', 'l1', ...hoses(1450))), ['Reinforced hose is sold in packs of 6.']),
        equals('Industrial filter, XL pack', productRuleFor(db, 'c1', 'l1', 'FIL-XL').increment, 12),
      ];
    },
  },
  {
    code: 'OL-08', title: 'A held order when its limit changes', ref: '#2',
    expect: 'Order #1045 ($12,400) keeps what it broke and compares it with the limit now; it stays held',
    run() {
      let db = fresh();
      const order = () => db.companies.find((c) => c.id === 'c1').orders.find((o) => o.id === '#1045');
      const edit = (f) => { db = { ...db, limits: db.limits.map((l) => (l.id === 'ol4' ? f(clone(l)) : l)) }; };
      const seed = heldReason(order(), db);
      edit((l) => { l.settings.maxValue = { mode: 'set', value: 15000 }; return l; });
      const raised = heldReason(order(), db);
      edit((l) => { l.status = 'Inactive'; return l; });
      return [
        equals('As held', seed, 'Over the $10,000 maximum · ABC Hanoi review'),
        equals('Review raised to $15,000', raised, 'Held over $10,000 · now within the $15,000 maximum · ABC Hanoi review'),
        equals('ABC Hanoi review turned off', heldReason(order(), db), 'Held over $10,000 · now within the $20,000 maximum · Large order review'),
        equals('Still waiting for review', order().status, 'Needs review'),
      ];
    },
  },
  {
    code: 'OL-09', title: 'A limit that starts later', ref: 'Dates',
    expect: 'A $150 cap from Oct 1 is Upcoming today; the clash with the $200 minimum is dated Oct 1',
    run() {
      const base = fresh();
      const d = { name: 'Q4 cap', maxValue: '150', storeWide: false, companyIds: ['c2'], startDate: '2026-10-01' };
      const db = withLimit(base, d, 'q4');
      const found = limitConflicts(base, draftOf(d));
      return [
        equals('Status today (Jul 28, 2026)', limitState(db.limits.at(-1)), 'Upcoming'),
        equals('Da Nang cart today, $300', messages(cartProblems(db, 'c2', 'l3', ...hoses(300))), []),
        equals('Warning on save', found.filter((c) => c.text.startsWith('No order can check out')).map((c) => `${c.from} · ${c.text}`),
          ['2026-10-01 · No order can check out: “Vinh Phat low minimum” needs at least $200, but “Q4 cap” allows at most $150.']),
      ];
    },
  },
  {
    code: 'OL-10', title: 'Minimum units cost more than the maximum value', ref: 'Qty × value',
    expect: '100 units at Vinh Phat cost at least $520: a $420 cap blocks every order, $600 doesn’t',
    run() {
      const db = withLimit(fresh(), { name: 'Vinh Phat bulk', minQty: '100', storeWide: false, companyIds: ['c2'] }, 'bulk');
      return [
        includes('Cap $420', warningsFor(db, { name: 'Vinh Phat cap', maxValue: '420', storeWide: false, companyIds: ['c2'] }), 'the cheapest 100 cost $520 (from Sealant cartridge 300ml at $5.20), more than the $420 “Vinh Phat cap” allows'),
        excludes('Cap $600', warningsFor(db, { name: 'Vinh Phat cap', maxValue: '600', storeWide: false, companyIds: ['c2'] }), '“Vinh Phat bulk” needs at least'),
      ];
    },
  },
  {
    code: 'OL-11', title: 'Maximum units can’t reach the minimum value', ref: 'Qty × value',
    expect: '5 units at Vinh Phat are worth at most $1,875,000 (5 gift sets from the storefront catalog), under a $2,000,000 minimum',
    run() {
      const db = withLimit(fresh(), { name: 'Vinh Phat small orders', maxQty: '5', storeWide: false, companyIds: ['c2'] }, 'small');
      return [
        includes('Minimum $2,000,000', warningsFor(db, { name: 'Vinh Phat high minimum', minValue: '2000000', storeWide: false, companyIds: ['c2'] }), 'the most 5 can cost is $1,875,000 (from Manchester City 4 Piece Gift Set at $375,000)'),
        excludes('Minimum $1,800,000', warningsFor(db, { name: 'Vinh Phat high minimum', minValue: '1800000', storeWide: false, companyIds: ['c2'] }), 'the most 5 can cost'),
      ];
    },
  },
  {
    code: 'OL-12', title: 'The cheapest product is capped', ref: 'Qty × value',
    expect: 'With sealant capped at 10, the cheapest 100 units cost $727 (10 sealant, 90 pillows), over a $700 cap; $520 without it',
    run() {
      const bulk = withLimit(fresh(), { name: 'Vinh Phat bulk', minQty: '100', storeWide: false, companyIds: ['c2'] }, 'bulk');
      const capped = withLimit(bulk, { kind: 'product', name: 'Sealant max 10', storeWide: false, companyIds: ['c2'], rules: [rule('SEA-30', { max: '10' })] }, 'sea');
      const cap = { name: 'Vinh Phat cap', maxValue: '700', storeWide: false, companyIds: ['c2'] };
      return [
        excludes('Without the sealant cap', warningsFor(bulk, cap), '“Vinh Phat bulk” needs at least'),
        includes('With the sealant cap', warningsFor(capped, cap), 'the cheapest 100 cost $727 (from Sealant cartridge 300ml at $5.20)'),
      ];
    },
  },
  {
    code: 'OL-13', title: 'Review that is never reached', ref: '#6',
    expect: 'A block below a review maximum warns, per order and per month',
    run() {
      const db = fresh();
      const monthly = withLimit(db, { name: 'Monthly review 40k', maxValue: '40000', maxAction: 'review', period: 'month', storeWide: false, companyIds: ['c2'] }, 'mr');
      return [
        includes('Block $15,000 under the $20,000 review', warningsFor(db, { name: 'Vinh Phat credit cap', maxValue: '15000', storeWide: false, companyIds: ['c2'] }), 'Orders never reach review: “Vinh Phat credit cap” blocks orders over $15,000, before they reach the $20,000 “Large order review” sends to you.'),
        includes('Monthly block $30,000 under monthly review $40,000', warningsFor(monthly, { name: 'Monthly block 30k', maxValue: '30000', period: 'month', storeWide: false, companyIds: ['c2'] }), 'blocks orders over $30,000 a month, before they reach the $40,000 a month “Monthly review 40k” sends to you.'),
      ];
    },
  },
  {
    code: 'OL-14', title: 'A custom message only for what it describes', ref: '#3',
    expect: 'A min + max limit shows the specific message; a min-only limit keeps the merchant’s',
    run() {
      const two = withLimit(fresh(), { name: 'Terms', minValue: '500', maxValue: '5000', message: 'Minimum order is $500.', storeWide: false, locationKeys: ['c4::l5'] }, 't');
      const one = withLimit(fresh(), { name: 'Min only', minValue: '800', message: 'We ship pallets: $800 minimum.', storeWide: false, locationKeys: ['c4::l5'] }, 'o');
      return [
        equals('Min + max limit, $7,000 cart', messages(cartProblems(two, 'c4', 'l5', ...hoses(7000))), ['Orders can’t be more than $5,000. Remove $2,000 to check out.']),
        equals('Min-only limit, $300 cart', messages(cartProblems(one, 'c4', 'l5', ...hoses(300))), ['We ship pallets: $800 minimum.']),
      ];
    },
  },
  {
    code: 'OL-15', title: 'Deleted locations aren’t checked', ref: '#12',
    expect: 'Warnings for ABC Construction leave out Hai Duong depot (deleted in Shopify)',
    run() {
      const places = limitConflicts(fresh(), draftOf({ name: 'ABC tiny cap', maxValue: '300', storeWide: false, companyIds: ['c1'] })).flatMap((c) => c.where);
      return [excludes('Where the warnings apply', places, 'Hai Duong depot'), includes('Where the warnings apply', places, 'Hanoi · ABC Construction')];
    },
  },
  {
    code: 'OL-16', title: 'Monthly review maximum', ref: '#11',
    expect: 'July so far is $21,400 (a $5,000 declined order and June don’t count); $9,500 more goes to review',
    run() {
      const db = withLimit(fresh(), { name: 'Hanoi monthly review', maxValue: '30000', maxAction: 'review', period: 'month', storeWide: false, locationKeys: ['c1::l1'] }, 'm');
      const spent = spentSoFar([
        { date: '2026-07-03', amount: 9000, status: 'Fulfilled' },
        { date: '2026-07-15', amount: 12400, status: 'Needs review' },
        { date: '2026-07-20', amount: 5000, status: 'Declined' },
        { date: '2026-06-30', amount: 7000, status: 'Paid' },
      ]);
      return [
        equals('Ordered so far (week, month)', spent, { week: 0, month: 21400 }),
        equals('$8,000 cart', messages(cartProblems(db, 'c1', 'l1', ...hoses(8000), spent)), []),
        equals('$9,500 cart', messages(cartProblems(db, 'c1', 'l1', ...hoses(9500), spent)), ['Your orders this month come to $21,400. With this one you’d be at $30,900, over the $30,000 a month you can order without review. Reduce your order or send an order request.']),
      ];
    },
  },
  {
    code: 'OL-17', title: 'Weekly blocking maximum', ref: '#11',
    expect: '$4,000 ordered this week plus a $1,500 cart is over a $5,000 weekly limit',
    run() {
      const db = withLimit(fresh(), { name: 'Vinh Phat weekly cap', maxValue: '5000', period: 'week', storeWide: false, companyIds: ['c2'] }, 'w');
      return [equals('$1,500 cart', messages(cartProblems(db, 'c2', 'l3', ...hoses(1500), { week: 4000, month: 4000 })), ['Your orders this week come to $4,000. This one would take you to $5,500, over your $5,000 weekly limit. Remove $500 to check out.'])];
    },
  },
  {
    code: 'OL-18', title: 'A per-order and a monthly maximum together', ref: '#11',
    expect: '$15,000 per order and $50,000 a month both apply at Da Nang; neither replaces the other',
    run() {
      const db = withLimit(withLimit(fresh(), { name: 'Per order 15k', maxValue: '15000', storeWide: false, companyIds: ['c2'] }, 'a'), { name: 'Monthly 50k', maxValue: '50000', period: 'month', storeWide: false, companyIds: ['c2'] }, 'b');
      const card = locationLimits(db, 'c2', 'l3').flatMap((r) => r.rules.map((x) => `${x.text}${x.replacedBy ? ' (replaced)' : ''}`));
      return [
        includes('Location card', card, 'Maximum order $15,000'),
        includes('Location card', card, 'Maximum $50,000 per month'),
        equals('$16,000 cart, nothing ordered yet', messages(cartProblems(db, 'c2', 'l3', ...hoses(16000), { week: 0, month: 0 })), ['Orders can’t be more than $15,000. Remove $1,000 to check out.']),
        equals('$10,000 cart, $45,000 ordered this month', messages(cartProblems(db, 'c2', 'l3', ...hoses(10000), { week: 0, month: 45000 })), ['Your orders this month come to $45,000. This one would take you to $55,000, over your $50,000 monthly limit. Remove $5,000 to check out.']),
      ];
    },
  },
  {
    code: 'OL-19', title: 'What an empty field inherits', ref: 'Editor',
    expect: 'Empty fields show the value the wider limits give, or “varies” when buyers differ',
    run() {
      const others = fresh();
      const hint = (d, f, r) => {
        const h = inheritedSetting(others, draftOf(d), f, r);
        return h == null ? 'No limit' : h === 'varies' ? 'varies' : `${h.mode === 'none' ? 'none' : h.value} · ${h.limit.name}`;
      };
      const pr = rule('FIL-XL', {});
      const hanoiRule = { kind: 'product', storeWide: false, locationKeys: ['c1::l1'], rules: [pr] };
      return [
        equals('Minimum, ABC Construction', hint({ storeWide: false, companyIds: ['c1'] }, 'minValue'), '500 · Wholesale minimum'),
        equals('Minimum, Vinh Phat Trading', hint({ storeWide: false, companyIds: ['c2'] }, 'minValue'), '200 · Vinh Phat low minimum'),
        equals('Minimum, both companies', hint({ storeWide: false, companyIds: ['c1', 'c2'] }, 'minValue'), 'varies'),
        equals('Review maximum, Hanoi', hint({ storeWide: false, locationKeys: ['c1::l1'], maxAction: 'review' }, 'maxValue'), '10000 · ABC Hanoi review'),
        equals('Industrial filter, XL at Hanoi: min / max / pack', ['min', 'max', 'increment'].map((f) => hint(hanoiRule, f, pr)), ['12 · Filter case packs', 'No limit', '12 · Filter case packs']),
      ];
    },
  },
  {
    code: 'OL-20', title: 'The product page counts the cart', ref: '#13',
    expect: 'With 24 already in the cart and a maximum of 24, adding more is refused',
    run() {
      return [
        equals('Max 24, 24 in cart, add 24', quantityProblem({ min: null, max: 24, increment: 1 }, 24, 24), 'You have 24 in your cart. Add at most 0 more.'),
        equals('Max 24, cart empty, add 24', quantityProblem({ min: null, max: 24, increment: 1 }, 24, 0), null),
        equals('Min 12 in packs of 3, 6 in cart, add 3', quantityProblem({ min: 12, max: null, increment: 3 }, 3, 6), 'You have 6 in your cart. Add at least 6 more.'),
        equals('Packs of 12, 12 in cart, add 6', quantityProblem({ min: null, max: null, increment: 12 }, 6, 12), 'Sold in packs of 12.'),
      ];
    },
  },
  {
    code: 'OL-22', title: 'Only limits that stop orders are blocked', ref: 'Blocking',
    expect: 'A $300 cap under the $500 minimum blocks; pack rounding is a note; turning off an exemption that keeps orders possible blocks',
    run() {
      const db = fresh();
      const tiny = limitConflicts(db, draftOf({ name: 'ABC tiny cap', maxValue: '300', storeWide: false, companyIds: ['c1'] }));
      const pack = limitConflicts(db, draftOf({ kind: 'product', name: 'Hanoi filter cap', storeWide: false, locationKeys: ['c1::l1'], rules: [rule('FIL-XL', { max: '100' })] }));
      // Bac Ninh is exempt from a store-wide 50-unit minimum and takes at most 20 units.
      let ex = withLimit(db, { name: 'Bulk everywhere', minQty: '50' }, 'bulk');
      ex = withLimit(ex, { name: 'Bac Ninh no unit minimum', minQty: '0', storeWide: false, locationKeys: ['c1::l2'] }, 'exempt');
      ex = withLimit(ex, { name: 'Bac Ninh small orders', maxQty: '20', storeWide: false, locationKeys: ['c1::l2'] }, 'small');
      const offExempt = newConflicts(ex, ex.limits.map((l) => (l.id === 'exempt' ? { ...l, status: 'Inactive' } : l)));
      return [
        includes('$300 cap: blocks saving', blockingOf(tiny).map((c) => c.text), 'No order can check out: “Wholesale minimum” needs at least $500, but “ABC tiny cap” allows at most $300.'),
        equals('Hanoi “max 100” on packs of 12: blocks', blockingOf(pack).length, 0),
        includes('…it’s a note', notesOf(pack).map((c) => c.text), 'so buyers can order at most 96'),
        includes('Turning off Bac Ninh’s exemption: blocks', blockingOf(offExempt).map((c) => c.text), 'No order can check out: “Bulk everywhere” needs at least 50 units, but “Bac Ninh small orders” allows at most 20 units.'),
      ];
    },
  },
  {
    code: 'OL-21', title: 'Saving on a large store stays fast', ref: 'Speed',
    expect: '2,100 locations with their own pricing: a store-wide Save under 500 ms, a company one under 150 ms',
    slow: true,
    run() {
      const db = largeStore();
      warmPriceIndex(db); // the store does this in the background when prices change
      const time = (d) => {
        const t = performance.now();
        limitConflicts(db, draftOf(d));
        return performance.now() - t;
      };
      return [
        under('Store-wide limit (checks every location)', time({ name: 'Bulk', minQty: '100' }), 500),
        under('One company’s limit (checks its locations)', time({ name: 'Cap', maxValue: '400', storeWide: false, companyIds: ['c2_7'] }), 150),
      ];
    },
  },
];

// In code order.
export const LIMIT_TESTS = CASES.sort((a, b) => a.code.localeCompare(b.code));

// 300 copies of the sample companies (2,100 locations), each with its own copy of
// its first price list, and 170 copies of the products.
function largeStore() {
  const seed = fresh();
  const policies = [...seed.policies];
  const companies = [];
  for (let i = 0; i < 300; i += 1) {
    seed.companies.forEach((c) => {
      const copy = { ...clone(c), id: `${c.id}_${i}`, orders: [] };
      const first = (copy.pricing?.base || [])[0];
      const src = first && policies.find((p) => p.id === (first.id || first));
      if (src) {
        const id = `${src.id}_${copy.id}`;
        policies.push({ ...clone(src), id, name: `${src.name} ${copy.id}`, scopeType: 'all' });
        copy.pricing.base = [{ id, priority: 0 }, ...copy.pricing.base];
      }
      companies.push(copy);
    });
  }
  const products = [];
  for (let i = 0; i < 170; i += 1) dbSeed.products.forEach((p) => products.push({ ...clone(p), sku: `${p.sku}_${i}` }));
  const limits = seed.limits.map((l) => ({ ...l, companyIds: (l.companyIds || []).map((c) => `${c}_0`), locationKeys: (l.locationKeys || []).map((k) => k.replace('::', '_0::')) }));
  return { ...seed, companies, policies, products, limits };
}

// Run one case: every check, whether all passed, how long it took — or what broke.
export function runLimitTest(test) {
  const t = performance.now();
  try {
    const checks = test.run();
    return { checks, pass: checks.every((c) => c.pass), ms: performance.now() - t };
  } catch (e) {
    return { checks: [], pass: false, ms: performance.now() - t, error: e?.message || String(e) };
  }
}
