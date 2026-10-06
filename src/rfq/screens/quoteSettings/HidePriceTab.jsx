import React, { useRef, useState } from 'react';
import { CUSTOMER_MODE } from './data.js';
import { ChoiceGroup, CustomerRules, FieldTitle, ProductRules, StoreModeSwitch } from './parts.jsx';

// "Hide price" tab — production components/CollectQuote/HidePrice/index.jsx + Settings.jsx.

export function HidePriceTab({ settings, onChange, mode, onModeChange, isTouched, errors = {}, toast, banners, setBanner }) {
  const s = settings;
  const customerRef = useRef(null);
  const noHide = s.to_see_price === 4;
  const allPages = !!Number(s.hide_on_all_page);

  const setSeePrice = (value) => {
    const v = Number(value);
    let next = { ...s, to_see_price: v };
    if (v === 4) next = { ...next, type_condition: 'all', applied_customers_mode: 0 };
    onChange(next);
  };

  const enable = (key, checked) => {
    const n = checked ? 1 : 0;
    let next = { ...s, [key]: n };
    if (key === 'hide_on_all_page' && n === 1) next = { ...next, hide_on_product: 1, hide_on_collection: 1 };
    onChange(next);
  };

  const displayOptions = [
    { value: 4, label: 'No, do not hide price' },
    { value: 0, label: 'Hide price only' },
    { value: 1, label: 'Hide price and show text' },
    s.type !== 'b2b' && { value: 2, label: "Hide price and require 'Login' option to see" },
    { value: 3, label: 'Hide price and require password to see' },
  ].filter(Boolean);

  const text = (key) => (e) => onChange({ ...s, [key]: e.currentTarget.value });

  return (
    <s-section>
      <s-stack gap="small">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center">
          <s-heading>Logic</s-heading>
          <StoreModeSwitch mode={mode} onChange={onModeChange} />
        </s-grid>

        <div>
          <ChoiceGroup title="Select option" name="to-see-price" value={s.to_see_price} choices={displayOptions} onChange={setSeePrice} />
          <s-divider />
          {[1, 2, 3].includes(s.to_see_price) && (
            <div>
              <s-box paddingBlockEnd="small-200">
                <s-box paddingBlockEnd="small-200">
                  <FieldTitle>Advanced settings</FieldTitle>
                </s-box>
                {s.to_see_price === 1 && (
                  <s-stack gap="small-200">
                    <s-paragraph>Replace price with</s-paragraph>
                    <s-text-field
                      label="Replace price with"
                      labelAccessibilityVisibility="exclusive"
                      placeholder="Enter text or number"
                      value={s.hide_price_show_text}
                      onInput={text('hide_price_show_text')}
                    />
                  </s-stack>
                )}
                {s.to_see_price === 2 && (
                  <s-stack gap="small-400">
                    <s-text-field label="Text customize" placeholder="Enter full text login" value={s.hide_price_full_text_login ?? ''} onInput={text('hide_price_full_text_login')} />
                    <s-text-field
                      label="Login Text"
                      details="This text will be replaced with the login URL"
                      placeholder="Enter text login"
                      value={s.hide_price_text_login}
                      onInput={text('hide_price_text_login')}
                    />
                    <s-text-field
                      label="Custom URL Login"
                      details="If no custom URL provided, the default URL will be used"
                      placeholder="Enter login URL"
                      value={s.hide_price_login_url}
                      onInput={text('hide_price_login_url')}
                    />
                  </s-stack>
                )}
                {s.to_see_price === 3 && (
                  <s-stack gap="small-400">
                    <s-paragraph>Set up pass</s-paragraph>
                    <s-text-field
                      label="Set up pass"
                      labelAccessibilityVisibility="exclusive"
                      placeholder="Enter pass"
                      value={s.hide_price_enter_pass}
                      error={isTouched && errors.hide_price_enter_pass ? 'You need to enter password' : undefined}
                      onInput={text('hide_price_enter_pass')}
                    />
                  </s-stack>
                )}
              </s-box>
              <s-divider />
            </div>
          )}
        </div>

        <s-stack gap="none">
          <s-box paddingBlockEnd="small-400">
            <FieldTitle>Hide price on what position?</FieldTitle>
          </s-box>
          <s-checkbox
            label="Product page"
            checked={!!Number(s.hide_on_product)}
            disabled={noHide || allPages}
            onChange={(e) => enable('hide_on_product', e.currentTarget.checked)}
          />
          <s-checkbox
            label="Catalog/collection page"
            checked={!!Number(s.hide_on_collection)}
            disabled={noHide || allPages}
            onChange={(e) => enable('hide_on_collection', e.currentTarget.checked)}
          />
          <s-checkbox
            label="All page (product, home, search page etc.)"
            checked={allPages}
            disabled={noHide}
            onChange={(e) => enable('hide_on_all_page', e.currentTarget.checked)}
          />
          {allPages && banners.allPagesHelp && (
            <s-banner tone="info" dismissible onDismiss={() => setBanner('allPagesHelp', false)}>
              <s-paragraph>
                <s-link onClick={() => toast('Opens the 24/7 support chat')}>Contact</s-link> 24/7 support if the function doesn't work on any page via your theme
              </s-paragraph>
            </s-banner>
          )}
          {isTouched && errors.show_on && <s-text tone="critical">This field is required</s-text>}
        </s-stack>
        <s-divider />

        <ProductRules type="hidePrice" settings={s} onChange={onChange} isTouched={isTouched} errors={errors} disabled={noHide} onToast={toast} />
        <s-divider />

        <div ref={customerRef}>
          <CustomerRules type="hidePrice" mode={mode} settings={s} onChange={onChange} isTouched={isTouched} errors={errors} disabled={noHide} />
        </div>

        {banners.country && !noHide && mode !== 'b2b' && s.applied_customers_mode !== CUSTOMER_MODE.COUNTRY && (
          <s-banner tone="info" dismissible onDismiss={() => setBanner('country', false)}>
            <s-paragraph>Hide price for specific countries?</s-paragraph>
            <s-button
              slot="secondary-actions"
              onClick={() => {
                onChange({ ...s, applied_customers_mode: CUSTOMER_MODE.COUNTRY });
                customerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Try now
            </s-button>
          </s-banner>
        )}
      </s-stack>
    </s-section>
  );
}

// HidePrice/index.jsx validateHidePrice.
export function validateHidePrice(s) {
  const e = {};
  if (!(Number(s.hide_on_product) || Number(s.hide_on_collection) || Number(s.hide_on_all_page))) e.show_on = true;
  if (s.type_condition === 'selected' && !s.manual_condition.length) e.selectedProduct = true;
  if (s.type_condition === 'collection' && !s.collection_condition.length) e.selectedCollection = true;
  if (s.type_condition === 'automate' && s.automatically_condition.some((or) => or.some((and) => !String(and.valueCondition ?? '').length))) e.automatically_condition = true;
  if (s.applied_customers_mode === CUSTOMER_MODE.WITH_TAGS && !s.applied_customers_tags.length) e.applied_customers_tags = true;
  if (s.applied_customers_mode === CUSTOMER_MODE.WITHOUT_TAGS && !s.applied_customers_without_tags.length) e.applied_customers_without_tags = true;
  if (s.applied_customers_mode === CUSTOMER_MODE.COUNTRY && !(s.applied_customers_country || []).length) e.applied_customers_country = true;
  if (s.to_see_price === 3 && !String(s.hide_price_enter_pass || '').trim()) e.hide_price_enter_pass = true;
  return Object.keys(e).length ? e : null;
}
