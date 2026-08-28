import React from 'react';
import { Page, Card, Text, BlockStack } from '@shopify/polaris';

export function App() {
  return (
    <Page title="Wholesale B2B Solution">
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Polaris React scaffold
          </Text>
          <Text as="p" tone="subdued">
            B2B app — Vite + React + @shopify/polaris is running. Screens migrate in next.
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}
