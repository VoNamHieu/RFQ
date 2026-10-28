import React from 'react';
import { useWcId } from '../../shared/wc.jsx';

// Which of a company's locations get a pricing: all of them (company pricing —
// locations added later get it too) or only some. `locationIds` null = all; an
// array = the picked ones. Ticking every location switches back to All locations.
// With `onApplyLaterChange`, a checkbox under both choices says whether locations
// added later get it too (`applyLater`) — only for a company with "Automatically
// add new locations" on, since only then are locations added later. `separate`
// puts the location list right under Specific locations. Shared by the Assign
// modal, the pricing editor and the agreement editor.
// `keep`: locations Active contracts give it to — { locationId: contract number } —
// which stay picked (can't be unticked).
export function LocationScopePicker({ company, locationIds, onChange, title = 'Apply to', titleHidden = false, applyLater = false, onApplyLaterChange, separate = false, keep = {} }) {
  const name = useWcId('loc-scope');
  const locations = company?.locations || [];
  const some = Array.isArray(locationIds);
  const picked = some ? locationIds : [];
  // Idempotent: sets the location on/off from the checkbox's checked state.
  // Specific locations, with the kept ones; every location → all (null).
  const pick = (ids) => {
    const next = [...new Set([...ids, ...Object.keys(keep)])];
    return locations.length > 0 && locations.every((l) => next.includes(l.id)) ? null : next;
  };
  // All of them kept: it can't be narrowed to specific locations.
  const allKept = locations.length > 0 && locations.every((l) => keep[l.id]);
  const allKeptNote = allKept ? <s-text slot="details">{`Every location is part of ${[...new Set(Object.values(keep))].join(', ')}.`}</s-text> : null;
  const setPicked = (id, on) => onChange(pick(on ? [...picked, id] : picked.filter((x) => x !== id)));

  const laterBox = onApplyLaterChange && company?.autoAddLocations && (
    <s-checkbox
      label="Automatically apply this pricing to locations added later"
      checked={applyLater}
      onChange={(e) => onApplyLaterChange(e.currentTarget.checked)}
    />
  );
  // Polaris React rendered this list under the "Specific locations" choice
  // (renderChildren); it follows the choice, indented to match.
  const locationsBox = some && (
    <s-box paddingInlineStart="large-200">
      <s-box border="base" borderRadius="base" overflow="hidden">
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {locations.map((l, i) => (
            <React.Fragment key={l.id}>
              {i > 0 ? <s-divider /> : null}
              <s-box paddingInline="small" paddingBlock="small-200">
                <s-checkbox
                  label={l.name}
                  checked={picked.includes(l.id)}
                  disabled={!!keep[l.id]}
                  details={keep[l.id] ? `Part of ${keep[l.id]}` : undefined}
                  onChange={(e) => setPicked(l.id, e.currentTarget.checked)}
                />
              </s-box>
            </React.Fragment>
          ))}
        </div>
      </s-box>
    </s-box>
  );

  if (separate) {
    // Each choice is its own list so its options can sit right under it (s-choice's
    // details slot only shows text). A list keeps its own checked state, so the one
    // that loses the selection is remounted (keyed on it).
    const choice = (value, selected, label) => (
      <s-choice-list
        key={`${value}-${selected}`}
        label={title}
        labelAccessibilityVisibility="exclusive"
        name={`${name}-${value}`}
        onChange={(e) => {
          if (e.currentTarget.values?.[0] === value) onChange(value === 'some' ? pick(picked) : null);
        }}
      >
        <s-choice value={value} selected={selected} disabled={value === 'some' && allKept}>
          {label}
          {value === 'some' ? allKeptNote : null}
        </s-choice>
      </s-choice-list>
    );
    return (
      <s-stack gap="small-200">
        {choice('all', !some, 'All locations')}
        {choice('some', some, 'Specific locations')}
        {locationsBox}
        {laterBox}
      </s-stack>
    );
  }

  return (
    <s-stack gap="small-200">
      <s-choice-list
        label={title}
        name={name}
        labelAccessibilityVisibility={titleHidden ? 'exclusive' : undefined}
        onChange={(e) => {
          const v = e.currentTarget.values?.[0];
          if (!v) return;
          onChange(v === 'some' ? pick(picked) : null);
        }}
      >
        <s-choice value="all" selected={!some}>
          All locations
        </s-choice>
        <s-choice value="some" selected={some} disabled={allKept}>
          Specific locations
          {allKeptNote}
        </s-choice>
      </s-choice-list>
      {locationsBox}
      {laterBox}
    </s-stack>
  );
}
