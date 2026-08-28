import React, { useState } from 'react';
import {
  Page,
  Card,
  IndexTable,
  Tabs,
  Badge,
  Banner,
  Text,
  BlockStack,
  useBreakpoints,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { money2, quoteAmount } from '../utils.js';
import {
  SUBMISSION_TABS,
  SUBMISSION_TAB_STATUS,
} from '../data/submissions.js';

// Submission status → Polaris Badge tone.
const STATUS_TONE = {
  'New Received': 'attention',
  Read: undefined,
  Updated: 'info',
  'Deal Closed': 'success',
  'Deal Rejected': 'critical',
  Trashed: undefined,
};

export function SubmissionList() {
  const { state, dispatch } = useStore();
  const [bannerVisible, setBannerVisible] = useState(true);

  const tabIndex = Math.max(0, SUBMISSION_TABS.indexOf(state.submissionTab));
  const statusFilter = SUBMISSION_TAB_STATUS[state.submissionTab];
  const ids = state.order.filter(
    (id) => !statusFilter || state.meta[id]?.status === statusFilter,
  );

  const tabs = SUBMISSION_TABS.map((label) => ({
    id: `tab-${label}`,
    content: label,
  }));

  const rowMarkup = ids.map((id, index) => {
    const quote = state.quotes[id];
    const meta = state.meta[id] || {};
    const customer = quote?.customer || {};
    return (
      <IndexTable.Row
        id={id}
        key={id}
        position={index}
        onClick={() => dispatch({ type: 'OPEN_QUOTE', id })}
      >
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {quote?.number ?? id}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd">
              {customer.name}
              {meta.b2b ? (
                <>
                  {'  '}
                  <Badge tone="info" size="small">
                    B2B
                  </Badge>
                </>
              ) : null}
            </Text>
            <Text as="span" tone="subdued" variant="bodySm">
              {customer.email}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" tone="subdued" variant="bodySm">
            {quote?.received}
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
          <BlockStack gap="050">
            <Badge tone={STATUS_TONE[meta.status]}>{meta.status}</Badge>
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
      title="Submission list"
      primaryAction={{
        content: 'Create a quote',
        onAction: () => dispatch({ type: 'START_CREATE_QUOTE' }),
      }}
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
            <p>Turn a closed quote into a B2B pricing so buyers reorder at the agreed price.</p>
          </Banner>
        )}
        <Card padding="0">
          <Tabs
            tabs={tabs}
            selected={tabIndex}
            onSelect={(i) => dispatch({ type: 'SET_TAB', tab: SUBMISSION_TABS[i] })}
          />
          <IndexTable
            resourceName={{ singular: 'submission', plural: 'submissions' }}
            itemCount={ids.length}
            selectable={false}
            headings={[
              { title: 'Quote ID' },
              { title: 'Customer information' },
              { title: 'Created time' },
              { title: 'Lead score' },
              { title: 'Amount', alignment: 'end' },
              { title: 'Quote log' },
              { title: 'Assignee' },
            ]}
          >
            {rowMarkup}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}
