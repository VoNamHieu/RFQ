import React, { useState } from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { money } from '../../format.js';
import { useStore } from '../../store.jsx';
import { versionFlags } from '../../../shared/versions.js';
import { isHeld, heldReason, heldFirst, HeldOrderActions } from '../HeldOrders.jsx';
import { wcTone } from '../../../shared/wc.jsx';

const STATUS_TONE = {
  Fulfilled: 'success',
  Paid: 'success',
  'Needs review': 'warning',
  Blocked: 'critical',
  Cancelled: 'critical',
  'Draft order': 'info',
  Unfulfilled: 'attention',
  Declined: 'critical',
};
const orderTone = (s) => wcTone(STATUS_TONE[s]); // neutral tone for unmapped statuses

export function OrdersTab({ company }) {
  const { state } = useStore();
  const [loc, setLoc] = useState('all');
  // Orders held by a review threshold sit on top, with Approve / Decline (order limits).
  const reviewOrders = versionFlags().orderLimits;
  const allOrders = company.orders || [];
  const orders = (loc === 'all' ? allOrders : allOrders.filter((o) => o.location === loc))
    .slice()
    .sort(reviewOrders ? heldFirst : (a, b) => String(b.date).localeCompare(String(a.date)));
  const locationNames = [...new Set(allOrders.map((o) => o.location).filter(Boolean))];

  if (allOrders.length === 0) {
    return (
      <s-section>
        <EmptyBlock heading="No orders yet">Orders from this company will show up here.</EmptyBlock>
      </s-section>
    );
  }

  const rows = orders.map((o) => (
    <s-table-row key={o.id}>
      <s-table-cell>
        <s-stack gap="small-500">
          <s-text fontWeight="semibold">{o.id}</s-text>
          {o.po ? (
            <s-text color="subdued" fontSize="small">
              {o.po}
            </s-text>
          ) : null}
          {reviewOrders && isHeld(o) ? (
            <s-text tone="caution" fontSize="small">
              {heldReason(o, state.db)}
            </s-text>
          ) : null}
        </s-stack>
      </s-table-cell>
      <s-table-cell>{o.location || '—'}</s-table-cell>
      <s-table-cell>{o.buyer || '—'}</s-table-cell>
      <s-table-cell>{o.date || '—'}</s-table-cell>
      <s-table-cell>{money(o.amount)}</s-table-cell>
      <s-table-cell>
        <s-badge tone={orderTone(o.status)}>{o.status}</s-badge>
      </s-table-cell>
      {reviewOrders ? (
        <s-table-cell>
          {isHeld(o) ? (
            <s-stack direction="inline" justifyContent="end">
              <HeldOrderActions companyId={company.id} order={o} />
            </s-stack>
          ) : null}
        </s-table-cell>
      ) : null}
    </s-table-row>
  ));

  return (
    <s-section padding="none">
      <s-box padding="small" paddingBlockEnd="small-200">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small-200">
          <s-heading>{`Orders${loc === 'all' ? '' : ` · ${loc}`} (${orders.length})`}</s-heading>
          {locationNames.length > 1 && (
            <div style={{ minWidth: 180 }}>
              <s-select
                label="Location"
                labelAccessibilityVisibility="exclusive"
                value={loc}
                onChange={(e) => setLoc(e.currentTarget.value)}
              >
                <s-option value="all">All locations</s-option>
                {locationNames.map((n) => (
                  <s-option key={n} value={n}>
                    {n}
                  </s-option>
                ))}
              </s-select>
            </div>
          )}
        </s-grid>
      </s-box>
      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Order</s-table-header>
          <s-table-header listSlot="labeled">Location</s-table-header>
          <s-table-header listSlot="labeled">Buyer</s-table-header>
          <s-table-header listSlot="labeled">Date</s-table-header>
          <s-table-header listSlot="labeled" format="currency">
            Total
          </s-table-header>
          <s-table-header listSlot="secondary">Status</s-table-header>
          {reviewOrders ? <s-table-header listSlot="inline" /> : null}
        </s-table-header-row>
        <s-table-body>{rows}</s-table-body>
      </s-table>
    </s-section>
  );
}
