import React, { useState, useEffect } from 'react';
import {
  Modal,
  Page,
  BlockStack,
  InlineGrid,
  InlineStack,
  TextField,
  Card,
  Text,
  Box,
  Badge,
  Button,
  Select,
  ChoiceList,
  RadioButton,
  Banner,
  Divider,
  Tabs,
} from '@shopify/polaris';
import { XIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { RuleBuilderCard } from './RuleBuilderCard.jsx';
import { VolumeRangesCard } from './VolumeRangesCard.jsx';
import { DefaultPriceCard } from './DefaultPriceCard.jsx';
import { versionFlags } from '../../shared/versions.js';
import { COLLECTIONS } from '../data/constants.js';
import { money } from '../format.js';
import { ActiveDatesCard, ProductScopeCard, VolumeBasisCard, ProductOverridesCard } from './pricingEditorCards.jsx';
import { ProductPriceTable } from './ProductPriceTable.jsx';
import { AssignmentCard } from './AssignmentCard.jsx';
import { policyUsageCount, companyBaseEntries, companyQuantityPolicy, policyPriceBreakdown, scopeLabel, kindOf, ruleTypeLabel, ruleValuesSummary } from '../pricing.js';

// Pricing editor (spec §2.6). Open whenever state.builder is set. Rendered as an
// in-frame page when opened from the Pricing screen (asPage), and as a full-screen
// overlay/modal when opened from a button on any other screen.
export function PricingEditor({ asPage = false }) {
  const { state, dispatch } = useStore();
  const [forkConfirm, setForkConfirm] = useState(false);
  const builder = state.builder;
  // Overlay mode only: lock body scroll and close on Escape while open.
  useEffect(() => {
    if (!builder || asPage) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') dispatch({ type: 'CLOSE_EDITOR' });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [builder, asPage, dispatch]);
  if (!builder) return null;

  const isNew = !builder.id;
  const isQuantity = builder.priceKind === 'quantity';
  const patch = (p) => dispatch({ type: 'BUILDER_PATCH', patch: p });
  // The editor has two tabs, like the god file: Settings (the pricing config) and
  // Appearance (how it shows on the storefront).
  const pricingTab = state.pricingBuilderTab === 'appearance' ? 'appearance' : 'settings';
  const kindWord = isQuantity ? 'quantity pricing' : 'base pricing';

  // Is this an edit of a profile SHARED beyond the company we opened it from?
  const scopeCompany = state.editorContext?.companyId
    ? state.db.companies.find((c) => c.id === state.editorContext.companyId)
    : null;
  // "Who this pricing serves" applies only to the library flow (create/edit from
  // Pricing). Opened from a Company page or the Add-company wizard, the target is
  // already fixed, so the card is hidden there — matching the god file's locked state.
  const showAssignment = !state.editorContext?.companyId && !state.editorContext?.setupKind;
  const usesHere =
    scopeCompany &&
    (companyBaseEntries(scopeCompany, state.db.policies).some((e) => e.policy.id === builder.id) ||
      companyQuantityPolicy(scopeCompany, state.db.policies)?.id === builder.id);
  const sharedCount = !isNew ? policyUsageCount({ id: builder.id }, state.db) - (usesHere ? 1 : 0) : 0;
  const sharedElsewhere = !isNew && scopeCompany && sharedCount > 0;

  const onSave = () => {
    if (sharedElsewhere) setForkConfirm(true);
    else dispatch({ type: 'SAVE_EDITOR' });
  };

  const editorTitle = isNew ? `Create ${isQuantity ? 'quantity' : 'base'} pricing` : `Edit pricing: ${builder.name}`;
  const editorBody = (
    <BlockStack gap="400">
          {sharedElsewhere && (
            <Banner tone="info">
              {`This pricing is also assigned to ${sharedCount} other ${sharedCount === 1 ? 'account' : 'accounts'}. Saving will offer to fork a copy for ${scopeCompany.name} or apply to all.`}
            </Banner>
          )}

          {/* Two tabs, like the god file: Settings (the pricing config) and
              Appearance (how it shows on the storefront). */}
          <Tabs
            tabs={[
              { id: 'settings', content: 'Settings' },
              { id: 'appearance', content: 'Appearance' },
            ]}
            selected={pricingTab === 'appearance' ? 1 : 0}
            onSelect={(i) => dispatch({ type: 'SET_BUILDER_TAB', tab: i === 1 ? 'appearance' : 'settings' })}
          />

          {/* Full-page two-column layout (god-file builder-shell): the config in
              the main column, and Rule status / resolution / summary in the aside. */}
          <InlineGrid columns={{ xs: '1fr', md: '2fr 1fr' }} gap="400" alignItems="start">
            <BlockStack gap="400">
              {pricingTab === 'settings' ? (
                <>
                  {isNew && (
                    // The type is fixed by how the editor was opened (base vs quantity)
                    // — no in-place switch, which is confusing mid-create. Just describe it.
                    <Card>
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">{isQuantity ? 'Quantity pricing' : 'Base pricing'}</Text>
                        <Text as="p" tone="subdued" variant="bodySm">
                          {isQuantity
                            ? 'Volume discounts that kick in above a quantity threshold, on selected products.'
                            : 'A price that covers the whole catalog, with optional rules and per-product overrides.'}
                        </Text>
                      </BlockStack>
                    </Card>
                  )}

                  <Card>
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingSm">Pricing details</Text>
                      <InlineGrid columns={{ xs: 1, sm: '2fr 1fr' }} gap="300">
                        <TextField
                          label="Name"
                          value={builder.name}
                          onChange={(v) => patch({ name: v })}
                          maxLength={255}
                          showCharacterCount
                          autoComplete="off"
                        />
                        <TextField
                          label="Priority (0–99)"
                          type="number"
                          min={0}
                          max={99}
                          value={String(builder.priority ?? '')}
                          onChange={(v) => patch({ priority: Number(v) })}
                          helpText="Lower number applies first. Company/Location and customer/tag precedence isn’t replaced by this."
                          autoComplete="off"
                        />
                      </InlineGrid>
                    </BlockStack>
                  </Card>

                  {showAssignment && <AssignmentCard builder={builder} patch={patch} db={state.db} isNew={isNew} />}

                  {isQuantity ? (
                    <>
                      <VolumeRangesCard />
                      <ProductScopeCard builder={builder} patch={patch} products={state.db.products} />
                      <VolumeBasisCard builder={builder} patch={patch} />
                    </>
                  ) : (
                    <>
                      {/* In the multi-base model, product scope lives in the Pricing rules
                          below (each rule targets all products, or a collection/vendor/tag),
                          so a standalone "Applies to" card just duplicates it. Only the
                          legacy single-base model needs the explicit scope + default price. */}
                      {!versionFlags().multiBase && <ProductScopeCard builder={builder} patch={patch} products={state.db.products} />}
                      {!versionFlags().multiBase && <DefaultPriceCard />}
                      <RuleBuilderCard />
                      <ProductOverridesCard builder={builder} patch={patch} products={state.db.products} />
                    </>
                  )}

                  {/* Scheduling last, matching the god-file editor order. */}
                  <ActiveDatesCard builder={builder} patch={patch} />
                </>
              ) : (
                <AppearanceTab builder={builder} patch={patch} kindWord={kindWord} product={state.db.products[0]} />
              )}
            </BlockStack>

            {/* Aside (god-file builder-side): status, resolution, summary. */}
            <BlockStack gap="400">
              <RuleStatusCard builder={builder} patch={patch} />
              {pricingTab === 'settings' && !isQuantity && <ResolutionCard builder={builder} products={state.db.products} />}
              <SummaryCard builder={builder} isQuantity={isQuantity} />
            </BlockStack>
          </InlineGrid>
    </BlockStack>
  );

  return (
    <>
      {forkConfirm && (
        <Modal
          open
          onClose={() => setForkConfirm(false)}
          title="This pricing is shared"
          primaryAction={{
            content: `Save a copy for ${scopeCompany.name}`,
            onAction: () => {
              setForkConfirm(false);
              dispatch({ type: 'SAVE_EDITOR' }); // default path forks for this company
            },
          }}
          secondaryActions={[
            {
              content: `Apply to all ${sharedCount + 1}`,
              onAction: () => {
                setForkConfirm(false);
                dispatch({ type: 'SAVE_EDITOR', applyToAll: true });
              },
            },
            { content: 'Cancel', onAction: () => setForkConfirm(false) },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              “{builder.name}” is assigned to {sharedCount} other {sharedCount === 1 ? 'account' : 'accounts'}. Saving a copy
              changes the price only for {scopeCompany.name}; the others keep the original. Choose “Apply to all” to change
              it everywhere it’s assigned.
            </Text>
          </Modal.Section>
        </Modal>
      )}
      {asPage ? (
        <Page
          title={editorTitle}
          backAction={{ content: 'Back', onAction: () => dispatch({ type: 'CLOSE_EDITOR' }) }}
          primaryAction={{ content: isNew ? 'Create pricing' : 'Save', onAction: onSave }}
          secondaryActions={[{ content: 'Cancel', onAction: () => dispatch({ type: 'CLOSE_EDITOR' }) }]}
        >
          {editorBody}
        </Page>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editorTitle}
          style={{ position: 'fixed', inset: 0, zIndex: 517, display: 'flex', flexDirection: 'column', background: 'var(--p-color-bg, #f1f1f1)' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              background: 'var(--p-color-bg-surface, #fff)',
              borderBottom: '1px solid var(--p-color-border, #e3e3e3)',
              flex: '0 0 auto',
            }}
          >
            <Text as="h2" variant="headingMd">{editorTitle}</Text>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button onClick={() => dispatch({ type: 'CLOSE_EDITOR' })}>Cancel</Button>
              <Button variant="primary" onClick={onSave}>{isNew ? 'Create pricing' : 'Save'}</Button>
              <Button variant="tertiary" icon={XIcon} accessibilityLabel="Close" onClick={() => dispatch({ type: 'CLOSE_EDITOR' })} />
            </div>
          </div>
          <div style={{ flex: '1 1 auto', overflowY: 'auto' }}>
            <div style={{ maxWidth: 1160, margin: '0 auto', padding: '20px 20px 64px' }}>
              {editorBody}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Rule status (god-file ruleStatusCard), shown in the aside: an on/off toggle.
function RuleStatusCard({ builder, patch }) {
  const on = (builder.status || 'Active') !== 'Inactive';
  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
        <InlineStack gap="200" blockAlign="center">
          <Text as="h3" variant="headingSm">Rule status</Text>
          <Badge tone={on ? 'success' : undefined}>{on ? 'Active' : 'Inactive'}</Badge>
        </InlineStack>
        <Button size="slim" onClick={() => patch({ status: on ? 'Inactive' : 'Active' })}>
          {on ? 'Turn off' : 'Turn on'}
        </Button>
      </InlineStack>
    </Card>
  );
}

// The winning layer for a base profile on one product (god-file priceTierFor).
function tierOf(builder, product) {
  const bd = policyPriceBreakdown(builder, product);
  if (!bd) return null;
  return bd.override != null ? 'override' : bd.rule ? 'rule' : 'default';
}

// "How the price resolves" (god-file resolutionPreview): for ONE illustrative
// in-scope product, Shopify price → default adjustment → matching rule → explicit
// override → what the buyer pays, highlighting the layer that actually wins so a
// merchant reads "most specific wins" without learning the precedence. Base only.
function ResolutionCard({ builder, products }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  // Prefer a product that exercises a product override, then one matched by a
  // rule, then any in-scope product — so the card demonstrates the resolution
  // instead of showing a flat default (god file picks the most-specific example).
  const inScope = products.filter((p) => policyPriceBreakdown(builder, p)?.inScope);
  const product =
    inScope.find((p) => tierOf(builder, p) === 'override') ||
    inScope.find((p) => tierOf(builder, p) === 'rule') ||
    inScope[0] ||
    products[0];
  const bd = product ? policyPriceBreakdown(builder, product) : null;
  if (!bd) return null;
  const tier = bd.override != null ? 'override' : bd.rule ? 'rule' : 'default';
  const rule = bd.rule ? (builder.conditionalRules || [])[bd.rule.index] : null;
  const ruleLabel = rule ? `Rule · ${ruleTypeLabel(rule)} · ${ruleValuesSummary(rule)}` : `Rule ${bd.rule?.index + 1}`;

  // The winning row bleeds into the card padding with a sunken background, like
  // the god file's `margin:0 -8px`; losing rows below the winner dim out.
  const HILITE = { background: 'var(--p-color-bg-surface-secondary, #f6f6f7)', margin: '0 -8px', padding: '6px 8px', borderRadius: 8 };
  const Row = ({ label, value, active, dim, strong }) => (
    <div style={active ? HILITE : undefined}>
      <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
        <Text as="span" variant="bodySm" tone={!active && dim ? 'subdued' : undefined} fontWeight={active ? 'medium' : undefined}>
          {label}
        </Text>
        <Text as="span" variant="bodyMd" tone={active || strong ? undefined : 'subdued'} fontWeight={active || strong ? 'semibold' : undefined}>
          {value}
        </Text>
      </InlineStack>
    </div>
  );

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
          <Text as="h3" variant="headingSm">How the price resolves</Text>
          <Button variant="plain" onClick={() => setPreviewOpen(true)}>Preview all prices</Button>
        </InlineStack>
        <InlineStack gap="150" blockAlign="center" wrap={false}>
          <Text as="span" tone="subdued" variant="bodySm">{product.title}</Text>
          <span style={{ fontFamily: 'var(--p-font-family-mono, monospace)', fontSize: 12, color: 'var(--p-color-text-subdued, #6d7175)' }}>
            {product.sku}
          </span>
        </InlineStack>
        <BlockStack gap="150">
          <Row label="Shopify price" value={money(bd.shopify)} />
          <Row label="Default" value={money(bd.defaultPrice)} active={tier === 'default'} dim={tier !== 'default'} />
          {bd.rule ? <Row label={ruleLabel} value={money(bd.rule.price)} active={tier === 'rule'} dim={tier === 'override'} /> : null}
          {bd.override != null ? <Row label="Product override" value={money(bd.override)} active={tier === 'override'} /> : null}
          <Divider />
          <Row label="Buyer pays" value={money(bd.final)} strong />
        </BlockStack>
      </BlockStack>
      {previewOpen && <BuilderPricePreview builder={builder} products={products} onClose={() => setPreviewOpen(false)} />}
    </Card>
  );
}

// The full table behind "Preview all prices": every product this base pricing
// covers, the layer that decides each price, and what the buyer pays — computed
// from the DRAFT builder, so it reflects unsaved rule/override edits. This is the
// per-rule counterpart to the company-level PriceBoard (which reads saved policies).
const PREVIEW_SORTS = [
  { label: 'Product A–Z', value: 'title-asc' },
  { label: 'Product Z–A', value: 'title-desc' },
  { label: 'Shopify price: low to high', value: 'shopify-asc' },
  { label: 'Shopify price: high to low', value: 'shopify-desc' },
  { label: 'Buyer pays: low to high', value: 'final-asc' },
  { label: 'Buyer pays: high to low', value: 'final-desc' },
  { label: 'Biggest discount', value: 'off-desc' },
];

function BuilderPricePreview({ builder, products, onClose }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('title-asc');
  const inScope = products.filter((p) => policyPriceBreakdown(builder, p)?.inScope);

  const entries = inScope.map((p) => {
    const bd = policyPriceBreakdown(builder, p);
    const layer = bd.override != null ? 'override' : bd.rule ? 'rule' : 'default';
    const rule = bd.rule ? (builder.conditionalRules || [])[bd.rule.index] : null;
    const decidedBy =
      layer === 'override'
        ? 'Product override'
        : layer === 'rule'
          ? `Rule ${bd.rule.index + 1} · ${ruleTypeLabel(rule)}`
          : 'Default';
    const off = bd.shopify > 0 ? Math.round((1 - bd.final / bd.shopify) * 100) : 0;
    return { p, bd, layer, decidedBy, off };
  });

  const q = query.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => e.p.title.toLowerCase().includes(q) || e.p.sku.toLowerCase().includes(q)) : entries;
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'title-desc': return b.p.title.localeCompare(a.p.title);
      case 'shopify-asc': return a.bd.shopify - b.bd.shopify;
      case 'shopify-desc': return b.bd.shopify - a.bd.shopify;
      case 'final-asc': return a.bd.final - b.bd.final;
      case 'final-desc': return b.bd.final - a.bd.final;
      case 'off-desc': return b.off - a.off;
      default: return a.p.title.localeCompare(b.p.title);
    }
  });

  const rows = sorted.map((e) => ({
    key: e.p.sku,
    title: e.p.title,
    subtitle: e.p.sku,
    cells: [
      <Text as="span" tone="subdued">{money(e.bd.shopify)}</Text>,
      <Badge tone={e.layer === 'override' ? 'info' : undefined}>{e.decidedBy}</Badge>,
      <Text as="span" fontWeight="semibold">{money(e.bd.final)}</Text>,
      <Text as="span">{e.off > 0 ? `${e.off}% off` : e.off < 0 ? `${-e.off}% over` : '—'}</Text>,
    ],
  }));

  return (
    <Modal
      open
      onClose={onClose}
      size="large"
      title={`Preview prices · ${builder.name || 'This pricing'}`}
      secondaryActions={[{ content: 'Close', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" tone="subdued" variant="bodySm">
            Every product this pricing covers, with the layer that decides each price. Reflects your unsaved edits.
          </Text>
          <ProductPriceTable
            search={query}
            onSearch={setQuery}
            sort={sort}
            onSort={setSort}
            sortOptions={PREVIEW_SORTS}
            columns={[
              { title: 'Shopify price', width: '96px', align: 'end' },
              { title: 'Decided by', width: '160px', align: 'start' },
              { title: 'Buyer pays', width: '96px', align: 'end' },
              { title: 'Off', width: '72px', align: 'end' },
            ]}
            rows={rows}
            emptyLabel={inScope.length === 0 ? 'This pricing covers no products yet.' : `No products match “${query}”.`}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// Settings summary (god-file asideSummary): an at-a-glance recap.
function SummaryCard({ builder, isQuantity }) {
  const items = [
    ['Type', isQuantity ? 'Quantity pricing' : 'Base pricing'],
    ['Products', scopeLabel(builder)],
    ['Priority', String(builder.priority ?? 0)],
    ['Status', builder.status || 'Active'],
  ];
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">Settings summary</Text>
        <BlockStack gap="150">
          {items.map(([k, v]) => (
            <InlineStack key={k} align="space-between" blockAlign="center">
              <Text as="span" tone="subdued" variant="bodySm">
                {k}
              </Text>
              <Text as="span" variant="bodyMd" fontWeight="medium">
                {v}
              </Text>
            </InlineStack>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

// The Appearance tab (god-file appearanceEditor): how the price shows on the
// storefront, plus a live product preview. Does not affect price calculation.
function AppearanceTab({ builder, patch, kindWord, product }) {
  // Illustrative preview, mirroring the god-file appearanceEditor ($30 → $22.50).
  const list = product?.list ?? 30;
  const now = Math.round(list * 0.75 * 100) / 100;
  const badge = builder.appearanceLabel || 'Special price';
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">Appearance</Text>
        <Text as="p" tone="subdued" variant="bodySm">
          {`How this ${kindWord} is presented on the storefront. It does not change price calculation or assignment.`}
        </Text>
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
          <TextField label="Display title" value={builder.appearanceTitle ?? ''} onChange={(v) => patch({ appearanceTitle: v })} autoComplete="off" />
          <TextField label="Price badge" value={builder.appearanceLabel ?? ''} onChange={(v) => patch({ appearanceLabel: v })} autoComplete="off" />
        </InlineGrid>
        <Box borderWidth="025" borderColor="border" borderRadius="200" padding="300">
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <Box background="bg-surface-secondary" borderRadius="200" minHeight="48px" width="48px">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48 }}>
                <Text as="span" tone="subdued">▣</Text>
              </div>
            </Box>
            <div style={{ flex: 1, minWidth: 0 }}>
              <BlockStack gap="100">
                <Text as="span" variant="bodyMd" fontWeight="medium">{product?.title || 'Cotton T-Shirt'}</Text>
                <Box>
                  <Badge tone="info">{badge}</Badge>
                </Box>
              </BlockStack>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>
                <Text as="span" tone="subdued" variant="bodySm" textDecorationLine="line-through">{money(list)}</Text>
              </div>
              <Text as="span" variant="headingMd">{money(now)}</Text>
            </div>
          </InlineStack>
        </Box>
      </BlockStack>
    </Card>
  );
}

// Status + validity window.
