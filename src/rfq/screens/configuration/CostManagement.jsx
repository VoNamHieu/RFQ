import React, { useMemo, useState } from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { IndexFiltersBar, Modal, Tabs, useWcId } from '../../../shared/wc.jsx';
import emptyAssign from './assets/emptyAssign.webp';
import { TODAY } from './data.js';
import { ShippingSetting, TaxSetting } from './ShippingTax.jsx';
import { fullApp, useToast } from './ui.jsx';
import './cost.css';

// Production: pages/CostManagement.jsx rendered `embedded` inside Configuration
// (A/B "shipping and tax rate" variant: Discount / Shipping / Tax tabs), with
// components/DiscountSetting (+ TableDiscountList, EmptyDiscountList, ModalDeleteDiscount),
// components/ShippingSetting and components/TaxSetting.

const TABS = [
  { id: 'discount', content: 'Discount' },
  { id: 'shipping', content: 'Shipping' },
  { id: 'tax', content: 'Tax' },
];

export function CostManagement({ discounts, onDiscountsChange, shipping, onShippingSave, tax, onTaxSave }) {
  // `/cost_management` now redirects to `/app_settings?section=cost-management&tab=discount`,
  // so the section always opens on the Discount tab. Embedded: no Page title (the menu shows it);
  // Polaris Tabs render the panel right under the tab list, inside Box paddingBlockStart 200.
  const [selected, setSelected] = useState(0);
  return (
    <s-stack gap="none">
      <Tabs tabs={TABS} selected={selected} onSelect={setSelected} flush />
      <s-box paddingBlockStart="small-200">
        {selected === 0 ? <DiscountSetting list={discounts} onListChange={onDiscountsChange} /> : null}
        {selected === 1 ? <ShippingSetting saved={shipping} onSave={onShippingSave} /> : null}
        {selected === 2 ? <TaxSetting saved={tax} onSave={onTaxSave} /> : null}
      </s-box>
    </s-stack>
  );
}

const DISCOUNT_TYPE = { 'line-item': 'Product', quote: 'Quote' };
const FILTERS = ['All', 'Active', 'Inactive', 'Expired'];

const isExpired = (d) => !!d.end_date && d.end_date < TODAY;

function DiscountSetting({ list, onListChange }) {
  const toast = useToast();
  const id = useWcId('qcfg-discount');
  const [selectedTab, setSelectedTab] = useState(0);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState([]);
  const [deleteIds, setDeleteIds] = useState(null);

  const rows = useMemo(() => {
    let result = list;
    if (selectedTab === 1) result = result.filter((d) => Number(d.status) === 1);
    if (selectedTab === 2) result = result.filter((d) => Number(d.status) === 0);
    if (selectedTab === 3) result = result.filter(isExpired);
    const q = query.trim().toLowerCase();
    if (q) result = result.filter((d) => d.title.toLowerCase().includes(q) || d.reason_message.toLowerCase().includes(q));
    return result;
  }, [list, selectedTab, query]);

  const selectedIds = selection.filter((sid) => rows.some((r) => r.id === sid));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  const create = () => toast(fullApp('the Create discount form'));

  const filtersBar = () => (
    <IndexFiltersBar
      query={query}
      onQueryChange={setQuery}
      queryPlaceholder="Searching in all"
      tabs={FILTERS.map((t, i) => ({ id: `${id}-tab-${i}`, content: t }))}
      selected={selectedTab}
      onSelect={(i) => {
        setSelectedTab(i);
        setSelection([]);
      }}
    >
      {selectedIds.length > 0 ? (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text color="subdued">{`${selectedIds.length} selected`}</s-text>
          <s-button onClick={() => setDeleteIds(selectedIds)}>Delete</s-button>
        </s-stack>
      ) : null}
    </IndexFiltersBar>
  );

  if (list.length === 0) {
    return (
      <s-section>
        <EmptyBlock heading="Create your first discount" image={emptyAssign} action={{ content: 'Create discount', onAction: create }}>
          Set up discount rules for different customer groups or product lines.
        </EmptyBlock>
      </s-section>
    );
  }

  return (
    <>
      <s-section>
        <s-stack gap="base">
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="small-200">
            <s-heading>Discount setting</s-heading>
            {/* Production hides the button whenever the fetched (searched/filtered) list is empty. */}
            {rows.length > 0 ? (
              <s-button variant="primary" onClick={create}>
                Add discount
              </s-button>
            ) : (
              <span />
            )}
          </s-grid>
          <s-box border="base" borderRadius="base" overflow="hidden">
            {/* Kept outside s-table so the search field never remounts (keeps focus) when the
                table swaps for the empty search result. */}
            <div className="qcfg-cost-filters">{filtersBar()}</div>
            {/* IndexTable hides its headings when there are no rows and shows its empty search result instead. */}
            {rows.length > 0 ? (
              <s-table>
                <s-table-header-row>
                  <s-table-header listSlot="inline">
                    <s-checkbox
                      accessibilityLabel={allSelected ? 'Deselect all discounts' : 'Select all discounts'}
                      checked={allSelected}
                      indeterminate={selectedIds.length > 0 && !allSelected}
                      onChange={(e) => setSelection(e.currentTarget.checked ? rows.map((r) => r.id) : [])}
                    />
                  </s-table-header>
                  <s-table-header listSlot="primary">Discount</s-table-header>
                  <s-table-header listSlot="labeled">Reason discount</s-table-header>
                  <s-table-header listSlot="labeled">Type</s-table-header>
                  <s-table-header listSlot="secondary">Status</s-table-header>
                  <s-table-header listSlot="labeled">Discount Expired</s-table-header>
                  <s-table-header listSlot="inline" format="numeric">
                    Action
                  </s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {rows.map((d) => (
                    <s-table-row key={d.id} clickDelegate={`${id}-select-${d.id}`}>
                      <s-table-cell>
                        <s-checkbox
                          id={`${id}-select-${d.id}`}
                          accessibilityLabel={`Select ${d.title}`}
                          checked={selectedIds.includes(d.id)}
                          onChange={(e) => {
                            const on = e.currentTarget.checked;
                            setSelection((cur) => (on ? [...new Set([...cur, d.id])] : cur.filter((x) => x !== d.id)));
                          }}
                        />
                      </s-table-cell>
                      <s-table-cell>
                        <span className="qcfg-cost-nowrap">
                          <s-text fontWeight="bold">{d.title}</s-text>
                        </span>
                      </s-table-cell>
                      <s-table-cell>
                        <span className="qcfg-cost-nowrap">
                          <s-text interestFor={`${id}-reason-${d.id}`}>
                            {d.reason_message.length > 50 ? `${d.reason_message.substring(0, 50)}...` : d.reason_message}
                          </s-text>
                        </span>
                        <s-tooltip id={`${id}-reason-${d.id}`}>{d.reason_message}</s-tooltip>
                      </s-table-cell>
                      <s-table-cell>
                        <span className="qcfg-cost-nowrap">{DISCOUNT_TYPE[d.apply_type]}</span>
                      </s-table-cell>
                      <s-table-cell>
                        {Number(d.status) ? <s-badge tone="success">Active</s-badge> : <s-badge>Inactive</s-badge>}
                      </s-table-cell>
                      <s-table-cell>
                        <span className="qcfg-cost-nowrap">{d.end_date ?? '--'}</span>
                      </s-table-cell>
                      <s-table-cell>
                        <div className="qcfg-row-actions">
                          <s-button
                            variant="tertiary"
                            icon="edit"
                            accessibilityLabel={`Edit ${d.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toast(fullApp(`the "${d.title}" discount`));
                            }}
                          />
                          <s-button
                            variant="tertiary"
                            icon="delete"
                            accessibilityLabel={`Delete ${d.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteIds([d.id]);
                            }}
                          />
                        </div>
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
            ) : null}
            {rows.length === 0 ? (
              // Polaris IndexTable default empty state: <EmptySearchResult withIllustration
              // title="No {resourceName.plural} found" description="Try changing the filters or search term" />
              <s-box padding="base">
                <div style={{ textAlign: 'center' }}>
                  <s-stack gap="base" alignItems="center">
                    <svg width="60" height="60" viewBox="0 0 60 60" aria-label="Empty search results" role="img">
                      <circle cx="26" cy="26" r="15" fill="none" stroke="#c9cccf" strokeWidth="5" />
                      <path d="M37.5 37.5 51 51" stroke="#c9cccf" strokeWidth="7" strokeLinecap="round" />
                    </svg>
                    <s-heading fontSize="large-200">No Discounts found</s-heading>
                    <s-text color="subdued">Try changing the filters or search term</s-text>
                  </s-stack>
                </div>
              </s-box>
            ) : null}
          </s-box>
        </s-stack>
      </s-section>

      <Modal open={deleteIds !== null} size="small" heading="Delete discount" onClose={() => setDeleteIds(null)}>
        <s-paragraph>Are you sure you want to delete this discount?</s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          onClick={() => {
            onListChange(list.filter((d) => !deleteIds.includes(d.id)));
            setSelection((cur) => cur.filter((x) => !deleteIds.includes(x)));
            setDeleteIds(null);
            toast(deleteIds.length === 1 ? 'Discount deleted' : `${deleteIds.length} discounts deleted`);
          }}
        >
          Delete
        </s-button>
        <s-button slot="secondary-actions" onClick={() => setDeleteIds(null)}>
          Cancel
        </s-button>
      </Modal>
    </>
  );
}
