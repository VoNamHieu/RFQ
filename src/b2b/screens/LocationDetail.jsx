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
  Tooltip,
} from '@shopify/polaris';
import { EditIcon, RefreshIcon, DeleteIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { locationPricingEntries, scopeLabel, policyStatus } from '../pricing.js';
import { versionFlags } from '../../shared/versions.js';
import { money } from '../format.js';

const PAYMENT_TERM_OPTIONS = ['No payment terms', 'Due immediately', 'Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'];
const TAX_SETTINGS = [
  { value: 'collect', label: 'Collect tax' },
  { value: 'collect_unless_exempt', label: 'Collect tax unless exemptions apply' },
  { value: 'exempt', label: 'Do not collect tax' },
];
const COUNTRY_NAMES = { VN: 'Vietnam', US: 'United States', GB: 'United Kingdom', SG: 'Singapore', AU: 'Australia' };
const ROLE_OPTIONS = ['Ordering only', 'Location admin'];

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
  const [override, setOverride] = useState(null); // { kind } — location pricing override modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [editGeneral, setEditGeneral] = useState(false);
  const [editShipping, setEditShipping] = useState(false);
  if (!company || !location) return null;

  const policies = state.db.policies;
  const canOverride = versionFlags().locationPricing; // v4 downgrades to read-only inherited
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

  // Pricing rows: resolved base(s) + quantity, with per-row edit / override / revert.
  const editPolicy = (policy) =>
    dispatch({ type: 'OPEN_EDITOR', policy, context: { mode: 'edit', companyId: company.id, locationId: location.id } });

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
          <IndexTable.Cell>
            <RowActions
              onEdit={() => editPolicy(e.policy)}
              onOverride={i === 0 && canOverride ? () => setOverride({ kind: 'base' }) : null}
              onRevert={i === 0 && canOverride && e.source === 'LOCATION' ? () => dispatch({ type: 'SET_LOCATION_PRICING', companyId: company.id, locationId: location.id, kind: 'base', policyId: null }) : null}
            />
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
        <IndexTable.Cell>{canOverride ? <Button size="micro" onClick={() => setOverride({ kind: 'base' })}>Assign</Button> : null}</IndexTable.Cell>
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
      <IndexTable.Cell>
        {quantity ? (
          <RowActions
            onEdit={() => editPolicy(quantity.policy)}
            onOverride={canOverride ? () => setOverride({ kind: 'quantity' }) : null}
            onRevert={canOverride && quantity.source === 'LOCATION' ? () => dispatch({ type: 'SET_LOCATION_PRICING', companyId: company.id, locationId: location.id, kind: 'quantity', policyId: null }) : null}
          />
        ) : canOverride ? (
          <Button size="micro" onClick={() => setOverride({ kind: 'quantity' })}>Assign</Button>
        ) : (
          <Text as="span" tone="subdued" variant="bodySm">Inherited</Text>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>,
  );

  return (
    <Page
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
                  <Text as="span" tone="subdued" variant="bodySm">Assign per type on the row</Text>
                </InlineStack>
              </Box>
              <IndexTable
                resourceName={{ singular: 'pricing', plural: 'pricings' }}
                itemCount={pricingRows.length}
                selectable={false}
                headings={[{ title: 'Type' }, { title: 'Pricing' }, { title: 'Products' }, { title: 'Status' }, { title: '' }]}
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

      {override && (
        <OverrideModal
          company={company}
          location={location}
          kind={override.kind}
          onClose={() => setOverride(null)}
        />
      )}
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

function RowActions({ onEdit, onOverride, onRevert }) {
  return (
    <InlineStack gap="100" wrap={false}>
      <Tooltip content="Edit pricing"><Button size="micro" icon={EditIcon} onClick={onEdit} accessibilityLabel="Edit pricing" /></Tooltip>
      {onOverride && <Tooltip content="Override for this location"><Button size="micro" icon={RefreshIcon} onClick={onOverride} accessibilityLabel="Override for this location" /></Tooltip>}
      {onRevert && <Tooltip content="Remove location override"><Button size="micro" tone="critical" icon={DeleteIcon} onClick={onRevert} accessibilityLabel="Remove location override" /></Tooltip>}
    </InlineStack>
  );
}

function OverrideModal({ company, location, kind, onClose }) {
  const { state, dispatch } = useStore();
  const current = (location.pricing || {})[kind] || '';
  const [sel, setSel] = useState(current);
  const options = [
    { label: 'Use company pricing (inherit)', value: '' },
    ...state.db.policies
      .filter((p) => (kind === 'base' ? p.priceKind !== 'quantity' : p.priceKind === 'quantity') && p.audienceType === 'b2b')
      .map((p) => ({ label: p.name, value: p.id })),
  ];
  const kindName = kind === 'base' ? 'base' : 'quantity';
  return (
    <Modal
      open
      onClose={onClose}
      title={`Override ${kindName} pricing for ${location.name}`}
      primaryAction={{
        content: 'Save',
        onAction: () => {
          dispatch({ type: 'SET_LOCATION_PRICING', companyId: company.id, locationId: location.id, kind, policyId: sel || null });
          onClose();
        },
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" tone="subdued" variant="bodySm">
            A location override replaces the inherited company {kindName} pricing for buyers at {location.name} only. Choose “Use company pricing” to inherit again.
          </Text>
          <Select label={`${kindName} pricing`} options={options} value={sel} onChange={setSel} />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

function AssignBuyerModal({ company, location, onClose }) {
  const { dispatch } = useStore();
  const candidates = (company.contacts || []).filter((c) => c.locations !== location.name);
  const [email, setEmail] = useState(candidates[0]?.email || '');
  const [role, setRole] = useState('Ordering only');
  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign a buyer to ${location.name}`}
      primaryAction={{
        content: 'Assign buyer',
        disabled: !email,
        onAction: () => {
          dispatch({ type: 'ASSIGN_BUYER', companyId: company.id, locationId: location.id, email, role });
          onClose();
        },
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        {candidates.length ? (
          <BlockStack gap="300">
            <Select
              label="Contact"
              options={candidates.map((c) => ({ label: `${c.name} · ${c.email}`, value: c.email }))}
              value={email}
              onChange={setEmail}
              helpText={(() => {
                const c = candidates.find((x) => x.email === email);
                return c && c.locations ? `Currently at ${c.locations}` : 'Not assigned to a location yet';
              })()}
            />
            <Select label="Role" options={ROLE_OPTIONS.map((r) => ({ label: r, value: r }))} value={role} onChange={setRole} />
          </BlockStack>
        ) : (
          <Text as="p" tone="subdued">Every contact is already assigned to this location.</Text>
        )}
      </Modal.Section>
    </Modal>
  );
}

function GeneralModal({ location, onClose, onSave }) {
  const [name, setName] = useState(location.name);
  const [externalId, setExternalId] = useState(location.externalId || '');
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit location"
      primaryAction={{ content: 'Save', disabled: !name.trim(), onAction: () => onSave({ name: name.trim(), externalId: externalId.trim() }) }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
          <TextField label="Location ID" value={externalId} onChange={setExternalId} placeholder="External / ERP ID" autoComplete="off" />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

function ShippingModal({ location, onClose, onSave }) {
  const s = location.shipping || {};
  const [f, setF] = useState({
    firstName: s.firstName || '',
    lastName: s.lastName || '',
    company: s.company || '',
    address1: s.address1 || '',
    address2: s.address2 || '',
    city: s.city || '',
    postal: s.postal || '',
    country: s.country || 'VN',
    phone: s.phone || '',
  });
  const [billingSame, setBillingSame] = useState(location.billingSameAsShipping !== false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal
      open
      onClose={onClose}
      title="Shipping address"
      primaryAction={{ content: 'Save', onAction: () => onSave({ shipping: f, billingSameAsShipping: billingSame }) }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Select
            label="Country/region"
            options={Object.entries(COUNTRY_NAMES).map(([value, label]) => ({ value, label }))}
            value={f.country}
            onChange={set('country')}
          />
          <InlineStack gap="300" wrap={false}>
            <Box width="100%"><TextField label="First name" value={f.firstName} onChange={set('firstName')} autoComplete="off" /></Box>
            <Box width="100%"><TextField label="Last name" value={f.lastName} onChange={set('lastName')} autoComplete="off" /></Box>
          </InlineStack>
          <TextField label="Company / attention" value={f.company} onChange={set('company')} autoComplete="off" />
          <TextField label="Address" value={f.address1} onChange={set('address1')} autoComplete="off" />
          <TextField label="Apartment, suite, etc." value={f.address2} onChange={set('address2')} autoComplete="off" />
          <InlineStack gap="300" wrap={false}>
            <Box width="100%"><TextField label="City" value={f.city} onChange={set('city')} autoComplete="off" /></Box>
            <Box width="100%"><TextField label="Postal code" value={f.postal} onChange={set('postal')} autoComplete="off" /></Box>
          </InlineStack>
          <TextField label="Phone" value={f.phone} onChange={set('phone')} autoComplete="off" />
          <Checkbox label="Billing address same as shipping" checked={billingSame} onChange={setBillingSame} />
        </BlockStack>
      </Modal.Section>
    </Modal>
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
