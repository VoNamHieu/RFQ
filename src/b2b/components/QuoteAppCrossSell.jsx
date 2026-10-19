import React from 'react';
import { withVersion } from '../../shared/versions.js';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import emptyStateArt from '../assets/empty-state.png';

// The RFQ app's Shopify App Store listing — where a merchant without it goes to install.
const RFQ_APP_STORE_URL = 'https://apps.shopify.com/request-for-quote-by-omega';

// No quote has come in from the O:Request a Quote app anywhere in the store: either the
// app isn't installed, or it is but hasn't received a quote yet.
export function noQuotesFromRfqApp(db) {
  return !db.rfqAppInstalled || (db.quotes || []).length === 0;
}

// Cross-sell to the RFQ app, shown where quotes would be (Analytics → Quotes, company
// Quotes tab) while noQuotesFromRfqApp() holds. Installed → open it; not installed → install.
export function QuoteAppCrossSell({ installed }) {
  return installed ? (
    <EmptyBlock
      image={emptyStateArt}
      imageAlt=""
      heading="No quotes yet"
      action={{ content: 'Open RFQ app', onAction: () => { window.location.href = withVersion('/'); } }}
    >
      Quotes from the O:Request a Quote app will show up here. Open the app to start collecting quote requests.
    </EmptyBlock>
  ) : (
    <EmptyBlock
      image={emptyStateArt}
      imageAlt=""
      heading="Install O:Request a Quote"
      action={{ content: 'Install app', onAction: () => window.open(RFQ_APP_STORE_URL, '_blank', 'noopener') }}
    >
      Quotes come from the O:Request a Quote app. Install it to collect quote requests and turn agreed prices into B2B pricing.
    </EmptyBlock>
  );
}
