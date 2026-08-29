import React from 'react';
import { Page, Tabs, Card, BlockStack, Text, Box } from '@shopify/polaris';
import { useStore, currentCompany } from '../store.jsx';
import { BasePricingCard } from '../components/BasePricingCard.jsx';
import { QuantityPricingCard } from '../components/QuantityPricingCard.jsx';
import { QuotesTab } from '../components/tabs/QuotesTab.jsx';
import { OrdersTab } from '../components/tabs/OrdersTab.jsx';
import { LocationsTab } from '../components/tabs/LocationsTab.jsx';
import { ContactsTab } from '../components/tabs/ContactsTab.jsx';
import { versionFlags } from '../../shared/versions.js';

const TABS = [
  { id: 'pricing', label: 'Pricing' },
  ...(versionFlags().analytics ? [{ id: 'analytics', label: 'Analytics' }] : []),
  { id: 'quotes', label: 'Quotes' },
  { id: 'orders', label: 'Orders' },
  { id: 'locations', label: 'Locations' },
  { id: 'contacts', label: 'Contacts' },
];

function Placeholder({ label }) {
  return (
    <Card>
      <Box padding="400">
        <Text as="p" tone="subdued" alignment="center">
          {label} tab — migrating next.
        </Text>
      </Box>
    </Card>
  );
}

export function CompanyDetail() {
  const { state, dispatch } = useStore();
  const company = currentCompany(state);
  if (!company) return null;

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
    <Page
      backAction={{ content: 'Companies', onAction: () => dispatch({ type: 'NAVIGATE', view: 'customers' }) }}
      title={company.name}
      subtitle={`${company.source ? `From ${company.source}` : 'Active'} · ${locationCount} location${locationCount === 1 ? '' : 's'}`}
      secondaryActions={[{ content: 'Delete', destructive: true, onAction: () => dispatch({ type: 'TOAST', message: 'Demo only' }) }]}
    >
      <BlockStack gap="400">
        <Card padding="0">
          <Tabs
            tabs={tabs}
            selected={tabIndex}
            onSelect={(i) => dispatch({ type: 'SET_COMPANY_TAB', tab: TABS[i].id })}
          />
        </Card>

        {state.companyTab === 'pricing' && (
          <>
            <BasePricingCard company={company} />
            <QuantityPricingCard company={company} />
          </>
        )}
        {state.companyTab === 'quotes' && <QuotesTab company={company} />}
        {state.companyTab === 'orders' && <OrdersTab company={company} />}
        {state.companyTab === 'locations' && <LocationsTab company={company} />}
        {state.companyTab === 'contacts' && <ContactsTab company={company} />}
        {state.companyTab === 'analytics' && <Placeholder label="Analytics" />}
      </BlockStack>
    </Page>
  );
}
