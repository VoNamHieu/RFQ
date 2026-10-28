import React from 'react';

// One message for every overlap limitOverlaps finds (limits.js), whatever it is: no
// limit, product, value or place is pointed out. `subject`: what covers the buyers
// ("this limit", "it", "its order limits").
export const overlapMessage = (subject = 'this limit') =>
  `Some buyers or products ${subject} covers already have other limits, so they may overlap. Review your other limits to make sure orders go through as you expect.`;

// The message as a paragraph (the save, turn-on and contract dialogs).
export function LimitOverlapMessage({ subject }) {
  return <s-paragraph>{overlapMessage(subject)}</s-paragraph>;
}
