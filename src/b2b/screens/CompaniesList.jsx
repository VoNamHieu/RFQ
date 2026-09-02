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
  TextField,
  Select,
  EmptyState,
  Icon,
} from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { companyBaseEntries, companyQuantityPolicy, companyPricingStatus, companyNeedsPrice } from '../pricing.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Price ready' },
  { id: 'need', label: 'Needs a price' },
];

// field:dir → the 6 sort options (legacy sortMenu: Name / Locations / Pricing status).
const SORT_OPTIONS = [
  { label: 'Name · A to Z', value: 'name:asc' },
  { label: 'Name · Z to A', value: 'name:desc' },
  { label: 'Locations · fewest first', value: 'locations:asc' },
  { label: 'Locations · most first', value: 'locations:desc' },
  { label: 'Pricing status · needs a price first', value: 'status:desc' },
  { label: 'Pricing status · price ready first', value: 'status:asc' },
];

export function CompaniesList() {
  const { state, dispatch } = useStore();
  const policies = state.db.policies;
  const defaults = state.db.defaults;

  const assignedPolicies = (c) => {
    const bases = companyBaseEntries(c, policies).map((e) => e.policy);
    const q = companyQuantityPolicy(c, policies);
    if (q) bases.push(q);
    return bases;
  };

  // First-run empty state (no companies at all) — the B2B boundary explainer.
  if (state.db.companies.length === 0) {
    return (
      <Page fullWidth title="Companies" subtitle="Who gets which price.">
        <Card>
          <EmptyState
            heading="No companies linked yet"
            action={{ content: 'Link your first company', onAction: () => dispatch({ type: 'OPEN_ADD_COMPANY' }) }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Link a Shopify B2B Company to decide what its buyers pay. Shopify keeps the Company record and takes the
              orders; this app only decides the price.
            </p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const search = (state.companySearch || '').trim().toLowerCase();
  let list = state.db.companies.filter((c) => {
    if (state.listFilter === 'all') return true;
    const ready = !companyNeedsPrice(c, policies, defaults);
    return state.listFilter === 'active' ? ready : !ready;
  });
  if (search) {
    list = list.filter((c) =>
      [c.name, c.source, c.mainContact || '', ...(c.locations || []).map((l) => l.name), ...assignedPolicies(c).map((p) => p.name)]
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }
  const needs = (c) => (companyNeedsPrice(c, policies, defaults) ? 1 : 0);
  const by = {
    name: (a, b) => a.name.localeCompare(b.name),
    locations: (a, b) => (a.locations || []).length - (b.locations || []).length || a.name.localeCompare(b.name),
    status: (a, b) => needs(a) - needs(b) || a.name.localeCompare(b.name),
  };
  list = [...list].sort(by[state.companySortField] || by.name);
  if (state.companySortDir === 'desc') list.reverse();

  const rows = list.map((c, index) => {
    const status = companyPricingStatus(c, policies, defaults);
    const assigned = assignedPolicies(c);
    return (
      <IndexTable.Row id={c.id} key={c.id} position={index} onClick={() => dispatch({ type: 'OPEN_COMPANY', id: c.id })}>
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
        <IndexTable.Cell>{(c.locations || []).length}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {assigned.length ? assigned.map((p) => p.name).join(', ') : 'Not set'}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {c.mainContact || 'None'}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const emptyStateMarkup = (
    <EmptyState heading="No companies match" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
      <p>Try a different search, or clear the pricing status filter.</p>
    </EmptyState>
  );

  return (
    <Page
      fullWidth
      title="Companies"
      subtitle="Who gets which price."
      primaryAction={{ content: 'Add company', onAction: () => dispatch({ type: 'OPEN_ADD_COMPANY' }) }}
    >
      <Card padding="0">
        <Box padding="300" paddingBlockEnd="200">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" gap="200">
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
              <Box minWidth="220px">
                <Select
                  label="Sort"
                  labelHidden
                  options={SORT_OPTIONS}
                  value={`${state.companySortField}:${state.companySortDir}`}
                  onChange={(v) => {
                    const [field, dir] = v.split(':');
                    dispatch({ type: 'SET_COMPANY_SORT', field, dir });
                  }}
                />
              </Box>
            </InlineStack>
            <TextField
              label="Search companies"
              labelHidden
              value={state.companySearch}
              onChange={(v) => dispatch({ type: 'SET_COMPANY_SEARCH', value: v })}
              prefix={<Icon source={SearchIcon} tone="subdued" />}
              placeholder="Search companies, locations, pricing"
              clearButton
              onClearButtonClick={() => dispatch({ type: 'SET_COMPANY_SEARCH', value: '' })}
              autoComplete="off"
            />
          </BlockStack>
        </Box>
        <IndexTable
          resourceName={{ singular: 'company', plural: 'companies' }}
          itemCount={rows.length}
          selectable={false}
          emptyState={emptyStateMarkup}
          headings={[
            { title: `Company${list.length ? ` (${list.length})` : ''}` },
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
