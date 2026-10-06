import React from 'react';
import { CHARGE_TYPE_MONTHLY, CHARGE_TYPE_YEARLY, ID_FREE_PLAN } from './data.js';
import whatsappLogo from './assets/whatsapp.svg';
import salesforceLogo from './assets/salesforce.jpg';

export const LOGOS = { whatsapp: whatsappLogo, salesforce: salesforceLogo };

// Renders copy written with **bold** markers (the production <Trans components={{ bold }}> strings).
export function Rich({ text }) {
  const parts = String(text).split('**');
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>));
}

// Monthly price, or the yearly price per month after the plan's yearly discount.
export function planPrice(planId, price, discount, chargeType) {
  if (planId === ID_FREE_PLAN) return 0;
  return chargeType === CHARGE_TYPE_MONTHLY ? price : ((price * (100 - discount)) / 100).toFixed(2);
}

// "$19.99 /mo" — the "/mo" suffix only where the production label passes showTextMonth.
export function PriceLabel({ value, perMonth }) {
  return (
    <>
      ${value}{' '}
      {perMonth && <span className="more-pp-price__per">/mo</span>}
    </>
  );
}

// "(20% OFF $24.99)" under a yearly price; kept (invisible) on Free so the cards line up.
// The production "% OFF" Text has no variant, so it inherits the surrounding size and weight
// (11px bold inside the compare table header) — hence a native span rather than s-text.
export function YearlyDiscount({ planId, price, discount, className = 'more-pp-discount' }) {
  return (
    <span className={className} style={{ visibility: planId !== ID_FREE_PLAN ? 'visible' : 'hidden' }}>
      (<span className="more-pp-subdued">{discount}% OFF </span>
      <span className="more-pp-strike">
        <PriceLabel value={planPrice(planId, price, 0, CHARGE_TYPE_YEARLY)} />
      </span>
      )
    </span>
  );
}
