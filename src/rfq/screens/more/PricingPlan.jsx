import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store.jsx';
import {
  CHARGE_TYPE_FREE,
  CHARGE_TYPE_MONTHLY,
  CHARGE_TYPE_YEARLY,
  CURRENT_SUBSCRIPTION,
  ID_ENTERPRISE_PLAN,
  ID_FREE_PLAN,
  ID_PRO_PLAN,
  IS_SHOPIFY_PLUS,
  LIST_PLAN,
  PLAN_DATA,
} from './data.js';
import { LOGOS, PriceLabel, Rich, YearlyDiscount, planPrice } from './shared.jsx';
import { PricingDetail } from './PricingDetail.jsx';
import { DiscountModal, DowngradeModal } from './PricingModals.jsx';
import './more.css';

// Rebuilt from the production app's pages/PricingPlanPage.jsx → components/PricingPlan/indexBfs.jsx
// (+ detail.jsx, ModalDiscountBfs.jsx, ModalDowngradeBfs.jsx, assets/styles/_pricingPlan.scss).

function PlanFeature({ item }) {
  const feature = typeof item === 'string' ? { text: item } : item;
  return (
    <div className="more-pp-feature">
      <span className="more-pp-feature__icon">
        <s-icon type="check" tone="info" />
      </span>
      <span className="more-pp-feature__text">
        {feature.logo && <img className={`more-pp-feature__logo more-pp-feature__logo--${feature.logo}`} src={LOGOS[feature.logo]} alt="" />}
        <Rich text={feature.text} />
        {feature.isNew && (
          <>
            {' '}
            <s-badge tone="success">New</s-badge>
          </>
        )}
      </span>
    </div>
  );
}

// MagicIcon (sparkles) + bodyLg bold text.
function StartText({ children }) {
  return (
    <div className="more-pp-start">
      <s-icon type="magic" />
      <span>{children}</span>
    </div>
  );
}

export function PricingPlan() {
  const { dispatch } = useStore();
  // The merchant's subscription (plan_price / charge_type in production).
  const subscription = CURRENT_SUBSCRIPTION;
  const [chargeType, setChargeType] = useState(CHARGE_TYPE_YEARLY);
  const [expanded, setExpanded] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(0);
  const [loadingCharge, setLoadingCharge] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const yearlyDiscount = LIST_PLAN[1]?.discount;
  const chargeTypeOptions = [
    { type: CHARGE_TYPE_MONTHLY, label: 'Monthly' },
    { type: CHARGE_TYPE_YEARLY, label: 'Yearly', save: yearlyDiscount ? `Save ${yearlyDiscount}%` : '' },
  ];

  const checkCurrentPlan = (planId) => {
    if (subscription.chargeType === CHARGE_TYPE_FREE) return planId === subscription.planId;
    return planId === subscription.planId && chargeType === subscription.chargeType;
  };

  const buttonLabel = (planId) => {
    if (checkCurrentPlan(planId)) return 'Current Plan';
    if (planId === ID_FREE_PLAN) return 'Downgrade to Free';
    return 'Choose plan';
  };

  // Production posts /shopify/charge-plan. A paid plan answers with Shopify's charge approval
  // link and the app leaves for it; the Free plan applies at once, shows the result toast and
  // reloads the app on its home page.
  const chargePlan = (planId) => {
    setLoadingCharge(planId);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDowngradeOpen(false);
      setLoadingCharge(false);
      if (planId === ID_FREE_PLAN) {
        dispatch({ type: 'TOAST', message: planId < subscription.planId ? 'Plan downgraded' : 'Plan upgraded' });
        dispatch({ type: 'NAVIGATE', view: 'submissionList' });
        return;
      }
      dispatch({ type: 'TOAST', message: `Opens Shopify's charge approval for the ${PLAN_DATA[planId].title} plan in the full app` });
    }, 600);
  };

  const handleChoosePlan = (planId) => {
    setSelectedPlanId(planId);
    if (planId < subscription.planId) {
      setDowngradeOpen(true);
      return;
    }
    chargePlan(planId);
  };

  const planButton = (planId, primary) => (
    <s-button
      inlineSize="fill"
      variant={primary ? 'primary' : undefined}
      disabled={checkCurrentPlan(planId)}
      loading={loadingCharge === planId}
      onClick={() => handleChoosePlan(planId)}
    >
      {buttonLabel(planId)}
    </s-button>
  );

  const priceBlock = ({ id, price, discount }) => (
    <div>
      <div className="more-pp-price">
        <PriceLabel value={planPrice(id, price, discount, chargeType)} perMonth />
      </div>
      {chargeType === CHARGE_TYPE_YEARLY && <YearlyDiscount planId={id} price={price} discount={discount} />}
      <s-paragraph>{chargeType === CHARGE_TYPE_YEARLY ? 'Billed yearly' : 'Billed monthly'}</s-paragraph>
    </div>
  );

  const planB2B = LIST_PLAN.find((p) => p.id === ID_ENTERPRISE_PLAN);
  const listPlanDTC = LIST_PLAN.filter((p) => p.id !== ID_ENTERPRISE_PLAN);

  return (
    <s-page heading="Pricing plan">
      <s-button slot="secondary-actions" onClick={() => setDiscountOpen(true)}>
        Add discount code
      </s-button>

      <div className="more-pp">
        <div className="more-pp-hero">
          <s-heading fontSize="large-400">Make Your Quote Simple</s-heading>
          <s-text fontSize="large">Enjoy full access starting at $0.57 daily — Cancel anytime</s-text>
        </div>

        {/* Billing cycle — segmented Monthly / Yearly toggle */}
        <div className="more-pp-cycle" role="group" aria-label="Billing cycle">
          {chargeTypeOptions.map((option) => (
            <button
              key={option.type}
              type="button"
              className="more-pp-cycle__btn"
              aria-pressed={chargeType === option.type}
              onClick={() => setChargeType(option.type)}
            >
              <span className="more-pp-cycle__label">{option.label}</span>
              {option.save && <s-badge tone="info">{option.save}</s-badge>}
            </button>
          ))}
        </div>

        {/* Pro Plus — the B2B plan, shown full width on top. Production passes className to a
            BlockStack / Box, which drop it, so the two columns are plain flex items sized by content. */}
        <div className="more-pp-card more-pp-card--highlight more-pp-b2b">
          <div className="more-pp-b2b__content">
            <div className="more-pp-b2b__pricing">
              <s-paragraph fontSize="small">{PLAN_DATA[planB2B.id].desc}</s-paragraph>
              {priceBlock(planB2B)}
              <s-box paddingBlock="base">{planButton(planB2B.id, true)}</s-box>
            </div>
            <div className="more-pp-b2b__features">
              <StartText>{PLAN_DATA[planB2B.id].startText}</StartText>
              <div className="more-pp-b2b__grid">
                {PLAN_DATA[planB2B.id].packages.map((item, i) => (
                  <PlanFeature key={i} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="more-pp-other">
          <s-text fontWeight="bold">Our other plans</s-text>
        </div>

        <div className="more-pp-grid">
          {listPlanDTC.map((plan) => {
            const data = PLAN_DATA[plan.id];
            const recommend = plan.id === ID_PRO_PLAN && !IS_SHOPIFY_PLUS;
            return (
              <div key={plan.id} className={`more-pp-card more-pp-plan${recommend ? ' more-pp-card--highlight' : ''}`}>
                {recommend && <div className="more-pp-recommend">Recommend</div>}
                <div className="more-pp-plan__content">
                  <s-stack gap="small-200">
                    <s-stack>
                      <s-heading fontSize="large-300">{data.title}</s-heading>
                      <s-paragraph fontSize="small">{data.desc}</s-paragraph>
                    </s-stack>
                    {priceBlock(plan)}
                  </s-stack>
                  <s-box paddingBlock="base">{planButton(plan.id, !IS_SHOPIFY_PLUS)}</s-box>
                  <s-divider />
                  <s-box paddingBlock="base">
                    <s-stack gap="base">
                      <StartText>{data.startText}</StartText>
                      {data.packages.map((item, i) => (
                        <PlanFeature key={i} item={item} />
                      ))}
                    </s-stack>
                  </s-box>
                </div>
              </div>
            );
          })}
        </div>

        <div className="more-pp-toggle">
          <s-button onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide pricing details' : 'Show pricing details'}
            <span className="more-pp-toggle__caret" aria-hidden="true">
              <s-icon type={expanded ? 'chevron-up' : 'chevron-down'} size="small" />
            </span>
          </s-button>
        </div>

        {expanded && (
          <PricingDetail
            chargeType={chargeType}
            isShopifyPlus={IS_SHOPIFY_PLUS}
            planButton={planButton}
          />
        )}
      </div>

      <DiscountModal open={discountOpen} onClose={() => setDiscountOpen(false)} />
      {/* Mounted per opening so the long lost-features body always starts scrolled to the top. */}
      {downgradeOpen && (
        <DowngradeModal
          currentPlanId={subscription.planId}
          planId={selectedPlanId}
          loading={loadingCharge === selectedPlanId}
          onCancel={() => setDowngradeOpen(false)}
          onConfirm={() => chargePlan(selectedPlanId)}
        />
      )}
    </s-page>
  );
}
