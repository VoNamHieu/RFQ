import React, { useState } from 'react';

// Strips closed with the X stay hidden across screens until the page reloads.
const dismissed = new Set();

// The grey "Dev" strip that holds prototype-only toggles, with an X to close it and
// see the screen without it. `id` keys the dismissal; `spaced` adds the bottom gap
// for strips that sit straight above a section (not inside a gap stack).
export function DevStrip({ id, spaced, children }) {
  const [hidden, setHidden] = useState(() => dismissed.has(id));
  if (hidden) return null;
  const close = () => {
    dismissed.add(id);
    setHidden(true);
  };
  const strip = (
    <s-box background="subdued" border="base" borderRadius="base" padding="small-200">
      <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="start">
        <div>{children}</div>
        <s-button variant="tertiary" icon="x" accessibilityLabel="Close dev tools" onClick={close} />
      </s-grid>
    </s-box>
  );
  return spaced ? <s-box paddingBlockEnd="base">{strip}</s-box> : strip;
}
