import React from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitKey, limitState, locationLimits } from '../limits.js';
import { withCatalog } from '../limitCatalog.js';
import { useWcId } from '../../shared/wc.jsx';
import { SummaryHoverCard, limitSummaryItems } from './SummaryHoverCard.jsx';
import { SideBlock, SideRow, BLOCK_HELP, backTo } from './companyLayout.jsx';

// A location's Order limits block in the page's side column, laid out as its Pricing block: every active limit that
// reaches it (its own, its company's, store-wide), most specific first, as chips. A chip
// opens the limit in its editor; ⊕ adds one for this location.
export function LocationLimitsCard({ company, location }) {
  const { state, dispatch } = useStore();
  const addId = useWcId('add-limit');
  // The whole catalog, so a rule by tag, vendor or type finds the storefront's products too.
  const rows = locationLimits(withCatalog(state.db), company.id, location.id);
  // The editor opens in Order limits and comes back here on save or cancel.
  const returnTo = { view: 'location', selectedCompany: company.id, selectedLocation: location.id };
  const add = (kind) => {
    dispatch({
      type: 'OPEN_LIMIT_EDITOR',
      kind,
      preset: { name: `${location.name} ${LIMIT_KINDS[kind].label.toLowerCase()}`, storeWide: false, locationKeys: [limitKey(company.id, location.id)] },
      returnTo,
    });
  };

  return (
    <SideBlock
      title="Order limits"
      info={BLOCK_HELP.limits}
      actions={
        // A link to the Order limits list, as on the company page.
        <s-link onClick={() => dispatch({ type: 'NAVIGATE', view: 'limits', patch: { agreementEditor: null, limitEditor: null, limitChooser: null, backTo: backTo(state, 'limits', company, location) } })}>
          View all order limits
        </s-link>
      }
    >
      <SideRow>
        <s-stack direction="inline" gap="small-300" alignItems="center">
          {/* Hover shows its status and a summary of its settings. A contract's limit here
              is Active: its contract gives it. */}
          {rows.map((row) => {
            const status = row.contract ? 'Active' : limitState(row.limit);
            const off = status !== 'Active';
            return (
              <SummaryHoverCard key={row.limit.id} title={row.limit.name} status={status} items={() => limitSummaryItems(row, state.db)}>
                {/* Active: green; otherwise grey, with its status (as the company page's chips). */}
                <button
                  type="button"
                  className={`cd-chip cd-chip--${off ? 'neutral' : 'success'}`}
                  onClick={() => dispatch({ type: 'OPEN_LIMIT_EDITOR', limit: row.limit, returnTo })}
                >
                  {off ? `${row.limit.name} · ${status}` : row.limit.name}
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
