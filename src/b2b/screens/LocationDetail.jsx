import React, { useState } from 'react';
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
  Button,
  ButtonGroup,
  Checkbox,
  TextField,
  Modal,
} from '@shopify/polaris';
import { EditIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { locationPricingEntries, scopeLabel, policyStatus } from '../pricing.js';
import { money } from '../format.js';

import { AssignBuyerModal, GeneralModal, ShippingModal, PAYMENT_TERM_OPTIONS, TAX_SETTINGS, COUNTRY_NAMES } from '../components/LocationModals.jsx';
import { PricePreviewModal } from '../components/PricePreviewModal.jsx';

const ORDER_TONE = {
  Fulfilled: 'success',
  Paid: 'success',
  'Needs review': 'warning',
  Cancelled: 'critical',
  'Draft order': 'info',
};
const orderTone = (s) => ORDER_TONE[s];
const QUOTE_TONE = { 'New Received': 'attention', Read: undefined, Updated: 'info', 'Deal Closed': 'success', 'Deal Rejected': 'critical' };

export function LocationDetail() {
  const { state, dispatch } = useStore();
  const company = state.db.companies.find((c) => c.id === state.selectedCompany);
  const location = company?.locations?.find((l) => l.id === state.selectedLocation);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editGeneral, setEditGeneral] = useState(false);
  const [editShipping, setEditShipping] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  if (!company || !location) return null;

  const policies = state.db.policies;
  const { bases, quantity } = locationPricingEntries(company, location, policies);
  const buyers = (company.contacts || []).filter((c) => c.locations === location.name);
  const locOrders = (company.orders || [])
    .filter((o) => o.location === location.name)
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const recentOrders = locOrders.slice(0, 5);
  const totalSales = locOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const locQuotes = (state.db.quotes || [])
    .filter((q) => q.company === company.id && q.location === location.name)
    .slice()
    .sort((a, b) => String(b.created).localeCompare(String(a.created)));

  const setField = (patch, silent) =>
    dispatch({ type: 'SET_LOCATION_FIELD', companyId: company.id, locationId: location.id, patch, silent });

  const ship = location.shipping || {};
  const shipName = [ship.firstName, ship.lastName].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
  const shipParts = [shipName, ship.company, ship.address1, ship.address2, ship.city, ship.postal]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  const shipPreview = shipParts.length ? [...shipParts, COUNTRY_NAMES[ship.country] || ''].filter(Boolean) : [];

  // Pricing rows: resolved base(s) + quantity — read-only (inherited from company).
  const pricingRows = [];
  if (bases.length) {
    bases.forEach((e, i) => {
      pricingRows.push(
        <IndexTable.Row id={`base-${e.policy.id}`} key={`base-${e.policy.id}`} position={i}>
          <IndexTable.Cell>{i === 0 ? 'Base pricing' : ''}</IndexTable.Cell>
          <IndexTable.Cell>
            <BlockStack gap="050">
              <Text as="span" variant="bodyMd">{e.policy.name}</Text>
              {e.source === 'LOCATION' ? (
                <Badge tone="info" size="small">Location override</Badge>
              ) : (
                <Text as="span" tone="subdued" variant="bodySm">Inherited from {company.name}</Text>
              )}
            </BlockStack>
          </IndexTable.Cell>
          <IndexTable.Cell>{scopeLabel(e.policy)}</IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={policyStatus(e.policy, state.db).tone}>{policyStatus(e.policy, state.db).label}</Badge>
          </IndexTable.Cell>
        </IndexTable.Row>,
      );
    });
  } else {
    pricingRows.push(
      <IndexTable.Row id="base-none" key="base-none" position={0}>
        <IndexTable.Cell>Base pricing</IndexTable.Cell>
        <IndexTable.Cell><Badge tone="warning">Not set</Badge></IndexTable.Cell>
        <IndexTable.Cell>—</IndexTable.Cell>
        <IndexTable.Cell>—</IndexTable.Cell>
      </IndexTable.Row>,
    );
  }
  pricingRows.push(
    <IndexTable.Row id="quantity" key="quantity" position={pricingRows.length}>
      <IndexTable.Cell>Quantity pricing</IndexTable.Cell>
      <IndexTable.Cell>
        {quantity ? (
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd">{quantity.policy.name}</Text>
            {quantity.source === 'LOCATION' ? (
              <Badge tone="info" size="small">Location override</Badge>
            ) : (
              <Text as="span" tone="subdued" variant="bodySm">Inherited from {company.name}</Text>
            )}
          </BlockStack>
        ) : (
          <Badge tone="warning">Not set</Badge>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>{quantity ? scopeLabel(quantity.policy) : '—'}</IndexTable.Cell>
      <IndexTable.Cell>{quantity ? <Badge tone={policyStatus(quantity.policy, state.db).tone}>{policyStatus(quantity.policy, state.db).label}</Badge> : '—'}</IndexTable.Cell>
    </IndexTable.Row>,
  );

  return (
    <Page
      fullWidth
      backAction={{ content: 'Locations', onAction: () => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'locations' }) }}
      title={location.name}
      subtitle={`${company.name} · Location`}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Overview */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">Location overview</Text>
                <InlineStack gap="400" wrap>
                  <Stat label="Sales" value={money(totalSales)} note="All-time from this location" />
                  <Stat label="Orders" value={String(locOrders.length)} note="Placed by its buyers" />
                  <Stat label="Quotes" value={String(locQuotes.length)} note="RFQ requests from here" />
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Buyers */}
            <Card padding="0">
              <Box padding="300" paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">Buyers{buyers.length ? ` (${buyers.length})` : ''}</Text>
                  <Button variant="primary" size="slim" onClick={() => setAssignOpen(true)}>Assign buyer</Button>
                </InlineStack>
              </Box>
              <IndexTable
                resourceName={{ singular: 'buyer', plural: 'buyers' }}
                itemCount={buyers.length}
                selectable={false}
                headings={[{ title: 'Name' }, { title: 'Role' }, { title: '' }]}
                emptyState={
                  <Box padding="400">
                    <Text as="p" alignment="center" tone="subdued">No buyers assigned. Assign a buyer so someone can purchase under this location.</Text>
                  </Box>
                }
              >
                {buyers.map((b, i) => (
                  <IndexTable.Row id={b.email || String(i)} key={b.email || i} position={i}>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="medium">{b.name}</Text>
                        <Text as="span" tone="subdued" variant="bodySm">{b.email}</Text>
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{b.role || 'Ordering only'}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Button size="micro" onClick={() => dispatch({ type: 'UNASSIGN_BUYER', companyId: company.id, locationId: location.id, email: b.email })}>Remove</Button>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </Card>

            {/* Pricing */}
            <Card padding="0">
              <Box padding="300" paddingBlockEnd="0">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">Pricing</Text>
                  <Button size="slim" onClick={() => setPreviewOpen(true)}>Preview price</Button>
                </InlineStack>
              </Box>
              <IndexTable
                resourceName={{ singular: 'pricing', plural: 'pricings' }}
                itemCount={pricingRows.length}
                selectable={false}
                headings={[{ title: 'Type' }, { title: 'Pricing' }, { title: 'Products' }, { title: 'Status' }]}
              >
                {pricingRows}
              </IndexTable>
            </Card>

            {/* Quotes from this location */}
            <Card padding="0">
              <Box padding="300" paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">Quotes{locQuotes.length ? ` (${locQuotes.length})` : ''}</Text>
                  <Button size="slim" onClick={() => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'quotes' })}>View all company quotes</Button>
                </InlineStack>
              </Box>
              <IndexTable
                resourceName={{ singular: 'quote', plural: 'quotes' }}
                itemCount={locQuotes.length}
                selectable={false}
                headings={[{ title: 'Quote' }, { title: 'Buyer' }, { title: 'Created' }, { title: 'Status' }]}
                emptyState={
                  <Box padding="400">
                    <Text as="p" alignment="center" tone="subdued">No quotes from this location yet.</Text>
                  </Box>
                }
              >
                {locQuotes.map((q, i) => (
                  <IndexTable.Row id={q.id} key={q.id} position={i} onClick={() => dispatch({ type: 'OPEN_QUOTE', id: q.id })}>
                    <IndexTable.Cell><Text as="span" variant="bodyMd" fontWeight="medium">{q.id}</Text></IndexTable.Cell>
                    <IndexTable.Cell>{q.buyer}</IndexTable.Cell>
                    <IndexTable.Cell>{q.created}</IndexTable.Cell>
                    <IndexTable.Cell><Badge tone={QUOTE_TONE[q.status]}>{q.status}</Badge></IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </Card>

            {/* Order history */}
            <Card padding="0">
              <Box padding="300" paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">Order history{locOrders.length ? ` (${locOrders.length})` : ''}</Text>
                  <Button size="slim" onClick={() => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'orders' })}>View all company orders</Button>
                </InlineStack>
              </Box>
              <IndexTable
                resourceName={{ singular: 'order', plural: 'orders' }}
                itemCount={recentOrders.length}
                selectable={false}
                headings={[{ title: 'Order' }, { title: 'Buyer' }, { title: 'Date' }, { title: 'Total', alignment: 'end' }, { title: 'Status' }]}
                emptyState={
                  <Box padding="400">
                    <Text as="p" alignment="center" tone="subdued">No orders from this location yet.</Text>
                  </Box>
                }
              >
                {recentOrders.map((o, i) => (
                  <IndexTable.Row id={o.id} key={o.id} position={i}>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="medium">{o.id}</Text>
                        {o.po && o.po !== 'None' ? <Text as="span" tone="subdued" variant="bodySm">{o.po}</Text> : null}
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{o.buyer}</IndexTable.Cell>
                    <IndexTable.Cell>{o.date}</IndexTable.Cell>
                    <IndexTable.Cell><Text as="span" alignment="end">{money(o.amount)}</Text></IndexTable.Cell>
                    <IndexTable.Cell><Badge tone={orderTone(o.status)}>{o.status}</Badge></IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
              {locOrders.length > recentOrders.length && (
                <Box padding="300" borderBlockStartWidth="025" borderColor="border">
                  <Text as="span" tone="subdued" variant="bodySm">Showing the {recentOrders.length} most recent — View all company orders for the rest.</Text>
                </Box>
              )}
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Location details: general + shipping */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">General</Text>
                  <Button size="micro" icon={EditIcon} onClick={() => setEditGeneral(true)} accessibilityLabel="Edit general" />
                </InlineStack>
                <Kv label="Name" value={location.name} />
                <Kv label="Location ID" value={location.externalId || 'Not set'} />
                <Kv label="Status" value={<Badge tone="success">{location.status || 'Active'}</Badge>} />
                <Divider />
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">Shipping address</Text>
                  <Button size="micro" onClick={() => setEditShipping(true)}>{shipPreview.length ? 'Edit' : 'Add'}</Button>
                </InlineStack>
                {shipPreview.length ? (
                  <BlockStack gap="0">
                    {shipPreview.map((line, i) => (
                      <Text as="span" key={i} variant="bodySm">{line}</Text>
                    ))}
                  </BlockStack>
                ) : (
                  <Text as="span" tone="subdued" variant="bodySm">No shipping address provided.</Text>
                )}
                <Text as="span" tone="subdued" variant="bodySm">
                  {location.billingSameAsShipping ? 'Billing address is same as shipping.' : 'Billing address is set separately.'}
                </Text>
              </BlockStack>
            </Card>

            {/* Commerce settings — live */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">Commerce settings</Text>
                <Select
                  label="Payment terms"
                  options={PAYMENT_TERM_OPTIONS.map((t) => ({ label: t, value: t }))}
                  value={location.paymentTerms || 'No payment terms'}
                  onChange={(v) => setField({ paymentTerms: v }, true)}
                />
                <Select
                  label="Order submission"
                  options={[
                    { label: 'Automatically submit orders', value: 'DIRECT' },
                    { label: 'Submit all orders as drafts for review', value: 'REQUIRE_APPROVAL' },
                  ]}
                  value={location.purchasingMode || 'DIRECT'}
                  onChange={(v) => setField({ purchasingMode: v }, true)}
                />
                <Checkbox
                  label="Allow any one-time address"
                  checked={!!location.editableShipping}
                  onChange={(v) => setField({ editableShipping: v }, true)}
                />
                <Divider />
                <TextField
                  label="Tax ID"
                  value={location.taxId || ''}
                  onChange={(v) => setField({ taxId: v }, true)}
                  placeholder="Tax / VAT ID"
                  autoComplete="off"
                />
                <Select
                  label="Tax settings"
                  options={TAX_SETTINGS}
                  value={location.taxSettings || 'collect'}
                  onChange={(v) => setField({ taxSettings: v }, true)}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {assignOpen && (
        <AssignBuyerModal company={company} location={location} onClose={() => setAssignOpen(false)} />
      )}
      {editGeneral && (
        <GeneralModal location={location} onClose={() => setEditGeneral(false)} onSave={(patch) => { setField(patch); setEditGeneral(false); }} />
      )}
      {editShipping && (
        <ShippingModal location={location} onClose={() => setEditShipping(false)} onSave={(patch) => { setField(patch); setEditShipping(false); }} />
      )}
      {previewOpen && (
        <PricePreviewModal company={company} location={location} db={state.db} onClose={() => setPreviewOpen(false)} />
      )}
    </Page>
  );
}

function Stat({ label, value, note }) {
  return (
    <Box minWidth="140px">
      <BlockStack gap="050">
        <Text as="span" tone="subdued" variant="bodySm">{label}</Text>
        <Text as="span" variant="headingLg">{value}</Text>
        <Text as="span" tone="subdued" variant="bodyXs">{note}</Text>
      </BlockStack>
    </Box>
  );
}

function Kv({ label, value }) {
  return (
    <InlineStack align="space-between" blockAlign="center">
      <Text as="span" tone="subdued" variant="bodySm">{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text as="span" variant="bodySm">{value || '—'}</Text>
      ) : (
        value
      )}
    </InlineStack>
  );
}
