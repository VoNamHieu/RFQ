import React, { useState } from 'react';
import { Modal, useWcId } from '../../shared/wc.jsx';
import { money, marginPct, estimatedCost } from '../utils.js';
import { RFQ_CATALOG, RFQ_PRICING_OPTIONS } from '../data/catalog.js';
import { versionFlags } from '../../shared/versions.js';

const catBySku = (sku) => RFQ_CATALOG.find((p) => p.sku === sku);

// "Save quoted prices to B2B" (spec §5.5): read-only Quoted (carried over from
// the quote) shown next to an editable Base price (what's written to B2B,
// defaulting to the quote) plus Cost/Margin, a destination base, and the
// block-if-above-Shopify / warn-if-below-cost logic.
export function SaveToB2B({ quote, onClose, onDone }) {
  const tipId = useWcId('save-b2b-tip');
  const companyKey = quote.linkedCompanyKey || quote.fixedCompanyKey || quote.recommendedKey;
  const bases = RFQ_PRICING_OPTIONS[companyKey] || [];

  const sourceLines =
    quote.lines && quote.lines.length
      ? quote.lines
      : [{ sku: quote.product?.sku, title: quote.product?.name, price: quote.product?.price, qty: quote.product?.quantity }];

  const [rows, setRows] = useState(
    sourceLines.map((l) => {
      const cat = catBySku(l.sku);
      const quoted = Number(l.price) || 0;
      return {
        sku: l.sku,
        title: l.title || cat?.title || l.sku,
        shopify: cat?.list ?? quoted,
        cost: estimatedCost(quoted),
        quoted,
        base: quoted, // what's written to B2B — defaults to the quoted price, editable
      };
    }),
  );
  const [dest, setDest] = useState(bases[0]?.id || '__new__');
  const [phase, setPhase] = useState('edit');
  // Fields for the "Create a new base pricing" destination (god-file parity).
  const [newName, setNewName] = useState(`Quote ${quote.number} prices`);
  const [newPriority, setNewPriority] = useState(1);
  const [newStatus, setNewStatus] = useState('Active');

  // Quoted is the read-only reference agreed on the RFQ side; Base price defaults
  // to it but stays editable so the merchant can tweak what's written into the
  // B2B base pricing. Margin / warnings track the (editable) base price.
  const anyOver = rows.some((r) => r.base > r.shopify);
  const anyBelowCost = rows.some((r) => r.base < r.cost);

  const setBase = (i, v) => setRows(rows.map((r, k) => (k === i ? { ...r, base: Number(v) } : r)));

  // "Create a new base pricing" is the first option (not buried at the bottom),
  // matching the B2B build-pricing modal.
  const destOptions = [
    { label: 'Create a new base pricing…', value: '__new__' },
    ...bases.map((b) => ({ label: `${b.name} (priority ${b.priority})`, value: b.id })),
  ];

  if (phase === 'done') {
    return (
      <Modal onClose={onClose} heading="Saved to B2B">
        <s-stack gap="small-200" alignItems="center">
          <s-badge tone="success">Done</s-badge>
          <div style={{ textAlign: 'center' }}>
            <s-text>
              These prices were added to {dest === '__new__' ? 'a new base pricing' : bases.find((b) => b.id === dest)?.name} for the company. Buyers now reorder at the agreed price.
            </s-text>
          </div>
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() =>
            onDone({
              dest,
              lines: rows.map((r) => ({ sku: r.sku, quoted: r.base })),
              newName,
              newPriority,
              status: newStatus,
            })
          }
        >
          Open in B2B app
        </s-button>
        <s-button slot="secondary-actions" onClick={onClose}>
          Close
        </s-button>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} heading="Save quoted prices to B2B" size="large">
      <s-stack gap="small">
        <s-paragraph color="subdued" fontSize="small">
          {versionFlags().crossSyncScope === 'location'
            ? 'Applies to the location this quote came from — other locations keep their current pricing.'
            : 'Saves onto a company base pricing — every location using that base gets these prices right away.'}
        </s-paragraph>

        {anyOver && <s-banner tone="critical">B2B pricing can’t be higher than the Shopify price — lower them first.</s-banner>}
        {!anyOver && anyBelowCost && <s-banner tone="warning">Some prices are below cost — you’d sell at a loss.</s-banner>}

        <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--p-color-border)', borderRadius: 'var(--p-border-radius-200)' }}>
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header listSlot="labeled" format="currency">Shopify</s-table-header>
              <s-table-header listSlot="labeled" format="currency">Cost</s-table-header>
              <s-table-header listSlot="labeled" format="currency">Quoted</s-table-header>
              <s-table-header listSlot="labeled">
                <s-text interestFor={tipId}>
                  <span style={{ borderBottom: '1px dotted var(--p-color-border)', cursor: 'help' }}>Price to save</span>
                </s-text>
                <s-tooltip id={tipId}>Saved as this product’s B2B base price. Defaults to the quoted price — edit if needed.</s-tooltip>
              </s-table-header>
              <s-table-header listSlot="labeled">Margin</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((r, i) => {
                const m = marginPct(r.base, r.cost);
                const belowCost = r.base < r.cost;
                const over = r.base > r.shopify;
                return (
                  <s-table-row key={i}>
                    <s-table-cell>
                      <s-stack gap="small-500">
                        <s-text fontWeight="medium">{r.title}</s-text>
                        {r.sku ? (
                          <s-text color="subdued" fontSize="small">
                            {r.sku}
                          </s-text>
                        ) : null}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>{money(r.shopify)}</s-table-cell>
                    <s-table-cell>{money(r.cost)}</s-table-cell>
                    <s-table-cell>
                      <s-text fontWeight="semibold">{money(r.quoted)}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <div style={{ width: 110 }}>
                        <s-number-field
                          label="Price to save"
                          labelAccessibilityVisibility="exclusive"
                          min={0}
                          prefix="$"
                          value={String(r.base)}
                          onInput={(e) => setBase(i, e.currentTarget.value)}
                          error={over ? 'Too high' : undefined}
                          autocomplete="off"
                        />
                      </div>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text tone={belowCost ? 'critical' : undefined}>{`${m}%${belowCost ? ' · below cost' : ''}`}</s-text>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        </div>

        <s-divider />

        <s-select
          label={versionFlags().crossSyncScope === 'location' ? 'Add to this company’s pricing' : 'Add to base pricing'}
          value={dest}
          onChange={(e) => setDest(e.currentTarget.value)}
        >
          {destOptions.map((o) => (
            <s-option key={o.value} value={o.value}>
              {o.label}
            </s-option>
          ))}
        </s-select>

        {dest === '__new__' && (
          <s-box border="base" borderRadius="base" padding="small">
            <s-stack gap="small">
              <s-heading>New pricing</s-heading>
              <s-query-container>
                <s-grid gridTemplateColumns="@container (inline-size > 480px) 1fr 1fr 1fr, 1fr" gap="small">
                  <s-text-field label="Pricing name" value={newName} onInput={(e) => setNewName(e.currentTarget.value)} autocomplete="off" />
                  <s-number-field
                    label="Priority (0–99)"
                    min={0}
                    max={99}
                    inputMode="numeric"
                    value={String(newPriority)}
                    onInput={(e) => setNewPriority(Math.max(0, Math.min(99, Math.round(Number(e.currentTarget.value) || 0))))}
                    autocomplete="off"
                  />
                  <s-select label="Status" value={newStatus} onChange={(e) => setNewStatus(e.currentTarget.value)}>
                    <s-option value="Active">Active</s-option>
                    <s-option value="Inactive">Inactive (turned off)</s-option>
                  </s-select>
                </s-grid>
              </s-query-container>
              <s-paragraph color="subdued" fontSize="small">
                Only the quoted products are added. Products without a price continue to the next pricing by priority.
              </s-paragraph>
            </s-stack>
          </s-box>
        )}
      </s-stack>
      <s-button slot="primary-action" variant="primary" disabled={anyOver} onClick={() => setPhase('done')}>
        {dest === '__new__' ? 'Create & assign' : 'Add prices'}
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}
