import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { money, money2 } from '../format.js';
import { CdSection, StatusDot, SideBlock, SideRow, cdDate, backActionFor } from '../components/companyLayout.jsx';
import { ORDER_STATUS_TONE } from '../components/tabs/OrdersTab.jsx';
import { isHeld, heldParts, HeldOrderActions } from '../components/HeldOrders.jsx';
import { versionFlags } from '../../shared/versions.js';
import { addressLines } from '../components/LocationModals.jsx';
import { Modal } from '../../shared/wc.jsx';

// An order's page in the app, in the company page's layout: back on top (to where it was
// opened from), then two columns. The main column: the order number and status, the
// review (an order held for review: why, and Decline / Approve) and its items with the
// total; the buyer's message is a link under the title that opens it (as on the Orders card). The side: the order's details, who ordered it (company
// and location open their pages).
export function OrderDetail() {
  const { state, dispatch } = useStore();
  const [noteOpen, setNoteOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [taxesOpen, setTaxesOpen] = useState(false);
  const { companyId, orderId } = state.selectedOrder || {};
  const company = (state.db.companies || []).find((c) => c.id === companyId);
  const order = company && (company.orders || []).find((o) => o.id === orderId);
  if (!company || !order) return null;

  const location = (company.locations || []).find((l) => (order.locationId ? l.id === order.locationId : l.name === order.location)) || null;
  // Back: to where it was opened from, else the company's Orders.
  const back = backActionFor(state, dispatch, 'order') || {
    content: `Back to ${company.name}`,
    onAction: () => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'orders' }),
  };
  const backLabel = state.backTo?.from === 'order' ? state.backTo.label : company.name;
  const held = versionFlags().orderLimits && isHeld(order);
  const declineMessage = order.status === 'Declined' ? order.declineMessage || null : null;
  const items = order.items || [];
  const itemsTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  // An order with a discount, shipping or tax sums up under its items, as Shopify's order
  // page does: Subtotal, then each of them (its code, method or rate), then the Total.
  // Several taxes are one Taxes row (their sum) whose Show taxes lists each one.
  const taxLines = order.taxLines || [];
  const charges = [
    order.discount ? { label: 'Discount', note: order.discount.label, value: `−${money2(order.discount.amount)}` } : null,
    order.shippingLine ? { label: 'Shipping', note: order.shippingLine.title, value: money2(order.shippingLine.amount) } : null,
    taxLines.length === 1 ? { label: 'Tax', note: taxLines[0].label, value: money2(taxLines[0].amount) } : null,
    taxLines.length > 1 ? { label: 'Taxes', taxes: true, value: money2(taxLines.reduce((s, t) => s + t.amount, 0)) } : null,
  ].filter(Boolean);
  const qtyCount = items.reduce((s, i) => s + i.qty, 0);
  const dash = (v) => (v && v !== 'None' && v !== '—' ? v : '—');
  // Where it ships: the order's own address, else its location's (a B2B order ships there).
  const shipTo = addressLines(order.shipping).length ? addressLines(order.shipping) : addressLines(location?.shipping);
  // Review: what held it and where it stands now, each with its order limit — a link that
  // opens the limit, then comes back here.
  const parts = held ? heldParts(order, state.db) : null;
  const openLimit = (limit) =>
    dispatch({
      type: 'OPEN_LIMIT_EDITOR',
      limit,
      returnTo: { view: 'order', selectedCompany: company.id, selectedOrder: state.selectedOrder, backTo: state.backTo || null },
    });
  const reason = (p) => (
    <p className="cd-review__line">
      {p.text}
      {p.limit || p.name ? ' · ' : null}
      {p.limit ? (
        <button type="button" className="cd-text-link cd-text-link--body cd-text-link--inline" onClick={() => openLimit(p.limit)}>
          {p.limit.name}
        </button>
      ) : p.name ? (
        <span>
          {p.name} <span className="cd-muted">(deleted)</span>
        </span>
      ) : null}
    </p>
  );

  return (
    <div className="cd-page">
      <div className="cd-topbar">
        <button type="button" className="cd-back" onClick={back.onAction}>
          <span className="cd-back__circle">
            <s-icon type="chevron-left" />
          </span>
          {backLabel}
        </button>
      </div>

      <div className="cd-layout">
        <div className="cd-main">
          <div className="cd-intro">
            <div>
              <div className="cd-inline">
                <h1 className="cd-title">{order.id}</h1>
                <StatusDot tone={ORDER_STATUS_TONE[order.status]}>{order.status}</StatusDot>
              </div>
              <p className="cd-subtitle">{[cdDate(order.date), order.po && order.po !== 'None' ? order.po : null, order.location].filter(Boolean).join(' · ')}</p>
              {/* The buyer's message, and (declined with one) what the buyer was told — side by side. */}
              {order.buyerMessage || declineMessage ? (
                <div className="cd-intro__links">
                  {order.buyerMessage ? (
                    <button type="button" className="cd-text-link cd-text-link--body" onClick={() => setNoteOpen(true)}>
                      Buyer message
                    </button>
                  ) : null}
                  {declineMessage ? (
                    <button type="button" className="cd-text-link cd-text-link--body" onClick={() => setDeclineOpen(true)}>
                      Message to the buyer
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* Held for review: why (and where it stands now), then the decision. */}
          {held ? (
            <CdSection title="Review">
              <div className="cd-card">
                <div className="cd-card__body cd-review">
                  <div>
                    <span className="cd-row__label">{parts.now ? 'Held when placed' : 'Reason'}</span>
                    {reason(parts.held)}
                  </div>
                  {parts.now ? (
                    <div>
                      <span className="cd-row__label">Now</span>
                      {reason(parts.now)}
                    </div>
                  ) : null}
                  {parts.period !== 'order' && parts.others ? (
                    <div>
                      <span className="cd-row__label">Counted</span>
                      <p className="cd-review__line">{`This order and ${money(parts.others)} ordered before it this ${parts.period}`}</p>
                    </div>
                  ) : null}
                </div>
                <div className="cd-card__foot cd-review__foot">
                  <HeldOrderActions companyId={company.id} order={order} />
                </div>
              </div>
            </CdSection>
          ) : null}


          <CdSection title={`Items${items.length ? ` (${items.length})` : ''}`}>
            <div className="cd-card">
              {items.length ? (
                <div className="cd-table-scroll">
                  <table className="cd-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="cd-num">Quantity</th>
                        <th className="cd-num">Price</th>
                        <th className="cd-num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((i, n) => (
                        <tr key={`${i.sku}-${n}`}>
                          <td>
                            <span className="cd-primary">{i.title}</span>
                            {i.sku ? <span className="cd-sub">{i.sku}</span> : null}
                          </td>
                          <td className="cd-num">{i.qty}</td>
                          <td className="cd-num">{money(i.price)}</td>
                          <td className="cd-num">{money(i.price * i.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="cd-card__empty">
                  {order.lines ? `${order.lines} ${order.lines === 1 ? 'item' : 'items'} · their details aren’t available for this order.` : 'No items recorded for this order.'}
                </div>
              )}
              {charges.length ? (
                <div className="cd-order-summary">
                  <span>Subtotal</span>
                  <span className="cd-order-summary__note">{items.length ? `${qtyCount} ${qtyCount === 1 ? 'item' : 'items'}` : ''}</span>
                  <span className="cd-num">{money2(items.length ? itemsTotal : order.amount)}</span>
                  {charges.map((c) => (
                    <React.Fragment key={c.label}>
                      <span>{c.label}</span>
                      {c.taxes ? (
                        <span>
                          <button type="button" className="cd-text-link cd-text-link--body" aria-expanded={taxesOpen} onClick={() => setTaxesOpen((v) => !v)}>
                            {taxesOpen ? 'Hide taxes' : 'Show taxes'}
                          </button>
                        </span>
                      ) : (
                        <span className="cd-order-summary__note">{c.note}</span>
                      )}
                      <span className="cd-num">{c.value}</span>
                      {c.taxes && taxesOpen
                        ? taxLines.map((t) => (
                            <React.Fragment key={t.label}>
                              <span />
                              <span className="cd-order-summary__note">{t.label}</span>
                              <span className="cd-num cd-order-summary__note">{money2(t.amount)}</span>
                            </React.Fragment>
                          ))
                        : null}
                    </React.Fragment>
                  ))}
                  <strong className="cd-order-summary__total">Total</strong>
                  <span className="cd-order-summary__total" />
                  <strong className="cd-order-summary__total cd-num">{money2(order.amount)}</strong>
                </div>
              ) : (
                <div className="cd-card__foot cd-order-total">
                  {items.length && Math.abs(itemsTotal - order.amount) > 0.005 ? <span className="cd-sub">{`Items ${money(itemsTotal)}`}</span> : <span />}
                  <span>
                    Total <strong>{money(order.amount)}</strong>
                  </span>
                </div>
              )}
            </div>
          </CdSection>
        </div>

        <div className="cd-side">
          <SideBlock title="Order">
            <SideRow label="Status">
              <StatusDot tone={ORDER_STATUS_TONE[order.status]}>{order.status}</StatusDot>
            </SideRow>
            <SideRow label="Total">{money(order.amount)}</SideRow>
            <SideRow label="Date">{cdDate(order.date) || '—'}</SideRow>
            <SideRow label="PO number">{dash(order.po)}</SideRow>
            <SideRow label="Source">{dash(order.source)}</SideRow>
            <SideRow label="In Shopify">{dash(order.shopifyStatus)}</SideRow>
          </SideBlock>

          <SideBlock title="Customer">
            <SideRow label="Company">
              <button type="button" className="cd-text-link cd-text-link--body" onClick={() => dispatch({ type: 'OPEN_COMPANY', id: company.id })}>
                {company.name}
              </button>
            </SideRow>
            <SideRow label="Location">
              {location ? (
                <button
                  type="button"
                  className="cd-text-link cd-text-link--body"
                  onClick={() => dispatch({ type: 'OPEN_LOCATION', companyId: company.id, locationId: location.id })}
                >
                  {location.name}
                </button>
              ) : (
                dash(order.location)
              )}
            </SideRow>
            <SideRow label="Buyer">{dash(order.buyer)}</SideRow>
            <SideRow label="Shipping address">{shipTo.length ? shipTo.map((line, i) => <div key={i}>{line}</div>) : 'Not set'}</SideRow>
          </SideBlock>
        </div>
      </div>
      {noteOpen ? (
        <Modal onClose={() => setNoteOpen(false)} heading={`Buyer message · ${order.id}`}>
          <s-stack gap="small">
            <s-text color="subdued">{[order.buyer, order.location, cdDate(order.date)].filter(Boolean).join(' · ')}</s-text>
            <s-paragraph>{order.buyerMessage}</s-paragraph>
          </s-stack>
          <s-button slot="secondary-actions" onClick={() => setNoteOpen(false)}>
            Close
          </s-button>
        </Modal>
      ) : null}
      {declineOpen && declineMessage ? (
        <Modal onClose={() => setDeclineOpen(false)} heading={`Message to the buyer · ${order.id}`}>
          <s-paragraph>{declineMessage}</s-paragraph>
          <s-button slot="secondary-actions" onClick={() => setDeclineOpen(false)}>
            Close
          </s-button>
        </Modal>
      ) : null}
    </div>
  );
}
