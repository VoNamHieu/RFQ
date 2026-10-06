import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWcId } from '../../../shared/wc.jsx';
import { CUSTOMER_INFO_KEYS, PERMISSION_KEYS, PRODUCT_INFO_KEYS } from './data.js';
import { ACCOUNT_COUNTRY_OPTIONS } from './account-data.js';
import { NestedRadios } from './ui.jsx';

// Production: components/CustomerAccount/CreateCondition.jsx and EditCondition.jsx — the
// same form rendered in place of the permission list (create has Cancel + Create, edit
// has Cancel and saves through the Customer Account save bar).

const SELECT_ONE = 'Select at least 1 option';

// Client-side reorder check first (CreateCondition / CustomerAccount save); only when it
// passes does the server validate the rest (title, condition value).
export const validateCondition = (c) => {
  const errs = { buttonVisibility: false, buttonConditions: false };
  if (c.reorder?.status) {
    const { button_visibility: vis, button_condition: mode, button_conditions: conds } = c.reorder;
    if (!vis.quote_list && !vis.quote_detail) errs.buttonVisibility = true;
    if (mode === 'conditions' && !conds.converted_to_draft_orders && !conds.after_quote_expiration) errs.buttonConditions = true;
  }
  if (errs.buttonVisibility || errs.buttonConditions) return errs;
  const cond = (type) => c.conditions.find((x) => x.type === type)?.condition || {};
  if (!String(c.title ?? '').trim()) errs.title = 'The title field is required.';
  if (c.condition_type === 'tag' && !String(cond('tag').value ?? '').trim()) errs.tag = 'The value field is required.';
  if (c.condition_type === 'country' && !(cond('country').value || []).length) errs.country = 'The value field is required.';
  return errs;
};

// customerAccountSlice `updateConditionStatusFn`: the default ("All") condition and the
// other conditions are mutually exclusive — turning one side on turns the other side off.
export const applyConditionStatus = (list, id, status) => {
  const def = list.find((c) => c.condition_type === 'default');
  return list.map((c) => {
    if (c.id === id) return { ...c, status };
    if (!def || !Number(status)) return c;
    if (def.id === id) return { ...c, status: 0 };
    if (c.id === def.id) return { ...c, status: 0 };
    return c;
  });
};

const GROUP_KEYS = { permissions: PERMISSION_KEYS, customer_information: CUSTOMER_INFO_KEYS, product_information: PRODUCT_INFO_KEYS };

const PERMISSION_LIST = {
  title: 'Action permissions',
  description: 'Determines actions available to customers on their account page.',
  key: 'permissions',
  choices: [
    { label: 'All permissions', value: 'all_permissions' },
    { label: 'Export PDF', value: 'export_pdf' },
    { label: 'Accept quote', value: 'accept_quote' },
    { label: 'Reject quote', value: 'reject_quote' },
    { label: 'View detail', value: 'view_detail' },
  ],
};
const CUSTOMER_INFO_LIST = {
  title: 'Quote customer information',
  description: 'Defines which quote details customer can view on their account page.',
  key: 'customer_information',
  choices: [
    { label: 'All permissions', value: 'all_permissions' },
    { label: 'Show contact', value: 'show_contact' },
    { label: 'Show billing', value: 'show_billing' },
    { label: 'Show shipping', value: 'show_shipping' },
    { label: 'Show payment terms', value: 'show_payment_term' },
  ],
};
const PRODUCT_INFO_LIST = {
  title: 'Quote product information',
  description: 'Defines which quote details products can view on their account page.',
  key: 'product_information',
  choices: [
    { label: 'All permissions', value: 'all_permissions' },
    { label: 'Show quantity', value: 'show_quantity' },
    { label: 'Show variant', value: 'show_variant' },
    { label: 'Show SKU', value: 'show_sku' },
    { label: 'Show properties', value: 'show_properties' },
    { label: 'Show quote price', value: 'show_wished_price', dividerBefore: true },
    { label: 'Show price', value: 'show_price' },
    { label: 'Show total', value: 'show_total' },
    { label: 'Show subtotal', value: 'show_subtotal' },
    { label: 'Show shipping', value: 'show_shipping' },
    { label: 'Show tax', value: 'show_tax', dividerBefore: true },
    { label: 'Show discount', value: 'show_discount' },
  ],
};

// Polaris InlineError (critical icon + message).
function InlineError({ message }) {
  return (
    <s-stack direction="inline" gap="small-300" alignItems="center">
      <s-icon type="alert-circle" tone="critical" />
      <s-text tone="critical">{message}</s-text>
    </s-stack>
  );
}

// RenderListSection
function ListSection({ list, value, onToggle }) {
  const group = value[list.key] || {};
  return (
    <s-section>
      <s-stack gap="small-400">
        <s-heading fontSize="large">{list.title}</s-heading>
        <s-paragraph>{list.description}</s-paragraph>
      </s-stack>
      <s-box paddingBlockStart="small-400">
        <s-stack gap="small-400">
          {list.choices.map((choice) => (
            <React.Fragment key={choice.value}>
              {choice.dividerBefore ? (
                <s-box paddingBlock="small-200">
                  <s-divider />
                </s-box>
              ) : null}
              <s-checkbox
                label={choice.label}
                checked={!!group[choice.value]}
                disabled={choice.value !== 'all_permissions' && !!group.all_permissions}
                onChange={(e) => onToggle(list.key, choice.value, e.currentTarget.checked ? 1 : 0)}
              />
            </React.Fragment>
          ))}
        </s-stack>
      </s-box>
    </s-section>
  );
}

// Combobox (allowMultiple) + Listbox of countries; picked countries show as tags below.
// The listbox floats like a Polaris Popover (native popover → top layer, so the card
// doesn't clip it) and closes on outside click / Escape.
function CountryCombobox({ selected, onChange, error }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const fieldRef = useRef(null);
  const popRef = useRef(null);

  const q = query.trim().toLowerCase();
  const matches = q ? ACCOUNT_COUNTRY_OPTIONS.filter((o) => o.label.toLowerCase().includes(q)) : ACCOUNT_COUNTRY_OPTIONS;
  const showList = open && matches.length > 0;

  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = fieldRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    const onDown = (e) => {
      if (!e.composedPath().includes(wrapRef.current)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    const el = popRef.current;
    if (!el || !el.showPopover) return;
    try {
      if (!el.matches(':popover-open')) el.showPopover();
    } catch {
      /* not connected yet */
    }
  });

  const setCountry = (code, on) => {
    const has = selected.includes(code);
    if (on && !has) onChange([...selected, code]);
    if (!on && has) onChange(selected.filter((c) => c !== code));
    setQuery('');
  };

  return (
    <div ref={wrapRef} className="qcfg-acct-combo">
      <div ref={fieldRef}>
        <s-search-field
          label="Search country"
          labelAccessibilityVisibility="exclusive"
          placeholder="Search country"
          autocomplete="off"
          value={query}
          error={error}
          onFocus={() => setOpen(true)}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setOpen(true);
          }}
        />
      </div>
      {showList && pos ? (
        <div
          ref={popRef}
          popover="manual"
          className="qcfg-acct-combo__popover"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          role="listbox"
          aria-multiselectable="true"
          aria-label="Search country"
        >
          {matches.map((o) => (
            <div key={o.value} className="qcfg-acct-combo__option" role="option" aria-selected={selected.includes(o.value)}>
              <s-checkbox label={o.label} checked={selected.includes(o.value)} onChange={(e) => setCountry(o.value, e.currentTarget.checked)} />
            </div>
          ))}
        </div>
      ) : null}
      <s-box paddingBlockStart="small-200">
        <s-stack direction="inline" gap="small-400">
          {selected.map((code) => (
            <s-clickable-chip key={code} removable accessibilityLabel={`Remove ${code}`} onRemove={() => setCountry(code, false)}>
              {code}
            </s-clickable-chip>
          ))}
        </s-stack>
      </s-box>
    </div>
  );
}

export function ConditionForm({ mode, value, errors = {}, onErrorsChange, onChange, onStatusChange, onCancel, onCreate }) {
  const id = useWcId('qcfg-cond-form');
  const isDefault = value.condition_type === 'default';

  // Any edit resets the "touched" flag, hiding server errors (title / condition value);
  // reorder errors clear when their own controls change (`errPatch`).
  const update = (next, errPatch) => {
    const patch = { ...(errors.title || errors.tag || errors.country ? { title: undefined, tag: undefined, country: undefined } : {}), ...errPatch };
    if (Object.keys(patch).some((k) => errors[k])) onErrorsChange?.({ ...errors, ...patch });
    onChange(next);
  };
  const set = (key, v, errPatch) => update({ ...value, [key]: v }, errPatch);
  const condOf = (type) => value.conditions.find((c) => c.type === type)?.condition || {};
  const setCond = (type, patch) =>
    set(
      'conditions',
      value.conditions.map((c) => (c.type === type ? { ...c, condition: { ...c.condition, ...patch } } : c)),
    );

  const toggleGroup = (group, key, status) => {
    const next = clonePlain(value);
    const g = next[group];
    if (key === 'all_permissions') {
      g.all_permissions = status;
      GROUP_KEYS[group].forEach((k) => {
        g[k] = status ? 1 : 0;
      });
      if (group === 'permissions' && !status && next.reorder?.button_visibility?.quote_detail) next.reorder.button_visibility.quote_detail = false;
    } else {
      g[key] = status;
      if (!status) {
        g.all_permissions = 0;
        if (group === 'permissions' && key === 'view_detail' && next.reorder?.button_visibility?.quote_detail) next.reorder.button_visibility.quote_detail = false;
      } else if (GROUP_KEYS[group].every((k) => g[k])) {
        g.all_permissions = 1;
      }
    }
    update(next);
  };

  const reorder = value.reorder;
  const setReorder = (patch, errPatch) => set('reorder', { ...reorder, ...patch }, errPatch);

  const tagFields = (
    <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap="small-200" alignItems="start">
      <s-select label="Tag condition" labelAccessibilityVisibility="exclusive" value={condOf('tag').key} onChange={(e) => setCond('tag', { key: e.currentTarget.value })}>
        <s-option value="has_tag">Customer Has Tag</s-option>
        <s-option value="has_not_tag">Customer Has Not Tag</s-option>
      </s-select>
      <s-text-field
        label="Enter customer tag"
        labelAccessibilityVisibility="exclusive"
        placeholder="Enter customer tag"
        value={condOf('tag').value}
        error={errors.tag}
        onInput={(e) => setCond('tag', { value: e.currentTarget.value })}
      />
    </s-grid>
  );

  const countryFields = (
    <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap="small-200" alignItems="start">
      <s-select
        label="Country condition"
        labelAccessibilityVisibility="exclusive"
        value={condOf('country').key}
        onChange={(e) => setCond('country', { key: e.currentTarget.value })}
      >
        <s-option value="inset">Inset</s-option>
        <s-option value="not_inset">Not inset</s-option>
      </s-select>
      <CountryCombobox selected={condOf('country').value || []} error={errors.country} onChange={(next) => setCond('country', { value: next })} />
    </s-grid>
  );

  const typeFields = (
    <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap="small-200">
      <s-select label="Type condition" labelAccessibilityVisibility="exclusive" value={condOf('type').key} onChange={(e) => setCond('type', { key: e.currentTarget.value })}>
        <s-option value="equal">Equal</s-option>
        <s-option value="not_equal">Not equal</s-option>
      </s-select>
      <s-select label="Customer type" labelAccessibilityVisibility="exclusive" value={condOf('type').value} onChange={(e) => setCond('type', { value: e.currentTarget.value })}>
        <s-option value="dtc">DTC</s-option>
        {/* Disabled below the Pro Plus (B2B) plan; this shop is on it. */}
        <s-option value="b2b">B2B</s-option>
      </s-select>
    </s-grid>
  );

  return (
    <s-stack gap="base">
      <s-section>
        <s-stack gap="small-200">
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="small-200">
            <s-heading>{mode === 'create' ? 'Create condition' : 'Edit condition'}</s-heading>
            <s-stack direction="inline" gap="small-200">
              <s-button onClick={onCancel}>Cancel</s-button>
              {mode === 'create' ? (
                <s-button variant="primary" onClick={onCreate}>
                  Create
                </s-button>
              ) : null}
            </s-stack>
          </s-grid>
          <s-switch label="Status" checked={!!Number(value.status)} onChange={(e) => onStatusChange(e.currentTarget.checked ? 1 : 0)} />
          <s-text-field label="Title" required value={value.title} error={errors.title} onInput={(e) => set('title', e.currentTarget.value)} />
          {!isDefault ? (
            <s-stack gap="small-200">
              <s-heading>Condition</s-heading>
              <NestedRadios
                name={`${id}-type`}
                value={value.condition_type}
                onChange={(v) => set('condition_type', v)}
                options={[
                  { value: 'tag', label: 'Customer Tag', children: tagFields },
                  { value: 'country', label: 'Customer Country', children: countryFields },
                  { value: 'type', label: 'Customer Type', children: typeFields },
                ]}
              />
            </s-stack>
          ) : null}
        </s-stack>
      </s-section>

      <ListSection list={PERMISSION_LIST} value={value} onToggle={toggleGroup} />

      <s-section>
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="start" gap="small-200">
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="small-400" alignItems="center">
              <s-heading fontSize="large">Reorder</s-heading>
              <s-badge tone={reorder.status ? 'success' : undefined}>{reorder.status ? 'On' : 'Off'}</s-badge>
              <s-icon type="info" interestFor={`${id}-reorder-tip`} />
              <s-tooltip id={`${id}-reorder-tip`}>Read more</s-tooltip>
            </s-stack>
            <s-paragraph>Enable reorder button on customer account pages</s-paragraph>
          </s-stack>
          {/* Production passes an unknown Button variant → a borderless text button. */}
          <s-button
            variant="tertiary"
            onClick={() => setReorder({ status: !reorder.status }, { buttonVisibility: false, buttonConditions: false })}
          >
            {reorder.status ? 'Turn off' : 'Turn on'}
          </s-button>
        </s-grid>
        <s-box paddingBlockStart="small-200">
          <s-divider />
        </s-box>
        <s-box paddingBlockStart="small">
          <s-stack gap="small">
            <s-stack gap="small-400">
              <s-heading>Logic</s-heading>
              <s-heading>Button visibility</s-heading>
              <s-checkbox
                label="Quote list"
                checked={!!reorder.button_visibility.quote_list}
                disabled={!reorder.status}
                onChange={(e) => {
                  setReorder({ button_visibility: { ...reorder.button_visibility, quote_list: e.currentTarget.checked } }, { buttonVisibility: false });
                }}
              />
              <s-checkbox
                label="Quote detail"
                checked={!!reorder.button_visibility.quote_detail}
                disabled={!reorder.status || !value.permissions?.view_detail}
                onChange={(e) => {
                  setReorder({ button_visibility: { ...reorder.button_visibility, quote_detail: e.currentTarget.checked } }, { buttonVisibility: false });
                }}
              />
              {errors.buttonVisibility ? <InlineError message={SELECT_ONE} /> : null}
            </s-stack>
            <s-stack gap="small-400">
              <s-heading>Button conditions</s-heading>
              <NestedRadios
                name={`${id}-reorder`}
                value={reorder.button_condition}
                disabled={!reorder.status}
                onChange={(v) => setReorder({ button_condition: v })}
                options={[
                  { value: 'anytime', label: 'Allow reorder anytime (last 60 days)' },
                  {
                    value: 'conditions',
                    label: 'Allow reorder by conditions',
                    children: (
                      <s-stack gap="small-400">
                        <s-checkbox
                          label="Quotes converted to draft orders"
                          checked={!!reorder.button_conditions.converted_to_draft_orders}
                          disabled={!reorder.status}
                          onChange={(e) => {
                            setReorder({ button_conditions: { ...reorder.button_conditions, converted_to_draft_orders: e.currentTarget.checked } }, { buttonConditions: false });
                          }}
                        />
                        <s-checkbox
                          label="After quote expiration"
                          checked={!!reorder.button_conditions.after_quote_expiration}
                          disabled={!reorder.status}
                          onChange={(e) => {
                            setReorder({ button_conditions: { ...reorder.button_conditions, after_quote_expiration: e.currentTarget.checked } }, { buttonConditions: false });
                          }}
                        />
                        {errors.buttonConditions ? <InlineError message={SELECT_ONE} /> : null}
                      </s-stack>
                    ),
                  },
                ]}
              />
            </s-stack>
          </s-stack>
        </s-box>
      </s-section>

      <ListSection list={CUSTOMER_INFO_LIST} value={value} onToggle={toggleGroup} />
      <ListSection list={PRODUCT_INFO_LIST} value={value} onToggle={toggleGroup} />
    </s-stack>
  );
}

const clonePlain = (v) => JSON.parse(JSON.stringify(v));
