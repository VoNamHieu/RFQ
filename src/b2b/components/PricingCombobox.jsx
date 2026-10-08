import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

// The pricing picker (production: features/Company/components/PricingProfilePicker,
// a Polaris Combobox + Listbox) shared by the Add / Swap pricing modal and the
// agreement editor: a search field that opens a list of options — with tick
// boxes when several can be picked, a check mark on the picked one when only one
// can — and the picks shown as removable tags under it. Multi-select unless
// `single`. Presentational — the caller owns `selectedIds` and gets `onChange`.
// Options show the pricing name unless `optionLabel` says otherwise.
//
// Like Polaris React's Combobox, the list floats over the content instead of
// pushing it down: it is a native popover (top layer, so a modal can't clip it)
// pinned under the field. In the flow, opening it would grow the modal and make
// it re-center, so everything jumped on each open/pick.
export function PricingCombobox({
  label,
  labelHidden = false,
  placeholder,
  candidates,
  selectedIds,
  onChange,
  single = false,
  optionLabel = (p) => p.name,
  emptyText = 'No matches',
}) {
  const [inputValue, setInputValue] = useState('');
  // The option list shows while the field is in use (like the Combobox popover):
  // opened by focusing or typing, closed by Escape or a click outside.
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const fieldRef = useRef(null);
  const listRef = useRef(null);
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

  // Show the floating list and keep it pinned under the field while it is open
  // (the field moves when the modal resizes or scrolls).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    if (!open) {
      if (list.matches(':popover-open')) list.hidePopover();
      // Production clears the search on blur; here on close, so a click on an
      // option (which blurs the field) doesn't reshuffle the list under it.
      setInputValue('');
      return undefined;
    }
    if (!list.matches(':popover-open')) list.showPopover();
    let raf = 0;
    let last = '';
    const place = () => {
      const field = fieldRef.current;
      if (field) {
        const r = field.getBoundingClientRect();
        const top = r.bottom + 4;
        const maxHeight = Math.max(120, Math.min(240, window.innerHeight - top - 12));
        const key = `${r.left}|${top}|${r.width}|${maxHeight}`;
        if (key !== last) {
          last = key;
          Object.assign(list.style, { left: `${r.left}px`, top: `${top}px`, width: `${r.width}px`, maxHeight: `${maxHeight}px` });
        }
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
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
        <div ref={fieldRef}>
          <s-search-field
            label={label}
            labelAccessibilityVisibility={labelHidden ? 'exclusive' : undefined}
            placeholder={placeholder}
            autocomplete="off"
            value={inputValue}
            onFocus={() => setOpen(true)}
            onInput={(e) => {
              setInputValue(e.currentTarget.value);
              setOpen(true);
            }}
          />
        </div>
        <div ref={listRef} popover="manual" role="group" aria-label={label} className="wc-combobox-list">
          {open &&
            (filtered.length > 0 ? (
              filtered.map((p) => {
                const on = selectedIds.includes(p.id);
                // Single choice (Swap): a plain option with a check mark, no tick box.
                if (single) {
                  return (
                    <s-clickable
                      key={p.id}
                      paddingInline="small"
                      paddingBlock="small-300"
                      accessibilityLabel={p.name}
                      onClick={() => handleSelect(p.id, !on)}
                    >
                      <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
                        <s-text fontWeight={on ? 'semibold' : undefined}>{optionLabel(p)}</s-text>
                        {on ? <s-icon type="check" /> : <span />}
                      </s-grid>
                    </s-clickable>
                  );
                }
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
            ))}
        </div>
      </div>
      {/* The picks as removable tags — only once there are some: a row kept
          empty for them read as a gap under the field. */}
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
