// Version-aware feature flags. The version switcher renders the SAME React app
// with a different `?v=`, toggling features — instead of separate builds:
//   - current:  the prototype without Order limits and Agreements. The default
//               (no ?v=), and the only version on this branch.
// Upcoming (Order limits and Agreements on) lives on the `upcoming` branch; until it
// ships, `?v=upcoming` falls back to Current here.
// Screens read features, not versions:
//   - analytics:      app-level Analytics + company Analytics tab
//   - priceCrossSync: RFQ "Save prices to B2B" + B2B "Turn into pricing" /
//                     "Build pricing from closed quotes"
//   - multiBase:      multiple base pricings per company w/ priority (off = the
//                     old single-base + "Default price" 3-tier model)
//   - locationPricing:per-location pricing override
//   - orderLimits:    Order limits screen, location Order limits card, held-order
//                     review, storefront limits (Upcoming only)
//   - agreements:     Agreements screen, company Agreement tab, storefront
//                     Agreement card (Upcoming only)
// crossSyncScope: RFQ "Save quoted prices to B2B" applies at the location the
// quote came from ('location') or the whole company ('company').
export const DEFAULT_VERSION = 'current';

export const VERSION_FLAGS = {
  current: { analytics: true, priceCrossSync: true, multiBase: true, locationPricing: true, crossSyncScope: 'location', orderLimits: false, agreements: false },
};

export function activeVersion() {
  try {
    const v = new URLSearchParams(window.location.search).get('v');
    return VERSION_FLAGS[v] ? v : DEFAULT_VERSION;
  } catch {
    return DEFAULT_VERSION;
  }
}

export function versionFlags() {
  return VERSION_FLAGS[activeVersion()];
}

// A path in another app of the prototype, keeping the version (the default needs no ?v=).
export function withVersion(path) {
  const v = activeVersion();
  return v === DEFAULT_VERSION ? path : `${path}?v=${v}`;
}

export const VERSION_LABEL = {
  current: 'Current',
};
