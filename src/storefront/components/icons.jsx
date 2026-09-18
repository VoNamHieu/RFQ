import React from 'react';

// Minimal inline icon set for the storefront (kept off Polaris — this is the
// customer-facing side). Stroke icons in the Dawn line-weight look.
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const SearchIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><circle cx="11" cy="11" r="7" {...stroke} /><path d="m20 20-3.2-3.2" {...stroke} /></svg>
);
export const AccountIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="8" r="4" {...stroke} /><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" {...stroke} /></svg>
);
export const CartIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><path d="M6 7h13l-1.2 9.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 4H3" {...stroke} /></svg>
);
export const CloseIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><path d="M6 6l12 12M18 6 6 18" {...stroke} /></svg>
);
export const QuoteIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><path d="M7 3h7l4 4v14H7z" {...stroke} /><path d="M14 3v4h4M9.5 12h6M9.5 15.5h6" {...stroke} /></svg>
);
export const InfoIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" {...stroke} /><path d="M12 11v5M12 8h.01" {...stroke} /></svg>
);
export const PinIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><path d="M12 21c4.5-4.2 7-7.5 7-11a7 7 0 1 0-14 0c0 3.5 2.5 6.8 7 11z" {...stroke} /><circle cx="12" cy="10" r="2.4" {...stroke} /></svg>
);
export const MailIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><rect x="3" y="5" width="18" height="14" rx="2" {...stroke} /><path d="m4 7 8 6 8-6" {...stroke} /></svg>
);
export const ChevronRightIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><path d="m9 6 6 6-6 6" {...stroke} /></svg>
);
export const ChevronDownIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><path d="m6 9 6 6 6-6" {...stroke} /></svg>
);
export const CardIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><rect x="3" y="5" width="18" height="14" rx="2" {...stroke} /><path d="M3 10h18" {...stroke} /></svg>
);
export const BoxIcon = (p) => (
  <svg viewBox="0 0 24 24" {...p}><path d="M12 3 4 7v10l8 4 8-4V7z" {...stroke} /><path d="m4 7 8 4 8-4M12 11v10" {...stroke} /></svg>
);
