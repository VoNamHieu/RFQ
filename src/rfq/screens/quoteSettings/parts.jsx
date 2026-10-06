import React, { useEffect, useMemo, useState } from 'react';
import { Modal, useWcId } from '../../../shared/wc.jsx';
import {
  CONDITION_TYPE_OPTIONS,
  COUNTRY_OPTIONS,
  CUSTOMER_MODE,
  DEFAULT_AND_CONDITION,
  PICKER_COLLECTIONS,
  PICKER_PRODUCTS,
  isChosenOptions,
  productRow,
  valueTypeFor,
} from './data.js';

// Building blocks shared by the Quote settings tabs. Each mirrors a production
// component (named in its comment) re-built with Polaris web components.

// ── Small layout helpers ───────────────────────────────────────────────────

// <Text fontWeight="medium"> used as a section / ChoiceList title.
export function FieldTitle({ children }) {
  return <s-paragraph fontWeight="medium">{children}</s-paragraph>;
}

// ChoiceList with a medium-weight title (Polaris ChoiceList title={<Text fontWeight="medium">}).
// choices: [{ value, label, details, disabled, children }] — `children` render
// under the selected choice (ChoiceList renderChildren).
export function ChoiceGroup({ title, name, value, choices, onChange, disabled, multiple = false, error }) {
  const selected = multiple ? (value || []).map(String) : [String(value)];
  return (
    <s-stack gap="small-400">
      {title ? <FieldTitle>{title}</FieldTitle> : null}
      <s-choice-list
        label={typeof title === 'string' ? title : name}
        labelAccessibilityVisibility="exclusive"
        name={name}
        multiple={multiple}
        disabled={disabled}
        error={error}
        onChange={(e) => {
          // Fields rendered inside a choice (secondary-content) bubble their own
          // change events up here; only the list's own selection counts.
          if (e.target !== e.currentTarget) return;
          const vals = e.currentTarget.values || [];
          onChange(multiple ? vals : vals[0]);
        }}
      >
        {choices.map((c) => {
          const isSel = selected.includes(String(c.value));
          return (
            <s-choice key={String(c.value)} value={String(c.value)} selected={isSel} disabled={c.disabled}>
              {c.label}
              {c.details && typeof c.details === 'string' ? <s-text slot="details">{c.details}</s-text> : null}
              {/* The details slot keeps text only, so help text with a link goes
                  into secondary-content, above the selected choice's children. */}
              {(c.details && typeof c.details !== 'string') || (isSel && c.children) ? (
                <div slot="secondary-content">
                  {c.details && typeof c.details !== 'string' ? <s-paragraph>{c.details}</s-paragraph> : null}
                  {isSel && c.children ? c.children : null}
                </div>
              ) : null}
            </s-choice>
          );
        })}
      </s-choice-list>
    </s-stack>
  );
}

// Plain icon button with a tooltip (Tooltip + Button variant="plain" icon=InfoIcon).
export function InfoTip({ tip, href, icon = 'info', onClick }) {
  const id = useWcId('qset-tip');
  return (
    <>
      <s-button
        variant="tertiary"
        icon={icon}
        interestFor={id}
        accessibilityLabel={tip}
        href={href}
        target={href ? '_blank' : undefined}
        onClick={onClick}
      />
      <s-tooltip id={id}>{tip}</s-tooltip>
    </>
  );
}

// An inline info icon with a tooltip (Tooltip > Icon InfoIcon tone="subdued").
export function InfoIcon({ tip }) {
  const id = useWcId('qset-info');
  return (
    <>
      <s-icon type="info" color="subdued" interestFor={id} />
      <s-tooltip id={id}>{tip}</s-tooltip>
    </>
  );
}

// ── Polaris icons drawn inline (so they can take the surrounding text color,
// like icons inside Polaris plain buttons / the purple suggestion box) ──────
const ICON_PATHS = {
  globe:
    'M3 10a7 7 0 1 1 14 0 7 7 0 0 1-14 0Zm7-5.5a5.497 5.497 0 0 0-4.737 2.703l2 1.999c.472.472.737 1.113.737 1.78v.518a.5.5 0 0 0 .5.5 2 2 0 0 1 2 2v1.478a5.504 5.504 0 0 0 4.52-3.228h-1.02a.75.75 0 0 1-.75-.75v-.5a.75.75 0 0 0-.75-.75h-2.5a1.755 1.755 0 0 1-1.07-3.144l.463-.356a.393.393 0 0 0 .152-.312v-.04c0-.885.62-1.624 1.449-1.808a5.531 5.531 0 0 0-.994-.09Zm2.875.81a1.85 1.85 0 0 1-1.477.735.352.352 0 0 0-.353.353v.04c0 .587-.271 1.14-.736 1.499l-.462.356a.256.256 0 0 0 .153.457h2.5a2.25 2.25 0 0 1 2.236 2h.713a5.497 5.497 0 0 0-2.574-5.44Zm-8.375 4.69c0-.443.052-.875.152-1.288l1.55 1.55c.19.191.298.45.298.72v.518a2 2 0 0 0 2 2 .5.5 0 0 1 .5.5v1.41a5.502 5.502 0 0 1-4.5-5.41Z',
  archive: [
    'M8.25 10.75a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1-.75-.75Z',
    'M5.25 3.5a1.75 1.75 0 0 0-1.75 1.75v2c0 .595.297 1.12.75 1.436v5.064a2.75 2.75 0 0 0 2.75 2.75h6a2.75 2.75 0 0 0 2.75-2.75v-5.064c.453-.316.75-.841.75-1.436v-2a1.75 1.75 0 0 0-1.75-1.75h-9.5Zm9 5.5h-8.5v4.75c0 .69.56 1.25 1.25 1.25h6c.69 0 1.25-.56 1.25-1.25v-4.75Zm-9.25-3.75a.25.25 0 0 1 .25-.25h9.5a.25.25 0 0 1 .25.25v2a.25.25 0 0 1-.25.25h-9.5a.25.25 0 0 1-.25-.25v-2Z',
  ],
  'chevron-down': 'M5.72 8.47a.75.75 0 0 1 1.06 0l3.47 3.47 3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 0-1.06Z',
  magic: [
    'M5.702 4.253a.625.625 0 0 1 1.096 0l.196.358c.207.378.517.688.895.895l.358.196a.625.625 0 0 1 0 1.097l-.358.196a2.25 2.25 0 0 0-.895.894l-.196.359a.625.625 0 0 1-1.096 0l-.196-.359a2.25 2.25 0 0 0-.895-.894l-.358-.196a.625.625 0 0 1 0-1.097l.358-.196a2.25 2.25 0 0 0 .895-.895l.196-.358Z',
    'M12.948 7.89c-.18-1.167-1.852-1.19-2.064-.029l-.03.164a3.756 3.756 0 0 1-3.088 3.031c-1.15.189-1.173 1.833-.03 2.054l.105.02a3.824 3.824 0 0 1 3.029 3.029l.032.165c.233 1.208 1.963 1.208 2.196 0l.025-.129a3.836 3.836 0 0 1 3.077-3.045c1.184-.216 1.12-1.928-.071-2.107a3.789 3.789 0 0 1-3.18-3.154Zm-.944 6.887a5.34 5.34 0 0 1 2.542-2.647 5.305 5.305 0 0 1-2.628-2.548 5.262 5.262 0 0 1-2.488 2.508 5.329 5.329 0 0 1 2.574 2.687Z',
  ],
  x: 'M13.97 15.03a.75.75 0 1 0 1.06-1.06l-3.97-3.97 3.97-3.97a.75.75 0 0 0-1.06-1.06l-3.97 3.97-3.97-3.97a.75.75 0 0 0-1.06 1.06l3.97 3.97-3.97 3.97a.75.75 0 1 0 1.06 1.06l3.97-3.97 3.97 3.97Z',
};

export function PolarisIcon({ type }) {
  const d = ICON_PATHS[type];
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {(Array.isArray(d) ? d : [d]).map((x) => (
        <path key={x.slice(0, 16)} fillRule="evenodd" d={x} />
      ))}
    </svg>
  );
}

// ── Store mode switch (Logic header: plain disclosure Button + Popover OptionList) ──
const MODE_OPTIONS = [
  { value: 'dtc', label: 'Default store', icon: 'globe' },
  { value: 'b2b', label: 'B2B store', icon: 'archive' },
];

export function StoreModeSwitch({ mode, onChange, b2bDisabled = false }) {
  const id = useWcId('qset-mode');
  const current = MODE_OPTIONS.find((o) => o.value === mode) || MODE_OPTIONS[0];
  return (
    <>
      <s-clickable commandFor={id} accessibilityLabel={`Store: ${current.label}`}>
        <span className="qset-mode-trigger">
          <PolarisIcon type={current.icon} />
          {current.label}
          <PolarisIcon type="chevron-down" />
        </span>
      </s-clickable>
      <s-popover id={id}>
        <div className="qset-optionlist" role="listbox" aria-label="Store">
          {MODE_OPTIONS.map((o) => {
            const disabled = o.value === 'b2b' && b2bDisabled;
            return (
              <s-clickable key={o.value} commandFor={id} command="--hide" disabled={disabled} onClick={() => !disabled && onChange(o.value)}>
                <span className="qset-option" role="option" aria-selected={o.value === mode} aria-disabled={disabled}>
                  <s-icon type={o.icon} />
                  {o.label}
                </span>
              </s-clickable>
            );
          })}
        </div>
      </s-popover>
    </>
  );
}

// Polaris secondary Button with a disclosure chevron (e.g. the language picker
// activator) — s-button has no trailing disclosure icon, so it is drawn here.
export function DisclosureButton({ commandFor, children, disabled = false }) {
  // The wrapper keeps s-clickable's full-width inner button at the label's width.
  return (
    <div className="qset-disclosure">
      <s-clickable commandFor={commandFor} disabled={disabled} borderRadius="base">
        <span className={`qset-disclosure-btn${disabled ? ' qset-disclosure-btn--disabled' : ''}`}>
          {children}
          <PolarisIcon type="chevron-down" />
        </span>
      </s-clickable>
    </div>
  );
}

// Unsaved-changes dialogs.
//  - kind "mode": core/ModalConfirmChangeMode.jsx (switching Default store / B2B store).
//  - kind "page": the App Bridge leave confirmation (shopify.saveBar.leaveConfirmation)
//    production shows when switching tabs — or, on the Text & translation card, picking
//    another language / opening "Multi languages" — while the save bar is open.
const LEAVE_COPY = {
  mode: {
    heading: 'Unsaved changes',
    body: 'You have unsaved changes. Are you sure you want to leave?',
    leave: 'Leave',
    cancel: 'Cancel',
  },
  page: {
    heading: 'Leave page with unsaved changes?',
    body: 'Leaving this page will delete all unsaved changes.',
    leave: 'Leave page',
    cancel: 'Stay',
  },
};

export function ConfirmLeaveModal({ open, kind = 'mode', onClose, onLeave }) {
  const copy = LEAVE_COPY[kind] || LEAVE_COPY.mode;
  return (
    <Modal open={open} onClose={onClose} heading={copy.heading}>
      <s-paragraph>{copy.body}</s-paragraph>
      <s-button slot="primary-action" variant="primary" tone="critical" onClick={onLeave}>
        {copy.leave}
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        {copy.cancel}
      </s-button>
    </Modal>
  );
}

// ── Colors (utils rgbaToHsba / rgbToHex / hexToRgba) ───────────────────────
export function parseColor(value) {
  const v = String(value || '').trim();
  const m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts[3] === undefined || Number.isNaN(parts[3]) ? 1 : parts[3] };
  }
  const hex = v.replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16), a: 1 };
  }
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 100) / 100 : 1,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}
export const colorToHex = ({ r, g, b }) => [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase();
export const colorToRgba = ({ r, g, b, a }) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 100) / 100})`;

// core/ColorPickerInput.jsx — round swatch opening a color picker + hex field,
// with "#HEX" and "alpha%" next to it.
export function ColorPickerInput({ label, value = 'rgba(0, 0, 0, 1)', onChange, disabled = false }) {
  const id = useWcId('qset-color');
  const color = parseColor(value);
  const hex = colorToHex(color);
  const [hexText, setHexText] = useState(hex);
  useEffect(() => setHexText(hex), [hex]);
  // utils isWhiteColor: every channel >= 200 gets the grey outline.
  const isWhite = color.r >= 200 && color.g >= 200 && color.b >= 200;

  const commitHex = () => {
    // utils isValidHexColor: 3 or 6 hex digits, optional leading '#'.
    if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexText)) {
      setHexText(hex);
      return;
    }
    onChange(colorToRgba({ ...parseColor(hexText), a: color.a }));
  };

  return (
    <s-stack gap="small-500">
      <s-paragraph color={disabled ? 'subdued' : undefined}>{label}</s-paragraph>
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <div className="qset-swatch-wrap">
          <s-clickable commandFor={id} disabled={disabled} accessibilityLabel={`${label}: #${hex}`} borderRadius="large-200">
            <span
              className={`qset-swatch${disabled ? ' qset-swatch--disabled' : ''}`}
              style={{ backgroundColor: value, borderColor: isWhite ? '#c2c2c2' : `#${hex}` }}
            />
          </s-clickable>
        </div>
        <s-popover id={id}>
          <s-box padding="small">
            <s-stack gap="small">
              <s-color-picker
                alpha
                value={colorToRgba(color)}
                onInput={(e) => {
                  const v = e.currentTarget.value;
                  if (v) onChange(colorToRgba(parseColor(v)));
                }}
              />
              {/* maxLength 6 without the character counter s-text-field adds for maxLength. */}
              <s-text-field
                label={label}
                value={hexText}
                disabled={disabled}
                onInput={(e) => {
                  const v = e.currentTarget.value.slice(0, 6);
                  if (v !== e.currentTarget.value) e.currentTarget.value = v;
                  setHexText(v);
                }}
                onBlur={commitHex}
              />
            </s-stack>
          </s-box>
        </s-popover>
        <div>
          <s-paragraph color={disabled ? 'subdued' : undefined}>#{hex}</s-paragraph>
          <s-paragraph color={disabled ? 'subdued' : undefined}>{Math.round(color.a * 100)}%</s-paragraph>
        </div>
      </s-stack>
    </s-stack>
  );
}

// ── Button style editor (core/CustomButtonStyle.jsx) ───────────────────────
const pxValue = (v, fallback) => (v === 'Default' ? String(fallback) : String(v ?? '').replace('px', ''));

function PxField({ label, value, fallback, max, onChange, disabled }) {
  return (
    <s-number-field
      label={label}
      suffix="px"
      inputMode="numeric"
      value={pxValue(value, fallback)}
      min={0}
      max={max}
      disabled={disabled}
      onInput={(e) => {
        const digits = e.currentTarget.value.replace(/\D/g, '');
        const n = digits === '' ? '' : Math.min(Number(digits), max);
        onChange(`${n}px`);
      }}
    />
  );
}

function Segmented({ label, items, disabled }) {
  return (
    <s-stack gap="small-400">
      <s-paragraph color={disabled ? 'subdued' : undefined}>{label}</s-paragraph>
      <div className="qset-segmented">
        <s-button-group gap="none" accessibilityLabel={label}>
          {items.map((it) => (
            <s-press-button
              key={it.key}
              slot="secondary-actions"
              icon={it.icon}
              pressed={it.pressed}
              disabled={disabled}
              accessibilityLabel={it.label}
              inlineSize="fill"
              onClick={it.onClick}
            />
          ))}
        </s-button-group>
      </div>
    </s-stack>
  );
}

// Polaris <Grid gap="400"> with cells columnSpan {xs: 6, sm: 6, md: 3, lg: 3}: one field
// per row below the md breakpoint, two at md, four from lg (breakpoints of the app's
// iframe, see .qset-style-grid in qset.css).
function StyleGrid({ children }) {
  return <div className="qset-style-grid">{children}</div>;
}

// section: 'all' (own card with a collapsible "Button appearance" header),
// 'text' or 'button' (inline parts used by the widget tabs).
export function ButtonStyleEditor({ name, labelText, styles = {}, onChange, section = 'all', disabled = false, isTouched = false, onHoverEdit }) {
  const [showAppear, setShowAppear] = useState(false);
  const set = (key, value) => {
    onChange({ ...styles, [key]: value, stroke_enable: 1 });
    const hoverKeys = ['hover_font_size', 'hover_font_color', 'hover_border_radius', 'hover_bg_color', 'hover_stroke_size', 'hover_stroke_color'];
    if ((Number(styles.hover_enable) && hoverKeys.includes(key)) || (key === 'hover_enable' && value)) onHoverEdit?.(name);
  };
  const labelError = isTouched && !String(styles.label || '').trim() ? `${labelText} is required` : undefined;
  const strokeOn = Number(pxValue(styles.stroke_size, 0)) >= 1;
  const hoverStrokeOn = Number(pxValue(styles.hover_stroke_size, 0)) >= 1;

  const customizeText = (
    <s-stack gap="small-200">
      {name !== 'request-for-quote' && (
        <>
          {section === 'all' && <FieldTitle>Text</FieldTitle>}
          <s-text-field
            label={labelText}
            placeholder="Enter button label"
            value={styles.label || ''}
            maxLength={100}
            required
            error={labelError}
            disabled={disabled}
            onInput={(e) => set('label', e.currentTarget.value)}
          />
        </>
      )}
      <s-stack gap="small-200">
        <s-box paddingBlock="small-200">
          <StyleGrid>
            <PxField label="Font size" value={styles.font_size} fallback={14} max={48} disabled={disabled} onChange={(v) => set('font_size', v)} />
            <Segmented
              label="Text format"
              disabled={disabled}
              items={[
                { key: 'b', icon: 'text-bold', label: 'Bold', pressed: !!Number(styles.text_bold), onClick: () => set('text_bold', Number(styles.text_bold) ? 0 : 1) },
                { key: 'i', icon: 'text-italic', label: 'Italic', pressed: !!Number(styles.text_italic), onClick: () => set('text_italic', Number(styles.text_italic) ? 0 : 1) },
                { key: 'u', icon: 'text-underline', label: 'Underline', pressed: !!Number(styles.text_underline), onClick: () => set('text_underline', Number(styles.text_underline) ? 0 : 1) },
              ]}
            />
            <Segmented
              label="Alignment"
              disabled={disabled}
              items={['left', 'center', 'right'].map((a) => ({
                key: a,
                icon: `text-align-${a}`,
                label: `Align ${a}`,
                pressed: styles.text_align === a,
                onClick: () => set('text_align', a),
              }))}
            />
            <ColorPickerInput label="Text color" value={styles.font_color} disabled={disabled} onChange={(v) => set('font_color', v)} />
          </StyleGrid>
        </s-box>
        <s-divider />
      </s-stack>
    </s-stack>
  );

  const customizeButton = (
    <s-stack gap="small-200">
      {section === 'all' && <s-heading>Button</s-heading>}
      <StyleGrid>
        <PxField label="Corner radius" value={styles.border_radius} fallback={4} max={25} disabled={disabled} onChange={(v) => set('border_radius', v)} />
        <PxField label="Border thickness" value={styles.stroke_size} fallback={0} max={5} disabled={disabled} onChange={(v) => set('stroke_size', v)} />
        <ColorPickerInput label="Button color" value={styles.bg_color} disabled={disabled} onChange={(v) => set('bg_color', v)} />
        {strokeOn && <ColorPickerInput label="Outline color" value={styles.stroke_color} disabled={disabled} onChange={(v) => set('stroke_color', v)} />}
      </StyleGrid>
      <s-divider />
      <s-stack gap="none">
        <s-checkbox
          label="Drop shadow"
          checked={!!Number(styles.shadow_enable)}
          disabled={disabled}
          onChange={(e) => set('shadow_enable', e.currentTarget.checked ? 1 : 0)}
        />
        <s-checkbox
          label="Hover"
          checked={!!Number(styles.hover_enable)}
          disabled={disabled}
          onChange={(e) => set('hover_enable', e.currentTarget.checked ? 1 : 0)}
        />
      </s-stack>
      {!!Number(styles.hover_enable) && (
        <>
          <s-divider />
          <StyleGrid>
            <PxField label="Font size" value={styles.hover_font_size} fallback={14} max={48} disabled={disabled} onChange={(v) => set('hover_font_size', v)} />
            <PxField label="Corner radius" value={styles.hover_border_radius} fallback={4} max={25} disabled={disabled} onChange={(v) => set('hover_border_radius', v)} />
            <PxField label="Border thickness" value={styles.hover_stroke_size} fallback={0} max={5} disabled={disabled} onChange={(v) => set('hover_stroke_size', v)} />
          </StyleGrid>
          <StyleGrid>
            <ColorPickerInput
              label="Text color"
              value={styles.hover_font_color === 'Default' ? 'rgba(255, 255, 255, 1)' : styles.hover_font_color}
              disabled={disabled}
              onChange={(v) => set('hover_font_color', v)}
            />
            <ColorPickerInput label="Button color" value={styles.hover_bg_color} disabled={disabled} onChange={(v) => set('hover_bg_color', v)} />
            {hoverStrokeOn && (
              <ColorPickerInput label="Outline color" value={styles.hover_stroke_color} disabled={disabled} onChange={(v) => set('hover_stroke_color', v)} />
            )}
          </StyleGrid>
        </>
      )}
    </s-stack>
  );

  if (section === 'text') return customizeText;
  if (section === 'button') return customizeButton;

  return (
    <s-section>
      <s-grid gridTemplateColumns="1fr auto" alignItems="center">
        <s-heading fontSize="large">Button appearance</s-heading>
        <s-button
          variant="tertiary"
          icon={showAppear ? 'chevron-down' : 'chevron-up'}
          accessibilityLabel={showAppear ? 'Collapse button appearance' : 'Expand button appearance'}
          onClick={() => setShowAppear(!showAppear)}
        />
      </s-grid>
      {showAppear && (
        <s-box paddingBlockStart="small-200">
          <s-stack gap="small">
            {customizeText}
            {customizeButton}
          </s-stack>
        </s-box>
      )}
    </s-section>
  );
}

// ── Shopify resource picker (App Bridge resourcePicker) ─────────────────────
// type 'product': selected = variant ids → onSelect(manual_condition rows)
// type 'collection': selected = collection ids → onSelect(collection rows)
export function ResourcePickerModal({ type, initialQuery = '', selected = [], onClose, onSelect }) {
  const isProduct = type === 'product';
  const [query, setQuery] = useState(initialQuery);
  const [ids, setIds] = useState(() => new Set(selected));
  const q = query.trim().toLowerCase();
  const products = PICKER_PRODUCTS.filter((p) => !q || p.title.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q)));
  const collections = PICKER_COLLECTIONS.filter((c) => !q || c.title.toLowerCase().includes(q));

  const setMany = (list, on) =>
    setIds((prev) => {
      const next = new Set(prev);
      list.forEach((x) => (on ? next.add(x) : next.delete(x)));
      return next;
    });

  const confirm = () => {
    if (isProduct) {
      const rows = [];
      PICKER_PRODUCTS.forEach((p) => p.variants.forEach((v) => ids.has(v.id) && rows.push(productRow(p, v))));
      onSelect(rows);
    } else {
      onSelect(PICKER_COLLECTIONS.filter((c) => ids.has(c.collection_id)).map((c) => ({ collection_id: c.collection_id, title: c.title, image: '', handle: c.handle })));
    }
  };

  return (
    <Modal open onClose={onClose} heading={isProduct ? 'Select products' : 'Select collections'}>
      <s-stack gap="small">
        <s-search-field
          label={isProduct ? 'Search products' : 'Search collections'}
          labelAccessibilityVisibility="exclusive"
          placeholder={isProduct ? 'Search products' : 'Search collections'}
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <div className="qset-picker">
          {isProduct &&
            products.map((p) => {
              const vids = p.variants.map((v) => v.id);
              const count = vids.filter((x) => ids.has(x)).length;
              return (
                <div key={p.product_id} className="qset-picker__group">
                  <div className="qset-picker__row">
                    <s-checkbox
                      accessibilityLabel={`Select ${p.title}`}
                      checked={count === vids.length}
                      indeterminate={count > 0 && count < vids.length}
                      onChange={(e) => setMany(vids, e.currentTarget.checked)}
                    />
                    <s-thumbnail size="small" alt={p.title} />
                    <s-text>{p.title}</s-text>
                  </div>
                  {p.variants.length > 1 &&
                    p.variants.map((v) => (
                      <div key={v.id} className="qset-picker__row qset-picker__row--variant">
                        <s-checkbox
                          accessibilityLabel={`Select ${p.title} - ${v.title}`}
                          checked={ids.has(v.id)}
                          onChange={(e) => setMany([v.id], e.currentTarget.checked)}
                        />
                        <s-text>{v.title}</s-text>
                        <s-text color="subdued">{v.sku}</s-text>
                      </div>
                    ))}
                </div>
              );
            })}
          {!isProduct &&
            collections.map((c) => (
              <div key={c.collection_id} className="qset-picker__group">
                <div className="qset-picker__row">
                  <s-checkbox
                    accessibilityLabel={`Select ${c.title}`}
                    checked={ids.has(c.collection_id)}
                    onChange={(e) => setMany([c.collection_id], e.currentTarget.checked)}
                  />
                  <s-thumbnail size="small" alt={c.title} />
                  <s-text>{c.title}</s-text>
                  <s-text color="subdued">
                    {c.count} {c.count === 1 ? 'product' : 'products'}
                  </s-text>
                </div>
              </div>
            ))}
          {(isProduct ? products : collections).length === 0 && (
            <s-box padding="base">
              <s-paragraph color="subdued">No results for “{query}”</s-paragraph>
            </s-box>
          )}
        </div>
        <s-paragraph color="subdued">{ids.size} selected</s-paragraph>
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={confirm}>
        Select
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

// core/OmegaResourcePicker.jsx — search field (typing opens the picker) + Browse.
function PickerField({ placeholder, error, disabled, onOpen }) {
  return (
    <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="start">
      <s-text-field
        label={placeholder}
        labelAccessibilityVisibility="exclusive"
        icon="search"
        placeholder={placeholder}
        value=""
        disabled={disabled}
        error={error}
        onInput={(e) => {
          const v = e.currentTarget.value;
          e.currentTarget.value = '';
          onOpen(v);
        }}
      />
      <s-button disabled={disabled} onClick={() => onOpen('')}>
        Browse
      </s-button>
    </s-grid>
  );
}

// ── Product rules (ButtonSettings/ProductRulesNew.jsx) ─────────────────────
export function ProductRules({ type, settings, onChange, isTouched, errors = {}, disabled = false, onToast }) {
  const [picker, setPicker] = useState(null); // { type, query }
  const { type_condition = 'all', manual_condition = [], collection_condition = [], automatically_condition = [] } = settings;
  const isButton = type === 'buttonSettings';
  const set = (patch) => onChange({ ...settings, ...patch });

  const setConditions = (fn) => {
    const next = JSON.parse(JSON.stringify(automatically_condition));
    fn(next);
    set({ automatically_condition: next });
  };

  const sortedProducts = [...manual_condition].sort((a, b) => a.product_title.localeCompare(b.product_title));

  const selectedProductsChildren = (
    <s-stack gap="small-200">
      <s-paragraph color="subdued">Select more than 100 items will harm your website performance. For more, select the option below.</s-paragraph>
      <PickerField
        placeholder="Search products"
        disabled={disabled}
        error={isTouched && errors.selectedProduct ? 'Select at least 1 product' : undefined}
        onOpen={(query) => setPicker({ type: 'product', query })}
      />
      {manual_condition.length > 0 && (
        <div className="qset-selected-list">
          {sortedProducts.map((p) => (
            <div key={p.product_variant_id} className="qset-resource-row">
              <s-thumbnail size="base" alt={p.product_title} />
              <div className="qset-resource-row__title" onClick={() => onToast?.(`Opens ${p.product_title} on your online store`)}>
                <s-paragraph>{p.product_title}</s-paragraph>
                <s-paragraph>Variant: {p.product_variant.title}</s-paragraph>
              </div>
              <s-button
                variant="tertiary"
                icon="delete"
                accessibilityLabel={`Remove ${p.product_title}`}
                disabled={disabled}
                onClick={() => set({ manual_condition: manual_condition.filter((x) => x.product_variant_id !== p.product_variant_id) })}
              />
            </div>
          ))}
        </div>
      )}
    </s-stack>
  );

  const selectedCollectionsChildren = (
    <s-stack gap="small-200">
      <PickerField
        placeholder="Search collections"
        disabled={disabled}
        error={isTouched && errors.selectedCollection ? 'Select at least 1 collection' : undefined}
        onOpen={(query) => setPicker({ type: 'collection', query })}
      />
      {collection_condition.length > 0 && (
        <div className="qset-selected-list">
          {collection_condition.map((c) => (
            <div key={c.collection_id} className="qset-resource-row">
              <s-thumbnail size="base" alt={c.title} />
              <div className="qset-resource-row__title" onClick={() => onToast?.(`Opens the ${c.title} collection on your online store`)}>
                <s-paragraph>{c.title}</s-paragraph>
              </div>
              <s-button
                variant="tertiary"
                icon="delete"
                accessibilityLabel={`Remove ${c.title}`}
                disabled={disabled}
                onClick={() => set({ collection_condition: collection_condition.filter((x) => x.collection_id !== c.collection_id) })}
              />
            </div>
          ))}
        </div>
      )}
    </s-stack>
  );

  const changeType = (iOr, iAnd, value) =>
    setConditions((c) => {
      const row = c[iOr][iAnd];
      row.selectedType = value;
      row.isChoosen = isChosenOptions(value)[0].value;
      row.valueCondition = '';
      ['isString', 'isNumber', 'isCustomer', 'isInventory', 'isTime'].forEach((k) => (row[k] = false));
      if (value === 'time') {
        const d = new Date();
        row.valueCondition = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
        row.isTime = true;
      } else if (value === 'price' || value === 'inventory') row.isNumber = true;
      else row.isString = true;
    });

  const dateToIso = (mdY) => {
    const [m, d, y] = String(mdY || '').split('/');
    return y ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
  };
  const isoToMdY = (iso) => {
    const [y, m, d] = String(iso || '').split('-');
    return y && m && d ? `${Number(m)}/${Number(d)}/${y}` : '';
  };

  return (
    <div>
      <s-box paddingBlockEnd="small-400">
        <FieldTitle>{isButton ? 'Display button for what products?' : 'Hide price of what products?'}</FieldTitle>
      </s-box>
      <ChoiceGroup
        name={`${type}-type-condition`}
        value={type_condition}
        disabled={disabled}
        onChange={(v) => set({ type_condition: v })}
        choices={[
          { value: 'all', label: 'All products' },
          { value: 'selected', label: 'Selected products', children: selectedProductsChildren },
          { value: 'collection', label: 'Selected collections', children: selectedCollectionsChildren },
          { value: 'automate', label: 'Custom condition' },
        ]}
      />
      {type_condition === 'automate' && (
        <s-box paddingInlineStart="large-200">
          {automatically_condition.map((orGroup, iOr) => (
            <div key={`or-${iOr}-${orGroup.length}`}>
              {orGroup.map((and, iAnd) => {
                const first = iOr === 0 && iAnd === 0;
                const valueType = valueTypeFor(and.selectedType);
                const err = isTouched && !String(and.valueCondition ?? '').length ? 'Enter a value' : undefined;
                return (
                  <div key={`and-${iOr}-${iAnd}`} className={`qset-and-row${iAnd > 0 ? ' qset-and-row--next' : ''}`}>
                    {iAnd > 0 && <span className="qset-and-label">AND</span>}
                    <s-grid gridTemplateColumns="1fr auto" gap="none" alignItems="start">
                      <s-query-container>
                        <s-grid gridTemplateColumns="@container (inline-size > 420px) 1fr 1fr 1fr, 1fr" gap="small-200" alignItems="start">
                          <s-select
                            label="Condition"
                            labelAccessibilityVisibility="exclusive"
                            value={and.selectedType}
                            onChange={(e) => changeType(iOr, iAnd, e.currentTarget.value)}
                          >
                            {CONDITION_TYPE_OPTIONS.map((o) => (
                              <s-option key={o.value} value={o.value}>
                                {o.label}
                              </s-option>
                            ))}
                          </s-select>
                          <s-select
                            label="Operator"
                            labelAccessibilityVisibility="exclusive"
                            value={and.isChoosen}
                            onChange={(e) => {
                              const v = e.currentTarget.value;
                              setConditions((c) => {
                                c[iOr][iAnd].isChoosen = v;
                              });
                            }}
                          >
                            {isChosenOptions(and.selectedType).map((o) => (
                              <s-option key={o.value} value={o.value}>
                                {o.label}
                              </s-option>
                            ))}
                          </s-select>
                          {valueType === 'date' ? (
                            <s-date-field
                              label="Value"
                              labelAccessibilityVisibility="exclusive"
                              value={dateToIso(and.valueCondition)}
                              onChange={(e) => {
                                const v = isoToMdY(e.currentTarget.value);
                                setConditions((c) => {
                                  c[iOr][iAnd].valueCondition = v;
                                });
                              }}
                            />
                          ) : valueType === 'number' ? (
                            <s-number-field
                              label="Value"
                              labelAccessibilityVisibility="exclusive"
                              placeholder="Enter value"
                              value={String(and.valueCondition ?? '')}
                              error={err}
                              onInput={(e) => {
                                const v = e.currentTarget.value;
                                setConditions((c) => {
                                  c[iOr][iAnd].valueCondition = v;
                                });
                              }}
                            />
                          ) : (
                            <s-text-field
                              label="Value"
                              labelAccessibilityVisibility="exclusive"
                              placeholder="Enter value"
                              value={String(and.valueCondition ?? '')}
                              error={err}
                              onInput={(e) => {
                                const v = e.currentTarget.value;
                                setConditions((c) => {
                                  c[iOr][iAnd].valueCondition = v;
                                });
                              }}
                            />
                          )}
                        </s-grid>
                      </s-query-container>
                      <div className="qset-cond-delete" style={{ opacity: first ? 0 : 1 }}>
                        <s-button
                          variant="tertiary"
                          icon="delete"
                          accessibilityLabel="Remove condition"
                          disabled={first}
                          onClick={() =>
                            setConditions((c) => {
                              c[iOr].splice(iAnd, 1);
                              if (!c[iOr].length) c.splice(iOr, 1);
                            })
                          }
                        />
                      </div>
                    </s-grid>
                    {iAnd === orGroup.length - 1 && (
                      <s-box paddingBlockStart="small">
                        <s-stack direction="inline" gap="small-200">
                          <s-button icon="plus" onClick={() => setConditions((c) => c[iOr].push({ ...DEFAULT_AND_CONDITION }))}>
                            AND
                          </s-button>
                          {iOr === automatically_condition.length - 1 && (
                            <s-button icon="plus" onClick={() => setConditions((c) => c.push([{ ...DEFAULT_AND_CONDITION }]))}>
                              OR
                            </s-button>
                          )}
                        </s-stack>
                      </s-box>
                    )}
                  </div>
                );
              })}
              {iOr < automatically_condition.length - 1 && (
                <div className="qset-or-divider">
                  <span>OR</span>
                </div>
              )}
            </div>
          ))}
        </s-box>
      )}
      {picker && (
        <ResourcePickerModal
          type={picker.type}
          initialQuery={picker.query}
          selected={picker.type === 'product' ? manual_condition.map((p) => p.product_variant_id) : collection_condition.map((c) => c.collection_id)}
          onClose={() => setPicker(null)}
          onSelect={(rows) => {
            set(picker.type === 'product' ? { manual_condition: rows } : { collection_condition: rows });
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

// ── Customer tags (core/TagTextField.jsx) ──────────────────────────────────
export function TagTextField({ placeholder, tags = [], onChange, error }) {
  const [tag, setTag] = useState('');
  const [dupError, setDupError] = useState('');
  useEffect(() => {
    setTag('');
    setDupError('');
  }, [tags]);

  const submit = () => {
    const t = tag.trim();
    setDupError('');
    if (!t) {
      setTag('');
      return;
    }
    if (tags.some((x) => x.trim() === t)) {
      setDupError('You already have another tag with this value!');
      return;
    }
    onChange([...tags, t]);
    setTag('');
  };

  return (
    <s-stack gap="small-400">
      <s-text-field
        label={placeholder}
        labelAccessibilityVisibility="exclusive"
        placeholder={placeholder}
        value={tag}
        error={dupError || error}
        onInput={(e) => {
          setDupError('');
          setTag(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        onBlur={submit}
      />
      {tags.length > 0 && (
        <s-stack direction="inline" gap="small-200">
          {tags.map((t) => (
            <s-clickable-chip key={t} removable accessibilityLabel={t} onRemove={() => onChange(tags.filter((x) => x !== t))}>
              {t}
            </s-clickable-chip>
          ))}
        </s-stack>
      )}
    </s-stack>
  );
}

// ── Country multi-select (core/SelectPopover.jsx — Combobox + Listbox + Tags) ──
export function CountrySelect({ selected = [], onChange, error }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNTRY_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q));
  }, [query]);
  const toggle = (value) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
    setQuery('');
  };
  return (
    <s-stack gap="small">
      <div
        className="qset-combo"
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setOpen(false), 150);
        }}
      >
        <s-text-field
          label="Countries"
          labelAccessibilityVisibility="exclusive"
          icon="search"
          placeholder="Search"
          value={query}
          error={error}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setOpen(true);
          }}
        />
        {open && (
          <div className="qset-combo__list qset-combo__list--floating" role="listbox" aria-multiselectable="true">
            {options.length === 0 && <div className="qset-combo__empty">No results</div>}
            {options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className="qset-option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(o.value)}
                >
                  <span>{o.label}</span>
                  {on && (
                    <span className="qset-option__suffix">
                      <s-icon type="check" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <s-stack direction="inline" gap="small-200">
          {selected.map((v) => (
            <s-clickable-chip key={v} removable accessibilityLabel={v} onRemove={() => toggle(v)}>
              {COUNTRY_OPTIONS.find((o) => o.value === v)?.label || v}
            </s-clickable-chip>
          ))}
        </s-stack>
      )}
    </s-stack>
  );
}

// ── Customer rules (ButtonSettings/CustomerRules.jsx) ──────────────────────
export function CustomerRules({ type, mode, settings, onChange, isTouched, errors = {}, disabled = false }) {
  const isB2b = mode === 'b2b';
  const {
    applied_customers_mode = CUSTOMER_MODE.LOGGED_IN,
    applied_customers_tags = [],
    applied_customers_without_tags = [],
    applied_customers_country = [],
  } = settings;
  const set = (patch) => onChange({ ...settings, ...patch });

  const tagsField = (key, errKey) => (
    <TagTextField
      placeholder="Enter customer tag"
      tags={key === 'tags' ? applied_customers_tags : applied_customers_without_tags}
      error={isTouched && errors[errKey] ? 'Select at lease 1 tag' : undefined}
      onChange={(v) => set(key === 'tags' ? { applied_customers_tags: v } : { applied_customers_without_tags: v })}
    />
  );

  const withTags = {
    value: CUSTOMER_MODE.WITH_TAGS,
    label: isB2b ? 'Logged-in customers with tags' : 'Customers with tags',
    children: tagsField('tags', 'applied_customers_tags'),
  };
  const withoutTags = {
    value: CUSTOMER_MODE.WITHOUT_TAGS,
    label: isB2b ? 'Logged-in customers without tags' : 'Customers without tags',
    children: tagsField('without', 'applied_customers_without_tags'),
  };

  const choices =
    type === 'hidePrice'
      ? [
          { value: CUSTOMER_MODE.ALL, label: isB2b ? 'Logged-in customers' : 'All customer' },
          !isB2b && { value: CUSTOMER_MODE.GUEST, label: 'Guest customers' },
          withTags,
          withoutTags,
          !isB2b && {
            value: CUSTOMER_MODE.COUNTRY,
            label: 'Customers from specific country',
            children: (
              <CountrySelect
                selected={applied_customers_country}
                error={isTouched && errors.applied_customers_country ? 'Please select at least one country.' : undefined}
                onChange={(v) => set({ applied_customers_country: v })}
              />
            ),
          },
        ]
      : [
          !isB2b && { value: CUSTOMER_MODE.ALL, label: 'All customer' },
          { value: CUSTOMER_MODE.LOGGED_IN, label: 'Logged-in customers' },
          !isB2b && { value: CUSTOMER_MODE.GUEST, label: 'Guest customers' },
          withTags,
          withoutTags,
        ];

  return (
    <ChoiceGroup
      title={type === 'hidePrice' ? 'Hide price to what customers?' : 'Who will see this button?'}
      name={`${type}-customers`}
      value={applied_customers_mode}
      disabled={disabled}
      choices={choices.filter(Boolean)}
      onChange={(v) => set({ applied_customers_mode: Number(v) })}
    />
  );
}

// ── Contextual pieces used on several tabs ─────────────────────────────────

// core/FooterCustom.jsx — Polaris FooterHelp: centred bodyLg (14px) text, 20px margin.
export function FooterHelp({ text, link }) {
  return (
    <s-box paddingBlock="large">
      <div style={{ textAlign: 'center', fontSize: 14 }}>
        <s-text fontSize="large">Learn more about </s-text>
        <s-link href={link} target="_blank">
          {text}
        </s-link>
      </div>
    </s-box>
  );
}
