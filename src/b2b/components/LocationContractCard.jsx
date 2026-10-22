import React from 'react';
import { useStore } from '../store.jsx';
import { activeAt, nextAt, agreementDatesLabel } from '../agreements.js';
import { wcTone } from '../../shared/wc.jsx';

const STATUS_TONE = { Active: 'success', Scheduled: 'info', Inactive: undefined };

// A location's contract: the Active contract here and the next one set up here (a
// company can have several contracts, but a location is in one Active contract and
// one next one). With no contract here, one can be created for this location.
export function LocationContractCard({ company, location }) {
  const { state, dispatch } = useStore();
  const active = activeAt(state.db, company, location.id);
  const next = nextAt(state.db, company, location.id);
  const here = [active, next].filter(Boolean);
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
          {!here.length ? <s-button onClick={create}>Create contract</s-button> : null}
        </s-grid>

        {here.map((a, i) => (
          <React.Fragment key={a.id}>
            {i > 0 && <s-divider />}
            <s-stack gap="small-400">
              <s-grid gridTemplateColumns="1fr auto" alignItems="start" gap="small-200">
                <div>
                  <s-link onClick={open}>{`${a.number} · ${a.name || 'Untitled contract'}`}</s-link>
                </div>
                <s-badge tone={wcTone(STATUS_TONE[a.status])}>{a.status}</s-badge>
              </s-grid>
              <s-paragraph fontSize="small" color="subdued">
                {a === next && active ? `Next contract · ${agreementDatesLabel(a)}` : agreementDatesLabel(a)}
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
