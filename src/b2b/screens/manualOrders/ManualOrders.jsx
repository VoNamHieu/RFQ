import React, { useState } from 'react';
import { useStore } from '../../store.jsx';
import { IndexFiltersBar, Modal, useWcId } from '../../../shared/wc.jsx';
import { CdPageHead, StatusDot, CardFoot, rangeLabel } from '../../components/companyLayout.jsx';
import { termsBack } from '../ContractsAndLimits.jsx';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import {
  EMPTY_STATE_IMAGE,
  MANUAL_ORDERS,
  MANUAL_ORDER_STATUS_BADGE_TONE,
  MANUAL_ORDER_STATUS_LABEL,
  ORDER_HELP_URL,
  ORDER_TABS,
  PAGE_SIZE,
} from './data.js';

// Manual Order list (production: pages/ManualOrder/ManualOrderListPage →
// features/ManualOrder/components/ManualOrderList). "Order management": status
// view tabs + customer search, a selectable table of the app's manual (draft)
// orders with Edit / Delete row actions and a "Delete selected" bulk action.
// Create / Edit order are separate routes in the app, so they show a toast here.

const formatCreatedDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Polaris IndexTable's default empty search result (EmptySearchResult with its
// magnifier illustration): "No orders found".
function EmptySearchResult() {
  return (
    <s-box padding="large-300">
      <s-stack gap="small-200" alignItems="center">
        <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="26" cy="26" r="16" fill="none" stroke="#8a8a8a" strokeWidth="4" />
          <path d="M38 38l12 12" stroke="#8a8a8a" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <s-heading>No orders found</s-heading>
        </div>
        <div style={{ textAlign: 'center' }}>
          <s-text color="subdued">Try changing the filters or search term</s-text>
        </div>
      </s-stack>
    </s-box>
  );
}

// "Delete draft order" confirmation (features/ManualOrder/modals/DeleteOrderModal).
function DeleteOrderModal({ open, ids, onClose, onConfirm }) {
  return (
    <Modal open={open} onClose={onClose} heading="Delete draft order">
      <s-paragraph>
        This action will permanently delete the draft order from both the app and Shopify. Deleted draft orders
        cannot be recovered. Do you want to continue?
      </s-paragraph>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        onClick={() => {
          if (ids.length === 0) return;
          onConfirm(ids);
          onClose();
        }}
      >
        Delete
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

export function ManualOrders() {
  const { state, dispatch } = useStore();
  const toast = (message) => dispatch({ type: 'TOAST', message });
  const uid = useWcId('mo');

  const [orders, setOrders] = useState(MANUAL_ORDERS);
  const [selectedTab, setSelectedTab] = useState(0);
  const [querySearch, setQuerySearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [rowDeleteId, setRowDeleteId] = useState(null);

  // The API filters by status tab and by customer name / email.
  const status = ORDER_TABS[selectedTab].id;
  const q = querySearch.trim().toLowerCase();
  const filtered = orders.filter(
    (o) =>
      (status === 'all' || o.status === status) &&
      (!q || o.customer_name.toLowerCase().includes(q) || o.customer_email.toLowerCase().includes(q)),
  );
  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, lastPage);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Selection covers the rows on the current page (useIndexResourceState over the page's orders).
  const selectedRows = rows.filter((o) => selectedIds.includes(o.id));
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  // Checkbox handlers always SET from the checkbox's state (change can fire twice).
  const selectAll = (on) => setSelectedIds(on ? rows.map((o) => o.id) : []);
  const selectRow = (id, on) =>
    setSelectedIds((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  const clearSelection = () => setSelectedIds([]);

  const handleChangeTab = (index) => {
    setSelectedTab(index);
    setPage(1);
    clearSelection();
  };

  const handleQuerySearchChange = (value) => {
    setQuerySearch(value);
    setPage(1);
  };

  const handlePageChange = (next) => {
    setPage(next);
    clearSelection();
  };

  const idsToDelete = rowDeleteId !== null ? [rowDeleteId] : selectedRows.map((o) => o.id);

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setRowDeleteId(null);
  };

  const handleRowDeleteClick = (orderId) => {
    setRowDeleteId(orderId);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = (ids) => {
    const willBeEmpty = ids.length >= rows.length && current > 1;
    setOrders((prev) => prev.filter((o) => !ids.includes(o.id)));
    if (willBeEmpty) setPage(current - 1);
    // Opened from the bulk action: the table selection still needs clearing.
    if (rowDeleteId === null) clearSelection();
    else setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
    toast(`${ids.length} order${ids.length > 1 ? 's' : ''} deleted`);
  };

  const handleCreateOrder = () => toast('Opens Create order in the full app');
  const handleEditOrder = (order) =>
    toast(`Opens Edit order${order.draft_order_name ? ` ${order.draft_order_name}` : ''} in the full app`);
  const openDraftOrder = (order) => toast(`Opens draft order ${order.draft_order_name} in Shopify admin`);

  // Empty state — no orders at all (unfiltered). A list of Orders & rules, in the company
  // page's look: back to it, the title (with Create order once there are orders).
  const header = (create) => (
    <CdPageHead
      title="Order management"
      back={termsBack(state, dispatch, 'manualOrders')}
      actions={
        create ? (
          <s-button variant="primary" onClick={handleCreateOrder}>
            Create order
          </s-button>
        ) : null
      }
    />
  );
  if (orders.length === 0) {
    return (
      <div className="cd-page">
        {header(false)}
        <div className="cd-card">
          <div className="cd-card__body">
            <EmptyBlock
              heading="Create your first order"
              action={{ content: 'Create order', onAction: handleCreateOrder }}
              image={EMPTY_STATE_IMAGE}
            >
              Build your order quickly and easily
            </EmptyBlock>
          </div>
        </div>
        <s-box paddingBlock="large">
          <div style={{ textAlign: 'center' }}>
            <s-text>Learn more about </s-text>
            <s-link href={ORDER_HELP_URL} target="_blank">
              order
            </s-link>
          </div>
        </s-box>
      </div>
    );
  }

  // The list in a bordered card: tabs, search and the selection's Delete on top, then a
  // plain table (a row's click ticks it, as before) and the pages.
  return (
    <div className="cd-page">
      {header(true)}

      <div className="cd-card">
        <div className="cd-card__filters">
          <IndexFiltersBar
            query={querySearch}
            queryPlaceholder="Search by customer name, email"
            onQueryChange={handleQuerySearchChange}
            tabs={ORDER_TABS.map((t) => ({ id: `${uid}-tab-${t.id}`, content: t.content }))}
            selected={selectedTab}
            onSelect={handleChangeTab}
          >
            {selectedRows.length > 0 ? (
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text fontWeight="semibold">{`${selectedRows.length} selected`}</s-text>
                <s-button
                  onClick={() => {
                    setRowDeleteId(null);
                    setDeleteModalOpen(true);
                  }}
                >
                  Delete selected
                </s-button>
              </s-stack>
            ) : null}
          </IndexFiltersBar>
        </div>

        {/* Like IndexTable, an empty result shows only the empty search state (no column headings). */}
        {rows.length > 0 ? (
          <div className="cd-table-scroll">
            <table className="cd-table">
              <thead>
                <tr>
                  <th className="cd-check">
                    <s-checkbox
                      accessibilityLabel={allSelected ? 'Deselect all orders' : 'Select all orders'}
                      checked={allSelected}
                      indeterminate={selectedRows.length > 0 && !allSelected}
                      onChange={(e) => selectAll(e.currentTarget.checked)}
                    />
                  </th>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Created date</th>
                  <th className="cd-actions cd-num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const rowKey = `${uid}-${order.id}`;
                  const picked = selectedIds.includes(order.id);
                  return (
                    <tr key={order.id} className="cd-row-link" onClick={() => selectRow(order.id, !picked)}>
                      <td className="cd-check" onClick={(e) => e.stopPropagation()}>
                        <s-checkbox
                          accessibilityLabel={`Select order ${order.draft_order_name || order.customer_name}`}
                          checked={picked}
                          onChange={(e) => selectRow(order.id, e.currentTarget.checked)}
                        />
                      </td>
                      <td className="cd-nowrap">
                        {!order.draft_order_name ? (
                          '-'
                        ) : order.draft_order_id ? (
                          <button
                            type="button"
                            className="cd-text-link cd-text-link--body"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDraftOrder(order);
                            }}
                          >
                            {order.draft_order_name}
                          </button>
                        ) : (
                          <span className="cd-primary">{order.draft_order_name}</span>
                        )}
                      </td>
                      <td>
                        {order.customer_name}
                        <span className="cd-sub">{order.customer_email}</span>
                      </td>
                      <td>
                        <StatusDot tone={MANUAL_ORDER_STATUS_BADGE_TONE[order.status]}>{MANUAL_ORDER_STATUS_LABEL[order.status]}</StatusDot>
                      </td>
                      <td className="cd-nowrap">{formatCreatedDate(order.created_at)}</td>
                      <td className="cd-actions cd-num" onClick={(e) => e.stopPropagation()}>
                        <span className="cd-row-actions">
                          <s-button
                            icon="edit"
                            variant="tertiary"
                            accessibilityLabel="Edit order"
                            interestFor={`${rowKey}-edit-tip`}
                            onClick={() => handleEditOrder(order)}
                          />
                          <s-tooltip id={`${rowKey}-edit-tip`}>Edit</s-tooltip>
                          <s-button
                            icon="delete"
                            variant="tertiary"
                            tone="critical"
                            accessibilityLabel="Delete order"
                            interestFor={`${rowKey}-delete-tip`}
                            onClick={() => handleRowDeleteClick(order.id)}
                          />
                          <s-tooltip id={`${rowKey}-delete-tip`}>Delete</s-tooltip>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptySearchResult />
        )}
        <CardFoot
          current={current - 1}
          count={lastPage}
          label={rangeLabel((current - 1) * PAGE_SIZE, rows.length, total)}
          onPage={(i) => handlePageChange(i + 1)}
        />
      </div>

      <DeleteOrderModal open={deleteModalOpen} ids={idsToDelete} onClose={closeDeleteModal} onConfirm={handleConfirmDelete} />
    </div>
  );
}
