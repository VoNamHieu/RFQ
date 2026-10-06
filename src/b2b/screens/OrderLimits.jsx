import React, { useState } from 'react';
import { Page, Card, IndexTable, IndexFilters, useSetIndexFiltersMode, Badge, Text, BlockStack, InlineStack, InlineGrid, Button, Box, Modal, Tooltip } from '@shopify/polaris';
import { EditIcon, DeleteIcon, ToggleOnIcon, ToggleOffIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitSummary, limitTargetsLabel, isLimitAssigned } from '../limits.js';
import { LimitEditor } from '../components/LimitEditor.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';

const TYPE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'order', label: 'Order' },
  { id: 'product', label: 'Product' },
  { id: 'review', label: 'Review' },
];

// "Create limit" step: pick one of the three kinds, then set it up.
function LimitTypeChooser({ onBack, onPick }) {
  return (
    <Page title="Select limit type" backAction={{ content: 'Order limits', onAction: onBack }}>
      <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
        {Object.entries(LIMIT_KINDS).map(([kind, k]) => (
          <Card key={kind}>
            <BlockStack gap="300">
              <BlockStack gap="150">
                <Text as="h3" variant="headingMd">{k.label}</Text>
                <Text as="p" tone="subdued">{k.description}</Text>
              </BlockStack>
              <InlineStack>
                <Button onClick={() => onPick(kind)}>Create limit</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        ))}
      </InlineGrid>
    </Page>
  );
}

// Order limits library: every limit with what it sets and who it applies to.
// The editor opens as a page here (OPEN_LIMIT_EDITOR).
export function OrderLimits() {
  const { state, dispatch } = useStore();
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [chooserOpen, setChooserOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { mode, setMode } = useSetIndexFiltersMode();

  if (state.limitEditor) return <LimitEditor />;
  if (chooserOpen) {
    return (
      <LimitTypeChooser
        onBack={() => setChooserOpen(false)}
        onPick={(kind) => {
          setChooserOpen(false);
          dispatch({ type: 'OPEN_LIMIT_EDITOR', kind });
        }}
      />
    );
  }

  const all = state.db.limits || [];
  const create = { content: 'Create limit', onAction: () => setChooserOpen(true) };
  if (!all.length) {
    return (
      <Page title="Order limits" primaryAction={create}>
        <Card>
          <EmptyBlock heading="Set rules for what buyers can order" action={create}>
            Require a minimum order, sell products in case packs, or review large orders before they go through. Apply a limit store-wide or to specific companies and locations.
          </EmptyBlock>
        </Card>
      </Page>
    );
  }

  const q = search.trim().toLowerCase();
  const limits = all
    .filter((l) => (type === 'all' || l.kind === type) && (!q || l.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const edit = (l) => dispatch({ type: 'OPEN_LIMIT_EDITOR', limit: l });

  const rows = limits.map((l, index) => {
    const isOff = l.status !== 'Active';
    return (
      <IndexTable.Row id={l.id} key={l.id} position={index} onClick={() => edit(l)}>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">{l.name}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{LIMIT_KINDS[l.kind].label}</IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ whiteSpace: 'normal', maxWidth: 320 }}>
            <Text as="span" variant="bodyMd">{limitSummary(l, state.db)}</Text>
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" tone={isLimitAssigned(l) ? undefined : 'subdued'}>{limitTargetsLabel(l, state.db)}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={isOff ? undefined : 'success'}>{isOff ? 'Inactive' : 'Active'}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {/* Keep these clicks from also opening the row's limit. */}
          <div onClick={(e) => e.stopPropagation()}>
            <InlineStack gap="100" align="end" wrap={false}>
              <Tooltip content={isOff ? 'Turn on' : 'Turn off'}>
                <Button icon={isOff ? ToggleOffIcon : ToggleOnIcon} variant="tertiary" accessibilityLabel={isOff ? 'Turn on' : 'Turn off'} onClick={() => dispatch({ type: 'TOGGLE_LIMIT_STATUS', id: l.id })} />
              </Tooltip>
              <Tooltip content="Edit limit">
                <Button icon={EditIcon} variant="tertiary" accessibilityLabel="Edit limit" onClick={() => edit(l)} />
              </Tooltip>
              <Tooltip content="Delete limit">
                <Button icon={DeleteIcon} variant="tertiary" tone="critical" accessibilityLabel="Delete limit" onClick={() => setConfirmDelete(l)} />
              </Tooltip>
            </InlineStack>
          </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Order limits" subtitle="Rules on what B2B buyers can check out, checked in the cart and at checkout." primaryAction={create}>
      <Card padding="0">
        <IndexFilters
          queryValue={search}
          queryPlaceholder="Search limits by name"
          onQueryChange={setSearch}
          onQueryClear={() => setSearch('')}
          tabs={TYPE_TABS.map((t, i) => ({ id: `type-${t.id}`, content: t.label, index: i }))}
          selected={Math.max(0, TYPE_TABS.findIndex((t) => t.id === type))}
          onSelect={(i) => setType(TYPE_TABS[i].id)}
          filters={[]}
          appliedFilters={[]}
          onClearAll={() => {}}
          hideFilters
          mode={mode}
          setMode={setMode}
          cancelAction={{ onAction: () => setSearch('') }}
          canCreateNewView={false}
        />
        <IndexTable
          resourceName={{ singular: 'limit', plural: 'limits' }}
          itemCount={rows.length}
          selectable={false}
          emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No limits match these filters.</Text></Box>}
          headings={[
            { title: 'Name' },
            { title: 'Type' },
            { title: 'Rule' },
            { title: 'Applies to' },
            { title: 'Status' },
            { title: '', alignment: 'end' },
          ]}
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
            content: 'Delete limit',
            destructive: true,
            onAction: () => {
              dispatch({ type: 'DELETE_LIMIT', id: confirmDelete.id });
              setConfirmDelete(null);
            },
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmDelete(null) }]}
        >
          <Modal.Section>
            <Text as="p">Buyers it applies to ({limitTargetsLabel(confirmDelete, state.db)}) can check out without it right away. This can’t be undone.</Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
