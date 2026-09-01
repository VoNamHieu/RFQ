import React from 'react';
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
import { useStore } from '../store.jsx';
import { companyBaseEntries, companyQuantityPolicy, companyPricingStatus, companyNeedsPrice } from '../pricing.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Price ready' },
  { id: 'need', label: 'Needs a price' },
];

export function CompaniesList() {
  const { state, dispatch } = useStore();
  const policies = state.db.policies;

  const defaults = state.db.defaults;
  const companies = state.db.companies.filter((c) => {
    if (state.listFilter === 'all') return true;
    const ready = !companyNeedsPrice(c, policies, defaults);
    return state.listFilter === 'active' ? ready : !ready;
  });

  const assignedNames = (c) => {
    const bases = companyBaseEntries(c, policies).map((e) => e.policy.name);
    const q = companyQuantityPolicy(c, policies);
    if (q) bases.push(q.name);
    return bases.join(', ') || '—';
  };

  const rows = companies.map((c, index) => {
    const status = companyPricingStatus(c, policies, defaults);
    const locationCount = (c.locations || []).length;
    return (
      <IndexTable.Row
        id={c.id}
        key={c.id}
        position={index}
        onClick={() => dispatch({ type: 'OPEN_COMPANY', id: c.id })}
      >
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {c.name}
            </Text>
            {c.source ? (
              <Text as="span" tone="subdued" variant="bodySm">
                From {c.source}
              </Text>
            ) : null}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={status.tone}>{status.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{locationCount}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {assignedNames(c)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {c.mainContact}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Companies"
      subtitle="Who gets which price."
      primaryAction={{ content: 'Add company', onAction: () => dispatch({ type: 'OPEN_ADD_COMPANY' }) }}
    >
      <Card padding="0">
        <Box padding="300" paddingBlockEnd="200">
          <ButtonGroup variant="segmented">
            {FILTERS.map((f) => (
              <Button
                key={f.id}
                pressed={state.listFilter === f.id}
                onClick={() => dispatch({ type: 'SET_LIST_FILTER', filter: f.id })}
              >
                {f.label}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
        <IndexTable
          resourceName={{ singular: 'company', plural: 'companies' }}
          itemCount={rows.length}
          selectable={false}
          headings={[
            { title: 'Company' },
            { title: 'Pricing status' },
            { title: 'Locations' },
            { title: 'Pricing assigned' },
            { title: 'Main contact' },
          ]}
        >
          {rows}
        </IndexTable>
      </Card>
    </Page>
  );
}
