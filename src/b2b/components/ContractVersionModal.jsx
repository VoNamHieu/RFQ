import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { versionSnapshot, agreementDatesLabel, fmtDay, termSettings, termSummary, PAST_STATUSES } from '../agreements.js';
import { TermGroup, VersionTimeline, PriorityNumber } from './ContractParts.jsx';
import { Modal, wcTone } from '../../shared/wc.jsx';

const STATUS_TONE = { Active: 'success', Scheduled: 'info', Expired: undefined, Ended: undefined };

// One version of a contract, read-only, as its snapshot kept it — its terms as they
// were then. Under the title one line says where it stands, which version (a
// dropdown to pick another), where it applied — of which company — and its dates. The terms are listed by kind: each pricing or limit with
// what it does in one line (its priority as a number before it), opening to its
// settings as that version kept them (termSettings) — also once the contract has
// ended or expired. The version history sits beside them only when there's more than
// one version. Opened from a company's Contract tab (version history, past contracts),
// the Contracts list and the contract editor. A contract that's over can be
// duplicated from here (`onDuplicate`) into a new one with its terms; open ones are
// duplicated from their row.
export function ContractVersionModal({ ag, version, onClose, onDuplicate }) {
  const { state } = useStore();
  const [shown, setShown] = useState(version ?? ag.version);
  const [opened, setOpened] = useState([]); // `${version}-${term id}` showing their settings
  const snap = versionSnapshot(ag, shown);
  const over = PAST_STATUSES.includes(ag.status) ? ag.history?.[0] : null;
  const toggle = (key) => setOpened((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  const withHistory = (ag.version || 0) > 1;
  // The versions it kept, newest first, to pick from in a dropdown, and where this one
  // applied — of which company.
  const versions = [...new Set((ag.history || []).filter((h) => h.snapshot).map((h) => h.version))].sort((a, b) => b - a);
  const company = (state.db.companies || []).find((c) => c.id === ag.companyId);
  const where = snap?.scope && company ? `${snap.scope} of ${company.name}` : snap?.scope;
  // Kept with the version; a version kept before that reads it as it is now.
  const configOf = (t, isLimit) => t.config || (isLimit ? state.db.limits || [] : state.db.policies).find((x) => x.id === t.id);
  // A term as a row: its priority (pricing, lowest first), name, what it does, and a
  // chevron that opens its settings.
  const rowsOf = (items, isLimit) =>
    (isLimit ? items : [...items].sort((a, b) => (configOf(a)?.priority ?? 0) - (configOf(b)?.priority ?? 0))).map((t) => {
      const key = `${shown}-${t.id}`;
      const open = opened.includes(key);
      const config = configOf(t, isLimit);
      return {
        key: t.id,
        name: t.name,
        detail: config ? termSummary(state.db, config, isLimit) : t.summary,
        lead: config && !isLimit ? <PriorityNumber value={config.priority ?? 0} /> : null,
        onOpen: config ? () => toggle(key) : undefined,
        actions: config ? (
          <s-button
            variant="tertiary"
            icon={open ? 'chevron-up' : 'chevron-down'}
            accessibilityLabel={`${open ? 'Hide' : 'Show'} settings of ${t.name}`}
            onClick={() => toggle(key)}
          />
        ) : null,
        // Lined up with the name, past a pricing's priority number.
        expanded:
          open && config ? (
            <div style={{ paddingInlineStart: isLimit ? 0 : 36 }}>
              <TermSettings sections={termSettings(state.db, config, isLimit)} />
            </div>
          ) : null,
      };
    });
  const terms = (
    <s-stack gap="small">
      <s-heading>Terms</s-heading>
      {snap ? (
        <>
          <TermGroup icon="receipt-dollar" title="Base pricing" rows={rowsOf(snap.base, false)} />
          <TermGroup icon="discount" title="Quantity pricing" rows={rowsOf(snap.quantity, false)} />
          <TermGroup icon="order" title="Order limits" rows={rowsOf(snap.limits, true)} />
        </>
      ) : (
        <s-paragraph color="subdued">This version’s terms weren’t recorded.</s-paragraph>
      )}
    </s-stack>
  );

  return (
    <Modal onClose={onClose} heading={`${ag.number} · ${snap?.name || ag.name}`} size="large">
      <s-stack gap="base">
        {/* Status and dates, then where it applies and the version: two by two in a
            box, a label over each. */}
        <s-box border="base" borderRadius="base" padding="base">
          <s-query-container>
            <s-grid gridTemplateColumns="@container (inline-size > 480px) 3fr 2fr, 1fr" gap="base" alignItems="start">
              <Info label="Status">
                <div>
                  <s-badge tone={wcTone(STATUS_TONE[ag.status])}>{over ? `${ag.status} ${fmtDay(over.date)}` : ag.status}</s-badge>
                </div>
              </Info>
              <Info label="Dates">
                <s-text fontWeight="semibold">{snap ? agreementDatesLabel(snap, ' to ') : '—'}</s-text>
              </Info>
              <Info label="Applies to">
                <s-text fontWeight="semibold">{where || '—'}</s-text>
              </Info>
              <Info label="Version">
                {versions.length ? (
                  <div style={{ width: 200, maxWidth: '100%' }}>
                    <s-select label="Version" labelAccessibilityVisibility="exclusive" value={String(shown)} onChange={(e) => setShown(Number(e.currentTarget.value))}>
                      {versions.map((v) => (
                        <s-option key={v} value={String(v)}>
                          {`Version ${v}${v === ag.version ? ' (latest)' : ''}`}
                        </s-option>
                      ))}
                    </s-select>
                  </div>
                ) : (
                  <s-text fontWeight="semibold">{`Version ${shown}`}</s-text>
                )}
              </Info>
            </s-grid>
          </s-query-container>
        </s-box>
        {withHistory ? (
          <s-query-container>
            <s-grid gridTemplateColumns="@container (inline-size > 640px) 2fr 1fr, 1fr" gap="large">
              {terms}
              <VersionTimeline history={ag.history || []} current={shown} onView={setShown} />
            </s-grid>
          </s-query-container>
        ) : (
          terms
        )}
      </s-stack>
      {onDuplicate && PAST_STATUSES.includes(ag.status) ? (
        <s-button slot="primary-action" variant="primary" onClick={() => onDuplicate(ag)}>
          Duplicate
        </s-button>
      ) : null}
      <s-button slot="secondary-actions" onClick={onClose}>
        Close
      </s-button>
    </Modal>
  );
}

// One fact in the line under the title: a small label over its value.
function Info({ label, children }) {
  return (
    <s-stack gap="small-400">
      <s-text color="subdued" fontSize="small">
        {label}
      </s-text>
      {children}
    </s-stack>
  );
}

// A pricing's or limit's settings, a block per section (Pricing rules, Product
// overrides…), laid out like the term groups: a header, then each line with its value on
// the right, in plain text (color is kept for status). A long section (many rules,
// prices or ranges) shows its first SETTINGS_SHOWN lines; Show all shows the rest, in
// order.
const SETTINGS_SHOWN = 5;
function TermSettings({ sections }) {
  const [all, setAll] = useState([]); // sections showing every line
  const flip = (label) => setAll((labels) => (labels.includes(label) ? labels.filter((l) => l !== label) : [...labels, label]));
  const line = (children) => (
    <>
      <s-divider />
      <s-box paddingBlock="small-300" paddingInline="small">
        {children}
      </s-box>
    </>
  );
  return (
    <s-stack gap="small">
      {sections.map((sec) => (
        <s-box key={sec.label} border="base" borderRadius="base" overflow="hidden">
          <s-box background="subdued" paddingBlock="small-300" paddingInline="small">
            <s-text fontWeight="medium">{sec.label}</s-text>
          </s-box>
          {(all.includes(sec.label) ? sec.items : sec.items.slice(0, SETTINGS_SHOWN)).map((it, i) => (
            <React.Fragment key={i}>
              {line(
                <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="start">
                  <s-stack gap="small-500">
                    <s-text>{it.text}</s-text>
                    {it.note ? (
                      <s-text color="subdued" fontSize="small">
                        {it.note}
                      </s-text>
                    ) : null}
                  </s-stack>
                  {it.value ? <s-text fontWeight="medium">{it.value}</s-text> : <span />}
                </s-grid>,
              )}
            </React.Fragment>
          ))}
          {sec.items.length > SETTINGS_SHOWN
            ? line(<s-link onClick={() => flip(sec.label)}>{all.includes(sec.label) ? 'Show less' : `Show all (${sec.items.length})`}</s-link>)
            : null}
        </s-box>
      ))}
    </s-stack>
  );
}
