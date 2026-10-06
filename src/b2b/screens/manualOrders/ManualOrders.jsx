import React, { useState } from 'react';
import { useStore } from '../../store.jsx';
import { IndexFiltersBar, Modal, useWcId, wcTone } from '../../../shared/wc.jsx';
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
  const { dispatch } = useStore();
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

  // Empty state — no orders at all (unfiltered).
  if (orders.length === 0) {
    return (
      <s-page heading="Order management">
        <s-section>
          <EmptyBlock
            heading="Create your first order"
            action={{ content: 'Create order', onAction: handleCreateOrder }}
            image={EMPTY_STATE_IMAGE}
          >
            Build your order quickly and easily
          </EmptyBlock>
        </s-section>
        <s-box paddingBlock="large">
          <div style={{ textAlign: 'center' }}>
            <s-text>Learn more about </s-text>
            <s-link href={ORDER_HELP_URL} target="_blank">
              order
            </s-link>
          </div>
        </s-box>
      </s-page>
    );
  }

  return (
    <s-page heading="Order management">
      <s-button slot="primary-action" variant="primary" onClick={handleCreateOrder}>
        Create order
      </s-button>

      <s-section padding="none">
        <s-table
          paginate={total > 0}
          hasPreviousPage={current > 1}
          hasNextPage={current * PAGE_SIZE < total}
          onPreviousPage={() => handlePageChange(Math.max(current - 1, 1))}
          onNextPage={() => handlePageChange(Math.min(current + 1, lastPage))}
        >
          <IndexFiltersBar
            slot="filters"
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

          {/* Like IndexTable, an empty result shows only the empty search state (no column headings). */}
          {rows.length > 0 ? (
            <>
              <s-table-header-row>
                <s-table-header listSlot="inline">
                  <s-checkbox
                    accessibilityLabel={allSelected ? 'Deselect all orders' : 'Select all orders'}
                    checked={allSelected}
                    indeterminate={selectedRows.length > 0 && !allSelected}
                    onChange={(e) => selectAll(e.currentTarget.checked)}
                  />
                </s-table-header>
                <s-table-header listSlot="kicker">ID</s-table-header>
                <s-table-header listSlot="primary">Customer</s-table-header>
                <s-table-header listSlot="secondary">Status</s-table-header>
                <s-table-header listSlot="labeled">Created date</s-table-header>
                <s-table-header listSlot="inline" format="numeric">
                  Actions
                </s-table-header>
              </s-table-header-row>

              <s-table-body>
                {rows.map((order) => {
                  const rowKey = `${uid}-${order.id}`;
                  return (
                    <s-table-row key={order.id} clickDelegate={`${rowKey}-select`}>
                      <s-table-cell>
                        <s-checkbox
                          id={`${rowKey}-select`}
                          accessibilityLabel={`Select order ${order.draft_order_name || order.customer_name}`}
                          checked={selectedIds.includes(order.id)}
                          onChange={(e) => selectRow(order.id, e.currentTarget.checked)}
                        />
                      </s-table-cell>
                      <s-table-cell>
                        {!order.draft_order_name ? (
                          '-'
                        ) : order.draft_order_id ? (
                          <s-link
                            onClick={(e) => {
                              e.stopPropagation();
                              openDraftOrder(order);
                            }}
                          >
                            {order.draft_order_name}
                          </s-link>
                        ) : (
                          <s-text fontWeight="semibold">{order.draft_order_name}</s-text>
                        )}
                      </s-table-cell>
                      <s-table-cell>
                        <s-stack gap="small-500">
                          <s-text>{order.customer_name}</s-text>
                          <s-text fontSize="small" color="subdued">
                            {order.customer_email}
                          </s-text>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge tone={wcTone(MANUAL_ORDER_STATUS_BADGE_TONE[order.status])}>
                          {MANUAL_ORDER_STATUS_LABEL[order.status]}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>{formatCreatedDate(order.created_at)}</s-table-cell>
                      <s-table-cell>
                        {/* Unstyled icon buttons (Icon tone base) with Edit / Delete tooltips. */}
                        <s-stack direction="inline" gap="small-400" justifyContent="end" alignItems="center">
                          <s-clickable
                            inlineSize="20px"
                            accessibilityLabel="Edit order"
                            interestFor={`${rowKey}-edit-tip`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditOrder(order);
                            }}
                          >
                            <s-icon type="edit" />
                          </s-clickable>
                          <s-tooltip id={`${rowKey}-edit-tip`}>Edit</s-tooltip>
                          <s-clickable
                            inlineSize="20px"
                            accessibilityLabel="Delete order"
                            interestFor={`${rowKey}-delete-tip`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowDeleteClick(order.id);
                            }}
                          >
                            <s-icon type="delete" />
                          </s-clickable>
                          <s-tooltip id={`${rowKey}-delete-tip`}>Delete</s-tooltip>
                        </s-stack>
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </>
          ) : (
            // Keeps s-table's required header row; IndexTable shows no headings when empty.
            <s-table-header-row />
          )}
        </s-table>
        {rows.length === 0 ? <EmptySearchResult /> : null}
      </s-section>

      <DeleteOrderModal open={deleteModalOpen} ids={idsToDelete} onClose={closeDeleteModal} onConfirm={handleConfirmDelete} />
    </s-page>
  );
}
