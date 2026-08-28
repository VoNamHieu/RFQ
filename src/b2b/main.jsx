import React from 'react';
import { createRoot } from 'react-dom/client';
import { PolarisProvider } from '../shared/PolarisProvider.jsx';
import { StoreProvider } from './store.jsx';
import { App } from './App.jsx';

createRoot(document.getElementById('root')).render(
  <PolarisProvider>
    <StoreProvider>
      <App />
    </StoreProvider>
  </PolarisProvider>,
);
