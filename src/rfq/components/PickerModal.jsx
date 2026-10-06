import React from 'react';
import { Modal } from '../../shared/wc.jsx';
import { RFQ_CATALOG, RFQ_PRICING_OPTIONS, RFQ_TEMPLATE_PRODUCTS } from '../data/catalog.js';
import { ProductPickerModal } from './ProductPickerModal.jsx';

// The B2B-price product flow for Create quote:
//   Step 1 — pick a base-pricing template attached to the customer's company.
//   Step 2 — the shared Shopify-style ProductPickerModal (checkbox-only, same as
//            "Add product"): products come in at the template's B2B price, qty 1,
//            then price/qty are edited in the quote's line table. (A single-variant
//            product's variant id === its sku.)
const catBySku = (sku) => RFQ_CATALOG.find((p) => p.sku === sku);

export function PickerModal({ picker, setPicker, customer, onAdd, onCreatePricing, appInstalled = true, onQuote }) {
  const templates = customer ? RFQ_PRICING_OPTIONS[customer.companyKey] || [] : [];

  // Step 1: pick a base-price template.
  if (!picker.templateId) {
    return (
      <Modal onClose={() => setPicker(null)} heading="Add B2B price">
        <s-stack gap="small">
          {/* Only meaningful when there's actually a pricing to choose — otherwise
              the banner below carries the "no pricing / not installed" message. */}
          {templates.length > 0 && (
            <s-paragraph color="subdued" fontSize="small">
              Choose a base pricing attached to {customer?.company} in the B2B app, then pick products.
            </s-paragraph>
          )}
          {templates.length === 0 ? (
            <s-banner
              tone={appInstalled ? 'warning' : 'info'}
              heading={
                appInstalled
                  ? `${customer?.company || customer?.name || 'This customer'} has no B2B pricing yet`
                  : 'Turn one-time buyers into repeat B2B customers'
              }
            >
              {appInstalled ? (
                <s-paragraph>
                  No pricing has been set up for this company yet. Create B2B pricing to quickly add products at agreed prices to this and future quotes, or use <s-text fontWeight="semibold">Add product</s-text> instead.
                </s-paragraph>
              ) : (
                <s-stack gap="small-200">
                  <s-paragraph>
                    Convert buyers like <s-text fontWeight="semibold">{customer?.company || 'this one'}</s-text> into managed B2B companies with agreed pricing — so you don’t have to re-quote the same products and prices every time they reorder.
                  </s-paragraph>
                  <s-unordered-list>
                    <s-list-item>Manage company accounts with multiple locations, buyers, and roles</s-list-item>
                    <s-list-item>Set contract pricing, quantity breaks, and product-specific prices</s-list-item>
                    <s-list-item>Let buyers reorder at agreed prices with access to their quote and order history</s-list-item>
                  </s-unordered-list>
                  <s-paragraph color="subdued" fontSize="small">
                    You can still create this quote now using <s-text fontWeight="semibold">Add product</s-text>.
                  </s-paragraph>
                </s-stack>
              )}
              {onCreatePricing ? (
                <s-button slot="secondary-actions" onClick={onCreatePricing}>
                  {appInstalled ? 'Create pricing' : 'Install B2B app'}
                </s-button>
              ) : null}
            </s-banner>
          ) : (
            templates.map((t) => (
              <s-box key={t.id} padding="small" border="base" borderRadius="base">
                <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
                  <s-stack gap="small-500">
                    <s-text fontWeight="medium">{t.name}</s-text>
                    <s-text color="subdued" fontSize="small">{`Priority ${t.priority}`}</s-text>
                  </s-stack>
                  <s-button
                    icon="chevron-right"
                    variant="tertiary"
                    accessibilityLabel={`Select ${t.name}`}
                    onClick={() => setPicker({ ...picker, templateId: t.id })}
                  />
                </s-grid>
              </s-box>
            ))
          )}
        </s-stack>
        <s-button slot="secondary-actions" onClick={() => setPicker(null)}>
          Cancel
        </s-button>
      </Modal>
    );
  }

  // Step 2: the shared Shopify-style picker (checkbox-only, like "Add product"). The
  // template price seeds the default variant; other variants seed from their catalog
  // price. Products are added at that B2B price (qty 1) and adjusted in the line table.
  // Search / sort / select-all / thumbnails / variant expansion come from the shared modal.
  const defPrice = (p, v) => (v.id === p.sku ? p.defaultPrice : v.list ?? p.defaultPrice);
  const products = (RFQ_TEMPLATE_PRODUCTS[picker.templateId] || []).map((t) => {
    const cat = catBySku(t.sku);
    const variants = cat?.variants?.length ? cat.variants : [{ id: t.sku, title: 'Default', list: t.price, stock: cat?.stock }];
    const p = { sku: t.sku, title: cat?.title || t.sku, defaultPrice: t.price, stock: cat?.stock, variants };
    return {
      sku: p.sku,
      title: p.title,
      stock: p.stock,
      variants: p.variants.map((v) => ({ id: v.id, title: v.title, price: defPrice(p, v), stock: v.stock ?? p.stock })),
    };
  });

  const template = templates.find((t) => t.id === picker.templateId);
  return (
    <ProductPickerModal
      title="Add B2B price"
      products={products}
      priced
      priceHeader="B2B price"
      onQuote={onQuote}
      option={{ source: 'b2b', sourceRef: picker.templateId, label: `B2B price · ${template?.name || 'Base pricing'}` }}
      onClose={() => setPicker(null)}
      onAdd={onAdd}
      backAction={{ content: '← Templates', onAction: () => setPicker({ ...picker, templateId: null }) }}
    />
  );
}
