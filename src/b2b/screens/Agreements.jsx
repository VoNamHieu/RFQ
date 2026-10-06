import React, { useState } from 'react';
import { Page, Card, IndexTable, IndexFilters, useSetIndexFiltersMode, Badge, Text, Box, Modal, Select, BlockStack } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { currentAgreement, agreementScopeLabel, agreementTermCount } from '../agreements.js';
import { AgreementEditor } from '../components/AgreementEditor.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'Active', label: 'Active' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Ended', label: 'Ended' },
];
const STATUS_TONE = { Active: 'success', Draft: undefined, Ended: undefined };

// Every company's agreement in one list. A row opens the company's Agreement tab;
// the editor opens as a page here (OPEN_AGREEMENT_EDITOR).
export function Agreements() {
  const { state, dispatch } = useStore();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const { mode, setMode } = useSetIndexFiltersMode();

  if (state.agreementEditor) return <AgreementEditor />;

  const all = state.db.agreements || [];
  const companyOf = (id) => state.db.companies.find((c) => c.id === id);
  // One current agreement per company: only companies without one can get a new one.
  const free = state.db.companies.filter((c) => !currentAgreement(state.db, c.id));
  const create = { content: 'Create agreement', onAction: () => { setCompanyId(free[0]?.id || ''); setPicking(true); }, disabled: !free.length };

  const q = search.trim().toLowerCase();
  const rows = all
    .filter((a) => (status === 'all' || a.status === status)
      && (!q || `${a.number} ${a.name} ${companyOf(a.companyId)?.name || ''}`.toLowerCase().includes(q)))
    .sort((a, b) => (a.status === 'Ended') - (b.status === 'Ended') || String(a.number).localeCompare(String(b.number)))
    .map((a, index) => {
      const company = companyOf(a.companyId);
      return (
        <IndexTable.Row id={a.id} key={a.id} position={index} onClick={() => dispatch({ type: 'OPEN_COMPANY', id: a.companyId, tab: 'agreement' })}>
          <IndexTable.Cell>
            <BlockStack gap="050">
              <Text as="span" variant="bodyMd" fontWeight="semibold">{a.number}</Text>
              <Text as="span" tone="subdued" variant="bodySm">{a.name || 'Untitled agreement'}</Text>
            </BlockStack>
          </IndexTable.Cell>
          <IndexTable.Cell>{company?.name || '—'}</IndexTable.Cell>
          <IndexTable.Cell>{company ? agreementScopeLabel(company, a) : '—'}</IndexTable.Cell>
          <IndexTable.Cell>{agreementTermCount(a)}</IndexTable.Cell>
          <IndexTable.Cell>{a.version ? `v${a.version}` : '—'}</IndexTable.Cell>
          <IndexTable.Cell><Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge></IndexTable.Cell>
        </IndexTable.Row>
      );
    });

  const picker = picking && (
    <Modal
      open
      onClose={() => setPicking(false)}
      title="Create agreement"
      primaryAction={{
        content: 'Continue',
        disabled: !companyId,
        onAction: () => { setPicking(false); dispatch({ type: 'OPEN_AGREEMENT_EDITOR', companyId }); },
      }}
      secondaryActions={[{ content: 'Cancel', onAction: () => setPicking(false) }]}
    >
      <Modal.Section>
        <Select
          label="Company"
          options={free.map((c) => ({ label: c.name, value: c.id }))}
          value={companyId}
          onChange={setCompanyId}
          helpText="A company has one current agreement. Companies that already have one aren’t listed."
        />
      </Modal.Section>
    </Modal>
  );

  if (!all.length) {
    return (
      <Page title="Agreements" primaryAction={create}>
        <Card>
          <EmptyBlock heading="Put each company’s terms in one agreement" action={create}>
            An agreement holds a company’s pricing and order limits. Activating it applies them together, and every change is kept as a version.
          </EmptyBlock>
        </Card>
        {picker}
      </Page>
    );
  }

  return (
    <Page title="Agreements" subtitle="Each company’s pricing and order limits, applied together." primaryAction={create}>
      <Card padding="0">
        <IndexFilters
          queryValue={search}
          queryPlaceholder="Search by agreement or company"
          onQueryChange={setSearch}
          onQueryClear={() => setSearch('')}
          tabs={STATUS_TABS.map((t, i) => ({ id: `ag-${t.id}`, content: t.label, index: i }))}
          selected={Math.max(0, STATUS_TABS.findIndex((t) => t.id === status))}
          onSelect={(i) => setStatus(STATUS_TABS[i].id)}
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
          resourceName={{ singular: 'agreement', plural: 'agreements' }}
          itemCount={rows.length}
          selectable={false}
          emptyState={<Box padding="400"><Text as="p" alignment="center" tone="subdued">No agreements match these filters.</Text></Box>}
          headings={[{ title: 'Agreement' }, { title: 'Company' }, { title: 'Applies to' }, { title: 'Terms' }, { title: 'Version' }, { title: 'Status' }]}
        >
          {rows}
        </IndexTable>
      </Card>
      {picker}
    </Page>
  );
}
