// Order-limit test cases for the test console (screens/LimitTestConsole.jsx). Each
// one builds a fresh copy of the sample data (as the app loads it), sets up its
// case, runs it through the real code — the limits engine, the held-order reason,
// the storefront's quantity check — and compares what comes out with what should.
import { clone } from './dbHelpers.js';
import { makeBaseState } from './initialState.js';
import {
  newLimit, normalizeLimit, upgradeLimits, limitOverlaps, cartProblems, cartProblemsForCustomer, productRuleFor, effectiveRules, effectiveRulesForCustomer,
  locationLimits, limitSummary, limitState, spentSoFar, inheritedSetting, limitErrors,
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
const warningsFor = (db, d) => limitOverlaps(db, draftOf(d)).map((o) => o.text);
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
    expect: 'Hanoi “max 100” keeps min 12 and packs of 12; notes that the maximum isn’t a multiple of the pack',
    run() {
      const d = { kind: 'product', name: 'Hanoi filter cap', storeWide: false, locationKeys: ['c1::l1'], rules: [rule('FIL-XL', { max: '100' })] };
      const base = fresh();
      const db = withLimit(base, d, 'cap');
      return [
        equals('Industrial filter, XL at Hanoi', quantities(productRuleFor(db, 'c1', 'l1', 'FIL-XL')), { min: 12, max: 100, pack: 12 }),
        equals('Cart: 5 filters', messages(cartProblems(db, 'c1', 'l1', ...filters(5))), ['Industrial filter, XL: order at least 12.']),
        includes('Note on save', warningsFor(base, d), 'Maximum 100 isn’t a multiple of the pack size 12'),
      ];
    },
  },
  {
    code: 'OL-03', title: 'Lift a pack size at one location', ref: 'Set to none',
    expect: 'Pack set to none (1) at Hanoi: 13 filters check out, the company minimum of 12 stays; Bac Ninh still sells in packs of 12',
    run() {
      const db = withLimit(fresh(), { kind: 'product', name: 'Hanoi loose filters', storeWide: false, locationKeys: ['c1::l1'], rules: [rule('FIL-XL', { increment: '1' })] }, 'loose');
      const card = locationLimits(db, 'c1', 'l1').find((r) => r.limit.name === 'Filter case packs');
      return [
        equals('Industrial filter, XL at Hanoi', quantities(productRuleFor(db, 'c1', 'l1', 'FIL-XL')), { min: 12, max: null, pack: 1 }),
        equals('Cart: 13 filters', messages(cartProblems(db, 'c1', 'l1', ...filters(13))), []),
        equals('Cart: 5 filters', messages(cartProblems(db, 'c1', 'l1', ...filters(5))), ['Industrial filter, XL: order at least 12.']),
        equals('Industrial filter, XL at Bac Ninh', quantities(productRuleFor(db, 'c1', 'l2', 'FIL-XL')), { min: 12, max: null, pack: 12 }),
        equals('Bac Ninh cart: 13 filters', messages(cartProblems(db, 'c1', 'l2', ...filters(13))), ['Industrial filter, XL is sold in packs of 12.']),
        includes('Location card', (card?.rules[0]?.partly || []).map((p) => `${p.label} replaced here by ${p.by?.name}`), 'Pack size for Industrial filter, XL replaced here by Hanoi loose filters'),
      ];
    },
  },
  {
    code: 'OL-04', title: 'Exempt one location from a minimum', ref: '#5',
    expect: 'Bac Ninh minimum set to none (0): a $100 cart checks out there, still blocked at Hanoi; saving it notes that it replaces the store-wide minimum there',
    run() {
      const d = { name: 'Bac Ninh no minimum', storeWide: false, locationKeys: ['c1::l2'], minValue: '0' };
      const db = withLimit(fresh(), d, 'nomin');
      return [
        includes('Note on save (more specific than the store-wide minimum)', warningsFor(fresh(), d), 'Both set the minimum order at Bac Ninh site · ABC Construction: “Bac Ninh no minimum” (none) and “Wholesale minimum” ($500). “Bac Ninh no minimum” wins there: it’s more specific.'),
        equals('Bac Ninh, $100', messages(cartProblems(db, 'c1', 'l2', ...hoses(100))), []),
        equals('Hanoi, $100', messages(cartProblems(db, 'c1', 'l1', ...hoses(100))), ['Your order must be at least $500 to check out. Add $400 more.']),
        equals('How the limit reads', limitSummary(db.limits.at(-1), db), 'No minimum order'),
      ];
    },
  },
  {
    code: 'OL-05', title: 'Two store-wide minimums', ref: 'Gap 1',
    expect: 'A second store-wide minimum ($300): the stricter $500 applies (order settings at the same level), and no note — it isn’t more specific',
    run() {
      const base = fresh();
      const d = { name: 'Promo minimum', minValue: '300' };
      return [
        equals('Note on save', warningsFor(base, d), []),
        equals('Minimum in effect at Bac Ninh', effectiveRules(withLimit(base, d, 'promo'), 'c1', 'l2').settings.minValue.value, 500),
      ];
    },
  },
  {
    code: 'OL-06', title: 'Two company rules on one product', ref: 'Gap 1',
    expect: 'Company minimum 24 (the newer limit) wins over 12, the pack of 12 stays; 30 filters are blocked. No note at the same level; the same rule for Hanoi only notes it',
    run() {
      const base = fresh();
      const d = { kind: 'product', name: 'Big filter minimum', storeWide: false, companyIds: ['c1'], rules: [rule('FIL-XL', { min: '24' })] };
      const db = withLimit(base, d, 'big');
      return [
        equals('Industrial filter, XL at Hanoi', quantities(productRuleFor(db, 'c1', 'l1', 'FIL-XL')), { min: 24, max: null, pack: 12 }),
        equals('Cart: 30 filters', messages(cartProblems(db, 'c1', 'l1', ...filters(30))), ['Industrial filter, XL is sold in packs of 12.']),
        equals('Note on save (same level)', warningsFor(base, d), []),
        includes('For Hanoi only (more specific): a note', warningsFor(base, { ...d, name: 'Hanoi big minimum', companyIds: [], locationKeys: ['c1::l1'] }), 'For the minimum, “Hanoi big minimum” wins there: it’s more specific.'),
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
    expect: 'A $150 cap from Oct 1 is Upcoming today; the clash with Vinh Phat’s $200 minimum is noted from Oct 1, not the store-wide $500 it replaces',
    run() {
      const base = fresh();
      const d = { name: 'Q4 cap', maxValue: '150', storeWide: false, companyIds: ['c2'], startDate: '2026-10-01' };
      const db = withLimit(base, d, 'q4');
      const found = limitOverlaps(base, draftOf(d));
      return [
        equals('Status today (Jul 28, 2026)', limitState(db.limits.at(-1)), 'Upcoming'),
        equals('Da Nang cart today, $300', messages(cartProblems(db, 'c2', 'l3', ...hoses(300))), []),
        equals('Note on save', found.filter((o) => o.stops).map((o) => `${o.from} · ${o.text}`),
          ['2026-10-01 · No order can check out at Vinh Phat Trading: “Vinh Phat low minimum” needs at least $200, but “Q4 cap” allows at most $150. Consider adjusting one of the two.']),
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
    code: 'OL-22', title: 'Overlaps are notes, never a block', ref: 'Notes',
    expect: 'A $300 cap under the $500 minimum is a note and still saves; a limit on other products has no note',
    run() {
      const db = fresh();
      const tiny = { name: 'ABC tiny cap', maxValue: '300', storeWide: false, companyIds: ['c1'] };
      const hosePacks = { kind: 'product', name: 'Hose packs', storeWide: false, companyIds: ['c1'], rules: [rule('HOS-12', { increment: '10' })] };
      return [
        includes('$300 cap: a note', warningsFor(db, tiny), 'No order can check out at ABC Construction: “Wholesale minimum” needs at least $500, but “ABC tiny cap” allows at most $300.'),
        equals('…and it saves (no errors)', Object.keys(limitErrors(draftOf(tiny))), []),
        equals('Hose packs: no note', warningsFor(db, hosePacks), []),
      ];
    },
  },
  {
    code: 'OL-23', title: 'Rules in one limit apply in order', ref: 'Rule order',
    expect: 'Rule 1 caps the Contractor assortment at 12, rule 2 sets a minimum of 13 on the Wholesale assortment (which holds all of it): the limit saves, shared products take rule 1, the rest rule 2; swapping the rules swaps them. A rule on all products shares the limit too: below, it takes what the other rules leave; on top, everything',
    run() {
      const db = fresh();
      const col = (name, o) => ({ id: `r_${name}`, scopeType: 'collection', collection: '', selectedCollections: [name], selectedProducts: [], min: null, max: null, increment: null, ...o });
      const d = { kind: 'product', name: 'ABC assortments', storeWide: false, companyIds: ['c1'], rules: [col('Contractor assortment', { max: '12' }), col('Wholesale assortment', { min: '13' })] };
      const inOrder = withLimit(db, d, 'assort');
      const swapped = withLimit(db, { ...d, rules: [d.rules[1], d.rules[0]] }, 'assort');
      const sealant = (n) => messages(cartProblems(inOrder, 'c1', 'l1', [{ sku: 'SEA-30', title: 'Sealant cartridge 300ml', qty: n }], n * 8).filter((p) => p.type === 'product'));
      const allBelow = { ...d, rules: [d.rules[0], allProducts({ min: '5' })] };
      const below = withLimit(db, allBelow, 'assort');
      const above = withLimit(db, { ...d, rules: [allProducts({ max: '50' }), d.rules[0]] }, 'assort');
      return [
        equals('Overlapping rules: saves', Object.keys(limitErrors(draftOf(d))), []),
        equals('Sealant (in both) takes rule 1', quantities(productRuleFor(inOrder, 'c1', 'l1', 'SEA-30')), { min: null, max: 12, pack: 1 }),
        equals('Reinforced hose (rule 2 only) takes rule 2', quantities(productRuleFor(inOrder, 'c1', 'l1', 'HOS-12')), { min: 13, max: null, pack: 1 }),
        equals('Cart: 12 sealants check out', sealant(12), []),
        includes('List says what rule 2 leaves to rule 1', [limitSummary(inOrder.limits.at(-1), inOrder)], 'Min 13 on Wholesale assortment, except 3 products in rule 1'),
        equals('Rules swapped: the sealant takes the minimum of 13', quantities(productRuleFor(swapped, 'c1', 'l1', 'SEA-30')), { min: 13, max: null, pack: 1 }),
        equals('All products below rule 1: saves', Object.keys(limitErrors(draftOf(allBelow))), []),
        equals('…the sealant still takes rule 1', quantities(productRuleFor(below, 'c1', 'l1', 'SEA-30')), { min: null, max: 12, pack: 1 }),
        equals('…a ball valve (in no other rule) takes all products', quantities(productRuleFor(below, 'c1', 'l1', 'VLV-40')), { min: 5, max: null, pack: 1 }),
        equals('All products on top: the sealant takes it', quantities(productRuleFor(above, 'c1', 'l1', 'SEA-30')), { min: null, max: 50, pack: 1 }),
      ];
    },
  },
  {
    code: 'OL-24', title: 'The newer limit wins a product at the same level', ref: 'Newest',
    expect: 'A newer company pack of 6 replaces the company pack of 12 (the minimum of 12 stays); a newer store-wide one doesn’t — the company’s is more specific. Neither is more specific than the existing limit, so no note',
    run() {
      const base = fresh();
      const d = { kind: 'product', name: 'ABC filter packs of 6', storeWide: false, companyIds: ['c1'], rules: [rule('FIL-XL', { increment: '6' })] };
      const wide = { ...d, name: 'Store filter packs of 6', storeWide: true, companyIds: [] };
      const db = withLimit(base, d, 'six');
      return [
        equals('Industrial filter, XL at Hanoi', quantities(productRuleFor(db, 'c1', 'l1', 'FIL-XL')), { min: 12, max: null, pack: 6 }),
        equals('Cart: 18 filters', messages(cartProblems(db, 'c1', 'l1', ...filters(18))), []),
        equals('Note on save (same level)', warningsFor(base, d), []),
        equals('Store-wide pack of 6 at Hanoi', quantities(productRuleFor(withLimit(base, wide, 'six'), 'c1', 'l1', 'FIL-XL')), { min: 12, max: null, pack: 12 }),
        equals('…no note (wider)', warningsFor(base, wide), []),
      ];
    },
  },
  {
    code: 'OL-25', title: 'A customer in two tag segments takes the newer limit', ref: 'Segments', note: 'No walkthrough for this case: the storefront has no D2C tagged customer.',
    expect: 'Tag “retailer” has a $500 minimum, a newer limit gives tag “trade” a $300 maximum. An Nam Retail has both tags: only the trade cap applies (no order is stopped); saving it gives a soft note that other tags have limits; Lan Anh Home (retailer only) keeps the minimum; two limits on the same tag still combine',
    run() {
      const d2c = (ids) => ({ audienceType: 'd2c', customerTarget: 'tags', customerTargetIds: ids });
      const base = { ...fresh(), limits: [] };
      const retail = { name: 'Retailer minimum', minValue: '500', ...d2c(['retailer']) };
      const trade = { name: 'Trade cap', maxValue: '300', ...d2c(['trade']) };
      const db = withLimit(withLimit(base, retail, 'rm'), trade, 'tc');
      const customer = (id) => db.customers.find((c) => c.id === id);
      const annam = cartProblemsForCustomer(db, customer('w4'), ...hoses(400));
      const twice = withLimit(withLimit(base, retail, 'rm'), { name: 'Retailer minimum 2', minValue: '300', ...d2c(['retailer']) }, 'rm2');
      return [
        equals('An Nam Retail, $400 cart: only the trade cap', messages(annam), ['Orders can’t be more than $300. Remove $100 to check out.']),
        equals('Lan Anh Home, $400 cart: the $500 minimum', messages(cartProblemsForCustomer(db, customer('w1'), ...hoses(400))), ['Your order must be at least $500 to check out. Add $100 more.']),
        includes('Soft note on save', warningsFor(withLimit(base, retail, 'rm'), trade), 'Other customer tags already have order limits (retailer). A customer with several tags gets only the newest of these limits, so check them if they may overlap.'),
        equals('…no clash', limitOverlaps(withLimit(base, retail, 'rm'), draftOf(trade)).filter((o) => o.stops).length, 0),
        equals('Same tag twice: the stricter $500 stays', effectiveRulesForCustomer(twice, customer('w1')).settings.minValue.value, 500),
      ];
    },
  },
];

// In code order.
export const LIMIT_TESTS = CASES.sort((a, b) => a.code.localeCompare(b.code));

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
