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
  Checkbox,
  Tooltip,
  Icon,
} from '@shopify/polaris';
import { XIcon, InfoIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { RuleBuilderCard } from './RuleBuilderCard.jsx';
import { VolumeRangesCard } from './VolumeRangesCard.jsx';
import { DefaultPriceCard } from './DefaultPriceCard.jsx';
import { LocationScopePicker } from './LocationScopePicker.jsx';
import { versionFlags } from '../../shared/versions.js';
import { COLLECTIONS } from '../data/constants.js';
import { money } from '../format.js';
import { ActiveDatesCard, ProductScopeCard, VolumeBasisCard, ProductOverridesCard } from './pricingEditorCards.jsx';
import { PricePreviewDialog } from './PricePreviewDialog.jsx';
import { AssignmentCard } from './AssignmentCard.jsx';
import { policyUsageCount, policyUsageDetail, companyBaseEntries, companyQuantityEntries, slotIds, KIND_ORDER, policyPriceBreakdown, scopeLabel, kindOf, ruleTypeLabel, ruleValuesSummary, locationCatalog } from '../pricing.js';

// Pricing editor (spec §2.6). Open whenever state.builder is set. Rendered as an
// in-frame page when opened from the Pricing screen (asPage), and as a full-screen
// overlay/modal when opened from a button on any other screen.
export function PricingEditor({ asPage = false }) {
  const { state, dispatch } = useStore();
  const [forkConfirm, setForkConfirm] = useState(false);
  // Save-time confirmation when the pricing switched Company-based B2B ↔ D2C Wholesale.
  const [sideConfirm, setSideConfirm] = useState(false);
  // Save dialog for a shared pricing: a separate copy for here, unless ticked to apply to all.
  const [applyAll, setApplyAll] = useState(false);
  // Preview by location, from the several-locations note under "Who this pricing serves".
  const [catalogPreview, setCatalogPreview] = useState(false);
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
  // Pricing). Opened from a Company or Location page, the target is
  // already fixed, so the card is hidden there — matching the god file's locked state.
  const showAssignment = !state.editorContext?.companyId;
  // From a Location page, "here" is that location's own list.
  const scopeLoc =
    scopeCompany && state.editorContext?.locationId
      ? (scopeCompany.locations || []).find((l) => l.id === state.editorContext.locationId)
      : null;
  const scopeName = (scopeLoc || scopeCompany)?.name;
  const usesHere = scopeLoc
    ? KIND_ORDER.some((k) => slotIds(scopeLoc, k).includes(builder.id))
    : scopeCompany &&
      (companyBaseEntries(scopeCompany, state.db.policies).some((e) => e.policy.id === builder.id) ||
        companyQuantityEntries(scopeCompany, state.db.policies).some((e) => e.policy.id === builder.id));
  const sharedCount = !isNew ? policyUsageCount({ id: builder.id }, state.db) - (usesHere ? 1 : 0) : 0;
  const sharedElsewhere = !isNew && scopeCompany && sharedCount > 0;
  // Save dialog wording: what else holds it (companies / locations / other), and
  // what "apply to all" covers — "here" is a location or a company.
  const usage = !isNew ? policyUsageDetail({ id: builder.id }, state.db) : null;
  const others = usage
    ? {
        companies: usage.companies - (usesHere && !scopeLoc ? 1 : 0),
        locations: usage.locations - (usesHere && scopeLoc ? 1 : 0),
        rest: usage.tags + usage.customers + usage.globals.length,
      }
    : { companies: 0, locations: 0, rest: 0 };
  // e.g. "2 other companies", "1 other company and 2 locations".
  const countOf = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const sharedWith = [
    others.companies ? countOf(others.companies, 'company', 'companies') : null,
    others.locations ? countOf(others.locations, 'location', 'locations') : null,
    others.rest ? countOf(others.rest, 'other assignment', 'other assignments') : null,
  ]
    .filter(Boolean)
    .map((t, i) => (i === 0 && !t.includes('other') ? t.replace(' ', ' other ') : t))
    .join(' and ');
  const hasCompanies = !scopeLoc || others.companies > 0;
  const hasLocations = !!scopeLoc || others.locations > 0;
  const allNoun = others.rest
    ? null
    : hasCompanies && hasLocations
      ? 'companies and locations'
      : hasLocations
        ? 'locations'
        : 'companies';

  // Creating from a company page (2+ locations): which of its locations get it —
  // all (null) or the picked ones (editorContext.locationIds, seeded from Assign).
  const showCompanyLocations = isNew && !!scopeCompany && !scopeLoc && (scopeCompany.locations || []).length > 1;
  const scopeLocationIds = showCompanyLocations ? state.editorContext?.locationIds ?? null : null;
  const noLocationPicked = Array.isArray(scopeLocationIds) && scopeLocationIds.length === 0;

  // Every location this pricing reaches: the picks in "Who this pricing serves"
  // (library), or the company / location it was opened from. Overrides can be
  // viewed by these locations.
  const reach = builder.audienceType === 'd2c'
    ? []
    : showAssignment
      ? state.db.companies.flatMap((c) =>
          (c.locations || [])
            .filter((l) => (builder.b2bCompanyIds || []).includes(c.id) || (builder.b2bLocationKeys || []).includes(`${c.id}::${l.id}`))
            .map((l) => ({ company: c, location: l })))
      : scopeLoc
        ? [{ company: scopeCompany, location: scopeLoc }]
        : scopeCompany
          ? (scopeCompany.locations || []).filter((l) => !scopeLocationIds || scopeLocationIds.includes(l.id)).map((l) => ({ company: scopeCompany, location: l }))
          : [];
  // Picked in "Who this pricing serves" and more than one: catalogs can differ, so
  // a note says how that plays out and offers a by-location preview.
  const targets = !isQuantity && (showAssignment || showCompanyLocations) ? reach : [];
  const catalogNote = targets.length > 1 ? <MultiCatalogNote onPreview={() => setCatalogPreview(true)} /> : null;

  // Switched Company-based B2B ↔ D2C Wholesale on a pricing that's assigned on its
  // saved side: saving clears that side, so confirm first ("Change who this pricing serves?").
  const savedPolicy = !isNew ? state.db.policies.find((p) => p.id === builder.id) || null : null;
  const savedSide = savedPolicy ? (savedPolicy.audienceType === 'd2c' ? 'd2c' : 'b2b') : null;
  const sideChanged = !!savedPolicy && savedSide !== (builder.audienceType === 'd2c' ? 'd2c' : 'b2b');
  const savedUsage = savedPolicy ? policyUsageDetail(savedPolicy, state.db) : null;
  const companiesAssigned = savedPolicy
    ? state.db.companies.filter((c) => [c, ...(c.locations || [])].some((h) => KIND_ORDER.some((k) => slotIds(h, k).includes(savedPolicy.id)))).length
    : 0;
  const hadAssignments = !savedUsage
    ? false
    : savedSide === 'b2b'
      ? companiesAssigned > 0 || savedUsage.globals.includes('All Companies')
      : savedUsage.customers + savedUsage.tags > 0 || savedUsage.globals.includes('All customers');

  const onSave = () => {
    if (noLocationPicked) return;
    if (sideChanged && hadAssignments) {
      setSideConfirm(true);
      return;
    }
    if (sharedElsewhere) {
      setApplyAll(false);
      setForkConfirm(true);
    }
    else dispatch({ type: 'SAVE_EDITOR' });
  };

  const editorTitle = isNew ? `Create ${isQuantity ? 'quantity' : 'base'} pricing` : `Edit pricing: ${builder.name}`;
  const editorBody = (
    <BlockStack gap="400">
          {sharedElsewhere && (
            <Banner tone="info">
              {`This pricing is also assigned to ${sharedWith}. Saving will offer to fork a copy for ${scopeName} or apply to all.`}
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
                      <InlineStack gap="100" blockAlign="center">
                        <Text as="h3" variant="headingSm">Pricing details</Text>
                        <Tooltip content="Priority orders pricing within a company or location. Company/Location and customer/tag precedence isn’t replaced by it.">
                          <span style={{ display: 'inline-flex' }}>
                            <Icon source={InfoIcon} tone="subdued" accessibilityLabel="About pricing details" />
                          </span>
                        </Tooltip>
                      </InlineStack>
                      <TextField
                        label="Name"
                        requiredIndicator
                        value={builder.name}
                        onChange={(v) => patch({ name: v })}
                        maxLength={255}
                        showCharacterCount
                        autoComplete="off"
                      />
                      <TextField
                        label="Priority (0-99)"
                        type="number"
                        min={0}
                        max={99}
                        value={String(builder.priority ?? '')}
                        onChange={(v) => patch({ priority: Number(v) })}
                        helpText="Lower number applies first."
                        autoComplete="off"
                      />
                    </BlockStack>
                  </Card>

                  {showAssignment && <AssignmentCard builder={builder} patch={patch} db={state.db} isNew={isNew} footer={catalogNote} />}
                  {/* Who it serves comes before how it prices, in both flows. */}
                  {showCompanyLocations && (
                    <CompanyLocationsCard
                      company={scopeCompany}
                      locationIds={scopeLocationIds}
                      onChange={(ids) => dispatch({ type: 'EDITOR_CONTEXT_PATCH', patch: { locationIds: ids } })}
                      footer={catalogNote}
                    />
                  )}

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
                      <ProductOverridesCard builder={builder} patch={patch} products={state.db.products} locations={reach} />
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
      {sideConfirm && (
        <Modal
          open
          onClose={() => setSideConfirm(false)}
          title="Change who this pricing serves?"
          primaryAction={{
            content: 'Save changes',
            onAction: () => {
              setSideConfirm(false);
              dispatch({ type: 'SAVE_EDITOR' });
            },
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setSideConfirm(false) }]}
        >
          <Modal.Section>
            {savedSide === 'b2b' ? (
              <Text as="p">
                {'This pricing is set up for '}
                <Text as="span" fontWeight="semibold">Company-based B2B</Text>
                {companiesAssigned
                  ? `, with ${companiesAssigned} compan${companiesAssigned === 1 ? 'y' : 'ies'} assigned. Switching to `
                  : ', as the default for all companies. Switching to '}
                <Text as="span" fontWeight="semibold">D2C Wholesale</Text>
                {` clears that assignment. ${companiesAssigned === 1 ? 'That company falls' : 'Those companies fall'} back to your Shopify prices until another pricing is assigned.`}
              </Text>
            ) : (
              <Text as="p">
                {'This pricing is set up for '}
                <Text as="span" fontWeight="semibold">D2C Wholesale</Text>
                {', with the customers and customer tags it targets. Switching to '}
                <Text as="span" fontWeight="semibold">Company-based B2B</Text>
                {' clears that selection. Only the companies you picked receive it.'}
              </Text>
            )}
          </Modal.Section>
        </Modal>
      )}
      {forkConfirm && (
        <Modal
          open
          onClose={() => setForkConfirm(false)}
          title={`Save changes to ${builder.name}`}
          primaryAction={{
            content: 'Save',
            onAction: () => {
              setForkConfirm(false);
              // Unticked: a separate copy for here (the default path forks).
              dispatch({ type: 'SAVE_EDITOR', applyToAll: applyAll });
            },
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setForkConfirm(false) }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p">
                {`${builder.name} is shared with ${sharedWith}. Save as a separate pricing for `}
                <Text as="span" fontWeight="semibold">{scopeName}</Text>
                {` — the others keep ${builder.name}.`}
              </Text>
              <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                <Checkbox
                  label={allNoun ? `Apply to all ${sharedCount + 1} ${allNoun} instead` : `Apply everywhere it’s used instead (${sharedCount + 1})`}
                  helpText={
                    allNoun
                      ? `Overwrites this pricing for every ${allNoun === 'companies' ? 'company' : allNoun === 'locations' ? 'location' : 'company and location'} using it.`
                      : 'Overwrites this pricing everywhere it’s used.'
                  }
                  checked={applyAll}
                  onChange={setApplyAll}
                />
              </Box>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
      {catalogPreview && targets.length > 1 && (
        <CatalogPricePreview builder={builder} products={state.db.products} targets={targets} onClose={() => setCatalogPreview(false)} />
      )}
      {asPage ? (
        <Page
          title={editorTitle}
          backAction={{ content: 'Back', onAction: () => dispatch({ type: 'CLOSE_EDITOR' }) }}
          primaryAction={{ content: isNew ? 'Create pricing' : 'Save', onAction: onSave, disabled: noLocationPicked }}
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
              <Button variant="primary" onClick={onSave} disabled={noLocationPicked}>{isNew ? 'Create pricing' : 'Save'}</Button>
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

// "Preview all prices": every product this base pricing covers, the layer that
// decides each price, and what the buyer pays — computed from the DRAFT builder, so
// it reflects unsaved rule/override edits. Same modal as the company page's Preview
// prices (PricePreviewDialog), which reads the saved pricing instead.
function BuilderPricePreview({ builder, products, onClose }) {
  const entries = products
    .map((p) => ({ p, bd: policyPriceBreakdown(builder, p) }))
    .filter(({ bd }) => bd?.inScope)
    .map(({ p, bd }) => {
      const layer = bd.override != null ? 'override' : bd.rule ? 'rule' : 'default';
      const rule = bd.rule ? (builder.conditionalRules || [])[bd.rule.index] : null;
      const decidedBy =
        layer === 'override' ? 'Product override' : layer === 'rule' ? `Rule ${bd.rule.index + 1} · ${ruleTypeLabel(rule)}` : 'Default';
      return { product: p, shopify: bd.shopify, final: bd.final, decidedBy, highlight: layer === 'override' };
    });
  return (
    <PricePreviewDialog
      title={`Preview prices · ${builder.name || 'This pricing'}`}
      description="Every product this pricing covers, with the layer that decides each price. Reflects your unsaved edits."
      entries={entries}
      emptyLabel="This pricing covers no products yet."
      onClose={onClose}
    />
  );
}

// Shown under "Who this pricing serves" when a base pricing reaches several
// locations: each can have its own catalog, and the pricing only reaches the
// products in it. Preview checks one location at a time.
function MultiCatalogNote({ onPreview }) {
  return (
    <Banner tone="info" action={{ content: 'Preview by location', onAction: onPreview }}>
      <Text as="p">
        Multiple locations can have different catalogs. This base pricing is applied per catalog, so selected products that aren’t in a location’s catalog won’t get the price you set up.
      </Text>
    </Banner>
  );
}

// What this base pricing (unsaved edits included) gives at one of the locations
// it reaches, picked from the toolbar. Products outside that location's catalog
// don't get it — they show "—".
function CatalogPricePreview({ builder, products, targets, onClose }) {
  const keyOf = (t) => `${t.company.id}::${t.location.id}`;
  const [key, setKey] = useState(keyOf(targets[0]));
  const target = targets.find((t) => keyOf(t) === key) || targets[0];
  const catalog = locationCatalog(target.location, products);
  const severalCompanies = new Set(targets.map((t) => t.company.id)).size > 1;
  const entries = products
    .map((p) => ({ p, bd: policyPriceBreakdown(builder, p) }))
    .filter(({ bd }) => bd?.inScope)
    .map(({ p, bd }) =>
      catalog.skus.includes(p.sku)
        ? { product: p, shopify: bd.shopify, final: bd.final, decidedBy: 'This pricing' }
        : { product: p, shopify: bd.shopify, final: null, decidedBy: 'Not in catalog', highlight: true });
  const outside = entries.filter((e) => e.final == null).length;
  return (
    <PricePreviewDialog
      title={`Preview prices · ${builder.name || 'This pricing'}`}
      description={`${target.location.name}${severalCompanies ? ` (${target.company.name})` : ''} uses the ${catalog.name} catalog. ${
        outside
          ? `${outside} of the products this pricing covers ${outside === 1 ? 'isn’t' : 'aren’t'} in it, so ${outside === 1 ? 'it doesn’t' : 'they don’t'} get this price there.`
          : 'Every product this pricing covers is in it.'
      }`}
      entries={entries}
      emptyLabel="This pricing covers no products yet."
      toolbar={
        <div style={{ width: 340, flex: '0 0 auto' }}>
          <Select
            label="Location"
            labelInline
            options={targets.map((t) => ({ label: severalCompanies ? `${t.location.name} · ${t.company.name}` : t.location.name, value: keyOf(t) }))}
            value={key}
            onChange={setKey}
          />
        </div>
      }
      onClose={onClose}
    />
  );
}

// Settings summary (god-file asideSummary): an at-a-glance recap.
// "Who this pricing serves" when creating from a company page: which of the
// company's locations get it (see LocationScopePicker).
function CompanyLocationsCard({ company, locationIds, onChange, footer = null }) {
  return (
    <Card>
      <BlockStack gap="300">
        <BlockStack gap="100">
          <Text as="h3" variant="headingSm">Who this pricing serves</Text>
          <Text as="p" tone="subdued" variant="bodySm">
            {'Choose which of '}
            <Text as="span" variant="bodySm" fontWeight="semibold">{company.name}</Text>
            {'’s locations get this pricing.'}
          </Text>
        </BlockStack>
        <LocationScopePicker company={company} locationIds={locationIds} onChange={onChange} titleHidden />
        {footer}
      </BlockStack>
    </Card>
  );
}

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
