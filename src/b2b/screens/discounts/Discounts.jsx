import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store.jsx';
import { IndexFiltersBar, useWcId } from '../../../shared/wc.jsx';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { DISCOUNTS, DISCOUNT_HELP_URL, DISCOUNT_TAB, DISCOUNT_LIST_PER_PAGE, EMPTY_STATE_IMAGE } from './data.js';
import { DiscountRow, deriveDisplayStatus, isDiscountExpired, typeLabel } from './DiscountRow.jsx';
import { DateFilterContent, parseDateString } from './DateFilterContent.jsx';
import { DiscountDeleteModal } from './DiscountDeleteModal.jsx';
import './discounts.css';

// Discount list (production: pages/Discount/DiscountTable.tsx). Create / edit discount,
// Usage history and Appearance are their own routes in the app, so here they show a toast.

const BULK_DELETE_MESSAGE =
  'Are you sure you want to delete the selected discounts? This action cannot be undone.';

// Keeps toggles / deletions while the merchant moves around the prototype.
let sessionDiscounts = null;

export function Discounts() {
  const { dispatch } = useStore();
  const toast = (message) => dispatch({ type: 'TOAST', message });
  const openInFullApp = (name) => toast(`Opens ${name} in the full app`);

  const [items, setItems] = useState(() => sessionDiscounts || DISCOUNTS);
  useEffect(() => {
    sessionDiscounts = items;
  }, [items]);

  const [querySearch, setQuerySearch] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [togglingId, setTogglingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openBulkDeleteModal, setOpenBulkDeleteModal] = useState(false);

  const baseId = useWcId('discount');
  const dateFilterId = `${baseId}-date`;

  // The status switch takes a moment in the app (API round trip) — keep its spinner.
  const toggleTimer = useRef(null);
  useEffect(() => () => clearTimeout(toggleTimer.current), []);

  // ---- empty state: no discounts at all ----
  if (items.length === 0) {
    return (
      <s-page heading="Discount">
        <s-button slot="secondary-actions" onClick={() => openInFullApp('Appearance')}>
          Appearance
        </s-button>
        <s-section>
          <EmptyBlock
            heading="Create your first discount"
            image={EMPTY_STATE_IMAGE}
            action={{ content: 'Create discount', onAction: () => openInFullApp('Create discount') }}
          >
            Build your discount quickly and easily
          </EmptyBlock>
        </s-section>
        <s-box paddingBlock="large">
          <div style={{ textAlign: 'center' }}>
            <s-text>Learn more about </s-text>
            <s-link href={DISCOUNT_HELP_URL} target="_blank">
              discount
            </s-link>
          </div>
        </s-box>
      </s-page>
    );
  }

  // ---- filtering (tab = derived status, search, created date) ----
  const now = new Date();
  const rows = items.map((it) => {
    const displayStatus = deriveDisplayStatus(it, now);
    return { ...it, displayStatus, isExpired: isDiscountExpired(it, displayStatus, now) };
  });
  const tabId = DISCOUNT_TAB[selectedTab].id;
  const q = querySearch.trim().toLowerCase();
  const from = parseDateString(startDate);
  const toDay = parseDateString(endDate);
  const to = toDay ? new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate(), 23, 59, 59) : null;
  const filtered = rows
    .filter((r) => tabId === 'all' || r.displayStatus === tabId)
    .filter((r) => !q || [r.name, r.code, typeLabel(r.discount_type)].join(' ').toLowerCase().includes(q))
    .filter((r) => {
      const created = new Date(r.created_at);
      return (!from || created >= from) && (!to || created <= to);
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / DISCOUNT_LIST_PER_PAGE));
  const current = Math.min(page, lastPage);
  const pageRows = filtered.slice((current - 1) * DISCOUNT_LIST_PER_PAGE, current * DISCOUNT_LIST_PER_PAGE);

  // ---- selection (only rows on screen count) ----
  const selected = pageRows.filter((r) => selectedIds.includes(r.id));
  const allSelected = pageRows.length > 0 && selected.length === pageRows.length;
  const clearSelection = () => setSelectedIds([]);
  // Checkbox handlers always SET from the checkbox state (change can fire twice).
  const selectAll = (on) => setSelectedIds(on ? pageRows.map((r) => r.id) : []);
  const selectRow = (id, on) =>
    setSelectedIds((ids) => (on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id)));

  // ---- filters ----
  const handleChangeTab = (index) => {
    setSelectedTab(index);
    setPage(1);
    clearSelection();
  };
  const handleQueryChange = (value) => {
    setQuerySearch(value);
    setPage(1);
  };
  const handleStartDate = (value) => {
    setStartDate(value);
    setPage(1);
  };
  const handleEndDate = (value) => {
    setEndDate(value);
    setPage(1);
  };
  const clearDates = () => {
    setStartDate('');
    setEndDate('');
    setPage(1);
  };
  const handleFiltersClearAll = () => {
    setQuerySearch('');
    setSelectedTab(0);
    clearDates();
  };
  let dateFilterLabel = `Date to: ${endDate}`;
  if (startDate && endDate) dateFilterLabel = `Date: ${startDate} – ${endDate}`;
  else if (startDate) dateFilterLabel = `Date from: ${startDate}`;
  const dateApplied = !!(startDate || endDate);

  // ---- row actions ----
  const handleToggleStatus = (id) => {
    const item = items.find((i) => i.id === id);
    if (!item || togglingId !== null) return;
    const next = item.status === 'on' ? 'off' : 'on';
    setTogglingId(id);
    toggleTimer.current = setTimeout(() => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: next } : i)));
      setTogglingId(null);
      toast(next === 'on' ? 'Turned on' : 'Turned off');
    }, 450);
  };
  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Copied');
    } catch {
      toast('Something went wrong');
    }
  };
  const onDeleteClick = (id) => {
    setDeleteId(id);
    setOpenDeleteModal(true);
  };
  const handleConfirmDelete = () => {
    if (deleteId === null) return;
    setItems((prev) => prev.filter((i) => i.id !== deleteId));
    setOpenDeleteModal(false);
    clearSelection();
    toast('Discount deleted');
  };
  const handleBulkDelete = () => {
    const ids = selected.map((r) => r.id);
    if (!ids.length) return;
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setOpenBulkDeleteModal(false);
    clearSelection();
    toast('Discounts deleted');
  };

  return (
    <s-page heading="Discount">
      <s-button slot="primary-action" variant="primary" onClick={() => openInFullApp('Create discount')}>
        Create rule
      </s-button>
      <s-button slot="secondary-actions" onClick={() => openInFullApp('Usage history')}>
        Usage history
      </s-button>
      <s-button slot="secondary-actions" onClick={() => openInFullApp('Appearance settings')}>
        Appearance settings
      </s-button>

      <s-section padding="none">
        <s-table
          paginate={pageRows.length > 0}
          hasPreviousPage={current > 1}
          hasNextPage={current * DISCOUNT_LIST_PER_PAGE < total}
          onPreviousPage={() => {
            setPage(Math.max(current - 1, 1));
            clearSelection();
          }}
          onNextPage={() => {
            setPage(Math.min(current + 1, lastPage));
            clearSelection();
          }}
        >
          <IndexFiltersBar
            slot="filters"
            query={querySearch}
            queryPlaceholder="Search by name, code, or type"
            onQueryChange={handleQueryChange}
            tabs={DISCOUNT_TAB.map((t) => ({ id: `discount-tab-${t.id}`, content: t.label }))}
            selected={selectedTab}
            onSelect={handleChangeTab}
            filtersApplied={dateApplied}
            filterControls={
              <>
                {dateApplied ? (
                  <s-clickable-chip removable commandFor={dateFilterId} onRemove={clearDates}>
                    {dateFilterLabel}
                  </s-clickable-chip>
                ) : (
                  // Polaris FilterPill (unselected): label + disclosure chevron.
                  <s-clickable-chip commandFor={dateFilterId}>
                    <span className="discounts-pill-label">
                      Created date
                      <s-icon type="chevron-down" size="small" />
                    </span>
                  </s-clickable-chip>
                )}
                <s-popover id={dateFilterId}>
                  <s-box padding="base">
                    <s-stack gap="small-200">
                      <DateFilterContent
                        startDate={startDate}
                        endDate={endDate}
                        onStartDateChange={handleStartDate}
                        onEndDateChange={handleEndDate}
                      />
                      {/* FilterPill's own "Clear" under the filter, disabled until a date is set. */}
                      <div>
                        <s-button variant="tertiary" disabled={!dateApplied} onClick={clearDates}>
                          Clear
                        </s-button>
                      </div>
                    </s-stack>
                  </s-box>
                </s-popover>
                {dateApplied ? <s-link onClick={handleFiltersClearAll}>Clear all</s-link> : null}
              </>
            }
          >
            {selected.length > 0 ? (
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text fontWeight="semibold">{`${selected.length} selected`}</s-text>
                <s-button onClick={() => setOpenBulkDeleteModal(true)}>Delete selected</s-button>
              </s-stack>
            ) : null}
          </IndexFiltersBar>
          {/* Like IndexTable, an empty result shows only the empty search state (no column headings). */}
          {pageRows.length > 0 ? (
            <>
              <s-table-header-row>
                <s-table-header listSlot="inline">
                  <s-checkbox
                    accessibilityLabel={allSelected ? 'Deselect all discounts' : 'Select all discounts'}
                    checked={allSelected}
                    indeterminate={selected.length > 0 && !allSelected}
                    onChange={(e) => selectAll(e.currentTarget.checked)}
                  />
                </s-table-header>
                <s-table-header listSlot="primary">Name</s-table-header>
                <s-table-header listSlot="secondary">Status</s-table-header>
                <s-table-header listSlot="labeled">Code</s-table-header>
                <s-table-header listSlot="labeled">Created date</s-table-header>
                <s-table-header listSlot="labeled">Type</s-table-header>
                <s-table-header listSlot="labeled">Used</s-table-header>
                <s-table-header listSlot="inline">Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {pageRows.map((item) => (
                  <DiscountRow
                    key={item.id}
                    item={item}
                    tipId={`${baseId}-${item.id}`}
                    isSelected={selectedIds.includes(item.id)}
                    onSelect={selectRow}
                    isToggling={togglingId === item.id}
                    onToggle={handleToggleStatus}
                    onEdit={() => openInFullApp('Edit discount')}
                    onDelete={onDeleteClick}
                    onCopy={handleCopyCode}
                  />
                ))}
              </s-table-body>
            </>
          ) : (
            // Keeps s-table's required header row; IndexTable shows no headings when empty.
            <s-table-header-row />
          )}
        </s-table>
        {pageRows.length === 0 ? <NoResults /> : null}
      </s-section>

      <DiscountDeleteModal
        open={openDeleteModal}
        onClose={() => setOpenDeleteModal(false)}
        onConfirm={handleConfirmDelete}
      />
      <DiscountDeleteModal
        open={openBulkDeleteModal}
        onClose={() => setOpenBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        message={BULK_DELETE_MESSAGE}
      />
    </s-page>
  );
}

// IndexTable's built-in empty search result ("No {plural} found").
function NoResults() {
  return (
    <s-box padding="large-300">
      <s-stack gap="small-200" alignItems="center">
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" aria-hidden="true">
          <circle cx="26" cy="26" r="17" stroke="#b5b5b5" strokeWidth="4" fill="#f1f1f1" />
          <path d="M38.5 38.5 52 52" stroke="#b5b5b5" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <s-heading>No discounts found</s-heading>
        <s-text color="subdued">Try changing the filters or search term</s-text>
      </s-stack>
    </s-box>
  );
}
