import React from 'react';
import { useStore } from '../store.jsx';
import { companyBaseEntries, locationOnlyEntries, pricingLocationsLabel, policyStatus, slotIds } from '../pricing.js';
import { openBuildFromQuotes } from './BuildFromQuotes.jsx';
import { versionFlags } from '../../shared/versions.js';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { Tip, wcTone } from '../../shared/wc.jsx';
import basePricingArt from '../assets/base-pricing-empty.webp';

const PAGE_SIZES = [5, 10, 20, 100];

// Edit / Remove for pricing only some locations get: editing opens it with those
// locations picked under "Who this pricing serves", removing takes it off them only.
export function LocationOnlyActions({ company, kind, entry }) {
  const { dispatch } = useStore();
  const locs = entry.locations;
  return (
    <s-stack direction="inline" gap="small-400" justifyContent="end" alignItems="center">
      <s-button
        icon="edit"
        variant="tertiary"
        accessibilityLabel="Edit pricing"
        onClick={() => dispatch({ type: 'OPEN_EDITOR', policy: entry.policy, context: { mode: 'edit', companyId: company.id } })}
      />
      <s-button
        icon="x-circle"
        variant="tertiary"
        tone="critical"
        accessibilityLabel={`Remove from ${locs.map((l) => l.name).join(', ')}`}
        onClick={() => locs.forEach((l) => dispatch({ type: 'REMOVE_LOCATION_PRICING', companyId: company.id, locationId: l.id, kind, policyId: entry.policy.id }))}
      />
    </s-stack>
  );
}

// With auto-add locations on, a switch per pricing: do locations added later get it?
export function ApplyLaterSwitch({ company, kind, policy }) {
  const { dispatch } = useStore();
  const on = slotIds(company, kind).includes(policy.id);
  return (
    <s-switch
      accessibilityLabel={`Apply ${policy.name} to new locations`}
      checked={on}
      disabled={!(company.locations || []).length}
      onChange={(e) => {
        const next = e.currentTarget.checked;
        if (next === on) return;
        dispatch({ type: 'SET_PRICING_APPLY_LATER', companyId: company.id, kind, policyId: policy.id, on: next });
      }}
    />
  );
}

// Card header: title on the left, a one-line subdued description on the right.
function CardHeader({ title, description }) {
  return (
    <s-box padding="small" paddingBlockEnd="small-200">
      <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small-200">
        <s-heading>{title}</s-heading>
        <s-text color="subdued" fontSize="small">
          {description}
        </s-text>
      </s-stack>
    </s-box>
  );
}

export function BasePricingCard({ company }) {
  const { state, dispatch } = useStore();
  const policies = state.db.policies;
  // The company's own list plus pricing only some locations get (labelled with them),
  // in priority order — the stable sort keeps the company's own tie-breaks.
  const entries = [...companyBaseEntries(company, policies), ...locationOnlyEntries(company, policies, 'base')].sort((a, b) => a.priority - b.priority);

  // v1: single base pricing per company (no priority list / pagination).
  if (!versionFlags().multiBase) return <SingleBaseCard company={company} />;

  const autoApply = !!company.autoAddLocations;
  const showTools = entries.length > 5;
  const q = showTools ? (state.basePricingSearch || '').trim().toLowerCase() : '';
  const filtered = q ? entries.filter((e) => e.policy.name.toLowerCase().includes(q)) : entries;
  const size = PAGE_SIZES.includes(state.basePageSize) ? state.basePageSize : 5;
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(Math.max(1, state.basePage), pageCount);
  const start = (page - 1) * size;
  const pageEntries = filtered.slice(start, start + size);

  // Always offered (Latest's cross-sync), even with no closed quotes yet: the modal
  // explains what's missing — no quotes, or the RFQ app isn't installed.
  const crossSync = versionFlags().priceCrossSync;
  const buildFromQuotes = () => openBuildFromQuotes(dispatch, company, state.db);

  const priorityHeader = (
    <Tip content="Lower number applies first.">
      <span style={{ borderBottom: '1px dotted var(--p-color-border)', cursor: 'help' }}>Priority</span>
    </Tip>
  );

  const rows = pageEntries.map((entry) => {
    const p = entry.policy;
    const st = policyStatus(p);
    const locs = entry.locations;
    return (
      <s-table-row key={p.id}>
        <s-table-cell>
          <s-text fontWeight="medium">{p.name}</s-text>
        </s-table-cell>
        <s-table-cell>{pricingLocationsLabel(company, 'base', p.id)}</s-table-cell>
        {autoApply && (
          <s-table-cell>
            <ApplyLaterSwitch company={company} kind="base" policy={p} />
          </s-table-cell>
        )}
        <s-table-cell>{entry.priority}</s-table-cell>
        <s-table-cell>
          <s-badge tone={wcTone(st.tone)}>{st.label}</s-badge>
        </s-table-cell>
        <s-table-cell>
          {locs ? (
            <LocationOnlyActions company={company} kind="base" entry={entry} />
          ) : (
            <s-stack direction="inline" gap="small-400" justifyContent="end" alignItems="center">
              <s-button
                icon="edit"
                variant="tertiary"
                accessibilityLabel="Edit pricing"
                onClick={() => dispatch({ type: 'OPEN_EDITOR', policy: p, context: { mode: 'edit', companyId: company.id } })}
              />
              <s-button
                icon="x-circle"
                variant="tertiary"
                tone="critical"
                accessibilityLabel="Remove this base pricing"
                onClick={() => dispatch({ type: 'REMOVE_COMPANY_BASE', companyId: company.id, policyId: p.id })}
              />
            </s-stack>
          )}
        </s-table-cell>
      </s-table-row>
    );
  });

  const footerButtons = (
    <s-box padding="small">
      <s-stack direction="inline" gap="small-200">
        <s-button icon="plus" onClick={() => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, mode: 'add' })}>
          Add base pricing
        </s-button>
        {crossSync && <s-button onClick={buildFromQuotes}>Build pricing from closed quotes</s-button>}
        <s-button variant="tertiary" onClick={() => dispatch({ type: 'OPEN_PRICE_BOARD', companyId: company.id })}>
          Preview prices
        </s-button>
      </s-stack>
    </s-box>
  );

  if (entries.length === 0) {
    return (
      <s-section heading="Base pricing">
        <EmptyBlock
          image={basePricingArt}
          imageAlt="A price list with a dollar amount on each line, next to boxes and a price tag"
          heading="No base pricing yet"
          action={{ content: 'Add base pricing', onAction: () => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, mode: 'add' }) }}
          secondaryAction={crossSync ? { content: 'Build pricing from closed quotes', onAction: buildFromQuotes } : undefined}
        >
          Assign a base pricing so buyers get a B2B price. You can add more than one — the lowest priority applies first.
        </EmptyBlock>
      </s-section>
    );
  }

  return (
    <s-section padding="none">
      <CardHeader title="Base pricing" description="The standard B2B price for this company" />

      {showTools && (
        <s-box paddingInline="small" paddingBlockEnd="small-200">
          <s-grid gridTemplateColumns="minmax(200px, 1fr) auto" gap="small" alignItems="center">
            <s-search-field
              label="Search base pricing"
              labelAccessibilityVisibility="exclusive"
              placeholder="Search base pricing"
              value={state.basePricingSearch || ''}
              autocomplete="off"
              onInput={(e) => dispatch({ type: 'BASE_SEARCH', value: e.currentTarget.value })}
            />
            <s-stack direction="inline" gap="small-300" alignItems="center">
              <s-text color="subdued" fontSize="small">
                Show
              </s-text>
              <div style={{ width: 76 }}>
                <s-select
                  label="Per page"
                  labelAccessibilityVisibility="exclusive"
                  value={String(size)}
                  onChange={(e) => dispatch({ type: 'BASE_PAGE_SIZE', size: Number(e.currentTarget.value) })}
                >
                  {PAGE_SIZES.map((n) => (
                    <s-option key={n} value={String(n)}>
                      {String(n)}
                    </s-option>
                  ))}
                </s-select>
              </div>
              <s-text color="subdued" fontSize="small">
                per page
              </s-text>
            </s-stack>
          </s-grid>
        </s-box>
      )}

      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Pricing</s-table-header>
          <s-table-header listSlot="labeled">Location</s-table-header>
          {autoApply && <s-table-header listSlot="labeled">Auto-apply to new locations</s-table-header>}
          <s-table-header listSlot="labeled">{priorityHeader}</s-table-header>
          <s-table-header listSlot="secondary">Status</s-table-header>
          <s-table-header listSlot="inline">
            <s-text accessibilityVisibility="exclusive">Actions</s-text>
          </s-table-header>
        </s-table-header-row>
        <s-table-body>{rows}</s-table-body>
      </s-table>
      {filtered.length === 0 ? (
        <s-box padding="base">
          <div style={{ textAlign: 'center' }}>
            <s-text color="subdued">{`No base pricing matches “${state.basePricingSearch}”.`}</s-text>
          </div>
        </s-box>
      ) : null}

      {showTools && filtered.length > size && (
        <>
          <s-divider />
          <s-box padding="small">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text color="subdued" fontSize="small">
                {`${start + 1}–${start + pageEntries.length} of ${filtered.length}`}
              </s-text>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text color="subdued" fontSize="small">
                  {`Page ${page} of ${pageCount}`}
                </s-text>
                <s-button-group gap="none" accessibilityLabel="Pagination">
                  <s-button
                    slot="secondary-actions"
                    icon="chevron-left"
                    accessibilityLabel="Previous"
                    disabled={page <= 1}
                    onClick={() => dispatch({ type: 'BASE_PAGE', page: Math.max(page - 1, 1) })}
                  />
                  <s-button
                    slot="secondary-actions"
                    icon="chevron-right"
                    accessibilityLabel="Next"
                    disabled={page >= pageCount}
                    onClick={() => dispatch({ type: 'BASE_PAGE', page: Math.min(page + 1, pageCount) })}
                  />
                </s-button-group>
              </s-stack>
            </s-stack>
          </s-box>
        </>
      )}

      {footerButtons}
    </s-section>
  );
}

// v1 single-slot base pricing card.
function SingleBaseCard({ company }) {
  const { state, dispatch } = useStore();
  const entries = companyBaseEntries(company, state.db.policies);
  const primary = entries[0];
  const st = primary ? policyStatus(primary.policy) : null;
  return (
    <s-section padding="none">
      <CardHeader title="Base pricing" description="The standard B2B price for this company" />
      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Pricing</s-table-header>
          <s-table-header listSlot="labeled">Products</s-table-header>
          <s-table-header listSlot="secondary">Status</s-table-header>
          <s-table-header listSlot="inline">
            <s-text accessibilityVisibility="exclusive">Actions</s-text>
          </s-table-header>
        </s-table-header-row>
        <s-table-body>
          <s-table-row>
            <s-table-cell>
              {primary ? <s-text fontWeight="medium">{primary.policy.name}</s-text> : <s-badge tone="caution">Not set</s-badge>}
            </s-table-cell>
            <s-table-cell>
              <s-text color="subdued">All products</s-text>
            </s-table-cell>
            <s-table-cell>
              {primary ? <s-badge tone={wcTone(st.tone)}>{st.label}</s-badge> : <s-text color="subdued">-</s-text>}
            </s-table-cell>
            <s-table-cell>
              <s-stack direction="inline" gap="small-400" justifyContent="end" alignItems="center">
                {primary ? (
                  <>
                    <s-button icon="edit" variant="tertiary" accessibilityLabel="Edit pricing" onClick={() => dispatch({ type: 'OPEN_EDITOR', policy: primary.policy, context: { mode: 'edit', companyId: company.id } })} />
                    <s-button icon="x-circle" variant="tertiary" tone="critical" accessibilityLabel="Remove" onClick={() => dispatch({ type: 'REMOVE_COMPANY_BASE', companyId: company.id, policyId: primary.policy.id })} />
                  </>
                ) : (
                  <s-button icon="plus" variant="tertiary" accessibilityLabel="Set base pricing" onClick={() => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, mode: 'add' })} />
                )}
              </s-stack>
            </s-table-cell>
          </s-table-row>
        </s-table-body>
      </s-table>
      <s-box padding="small">
        <s-button variant="tertiary" onClick={() => dispatch({ type: 'OPEN_PRICE_BOARD', companyId: company.id })}>
          Preview prices
        </s-button>
      </s-box>
    </s-section>
  );
}
