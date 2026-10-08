import React from 'react';
import { useWcId } from '../../shared/wc.jsx';

// Which of a company's locations get a pricing: all of them (company pricing —
// locations added later get it too) or only some. `locationIds` null = all; an
// array = the picked ones. Ticking every location switches back to All locations.
// With `onApplyLaterChange`, All locations shows a checkbox for whether locations
// added later get it too (`applyLater`). `separate` drops the detail line and puts
// each choice's options right under it: the checkbox under All locations, the
// location list under Specific locations. Shared by the Assign modal, the pricing
// editor and the agreement editor.
export function LocationScopePicker({ company, locationIds, onChange, title = 'Apply to', titleHidden = false, applyLater = false, onApplyLaterChange, separate = false }) {
  const name = useWcId('loc-scope');
  const locations = company?.locations || [];
  const some = Array.isArray(locationIds);
  const picked = some ? locationIds : [];
  // Idempotent: sets the location on/off from the checkbox's checked state.
  const setPicked = (id, on) => {
    const next = on ? [...new Set([...picked, id])] : picked.filter((x) => x !== id);
    onChange(locations.length > 0 && locations.every((l) => next.includes(l.id)) ? null : next);
  };

  const allDetails = onApplyLaterChange ? 'Company pricing.' : 'Company pricing. Locations added later get it too.';
  const laterBox = !some && onApplyLaterChange && (
    <s-box paddingInlineStart="large-200">
      <s-checkbox
        label="Automatically apply this pricing to locations added later"
        details="This only applies to companies with “Automatically add new locations” turned on."
        checked={applyLater}
        onChange={(e) => onApplyLaterChange(e.currentTarget.checked)}
      />
    </s-box>
  );
  // Polaris React rendered this list under the "Specific locations" choice
  // (renderChildren); it follows the choice, indented to match.
  const locationsBox = some && (
    <s-box paddingInlineStart="large-200">
      <s-stack gap="small-300">
        <s-box border="base" borderRadius="base" overflow="hidden">
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {locations.map((l, i) => (
              <React.Fragment key={l.id}>
                {i > 0 ? <s-divider /> : null}
                <s-box paddingInline="small" paddingBlock="small-200">
                  <s-checkbox
                    label={l.name}
                    checked={picked.includes(l.id)}
                    onChange={(e) => setPicked(l.id, e.currentTarget.checked)}
                  />
                </s-box>
              </React.Fragment>
            ))}
          </div>
        </s-box>
        <s-paragraph color="subdued" fontSize="small">
          {picked.length
            ? `${picked.length} of ${locations.length} selected. They get their own pricing, starting from the company’s, so later company changes won’t reach them.`
            : 'Pick the locations that get this pricing.'}
        </s-paragraph>
      </s-stack>
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
          if (e.currentTarget.values?.[0] === value) onChange(value === 'some' ? picked : null);
        }}
      >
        <s-choice value={value} selected={selected}>{label}</s-choice>
      </s-choice-list>
    );
    return (
      <s-stack gap="small-200">
        {choice('all', !some, 'All locations')}
        {laterBox}
        {choice('some', some, 'Specific locations')}
        {locationsBox}
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
          onChange(v === 'some' ? picked : null);
        }}
      >
        <s-choice value="all" selected={!some}>
          All locations
          <s-text slot="details">{allDetails}</s-text>
        </s-choice>
        <s-choice value="some" selected={some}>
          Specific locations
        </s-choice>
      </s-choice-list>
      {laterBox}
      {locationsBox}
    </s-stack>
  );
}
