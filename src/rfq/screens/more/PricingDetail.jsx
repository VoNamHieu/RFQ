import React, { Fragment, useState } from 'react';
import { CHARGE_TYPE_YEARLY, DETAIL_SECTIONS, ID_PRO_PLAN, LIST_PLAN, PLAN_DATA } from './data.js';
import { PriceLabel, YearlyDiscount, planPrice } from './shared.jsx';

// "Show pricing details" — the Compare features table (production components/PricingPlan/detail.jsx).
function CheckMark() {
  return (
    <svg width="13" height="9" viewBox="0 0 13 9" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Included">
      <path
        d="M12.2559 0.244078C12.5814 0.569515 12.5814 1.09715 12.2559 1.42259L5.0337 8.64481C4.70826 8.97025 4.18063 8.97025 3.85519 8.64481L0.244078 5.0337C-0.0813592 4.70826 -0.0813592 4.18063 0.244078 3.85519C0.569515 3.52975 1.09715 3.52975 1.42259 3.85519L4.44444 6.87704L11.0774 0.244078C11.4028 -0.0813592 11.9305 -0.0813592 12.2559 0.244078Z"
        fill="#4A4A4A"
      />
    </svg>
  );
}

export function PricingDetail({ chargeType, planButton, isShopifyPlus }) {
  // Every section starts expanded; the header row collapses / expands it.
  const [expandedSections, setExpandedSections] = useState(() =>
    Object.fromEntries(DETAIL_SECTIONS.map((s) => [s.id, true])),
  );
  const toggleSection = (id) => setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="more-pp-detail">
      <div className="more-pp-detail__scroll">
        <table>
          <thead>
            <tr>
              <th className="more-pp-detail__first">Compare features</th>
              {LIST_PLAN.map(({ id, price, discount }) => (
                <th key={id} className="more-pp-detail__plan">
                  <div className="more-pp-detail__plan-inner">
                    <div className="more-pp-detail__plan-title">
                      <span className="more-pp-detail__plan-name">{PLAN_DATA[id].title}</span>
                      {id === ID_PRO_PLAN && <span className="more-pp-detail__recommend">Recommend</span>}
                    </div>
                    <div className="more-pp-detail__price-block">
                      <div className="more-pp-detail__price">
                        <PriceLabel value={planPrice(id, price, discount, chargeType)} perMonth />
                      </div>
                      {chargeType === CHARGE_TYPE_YEARLY && (
                        <YearlyDiscount planId={id} price={price} discount={discount} className="more-pp-detail__discount" />
                      )}
                      <div className="more-pp-detail__billing">
                        <s-text fontSize="small" color="subdued">
                          {chargeType === CHARGE_TYPE_YEARLY ? 'Billed yearly' : 'Billed monthly'}
                        </s-text>
                      </div>
                    </div>
                    <div className="more-pp-detail__cta">{planButton(id, !isShopifyPlus)}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DETAIL_SECTIONS.map((section) => (
              <Fragment key={section.id}>
                <tr className="more-pp-detail__section-row">
                  <td colSpan={LIST_PLAN.length + 1} className="more-pp-detail__section-cell">
                    <button
                      type="button"
                      className="more-pp-detail__section-toggle"
                      aria-expanded={!!expandedSections[section.id]}
                      onClick={() => toggleSection(section.id)}
                    >
                      <span className="more-pp-detail__section-title">{section.title}</span>
                      <span className={`more-pp-detail__section-icon${expandedSections[section.id] ? ' is-expanded' : ''}`}>
                        <s-icon type="caret-up" />
                      </span>
                    </button>
                  </td>
                </tr>
                {expandedSections[section.id] &&
                  section.features.map(([name, values], fi) => (
                    <tr key={`${section.id}-${fi}`} className="more-pp-detail__feature-row">
                      <td className="more-pp-detail__feature-name">{name}</td>
                      {LIST_PLAN.map(({ id }, pi) => {
                        const value = values[pi];
                        return (
                          <td key={id} className="more-pp-detail__feature-value">
                            {typeof value === 'boolean' ? (
                              <span className={`more-pp-detail__feature-icon ${value ? 'is-on' : 'is-off'}`}>
                                {value ? <CheckMark /> : '-'}
                              </span>
                            ) : (
                              <span>{value ?? '-'}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
