import React from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitKey, locationLimits } from '../limits.js';
import { withCatalog } from '../limitCatalog.js';
import { useWcId } from '../../shared/wc.jsx';

const LEVEL_LABEL = { location: 'This location', company: 'Company', store: 'Store-wide' };

// A location's order limits: every active limit that reaches it (its own, its
// company's, store-wide), most specific first, read off the location's record.
// Each shows its name and level only.
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
    <s-section>
      <s-stack gap="small">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small-200">
          <s-heading>Order limits</s-heading>
          <s-button icon="plus" commandFor={addId}>
            Add limit
          </s-button>
        </s-grid>
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

        {rows.length ? (
          rows.map(({ limit, level }, i) => (
            <React.Fragment key={limit.id}>
              {i > 0 && <s-divider />}
              <s-grid gridTemplateColumns="1fr auto" alignItems="start" gap="small-200">
                <div>
                  <s-link onClick={() => dispatch({ type: 'OPEN_LIMIT_EDITOR', limit, returnTo })}>{limit.name}</s-link>
                </div>
                <s-badge tone={level === 'location' ? 'info' : undefined}>{LEVEL_LABEL[level]}</s-badge>
              </s-grid>
            </React.Fragment>
          ))
        ) : (
          <s-paragraph color="subdued" fontSize="small">
            No order limits. Buyers here can check out any amount.
          </s-paragraph>
        )}

        <s-stack direction="inline">
          <s-link onClick={() => dispatch({ type: 'NAVIGATE', view: 'limits' })}>Manage all order limits</s-link>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
