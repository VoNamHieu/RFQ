import React from 'react';
import { Card, IndexTable, Badge, Button, InlineStack, Text, Box, BlockStack } from '@shopify/polaris';
import { EditIcon, ExchangeIcon, XCircleIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { companyQuantityPolicy, policyStatus, scopeTypeLabel } from '../pricing.js';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import quantityPricingArt from '../assets/quantity-pricing-empty.webp';

export function QuantityPricingCard({ company }) {
  const { state, dispatch } = useStore();
  const policy = companyQuantityPolicy(company, state.db.policies);

  // No quantity pricing yet — a proper empty state so the Add action is obvious
  // (mirrors the Base pricing card) instead of a "Not set" row with a bare +.
  if (!policy) {
    return (
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingSm">
            Quantity pricing
          </Text>
          <EmptyBlock
            image={quantityPricingArt}
            imageAlt="Growing box stacks with the unit price dropping from $10 to $9 to $8"
            heading="No quantity pricing yet"
            action={{
              content: 'Add quantity pricing',
              onAction: () => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, kind: 'quantity', mode: 'add' }),
            }}
          >
            Add a quantity pricing to give buyers a discount as the order quantity grows.
          </EmptyBlock>
        </BlockStack>
      </Card>
    );
  }

  const st = policyStatus(policy, state.db);

  return (
    <Card padding="0">
      <Box padding="300" paddingBlockEnd="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">
            Quantity pricing
          </Text>
          <Text as="span" tone="subdued" variant="bodySm">
            How the price changes with quantity
          </Text>
        </InlineStack>
      </Box>
      <IndexTable
        resourceName={{ singular: 'quantity pricing', plural: 'quantity pricings' }}
        itemCount={1}
        selectable={false}
        headings={[{ title: 'Pricing' }, { title: 'Products' }, { title: 'Status' }, { title: '', alignment: 'end' }]}
      >
        <IndexTable.Row id="quantity" position={0}>
          <IndexTable.Cell>
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {policy.name}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span" tone="subdued">
              {scopeTypeLabel(policy)}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={st.tone}>{st.label}</Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack gap="100" align="end" blockAlign="center" wrap={false}>
              <Button icon={EditIcon} variant="tertiary" accessibilityLabel="Edit pricing" onClick={() => dispatch({ type: 'OPEN_EDITOR', policy, context: { mode: 'edit', companyId: company.id } })} />
              <Button icon={ExchangeIcon} variant="tertiary" accessibilityLabel="Change pricing" onClick={() => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, kind: 'quantity', mode: 'swap', swapId: policy.id })} />
              <Button icon={XCircleIcon} variant="tertiary" tone="critical" accessibilityLabel="Remove" onClick={() => dispatch({ type: 'REMOVE_COMPANY_QUANTITY', companyId: company.id })} />
            </InlineStack>
          </IndexTable.Cell>
        </IndexTable.Row>
      </IndexTable>
    </Card>
  );
}
