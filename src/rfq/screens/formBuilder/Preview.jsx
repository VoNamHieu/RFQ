import React, { useRef, useState } from 'react';
import { Modal, MenuButton } from '../../../shared/wc.jsx';
import {
  STEP_1,
  STEP_2,
  EMPTY_STATE,
  APPEARANCE_DEFAULT,
  SAMPLE_PRODUCT,
  SAMPLE_GUEST,
  SAMPLE_LOGGED_IN,
  SHOP_DOMAIN,
  DATE_FORMATS,
} from './data.js';
import { COUNTRIES, PHONE_COUNTRIES } from './lists.js';
import { useBuilder, step2, labels, step1Lang, fieldsWithText, visibleChoices } from './model.js';
import emptyListImg from './assets/empty_list.webp';
import requestSubmittedImg from './assets/request_submitted.webp';

// Live preview (FormSetting/PreviewForm): what the storefront quote form looks
// like with the current, unsaved settings. Step 1 / Step 2 / Empty state follow
// the element being edited; the After submit tab shows the success message.
// Desktop = the *Translation preview components (current language); mobile =
// PreviewMobi, which production renders with the older PreviewStep1/2 (no step
// connector line, the other step's number greyed out, a plain "Edit" link).

function useLook() {
  const { form } = useBuilder();
  return { ...APPEARANCE_DEFAULT, ...(form.appearance_form || {}) };
}
const fontPx = (look) => (look.font_size === 'Default' ? 14 : Number(look.font_size) || 14);

export function Preview() {
  const { ui } = useBuilder();
  const look = useLook();
  return (
    <div className="qfb-pv" style={{ color: look.text_color, fontSize: fontPx(look) }}>
      {ui.tab === 1 ? <ThankYouPreview /> : <SubmitFormPreview />}
    </div>
  );
}

function SubmitFormPreview() {
  const { form, ui, setUi, typeForm } = useBuilder();
  // A form without step 1 previews its contact step.
  const step = ui.step === STEP_1 && !form.multiple_form[ui.variant] ? STEP_2 : ui.step;
  let body = null;
  if (ui.screen === 'desktop') {
    if (step === EMPTY_STATE) body = <EmptyStatePreview />;
    else if (step === STEP_1) body = <Step1Preview />;
    else body = <Step2Preview />;
  } else if (ui.tab === 0) {
    // PreviewMobi: only the Element tab renders it; the empty state shows step 2.
    const popup = form.multiple_form.length > 0;
    body = (
      <div className={`qfb-pv-mobile${popup ? ' qfb-pv-mobile--popup' : ''}`}>
        {step === STEP_1 ? <Step1Preview mobi /> : <Step2Preview mobi />}
      </div>
    );
  }

  return (
    <>
      <div className="qfb-pv-actions">
        {typeForm !== 'b2b' && (
          <MenuButton
            items={[
              { content: 'Logged-in', onAction: () => setUi({ loggedIn: true }) },
              { content: 'Guest', onAction: () => setUi({ loggedIn: false }) },
            ]}
            accessibilityLabel="Preview as"
          >
            {ui.loggedIn ? 'Logged-in' : 'Guest'}
          </MenuButton>
        )}
        <s-button onClick={() => setUi({ fullPreview: true })}>See full preview</s-button>
      </div>
      {body}
      {ui.fullPreview && (
        <Modal heading="Preview Form Step 2" size="large" onClose={() => setUi({ fullPreview: false })}>
          <div className="qfb-pv qfb-pv--modal" style={{ color: textColorOf(form) }}>
            <Step2Preview full />
          </div>
          <s-button slot="secondary-actions" onClick={() => setUi({ fullPreview: false })}>
            Close
          </s-button>
        </Modal>
      )}
    </>
  );
}
const textColorOf = (form) => ({ ...APPEARANCE_DEFAULT, ...(form.appearance_form || {}) }).text_color;

// ── Pieces ───────────────────────────────────────────────────────────────────
function XMark() {
  return (
    <svg className="qfb-pv-x" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M13.97 15.03a.75.75 0 1 0 1.06-1.06l-3.97-3.97 3.97-3.97a.75.75 0 0 0-1.06-1.06l-3.97 3.97-3.97-3.97a.75.75 0 0 0-1.06 1.06l3.97 3.97-3.97 3.97a.75.75 0 1 0 1.06 1.06l3.97-3.97 3.97 3.97Z" />
    </svg>
  );
}

function StepBox({ n, text, showNumber = true, background, numberColor }) {
  const look = useLook();
  return (
    <div className="qfb-pv-stepbox">
      {showNumber && (
        <span className="qfb-pv-stepnum" style={{ backgroundColor: background, color: numberColor }}>
          {n}
        </span>
      )}
      <p style={{ color: look.text_color, fontWeight: 600, margin: 0 }}>{text}</p>
    </div>
  );
}

// Card header: step boxes + close icon. `current` = the step being previewed
// (mobile greys out the other one).
function FormHeader({ mobi, current }) {
  const { form, lang, ui } = useBuilder();
  const look = useLook();
  const hasStep1 = form.multiple_form.length > 0;
  const t1 = step1Lang(form, current === STEP_2 ? ui.variant : 0, lang)?.quote_form_header.popup_header_list_quote;
  const t2 = step2(form, lang).quote_form_header.popup_header_list_quote;
  const on = { background: look.text_color, numberColor: look.primary_bg_color };
  const off = { background: look.secondary_bg_color, numberColor: look.text_color };
  const s1 = mobi && current === STEP_2 ? off : on;
  const s2 = mobi && current === STEP_1 ? off : on;
  return (
    <div className="qfb-pv-head" style={{ backgroundColor: look.header_bg_color }}>
      {mobi && (
        <div className="qfb-pv-head__x">
          <XMark />
        </div>
      )}
      <div className={`qfb-pv-head__row${mobi ? ' qfb-pv-head__row--center' : ''}`}>
        <div className={`qfb-pv-steps${mobi && current === STEP_1 ? ' qfb-pv-steps--wide' : ''}`}>
          {hasStep1 && (
            <>
              <StepBox n={1} text={t1} {...s1} />
              {!mobi && <span className="qfb-pv-line" style={{ backgroundColor: look.text_color }} />}
            </>
          )}
          <StepBox n={2} text={t2} showNumber={hasStep1} {...s2} />
        </div>
        {!mobi && <XMark />}
      </div>
    </div>
  );
}

// ButtonSubmitTranslation — "Continue shopping" + submit, aligned per setting.
function FormFooter({ mobi, step }) {
  const { form, lang, ui } = useBuilder();
  const look = useLook();
  let close;
  let submit;
  let position;
  if (step === STEP_1) {
    const l = form.multiple_form[ui.variant]?.languages?.[lang] || step1Lang(form, ui.variant, lang);
    close = l?.quote_form_header?.popup_shopping_mess;
    submit = l?.footer_setting?.submitting_quote_mess;
    position = form.multiple_form[ui.variant]?.quote_form_bottom?.submitting_position;
  } else {
    const t2 = step2(form, lang);
    close = t2.quote_form_header.popup_shopping_mess;
    submit = t2.quote_form_bottom.submitting_quote_mess;
    position = t2.quote_form_bottom.submitting_position;
  }
  const justify = mobi ? 'center' : { left: 'flex-start', center: 'center', right: 'flex-end' }[position] || 'center';
  const btn = { fontSize: fontPx(look) };
  return (
    <div className="qfb-pv-foot" style={{ backgroundColor: look.footer_bg_color, justifyContent: justify }}>
      <button type="button" className="qfb-pv-btn" style={{ ...btn, color: look.continue_button_color, backgroundColor: look.continue_button_bg_color }}>
        {close}
      </button>
      <button type="button" className="qfb-pv-btn" style={{ ...btn, color: look.submit_button_color, backgroundColor: look.submit_button_bg_color }}>
        {submit}
      </button>
    </div>
  );
}

const Req = () => <span className="qfb-pv-req">*</span>;

function Field({ label, required, children, className = '' }) {
  return (
    <label className={`qfb-pv-field ${className}`}>
      {label != null && (
        <span className="qfb-pv-label">
          {label}
          {required ? <span className="qfb-pv-req qfb-pv-req--ind">*</span> : null}
        </span>
      )}
      {children}
    </label>
  );
}

const Input = ({ value = '', placeholder, disabled, type = 'text' }) => (
  <input className="qfb-pv-in" type={type} defaultValue={value} placeholder={placeholder} disabled={disabled} />
);

// Polaris Select of countryOptions: without a placeholder the first country shows.
function CountrySelect({ placeholder, value, onChange }) {
  const [own, setOwn] = useState(placeholder ? '' : COUNTRIES[0][0]);
  const current = onChange ? value || '' : own;
  return (
    <select className="qfb-pv-in qfb-pv-select" value={current} onChange={(e) => (onChange ? onChange(e.target.value) : setOwn(e.target.value))}>
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {COUNTRIES.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

const flag = (code) => String.fromCodePoint(...[...code.slice(0, 2)].map((c) => 127397 + c.charCodeAt(0)));

// The 68px phone-country Select with the country's flag drawn over it.
function PhoneCode({ initial = PHONE_COUNTRIES[0][0] }) {
  const [code, setCode] = useState(initial);
  return (
    <span className="qfb-pv-code">
      <select className="qfb-pv-in qfb-pv-select" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Country code">
        {PHONE_COUNTRIES.map(([v, country, dial]) => (
          <option key={v} value={v}>
            {`${country} (${dial})`}
          </option>
        ))}
      </select>
      <span className="qfb-pv-flag" aria-hidden="true">
        {flag(code)}
      </span>
    </span>
  );
}

function PhoneInput({ value, placeholder, codeFirst = false, initialCode }) {
  return (
    <div className="qfb-pv-phone">
      {codeFirst && <PhoneCode initial={initialCode} />}
      <input className="qfb-pv-in" defaultValue={value} placeholder={placeholder} />
      {!codeFirst && <PhoneCode initial={initialCode} />}
    </div>
  );
}

// ── Request list table (RequestListTableTranslation / mobile RequestListTable) ──
function RequestListTable({ step, mobi }) {
  const { form, lang } = useBuilder();
  const look = useLook();
  const rl = form.quote_form_request_list;
  const L = step2(form, lang).quote_form_request_list;
  const T = labels(form, lang);
  const isStep2 = step === STEP_2;
  const p = SAMPLE_PRODUCT;
  const fs = fontPx(look);

  if (mobi) {
    return (
      <div className="qfb-pv-mtable">
        <div className="qfb-pv-mtable__row">
          <img src={p.product_image} alt="Product image" className="qfb-pv-mtable__img" />
          <div className="qfb-pv-stack8">
            <strong className="qfb-pv-mtitle">{p.product_title}</strong>
            {!!rl.show_product_price && (
              <span>
                {isStep2 ? `${L.price_text}:  ` : ''} {p.price}
              </span>
            )}
            {!!rl.show_product_sku && (
              <span>
                {L.sku_text}: {p.sku}
              </span>
            )}
            {!rl.hide_option_table && <span>Variant: {p.option}</span>}
            {!!rl.show_properties_form && (
              <span className="qfb-pv-max200">
                {L.properties_form_text}: {p.properties}
              </span>
            )}
            {!!rl.show_offered_price && isStep2 && (
              <span>
                {L.offered_price_text}: {p.wished_price}
              </span>
            )}
            {!!rl.show_product_message && isStep2 && (
              <span>
                {L.message_text}: {p.note}
              </span>
            )}
            {isStep2 && (
              <span>
                <button type="button" className="qfb-pv-plain">
                  <u>Edit</u>
                </button>
              </span>
            )}
            <div className="qfb-pv-qtyrow">
              {!rl.hide_quantity_table && <input className="qfb-pv-in qfb-pv-qty" type="number" defaultValue={p.quantity} aria-label={L.quantity_text} />}
              {!rl.hide_remove_table && <TrashIcon />}
            </div>
            {!!rl.show_product_price && <span className="qfb-pv-medium">{p.price}</span>}
          </div>
        </div>
        {!isStep2 && !!rl.show_offered_price && (
          <Field label={L.offered_price_text}>
            <Input type="number" value={p.wished_price} placeholder="Enter your price" />
          </Field>
        )}
        {!isStep2 && !!rl.show_product_message && (
          <Field label={L.message_text}>
            <textarea className="qfb-pv-in" rows={1} placeholder={L.message_placeholder} />
          </Field>
        )}
        {!isStep2 && !!rl.show_total_price && (
          <div className="qfb-pv-total">
            <span className="qfb-pv-medium">{L.total_price_text}:</span>
            <span className="qfb-pv-medium">{p.total_price}</span>
          </div>
        )}
        {!!rl.show_sub_total_price_quote && (
          <div className="qfb-pv-total">
            <span className="qfb-pv-medium">{L.sub_total_price_quote_text}:</span>
            <span className="qfb-pv-medium">{p.total_price}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="qfb-pv-table">
        <table>
          <thead>
            <tr style={{ backgroundColor: look.section_title_bg_color }}>
              <th className="qfb-pv-th--product">{L.product_text}</th>
              {!rl.hide_quantity_table && <th className="qfb-pv-th--qty">{L.quantity_text}</th>}
              {!isStep2 && !!rl.show_offered_price && <th className="qfb-pv-th--offer">{L.offered_price_text}</th>}
              {isStep2 && !rl.hide_remove_table && <th />}
              {!!rl.show_total_price && <th className="qfb-pv-th--total">{L.total_price_text}</th>}
              {!isStep2 && !!rl.show_product_message && <th className="qfb-pv-th--note">{L.message_text}</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="qfb-pv-prod">
                  <img src={p.product_image} alt="Product image" className="qfb-pv-thumb" />
                  <div className="qfb-pv-stack4">
                    <strong className="qfb-pv-ptitle">{p.product_title}</strong>
                    {!!rl.show_product_price && (
                      <span>
                        {L.price_text}: {p.price}
                      </span>
                    )}
                    {!!rl.show_product_sku && (
                      <span>
                        {L.sku_text}: {p.sku}
                      </span>
                    )}
                    {!rl.hide_option_table && <span>Color: {p.option}</span>}
                    {!!rl.show_properties_form && (
                      <span className="qfb-pv-max200">
                        {L.properties_form_text}: {p.properties}
                      </span>
                    )}
                    {!!rl.show_offered_price && isStep2 && (
                      <span>
                        {L.offered_price_text}: {p.wished_price_text}
                      </span>
                    )}
                    {!!rl.show_product_message && isStep2 && (
                      <span>
                        {L.message_text}: {p.note}
                      </span>
                    )}
                    {isStep2 && (
                      <>
                        <u className="qfb-pv-link" style={{ fontSize: fs }}>
                          {T.edit_label || 'Edit'}
                        </u>
                        {!!form.quote_form_information.product_addition_in_form && (
                          <span>
                            <button
                              type="button"
                              className="qfb-pv-add"
                              style={{ backgroundColor: look.submit_button_bg_color, color: look.submit_button_color }}
                            >
                              <span style={{ fontSize: fs }}>+ {T.add_product_label || 'Add product'}</span>
                            </button>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </td>
              {!rl.hide_quantity_table && (
                <td>
                  <input className="qfb-pv-in qfb-pv-qty" type="number" defaultValue={p.quantity} aria-label={L.quantity_text} />
                </td>
              )}
              {isStep2 && !rl.hide_remove_table && (
                <td>
                  <TrashIcon />
                </td>
              )}
              {!isStep2 && !!rl.show_offered_price && (
                <td>
                  <input className="qfb-pv-in" type="number" defaultValue={p.wished_price} aria-label={L.offered_price_text} />
                </td>
              )}
              {!!rl.show_total_price && (
                <td>
                  <span className="qfb-pv-medium">{p.total_price}</span>
                </td>
              )}
              {!isStep2 && !!rl.show_product_message && (
                <td>
                  <textarea className="qfb-pv-in" rows={1} placeholder={L.message_placeholder} aria-label={L.message_text} />
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="qfb-pv-divider" />
      {!!rl.show_sub_total_price_quote && (
        <div className="qfb-pv-subtotal">
          {L.sub_total_price_quote_text}: ${rl.show_product_price ? '240.00' : '0'}
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg className="qfb-pv-trash" viewBox="0 0 20 20" aria-label="Remove">
      <path d="M11.5 8.25a.75.75 0 0 1 .75.75v4.25a.75.75 0 0 1-1.5 0v-4.25a.75.75 0 0 1 .75-.75Z" />
      <path d="M9.25 9a.75.75 0 0 0-1.5 0v4.25a.75.75 0 0 0 1.5 0v-4.25Z" />
      <path
        fillRule="evenodd"
        d="M7.25 5.25a2.75 2.75 0 0 1 5.5 0h3a.75.75 0 0 1 0 1.5h-.75v5.45c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311c-.642.327-1.482.327-3.162.327h-.4c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311c-.327-.642-.327-1.482-.327-3.162v-5.45h-.75a.75.75 0 0 1 0-1.5h3Zm1.5 0a1.25 1.25 0 1 1 2.5 0h-2.5Zm-2.25 1.5h7v5.45c0 .865-.001 1.423-.036 1.848-.033.408-.09.559-.128.633a1.5 1.5 0 0 1-.655.655c-.074.038-.225.095-.633.128-.425.035-.983.036-1.848.036h-.4c-.865 0-1.423-.001-1.848-.036-.408-.033-.559-.09-.633-.128a1.5 1.5 0 0 1-.656-.655c-.037-.074-.094-.225-.127-.633-.035-.425-.036-.983-.036-1.848v-5.45Z"
      />
    </svg>
  );
}

// ── Custom fields (RequestFormTranslation + FormField) ───────────────────────
// constant/quoteForm.jsx checkAndCondition — the builder previews in "actual"
// mode, so a conditional field only shows once the preview answers satisfy it.
function conditionMet(c, values) {
  if (!(c.formId in values)) return false;
  const raw = values[c.formId];
  const value = typeof raw === 'string' ? raw.trim() : raw;
  const len = value?.length ?? 0;
  const list = Array.isArray(c.conditionValue) ? c.conditionValue : [];
  switch (c.formType) {
    case 'text':
    case 'file':
    case 'phone':
      return c.operator === 'empty' ? len === 0 : c.operator === 'not_empty' ? len > 0 : false;
    case 'select':
    case 'radio':
    case 'checkbox': {
      const v = Array.isArray(value) ? value : [value];
      if (c.operator === 'contains') return v.some((x) => list.includes(x));
      if (c.operator === 'not_contains') return v.every((x) => !list.includes(x));
      return false;
    }
    case 'date': {
      const day = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).getTime() : NaN);
      const today = day(new Date().toISOString());
      const v = day(value);
      if (c.operator === 'today') return v === today;
      if (c.operator === 'on_or_before') return !!c.conditionValue && v <= day(c.conditionValue);
      if (c.operator === 'on_or_after') return !!c.conditionValue && v >= day(c.conditionValue);
      if (c.operator === 'in_the_next_x_days') return !!c.conditionValue && v >= today && v <= today + Number(c.conditionValue) * 86400000;
      return c.operator === 'empty' ? len === 0 : c.operator === 'not_empty' ? len > 0 : false;
    }
    case 'country': {
      if (c.operator === 'not_empty') return len > 0;
      if (c.operator === 'empty') return len === 0;
      if (!len) return false;
      if (c.operator === 'contains') return list.includes('all') || list.includes(value);
      if (c.operator === 'not_contains') return !list.includes('all') && !list.includes(value);
      return false;
    }
    default:
      return false;
  }
}

function initialValue(f) {
  const choices = f.choices || [];
  if (f.input === 'select') return choices.find((c) => Number(c.sel))?.label ?? '';
  if (f.input === 'radio') return [choices.find((c) => Number(c.sel))?.label ?? choices[0]?.label];
  if (f.input === 'checkbox') return choices.filter((c) => Number(c.sel)).map((c) => c.label);
  if (f.input === 'file') return [];
  return '';
}

function RequestForm({ step, mobi }) {
  const { form, lang, ui } = useBuilder();
  const look = useLook();
  const fields = fieldsWithText(form, step, ui.variant, lang).map((f) => ({ ...f, choices: visibleChoices(f.choices) }));
  const [values, setValues] = useState({});
  const valueOf = (f) => (f.id in values ? values[f.id] : initialValue(f));
  const allValues = Object.fromEntries(fields.map((f) => [f.id, valueOf(f)]));
  return (
    <div className={`qfb-pv-form${mobi || ui.tab !== 0 ? ' qfb-pv-form--flush' : ''}`}>
      {fields.map((f) =>
        f.use_condition && !(f.conditions || []).some((group) => group.every((c) => conditionMet(c, allValues))) ? null : (
          <div key={f.id} className="qfb-pv-form__item" style={{ width: mobi ? '100%' : `${Number(f.width) || 100}%` }}>
            <FormField field={f} look={look} value={valueOf(f)} onChange={(v) => setValues((cur) => ({ ...cur, [f.id]: v }))} />
          </div>
        ),
      )}
    </div>
  );
}

function formatDate(iso, dateFormat) {
  const fmt = DATE_FORMATS.find((d) => d.value === dateFormat)?.moment || 'DD/MM/YYYY';
  const d = new Date(`${iso}T00:00:00`);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pad = (n) => String(n).padStart(2, '0');
  const tokens = {
    YYYY: String(d.getFullYear()),
    MMMM: months[d.getMonth()],
    MMM: months[d.getMonth()].slice(0, 3),
    MM: pad(d.getMonth() + 1),
    M: String(d.getMonth() + 1),
    dddd: days[d.getDay()],
    DD: pad(d.getDate()),
    D: String(d.getDate()),
  };
  return fmt.replace(/YYYY|MMMM|MMM|MM|M|dddd|DD|D/g, (t) => tokens[t]);
}

// core/DatePicker: a text field showing the placeholder (as its value) until a
// date is picked, then the date in the field's format.
function DateInput({ placeholder, dateFormat, value, onChange }) {
  const ref = useRef(null);
  return (
    <span className="qfb-pv-datewrap">
      <input
        className="qfb-pv-in"
        readOnly
        value={value ? formatDate(value, dateFormat) : placeholder || ''}
        onClick={() => {
          try {
            ref.current?.showPicker();
          } catch {
            ref.current?.focus();
          }
        }}
      />
      <input ref={ref} className="qfb-pv-datenative" type="date" tabIndex={-1} aria-hidden="true" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </span>
  );
}

function FormField({ field: f, look, value, onChange }) {
  const req = !!Number(f.req);
  if (f.input === 'simple') {
    return (
      <p className="qfb-pv-p">
        <span style={{ fontStyle: 'italic' }}>{f.content} </span>
        {req ? <Req /> : null}
      </p>
    );
  }
  if (f.input === 'text') {
    if (f.type === 'country' || f.type === 'state') {
      return (
        <Field label={f.label} required={req}>
          {f.type === 'state' ? (
            <select className="qfb-pv-in qfb-pv-select" value="" onChange={() => {}}>
              <option value="" disabled>
                {f.placeholder}
              </option>
            </select>
          ) : (
            <CountrySelect placeholder={f.placeholder} value={value} onChange={onChange} />
          )}
        </Field>
      );
    }
    if (f.type === 'phone') {
      return (
        <Field label={f.label} required={req}>
          <div className="qfb-pv-phone">
            <PhoneCode initial="VN" />
            <input className="qfb-pv-in" placeholder={f.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
          </div>
        </Field>
      );
    }
    return (
      <Field label={f.label} required={req}>
        {f.type === 'textarea' ? (
          <textarea className="qfb-pv-in" rows={5} placeholder={f.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input
            className="qfb-pv-in"
            type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'}
            placeholder={f.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </Field>
    );
  }
  if (f.input === 'select') {
    return (
      <div className="qfb-pv-field">
        <span className="qfb-pv-label">
          {f.label} {req ? <Req /> : null}
        </span>
        {(f.choices || []).length > 0 && (
          <select className="qfb-pv-in qfb-pv-select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
            {f.placeholder ? (
              <option value="" disabled>
                {f.placeholder}
              </option>
            ) : null}
            {f.choices.map((c, i) => (
              <option key={i} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }
  if (f.input === 'radio' || f.input === 'checkbox') {
    const picked = Array.isArray(value) ? value : [];
    return (
      <div className="qfb-pv-field">
        <span className="qfb-pv-label">
          {f.label} {req ? <Req /> : null}
        </span>
        {(f.choices || []).map((c, i) => (
          <label key={i} className="qfb-pv-choice">
            <input
              type={f.input}
              name={`qfb-pv-${f.id}`}
              checked={picked.includes(c.label)}
              onChange={(e) => {
                if (f.input === 'radio') onChange([c.label]);
                else onChange(e.target.checked ? [...picked, c.label] : picked.filter((x) => x !== c.label));
              }}
            />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    );
  }
  if (f.input === 'date') {
    return (
      <div className="qfb-pv-field">
        <span className="qfb-pv-label">
          {f.label} {req ? <Req /> : null}
        </span>
        <DateInput placeholder={f.placeholder} dateFormat={f.dateFormat || 'F j, Y'} value={value} onChange={onChange} />
      </div>
    );
  }
  if (f.input === 'file') {
    return (
      <div className="qfb-pv-field qfb-pv-file">
        <span>
          <button type="button" className="qfb-pv-add" style={{ backgroundColor: look.submit_button_bg_color, color: look.submit_button_color }}>
            <span>{f.label}</span>
          </button>
        </span>
      </div>
    );
  }
  return null;
}

// ── Step 1 (PreviewStep1Translation; mobile = PreviewStep1) ──────────────────
function Step1Preview({ mobi }) {
  const look = useLook();
  return (
    <div className="qfb-pv-card">
      <FormHeader mobi={mobi} current={STEP_1} />
      <div className="qfb-pv-body" style={{ backgroundColor: look.secondary_bg_color }}>
        <div className="qfb-pv-box qfb-pv-box--r4" style={{ backgroundColor: look.primary_bg_color }}>
          <RequestListTable step={STEP_1} mobi={mobi} />
          <div className="qfb-pv-pl8">
            <RequestForm step={STEP_1} mobi={mobi} />
          </div>
        </div>
      </div>
      <FormFooter mobi={mobi} step={STEP_1} />
    </div>
  );
}

// ── Step 2 (PreviewStep2Translation; mobile = PreviewStep2) ──────────────────
function Step2Preview({ mobi, full = false }) {
  const { form, lang, ui } = useBuilder();
  const look = useLook();
  const T = labels(form, lang);
  const detail = ui.detail;
  const wideProducts = detail === 'productList' && !full;
  const wideCustomer = (detail === 'note' || detail === 'customerInfo' || ui.tab === 2) && !full;
  const showCustomer = full || detail !== 'productList';
  const showProducts = full || (detail !== 'note' && detail !== 'customerInfo' && ui.tab !== 2);
  const loggedIn = ui.loggedIn;

  const products = (
    <div key="p" className={`qfb-pv-cell${wideProducts || mobi ? ' qfb-pv-cell--wide' : ''}`}>
      <div className="qfb-pv-box" style={{ backgroundColor: look.primary_bg_color }}>
        {/* The *Translation preview reads `translations.products_title` off the
            language map (undefined), so its title row renders empty. */}
        <div className="qfb-pv-pad8">
          <strong>{mobi ? T.products_title : null}</strong>
        </div>
        <RequestListTable step={STEP_2} mobi={mobi} />
      </div>
    </div>
  );
  const customer = (
    <div key="c" className={`qfb-pv-cell${wideCustomer || mobi ? ' qfb-pv-cell--wide' : ''}`}>
      <div className="qfb-pv-box" style={{ backgroundColor: look.primary_bg_color }}>
        {loggedIn ? <LoggedInCustomer mobi={mobi} /> : <GuestCustomer mobi={mobi} />}
      </div>
    </div>
  );

  let cells;
  if (mobi) cells = [showProducts && products, showCustomer && customer];
  else cells = [showCustomer && customer, showProducts && products];

  return (
    <div className="qfb-pv-card">
      <FormHeader mobi={mobi} current={STEP_2} />
      <div className={`qfb-pv-body${full ? ' qfb-pv-body--full' : ''}`} style={{ backgroundColor: look.secondary_bg_color }}>
        <div className={`qfb-pv-grid${mobi ? ' qfb-pv-grid--mobi' : ''}`}>{cells.filter(Boolean)}</div>
      </div>
      <FormFooter mobi={mobi} step={STEP_2} />
    </div>
  );
}

// "contact-information" collapsible section of the customer box.
function Section({ title, children, initiallyOpen = true }) {
  const look = useLook();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="qfb-pv-section">
      <button type="button" className="qfb-pv-section__head" style={{ backgroundColor: look.section_title_bg_color }} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true" className={open ? '' : 'qfb-rot'}>
          <path d="M5.72 8.47a.75.75 0 0 1 1.06 0l3.22 3.22 3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-3.75-3.75a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
      {open && <div className="qfb-pv-pad8">{children}</div>}
    </div>
  );
}

// PreviewCustomerTranslation — guest checkout of the quote.
function GuestCustomer({ mobi }) {
  const { form, lang, typeForm } = useBuilder();
  const T = labels(form, lang);
  const vfs = form.view_form_submit;
  const fs = form.fields_setting;
  const b2b = typeForm === 'b2b';
  const g = SAMPLE_GUEST;
  const [useAsBilling, setUseAsBilling] = useState(false);
  const contact = (k, prop = 'enabled') => (b2b ? true : fs.contact_info[k]?.[prop]);
  const ship = (k, prop = 'enabled') => (b2b ? true : fs.shipping_address[k]?.[prop]);
  const anyContact = Object.values(fs.contact_info).some((x) => x.enabled);
  const anyShip = Object.values(fs.shipping_address).some((x) => x.enabled);
  const showShipping = b2b ? !!vfs.b2b_show_shipping : !!vfs.dtc_show_shipping && anyShip;
  const pair = (a, b) => (
    <div className="qfb-pv-pair">
      {a}
      {b}
    </div>
  );

  return (
    <div className="qfb-pv-customer">
      <div className="qfb-pv-pad8">
        <strong>{T.information_title}</strong>
        <Field label={T.email_address_label} required>
          <Input value={g.email} />
        </Field>
        <p className="qfb-pv-p qfb-pv-mt8">{T.auto_fill_help_text}</p>
      </div>
      {anyContact && (
        <Section title={b2b ? T.contact_and_company_title : T.contact_title}>
          <div className="qfb-pv-stack8">
            {b2b && <p className="qfb-pv-p qfb-pv-medium">{T.contact_person_title}</p>}
            {pair(
              contact('first_name') && (
                <Field label={T.contact_first_name_label} required={contact('first_name', 'required')}>
                  <Input value={g.firstName} />
                </Field>
              ),
              contact('last_name') && (
                <Field label={T.contact_last_name_label} required={contact('last_name', 'required')}>
                  <Input value={g.lastName} />
                </Field>
              ),
            )}
            {contact('phone_number') && (
              <Field label={T.contact_phone_number_label} required={contact('phone_number', 'required')}>
                <PhoneInput value={g.phone} placeholder={T.placeholder_contact_phone_number} codeFirst={mobi} />
              </Field>
            )}
            {b2b && !!vfs.b2b_show_company && (
              <div className="qfb-pv-stack8">
                <p className="qfb-pv-p qfb-pv-medium">{T.company_title}</p>
                <Field label={T.company_name_label}>
                  <Input value={g.companyName} />
                </Field>
                <Field label={T.company_id_title}>
                  <Input value={g.companyId} />
                </Field>
              </div>
            )}
          </div>
        </Section>
      )}
      {showShipping && (
        <Section title={T.shipping_title}>
          <div className="qfb-pv-stack8">
            {ship('country') && (
              <Field label={T.shipping_country_label} required={ship('country', 'required')}>
                <CountrySelect />
              </Field>
            )}
            {pair(
              ship('first_name') && (
                <Field label={T.shipping_first_name_label} required={ship('first_name', 'required')}>
                  <Input value={g.firstName} />
                </Field>
              ),
              ship('last_name') && (
                <Field label={T.shipping_last_name_label} required={ship('last_name', 'required')}>
                  <Input value={g.shippingLastName} />
                </Field>
              ),
            )}
            {ship('company') && (
              <Field label={T.shipping_company_label} required={ship('company', 'required')}>
                <Input value={g.companyName} />
              </Field>
            )}
            {ship('address') && (
              <Field label={T.shipping_address_label} required={ship('address', 'required')}>
                <Input value={g.address} />
              </Field>
            )}
            {ship('state') && (
              <Field label={T.shipping_state_label} required={ship('state', 'required')}>
                <select className="qfb-pv-in qfb-pv-select" defaultValue="State">
                  <option>State</option>
                </select>
              </Field>
            )}
            {pair(
              ship('city') && (
                <Field label={T.shipping_city_label} required={ship('city', 'required')}>
                  <Input value={g.city} />
                </Field>
              ),
              ship('postal_code') && (
                <Field label={T.shipping_postal_code_label} required={ship('postal_code', 'required')}>
                  <Input value={g.postalCode} />
                </Field>
              ),
            )}
            {ship('phone_number') && (
              <Field label={T.shipping_phone_number_label} required={ship('phone_number', 'required')}>
                <PhoneInput value={g.phone} placeholder={T.placeholder_shipping_phone_number} codeFirst />
              </Field>
            )}
            {b2b && (
              <label className="qfb-pv-choice">
                <input type="checkbox" checked={useAsBilling} onChange={(e) => setUseAsBilling(e.target.checked)} />
                <span>{T.shipping_use_as_billing}</span>
              </label>
            )}
          </div>
        </Section>
      )}
      {b2b && !!vfs.b2b_show_billing && !useAsBilling && (
        <>
          <div className="qfb-pv-divider" />
          <Section title={T.billing_title}>
            <div className="qfb-pv-stack8">
              <Field label={T.billing_country_label}>
                <CountrySelect />
              </Field>
              {pair(
                <Field label={T.billing_first_name_label}>
                  <Input value={g.firstName} />
                </Field>,
                <Field label={T.billing_last_name_label}>
                  <Input value={g.lastName} />
                </Field>,
              )}
              <Field label={T.billing_company_label}>
                <Input value={g.companyName} />
              </Field>
              <Field label={T.billing_address_label}>
                <Input value={g.address} />
              </Field>
              <Field label={T.billing_state_label}>
                <select className="qfb-pv-in qfb-pv-select" defaultValue="State">
                  <option>State</option>
                </select>
              </Field>
              {pair(
                <Field label={T.billing_city_label}>
                  <Input value={g.city} />
                </Field>,
                <Field label={T.billing_postal_code_label}>
                  <Input value={g.postalCode} />
                </Field>,
              )}
              <Field label={T.billing_phone_number_label}>
                <PhoneInput value={g.phone} placeholder={T.placeholder_billing_phone_number} codeFirst />
              </Field>
            </div>
          </Section>
          <div className="qfb-pv-divider" />
        </>
      )}
      <Section title={T.note_title}>
        <RequestForm step={STEP_2} mobi={mobi} />
      </Section>
    </div>
  );
}

// PreviewLoginCustomerTranslation — details come from the customer account.
function LoggedInCustomer({ mobi }) {
  const { form, lang, typeForm } = useBuilder();
  const T = labels(form, lang);
  const vfs = form.view_form_submit;
  const b2b = typeForm === 'b2b';
  const c = SAMPLE_LOGGED_IN;
  const lines = (list) => list.map((line) => <p key={line} className="qfb-pv-p">{` ${line} `}</p>);
  return (
    <div className="qfb-pv-customer">
      <div className="qfb-pv-pad8">
        <strong>{T.information_title}</strong>
        <Field label={T.email_address_label}>
          <Input value={c.email} disabled />
        </Field>
        <div className="qfb-pv-pb12">
          <Field label={b2b ? T.location_b2b_title : T.location_dtc_title}>
            <select className="qfb-pv-in qfb-pv-select" disabled={b2b} defaultValue="0">
              <option value="0">{c.location}</option>
            </select>
          </Field>
        </div>
      </div>
      <Section title={b2b ? T.contact_and_company_title : T.contact_title}>
        {b2b && <p className="qfb-pv-p qfb-pv-medium">{T.contact_person_title}</p>}
        {lines(c.contact)}
        {b2b && !!vfs.b2b_show_company && (
          <div className="qfb-pv-mt8">
            <p className="qfb-pv-p qfb-pv-medium">{T.company_title}</p>
            <p className="qfb-pv-p">{` ${c.company} `}</p>
          </div>
        )}
      </Section>
      {(b2b ? !!vfs.b2b_show_shipping : !!vfs.dtc_show_shipping) && (
        <div className="qfb-pv-rel">
          <Section title={T.shipping_title}>{lines(c.address)}</Section>
          {!b2b && !!vfs.dtc_multiple_shipping && (
            <button type="button" className="qfb-pv-editaddr" aria-label="Change shipping address">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12.1553 0.789217C11.103 -0.263082 9.39692 -0.263071 8.34464 0.789241L7.74615 1.38776L7.7374 1.379L6.67674 2.43966L6.6855 2.44843L0.805427 8.32869C0.28972 8.84441 0 9.54387 0 10.2732V12.1948C0 12.3937 0.0790185 12.5845 0.219671 12.7251C0.360323 12.8658 0.551088 12.9448 0.750001 12.9448L2.67155 12.9448C3.40091 12.9448 4.1004 12.6551 4.61613 12.1393L12.1554 4.59983C13.2076 3.54755 13.2076 1.84149 12.1553 0.789217ZM7.74616 3.50909L1.8661 9.38933C1.63169 9.62375 1.5 9.94169 1.5 10.2732L1.5 11.4448H2.67155C3.00308 11.4448 3.32103 11.3131 3.55545 11.0787L9.4355 5.19843L7.74616 3.50909ZM10.4961 4.13775L11.0947 3.53919C11.5612 3.07269 11.5612 2.31637 11.0947 1.84987C10.6282 1.38337 9.87182 1.38338 9.40532 1.84989L8.80681 2.44842L10.4961 4.13775Z"
                  fill="#4A4A4A"
                />
              </svg>
            </button>
          )}
        </div>
      )}
      {b2b && !!vfs.b2b_show_billing && <Section title={T.billing_title}>{lines(c.address)}</Section>}
      {/* payment_term is missing from the open-sections state: it starts collapsed. */}
      {b2b && !!vfs.b2b_show_payment_term && (
        <Section title={T.payment_term_title} initiallyOpen={false}>
          <p className="qfb-pv-p">{` ${c.paymentTerms} `}</p>
        </Section>
      )}
      <Section title={T.note_title}>
        <RequestForm step={STEP_2} mobi={mobi} />
      </Section>
    </div>
  );
}

// ── Empty state (EmptyStatePreviewTranslation) ───────────────────────────────
function EmptyStatePreview() {
  const { form, lang } = useBuilder();
  const look = useLook();
  const t = step2(form, lang).empty_list;
  const img = form.empty_list;
  return (
    <div className="qfb-pv-center">
      <div className="qfb-pv-card qfb-pv-msg" style={{ backgroundColor: look.primary_bg_color }}>
        <div className="qfb-pv-msg__inner">
          {!!Number(img.empty_quote_image) && <img className="qfb-pv-msg__img" src={img.illustration_image || emptyListImg} alt="Empty List" />}
          <div className="qfb-pv-msg__text">
            <h2 className="qfb-pv-h2">{t.popup_header_empty_quote}</h2>
            <p className="qfb-pv-p qfb-pv-subdued qfb-pv-pre">{t.empty_quote_mess}</p>
            <div className="qfb-pv-msg__btn">
              <button
                type="button"
                className="qfb-pv-btn"
                style={{ fontSize: fontPx(look), color: look.submit_button_color, backgroundColor: look.submit_button_bg_color }}
              >
                {t.continue_shopping_label}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── After submit (ThankYouPage) ───────────────────────────────────────────────
function ThankYouPreview() {
  const { form, lang } = useBuilder();
  const look = useLook();
  const rs = form.request_submit;
  const t = step2(form, lang).request_submit;
  const type = rs.type || 'full-size';
  const previewUrl = rs.redirect_url || `https://${SHOP_DOMAIN}`;

  if (type === 'toast') {
    return (
      <div className="qfb-pv-center">
        <div className="qfb-pv-toast">{t.toast_message ?? 'Request Submitted'}</div>
      </div>
    );
  }
  if (type === 'direct-to-url') {
    return (
      <div className="qfb-pv-center">
        <div className="qfb-pv-card qfb-pv-browser">
          <div className="qfb-pv-browser__bar">
            <span className="qfb-pv-dots">
              <span />
              <span />
              <span />
            </span>
            <div className="qfb-pv-browser__url">{previewUrl}</div>
          </div>
          <div className="qfb-pv-browser__body">
            <h3 className="qfb-pv-browser__title">Customers will be redirected to this page</h3>
            <p className="qfb-pv-p qfb-pv-browser__sub">
              After submitting the quote request, customers are taken straight to the URL above. No confirmation screen is shown.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="qfb-pv-center">
      <div className="qfb-pv-card qfb-pv-msg" style={{ backgroundColor: look.primary_bg_color }}>
        <div className="qfb-pv-msg__inner">
          {!!Number(rs.request_submit_image) && <img className="qfb-pv-msg__img" src={rs.illustration_image || requestSubmittedImg} alt="Request Submitted" />}
          <div className="qfb-pv-msg__text">
            <h2 className="qfb-pv-h2">{t.popup_header_submitted_quote}</h2>
            <p className="qfb-pv-p qfb-pv-pre">{t.success_submit_mess}</p>
            <div className="qfb-pv-msg__btn">
              <button
                type="button"
                className="qfb-pv-btn"
                style={{ fontSize: fontPx(look), color: look.submit_button_color, backgroundColor: look.submit_button_bg_color }}
              >
                {t.continue_shopping_label}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
