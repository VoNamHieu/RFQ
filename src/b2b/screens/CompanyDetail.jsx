import React, { useState } from 'react';
import { Page, Tabs, Card, BlockStack, InlineStack, Button, Text, Modal } from '@shopify/polaris';
import { useStore, currentCompany } from '../store.jsx';
import { companyBaseEntries, companyQuantityPolicy } from '../pricing.js';
import { BasePricingCard } from '../components/BasePricingCard.jsx';
import { QuantityPricingCard } from '../components/QuantityPricingCard.jsx';
import { QuotesTab } from '../components/tabs/QuotesTab.jsx';
import { OrdersTab } from '../components/tabs/OrdersTab.jsx';
import { LocationsTab } from '../components/tabs/LocationsTab.jsx';
import { ContactsTab } from '../components/tabs/ContactsTab.jsx';
import { Analytics } from './Analytics.jsx';
import { versionFlags } from '../../shared/versions.js';

const TABS = [
  { id: 'pricing', label: 'Pricing' },
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
    companyBaseEntries(company, state.db.policies).length + (companyQuantityPolicy(company, state.db.policies) ? 1 : 0);

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
      secondaryActions={[{ content: 'Delete', destructive: true, onAction: () => setConfirmDelete(true) }]}
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
        {state.companyTab === 'analytics' && (
          <BlockStack gap="300">
            <InlineStack align="end">
              <Button onClick={() => dispatch({ type: 'NAVIGATE', view: 'analytics' })}>View advanced analytics</Button>
            </InlineStack>
            <Analytics embeddedCompanyId={company.id} />
          </BlockStack>
        )}
      </BlockStack>

      {confirmDelete && (
        <Modal
          open
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${company.name}?`}
          primaryAction={{
            content: 'Delete company',
            destructive: true,
            onAction: () => {
              setConfirmDelete(false);
              dispatch({ type: 'DELETE_COMPANY', id: company.id });
            },
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmDelete(false) }]}
        >
          <Modal.Section>
            <Text as="p">
              This removes {company.name} from the B2B app — its {locationCount} location
              {locationCount === 1 ? '' : 's'}, {(company.contacts || []).length} contact
              {(company.contacts || []).length === 1 ? '' : 's'}
              {assignedCount ? `, and unassigns ${assignedCount} pricing profile${assignedCount === 1 ? '' : 's'}` : ''}. The
              Shopify company record is not affected.
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
