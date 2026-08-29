// Version-aware feature flags. The version switcher renders the SAME React app
// with a different `?v=` (v1..v4 or latest), toggling features — instead of 4
// separate builds. Flags derived from /versions/manifest.json notes:
//   - analytics:      app-level Analytics + company Analytics tab (added in Latest)
//   - priceCrossSync: RFQ "Save prices to B2B" + B2B "Turn into pricing" /
//                     "Build pricing from closed quotes" (removed in v2)
//   - multiBase:      multiple base pricings per company w/ priority (v2+); v1 is
//                     the old single-base + "Default price" 3-tier model
//   - locationPricing:per-location pricing override (v1 only; inherited elsewhere)
export const VERSION_FLAGS = {
  latest: { analytics: true, priceCrossSync: true, multiBase: true, locationPricing: false },
  v4: { analytics: true, priceCrossSync: true, multiBase: true, locationPricing: false },
  v3: { analytics: false, priceCrossSync: true, multiBase: true, locationPricing: false },
  v2: { analytics: false, priceCrossSync: false, multiBase: true, locationPricing: false },
  v1: { analytics: false, priceCrossSync: false, multiBase: false, locationPricing: true },
};

export function activeVersion() {
  try {
    const v = new URLSearchParams(window.location.search).get('v');
    return VERSION_FLAGS[v] ? v : 'latest';
  } catch {
    return 'latest';
  }
}

export function versionFlags() {
  return VERSION_FLAGS[activeVersion()];
}

export const VERSION_LABEL = {
  latest: 'Latest',
  v1: 'v1',
  v2: 'v2',
  v3: 'v3',
  v4: 'v4',
};
