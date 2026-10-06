import React, { useState } from 'react';
import { Card, IndexTable, Badge, Text, BlockStack, Box, InlineStack, Select } from '@shopify/polaris';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { money } from '../../format.js';
import { useStore } from '../../store.jsx';
import { versionFlags } from '../../../shared/versions.js';
import { isHeld, heldReason, heldFirst, HeldOrderActions } from '../HeldOrders.jsx';

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
const orderTone = (s) => STATUS_TONE[s]; // neutral tone for unmapped statuses

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
      <Card>
        <EmptyBlock heading="No orders yet">Orders from this company will show up here.</EmptyBlock>
      </Card>
    );
  }

  const rows = orders.map((o, index) => (
    <IndexTable.Row id={o.id} key={o.id} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {o.id}
          </Text>
          {o.po ? (
            <Text as="span" tone="subdued" variant="bodySm">
              {o.po}
            </Text>
          ) : null}
          {reviewOrders && isHeld(o) ? <Text as="span" tone="caution" variant="bodySm">{heldReason(o, state.db)}</Text> : null}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{o.location || '—'}</IndexTable.Cell>
      <IndexTable.Cell>{o.buyer || '—'}</IndexTable.Cell>
      <IndexTable.Cell>{o.date || '—'}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" alignment="end">
          {money(o.amount)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={orderTone(o.status)}>{o.status}</Badge>
      </IndexTable.Cell>
      {reviewOrders ? (
        <IndexTable.Cell>
          {isHeld(o) ? <InlineStack align="end"><HeldOrderActions companyId={company.id} order={o} /></InlineStack> : null}
        </IndexTable.Cell>
      ) : null}
    </IndexTable.Row>
  ));

  return (
    <Card padding="0">
      <Box padding="300" paddingBlockEnd="200">
        <InlineStack align="space-between" blockAlign="center" gap="200">
          <Text as="h2" variant="headingSm">{`Orders${loc === 'all' ? '' : ` · ${loc}`} (${orders.length})`}</Text>
          {locationNames.length > 1 && (
            <Box minWidth="180px">
              <Select
                label="Location"
                labelHidden
                options={[{ label: 'All locations', value: 'all' }, ...locationNames.map((n) => ({ label: n, value: n }))]}
                value={loc}
                onChange={setLoc}
              />
            </Box>
          )}
        </InlineStack>
      </Box>
      <IndexTable
        resourceName={{ singular: 'order', plural: 'orders' }}
        itemCount={orders.length}
        selectable={false}
        headings={[
          { title: 'Order' },
          { title: 'Location' },
          { title: 'Buyer' },
          { title: 'Date' },
          { title: 'Total', alignment: 'end' },
          { title: 'Status' },
          ...(reviewOrders ? [{ title: '', alignment: 'end' }] : []),
        ]}
      >
        {rows}
      </IndexTable>
    </Card>
  );
}
