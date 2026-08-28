import React from 'react';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import enTranslations from '@shopify/polaris/locales/en.json';

// Single place that wires the Polaris design system (styles + i18n) around an app.
// Both the RFQ and B2B entry points render their <App/> inside this.
export function PolarisProvider({ children }) {
  return <AppProvider i18n={enTranslations}>{children}</AppProvider>;
}
