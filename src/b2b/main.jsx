import React from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/wc.css';
import { StoreProvider } from './store.jsx';
import { App } from './App.jsx';
import { LIVE, fetchStore, buildLiveDb } from './live/shopifyLive.js';

const root = createRoot(document.getElementById('root'));
const start = (live = null) =>
  root.render(
    <StoreProvider live={live}>
      <App />
    </StoreProvider>,
  );

// Inside Shopify admin the app opens on the store's records, read first.
if (LIVE) {
  root.render(
    <s-page>
      <s-stack alignItems="center" padding="large-500">
        <s-spinner accessibilityLabel="Loading your store’s data" />
      </s-stack>
    </s-page>,
  );
  fetchStore()
    .then((store) => start({ db: buildLiveDb(store), installationId: store.installationId, currency: store.currency }))
    .catch((e) =>
      root.render(
        <s-page>
          <s-banner tone="critical" heading="Couldn’t load your store’s data">
            {e.message}
          </s-banner>
        </s-page>,
      ),
    );
} else {
  start();
}
