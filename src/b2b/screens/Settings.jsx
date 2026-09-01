import React from 'react';
import { Page, Card, Text, BlockStack, InlineGrid, InlineStack, Badge, Select, Divider, Box } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { resetDemo } from '../../shared/persistence.js';

export function Settings() {
  const { state, dispatch } = useStore();
  const toast = (m) => dispatch({ type: 'TOAST', message: m });

  const connections = [
    { name: 'Shopify B2B', status: 'Connected', tone: 'success' },
    { name: 'QuoteSnap RFQ', status: 'Connected', tone: 'success' },
    { name: 'ERP import', status: 'Available', tone: undefined },
  ];

  return (
    <Page
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
      </BlockStack>
    </Page>
  );
}
