import React from 'react';
import { Card, IndexTable, Badge, Button, InlineStack, Text, Box, BlockStack } from '@shopify/polaris';
import { EditIcon, ExchangeIcon, XCircleIcon, PlusIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { companyQuantityEntries, locationOnlyEntries, pricingLocationsLabel, policyStatus, scopeTypeLabel } from '../pricing.js';
import { LocationOnlyActions } from './BasePricingCard.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import quantityPricingArt from '../assets/quantity-pricing-empty.webp';

export function QuantityPricingCard({ company }) {
  const { state, dispatch } = useStore();
  // A company can hold several quantity pricings (lowest priority applies first).
  // The company's own list plus pricing only some locations get (labelled with them),
  // in priority order — the stable sort keeps the company's own tie-breaks.
  const entries = [...companyQuantityEntries(company, state.db.policies), ...locationOnlyEntries(company, state.db.policies, 'quantity')].sort((a, b) => a.priority - b.priority);
  const policies = entries.map((e) => e.policy);
  const openAdd = () => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, kind: 'quantity', mode: 'add' });

  // No quantity pricing yet — a proper empty state so the Add action is obvious
  // (mirrors the Base pricing card) instead of a "Not set" row with a bare +.
  if (!policies.length) {
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
            action={{ content: 'Add quantity pricing', onAction: openAdd }}
          >
            Add a quantity pricing to give buyers a discount as the order quantity grows.
          </EmptyBlock>
        </BlockStack>
      </Card>
    );
  }

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
        itemCount={policies.length}
        selectable={false}
        headings={[{ title: 'Pricing' }, { title: 'Location' }, { title: 'Products' }, { title: 'Status' }, { title: '', alignment: 'end' }]}
      >
        {entries.map((entry, index) => {
          const policy = entry.policy;
          const st = policyStatus(policy, state.db);
          return (
            <IndexTable.Row id={policy.id} key={policy.id} position={index}>
              <IndexTable.Cell>
                <Text as="span" variant="bodyMd" fontWeight="medium">
                  {policy.name}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>{pricingLocationsLabel(company, 'quantity', policy.id)}</IndexTable.Cell>
              <IndexTable.Cell>
                <Text as="span" tone="subdued">
                  {scopeTypeLabel(policy)}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={st.tone}>{st.label}</Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {entry.locations ? (
                  <LocationOnlyActions company={company} kind="quantity" entry={entry} />
                ) : (
                <InlineStack gap="100" align="end" blockAlign="center" wrap={false}>
                  <Button icon={EditIcon} variant="tertiary" accessibilityLabel="Edit pricing" onClick={() => dispatch({ type: 'OPEN_EDITOR', policy, context: { mode: 'edit', companyId: company.id } })} />
                  <Button icon={ExchangeIcon} variant="tertiary" accessibilityLabel="Change pricing" onClick={() => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, kind: 'quantity', mode: 'swap', swapId: policy.id })} />
                  <Button icon={XCircleIcon} variant="tertiary" tone="critical" accessibilityLabel="Remove" onClick={() => dispatch({ type: 'REMOVE_COMPANY_QUANTITY', companyId: company.id, policyId: policy.id })} />
                </InlineStack>
                )}
              </IndexTable.Cell>
            </IndexTable.Row>
          );
        })}
      </IndexTable>
      <Box padding="300">
        <Button icon={PlusIcon} onClick={openAdd}>
          Add quantity pricing
        </Button>
      </Box>
    </Card>
  );
}
