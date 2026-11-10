import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './LocationNames.css';

// A contract's locations as a label (agreementAppliesToLabel, versionScopeLabel):
// "All locations" / "No locations" as they are, or the first names, then "+N" —
// hovering it (or reaching it with the keyboard) lists the locations not named — then
// what follows (" + new locations", and `after`, e.g. " of <company>").
export function LocationNames({ label, after = '' }) {
  if (typeof label === 'string') return `${label}${after}`;
  return (
    <>
      {label.names.join(', ')}
      {label.more.length ? (
        <>
          {' '}
          <MoreLocations names={label.more} />
        </>
      ) : null}
      {`${label.after}${after}`}
    </>
  );
}

// "+N" as a round count, listing `names` one per line while hovered. The list opens in the top layer
// (popover), so it shows over a modal too: under "+N", or above it with no room below.
function MoreLocations({ names }) {
  const anchor = useRef(null);
  const list = useRef(null);
  const timer = useRef(null);
  const pressed = useRef(false); // focus from a click doesn't open it; the keyboard's does
  const [open, setOpen] = useState(false);
  const later = (fn, ms) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    const el = list.current;
    if (!el?.showPopover) return undefined;
    if (!open) {
      if (el.matches(':popover-open')) el.hidePopover();
      return undefined;
    }
    el.showPopover();
    const at = anchor.current.getBoundingClientRect();
    const below = at.bottom + 4 + el.offsetHeight <= window.innerHeight;
    el.style.top = `${below ? at.bottom + 4 : Math.max(8, at.top - 4 - el.offsetHeight)}px`;
    el.style.left = `${Math.max(8, Math.min(at.left, window.innerWidth - el.offsetWidth - 8))}px`;
    const close = () => setOpen(false);
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <span
        ref={anchor}
        className="qs-more-locations"
        tabIndex={0}
        aria-label={`${names.length} more: ${names.join(', ')}`}
        onMouseEnter={() => later(() => setOpen(true), 150)}
        onMouseLeave={() => later(() => setOpen(false), 100)}
        onPointerDown={() => {
          pressed.current = true;
        }}
        onFocus={() => {
          if (!pressed.current) setOpen(true);
          pressed.current = false;
        }}
        onBlur={() => setOpen(false)}
      >
        {`+${names.length}`}
      </span>
      <div ref={list} popover="manual" className="qs-more-locations__list" aria-hidden="true">
        {names.map((n, i) => (
          <div key={i}>{n}</div>
        ))}
      </div>
    </>
  );
}
