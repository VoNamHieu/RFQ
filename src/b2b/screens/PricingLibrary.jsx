import React, { useState, useEffect } from 'react';
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  Button,
  ButtonGroup,
  Box,
  TextField,
  Select,
  Icon,
  Modal,
  Tooltip,
} from '@shopify/polaris';
import { EditIcon, DeleteIcon, SearchIcon, PlusCircleIcon, ToggleOnIcon, ToggleOffIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { policyStatus, scopeTypeLabel, policyUsage, policyUsageCount } from '../pricing.js';

const AUDIENCE = [
  { id: 'all', label: 'All' },
  { id: 'b2b', label: 'Companies' },
  { id: 'd2c', label: 'Customers' },
];

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
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="semibold">{p.name}</Text>
            <Text as="span" tone="subdued" variant="bodySm">{p.type}</Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{p.priceKind === 'quantity' ? 'Quantity pricing' : 'Base pricing'}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={p.audienceType === 'b2b' ? 'info' : undefined}>{p.audienceType === 'b2b' ? 'Companies' : 'Customers'}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell><Text as="span" variant="bodySm">{scopeTypeLabel(p)}</Text></IndexTable.Cell>
        <IndexTable.Cell><Badge tone={st.tone}>{st.label}</Badge></IndexTable.Cell>
        <IndexTable.Cell><Text as="span" tone="subdued" variant="bodySm">{policyUsage(p, state.db)}</Text></IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100" align="end" wrap={false}>
            <Tooltip content="Assign">
              <Button icon={PlusCircleIcon} variant="tertiary" accessibilityLabel="Assign" onClick={() => dispatch({ type: 'OPEN_MULTI_ASSIGN', policyId: p.id })} />
            </Tooltip>
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

  return (
    <Page
      fullWidth
      title="Pricing"
      subtitle="Make a price once, then assign it to companies or customers."
      primaryAction={{ content: 'Create base pricing', onAction: () => dispatch({ type: 'OPEN_EDITOR', policy: null, kind: 'base', context: { mode: 'add-base' } }) }}
      secondaryActions={[
        { content: 'Create quantity pricing', onAction: () => dispatch({ type: 'OPEN_EDITOR', policy: null, kind: 'quantity', context: { mode: 'add-quantity' } }) },
      ]}
    >
      <Card padding="0">
        <Box padding="300" paddingBlockEnd="200">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
              <ButtonGroup variant="segmented">
                {AUDIENCE.map((a) => (
                  <Button key={a.id} pressed={audience === a.id} onClick={() => setAudience(a.id)}>{a.label}</Button>
                ))}
              </ButtonGroup>
              <InlineStack gap="200">
                <Box minWidth="150px">
                  <Select label="Type" labelHidden options={[{ label: 'All types', value: 'all' }, { label: 'Base pricing', value: 'base' }, { label: 'Quantity pricing', value: 'quantity' }]} value={kind} onChange={setKind} />
                </Box>
                <Box minWidth="150px">
                  <Select label="Status" labelHidden options={[{ label: 'Any status', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Scheduled', value: 'scheduled' }, { label: 'Inactive', value: 'inactive' }]} value={statusFilter} onChange={setStatusFilter} />
                </Box>
                <Box minWidth="150px">
                  <Select label="Sort" labelHidden options={[{ label: 'Name', value: 'name' }, { label: 'Most assigned', value: 'assigned' }]} value={sort} onChange={setSort} />
                </Box>
              </InlineStack>
            </InlineStack>
            <TextField
              label="Search pricing"
              labelHidden
              value={search}
              onChange={setSearch}
              prefix={<Icon source={SearchIcon} tone="subdued" />}
              placeholder="Search pricing by name"
              clearButton
              onClearButtonClick={() => setSearch('')}
              autoComplete="off"
            />
          </BlockStack>
        </Box>
        <IndexTable
          resourceName={{ singular: 'pricing', plural: 'pricings' }}
          itemCount={rows.length}
          selectable={false}
          emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No pricing matches these filters.</Text></Box>}
          headings={[
            { title: 'Name' },
            { title: 'Pricing type' },
            { title: 'Serves' },
            { title: 'Products' },
            { title: 'Status' },
            { title: 'Assigned to' },
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
