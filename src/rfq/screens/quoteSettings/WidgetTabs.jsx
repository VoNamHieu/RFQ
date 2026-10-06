import React, { useRef, useState } from 'react';
import { UNIT_OPTIONS, WIDGET_POSITION_OPTIONS } from './data.js';
import { ButtonStyleEditor, FieldTitle, InfoIcon, StoreModeSwitch } from './parts.jsx';
import defaultCartIcon from './assets/quote_cart_icon.svg';

// "Quote cart widget" and "Quote history widget" tabs — production
// components/CollectQuote/QuoteForm/Settings/QuoteCart/* and .../HistoryQuote/*.

// Polaris RangeSlider (label + output bubble) next to the unit Select.
function MarginPosition({ value, unit, disabled, onAmount, onUnit }) {
  const amount = value ?? 0;
  return (
    <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small" alignItems="end">
      <label className={`qset-range${disabled ? ' qset-range--disabled' : ''}`}>
        <s-text>Margin position</s-text>
        <span className="qset-range__row">
          <input type="range" min={-100} max={500} step={1} value={amount} disabled={disabled} onChange={(e) => onAmount(Number(e.target.value))} />
          <output className="qset-range__output">{amount}</output>
        </span>
      </label>
      <s-select label="Unit" labelAccessibilityVisibility="exclusive" value={unit} disabled={disabled} onChange={(e) => onUnit(e.currentTarget.value)}>
        {UNIT_OPTIONS.map((o) => (
          <s-option key={o.value} value={o.value}>
            {o.label}
          </s-option>
        ))}
      </s-select>
    </s-grid>
  );
}

// Polaris DropZone (50×50, .svg only) with the current quote cart icon inside.
function CartIconDrop({ icon, disabled, onFile, onReject }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const take = (file) => {
    if (!file) return;
    if (file.type === 'image/svg+xml' || /\.svgz?$/i.test(file.name)) onFile(file);
    else onReject(file);
  };
  return (
    <>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload quote cart icon"
        aria-disabled={disabled}
        className={`qset-icon-drop${over ? ' qset-icon-drop--over' : ''}${disabled ? ' qset-icon-drop--disabled' : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) take(e.dataTransfer.files?.[0]);
        }}
      >
        <span>
          <img src={icon || defaultCartIcon} alt="Quote Cart Icon" />
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/svg+xml"
        hidden
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );
}

export function QuoteCartTab({ settings, onChange, mode, onModeChange, isTouched, onHoverEdit, onTextEdit }) {
  const s = settings;
  const enabled = !!Number(s.show_view_button);
  const pos = s.view_quote_position;
  const [rejected, setRejected] = useState([]);
  const [showUploadError, setShowUploadError] = useState(true);
  const setPos = (patch) => onChange({ ...s, view_quote_position: { ...pos, ...patch } });
  const setStyles = (styles) => onChange({ ...s, custom_styles: styles });

  return (
    <s-section>
      <s-stack gap="small">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center">
          <s-heading>Logic</s-heading>
          <StoreModeSwitch mode={mode} onChange={onModeChange} />
        </s-grid>
        <s-checkbox label="Activate widget" checked={enabled} onChange={(e) => onChange({ ...s, show_view_button: e.currentTarget.checked ? 1 : 0 })} />
        <s-divider />
        <s-stack gap="small-200">
          <s-stack gap="small">
            <s-select label="Button position" value={pos.side} disabled={!enabled} onChange={(e) => setPos({ side: e.currentTarget.value })}>
              {WIDGET_POSITION_OPTIONS.map((o) => (
                <s-option key={o.value} value={o.value}>
                  {o.label}
                </s-option>
              ))}
            </s-select>
            {pos.side !== 'next_cart' && (
              <MarginPosition
                value={pos.margin_top?.amount}
                unit={pos.margin_top?.unit}
                disabled={!enabled}
                onAmount={(amount) => setPos({ margin_top: { ...pos.margin_top, amount } })}
                onUnit={(unit) => setPos({ margin_top: { ...pos.margin_top, unit } })}
              />
            )}
            <s-checkbox
              label="Not show button for empty list"
              checked={!!Number(s.show_view_button_empty)}
              disabled={!enabled}
              onChange={(e) => onChange({ ...s, show_view_button_empty: e.currentTarget.checked ? 1 : 0 })}
            />
          </s-stack>
          {pos.side === 'next_cart' && (
            <s-stack gap="small-400">
              <s-stack direction="inline" gap="small-400" alignItems="center">
                <s-text>Customize quote cart icon</s-text>
                <InfoIcon tip="Only .svg, .svgz files are supported." />
              </s-stack>
              {rejected.length > 0 && showUploadError && (
                <s-banner tone="critical" heading="The following images couldn't be uploaded:" dismissible onDismiss={() => setShowUploadError(false)}>
                  <s-unordered-list>
                    {rejected.map((f) => (
                      <s-list-item key={`${f.name}-${f.size}`}>"{f.name}" is not supported. Only .svg, .svgz files are supported.</s-list-item>
                    ))}
                  </s-unordered-list>
                </s-banner>
              )}
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <CartIconDrop
                  icon={s.custom_styles.quote_cart_icon}
                  disabled={!enabled}
                  onFile={(file) => {
                    setRejected([]);
                    setStyles({ ...s.custom_styles, quote_cart_icon: URL.createObjectURL(file) });
                  }}
                  onReject={(file) => {
                    setRejected([file]);
                    setShowUploadError(true);
                  }}
                />
                {s.custom_styles.quote_cart_icon && (
                  <s-button icon="x" accessibilityLabel="Remove icon" disabled={!enabled} onClick={() => setStyles({ ...s.custom_styles, quote_cart_icon: null })} />
                )}
              </s-stack>
            </s-stack>
          )}
        </s-stack>
        <s-divider />
        <div>
          <FieldTitle>Widget appearance</FieldTitle>
          <s-box paddingBlock="small">
            <ButtonStyleEditor
              name="view-quote"
              section="text"
              labelText="Button label"
              styles={s.custom_styles}
              disabled={!enabled}
              isTouched={isTouched}
              onChange={(styles) => {
                setStyles(styles);
                onTextEdit?.();
              }}
              onHoverEdit={onHoverEdit}
            />
          </s-box>
          <s-box paddingBlockEnd="small">
            <ButtonStyleEditor name="view-quote" section="button" labelText="Button label" styles={s.custom_styles} disabled={!enabled} onChange={setStyles} onHoverEdit={onHoverEdit} />
          </s-box>
        </div>
      </s-stack>
    </s-section>
  );
}

export function HistoryTab({ settings, onChange, mode, onModeChange, isTouched, onHoverEdit }) {
  const s = settings;
  const enabled = !!Number(s.show_history_quotes_button);
  const pos = s.view_history_quote_position;
  const setPos = (patch) => onChange({ ...s, view_history_quote_position: { ...pos, ...patch } });
  const setStyles = (styles) => onChange({ ...s, custom_styles: styles });

  return (
    <s-section>
      <s-stack gap="small">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center">
          <s-heading>Logic</s-heading>
          <StoreModeSwitch mode={mode} onChange={onModeChange} />
        </s-grid>
        <s-checkbox label="Activate widget" checked={enabled} onChange={(e) => onChange({ ...s, show_history_quotes_button: e.currentTarget.checked ? 1 : 0 })} />
        <s-stack gap="small">
          <s-select label="Button position" value={pos.side} disabled={!enabled} onChange={(e) => setPos({ side: e.currentTarget.value })}>
            {WIDGET_POSITION_OPTIONS.map((o) => (
              <s-option key={o.value} value={o.value}>
                {o.label}
              </s-option>
            ))}
          </s-select>
          {pos.side !== 'next_cart' && (
            <MarginPosition
              value={pos.margin_top?.amount}
              unit={pos.margin_top?.unit}
              disabled={!enabled}
              onAmount={(amount) => setPos({ margin_top: { ...pos.margin_top, amount } })}
              onUnit={(unit) => setPos({ margin_top: { ...pos.margin_top, unit } })}
            />
          )}
        </s-stack>
        <s-divider />
        <div>
          <FieldTitle>Widget appearance</FieldTitle>
          <s-box paddingBlock="small">
            {/* Production passes name="view-quote" here too, so editing a hover style
                does not flash the history preview (it listens for "view-history-quote"). */}
            <ButtonStyleEditor
              name="view-quote"
              section="text"
              labelText="Button label"
              styles={s.custom_styles}
              disabled={!enabled}
              isTouched={isTouched}
              onChange={setStyles}
              onHoverEdit={onHoverEdit}
            />
          </s-box>
          <s-box paddingBlockEnd="small">
            <ButtonStyleEditor
              name="view-quote"
              section="button"
              labelText="Button label"
              styles={s.custom_styles}
              disabled={!enabled}
              onChange={setStyles}
              onHoverEdit={onHoverEdit}
            />
          </s-box>
        </div>
      </s-stack>
    </s-section>
  );
}
