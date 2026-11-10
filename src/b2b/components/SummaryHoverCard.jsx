import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { baseInScope, kindOf, policyPriceBreakdown, policyUsage, scopeLabel, basePricingProductsLabel, basePricingCalculationLabel } from '../pricing.js';
import { LIMIT_KINDS, limitTargetsLabel } from '../limits.js';
import { agreementAppliesToLabel, agreementDatesLabel, agreementScopeLabel, contractOf, isContractTerm } from '../agreements.js';
import { useWcId, wcTone } from '../../shared/wc.jsx';
import './SummaryHoverCard.css';

// Hovering (or focusing) a chip on the location page opens a card above the page:
// the name and status, then a summary of its settings — a pricing's as the pricing
// editor's Settings summary lists them, a limit's as the Order limits list and its
// editor name them, a contract's as the contract editor's Overview. The card stays open while the pointer moves onto it; a click,
// Escape or a scroll closes it.

const STATUS_TONE = { Active: 'success', Scheduled: 'info', Upcoming: 'info' };
const SHOW_DELAY = 250;
const HIDE_DELAY = 150;
const CARD_WIDTH = 300;
const GAP = 6;
const EDGE = 8;

const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

// A pricing: the editor's Settings summary rows, for a saved pricing.
export function pricingSummaryItems(policy, db) {
  const isQuantity = kindOf(policy) === 'quantity';
  const forContracts = isContractTerm(policy);
  const ranges = (policy.volumeRanges || []).length;
  const calculation = isQuantity ? count(ranges, 'quantity range') : basePricingCalculationLabel(policy, db.products || []);
  const hasEnd = (policy.hasEndDate ?? !!policy.endDate) && !!policy.endDate;
  const contract = forContracts ? contractOf(db, policy.id) : null;
  return [
    ['receipt-dollar', 'Type', isQuantity ? 'Quantity pricing' : 'Base pricing'],
    ['product', 'Products', isQuantity ? scopeLabel(policy) : basePricingProductsLabel(policy, db.products || [])],
    ['discount', 'Calculation', calculation],
    ['markets', 'Markets', 'All markets'],
    forContracts ? null : ['team', 'Serves', policy.audienceType === 'd2c' ? 'D2C Wholesale' : 'Company-based B2B'],
    ['person', 'Assigned to', contract ? `Contract ${contract.number}` : policyUsage(policy, db)],
    ['star', 'Priority', String(policy.priority ?? 0)],
    forContracts ? null : ['calendar', 'Start', policy.startDate ? `${dayLabel(policy.startDate)} ${policy.startTime || '12:00 AM'}` : 'Immediately'],
    hasEnd && !forContracts ? ['calendar', 'End', `${dayLabel(policy.endDate)} ${policy.endTime || '12:00 AM'}`] : null,
  ].filter(Boolean);
}

// A limit at a location (a locationLimits row): its type, what it sets (an order
// limit's order value and quantity, a product limit's rules), who it applies to and
// its dates. Where a contract gives it, the contract decides who and when.
export function limitSummaryItems({ limit, rules, contract }, db) {
  const texts = (fields) => rules.filter((r) => fields.includes(r.field)).map((r) => r.text);
  const sets =
    limit.kind === 'product'
      ? [['product', 'Rules', rules.map((r) => r.text)]]
      : [
          ['receipt-dollar', 'Order value', texts(['minValue', 'maxValue'])],
          ['order', 'Order quantity', texts(['minQty', 'maxQty'])],
        ];
  const set = sets.filter(([, , v]) => v.length);
  return [
    ['note', 'Type', LIMIT_KINDS[limit.kind].label],
    ...(set.length ? set : [[sets[0][0], sets[0][1], 'No limit set']]),
    ['location', 'Applies to', contract ? `Contract ${contract}` : limitTargetsLabel(limit, db)],
    contract ? null : ['calendar', 'Start', limit.startDate ? dayLabel(limit.startDate) : 'Immediately'],
    !contract && limit.endDate ? ['calendar', 'End', dayLabel(limit.endDate)] : null,
  ].filter(Boolean);
}

// A contract: the contract editor's Overview rows, for a saved contract. Its products
// are the ones its pricing covers (as the editor counts them).
export function contractSummaryItems(ag, company, db) {
  const pricing = [...ag.terms.base, ...ag.terms.quantity].map((id) => (db.policies || []).find((p) => p.id === id)).filter(Boolean);
  const covers = (p, product) => (kindOf(p) === 'base' ? baseInScope(p, product.sku) : policyPriceBreakdown(p, product)?.inScope);
  const covered = (db.products || []).filter((product) => pricing.some((p) => covers(p, product)));
  return [
    ['organization', 'Company', company.name],
    ['location', 'Applies to', agreementScopeLabel(company, ag) ? agreementAppliesToLabel(company, ag) : 'No locations'],
    ['calendar', 'Dates', agreementDatesLabel(ag)],
    ['receipt-dollar', 'Pricing', `${ag.terms.base.length} base · ${ag.terms.quantity.length} quantity`],
    ['order', 'Order limits', count(ag.terms.limits.length, 'limit')],
    ['product', 'Products', count(covered.length, 'product')],
  ];
}

// `items`: called when the card opens; rows of [icon, label, value], where value is
// a string or a list of lines. `width`: the card's width (it fits the window).
export function SummaryHoverCard({ title, status, items, width = CARD_WIDTH, children }) {
  const id = useWcId('summary-card');
  const anchorRef = useRef(null);
  const cardRef = useRef(null);
  const timer = useRef(null);
  const pressed = useRef(false);
  const [pos, setPos] = useState(null);

  const clear = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };
  const show = () => {
    clear();
    timer.current = setTimeout(() => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.min(width, window.innerWidth - 2 * EDGE);
      const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - w - EDGE));
      setPos({ top: r.bottom + GAP, left, width: w, anchorTop: r.top });
    }, SHOW_DELAY);
  };
  const hide = (now) => {
    clear();
    if (now) setPos(null);
    else timer.current = setTimeout(() => setPos(null), HIDE_DELAY);
  };

  // No room below the chip: open above it instead.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!pos || !card) return;
    const h = card.offsetHeight;
    if (pos.top + h > window.innerHeight - EDGE && pos.anchorTop - GAP - h >= EDGE) {
      card.style.top = `${pos.anchorTop - GAP - h}px`;
    }
  }, [pos]);

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => hide(true);
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  useEffect(() => clear, []);

  return (
    <>
      <span
        ref={anchorRef}
        className="qs-summary-hover"
        onMouseEnter={show}
        onMouseLeave={() => hide(false)}
        // Focus opens it from the keyboard only: a click opens the chip's editor instead.
        onFocus={() => {
          if (!pressed.current) show();
        }}
        onBlur={() => {
          pressed.current = false;
          hide(true);
        }}
        onPointerDown={() => {
          pressed.current = true;
          hide(true);
        }}
      >
        {children}
      </span>
      {pos
        ? createPortal(
            <div
              ref={cardRef}
              id={id}
              role="tooltip"
              className="qs-summary-hovercard"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              onMouseEnter={clear}
              onMouseLeave={() => hide(false)}
            >
              <s-stack gap="small">
                <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
                  <s-text fontWeight="semibold">{title}</s-text>
                  {status ? <s-badge tone={wcTone(STATUS_TONE[status])}>{status}</s-badge> : null}
                </s-grid>
                <s-divider />
                <s-stack gap="small-300">
                  {items().map(([icon, label, value]) => (
                    <s-grid key={label} gridTemplateColumns="auto 88px minmax(0, 1fr)" gap="small-200" alignItems="start">
                      <s-icon type={icon} color="subdued" />
                      <s-text color="subdued">{`${label}:`}</s-text>
                      {Array.isArray(value) ? (
                        <s-stack gap="small-500">
                          {value.map((line, i) => (
                            <s-text key={i}>{line}</s-text>
                          ))}
                        </s-stack>
                      ) : (
                        <s-text>{value}</s-text>
                      )}
                    </s-grid>
                  ))}
                </s-stack>
              </s-stack>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
