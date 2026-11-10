import React from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitKey, limitRules, limitState, isD2CLimit } from '../limits.js';
import { withCatalog } from '../limitCatalog.js';
import { isContractTerm } from '../agreements.js';
import { useWcId } from '../../shared/wc.jsx';
import { SummaryHoverCard, limitSummaryItems } from './SummaryHoverCard.jsx';
import { SideBlock, SideRow, BLOCK_HELP, backTo } from './companyLayout.jsx';

const LEVEL_RANK = { location: 3, company: 2, store: 1 };

// A company's Order limits block in the page's side column: the limits set on
// the company, on its locations, and store-wide, most specific first, as chips: green
// when Active, otherwise grey with its status after the name. A chip opens the limit
// in its editor, hovering shows its status and settings; ⊕ adds one for the company.
// A contract's own limits are in its contract.
export function CompanyLimitsCard({ company }) {
  const { state, dispatch } = useStore();
  const addId = useWcId('add-company-limit');
  // The editor opens in Order limits and comes back here on save or cancel.
  const returnTo = { view: 'company', selectedCompany: company.id, companyTab: 'limits' };
  const levelOf = (l) => {
    if ((l.companyIds || []).includes(company.id)) return 'company';
    if ((company.locations || []).some((loc) => (l.locationKeys || []).includes(limitKey(company.id, loc.id)))) return 'location';
    if (l.storeWide) return 'store';
    return null;
  };
  const rows = (state.db.limits || [])
    .filter((l) => !isContractTerm(l) && !isD2CLimit(l))
    .map((limit) => ({ limit, level: levelOf(limit) }))
    .filter((r) => r.level)
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.limit.name.localeCompare(b.limit.name));
  // The whole catalog, so a rule by tag, vendor or type finds the storefront's products too.
  const catalogDb = withCatalog(state.db);
  // A limit other companies share (store-wide, or set on more companies or their
  // locations) says so on its chip: "Shared · 8 companies", "Shared · All companies".
  const sharedLabel = (l) => {
    if (l.storeWide) return 'Shared · All companies';
    const ids = new Set([...(l.companyIds || []), ...(l.locationKeys || []).map((k) => String(k).split('::')[0])]);
    return ids.size > 1 ? `Shared · ${ids.size} companies` : null;
  };
  const add = (kind) => {
    dispatch({
      type: 'OPEN_LIMIT_EDITOR',
      kind,
      preset: { name: `${company.name} ${LIMIT_KINDS[kind].label.toLowerCase()}`, storeWide: false, companyIds: [company.id] },
      returnTo,
    });
  };

  return (
    <SideBlock
      title="Order limits"
      info={BLOCK_HELP.limits}
      actions={
        // A link to the Order limits list.
        <s-link onClick={() => dispatch({ type: 'NAVIGATE', view: 'limits', patch: { agreementEditor: null, limitEditor: null, limitChooser: null, backTo: backTo(state, 'limits', company) } })}>
          View all order limits
        </s-link>
      }
    >
      <SideRow>
        <s-stack direction="inline" gap="small-300" alignItems="center">
          {rows.map(({ limit }) => {
            const status = limitState(limit);
            const off = status !== 'Active';
            return (
              <SummaryHoverCard
                key={limit.id}
                title={limit.name}
                status={status}
                items={() => limitSummaryItems({ limit, rules: limitRules(limit, catalogDb), contract: null }, state.db)}
              >
                {/* Active: green; otherwise grey, with its status (as the Pricing block's chips). */}
                <button
                  type="button"
                  className={`cd-chip cd-chip--${off ? 'neutral' : 'success'}`}
                  onClick={() => dispatch({ type: 'OPEN_LIMIT_EDITOR', limit, returnTo })}
                >
                  {[limit.name, off ? status : null, sharedLabel(limit)].filter(Boolean).join(' · ')}
                </button>
              </SummaryHoverCard>
            );
          })}
          <s-button icon="plus-circle" variant="tertiary" accessibilityLabel="Add limit" commandFor={addId} />
        </s-stack>
      </SideRow>
      {/* Popover + ActionList with help text: each kind's description stays under its name. */}
      <s-popover id={addId} maxInlineSize="320px">
        <s-box padding="small-200">
          <s-stack gap="none">
            {Object.entries(LIMIT_KINDS).map(([kind, k]) => (
              <s-clickable
                key={kind}
                padding="small-200"
                borderRadius="base"
                commandFor={addId}
                command="--hide"
                onClick={() => add(kind)}
              >
                <s-paragraph>{k.label}</s-paragraph>
                <s-paragraph color="subdued" fontSize="small">
                  {k.description}
                </s-paragraph>
              </s-clickable>
            ))}
          </s-stack>
        </s-box>
      </s-popover>
    </SideBlock>
  );
}
