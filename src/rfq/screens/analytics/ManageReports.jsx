import React, { useLayoutEffect, useRef, useState } from 'react';
import { IndexFiltersBar, Modal, PageHeader, useWcId } from '../../../shared/wc.jsx';
import { A, fmt } from './copy.js';
import { Pager } from './parts.jsx';
import { EMPTY_STATE_IMAGE, REPORTS_PAGE_SIZE } from './data.js';
import { formatReportDate } from './model.js';

// pages/AnalyticsReportManage: saved analytics reports — search, "Created date"
// filter, bulk/row delete with confirmation, pagination, and the empty state.
// Opening/editing a report is its own route in production → toast (onOpenReport).

const R = A.report;

// Polaris EmptySearchResult illustration (IndexTable's default empty state).
const EMPTY_SEARCH_ILLUSTRATION =
  "data:image/svg+xml,%3csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill-rule='evenodd' d='M41.87 24a17.87 17.87 0 11-35.74 0 17.87 17.87 0 0135.74 0zm-3.15 18.96a24 24 0 114.24-4.24L59.04 54.8a3 3 0 11-4.24 4.24L38.72 42.96z' fill='%238C9196'/%3e%3c/svg%3e";

// createdDateFilterLabel.buildCreatedDateFilterLabel
function createdDateFilterLabel(dateFrom, dateTo) {
  let timeLabel = `${dateFrom} - ${dateTo}`;
  if (dateFrom && !dateTo) timeLabel = fmt(R.startingDate, { date: dateFrom });
  else if (!dateFrom && dateTo) timeLabel = fmt(R.endingDate, { date: dateTo });
  return fmt(R.createdTimeLabel, { timeLabel });
}

// components/ConfirmDeleteModal → OmegaModal (size "small"), destructive primary action.
function ConfirmDeleteModal({ open, body, onClose, onConfirm }) {
  if (!open) return null;
  return (
    <Modal onClose={onClose} heading={R.deleteReportTitle} size="small">
      <s-paragraph>{body}</s-paragraph>
      <s-button slot="primary-action" variant="primary" tone="critical" onClick={onConfirm}>
        {R.delete}
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        {R.cancel}
      </s-button>
    </Modal>
  );
}

// components/TruncatedText (360px, ellipsis) — the tooltip only when the name is cut
// off. The name stays plain text as in production; the row's click delegate is an
// empty s-link (s-table-row only delegates to s-link / s-checkbox).
function ReportName({ id, text, onOpen }) {
  const ref = useRef(null);
  const [truncated, setTruncated] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (node) setTruncated(node.scrollWidth > node.clientWidth);
  }, [text]);
  const tipId = `${id}-tip`;
  return (
    <>
      <span className="qan-delegate">
        <s-link id={id} accessibilityLabel={text} onClick={onOpen} />
      </span>
      <div ref={ref} className="qan-report-name">
        <s-text interestFor={truncated ? tipId : undefined}>{text}</s-text>
      </div>
      {truncated ? <s-tooltip id={tipId}>{text}</s-tooltip> : null}
    </>
  );
}

// Polaris EmptyState inside the Card: image, headingMd, bodySm text, primary action.
function ReportsEmptyState({ onCreate }) {
  return (
    <div className="qan-empty">
      <img src={EMPTY_STATE_IMAGE} alt="" role="presentation" className="qan-empty__image" />
      <div className="qan-empty__details">
        <div className="qan-empty__text">
          <div className="qan-empty__heading">
            <s-heading fontSize="large">{R.emptyHeading}</s-heading>
          </div>
          <s-text fontSize="small">{R.emptyBody}</s-text>
        </div>
        <s-button variant="primary" onClick={onCreate}>
          {R.create}
        </s-button>
      </div>
    </div>
  );
}

export function ManageReports({ reports, setReports, onBack, onCreate, onOpenReport, toast }) {
  const ids = useWcId('qan-rep');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [deleteReportId, setDeleteReportId] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const hasNoFilters = search === '' && dateFrom === '' && dateTo === '';
  const q = search.trim().toLowerCase();
  const filtered = reports.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q)) &&
      (!dateFrom || r.created_at >= dateFrom) &&
      (!dateTo || r.created_at <= dateTo),
  );
  const lastPage = Math.max(1, Math.ceil(filtered.length / REPORTS_PAGE_SIZE));
  const current = Math.min(page, lastPage);
  const rows = filtered.slice((current - 1) * REPORTS_PAGE_SIZE, current * REPORTS_PAGE_SIZE);
  const rowIds = rows.map((r) => r.id);
  const selectedOnPage = selected.filter((id) => rowIds.includes(id));

  const resetPaging = () => {
    setPage(1);
    setSelected([]);
  };
  const clearAllFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    resetPaging();
  };

  // Page backAction { content: "Back" } → ← arrow button next to the title.
  const header = <PageHeader heading={R.manageTitle} backAction={{ content: R.back, onAction: onBack }} />;

  if (reports.length === 0 && hasNoFilters) {
    return (
      <>
        {header}
        <s-page>
          <s-section>
            <ReportsEmptyState onCreate={onCreate} />
          </s-section>
        </s-page>
      </>
    );
  }

  const deleteReports = (idsToDelete) => {
    setReports((list) => list.filter((r) => !idsToDelete.includes(r.id)));
    // Both the row delete and the bulk delete clear the selection (clearSelection()).
    setSelected([]);
    toast(R.deleteSuccess);
  };

  const filterPopId = `${ids}-date`;
  const hasDateFilter = Boolean(dateFrom || dateTo);

  return (
    <>
      {header}
      <s-page>
        <s-section padding="none">
          <s-table>
            <IndexFiltersBar
              slot="filters"
              query={search}
              queryPlaceholder={R.searchPlaceholder}
              onQueryChange={(v) => {
                setSearch(v);
                resetPaging();
              }}
              filtersApplied={hasDateFilter}
              filterControls={
                <>
                  {/* Shortcut FilterPill "Created date": once applied it shows the applied label
                    ("Created time: …") with a remove button; "Clear all" only appears when a
                    filter (not the search) is applied. */}
                  <s-clickable-chip
                    commandFor={filterPopId}
                    removable={hasDateFilter}
                    accessibilityLabel={hasDateFilter ? createdDateFilterLabel(dateFrom, dateTo) : R.dateRangeLabel}
                    onRemove={() => {
                      setDateFrom('');
                      setDateTo('');
                      resetPaging();
                    }}
                  >
                    {hasDateFilter ? createdDateFilterLabel(dateFrom, dateTo) : R.dateRangeLabel}
                  </s-clickable-chip>
                  <s-popover id={filterPopId}>
                    <s-box padding="base" minInlineSize="260px">
                      <s-stack gap="small">
                        <s-date-field
                          label={R.starting}
                          value={dateFrom}
                          onInput={(e) => {
                            setDateFrom(e.currentTarget.value || '');
                            resetPaging();
                          }}
                          onChange={(e) => {
                            setDateFrom(e.currentTarget.value || '');
                            resetPaging();
                          }}
                        />
                        <s-date-field
                          label={R.ending}
                          value={dateTo}
                          onInput={(e) => {
                            setDateTo(e.currentTarget.value || '');
                            resetPaging();
                          }}
                          onChange={(e) => {
                            setDateTo(e.currentTarget.value || '');
                            resetPaging();
                          }}
                        />
                        <div>
                          <s-button
                            variant="tertiary"
                            disabled={!hasDateFilter}
                            onClick={() => {
                              setDateFrom('');
                              setDateTo('');
                              resetPaging();
                            }}
                          >
                            {R.clear}
                          </s-button>
                        </div>
                      </s-stack>
                    </s-box>
                  </s-popover>
                  {hasDateFilter ? (
                    <s-button variant="tertiary" onClick={clearAllFilters}>
                      Clear all
                    </s-button>
                  ) : null}
                </>
              }
            >
              {/* BulkActions: "{n} selected" + the promoted "Delete" (a plain secondary button). */}
              {selectedOnPage.length > 0 ? (
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-text fontWeight="semibold">{`${selectedOnPage.length} selected`}</s-text>
                  <s-button onClick={() => setBulkDeleteOpen(true)}>{R.delete}</s-button>
                </s-stack>
              ) : null}
            </IndexFiltersBar>
            <s-table-header-row>
              <s-table-header listSlot="inline">
                <s-checkbox
                  accessibilityLabel={`Select all ${R.resourcePlural}`}
                  checked={rows.length > 0 && selectedOnPage.length === rows.length}
                  indeterminate={selectedOnPage.length > 0 && selectedOnPage.length < rows.length}
                  onChange={(e) => setSelected(e.currentTarget.checked ? rowIds : [])}
                />
              </s-table-header>
              <s-table-header listSlot="primary">{R.columnName}</s-table-header>
              <s-table-header listSlot="labeled">{R.createdAt}</s-table-header>
              <s-table-header listSlot="inline">{R.actions}</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((report) => {
                const linkId = `${ids}-open-${report.id}`;
                const isSelected = selected.includes(report.id);
                return (
                  <s-table-row key={report.id} clickDelegate={linkId}>
                    <s-table-cell>
                      <div onClick={(e) => e.stopPropagation()}>
                        <s-checkbox
                          accessibilityLabel={`Select ${report.name}`}
                          checked={isSelected}
                          onChange={(e) => {
                            const on = e.currentTarget.checked;
                            setSelected((sel) =>
                              on ? Array.from(new Set([...sel, report.id])) : sel.filter((id) => id !== report.id),
                            );
                          }}
                        />
                      </div>
                    </s-table-cell>
                    <s-table-cell>
                      {/* TruncatedText; the row click opens the report. */}
                      <ReportName id={linkId} text={report.name} onOpen={() => onOpenReport(report)} />
                    </s-table-cell>
                    <s-table-cell>{formatReportDate(report.created_at)}</s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-200">
                        <s-button
                          variant="tertiary"
                          icon="edit"
                          accessibilityLabel={R.edit}
                          interestFor={`${ids}-edit-${report.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenReport(report);
                          }}
                        />
                        <s-tooltip id={`${ids}-edit-${report.id}`}>{R.edit}</s-tooltip>
                        <s-button
                          variant="tertiary"
                          icon="delete"
                          accessibilityLabel={R.delete}
                          interestFor={`${ids}-delete-${report.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteReportId(report.id);
                          }}
                        />
                        <s-tooltip id={`${ids}-delete-${report.id}`}>{R.delete}</s-tooltip>
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
          {rows.length === 0 ? (
            // IndexTable default empty state: EmptySearchResult withIllustration.
            <div className="qan-empty-search">
              <img
                src={EMPTY_SEARCH_ILLUSTRATION}
                alt="Empty search results"
                width={60}
                height={60}
                draggable={false}
              />
              <s-heading fontSize="large-200">{`No ${R.resourcePlural} found`}</s-heading>
              <s-text color="subdued">Try changing the filters or search term</s-text>
            </div>
          ) : null}
          {lastPage > 1 ? (
            <>
              <s-divider />
              <s-box paddingBlock="base">
                <div className="qan-pager-row">
                  <Pager
                    hasPrevious={current > 1}
                    hasNext={current < lastPage}
                    onPrevious={() => {
                      setPage(Math.max(1, current - 1));
                      setSelected([]);
                    }}
                    onNext={() => {
                      setPage(Math.min(lastPage, current + 1));
                      setSelected([]);
                    }}
                  />
                </div>
              </s-box>
            </>
          ) : null}
        </s-section>

        <ConfirmDeleteModal
          open={deleteReportId !== null}
          body={R.deleteReportBody}
          onClose={() => setDeleteReportId(null)}
          onConfirm={() => {
            const id = deleteReportId;
            setDeleteReportId(null);
            deleteReports([id]);
          }}
        />
        <ConfirmDeleteModal
          open={bulkDeleteOpen}
          body={fmt(R.deleteBulkBody, { count: selectedOnPage.length })}
          onClose={() => setBulkDeleteOpen(false)}
          onConfirm={() => {
            setBulkDeleteOpen(false);
            deleteReports(selectedOnPage);
          }}
        />
      </s-page>
    </>
  );
}
