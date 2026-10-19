import React from 'react';

// One message for every overlap limitOverlaps finds (limits.js), whatever it is: no
// limit, product, value or place is pointed out. The rules for which limit applies
// are under "When limits overlap" in the editor. `subject`: what covers the buyers
// ("this limit", "it", "its order limits").
export const overlapMessage = (subject = 'this limit') =>
  `Some buyers or products ${subject} covers already have other limits, so they may overlap. Review your other limits to make sure orders go through as you expect.`;

// The message as a paragraph (the turn-on and contract dialogs).
export function LimitOverlapMessage({ subject }) {
  return <s-paragraph>{overlapMessage(subject)}</s-paragraph>;
}

// The editor's banner: a warning when something found may stop orders, else
// information. Notes, never a block.
export function LimitOverlapBanner({ overlaps }) {
  if (!overlaps.length) return null;
  return (
    <s-banner data-field="limit-overlaps" tone={overlaps.some((o) => o.attention) ? 'warning' : 'info'} heading="Overlaps with other limits">
      <s-paragraph>{overlapMessage()}</s-paragraph>
    </s-banner>
  );
}
