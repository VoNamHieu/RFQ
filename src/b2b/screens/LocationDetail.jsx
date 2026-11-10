import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { locationPricingEntries, policyStatus } from '../pricing.js';
import { money } from '../format.js';

import { AssignBuyerModal, GeneralModal, ShippingModal, BillingModal, CommerceModal, commerceRows, COUNTRY_NAMES } from '../components/LocationModals.jsx';
import { LocationLimitsCard } from '../components/LocationLimitsCard.jsx';
import { LocationContractCard } from '../components/LocationContractCard.jsx';
import { SummaryHoverCard, pricingSummaryItems } from '../components/SummaryHoverCard.jsx';
import { CdSection, StatusDot, CardBanner, ExpandButton, SideBlock, SideRow, BLOCK_HELP, cdDate, backTo } from '../components/companyLayout.jsx';
import { DeleteLocationsModal } from '../components/tabs/LocationsTab.jsx';
import { PricingTypeChooser } from './PricingLibrary.jsx';
import { QuotesTab } from '../components/tabs/QuotesTab.jsx';
import { ORDER_STATUS_TONE } from '../components/tabs/OrdersTab.jsx';
import { isHeld, heldFirst } from '../components/HeldOrders.jsx';
import { contractGiving, contractOf, isContractTerm } from '../agreements.js';
import { versionFlags } from '../../shared/versions.js';
import { MenuButton, Modal } from '../../shared/wc.jsx';
import { openBuildFromQuotes } from '../components/BuildFromQuotes.jsx';
const PRICING_TYPES = [
  { id: 'base', content: 'Base pricing' },
  { id: 'quantity', content: 'Quantity pricing' },
  { id: 'contract', content: 'Contract pricing' },
];
const HISTORY_PAGE_SIZE = 5;
// Buyer chips shown before "+N more" (as the pricing's).
const BUYERS_SHOWN = 4;
// A buyer chip's hover card: email and how they order (its badge is the role).
const buyerSummaryItems = (b) => [
  ['email', 'Email', b.email || '—'],
  ['cart', 'Ordering', b.access || 'Buys directly'],
];
// Review banners closed with ✕ (by location: the orders to review then) stay closed
// until the page reloads — unless another order needs review there.
const closedReviews = new Map();
// Pricing chips shown before "+N more".
const PRICING_SHOWN = 4;

export function LocationDetail() {
  const { state, dispatch } = useStore();
  const company = state.db.companies.find((c) => c.id === state.selectedCompany);
  const location = company?.locations?.find((l) => l.id === state.selectedLocation);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editGeneral, setEditGeneral] = useState(false);
  const [editShipping, setEditShipping] = useState(false);
  const [editCommerce, setEditCommerce] = useState(false);
  const [buyersAll, setBuyersAll] = useState(false);
  // General's shipping address row: two lines until opened out.
  const [shipOpen, setShipOpen] = useState(false);
  // Its billing address row (when set apart from shipping): the same.
  const [billOpen, setBillOpen] = useState(false);
  const [editBilling, setEditBilling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The Pricing card shows one type at a time (its dropdown).
  const [pricingType, setPricingType] = useState('base');
  // All of its chips shown ("+N more").
  const [pricingAll, setPricingAll] = useState(false);
  // The Pricing block's ⊕: "Select pricing type" as a page, then the pricing of that type to add.
  const [pickPricingType, setPickPricingType] = useState(false);
  const [, setReviewClosed] = useState(0);
  // The order whose buyer message is open (its Buyer message link).
  const [noteOf, setNoteOf] = useState(null);
  if (!company || !location) return null;
  // Add / remove pricing on this location (its own list of that kind — see locationSlotArray).
  const addPricing = (kind) => {
    dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, locationId: location.id, kind, mode: 'add' });
  };

  const policies = state.db.policies;
  // Scheduled / Inactive ones listed too, so each can be opened.
  const { bases, quantities } = locationPricingEntries(company, location, policies, { includeInactive: true });
  const buyers = (company.contacts || []).filter((c) => c.locations === location.name);
  // Orders held by an order maximum sent for review sit on top, with Approve / Decline (order limits).
  const reviewOrders = versionFlags().orderLimits;
  const locOrders = (company.orders || [])
    .filter((o) => o.location === location.name)
    .slice()
    .sort(reviewOrders ? heldFirst : (a, b) => String(b.date).localeCompare(String(a.date)));
  const heldCount = locOrders.filter(isHeld).length;
  const reviewKey = `${company.id}::${location.id}`;
  const heldIds = locOrders.filter(isHeld).map((o) => o.id).join(',');
  const reviewClosed = closedReviews.get(reviewKey) === heldIds;
  const closeReview = () => {
    closedReviews.set(reviewKey, heldIds);
    setReviewClosed((n) => n + 1);
  };
  const totalSales = locOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const locQuotes = (state.db.quotes || [])
    .filter((q) => q.company === company.id && q.location === location.name)
    .slice()
    .sort((a, b) => String(b.created).localeCompare(String(a.created)));

  const setField = (patch, silent) =>
    dispatch({ type: 'SET_LOCATION_FIELD', companyId: company.id, locationId: location.id, patch, silent });

  // An address's lines: name, company, street, city, postal code, then its country.
  const addressLines = (a = {}) => {
    const name = [a.firstName, a.lastName].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
    const parts = [name, a.company, a.address1, a.address2, a.city, a.postal].map((x) => String(x || '').trim()).filter(Boolean);
    return parts.length ? [...parts, COUNTRY_NAMES[a.country] || ''].filter(Boolean) : [];
  };
  const shipPreview = addressLines(location.shipping);
  // Billing: the shipping address (billingSameAsShipping, the default) or its own.
  const billingSame = location.billingSameAsShipping !== false;
  const billPreview = billingSame ? [] : addressLines(location.billing);

  // Pricing as chips: the location's own, else inherited from the company. A name opens it
  // in the editor for the company ("Who this pricing serves" ticks the locations that get
  // it). One that isn't Active here is
  // greyed, with its status after the name.
  const chipStatus = (policy) => {
    // A contract's own pricing goes by its contract at this location; any other by its own
    // status, as in the Pricing library.
    if (isContractTerm(policy)) {
      if (policy.status === 'Inactive') return 'Inactive';
      if (contractGiving(state.db, company, policy.id, location.id)) return 'Active';
      return contractOf(state.db, policy.id)?.status === 'Scheduled' ? 'Scheduled' : 'Inactive';
    }
    return policyStatus(policy, state.db).label;
  };
  const pricingChip = (e, kind) => {
    const status = chipStatus(e.policy);
    const off = status !== 'Active';
    const open = () => dispatch({ type: 'OPEN_EDITOR', policy: e.policy, context: { mode: 'edit', companyId: company.id } });
    // Hover shows its status and a summary of its settings.
    return (
      <SummaryHoverCard key={`${kind}-${e.policy.id}`} title={e.policy.name} status={status} items={() => pricingSummaryItems(e.policy, state.db)}>
        {/* Active: green; otherwise grey, with its status (as the company page's chips). */}
        <button type="button" className={`cd-chip cd-chip--${off ? 'neutral' : 'success'}`} onClick={open}>
          {off ? `${e.policy.name} · ${status}` : e.policy.name}
        </button>
      </SummaryHoverCard>
    );
  };
  // One type per kind; a contract's own pricing (base or quantity) sits in Contract pricing,
  // a type only versions with Contracts have.
  const pricingTypes = versionFlags().agreements ? PRICING_TYPES : PRICING_TYPES.filter((t) => t.id !== 'contract');
  const shownPricingType = pricingTypes.some((t) => t.id === pricingType) ? pricingType : 'base';
  const fromContract = (e) => isContractTerm(e.policy);
  const pricingChips = {
    base: bases.filter((e) => !fromContract(e)).map((e) => pricingChip(e, 'base')),
    quantity: quantities.filter((e) => !fromContract(e)).map((e) => pricingChip(e, 'quantity')),
    contract: [
      ...bases.filter(fromContract).map((e) => pricingChip(e, 'base')),
      ...quantities.filter(fromContract).map((e) => pricingChip(e, 'quantity')),
    ],
  };
  // The first few, then "+N more"; all of them once opened up.
  const typeChips = pricingChips[shownPricingType];
  const shownChips = pricingAll ? typeChips : typeChips.slice(0, PRICING_SHOWN);
  const moreChips = typeChips.length - shownChips.length;

  // Order history pagination.
  // Order history shows the first few; the rest are on the company's Orders page (⤢).
  const pageOrders = locOrders.slice(0, HISTORY_PAGE_SIZE);

  const viewCompany = (tab, extra) => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab, ...extra });

  // Add pricing: pick a type, then the pricing of that type to add (the assign modal).
  if (pickPricingType) {
    return (
      <PricingTypeChooser
        backLabel={location.name}
        actionLabel="Select"
        onBack={() => setPickPricingType(false)}
        onPick={(kind) => {
          setPickPricingType(false);
          addPricing(kind);
        }}
      />
    );
  }

  // The company page's layout: Locations and More actions on top, then two columns
  // (stacked below 768px). The main column: the name, its overview's numbers in tiles,
  // then order history and quotes, each titled above a bordered card. The side, flat and
  // split by hairlines: general and shipping, buyers, pricing, contract, order limits and
  // commerce settings.
  return (
    <div className="cd-page">
      <div className="cd-topbar">
        <button type="button" className="cd-back" onClick={() => viewCompany('locations')}>
          <span className="cd-back__circle">
            <s-icon type="chevron-left" />
          </span>
          Locations
        </button>
        <MenuButton items={[{ content: 'Delete', destructive: true, onAction: () => setConfirmDelete(true) }]}>More actions</MenuButton>
      </div>

      <div className="cd-layout">
        <div className="cd-main">
          {/* Name and subtitle, then the overview's numbers. */}
          <div className="cd-intro">
            <div>
              <h1 className="cd-title">{location.name}</h1>
              <p className="cd-subtitle">{`${company.name} · Location`}</p>
            </div>
            <section>
              <div className="cd-section__head">
                <h2 className="cd-section__title">Location overview</h2>
              </div>
              <div className="cd-stats">
                <Stat label="Sales" value={money(totalSales)} note="All-time from this location" />
                <Stat label="Orders" value={String(locOrders.length)} note="Placed by its buyers" />
                <Stat label="Quotes" value={String(locQuotes.length)} note="RFQ requests from here" />
              </div>
            </section>
          </div>

          {/* Order history */}
          <div>
            {/* Its first orders; ⤢ opens the company's Orders on this location's, back here. */}
            <CdSection
              title="Order history"
              controls={
                <ExpandButton
                  id="location-orders-view-all"
                  onAction={() => viewCompany('orders-all', { location: location.name, backTo: backTo(state, 'orders-all', company, location) })}
                />
              }
            >
              {/* Held for review: the decision is made in the company's Orders, opened on this
                  location (held orders sit on top there). */}
              {reviewOrders && heldCount && !reviewClosed ? (
                // The company's Orders page on the orders to review here (Approve / Decline),
                // with a back arrow to this location.
                <CardBanner
                  action={{
                    label: 'Review orders',
                    onAction: () => viewCompany('orders-all', { location: location.name, filter: 'review', backTo: backTo(state, 'orders-all', company, location) }),
                  }}
                  onDismiss={closeReview}
                  textAction
                >
                  {`${heldCount} ${heldCount === 1 ? 'order needs' : 'orders need'} your review`}
                </CardBanner>
              ) : null}
              <div className="cd-card">
                {pageOrders.length ? (
                  <div className="cd-table-scroll">
                    <table className="cd-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Buyer</th>
                          <th className="cd-num">Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageOrders.map((o) => {
                          const openOrder = () =>
                            dispatch({ type: 'OPEN_ORDER', companyId: company.id, orderId: o.id, backTo: backTo(state, 'order', company, location) });
                          // As the company's Orders card: an order to review shows its buyer's
                          // message (a link that opens it) and Review (opens the order's page).
                          const toReview = reviewOrders && isHeld(o);
                          return (
                            <tr key={o.id} className="cd-row-link" onClick={openOrder}>
                              <td>
                                <button type="button" className="cd-link-button">
                                  {o.id}
                                </button>
                                <span className="cd-sub">{[cdDate(o.date), o.po && o.po !== 'None' ? o.po : null].filter(Boolean).join(' · ') || '—'}</span>
                                {toReview && o.buyerMessage ? (
                                  <button
                                    type="button"
                                    className="cd-text-link"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNoteOf(o);
                                    }}
                                  >
                                    Buyer message
                                  </button>
                                ) : null}
                              </td>
                              <td>{o.buyer || '—'}</td>
                              <td className="cd-num">{money(o.amount)}</td>
                              <td>
                                <StatusDot tone={ORDER_STATUS_TONE[o.status]}>{o.status}</StatusDot>
                                {toReview ? (
                                  <button
                                    type="button"
                                    className="cd-text-link cd-text-link--indent"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openOrder();
                                    }}
                                  >
                                    Review
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="cd-card__empty">No orders from this location yet.</div>
                )}
              </div>
            </CdSection>
          </div>

          {/* Quotes from this location: the company page's Quotes card, on its quotes. */}
          <div>
            <QuotesTab key={location.id} company={company} location={location} />
          </div>
        </div>

        <div className="cd-side">
          {/* General: name and ID (the pencil edits them), then the shipping address's first
              two lines — opened out, all its lines and Edit address — then the billing
              address the same way (or "Same as shipping address"). */}
          <SideBlock title="General" actions={<s-button icon="edit" variant="tertiary" onClick={() => setEditGeneral(true)} accessibilityLabel="Edit general" />}>
            <SideRow label="Name">{location.name}</SideRow>
            <SideRow label="Location ID">{location.externalId || 'Not set'}</SideRow>
            {location.status === 'Deleted' && (
              <SideRow label="Status">
                <s-badge tone="critical">Deleted</s-badge>
              </SideRow>
            )}
            <div className="cd-row">
              {shipPreview.length ? (
                <>
                  <button type="button" className="cd-row__toggle" aria-expanded={shipOpen} onClick={() => setShipOpen((v) => !v)}>
                    <span>Shipping address</span>
                    <s-icon type={shipOpen ? 'chevron-up' : 'chevron-down'} size="small" />
                  </button>
                  <div className="cd-row__value">
                    {shipOpen ? (
                      <>
                        {shipPreview.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                        <button type="button" className="cd-text-link" onClick={() => setEditShipping(true)}>
                          Edit address
                        </button>
                      </>
                    ) : (
                      // Closed: its first two lines, one piece of the address each.
                      shipPreview.slice(0, 2).map((line, i) => (
                        <span key={i} className="cd-truncate">
                          {line}
                        </span>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="cd-row__label">Shipping address</div>
                  {/* Like Location ID's: the value in body text, not grey like the label. */}
                  <div className="cd-row__value">
                    Not set
                    <button type="button" className="cd-text-link" onClick={() => setEditShipping(true)}>
                      Add address
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* Billing address (Shopify's location page has both, each with its own Edit):
                "Same as shipping address", or its own address shown as the shipping one is. */}
            <div className="cd-row">
              {billPreview.length ? (
                <>
                  <button type="button" className="cd-row__toggle" aria-expanded={billOpen} onClick={() => setBillOpen((v) => !v)}>
                    <span>Billing address</span>
                    <s-icon type={billOpen ? 'chevron-up' : 'chevron-down'} size="small" />
                  </button>
                  <div className="cd-row__value">
                    {billOpen ? (
                      <>
                        {billPreview.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                        <button type="button" className="cd-text-link" onClick={() => setEditBilling(true)}>
                          Edit address
                        </button>
                      </>
                    ) : (
                      billPreview.slice(0, 2).map((line, i) => (
                        <span key={i} className="cd-truncate">
                          {line}
                        </span>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="cd-row__label">Billing address</div>
                  <div className="cd-row__value">
                    {billingSame ? 'Same as shipping address' : 'Not set'}
                    <button type="button" className="cd-text-link" onClick={() => setEditBilling(true)}>
                      {billingSame ? 'Edit address' : 'Add address'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </SideBlock>

          {/* Buyers as chips, together like the pricing's: hover shows the role, email and how
              they order; × removes one from the location. The first few, then "+N more". */}
          <SideBlock title={`Buyers${buyers.length ? ` (${buyers.length})` : ''}`} actions={<s-button onClick={() => setAssignOpen(true)}>Assign buyer</s-button>}>
            <SideRow>
              {buyers.length ? (
                <s-stack direction="inline" gap="small-300" alignItems="center">
                  {(buyersAll ? buyers : buyers.slice(0, BUYERS_SHOWN)).map((b, i) => (
                    <span key={b.email || i} className="cd-chip cd-chip--plain cd-chip--removable">
                      <SummaryHoverCard title={b.name} status={b.role || 'Ordering only'} items={() => buyerSummaryItems(b)}>
                        <span className="cd-chip__label" tabIndex={0}>
                          {b.name}
                        </span>
                      </SummaryHoverCard>
                      <button
                        type="button"
                        className="cd-chip__remove"
                        aria-label={`Remove ${b.name}`}
                        onClick={() => dispatch({ type: 'UNASSIGN_BUYER', companyId: company.id, locationId: location.id, email: b.email })}
                      >
                        <s-icon type="x" size="small" />
                      </button>
                    </span>
                  ))}
                  {!buyersAll && buyers.length > BUYERS_SHOWN ? (
                    <s-clickable-chip accessibilityLabel={`Show ${buyers.length - BUYERS_SHOWN} more`} onClick={() => setBuyersAll(true)}>
                      {`+${buyers.length - BUYERS_SHOWN} more`}
                    </s-clickable-chip>
                  ) : null}
                  {buyersAll && buyers.length > BUYERS_SHOWN ? <s-link onClick={() => setBuyersAll(false)}>Show less</s-link> : null}
                </s-stack>
              ) : (
                <span className="cd-sub">No buyers assigned. Assign a buyer so someone can purchase under this location.</span>
              )}
            </SideRow>
          </SideBlock>

          {/* Pricing: a type dropdown over names as chips (a few, then "+N more"); ⊕ offers
              Regular pricing (Select pricing type) or Convert from quotes (this location's
              closed quotes); Preview prices under them shows what its buyers pay. */}
          <SideBlock
            title="Pricing"
            info={BLOCK_HELP.pricing}
            // The library filtered to this location (and its company).
            actions={
              <s-link onClick={() => dispatch({ type: 'NAVIGATE', view: 'pricing', patch: { pricingCompany: company.id, pricingLocation: `${company.id}::${location.id}`, backTo: backTo(state, 'pricing', company, location) } })}>
                View pricing library
              </s-link>
            }
          >
            <SideRow>
              <s-stack gap="small">
                <s-select
                  label="Pricing type"
                  labelAccessibilityVisibility="exclusive"
                  value={shownPricingType}
                  onChange={(e) => {
                    setPricingType(e.currentTarget.value);
                    setPricingAll(false);
                  }}
                >
                  {pricingTypes.map((t) => (
                    <s-option key={t.id} value={t.id}>{t.content}</s-option>
                  ))}
                </s-select>
                <s-stack direction="inline" gap="small-300" alignItems="center">
                  {shownChips}
                  {moreChips > 0 ? (
                    <s-clickable-chip accessibilityLabel={`Show ${moreChips} more`} onClick={() => setPricingAll(true)}>
                      {`+${moreChips} more`}
                    </s-clickable-chip>
                  ) : null}
                  {pricingAll && typeChips.length > PRICING_SHOWN ? <s-link onClick={() => setPricingAll(false)}>Show less</s-link> : null}
                  {versionFlags().priceCrossSync ? (
                    <MenuButton
                      icon="plus-circle"
                      variant="tertiary"
                      accessibilityLabel="Add pricing"
                      items={[
                        { content: 'Regular pricing', onAction: () => setPickPricingType(true) },
                        { content: 'Convert from quotes', onAction: () => openBuildFromQuotes(dispatch, company, state.db, location.name) },
                      ]}
                    />
                  ) : (
                    <s-button icon="plus-circle" variant="tertiary" accessibilityLabel="Add pricing" onClick={() => setPickPricingType(true)} />
                  )}
                </s-stack>
                <div>
                  <button type="button" className="cd-action-link" onClick={() => dispatch({ type: 'OPEN_PRICE_BOARD', companyId: company.id, locationId: location.id })}>
                    <s-icon type="view" color="subdued" />
                    Preview prices
                  </button>
                </div>
              </s-stack>
            </SideRow>
          </SideBlock>

          {/* Contract, then order limits: chips under the pricing, laid out as it is */}
          {versionFlags().agreements && <LocationContractCard company={company} location={location} />}
          {versionFlags().orderLimits && <LocationLimitsCard company={company} location={location} />}

          {/* Commerce settings: rows like the other blocks; the pencil edits them together. */}
          <SideBlock
            title="Commerce settings"
            actions={<s-button icon="edit" variant="tertiary" onClick={() => setEditCommerce(true)} accessibilityLabel="Edit commerce settings" />}
          >
            {commerceRows(location).map(([label, value]) => (
              <SideRow key={label} label={label}>
                {value}
              </SideRow>
            ))}
          </SideBlock>
        </div>
      </div>

      {assignOpen && <AssignBuyerModal company={company} location={location} onClose={() => setAssignOpen(false)} />}
      {editCommerce && (
        <CommerceModal location={location} onClose={() => setEditCommerce(false)} onSave={(patch) => { setField(patch); setEditCommerce(false); }} />
      )}
      {editGeneral && (
        <GeneralModal location={location} onClose={() => setEditGeneral(false)} onSave={(patch) => { setField(patch); setEditGeneral(false); }} />
      )}
      {editShipping && (
        <ShippingModal location={location} onClose={() => setEditShipping(false)} onSave={(patch) => { setField(patch); setEditShipping(false); }} />
      )}
      {editBilling && (
        <BillingModal location={location} onClose={() => setEditBilling(false)} onSave={(patch) => { setField(patch); setEditBilling(false); }} />
      )}
      {confirmDelete && <DeleteLocationsModal company={company} locationIds={[location.id]} onClose={() => setConfirmDelete(false)} />}
      {noteOf ? (
        <Modal onClose={() => setNoteOf(null)} heading={`Buyer message · ${noteOf.id}`}>
          <s-stack gap="small">
            <s-text color="subdued">{[noteOf.buyer, noteOf.location, cdDate(noteOf.date)].filter(Boolean).join(' · ')}</s-text>
            <s-paragraph>{noteOf.buyerMessage}</s-paragraph>
          </s-stack>
          <s-button slot="secondary-actions" onClick={() => setNoteOf(null)}>
            Close
          </s-button>
        </Modal>
      ) : null}
    </div>
  );
}

// One of the overview's numbers, in a tile of equal width: label, value, then a note
// (as the company page's).
function Stat({ label, value, note }) {
  return (
    <div className="cd-stat">
      <div className="cd-stat__label">{label}</div>
      <div className="cd-stat__value">{value}</div>
      <div className="cd-stat__note">{note}</div>
    </div>
  );
}
