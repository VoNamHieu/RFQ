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
  Popover,
  ActionList,
  Tooltip,
} from '@shopify/polaris';
import { EditIcon, XIcon, PlusIcon, XCircleIcon, ExchangeIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { locationPricingEntries, scopeLabel, policyStatus, hasOwnSlot } from '../pricing.js';
import { money } from '../format.js';

import { AssignBuyerModal, GeneralModal, ShippingModal, PAYMENT_TERM_OPTIONS, TAX_SETTINGS, COUNTRY_NAMES } from '../components/LocationModals.jsx';

const ORDER_TONE = {
  Fulfilled: 'success',
  Paid: 'success',
  'Needs review': 'warning',
  Cancelled: 'critical',
  'Draft order': 'info',
};
const orderTone = (s) => ORDER_TONE[s];
const QUOTE_TONE = { 'New Received': 'attention', Read: undefined, Updated: 'info', 'Deal Closed': 'success', 'Deal Rejected': 'critical' };
const PRICING_PAGE_SIZE = 5;
const HISTORY_PAGE_SIZE = 5;

export function LocationDetail() {
  const { state, dispatch } = useStore();
  const company = state.db.companies.find((c) => c.id === state.selectedCompany);
  const location = company?.locations?.find((l) => l.id === state.selectedLocation);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editGeneral, setEditGeneral] = useState(false);
  const [editShipping, setEditShipping] = useState(false);
  const [pricingPage, setPricingPage] = useState(0);
  const [quotesPage, setQuotesPage] = useState(0);
  const [ordersPage, setOrdersPage] = useState(0);
  const [addPricingOpen, setAddPricingOpen] = useState(false);
  if (!company || !location) return null;
  // Add / edit / change / remove pricing on this location (its own list of that
  // kind — see locationSlotArray), with the same row actions as the company page.
  // Edit of a pricing shared elsewhere offers a copy for here.
  const addPricing = (kind) => {
    setAddPricingOpen(false);
    dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, locationId: location.id, kind, mode: 'add' });
  };
  // Type cell: the label, plus "Use company pricing" when this location keeps its
  // own list of that kind (even an empty one) — dropping it follows the company again.
  const typeCell = (label, kind) => (
    <BlockStack gap="050">
      <Text as="span" variant="bodyMd">{label}</Text>
      {hasOwnSlot(location, kind) ? (
        <InlineStack>
          <Button
            variant="plain"
            size="micro"
            onClick={() => dispatch({ type: 'RESET_LOCATION_PRICING', companyId: company.id, locationId: location.id, kind })}
          >
            Use company pricing
          </Button>
        </InlineStack>
      ) : null}
    </BlockStack>
  );
  const pricingActions = (policy, kind) => (
    <InlineStack gap="100" align="end" blockAlign="center" wrap={false}>
      <Button
        icon={EditIcon}
        variant="tertiary"
        accessibilityLabel={`Edit ${policy.name}`}
        onClick={() => dispatch({ type: 'OPEN_EDITOR', policy, context: { mode: 'edit', companyId: company.id, locationId: location.id } })}
      />
      <Button
        icon={ExchangeIcon}
        variant="tertiary"
        accessibilityLabel={`Change ${policy.name}`}
        onClick={() => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, locationId: location.id, kind, mode: 'swap', swapId: policy.id })}
      />
      <Button
        icon={XCircleIcon}
        variant="tertiary"
        tone="critical"
        accessibilityLabel={`Remove ${policy.name}`}
        onClick={() => dispatch({ type: 'REMOVE_LOCATION_PRICING', companyId: company.id, locationId: location.id, kind, policyId: policy.id })}
      />
    </InlineStack>
  );

  const policies = state.db.policies;
  // Scheduled / Inactive ones listed too (with their status), so each can be edited or removed.
  const { bases, quantities } = locationPricingEntries(company, location, policies, { includeInactive: true });
  const buyers = (company.contacts || []).filter((c) => c.locations === location.name);
  const locOrders = (company.orders || [])
    .filter((o) => o.location === location.name)
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
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

  // Pricing rows: resolved base(s) + quantities — the location's own, else inherited from the company.
  const pricingRows = [];
  if (bases.length) {
    bases.forEach((e, i) => {
      pricingRows.push(
        <IndexTable.Row id={`base-${e.policy.id}`} key={`base-${e.policy.id}`} position={i}>
          <IndexTable.Cell>{i === 0 ? typeCell('Base pricing', 'base') : ''}</IndexTable.Cell>
          <IndexTable.Cell>
            <BlockStack gap="050">
              <Text as="span" variant="bodyMd">{e.policy.name}</Text>
              {e.source === 'COMPANY' ? (
                <Text as="span" tone="subdued" variant="bodySm">Inherited from {company.name}</Text>
              ) : null}
            </BlockStack>
          </IndexTable.Cell>
          <IndexTable.Cell>{scopeLabel(e.policy)}</IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={policyStatus(e.policy, state.db).tone}>{policyStatus(e.policy, state.db).label}</Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>{pricingActions(e.policy, 'base')}</IndexTable.Cell>
        </IndexTable.Row>,
      );
    });
  } else {
    pricingRows.push(
      <IndexTable.Row id="base-none" key="base-none" position={0}>
        <IndexTable.Cell>{typeCell('Base pricing', 'base')}</IndexTable.Cell>
        <IndexTable.Cell><Badge tone="warning">Not set</Badge></IndexTable.Cell>
        <IndexTable.Cell>—</IndexTable.Cell>
        <IndexTable.Cell>—</IndexTable.Cell>
        <IndexTable.Cell />
      </IndexTable.Row>,
    );
  }
  if (quantities.length) {
    quantities.forEach((e, i) => {
      pricingRows.push(
        <IndexTable.Row id={`quantity-${e.policy.id}`} key={`quantity-${e.policy.id}`} position={pricingRows.length}>
          <IndexTable.Cell>{i === 0 ? typeCell('Quantity pricing', 'quantity') : ''}</IndexTable.Cell>
          <IndexTable.Cell>
            <BlockStack gap="050">
              <Text as="span" variant="bodyMd">{e.policy.name}</Text>
              {e.source === 'COMPANY' ? (
                <Text as="span" tone="subdued" variant="bodySm">Inherited from {company.name}</Text>
              ) : null}
            </BlockStack>
          </IndexTable.Cell>
          <IndexTable.Cell>{scopeLabel(e.policy)}</IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={policyStatus(e.policy, state.db).tone}>{policyStatus(e.policy, state.db).label}</Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>{pricingActions(e.policy, 'quantity')}</IndexTable.Cell>
        </IndexTable.Row>,
      );
    });
  } else {
    pricingRows.push(
      <IndexTable.Row id="quantity-none" key="quantity-none" position={pricingRows.length}>
        <IndexTable.Cell>{typeCell('Quantity pricing', 'quantity')}</IndexTable.Cell>
        <IndexTable.Cell><Badge tone="warning">Not set</Badge></IndexTable.Cell>
        <IndexTable.Cell>—</IndexTable.Cell>
        <IndexTable.Cell>—</IndexTable.Cell>
        <IndexTable.Cell />
      </IndexTable.Row>,
    );
  }

  // Pricing table pagination.
  const pricingPageCount = Math.max(1, Math.ceil(pricingRows.length / PRICING_PAGE_SIZE));
  const pricingCurrent = Math.min(pricingPage, pricingPageCount - 1);
  const pricingStart = pricingCurrent * PRICING_PAGE_SIZE;
  const pagePricingRows = pricingRows.slice(pricingStart, pricingStart + PRICING_PAGE_SIZE);
  const pricingPageLabel = pricingRows.length
    ? `${pricingStart + 1}–${pricingStart + pagePricingRows.length} of ${pricingRows.length}`
    : '0 of 0';

  // Quotes table pagination.
  const quotesPageCount = Math.max(1, Math.ceil(locQuotes.length / HISTORY_PAGE_SIZE));
  const quotesCurrent = Math.min(quotesPage, quotesPageCount - 1);
  const quotesStart = quotesCurrent * HISTORY_PAGE_SIZE;
  const pageQuotes = locQuotes.slice(quotesStart, quotesStart + HISTORY_PAGE_SIZE);
  const quotesPageLabel = locQuotes.length
    ? `${quotesStart + 1}–${quotesStart + pageQuotes.length} of ${locQuotes.length}`
    : '0 of 0';

  // Order history pagination.
  const ordersPageCount = Math.max(1, Math.ceil(locOrders.length / HISTORY_PAGE_SIZE));
  const ordersCurrent = Math.min(ordersPage, ordersPageCount - 1);
  const ordersStart = ordersCurrent * HISTORY_PAGE_SIZE;
  const pageOrders = locOrders.slice(ordersStart, ordersStart + HISTORY_PAGE_SIZE);
  const ordersPageLabel = locOrders.length
    ? `${ordersStart + 1}–${ordersStart + pageOrders.length} of ${locOrders.length}`
    : '0 of 0';

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

            {/* Pricing */}
            <Card padding="0">
              <Box padding="300" paddingBlockEnd="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">Pricing</Text>
                  <Popover
                    active={addPricingOpen}
                    onClose={() => setAddPricingOpen(false)}
                    preferredAlignment="right"
                    activator={
                      <Button size="slim" icon={PlusIcon} disclosure onClick={() => setAddPricingOpen((v) => !v)}>
                        Add pricing
                      </Button>
                    }
                  >
                    <ActionList
                      actionRole="menuitem"
                      items={[
                        { content: 'Base pricing', onAction: () => addPricing('base') },
                        { content: 'Quantity pricing', onAction: () => addPricing('quantity') },
                      ]}
                    />
                  </Popover>
                </InlineStack>
              </Box>
              <IndexTable
                resourceName={{ singular: 'pricing', plural: 'pricings' }}
                itemCount={pagePricingRows.length}
                selectable={false}
                headings={[{ title: 'Type' }, { title: 'Pricing' }, { title: 'Products' }, { title: 'Status' }, { title: '', alignment: 'end' }]}
                pagination={{
                  hasNext: pricingCurrent < pricingPageCount - 1,
                  hasPrevious: pricingCurrent > 0,
                  onNext: () => setPricingPage((p) => Math.min(p + 1, pricingPageCount - 1)),
                  onPrevious: () => setPricingPage((p) => Math.max(p - 1, 0)),
                  label: pricingPageLabel,
                }}
              >
                {pagePricingRows}
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
                itemCount={pageQuotes.length}
                selectable={false}
                headings={[{ title: 'Quote' }, { title: 'Buyer' }, { title: 'Created' }, { title: 'Status' }]}
                pagination={{
                  hasNext: quotesCurrent < quotesPageCount - 1,
                  hasPrevious: quotesCurrent > 0,
                  onNext: () => setQuotesPage((p) => Math.min(p + 1, quotesPageCount - 1)),
                  onPrevious: () => setQuotesPage((p) => Math.max(p - 1, 0)),
                  label: quotesPageLabel,
                }}
                emptyState={
                  <Box padding="400">
                    <Text as="p" alignment="center" tone="subdued">No quotes from this location yet.</Text>
                  </Box>
                }
              >
                {pageQuotes.map((q, i) => (
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
                itemCount={pageOrders.length}
                selectable={false}
                headings={[{ title: 'Order' }, { title: 'Buyer' }, { title: 'Date' }, { title: 'Total', alignment: 'end' }, { title: 'Status' }]}
                pagination={{
                  hasNext: ordersCurrent < ordersPageCount - 1,
                  hasPrevious: ordersCurrent > 0,
                  onNext: () => setOrdersPage((p) => Math.min(p + 1, ordersPageCount - 1)),
                  onPrevious: () => setOrdersPage((p) => Math.max(p - 1, 0)),
                  label: ordersPageLabel,
                }}
                emptyState={
                  <Box padding="400">
                    <Text as="p" alignment="center" tone="subdued">No orders from this location yet.</Text>
                  </Box>
                }
              >
                {pageOrders.map((o, i) => (
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

            {/* Buyers — names only; the role shows on hover */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">Buyers{buyers.length ? ` (${buyers.length})` : ''}</Text>
                  <Button size="micro" onClick={() => setAssignOpen(true)}>Assign buyer</Button>
                </InlineStack>
                {buyers.length ? (
                  <BlockStack gap="100">
                    {buyers.map((b, i) => (
                      <InlineStack key={b.email || i} align="space-between" blockAlign="center" gap="200" wrap={false}>
                        <Tooltip content={b.role || 'Ordering only'}>
                          <Text as="span" variant="bodyMd">{b.name}</Text>
                        </Tooltip>
                        <Button
                          icon={XIcon}
                          variant="tertiary"
                          size="micro"
                          accessibilityLabel={`Remove ${b.name}`}
                          onClick={() => dispatch({ type: 'UNASSIGN_BUYER', companyId: company.id, locationId: location.id, email: b.email })}
                        />
                      </InlineStack>
                    ))}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued" variant="bodySm">No buyers assigned. Assign a buyer so someone can purchase under this location.</Text>
                )}
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
