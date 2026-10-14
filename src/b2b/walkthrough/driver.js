// Drives the order-limit walkthrough: a cursor on the stage that points at and
// clicks real elements in the admin and the storefront (two frames on the stage,
// both in demo mode), and fills fields through each app's own store
// (window.__qsDemo), so what it sets is exactly what a merchant's typing sets.
// Every step can be stopped; `checks` collects what the screens show.

export const STOPPED = new Error('Stopped');

export function createDriver({ frames, stage, cursor, ring, say, showPane, stopped }) {
  const checks = [];
  const wait = async (ms) => {
    await new Promise((r) => setTimeout(r, ms));
    if (stopped()) throw STOPPED;
  };
  const doc = (app) => frames[app].contentDocument;
  const hook = (app) => frames[app].contentWindow.__qsDemo;
  const dispatch = (app, action) => hook(app).dispatch(action);
  const state = (app) => hook(app).state;
  const where = (app) => (app === 'admin' ? 'the admin' : 'the storefront');

  // ── Finding things ──────────────────────────────────────────────────────────
  const text = (el) => (el?.innerText ?? el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const byText = (selector, label) => (d) => [...d.querySelectorAll(selector)].find((e) => text(e) === label);
  const field = (name) => (d) => d.querySelector(`[data-field="${name}"]`);
  async function find(app, pick, what, timeout = 6000) {
    const until = Date.now() + timeout;
    for (;;) {
      const el = pick(doc(app));
      if (el) return el;
      if (Date.now() > until) throw new Error(`Couldn’t find ${what} in ${where(app)}.`);
      await wait(100);
    }
  }
  const maybe = async (app, pick, timeout) => {
    try {
      return await find(app, pick, '', timeout);
    } catch (e) {
      if (e === STOPPED) throw e;
      return null;
    }
  };

  // ── The cursor ──────────────────────────────────────────────────────────────
  // Some web components lay out no box of their own (their children do): aim at
  // the first part of them that has one.
  function shown(el) {
    const queue = [el];
    for (let i = 0; i < queue.length && i < 60; i += 1) {
      const n = queue[i];
      const r = n.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return n;
      queue.push(...n.children, ...(n.shadowRoot ? n.shadowRoot.children : []));
    }
    return el;
  }
  // Where an element is on the stage (it sits inside a frame).
  function spot(app, el) {
    const f = frames[app].getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const r = shown(el).getBoundingClientRect();
    return { x: f.left - s.left + r.left, y: f.top - s.top + r.top, w: r.width, h: r.height };
  }
  async function point(app, el) {
    ring.hidden = true;
    showPane(app);
    shown(el).scrollIntoView({ block: 'center', inline: 'nearest' });
    await wait(120);
    const p = spot(app, el);
    cursor.style.transform = `translate(${p.x + Math.min(p.w / 2, 56)}px, ${p.y + Math.min(p.h / 2, 18)}px)`;
    await wait(620);
  }
  async function press() {
    cursor.classList.add('is-pressing');
    await wait(170);
    cursor.classList.remove('is-pressing');
  }
  async function click(app, el) {
    await point(app, el);
    await press();
    el.click();
    await wait(380);
  }
  // Type `value` a character at a time: `set` puts each prefix in the field.
  async function type(app, el, value, set) {
    await point(app, el);
    await press();
    for (let i = 1; i <= value.length; i += 1) {
      set(value.slice(0, i));
      await wait(45);
    }
    await wait(260);
  }
  function highlight(app, el) {
    const p = spot(app, el);
    if (!p.w || !p.h) return;
    ring.hidden = false;
    Object.assign(ring.style, { transform: `translate(${p.x - 6}px, ${p.y - 6}px)`, width: `${p.w + 12}px`, height: `${p.h + 12}px` });
  }
  // A native input React controls: set its value the way typing does.
  function setNative(input, value) {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, value);
    input.dispatchEvent(new (input.ownerDocument.defaultView.Event)('input', { bubbles: true }));
  }

  // ── Checking what the screen shows ──────────────────────────────────────────
  // `expected`: text the screen must contain, or null for "nothing shown".
  function see(label, actual, expected) {
    const pass = expected == null ? !actual : !!actual && actual.includes(expected);
    checks.push({ label, expected: expected == null ? 'nothing shown' : `shows “${expected}”`, actual: actual || 'nothing shown', pass });
    return pass;
  }

  // ── The admin (Order limits, embedded) ──────────────────────────────────────
  const admin = {
    patch(p) {
      dispatch('admin', { type: 'LIMIT_EDITOR_PATCH', patch: p });
    },
    draft: () => state('admin').limitEditor?.draft,
    async list() {
      if (state('admin').limitEditor) dispatch('admin', { type: 'CLOSE_LIMIT_EDITOR' });
      dispatch('admin', { type: 'NAVIGATE', view: 'limits' });
      return find('admin', byText('s-button', 'Create limit'), 'the Order limits list');
    },
    async open(kind) {
      const btn = await admin.list();
      await point('admin', btn);
      await press();
      dispatch('admin', { type: 'OPEN_LIMIT_EDITOR', kind }); // the kind picked in its menu
      await find('admin', field('name'), 'the limit editor');
      await wait(250);
    },
    async type(name, value) {
      const el = await find('admin', field(name), `the ${name} field`);
      await type('admin', el, String(value), (v) => admin.patch({ [name]: v }));
    },
    async choose(name, patch) {
      const el = await find('admin', field(name), `the ${name} setting`);
      await point('admin', el);
      await press();
      admin.patch(patch);
      await wait(300);
    },
    // Applies to: specific companies and / or locations.
    async appliesTo({ companyIds = [], locationKeys = [] }) {
      await admin.choose('appliesTo', { storeWide: false });
      const search = await find('admin', field('targets'), 'the company search');
      await point('admin', search);
      await press();
      admin.patch({ companyIds, locationKeys });
      await wait(400);
    },
    // One product rule: its products (or all), then its quantities.
    async rule(i, { skus = null, all = false, min = '', max = '', increment = '' }) {
      const section = await find('admin', field(`rule-${i}`), `rule ${i + 1}`);
      await point('admin', section);
      await press();
      const rules = admin.draft().rules.map((r, j) => (j === i ? { ...r, scopeType: all ? 'all' : 'products', selectedProducts: all ? [] : skus } : r));
      admin.patch({ rules });
      await wait(350);
      for (const [key, value] of [['min', min], ['max', max], ['increment', increment]]) {
        if (value === '') continue;
        const el = await find('admin', field(`rule-${i}-${key}`), `the rule’s ${key}`);
        await type('admin', el, String(value), (v) => admin.patch({ rules: admin.draft().rules.map((r, j) => (j === i ? { ...r, [key]: v } : r)) }));
      }
    },
    // Save (Create limit / Save). The editor checks the limit against the others
    // as it's filled in. Notes (orders still go through) are shown, then it saves;
    // when it would stop orders, Save is blocked — shown and returned unsaved.
    // { saved, blocked: [text], notes: [text] }
    async save() {
      await wait(500); // the editor's check runs a moment after the last change
      const items = (name) => [...doc('admin').querySelectorAll(`[data-field="${name}"] s-list-item`)].map(text);
      const blocked = items('conflicts-blocking');
      const notes = items('conflicts-notes');
      const label = admin.draft()?.id ? 'Save' : 'Create limit';
      const btn = await find('admin', byText('s-button', label), `the ${label} button`);
      if (blocked.length) {
        const banner = doc('admin').querySelector('[data-field="conflicts-blocking"]');
        await point('admin', banner);
        highlight('admin', banner);
        say(`Admin · can’t save: ${blocked[0]}`);
        await wait(3200);
        await point('admin', btn); // Save is off until the limit changes
        await wait(500);
        return { saved: false, blocked, notes };
      }
      if (notes.length) {
        const banner = doc('admin').querySelector('[data-field="conflicts-notes"]');
        await point('admin', banner);
        highlight('admin', banner);
        say(`Admin · note: ${notes[0]}`);
        await wait(2400);
      }
      await click('admin', btn);
      await wait(300);
      return { saved: true, blocked, notes };
    },
    // A blocked limit: set it to Inactive and save it, or leave without saving.
    async turnOff() {
      say('Admin · set it to Inactive, then save');
      await admin.choose('status', { status: 'Inactive' });
      return admin.save();
    },
    // Turn a limit on (or off) from the list. When that would stop orders it's
    // refused: the reason is shown and returned. { blocked: [text] }
    async toggle(name, on = true) {
      say(`Admin · turn “${name}” ${on ? 'on' : 'off'} from the list`);
      await admin.list();
      const row = await find('admin', (d) => [...d.querySelectorAll('s-table-row')].find((r) => r.textContent.includes(name)), `“${name}” in the list`);
      await click('admin', row.querySelector('s-button'));
      const close = await maybe('admin', byText('s-button', 'Close'), 1500);
      const blocked = close ? [...doc('admin').querySelectorAll('s-modal s-list-item')].map(text) : [];
      if (close) {
        const why = doc('admin').querySelector('s-modal s-unordered-list');
        if (why) highlight('admin', why);
        say(`Admin · can’t turn it ${on ? 'on' : 'off'}: ${blocked[0] || ''}`);
        await wait(3200);
        await click('admin', close);
      }
      return { blocked };
    },
    async cancel() {
      const btn = await find('admin', byText('s-button', 'Cancel'), 'Cancel');
      await click('admin', btn);
    },
    // Create a limit from a spec, field by field, as a merchant would.
    async create(kind, spec) {
      say(`Admin · create “${spec.name}”`);
      await admin.open(kind);
      await admin.type('name', spec.name);
      for (const key of ['minValue', 'maxValue', 'minQty', 'maxQty']) if (spec[key] != null) await admin.type(key, spec[key]);
      if (spec.maxAction === 'review') await admin.choose('maxAction', { maxAction: 'review' });
      for (let i = 0; i < (spec.rules || []).length; i += 1) await admin.rule(i, spec.rules[i]);
      if (spec.message) await admin.type('message', spec.message);
      if (spec.companyIds || spec.locationKeys) await admin.appliesTo(spec);
      if (spec.startDate) await admin.choose('startDate', { startDate: spec.startDate });
      if (spec.period) await admin.choose('period', { period: spec.period });
      if (spec.status) await admin.choose('status', { status: spec.status });
      return admin.save();
    },
    // Open a limit from the list and change it.
    async edit(name, change) {
      say(`Admin · edit “${name}”`);
      await admin.list();
      const link = await find('admin', byText('s-link', name), `“${name}” in the list`);
      await click('admin', link);
      await find('admin', field('name'), 'the limit editor');
      for (const [key, value] of Object.entries(change)) await admin.type(key, value);
      return admin.save();
    },
    async show(label, pick, what) {
      const el = await find('admin', pick, what);
      await point('admin', el);
      highlight('admin', el);
      say(label);
      await wait(1800);
      return text(el);
    },
    navigate: (view, patch) => dispatch('admin', { type: 'NAVIGATE', view, patch }),
    // What an editor field shows while it's empty.
    placeholder(name) {
      const el = doc('admin').querySelector(`[data-field="${name}"]`);
      return el?.placeholder || el?.getAttribute('placeholder') || '';
    },
  };

  // ── The storefront ──────────────────────────────────────────────────────────
  const store = {
    async signIn() {
      say('Storefront · sign in as John Nguyen, ABC Construction · Hanoi');
      const btn = await find('store', (d) => d.querySelector('button[aria-label="Account"]'), 'the account button');
      await point('store', btn);
      await press();
      dispatch('store', { type: 'LOGIN', email: 'quatnap.of@gmail.com' });
      dispatch('store', { type: 'NAVIGATE', view: 'home' });
      await wait(600);
    },
    async closeCart() {
      dispatch('store', { type: 'TOGGLE_CART', open: false });
      await wait(300);
    },
    async emptyCart() {
      const n = state('store').cart.length;
      for (let i = 0; i < n; i += 1) dispatch('store', { type: 'REMOVE_LINE', index: 0 });
      dispatch('store', { type: 'TOGGLE_CART', open: false });
      await wait(250);
    },
    async product(title) {
      say(`Storefront · open ${title}`);
      dispatch('store', { type: 'NAVIGATE', view: 'home' });
      const card = await find('store', (d) => [...d.querySelectorAll('.card')].find((c) => text(c.querySelector('.card__title')) === title), title);
      await click('store', card);
      await find('store', (d) => d.querySelector('.product__info'), 'the product page');
      await wait(300);
    },
    async quantity(n) {
      const input = await find('store', (d) => d.querySelector('.product__info .qty input'), 'the quantity');
      await type('store', input, String(n), (v) => setNative(input, v));
    },
    qtyNote: () => text(doc('store').querySelector('.qty-note')),
    // Add to cart, if the product page lets it. Returns whether it was added.
    async add() {
      const btn = await find('store', byText('button', 'Add to cart'), 'Add to cart');
      await point('store', btn);
      if (btn.disabled) return false;
      await press();
      btn.click();
      await wait(700);
      return true;
    },
    async buy(title, n) {
      await store.product(title);
      await store.quantity(n);
      return store.add();
    },
    // Check out from the cart: blocked (the notice), sent for review (the dialog)
    // or through. Returns what the buyer sees.
    async checkout() {
      if (!state('store').cartOpen) dispatch('store', { type: 'TOGGLE_CART', open: true });
      const btn = await find('store', byText('button', 'Check out'), 'Check out');
      await point('store', btn);
      const notice = doc('store').querySelector('.limit-notice');
      if (btn.disabled || notice) {
        if (notice) highlight('store', notice);
        say(`Storefront · checkout blocked: ${text(notice)}`);
        await wait(2200);
        return { blocked: text(notice) };
      }
      await press();
      btn.click();
      await wait(600);
      const dialog = doc('store').querySelector('.modal .modal__body');
      if (dialog) {
        highlight('store', dialog);
        say(`Storefront · sent for review: ${text(dialog)}`);
        await wait(2200);
        return { review: text(dialog) };
      }
      say('Storefront · checks out');
      await wait(1200);
      return { through: true };
    },
    async sendRequest() {
      const btn = await find('store', byText('button', 'Send order request'), 'Send order request');
      await click('store', btn);
      await wait(600);
    },
    async showNote() {
      const el = await find('store', (d) => d.querySelector('.qty-note'), 'the quantity note');
      highlight('store', el);
      say(`Storefront · ${text(el)}`);
      await wait(2000);
      return text(el);
    },
  };

  return { admin, store, see, say, wait, checks };
}
