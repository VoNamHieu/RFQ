import React, { useState } from 'react';
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  Button,
  ButtonGroup,
  Box,
} from '@shopify/polaris';
import { EditIcon, DeleteIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { policyStatus, scopeTypeLabel, policyUsage } from '../pricing.js';

const AUDIENCE = [
  { id: 'all', label: 'All' },
  { id: 'b2b', label: 'Companies' },
  { id: 'd2c', label: 'Customers' },
];

export function PricingLibrary() {
  const { state, dispatch } = useStore();
  const [audience, setAudience] = useState('all');

  const policies = state.db.policies.filter((p) => (audience === 'all' ? true : p.audienceType === audience));

  const rows = policies.map((p, index) => {
    const st = policyStatus(p, state.db);
    return (
      <IndexTable.Row
        id={p.id}
        key={p.id}
        position={index}
        onClick={() => dispatch({ type: 'OPEN_EDITOR', policy: p, context: { mode: 'edit' } })}
      >
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {p.name}
            </Text>
            <Text as="span" tone="subdued" variant="bodySm">
              {p.type}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{p.priceKind === 'quantity' ? 'Quantity pricing' : 'Base pricing'}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={p.audienceType === 'b2b' ? 'info' : undefined}>
            {p.audienceType === 'b2b' ? 'Companies' : 'Customers'}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {scopeTypeLabel(p)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={st.tone}>{st.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone="subdued" variant="bodySm">
            {policyUsage(p, state.db)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100" align="end" wrap={false}>
            <Button
              icon={EditIcon}
              variant="tertiary"
              accessibilityLabel="Edit pricing"
              onClick={() => dispatch({ type: 'OPEN_EDITOR', policy: p, context: { mode: 'edit' } })}
            />
            <Button
              icon={DeleteIcon}
              variant="tertiary"
              tone="critical"
              accessibilityLabel="Delete pricing"
              onClick={() => dispatch({ type: 'TOAST', message: 'Delete — demo only' })}
            />
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Pricing"
      subtitle="Make a price once, then assign it to companies or customers."
      primaryAction={{
        content: 'Create pricing',
        onAction: () => dispatch({ type: 'OPEN_EDITOR', policy: null, context: { mode: 'add-base' } }),
      }}
    >
      <Card padding="0">
        <Box padding="300" paddingBlockEnd="200">
          <ButtonGroup variant="segmented">
            {AUDIENCE.map((a) => (
              <Button key={a.id} pressed={audience === a.id} onClick={() => setAudience(a.id)}>
                {a.label}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
        <IndexTable
          resourceName={{ singular: 'pricing', plural: 'pricings' }}
          itemCount={rows.length}
          selectable={false}
          headings={[
            { title: 'Name' },
            { title: 'Pricing type' },
            { title: 'Serves' },
            { title: 'Products' },
            { title: 'Status' },
            { title: 'Assigned to' },
            { title: '', alignment: 'end' },
          ]}
        >
          {rows}
        </IndexTable>
      </Card>
    </Page>
  );
}
