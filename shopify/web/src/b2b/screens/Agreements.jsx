import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { canCreateAgreement, agreementAppliesToLabel, agreementTermCount, agreementDatesLabel, expiringSoon, daysUntil, PAST_STATUSES, proposalState, PROPOSAL_LABEL, statusLabel, canDeleteAgreement } from '../agreements.js';
import { AgreementEditor } from '../components/AgreementEditor.jsx';
import { ContractVersionModal } from '../components/ContractVersionModal.jsx';
import { EndContractModal, DeleteContractModal } from '../components/ContractParts.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { IndexFiltersBar, useWcId } from '../../shared/wc.jsx';
import { termsBack } from './ContractsAndLimits.jsx';
import { DevStrip } from '../../shared/DevStrip.jsx';
import { CdPageHead, StatusDot } from '../components/companyLayout.jsx';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'Active', label: 'Active' },
  { id: 'Scheduled', label: 'Scheduled' },
  { id: 'Proposed', label: 'Proposed' },
  { id: 'Expired', label: 'Expired' },
  { id: 'Ended', label: 'Ended' },
];
const STATUS_TONE = { Active: 'success', Scheduled: 'info', Proposed: 'attention', 'Changes requested': 'warning', 'Cancellation requested': 'warning', Expired: undefined, Ended: undefined };
// Prototype: show the dev toggles in production too (flip to import.meta.env.DEV to hide in prod).
const SHOW_DEV_TOOLS = true;

// Every company's agreement in one list. A row opens it in the editor, as a page here
// (OPEN_AGREEMENT_EDITOR) — a past one opens as it was, read-only. An Active one can
// be ended and a Scheduled or Proposed one deleted from its row; a Proposed one shows
// where its buyer's answer stands.
export function Agreements() {
  const { state, dispatch } = useStore();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);
  const [ending, setEnding] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [devEmpty, setDevEmpty] = useState(false); // dev-only: preview the empty state while contracts exist
  const rowId = useWcId('agreement');

  if (state.agreementEditor) return <AgreementEditor />;

  const realAll = state.db.agreements || [];
  const all = devEmpty ? [] : realAll;
  const companyOf = (id) => state.db.companies.find((c) => c.id === id);
  // Any company can get a new one (picked in the editor), overlapping its other
  // contracts or not.
  const free = state.db.companies.filter((c) => canCreateAgreement(state.db, c.id));
  const create = { content: 'Create contract', onAction: () => dispatch({ type: 'OPEN_AGREEMENT_EDITOR' }), disabled: !free.length };
  // A list of Orders & rules, in the company page's look: back (to Orders & rules, or the
  // company or location page it was opened from), the title and Create contract.
  const header = (
    <CdPageHead
      title="Contracts"
      subtitle="Each company’s pricing and order limits, applied together."
      back={termsBack(state, dispatch, 'agreements')}
      actions={
        <s-button variant="primary" disabled={create.disabled} onClick={create.onAction}>
          {create.content}
        </s-button>
      }
    />
  );
  const devTools = SHOW_DEV_TOOLS && (
    <DevTools disabled={!realAll.length} on={devEmpty} onToggle={() => setDevEmpty((v) => !v)} />
  );

  const q = search.trim().toLowerCase();
  const rows = all
    .filter((a) => (status === 'all' || a.status === status)
      && (!q || `${a.number} ${a.name} ${companyOf(a.companyId)?.name || ''}`.toLowerCase().includes(q)))
    .sort((a, b) => PAST_STATUSES.includes(a.status) - PAST_STATUSES.includes(b.status) || String(a.number).localeCompare(String(b.number)))
    .map((a) => {
      const company = companyOf(a.companyId);
      const linkId = `${rowId}-${a.id}`;
      // A past one opens as it was (read-only); any other in the editor.
      const open = () => (PAST_STATUSES.includes(a.status) ? setViewing(a) : dispatch({ type: 'OPEN_AGREEMENT_EDITOR', agreementId: a.id }));
      const days = expiringSoon(a, state.db) ? daysUntil(a.endDate) : null;
      return (
        // The row opens it; its number is the keyboard target (the click bubbles up).
        <tr key={a.id} className="cd-row-link" onClick={open}>
          <td>
            <button type="button" className="cd-link-button">
              {a.number}
            </button>
            <span className="cd-sub">{a.name || 'Untitled contract'}</span>
          </td>
          <td className="cd-nowrap">{company?.name || '—'}</td>
          <td>{company ? agreementAppliesToLabel(company, a) : '—'}</td>
          <td className="cd-nowrap">
            {agreementDatesLabel(a)}
            {days != null ? <span className="cd-sub cd-sub--caution">{days === 0 ? 'Ends today' : `Ends in ${days} day${days === 1 ? '' : 's'}`}</span> : null}
          </td>
          <td className="cd-num cd-nowrap">{agreementTermCount(state.db, a)}</td>
          <td className="cd-nowrap">{a.version ? `v${a.version}` : '—'}</td>
          <td>
            <StatusDot tone={STATUS_TONE[statusLabel(a)]}>{statusLabel(a)}</StatusDot>
            {/* Sent to the buyer: where their answer stands (Changes requested and
                Cancellation requested are its status). */}
            {proposalState(a) && proposalState(a) !== 'changes' && proposalState(a) !== 'cancel' ? <span className="cd-sub">{PROPOSAL_LABEL[proposalState(a)]}</span> : null}
          </td>
          <td className="cd-actions cd-num" onClick={(e) => e.stopPropagation()}>
            <span className="cd-row-actions">
              {a.status === 'Active' ? (
                <>
                  <s-button
                    icon="stop-circle"
                    variant="tertiary"
                    tone="critical"
                    accessibilityLabel={`End ${a.number}`}
                    interestFor={`${linkId}-end-tip`}
                    onClick={() => setEnding(a)}
                  />
                  <s-tooltip id={`${linkId}-end-tip`}>End contract</s-tooltip>
                </>
              ) : null}
              {canDeleteAgreement(a) ? (
                <>
                  <s-button
                    icon="delete"
                    variant="tertiary"
                    tone="critical"
                    accessibilityLabel={`Delete ${a.number}`}
                    interestFor={`${linkId}-delete-tip`}
                    onClick={() => setDeleting(a)}
                  />
                  <s-tooltip id={`${linkId}-delete-tip`}>Delete contract</s-tooltip>
                </>
              ) : null}
            </span>
          </td>
        </tr>
      );
    });

  if (!all.length) {
    return (
      <div className="cd-page">
        {header}
        {devTools}
        <div className="cd-card">
          <div className="cd-card__body">
            <EmptyBlock heading="Put each company’s terms in one contract" action={create.disabled ? undefined : create}>
              A contract holds a company’s pricing and order limits. Activating it applies them together, and every change is kept as a version.
            </EmptyBlock>
          </div>
        </div>
      </div>
    );
  }

  // The list in a bordered card: tabs and search on top, then a plain table.
  return (
    <div className="cd-page">
      {header}
      {devTools}
      <div className="cd-card">
        <div className="cd-card__filters">
          <IndexFiltersBar
            query={search}
            queryPlaceholder="Search by contract or company"
            onQueryChange={setSearch}
            tabs={STATUS_TABS.map((t) => ({ id: `ag-${t.id}`, content: t.label }))}
            selected={Math.max(0, STATUS_TABS.findIndex((t) => t.id === status))}
            onSelect={(i) => setStatus(STATUS_TABS[i].id)}
          />
        </div>
        {rows.length ? (
          <div className="cd-table-scroll">
            {/* Company, dates and terms on one line (each row stays two lines at most); the
                cells' sides a little tighter so they fit. */}
            <table className="cd-table cd-table--dense">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Company</th>
                  <th>Applies to</th>
                  <th>Dates</th>
                  <th className="cd-num">Terms</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th className="cd-actions">
                    <span className="cd-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        ) : (
          <div className="cd-card__empty">No contracts match these filters.</div>
        )}
      </div>
      {ending && <EndContractModal ag={ending} onClose={() => setEnding(null)} />}
      {deleting && <DeleteContractModal ag={deleting} onClose={() => setDeleting(null)} />}
      {viewing && (
        <ContractVersionModal
          ag={viewing}
          onClose={() => setViewing(null)}
          onDuplicate={(ag) => {
            setViewing(null);
            dispatch({ type: 'OPEN_AGREEMENT_EDITOR', duplicateOf: ag.id });
          }}
        />
      )}
    </div>
  );
}

// Dev-only strip (same pattern as Registrations): preview the Contracts empty state
// while contracts exist.
function DevTools({ disabled, on, onToggle }) {
  return (
    <DevStrip id="contracts" spaced>
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-badge tone="info">Dev</s-badge>
        <s-text fontSize="small" color="subdued">
          {disabled
            ? 'No contracts exist, so Contracts is showing its empty state.'
            : on
            ? 'Previewing the empty state — contracts actually exist.'
            : 'Preview the Contracts empty state.'}
        </s-text>
        <s-press-button pressed={on} disabled={disabled} onClick={onToggle}>
          {on ? 'Show data' : 'Preview empty state'}
        </s-press-button>
      </s-stack>
    </DevStrip>
  );
}
