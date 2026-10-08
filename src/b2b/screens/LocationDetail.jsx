import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { locationPricingEntries, scopeLabel, policyStatus } from '../pricing.js';
import { money } from '../format.js';

import { AssignBuyerModal, GeneralModal, ShippingModal, PAYMENT_TERM_OPTIONS, TAX_SETTINGS, COUNTRY_NAMES } from '../components/LocationModals.jsx';
import { LocationLimitsCard } from '../components/LocationLimitsCard.jsx';
import { DeleteLocationsModal } from '../components/tabs/LocationsTab.jsx';
import { isHeld, heldReason, heldFirst, HeldOrderActions } from '../components/HeldOrders.jsx';
import { versionFlags } from '../../shared/versions.js';
import { MenuButton, Tip, useWcId, wcTone, PageHeader, Tabs } from '../../shared/wc.jsx';

const ORDER_TONE = {
  Fulfilled: 'success',
  Paid: 'success',
  'Needs review': 'warning',
  Cancelled: 'critical',
  'Draft order': 'info',
  Unfulfilled: 'attention',
  Declined: 'critical',
};
const orderTone = (s) => ORDER_TONE[s];
const QUOTE_TONE = { 'New Received': 'attention', Read: undefined, Updated: 'info', 'Deal Closed': 'success', 'Deal Rejected': 'critical' };
const PRICING_PAGE_SIZE = 5;
const PRICING_KINDS = [
  { id: 'base', content: 'Base pricing' },
  { id: 'quantity', content: 'Quantity pricing' },
];
const HISTORY_PAGE_SIZE = 5;

export function LocationDetail() {
  const { state, dispatch } = useStore();
  const company = state.db.companies.find((c) => c.id === state.selectedCompany);
  const location = company?.locations?.find((l) => l.id === state.selectedLocation);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editGeneral, setEditGeneral] = useState(false);
  const [editShipping, setEditShipping] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pricingPage, setPricingPage] = useState(0);
  // The Pricing card shows one kind at a time (its tabs).
  const [pricingKind, setPricingKind] = useState('base');
  const [quotesPage, setQuotesPage] = useState(0);
  const [ordersPage, setOrdersPage] = useState(0);
  const ids = useWcId('loc');
  if (!company || !location) return null;
  // Add / change / remove pricing on this location (its own list of that kind — see
  // locationSlotArray), with the same row actions as the company page. Edit opens it
  // for the company: "Who this pricing serves" ticks the locations that get it.
  const addPricing = (kind) => {
    dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, locationId: location.id, kind, mode: 'add' });
  };
  const pricingActions = (policy, kind) => (
    <s-stack direction="inline" gap="small-400" justifyContent="end" alignItems="center">
      <s-button
        icon="edit"
        variant="tertiary"
        accessibilityLabel={`Edit ${policy.name}`}
        onClick={() => dispatch({ type: 'OPEN_EDITOR', policy, context: { mode: 'edit', companyId: company.id } })}
      />
      <s-button
        icon="exchange"
        variant="tertiary"
        accessibilityLabel={`Change ${policy.name}`}
        onClick={() => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, locationId: location.id, kind, mode: 'swap', swapId: policy.id })}
      />
      <s-button
        icon="x-circle"
        variant="tertiary"
        tone="critical"
        accessibilityLabel={`Remove ${policy.name}`}
        onClick={() => dispatch({ type: 'REMOVE_LOCATION_PRICING', companyId: company.id, locationId: location.id, kind, policyId: policy.id })}
      />
    </s-stack>
  );

  const policies = state.db.policies;
  // Scheduled / Inactive ones listed too (with their status), so each can be edited or removed.
  const { bases, quantities } = locationPricingEntries(company, location, policies, { includeInactive: true });
  const buyers = (company.contacts || []).filter((c) => c.locations === location.name);
  // Orders held by a review threshold sit on top, with Approve / Decline (order limits).
  const reviewOrders = versionFlags().orderLimits;
  const locOrders = (company.orders || [])
    .filter((o) => o.location === location.name)
    .slice()
    .sort(reviewOrders ? heldFirst : (a, b) => String(b.date).localeCompare(String(a.date)));
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

  // Pricing rows of the picked kind: the location's own, else inherited from the company.
  const pricingRow = (e, kind) => {
    const status = policyStatus(e.policy, state.db);
    return (
      <s-table-row key={`${kind}-${e.policy.id}`}>
        <s-table-cell>
          <s-stack gap="small-500">
            <s-text>{e.policy.name}</s-text>
            {e.source === 'COMPANY' ? (
              <s-text color="subdued" fontSize="small">Inherited from {company.name}</s-text>
            ) : null}
          </s-stack>
        </s-table-cell>
        <s-table-cell>{scopeLabel(e.policy)}</s-table-cell>
        <s-table-cell>
          <s-badge tone={wcTone(status.tone)}>{status.label}</s-badge>
        </s-table-cell>
        <s-table-cell>{pricingActions(e.policy, kind)}</s-table-cell>
      </s-table-row>
    );
  };
  const notSetRow = (kind) => (
    <s-table-row key={`${kind}-none`}>
      <s-table-cell><s-badge tone="warning">Not set</s-badge></s-table-cell>
      <s-table-cell>—</s-table-cell>
      <s-table-cell>—</s-table-cell>
      <s-table-cell />
    </s-table-row>
  );
  const kindEntries = pricingKind === 'base' ? bases : quantities;
  const pricingRows = kindEntries.length ? kindEntries.map((e) => pricingRow(e, pricingKind)) : [notSetRow(pricingKind)];

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

  // A card's title row: heading on the left, its action on the right.
  const cardHeader = (title, action) => (
    <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
      <s-heading>{title}</s-heading>
      {action}
    </s-grid>
  );
  // Polaris React's IndexTable pagination showed "1–5 of 15" between its arrows;
  // s-table's own pagination has no label, so it sits just under it, on the same band.
  const pageLabel = (label) => (
    <s-box background="subdued" paddingBlockEnd="small">
      <div style={{ textAlign: 'center' }}>
        <s-text color="subdued" fontSize="small">{label}</s-text>
      </div>
    </s-box>
  );
  const emptyRows = (text) => (
    <s-box padding="base">
      <div style={{ textAlign: 'center' }}>
        <s-text color="subdued">{text}</s-text>
      </div>
    </s-box>
  );

  return (
    <>
    <PageHeader
      backAction={{ content: 'Locations', onAction: () => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'locations' }) }}
      heading={location.name}
      subtitle={`${company.name} · Location`}
      secondaryActions={[{ content: 'Delete', destructive: true, onAction: () => setConfirmDelete(true) }]}
    />
    <s-page>
      <s-stack gap="base">
        {/* Two columns (Polaris React Layout + a oneThird section), as a grid so they
            stack below 768px like Layout did. */}
        <s-query-container>
          <s-grid
            gridTemplateColumns='@container (inline-size > 768px) "minmax(0, 2fr) minmax(0, 1fr)", "minmax(0, 1fr)"'
            gap="base"
            alignItems="start"
          >
            <s-stack gap="base">
              {/* Overview */}
              <s-section heading="Location overview">
                <s-stack direction="inline" gap="base">
                  <Stat label="Sales" value={money(totalSales)} note="All-time from this location" />
                  <Stat label="Orders" value={String(locOrders.length)} note="Placed by its buyers" />
                  <Stat label="Quotes" value={String(locQuotes.length)} note="RFQ requests from here" />
                </s-stack>
              </s-section>

              {/* Pricing */}
              <s-section padding="none">
                <s-box padding="small" paddingBlockEnd="small-200">
                  {cardHeader(
                    'Pricing',
                    <MenuButton
                      icon="plus"
                      items={[
                        { content: 'Base pricing', onAction: () => addPricing('base') },
                        { content: 'Quantity pricing', onAction: () => addPricing('quantity') },
                      ]}
                    >
                      Add pricing
                    </MenuButton>,
                  )}
                </s-box>
                <Tabs
                  tabs={PRICING_KINDS}
                  selected={PRICING_KINDS.findIndex((k) => k.id === pricingKind)}
                  onSelect={(i) => {
                    setPricingKind(PRICING_KINDS[i].id);
                    setPricingPage(0);
                  }}
                />
                <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Pricing</s-table-header>
                    <s-table-header listSlot="labeled">Products</s-table-header>
                    <s-table-header listSlot="secondary">Status</s-table-header>
                    <s-table-header listSlot="inline"><s-text accessibilityVisibility="exclusive">Actions</s-text></s-table-header>
                  </s-table-header-row>
                  <s-table-body>{pagePricingRows}</s-table-body>
                </s-table>
                {/* One-row footer, as on the company page's Base pricing card. */}
                {pricingPageCount > 1 ? (
                  <>
                    <s-divider />
                    <s-box padding="small">
                      <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                        <s-text color="subdued" fontSize="small">{pricingPageLabel}</s-text>
                        <s-stack direction="inline" gap="small-200" alignItems="center">
                          <s-text color="subdued" fontSize="small">{`Page ${pricingCurrent + 1} of ${pricingPageCount}`}</s-text>
                          <s-button-group gap="none" accessibilityLabel="Pagination">
                            <s-button
                              slot="secondary-actions"
                              icon="chevron-left"
                              accessibilityLabel="Previous"
                              disabled={pricingCurrent <= 0}
                              onClick={() => setPricingPage(Math.max(pricingCurrent - 1, 0))}
                            />
                            <s-button
                              slot="secondary-actions"
                              icon="chevron-right"
                              accessibilityLabel="Next"
                              disabled={pricingCurrent >= pricingPageCount - 1}
                              onClick={() => setPricingPage(Math.min(pricingCurrent + 1, pricingPageCount - 1))}
                            />
                          </s-button-group>
                        </s-stack>
                      </s-stack>
                    </s-box>
                  </>
                ) : null}
              </s-section>

              {/* Quotes from this location */}
              <s-section padding="none">
                <s-box padding="small" paddingBlockEnd="small-200">
                  {cardHeader(
                    `Quotes${locQuotes.length ? ` (${locQuotes.length})` : ''}`,
                    <s-button onClick={() => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'quotes' })}>View all company quotes</s-button>,
                  )}
                </s-box>
                {pageQuotes.length ? (
                  <>
                    <s-table
                      paginate={quotesPageCount > 1}
                      hasPreviousPage={quotesCurrent > 0}
                      hasNextPage={quotesCurrent < quotesPageCount - 1}
                      onPreviousPage={() => setQuotesPage(Math.max(quotesCurrent - 1, 0))}
                      onNextPage={() => setQuotesPage(Math.min(quotesCurrent + 1, quotesPageCount - 1))}
                    >
                      <s-table-header-row>
                        <s-table-header listSlot="primary">Quote</s-table-header>
                        <s-table-header listSlot="labeled">Buyer</s-table-header>
                        <s-table-header listSlot="labeled">Created</s-table-header>
                        <s-table-header listSlot="secondary">Status</s-table-header>
                      </s-table-header-row>
                      <s-table-body>
                        {pageQuotes.map((q) => {
                          const linkId = `${ids}-quote-${q.id}`;
                          return (
                            <s-table-row key={q.id} clickDelegate={linkId}>
                              <s-table-cell>
                                <s-link id={linkId} onClick={() => dispatch({ type: 'OPEN_QUOTE', id: q.id })}>{q.id}</s-link>
                              </s-table-cell>
                              <s-table-cell>{q.buyer}</s-table-cell>
                              <s-table-cell>{q.created}</s-table-cell>
                              <s-table-cell><s-badge tone={wcTone(QUOTE_TONE[q.status])}>{q.status}</s-badge></s-table-cell>
                            </s-table-row>
                          );
                        })}
                      </s-table-body>
                    </s-table>
                    {quotesPageCount > 1 ? pageLabel(quotesPageLabel) : null}
                  </>
                ) : (
                  emptyRows('No quotes from this location yet.')
                )}
              </s-section>

              {/* Order history */}
              <s-section padding="none">
                <s-box padding="small" paddingBlockEnd="small-200">
                  {cardHeader(
                    `Order history${locOrders.length ? ` (${locOrders.length})` : ''}`,
                    <s-button onClick={() => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'orders' })}>View all company orders</s-button>,
                  )}
                </s-box>
                {/* Held by a review threshold: the decision sits above the list (this column is too narrow for a row of buttons). */}
                {reviewOrders && locOrders.filter(isHeld).map((o) => (
                  <s-box key={o.id} paddingInline="small" paddingBlockEnd="small">
                    <s-banner tone="warning" heading={`Order ${o.id} for ${money(o.amount)} is waiting for your review`}>
                      <s-stack gap="small-200">
                        <s-paragraph>{`${heldReason(o, state.db)}. ${o.buyer} couldn’t check out, so it stays a draft order until you decide.`}</s-paragraph>
                        <s-stack direction="inline" justifyContent="start"><HeldOrderActions companyId={company.id} order={o} /></s-stack>
                      </s-stack>
                    </s-banner>
                  </s-box>
                ))}
                {pageOrders.length ? (
                  <>
                    <s-table
                      paginate={ordersPageCount > 1}
                      hasPreviousPage={ordersCurrent > 0}
                      hasNextPage={ordersCurrent < ordersPageCount - 1}
                      onPreviousPage={() => setOrdersPage(Math.max(ordersCurrent - 1, 0))}
                      onNextPage={() => setOrdersPage(Math.min(ordersCurrent + 1, ordersPageCount - 1))}
                    >
                      <s-table-header-row>
                        <s-table-header listSlot="primary">Order</s-table-header>
                        <s-table-header listSlot="labeled">Buyer</s-table-header>
                        <s-table-header listSlot="labeled">Date</s-table-header>
                        <s-table-header listSlot="labeled" format="currency">Total</s-table-header>
                        <s-table-header listSlot="secondary">Status</s-table-header>
                      </s-table-header-row>
                      <s-table-body>
                        {pageOrders.map((o) => (
                          <s-table-row key={o.id}>
                            <s-table-cell>
                              <s-stack gap="small-500">
                                <s-text fontWeight="medium">{o.id}</s-text>
                                {o.po && o.po !== 'None' ? <s-text color="subdued" fontSize="small">{o.po}</s-text> : null}
                                {reviewOrders && isHeld(o) ? <s-text tone="caution" fontSize="small">{heldReason(o, state.db)}</s-text> : null}
                              </s-stack>
                            </s-table-cell>
                            <s-table-cell>{o.buyer}</s-table-cell>
                            <s-table-cell>{o.date}</s-table-cell>
                            <s-table-cell>{money(o.amount)}</s-table-cell>
                            <s-table-cell><s-badge tone={wcTone(orderTone(o.status))}>{o.status}</s-badge></s-table-cell>
                          </s-table-row>
                        ))}
                      </s-table-body>
                    </s-table>
                    {ordersPageCount > 1 ? pageLabel(ordersPageLabel) : null}
                  </>
                ) : (
                  emptyRows('No orders from this location yet.')
                )}
              </s-section>
            </s-stack>

            <s-stack gap="base">
              {/* Location details: general + shipping */}
              <s-section>
                <s-stack gap="small">
                  {cardHeader('General', <s-button icon="edit" onClick={() => setEditGeneral(true)} accessibilityLabel="Edit general" />)}
                  <Kv label="Name" value={location.name} />
                  <Kv label="Location ID" value={location.externalId || 'Not set'} />
                  <Kv label="Status" value={<s-badge tone={location.status === 'Deleted' ? 'critical' : 'success'}>{location.status || 'Active'}</s-badge>} />
                  <s-divider />
                  {cardHeader('Shipping address', <s-button onClick={() => setEditShipping(true)}>{shipPreview.length ? 'Edit' : 'Add'}</s-button>)}
                  {shipPreview.length ? (
                    <s-stack gap="none">
                      {shipPreview.map((line, i) => (
                        <s-paragraph key={i} fontSize="small">{line}</s-paragraph>
                      ))}
                    </s-stack>
                  ) : (
                    <s-paragraph color="subdued" fontSize="small">No shipping address provided.</s-paragraph>
                  )}
                  <s-paragraph color="subdued" fontSize="small">
                    {location.billingSameAsShipping ? 'Billing address is same as shipping.' : 'Billing address is set separately.'}
                  </s-paragraph>
                </s-stack>
              </s-section>

              {/* Buyers — names only; the role shows on hover */}
              <s-section>
                <s-stack gap="small">
                  {cardHeader(`Buyers${buyers.length ? ` (${buyers.length})` : ''}`, <s-button onClick={() => setAssignOpen(true)}>Assign buyer</s-button>)}
                  {buyers.length ? (
                    <s-stack gap="small-400">
                      {buyers.map((b, i) => (
                        <s-grid key={b.email || i} gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
                          <div>
                            <Tip content={b.role || 'Ordering only'}>{b.name}</Tip>
                          </div>
                          <s-button
                            icon="x"
                            variant="tertiary"
                            accessibilityLabel={`Remove ${b.name}`}
                            onClick={() => dispatch({ type: 'UNASSIGN_BUYER', companyId: company.id, locationId: location.id, email: b.email })}
                          />
                        </s-grid>
                      ))}
                    </s-stack>
                  ) : (
                    <s-paragraph color="subdued" fontSize="small">No buyers assigned. Assign a buyer so someone can purchase under this location.</s-paragraph>
                  )}
                </s-stack>
              </s-section>

              {/* Commerce settings — live */}
              <s-section heading="Commerce settings">
                <s-stack gap="small">
                  <s-select
                    label="Payment terms"
                    value={location.paymentTerms || 'No payment terms'}
                    onChange={(e) => setField({ paymentTerms: e.currentTarget.value }, true)}
                  >
                    {PAYMENT_TERM_OPTIONS.map((t) => (
                      <s-option key={t} value={t}>{t}</s-option>
                    ))}
                  </s-select>
                  <s-select
                    label="Order submission"
                    value={location.purchasingMode || 'DIRECT'}
                    onChange={(e) => setField({ purchasingMode: e.currentTarget.value }, true)}
                  >
                    <s-option value="DIRECT">Automatically submit orders</s-option>
                    <s-option value="REQUIRE_APPROVAL">Submit all orders as drafts for review</s-option>
                  </s-select>
                  <s-checkbox
                    label="Allow any one-time address"
                    checked={!!location.editableShipping}
                    onChange={(e) => setField({ editableShipping: e.currentTarget.checked }, true)}
                  />
                  <s-divider />
                  <s-text-field
                    label="Tax ID"
                    value={location.taxId || ''}
                    onInput={(e) => setField({ taxId: e.currentTarget.value }, true)}
                    placeholder="Tax / VAT ID"
                    autocomplete="off"
                  />
                  <s-select
                    label="Tax settings"
                    value={location.taxSettings || 'collect'}
                    onChange={(e) => setField({ taxSettings: e.currentTarget.value }, true)}
                  >
                    {TAX_SETTINGS.map((t) => (
                      <s-option key={t.value} value={t.value}>{t.label}</s-option>
                    ))}
                  </s-select>
                </s-stack>
              </s-section>

              {/* Order limits that reach this location, next to Shopify's own checkout settings */}
              {versionFlags().orderLimits && <LocationLimitsCard company={company} location={location} />}
            </s-stack>
          </s-grid>
        </s-query-container>
      </s-stack>

      {assignOpen && (
        <AssignBuyerModal company={company} location={location} onClose={() => setAssignOpen(false)} />
      )}
      {editGeneral && (
        <GeneralModal location={location} onClose={() => setEditGeneral(false)} onSave={(patch) => { setField(patch); setEditGeneral(false); }} />
      )}
      {editShipping && (
        <ShippingModal location={location} onClose={() => setEditShipping(false)} onSave={(patch) => { setField(patch); setEditShipping(false); }} />
      )}
      {confirmDelete && (
        <DeleteLocationsModal company={company} locationIds={[location.id]} onClose={() => setConfirmDelete(false)} />
      )}
    </s-page>
    </>
  );
}

function Stat({ label, value, note }) {
  return (
    <s-box minInlineSize="140px">
      <s-stack gap="small-500">
        <s-paragraph color="subdued" fontSize="small">{label}</s-paragraph>
        <s-heading fontSize="large-200" accessibilityRole="presentation">{value}</s-heading>
        <s-paragraph color="subdued" fontSize="small-200">{note}</s-paragraph>
      </s-stack>
    </s-box>
  );
}

function Kv({ label, value }) {
  return (
    <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small-200">
      <s-text color="subdued" fontSize="small">{label}</s-text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <s-text fontSize="small">{value || '—'}</s-text>
      ) : (
        value
      )}
    </s-stack>
  );
}
