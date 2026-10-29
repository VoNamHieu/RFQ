import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { scopeLabel } from '../pricing.js';
import { LIMIT_KINDS } from '../limits.js';
import { versionSnapshot, agreementDatesLabel, fmtDay, termSettings, PAST_STATUSES } from '../agreements.js';
import { Fact, TermGroup, VersionTimeline } from './ContractParts.jsx';
import { Modal, wcTone } from '../../shared/wc.jsx';

const STATUS_TONE = { Active: 'success', Scheduled: 'info', Expired: undefined, Ended: undefined };

// One version of a contract, read-only, as its snapshot kept it — its terms as they
// were then — laid out like the company's Contract tab: key facts, the terms by kind,
// and the version history to move between versions. Opened from a company's Contract
// tab (version history, past contracts) and the Contracts list. Each pricing and
// limit opens to its settings as that version kept them (termSettings) — also once
// the contract has ended or expired. A contract that's over can be duplicated from
// here (`onDuplicate`) into a new one with its terms; open ones are duplicated from
// their row.
export function ContractVersionModal({ ag, version, onClose, onDuplicate }) {
  const { state } = useStore();
  const [shown, setShown] = useState(version ?? ag.version);
  const [opened, setOpened] = useState([]); // `${version}-${term id}` showing their settings
  const snap = versionSnapshot(ag, shown);
  const over = PAST_STATUSES.includes(ag.status) ? ag.history?.[0] : null;
  const toggle = (key) => setOpened((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  // A term as a row: its products (or what a limit sets), its priority (or the kind of
  // limit), and a chevron that opens its settings.
  const rowsOf = (items, isLimit) =>
    items.map((t) => {
      const key = `${shown}-${t.id}`;
      const open = opened.includes(key);
      // Kept with the version; a version kept before that reads it as it is now.
      const config = t.config || (isLimit ? state.db.limits || [] : state.db.policies).find((x) => x.id === t.id);
      return {
        key: t.id,
        name: t.name,
        detail: !config ? t.summary : isLimit ? t.summary : scopeLabel(config),
        side: !config ? null : isLimit ? LIMIT_KINDS[config.kind]?.label : `Priority ${config.priority ?? 0}`,
        onOpen: config ? () => toggle(key) : undefined,
        actions: config ? (
          <s-button
            variant="tertiary"
            icon={open ? 'chevron-up' : 'chevron-down'}
            accessibilityLabel={`${open ? 'Hide' : 'Show'} settings of ${t.name}`}
            onClick={() => toggle(key)}
          />
        ) : null,
        expanded: open && config ? <TermSettings sections={termSettings(state.db, config, isLimit)} /> : null,
      };
    });

  return (
    <Modal onClose={onClose} heading={`${ag.number} · ${snap?.name || ag.name}`} size="large">
      <s-stack gap="base">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone={wcTone(STATUS_TONE[ag.status])}>{over ? `${ag.status} ${fmtDay(over.date)}` : ag.status}</s-badge>
          <s-text color="subdued">{shown === ag.version ? 'Latest version' : `Version ${shown} of ${ag.version}`}</s-text>
        </s-stack>
        {snap ? (
          <s-query-container>
            <s-grid gridTemplateColumns="@container (inline-size > 480px) 1fr 1fr 1fr, 1fr" gap="small">
              <Fact icon="clock" label="Version" value={String(shown)} />
              <Fact icon="location" label="Applies to" value={snap.scope} />
              <Fact icon="calendar" label="Dates" value={agreementDatesLabel(snap)} />
            </s-grid>
          </s-query-container>
        ) : null}
        <s-query-container>
          <s-grid gridTemplateColumns="@container (inline-size > 640px) 2fr 1fr, 1fr" gap="large">
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
            <VersionTimeline history={ag.history || []} current={shown} onView={setShown} />
          </s-grid>
        </s-query-container>
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

// A pricing's or limit's settings, by section: each line, with its adjustment as a
// badge on the right. A long section (many rules, overrides or ranges) shows its first
// SETTINGS_SHOWN lines; Show all shows the rest, in order.
const SETTINGS_SHOWN = 5;
function TermSettings({ sections }) {
  const [all, setAll] = useState([]); // sections showing every line
  const flip = (label) => setAll((labels) => (labels.includes(label) ? labels.filter((l) => l !== label) : [...labels, label]));
  return (
    <s-box background="subdued" borderRadius="base" padding="small">
      <s-stack gap="small">
        {sections.map((sec) => (
          <s-stack key={sec.label} gap="small-300">
            <s-text color="subdued" fontSize="small" fontWeight="medium">
              {sec.label}
            </s-text>
            {(all.includes(sec.label) ? sec.items : sec.items.slice(0, SETTINGS_SHOWN)).map((it, i) => (
              <s-grid key={i} gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
                <s-stack gap="small-500">
                  <s-text color={it.subdued ? 'subdued' : undefined}>{it.text}</s-text>
                  {it.note ? (
                    <s-text color="subdued" fontSize="small">
                      {it.note}
                    </s-text>
                  ) : null}
                </s-stack>
                {it.badge ? <s-badge tone={wcTone(it.tone)}>{it.badge}</s-badge> : <span />}
              </s-grid>
            ))}
            {sec.items.length > SETTINGS_SHOWN ? (
              <div>
                <s-link onClick={() => flip(sec.label)}>{all.includes(sec.label) ? 'Show less' : `Show all (${sec.items.length})`}</s-link>
              </div>
            ) : null}
          </s-stack>
        ))}
      </s-stack>
    </s-box>
  );
}
