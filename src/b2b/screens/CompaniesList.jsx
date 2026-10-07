import React, { useEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import { companyBaseEntries, companyQuantityEntries, companyPricingStatus, companyNeedsPrice } from '../pricing.js';
import { Modal, IndexFiltersBar, useWcId, wcTone } from '../../shared/wc.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Price ready' },
  { id: 'need', label: 'Needs a price' },
];
const SORT_OPTIONS = [
  { label: 'Name', value: 'name asc', directionLabel: 'A to Z' },
  { label: 'Name', value: 'name desc', directionLabel: 'Z to A' },
  { label: 'Locations', value: 'locations asc', directionLabel: 'Fewest first' },
  { label: 'Locations', value: 'locations desc', directionLabel: 'Most first' },
  { label: 'Pricing status', value: 'status desc', directionLabel: 'Needs a price first' },
  { label: 'Pricing status', value: 'status asc', directionLabel: 'Price ready first' },
];
const PAGE_SIZE = 10;

export function CompaniesList() {
  const { state, dispatch } = useStore();
  const policies = state.db.policies;
  const defaults = state.db.defaults;
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Row selection (the leading checkbox column) and the ids awaiting bulk-delete confirmation.
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmBulk, setConfirmBulk] = useState(null);
  const tipId = useWcId('company-tip');
  // A new tab / search shows different rows — don't carry a selection across.
  useEffect(() => { setSelectedIds([]); }, [state.listFilter, state.companySearch]);
  // Just added companies are listed first: show the first page.
  useEffect(() => { setPage(0); }, [state.recentCompanyIds]);

  // Pricing held by the company and by any of its locations (a location's own
  // pricing counts too), each listed once.
  const assignedPolicies = (c) => {
    const out = [];
    [c, ...(c.locations || [])].forEach((holder) => {
      out.push(...companyBaseEntries(holder, policies).map((e) => e.policy));
      out.push(...companyQuantityEntries(holder, policies).map((e) => e.policy));
    });
    return out.filter((p, i) => out.findIndex((x) => x.id === p.id) === i);
  };

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
  // Companies just added from Shopify come first, in the order they were added.
  const recent = state.recentCompanyIds || [];
  if (recent.length) {
    list = [...recent.map((id) => list.find((c) => c.id === id)).filter(Boolean), ...list.filter((c) => !recent.includes(c.id))];
  }

  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = list.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  // Select all takes every company in the tab / search, across pages.
  const selected = list.filter((c) => selectedIds.includes(c.id));
  const allSelected = list.length > 0 && selected.length === list.length;
  // Checkbox handlers always SET from the checkbox's state (change can fire twice).
  const selectAll = (on) => setSelectedIds(on ? list.map((c) => c.id) : []);
  const selectRow = (id, on) =>
    setSelectedIds((ids) => (on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id)));
  // Bulk actions, as in Shopify's index tables: while rows are selected the column
  // headings give way to "N selected" and Delete, so the table doesn't move. In
  // s-table's list layout (narrow windows) they sit under the filters instead.
  // See .qs-bulk-bar in wc.css.
  const bulk = selected.length > 0;
  const askBulkDelete = () => setConfirmBulk(selected);
  const heading = (label) => (bulk ? <span className="qs-bulk-hidden">{label}</span> : label);
  const bulkActions = (
    <>
      <s-text fontWeight="semibold">{`${selected.length} selected`}</s-text>
      <s-button tone="critical" onClick={askBulkDelete}>
        Delete companies
      </s-button>
    </>
  );

  // First-run empty state (no companies at all) — the B2B boundary explainer.
  if (state.db.companies.length === 0) {
    return (
      <s-page heading="B2B Company">
        <s-section>
          <EmptyBlock
            heading="No companies linked yet"
            action={{ content: 'Link your first company', onAction: () => dispatch({ type: 'OPEN_ADD_COMPANY' }) }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            Link a Shopify B2B Company to decide what its buyers pay. Shopify keeps the Company record and takes the
            orders; this app only decides the price.
          </EmptyBlock>
        </s-section>
      </s-page>
    );
  }

  const filterIndex = Math.max(0, FILTER_TABS.findIndex((t) => t.id === state.listFilter));

  return (
    <s-page heading="B2B Company">
      <s-button slot="primary-action" variant="primary" onClick={() => dispatch({ type: 'OPEN_ADD_COMPANY' })}>
        Add company
      </s-button>

      <s-section padding="none">
        <s-table
          paginate={pageCount > 1}
          hasPreviousPage={current > 0}
          hasNextPage={current < pageCount - 1}
          onPreviousPage={() => setPage(Math.max(current - 1, 0))}
          onNextPage={() => setPage(Math.min(current + 1, pageCount - 1))}
        >
          <IndexFiltersBar
            slot="filters"
            query={state.companySearch}
            queryPlaceholder="Searching in all companies"
            onQueryChange={(v) => dispatch({ type: 'SET_COMPANY_SEARCH', value: v })}
            tabs={FILTER_TABS.map((t) => ({ id: `f-${t.id}`, content: t.label }))}
            selected={filterIndex}
            onSelect={(i) => {
              dispatch({ type: 'SET_LIST_FILTER', filter: FILTER_TABS[i].id });
              setPage(0);
            }}
            sortOptions={SORT_OPTIONS}
            sortSelected={`${state.companySortField} ${state.companySortDir}`}
            onSort={(val) => {
              const [field, dir] = (val || 'name asc').split(' ');
              dispatch({ type: 'SET_COMPANY_SORT', field, dir });
            }}
          >
            {bulk ? (
              <div className="qs-bulk-list">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  {bulkActions}
                </s-stack>
              </div>
            ) : null}
          </IndexFiltersBar>
          <s-table-header-row>
            <s-table-header listSlot="inline">
              <s-checkbox
                accessibilityLabel={allSelected ? 'Deselect all companies' : 'Select all companies'}
                checked={allSelected}
                indeterminate={bulk && !allSelected}
                disabled={list.length === 0}
                onChange={(e) => selectAll(e.currentTarget.checked)}
              />
            </s-table-header>
            <s-table-header listSlot="primary">
              {bulk ? <span className="qs-bulk-bar">{bulkActions}</span> : 'Company'}
            </s-table-header>
            <s-table-header listSlot="secondary">{heading('Pricing status')}</s-table-header>
            <s-table-header listSlot="labeled" format="numeric">{heading('Locations')}</s-table-header>
            <s-table-header listSlot="labeled">{heading('Pricing assigned')}</s-table-header>
            <s-table-header listSlot="labeled">{heading('Main contact')}</s-table-header>
            <s-table-header listSlot="inline">{heading('Actions')}</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {pageRows.map((c) => {
              const status = companyPricingStatus(c, policies, defaults);
              const assigned = assignedPolicies(c);
              const linkId = `${tipId}-open-${c.id}`;
              return (
                <s-table-row key={c.id} clickDelegate={linkId}>
                  <s-table-cell>
                    <s-checkbox
                      accessibilityLabel={`Select ${c.name}`}
                      checked={selectedIds.includes(c.id)}
                      onChange={(e) => selectRow(c.id, e.currentTarget.checked)}
                    />
                  </s-table-cell>
                  <s-table-cell>
                    <s-link id={linkId} onClick={() => dispatch({ type: 'OPEN_COMPANY', id: c.id })}>
                      {c.name}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={wcTone(status.tone)}>{status.label}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{(c.locations || []).length}</s-table-cell>
                  <s-table-cell>
                    <s-text fontSize="small">
                      {assigned.length
                        ? assigned.slice(0, 2).map((p) => p.name).join(', ') + (assigned.length > 2 ? ` +${assigned.length - 2} more` : '')
                        : '—'}
                    </s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text fontSize="small">{c.mainContact || '—'}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-400" justifyContent="end">
                      <s-button
                        icon="edit"
                        variant="tertiary"
                        accessibilityLabel="Edit company"
                        interestFor={`${tipId}-edit-${c.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ type: 'OPEN_COMPANY', id: c.id });
                        }}
                      />
                      <s-tooltip id={`${tipId}-edit-${c.id}`}>Edit</s-tooltip>
                      <s-button
                        icon="delete"
                        variant="tertiary"
                        tone="critical"
                        accessibilityLabel="Delete company"
                        interestFor={`${tipId}-delete-${c.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(c);
                        }}
                      />
                      <s-tooltip id={`${tipId}-delete-${c.id}`}>Delete</s-tooltip>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
        {pageRows.length === 0 ? (
          <s-box padding="base">
            <div style={{ textAlign: 'center' }}>
              <s-text color="subdued">No companies match — try a different search or clear the filter.</s-text>
            </div>
          </s-box>
        ) : null}
      </s-section>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} heading={`Delete ${confirmDelete.name}?`}>
          <s-paragraph>
            This removes {confirmDelete.name} from the B2B app. The Shopify company record is not affected.
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              dispatch({ type: 'DELETE_COMPANY', id: confirmDelete.id });
              setConfirmDelete(null);
            }}
          >
            Delete company
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmDelete(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
      {confirmBulk && (
        <Modal
          onClose={() => setConfirmBulk(null)}
          heading={confirmBulk.length === 1 ? `Delete ${confirmBulk[0].name}?` : `Delete ${confirmBulk.length} companies?`}
        >
          <s-stack gap="small">
            <s-paragraph>
              {confirmBulk.length === 1
                ? `This removes ${confirmBulk[0].name} from the B2B app. The Shopify company record is not affected.`
                : 'This removes them from the B2B app. The Shopify company records are not affected.'}
            </s-paragraph>
            {confirmBulk.length > 1 ? (
              <s-unordered-list>
                {confirmBulk.map((c) => (
                  <s-list-item key={c.id}>{c.name}</s-list-item>
                ))}
              </s-unordered-list>
            ) : null}
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              dispatch({ type: 'DELETE_COMPANY', ids: confirmBulk.map((c) => c.id) });
              setConfirmBulk(null);
              setSelectedIds([]);
            }}
          >
            {confirmBulk.length === 1 ? 'Delete company' : 'Delete companies'}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmBulk(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-page>
  );
}

