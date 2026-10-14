import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { money } from '../format.js';
import { reviewMaximumFor, spentSoFar } from '../limits.js';
import { Modal } from '../../shared/wc.jsx';

// Orders an order maximum (order limits) held back for review: status 'Needs review',
// `heldAt` = what it broke then ({ value, limitId, limitName }). The buyer couldn't check out, so the order waits as a
// draft order until the merchant approves it (it becomes a real order) or
// declines it. Listed on app home and in the location / company orders.
export const isHeld = (o) => o.status === 'Needs review';

// Held orders across every company, the longest-waiting first.
export function heldOrders(db) {
  return (db.companies || [])
    .flatMap((company) =>
      (company.orders || []).filter(isHeld).map((order) => ({
        order,
        company,
        location: (company.locations || []).find((l) => l.name === order.location) || null,
      })),
    )
    .sort((a, b) => String(a.order.date).localeCompare(String(b.order.date)));
}

// Why an order is waiting: what it broke when it was held (`heldAt`), next to the
// maximum in effect at its location now, read off the location's record — the
// limits can change while it waits (a limit edited, turned off or deleted, a
// contract starting or ending). It stays held either way: under the maximum now,
// it still waits for the merchant to approve or decline it.
export function heldReason(order, db) {
  const company = (db.companies || []).find((c) => (c.orders || []).some((o) => o.id === order.id));
  const location = company && (company.locations || []).find((l) => (order.locationId ? l.id === order.locationId : l.name === order.location));
  if (!location) return order.reason || 'Held for your review';
  const held = order.heldAt;
  // A weekly or monthly maximum counts this order on top of the location's other
  // orders in that period.
  const period = held?.period || 'order';
  const per = period === 'order' ? '' : ` ${period}ly`;
  const max = reviewMaximumFor(db, company.id, location.id, period);
  const atLocation = (o) => (o.locationId ? o.locationId === location.id : o.location === location.name);
  const others = period === 'order' ? 0 : spentSoFar((company.orders || []).filter((o) => o.id !== order.id && atLocation(o)), order.date)[period];
  const total = others + order.amount;
  const now = max
    ? `${total > max.value ? 'over' : 'within'} the ${money(max.value)}${per} maximum · ${max.limit.name}`
    : 'no longer over a limit';
  if (!held) return now[0].toUpperCase() + now.slice(1);
  if (max && max.value === held.value && max.limit.id === held.limitId) return `Over the ${money(held.value)}${per} maximum · ${max.limit.name}`;
  return `Held over ${money(held.value)}${per} · now ${now}`;
}

// Held first, then newest — so what's waiting sits on top of an order list.
export const heldFirst = (a, b) => Number(isHeld(b)) - Number(isHeld(a)) || String(b.date).localeCompare(String(a.date));

export function HeldOrderActions({ companyId, order }) {
  const { dispatch } = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    // Keep clicks off the row underneath (rows can open the order's location).
    <div onClick={(e) => e.stopPropagation()}>
      <s-stack direction="inline" gap="small-200">
        <s-button onClick={() => setConfirm(true)}>Decline</s-button>
        <s-button variant="primary" onClick={() => dispatch({ type: 'APPROVE_ORDER', companyId, orderId: order.id })}>
          Approve
        </s-button>
      </s-stack>
      {confirm && (
        <Modal onClose={() => setConfirm(false)} heading={`Decline order ${order.id}?`}>
          <s-paragraph>
            {`The draft order for ${money(order.amount)} is cancelled and ${order.buyer || 'the buyer'} is told it wasn’t approved. They can change the order and submit it again.`}
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              setConfirm(false);
              dispatch({ type: 'DECLINE_ORDER', companyId, orderId: order.id });
            }}
          >
            Decline order
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirm(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </div>
  );
}
