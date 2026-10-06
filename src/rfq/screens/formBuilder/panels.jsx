import React, { useEffect, useMemo, useState } from 'react';
import { Modal, useWcId } from '../../../shared/wc.jsx';
import { RFQ_CATALOG } from '../../data/catalog.js';
import {
  STEP_1,
  STEP_2,
  EMPTY_STATE,
  BUTTON_POSITIONS,
  AUTO_CONDITION_TYPES,
  autoOperatorOptions,
  autoValueType,
  DEFAULT_AUTO_CONDITION,
  MARKETS,
} from './data.js';
import { COUNTRIES } from './lists.js';
import { useBuilder, step2, step1Lang } from './model.js';
import { CollapseMenu, ImageDrop, Segmented } from './ui.jsx';

// Shared: a step's preview follows the panel that is open (each production panel
// dispatches setSelectedStep on mount).
function useStep(step, extra) {
  const { ui, setUi } = useBuilder();
  useEffect(() => {
    if (ui.step !== step || extra) setUi({ step, ...(extra || {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const Indent = ({ children, px = 26 }) => <div style={{ paddingInlineStart: px }}>{children}</div>;

// ── Display condition (SettingDisplayCondition.jsx) ──────────────────────────
export function DisplayConditionPanel() {
  const { form, edit, ui } = useBuilder();
  useStep(STEP_1);
  const v = ui.variant;
  const mf = form.multiple_form[v];
  const name = useWcId('qfb-cond');
  const [pickerOpen, setPickerOpen] = useState(false);
  const set = (fn) => edit((f) => fn(f.multiple_form[v]));

  const choices = mf.is_default
    ? [{ value: 'all', label: 'Any products', disabled: v !== 0 }]
    : [
        { value: 'selected', label: 'Specific products - Manually select', disabled: v === 0 },
        { value: 'automate', label: 'Group products - Conditionally select', disabled: v === 0 },
      ];

  return (
    <div className="qfb-panel">
      <s-choice-list
        label="Variant displays for what products?"
        labelAccessibilityVisibility="exclusive"
        name={name}
        onChange={(e) => {
          const val = e.currentTarget.values?.[0];
          if (!val) return;
          set((m) => {
            m.type_condition = val;
            if (val === 'automate' && !m.automatically_condition.length) m.automatically_condition = [[DEFAULT_AUTO_CONDITION()]];
          });
        }}
      >
        {choices.map((c) => (
          <s-choice key={c.value} value={c.value} selected={mf.type_condition === c.value} disabled={c.disabled}>
            {c.label}
            {c.value === 'selected' && mf.type_condition === 'selected' && (
              <div slot="secondary-content" className="qfb-manual">
                <ManualProducts mf={mf} set={set} showError={ui.errors.server} onBrowse={() => setPickerOpen(true)} />
              </div>
            )}
          </s-choice>
        ))}
      </s-choice-list>
      {mf.type_condition === 'automate' && <AutoConditions mf={mf} set={set} showError={ui.errors.server} />}
      {pickerOpen && (
        <ProductPicker
          selected={mf.manual_condition.map((p) => p.id)}
          onClose={() => setPickerOpen(false)}
          onSelect={(items) => {
            set((m) => {
              m.manual_condition = items;
            });
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ManualProducts({ mf, set, onBrowse, showError }) {
  const empty = !mf.manual_condition.length;
  const sorted = [...mf.manual_condition].sort((a, b) => a.product_title.localeCompare(b.product_title));
  return (
    <s-stack gap="small">
      <s-text color="subdued">Select more than 100 items will harm your website performance. For more, select the option below.</s-text>
      <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="start">
        <s-search-field
          label="Search products"
          labelAccessibilityVisibility="exclusive"
          placeholder="Search products"
          value=""
          error={empty && showError ? 'Select at least 1 product' : undefined}
          onFocus={onBrowse}
        />
        <s-button onClick={onBrowse}>Browse</s-button>
      </s-grid>
      {!empty && (
        <div className="qfb-product-list">
          {sorted.map((p) => (
            <div key={p.id} className="qfb-product-row">
              <s-thumbnail size="small" alt={p.product_title} />
              <div className="qfb-product-row__text">
                <s-paragraph>{p.product_title}</s-paragraph>
                <s-paragraph color="subdued">Variant: {p.variant}</s-paragraph>
              </div>
              <s-button
                variant="tertiary"
                icon="delete"
                accessibilityLabel={`Remove ${p.product_title}`}
                onClick={() =>
                  set((m) => {
                    m.manual_condition = m.manual_condition.filter((x) => x.id !== p.id);
                  })
                }
              />
            </div>
          ))}
        </div>
      )}
    </s-stack>
  );
}

// Shopify resource picker stand-in: products + variants from the demo catalog.
function ProductPicker({ selected, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(selected);
  const rows = RFQ_CATALOG.filter((p) => p.title.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id, checked) => setPicked((cur) => (checked ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)));
  const submit = () => {
    const items = [];
    RFQ_CATALOG.forEach((p) =>
      p.variants.forEach((variant) => {
        if (picked.includes(variant.id)) items.push({ id: variant.id, product_title: p.title, variant: variant.title });
      }),
    );
    onSelect(items);
  };
  return (
    <Modal heading="Add products" onClose={onClose}>
      <s-stack gap="base">
        <s-search-field label="Search products" labelAccessibilityVisibility="exclusive" placeholder="Search products" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
        <s-stack gap="small-200">
          {rows.map((p) => (
            <s-box key={p.sku} border="base" borderRadius="base" padding="small">
              <s-stack gap="small-200">
                <s-text fontWeight="semibold">{p.title}</s-text>
                {p.variants.map((variant) => (
                  <s-checkbox
                    key={variant.id}
                    label={`${variant.title} · ${variant.id}`}
                    checked={picked.includes(variant.id)}
                    onChange={(e) => toggle(variant.id, e.currentTarget.checked)}
                  />
                ))}
              </s-stack>
            </s-box>
          ))}
          {!rows.length && <s-paragraph color="subdued">No products found</s-paragraph>}
        </s-stack>
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={submit}>
        Add
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

const COLS3 = '@container (inline-size > 520px) 1fr 1fr 1fr, 1fr';

function AutoConditions({ mf, set, showError }) {
  const groups = mf.automatically_condition;
  const change = (io, ia, patch) =>
    set((m) => {
      Object.assign(m.automatically_condition[io][ia], patch);
    });
  const add = (type, io) =>
    set((m) => {
      if (type === 'AND') m.automatically_condition[io].push(DEFAULT_AUTO_CONDITION());
      else m.automatically_condition.push([DEFAULT_AUTO_CONDITION()]);
    });
  const remove = (io, ia) =>
    set((m) => {
      m.automatically_condition[io].splice(ia, 1);
      if (!m.automatically_condition[io].length) m.automatically_condition.splice(io, 1);
    });

  return (
    <div className="qfb-auto">
      {groups.map((group, io) => (
        <div key={io}>
          {group.map((c, ia) => {
            const valueType = autoValueType(c.selectedType);
            return (
              <div key={ia} className="qfb-auto__and">
                {ia !== 0 && <div className="qfb-auto__and-label">AND</div>}
                <div className="qfb-auto__row">
                  <s-query-container>
                    <s-grid gridTemplateColumns={COLS3} gap="small-200">
                      <s-select
                        label="Condition"
                        labelAccessibilityVisibility="exclusive"
                        value={c.selectedType}
                        onChange={(e) => {
                          const t = e.currentTarget.value;
                          if (t === c.selectedType) return;
                          const today = new Date().toISOString().slice(0, 10);
                          change(io, ia, { selectedType: t, isChoosen: autoOperatorOptions(t)[0].value, valueCondition: t === 'time' ? today : '' });
                        }}
                      >
                        {AUTO_CONDITION_TYPES.map((o) => (
                          <s-option key={o.value} value={o.value}>
                            {o.label}
                          </s-option>
                        ))}
                      </s-select>
                      <s-select
                        label="Operator"
                        labelAccessibilityVisibility="exclusive"
                        value={c.isChoosen}
                        onChange={(e) => change(io, ia, { isChoosen: e.currentTarget.value })}
                      >
                        {autoOperatorOptions(c.selectedType).map((o) => (
                          <s-option key={o.value} value={o.value}>
                            {o.label}
                          </s-option>
                        ))}
                      </s-select>
                      {valueType === 'date' ? (
                        <s-date-field
                          label="Value"
                          labelAccessibilityVisibility="exclusive"
                          value={c.valueCondition}
                          onChange={(e) => change(io, ia, { valueCondition: e.currentTarget.value })}
                        />
                      ) : valueType === 'number' ? (
                        <s-number-field
                          label="Value"
                          labelAccessibilityVisibility="exclusive"
                          placeholder="Enter value"
                          value={String(c.valueCondition)}
                          required
                          error={showError && String(c.valueCondition).trim() === '' ? 'Condition value is required' : undefined}
                          onInput={(e) => change(io, ia, { valueCondition: e.currentTarget.value })}
                        />
                      ) : (
                        <s-text-field
                          label="Value"
                          labelAccessibilityVisibility="exclusive"
                          placeholder="Enter value"
                          value={c.valueCondition}
                          required
                          error={showError && !String(c.valueCondition).trim() ? 'Condition value is required' : undefined}
                          onInput={(e) => change(io, ia, { valueCondition: e.currentTarget.value })}
                        />
                      )}
                    </s-grid>
                  </s-query-container>
                  <div className={!ia && !io ? 'qfb-hidden' : undefined}>
                    <s-button variant="tertiary" icon="delete" accessibilityLabel="Remove condition" disabled={!ia && !io} onClick={() => remove(io, ia)} />
                  </div>
                </div>
                {ia === group.length - 1 && (
                  <div className="qfb-auto__add">
                    <s-stack direction="inline" gap="small-200">
                      <s-button icon="plus" onClick={() => add('AND', io)}>
                        AND
                      </s-button>
                      {io === groups.length - 1 && (
                        <s-button icon="plus" onClick={() => add('OR', io)}>
                          OR
                        </s-button>
                      )}
                    </s-stack>
                  </div>
                )}
              </div>
            );
          })}
          {io < groups.length - 1 && (
            <div className="qfb-or">
              <span>OR</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Product info (step 1, read-only) / Product list (step 2) — InformationFieldSettingTranslation
export function ProductFieldsPanel({ step }) {
  const { form, edit, lang, openPanel } = useBuilder();
  useStep(step === 1 ? STEP_1 : STEP_2);
  const rl = form.quote_form_request_list;
  const labels = step2(form, lang).quote_form_request_list;
  const s1 = step === 1;
  const flag = (key, value) =>
    edit((f) => {
      f.quote_form_request_list[key] = value;
    });
  const setLabel = (key) => (e) => {
    const v = e.currentTarget.value;
    edit((f) => {
      f.translations[lang].form_step_2.quote_form_request_list[key] = v;
    });
  };
  const labelField = (label, key, error, placeholder = 'Enter label') => (
    <Indent>
      <s-text-field
        label={label}
        placeholder={placeholder}
        required
        value={labels[key] ?? ''}
        error={!labels[key]?.trim() ? error : undefined}
        onInput={setLabel(key)}
      />
    </Indent>
  );

  return (
    <div className="qfb-panel">
      <s-stack gap="small-400">
        <s-checkbox label="Product" checked disabled />
        {!s1 && labelField('Product label', 'product_text', 'Product label is required')}
        <s-checkbox label="Quantity" checked={!rl.hide_quantity_table} disabled={s1} onChange={(e) => flag('hide_quantity_table', e.currentTarget.checked ? 0 : 1)} />
        {!rl.hide_quantity_table && !s1 && labelField('Quantity label', 'quantity_text', 'Quantity label is required')}
        <s-checkbox label="Remove icon" checked={!rl.hide_remove_table} disabled={s1} onChange={(e) => flag('hide_remove_table', e.currentTarget.checked ? 0 : 1)} />
        <s-checkbox label="Product variant" checked={!rl.hide_option_table} disabled={s1} onChange={(e) => flag('hide_option_table', e.currentTarget.checked ? 0 : 1)} />
        <s-checkbox label="SKU" checked={!!rl.show_product_sku} disabled={s1} onChange={(e) => flag('show_product_sku', e.currentTarget.checked ? 1 : 0)} />
        {!!rl.show_product_sku && !s1 && labelField('SKU label', 'sku_text', 'SKU label is required')}
        <s-checkbox
          label="Product properties"
          checked={!!rl.show_properties_form}
          disabled={s1}
          onChange={(e) => flag('show_properties_form', e.currentTarget.checked ? 1 : 0)}
        />
        {!!rl.show_properties_form && !s1 && labelField('Properties label', 'properties_form_text', 'Properties label is required')}
        <s-checkbox
          label="Product price"
          checked={!!rl.show_product_price}
          disabled={s1}
          onChange={(e) => {
            const on = e.currentTarget.checked ? 1 : 0;
            edit((f) => {
              Object.assign(f.quote_form_request_list, { show_product_price: on, show_sub_total_price_quote: on, show_total_price: on });
            });
          }}
        />
        {!!rl.show_product_price && !s1 && labelField('Price label', 'price_text', 'Price label is required')}
        <s-checkbox
          label="Product wished price"
          checked={!!rl.show_offered_price}
          disabled={s1}
          onChange={(e) => flag('show_offered_price', e.currentTarget.checked ? 1 : 0)}
        />
        {!!rl.show_offered_price && !s1 && labelField('Wished price label', 'offered_price_text', 'Wished price label is required')}
        {!!rl.show_product_price && !s1 && (
          <s-checkbox
            label="Product subtotal price"
            checked={!!rl.show_sub_total_price_quote}
            onChange={(e) => flag('show_sub_total_price_quote', e.currentTarget.checked ? 1 : 0)}
          />
        )}
        {!!rl.show_sub_total_price_quote && !s1 && labelField('Subtotal price label', 'sub_total_price_quote_text', 'Subtotal price label is required')}
        {!!rl.show_product_price && !s1 && (
          <s-checkbox label="Product total price" checked={!!rl.show_total_price} onChange={(e) => flag('show_total_price', e.currentTarget.checked ? 1 : 0)} />
        )}
        {!!rl.show_total_price && !s1 && labelField('Total price label', 'total_price_text', 'Total price label is required')}
        <s-checkbox label="Note" checked={!!rl.show_product_message} disabled={s1} onChange={(e) => flag('show_product_message', e.currentTarget.checked ? 1 : 0)} />
        {!!rl.show_product_message && !s1 && (
          <Indent>
            <s-stack gap="small-100">
              <s-text-field
                label="Note label"
                placeholder="Enter label"
                required
                value={labels.message_text ?? ''}
                error={!labels.message_text?.trim() ? 'Notes label is required' : undefined}
                onInput={setLabel('message_text')}
              />
              <s-text-field label="Note placeholder" placeholder="Enter placeholder" value={labels.message_placeholder ?? ''} onInput={setLabel('message_placeholder')} />
            </s-stack>
          </Indent>
        )}
        {s1 && (
          <div className="qfb-mt-16">
            <s-paragraph color="subdued">
              You can edit this information in{' '}
              <s-link tone="neutral" onClick={() => openPanel('productList', { step: STEP_2 })}>
                step 2
              </s-link>{' '}
              to ensure information consistency.
            </s-paragraph>
          </div>
        )}
      </s-stack>
    </div>
  );
}

// ── Add To Quote button (ButtonStep1SettingTranslation) ───────────────────────
export function ButtonStep1Panel() {
  const { form, edit, ui, lang } = useBuilder();
  useStep(STEP_1);
  const v = ui.variant;
  const mf = form.multiple_form[v];
  const l = step1Lang(form, v, lang);
  const label = l?.footer_setting?.submitting_quote_mess ?? '';
  const close = l?.quote_form_header?.popup_shopping_mess ?? step1Lang(form, 0, lang)?.quote_form_header.popup_shopping_mess ?? '';
  const ensureLang = (m) => {
    m.languages[lang] = m.languages[lang] || structuredClone(m.languages[Object.keys(m.languages)[0]]);
    return m.languages[lang];
  };
  return (
    <div className="qfb-panel">
      <s-stack gap="base">
        <s-text-field
          label="Button label"
          required
          autocomplete="off"
          value={label}
          error={ui.errors.server && !label.trim() ? 'Label is required' : undefined}
          onInput={(e) => {
            const val = e.currentTarget.value;
            edit((f) => {
              ensureLang(f.multiple_form[v]).footer_setting.submitting_quote_mess = val;
            });
          }}
        />
        <s-text-field
          label="Close button"
          details="This setting applies to every form in step 1"
          placeholder="Enter close button label"
          required
          value={close}
          error={ui.errors.server && !close.trim() ? 'Continue shopping title is required' : undefined}
          onInput={(e) => {
            const val = e.currentTarget.value;
            edit((f) =>
              f.multiple_form.forEach((m) => {
                ensureLang(m).quote_form_header.popup_shopping_mess = val;
              }),
            );
          }}
        />
        <Segmented
          label="Button Alignment"
          options={BUTTON_POSITIONS}
          value={mf.quote_form_bottom.submitting_position}
          onChange={(pos) =>
            edit((f) => {
              f.multiple_form[v].quote_form_bottom.submitting_position = pos;
            })
          }
        />
      </s-stack>
    </div>
  );
}

// ── Submit button (ButtonStep2SettingTranslation) ─────────────────────────────
export function SubmitButtonPanel() {
  const { form, edit, lang } = useBuilder();
  useStep(STEP_2);
  const t2 = step2(form, lang);
  const set = (fn) => edit((f) => fn(f.translations[lang].form_step_2));
  const label = t2.quote_form_bottom.submitting_quote_mess ?? '';
  const close = t2.quote_form_header.popup_shopping_mess ?? '';
  return (
    <div className="qfb-panel">
      <s-stack gap="base">
        <s-text-field
          label="Button label"
          required
          autocomplete="off"
          value={label}
          error={!label.trim() ? 'Label is required' : undefined}
          onInput={(e) => {
            const v = e.currentTarget.value;
            set((s) => {
              s.quote_form_bottom.submitting_quote_mess = v;
            });
          }}
        />
        <s-text-field
          label="Close button"
          placeholder="Enter close button label"
          required
          value={close}
          error={!close.trim() ? 'Continue shopping title is required' : undefined}
          onInput={(e) => {
            const v = e.currentTarget.value;
            set((s) => {
              s.quote_form_header.popup_shopping_mess = v;
            });
          }}
        />
        <Segmented
          label="Button alignment"
          options={BUTTON_POSITIONS}
          value={t2.quote_form_bottom.submitting_position || 'right'}
          onChange={(pos) =>
            set((s) => {
              s.quote_form_bottom.submitting_position = pos;
            })
          }
        />
      </s-stack>
    </div>
  );
}

// ── Form attribute (FormAttribute.jsx) ────────────────────────────────────────
export function FormAttributePanel() {
  const { form, edit, ui } = useBuilder();
  const v = ui.variant;
  const name = form.multiple_form[v]?.name ?? '';
  return (
    <div className="qfb-panel">
      <s-text-field
        label="Form name"
        placeholder="Enter form name"
        required
        value={name}
        error={!name.trim() ? 'Form name is required' : undefined}
        onInput={(e) => {
          const val = e.currentTarget.value;
          edit((f) => {
            f.multiple_form[v].name = val;
          });
        }}
      />
    </div>
  );
}

// ── Customer info (CustomerInfoFormSplit) ─────────────────────────────────────
const CONTACT_FIELDS = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'phone_number', label: 'Phone number' },
];
const SHIPPING_FIELDS = [
  { key: 'country', label: 'Country' },
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'company', label: 'Company info' },
  { key: 'address', label: 'Address line 1' },
  { key: 'state', label: 'Province' },
  { key: 'city', label: 'City' },
  { key: 'postal_code', label: 'Postal Code' },
  { key: 'phone_number', label: 'Phone number' },
];

export function CustomerInfoPanel() {
  const { form, edit, typeForm, ui } = useBuilder();
  useStep(STEP_2, { loggedIn: false });
  // A failed save on the country restriction opens "Shipping address".
  const [openId, setOpenId] = useState(ui.errors.country ? 'shipping_address' : 'contact_info');
  useEffect(() => {
    if (ui.errors.country) setOpenId('shipping_address');
  }, [ui.errors.country]);
  const vfs = form.view_form_submit;
  const setVfs = (key) => (e) => {
    const on = e.currentTarget.checked ? 1 : 0;
    edit((f) => {
      f.view_form_submit[key] = on;
    });
  };
  const tipId = useWcId('qfb-multi-ship');

  const menus = [
    { id: 'contact_info', title: 'Contact information', content: <FieldSettings group="contact_info" fields={CONTACT_FIELDS} /> },
    {
      id: 'shipping_address',
      title: 'Shipping address',
      content: (
        <s-stack gap="small-200">
          <s-checkbox label="Shipping address" checked={!!vfs.dtc_show_shipping} onChange={setVfs('dtc_show_shipping')} />
          {!!vfs.dtc_show_shipping && (
            <Indent px={24}>
              <s-stack gap="small-100">
                <div className="qfb-inline-label">
                  <s-checkbox label="Multiple shipping addresses" checked={!!vfs.dtc_multiple_shipping} onChange={setVfs('dtc_multiple_shipping')} />
                  <s-link
                    href="https://help.omegatheme.com/en/article/quote-form-builder-1cd6sb4/#6-multiple-shipping-addresses"
                    target="_blank"
                    accessibilityLabel="Read more"
                    interestFor={tipId}
                  >
                    <s-icon type="info" color="subdued" />
                  </s-link>
                  <s-tooltip id={tipId}>Read more</s-tooltip>
                </div>
                <s-paragraph>Allow logged‑in DTC customers (without company location or company details) to select a preferred shipping address</s-paragraph>
              </s-stack>
            </Indent>
          )}
          {!!vfs.dtc_show_shipping && (
            <div className="qfb-mt-8">
              <FieldSettings group="shipping_address" fields={SHIPPING_FIELDS} />
            </div>
          )}
        </s-stack>
      ),
    },
  ];

  return (
    <div>
      {typeForm === 'dtc' ? (
        <CollapseMenu items={menus} openId={openId} onToggle={setOpenId} />
      ) : (
        <div className="qfb-panel">
          <s-stack gap="small-200">
            <s-checkbox label="Company info" checked={!!vfs.b2b_show_company} onChange={setVfs('b2b_show_company')} />
            <s-checkbox label="Shipping address" checked={!!vfs.b2b_show_shipping} onChange={setVfs('b2b_show_shipping')} />
            <s-checkbox label="Billing address" checked={!!vfs.b2b_show_billing} onChange={setVfs('b2b_show_billing')} />
            <s-checkbox label="Payment terms" checked={!!vfs.b2b_show_payment_term} onChange={setVfs('b2b_show_payment_term')} />
          </s-stack>
        </div>
      )}
      <div className="qfb-autofill">
        <s-paragraph>These information will be auto-filled if customers log in with their customer account</s-paragraph>
      </div>
    </div>
  );
}

// CustomerInfoFormSplit/FieldSetting.jsx — "Enable" / "Required" per field.
function FieldSettings({ group, fields }) {
  const { form, edit } = useBuilder();
  const settings = form.fields_setting[group];
  const set = (key, prop, value) =>
    edit((f) => {
      const g = f.fields_setting[group];
      g[key][prop] = value;
      if (prop === 'enabled' && !value) g[key].required = false;
      // changeFieldSetting: turning the country off turns the province off too.
      if (group === 'shipping_address' && key === 'country' && prop === 'enabled' && !value && g.state) {
        g.state.enabled = false;
        g.state.required = false;
      }
    });
  return (
    <s-stack gap="small-100">
      {fields.map((field) => {
        const fs = settings[field.key];
        const isCountry = group === 'shipping_address' && field.key === 'country';
        const isState = group === 'shipping_address' && field.key === 'state';
        const countryEnabled = settings.country ? settings.country.enabled : true;
        return (
          <s-stack key={field.key} gap="none">
            <s-text>{field.label}</s-text>
            <s-checkbox
              label="Enable"
              disabled={isState && !countryEnabled}
              checked={!!fs.enabled}
              onChange={(e) => set(field.key, 'enabled', e.currentTarget.checked)}
            />
            {isCountry && fs.enabled && <CountryRestriction />}
            <s-checkbox
              label="Required"
              disabled={!fs.enabled}
              checked={!!fs.required}
              onChange={(e) => set(field.key, 'required', e.currentTarget.checked)}
            />
          </s-stack>
        );
      })}
    </s-stack>
  );
}

// CustomerInfoFormSplit/CountryRestrictionSetting.jsx — three radios; the picked
// countries / markets show as removable tags under a search box that opens the
// chooser. Switching mode clears the selection (changeCountryMode).
function CountryRestriction() {
  const { form, edit, ui } = useBuilder();
  const name = useWcId('qfb-country-mode');
  const country = form.fields_setting.shipping_address.country;
  const mode = country.country_mode || 'all';
  const codes = country.specific_country_codes || [];
  const marketIds = country.market_ids || [];
  const [modal, setModal] = useState(null); // 'countries' | 'markets'
  const set = (fn) => edit((f) => fn(f.fields_setting.shipping_address.country));
  const showError = ui.errors.country;
  const countryError = showError && !codes.length;
  const marketError = showError && !marketIds.length;

  const countryBadges = codes
    .map((c) => ({ value: c, label: COUNTRIES.find(([v]) => v === c)?.[1] || c }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const marketBadges = marketIds.map((id) => ({ value: id, label: MARKETS.find((m) => m.id === id)?.name || 'Deleted market' }));

  return (
    <Indent px={24}>
      <s-choice-list
        label="Country display"
        labelAccessibilityVisibility="exclusive"
        name={name}
        onChange={(e) => {
          const v = e.currentTarget.values?.[0];
          if (v && v !== mode)
            set((c) => {
              c.country_mode = v;
              c.specific_country_codes = [];
              c.market_ids = [];
            });
        }}
      >
        <s-choice value="all" selected={mode === 'all'}>
          Display all countries
        </s-choice>
        <s-choice value="specific" selected={mode === 'specific'}>
          Display specific countries
          {mode === 'specific' && (
            <div slot="secondary-content" className="qfb-mt-8">
              <s-stack gap="small-200">
                <s-stack gap="small-400">
                  <s-text-field
                    label="Search countries"
                    labelAccessibilityVisibility="exclusive"
                    placeholder="Search countries"
                    autocomplete="off"
                    value=""
                    error={countryError ? 'Please select at least one country.' : undefined}
                    onFocus={() => setModal('countries')}
                  />
                </s-stack>
                <SelectedChips
                  items={countryBadges}
                  onRemove={(v) =>
                    set((c) => {
                      c.specific_country_codes = c.specific_country_codes.filter((x) => x !== v);
                    })
                  }
                />
              </s-stack>
            </div>
          )}
        </s-choice>
        <s-choice value="markets" selected={mode === 'markets'}>
          Display countries belonging to markets
          {mode === 'markets' && (
            <div slot="secondary-content" className="qfb-mt-8">
              <s-stack gap="small-200">
                <s-stack gap="small-400">
                  <s-text-field
                    label="Search markets"
                    labelAccessibilityVisibility="exclusive"
                    placeholder="Search markets"
                    autocomplete="off"
                    value=""
                    error={marketError ? 'Please select at least one market.' : undefined}
                    onFocus={() => setModal('markets')}
                  />
                </s-stack>
                {!marketError && (
                  <SelectedChips
                    items={marketBadges}
                    onRemove={(v) =>
                      set((c) => {
                        c.market_ids = c.market_ids.filter((x) => x !== v);
                      })
                    }
                  />
                )}
              </s-stack>
            </div>
          )}
        </s-choice>
      </s-choice-list>
      {modal === 'countries' && (
        <SelectItemsModal
          title="Choose countries"
          options={COUNTRIES.map(([value, label]) => ({ value, label }))}
          selected={codes}
          selectAllLabel="Select all countries"
          countLabel={(n) => `${n} ${n === 1 ? 'country' : 'countries'} selected`}
          onClose={() => setModal(null)}
          onSelect={(values) => {
            set((c) => {
              c.specific_country_codes = [...new Set(values)].sort((a, b) => a.localeCompare(b));
            });
            setModal(null);
          }}
        />
      )}
      {modal === 'markets' && (
        <SelectItemsModal
          title="Choose markets"
          options={MARKETS.map((m) => ({ value: m.id, label: m.name }))}
          selected={marketIds}
          selectAllLabel="Select all markets"
          countLabel={(n) => `${n} ${n === 1 ? 'market' : 'markets'} selected`}
          onClose={() => setModal(null)}
          onSelect={(values) => {
            set((c) => {
              c.market_ids = values;
            });
            setModal(null);
          }}
        />
      )}
    </Indent>
  );
}

// CustomerInfoFormSplit/SelectedBadges.jsx — first 3 tags, then "Show more (n)".
function SelectedChips({ items, onRemove, maxVisible = 3 }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, maxVisible);
  const hidden = items.length - maxVisible;
  if (!items.length) return null;
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      {visible.map((item) => (
        <s-clickable-chip key={item.value} removable accessibilityLabel={`Remove ${item.label}`} onRemove={() => onRemove(item.value)}>
          {item.label}
        </s-clickable-chip>
      ))}
      {hidden > 0 && <s-link onClick={() => setExpanded(!expanded)}>{expanded ? 'Show less' : `Show more (${hidden})`}</s-link>}
    </s-stack>
  );
}

// CustomerInfoFormSplit/SelectItemsModal.jsx
function SelectItemsModal({ title, options, selected, selectAllLabel, countLabel, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState(() => selected.filter((v) => options.some((o) => o.value === v)));
  const filtered = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())), [options, query]);
  const count = options.filter((o) => checked.includes(o.value)).length;
  const all = options.length > 0 && count === options.length;
  const some = count > 0 && !all;
  return (
    <Modal heading={title} padding="none" onClose={onClose}>
      <div className="qfb-sel-search">
        <s-search-field label={title} labelAccessibilityVisibility="exclusive" placeholder={title} value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
      </div>
      <div className="qfb-sel-count">
        <s-checkbox
          label={all || count === 0 ? selectAllLabel : countLabel(count)}
          checked={all}
          indeterminate={some}
          onChange={(e) => setChecked(e.currentTarget.checked ? options.map((o) => o.value) : [])}
        />
      </div>
      <div className="qfb-sel-items">
        {filtered.map((o) => (
          <div key={o.value} className="qfb-sel-item">
            <s-checkbox
              label={o.label}
              checked={checked.includes(o.value)}
              onChange={(e) => {
                const on = e.currentTarget.checked;
                setChecked((cur) => (on ? [...new Set([...cur, o.value])] : cur.filter((x) => x !== o.value)));
              }}
            />
          </div>
        ))}
      </div>
      <s-button slot="primary-action" variant="primary" onClick={() => onSelect(checked)}>
        Select
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Close
      </s-button>
    </Modal>
  );
}

// ── Empty state (EmptyStateTranslation.jsx) ──────────────────────────────────
export function EmptyStatePanel() {
  const { form, edit, lang, ui, setUi } = useBuilder();
  useEffect(() => {
    if (ui.step !== EMPTY_STATE) setUi({ step: EMPTY_STATE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const t = step2(form, lang).empty_list;
  const img = form.empty_list;
  const [errors, setErrors] = useState([]);
  const set = (key) => (e) => {
    const v = e.currentTarget.value;
    edit((f) => {
      f.translations[lang].form_step_2.empty_list[key] = v;
    });
  };
  return (
    <div className="qfb-panel">
      <s-stack gap="base">
        <s-text-field
          label="Title"
          placeholder="Enter title"
          required
          value={t.popup_header_empty_quote}
          error={!t.popup_header_empty_quote?.trim() ? 'Title is required' : undefined}
          onInput={set('popup_header_empty_quote')}
        />
        <s-text-area label="Content" placeholder="Enter content" rows={4} autocomplete="off" value={t.empty_quote_mess} onInput={set('empty_quote_mess')} />
        <s-text-field
          label="Button label"
          placeholder="Enter label"
          required
          value={t.continue_shopping_label}
          error={!t.continue_shopping_label?.trim() ? 'Label is required' : undefined}
          onInput={set('continue_shopping_label')}
        />
        <ImageDrop
          label="Illustration image"
          hint="Accepts .gif, .jpg, and .png"
          image={img.illustration_image}
          name={img.image_name || img.illustration_image?.split('/').pop()}
          size={img.image_size}
          alt="Empty list image"
          onError={setErrors}
          onPick={({ url, name, size }) =>
            edit((f) => {
              Object.assign(f.empty_list, { illustration_image: url, image_name: name, image_size: size, delete_image: false });
            })
          }
          onRemove={() =>
            edit((f) => {
              Object.assign(f.empty_list, { illustration_image: null, image_name: '', image_size: 0, delete_image: true });
            })
          }
        />
        {errors.length > 0 && (
          <s-banner tone="critical" dismissible onDismiss={() => setErrors([])}>
            {errors.map((er) => (
              <s-paragraph key={er}>{er}</s-paragraph>
            ))}
          </s-banner>
        )}
      </s-stack>
    </div>
  );
}

// ── Behavior (TranslationComponents/…/BehaviorSetting.jsx) ───────────────────
export function BehaviorPanel() {
  const { form, edit } = useBuilder();
  const name = useWcId('qfb-recaptcha');
  const info = form.quote_form_information;
  const version = Number(info.type_recaptcha) ? 'v3' : 'v2';
  const set = (fn) => edit((f) => fn(f.quote_form_information));
  return (
    <div className="qfb-panel">
      <s-stack gap="small-100">
        <s-checkbox
          label="Product additions in form"
          details="Enable the “Add Product” button to allow customers to select multiple products in the quote form without leaving it"
          checked={!!Number(info.product_addition_in_form)}
          onChange={(e) => {
            const on = e.currentTarget.checked ? 1 : 0;
            set((i) => {
              i.product_addition_in_form = on;
            });
          }}
        />
        <div id="agent-focus-recaptcha">
          <s-checkbox
            label="Google reCAPTCHA"
            checked={!!Number(info.use_google_recaptcha)}
            onChange={(e) => {
              const on = e.currentTarget.checked ? 1 : 0;
              set((i) => {
                i.use_google_recaptcha = on;
              });
            }}
          />
        </div>
        {!!Number(info.use_google_recaptcha) && (
          <Indent px={24}>
            <s-stack gap="small">
              <s-choice-list
                label="reCAPTCHA version"
                labelAccessibilityVisibility="exclusive"
                name={name}
                onChange={(e) => {
                  const v = Number(e.currentTarget.values?.[0] ?? 0);
                  set((i) => {
                    i.type_recaptcha = v;
                  });
                }}
              >
                <s-choice value="0" selected={!Number(info.type_recaptcha)}>
                  reCAPTCHA v2
                </s-choice>
                <s-choice value="1" selected={!!Number(info.type_recaptcha)}>
                  reCAPTCHA v3
                </s-choice>
              </s-choice-list>
              <s-text-field
                label="Site key"
                placeholder="Enter site key"
                value={info.ggsite_key?.[version] ?? ''}
                onInput={(e) => {
                  const v = e.currentTarget.value;
                  set((i) => {
                    i.ggsite_key = { ...i.ggsite_key, [version]: v };
                  });
                }}
              />
              <s-text-field
                label="Secret key"
                placeholder="Enter secret key"
                value={info.ggsecret_key?.[version] ?? ''}
                onInput={(e) => {
                  const v = e.currentTarget.value;
                  set((i) => {
                    i.ggsecret_key = { ...i.ggsecret_key, [version]: v };
                  });
                }}
              />
              <div>
                <s-link href="https://help.omegatheme.com/en/article/google-recaptcha-keys-obl5y9/" target="_blank">
                  How to get the key?
                </s-link>
              </div>
            </s-stack>
          </Indent>
        )}
      </s-stack>
    </div>
  );
}
