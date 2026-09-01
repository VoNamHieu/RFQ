import React from 'react';
import { Card, IndexTable, Badge, Button, InlineStack, Text, Box } from '@shopify/polaris';
import { EditIcon, ExchangeIcon, XCircleIcon, PlusIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { companyQuantityPolicy, policyStatus, scopeTypeLabel } from '../pricing.js';

export function QuantityPricingCard({ company }) {
  const { state, dispatch } = useStore();
  const policy = companyQuantityPolicy(company, state.db.policies);
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
            {policy ? (
              <Text as="span" variant="bodyMd" fontWeight="medium">
                {policy.name}
              </Text>
            ) : (
              <Badge tone="attention">Not set</Badge>
            )}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span" tone="subdued">
              {policy ? scopeTypeLabel(policy) : '-'}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            {policy ? <Badge tone={st.tone}>{st.label}</Badge> : <Text as="span" tone="subdued">-</Text>}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack gap="100" align="end" blockAlign="center" wrap={false}>
              {policy ? (
                <>
                  <Button icon={EditIcon} variant="tertiary" accessibilityLabel="Edit pricing" onClick={() => dispatch({ type: 'OPEN_EDITOR', policy, context: { mode: 'edit', companyId: company.id } })} />
                  <Button icon={ExchangeIcon} variant="tertiary" accessibilityLabel="Change pricing" onClick={() => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, kind: 'quantity', mode: 'swap', swapId: policy.id })} />
                  <Button icon={XCircleIcon} variant="tertiary" tone="critical" accessibilityLabel="Remove" onClick={() => dispatch({ type: 'REMOVE_COMPANY_QUANTITY', companyId: company.id })} />
                </>
              ) : (
                <Button icon={PlusIcon} variant="tertiary" accessibilityLabel="Assign a quantity pricing" onClick={() => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, kind: 'quantity', mode: 'add' })} />
              )}
            </InlineStack>
          </IndexTable.Cell>
        </IndexTable.Row>
      </IndexTable>
    </Card>
  );
}
