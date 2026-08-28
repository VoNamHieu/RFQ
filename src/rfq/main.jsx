import React from 'react';
import { createRoot } from 'react-dom/client';
import { PolarisProvider } from '../shared/PolarisProvider.jsx';
import { App } from './App.jsx';

createRoot(document.getElementById('root')).render(
  <PolarisProvider>
    <App />
  </PolarisProvider>,
);
