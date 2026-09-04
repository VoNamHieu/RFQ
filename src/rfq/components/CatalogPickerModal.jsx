import React, { useState } from 'react';
import { Modal, Text, InlineStack, BlockStack, Box, Button, Banner } from '@shopify/polaris';
import { RFQ_CATALOG, RFQ_SHOPIFY_CATALOGS } from '../data/catalog.js';
import { ProductPickerModal } from './ProductPickerModal.jsx';

// "Add product from catalog": pick from a company's native Shopify B2B catalog(s)
// — a curated subset of the store at catalog prices. A company location can have
// several catalogs, so step 1 chooses one (skipped when there's only one) and
// step 2 delegates to the shared ProductPickerModal. Distinct from "Add custom
// priced items" (B2B app pricing) and the whole-store picker.

// A catalog's in-catalog products → included variants (with catalog price + stock).
const catalogProducts = (catalog) => {
  const products = [];
  RFQ_CATALOG.forEach((p) => {
    const variants = (p.variants || [])
      .filter((v) => catalog.prices[v.id] != null)
      .map((v) => ({ id: v.id, title: v.title, price: catalog.prices[v.id], stock: v.stock }));
    if (variants.length) products.push({ sku: p.sku, title: p.title, stock: p.stock, variants });
  });
  return products;
};
const catalogProductCount = (catalog) =>
  RFQ_CATALOG.filter((p) => (p.variants || []).some((v) => catalog.prices[v.id] != null)).length;

export function CatalogPickerModal({ customer, onClose, onAdd, initialSelected }) {
  const catalogs = (customer && RFQ_SHOPIFY_CATALOGS[customer.companyKey]) || [];
  const [catalogId, setCatalogId] = useState(catalogs.length === 1 ? catalogs[0].id : null);

  // No catalog assigned → an informative empty modal (D2C customers, or a B2B
  // company without a Shopify catalog yet).
  if (catalogs.length === 0) {
    return (
      <Modal open onClose={onClose} title="Add product from catalog" secondaryActions={[{ content: 'Close', onAction: onClose }]}>
        <Modal.Section>
          <Banner tone="info" title={`No Shopify catalog for ${customer?.company || 'this customer'}`}>
            <p>
              This customer has no products published to a Shopify B2B catalog. Use “Add product → Shopify” to pick from
              the whole store, or assign a catalog in Shopify’s Markets → Catalogs.
            </p>
          </Banner>
        </Modal.Section>
      </Modal>
    );
  }

  const activeCatalog = catalogs.find((c) => c.id === catalogId) || null;

  // Step 1: choose which catalog (only when there are 2+ and none picked).
  if (!activeCatalog) {
    return (
      <Modal open onClose={onClose} title="Add product from catalog" secondaryActions={[{ content: 'Cancel', onAction: onClose }]}>
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" tone="subdued" variant="bodySm">
              {`${customer.company} has ${catalogs.length} Shopify catalogs. Choose one, then pick products.`}
            </Text>
            {catalogs.map((c) => (
              <Box key={c.id} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text as="span" variant="bodyMd" fontWeight="medium">{c.name}</Text>
                    <Text as="span" tone="subdued" variant="bodySm">{`${catalogProductCount(c)} products`}</Text>
                  </BlockStack>
                  <Button onClick={() => setCatalogId(c.id)}>Select</Button>
                </InlineStack>
              </Box>
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // Step 2: the shared Shopify-style picker for the chosen catalog.
  return (
    <ProductPickerModal
      title={`Add from ${activeCatalog.name}`}
      products={catalogProducts(activeCatalog)}
      priceHeader="Catalog price"
      priced
      initialSelected={initialSelected}
      onClose={onClose}
      onAdd={onAdd}
      backAction={catalogs.length > 1 ? { content: '← Catalogs', onAction: () => setCatalogId(null) } : { content: 'Cancel', onAction: onClose }}
    />
  );
}
