import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { companyBaseEntries, companyQuantityEntries, locationOnlyEntries, policyStatus } from '../pricing.js';
import { contractGiving, contractOf, isContractTerm } from '../agreements.js';
import { SummaryHoverCard, pricingSummaryItems } from './SummaryHoverCard.jsx';
import { versionFlags } from '../../shared/versions.js';
import { SideBlock, SideRow, BLOCK_HELP, backTo } from './companyLayout.jsx';
import { openBuildFromQuotes } from './BuildFromQuotes.jsx';
import { MenuButton } from '../../shared/wc.jsx';

const PRICING_TYPES = [
  { id: 'base', content: 'Base pricing' },
  { id: 'quantity', content: 'Quantity pricing' },
  { id: 'contract', content: 'Contract pricing' },
];
// Chips shown before "+N more".
const PRICING_SHOWN = 4;

// A company's Pricing block in the page's side column: a type dropdown over
// names as chips (a few, then "+N more"), in the order they apply — a live contract's
// first, then by priority. The company's own pricing and pricing only some of its
// locations get. A name opens it in the editor (where "Who this pricing serves" picks
// the locations); hovering shows its status and settings. ⊕ offers Regular pricing (Select
// pricing type, then the pricing to add) or Convert from quotes (Build pricing from closed
// quotes); without the RFQ link (priceCrossSync) it opens Select pricing type straight away.
// Under the chips, Preview prices shows what its buyers pay (the price board); the
// title's link opens the Pricing library instead.
export function CompanyPricingCard({ company, onAddPricing }) {
  const { state, dispatch } = useStore();
  const [type, setType] = useState('base');
  const [all, setAll] = useState(false);
  const db = state.db;

  // The live contract giving an entry's pricing (on the company, or on its locations).
  const contractAt = (entry) =>
    entry.locations
      ? entry.locations.map((l) => contractGiving(db, company, entry.policy.id, l.id)).find(Boolean) || null
      : contractGiving(db, company, entry.policy.id);
  const inOrder = (a, b) => !!contractAt(b) - !!contractAt(a) || a.priority - b.priority;
  const bases = [...companyBaseEntries(company, db.policies), ...locationOnlyEntries(company, db.policies, 'base')].sort(inOrder);
  const quantities = [...companyQuantityEntries(company, db.policies), ...locationOnlyEntries(company, db.policies, 'quantity')].sort(inOrder);

  // A contract's own pricing goes by its contract here; any other by its own status,
  // as in the Pricing library.
  const statusOf = (entry) => {
    const p = entry.policy;
    if (isContractTerm(p)) {
      if (p.status === 'Inactive') return 'Inactive';
      if (contractAt(entry)) return 'Active';
      return contractOf(db, p.id)?.status === 'Scheduled' ? 'Scheduled' : 'Inactive';
    }
    return policyStatus(p, db).label;
  };

  const chip = (entry, kind) => {
    const p = entry.policy;
    const status = statusOf(entry);
    const off = status !== 'Active';
    const open = () => dispatch({ type: 'OPEN_EDITOR', policy: p, context: { mode: 'edit', companyId: company.id } });
    return (
      <SummaryHoverCard key={`${kind}-${p.id}`} title={p.name} status={status} items={() => pricingSummaryItems(p, db)}>
        {/* Active: green; otherwise grey, with its status (s-clickable-chip has neither
            fill, so a chip of our own). */}
        <button type="button" className={`cd-chip cd-chip--${off ? 'neutral' : 'success'}`} onClick={open}>
          {off ? `${p.name} · ${status}` : p.name}
        </button>
      </SummaryHoverCard>
    );
  };

  // One type per kind; a contract's own pricing (base or quantity) sits in Contract
  // pricing, a type only versions with Contracts have.
  const types = versionFlags().agreements ? PRICING_TYPES : PRICING_TYPES.filter((t) => t.id !== 'contract');
  const shownType = types.some((t) => t.id === type) ? type : 'base';
  const fromContract = (e) => isContractTerm(e.policy);
  const chips = {
    base: bases.filter((e) => !fromContract(e)).map((e) => chip(e, 'base')),
    quantity: quantities.filter((e) => !fromContract(e)).map((e) => chip(e, 'quantity')),
    contract: [...bases.filter(fromContract).map((e) => chip(e, 'base')), ...quantities.filter(fromContract).map((e) => chip(e, 'quantity'))],
  };
  // The first few, then "+N more"; all of them once opened up.
  const typeChips = chips[shownType];
  const shownChips = all ? typeChips : typeChips.slice(0, PRICING_SHOWN);
  const more = typeChips.length - shownChips.length;
  // No pricing of any type yet (the empty state): no type dropdown, just ⊕.
  const hasPricing = types.some((t) => chips[t.id].length);

  return (
    <SideBlock
      title="Pricing"
      info={BLOCK_HELP.pricing}
      actions={<s-link onClick={() => dispatch({ type: 'NAVIGATE', view: 'pricing', patch: { pricingCompany: company.id, backTo: backTo(state, 'pricing', company) } })}>View pricing library</s-link>}
    >
      <SideRow>
        <s-stack gap="small">
          {hasPricing ? (
            <s-select
              label="Pricing type"
              labelAccessibilityVisibility="exclusive"
              value={shownType}
              onChange={(e) => {
                setType(e.currentTarget.value);
                setAll(false);
              }}
            >
              {types.map((t) => (
                <s-option key={t.id} value={t.id}>{t.content}</s-option>
              ))}
            </s-select>
          ) : null}
          <s-stack direction="inline" gap="small-300" alignItems="center">
            {shownChips}
            {more > 0 ? (
              <s-clickable-chip accessibilityLabel={`Show ${more} more`} onClick={() => setAll(true)}>
                {`+${more} more`}
              </s-clickable-chip>
            ) : null}
            {all && typeChips.length > PRICING_SHOWN ? <s-link onClick={() => setAll(false)}>Show less</s-link> : null}
            {versionFlags().priceCrossSync ? (
              <MenuButton
                icon="plus-circle"
                variant="tertiary"
                accessibilityLabel="Add pricing"
                items={[
                  { content: 'Regular pricing', onAction: onAddPricing },
                  { content: 'Convert from quotes', onAction: () => openBuildFromQuotes(dispatch, company, db) },
                ]}
              />
            ) : (
              <s-button icon="plus-circle" variant="tertiary" accessibilityLabel="Add pricing" onClick={onAddPricing} />
            )}
          </s-stack>
          <div>
            <button type="button" className="cd-action-link" onClick={() => dispatch({ type: 'OPEN_PRICE_BOARD', companyId: company.id })}>
              <s-icon type="view" color="subdued" />
              Preview prices
            </button>
          </div>
        </s-stack>
      </SideRow>
    </SideBlock>
  );
}
