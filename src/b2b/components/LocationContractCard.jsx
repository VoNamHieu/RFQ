import React from 'react';
import { useStore } from '../store.jsx';
import { openAgreements, appliesAt, agreementDatesLabel, noTerms } from '../agreements.js';
import { wcTone } from '../../shared/wc.jsx';

const STATUS_TONE = { Active: 'success', Scheduled: 'info', Inactive: undefined };

// A location's contracts: the Active one here, the Scheduled ones set up to follow
// it and any drafts for it (Active first). A new one can always be created for this
// location — it just can't overlap the Active or Scheduled ones.
export function LocationContractCard({ company, location }) {
  const { state, dispatch } = useStore();
  const here = openAgreements(state.db, company.id).filter((a) => appliesAt(company, a, location.id));
  const open = () => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'agreement' });
  // The editor opens in Contracts and comes back here on save or cancel.
  const create = () =>
    dispatch({
      type: 'OPEN_AGREEMENT_EDITOR',
      companyId: company.id,
      locationIds: [location.id],
      returnTo: { view: 'location', selectedCompany: company.id, selectedLocation: location.id },
    });

  return (
    <s-section>
      <s-stack gap="small">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small-200">
          <s-heading>Contract</s-heading>
          <s-button onClick={create}>Create contract</s-button>
        </s-grid>

        {here.map((a, i) => (
          <React.Fragment key={a.id}>
            {i > 0 && <s-divider />}
            <s-stack gap="small-400">
              <s-grid gridTemplateColumns="1fr auto" alignItems="start" gap="small-200">
                <div>
                  <s-link onClick={open}>{`${a.number} · ${a.name || 'Untitled contract'}`}</s-link>
                </div>
                <s-stack direction="inline" gap="small-200">
                  <s-badge tone={wcTone(STATUS_TONE[a.status])}>{a.status}</s-badge>
                  {noTerms(a) ? <s-badge tone="warning">No terms</s-badge> : null}
                </s-stack>
              </s-grid>
              <s-paragraph fontSize="small" color="subdued">
                {agreementDatesLabel(a)}
              </s-paragraph>
            </s-stack>
          </React.Fragment>
        ))}

        {!here.length ? (
          <s-paragraph color="subdued" fontSize="small">
            No contract. Pricing and order limits here are assigned directly.
          </s-paragraph>
        ) : null}
      </s-stack>
    </s-section>
  );
}
