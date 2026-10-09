import React, { useState, useEffect } from 'react';
import { useStore } from '../store.jsx';
import { Modal, Tabs, useWcId, PageHeader } from '../../shared/wc.jsx';
import { RuleBuilderCard } from './RuleBuilderCard.jsx';
import { VolumeRangesCard } from './VolumeRangesCard.jsx';
import { DefaultPriceCard } from './DefaultPriceCard.jsx';
import { LocationScopePicker } from './LocationScopePicker.jsx';
import { versionFlags } from '../../shared/versions.js';
import { COLLECTIONS } from '../data/constants.js';
import { money } from '../format.js';
import { ActiveDatesCard, ProductScopeCard, QuantityProductsCard, VolumeBasisCard, ProductOverridesCard } from './pricingEditorCards.jsx';
import { PricePreviewDialog } from './PricePreviewDialog.jsx';
import { AssignmentCard } from './AssignmentCard.jsx';
import { policyUsageCount, policyUsageDetail, slotIds, KIND_ORDER, policyPriceBreakdown, scopeLabel, kindOf, ruleTypeLabel, locationCatalog } from '../pricing.js';

// Main column + aside side by side once the editor is wide enough (Polaris React
// InlineGrid columns={{ xs: '1fr', md: '2fr 1fr' }}); two fields side by side
// in a card ({ xs: 1, sm: 2 }).
const MAIN_ASIDE = '@container (inline-size > 700px) 2fr 1fr, 1fr';
// Settings summary labels for a D2C pricing's customer target.
const D2C_TARGET_LABEL = { all: 'All customers', logged_in: 'Logged-in customers', logged_out: 'Non logged-in customers' };
// "2026-07-28" → "Jul 28, 2026".
const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const TWO_UP = '@container (inline-size > 400px) 1fr 1fr, 1fr';

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
  // Set by a save with an empty name; the Name field shows the error while it's empty.
  const [nameMissing, setNameMissing] = useState(false);
  const builder = state.builder;
  const tipId = useWcId('pricing-editor');
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
  // Holders "here": the location, or the company and its locations (from a company
  // page the pricing can sit on some locations only).
  const holdsIt = (h) => KIND_ORDER.some((k) => slotIds(h, k).includes(builder.id));
  const hereCompany = !scopeLoc && scopeCompany && holdsIt(scopeCompany) ? 1 : 0;
  const hereLocations = scopeLoc ? (holdsIt(scopeLoc) ? 1 : 0) : scopeCompany ? (scopeCompany.locations || []).filter(holdsIt).length : 0;
  const sharedCount = !isNew ? policyUsageCount({ id: builder.id }, state.db) - hereCompany - hereLocations : 0;
  const sharedElsewhere = !isNew && scopeCompany && sharedCount > 0;
  // Save dialog wording: what else holds it (companies / locations / other), and
  // what "apply to all" covers — "here" is a location or a company.
  const usage = !isNew ? policyUsageDetail({ id: builder.id }, state.db) : null;
  const others = usage
    ? {
        companies: usage.companies - hereCompany,
        locations: usage.locations - hereLocations,
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

  // From a company or location page, creating or editing: which of the company's
  // locations get it — all (null) or the picked ones (editorContext.locationIds,
  // seeded from Assign / the location page, or from where an edited pricing sits now).
  const showCompanyLocations = !!scopeCompany && !scopeLoc && (scopeCompany.locations || []).length > 0;
  const scopeLocationIds = showCompanyLocations ? state.editorContext?.locationIds ?? null : null;
  const noLocationPicked = Array.isArray(scopeLocationIds) && scopeLocationIds.length === 0;

  // "Assigned to" in the Settings summary: who gets this pricing, as picked here.
  const assignedTo = (() => {
    const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
    if (builder.audienceType === 'd2c') {
      const target = builder.customerTarget || 'none';
      const n = (builder.assignmentTargetIds || []).length;
      if (target === 'specific') return n ? count(n, 'customer') : 'Not assigned';
      if (target === 'tags') return n ? count(n, 'customer tag') : 'Not assigned';
      return D2C_TARGET_LABEL[target] || 'Not assigned';
    }
    if (scopeLoc) return `${scopeLoc.name} · ${scopeCompany.name}`;
    if (scopeCompany) {
      if (!scopeLocationIds) return scopeCompany.name;
      if (!scopeLocationIds.length) return 'Not assigned';
      const one = scopeLocationIds.length === 1 && (scopeCompany.locations || []).find((l) => l.id === scopeLocationIds[0]);
      return `${one ? one.name : count(scopeLocationIds.length, 'location')} · ${scopeCompany.name}`;
    }
    const companies = (builder.b2bCompanyIds || []).map((id) => state.db.companies.find((c) => c.id === id)).filter(Boolean);
    const locKeys = builder.b2bLocationKeys || [];
    const parts = [];
    if (companies.length) parts.push(companies.length === 1 ? companies[0].name : count(companies.length, 'company', 'companies'));
    if (locKeys.length) parts.push(count(locKeys.length, 'location'));
    return parts.length ? parts.join(' · ') : 'Not assigned';
  })();

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
    if (!builder.name?.trim()) {
      setNameMissing(true);
      return;
    }
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

  // "Who this pricing serves": the library's assignment card, or a company's locations.
  const whoServes = (
    <>
      {showAssignment && <AssignmentCard builder={builder} patch={patch} db={state.db} isNew={isNew} footer={catalogNote} />}
      {showCompanyLocations && (
        <CompanyLocationsCard
          company={scopeCompany}
          locationIds={scopeLocationIds}
          onChange={(ids) => dispatch({ type: 'EDITOR_CONTEXT_PATCH', patch: { locationIds: ids } })}
          applyLater={state.editorContext?.applyLater === true}
          onApplyLaterChange={(on) => dispatch({ type: 'EDITOR_CONTEXT_PATCH', patch: { applyLater: on } })}
          footer={catalogNote}
        />
      )}
    </>
  );

  const editorTitle = isNew ? `Create ${isQuantity ? 'quantity' : 'base'} pricing` : `Edit pricing: ${builder.name}`;
  const editorBody = (
    <s-stack gap="base">
          {sharedElsewhere && (
            <s-banner tone="info">
              {`This pricing is also assigned to ${sharedWith}. Saving will offer to fork a copy for ${scopeName} or apply to all.`}
            </s-banner>
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
          <s-query-container>
          <s-grid gridTemplateColumns={MAIN_ASIDE} gap="base" alignItems="start">
            <s-stack gap="base">
              {pricingTab === 'settings' ? (
                <>
                  {isNew && (
                    // The type is fixed by how the editor was opened (base vs quantity)
                    // — no in-place switch, which is confusing mid-create. Just describe it.
                    <s-section>
                      <s-stack gap="small-400">
                        <s-heading>{isQuantity ? 'Quantity pricing' : 'Base pricing'}</s-heading>
                        <s-paragraph color="subdued" fontSize="small">
                          {isQuantity
                            ? 'Volume discounts that kick in above a quantity threshold, on selected products.'
                            : 'A price that covers the whole catalog, with optional rules and per-product overrides.'}
                        </s-paragraph>
                      </s-stack>
                    </s-section>
                  )}

                  <s-section>
                    <s-stack gap="small">
                      <s-stack direction="inline" gap="small-400" alignItems="center">
                        <s-heading>Pricing details</s-heading>
                        <s-icon type="info" color="subdued" interestFor={`${tipId}-details`} />
                        <s-tooltip id={`${tipId}-details`}>
                          Priority orders pricing within a company or location. Company/Location and customer/tag precedence isn’t replaced by it.
                        </s-tooltip>
                      </s-stack>
                      <s-text-field
                        label="Name"
                        required
                        value={builder.name}
                        error={nameMissing && !builder.name?.trim() ? 'Name is required' : undefined}
                        onInput={(e) => patch({ name: e.currentTarget.value })}
                        maxLength={255}
                        autocomplete="off"
                      />
                      <s-number-field
                        label="Priority (0-99)"
                        min={0}
                        max={99}
                        inputMode="numeric"
                        value={String(builder.priority ?? '')}
                        onInput={(e) => patch({ priority: Number(e.currentTarget.value) })}
                        details="Lower number applies first."
                        autocomplete="off"
                      />
                    </s-stack>
                  </s-section>

                  {/* Base pricing: who it serves comes before how it prices. */}
                  {!isQuantity && whoServes}

                  {isQuantity ? (
                    <>
                      <VolumeRangesCard />
                      <QuantityProductsCard builder={builder} patch={patch} products={state.db.products} />
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

                  {/* Quantity pricing: who it serves comes after how it prices. */}
                  {isQuantity && whoServes}

                  {/* Scheduling last, matching the god-file editor order. */}
                  <ActiveDatesCard builder={builder} patch={patch} />
                </>
              ) : (
                <AppearanceTab builder={builder} patch={patch} kindWord={kindWord} product={state.db.products[0]} />
              )}
            </s-stack>

            {/* Aside (god-file builder-side): status, resolution, summary. */}
            <s-stack gap="base">
              <RuleStatusCard builder={builder} patch={patch} />
              <SummaryCard builder={builder} isQuantity={isQuantity} assignedTo={assignedTo} products={state.db.products} />
            </s-stack>
          </s-grid>
          </s-query-container>
    </s-stack>
  );

  return (
    <>
      {sideConfirm && (
        <Modal onClose={() => setSideConfirm(false)} heading="Change who this pricing serves?">
          {savedSide === 'b2b' ? (
            <s-paragraph>
              {'This pricing is set up for '}
              <s-text fontWeight="semibold">Company-based B2B</s-text>
              {companiesAssigned
                ? `, with ${companiesAssigned} compan${companiesAssigned === 1 ? 'y' : 'ies'} assigned. Switching to `
                : ', as the default for all companies. Switching to '}
              <s-text fontWeight="semibold">D2C Wholesale</s-text>
              {` clears that assignment. ${companiesAssigned === 1 ? 'That company falls' : 'Those companies fall'} back to your Shopify prices until another pricing is assigned.`}
            </s-paragraph>
          ) : (
            <s-paragraph>
              {'This pricing is set up for '}
              <s-text fontWeight="semibold">D2C Wholesale</s-text>
              {', with the customers and customer tags it targets. Switching to '}
              <s-text fontWeight="semibold">Company-based B2B</s-text>
              {' clears that selection. Only the companies you picked receive it.'}
            </s-paragraph>
          )}
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setSideConfirm(false);
              dispatch({ type: 'SAVE_EDITOR' });
            }}
          >
            Save changes
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setSideConfirm(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
      {forkConfirm && (
        <Modal onClose={() => setForkConfirm(false)} heading={`Save changes to ${builder.name}`}>
          <s-stack gap="small">
            <s-paragraph>
              {`${builder.name} is shared with ${sharedWith}. Save as a separate pricing for `}
              <s-text fontWeight="semibold">{scopeName}</s-text>
              {` — the others keep ${builder.name}.`}
            </s-paragraph>
            <s-box padding="small" border="base" borderRadius="base">
              <s-checkbox
                label={allNoun ? `Apply to all ${sharedCount + 1} ${allNoun} instead` : `Apply everywhere it’s used instead (${sharedCount + 1})`}
                details={
                  allNoun
                    ? `Overwrites this pricing for every ${allNoun === 'companies' ? 'company' : allNoun === 'locations' ? 'location' : 'company and location'} using it.`
                    : 'Overwrites this pricing everywhere it’s used.'
                }
                checked={applyAll}
                onChange={(e) => setApplyAll(e.currentTarget.checked)}
              />
            </s-box>
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setForkConfirm(false);
              // Unticked: a separate copy for here (the default path forks).
              dispatch({ type: 'SAVE_EDITOR', applyToAll: applyAll });
            }}
          >
            Save
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setForkConfirm(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
      {catalogPreview && targets.length > 1 && (
        <CatalogPricePreview builder={builder} products={state.db.products} targets={targets} onClose={() => setCatalogPreview(false)} />
      )}
      {asPage ? (
        <>
          <PageHeader
            heading={editorTitle}
            backAction={{ content: 'Back', onAction: () => dispatch({ type: 'CLOSE_EDITOR' }) }}
            primaryAction={{ content: isNew ? 'Create pricing' : 'Save', onAction: onSave, disabled: noLocationPicked }}
            secondaryActions={[{ content: 'Cancel', onAction: () => dispatch({ type: 'CLOSE_EDITOR' }) }]}
          />
          <s-page>{editorBody}</s-page>
        </>
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
            <s-heading fontSize="large">{editorTitle}</s-heading>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <s-button onClick={() => dispatch({ type: 'CLOSE_EDITOR' })}>Cancel</s-button>
              <s-button variant="primary" onClick={onSave} disabled={noLocationPicked}>{isNew ? 'Create pricing' : 'Save'}</s-button>
              <s-button variant="tertiary" icon="x" accessibilityLabel="Close" onClick={() => dispatch({ type: 'CLOSE_EDITOR' })} />
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
    <s-section>
      <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-heading>Rule status</s-heading>
          <s-badge tone={on ? 'success' : undefined}>{on ? 'Active' : 'Inactive'}</s-badge>
        </s-stack>
        <s-button onClick={() => patch({ status: on ? 'Inactive' : 'Active' })}>
          {on ? 'Turn off' : 'Turn on'}
        </s-button>
      </s-grid>
    </s-section>
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
    <s-banner tone="info">
      <s-paragraph>
        Multiple locations can have different catalogs. This base pricing is applied per catalog, so selected products that aren’t in a location’s catalog won’t get the price you set up.
      </s-paragraph>
      <s-button slot="secondary-actions" onClick={onPreview}>
        Preview by location
      </s-button>
    </s-banner>
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
          <s-select label="Location" value={key} onChange={(e) => setKey(e.currentTarget.value)}>
            {targets.map((t) => (
              <s-option key={keyOf(t)} value={keyOf(t)}>
                {severalCompanies ? `${t.location.name} · ${t.company.name}` : t.location.name}
              </s-option>
            ))}
          </s-select>
        </div>
      }
      onClose={onClose}
    />
  );
}

// "Who this pricing serves" from a company page: which of the company's locations
// get it (see LocationScopePicker).
function CompanyLocationsCard({ company, locationIds, onChange, applyLater, onApplyLaterChange, footer = null }) {
  return (
    <s-section>
      <s-stack gap="small">
        <s-stack gap="small-400">
          <s-heading>Who this pricing serves</s-heading>
          <s-paragraph color="subdued" fontSize="small">
            {'Choose which of '}
            <s-text fontSize="small" fontWeight="semibold">{company.name}</s-text>
            {'’s locations get this pricing.'}
          </s-paragraph>
        </s-stack>
        <LocationScopePicker
          company={company}
          locationIds={locationIds}
          onChange={onChange}
          titleHidden
          separate
          applyLater={applyLater}
          onApplyLaterChange={onApplyLaterChange}
        />
        {footer}
      </s-stack>
    </s-section>
  );
}

// Settings summary (production's SettingsSummaryCard): what this pricing is and
// who gets it at a glance, then — for base pricing — Preview prices: what buyers
// pay with these settings, unsaved edits included.
function SummaryCard({ builder, isQuantity, assignedTo, products }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const rules = (builder.conditionalRules || []).length;
  const overrides = Object.keys(builder.variantAdjustments || {}).length;
  const ranges = (builder.volumeRanges || []).length;
  const calculation = isQuantity
    ? count(ranges, 'quantity range')
    : [rules ? count(rules, 'rule') : null, overrides ? count(overrides, 'override') : null].filter(Boolean).join(' · ') || 'No rules';
  const hasEnd = (builder.hasEndDate ?? !!builder.endDate) && !!builder.endDate;
  const items = [
    ['receipt-dollar', 'Type', isQuantity ? 'Quantity pricing' : 'Base pricing'],
    ['product', 'Products', isQuantity || rules || overrides ? scopeLabel(builder) : 'Shopify prices'],
    ['discount', 'Calculation', calculation],
    ['team', 'Serves', builder.audienceType === 'd2c' ? 'D2C Wholesale' : 'Company-based B2B'],
    ['person', 'Assigned to', assignedTo],
    ['star', 'Priority', String(builder.priority ?? 0)],
    ['calendar', 'Start', builder.startDate ? `${dayLabel(builder.startDate)} ${builder.startTime || '12:00 AM'}` : 'Immediately'],
    hasEnd ? ['calendar', 'End', `${dayLabel(builder.endDate)} ${builder.endTime || '12:00 AM'}`] : null,
  ].filter(Boolean);
  return (
    <s-section>
      <s-stack gap="small">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-heading>Settings summary</s-heading>
          <s-badge tone="info">All markets</s-badge>
        </s-stack>
        <s-stack gap="small-300">
          {items.map(([icon, label, value]) => (
            <s-grid key={label} gridTemplateColumns="auto 96px minmax(0, 1fr)" gap="small-200" alignItems="center">
              <s-icon type={icon} color="subdued" />
              <s-text color="subdued">{`${label}:`}</s-text>
              <s-text>{value}</s-text>
            </s-grid>
          ))}
        </s-stack>
        {!isQuantity && (
          <>
            <s-divider />
            <s-paragraph color="subdued">See what buyers pay with these settings.</s-paragraph>
            <s-button icon="view" inlineSize="fill" onClick={() => setPreviewOpen(true)}>
              Preview prices
            </s-button>
          </>
        )}
      </s-stack>
      {previewOpen && <BuilderPricePreview builder={builder} products={products} onClose={() => setPreviewOpen(false)} />}
    </s-section>
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
    <s-section heading="Appearance">
      <s-stack gap="small">
        <s-paragraph color="subdued" fontSize="small">
          {`How this ${kindWord} is presented on the storefront. It does not change price calculation or assignment.`}
        </s-paragraph>
        <s-query-container>
          <s-grid gridTemplateColumns={TWO_UP} gap="small">
            <s-text-field label="Display title" value={builder.appearanceTitle ?? ''} onInput={(e) => patch({ appearanceTitle: e.currentTarget.value })} autocomplete="off" />
            <s-text-field label="Price badge" value={builder.appearanceLabel ?? ''} onInput={(e) => patch({ appearanceLabel: e.currentTarget.value })} autocomplete="off" />
          </s-grid>
        </s-query-container>
        <s-box border="base" borderRadius="base" padding="small">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <s-box background="subdued" borderRadius="base" minBlockSize="48px" inlineSize="48px">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48 }}>
                <s-text color="subdued">▣</s-text>
              </div>
            </s-box>
            <div style={{ flex: 1, minWidth: 0 }}>
              <s-stack gap="small-400">
                <s-text fontWeight="medium">{product?.title || 'Cotton T-Shirt'}</s-text>
                <div>
                  <s-badge tone="info">{badge}</s-badge>
                </div>
              </s-stack>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>
                <s-text color="subdued" fontSize="small">
                  <s>{money(list)}</s>
                </s-text>
              </div>
              <s-text fontSize="large" fontWeight="semibold">{money(now)}</s-text>
            </div>
          </div>
        </s-box>
      </s-stack>
    </s-section>
  );
}

// Status + validity window.
