import React from 'react';
import { Modal } from '../../shared/wc.jsx';
import { useStore, handoffToB2B } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/companies.js';

const ROLES = [
  { label: 'Ordering only', value: 'Ordering only' },
  { label: 'Location admin', value: 'Location admin' },
];
const PAYMENT_TERMS = ['No payment terms', 'Due on receipt', 'Net 15', 'Net 30', 'Net 60'].map((t) => ({ label: t, value: t }));
const ORDER_SUBMISSION = [
  { label: 'Buy directly', value: 'direct' },
  { label: 'Require merchant approval (draft)', value: 'draft' },
];

const locationsOf = (company) =>
  company
    ? company.locationList || (company.locationSummary && company.locationSummary !== 'Company location' ? [company.locationSummary] : [])
    : [];

const options = (list) =>
  list.map((o) => (
    <s-option key={o.value} value={o.value}>
      {o.label}
    </s-option>
  ));

export function SyncFlowModals() {
  const { state, dispatch } = useStore();
  const sf = state.syncFlow;
  if (!sf) return null;

  const quote = state.quotes[sf.quoteId];
  const isMember = quote?.syncMode === 'fixed'; // deterministic company (Case 1/2)
  const isIndependent = !isMember; // selector (Case 3/4)
  const company = sf.companyKey ? shopifyCompanyDirectory[sf.companyKey] : null;
  const alreadyInB2B = !!company?.inB2B;
  const buyer = quote?.customer?.name || 'the requester';

  const baseLocations = locationsOf(company);
  const allLocations = [...baseLocations, ...(sf.createdLocations || []).map((l) => l.name)];
  const locCount = allLocations.length || 1;
  const baseBuyers = company ? company.buyerList?.length ?? company.buyers ?? 1 : 0;
  const buyersPill = baseBuyers + (isIndependent && !alreadyInB2B ? 1 : 0);
  const companyAutoSyncs = !!(company?.autoSyncEnabled || state.autoSyncCompanies?.[sf.companyKey]);
  const isReco = isIndependent && !!sf.companyKey && sf.companyKey === quote?.recommendedKey;
  const showAssign = isIndependent; // location picker only for independent requesters

  // "D2C with history": the same requester (by email) has other quotes not yet tied
  // to a company. Those can be back-filled into B2B under this company — unless this
  // is a company switch (the requester already belongs to a different company), in
  // which case their history stays where it is and no back-fill is offered.
  const requesterEmail = (quote?.customer?.email || '').toLowerCase();
  const companyKeyOfQuote = (q) => q.syncedCompanyKey || q.linkedCompanyKey || null;
  const otherQuotes = requesterEmail
    ? Object.values(state.quotes).filter((q) => q.number !== sf.quoteId && (q.customer?.email || '').toLowerCase() === requesterEmail)
    : [];
  const existingCompanyKey = quote?.linkedCompanyKey || otherQuotes.map(companyKeyOfQuote).find(Boolean) || null;
  const isSwitch = !!existingCompanyKey && existingCompanyKey !== sf.companyKey;
  const pastD2CQuotes = otherQuotes.filter(
    (q) => !companyKeyOfQuote(q) && q.state !== 'linked' && q.state !== 'shopifySynced',
  );
  const showSyncPast = isIndependent && !isSwitch && pastD2CQuotes.length > 0;
  const syncPast = showSyncPast && sf.syncPast !== false; // default: checked (opt-out)

  const close = () => dispatch({ type: 'SYNC_CLOSE' });

  // ── Step 1: choose / confirm the company ───────────────────────────────────
  if (sf.step === 'sync') {
    const companyOptions = Object.entries(shopifyCompanyDirectory)
      .filter(([k]) => k !== 'testnoapp')
      .map(([k, c]) => ({ label: c.inB2B ? `${c.name} · Already in B2B app` : c.name, value: k }));
    const selectLabel = isReco
      ? `Recommended Shopify company${alreadyInB2B ? ' · already in B2B app' : ''}`
      : 'Shopify company';

    return (
      <Modal onClose={close} heading="Sync Shopify company to B2B">
        <s-stack gap="base">
          {/* Zone — the company to sync. */}
          {isMember ? (
            <s-stack gap="small">
              <s-stack gap="small-400">
                <s-text color="subdued" fontSize="small" fontWeight="medium">Company</s-text>
                <s-heading fontSize="large">{company?.name}</s-heading>
              </s-stack>
              <s-query-container>
                <s-grid gridTemplateColumns="@container (inline-size > 400px) 1fr 1fr 1fr, 1fr" gap="small">
                  <KvItem align="start" label="Shopify Company ID" value={company?.shopifyId} />
                  <KvItem align="center" label="Main contact" value={buyer} />
                  <KvItem align="end" label="Locations" value={`${locCount} location${locCount === 1 ? '' : 's'}`} />
                </s-grid>
              </s-query-container>
            </s-stack>
          ) : (
            // Independent: lead with the recommended company + signals; dropdown to change.
            <s-stack gap="small-200">
              <s-stack gap="small-500">
                <s-text color="subdued" fontSize="small" fontWeight="medium">{selectLabel}</s-text>
                {company ? <s-heading fontSize="large">{company.name}</s-heading> : null}
              </s-stack>
              {isReco && company?.signals?.length ? (
                <s-stack direction="inline" gap="small-400">
                  {company.signals.map((s) => (
                    <s-badge key={s} tone="info">{s}</s-badge>
                  ))}
                </s-stack>
              ) : null}
              <s-select
                label="Select a Shopify company"
                placeholder="Select a Shopify company…"
                value={sf.companyKey || ''}
                onChange={(e) => dispatch({ type: 'SYNC_PATCH', patch: { companyKey: e.currentTarget.value, location: '', createdLocations: [] } })}
              >
                {options(companyOptions)}
              </s-select>
            </s-stack>
          )}

          {/* Consequence of the sync. */}
          {company ? (
            <s-paragraph color="subdued" fontSize="small">
              {alreadyInB2B
                ? `Adds ${buyer} to ${company.name} in B2B. Existing company data won’t be re-synced.`
                : `Creates the full company in QuoteSnap B2B, including all ${locCount} location${locCount === 1 ? '' : 's'} and its buyers.`}
            </s-paragraph>
          ) : (
            <s-paragraph color="subdued" fontSize="small">
              Select the Shopify company this requester belongs to, or create a new one.
            </s-paragraph>
          )}

          {/* Zone 3 — create-company fallback (independent only; god file inline row). */}
          {isIndependent ? (
            <>
              <s-divider />
              <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
                <s-text color="subdued" fontSize="small">No suitable Shopify company?</s-text>
                <s-button onClick={() => dispatch({ type: 'OPEN_CREATE_COMPANY', quoteId: sf.quoteId })}>Create new company</s-button>
              </s-grid>
            </>
          ) : null}
        </s-stack>
        <s-button slot="primary-action" variant="primary" disabled={!company} onClick={() => dispatch({ type: 'SYNC_GOTO', step: 'review' })}>
          Review
        </s-button>
        <s-button slot="secondary-actions" onClick={close}>
          Cancel
        </s-button>
      </Modal>
    );
  }

  // ── Step 2a: create a new location (from the review step) ───────────────────
  if (sf.step === 'createLocation') {
    const nl = sf.newLocation || {};
    const patch = (p) => dispatch({ type: 'SYNC_LOCATION_PATCH', patch: p });
    return (
      <Modal onClose={close} heading="Create a location">
        <s-stack gap="small">
          <s-text-field label="Location name" value={nl.name || ''} onInput={(e) => patch({ name: e.currentTarget.value })} autocomplete="off" required />
          <s-text-field label="Location ID (optional)" value={nl.locationId || ''} onInput={(e) => patch({ locationId: e.currentTarget.value })} autocomplete="off" />
          <s-divider />
          <s-heading>Address</s-heading>
          <s-text-field label="Address" value={nl.address1 || ''} onInput={(e) => patch({ address1: e.currentTarget.value })} autocomplete="off" />
          <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="small">
            <s-text-field label="City" value={nl.city || ''} onInput={(e) => patch({ city: e.currentTarget.value })} autocomplete="off" />
            <s-text-field label="Postal code" value={nl.postal || ''} onInput={(e) => patch({ postal: e.currentTarget.value })} autocomplete="off" />
            <s-text-field label="Country" value={nl.country || ''} onInput={(e) => patch({ country: e.currentTarget.value })} autocomplete="off" />
            <s-text-field label="Phone" value={nl.phone || ''} onInput={(e) => patch({ phone: e.currentTarget.value })} autocomplete="off" />
          </s-grid>
          <s-divider />
          <s-select
            label="Order submission"
            value={nl.checkoutToDraft ? 'draft' : 'direct'}
            onChange={(e) => patch({ checkoutToDraft: e.currentTarget.value === 'draft' })}
          >
            {options(ORDER_SUBMISSION)}
          </s-select>
          <s-select label="Payment terms" value={nl.paymentTerms || 'No payment terms'} onChange={(e) => patch({ paymentTerms: e.currentTarget.value })}>
            {options(PAYMENT_TERMS)}
          </s-select>
        </s-stack>
        <s-button slot="primary-action" variant="primary" disabled={!(nl.name || '').trim()} onClick={() => dispatch({ type: 'SYNC_LOCATION_ADD' })}>
          Add location
        </s-button>
        <s-button slot="secondary-actions" onClick={() => dispatch({ type: 'SYNC_GOTO', step: 'review' })}>
          Back
        </s-button>
      </Modal>
    );
  }

  // ── Step 2: review + assign ────────────────────────────────────────────────
  if (sf.step === 'review') {
    const addBuyerOnly = isIndependent && alreadyInB2B; // Case 4
    const memberSync = isMember; // Case 1
    const title = addBuyerOnly ? `Add ${buyer} to ${company?.name}?` : `Sync ${company?.name} to B2B?`;
    const cta = addBuyerOnly ? 'Add buyer' : memberSync ? 'Sync company' : 'Sync company & add buyer';
    const banner = addBuyerOnly
      ? `${company?.name} is already in B2B — only ${buyer} will be added to the selected location. Existing company data won’t be re-synced.`
      : memberSync
        ? `Creates the full company in B2B, including all ${locCount} location${locCount === 1 ? '' : 's'} and existing buyers.`
        : `Syncs the whole company to B2B, then adds ${buyer} to the selected location.`;

    return (
      <Modal onClose={close} heading={title}>
        <s-stack gap="small">
          <s-banner tone={addBuyerOnly ? 'info' : 'success'}>{banner}</s-banner>
          <s-stack gap="small-300">
            <Kv label="Company" value={company?.name} />
            <Kv label="Company ID" value={String(company?.shopifyId || '')} />
            {memberSync ? (
              <Kv label="Assigned location" value={baseLocations[0] || company?.locationSummary || '—'} />
            ) : (
              <Kv label="Locations" value={allLocations.join(', ') || '—'} />
            )}
            <Kv label="Main contact" value={company?.mainContact} />
            <Kv label="Auto-sync future quotes" value={sf.autoSync ? 'On' : 'Off'} />
          </s-stack>

          {showAssign ? (
            <>
              <s-divider />
              <s-select
                label="Add buyer to location"
                value={sf.location || allLocations[0] || ''}
                onChange={(e) => dispatch({ type: 'SYNC_PATCH', patch: { location: e.currentTarget.value } })}
              >
                {options(allLocations.map((l) => ({ label: l, value: l })))}
              </s-select>
              <s-select label="Role" value={sf.role} onChange={(e) => dispatch({ type: 'SYNC_PATCH', patch: { role: e.currentTarget.value } })}>
                {options(ROLES)}
              </s-select>
              <s-box>
                <s-link onClick={() => dispatch({ type: 'SYNC_LOCATION_NEW' })}>+ Create new location</s-link>
              </s-box>
            </>
          ) : null}

          {showSyncPast ? (
            <>
              <s-divider />
              <s-checkbox
                label="Also sync past quotes"
                details="Add this customer’s past quotes to the B2B company and its quote history."
                checked={syncPast}
                onChange={(e) => dispatch({ type: 'SYNC_PATCH', patch: { syncPast: e.currentTarget.checked } })}
              />
            </>
          ) : null}
        </s-stack>
        <s-button slot="primary-action" variant="primary" onClick={() => dispatch({ type: 'SYNC_CONFIRM' })}>
          {cta}
        </s-button>
        <s-button slot="secondary-actions" onClick={() => dispatch({ type: 'SYNC_GOTO', step: 'sync' })}>
          Back
        </s-button>
      </Modal>
    );
  }

  // ── Step 3: success ────────────────────────────────────────────────────────
  return (
    <Modal size="small" onClose={close} heading={alreadyInB2B ? 'Buyer added' : 'Sync complete'}>
      <s-stack gap="small" alignItems="center">
        <s-badge tone="success">Done</s-badge>
        <div style={{ textAlign: 'center' }}>
          <s-text>
            {alreadyInB2B
              ? `${buyer} added to ${company?.name}${sf.location ? ` · ${sf.location}` : ''}.`
              : `${company?.name} is now managed in the B2B app${sf.location ? `, ${buyer} added to ${sf.location}` : ''}.`}
          </s-text>
        </div>
        {!alreadyInB2B ? (
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-badge>{`${locCount} location${locCount === 1 ? '' : 's'}`}</s-badge>
            <s-badge>{`${buyersPill} buyer${buyersPill === 1 ? '' : 's'}`}</s-badge>
          </s-stack>
        ) : null}
        {sf.backfilled > 0 ? (
          <div style={{ textAlign: 'center' }}>
            <s-text color="subdued" fontSize="small">
              {`${sf.backfilled} past quote${sf.backfilled === 1 ? '' : 's'} from ${buyer} also moved into B2B under ${company?.name}.`}
            </s-text>
          </div>
        ) : null}
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={() => handoffToB2B(state, sf.quoteId)}>
        View in B2B app
      </s-button>
      <s-button slot="secondary-actions" onClick={close}>
        Stay in RFQ
      </s-button>
    </Modal>
  );
}

function Kv({ label, value }) {
  return (
    <s-grid gridTemplateColumns="auto minmax(0, 1fr)" gap="base" alignItems="start">
      <s-paragraph color="subdued" fontSize="small">
        {label}
      </s-paragraph>
      <div style={{ textAlign: 'end', lineHeight: '16px' }}>
        <s-text fontSize="small">{value || '—'}</s-text>
      </div>
    </s-grid>
  );
}

// A key/value cell for the sync modal's company grid.
function KvItem({ label, value, align = 'start' }) {
  return (
    <div style={{ display: 'grid', gap: 2, textAlign: align }}>
      <div style={{ lineHeight: '16px' }}>
        <s-text color="subdued" fontSize="small">{label}</s-text>
      </div>
      <div>
        <s-text>{value || '—'}</s-text>
      </div>
    </div>
  );
}
