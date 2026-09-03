import React, { useState } from 'react';
import { Card, IndexTable, Badge, Text, BlockStack, Box, InlineStack, Select } from '@shopify/polaris';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { money } from '../../format.js';

const STATUS_TONE = {
  Fulfilled: 'success',
  Paid: 'success',
  'Needs review': 'warning',
  Blocked: 'critical',
  Cancelled: 'critical',
  'Draft order': 'info',
};
const orderTone = (s) => STATUS_TONE[s]; // neutral fallback for unmapped statuses

export function OrdersTab({ company }) {
  const [loc, setLoc] = useState('all');
  const allOrders = company.orders || [];
  const orders = (loc === 'all' ? allOrders : allOrders.filter((o) => o.location === loc))
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
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
        ]}
      >
        {rows}
      </IndexTable>
    </Card>
  );
}
