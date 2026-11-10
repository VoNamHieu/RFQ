import React, { useState } from 'react';
import { money } from '../../format.js';
import { useStore } from '../../store.jsx';
import { versionFlags } from '../../../shared/versions.js';
import { isHeld, heldReason, heldFirst, HeldOrderActions } from '../HeldOrders.jsx';
import { Modal } from '../../../shared/wc.jsx';
import { CdSection, StatusDot, CardBanner, CardFoot, ExpandButton, rangeLabel, cdDate, backTo } from '../companyLayout.jsx';
import ordersArt from '../../assets/orders-empty.webp';
import { DevStrip } from '../../../shared/DevStrip.jsx';

// order.status → its dot's tone (unmapped = neutral grey).
export const ORDER_STATUS_TONE = {
  Fulfilled: 'success',
  Paid: 'success',
  'Needs review': 'warning',
  'Invoice sent': 'info',
  Blocked: 'critical',
  Cancelled: 'critical',
  'Draft order': 'info',
  Unfulfilled: 'attention',
  Declined: 'critical',
};
// Rows per page: 5 in the card, as the location page's history tables; 50 on its
// full page (View all).
const PAGE_SIZE = 5;
const FULL_PAGE_SIZE = 50;
// The card's review banner closed with ✕ (by company and location shown: the orders to
// review then) stays closed until the page reloads — unless another order needs review
// there. As the location page's.
const closedReviews = new Map();
// Prototype: the card's dev strip (preview its empty state) shows in production too.
const SHOW_DEV_TOOLS = true;

// The company page's Orders section: the title with View all (the expand icon) and a
// location select, then a card with the orders (held ones first), a page at a time. `full`:
// the same section on its own page (View all opens it), at full width, without View all.
export function OrdersTab({ company, full = false }) {
  const { state, dispatch } = useStore();
  // Opened from a location (its ⤢ or review banner; back goes to it): the full page stays
  // on that location — its Location select shows it, locked.
  const lockedLoc = full && state.backTo?.view === 'location' && state.ordersLocation && state.ordersLocation !== 'all' ? state.ordersLocation : null;
  const [pickedLoc, setLoc] = useState(state.ordersLocation || 'all');
  const loc = lockedLoc || pickedLoc;
  const [page, setPage] = useState(0);
  // The order whose buyer message is open (its Buyer message link).
  const [noteOf, setNoteOf] = useState(null);
  const [, setReviewClosed] = useState(0);
  // Dev: the card as it is with no orders yet (the company's orders stay as they are).
  const [devEmpty, setDevEmpty] = useState(false);
  // Orders held by an order maximum sent for review sit on top, with Approve / Decline (order limits).
  const reviewOrders = versionFlags().orderLimits;
  // On the full page (order limits): All or Needs review only; the card's banner button
  // opens the page on Needs review.
  const [status, setStatus] = useState(full && reviewOrders && state.companyListFilter === 'review' ? 'review' : 'all');
  const statusSelect = full && reviewOrders;
  // A declined order request leaves the list (the buyer still sees it, declined, on the storefront).
  const realOrders = (company.orders || []).filter((o) => o.status !== 'Declined');
  const allOrders = devEmpty ? [] : realOrders;
  // On the card, while the company has orders: Preview empty / Show data; a note only
  // while previewing.
  const devStrip =
    SHOW_DEV_TOOLS && !full && realOrders.length > 0 ? (
      <DevStrip id="company-orders-empty" spaced>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone="info">Dev</s-badge>
          {devEmpty ? (
            <s-text fontSize="small" color="subdued">
              Previewing the empty state — this company’s orders still exist.
            </s-text>
          ) : null}
          <s-press-button pressed={devEmpty} onClick={() => setDevEmpty(!devEmpty)}>
            {devEmpty ? 'Show data' : 'Preview empty'}
          </s-press-button>
        </s-stack>
      </DevStrip>
    ) : null;
  const atLocation = loc === 'all' ? allOrders : allOrders.filter((o) => o.location === loc);
  // The banner counts the orders to review at the location shown.
  const heldCount = reviewOrders ? atLocation.filter(isHeld).length : 0;
  const reviewKey = `${company.id}::${loc}`;
  const heldIds = atLocation.filter(isHeld).map((o) => o.id).join(',');
  const reviewClosed = !full && closedReviews.get(reviewKey) === heldIds;
  const closeReview = () => {
    closedReviews.set(reviewKey, heldIds);
    setReviewClosed((n) => n + 1);
  };
  const orders = (statusSelect && status === 'review' ? atLocation.filter(isHeld) : atLocation)
    .slice()
    .sort(reviewOrders ? heldFirst : (a, b) => String(b.date).localeCompare(String(a.date)));
  const locationNames = [...new Set(allOrders.map((o) => o.location).filter(Boolean))];

  if (allOrders.length === 0) {
    return (
      <CdSection title="Orders">
        {devStrip}
        <div className="cd-card">
          <div className="cd-card__empty">
            {/* The art at the empty states' size (EmptyBlock's), as the Locations section's. */}
            <s-stack gap="small-200" alignItems="center">
              <img
                src={ordersArt}
                alt="An order sheet in a tray"
                style={{ display: 'block', height: 140, width: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }}
              />
              <span>No orders from this company yet.</span>
            </s-stack>
          </div>
        </div>
      </CdSection>
    );
  }

  const pageSize = full ? FULL_PAGE_SIZE : PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(orders.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const pageOrders = orders.slice(start, start + pageSize);

  // A row opens the order's page, back to this card or this full page.
  const open = (o) =>
    dispatch({ type: 'OPEN_ORDER', companyId: company.id, orderId: o.id, backTo: backTo(state, 'order', company, null, full ? 'Orders' : null) });
  const own = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };
  const rows = pageOrders.map((o) => (
    <tr key={o.id} className="cd-row-link" onClick={() => open(o)}>
      {/* Order and buyer don't wrap (a name stays on one line); the full page's actions
          column only takes what its buttons need. */}
      <td className="cd-nowrap">
        <button type="button" className="cd-link-button">
          {o.id}
        </button>
        {o.date || o.po ? <span className="cd-sub">{[cdDate(o.date), o.po].filter(Boolean).join(' · ')}</span> : null}
        {/* The buyer's message as a link that opens it: on the card for the orders to
            review, on the full page for every order that has one. */}
        {(full ? o.buyerMessage : reviewOrders && isHeld(o) && o.buyerMessage) ? (
          <button type="button" className="cd-text-link" onClick={own(() => setNoteOf(o))}>
            Buyer message
          </button>
        ) : null}
      </td>
      <td className="cd-nowrap">
        {o.buyer || '—'}
        {o.location ? <span className="cd-sub">{o.location}</span> : null}
      </td>
      <td className="cd-num">{money(o.amount)}</td>
      <td>
        <StatusDot tone={ORDER_STATUS_TONE[o.status]}>{o.status}</StatusDot>
        {/* The card only shows it: Review opens this order's page, where the reason and
            the buyer's message sit by Decline / Approve. */}
        {!full && reviewOrders && isHeld(o) ? (
          <button
            type="button"
            className="cd-text-link cd-text-link--indent"
            onClick={own(() => open(o))}
          >
            Review
          </button>
        ) : null}
        {/* Full page: why it's held for review, under the status, lined up with its word. */}
        {full && reviewOrders && isHeld(o) ? <span className="cd-sub cd-sub--indent cd-sub--caution">{heldReason(o, state.db)}</span> : null}
      </td>
      {full && reviewOrders ? (
        <td className="cd-num cd-actions">
          {isHeld(o) ? (
            <s-stack direction="inline" justifyContent="end">
              <HeldOrderActions companyId={company.id} order={o} />
            </s-stack>
          ) : null}
        </td>
      ) : null}
    </tr>
  ));

  return (
    <CdSection
      title={`Orders${loc === 'all' ? '' : ` · ${loc}`} (${orders.length})`}
      controls={
        !full || statusSelect || locationNames.length > 1 ? (
          <>
            {full ? null : <ExpandButton id="company-orders-view-all" onAction={() => dispatch({ type: 'SET_COMPANY_TAB', tab: 'orders-all' })} />}
            {statusSelect ? (
              <div style={{ minWidth: 180 }}>
                <s-select
                  label="Status"
                  labelAccessibilityVisibility="exclusive"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.currentTarget.value);
                    setPage(0);
                  }}
                >
                  <s-option value="all">{`All (${atLocation.length})`}</s-option>
                  <s-option value="review">{`Needs review (${atLocation.filter(isHeld).length})`}</s-option>
                </s-select>
              </div>
            ) : null}
            {locationNames.length > 1 ? (
              <div style={{ minWidth: 180 }}>
                <s-select
                  label="Location"
                  labelAccessibilityVisibility="exclusive"
                  value={loc}
                  disabled={!!lockedLoc}
                  onChange={(e) => {
                    setLoc(e.currentTarget.value);
                    setPage(0);
                  }}
                >
                  <s-option value="all">All locations</s-option>
                  {locationNames.map((n) => (
                    <s-option key={n} value={n}>
                      {n}
                    </s-option>
                  ))}
                </s-select>
              </div>
            ) : null}
          </>
        ) : null
      }
    >
      {devStrip}
      {heldCount > 0 && !reviewClosed && (
        <CardBanner
          action={
            full
              ? null
              : {
                  label: 'Review orders',
                  onAction: () => dispatch({ type: 'SET_COMPANY_TAB', tab: 'orders-all', filter: 'review' }),
                }
          }
          onDismiss={full ? undefined : closeReview}
          textAction
        >
          {`${heldCount} ${heldCount === 1 ? 'order needs' : 'orders need'} your review`}
        </CardBanner>
      )}
      <div className="cd-card">
        <div className="cd-table-scroll">
          <table className="cd-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Buyer</th>
                <th className="cd-num">Total</th>
                <th>Status</th>
                {full && reviewOrders ? <th className="cd-actions" /> : null}
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
        {/* The card shows its first orders only; the full page (⤢) pages through them all. */}
        {full ? (
          <CardFoot
            current={current}
            count={pageCount}
            label={rangeLabel(start, pageOrders.length, orders.length)}
            onPage={setPage}
          />
        ) : null}
      </div>
      {noteOf ? (
        <Modal onClose={() => setNoteOf(null)} heading={`Buyer message · ${noteOf.id}`}>
          <s-stack gap="small">
            <s-text color="subdued">{[noteOf.buyer, noteOf.location, cdDate(noteOf.date)].filter(Boolean).join(' · ')}</s-text>
            <s-paragraph>{noteOf.buyerMessage}</s-paragraph>
          </s-stack>
          <s-button slot="secondary-actions" onClick={() => setNoteOf(null)}>
            Close
          </s-button>
        </Modal>
      ) : null}
    </CdSection>
  );
}
