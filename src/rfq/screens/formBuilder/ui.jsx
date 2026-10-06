import React, { useEffect, useState } from 'react';
import { useWcId } from '../../../shared/wc.jsx';
import { LANGUAGES } from './lists.js';
import { useBuilder, parseRgba, toHex, toRgba, kilobytes } from './model.js';

export const languageName = (code) => LANGUAGES.find(([c]) => c === code)?.[1] || code;

// TranslationSetting/LanguagePopover.jsx — a disclosure button with the current
// form language and an ActionList of the languages this form has (the default
// one carries a "Default" badge).
export function LanguagePopover() {
  const { form, lang, setLang } = useBuilder();
  const id = useWcId('qfb-lang');
  const entries = Object.values(form.translations);
  return (
    <>
      <s-button commandFor={id}>
        <span className="qfb-disclosure">
          {LANGUAGES.find(([c]) => c === lang)?.[1] || 'English'}
          <s-icon type="chevron-down" size="small" />
        </span>
      </s-button>
      <s-popover id={id}>
        <div className="qfb-actionlist" role="menu">
          {entries.map((t) => (
            <s-clickable
              key={t.lang_code}
              commandFor={id}
              command="--hide"
              padding="small-200"
              borderRadius="base"
              background={t.lang_code === lang ? 'subdued' : undefined}
              onClick={() => setLang(t.lang_code)}
            >
              <span className="qfb-actionlist__item" role="menuitem">
                <s-text fontWeight={t.lang_code === lang ? 'semibold' : undefined}>{languageName(t.lang_code)}</s-text>
                {t.is_default ? <s-badge tone="info">Default</s-badge> : null}
              </span>
            </s-clickable>
          ))}
        </div>
      </s-popover>
    </>
  );
}

// core/MenuCollapseFullScreen.jsx — full-bleed accordion sections (one open at a
// time), a divider under every section.
export function CollapseMenu({ items, openId, onToggle }) {
  return (
    <div className="qfb-collapse">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div key={item.id} className="qfb-collapse__item">
            <button
              type="button"
              className="qfb-collapse__head"
              aria-expanded={open}
              onClick={() => onToggle(open ? null : item.id)}
            >
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-heading>{item.title}</s-heading>
                {item.badgeText ? <s-badge tone="info">{item.badgeText}</s-badge> : null}
              </s-stack>
              <s-icon type={open ? 'chevron-up' : 'chevron-down'} />
            </button>
            {open && <div className="qfb-collapse__body">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}

// Back row at the top of a detail panel (SettingDetail.jsx).
export function DetailHeader({ title, onBack }) {
  return (
    <button type="button" className="qfb-detail-head" onClick={onBack}>
      <span className="qfb-detail-head__icon">
        <s-icon type="chevron-left" />
      </span>
      <s-heading>{title}</s-heading>
    </button>
  );
}

// Polaris ButtonGroup variant="segmented" fullWidth (button alignment, field width).
export function Segmented({ label, options, value, onChange, disabled }) {
  return (
    <s-stack gap="small-200">
      {label ? <s-text color={disabled ? 'subdued' : undefined}>{label}</s-text> : null}
      <div className="qfb-segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <s-press-button
            key={o.value}
            inlineSize="fill"
            disabled={disabled}
            pressed={o.value === value}
            onClick={(e) => {
              e.currentTarget.pressed = true;
              if (o.value !== value) onChange(o.value);
            }}
          >
            {o.label}
          </s-press-button>
        ))}
      </div>
    </s-stack>
  );
}

// DropZone (variableHeight) with DropZone.FileUpload, or the current image's
// thumbnail + name + "Remove" inside it (empty state / success message image).
export function ImageDrop({ label, hint, image, name, size, alt, onPick, onRemove, onError }) {
  const accept = 'image/gif,image/jpg,image/jpeg,image/png';
  return (
    <s-drop-zone
      label={label}
      accept={accept}
      onChange={(e) => {
        const file = e.currentTarget.files?.[0];
        if (!file) return;
        const errors = [];
        if (file.size > 2097152) errors.push('File size must be less than 2MB');
        if (!['image/gif', 'image/jpeg', 'image/png'].includes(file.type)) {
          errors.push('File type must be image/gif, image/jpg, image/jpeg, or image/png');
        }
        onError?.(errors);
        if (errors.length) return;
        onPick({ url: URL.createObjectURL(file), name: file.name, size: file.size });
      }}
      // Files the `accept` filter turns away (DropZone customValidator errors).
      onDropRejected={() => onError?.(['File type must be image/gif, image/jpg, image/jpeg, or image/png'])}
    >
      <div className="qfb-drop">
        {!image ? (
          <s-stack gap="small-200" alignItems="center">
            <s-button>Add file</s-button>
            <s-text color="subdued">{hint}</s-text>
          </s-stack>
        ) : (
          <div className="qfb-drop__file">
            <s-thumbnail size="large" src={image} alt={alt || name} />
            <div className="qfb-drop__meta">
              <span>{name}</span>
              {size ? (
                <s-paragraph fontSize="small">
                  {kilobytes(size)} kilobytes
                </s-paragraph>
              ) : null}
              <s-link
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                Remove
              </s-link>
            </div>
          </div>
        )}
      </div>
    </s-drop-zone>
  );
}

// core/ColorPickerInputInline.jsx — 40px swatch (opens a picker + hex input) and
// "label / #HEX, alpha%".
export function ColorRow({ label, value, onChange }) {
  const id = useWcId('qfb-color');
  const rgba = parseRgba(value);
  const hex = toHex(rgba);
  const [hexText, setHexText] = useState(hex);
  useEffect(() => setHexText(hex), [hex]);
  const commitHex = () => {
    if (!/^[0-9a-f]{6}$/i.test(hexText)) {
      setHexText(hex);
      return;
    }
    onChange(toRgba({ ...parseRgba(`#${hexText}`), a: rgba.a }));
  };
  return (
    <>
      <div className="qfb-color-row">
        <span className="qfb-swatch-wrap">
          <s-clickable commandFor={id} accessibilityLabel={`${label}: #${hex}`} borderRadius="large-200">
            <span
              className="qfb-swatch"
              style={{ backgroundColor: value, borderColor: hex === 'FFFFFF' ? '#c2c2c2' : `#${hex}` }}
            />
          </s-clickable>
        </span>
        <div className="qfb-color-row__text">
          <s-paragraph fontWeight="medium">{label}</s-paragraph>
          <s-paragraph>
            #{hexText}, {Math.round(rgba.a * 100)}%
          </s-paragraph>
        </div>
      </div>
      <s-popover id={id}>
        <s-box padding="small">
          <s-stack gap="small">
            <s-color-picker alpha value={toRgba(rgba)} onInput={(e) => onChange(toRgba(parseRgba(e.currentTarget.value)))} />
            <s-text-field
              label={label}
              value={hexText}
              maxLength={6}
              onInput={(e) => setHexText(e.currentTarget.value.replace('#', ''))}
              onBlur={commitHex}
            />
          </s-stack>
        </s-box>
      </s-popover>
    </>
  );
}

// Plain "link" button with a leading icon (Polaris plain Button + PlusCircleIcon).
export function PlainIconButton({ icon, children, onClick }) {
  return (
    <button type="button" className="qfb-plain-btn" onClick={onClick}>
      <s-icon type={icon} />
      <span>{children}</span>
    </button>
  );
}
