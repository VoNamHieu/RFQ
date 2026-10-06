import React, { useEffect, useRef, useState } from 'react';

// The pricing picker shared by the company section's "Add base pricing" flow
// (AssignModal) and the Add-company wizard: a search field that opens a list of
// options with checkboxes below it (Polaris web components have no combobox),
// with the picks shown as removable chips under it. Multi-select unless
// `single`. Presentational — the caller owns `selectedIds` and gets `onChange`.
export function PricingCombobox({
  label,
  placeholder,
  candidates,
  selectedIds,
  onChange,
  single = false,
  optionLabel,
  emptyText = 'No matches',
}) {
  const [inputValue, setInputValue] = useState('');
  // The option list shows while the field is in use (like the Combobox popover):
  // opened by focusing or typing, closed by Escape or a click outside.
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const q = inputValue.trim().toLowerCase();
  const filtered = q ? candidates.filter((p) => p.name.toLowerCase().includes(q)) : candidates;
  const selectedPolicies = candidates.filter((p) => selectedIds.includes(p.id));

  useEffect(() => {
    if (!open) return undefined;
    const inside = (e) => !!wrapRef.current && e.composedPath().includes(wrapRef.current);
    const onPointer = (e) => {
      if (!inside(e)) setOpen(false);
    };
    // Escape from the field closes the list only. Caught in the capture phase at
    // the document: s-modal (and the editor overlay) would otherwise close too.
    const onKey = (e) => {
      if (e.key !== 'Escape' || !inside(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  // Idempotent: sets the option on/off from its checkbox (onChange can fire twice).
  const handleSelect = (id, on) => {
    const has = selectedIds.includes(id);
    if (on === has) return;
    const next = single ? (on ? [id] : []) : on ? [...selectedIds, id] : selectedIds.filter((x) => x !== id);
    onChange(next);
    if (single) {
      setInputValue('');
      setOpen(false);
    }
  };

  return (
    <>
      <div ref={wrapRef}>
        <s-stack gap="small-300">
          <s-search-field
            label={label}
            labelAccessibilityVisibility="exclusive"
            placeholder={placeholder}
            autocomplete="off"
            value={inputValue}
            onFocus={() => setOpen(true)}
            onInput={(e) => {
              setInputValue(e.currentTarget.value);
              setOpen(true);
            }}
          />
          {open && (
            <s-box border="base" borderRadius="base" background="base" overflow="hidden">
              <div role="group" aria-label={label} style={{ maxHeight: 280, overflowY: 'auto' }}>
                {filtered.length > 0 ? (
                  filtered.map((p) => {
                    const on = selectedIds.includes(p.id);
                    return (
                      <s-box key={p.id} paddingInline="small" paddingBlock="small-300">
                        <s-checkbox
                          label={optionLabel(p)}
                          accessibilityLabel={p.name}
                          checked={on}
                          onChange={(e) => handleSelect(p.id, e.currentTarget.checked)}
                        />
                      </s-box>
                    );
                  })
                ) : (
                  <s-box paddingInline="small" paddingBlock="small-200">
                    <s-paragraph color="subdued">{emptyText}</s-paragraph>
                  </s-box>
                )}
              </div>
            </s-box>
          )}
        </s-stack>
      </div>
      {selectedPolicies.length > 0 && (
        <s-stack direction="inline" gap="small-300">
          {selectedPolicies.map((p) => (
            <s-clickable-chip
              key={p.id}
              removable
              accessibilityLabel={p.name}
              onRemove={() => onChange(selectedIds.filter((id) => id !== p.id))}
            >
              {p.name}
            </s-clickable-chip>
          ))}
        </s-stack>
      )}
    </>
  );
}
