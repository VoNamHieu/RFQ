import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { kindOf, scopeLabel } from '../pricing.js';
import { limitSummary, isD2CLimit, newConflicts } from '../limits.js';
import { LimitConflictList } from './LimitConflictList.jsx';
import { agreementChanges, limitsAfterAgreement, isLive, liveStatus, fmtDay } from '../agreements.js';
import { TODAY } from '../pricing.js';
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
  // Live = activated (Scheduled or Active); started = Active, so its start date is fixed.
  const live = isLive(saved);
  const started = saved?.status === 'Active';
  const startsLater = liveStatus(draft) === 'Scheduled';
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const patch = (p) => dispatch({ type: 'AGREEMENT_EDITOR_PATCH', patch: p });
  const setTerms = (p) => patch({ terms: { ...draft.terms, ...p } });
  const close = () => dispatch({ type: 'CLOSE_AGREEMENT_EDITOR' });

  const b2b = state.db.policies.filter((p) => p.audienceType !== 'd2c');
  const bases = b2b.filter((p) => kindOf(p) === 'base');
  const quantities = b2b.filter((p) => kindOf(p) === 'quantity');
  // Store-wide limits already reach every company and D2C ones never reach one, so
  // they aren't offered here.
  const limits = (state.db.limits || []).filter((l) => !l.storeWide && !isD2CLimit(l));

  const errors = {};
  if (!(draft.name || '').trim()) errors.name = 'Name is required';
  if (!draft.terms.base.length && !draft.terms.quantity.length && !draft.terms.limits.length) errors.terms = 'Add at least one pricing or order limit';
  if (Array.isArray(draft.locationIds) && !draft.locationIds.length) errors.scope = 'Pick at least one location';
  if (!draft.startDate) errors.startDate = 'Choose a start date';
  if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) errors.endDate = 'Must be after the start date';
  else if (draft.endDate && draft.endDate < TODAY) errors.endDate = 'This date has passed';
  const valid = !Object.keys(errors).length;
  const shown = (k) => (tried ? errors[k] : undefined);

  // Activating, or saving a live agreement, changes what the company gets — confirm first.
  const goLive = () => (valid ? setConfirm(true) : setTried(true));
  const saveDraft = () => (valid || (draft.name || '').trim() ? dispatch({ type: 'SAVE_AGREEMENT' }) : setTried(true));
  const nextVersion = (saved?.version || 0) + 1;
  // The order-limit conflicts going live would cause (the live version comes off first).
  const goLiveConflicts = confirm ? newConflicts(state.db, limitsAfterAgreement(state.db, { off: started ? saved : null, on: draft })) : [];
  const when = startsLater ? `on ${fmtDay(draft.startDate)}` : 'right away';
  const until = draft.endDate ? ` They come off after ${fmtDay(draft.endDate)}, unless you renew it.` : '';

  return (
    <>
    <PageHeader
      heading={saved ? `${draft.number} · ${saved.name}` : `New contract ${draft.number}`}
      subtitle={company?.name}
      backAction={{ content: 'Contracts', onAction: close }}
      primaryAction={{ content: live ? `Save as version ${nextVersion}` : 'Activate', onAction: goLive }}
      secondaryActions={[...(live ? [] : [{ content: 'Save draft', onAction: saveDraft }]), { content: 'Cancel', onAction: close }]}
    />
    <s-page>
      <s-stack gap="base">
        <s-section>
          <s-text-field
            label="Contract name"
            required
            value={draft.name}
            onInput={(e) => patch({ name: e.currentTarget.value })}
            error={shown('name')}
            placeholder="e.g. 2027 distributor terms"
            details="Buyers see this name in their account."
            autocomplete="off"
          />
        </s-section>

        <s-section heading="Dates">
          <s-stack gap="small">
            <s-query-container>
              <s-grid gridTemplateColumns="@container (inline-size > 400px) 1fr 1fr, 1fr" gap="small">
                {/* Date fields commit on change (typing emits partial dates on input). */}
                <s-date-field
                  label="Start date"
                  value={draft.startDate || ''}
                  disabled={started}
                  onChange={(e) => patch({ startDate: e.currentTarget.value })}
                  error={shown('startDate')}
                  details={started ? 'It has started, so this can’t change.' : undefined}
                />
                <s-date-field
                  label="End date"
                  value={draft.endDate || ''}
                  onChange={(e) => patch({ endDate: e.currentTarget.value })}
                  error={errors.endDate}
                  details="Leave empty for no end date."
                />
              </s-grid>
            </s-query-container>
            <s-paragraph color="subdued" fontSize="small">
              {`It starts and ends on its own. After the end date, ${company?.name} goes back to the pricing and limits outside the contract.`}
            </s-paragraph>
          </s-stack>
        </s-section>

        <s-section>
          <s-stack gap="base">
            <s-stack gap="small-200">
              <s-heading>Base pricing</s-heading>
              <PricingCombobox
                label="Base pricing"
                labelHidden
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
                labelHidden
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
                labelHidden
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
            <s-badge tone={started ? 'success' : live ? 'info' : undefined}>{live ? `${saved.status} · version ${saved.version}` : 'Draft'}</s-badge>
          </div>
          <s-paragraph color="subdued" fontSize="small">
            {live
              ? `Saving gives ${company?.name} your changes ${when}, as version ${nextVersion}.`
              : `Nothing is applied yet. Activate to give ${company?.name} these terms ${startsLater ? `from ${fmtDay(draft.startDate)}` : 'right away'}.`}
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
        <Modal onClose={() => setConfirm(false)} heading={live ? `Save ${draft.number} as version ${nextVersion}?` : `Activate ${draft.number}?`}>
          <s-stack gap="small">
            <s-paragraph>
              {live
                ? `${agreementChanges(saved, draft, state.db)}. ${company?.name} gets the new terms ${when}.${until}`
                : `Its pricing and order limits are assigned to ${company?.name} ${when}.${until}`}
            </s-paragraph>
            {goLiveConflicts.length ? (
              <>
                <s-paragraph>{startsLater ? 'When it starts, these order limits conflict:' : 'After this, these order limits conflict:'}</s-paragraph>
                <LimitConflictList conflicts={goLiveConflicts} />
              </>
            ) : null}
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setConfirm(false);
              dispatch({ type: 'SAVE_AGREEMENT', activate: true });
            }}
          >
            {live ? 'Save and apply' : 'Activate'}
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
