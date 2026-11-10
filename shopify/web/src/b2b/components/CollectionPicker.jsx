import React, { useState } from 'react';
import { Modal } from '../../shared/wc.jsx';
import { COLLECTIONS } from '../data/constants.js';

// Shopify-style "select collections" resource picker, laid out like VariantPicker:
// search, a [checkbox] · Collection · Products grid, then Select / Cancel. Mount it
// only while open so it resets from `initialSelected` each time.
const PICK_GRID = { display: 'grid', gridTemplateColumns: 'auto minmax(140px, 1fr) 92px', gap: 12, alignItems: 'center' };
const THUMB = { width: 32, height: 32, borderRadius: 6, background: 'var(--p-color-bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' };

export function CollectionPicker({ initialSelected, onCancel, onSelect }) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = Object.keys(COLLECTIONS)
    .filter((c) => !q || c.toLowerCase().includes(q))
    .sort((a, b) => a.localeCompare(b));

  // Checkbox handlers set the state from the box's checked value (a repeated change
  // event is then harmless). The header one acts on the shown (filtered) collections.
  const setOne = (c, on) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(c);
      else n.delete(c);
      return n;
    });
  const allShown = shown.length > 0 && shown.every((c) => selected.has(c));
  const someShown = shown.some((c) => selected.has(c));
  const setAllShown = (on) =>
    setSelected((s) => {
      const n = new Set(s);
      shown.forEach((c) => (on ? n.add(c) : n.delete(c)));
      return n;
    });

  return (
    <Modal onClose={onCancel} heading="Select collections" padding="none">
      <s-box padding="base">
        <s-search-field
          label="Search collections"
          labelAccessibilityVisibility="exclusive"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search collections"
          autocomplete="off"
        />
      </s-box>
      <s-divider />
      <s-box background="subdued" paddingBlock="small-300" paddingInline="base">
        <div style={PICK_GRID}>
          <s-checkbox
            accessibilityLabel="Select all shown collections"
            checked={allShown}
            indeterminate={!allShown && someShown}
            onChange={(e) => setAllShown(e.currentTarget.checked)}
          />
          <s-text fontSize="small" color="subdued" fontWeight="medium">Collection</s-text>
          <div style={{ textAlign: 'end' }}>
            <s-text fontSize="small" color="subdued" fontWeight="medium">Products</s-text>
          </div>
        </div>
      </s-box>
      <s-divider />
      <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'hidden' }}>
        {shown.map((c, i) => (
          <React.Fragment key={c}>
            {i > 0 ? <s-divider /> : null}
            <s-box paddingBlock="small-200" paddingInline="base">
              <div style={PICK_GRID}>
                <s-checkbox accessibilityLabel={`Select ${c}`} checked={selected.has(c)} onChange={(e) => setOne(c, e.currentTarget.checked)} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={THUMB}><s-icon type="collection" color="subdued" /></span>
                  <s-paragraph lineClamp={1}>{c}</s-paragraph>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <s-text>{COLLECTIONS[c].length}</s-text>
                </div>
              </div>
            </s-box>
          </React.Fragment>
        ))}
        {shown.length === 0 && (
          <s-box padding="base">
            <div style={{ textAlign: 'center' }}>
              <s-text color="subdued">{`No collections match “${query.trim()}”.`}</s-text>
            </div>
          </s-box>
        )}
      </div>
      <s-button slot="primary-action" variant="primary" onClick={() => onSelect([...selected])}>
        Select
      </s-button>
      <s-button slot="secondary-actions" onClick={onCancel}>
        Cancel
      </s-button>
    </Modal>
  );
}
