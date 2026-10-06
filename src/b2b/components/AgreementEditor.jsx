import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { kindOf, scopeLabel } from '../pricing.js';
import { limitSummary } from '../limits.js';
import { agreementChanges } from '../agreements.js';
import { PricingCombobox } from './PricingCombobox.jsx';
import { LocationScopePicker } from './LocationScopePicker.jsx';
import { Modal, PageHeader } from '../../shared/wc.jsx';

// Create / edit a company's agreement — an in-frame page in the Agreements view
// (OPEN_AGREEMENT_EDITOR). Terms are picked from the Pricing and Order limits
// libraries; who gets them is all of the company's locations or some. A draft is
// activated here; an active agreement saves as its next version, applied at once.
export function AgreementEditor() {
  const { state, dispatch } = useStore();
  const draft = state.agreementEditor.draft;
  const company = state.db.companies.find((c) => c.id === draft.companyId);
  const saved = (state.db.agreements || []).find((a) => a.id === draft.id);
  const isActive = saved?.status === 'Active';
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const patch = (p) => dispatch({ type: 'AGREEMENT_EDITOR_PATCH', patch: p });
  const setTerms = (p) => patch({ terms: { ...draft.terms, ...p } });
  const close = () => dispatch({ type: 'CLOSE_AGREEMENT_EDITOR' });

  const b2b = state.db.policies.filter((p) => p.audienceType !== 'd2c');
  const bases = b2b.filter((p) => kindOf(p) === 'base');
  const quantities = b2b.filter((p) => kindOf(p) === 'quantity');
  // Store-wide limits already reach every company, so they aren't offered here.
  const limits = (state.db.limits || []).filter((l) => !l.storeWide);

  const errors = {};
  if (!(draft.name || '').trim()) errors.name = 'Name is required';
  if (!draft.terms.base.length && !draft.terms.quantity.length && !draft.terms.limits.length) errors.terms = 'Add at least one pricing or order limit';
  if (Array.isArray(draft.locationIds) && !draft.locationIds.length) errors.scope = 'Pick at least one location';
  const valid = !Object.keys(errors).length;
  const shown = (k) => (tried ? errors[k] : undefined);

  // Activating, or saving a live agreement, changes what the company gets — confirm first.
  const goLive = () => (valid ? setConfirm(true) : setTried(true));
  const saveDraft = () => (valid || (draft.name || '').trim() ? dispatch({ type: 'SAVE_AGREEMENT' }) : setTried(true));
  const nextVersion = (saved?.version || 0) + 1;

  return (
    <>
    <PageHeader
      heading={saved ? `${draft.number} · ${saved.name}` : `New agreement ${draft.number}`}
      subtitle={company?.name}
      backAction={{ content: 'Agreements', onAction: close }}
      primaryAction={{ content: isActive ? `Save as version ${nextVersion}` : 'Activate', onAction: goLive }}
      secondaryActions={[...(isActive ? [] : [{ content: 'Save draft', onAction: saveDraft }]), { content: 'Cancel', onAction: close }]}
    />
    <s-page>
      <s-stack gap="base">
        <s-section>
          <s-text-field
            label="Agreement name"
            required
            value={draft.name}
            onInput={(e) => patch({ name: e.currentTarget.value })}
            error={shown('name')}
            placeholder="e.g. 2027 distributor terms"
            details="Buyers see this name in their account."
            autocomplete="off"
          />
        </s-section>

        <s-section>
          <s-stack gap="base">
            <s-stack gap="small-200">
              <s-heading>Base pricing</s-heading>
              <PricingCombobox
                label="Base pricing"
                placeholder="Search base pricing"
                candidates={bases}
                selectedIds={draft.terms.base}
                onChange={(ids) => setTerms({ base: ids })}
                optionLabel={(p) => `${p.name} · Priority ${p.priority ?? 0}`}
              />
            </s-stack>
            <s-stack gap="small-200">
              <s-heading>Quantity pricing</s-heading>
              <PricingCombobox
                label="Quantity pricing"
                placeholder="Search quantity pricing"
                candidates={quantities}
                selectedIds={draft.terms.quantity}
                onChange={(ids) => setTerms({ quantity: ids })}
                optionLabel={(p) => `${p.name} · ${scopeLabel(p)}`}
              />
            </s-stack>
            <s-stack gap="small-200">
              <s-heading>Order limits</s-heading>
              <PricingCombobox
                label="Order limits"
                placeholder="Search order limits"
                candidates={limits}
                selectedIds={draft.terms.limits}
                onChange={(ids) => setTerms({ limits: ids })}
                optionLabel={(l) => `${l.name} · ${limitSummary(l, state.db)}`}
                emptyText="No order limits to add. Store-wide limits already apply to every company."
              />
            </s-stack>
            {shown('terms') && (
              <s-paragraph tone="critical" id="agreement-terms">
                {errors.terms}
              </s-paragraph>
            )}
          </s-stack>
        </s-section>
      </s-stack>

      <s-section slot="aside" heading="Status">
        <s-stack gap="small-200">
          <div>
            <s-badge tone={isActive ? 'success' : undefined}>{isActive ? `Active · version ${saved.version}` : 'Draft'}</s-badge>
          </div>
          <s-paragraph color="subdued" fontSize="small">
            {isActive
              ? `Saving applies your changes to ${company?.name} right away, as version ${nextVersion}.`
              : `Nothing is applied yet. Activate to give ${company?.name} these terms.`}
          </s-paragraph>
        </s-stack>
      </s-section>
      <s-section slot="aside">
        <s-stack gap="small-200">
          <LocationScopePicker company={company} locationIds={draft.locationIds} onChange={(ids) => patch({ locationIds: ids })} title="Applies to" />
          {shown('scope') && (
            <s-paragraph tone="critical" id="agreement-scope">
              {errors.scope}
            </s-paragraph>
          )}
        </s-stack>
      </s-section>

      {confirm && (
        <Modal onClose={() => setConfirm(false)} heading={isActive ? `Save ${draft.number} as version ${nextVersion}?` : `Activate ${draft.number}?`}>
          <s-paragraph>
            {isActive
              ? `${agreementChanges(saved, draft, state.db)}. ${company?.name} gets the new terms right away.`
              : `Its pricing and order limits are assigned to ${company?.name} right away.`}
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setConfirm(false);
              dispatch({ type: 'SAVE_AGREEMENT', activate: true });
            }}
          >
            {isActive ? 'Save and apply' : 'Activate'}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirm(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-page>
    </>
  );
}
