import React, { useEffect, useState } from 'react';
import { Select } from '@shopify/polaris';

// Version switcher (ported from the god-file top-bar <select>): Latest is the
// current React app; v1–v4 are the static god-file snapshots under /versions/.
// `app` ('rfq' | 'b2b') picks the right sub-path.
export function VersionSwitcher({ app }) {
  const [versions, setVersions] = useState([]);

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
    if (val === 'latest') {
      window.location.href = app === 'b2b' ? '/b2b' : '/';
    } else if (val === 'changelog') {
      window.location.href = '/versions/';
    } else {
      window.location.href = app === 'b2b' ? `/versions/${val}/b2b/` : `/versions/${val}/`;
    }
  };

  return <Select label="Version" labelHidden options={options} value="latest" onChange={onChange} />;
}
