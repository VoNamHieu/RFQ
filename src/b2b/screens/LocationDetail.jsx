import React from 'react';
import {
  Page,
  Card,
  Layout,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Box,
  Divider,
  IndexTable,
  Select,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { companyBaseEntries, companyQuantityPolicy } from '../pricing.js';

export function LocationDetail() {
  const { state, dispatch } = useStore();
  const company = state.db.companies.find((c) => c.id === state.selectedCompany);
  const location = company?.locations?.find((l) => l.id === state.selectedLocation);
  if (!company || !location) return null;

  const bases = companyBaseEntries(company, state.db.policies);
  const quantity = companyQuantityPolicy(company, state.db.policies);
  const buyers = (company.contacts || []).filter((c) => c.locations === location.name);
  const toast = (m) => dispatch({ type: 'TOAST', message: m });

  return (
    <Page
      backAction={{ content: 'Locations', onAction: () => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'locations' }) }}
      title={location.name}
      subtitle={`${company.name} · Location`}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Pricing
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  This location inherits the company’s pricing. Add an override to give it different prices.
                </Text>
                <Box borderColor="border" borderWidth="025" borderRadius="200">
                  <IndexTable
                    resourceName={{ singular: 'pricing', plural: 'pricings' }}
                    itemCount={bases.length + 1}
                    selectable={false}
                    headings={[{ title: 'Type' }, { title: 'Pricing' }, { title: 'Source' }]}
                  >
                    {bases.map((e, i) => (
                      <IndexTable.Row id={`base-${e.policy.id}`} key={e.policy.id} position={i}>
                        <IndexTable.Cell>{i === 0 ? 'Base' : ''}</IndexTable.Cell>
                        <IndexTable.Cell>{e.policy.name}</IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" tone="subdued" variant="bodySm">
                            Inherited from company
                          </Text>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                    <IndexTable.Row id="quantity" position={bases.length}>
                      <IndexTable.Cell>Quantity</IndexTable.Cell>
                      <IndexTable.Cell>{quantity ? quantity.name : <Badge tone="attention">Not set</Badge>}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span" tone="subdued" variant="bodySm">
                          {quantity ? 'Inherited from company' : '—'}
                        </Text>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  </IndexTable>
                </Box>
              </BlockStack>
            </Card>

            <Card padding="0">
              <Box padding="300" paddingBlockEnd="0">
                <Text as="h2" variant="headingSm">
                  Buyers
                </Text>
              </Box>
              <IndexTable
                resourceName={{ singular: 'buyer', plural: 'buyers' }}
                itemCount={buyers.length}
                selectable={false}
                headings={[{ title: 'Name' }, { title: 'Role' }, { title: 'How they buy' }]}
                emptyState={
                  <Box padding="400">
                    <Text as="p" alignment="center" tone="subdued">
                      No buyers at this location.
                    </Text>
                  </Box>
                }
              >
                {buyers.map((b, i) => (
                  <IndexTable.Row id={b.email || String(i)} key={b.email || i} position={i}>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="medium">
                          {b.name}
                        </Text>
                        <Text as="span" tone="subdued" variant="bodySm">
                          {b.email}
                        </Text>
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{b.role}</IndexTable.Cell>
                    <IndexTable.Cell>{b.access}</IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  General
                </Text>
                <Kv label="Name" value={location.name} />
                <Kv label="Location ID" value={location.id} />
                <Kv label="Status" value={<Badge tone="success">Active</Badge>} />
                <Kv label="Last order" value={location.lastOrder} />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Commerce
                </Text>
                <Select
                  label="Payment terms"
                  options={['Net 30', 'Net 60', 'Due on receipt', 'No payment terms'].map((t) => ({ label: t, value: t }))}
                  value={location.terms || 'Net 30'}
                  onChange={() => toast('Demo only')}
                />
                <Select
                  label="Order submission"
                  options={[
                    { label: 'Buys directly', value: 'Buys directly' },
                    { label: 'You approve first', value: 'You approve first' },
                  ]}
                  value={location.ordering || 'Buys directly'}
                  onChange={() => toast('Demo only')}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function Kv({ label, value }) {
  return (
    <InlineStack align="space-between" blockAlign="center">
      <Text as="span" tone="subdued" variant="bodySm">
        {label}
      </Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text as="span" variant="bodySm">
          {value || '—'}
        </Text>
      ) : (
        value
      )}
    </InlineStack>
  );
}
