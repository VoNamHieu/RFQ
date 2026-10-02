import React, { useState } from 'react';
import { Select } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { resolveDetail, hasOwnSlot } from '../pricing.js';
import { PriceWhyContent } from './PricePreviewModal.jsx';
import { PricePreviewDialog } from './PricePreviewDialog.jsx';

// The company page's "Preview prices" (spec §2.7): what a buyer pays for every
// product and which pricing layer decided it, in the shared preview modal (same one
// as the pricing editor's "Preview all prices"). Prices are per location: with 2+
// locations a Location picker sits next to sort; each row drills into "Why this price".
export function PriceBoard() {
  const { state, dispatch } = useStore();
  const [locationId, setLocationId] = useState(null);
  const pb = state.priceBoard;
  if (!pb) return null;
  const company = state.db.companies.find((c) => c.id === pb.companyId);
  const policies = state.db.policies;

  // `differs` — some location keeps its own pricing, so prices can differ by location.
  const locations = company?.locations || [];
  const pickLocation = locations.length > 1;
  const differs = pickLocation && locations.some((l) => hasOwnSlot(l, 'base') || hasOwnSlot(l, 'quantity'));
  const location = locations.find((l) => l.id === locationId) || locations[0] || null;

  const entries = state.db.products.map((p) => {
    const d = resolveDetail(company, p, policies, undefined, location);
    // Priority of the pricing that decided it (none when the Shopify price stands).
    return { product: p, shopify: p.list, final: d.price, decidedBy: d.decidedBy, priority: d.policy ? d.policy.priority ?? 0 : null, highlight: d.layer === 'override' };
  });

  return (
    <PricePreviewDialog
      title={`Preview prices · ${company?.name || ''}`}
      description={
        pickLocation
          ? `What a buyer at ${location?.name} pays for each product, and which pricing layer decided it.${
              differs ? '' : ' Every location uses the company pricing, so prices are the same.'
            }`
          : 'What a buyer at this company pays for each product, and which pricing layer decided it.'
      }
      entries={entries}
      emptyLabel="No products yet."
      toolbar={
        pickLocation ? (
          <div style={{ width: 220, flex: '0 0 auto' }}>
            <Select
              label="Location"
              labelInline
              options={locations.map((l) => ({ label: l.name, value: l.id }))}
              value={location?.id || ''}
              onChange={setLocationId}
            />
          </div>
        ) : null
      }
      renderWhy={(product) => <PriceWhyContent key={product.sku} company={company} location={location} policies={policies} product={product} />}
      onClose={() => dispatch({ type: 'CLOSE_PRICE_BOARD' })}
    />
  );
}
