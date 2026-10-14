// What the walkthrough does for each test case (limitTests.js): set it up in the
// admin with the cursor, then show what the buyer gets on the storefront — and
// check what the screens say. The storefront sells the store's own catalog (no
// filters or hoses there), so its cases use the Haaland home jersey ($85.85 for
// ABC Construction) and the pillow ($8.50); the buyer is John Nguyen at ABC
// Construction · Hanoi. Cases whose result is in the admin end there. A limit that
// would stop orders can't be saved: the cursor shows why, then changes it or sets
// it to Inactive; notes (orders still go through) are read and it saves.

const JERSEY = 'Manchester City Home Jersey 2026/27 With HAALAND 9 Printing';
const JERSEY_SKU = '701242784-HAALAND';
const PILLOW = 'Pillow';
const SEALANT_SKU = 'SEA-30';
const HANOI = ['c1::l1'];
const ABC = ['c1'];
const casePacks = { name: 'Jersey case packs', companyIds: ABC, rules: [{ skus: [JERSEY_SKU], min: 12, increment: 12 }] };
const all = (list) => list.join(' ');

// Cases whose result is only in the admin: the stage shows the admin alone.
export const ADMIN_ONLY = new Set(['OL-11', 'OL-12', 'OL-15', 'OL-19', 'OL-22']);

export const WALKTHROUGHS = {
  'OL-01': async ({ admin, store, see }) => {
    await admin.list();
    await admin.show('Admin · the sample limits: a $500 store-wide minimum, Hanoi’s review over $10,000', (d) => d.querySelector('s-table'), 'the Order limits list');
    await store.signIn();
    await store.buy(JERSEY, 2);
    see('Storefront: 2 jerseys ($171.70)', (await store.checkout()).blocked, 'Your order must be at least $500 to check out. Add $328.30 more.');
    await store.emptyCart();
    await store.buy(JERSEY, 150);
    see('Storefront: 150 jerseys ($12,877.50)', (await store.checkout()).review, 'Your current limit is $10,000. Reduce your order or send an order request.');
  },

  'OL-02': async ({ admin, store, see }) => {
    await admin.create('product', casePacks);
    const w = await admin.create('product', { name: 'Hanoi jersey cap', locationKeys: HANOI, rules: [{ skus: [JERSEY_SKU], max: 100 }] });
    see('Admin: a note, and it saves', w.saved ? all(w.notes) : '', 'so buyers can order at most 96');
    await store.signIn();
    await store.product(JERSEY);
    see('Storefront: product page', await store.showNote(), 'Sold in packs of 12 · Minimum 12 · Maximum 100');
    await store.quantity(5);
    see('Storefront: quantity 5', await store.showNote(), 'Order at least 12.');
  },

  'OL-03': async ({ admin, store, see }) => {
    await admin.create('product', casePacks);
    await admin.create('product', { name: 'Hanoi loose jerseys', locationKeys: HANOI, rules: [{ skus: [JERSEY_SKU], increment: 1 }] });
    await store.signIn();
    await store.product(JERSEY);
    const note = await store.showNote();
    see('Storefront: product page keeps the minimum', note, 'Minimum 12');
    see('Storefront: …without a pack size', note.includes('packs') ? note : '', null);
    await store.quantity(13);
    await store.add();
    const r = await store.checkout();
    see('Storefront: 13 jerseys ($1,116.05)', r.through ? 'checks out' : r.blocked || r.review, 'checks out');
  },

  'OL-04': async ({ admin, store, see }) => {
    await admin.create('order', { name: 'Hanoi no minimum', minValue: 0, locationKeys: HANOI });
    await store.signIn();
    await store.buy(JERSEY, 2);
    const r = await store.checkout();
    see('Storefront: 2 jerseys ($171.70)', r.through ? 'checks out' : r.blocked || r.review, 'checks out');
  },

  'OL-05': async ({ admin, store, see }) => {
    const w = await admin.create('order', { name: 'Promo minimum', minValue: 300 });
    see('Admin: a note, and it saves', w.saved ? all(w.notes) : '', 'Only the stricter one, “Wholesale minimum”, applies.');
    await store.signIn();
    await store.buy(JERSEY, 4);
    see('Storefront: 4 jerseys ($343.40)', (await store.checkout()).blocked, 'Your order must be at least $500 to check out. Add $156.60 more.');
  },

  'OL-06': async ({ admin, store, see }) => {
    await admin.create('product', casePacks);
    const w = await admin.create('product', { name: 'Big jersey minimum', companyIds: ABC, rules: [{ skus: [JERSEY_SKU], min: 24 }] });
    see('Admin: a note, and it saves', w.saved ? all(w.notes) : '', 'Only the stricter one, “Big jersey minimum”, applies.');
    await store.signIn();
    await store.product(JERSEY);
    see('Storefront: product page', await store.showNote(), 'Sold in packs of 12 · Minimum 24');
    await store.quantity(30);
    see('Storefront: quantity 30', await store.showNote(), 'Sold in packs of 12.');
  },

  'OL-07': async ({ admin, store, see }) => {
    await admin.create('product', { name: 'Store packs of 6', rules: [{ all: true, increment: 6 }] });
    await store.signIn();
    await store.product(PILLOW);
    see('Storefront: pillow', await store.showNote(), 'Sold in packs of 6');
    await store.quantity(5);
    see('Storefront: quantity 5', await store.showNote(), 'Sold in packs of 6.');
    await store.product(JERSEY);
    see('Storefront: the jersey has no rule of its own', await store.showNote(), 'Sold in packs of 6');
  },

  'OL-08': async ({ admin, store, see }) => {
    await store.signIn();
    await store.buy(JERSEY, 150);
    see('Storefront: 150 jerseys ($12,877.50)', (await store.checkout()).review, 'Your current limit is $10,000.');
    await store.sendRequest();
    const held = (d) => [...d.querySelectorAll('s-paragraph')].find((p) => p.closest('s-grid')?.textContent.includes('$12,877.50'));
    admin.navigate('home');
    see('Admin: the request waits on Home', await admin.show('Admin · the order request waits for your review', held, 'the held order'), 'Over the $10,000 maximum · ABC Hanoi review');
    await admin.edit('ABC Hanoi review', { maxValue: 15000 });
    admin.navigate('home');
    see('Admin: after raising the review to $15,000', await admin.show('Admin · the held order after the limit changed', held, 'the held order'), 'Held over $10,000 · now within the $15,000 maximum · ABC Hanoi review');
  },

  'OL-09': async ({ admin, store, see }) => {
    const w = await admin.create('order', { name: 'Q4 cap', maxValue: 150, companyIds: ABC, startDate: '2026-10-01' });
    see('Admin: $150 can’t be saved (from Oct 1)', w.saved ? '' : all(w.blocked), 'No order can check out: “Wholesale minimum” needs at least $500, but “Q4 cap” allows at most $150. From Oct 1, 2026');
    await admin.type('maxValue', 2000);
    const fixed = await admin.save();
    see('Admin: changed to $2,000, it saves', fixed.saved ? 'saved' : all(fixed.blocked), 'saved');
    await admin.list();
    const badge = (d) => [...d.querySelectorAll('s-table-row')].find((r) => r.textContent.includes('Q4 cap'))?.querySelector('s-badge');
    see('Admin: status in the list', await admin.show('Admin · “Q4 cap” is Upcoming', badge, 'the Q4 cap status'), 'Upcoming');
    await store.signIn();
    await store.buy(JERSEY, 6);
    const r = await store.checkout();
    see('Storefront today: 6 jerseys ($515.10)', r.through ? 'checks out' : r.blocked || r.review, 'checks out');
  },

  'OL-10': async ({ admin, store, see }) => {
    await admin.create('order', { name: 'ABC bulk', minQty: 100, companyIds: ABC });
    const w = await admin.create('order', { name: 'ABC cap', maxValue: 420, companyIds: ABC });
    see('Admin: the cap can’t be saved', w.saved ? '' : all(w.blocked), '“ABC bulk” needs at least 100 units, and the cheapest 100 cost $520 (from Sealant cartridge 300ml at $5.20), more than the $420 “ABC cap” allows.');
    const off = await admin.turnOff();
    see('Admin: set to Inactive, it saves', off.saved ? 'saved' : all(off.blocked), 'saved');
    await store.signIn();
    await store.buy(PILLOW, 100);
    const r = await store.checkout();
    see('Storefront: 100 pillows ($850), the cap is off', r.through ? 'checks out' : r.blocked || r.review, 'checks out');
  },

  'OL-11': async ({ admin, see, say, wait }) => {
    // At most 12 units (fewer would stop the filters, sold 12 at a time, at ABC).
    const small = await admin.create('order', { name: 'ABC small orders', maxQty: 12, companyIds: ABC });
    see('Admin: a 12-unit maximum saves', small.saved ? 'saved' : all(small.blocked), 'saved');
    const w = await admin.create('order', { name: 'ABC high minimum', minValue: 5000000, companyIds: ABC });
    see('Admin: a $5,000,000 minimum can’t be saved', w.saved ? '' : all(w.blocked), 'the most 12 can cost is $4,500,000');
    const off = await admin.turnOff();
    see('Admin: set to Inactive, it saves', off.saved ? 'saved' : all(off.blocked), 'saved');
    await wait(1200);
  },

  'OL-12': async ({ admin, see, say, wait }) => {
    await admin.create('order', { name: 'ABC bulk', minQty: 300, companyIds: ABC });
    const w1 = await admin.create('order', { name: 'ABC cap', maxValue: 2000, companyIds: ABC });
    see('Admin: a $2,000 cap saves (the cheapest 300 cost $1,560)', w1.saved ? 'saved' : all(w1.blocked), 'saved');
    const w2 = await admin.create('product', { name: 'Sealant max 10', companyIds: ABC, rules: [{ skus: [SEALANT_SKU], max: 10 }] });
    see('Admin: capping sealant at 10 can’t be saved', w2.saved ? '' : all(w2.blocked), 'the cheapest 300 cost $2,227');
    await admin.cancel();
    await wait(1200);
  },

  'OL-13': async ({ admin, store, see }) => {
    const w = await admin.create('order', { name: 'Hanoi credit cap', maxValue: 8000, locationKeys: HANOI });
    see('Admin: a note, and it saves', w.saved ? all(w.notes) : '', 'Orders never reach review: “Hanoi credit cap” blocks orders over $8,000, before they reach the $10,000 “ABC Hanoi review” sends to you.');
    await store.signIn();
    await store.buy(JERSEY, 120);
    see('Storefront: 120 jerseys ($10,302)', (await store.checkout()).blocked, 'Orders can’t be more than $8,000. Remove $2,302 to check out.');
  },

  'OL-14': async ({ admin, store, see }) => {
    await admin.create('order', { name: 'Hanoi terms', minValue: 500, maxValue: 5000, message: 'Minimum order is $500.', locationKeys: HANOI });
    await store.signIn();
    await store.buy(JERSEY, 70);
    const r = await store.checkout();
    see('Storefront: 70 jerseys ($6,009.50)', r.blocked, 'Orders can’t be more than $5,000. Remove $1,009.50 to check out.');
    see('Storefront: not the merchant’s minimum message', r.blocked?.includes('Minimum order is $500') ? r.blocked : '', null);
  },

  'OL-15': async ({ admin, see, say, wait }) => {
    const w = await admin.create('order', { name: 'ABC tiny cap', maxValue: 300, companyIds: ABC });
    see('Admin: can’t be saved, at Hanoi', w.saved ? '' : all(w.blocked), 'Hanoi · ABC Construction');
    see('Admin: …and not the deleted Hai Duong depot', all([...w.blocked, ...w.notes]).includes('Hai Duong') ? 'Hai Duong depot' : '', null);
    await admin.cancel();
    await wait(1200);
  },

  'OL-16': async ({ admin, store, see }) => {
    await admin.create('order', { name: 'Hanoi monthly review', maxValue: 10000, maxAction: 'review', period: 'month', locationKeys: HANOI });
    await store.signIn();
    await store.buy(JERSEY, 110);
    see('Storefront: 110 jerseys ($9,443.50), $890 ordered in July', (await store.checkout()).review, 'Your orders this month come to $890. With this one you’d be at $10,333.50');
  },

  'OL-17': async ({ admin, store, see }) => {
    await admin.create('order', { name: 'ABC weekly cap', maxValue: 5000, period: 'week', companyIds: ABC });
    await store.signIn();
    await store.buy(JERSEY, 60);
    see('Storefront: 60 jerseys ($5,151)', (await store.checkout()).blocked, 'over your $5,000 weekly limit. Remove $151 to check out.');
  },

  'OL-18': async ({ admin, store, see }) => {
    await admin.create('order', { name: 'Hanoi per order 9k', maxValue: 9000, locationKeys: HANOI });
    await admin.create('order', { name: 'Hanoi monthly 10k', maxValue: 10000, period: 'month', locationKeys: HANOI });
    admin.navigate('location', { selectedCompany: 'c1', selectedLocation: 'l1' });
    const line = (label) => (d) => [...d.querySelectorAll('s-paragraph')].find((p) => p.textContent.trim() === label);
    see('Admin: Hanoi’s limits card', await admin.show('Admin · Hanoi has both maximums', line('Maximum $10,000 per month'), 'the monthly maximum'), 'Maximum $10,000 per month');
    see('Admin: …and the per-order one', await admin.show('Admin · …and the per-order one', line('Maximum order $9,000'), 'the per-order maximum'), 'Maximum order $9,000');
    await store.signIn();
    await store.buy(JERSEY, 110);
    const r = await store.checkout();
    see('Storefront: 110 jerseys ($9,443.50), per order', r.blocked, 'Orders can’t be more than $9,000.');
    see('Storefront: …and for the month', r.blocked, 'over your $10,000 monthly limit');
  },

  'OL-19': async ({ admin, see, say }) => {
    say('Admin · a new limit for Hanoi: empty fields show what they inherit');
    await admin.open('order');
    await admin.type('name', 'Hanoi draft');
    await admin.appliesTo({ locationKeys: HANOI });
    const hint = async (name, label) => {
      await admin.show(label, (d) => d.querySelector(`[data-field="${name}"]`), `the ${name} field`);
      return admin.placeholder(name);
    };
    see('Admin: Minimum order, empty', await hint('minValue', 'Admin · Minimum: inherited from the store-wide $500'), 'Inherited: $500 · Wholesale minimum');
    admin.patch({ maxAction: 'review' });
    see('Admin: Maximum sent for review, empty', await hint('maxValue', 'Admin · Maximum for review: inherited from Hanoi’s own $10,000'), 'Inherited: $10,000 · ABC Hanoi review');
    await admin.list();
  },

  'OL-22': async ({ admin, see, say, wait }) => {
    const w = await admin.create('order', { name: 'ABC tiny cap', maxValue: 300, companyIds: ABC, status: 'Inactive' });
    see('Admin: saved as Inactive, it can’t stop orders', w.saved ? 'saved' : all(w.blocked), 'saved');
    const t = await admin.toggle('ABC tiny cap');
    see('Admin: turning it on is refused', all(t.blocked), 'No order can check out: “Wholesale minimum” needs at least $500, but “ABC tiny cap” allows at most $300.');
    await wait(1200);
  },

  'OL-20': async ({ admin, store, see }) => {
    await admin.create('product', { name: 'Hanoi jersey max 24', locationKeys: HANOI, rules: [{ skus: [JERSEY_SKU], max: 24 }] });
    await store.signIn();
    await store.buy(JERSEY, 24);
    await store.closeCart();
    await store.quantity(24);
    see('Storefront: 24 more with 24 in the cart', await store.showNote(), 'You have 24 in your cart. Add at most 0 more.');
  },
};
