import React, { useState } from 'react';
import {
  Page,
  Card,
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  useIndexResourceState,
  Badge,
  Text,
  Link,
  Button,
  Tooltip,
  InlineStack,
  Box,
  Modal,
  EmptyState,
} from '@shopify/polaris';
import { EditIcon, DeleteIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { companyBaseEntries, companyQuantityPolicy, companyPricingStatus, companyNeedsPrice } from '../pricing.js';

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
  const { mode, setMode } = useSetIndexFiltersMode();
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const assignedPolicies = (c) => {
    const bases = companyBaseEntries(c, policies).map((e) => e.policy);
    const qp = companyQuantityPolicy(c, policies);
    if (qp) bases.push(qp);
    return bases;
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

  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = list.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const resources = pageRows.map((c) => ({ id: c.id }));
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(resources);

  // First-run empty state (no companies at all) — the B2B boundary explainer.
  // (After all hooks so hook order stays stable.)
  if (state.db.companies.length === 0) {
    return (
      <Page fullWidth title="B2B Company">
        <Card>
          <EmptyState
            heading="No companies linked yet"
            action={{ content: 'Link your first company', onAction: () => dispatch({ type: 'OPEN_ADD_COMPANY' }) }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Link a Shopify B2B Company to decide what its buyers pay. Shopify keeps the Company record and takes the
              orders; this app only decides the price.
            </p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const filterIndex = Math.max(0, FILTER_TABS.findIndex((t) => t.id === state.listFilter));
  const tabs = FILTER_TABS.map((t, i) => ({ id: `f-${t.id}`, content: t.label, index: i }));

  const rows = pageRows.map((c, index) => {
    const status = companyPricingStatus(c, policies, defaults);
    const assigned = assignedPolicies(c);
    return (
      <IndexTable.Row
        id={c.id}
        key={c.id}
        position={index}
        selected={selectedResources.includes(c.id)}
        onClick={() => dispatch({ type: 'OPEN_COMPANY', id: c.id })}
      >
        <IndexTable.Cell>
          <Link removeUnderline monochrome={false} onClick={() => dispatch({ type: 'OPEN_COMPANY', id: c.id })}>
            {c.name}
          </Link>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={status.tone}>{status.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{(c.locations || []).length}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {assigned.length
              ? assigned.slice(0, 2).map((p) => p.name).join(', ') + (assigned.length > 2 ? ` +${assigned.length - 2} more` : '')
              : '—'}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {c.mainContact || '—'}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100" align="end" wrap={false}>
            <Tooltip content="Edit">
              <Button icon={EditIcon} variant="tertiary" accessibilityLabel="Edit company" onClick={() => dispatch({ type: 'OPEN_COMPANY', id: c.id })} />
            </Tooltip>
            <Tooltip content="Delete">
              <Button icon={DeleteIcon} variant="tertiary" tone="critical" accessibilityLabel="Delete company" onClick={() => setConfirmDelete(c)} />
            </Tooltip>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      fullWidth
      title="B2B Company"
      primaryAction={{ content: 'Add company', onAction: () => dispatch({ type: 'OPEN_ADD_COMPANY' }) }}
    >
      <Card padding="0">
        <IndexFilters
          queryValue={state.companySearch}
          queryPlaceholder="Searching in all companies"
          onQueryChange={(v) => dispatch({ type: 'SET_COMPANY_SEARCH', value: v })}
          onQueryClear={() => dispatch({ type: 'SET_COMPANY_SEARCH', value: '' })}
          tabs={tabs}
          selected={filterIndex}
          onSelect={(i) => {
            dispatch({ type: 'SET_LIST_FILTER', filter: FILTER_TABS[i].id });
            setPage(0);
          }}
          sortOptions={SORT_OPTIONS}
          sortSelected={[`${state.companySortField} ${state.companySortDir}`]}
          onSort={(val) => {
            const [field, dir] = (val[0] || 'name asc').split(' ');
            dispatch({ type: 'SET_COMPANY_SORT', field, dir });
          }}
          filters={[]}
          appliedFilters={[]}
          onClearAll={() => {}}
          mode={mode}
          setMode={setMode}
          cancelAction={{ onAction: () => dispatch({ type: 'SET_COMPANY_SEARCH', value: '' }) }}
          canCreateNewView={false}
        />
        <IndexTable
          resourceName={{ singular: 'company', plural: 'companies' }}
          itemCount={pageRows.length}
          selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          headings={[
            { title: 'Company' },
            { title: 'Pricing status' },
            { title: 'Locations' },
            { title: 'Pricing assigned' },
            { title: 'Main contact' },
            { title: 'Actions', alignment: 'end' },
          ]}
          pagination={{
            hasNext: current < pageCount - 1,
            hasPrevious: current > 0,
            onNext: () => setPage((p) => Math.min(p + 1, pageCount - 1)),
            onPrevious: () => setPage((p) => Math.max(p - 1, 0)),
          }}
          emptyState={
            <Box padding="400">
              <Text as="p" alignment="center" tone="subdued">
                No companies match — try a different search or clear the filter.
              </Text>
            </Box>
          }
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
            content: 'Delete company',
            destructive: true,
            onAction: () => {
              dispatch({ type: 'DELETE_COMPANY', id: confirmDelete.id });
              setConfirmDelete(null);
            },
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmDelete(null) }]}
        >
          <Modal.Section>
            <Text as="p">
              This removes {confirmDelete.name} from the B2B app. The Shopify company record is not affected.
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
