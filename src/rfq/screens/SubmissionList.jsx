import React, { useState } from 'react';
import {
  Page,
  Card,
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  useIndexResourceState,
  Badge,
  Banner,
  Text,
  Icon,
  BlockStack,
  InlineStack,
  Box,
} from '@shopify/polaris';
import { ChevronDownIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { money2, quoteAmount } from '../utils.js';
import { SUBMISSION_TABS, SUBMISSION_TAB_STATUS } from '../data/submissions.js';

// Submission status → Polaris Badge tone.
const STATUS_TONE = {
  'New Received': 'attention',
  'New Created': 'attention',
  Read: undefined,
  Updated: 'warning',
  'Deal Closed': 'success',
  'Deal Rejected': 'critical',
  Trashed: undefined,
};

const SORT_OPTIONS = [
  { label: 'Created time', value: 'created desc', directionLabel: 'Newest first' },
  { label: 'Created time', value: 'created asc', directionLabel: 'Oldest first' },
  { label: 'Amount', value: 'amount desc', directionLabel: 'Highest first' },
  { label: 'Amount', value: 'amount asc', directionLabel: 'Lowest first' },
];

export function SubmissionList() {
  const { state, dispatch } = useStore();
  const [bannerVisible, setBannerVisible] = useState(true);
  const [query, setQuery] = useState('');
  const [sortSelected, setSortSelected] = useState(['created desc']);
  const { mode, setMode } = useSetIndexFiltersMode();

  const tabIndex = Math.max(0, SUBMISSION_TABS.indexOf(state.submissionTab));
  const statusFilter = SUBMISSION_TAB_STATUS[state.submissionTab];

  let ids = state.order.filter((id) => !statusFilter || state.meta[id]?.status === statusFilter);
  const q = query.trim().toLowerCase();
  if (q) {
    ids = ids.filter((id) => {
      const quote = state.quotes[id];
      return [String(quote?.number ?? id), quote?.customer?.name || '', quote?.customer?.email || '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }
  const [sortField, sortDir] = (sortSelected[0] || 'created desc').split(' ');
  const baseIndex = (id) => state.order.indexOf(id); // state.order is newest-first
  ids = [...ids];
  if (sortField === 'amount') {
    ids.sort((a, b) => quoteAmount(state.quotes[a]) - quoteAmount(state.quotes[b])); // ascending
    if (sortDir === 'desc') ids.reverse();
  } else {
    ids.sort((a, b) => baseIndex(a) - baseIndex(b)); // by creation order → newest first
    if (sortDir === 'asc') ids.reverse();
  }

  const resources = ids.map((id) => ({ id }));
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(resources);

  const tabs = SUBMISSION_TABS.map((label, i) => ({ id: `tab-${label}`, content: label, index: i }));

  const rowMarkup = ids.map((id, index) => {
    const quote = state.quotes[id];
    const meta = state.meta[id] || {};
    const customer = quote?.customer || {};
    return (
      <IndexTable.Row
        id={id}
        key={id}
        position={index}
        selected={selectedResources.includes(id)}
        onClick={() => dispatch({ type: 'OPEN_QUOTE', id })}
      >
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {quote?.number ?? id}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100" blockAlign="center">
            <Text as="span" variant="bodyMd">
              {customer.name}
            </Text>
            {meta.b2b ? (
              <Badge tone="info" size="small">
                B2B
              </Badge>
            ) : null}
            <Icon source={ChevronDownIcon} tone="subdued" />
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone="subdued" variant="bodySm">
            {(quote?.received || '').replace(/^Received by /, '')}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone="subdued">
            -
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="medium" alignment="end">
            {money2(quoteAmount(quote))}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="050" inlineAlign="start">
            <Badge tone={STATUS_TONE[meta.status]} progress="incomplete" size="small">
              {meta.status}
            </Badge>
            {meta.progress ? (
              <Text as="span" tone="subdued" variant="bodySm">
                {meta.progress}
              </Text>
            ) : null}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone="subdued" variant="bodySm">
            {meta.assignee}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      fullWidth
      title="Submission list"
      primaryAction={{ content: 'Create a quote', onAction: () => dispatch({ type: 'START_CREATE_QUOTE' }) }}
      secondaryActions={[
        { content: 'Export', onAction: () => dispatch({ type: 'TOAST', message: 'Demo only' }) },
        { content: 'Edit', disclosure: true, onAction: () => {} },
        { content: 'Remove', disclosure: true, onAction: () => {} },
      ]}
    >
      <BlockStack gap="400">
        {bannerVisible && (
          <Banner
            tone="info"
            title="Deal closed? Stop delivery follow-ups."
            onDismiss={() => setBannerVisible(false)}
            action={{ content: 'Automate Delivery Updates' }}
          >
            <p>
              Once a quote becomes an order, automatically sends shipment updates and lets customers track deliveries
              themselves. Reduce up to 90% of “Where is my order?” inquiries.
            </p>
          </Banner>
        )}
        <Card padding="0">
          <IndexFilters
            queryValue={query}
            queryPlaceholder="Searching in all submissions"
            onQueryChange={setQuery}
            onQueryClear={() => setQuery('')}
            tabs={tabs}
            selected={tabIndex}
            onSelect={(i) => dispatch({ type: 'SET_TAB', tab: SUBMISSION_TABS[i] })}
            sortOptions={SORT_OPTIONS}
            sortSelected={sortSelected}
            onSort={setSortSelected}
            filters={[]}
            appliedFilters={[]}
            onClearAll={() => {}}
            mode={mode}
            setMode={setMode}
            cancelAction={{ onAction: () => setQuery('') }}
            canCreateNewView={false}
          />
          <IndexTable
            resourceName={{ singular: 'submission', plural: 'submissions' }}
            itemCount={ids.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Quote ID' },
              { title: 'Customer information' },
              { title: 'Created time' },
              { title: 'Lead score' },
              { title: 'Amount', alignment: 'end' },
              { title: 'Quote log' },
              { title: 'Assignee' },
            ]}
            emptyState={
              <Box padding="400">
                <Text as="p" alignment="center" tone="subdued">
                  No quotes in this tab.
                </Text>
              </Box>
            }
          >
            {rowMarkup}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}
