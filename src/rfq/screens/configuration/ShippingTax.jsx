import React, { useState } from 'react';
import { SaveBar, useWcId } from '../../../shared/wc.jsx';
import productImage from './assets/product_image.webp';
import { RadioGroup, clone, same, useToast } from './ui.jsx';
import './cost.css';

// Production: components/ShippingSetting (index.jsx, CustomRule.jsx, Preview/index.jsx)
// and components/TaxSetting/index.jsx. Each tab has its own contextual save bar.

const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toNumber = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const fixed = (v) => toNumber(v).toFixed(2);

const DEFAULT_RULE = { limit_price: '0.00', shipping_price: '0.00', type: 'SMALLER' };

const MAX_RULES = 5;

// shippingSettingSlice.formatCustomRulePrices: 2-decimal prices, and the "Subtotal over"
// rule always starts where the highest "Subtotal up to" rule ends.
function formatRules(rules) {
  let maxLimit = 0;
  const next = rules.map((r) => {
    if (r.type === 'SMALLER') maxLimit = Math.max(maxLimit, toNumber(r.limit_price));
    return { ...r, limit_price: fixed(r.limit_price), shipping_price: fixed(r.shipping_price) };
  });
  return next.map((r) => (r.type === 'BIGGER_OR_EQUAL' ? { ...r, limit_price: fixed(maxLimit) } : r));
}

// ---------------------------------------------------------------------------
// Shipping
// ---------------------------------------------------------------------------
export function ShippingSetting({ saved, onSave }) {
  const toast = useToast();
  const id = useWcId('qcfg-ship');
  const [setting, setSetting] = useState(() => clone(saved));
  const [labelError, setLabelError] = useState(null);
  const dirty = !same(setting, saved);

  const change = (key, value) => {
    setLabelError(null);
    setSetting((s) => ({ ...s, [key]: value }));
  };

  const rules = setting.custom_rules;
  const addDisabled = rules.length >= MAX_RULES;
  const setRules = (next) => change('custom_rules', next);
  const addRule = (index) => setRules(formatRules(rules.flatMap((r, i) => (i === index ? [r, { ...DEFAULT_RULE }] : [r]))));
  const removeRule = (index) => setRules(formatRules(rules.filter((_, i) => i !== index)));
  const changeRule = (index, key, value) => setRules(rules.map((r, i) => (i === index ? { ...r, [key]: value } : r)));

  const save = () => {
    if (setting.type !== 'DISABLED' && !setting.label.trim()) {
      setLabelError('The label field is required.');
      return;
    }
    const next = { ...setting, label: setting.label.trim(), custom_rules: formatRules(setting.custom_rules) };
    setSetting(next);
    onSave(next);
    toast('Settings saved!');
  };

  return (
    <>
      {dirty ? (
        <SaveBar
          onSave={save}
          onDiscard={() => {
            setSetting(clone(saved));
            setLabelError(null);
          }}
        />
      ) : null}
      <s-stack gap="base">
        <s-section>
          <s-stack gap="small-200">
            <s-text fontWeight="medium">Settings</s-text>
            <RadioGroup
              name={`${id}-type`}
              label="Select option"
              value={setting.type}
              onChange={(v) => change('type', v)}
              options={[
                { value: 'DISABLED', label: 'Do not apply this setting' },
                { value: 'SHOPIFY', label: 'Use Shopify shipping rates' },
                { value: 'CUSTOM', label: 'Define custom shipping rates by quote value' },
              ]}
            />
          </s-stack>
        </s-section>

        {setting.type !== 'DISABLED' ? (
          <s-section>
            <s-stack gap="small-200">
              <s-text fontWeight="medium">Shipping label</s-text>
              <s-text-field
                label="Label"
                required
                maxLength={20}
                value={setting.label}
                error={labelError || undefined}
                onInput={(e) => change('label', e.currentTarget.value)}
              />
            </s-stack>
          </s-section>
        ) : null}

        {setting.type === 'CUSTOM' ? (
          <s-section>
            <s-stack gap="small-200">
              <s-text fontWeight="medium">Shipping rates by Quote subtotal</s-text>
              <div className="qcfg-cost-rules">
                {rules.map((rule, index) => {
                  const isOver = rule.type === 'BIGGER_OR_EQUAL';
                  return (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={index} className="qcfg-cost-rule">
                      <s-text-field
                        label={isOver ? 'Subtotal over' : 'Subtotal up to'}
                        prefix="$"
                        readOnly={isOver}
                        value={rule.limit_price}
                        onInput={(e) => changeRule(index, 'limit_price', e.currentTarget.value)}
                        onBlur={() => setRules(formatRules(rules))}
                      />
                      <s-text-field
                        label="Price"
                        prefix="$"
                        value={rule.shipping_price}
                        onInput={(e) => changeRule(index, 'shipping_price', e.currentTarget.value)}
                        onBlur={() => setRules(formatRules(rules))}
                      >
                        {!toNumber(rule.shipping_price) ? <s-badge slot="accessory">Free</s-badge> : null}
                      </s-text-field>
                      {!isOver ? (
                        <s-stack direction="inline" gap="small-400" alignItems="center">
                          <s-text interestFor={`${id}-add-${index}`}>
                            <s-button
                              variant="tertiary"
                              icon="plus-circle"
                              accessibilityLabel="Add"
                              disabled={addDisabled}
                              onClick={() => addRule(index)}
                            />
                          </s-text>
                          <s-tooltip id={`${id}-add-${index}`}>
                            {addDisabled ? 'You have exceeded the 5 conditions limit' : 'Add'}
                          </s-tooltip>
                          {rules.length > 2 ? (
                            <>
                              <s-button
                                variant="tertiary"
                                tone="critical"
                                icon="delete"
                                accessibilityLabel="Remove"
                                interestFor={`${id}-remove-${index}`}
                                onClick={() => removeRule(index)}
                              />
                              <s-tooltip id={`${id}-remove-${index}`}>Remove</s-tooltip>
                            </>
                          ) : null}
                        </s-stack>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </s-stack>
          </s-section>
        ) : null}

        <Preview previewType="shipping" shipping={setting} />
      </s-stack>
    </>
  );
}

// ---------------------------------------------------------------------------
// Preview (ShippingSetting/Preview) — shared by the Shipping and Tax tabs
// ---------------------------------------------------------------------------
const SHOPIFY_METHODS = [
  { label: 'Standard Delivery', value: 12 },
  { label: 'Same-day Delivery', value: 24 },
];

function Preview({ previewType, shipping, tax }) {
  const [quantity, setQuantity] = useState('1');
  const [method, setMethod] = useState(0);
  const [showDisplayBanner, setShowDisplayBanner] = useState(true);
  const [showReferenceBanner, setShowReferenceBanner] = useState(true);

  const qty = toNumber(quantity);
  const productPrice = 120;
  const total = productPrice * qty;
  let shippingPrice = 12;
  if (shipping?.type === 'DISABLED') shippingPrice = 0;
  if (shipping?.type === 'CUSTOM') {
    const sorted = [...(shipping.custom_rules || [])].sort((a, b) => toNumber(a.limit_price) - toNumber(b.limit_price));
    for (const rule of sorted) {
      const smallerHit = rule.type === 'SMALLER' && toNumber(rule.limit_price) > total;
      const biggerHit = rule.type === 'BIGGER_OR_EQUAL' && toNumber(rule.limit_price) <= total;
      if (smallerHit || biggerHit) {
        shippingPrice = toNumber(rule.shipping_price);
        break;
      }
    }
  }
  if (shipping?.type === 'SHOPIFY') shippingPrice = SHOPIFY_METHODS[method].value;

  const right = (children, bold) => (
    <div style={{ textAlign: 'end' }}>
      <s-text fontSize="small" fontWeight={bold ? 'medium' : undefined}>
        {children}
      </s-text>
    </div>
  );

  return (
    <s-stack gap="base">
      {showDisplayBanner ? (
        // Production: <Card><Banner …/></Card>. The div keeps s-section from going "banner-only"
        // (no padding/background), so the banner sits inside a padded white card.
        <s-section>
          <div>
            <s-banner heading="Setting display" tone="info" dismissible onDismiss={() => setShowDisplayBanner(false)}>
              <s-text fontSize="small">
                {previewType === 'shipping'
                  ? 'Shipping is displayed on Step 2 of the Quote Form'
                  : 'Tax is displayed on Step 2 of the Quote Form'}
              </s-text>
            </s-banner>
          </div>
        </s-section>
      ) : null}

      <s-section padding="none">
        <s-box padding="base" paddingBlockEnd="small-200">
          <s-grid gridTemplateColumns="1fr auto" alignItems="center">
            <s-text fontSize="small" fontWeight="medium">
              Product
            </s-text>
            <s-text fontSize="small" fontWeight="medium">
              Total Price
            </s-text>
          </s-grid>
        </s-box>
        <s-divider />
        <s-box padding="base">
          <s-stack gap="small-200">
            <s-grid gridTemplateColumns="auto minmax(0, 1fr)" gap="small" alignItems="start">
              <s-stack gap="small-300" alignItems="center">
                <s-thumbnail size="small" src={productImage} alt="Garden machine" />
                <div style={{ width: 56 }}>
                  <s-text-field
                    label="Quant"
                    labelAccessibilityVisibility="exclusive"
                    autocomplete="off"
                    value={quantity}
                    onInput={(e) => setQuantity(e.currentTarget.value)}
                  />
                </div>
              </s-stack>
              <s-stack gap="small-400">
                <s-text fontSize="small" fontWeight="medium">
                  Garden machine
                </s-text>
                <s-stack gap="none">
                  <s-text fontSize="small" color="subdued">{`Price: ${money(productPrice)}`}</s-text>
                  <s-text fontSize="small" color="subdued">
                    SKU: AB1346
                  </s-text>
                  <s-text fontSize="small" color="subdued">
                    Color: Yellow
                  </s-text>
                </s-stack>
              </s-stack>
            </s-grid>
            {right(money(total), true)}
          </s-stack>
        </s-box>
        <s-divider />
        <s-box padding="base" paddingBlockStart="small-200">
          <s-stack gap="small-200">
            <s-stack gap="small-400">
              {right(`Subtotal: ${money(total)}`)}
              {previewType === 'shipping' && shipping.type !== 'DISABLED' ? right(`${shipping.label}: ${money(shippingPrice)}`) : null}
              {previewType === 'tax' ? right(`${tax?.tax_label ?? ''}: ${money(12)}`) : null}
            </s-stack>
            {right(`Total: ${previewType === 'shipping' ? money(total + shippingPrice) : money(132)}`, true)}
          </s-stack>
        </s-box>
      </s-section>

      {previewType === 'shipping' && shipping.type === 'SHOPIFY' ? (
        <s-section>
          <s-stack gap="small-200">
            <s-text fontSize="small" fontWeight="medium">
              Shipping method
            </s-text>
            {showReferenceBanner ? (
              <s-banner tone="info" dismissible onDismiss={() => setShowReferenceBanner(false)}>
                Displayed options are for reference purposes only
              </s-banner>
            ) : null}
            <s-box border="base" borderRadius="base">
              {SHOPIFY_METHODS.map((m, index) => (
                <React.Fragment key={m.label}>
                  {index > 0 ? <div className="qcfg-cost-divider-focus" /> : null}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={method === index}
                    className={`qcfg-shipmethod${method === index ? ' qcfg-shipmethod--selected' : ''}`}
                    onClick={() => setMethod(index)}
                  >
                    <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span className={`qcfg-radio-dot${method === index ? ' qcfg-radio-dot--on' : ''}`} />
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <s-text>{m.label}</s-text>
                        <s-text fontWeight="medium" color="subdued">
                          {money(m.value)}
                        </s-text>
                      </span>
                    </span>
                  </button>
                </React.Fragment>
              ))}
            </s-box>
          </s-stack>
        </s-section>
      ) : null}
    </s-stack>
  );
}

// ---------------------------------------------------------------------------
// Tax
// ---------------------------------------------------------------------------
export function TaxSetting({ saved, onSave }) {
  const toast = useToast();
  const id = useWcId('qcfg-tax');
  const [setting, setSetting] = useState(() => clone(saved));
  const [error, setError] = useState(null);
  const dirty = !same(setting, saved);

  const change = (key, value) => {
    setError(null);
    setSetting((s) => ({ ...s, [key]: value }));
  };

  const save = () => {
    const next = { ...setting, tax_label: setting.tax_label.trim() };
    if (!next.tax_label) {
      setError('This field is required');
      return;
    }
    setSetting(next);
    onSave(next);
    toast('Settings saved!');
  };

  return (
    <>
      {dirty ? (
        <SaveBar
          onSave={save}
          onDiscard={() => {
            setSetting(clone(saved));
            setError(null);
          }}
        />
      ) : null}
      <s-query-container>
        {/* Polaris Layout (section + oneThird) wraps below ~744px, which is the case inside this column on desktop. */}
        <s-grid
          gridTemplateColumns='@container (inline-size > 744px) "minmax(0, 2fr) minmax(0, 1fr)", "minmax(0, 1fr)"'
          gap="base"
          alignItems="start"
        >
          <s-stack gap="base">
            <s-section>
              <s-stack gap="small-200">
                <s-stack gap="none">
                  <s-stack direction="inline" gap="small-400" alignItems="center">
                    <s-text fontWeight="bold">Settings</s-text>
                    <s-link
                      href="https://help.omegatheme.com/en/article/cost-management-shipping-tax-settings-cnolyx/#1-tax-settings"
                      target="_blank"
                      accessibilityLabel="Read more"
                      interestFor={`${id}-more`}
                    >
                      <s-icon type="info" />
                    </s-link>
                    <s-tooltip id={`${id}-more`}>Read more</s-tooltip>
                  </s-stack>
                  <s-text color="subdued">Configure how tax is displayed on the quote form</s-text>
                </s-stack>
                <s-paragraph>Select option</s-paragraph>
                <s-stack gap="small-400">
                  <s-checkbox
                    label="Use Shopify tax rates"
                    details="Displays tax on the quote form based on your Shopify tax settings"
                    checked={!!setting.is_use_shopify_tax}
                    onChange={(e) => change('is_use_shopify_tax', e.currentTarget.checked ? 1 : 0)}
                  />
                  {setting.is_use_shopify_tax ? (
                    <s-box paddingInlineStart="large-200">
                      <s-stack gap="none">
                        <s-stack direction="inline" gap="small-200" alignItems="center">
                          <s-checkbox
                            label="Display the price before tax on the quote form"
                            checked={!!setting.show_price_before_tax}
                            onChange={(e) => change('show_price_before_tax', e.currentTarget.checked ? 1 : 0)}
                          />
                          <s-badge tone="info">Tax-inclusive pricing</s-badge>
                        </s-stack>
                        <div className="qcfg-cost-nested-help">
                          <s-text color="subdued" fontSize="small">
                            For tax-inclusive pricing, this option allows the form to display the base price before tax
                          </s-text>
                        </div>
                      </s-stack>
                    </s-box>
                  ) : null}
                </s-stack>
              </s-stack>
            </s-section>
            {setting.is_use_shopify_tax ? (
              <s-section>
                <s-stack gap="small-200">
                  <s-text fontWeight="bold">Tax label</s-text>
                  <s-text-field
                    label="Label"
                    required
                    maxLength={20}
                    value={setting.tax_label}
                    error={error || undefined}
                    onInput={(e) => change('tax_label', e.currentTarget.value)}
                  />
                </s-stack>
              </s-section>
            ) : null}
          </s-stack>
          <Preview previewType="tax" tax={setting} />
        </s-grid>
      </s-query-container>
    </>
  );
}
