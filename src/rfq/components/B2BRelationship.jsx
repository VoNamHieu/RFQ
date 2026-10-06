import React from 'react';
import { useStore, handoffToB2B, managedCompanyKeyForEmail } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/companies.js';
import { money2 } from '../utils.js';

const quoteValueOf = (quote) => {
  const lines = quote.lines && quote.lines.length
    ? quote.lines
    : [{ price: quote.product?.price, qty: quote.product?.quantity ?? 1 }];
  return lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty ?? l.quantity) || 1), 0);
};

function SummaryRow({ label, value }) {
  return (
    <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
      <s-text color="subdued" fontSize="small">{label}</s-text>
      <s-text fontWeight="medium">{value}</s-text>
    </s-grid>
  );
}

// Card header: "B2B relationship" title with the status badge on the right.
function CardHeader({ children }) {
  return (
    <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
      <s-heading>B2B relationship</s-heading>
      {children}
    </s-grid>
  );
}

// The RFQ↔B2B relationship card. The sync flow and the create-company overlay it
// launches live in sibling files; re-exported so callers keep one import.
export { SyncFlowModals } from './SyncFlowModals.jsx';
export { CreateCompanyModal } from './CreateCompanyModal.jsx';
export { CompanyCreatedModal } from './CompanyCreatedModal.jsx';

function companyKeyOf(quote) {
  return (
    quote.syncedCompanyKey ||
    quote.linkedCompanyKey ||
    quote.fixedCompanyKey ||
    quote.recommendedKey ||
    quote.previewCompanyKey ||
    null
  );
}

// Right-column B2B relationship card (spec §5.6): four states.
export function B2BRelationshipCard({ quote }) {
  const { state: rfqState, dispatch } = useStore();
  const key = companyKeyOf(quote);
  const company = key ? shopifyCompanyDirectory[key] : null;
  const state = quote.state;

  if (state === 'uninstalled') {
    return (
      <s-section>
        <s-stack gap="small">
          <CardHeader>
            <s-badge>App not installed</s-badge>
          </CardHeader>
          <s-paragraph color="subdued" fontSize="small">
            {quote.scenario === 'Merchant created — B2B app not installed'
              ? `${company?.name || 'This company'} isn’t on the Wholesale B2B app yet, so this quote stays in QuoteSnap RFQ. Install the app to manage this buyer as a company with shared pricing and quote history.`
              : 'Install QuoteSnap B2B to manage this buyer as a company with shared pricing and quote history.'}
          </s-paragraph>
          <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="small-200">
            <Stat label="Quotes" value={String(quote.quoteCount ?? 1)} />
            <Stat label="Quoted value" value={money2(quoteValueOf(quote))} />
          </s-grid>
          <s-stack direction="inline" gap="small-200">
            <s-button onClick={() => dispatch({ type: 'INSTALL_B2B', id: quote.number })}>Install QuoteSnap B2B</s-button>
            <s-button variant="tertiary" onClick={() => dispatch({ type: 'TOAST', message: 'Learn more' })}>Learn more</s-button>
          </s-stack>
          <s-paragraph color="subdued" fontSize="small">Prefills your first company on install — nothing created automatically.</s-paragraph>
        </s-stack>
      </s-section>
    );
  }

  // The customer is already managed under a company via another quote, but THIS
  // quote isn't linked yet — show a consistent "in B2B" card (not "not identified")
  // so all of a customer's quotes agree on their B2B membership.
  const managedKey = managedCompanyKeyForEmail(rfqState.quotes, quote.customer?.email);
  const selfLinked = !!(quote.syncedCompanyKey || quote.linkedCompanyKey);
  if (state !== 'linked' && state !== 'shopifySynced' && managedKey && !selfLinked) {
    const managed = shopifyCompanyDirectory[managedKey];
    const buyerName = quote.customer?.name || 'This customer';
    return (
      <s-section>
        <s-stack gap="small">
          <CardHeader>
            <s-badge tone="info">In B2B app</s-badge>
          </CardHeader>
          <s-paragraph color="subdued" fontSize="small">
            {`${buyerName} is already a buyer at ${managed?.name || 'a company'} in the B2B app. This quote isn’t part of that company’s history yet — sync it to add it.`}
          </s-paragraph>
          <s-stack gap="small-300">
            <SummaryRow label="Company" value={managed?.name || '—'} />
            <SummaryRow label="Quoted value" value={money2(quoteValueOf(quote))} />
          </s-stack>
          <s-stack direction="inline" gap="small-200">
            <s-button onClick={() => dispatch({ type: 'LINK_QUOTE_TO_COMPANY', id: quote.number, companyKey: managedKey })}>
              Update to B2B
            </s-button>
            <s-button variant="tertiary" onClick={() => handoffToB2B(rfqState, quote.number)}>Open in B2B app</s-button>
          </s-stack>
        </s-stack>
      </s-section>
    );
  }

  if (state === 'new') {
    // Member (syncMode 'fixed') → the company is deterministic; independent
    // (selector) → the merchant still has to pick, so it reads "not identified"
    // and does NOT assert the company's B2B status (mirrors the god file).
    const isMember = quote.syncMode === 'fixed';
    const memberCompany = isMember ? company : null;
    return (
      <s-section>
        <s-stack gap="small">
          <CardHeader>
            <s-badge tone={isMember ? 'caution' : 'info'}>{isMember ? 'Not in B2B app' : 'Company not identified'}</s-badge>
          </CardHeader>
          <s-paragraph color="subdued" fontSize="small">
            {isMember && memberCompany
              ? `Sync ${memberCompany.name} to QuoteSnap B2B app to bring in the full company, including company information, locations, and buyers.`
              : 'No company has been identified for this requester yet. Select a Shopify company to continue syncing to QuoteSnap B2B app.'}
          </s-paragraph>
          <s-grid gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap="small-200">
            <Stat label="Quotes" value={String(quote.quoteCount ?? 1)} />
            <Stat label="Quoted value" value={money2(quoteValueOf(quote))} />
            <Stat label="Company" value={isMember && memberCompany ? memberCompany.name : 'Not selected'} />
          </s-grid>
          <s-button inlineSize="fill" onClick={() => dispatch({ type: 'SYNC_OPEN', id: quote.number })}>
            Sync to B2B app
          </s-button>
        </s-stack>
      </s-section>
    );
  }

  // shopifySynced or linked → managed
  const companyName = company?.name || quote.createdCompanyName || '—';
  const locations = company?.locations ?? 1;
  const buyers = company?.buyers ?? 1;

  return (
    <s-section>
      <s-stack gap="small">
        <CardHeader>
          <s-badge tone="success">Managed</s-badge>
        </CardHeader>
        <s-stack gap="small-300">
          <SummaryRow label="Company" value={companyName} />
          <SummaryRow label="Locations" value={String(locations)} />
          <SummaryRow label="Buyers" value={String(buyers)} />
          <SummaryRow label="Quoted value" value={money2(quoteValueOf(quote))} />
          {company?.shopifyId ? (
            <s-text color="subdued" fontSize="small">{`Shopify company ${company.shopifyId}`}</s-text>
          ) : (
            <s-text color="subdued" fontSize="small">Newly created company</s-text>
          )}
        </s-stack>
        <s-divider />
        <s-stack direction="inline" gap="small-200">
          <s-button onClick={() => handoffToB2B(rfqState, quote.number)}>
            {state === 'linked' ? 'View in B2B app' : 'Open in B2B app'}
          </s-button>
          <s-button variant="tertiary" onClick={() => dispatch({ type: 'TOAST', message: 'Opens in Shopify' })}>
            Open in Shopify
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}

function Stat({ label, value }) {
  return (
    <s-box background="subdued" padding="small-200" borderRadius="base">
      <s-stack gap="small-500">
        <s-text color="subdued" fontSize="small">
          {label}
        </s-text>
        <s-text fontSize="large" fontWeight="semibold">
          {value}
        </s-text>
      </s-stack>
    </s-box>
  );
}
