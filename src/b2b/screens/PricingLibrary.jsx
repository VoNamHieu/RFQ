import React, { useState, useEffect } from 'react';
import {
  Page,
  Card,
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  ChoiceList,
  Badge,
  Text,
  InlineStack,
  Button,
  Box,
  Modal,
  Tooltip,
} from '@shopify/polaris';
import { EditIcon, DeleteIcon, ToggleOnIcon, ToggleOffIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { policyStatus, policyUsage, policyUsageCount } from '../pricing.js';

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

export function PricingLibrary() {
  const { state, dispatch } = useStore();
  const [audience, setAudience] = useState('all');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { mode, setMode } = useSetIndexFiltersMode();

  // Jump back to the first page whenever the result set changes.
  useEffect(() => { setPage(0); }, [audience, search, kind, statusFilter, sort]);

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

  const rows = pagePolicies.map((p, index) => {
    const st = policyStatus(p, state.db);
    const canToggle = policyUsageCount(p, state.db) > 0;
    const isOff = p.status === 'Inactive';
    return (
      <IndexTable.Row id={p.id} key={p.id} position={index} onClick={() => dispatch({ type: 'OPEN_EDITOR', policy: p, context: { mode: 'edit' } })}>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">{p.name}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{p.priceKind === 'quantity' ? 'Quantity pricing' : 'Base pricing'}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={p.audienceType === 'b2b' ? 'info' : undefined}>{p.audienceType === 'b2b' ? 'Companies' : 'Customers'}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell><Badge tone={st.tone}>{st.label}</Badge></IndexTable.Cell>
        <IndexTable.Cell><Text as="span" variant="bodyMd">{p.priority ?? 0}</Text></IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100" align="end" wrap={false}>
            {canToggle && (
              <Tooltip content={isOff ? 'Turn on' : 'Turn off'}>
                <Button icon={isOff ? ToggleOffIcon : ToggleOnIcon} variant="tertiary" accessibilityLabel={isOff ? 'Turn on' : 'Turn off'} onClick={() => dispatch({ type: 'TOGGLE_POLICY_STATUS', id: p.id })} />
              </Tooltip>
            )}
            <Tooltip content="Edit pricing">
              <Button icon={EditIcon} variant="tertiary" accessibilityLabel="Edit pricing" onClick={() => dispatch({ type: 'OPEN_EDITOR', policy: p, context: { mode: 'edit' } })} />
            </Tooltip>
            <Tooltip content="Delete pricing">
              <Button icon={DeleteIcon} variant="tertiary" tone="critical" accessibilityLabel="Delete pricing" onClick={() => setConfirmDelete(p)} />
            </Tooltip>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const tabs = AUDIENCE.map((a, i) => ({ id: `aud-${a.id}`, content: a.label, index: i }));
  const selectedTab = Math.max(0, AUDIENCE.findIndex((a) => a.id === audience));

  // Both filters live behind a single "Add filter" disclosure (unpinned), so the
  // filter bar shows one "Add filter +" that lists Pricing type / Status — instead
  // of two always-on filter buttons.
  const filters = [
    {
      key: 'kind',
      label: 'Pricing type',
      filter: <ChoiceList title="Pricing type" titleHidden choices={TYPE_CHOICES} selected={[kind]} onChange={(v) => setKind(v[0])} />,
    },
    {
      key: 'status',
      label: 'Status',
      filter: <ChoiceList title="Status" titleHidden choices={STATUS_CHOICES} selected={[statusFilter]} onChange={(v) => setStatusFilter(v[0])} />,
    },
  ];
  const appliedFilters = [];
  if (kind !== 'all') appliedFilters.push({ key: 'kind', label: `Pricing type: ${labelOf(TYPE_CHOICES, kind)}`, onRemove: () => setKind('all') });
  if (statusFilter !== 'all') appliedFilters.push({ key: 'status', label: `Status: ${labelOf(STATUS_CHOICES, statusFilter)}`, onRemove: () => setStatusFilter('all') });

  return (
    <Page
      title="Pricing settings"
      primaryAction={{ content: 'Create base pricing', onAction: () => dispatch({ type: 'OPEN_EDITOR', policy: null, kind: 'base', context: { mode: 'add-base' } }) }}
      secondaryActions={[
        { content: 'Create quantity pricing', onAction: () => dispatch({ type: 'OPEN_EDITOR', policy: null, kind: 'quantity', context: { mode: 'add-quantity' } }) },
      ]}
    >
      <Card padding="0">
        <IndexFilters
          queryValue={search}
          queryPlaceholder="Search pricing by name"
          onQueryChange={setSearch}
          onQueryClear={() => setSearch('')}
          tabs={tabs}
          selected={selectedTab}
          onSelect={(i) => setAudience(AUDIENCE[i].id)}
          sortOptions={SORT_OPTIONS}
          sortSelected={[sort]}
          onSort={(v) => setSort(v[0])}
          filters={filters}
          appliedFilters={appliedFilters}
          onClearAll={() => { setKind('all'); setStatusFilter('all'); }}
          mode={mode}
          setMode={setMode}
          cancelAction={{ onAction: () => setSearch('') }}
          canCreateNewView={false}
        />
        <IndexTable
          resourceName={{ singular: 'pricing', plural: 'pricings' }}
          itemCount={rows.length}
          selectable={false}
          emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No pricing matches these filters.</Text></Box>}
          headings={[
            { title: 'Name' },
            { title: 'Pricing type' },
            { title: 'Assigned to' },
            { title: 'Status' },
            { title: 'Priority' },
            { title: '', alignment: 'end' },
          ]}
          pagination={{
            hasNext: current < pageCount - 1,
            hasPrevious: current > 0,
            onNext: () => setPage((p) => Math.min(p + 1, pageCount - 1)),
            onPrevious: () => setPage((p) => Math.max(p - 1, 0)),
            label: pageLabel,
          }}
        >
          {rows}
        </IndexTable>
      </Card>

      {confirmDelete && (
        <Modal
          open
          onClose={() => setConfirmDelete(null)}
          title={`Delete ${confirmDelete.name}?`}
          primaryAction={{
            content: 'Delete pricing',
            destructive: true,
            onAction: () => {
              dispatch({ type: 'DELETE_POLICY', id: confirmDelete.id });
              setConfirmDelete(null);
            },
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmDelete(null) }]}
        >
          <Modal.Section>
            <Text as="p">
              This deletes the pricing and unassigns it from {policyUsage(confirmDelete, state.db)}. Buyers there fall back to their next pricing or the Shopify price.
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
