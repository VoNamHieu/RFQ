import React, { useState } from 'react';
import { versionSnapshot, agreementDatesLabel, fmtDay, PAST_STATUSES } from '../agreements.js';
import { Modal } from '../../shared/wc.jsx';

// One version of a contract, read-only, as its snapshot kept it — its terms as they
// were then — with the version history to move between versions. Opened from a
// company's Contract tab (version history, past contracts) and the Contracts list.
export function ContractVersionModal({ ag, version, onClose }) {
  const [shown, setShown] = useState(version ?? ag.version);
  const snap = versionSnapshot(ag, shown);
  const over = PAST_STATUSES.includes(ag.status) ? ag.history?.[0] : null;
  const terms = (title, items) => (
    <s-stack gap="small-200">
      <s-heading>{title}</s-heading>
      {items.length ? (
        items.map((t) => (
          <s-stack key={t.id} gap="small-500">
            <s-text>{t.name}</s-text>
            <s-text color="subdued" fontSize="small">
              {t.summary}
            </s-text>
          </s-stack>
        ))
      ) : (
        <s-paragraph color="subdued">None</s-paragraph>
      )}
    </s-stack>
  );

  return (
    <Modal onClose={onClose} heading={`${ag.number} · version ${shown}`}>
      <s-stack gap="base">
        <s-paragraph color="subdued">
          {[
            snap?.name || ag.name,
            shown === ag.version ? 'latest version' : `version ${shown} of ${ag.version}`,
            over ? `${ag.status} ${fmtDay(over.date)}` : ag.status,
          ].join(' · ')}
        </s-paragraph>
        {snap ? (
          <>
            <s-paragraph>{`Applies to ${snap.scope} · ${agreementDatesLabel(snap)}`}</s-paragraph>
            {terms('Base pricing', snap.base)}
            {terms('Quantity pricing', snap.quantity)}
            {terms('Order limits', snap.limits)}
          </>
        ) : (
          <s-paragraph color="subdued">This version’s terms weren’t recorded.</s-paragraph>
        )}
        <s-divider />
        <s-stack gap="small-200">
          <s-heading>Version history</s-heading>
          {(ag.history || []).map((h, i) => (
            <s-grid key={i} gridTemplateColumns="1fr auto" alignItems="center" gap="small">
              {h.snapshot && h.version !== shown ? (
                <s-link onClick={() => setShown(h.version)}>{`Version ${h.version} · ${h.note}`}</s-link>
              ) : (
                <s-text fontWeight={h.snapshot ? 'semibold' : undefined}>{`Version ${h.version} · ${h.note}`}</s-text>
              )}
              <s-text color="subdued" fontSize="small">
                {fmtDay(h.date)}
              </s-text>
            </s-grid>
          ))}
        </s-stack>
      </s-stack>
      <s-button slot="secondary-actions" onClick={onClose}>
        Close
      </s-button>
    </Modal>
  );
}
