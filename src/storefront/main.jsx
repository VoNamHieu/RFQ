import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { StoreProvider } from './store.jsx';
import { App } from './App.jsx';

// Storefront is the customer-facing side — no Polaris here (that's the admin apps).
createRoot(document.getElementById('root')).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
