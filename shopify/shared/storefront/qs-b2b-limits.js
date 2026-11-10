// Source of extensions/qs-b2b-storefront/assets/qs-b2b-limits.js (bundled and
// minified there, under the 10 KB app block limit). After editing, rebuild it:
//   npx esbuild shared/storefront/qs-b2b-limits.js --bundle --minify --format=iife --target=es2020 --outfile=extensions/qs-b2b-storefront/assets/qs-b2b-limits.js

// QuoteSnap B2B on the storefront: a B2B buyer's company price, quantity prices
// and order limits, as the app last saved them for their company location (the
// blocks hand them in as JSON). Over a maximum the seller reviews (and nothing that
// blocks), Check out opens a dialog to reduce the order or send it as an order
// request: a draft order the seller reviews, made by the app's backend through the
// app proxy /apps/qs-b2b (backend/api/proxy/order-request.js).
import { fmt as money, priced, problems } from '../../backend/lib/limits.js';

(() => {
  const D = document;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fmt = (cur) => money(cur, D.documentElement.lang || 'en-US');
  const PERIODS = ['order', 'week', 'month'];
  const keyFor = (k, p) => (p === 'order' ? k : `${k}@${p}`);
  const base = window.Shopify?.routes?.root || '/';
  const fromCart = (cart) => (cart?.items || []).map((i) => ({ pid: String(i.product_id), vid: String(i.variant_id), qty: i.quantity, list: i.price / 100, title: i.product_title }));

  // The product page's rows (as the prototype's): this product's quantity rule, with
  // the quantity picked; the order's limits, with the cart plus that quantity.
  function productRow(r, qty) {
    const step = r.increment || 1;
    const rule = [step > 1 && `Sold in packs of ${step}`, r.min && `Min ${r.min}`, r.max && (r.review ? `Review above ${r.max}` : `Max ${r.max}`)].filter(Boolean).join(' · ');
    const at = (tone, status) => ({ label: 'This product', rule, tone, status });
    if (r.min != null && qty < r.min) return at('warn', `${qty} of ${r.min} minimum · add ${r.min - qty} more`);
    if (r.max != null && !r.review && qty > r.max) return at('warn', `${qty} of ${r.max} maximum · remove ${qty - r.max}`);
    if (qty % step) return at('warn', `${qty} isn’t a multiple of ${step} · choose ${[Math.floor(qty / step) * step, Math.ceil(qty / step) * step].filter((n) => n > 0).join(' or ')}`);
    if (r.review && qty > r.max) return at('review', `${qty} of ${r.max} · the seller will review this order`);
    return at('info', null);
  }
  function orderRow(o, sub, units, m) {
    const per = (p) => (p === 'order' ? '' : ` per ${p}`);
    const rule = [
      o.minValue && `Min ${m.whole(o.minValue)}`,
      ...PERIODS.map((p) => o[keyFor('maxValue', p)] && `Max ${m.whole(o[keyFor('maxValue', p)])}${per(p)}`),
      ...PERIODS.map((p) => o[keyFor('threshold', p)] && `Review above ${m.whole(o[keyFor('threshold', p)])}${per(p)}`),
      o.minQty && `Min ${o.minQty} items`,
      o.maxQty && `Max ${o.maxQty} items`,
      o.thresholdQty && `Review above ${o.thresholdQty} items`,
    ].filter(Boolean).join(' · ');
    const at = (tone, status) => ({ label: 'Your order', rule, tone, status });
    if (o.minValue && sub < o.minValue) return at('warn', `${m(sub)} of ${m.whole(o.minValue)} minimum · add ${m(o.minValue - sub)} more`);
    if (o.minQty && units < o.minQty) return at('warn', `${units} of ${o.minQty} items minimum · add ${o.minQty - units} more`);
    for (const p of PERIODS) {
      const cap = o[keyFor('maxValue', p)];
      if (cap && sub > cap) return at('warn', `${m(sub)} of ${m.whole(cap)} ${p === 'order' ? '' : `${p}ly `}maximum · remove ${m(sub - cap)} to check out`);
    }
    if (o.maxQty && units > o.maxQty) return at('warn', `${units} of ${o.maxQty} items maximum · remove ${units - o.maxQty} to check out`);
    for (const p of PERIODS) {
      const t = o[keyFor('threshold', p)];
      if (t && sub > t) return at('review', `${m(sub)} of ${m.whole(t)}${p === 'order' ? '' : ` this ${p}`} · the seller will review this order`);
    }
    if (o.thresholdQty && units > o.thresholdQty) return at('review', `${units} of ${o.thresholdQty} items · the seller will review this order`);
    return at('info', `${m(sub)} · within your order limits`);
  }
  const rowsHtml = (rows) =>
    rows.length
      ? `<div class="qs-b2b-limits" aria-live="polite">${rows
          .map((r) => `<div class="qs-b2b-limits__row qs-b2b-limits__row--${r.tone}"><span class="qs-b2b-limits__label">${r.label}</span><div class="qs-b2b-limits__body">${r.rule ? `<p class="qs-b2b-limits__rule">${esc(r.rule)}</p>` : ''}${r.status ? `<p class="qs-b2b-limits__status">${esc(r.status)}</p>` : ''}</div></div>`)
          .join('')}</div>`
      : '';

  let cart = null;
  const views = [];
  const refresh = () => views.forEach((v) => v());
  const loadCart = () =>
    fetch(`${base}cart.js`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((c) => {
        cart = c;
        refresh();
      })
      .catch(() => {});
  const read = (el) => {
    try {
      return JSON.parse(el.textContent);
    } catch {
      return null;
    }
  };

  // Product page block. Looked up again on every render: the theme can re-render the
  // product section (on load, on a variant change) and the block with it.
  const renderProduct = (root) => {
    const cfg = read(root.querySelector('script[type="application/json"]'));
    const out = root.querySelector('[data-qs-b2b-out]');
    if (!cfg?.loc || !out) return;
    const { loc } = cfg;
    const m = fmt(cfg.currency);
    const scope = root.closest('.shopify-section') || D;
    const field = (name) => scope.querySelector(`form[action*="/cart/add"] [name="${name}"]`) || scope.querySelector(`[name="${name}"]`);
    const vid = String(field('id')?.value || cfg.variant);
    const qty = Math.max(1, parseInt(field('quantity')?.value, 10) || 1);
    const list = cfg.variants[vid] ?? cfg.variants[cfg.variant];
    const lines = priced(loc, [...fromCart(cart), { pid: String(cfg.product), vid, qty, list, title: cfg.title }]);
    const mine = lines[lines.length - 1];
    const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const units = lines.reduce((n, l) => n + l.qty, 0);
    const b2b = loc.prices[vid];
    const name = b2b ? loc.pricings[b2b[1]] : loc.tiers[vid]?.name;
    let html = '';
    if (mine.price !== list) {
      html += `<div class="qs-b2b__price"><span class="qs-b2b__now">${m(mine.price)}</span><s class="qs-b2b__was">${m(list)}</s></div>`;
      if (name) html += `<p class="qs-b2b__note">Your ${esc(name)} price</p>`;
    }
    const t = loc.tiers[vid];
    if (t) {
      const n = lines.filter((x) => (t.basis === 'per_variant' ? x.vid === vid : t.basis === 'per_product' ? x.pid === String(cfg.product) : loc.tiers[x.vid]?.name === t.name)).reduce((s, x) => s + x.qty, 0);
      html += `<table class="qs-b2b__tiers"><caption>Quantity pricing</caption><tbody>${t.ranges
        .map(([a, b, p]) => `<tr${n >= a && (b == null || n <= b) ? ' class="is-current"' : ''}><td>${b == null ? `${a}+` : a === b ? a : `${a}–${b}`}</td><td>${m(p)}</td></tr>`)
        .join('')}</tbody></table>`;
    }
    const rule = loc.products[cfg.product] || loc.products['*'];
    const rows = [rule && productRow(rule, qty), Object.keys(loc.order).length && orderRow(loc.order, sub, units, m)].filter(Boolean);
    html += rowsHtml(rows);
    // Written again when it changed, or when the theme emptied it since.
    if (out.dataset.qs !== html || (html && !out.firstElementChild)) {
      out.innerHTML = html;
      out.dataset.qs = html;
    }
    root.hidden = !html;
  };
  if (D.querySelector('[data-qs-b2b-product]')) views.push(() => D.querySelectorAll('[data-qs-b2b-product]').forEach(renderProduct));

  // Cart (app embed): the order's limits above every Check out button, on the cart
  // page and in the cart drawer.
  const cartCfgEl = D.querySelector('script[data-qs-b2b-cart]');
  const cartCfg = cartCfgEl && read(cartCfgEl);
  if (cartCfg?.loc) {
    const { loc } = cartCfg;
    const m = fmt(cartCfg.currency);
    let html = '';
    // The cart as last checked: what blocks it, what the seller reviews.
    let now = { lines: [], block: [], review: [] };
    const place = () => {
      D.querySelectorAll('[name="checkout"]').forEach((btn) => {
        let box = btn.parentElement.querySelector(':scope > .qs-b2b-cart');
        if (!box) {
          box = D.createElement('div');
          box.className = 'qs-b2b-cart';
          btn.before(box);
        }
        // Compared with what was written, not innerHTML (which the browser re-serializes):
        // rewriting it would trigger the observer again.
        if (box.dataset.qs !== html || (html && !box.firstElementChild)) {
          box.innerHTML = html;
          box.dataset.qs = html;
          box.hidden = !html;
        }
      });
    };
    views.push(() => {
      const lines = priced(loc, fromCart(cart));
      now = { lines, block: [], review: [] };
      if (!lines.length) {
        html = '';
      } else {
        const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
        const all = problems(loc, lines, m);
        const block = all.filter((p) => !p.review);
        const review = all.filter((p) => p.review);
        now = { lines, block, review };
        html = `<p class="qs-b2b-cart__head"><span>${esc(loc.company)} · ${esc(loc.location)}</span><span>Company price subtotal <strong>${m(sub)}</strong></span></p>${
          block.length ? `<ul class="qs-b2b-cart__notice qs-b2b-cart__notice--warn" role="alert">${block.map((p) => `<li>${esc(p.text)}</li>`).join('')}</ul>` : ''
        }${review.length ? `<ul class="qs-b2b-cart__notice qs-b2b-cart__notice--review" role="status">${review.map((p) => `<li>${esc(p.text)}</li>`).join('')}</ul>` : ''}`;
      }
      place();
    });

    // Check out over a maximum the seller reviews, with nothing that blocks: the order
    // request dialog (qs-b2b-request.js, loaded the first time it's needed).
    let loading = null;
    const ask = () => {
      loading ||= new Promise((done, fail) => {
        const script = D.createElement('script');
        script.src = cartCfg.requestJs;
        script.onload = done;
        script.onerror = () => {
          loading = null;
          fail();
        };
        D.head.append(script);
      });
      loading.then(() => window.qsB2BRequest({ review: now.review, lines: now.lines, locationId: cartCfg.location, base })).catch(() => {});
    };
    // Before the theme's own handler (capture), so the cart doesn't go to checkout.
    D.addEventListener(
      'click',
      (e) => {
        if (!e.target.closest?.('[name="checkout"], a[href$="/checkout"]') || !now.review.length || now.block.length) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        ask();
      },
      true,
    );
  }

  if (views.length) {
    // Again after the page or the theme changes: the quantity or variant picked, the
    // product section or the cart drawer re-rendered (only what changed is written).
    const later = () => setTimeout(refresh, 0);
    ['input', 'change', 'click'].forEach((e) => D.addEventListener(e, later));
    let pending = 0;
    new MutationObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(refresh, 50);
    }).observe(D.body, { childList: true, subtree: true });
    D.addEventListener('cart:update', loadCart);
    D.addEventListener('variant:update', later);
    // Themes that don't announce cart changes: after any change to the cart.
    const send = window.fetch;
    window.fetch = (...args) => {
      const p = send(...args);
      if (/\/cart\/(add|change|update|clear)/.test(String(args[0]?.url || args[0]))) p.then(() => setTimeout(loadCart, 0)).catch(() => {});
      return p;
    };
    refresh();
    loadCart();
  }
})();
