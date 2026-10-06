import React, { useState } from 'react';
import { Page, Card, BlockStack, InlineGrid, Text, TextField, Badge, Modal, InlineError, Box } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { kindOf, scopeLabel } from '../pricing.js';
import { limitSummary } from '../limits.js';
import { agreementChanges } from '../agreements.js';
import { PricingCombobox } from './PricingCombobox.jsx';
import { LocationScopePicker } from './LocationScopePicker.jsx';

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
    <Page
      title={saved ? `${draft.number} · ${saved.name}` : `New agreement ${draft.number}`}
      subtitle={company?.name}
      backAction={{ content: 'Agreements', onAction: close }}
      primaryAction={{ content: isActive ? `Save as version ${nextVersion}` : 'Activate', onAction: goLive }}
      secondaryActions={[...(isActive ? [] : [{ content: 'Save draft', onAction: saveDraft }]), { content: 'Cancel', onAction: close }]}
    >
      <InlineGrid columns={{ xs: '1fr', md: '2fr 1fr' }} gap="400" alignItems="start">
        <BlockStack gap="400">
          <Card>
            <TextField
              label="Agreement name"
              requiredIndicator
              value={draft.name}
              onChange={(v) => patch({ name: v })}
              error={shown('name')}
              placeholder="e.g. 2027 distributor terms"
              helpText="Buyers see this name in their account."
              autoComplete="off"
            />
          </Card>

          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Base pricing</Text>
                <PricingCombobox
                  label="Base pricing"
                  placeholder="Search base pricing"
                  candidates={bases}
                  selectedIds={draft.terms.base}
                  onChange={(ids) => setTerms({ base: ids })}
                  optionLabel={(p) => `${p.name} · Priority ${p.priority ?? 0}`}
                />
              </BlockStack>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Quantity pricing</Text>
                <PricingCombobox
                  label="Quantity pricing"
                  placeholder="Search quantity pricing"
                  candidates={quantities}
                  selectedIds={draft.terms.quantity}
                  onChange={(ids) => setTerms({ quantity: ids })}
                  optionLabel={(p) => `${p.name} · ${scopeLabel(p)}`}
                />
              </BlockStack>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Order limits</Text>
                <PricingCombobox
                  label="Order limits"
                  placeholder="Search order limits"
                  candidates={limits}
                  selectedIds={draft.terms.limits}
                  onChange={(ids) => setTerms({ limits: ids })}
                  optionLabel={(l) => `${l.name} · ${limitSummary(l, state.db)}`}
                  emptyText="No order limits to add. Store-wide limits already apply to every company."
                />
              </BlockStack>
              {shown('terms') && <InlineError message={errors.terms} fieldID="agreement-terms" />}
            </BlockStack>
          </Card>
        </BlockStack>

        <BlockStack gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Status</Text>
              <div><Badge tone={isActive ? 'success' : undefined}>{isActive ? `Active · version ${saved.version}` : 'Draft'}</Badge></div>
              <Text as="p" tone="subdued" variant="bodySm">
                {isActive
                  ? `Saving applies your changes to ${company?.name} right away, as version ${nextVersion}.`
                  : `Nothing is applied yet. Activate to give ${company?.name} these terms.`}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <LocationScopePicker company={company} locationIds={draft.locationIds} onChange={(ids) => patch({ locationIds: ids })} title="Applies to" />
              {shown('scope') && <InlineError message={errors.scope} fieldID="agreement-scope" />}
            </BlockStack>
          </Card>
        </BlockStack>
      </InlineGrid>
      <Box paddingBlockEnd="1600" />

      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(false)}
          title={isActive ? `Save ${draft.number} as version ${nextVersion}?` : `Activate ${draft.number}?`}
          primaryAction={{
            content: isActive ? 'Save and apply' : 'Activate',
            onAction: () => {
              setConfirm(false);
              dispatch({ type: 'SAVE_AGREEMENT', activate: true });
            },
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirm(false) }]}
        >
          <Modal.Section>
            <Text as="p">
              {isActive
                ? `${agreementChanges(saved, draft, state.db)}. ${company?.name} gets the new terms right away.`
                : `Its pricing and order limits are assigned to ${company?.name} right away.`}
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
