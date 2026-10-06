import React, { useMemo, useState } from 'react';
import { Modal, useWcId } from '../../../shared/wc.jsx';
import {
  CART_POSITION_OPTIONS,
  LANGUAGE_OPTIONS,
  POSITION_OPTIONS,
  QUOTE_BUTTON_TRANSLATIONS,
  QUOTE_FORM_LANGUAGES,
  languageLabel,
} from './data.js';
import {
  ButtonStyleEditor,
  ChoiceGroup,
  CustomerRules,
  DisclosureButton,
  FieldTitle,
  InfoIcon,
  InfoTip,
  PolarisIcon,
  ProductRules,
  StoreModeSwitch,
} from './parts.jsx';
import paretoImage from './assets/pareto-integrate.webp';

// "Quote button" tab — production components/CollectQuote/ButtonSettings/index.jsx
// (the Nov 2025 variants: Text & translation card + quote quantity limit).

const PARETO_URL = 'https://apps.shopify.com/quantity-price-breaks-limit-purchase';

// ButtonSettings/QuantityLimit.jsx
function LabelWithTip({ label, tip }) {
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-text>{label}</s-text>
      {tip ? <InfoIcon tip={tip} /> : null}
    </s-stack>
  );
}

function QuantityLimit({ settings, onChange, errors }) {
  const q = settings.quantity_limit_setting;
  const byVariant = Number(q.applied_product_type) === 1;
  const handle = (field, value) => {
    const next = { ...q, [field]: value };
    if (field === 'max_same_as_inventory') next.allow_submit_of_stock = !!value;
    onChange({ ...settings, quantity_limit_setting: next });
  };
  const children = (
    <s-stack gap="small-200">
      <s-select
        label="Quantity limit"
        details={byVariant ? 'Quantity limit will be calculated by each variant of a product separately' : 'Quantity limit will be calculated by total variants of a product'}
        value={String(Number(q.applied_product_type))}
        onChange={(e) => handle('applied_product_type', Number(e.currentTarget.value))}
      >
        <s-option value="0">By product</s-option>
        <s-option value="1">By product variants</s-option>
      </s-select>
      <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap="small-200" alignItems="start">
        <s-stack gap="small-400">
          <LabelWithTip label="Minimum quantity" />
          <s-number-field
            label="Minimum quantity"
            labelAccessibilityVisibility="exclusive"
            inputMode="numeric"
            min={1}
            step={1}
            value={String(q.min_quantity)}
            onInput={(e) => handle('min_quantity', e.currentTarget.value)}
            onBlur={(e) => {
              if (!e.currentTarget.value || Number(e.currentTarget.value) < 1) handle('min_quantity', 1);
            }}
          />
        </s-stack>
        <s-stack gap="small-400">
          <LabelWithTip label="Maximum quantity" tip="Set to 0 for no max quantity limit" />
          {byVariant && q.max_same_as_inventory ? (
            <s-text-field label="Maximum quantity" labelAccessibilityVisibility="exclusive" value="Equal to the inventory" disabled />
          ) : (
            <s-number-field
              label="Maximum quantity"
              labelAccessibilityVisibility="exclusive"
              inputMode="numeric"
              min={0}
              step={1}
              value={String(q.max_quantity)}
              error={errors.maxUnderMin ? `Max quantity cannot be under ${q.min_quantity}` : undefined}
              onInput={(e) => handle('max_quantity', e.currentTarget.value)}
              onBlur={(e) => {
                if (!e.currentTarget.value || Number(e.currentTarget.value) < 0) handle('max_quantity', 0);
              }}
            />
          )}
        </s-stack>
      </s-grid>
      {byVariant && (
        <>
          <s-checkbox
            label="Set the maximum equal to the inventory"
            checked={!!q.max_same_as_inventory}
            onChange={(e) => handle('max_same_as_inventory', e.currentTarget.checked)}
          />
          {!!q.max_same_as_inventory && (
            <s-box paddingInlineStart="large-200">
              <s-checkbox
                label="Allow customers to submit for out-of-stock items"
                checked={!!q.allow_submit_out_of_stock}
                onChange={(e) => handle('allow_submit_out_of_stock', e.currentTarget.checked)}
              />
            </s-box>
          )}
        </>
      )}
    </s-stack>
  );

  return (
    <div>
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <FieldTitle>What is the quote limit?</FieldTitle>
        <InfoTip tip="Read more" href="https://help.omegatheme.com/en/article/quote-button-1hr18hp/#3-4-quote-limit" />
      </s-stack>
      <ChoiceGroup
        name="quantity-limit"
        value={String(!!q.active)}
        onChange={(v) => handle('active', v === 'true')}
        choices={[
          { value: 'false', label: 'Not required' },
          { value: 'true', label: 'Set quote quantity limit', children },
        ]}
      />
    </div>
  );
}

// A checkbox whose label carries extra inline content (tooltip icon) and a
// help text with a link (Polaris Checkbox label={<…/>} helpText={<…/>}).
function RichCheckbox({ label, labelExtra, help, checked, onChange }) {
  return (
    <s-grid gridTemplateColumns="auto minmax(0, 1fr)" columnGap="small-200" alignItems="start">
      <s-checkbox accessibilityLabel={label} checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <div>
        <s-stack direction="inline" gap="small-300" alignItems="center">
          <span style={{ cursor: 'pointer' }} onClick={() => onChange(!checked)}>
            <s-text>{label}</s-text>
          </span>
          {labelExtra}
        </s-stack>
        <s-paragraph>{help}</s-paragraph>
      </div>
    </s-grid>
  );
}

// ButtonSettings/ClickButtonRules.jsx
function ClickButtonRules({ settings, onChange, isTouched, errors, goQuoteForm, toast }) {
  const showOnCart = !!Number(settings.show_on_cart);
  const action = settings.get_quote_action;
  const setAction = (key, value) => onChange({ ...settings, get_quote_action: { ...action, [key]: value } });
  const here = (onClick) => (
    <s-link
      onClick={(e) => {
        e.preventDefault?.();
        e.stopPropagation?.();
        onClick();
      }}
    >
      here
    </s-link>
  );

  const getQuoteChildren = (
    <s-stack gap="small-200">
      <RichCheckbox
        label="Product additions"
        labelExtra={<InfoTip tip="Read more" icon="alert-circle" href="https://help.omegatheme.com/en/article/quote-button-1hr18hp/#3-4-click-the-button-to-button-actions" />}
        help={<><s-text color="subdued">Enable “Add Product” button to allow customers to select multiple products before getting instant quote. Customize button label </s-text>{here(goQuoteForm)}</>}
        checked={!!action.product_additions}
        onChange={(v) => setAction('product_additions', v)}
      />
      <RichCheckbox
        label="Export quote PDF"
        help={<><s-text color="subdued">Edit PDF template </s-text>{here(() => toast('Opens PDF template settings in the full app'))}</>}
        checked={!!action.export_pdf}
        onChange={(v) => setAction('export_pdf', v)}
      />
      <RichCheckbox
        label="Send proposal email"
        help={<><s-text color="subdued">Edit email template </s-text>{here(() => toast('Opens Email template settings in the full app'))}</>}
        checked={!!action.send_quote_email}
        onChange={(v) => setAction('send_quote_email', v)}
      />
    </s-stack>
  );

  const choices = [
    { value: 'popup', label: 'Display inquiry popup', details: <><s-text color="subdued">Edit form </s-text>{here(goQuoteForm)}</> },
    { value: 'page', label: 'Direct to Request For Quote page', details: <><s-text color="subdued">Edit page </s-text>{here(goQuoteForm)}</> },
    !showOnCart && { value: 'toast', label: 'Display a toast' },
    { value: 'get_quote', label: 'Get instant quote', children: getQuoteChildren },
  ].filter(Boolean);

  return (
    <div>
      <ChoiceGroup title="Click button to" name="type-form" value={settings.type_form} choices={choices} onChange={(v) => onChange({ ...settings, type_form: v })} />
      {isTouched && errors.action_quote && (
        <s-box paddingInlineStart="large-200" paddingBlockStart="small-400">
          <s-text tone="critical">Select at least 1 action: Export PDF or Send Email</s-text>
        </s-box>
      )}
    </div>
  );
}

// core/ListBoxWithSearch.jsx — search field + language listbox: the first 25 matches,
// then a "Showing all … languages" action that reveals the rest.
function LanguageListbox({ value, onSelect }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LANGUAGE_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q));
  }, [query]);
  const visible = showAll ? options : options.slice(0, 25);
  return (
    <div
      className="qset-combo"
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setOpen(false), 150);
      }}
    >
      <s-text-field
        label="Language"
        labelAccessibilityVisibility="exclusive"
        placeholder="Search"
        value={query}
        onInput={(e) => {
          setQuery(e.currentTarget.value);
          setOpen(true);
          if (value) onSelect(null);
        }}
      />
      {open && (
        <div className="qset-combo__list" role="listbox" aria-label="Language">
          {visible.length === 0 && <div className="qset-combo__empty">No results found matching "{query}"</div>}
          {visible.map((o) => (
            <button
              key={o.code}
              type="button"
              role="option"
              aria-selected={value === o.value}
              className="qset-option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(o.value);
                onSelect(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
          {!showAll && options.length > visible.length && (
            <button type="button" className="qset-option qset-option--action" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowAll(true)}>
              Showing all {LANGUAGE_OPTIONS.length} languages
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ButtonSettings/MultipleLanguageButton.jsx — "Text & translation" card.
function TextTranslationCard({ settings, onChange, mode, errors, goQuoteForm, blockIfDirty }) {
  const langMenuId = useWcId('qset-lang');
  const translations = settings.translations;
  const defaultCode = translations.find((t) => t.is_default)?.lang_code ?? 'EN';
  const [language, setLanguage] = useState(defaultCode);
  const [open, setOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [languageCreate, setLanguageCreate] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dismissed, setDismissed] = useState([]);

  const current = translations.find((t) => t.lang_code === language) || translations.find((t) => t.is_default) || translations[0];
  const code = current?.lang_code || 'EN';
  const fields = current?.translations || {};
  const q = settings.quantity_limit_setting;
  const tErr = errors.translations || {};

  const setTranslations = (next) => onChange({ ...settings, translations: next });
  const setField = (field, value) => setTranslations(translations.map((t) => (t.lang_code === code ? { ...t, translations: { ...t.translations, [field]: value } } : t)));

  const addLanguage = () => {
    setAddOpen(false);
    const opt = LANGUAGE_OPTIONS.find((l) => l.value === languageCreate);
    if (!opt) return;
    const defaults = QUOTE_BUTTON_TRANSLATIONS[opt.code.toUpperCase()] ?? {};
    const data = {
      button_label: defaults.button_label || '',
      display_a_toast_message: defaults.display_a_toast_message || '',
      get_instant_quote_message: defaults.get_instant_quote_message || '',
      validation_message_min_qty: defaults.validation_message_min_qty || '',
      validation_message_max_qty: defaults.validation_message_max_qty || '',
    };
    const idx = translations.findIndex((t) => t.lang_code === opt.code);
    const next = [...translations];
    if (idx > -1) next[idx] = { ...next[idx], translations: data };
    else next.push({ lang_code: opt.code, lang_name: opt.label, translations: data, is_default: false });
    setLanguage(opt.code);
    setLanguageCreate(null);
    setTranslations(next);
  };

  const deleteLanguage = () => {
    if (current?.is_default) return;
    const next = translations.filter((t) => t.lang_code !== code);
    setTranslations(next);
    setLanguage(next.find((t) => t.is_default)?.lang_code || next[0]?.lang_code || 'EN');
    setDeleteOpen(false);
  };

  const formLangs = QUOTE_FORM_LANGUAGES[mode] || ['EN'];
  const suggestion = current && !formLangs.includes(code) && !dismissed.includes(`${mode}-${code}`) ? current : null;

  const field = (key, label, placeholder) => (
    <s-text-field
      label={label}
      placeholder={placeholder}
      required
      value={fields[key] || ''}
      error={tErr[key] ? 'This field is required' : undefined}
      onInput={(e) => setField(key, e.currentTarget.value)}
    />
  );

  return (
    <>
      <s-section>
        <s-stack gap="base">
          <s-grid gridTemplateColumns="1fr auto" alignItems="center">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-heading fontSize="large">Text &amp; translation</s-heading>
              <InfoTip tip="Read more" href="https://help.omegatheme.com/en/article/quote-button-1hr18hp/" />
            </s-stack>
            <s-button
              variant="tertiary"
              icon={open ? 'chevron-down' : 'chevron-up'}
              accessibilityLabel={open ? 'Collapse text and translation' : 'Expand text and translation'}
              onClick={() => setOpen(!open)}
            />
          </s-grid>
          {open && (
            <>
              <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small-200">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-text fontWeight="bold">Text</s-text>
                  {current?.is_default && <s-badge tone="info">Default</s-badge>}
                </s-stack>
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-button
                    icon="language-translate"
                    onClick={() => {
                      // While the save bar is open production asks for the leave
                      // confirmation instead (shopify.saveBar.leaveConfirmation).
                      if (blockIfDirty?.()) return;
                      setAddKey((k) => k + 1);
                      setLanguageCreate(null);
                      setAddOpen(true);
                    }}
                  >
                    Multi languages
                  </s-button>
                  <DisclosureButton commandFor={langMenuId}>{languageLabel(code)}</DisclosureButton>
                  <s-popover id={langMenuId}>
                    <div className="qset-optionlist" role="menu">
                      {translations.map((t) => (
                        <s-clickable
                          key={t.lang_code}
                          commandFor={langMenuId}
                          command="--hide"
                          onClick={() => {
                            if (blockIfDirty?.()) return;
                            setLanguage(t.lang_code);
                          }}
                        >
                          <span className="qset-option" role="menuitem" aria-selected={t.lang_code === code}>
                            {t.lang_name}
                            {t.is_default && (
                              <span className="qset-option__suffix">
                                <s-badge tone="info">Default</s-badge>
                              </span>
                            )}
                          </span>
                        </s-clickable>
                      ))}
                    </div>
                  </s-popover>
                  {!current?.is_default && <s-button variant="tertiary" icon="delete" accessibilityLabel="Delete language" onClick={() => setDeleteOpen(true)} />}
                </s-stack>
              </s-grid>
              <div>
                <s-stack gap="small">
                  {field('button_label', 'Quote button label', 'Enter quote button label')}
                  {settings.type_form === 'toast' && field('display_a_toast_message', 'Label: Display a toast', 'Enter toast display label')}
                  {settings.type_form === 'get_quote' &&
                    field('get_instant_quote_message', 'Label: Get instant quote - Display message after click button', 'Enter instant quote label')}
                  {q.active && (
                    <>
                      {field('validation_message_min_qty', 'Validation message: min quantity', 'Enter message')}
                      {(Number(q.max_quantity) > 0 || !!q.max_same_as_inventory) &&
                        field('validation_message_max_qty', 'Validation message: max quantity', 'Enter message')}
                    </>
                  )}
                </s-stack>
                <s-box paddingBlockStart="small-200">
                  <s-checkbox
                    label="Set as default"
                    checked={!!current?.is_default}
                    disabled={!!current?.is_default}
                    onChange={(e) => {
                      if (e.currentTarget.checked && !current?.is_default) {
                        setTranslations(translations.map((t) => ({ ...t, is_default: t.lang_code === code })));
                      }
                    }}
                  />
                </s-box>
              </div>
              {suggestion && (
                <div className="qset-suggestion">
                  <s-stack direction="inline" gap="small" alignItems="center">
                    <PolarisIcon type="magic" />
                    <button type="button" className="qset-suggestion__link" onClick={goQuoteForm}>
                      Add {suggestion.lang_name} translation for quote form
                    </button>
                  </s-stack>
                  <button
                    type="button"
                    className="qset-suggestion__close"
                    aria-label="Dismiss"
                    onClick={() => setDismissed((d) => [...d, `${mode}-${code}`])}
                  >
                    <PolarisIcon type="x" />
                  </button>
                </div>
              )}
            </>
          )}
        </s-stack>
      </s-section>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} heading="Add language">
        <LanguageListbox key={addKey} value={languageCreate} onSelect={setLanguageCreate} />
        <s-button slot="primary-action" variant="primary" disabled={!languageCreate} onClick={addLanguage}>
          Add
        </s-button>
        <s-button slot="secondary-actions" onClick={() => setAddOpen(false)}>
          Cancel
        </s-button>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} heading="Confirm delete language">
        <s-paragraph>Are you sure you want to delete this language?</s-paragraph>
        <s-button slot="primary-action" variant="primary" tone="critical" onClick={deleteLanguage}>
          Delete
        </s-button>
        <s-button slot="secondary-actions" onClick={() => setDeleteOpen(false)}>
          Cancel
        </s-button>
      </Modal>
    </>
  );
}

// ButtonSettings/Integrate/NotInstallApp.jsx — Pareto bundles promo card.
function ParetoCard({ onDismiss, toast }) {
  return (
    <s-section>
      <div className="qset-promo">
        <div className="qset-promo__body">
          <s-heading fontSize="large">Allow adding bundles to quote</s-heading>
          <s-box paddingBlockStart="small-200">
            <s-paragraph>
              🔔 Want to let customers quote bundled products? Install the{' '}
              <s-link href={PARETO_URL} target="_blank">
                P:Quantity Breaks &amp; Bundles
              </s-link>{' '}
              to unlock this feature.
            </s-paragraph>
          </s-box>
          <s-box paddingBlockStart="small-200">
            <s-paragraph>📌 Why integrate?</s-paragraph>
            <ul className="qset-bullets qset-promo__list">
              <li>Seamlessly add discounted bundles to your quote flow.</li>
              <li>No manual setup — pricing and products sync automatically.</li>
            </ul>
          </s-box>
          <s-button variant="primary" onClick={() => toast('Opens P:Quantity Breaks & Bundles on the Shopify App Store')}>
            Integrate now
          </s-button>
        </div>
        <div className="qset-promo__aside">
          <img className="qset-promo__img" alt="Pareto Limit" src={paretoImage} />
          <s-button variant="tertiary" icon="x" accessibilityLabel="Dismiss" onClick={onDismiss} />
        </div>
      </div>
    </s-section>
  );
}

export function QuoteButtonTab({
  settings,
  onChange,
  mode,
  onModeChange,
  isTouched,
  errors = {},
  toast,
  goQuoteForm,
  onHoverEdit,
  paretoDismissed,
  onDismissPareto,
  blockIfDirty,
}) {
  const s = settings;
  // The custom position field validates as it is edited (useValidate on change),
  // not only on save.
  const [positionEdited, setPositionEdited] = useState(false);
  const showOnProduct = !!Number(s.show_on_product);
  const showOnCollection = !!Number(s.show_on_collection);
  const showOnCart = !!Number(s.show_on_cart);

  const enable = (key, checked) => {
    const next = { ...s, [key]: checked ? 1 : 0 };
    if (key === 'show_on_cart' && checked && s.type_form === 'toast') next.type_form = 'popup';
    onChange(next);
  };

  return (
    <s-stack gap="large">
      <s-section>
        <s-stack gap="small">
          <s-grid gridTemplateColumns="1fr auto" alignItems="center">
            <s-heading fontSize="large">Logic</s-heading>
            <StoreModeSwitch mode={mode} onChange={onModeChange} />
          </s-grid>

          <s-stack gap="small-400">
            <FieldTitle>Display button on what position?</FieldTitle>
            <s-checkbox label="Product page" checked={showOnProduct} disabled={showOnCart} onChange={(e) => enable('show_on_product', e.currentTarget.checked)} />
            <s-checkbox
              label="Catalog/collection page"
              checked={showOnCollection}
              disabled={showOnCart}
              onChange={(e) => enable('show_on_collection', e.currentTarget.checked)}
            />
            <s-checkbox
              label="Cart page"
              checked={showOnCart}
              disabled={showOnCollection || showOnProduct}
              onChange={(e) => enable('show_on_cart', e.currentTarget.checked)}
            />
            {isTouched && errors.show_on && <s-text tone="critical">This field is required</s-text>}
          </s-stack>

          {(showOnProduct || showOnCart) && (
            <>
              <s-select
                label="Select position"
                value={showOnCart ? s.cart_position : s.position_button}
                onChange={(e) => onChange({ ...s, [showOnCart ? 'cart_position' : 'position_button']: e.currentTarget.value })}
              >
                {(showOnProduct ? POSITION_OPTIONS : CART_POSITION_OPTIONS).map((o) => (
                  <s-option key={o.value} value={o.value}>
                    {o.label}
                  </s-option>
                ))}
              </s-select>
              {s.position_button === 'addCode' && (
                <div className="qset-label-action">
                  <s-text-field
                    label="Custom position"
                    placeholder="Choose custom position"
                    value={s.custom_element_position}
                    error={
                      (isTouched && errors.custom_element_position) || (positionEdited && !String(s.custom_element_position || '').trim())
                        ? 'Please select position of button'
                        : undefined
                    }
                    onInput={(e) => {
                      setPositionEdited(true);
                      onChange({ ...s, custom_element_position: e.currentTarget.value });
                    }}
                  />
                  <div className="qset-label-action__link">
                    <s-link onClick={() => toast('Opens your storefront to pick the button position')}>Select position</s-link>
                  </div>
                </div>
              )}
            </>
          )}
          <s-divider />

          {!showOnCart && (
            <>
              <ProductRules type="buttonSettings" settings={s} onChange={onChange} isTouched={isTouched} errors={errors} onToast={toast} />
              <s-divider />
              <CustomerRules type="buttonSettings" mode={mode} settings={s} onChange={onChange} isTouched={isTouched} errors={errors} />
              <s-divider />
            </>
          )}

          <QuantityLimit settings={s} onChange={onChange} errors={errors} />
          <s-divider />

          <ClickButtonRules settings={s} onChange={onChange} isTouched={isTouched} errors={errors} goQuoteForm={goQuoteForm} toast={toast} />
        </s-stack>
      </s-section>

      <TextTranslationCard key={mode} settings={s} onChange={onChange} mode={mode} errors={errors} goQuoteForm={goQuoteForm} blockIfDirty={blockIfDirty} />

      <ButtonStyleEditor
        name="request-for-quote"
        labelText="Button Label"
        styles={s.custom_styles}
        onChange={(styles) => onChange({ ...s, custom_styles: styles })}
        onHoverEdit={onHoverEdit}
      />

      {!paretoDismissed && <ParetoCard onDismiss={onDismissPareto} toast={toast} />}
    </s-stack>
  );
}

// Validation on save (ButtonSettings validateSettings).
export function validateQuoteButton(s) {
  const e = {};
  if (s.type_condition === 'selected' && !s.manual_condition.length) e.selectedProduct = true;
  if (s.type_condition === 'collection' && !s.collection_condition.length) e.selectedCollection = true;
  if (s.type_condition === 'automate' && s.automatically_condition.some((or) => or.some((and) => !String(and.valueCondition ?? '').length))) e.automatically_condition = true;
  if (s.applied_customers_mode === 3 && !s.applied_customers_tags.length) e.applied_customers_tags = true;
  if (s.applied_customers_mode === 5 && !s.applied_customers_without_tags.length) e.applied_customers_without_tags = true;
  if (s.type_form === 'get_quote' && !s.get_quote_action.export_pdf && !s.get_quote_action.send_quote_email) e.action_quote = true;
  if (s.position_button === 'addCode' && !String(s.custom_element_position || '').trim()) e.custom_element_position = true;
  // Every language must have every text (production checks all of them, whichever
  // fields are currently shown).
  const t = {};
  s.translations.forEach((x) => {
    if (!x.translations.button_label) t.button_label = true;
    if (!x.translations.display_a_toast_message) t.display_a_toast_message = true;
    if (!x.translations.get_instant_quote_message) t.get_instant_quote_message = true;
    if (!x.translations.validation_message_min_qty) t.validation_message_min_qty = true;
    if (!x.translations.validation_message_max_qty) t.validation_message_max_qty = true;
  });
  if (Object.keys(t).length) e.translations = t;
  const ql = s.quantity_limit_setting;
  if (Number(ql.max_quantity) > 0 && Number(ql.max_quantity) < Number(ql.min_quantity) && !ql.max_same_as_inventory) e.maxUnderMin = true;
  return Object.keys(e).length ? e : null;
}
