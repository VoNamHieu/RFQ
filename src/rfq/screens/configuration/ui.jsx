import React, { useCallback } from 'react';
import { useStore } from '../../store.jsx';

// Small building blocks shared by the Configuration sections.

export function useToast() {
  const { dispatch } = useStore();
  return useCallback((message) => dispatch({ type: 'TOAST', message }), [dispatch]);
}

// Deeper production routes (template editors, integration pages, create forms) are
// out of scope for the prototype; their entry points announce that instead.
export const fullApp = (name) => `Opens ${name} in the full app`;

export const clone = (v) => JSON.parse(JSON.stringify(v));
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Polaris React `Card` nested inside another Card (rendered as its own bordered card).
export function InnerCard({ children, padding = 'base', background = 'base' }) {
  return (
    <s-box border="base" borderRadius="base" padding={padding} background={background}>
      {children}
    </s-box>
  );
}

// Polaris DataTable used with `totals` as its header row (Name … Action) and one
// row per template. `rows`: [{ key, content, actions }].
export function DataRows({ headings, rows }) {
  return (
    <div className="qcfg-datatable" role="table">
      <div className="qcfg-datatable__row qcfg-datatable__row--head" role="row">
        <span role="columnheader">{headings[0]}</span>
        <span role="columnheader" className="qcfg-datatable__end">
          {headings[1]}
        </span>
      </div>
      {rows.map((r) => (
        <div className="qcfg-datatable__row" role="row" key={r.key}>
          <div role="cell" className="qcfg-datatable__main">
            {r.content}
          </div>
          <div role="cell" className="qcfg-datatable__end">
            {r.actions}
          </div>
        </div>
      ))}
    </div>
  );
}

// Polaris RadioButton group → single-select s-choice-list.
export function RadioGroup({ name, label, labelHidden, value, options, onChange, disabled }) {
  return (
    <s-choice-list
      name={name}
      label={label || name}
      labelAccessibilityVisibility={label && !labelHidden ? undefined : 'exclusive'}
      disabled={disabled}
      onChange={(e) => {
        const next = e.currentTarget.values?.[0];
        if (next != null && next !== String(value)) onChange(next);
      }}
    >
      {options.map((o) => (
        <s-choice key={o.value} value={String(o.value)} selected={String(o.value) === String(value)} disabled={o.disabled}>
          {o.label}
          {o.details ? <s-text slot="details">{o.details}</s-text> : null}
        </s-choice>
      ))}
    </s-choice-list>
  );
}

// Polaris ChoiceList / RadioButtons whose selected option shows extra fields right
// under it (`renderChildren`). options: [{ value, label, details, disabled, children }].
export function NestedRadios({ name, label, value, options, onChange, disabled }) {
  return (
    <s-choice-list
      name={name}
      label={label || name}
      labelAccessibilityVisibility={label ? undefined : 'exclusive'}
      disabled={disabled}
      onChange={(e) => {
        const next = e.currentTarget.values?.[0];
        if (next != null && next !== String(value)) onChange(next);
      }}
    >
      {options.map((o) => {
        const isSelected = String(o.value) === String(value);
        return (
          <s-choice key={o.value} value={String(o.value)} selected={isSelected} disabled={o.disabled}>
            {o.label}
            {o.details ? <s-text slot="details">{o.details}</s-text> : null}
            {isSelected && o.children ? (
              <div slot="secondary-content" style={{ paddingBlock: '4px 8px' }}>
                {o.children}
              </div>
            ) : null}
          </s-choice>
        );
      })}
    </s-choice-list>
  );
}

export function Options({ options }) {
  return options.map((o) => (
    <s-option key={o.value} value={o.value} disabled={o.disabled}>
      {o.label}
    </s-option>
  ));
}
