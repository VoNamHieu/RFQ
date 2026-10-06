import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../shared/wc.jsx';
import { useStore } from '../../store.jsx';
import { ID_STARTER_PLAN, PAID_PLAN_OPTIONS, PLAN_DATA, lostFeatures } from './data.js';

// "Add discount code" (production components/PricingPlan/ModalDiscountBfs.jsx).
export function DiscountModal({ open, onClose }) {
  const { dispatch } = useStore();
  const [plan, setPlan] = useState(ID_STARTER_PLAN);
  const [discountCode, setDiscountCode] = useState('');
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const reset = () => {
    setDiscountCode('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Production posts the code and redirects to Shopify's charge approval page.
  const handleSubmit = () => {
    setLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const planName = PLAN_DATA[plan].title;
      dispatch({ type: 'TOAST', message: `Opens Shopify's charge approval for the ${planName} plan in the full app` });
      handleClose();
    }, 500);
  };

  return (
    <Modal open={open} onClose={handleClose} heading="Add discount code" size="small">
      <s-stack gap="base">
        <s-select label="Select plan" value={String(plan)} onChange={(e) => setPlan(Number(e.currentTarget.value))}>
          {PAID_PLAN_OPTIONS.map((o) => (
            <s-option key={o.value} value={String(o.value)}>
              {o.label}
            </s-option>
          ))}
        </s-select>
        <s-text-field
          label="Discount code"
          value={discountCode}
          autocomplete="off"
          onInput={(e) => setDiscountCode(e.currentTarget.value)}
        />
      </s-stack>
      <s-button slot="primary-action" variant="primary" disabled={!discountCode.trim()} loading={loading} onClick={handleSubmit}>
        Add coupon
      </s-button>
    </Modal>
  );
}

// "Downgrade confirm" (production components/PricingPlan/ModalDowngradeBfs.jsx).
export function DowngradeModal({ open = true, currentPlanId, planId, loading, onCancel, onConfirm }) {
  const [agreeDowngrade, setAgreeDowngrade] = useState(false);
  const currentPlanName = (PLAN_DATA[currentPlanId]?.title || '').toUpperCase();
  const newPlanName = (PLAN_DATA[planId]?.title || '').toUpperCase();
  const lost = lostFeatures(currentPlanId, planId);

  const handleCancel = () => {
    setAgreeDowngrade(false);
    onCancel();
  };

  return (
    <Modal open={open} onClose={handleCancel} heading="Downgrade confirm">
      <div className="more-pp-downgrade">
        <div className="more-pp-downgrade__desc">
          When you downgrade to the <strong>{newPlanName}</strong> plan, some features in the{' '}
          <strong>{currentPlanName}</strong> plan (which are not included in <strong>{newPlanName}</strong> plan) will stop
          working on your store and <strong>return to the default settings.</strong>
        </div>
        <div className="more-pp-downgrade__warning">
          <span className="more-pp-downgrade__warning-icon">
            <s-icon type="alert-diamond" />
          </span>
          <span>
            <strong>You will lose all the {currentPlanName} plan settings including</strong>
          </span>
        </div>
        <div className="more-pp-downgrade__features">
          <s-stack gap="small-200">
            {lost.map((feature) => (
              <s-paragraph key={feature}>{feature}</s-paragraph>
            ))}
          </s-stack>
        </div>
      </div>
      <s-divider />
      <div className="more-pp-downgrade__actions">
        <div className="more-pp-downgrade__agree">
          <s-checkbox
            label="I have read and agreed to the downgrade changes"
            checked={agreeDowngrade}
            onChange={(e) => setAgreeDowngrade(e.currentTarget.checked)}
          />
        </div>
        <div className="more-pp-downgrade__buttons">
          <s-button onClick={handleCancel}>Cancel</s-button>
          <s-button variant="primary" tone="critical" loading={loading} disabled={!agreeDowngrade} onClick={onConfirm}>
            Confirm
          </s-button>
        </div>
      </div>
    </Modal>
  );
}
