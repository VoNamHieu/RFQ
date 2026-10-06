import React from 'react';
import productImage from './assets/product_image.webp';

// "Checkout page" tab — production components/CollectQuote/CheckoutPage/index.jsx.
// The demo store is on Shopify Plus with a plan that includes the checkout
// extension, so the feature is unlocked (no Plus-required banner).

export function CheckoutPageSettings({ enabled, onChange, showBanner, onDismissBanner, toast }) {
  return (
    <s-section>
      <s-stack gap="small-200">
        <s-heading>Logic</s-heading>
        <s-checkbox
          label="Activate quote checkout extension"
          details="Enable a Request for Quote button at checkout page"
          checked={enabled}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
        <s-box paddingInlineStart="large-200">
          <s-button disabled={!enabled} onClick={() => toast('Opens the Shopify checkout editor')}>
            Manage position
          </s-button>
        </s-box>
        {showBanner && (
          <s-box paddingBlockEnd="base">
            <s-banner tone="info" dismissible onDismiss={onDismissBanner}>
              Quote checkout extension functions separately from Quote button settings. Therefore, please{' '}
              <s-link href="https://help.omegatheme.com/en/article/quote-checkout-extension-rzalfu/" target="_blank">
                review the guideline
              </s-link>{' '}
              before enabling this option
            </s-banner>
          </s-box>
        )}
      </s-stack>
    </s-section>
  );
}

export function CheckoutPagePreview({ enabled }) {
  return (
    <div>
      <s-heading fontSize="large">Preview</s-heading>
      <s-box paddingBlockStart="base">
        <s-stack gap="small">
          <s-heading>Checkout page</s-heading>
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small" alignItems="center">
            <s-stack direction="inline" gap="small" alignItems="center">
              <img className="qset-checkout-img" src={productImage} alt="product image" />
              <s-text>Women Turtleneck</s-text>
            </s-stack>
            <s-text>$129.99</s-text>
          </s-grid>
          <s-grid gridTemplateColumns="1fr auto">
            <s-text color="subdued">Subtotal</s-text>
            <s-text>$129.99</s-text>
          </s-grid>
          <s-grid gridTemplateColumns="1fr auto" alignItems="center">
            <s-heading fontSize="large">Total</s-heading>
            <s-text fontWeight="semibold">$129.99</s-text>
          </s-grid>
          {enabled && (
            <div className="qset-checkout-btn">
              <s-text fontSize="small" fontWeight="semibold">
                Request for quote
              </s-text>
            </div>
          )}
        </s-stack>
      </s-box>
    </div>
  );
}
