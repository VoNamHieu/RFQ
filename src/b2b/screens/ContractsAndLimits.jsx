import React from 'react';
import { useStore } from '../store.jsx';
import { versionFlags } from '../../shared/versions.js';
import { backActionFor, CdPageHead } from '../components/companyLayout.jsx';

export const TERMS_HEADING = 'Orders & rules';

// The Orders & rules lists, one section each: Contracts and Order limits (Upcoming),
// Manual orders and Discounts.
const SECTIONS = () => {
  const flags = versionFlags();
  return [
    flags.agreements
      ? { view: 'agreements', title: 'Contracts', description: 'Each company’s pricing and order limits, applied together.', action: 'Manage contracts' }
      : null,
    flags.orderLimits
      ? {
          view: 'limits',
          title: 'Order limits',
          description: 'Rules on what B2B buyers and D2C wholesale customers can check out, checked in the cart and at checkout.',
          action: 'Manage order limits',
        }
      : null,
    { view: 'manualOrders', title: 'Manual orders', description: 'Orders you create for buyers, saved as Shopify draft orders.', action: 'Manage manual orders' },
    { view: 'discounts', title: 'Discounts', description: 'Discounts for your buyers, and how they show on your storefront.', action: 'Manage discounts' },
  ].filter(Boolean);
};

// The Orders & rules menu item: one page with a section for each list, like Select
// pricing type — its button opens that list, whose back arrow returns here.
export function OrdersAndRules() {
  const { dispatch } = useStore();
  const open = (view) => dispatch({ type: 'NAVIGATE', view, patch: { agreementEditor: null, limitEditor: null, limitChooser: null } });
  return (
    <div className="cd-page">
      <CdPageHead title={TERMS_HEADING} />
      <div className="cd-card-grid">
        {SECTIONS().map((c) => (
          <div key={c.view} className="cd-card">
            <div className="cd-card__body cd-terms-card">
              <div>
                <h2 className="cd-section__title">{c.title}</h2>
                <p className="cd-section__subtitle">{c.description}</p>
              </div>
              <s-stack direction="inline">
                <s-button onClick={() => open(c.view)}>{c.action}</s-button>
              </s-stack>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// A list's way back: to the company or location page it was opened from, else to
// Orders & rules. `label` / `content` for the new and the old page headers.
export function termsBack(state, dispatch, view) {
  const back = backActionFor(state, dispatch, view);
  if (back) return { label: state.backTo?.label || 'Back', content: back.content, onAction: back.onAction };
  const toTerms = () => dispatch({ type: 'NAVIGATE', view: 'terms', patch: { agreementEditor: null, limitEditor: null, limitChooser: null } });
  return { label: TERMS_HEADING, content: TERMS_HEADING, onAction: toTerms };
}
