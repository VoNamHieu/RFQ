import React from 'react';
import { Card, IndexTable, Badge, Text, BlockStack, Box, InlineStack, Button } from '@shopify/polaris';
import { PlusIcon } from '@shopify/polaris-icons';
import { useStore } from '../../store.jsx';

export function LocationsTab({ company }) {
  const { dispatch } = useStore();
  const locations = company.locations || [];

  const rows = locations.map((l, index) => {
    const buyers = typeof l.buyers === 'number' ? l.buyers : (company.contacts || []).filter((c) => c.locations === l.name).length;
    const override = l.pricing && (l.pricing.base || l.pricing.quantity);
    return (
      <IndexTable.Row
        id={l.id || String(index)}
        key={l.id || index}
        position={index}
        onClick={() => dispatch({ type: 'OPEN_LOCATION', companyId: company.id, locationId: l.id })}
      >
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {l.name}
            </Text>
            {l.address ? (
              <Text as="span" tone="subdued" variant="bodySm">
                {l.address}
              </Text>
            ) : null}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{l.terms || l.paymentTerms || '—'}</IndexTable.Cell>
        <IndexTable.Cell>{l.ordering || (l.purchasingMode === 'REQUIRE_APPROVAL' ? 'You approve first' : 'Buys directly')}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone="subdued" variant="bodySm">
            {override ? 'Location override' : 'Inherited from company'}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{buyers}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="success">{l.status || 'Active'}</Badge>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Card padding="0">
      <Box padding="300" paddingBlockEnd="0">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">
            Locations
          </Text>
          <Button icon={PlusIcon} variant="tertiary" onClick={() => dispatch({ type: 'TOAST', message: 'Add location — demo only' })}>
            Add location
          </Button>
        </InlineStack>
      </Box>
      <IndexTable
        resourceName={{ singular: 'location', plural: 'locations' }}
        itemCount={locations.length}
        selectable={false}
        headings={[
          { title: 'Location' },
          { title: 'Payment terms' },
          { title: 'Purchasing' },
          { title: 'Pricing' },
          { title: 'Buyers' },
          { title: 'Status' },
        ]}
      >
        {rows}
      </IndexTable>
    </Card>
  );
}
