import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { resetDemo } from '../../shared/persistence.js';
import { isContractTerm } from '../agreements.js';
import { CdPageHead, CdSection, StatusDot } from '../components/companyLayout.jsx';

const APPROVED_APP = [
  { label: 'Assign the standard wholesale pricing', value: 'standard' },
  { label: 'Approve with no price yet', value: 'noprice' },
  { label: 'Decline the application', value: 'decline' },
];
const EXPIRED_PRICE = [
  { label: 'Fall back to the Shopify price', value: 'shopify' },
  { label: 'Fall back to the next pricing', value: 'next' },
  { label: 'Block ordering until renewed', value: 'block' },
];
const ACCEPTED_QUOTE = [
  { label: 'Create a one-time order', value: 'order' },
  { label: 'Turn it into ongoing pricing', value: 'pricing' },
  { label: 'Ask each time', value: 'ask' },
];

// An s-option with value="" reports its label as its value, so "None" uses a
// sentinel that maps back to '' (no default pricing).
const NONE = '__none__';
const toOption = (v) => (v === '' ? NONE : v);
const fromOption = (v) => (v === NONE ? '' : v);

function Options({ options }) {
  return options.map((o) => (
    <s-option key={o.value} value={toOption(o.value)}>
      {o.label}
    </s-option>
  ));
}

export function Settings() {
  const { state, dispatch } = useStore();
  const toast = (m) => dispatch({ type: 'TOAST', message: m });
  const [behaviors, setBehaviors] = useState({ approvedApp: 'standard', expiredPrice: 'shopify', acceptedQuote: 'order' });
  const setB = (k) => (e) => {
    const v = e.currentTarget.value;
    setBehaviors((p) => ({ ...p, [k]: v }));
  };

  const connections = [
    { name: 'Shopify B2B', status: 'Connected', tone: 'success' },
    { name: 'QuoteSnap RFQ', status: 'Connected', tone: 'success' },
    { name: 'ERP import', status: 'Available', tone: undefined },
  ];

  // The company page's look: a white page, the title with Reset and Save, then sections
  // titled above bordered cards.
  return (
    <div className="cd-page">
      <CdPageHead
        title="Settings"
        actions={
          <>
            <s-button onClick={resetDemo}>Reset sample data</s-button>
            <s-button variant="primary" onClick={() => toast('Settings saved')}>
              Save
            </s-button>
          </>
        }
      />

      <div className="cd-stack">
        <CdSection title="What this app manages">
          <div className="cd-card">
            <div className="cd-card__body cd-muted">
              B2B pricing for {state.db.companies.length} linked companies and {state.db.policies.length} pricing rules. Prices resolve on the storefront when a buyer is signed into a company.
            </div>
          </div>
        </CdSection>

        <div className="cd-card-grid">
          <CdSection title="Connections">
            <div className="cd-card">
              {connections.map((c) => (
                <div key={c.name} className="cd-list-row">
                  <span>{c.name}</span>
                  <StatusDot tone={c.tone}>{c.status}</StatusDot>
                </div>
              ))}
            </div>
          </CdSection>

          <CdSection title="Store defaults">
            <div className="cd-card">
              <div className="cd-card__body">
                <s-stack gap="small">
                  <s-select
                    label="Default B2B pricing"
                    details="Applies to every company or location that has no pricing of its own."
                    value={toOption(state.db.defaults?.b2bPolicyId || '')}
                    onChange={(e) => dispatch({ type: 'SET_DEFAULT_POLICY', key: 'b2bPolicyId', value: fromOption(e.currentTarget.value) })}
                  >
                    <Options
                      options={[
                        { label: 'None', value: '' },
                        // Contract pricing is given only by its contracts.
                        ...state.db.policies.filter((p) => p.audienceType === 'b2b' && p.priceKind !== 'quantity' && !isContractTerm(p)).map((p) => ({ label: p.name, value: p.id })),
                      ]}
                    />
                  </s-select>
                  <s-select
                    label="Default wholesale pricing"
                    details="Applies to signed-in customers not attached to a company."
                    value={toOption(state.db.defaults?.wholesalePolicyId || '')}
                    onChange={(e) => dispatch({ type: 'SET_DEFAULT_POLICY', key: 'wholesalePolicyId', value: fromOption(e.currentTarget.value) })}
                  >
                    <Options
                      options={[{ label: 'None', value: '' }, ...state.db.policies.filter((p) => p.audienceType === 'd2c').map((p) => ({ label: p.name, value: p.id }))]}
                    />
                  </s-select>
                </s-stack>
              </div>
            </div>
          </CdSection>
        </div>

        <CdSection title="Default behaviors">
          <div className="cd-card">
            <div className="cd-card__body">
              <div className="cd-field-grid">
                <s-select label="When a wholesale application is approved" value={behaviors.approvedApp} onChange={setB('approvedApp')}>
                  <Options options={APPROVED_APP} />
                </s-select>
                <s-select label="When an assigned pricing expires" value={behaviors.expiredPrice} onChange={setB('expiredPrice')}>
                  <Options options={EXPIRED_PRICE} />
                </s-select>
                <s-select label="When a quote is accepted" value={behaviors.acceptedQuote} onChange={setB('acceptedQuote')}>
                  <Options options={ACCEPTED_QUOTE} />
                </s-select>
              </div>
            </div>
          </div>
        </CdSection>

        <CdSection title="Prototype">
          <div className="cd-card">
            <div className="cd-card__body">
              <s-checkbox
                label="Show the app with no data"
                details="Clears this app's own records (companies, pricing, customers) to preview the fresh-install empty states. Shopify's products and companies are untouched."
                checked={!!state.emptyMode}
                onChange={(e) => dispatch({ type: 'SET_EMPTY_MODE', on: e.currentTarget.checked })}
              />
            </div>
          </div>
        </CdSection>
      </div>
    </div>
  );
}
