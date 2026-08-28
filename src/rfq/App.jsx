import React from 'react';
import { Page, Card, Text, BlockStack } from '@shopify/polaris';

export function App() {
  return (
    <Page title="Request a Quote">
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Polaris React scaffold
          </Text>
          <Text as="p" tone="subdued">
            RFQ app — Vite + React + @shopify/polaris is running. Screens migrate in next.
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}
