import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { currentAgreement, agreementScopeLabel, agreementTermCount } from '../agreements.js';
import { AgreementEditor } from '../components/AgreementEditor.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { Modal, IndexFiltersBar, useWcId, wcTone } from '../../shared/wc.jsx';

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
  const rowId = useWcId('agreement');

  if (state.agreementEditor) return <AgreementEditor />;

  const all = state.db.agreements || [];
  const companyOf = (id) => state.db.companies.find((c) => c.id === id);
  // One current agreement per company: only companies without one can get a new one.
  const free = state.db.companies.filter((c) => !currentAgreement(state.db, c.id));
  const create = { content: 'Create contract', onAction: () => { setCompanyId(free[0]?.id || ''); setPicking(true); }, disabled: !free.length };
  const createButton = (
    <s-button slot="primary-action" variant="primary" disabled={create.disabled} onClick={create.onAction}>
      {create.content}
    </s-button>
  );

  const q = search.trim().toLowerCase();
  const rows = all
    .filter((a) => (status === 'all' || a.status === status)
      && (!q || `${a.number} ${a.name} ${companyOf(a.companyId)?.name || ''}`.toLowerCase().includes(q)))
    .sort((a, b) => (a.status === 'Ended') - (b.status === 'Ended') || String(a.number).localeCompare(String(b.number)))
    .map((a) => {
      const company = companyOf(a.companyId);
      const linkId = `${rowId}-${a.id}`;
      return (
        <s-table-row key={a.id} clickDelegate={linkId}>
          <s-table-cell>
            <s-stack gap="small-500">
              <s-link id={linkId} onClick={() => dispatch({ type: 'OPEN_COMPANY', id: a.companyId, tab: 'agreement' })}>
                {a.number}
              </s-link>
              <s-text color="subdued" fontSize="small">{a.name || 'Untitled contract'}</s-text>
            </s-stack>
          </s-table-cell>
          <s-table-cell>{company?.name || '—'}</s-table-cell>
          <s-table-cell>{company ? agreementScopeLabel(company, a) : '—'}</s-table-cell>
          <s-table-cell>{agreementTermCount(a)}</s-table-cell>
          <s-table-cell>{a.version ? `v${a.version}` : '—'}</s-table-cell>
          <s-table-cell>
            <s-badge tone={wcTone(STATUS_TONE[a.status])}>{a.status}</s-badge>
          </s-table-cell>
        </s-table-row>
      );
    });

  const picker = picking && (
    <Modal onClose={() => setPicking(false)} heading="Create contract">
      <s-select
        label="Company"
        value={companyId}
        onChange={(e) => setCompanyId(e.currentTarget.value)}
        details="A company has one current contract. Companies that already have one aren’t listed."
      >
        {free.map((c) => (
          <s-option key={c.id} value={c.id}>
            {c.name}
          </s-option>
        ))}
      </s-select>
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!companyId}
        onClick={() => { setPicking(false); dispatch({ type: 'OPEN_AGREEMENT_EDITOR', companyId }); }}
      >
        Continue
      </s-button>
      <s-button slot="secondary-actions" onClick={() => setPicking(false)}>
        Cancel
      </s-button>
    </Modal>
  );

  if (!all.length) {
    return (
      <s-page heading="Contracts">
        {createButton}
        <s-section>
          <EmptyBlock heading="Put each company’s terms in one contract" action={create.disabled ? undefined : create}>
            A contract holds a company’s pricing and order limits. Activating it applies them together, and every change is kept as a version.
          </EmptyBlock>
        </s-section>
        {picker}
      </s-page>
    );
  }

  return (
    <s-page heading="Contracts">
      {createButton}
      <s-stack gap="base">
        <s-paragraph color="subdued">Each company’s pricing and order limits, applied together.</s-paragraph>
        <s-section padding="none">
          <s-table>
            <IndexFiltersBar
              slot="filters"
              query={search}
              queryPlaceholder="Search by contract or company"
              onQueryChange={setSearch}
              tabs={STATUS_TABS.map((t) => ({ id: `ag-${t.id}`, content: t.label }))}
              selected={Math.max(0, STATUS_TABS.findIndex((t) => t.id === status))}
              onSelect={(i) => setStatus(STATUS_TABS[i].id)}
            />
            <s-table-header-row>
              <s-table-header listSlot="primary">Contract</s-table-header>
              <s-table-header listSlot="labeled">Company</s-table-header>
              <s-table-header listSlot="labeled">Applies to</s-table-header>
              <s-table-header listSlot="labeled">Terms</s-table-header>
              <s-table-header listSlot="labeled">Version</s-table-header>
              <s-table-header listSlot="secondary">Status</s-table-header>
            </s-table-header-row>
            <s-table-body>{rows}</s-table-body>
          </s-table>
          {rows.length === 0 ? (
            <s-box padding="base">
              <div style={{ textAlign: 'center' }}>
                <s-text color="subdued">No contracts match these filters.</s-text>
              </div>
            </s-box>
          ) : null}
        </s-section>
      </s-stack>
      {picker}
    </s-page>
  );
}
