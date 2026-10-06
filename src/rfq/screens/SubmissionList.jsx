import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { syncCaseOf } from '../data/companies.js';
import { DEMO_STATE_KEY } from '../../shared/persistence.js';
import { IndexFiltersBar, Tip, useWcId, wcTone } from '../../shared/wc.jsx';

// Dev/QA: wipe the persisted demo state so every quote returns to its seed
// scenario (e.g. 1051074 back to "No install"). Mirrors the god file's Reset data.
function resetDemoData() {
  try {
    localStorage.removeItem(DEMO_STATE_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}
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
  const [sortSelected, setSortSelected] = useState('created desc');
  const rowId = useWcId('submission');

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
  const [sortField, sortDir] = (sortSelected || 'created desc').split(' ');
  const baseIndex = (id) => state.order.indexOf(id); // state.order is newest-first
  ids = [...ids];
  if (sortField === 'amount') {
    ids.sort((a, b) => quoteAmount(state.quotes[a]) - quoteAmount(state.quotes[b])); // ascending
    if (sortDir === 'desc') ids.reverse();
  } else {
    ids.sort((a, b) => baseIndex(a) - baseIndex(b)); // by creation order → newest first
    if (sortDir === 'asc') ids.reverse();
  }

  const tabs = SUBMISSION_TABS.map((label) => ({ id: `tab-${label}`, content: label }));

  const rowMarkup = ids.map((id) => {
    const quote = state.quotes[id];
    const meta = state.meta[id] || {};
    const customer = quote?.customer || {};
    const devCase = syncCaseOf(quote); // dev/QA-only sync-case signal
    const linkId = `${rowId}-open-${id}`;
    return (
      <s-table-row key={id} clickDelegate={linkId}>
        <s-table-cell>
          <s-link id={linkId} tone="neutral" onClick={() => dispatch({ type: 'OPEN_QUOTE', id })}>
            <s-text fontWeight="semibold">{quote?.number ?? id}</s-text>
          </s-link>
        </s-table-cell>
        <s-table-cell>
          <s-stack direction="inline" gap="small-400" alignItems="center">
            <s-text>{customer.name}</s-text>
            {meta.b2b ? <s-badge tone="info">B2B</s-badge> : null}
            {devCase ? (
              <Tip content={`DEV / QA · ${devCase.label}`}>
                <s-badge tone="caution">{`⚙ ${devCase.tag}`}</s-badge>
              </Tip>
            ) : null}
            <s-icon type="chevron-down" color="subdued" />
          </s-stack>
        </s-table-cell>
        <s-table-cell>
          <s-text color="subdued" fontSize="small">
            {(quote?.received || '').replace(/^Received by /, '')}
          </s-text>
        </s-table-cell>
        <s-table-cell>
          <s-text color="subdued">-</s-text>
        </s-table-cell>
        <s-table-cell>
          <s-text fontWeight="medium">{money2(quoteAmount(quote))}</s-text>
        </s-table-cell>
        <s-table-cell>
          <s-stack gap="small-500" alignItems="start">
            <s-badge tone={wcTone(STATUS_TONE[meta.status])}>{meta.status}</s-badge>
            {meta.progress ? (
              <s-text color="subdued" fontSize="small">
                {meta.progress}
              </s-text>
            ) : null}
          </s-stack>
        </s-table-cell>
        <s-table-cell>
          <s-text color="subdued" fontSize="small">
            {meta.assignee}
          </s-text>
        </s-table-cell>
      </s-table-row>
    );
  });

  return (
    <s-page heading="Submission list" inlineSize="large">
      <s-button slot="primary-action" variant="primary" onClick={() => dispatch({ type: 'START_CREATE_QUOTE' })}>
        Create a quote
      </s-button>
      <s-button slot="secondary-actions" onClick={resetDemoData}>
        Reset demo data
      </s-button>
      <s-button slot="secondary-actions" onClick={() => dispatch({ type: 'TOAST', message: 'Demo only' })}>
        Export
      </s-button>
      <s-button slot="secondary-actions" onClick={() => {}}>
        Edit
      </s-button>
      <s-button slot="secondary-actions" onClick={() => {}}>
        Remove
      </s-button>

      <s-stack gap="base">
        {bannerVisible && (
          <s-banner
            tone="info"
            heading="Deal closed? Stop delivery follow-ups."
            dismissible
            onDismiss={() => setBannerVisible(false)}
          >
            <s-paragraph>
              Once a quote becomes an order, automatically sends shipment updates and lets customers track deliveries
              themselves. Reduce up to 90% of “Where is my order?” inquiries.
            </s-paragraph>
            <s-button slot="secondary-actions">Automate Delivery Updates</s-button>
          </s-banner>
        )}
        <s-section padding="none">
          <s-table>
            <IndexFiltersBar
              slot="filters"
              query={query}
              queryPlaceholder="Searching in all submissions"
              onQueryChange={setQuery}
              tabs={tabs}
              selected={tabIndex}
              onSelect={(i) => dispatch({ type: 'SET_TAB', tab: SUBMISSION_TABS[i] })}
              sortOptions={SORT_OPTIONS}
              sortSelected={sortSelected}
              onSort={setSortSelected}
            />
            <s-table-header-row>
              <s-table-header listSlot="primary">Quote ID</s-table-header>
              <s-table-header listSlot="labeled">Customer information</s-table-header>
              <s-table-header listSlot="labeled">Created time</s-table-header>
              <s-table-header listSlot="labeled">Lead score</s-table-header>
              <s-table-header listSlot="labeled" format="currency">
                Amount
              </s-table-header>
              <s-table-header listSlot="secondary">Quote log</s-table-header>
              <s-table-header listSlot="labeled">Assignee</s-table-header>
            </s-table-header-row>
            <s-table-body>{rowMarkup}</s-table-body>
          </s-table>
          {ids.length === 0 ? (
            <s-box padding="base">
              <div style={{ textAlign: 'center' }}>
                <s-paragraph color="subdued">No quotes in this tab.</s-paragraph>
              </div>
            </s-box>
          ) : null}
        </s-section>
      </s-stack>
    </s-page>
  );
}
