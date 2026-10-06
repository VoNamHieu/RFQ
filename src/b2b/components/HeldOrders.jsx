import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { money } from '../format.js';
import { Modal } from '../../shared/wc.jsx';

// Orders a review threshold (order limits) held back: status 'Needs review',
// `heldBy` = the limit. The buyer couldn't check out, so the order waits as a
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

// Why an order is waiting: the threshold and the limit that set it.
export function heldReason(order, db) {
  const limit = (db.limits || []).find((l) => l.id === order.heldBy);
  if (limit?.threshold != null) return `Over the ${money(limit.threshold)} review threshold · ${limit.name}`;
  return order.reason || 'Held for your review';
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
