import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, useWcId } from '../../../shared/wc.jsx';
import { STEP_2, COLOR_SETTINGS, APPEARANCE_DEFAULT, SHOP_DOMAIN, LABELS_EN } from './data.js';
import { LANGUAGES } from './lists.js';
import { useBuilder, step2, defaultLang, redirectUrlError } from './model.js';
import { CollapseMenu, ColorRow, ImageDrop, LanguagePopover, languageName } from './ui.jsx';

// ── After submit (AfterSubmitSetting + ShowSuccessMessageTranslation) ─────────
export function AfterSubmitTab() {
  const { form, edit, lang, ui, setUi } = useBuilder();
  const name = useWcId('qfb-success');
  const rs = form.request_submit;
  const t = step2(form, lang).request_submit;
  const type = rs.type || 'full-size';
  const [errors, setErrors] = useState([]);
  const setText = (key) => (e) => {
    const v = e.currentTarget.value;
    edit((f) => {
      f.translations[lang].form_step_2.request_submit[key] = v;
    });
  };
  const setBase = (patch) =>
    edit((f) => {
      Object.assign(f.request_submit, patch);
    });
  const url = rs.redirect_url ?? '';
  // Save-gated: shown after a failed save, hidden again on the next keystroke.
  const urlError = ui.errors.url ? redirectUrlError(url) || undefined : undefined;
  const showErrors = ui.errors.server;

  return (
    <div>
      <div className="qfb-tab-head">
        <s-heading>After submit</s-heading>
        <s-paragraph color="subdued">Setting up what will happen after customers submit quote inquiry form</s-paragraph>
      </div>
      <div className="qfb-pad">
        <s-choice-list
          label="Success message"
          labelAccessibilityVisibility="exclusive"
          name={name}
          onChange={(e) => {
            const v = e.currentTarget.values?.[0];
            if (!v || v === type) return;
            setBase(v === 'direct-to-url' && !rs.redirect_url ? { type: v, redirect_url: `https://${SHOP_DOMAIN}` } : { type: v });
          }}
        >
          <s-choice value="toast" selected={type === 'toast'}>
            Display as a toast
            {type === 'toast' && (
              <div slot="secondary-content" className="qfb-choice-body">
                <s-text-field
                  label="Toast message"
                  required
                  value={t.toast_message ?? ''}
                  error={showErrors && !t.toast_message?.trim() ? 'Toast message is required' : undefined}
                  onInput={setText('toast_message')}
                />
              </div>
            )}
          </s-choice>
          <s-choice value="full-size" selected={type === 'full-size'}>
            Display as a full-size message
            {type === 'full-size' && (
              <div slot="secondary-content" className="qfb-choice-body">
                <s-stack gap="small-200">
                  <s-text-field
                    label="Title"
                    required
                    value={t.popup_header_submitted_quote ?? ''}
                    error={showErrors && !t.popup_header_submitted_quote?.trim() ? 'Title is required' : undefined}
                    onInput={setText('popup_header_submitted_quote')}
                  />
                  <s-text-field label="Content" value={t.success_submit_mess ?? ''} onInput={setText('success_submit_mess')} />
                  <s-text-field
                    label="Button label"
                    required
                    value={t.continue_shopping_label ?? ''}
                    error={showErrors && !t.continue_shopping_label?.trim() ? 'Label is required' : undefined}
                    onInput={setText('continue_shopping_label')}
                  />
                  <ImageDrop
                    label="Illustration image"
                    hint="Accepts .gif, .jpg, and .png"
                    image={rs.illustration_image}
                    name={rs.image_name || rs.illustration_image?.split('/').pop()}
                    size={rs.image_size}
                    alt="After submit image"
                    onError={setErrors}
                    onPick={({ url: u, name: n, size }) => setBase({ illustration_image: u, image_name: n, image_size: size, delete_image: false })}
                    onRemove={() => setBase({ illustration_image: null, image_name: '', image_size: 0, delete_image: true })}
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
            )}
          </s-choice>
          <s-choice value="direct-to-url" selected={type === 'direct-to-url'}>
            Direct to URL
            {type === 'direct-to-url' && (
              <div slot="secondary-content" className="qfb-choice-body">
                <s-stack gap="small-200">
                  <s-text-field
                    label="Redirect URL"
                    labelAccessibilityVisibility="exclusive"
                    autocomplete="off"
                    value={url}
                    error={urlError}
                    onInput={(e) => {
                      if (ui.errors.url) setUi((u) => ({ errors: { ...u.errors, url: false } }));
                      setBase({ redirect_url: e.currentTarget.value });
                    }}
                  />
                  <s-checkbox
                    label="Open URL in a new tab"
                    checked={!!rs.open_in_new_tab}
                    onChange={(e) => setBase({ open_in_new_tab: e.currentTarget.checked ? 1 : 0 })}
                  />
                </s-stack>
              </div>
            )}
          </s-choice>
        </s-choice-list>
      </div>
    </div>
  );
}

// ── Translation (TranslationSetting + MultiLanguage) ──────────────────────────
export function TranslationTab() {
  const { typeForm, setUi } = useBuilder();
  const [openId, setOpenId] = useState(null);
  useEffect(() => {
    setUi({ step: STEP_2, detail: null, ...(typeForm === 'b2b' ? { loggedIn: true } : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeForm]);
  const b2b = typeForm === 'b2b';

  const menu = [
    { id: 'common_information', title: 'Common Information', content: <CommonInformation /> },
    { id: 'contact_and_company_information', title: b2b ? 'Contact & Company' : 'Contact information', content: <ContactAndCompany /> },
    { id: 'shipping_address', title: 'Shipping address', content: <AddressTranslation kind="shipping" /> },
    b2b && { id: 'billing_address', title: 'Billing address', content: <AddressTranslation kind="billing" /> },
    b2b && { id: 'payment_term', title: 'Payment terms', content: <ItemTranslation customLabel="Payment terms title" labelKey="payment_term_title" /> },
    { id: 'note', title: 'Note', content: <ItemTranslation customLabel="Note title" labelKey="note_title" /> },
    { id: 'other', title: 'Other', content: <OtherTranslation /> },
  ].filter(Boolean);

  return (
    <div>
      <div className="qfb-pad">
        <MultiLanguage />
      </div>
      <s-divider />
      <div className="qfb-tab-head">
        <s-heading>Translation</s-heading>
      </div>
      <CollapseMenu items={menu} openId={openId} onToggle={setOpenId} />
    </div>
  );
}

function MultiLanguage() {
  const { form, edit, commit, lang, setLang, toast } = useBuilder();
  const infoId = useWcId('qfb-ml-info');
  const delId = useWcId('qfb-ml-del');
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const on = !!form.use_multiple_language;
  const isDefault = !!form.translations[lang]?.is_default;

  const toggle = () => {
    commit((f) => {
      f.use_multiple_language = !on;
    });
    toast('Settings saved');
  };

  const setDefault = (checked) => {
    edit((f) => {
      const codes = Object.keys(f.translations);
      let target = lang;
      if (!checked) {
        const i = codes.indexOf(lang);
        target = codes[i + 1] ?? codes[i - 1];
        if (!target) return;
      }
      codes.forEach((c) => {
        f.translations[c].is_default = c === target;
      });
    });
  };

  const deleteLanguage = () => {
    edit((f) => {
      const wasDefault = f.translations[lang]?.is_default;
      delete f.translations[lang];
      f.multiple_form.forEach((mf) => {
        if (mf.languages) delete mf.languages[lang];
      });
      const rest = Object.keys(f.translations);
      if (wasDefault && rest.length) f.translations[rest[0]].is_default = true;
    });
    const rest = Object.keys(form.translations).filter((c) => c !== lang);
    setLang(rest.find((c) => form.translations[c].is_default) || rest[0]);
    setDeleteOpen(false);
    toast('Language removed');
  };

  return (
    <div id="agent-focus-multi-language">
      <s-stack gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-heading>Multi-language form</s-heading>
          <s-badge tone={on ? 'success' : undefined}>{on ? 'On' : 'Off'}</s-badge>
          <s-link tone="neutral" href="https://help.omegatheme.com/en/article/quote-form-builder-1cd6sb4/" target="_blank" interestFor={infoId} accessibilityLabel="Read document">
            <s-icon type="info" />
          </s-link>
          <s-tooltip id={infoId}>Read document</s-tooltip>
        </s-stack>
        <s-paragraph>Display quote form in customer’s language based on your language settings</s-paragraph>
        <div>
          <s-button onClick={toggle}>{on ? 'Turn off' : 'Turn on'}</s-button>
        </div>
        <div>
          {/* Badge size="large" — wraps like Polaris instead of truncating like s-badge. */}
          <span className={`qfb-badge-lg qfb-badge-lg--${on ? 'success' : 'info'}`}>
            {on ? 'The quote form is displayed in the customer’s language.' : 'The quote form is displayed in your default language only'}
          </span>
        </div>
        <s-heading>Language settings</s-heading>
        <div className="qfb-lang-row">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <LanguagePopover />
            {isDefault ? <s-badge tone="info">Default</s-badge> : null}
          </s-stack>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-button variant="tertiary" icon="plus" onClick={() => setAddOpen(true)}>
              Add
            </s-button>
            {!isDefault && (
              <>
                <s-button variant="tertiary" icon="delete" accessibilityLabel="Delete language" interestFor={delId} onClick={() => setDeleteOpen(true)} />
                <s-tooltip id={delId}>Delete language</s-tooltip>
              </>
            )}
          </s-stack>
        </div>
        <s-checkbox label="Set as default" checked={isDefault} onChange={(e) => setDefault(e.currentTarget.checked)} />
      </s-stack>
      {addOpen && <AddLanguageModal onClose={() => setAddOpen(false)} />}
      {deleteOpen && (
        <Modal heading="Confirm delete language" onClose={() => setDeleteOpen(false)}>
          <s-paragraph>Are you sure you want to delete this language?</s-paragraph>
          <s-button slot="primary-action" variant="primary" tone="critical" onClick={deleteLanguage}>
            Delete
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setDeleteOpen(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </div>
  );
}

// "Add new language with AI translation" — core/ListBoxWithSearch: a search box
// whose popover lists the languages (25 first, then "Show all segments"); the
// picked one fills the box. The prototype has no translation service: the new
// language starts as a copy of the default language's texts.
function AddLanguageModal({ onClose }) {
  const { edit, setLang } = useBuilder();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? LANGUAGES.filter(([, name]) => name.toLowerCase().includes(q)) : LANGUAGES;
  }, [query]);
  const visible = showAll ? options : options.slice(0, 25);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        // ListboxWithSearch handleClose: typing without picking clears the choice.
        if (!LANGUAGES.some(([, name]) => name === query)) setPicked(null);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, query]);

  const generate = () => {
    setLoading(true);
    setTimeout(() => {
      const code = picked;
      edit((f) => {
        const base = defaultLang(f);
        const src = f.translations[base];
        f.translations[code] = {
          ...structuredClone(src),
          translations: { ...LABELS_EN, ...structuredClone(src.translations) },
          lang_code: code,
          lang_name: languageName(code),
          is_default: f.translations[code]?.is_default ?? false,
        };
        f.multiple_form.forEach((mf) => {
          mf.languages[code] = structuredClone(mf.languages[base] || mf.languages[Object.keys(mf.languages)[0]]);
        });
      });
      setLang(code);
      setLoading(false);
      onClose();
    }, 600);
  };

  return (
    <Modal heading="Add new language with AI translation" onClose={onClose}>
      <div className="qfb-combo" ref={boxRef}>
        <s-text-field
          label="Select language"
          labelAccessibilityVisibility="exclusive"
          placeholder="Search"
          autocomplete="off"
          value={query}
          onFocus={() => setOpen(true)}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setShowAll(false);
            setOpen(true);
          }}
        />
        {open && (
          <div className="qfb-combo__list qfb-combo__list--tall" role="listbox" aria-label="Select language">
            {visible.map(([code, name]) => (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={picked === code}
                className={`qfb-combo__option${picked === code ? ' qfb-combo__option--selected' : ''}`}
                onClick={() => {
                  setPicked(code);
                  setQuery(name);
                  setOpen(false);
                }}
              >
                <span>{name}</span>
                {picked === code ? <s-icon type="check" /> : null}
              </button>
            ))}
            {!showAll && options.length > visible.length && (
              <button type="button" className="qfb-combo__action" onClick={() => setShowAll(true)}>
                Show all segments
              </button>
            )}
            {!options.length && <div className="qfb-combo__empty">No results found matching "{query}"</div>}
          </div>
        )}
      </div>
      <s-button slot="primary-action" variant="primary" icon="magic" loading={loading} disabled={!picked || loading} onClick={generate}>
        Generate with AI
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

// TranslationSetting/ItemTranslation.jsx
function ItemTranslation({ title, labelKey, placeholderKey, customLabel }) {
  const { form, edit, lang } = useBuilder();
  const t = form.translations[lang].translations;
  const set = (key) => (e) => {
    const v = e.currentTarget.value;
    edit((f) => {
      f.translations[lang].translations[key] = v;
    });
  };
  return (
    <s-stack gap="small-200">
      {title && !customLabel ? <s-text fontWeight="medium">{title}</s-text> : null}
      <div className="qfb-indent-8">
        <s-stack gap="small-200">
          {labelKey && (
            <s-text-field
              label={customLabel || (title ? `${title} label` : labelKey)}
              labelAccessibilityVisibility={customLabel || title ? undefined : 'exclusive'}
              value={t[labelKey] ?? ''}
              onInput={set(labelKey)}
            />
          )}
          {placeholderKey && <s-text-field label={`${title} placeholder`} value={t[placeholderKey] ?? ''} onInput={set(placeholderKey)} />}
        </s-stack>
      </div>
    </s-stack>
  );
}

function CommonInformation() {
  const { typeForm } = useBuilder();
  const dtc = typeForm === 'dtc';
  return (
    <s-stack gap="small-200">
      <ItemTranslation customLabel="Customer information section title" labelKey="information_title" />
      <ItemTranslation customLabel="Products section title" labelKey="products_title" />
      <div className="qfb-indent-8">
        <s-stack gap="small-200">
          <ItemTranslation title="Email address" labelKey="email_address_label" placeholderKey={dtc ? 'email_address_placeholder' : null} />
          {dtc ? <ItemTranslation title="Address" labelKey="location_dtc_title" /> : <ItemTranslation title="Location" labelKey="location_b2b_title" />}
          {dtc && (
            <s-stack gap="small-200">
              <s-text fontWeight="medium">Auto fill help text</s-text>
              <ItemTranslation labelKey="auto_fill_help_text" />
            </s-stack>
          )}
        </s-stack>
      </div>
    </s-stack>
  );
}

function ContactAndCompany() {
  const { typeForm } = useBuilder();
  const b2b = typeForm === 'b2b';
  return (
    <s-stack gap="small-200">
      {b2b ? (
        <ItemTranslation customLabel="Contact & company title" labelKey="contact_and_company_title" />
      ) : (
        <ItemTranslation customLabel="Contact information title" labelKey="contact_title" />
      )}
      <div className="qfb-indent-8">
        <s-stack gap="small-200">
          {b2b && <s-text fontWeight="medium">Contact person</s-text>}
          {b2b && <ItemTranslation customLabel="Contact person title" labelKey="contact_person_title" />}
          {!b2b && (
            <div className="qfb-indent-8">
              <s-stack gap="small-200">
                <ItemTranslation title="First name" labelKey="contact_first_name_label" placeholderKey="placeholder_contact_first_name" />
                <ItemTranslation title="Last name" labelKey="contact_last_name_label" placeholderKey="placeholder_contact_last_name" />
                <ItemTranslation title="Phone number" labelKey="contact_phone_number_label" placeholderKey="placeholder_contact_phone_number" />
              </s-stack>
            </div>
          )}
          {b2b && (
            <>
              <s-text fontWeight="medium">Company</s-text>
              <ItemTranslation customLabel="Company title" labelKey="company_title" />
            </>
          )}
          {!b2b && (
            <div className="qfb-indent-8">
              <s-stack gap="small-200">
                <ItemTranslation title="Company name" labelKey="company_name_label" placeholderKey="company_name_placeholder" />
                <ItemTranslation title="Company ID" labelKey="company_id_title" placeholderKey="company_id_place_holder" />
              </s-stack>
            </div>
          )}
        </s-stack>
      </div>
    </s-stack>
  );
}

const ADDRESS_ROWS = [
  ['Country/region', 'country', 'country'],
  ['First name', 'first_name', 'first_name'],
  ['Last name', 'last_name', 'last_name'],
  ['Company/attention', 'company', 'company'],
  ['Address', 'address', 'address'],
  ['State', 'state', 'state'],
  ['City', 'city', 'city'],
  ['Postal Code', 'postal_code', 'postal_code'],
];

function AddressTranslation({ kind }) {
  const { typeForm } = useBuilder();
  const dtc = typeForm === 'dtc';
  const shipping = kind === 'shipping';
  return (
    <s-stack gap="small-200">
      <ItemTranslation customLabel={shipping ? 'Shipping address title' : 'Billing address title'} labelKey={`${kind}_title`} />
      {dtc && (
        <div className="qfb-indent-8">
          <s-stack gap="small-200">
            {ADDRESS_ROWS.map(([title, key, ph]) => (
              <ItemTranslation key={key} title={title} labelKey={`${kind}_${key}_label`} placeholderKey={`placeholder_${kind}_${ph}`} />
            ))}
            <ItemTranslation title={shipping ? 'Phone number' : 'Phone'} labelKey={`${kind}_phone_number_label`} placeholderKey={`placeholder_${kind}_phone_number`} />
          </s-stack>
        </div>
      )}
    </s-stack>
  );
}

const OTHER_ROWS = [
  ['Edit label', 'edit_label'],
  ['Add product label', 'add_product_label'],
  ['Add product modal title', 'add_product_modal_title'],
  ['Search products', 'search_products'],
  ['Close modal select product', 'close_modal_select_product'],
  ['Select product', 'select_product'],
  ['No products found', 'no_products_found'],
  ['No results found', 'no_results_found'],
  ['No products found hint', 'no_products_found_hint'],
  ['Search by label', 'search_by_label'],
  ['Search by option: All', 'search_by_all'],
  ['Search by option: Product title', 'search_by_title'],
  ['Search by option: Barcode', 'search_by_barcode'],
  ['Search by option: SKU', 'search_by_sku'],
  ['Search by option: Variant title', 'search_by_variant'],
  ['Loading more products', 'loading_more_products'],
  ['Products selected (plural)', 'products_selected'],
  ['Invalid phone number message', 'invalid_phone_number'],
];

function OtherTranslation() {
  return (
    <s-stack gap="small-200">
      {OTHER_ROWS.map(([label, key]) => (
        <ItemTranslation key={key} customLabel={label} labelKey={key} />
      ))}
    </s-stack>
  );
}

// ── Form appearance (AppearanceFormSetting) ───────────────────────────────────
export function AppearanceTab() {
  const { form, edit } = useBuilder();
  const a = { ...APPEARANCE_DEFAULT, ...(form.appearance_form || {}) };
  const size = a.font_size === 'Default' ? 14 : Number(a.font_size);
  const set = (field, value) =>
    edit((f) => {
      f.appearance_form = { ...(f.appearance_form || {}), [field]: value };
    });
  return (
    <div className="qfb-pad">
      <s-heading>Appearance Form</s-heading>
      <div className="qfb-font-row">
        <label className="qfb-range">
          <s-text>Font size</s-text>
          <span className="qfb-range__row">
            <input type="range" min={1} max={24} value={size} onChange={(e) => set('font_size', Number(e.target.value))} aria-label="Font size" />
            <span className="qfb-range__out">{size}</span>
          </span>
        </label>
        <div className="qfb-font-input">
          <s-text-field
            label="Font size"
            labelAccessibilityVisibility="exclusive"
            suffix="px"
            autocomplete="off"
            value={String(size)}
            onInput={(e) => {
              const n = Math.min(48, Number(e.currentTarget.value.replace(/\D/g, '')) || 0);
              set('font_size', n);
            }}
          />
        </div>
      </div>
      <s-stack gap="small-200">
        {COLOR_SETTINGS.map(({ field, label }) => (
          <ColorRow key={field} label={label} value={a[field]} onChange={(v) => set(field, v)} />
        ))}
      </s-stack>
    </div>
  );
}
