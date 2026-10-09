import React, { useState } from 'react';
import { useWcId } from '../../../shared/wc.jsx';
import { fullApp, useToast } from './ui.jsx';

// Production "Formatting standards" section: CustomizeQuoteID.jsx, NameFormat.jsx
// (+ core/DynamicValue.jsx), CustomerNameFormat.jsx and AddressFormat.jsx.
// Card titles are `Text variant="headingMd"` (14px) → s-heading fontSize="large".

export function FormattingStandards({ draft, patch }) {
  const { custom_quote, pdf_name_format, name_format, address_format } = draft;
  return (
    <>
      <QuoteIdFormat value={custom_quote} onChange={(v) => patch('custom_quote', v)} />
      <PdfNameFormat customQuote={custom_quote} value={pdf_name_format} onChange={(v) => patch('pdf_name_format', v)} />
      <CustomerNameFormat value={name_format} onChange={(v) => patch('name_format', v)} />
      <AddressFormat value={address_format} onChange={(v) => patch('address_format', v)} />
    </>
  );
}

function QuoteIdFormat({ value, onChange }) {
  return (
    <s-section>
      <s-stack gap="small-200">
        <s-heading fontSize="large">Quote ID format</s-heading>
        <s-text-field label="Prefix" placeholder="PRE-" value={value.prefix} onInput={(e) => onChange({ ...value, prefix: e.currentTarget.value })} />
        <s-text-field label="Suffix" placeholder="-SUF" value={value.suffix} onInput={(e) => onChange({ ...value, suffix: e.currentTarget.value })} />
        <s-text-field label="Quote ID preview" placeholder="-SUF" value={`${value.prefix}1000${value.suffix}`} disabled />
      </s-stack>
    </s-section>
  );
}

// core/DynamicValue.jsx — a plain "Dynamic value" button that opens a list of
// placeholders; picking one copies it to the clipboard.
function DynamicValue({ values }) {
  const toast = useToast();
  const id = useWcId('qcfg-dyn');
  const copy = (value) => {
    try {
      navigator.clipboard?.writeText(value);
    } catch {
      /* clipboard unavailable — the toast still confirms the pick */
    }
    toast('Dynamic value copied');
  };
  return (
    <>
      <s-link commandFor={id}>Dynamic value</s-link>
      <s-popover id={id}>
        <div style={{ minWidth: 260 }}>
          <s-box padding="small">
            <s-text fontWeight="medium">Dynamic value</s-text>
          </s-box>
          <s-divider />
          <s-box padding="small-300">
            <s-stack gap="small-500">
              {values.map((item) => (
                <s-clickable
                  key={item.value}
                  commandFor={id}
                  command="--hide"
                  padding="small-300 small-200"
                  borderRadius="base"
                  onClick={() => copy(item.value)}
                >
                  <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
                    <s-text>
                      {item.label}: {item.value}
                    </s-text>
                    <s-icon type="duplicate" />
                  </s-grid>
                </s-clickable>
              ))}
            </s-stack>
          </s-box>
        </div>
      </s-popover>
    </>
  );
}

// TextField with a labelAction (label on the left, action link on the right).
function FieldWithAction({ label, action, children }) {
  return (
    <s-stack gap="small-400">
      <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="small-200">
        <s-text>{label}</s-text>
        {action}
      </s-grid>
      {children}
    </s-stack>
  );
}

const QUOTE_VALUES = [
  { label: 'Quote ID', value: '{{quote_id}}' },
  { label: 'Quote created date', value: '{{create_date}}' },
  { label: 'File exported date', value: '{{export_date}}' },
];
const INVOICE_VALUES = [
  { label: 'Quote ID', value: '{{quote_id}}' },
  { label: 'Quote created date', value: '{{create_date}}' },
  { label: 'Order created date', value: '{{order_date}}' },
  { label: 'File exported date', value: '{{export_date}}' },
];

function PdfNameFormat({ customQuote, value, onChange }) {
  const preview = (format) =>
    format
      .replaceAll('{{quote_id}}', `${customQuote.prefix}0001${customQuote.suffix}`)
      .replaceAll('{{create_date}}', '2024-01-24')
      .replaceAll('{{order_date}}', '2024-01-24')
      .replaceAll('{{export_date}}', '2024-01-24');
  return (
    <s-section>
      <s-stack gap="small-200">
        <s-heading fontSize="large">PDF name format</s-heading>
        <s-text fontWeight="medium">PDF quote</s-text>
        <FieldWithAction label="Format" action={<DynamicValue values={QUOTE_VALUES} />}>
          <s-text-field
            label="Format"
            labelAccessibilityVisibility="exclusive"
            placeholder="PRE-"
            value={value.quote}
            onInput={(e) => onChange({ ...value, quote: e.currentTarget.value })}
          />
        </FieldWithAction>
        <s-text-field label="Preview" placeholder="-SUF" value={preview(value.quote)} disabled />

        <s-text fontWeight="medium">PDF invoice</s-text>
        <FieldWithAction label="Format" action={<DynamicValue values={INVOICE_VALUES} />}>
          <s-text-field
            label="Format"
            labelAccessibilityVisibility="exclusive"
            placeholder="PRE-"
            value={value.invoice}
            onInput={(e) => onChange({ ...value, invoice: e.currentTarget.value })}
          />
        </FieldWithAction>
        <s-text-field label="Preview" placeholder="-SUF" value={preview(value.invoice)} disabled />
      </s-stack>
    </s-section>
  );
}

// Drag the two chips to swap the display order (react-beautiful-dnd in production).
function CustomerNameFormat({ value, onChange }) {
  const first = { id: 'firstName', label: 'First name' };
  const last = { id: 'lastName', label: 'Last name' };
  const lastFirst = value?.order === 'last_first';
  const items = lastFirst ? [last, first] : [first, last];
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const swap = () => onChange({ order: lastFirst ? 'first_last' : 'last_first' });

  return (
    <s-section>
      <s-stack gap="small-200">
        <s-heading fontSize="large">Name format</s-heading>
        <s-text fontWeight="medium">Display order</s-text>
        <s-paragraph color="subdued">The customer name displays on one line, space-separated. Drag to reorder.</s-paragraph>
        <div className="qcfg-dropzone">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`qcfg-dragitem${dragging === index ? ' qcfg-dragitem--dragging' : ''}${over === index && dragging !== index ? ' qcfg-dragitem--over' : ''}`}
              draggable
              onDragStart={(e) => {
                setDragging(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.id);
              }}
              onDragEnter={() => setOver(index)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging !== null && dragging !== index) swap();
                setDragging(null);
                setOver(null);
              }}
            >
              <button
                type="button"
                className="qcfg-draghandle"
                aria-label="Drag to reorder"
                onKeyDown={(e) => {
                  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                    e.preventDefault();
                    swap();
                  }
                }}
              >
                <s-icon type="drag-handle" />
              </button>
              <s-text>{item.label}</s-text>
            </div>
          ))}
        </div>
      </s-stack>
    </s-section>
  );
}

const PREVIEW_LINES = ['John Smith', 'Acme', '456 Park Avenue', 'Apt 12B', 'New York NY 10022', 'United States', '+1987654321'];

function AddressFormat({ value, onChange }) {
  const toast = useToast();
  const direction = value?.displayDirection ?? 'vertical';
  return (
    <s-section>
      <s-stack gap="small-200">
        <s-heading fontSize="large">Address format</s-heading>
        <s-select label="Display direction" value={direction} onChange={(e) => onChange({ ...value, displayDirection: e.currentTarget.value })}>
          <s-option value="horizontal">Horizontal</s-option>
          <s-option value="vertical">Vertical</s-option>
        </s-select>
        <s-text fontWeight="medium">Preview</s-text>
        <div data-testid="address-format-preview">
          {direction === 'horizontal' ? (
            <s-paragraph>{PREVIEW_LINES.join(', ')}</s-paragraph>
          ) : (
            PREVIEW_LINES.map((line) => <s-paragraph key={line}>{line}</s-paragraph>)
          )}
        </div>
        <s-banner tone="info">
          Preview only, actual output will be formatted correctly. <s-link onClick={() => toast(fullApp('the support chat'))}>Contact us</s-link> if you would
          like to customize your address format
        </s-banner>
      </s-stack>
    </s-section>
  );
}
