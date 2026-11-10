// Source of extensions/qs-b2b-storefront/assets/qs-b2b-request.js (minified there).
// The cart embed's script (qs-b2b-limits.js) loads it the first time Check out
// needs it, so that one stays under the 10 KB app block limit. Rebuild:
//   npx esbuild shared/storefront/qs-b2b-request.js --bundle --minify --format=iife --target=es2020 --outfile=extensions/qs-b2b-storefront/assets/qs-b2b-request.js

// The order request dialog: Check out over a maximum the seller reviews, with
// nothing that blocks. The buyer reduces the order, or sends it as an order request
// with a note for the seller: the app's backend makes it a draft order the seller
// reviews (app proxy /apps/qs-b2b/order-request, backend/api/proxy/order-request.js).
// Sent, the cart is emptied and the request waits on the B2B Portal.
// window.qsB2BRequest({ review: [{ text }], lines: [{ vid, qty }], locationId, base })
(() => {
  const D = document;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const NOTE = 500;
  const FAILED = 'We couldn’t send your order request. Try again.';
  let dialog = null;

  window.qsB2BRequest = ({ review, lines, locationId, base }) => {
    dialog?.remove();
    dialog = D.createElement('dialog');
    dialog.className = 'qs-b2b-modal';
    dialog.setAttribute('aria-labelledby', 'qs-b2b-modal-title');
    dialog.innerHTML = `<div class="qs-b2b-modal__head"><h2 id="qs-b2b-modal-title">Your order is over the limit</h2><button type="button" class="qs-b2b-modal__close" data-close aria-label="Close">×</button></div>
<div class="qs-b2b-modal__body">${review.map((p) => `<p>${esc(p.text)}</p>`).join('')}
<label class="qs-b2b-modal__label" for="qs-b2b-note">Note for the seller (optional)</label>
<textarea id="qs-b2b-note" class="qs-b2b-modal__note" maxlength="${NOTE}" rows="4"></textarea>
<div class="qs-b2b-modal__help"><span>Add a note for the seller about this order, like a delivery date or why you need this quantity.</span><span data-count>0/${NOTE}</span></div>
<p class="qs-b2b-modal__error" role="alert" hidden></p></div>
<div class="qs-b2b-modal__foot"><button type="button" class="qs-b2b-modal__btn" data-close>Reduce order</button><button type="button" class="qs-b2b-modal__btn qs-b2b-modal__btn--primary" data-send>Send order request</button></div>`;
    D.body.append(dialog);
    const note = dialog.querySelector('textarea');
    const error = dialog.querySelector('.qs-b2b-modal__error');
    const send = dialog.querySelector('[data-send]');
    note.addEventListener('input', () => {
      dialog.querySelector('[data-count]').textContent = `${note.value.length}/${NOTE}`;
    });
    // Reduce order, ×, a click on the backdrop or Esc close it. Once sent, closing
    // reloads the page so the theme shows the emptied cart.
    dialog.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (dialog.dataset.sent) window.location.reload();
      else dialog.remove();
    });
    send.addEventListener('click', async () => {
      send.disabled = true;
      send.textContent = 'Sending…';
      error.hidden = true;
      try {
        const res = await fetch(`${base}apps/qs-b2b/order-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ locationId, note: note.value.trim(), lines: lines.map((l) => ({ variantId: l.vid, quantity: l.qty })) }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.draftOrder) throw new Error(out.error || FAILED);
        await fetch(`${base}cart/clear.js`, { method: 'POST', headers: { Accept: 'application/json' } }).catch(() => {});
        dialog.dataset.sent = '1';
        dialog.querySelector('#qs-b2b-modal-title').textContent = 'Order request sent';
        dialog.querySelector('.qs-b2b-modal__body').innerHTML = `<p>${esc(out.draftOrder.name)} is with the seller for review. You’ll find it on the B2B Portal, under Order requests.</p>`;
        dialog.querySelector('.qs-b2b-modal__foot').innerHTML = '<button type="button" class="qs-b2b-modal__btn qs-b2b-modal__btn--primary" data-close>Close</button>';
      } catch (err) {
        error.textContent = err.message || FAILED;
        error.hidden = false;
        send.disabled = false;
        send.textContent = 'Send order request';
      }
    });
    dialog.showModal();
  };
})();
