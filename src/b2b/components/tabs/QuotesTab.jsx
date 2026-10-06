import React from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { Tabs, useWcId, wcTone } from '../../../shared/wc.jsx';
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
  const rowId = useWcId('quote-row');

  const companyQuotes = (state.db.quotes || []).filter((q) => q.company === company.id);

  if (companyQuotes.length === 0) {
    return (
      <s-section>
        <EmptyBlock heading="No quotes yet">Quotes from this company will show up here.</EmptyBlock>
      </s-section>
    );
  }

  // Per-status counts drive the sub-tab labels.
  const countFor = (status) => (status ? companyQuotes.filter((q) => q.status === status).length : companyQuotes.length);
  const subTabs = SUB_TABS.map((t) => ({ ...t, content: `${t.content} (${countFor(t.status)})` }));

  // "Waiting on a price": open quotes with at least one unpriced line.
  const waiting = companyQuotes.filter(
    (q) => !['Deal Closed', 'Deal Rejected', 'Trashed'].includes(q.status) && (q.lines || []).some((l) => l.quoted == null),
  ).length;

  const activeStatus = SUB_TABS[selected].status;
  const shown = activeStatus
    ? companyQuotes.filter((q) => q.status === activeStatus)
    : companyQuotes;

  const rows = shown.map((q) => {
    const linkId = `${rowId}-${q.id}`;
    return (
      <s-table-row key={q.id} clickDelegate={linkId}>
        <s-table-cell>
          <s-link id={linkId} onClick={() => dispatch({ type: 'OPEN_QUOTE', id: q.id })}>
            {q.id}
          </s-link>
        </s-table-cell>
        <s-table-cell>
          <s-stack gap="small-500">
            <s-text>{q.buyer}</s-text>
            {q.email ? (
              <s-text color="subdued" fontSize="small">
                {q.email}
              </s-text>
            ) : null}
          </s-stack>
        </s-table-cell>
        <s-table-cell>
          <s-text fontSize="small">{(q.created || '').split(' ')[0] || '—'}</s-text>
        </s-table-cell>
        <s-table-cell>
          <s-text fontSize="small">{q.leadScore != null ? q.leadScore : '—'}</s-text>
        </s-table-cell>
        <s-table-cell>
          <s-text fontSize="small">{q.progress || '—'}</s-text>
        </s-table-cell>
        <s-table-cell>
          <s-badge tone={wcTone(STATUS_TONE[q.status])}>{q.status}</s-badge>
        </s-table-cell>
        <s-table-cell>
          <s-text fontSize="small">{q.assignee || '—'}</s-text>
        </s-table-cell>
      </s-table-row>
    );
  });

  return (
    <s-section padding="none">
      {waiting > 0 && (
        <s-box padding="small" paddingBlockEnd="none">
          <s-banner tone="warning">{`${waiting} quote${waiting === 1 ? '' : 's'} waiting on a price. Price them in the RFQ app to move them forward.`}</s-banner>
        </s-box>
      )}
      <Tabs tabs={subTabs} selected={selected} onSelect={setSelected} />
      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Quote ID</s-table-header>
          <s-table-header listSlot="labeled">Customer</s-table-header>
          <s-table-header listSlot="labeled">Created</s-table-header>
          <s-table-header listSlot="labeled">Lead score</s-table-header>
          <s-table-header listSlot="labeled">Progress</s-table-header>
          <s-table-header listSlot="secondary">Status</s-table-header>
          <s-table-header listSlot="labeled">Assignee</s-table-header>
        </s-table-header-row>
        <s-table-body>{rows}</s-table-body>
      </s-table>
      {shown.length === 0 ? (
        <s-box padding="base">
          <div style={{ textAlign: 'center' }}>
            <s-text color="subdued">No quotes in this view.</s-text>
          </div>
        </s-box>
      ) : null}
    </s-section>
  );
}
