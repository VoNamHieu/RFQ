import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/directory.js';
import { resetDemo } from '../../shared/persistence.js';

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
  const [newLocationCompany, setNewLocationCompany] = useState(shopifyCompanyDirectory[0]?.id || '');
  const setB = (k) => (e) => {
    const v = e.currentTarget.value;
    setBehaviors((p) => ({ ...p, [k]: v }));
  };

  const connections = [
    { name: 'Shopify B2B', status: 'Connected', tone: 'success' },
    { name: 'QuoteSnap RFQ', status: 'Connected', tone: 'success' },
    { name: 'ERP import', status: 'Available', tone: undefined },
  ];

  return (
    <s-page heading="Settings" inlineSize="large">
      <s-button slot="primary-action" variant="primary" onClick={() => toast('Settings saved')}>
        Save
      </s-button>
      <s-button slot="secondary-actions" onClick={resetDemo}>
        Reset sample data
      </s-button>

      <s-stack gap="base">
        <s-section heading="What this app manages">
          <s-paragraph color="subdued">
            B2B pricing for {state.db.companies.length} linked companies and {state.db.policies.length} pricing rules. Prices resolve on the storefront when a buyer is signed into a company.
          </s-paragraph>
        </s-section>

        <s-query-container>
          <s-grid gridTemplateColumns="@container (inline-size > 600px) 1fr 1fr, 1fr" gap="base">
            <s-section heading="Connections">
              <s-stack gap="small">
                {connections.map((c, i) => (
                  <React.Fragment key={c.name}>
                    {i > 0 && <s-divider />}
                    <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                      <s-text>{c.name}</s-text>
                      <s-badge tone={c.tone}>{c.status}</s-badge>
                    </s-stack>
                  </React.Fragment>
                ))}
              </s-stack>
            </s-section>

            <s-section heading="Store defaults">
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
                      ...state.db.policies.filter((p) => p.audienceType === 'b2b' && p.priceKind !== 'quantity').map((p) => ({ label: p.name, value: p.id })),
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
            </s-section>
          </s-grid>
        </s-query-container>

        <s-section heading="Default behaviors">
          <s-query-container>
            <s-grid gridTemplateColumns="@container (inline-size > 600px) 1fr 1fr 1fr, 1fr" gap="base">
              <s-select label="When a wholesale application is approved" value={behaviors.approvedApp} onChange={setB('approvedApp')}>
                <Options options={APPROVED_APP} />
              </s-select>
              <s-select label="When an assigned pricing expires" value={behaviors.expiredPrice} onChange={setB('expiredPrice')}>
                <Options options={EXPIRED_PRICE} />
              </s-select>
              <s-select label="When a quote is accepted" value={behaviors.acceptedQuote} onChange={setB('acceptedQuote')}>
                <Options options={ACCEPTED_QUOTE} />
              </s-select>
            </s-grid>
          </s-query-container>
        </s-section>

        <s-section heading="Prototype">
          <s-checkbox
            label="Show the app with no data"
            details="Clears this app's own records (companies, pricing, customers) to preview the fresh-install empty states. Shopify's products and companies are untouched."
            checked={!!state.emptyMode}
            onChange={(e) => dispatch({ type: 'SET_EMPTY_MODE', on: e.currentTarget.checked })}
          />
          <s-box paddingBlock="small">
            <s-divider />
          </s-box>
          {/* Stands in for a merchant adding a location to a company in Shopify admin. */}
          <s-stack gap="small-200">
            <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="end">
              <s-select
                label="Add a location to a company in Shopify"
                value={newLocationCompany}
                onChange={(e) => setNewLocationCompany(e.currentTarget.value)}
              >
                {shopifyCompanyDirectory.map((c) => (
                  <s-option key={c.id} value={c.id}>
                    {c.name}
                  </s-option>
                ))}
              </s-select>
              <s-button onClick={() => dispatch({ type: 'SHOPIFY_LOCATION_CREATED', shopifyId: newLocationCompany })}>
                Add in Shopify
              </s-button>
            </s-grid>
            <s-paragraph color="subdued" fontSize="small">
              A company with "Automatically add new locations" on gets the new location right away. Otherwise it waits in Add company.
            </s-paragraph>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
