import React, { useEffect, useState } from 'react';
import { Select } from '@shopify/polaris';
import { activeVersion } from './versions.js';

// Version switcher: renders the SAME React app with a different `?v=` so Latest
// and v1–v4 are all Polaris (not the old static snapshots). Changelog still links
// to the static /versions/ index. `app` is kept for signature compatibility.
export function VersionSwitcher({ app }) {
  const [versions, setVersions] = useState([]);
  const current = activeVersion();

  useEffect(() => {
    let alive = true;
    fetch('/versions/manifest.json')
      .then((r) => r.json())
      .then((m) => {
        if (alive) setVersions(m.versions || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const options = [
    { label: 'Version: Latest', value: 'latest' },
    ...versions.map((v) => ({ label: `${v.id} · ${v.date}`, value: v.id })),
    { label: 'Changelog ↗', value: 'changelog' },
  ];

  const onChange = (val) => {
    if (val === 'changelog') {
      window.location.href = '/versions/';
      return;
    }
    const base = window.location.pathname;
    window.location.href = val === 'latest' ? base : `${base}?v=${val}`;
  };

  return <Select label="Version" labelHidden options={options} value={current} onChange={onChange} />;
}
