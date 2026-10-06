import React, { useState, useEffect } from 'react';
import { useStore } from '../store.jsx';
import { policyStatus, policyUsage, policyUsageCount } from '../pricing.js';
import { Modal, IndexFiltersBar, useWcId, wcTone, PageHeader } from '../../shared/wc.jsx';
import basePricingArt from '../assets/base-pricing-empty.webp';
import quantityPricingArt from '../assets/quantity-pricing-empty.webp';

const AUDIENCE = [
  { id: 'all', label: 'All' },
  { id: 'b2b', label: 'Companies' },
  { id: 'd2c', label: 'Customers' },
];

const TYPE_CHOICES = [
  { label: 'All types', value: 'all' },
  { label: 'Base pricing', value: 'base' },
  { label: 'Quantity pricing', value: 'quantity' },
];
const STATUS_CHOICES = [
  { label: 'Any status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Inactive', value: 'inactive' },
];
const SORT_OPTIONS = [
  { label: 'Name', value: 'name', directionLabel: 'A–Z' },
  { label: 'Most assigned', value: 'assigned', directionLabel: 'Most first' },
];
const labelOf = (choices, value) => choices.find((c) => c.value === value)?.label ?? value;

const PAGE_SIZE = 10;

const PRICING_TYPES = [
  {
    kind: 'base',
    mode: 'add-base',
    image: basePricingArt,
    title: 'Base pricing',
    description: 'A price that covers the whole catalog, with optional rules and per-product overrides.',
  },
  {
    kind: 'quantity',
    mode: 'add-quantity',
    image: quantityPricingArt,
    title: 'Quantity pricing',
    description: 'Volume discounts that kick in above a quantity threshold, on selected products.',
  },
];

// Full-page "Select pricing type" step shown before the editor: pick a type
// card, then set it up. Opened from the list's "Create pricing" action; the
// back action returns to the list.
function PricingTypeChooser({ onBack, onPick }) {
  return (
    <>
    <PageHeader heading="Select pricing type" backAction={{ content: 'Pricing settings', onAction: onBack }} />
    <s-page>
      <s-query-container>
        <s-grid gridTemplateColumns="@container (inline-size > 490px) 1fr 1fr, 1fr" gap="base">
          {PRICING_TYPES.map((t) => (
            <s-section key={t.kind}>
              <s-stack gap="base">
                <img src={t.image} alt="" style={{ display: 'block', height: 140, width: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }} />
                <s-stack gap="small-300">
                  <s-heading fontSize="large">{t.title}</s-heading>
                  <s-paragraph color="subdued">{t.description}</s-paragraph>
                </s-stack>
                <s-stack direction="inline">
                  <s-button onClick={() => onPick(t.kind, t.mode)}>Create pricing</s-button>
                </s-stack>
              </s-stack>
            </s-section>
          ))}
        </s-grid>
      </s-query-container>
    </s-page>
    </>
  );
}

export function PricingLibrary() {
  const { state, dispatch } = useStore();
  const [audience, setAudience] = useState('all');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  // App home's unassigned-pricing warning lands here filtered to Inactive.
  const [statusFilter, setStatusFilter] = useState(state.pricingStatus || 'all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // App home's "Create pricing" lands here with the type chooser already open.
  const [chooserOpen, setChooserOpen] = useState(!!state.pricingChooser);
  const tipId = useWcId('pricing-row');
  useEffect(() => {
    if (state.pricingChooser || state.pricingStatus) dispatch({ type: 'NAVIGATE', view: 'pricing', patch: { pricingChooser: false, pricingStatus: null } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Jump back to the first page whenever the result set changes.
  useEffect(() => { setPage(0); }, [audience, search, kind, statusFilter, sort]);

  // "Create pricing" opens the type chooser first; picking a card opens the editor.
  if (chooserOpen) {
    return (
      <PricingTypeChooser
        onBack={() => setChooserOpen(false)}
        onPick={(kind, editorMode) => {
          setChooserOpen(false);
          dispatch({ type: 'OPEN_EDITOR', policy: null, kind, context: { mode: editorMode } });
        }}
      />
    );
  }

  const q = search.trim().toLowerCase();
  let policies = state.db.policies.filter((p) => {
    if (audience !== 'all' && p.audienceType !== audience) return false;
    if (kind !== 'all' && (p.priceKind === 'quantity' ? 'quantity' : 'base') !== kind) return false;
    if (statusFilter !== 'all' && policyStatus(p, state.db).label.toLowerCase() !== statusFilter) return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });
  policies = [...policies].sort((a, b) =>
    sort === 'assigned' ? policyUsageCount(b, state.db) - policyUsageCount(a, state.db) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name),
  );

  const total = policies.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const start = current * PAGE_SIZE;
  const pagePolicies = policies.slice(start, start + PAGE_SIZE);
  const pageLabel = total === 0 ? '0 of 0' : `${start + 1}–${start + pagePolicies.length} of ${total}`;

  const openEditor = (p) => dispatch({ type: 'OPEN_EDITOR', policy: p, context: { mode: 'edit' } });

  const rows = pagePolicies.map((p) => {
    const st = policyStatus(p, state.db);
    const isOff = p.status === 'Inactive';
    const id = `${tipId}-${p.id}`;
    return (
      // A row click opens the editor (delegated to the name link).
      <s-table-row key={p.id} clickDelegate={`${id}-open`}>
        <s-table-cell>
          <s-link id={`${id}-open`} tone="neutral" onClick={() => openEditor(p)}>
            <s-text fontWeight="semibold">{p.name}</s-text>
          </s-link>
        </s-table-cell>
        <s-table-cell>{p.priceKind === 'quantity' ? 'Quantity pricing' : 'Base pricing'}</s-table-cell>
        <s-table-cell>
          <s-badge tone={p.audienceType === 'b2b' ? 'info' : undefined}>{p.audienceType === 'b2b' ? 'Companies' : 'Customers'}</s-badge>
        </s-table-cell>
        <s-table-cell>
          <s-badge tone={wcTone(st.tone)}>{st.label}</s-badge>
        </s-table-cell>
        <s-table-cell>
          <s-text>{p.priority ?? 0}</s-text>
        </s-table-cell>
        <s-table-cell>
          <s-stack direction="inline" gap="small-400" justifyContent="end" alignItems="center">
            <s-button
              icon={isOff ? 'toggle-off' : 'toggle-on'}
              variant="tertiary"
              accessibilityLabel={isOff ? 'Turn on' : 'Turn off'}
              interestFor={`${id}-toggle-tip`}
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'TOGGLE_POLICY_STATUS', id: p.id });
              }}
            />
            <s-tooltip id={`${id}-toggle-tip`}>{isOff ? 'Turn on' : 'Turn off'}</s-tooltip>
            <s-button
              icon="edit"
              variant="tertiary"
              accessibilityLabel="Edit pricing"
              interestFor={`${id}-edit-tip`}
              onClick={(e) => {
                e.stopPropagation();
                openEditor(p);
              }}
            />
            <s-tooltip id={`${id}-edit-tip`}>Edit pricing</s-tooltip>
            <s-button
              icon="delete"
              variant="tertiary"
              tone="critical"
              accessibilityLabel="Delete pricing"
              interestFor={`${id}-delete-tip`}
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(p);
              }}
            />
            <s-tooltip id={`${id}-delete-tip`}>Delete pricing</s-tooltip>
          </s-stack>
        </s-table-cell>
      </s-table-row>
    );
  });

  const tabs = AUDIENCE.map((a) => ({ id: `aud-${a.id}`, content: a.label }));
  const selectedTab = Math.max(0, AUDIENCE.findIndex((a) => a.id === audience));

  // Pricing type / Status filters sit under the search; the ones in use also
  // show as removable chips (with Clear all), like IndexFilters' applied filters.
  const appliedFilters = [];
  if (kind !== 'all') appliedFilters.push({ key: 'kind', label: `Pricing type: ${labelOf(TYPE_CHOICES, kind)}`, onRemove: () => setKind('all') });
  if (statusFilter !== 'all') appliedFilters.push({ key: 'status', label: `Status: ${labelOf(STATUS_CHOICES, statusFilter)}`, onRemove: () => setStatusFilter('all') });

  return (
    <s-page heading="Pricing settings">
      <s-button slot="primary-action" variant="primary" onClick={() => setChooserOpen(true)}>
        Create pricing
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
            query={search}
            queryPlaceholder="Search pricing by name"
            onQueryChange={setSearch}
            tabs={tabs}
            selected={selectedTab}
            onSelect={(i) => setAudience(AUDIENCE[i].id)}
            sortOptions={SORT_OPTIONS}
            sortSelected={sort}
            onSort={setSort}
          >
            <s-grid gridTemplateColumns="180px 180px 1fr" gap="small-200" alignItems="center">
              <s-select
                label="Pricing type"
                labelAccessibilityVisibility="exclusive"
                value={kind}
                onChange={(e) => setKind(e.currentTarget.value)}
              >
                {TYPE_CHOICES.map((c) => (
                  <s-option key={c.value} value={c.value}>
                    {c.label}
                  </s-option>
                ))}
              </s-select>
              <s-select
                label="Status"
                labelAccessibilityVisibility="exclusive"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.currentTarget.value)}
              >
                {STATUS_CHOICES.map((c) => (
                  <s-option key={c.value} value={c.value}>
                    {c.label}
                  </s-option>
                ))}
              </s-select>
              {appliedFilters.length ? (
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  {appliedFilters.map((f) => (
                    <s-clickable-chip key={f.key} removable accessibilityLabel={`Remove ${f.label}`} onRemove={f.onRemove}>
                      {f.label}
                    </s-clickable-chip>
                  ))}
                  <s-link
                    onClick={() => {
                      setKind('all');
                      setStatusFilter('all');
                    }}
                  >
                    Clear all
                  </s-link>
                </s-stack>
              ) : (
                <span />
              )}
            </s-grid>
          </IndexFiltersBar>
          <s-table-header-row>
            <s-table-header listSlot="primary">Name</s-table-header>
            <s-table-header listSlot="labeled">Pricing type</s-table-header>
            <s-table-header listSlot="labeled">Assigned to</s-table-header>
            <s-table-header listSlot="secondary">Status</s-table-header>
            <s-table-header listSlot="labeled">Priority</s-table-header>
            <s-table-header listSlot="inline">
              <s-text accessibilityVisibility="exclusive">Actions</s-text>
            </s-table-header>
          </s-table-header-row>
          <s-table-body>{rows}</s-table-body>
        </s-table>
        {rows.length === 0 ? (
          <s-box padding="base">
            <div style={{ textAlign: 'center' }}>
              <s-text color="subdued">No pricing matches these filters.</s-text>
            </div>
          </s-box>
        ) : pageCount > 1 ? (
          <s-box paddingBlockEnd="small">
            <div style={{ textAlign: 'center' }}>
              <s-text color="subdued" fontSize="small">{pageLabel}</s-text>
            </div>
          </s-box>
        ) : null}
      </s-section>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} heading={`Delete ${confirmDelete.name}?`}>
          <s-paragraph>
            This deletes the pricing and unassigns it from {policyUsage(confirmDelete, state.db)}. Buyers there fall back to their next pricing or the Shopify price.
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              dispatch({ type: 'DELETE_POLICY', id: confirmDelete.id });
              setConfirmDelete(null);
            }}
          >
            Delete pricing
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmDelete(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-page>
  );
}
