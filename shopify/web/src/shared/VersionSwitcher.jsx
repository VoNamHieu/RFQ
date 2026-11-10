import React from 'react';
import { activeVersion, DEFAULT_VERSION, VERSION_LABEL } from './versions.js';

// Version switcher: renders the SAME React app with a different `?v=` — Current
// (the default, no ?v=) or Upcoming. Changelog links to the static /versions/
// page. `app` is kept for signature compatibility.
export function VersionSwitcher({ app }) {
  const current = activeVersion();

  const options = [
    ...Object.entries(VERSION_LABEL).map(([value, name]) => ({ label: `Version: ${name}`, value })),
    { label: 'Changelog ↗', value: 'changelog' },
  ];

  const onChange = (val) => {
    if (val === 'changelog') {
      window.location.href = '/versions/';
      return;
    }
    const base = window.location.pathname;
    window.location.href = val === DEFAULT_VERSION ? base : `${base}?v=${val}`;
  };

  return (
    <s-select
      label="Version"
      labelAccessibilityVisibility="exclusive"
      value={current}
      onChange={(e) => {
        const val = e.currentTarget.value;
        if (val !== current) onChange(val);
      }}
    >
      {options.map((o) => (
        <s-option key={o.value} value={o.value}>
          {o.label}
        </s-option>
      ))}
    </s-select>
  );
}
