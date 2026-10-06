import React from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitKey, locationLimits } from '../limits.js';
import { useWcId } from '../../shared/wc.jsx';

const LEVEL_LABEL = { location: 'This location', company: 'Company', store: 'Store-wide' };

// A location's order limits: every active limit that reaches it (its own, its
// company's, store-wide), most specific first. A rule that a more specific limit
// replaces here is struck through and names the limit that wins.
export function LocationLimitsCard({ company, location }) {
  const { state, dispatch } = useStore();
  const addId = useWcId('add-limit');
  const rows = locationLimits(state.db, company.id, location.id);
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
          rows.map(({ limit, level, rules }, i) => (
            <React.Fragment key={limit.id}>
              {i > 0 && <s-divider />}
              <s-stack gap="small-400">
                <s-grid gridTemplateColumns="1fr auto" alignItems="start" gap="small-200">
                  <div>
                    <s-link onClick={() => dispatch({ type: 'OPEN_LIMIT_EDITOR', limit, returnTo })}>{limit.name}</s-link>
                  </div>
                  <s-badge tone={level === 'location' ? 'info' : undefined}>{LEVEL_LABEL[level]}</s-badge>
                </s-grid>
                {rules.map((r) =>
                  r.replacedBy ? (
                    <s-stack key={r.text} gap="none">
                      <s-paragraph fontSize="small" color="subdued">
                        <s>{r.text}</s>
                      </s-paragraph>
                      <s-paragraph fontSize="small" color="subdued">{`Replaced here by ${r.replacedBy.name}`}</s-paragraph>
                    </s-stack>
                  ) : (
                    <s-paragraph key={r.text} fontSize="small">
                      {r.text}
                    </s-paragraph>
                  ),
                )}
              </s-stack>
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
