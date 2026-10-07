import React, { useState } from 'react';
import { useStore, currentCompany } from '../store.jsx';
import { companyBaseEntries, companyQuantityEntries } from '../pricing.js';
import { BasePricingCard } from '../components/BasePricingCard.jsx';
import { QuantityPricingCard } from '../components/QuantityPricingCard.jsx';
import { QuotesTab } from '../components/tabs/QuotesTab.jsx';
import { OrdersTab } from '../components/tabs/OrdersTab.jsx';
import { LocationsTab } from '../components/tabs/LocationsTab.jsx';
import { ContactsTab } from '../components/tabs/ContactsTab.jsx';
import { AgreementTab } from '../components/tabs/AgreementTab.jsx';
import { CompanyAnalytics } from '../components/CompanyAnalytics.jsx';
import { versionFlags } from '../../shared/versions.js';
import { Tabs, Modal, PageHeader } from '../../shared/wc.jsx';

const TABS = [
  { id: 'pricing', label: 'Pricing' },
  ...(versionFlags().agreements ? [{ id: 'agreement', label: 'Agreement' }] : []),
  ...(versionFlags().analytics ? [{ id: 'analytics', label: 'Analytics' }] : []),
  { id: 'quotes', label: 'Quotes' },
  { id: 'orders', label: 'Orders' },
  { id: 'locations', label: 'Locations' },
  { id: 'contacts', label: 'Contacts' },
];

export function CompanyDetail() {
  const { state, dispatch } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const company = currentCompany(state);
  if (!company) return null;

  const assignedCount =
    companyBaseEntries(company, state.db.policies).length + companyQuantityEntries(company, state.db.policies).length;

  const tabIndex = Math.max(0, TABS.findIndex((t) => t.id === state.companyTab));
  const tabs = TABS.map((t) => {
    let content = t.label;
    if (t.id === 'quotes') {
      const n = (state.db.quotes || []).filter((q) => q.company === company.id).length;
      content = `Quotes${n ? ` (${n})` : ''}`;
    }
    if (t.id === 'orders') {
      const n = (company.orders || []).length;
      content = `Orders${n ? ` (${n})` : ''}`;
    }
    return { id: t.id, content };
  });

  const locationCount = (company.locations || []).length;

  return (
    <>
    <PageHeader
      heading={company.name}
      backAction={{ content: 'Companies', onAction: () => dispatch({ type: 'NAVIGATE', view: 'customers' }) }}
      subtitle={`${company.source ? `From ${company.source}` : 'Active'} · ${locationCount} location${locationCount === 1 ? '' : 's'}`}
      secondaryActions={[{ content: 'Delete', destructive: true, onAction: () => setConfirmDelete(true) }]}
    />
    <s-page>
      <s-stack gap="base">
        <s-section padding="none">
          <Tabs tabs={tabs} selected={tabIndex} onSelect={(i) => dispatch({ type: 'SET_COMPANY_TAB', tab: TABS[i].id })} />
        </s-section>

        {state.companyTab === 'pricing' && (
          <>
            <BasePricingCard company={company} />
            <QuantityPricingCard company={company} />
          </>
        )}
        {state.companyTab === 'agreement' && <AgreementTab company={company} />}
        {state.companyTab === 'quotes' && <QuotesTab company={company} />}
        {state.companyTab === 'orders' && <OrdersTab company={company} />}
        {state.companyTab === 'locations' && <LocationsTab company={company} />}
        {state.companyTab === 'contacts' && <ContactsTab company={company} />}
        {state.companyTab === 'analytics' && (
          <s-stack gap="small">
            <s-stack direction="inline" justifyContent="end">
              <s-button onClick={() => dispatch({ type: 'NAVIGATE', view: 'analytics' })}>Compare with all companies</s-button>
            </s-stack>
            <CompanyAnalytics company={company} />
          </s-stack>
        )}
      </s-stack>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} heading={`Delete ${company.name}?`}>
          <s-paragraph>
            This removes {company.name} from the B2B app — its {locationCount} location
            {locationCount === 1 ? '' : 's'}, {(company.contacts || []).length} contact
            {(company.contacts || []).length === 1 ? '' : 's'}
            {assignedCount ? `, and unassigns ${assignedCount} pricing profile${assignedCount === 1 ? '' : 's'}` : ''}. The
            Shopify company record is not affected.
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              setConfirmDelete(false);
              dispatch({ type: 'DELETE_COMPANY', id: company.id });
            }}
          >
            Delete company
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmDelete(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-page>
    </>
  );
}
