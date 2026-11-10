import React from 'react';
import { useStore } from '../store.jsx';
import { openAgreements, appliesAt } from '../agreements.js';
import { SummaryHoverCard, contractSummaryItems } from './SummaryHoverCard.jsx';
import { SideBlock, SideRow, BLOCK_HELP, backTo } from './companyLayout.jsx';

// A location's Contract block in the page's side column, laid out as its Pricing block: the Active contract here and
// the Scheduled ones set up to follow it (Active first), as chips. A chip opens the
// contract in its editor; ⊕ creates a new one for this location. The editor comes back
// here on save or cancel.
export function LocationContractCard({ company, location }) {
  const { state, dispatch } = useStore();
  const here = openAgreements(state.db, company.id).filter((a) => appliesAt(company, a, location.id));
  const returnTo = { view: 'location', selectedCompany: company.id, selectedLocation: location.id };
  const open = (a) => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', agreementId: a.id, returnTo });
  const create = () => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', companyId: company.id, locationIds: [location.id], returnTo });

  return (
    <SideBlock
      title="Contract"
      info={BLOCK_HELP.contract}
      actions={
        // A link to the Contracts list, as on the company page.
        <s-link
          onClick={() => dispatch({ type: 'NAVIGATE', view: 'agreements', patch: { agreementEditor: null, limitEditor: null, limitChooser: null, backTo: backTo(state, 'agreements', company, location) } })}
        >
          View all contracts
        </s-link>
      }
    >
      <SideRow>
        <s-stack direction="inline" gap="small-300" alignItems="center">
          {/* Hover shows its status and its Overview. */}
          {here.map((a) => (
            <SummaryHoverCard
              key={a.id}
              title={`${a.number} · ${a.name}`}
              status={a.status}
              items={() => contractSummaryItems(a, company, state.db)}
            >
              {/* As the Pricing chips: Active green; otherwise grey, with its status. */}
              <button
                type="button"
                className={`cd-chip cd-chip--${a.status === 'Active' ? 'success' : 'neutral'}`}
                onClick={() => open(a)}
              >
                {a.status === 'Active' ? a.number : `${a.number} · ${a.status}`}
              </button>
            </SummaryHoverCard>
          ))}
          <s-button icon="plus-circle" variant="tertiary" accessibilityLabel="Create contract" onClick={create} />
        </s-stack>
      </SideRow>
    </SideBlock>
  );
}
