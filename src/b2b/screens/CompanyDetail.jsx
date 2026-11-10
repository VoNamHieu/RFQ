import React, { useEffect, useState } from 'react';
import { useStore, currentCompany } from '../store.jsx';
import { companyBaseEntries, companyQuantityEntries } from '../pricing.js';
import { money } from '../format.js';
import { CompanyPricingCard } from '../components/CompanyPricingCard.jsx';
import { PricingTypeChooser } from './PricingLibrary.jsx';
import { CompanyContractCard } from '../components/CompanyContractCard.jsx';
import { CompanyLimitsCard } from '../components/CompanyLimitsCard.jsx';
import { QuotesTab } from '../components/tabs/QuotesTab.jsx';
import { OrdersTab } from '../components/tabs/OrdersTab.jsx';
import { LocationsTab } from '../components/tabs/LocationsTab.jsx';
import { ContactsTab } from '../components/tabs/ContactsTab.jsx';
import { CompanyAnalytics } from '../components/CompanyAnalytics.jsx';
import { SideBlock, SideRow, backActionFor } from '../components/companyLayout.jsx';
import { versionFlags } from '../../shared/versions.js';
import { MenuButton, Modal, PageHeader } from '../../shared/wc.jsx';

// Links that used to open one of the company's tabs (`companyTab`, e.g. "View all
// company orders" on a location) now scroll to that card on the one page.
const SECTION_OF = { agreement: 'contract', limits: 'limits', quotes: 'quotes', orders: 'orders', locations: 'locations', contacts: 'contacts' };
// Below the fixed top bar.
const scrollMargin = { scrollMarginTop: 72 };
// The Quotes and Orders cards' View all: the same card on a page of its own (full
// width, more rows a page); back returns to the card.
const FULL_PAGES = {
  'quotes-all': { heading: 'Quotes', card: 'quotes', Card: QuotesTab },
  'orders-all': { heading: 'Orders', card: 'orders', Card: OrdersTab },
};

// The company page, after the merchant's mockup: Companies and More actions on top,
// then two columns (stacked below 768px). The main column: the name, its overview's
// numbers flat on the page, then locations, orders and quotes, each titled above a
// bordered card. The side, flat and split by hairlines: the company's details,
// contacts, then pricing, contract and order limits as chips. Its Analytics opens as a
// page of its own (View analytics, by the overview's title).
export function CompanyDetail() {
  const { state, dispatch } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The Pricing block's ⊕: "Select pricing type" as a page, then the pricing of that type to add.
  const [pickPricingType, setPickPricingType] = useState(false);
  const company = currentCompany(state);

  useEffect(() => {
    if (FULL_PAGES[state.companyTab]) {
      window.scrollTo(0, 0);
      return;
    }
    const id = SECTION_OF[state.companyTab];
    if (id) document.getElementById(`company-${id}`)?.scrollIntoView({ block: 'start' });
  }, [state.selectedCompany, state.companyTab]);

  if (!company) return null;

  const assignedCount =
    companyBaseEntries(company, state.db.policies).length + companyQuantityEntries(company, state.db.policies).length;
  const locationCount = (company.locations || []).length;
  const backToCompany = () => dispatch({ type: 'SET_COMPANY_TAB', tab: 'overview' });

  // Analytics: a page of its own, back to the company.
  if (state.companyTab === 'analytics' && versionFlags().analytics) {
    return (
      <>
        <PageHeader heading="Analytics" subtitle={company.name} backAction={{ content: company.name, onAction: backToCompany }} />
        <s-page>
          <s-stack gap="small">
            <s-stack direction="inline" justifyContent="end">
              <s-button onClick={() => dispatch({ type: 'NAVIGATE', view: 'analytics' })}>Compare with all companies</s-button>
            </s-stack>
            <CompanyAnalytics company={company} />
          </s-stack>
        </s-page>
      </>
    );
  }

  // Add pricing: pick a type, then the pricing of that type to add (the assign modal).
  if (pickPricingType) {
    return (
      <PricingTypeChooser
        backLabel={company.name}
        actionLabel="Select"
        onBack={() => setPickPricingType(false)}
        onPick={(kind) => {
          setPickPricingType(false);
          dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, kind, mode: 'add' });
        }}
      />
    );
  }

  // Quotes / Orders full page (View all), back to its card.
  const fullPage = FULL_PAGES[state.companyTab];
  if (fullPage) {
    const { heading, card, Card } = fullPage;
    return (
      <>
        <PageHeader
          heading={heading}
          subtitle={company.name}
          inlineSize="large"
          // Opened from a location's held-orders banner: back to that location.
          backAction={backActionFor(state, dispatch, state.companyTab) || { content: company.name, onAction: () => dispatch({ type: 'SET_COMPANY_TAB', tab: card }) }}
        />
        <s-page inlineSize="large">
          <Card company={company} full />
        </s-page>
      </>
    );
  }

  const orders = company.orders || [];
  const quoteCount = (state.db.quotes || []).filter((q) => q.company === company.id).length;
  const totalSales = orders.reduce((s, o) => s + (o.amount || 0), 0);

  return (
    <div className="cd-page">
      <div className="cd-topbar">
        <button type="button" className="cd-back" onClick={() => dispatch({ type: 'NAVIGATE', view: 'customers' })}>
          <span className="cd-back__circle">
            <s-icon type="chevron-left" />
          </span>
          Companies
        </button>
        <MenuButton
          items={[
            // Whether locations created on this company in Shopify join it here automatically.
            {
              content: `Auto-add locations: ${company.autoAddLocations ? 'On' : 'Off'}`,
              onAction: () => dispatch({ type: 'SET_AUTO_ADD_LOCATIONS', companyId: company.id, on: !company.autoAddLocations }),
            },
            { content: 'Delete', destructive: true, onAction: () => setConfirmDelete(true) },
          ]}
        >
          More actions
        </MenuButton>
      </div>

      <div className="cd-layout">
        <div className="cd-main">
          {/* Name and subtitle, then the overview's numbers; View analytics, by its title,
              opens its own page. */}
          <div className="cd-intro">
            <div>
              <h1 className="cd-title">{company.name}</h1>
              <p className="cd-subtitle">
                {`${company.source ? `From ${company.source}` : 'Active'} · ${locationCount} location${locationCount === 1 ? '' : 's'}`}
              </p>
            </div>
            <section>
              <div className="cd-section__head">
                <h2 className="cd-section__title">Company overview</h2>
                {versionFlags().analytics && (
                  <s-link onClick={() => dispatch({ type: 'SET_COMPANY_TAB', tab: 'analytics' })}>View analytics</s-link>
                )}
              </div>
              <div className="cd-stats">
                <Stat label="Sales" value={money(totalSales)} note="All-time from this company" />
                <Stat label="Orders" value={String(orders.length)} note="Placed by its buyers" />
                <Stat label="Quotes" value={String(quoteCount)} note="RFQ requests from here" />
              </div>
            </section>
          </div>
          <div id="company-locations" style={scrollMargin}>
            <LocationsTab company={company} />
          </div>
          <div id="company-orders" style={scrollMargin}>
            <OrdersTab company={company} />
          </div>
          <div id="company-quotes" style={scrollMargin}>
            <QuotesTab company={company} />
          </div>
        </div>

        <div className="cd-side">
          <SideBlock title="General">
            <SideRow label="Name">{company.name}</SideRow>
            <SideRow label="Main contact">{company.mainContact || '—'}</SideRow>
            <SideRow label="Source">{company.source || '—'}</SideRow>
          </SideBlock>
          <div id="company-contacts" style={scrollMargin}>
            <ContactsTab company={company} />
          </div>
          <CompanyPricingCard company={company} onAddPricing={() => setPickPricingType(true)} />
          {versionFlags().agreements && (
            <div id="company-contract" style={scrollMargin}>
              <CompanyContractCard company={company} />
            </div>
          )}
          {versionFlags().orderLimits && (
            <div id="company-limits" style={scrollMargin}>
              <CompanyLimitsCard company={company} />
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} heading={`Delete ${company.name}?`}>
          <s-paragraph>
            This removes {company.name} from the B2B app — its {locationCount} location
            {locationCount === 1 ? '' : 's'}, {(company.contacts || []).length} contact
            {(company.contacts || []).length === 1 ? '' : 's'}
            {assignedCount ? `, and unassigns ${assignedCount} pricing profile${assignedCount === 1 ? '' : 's'}` : ''}. The
            Shopify company record is not affected.
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              setConfirmDelete(false);
              dispatch({ type: 'DELETE_COMPANY', id: company.id });
            }}
          >
            Delete company
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmDelete(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </div>
  );
}

// One of the overview's numbers, in a tile of equal width: label, value, then a note.
function Stat({ label, value, note }) {
  return (
    <div className="cd-stat">
      <div className="cd-stat__label">{label}</div>
      <div className="cd-stat__value">{value}</div>
      <div className="cd-stat__note">{note}</div>
    </div>
  );
}
