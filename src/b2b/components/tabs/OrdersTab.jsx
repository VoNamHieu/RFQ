import React from 'react';
import { Card, IndexTable, Badge, Text, BlockStack, Box, EmptyState } from '@shopify/polaris';
import { useStore } from '../../store.jsx';
import { money } from '../../format.js';

const STATUS_TONE = {
  Fulfilled: 'success',
  Paid: 'success',
  'Needs review': 'attention',
  Blocked: 'critical',
};

export function OrdersTab({ company }) {
  useStore();
  const orders = company.orders || [];

  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState heading="No orders yet" image="">
          <p>Orders from this company will show up here.</p>
        </EmptyState>
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
        <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card padding="0">
      <Box padding="300" paddingBlockEnd="0">
        <Text as="h2" variant="headingSm">
          Orders
        </Text>
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
