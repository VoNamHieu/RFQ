import React from 'react';
import { useStore } from '../store.jsx';
import { openAgreements, proposedAgreements, canCreateAgreement, proposalState, PROPOSAL_LABEL, statusLabel } from '../agreements.js';
import { SummaryHoverCard, contractSummaryItems } from './SummaryHoverCard.jsx';
import { SideBlock, SideRow, BLOCK_HELP, backTo } from './companyLayout.jsx';

// A company's Contract block in the page's side column: its Active contract, the
// Scheduled ones set up to follow it, then the ones sent to its buyers to approve
// (Proposed, with where their answer stands), as chips. A chip opens the contract in
// its editor, hovering shows its status and Overview; ⊕ creates a new one for the
// company. The editor comes back here on save or cancel.
export function CompanyContractCard({ company }) {
  const { state, dispatch } = useStore();
  const contracts = [...openAgreements(state.db, company.id), ...proposedAgreements(state.db, company.id)];
  const returnTo = { view: 'company', selectedCompany: company.id, companyTab: 'agreement' };
  const open = (a) => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', agreementId: a.id, returnTo });
  const create = () => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', companyId: company.id, returnTo });
  const label = (a) => (a.status === 'Active' ? a.number : a.status === 'Proposed' ? `${a.number} · ${PROPOSAL_LABEL[proposalState(a)]}` : `${a.number} · ${a.status}`);
  // Changes requested reads as its status (agreements.js statusLabel).

  return (
    <SideBlock
      title="Contract"
      info={BLOCK_HELP.contract}
      actions={
        // A link to the Contracts list.
        <s-link
          onClick={() => dispatch({ type: 'NAVIGATE', view: 'agreements', patch: { agreementEditor: null, limitEditor: null, limitChooser: null, backTo: backTo(state, 'agreements', company) } })}
        >
          View all contracts
        </s-link>
      }
    >
      <SideRow>
        <s-stack direction="inline" gap="small-300" alignItems="center">
          {contracts.map((a) => (
            <SummaryHoverCard
              key={a.id}
              title={`${a.number} · ${a.name}`}
              status={statusLabel(a)}
              items={() => contractSummaryItems(a, company, state.db)}
            >
              {/* As the Pricing chips: Active green; otherwise grey, with its status. */}
              <button
                type="button"
                className={`cd-chip cd-chip--${a.status === 'Active' ? 'success' : 'neutral'}`}
                onClick={() => open(a)}
              >
                {label(a)}
              </button>
            </SummaryHoverCard>
          ))}
          <s-button
            icon="plus-circle"
            variant="tertiary"
            accessibilityLabel="Create contract"
            disabled={!canCreateAgreement(state.db, company.id)}
            onClick={create}
          />
        </s-stack>
      </SideRow>
    </SideBlock>
  );
}
