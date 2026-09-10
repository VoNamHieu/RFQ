import React, { useState } from 'react';
import { Modal, Text, InlineStack, BlockStack, Box, Button, Banner } from '@shopify/polaris';
import { ChevronRightIcon } from '@shopify/polaris-icons';
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

export function CatalogPickerModal({ customer, onClose, onAdd, initialSelected, onPickFromStore, onCreateCatalog }) {
  const catalogs = (customer && RFQ_SHOPIFY_CATALOGS[customer.companyKey]) || [];
  const [catalogId, setCatalogId] = useState(catalogs.length === 1 ? catalogs[0].id : null);

  const storeAction = onPickFromStore ? { content: 'Add product from Shopify', onAction: onPickFromStore } : undefined;
  const catalogAction = onCreateCatalog ? { content: 'Set up a catalog', onAction: onCreateCatalog } : undefined;

  // No catalog assigned → an empty-state warning (D2C customers, or a B2B company
  // without a Shopify catalog yet), with a CTA to the whole-store picker.
  if (catalogs.length === 0) {
    return (
      <Modal open onClose={onClose} title="Add product from catalog" secondaryActions={[{ content: 'Close', onAction: onClose }]}>
        <Modal.Section>
          <Banner tone="info" title={`${customer?.company || 'This company'} has no Shopify catalog yet`} action={storeAction} secondaryAction={catalogAction}>
            <Text as="p">
              No Shopify B2B catalog has been assigned to this company yet. Add products from your store to create this
              quote, or set up a catalog for this company in <Text as="span" fontWeight="semibold">Shopify → Markets → Catalogs</Text>.
            </Text>
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
                  <Button icon={ChevronRightIcon} variant="tertiary" accessibilityLabel={`Select ${c.name}`} onClick={() => setCatalogId(c.id)} />
                </InlineStack>
              </Box>
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }

  // Step 2: the shared Shopify-style picker for the chosen catalog.
  const products = catalogProducts(activeCatalog);
  const backToCatalogs = catalogs.length > 1 ? { content: '← Catalogs', onAction: () => setCatalogId(null) } : { content: 'Close', onAction: onClose };

  // Chosen catalog has no products published → empty-state warning + CTA.
  if (products.length === 0) {
    return (
      <Modal open onClose={onClose} title={`Add from ${activeCatalog.name}`} secondaryActions={[backToCatalogs]}>
        <Modal.Section>
          <Banner tone="info" title={`${activeCatalog.name} has no products yet`} action={storeAction} secondaryAction={catalogAction}>
            <Text as="p">
              This catalog doesn’t have any products published yet. Add products from your store to create this quote,
              or add them to this catalog in <Text as="span" fontWeight="semibold">Shopify → Markets → Catalogs</Text>.
            </Text>
          </Banner>
        </Modal.Section>
      </Modal>
    );
  }

  return (
    <ProductPickerModal
      title={`Add from ${activeCatalog.name}`}
      products={products}
      priceHeader="Catalog price"
      priced
      initialSelected={initialSelected}
      onClose={onClose}
      onAdd={onAdd}
      backAction={catalogs.length > 1 ? { content: '← Catalogs', onAction: () => setCatalogId(null) } : { content: 'Cancel', onAction: onClose }}
    />
  );
}
