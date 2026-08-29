import React from 'react';
import {
  Card,
  IndexTable,
  Badge,
  Text,
  BlockStack,
  Box,
  Tabs,
  EmptyState,
} from '@shopify/polaris';
import { useStore } from '../../store.jsx';

// quote.status → Badge tone (undefined = the default neutral badge).
const STATUS_TONE = {
  'New Received': 'attention',
  Read: undefined,
  Updated: 'info',
  'Deal Closed': 'success',
  'Deal Rejected': 'critical',
  Trashed: undefined,
};

// Sub-tabs filter the company's quotes by status; `status: null` means "All".
const SUB_TABS = [
  { id: 'all', content: 'All', status: null },
  { id: 'new', content: 'New received', status: 'New Received' },
  { id: 'read', content: 'Read', status: 'Read' },
  { id: 'closed', content: 'Deal closed', status: 'Deal Closed' },
  { id: 'rejected', content: 'Deal rejected', status: 'Deal Rejected' },
  { id: 'trashed', content: 'Trashed', status: 'Trashed' },
];

export function QuotesTab({ company }) {
  const { state, dispatch } = useStore();
  const [selected, setSelected] = React.useState(0);

  const companyQuotes = (state.db.quotes || []).filter((q) => q.company === company.id);

  if (companyQuotes.length === 0) {
    return (
      <Card>
        <EmptyState heading="No quotes yet" image="">
          <p>Quotes from this company will show up here.</p>
        </EmptyState>
      </Card>
    );
  }

  const activeStatus = SUB_TABS[selected].status;
  const shown = activeStatus
    ? companyQuotes.filter((q) => q.status === activeStatus)
    : companyQuotes;

  const rows = shown.map((q, index) => (
    <IndexTable.Row id={q.id} key={q.id} position={index} onClick={() => dispatch({ type: 'OPEN_QUOTE', id: q.id })}>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {q.id}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd">
            {q.buyer}
          </Text>
          {q.email ? (
            <Text as="span" tone="subdued" variant="bodySm">
              {q.email}
            </Text>
          ) : null}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {(q.created || '').split(' ')[0] || '—'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {q.leadScore != null ? q.leadScore : '—'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {q.progress || '—'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {q.assignee || '—'}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card padding="0">
      <Tabs tabs={SUB_TABS} selected={selected} onSelect={setSelected} />
      <IndexTable
        resourceName={{ singular: 'quote', plural: 'quotes' }}
        itemCount={shown.length}
        selectable={false}
        headings={[
          { title: 'Quote ID' },
          { title: 'Customer' },
          { title: 'Created' },
          { title: 'Lead score' },
          { title: 'Progress' },
          { title: 'Status' },
          { title: 'Assignee' },
        ]}
        emptyState={
          <Box padding="400">
            <Text as="p" alignment="center" tone="subdued">
              No quotes in this view.
            </Text>
          </Box>
        }
      >
        {rows}
      </IndexTable>
    </Card>
  );
}
