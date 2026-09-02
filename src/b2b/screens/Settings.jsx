import React, { useState } from 'react';
import { Page, Card, Text, BlockStack, InlineGrid, InlineStack, Badge, Select, Checkbox, Divider, Box } from '@shopify/polaris';
import { useStore } from '../store.jsx';
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

export function Settings() {
  const { state, dispatch } = useStore();
  const toast = (m) => dispatch({ type: 'TOAST', message: m });
  const [behaviors, setBehaviors] = useState({ approvedApp: 'standard', expiredPrice: 'shopify', acceptedQuote: 'order' });
  const setB = (k) => (v) => setBehaviors((p) => ({ ...p, [k]: v }));

  const connections = [
    { name: 'Shopify B2B', status: 'Connected', tone: 'success' },
    { name: 'QuoteSnap RFQ', status: 'Connected', tone: 'success' },
    { name: 'ERP import', status: 'Available', tone: undefined },
  ];

  return (
    <Page
      fullWidth
      title="Settings"
      primaryAction={{ content: 'Save', onAction: () => toast('Settings saved') }}
      secondaryActions={[{ content: 'Reset sample data', onAction: resetDemo }]}
    >
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingSm">
              What this app manages
            </Text>
            <Text as="p" tone="subdued">
              B2B pricing for {state.db.companies.length} linked companies and {state.db.policies.length} pricing rules. Prices resolve on the storefront when a buyer is signed into a company.
            </Text>
          </BlockStack>
        </Card>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">
                Connections
              </Text>
              {connections.map((c, i) => (
                <React.Fragment key={c.name}>
                  {i > 0 && <Divider />}
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodyMd">
                      {c.name}
                    </Text>
                    <Badge tone={c.tone}>{c.status}</Badge>
                  </InlineStack>
                </React.Fragment>
              ))}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">
                Store defaults
              </Text>
              <Select
                label="Default B2B pricing"
                helpText="Applies to every company that has no pricing of its own."
                options={[{ label: 'None', value: '' }, ...state.db.policies.filter((p) => p.audienceType === 'b2b' && p.priceKind !== 'quantity').map((p) => ({ label: p.name, value: p.id }))]}
                value={state.db.defaults?.b2bPolicyId || ''}
                onChange={(v) => dispatch({ type: 'SET_DEFAULT_POLICY', key: 'b2bPolicyId', value: v })}
              />
              <Select
                label="Default wholesale pricing"
                helpText="Applies to signed-in customers not attached to a company."
                options={[{ label: 'None', value: '' }, ...state.db.policies.filter((p) => p.audienceType === 'd2c').map((p) => ({ label: p.name, value: p.id }))]}
                value={state.db.defaults?.wholesalePolicyId || ''}
                onChange={(v) => dispatch({ type: 'SET_DEFAULT_POLICY', key: 'wholesalePolicyId', value: v })}
              />
            </BlockStack>
          </Card>
        </InlineGrid>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">Default behaviors</Text>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              <Select label="When a wholesale application is approved" options={APPROVED_APP} value={behaviors.approvedApp} onChange={setB('approvedApp')} />
              <Select label="When an assigned pricing expires" options={EXPIRED_PRICE} value={behaviors.expiredPrice} onChange={setB('expiredPrice')} />
              <Select label="When a quote is accepted" options={ACCEPTED_QUOTE} value={behaviors.acceptedQuote} onChange={setB('acceptedQuote')} />
            </InlineGrid>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingSm">Prototype</Text>
            <Checkbox
              label="Show the app with no data"
              helpText="Clears this app's own records (companies, pricing, customers) to preview the fresh-install empty states. Shopify's products and companies are untouched."
              checked={state.emptyMode}
              onChange={(v) => dispatch({ type: 'SET_EMPTY_MODE', on: v })}
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
