import React from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, Button, Banner, List } from '@shopify/polaris';
import { ChevronRightIcon } from '@shopify/polaris-icons';
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
      <Modal
        open
        onClose={() => setPicker(null)}
        title="Add B2B price"
        secondaryActions={[{ content: 'Cancel', onAction: () => setPicker(null) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            {/* Only meaningful when there's actually a pricing to choose — otherwise
                the banner below carries the "no pricing / not installed" message. */}
            {templates.length > 0 && (
              <Text as="p" tone="subdued" variant="bodySm">
                Choose a base pricing attached to {customer?.company} in the B2B app, then pick products.
              </Text>
            )}
            {templates.length === 0 ? (
              <Banner
                tone={appInstalled ? 'warning' : 'info'}
                title={
                  appInstalled
                    ? `${customer?.company || customer?.name || 'This customer'} has no B2B pricing yet`
                    : 'Turn one-time buyers into repeat B2B customers'
                }
                action={onCreatePricing ? { content: appInstalled ? 'Create pricing' : 'Install B2B app', onAction: onCreatePricing } : undefined}
              >
                {appInstalled ? (
                  <Text as="p">
                    No pricing has been set up for this company yet. Create B2B pricing to quickly add products at agreed prices to this and future quotes, or use <Text as="span" fontWeight="semibold">Add product</Text> instead.
                  </Text>
                ) : (
                  <BlockStack gap="200">
                    <Text as="p">
                      Convert buyers like <Text as="span" fontWeight="semibold">{customer?.company || 'this one'}</Text> into managed B2B companies with agreed pricing — so you don’t have to re-quote the same products and prices every time they reorder.
                    </Text>
                    <List>
                      <List.Item>Manage company accounts with multiple locations, buyers, and roles</List.Item>
                      <List.Item>Set contract pricing, quantity breaks, and product-specific prices</List.Item>
                      <List.Item>Let buyers reorder at agreed prices with access to their quote and order history</List.Item>
                    </List>
                    <Text as="span" tone="subdued" variant="bodySm">
                      You can still create this quote now using <Text as="span" fontWeight="semibold">Add product</Text>.
                    </Text>
                  </BlockStack>
                )}
              </Banner>
            ) : (
              templates.map((t) => (
                <Box key={t.id} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="medium">{t.name}</Text>
                      <Text as="span" tone="subdued" variant="bodySm">{`Priority ${t.priority}`}</Text>
                    </BlockStack>
                    <Button icon={ChevronRightIcon} variant="tertiary" accessibilityLabel={`Select ${t.name}`} onClick={() => setPicker({ ...picker, templateId: t.id })} />
                  </InlineStack>
                </Box>
              ))
            )}
          </BlockStack>
        </Modal.Section>
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
