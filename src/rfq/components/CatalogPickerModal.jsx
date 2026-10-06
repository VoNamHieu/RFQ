import React, { useState } from 'react';
import { Modal } from '../../shared/wc.jsx';
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

// Banner actions (Polaris React Banner action / secondaryAction) as slot buttons.
function BannerActions({ actions }) {
  return actions.filter(Boolean).map((a) => (
    <s-button key={a.content} slot="secondary-actions" onClick={a.onAction}>
      {a.content}
    </s-button>
  ));
}

export function CatalogPickerModal({ customer, onClose, onAdd, onQuote, onPickFromStore, onCreateCatalog }) {
  const catalogs = (customer && RFQ_SHOPIFY_CATALOGS[customer.companyKey]) || [];
  const [catalogId, setCatalogId] = useState(catalogs.length === 1 ? catalogs[0].id : null);

  const storeAction = onPickFromStore ? { content: 'Add product from Shopify', onAction: onPickFromStore } : undefined;
  const catalogAction = onCreateCatalog ? { content: 'Set up a catalog', onAction: onCreateCatalog } : undefined;

  // No catalog assigned → an empty-state warning (D2C customers, or a B2B company
  // without a Shopify catalog yet), with a CTA to the whole-store picker.
  if (catalogs.length === 0) {
    return (
      <Modal onClose={onClose} heading="Add product from catalog">
        <s-banner tone="info" heading={`${customer?.company || 'This company'} has no Shopify catalog yet`}>
          <s-paragraph>
            No Shopify B2B catalog has been assigned to this company yet. Add products from your store to create this
            quote, or set up a catalog for this company in <s-text fontWeight="semibold">Shopify → Markets → Catalogs</s-text>.
          </s-paragraph>
          <BannerActions actions={[storeAction, catalogAction]} />
        </s-banner>
        <s-button slot="secondary-actions" onClick={onClose}>
          Close
        </s-button>
      </Modal>
    );
  }

  const activeCatalog = catalogs.find((c) => c.id === catalogId) || null;

  // Step 1: choose which catalog (only when there are 2+ and none picked).
  if (!activeCatalog) {
    return (
      <Modal onClose={onClose} heading="Add product from catalog">
        <s-stack gap="small">
          <s-paragraph color="subdued" fontSize="small">
            {`${customer.company} has ${catalogs.length} Shopify catalogs. Choose one, then pick products.`}
          </s-paragraph>
          {catalogs.map((c) => (
            <s-box key={c.id} padding="small" border="base" borderRadius="base">
              <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
                <s-stack gap="small-500">
                  <s-text fontWeight="medium">{c.name}</s-text>
                  <s-text color="subdued" fontSize="small">{`${catalogProductCount(c)} products`}</s-text>
                </s-stack>
                <s-button icon="chevron-right" variant="tertiary" accessibilityLabel={`Select ${c.name}`} onClick={() => setCatalogId(c.id)} />
              </s-grid>
            </s-box>
          ))}
        </s-stack>
        <s-button slot="secondary-actions" onClick={onClose}>
          Cancel
        </s-button>
      </Modal>
    );
  }

  // Step 2: the shared Shopify-style picker for the chosen catalog.
  const products = catalogProducts(activeCatalog);
  const backToCatalogs = catalogs.length > 1 ? { content: '← Catalogs', onAction: () => setCatalogId(null) } : { content: 'Close', onAction: onClose };

  // Chosen catalog has no products published → empty-state warning + CTA.
  if (products.length === 0) {
    return (
      <Modal onClose={onClose} heading={`Add from ${activeCatalog.name}`}>
        <s-banner tone="info" heading={`${activeCatalog.name} has no products yet`}>
          <s-paragraph>
            This catalog doesn’t have any products published yet. Add products from your store to create this quote,
            or add them to this catalog in <s-text fontWeight="semibold">Shopify → Markets → Catalogs</s-text>.
          </s-paragraph>
          <BannerActions actions={[storeAction, catalogAction]} />
        </s-banner>
        <s-button slot="secondary-actions" onClick={backToCatalogs.onAction}>
          {backToCatalogs.content}
        </s-button>
      </Modal>
    );
  }

  return (
    <ProductPickerModal
      title={`Add from ${activeCatalog.name}`}
      products={products}
      priceHeader="Catalog price"
      priced
      onQuote={onQuote}
      option={{ source: 'catalog', sourceRef: activeCatalog.id, label: activeCatalog.name }}
      onClose={onClose}
      onAdd={onAdd}
      backAction={catalogs.length > 1 ? { content: '← Catalogs', onAction: () => setCatalogId(null) } : { content: 'Cancel', onAction: onClose }}
    />
  );
}
