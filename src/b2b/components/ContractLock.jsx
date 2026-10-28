import React, { useState } from 'react';
import { Modal } from '../../shared/wc.jsx';
import { draftsHolding, contractNames, joinAnd } from '../agreements.js';

// Taking a pricing or limit off, turning it off or deleting it while live contracts
// hold it goes through those contracts. Its button stays: it opens this box, which
// says so — no list of contracts, no links, only Close.
// `showLock({ name, count, verb })` opens it; render `lockModal` once.
export function useContractLock() {
  const [lock, setLock] = useState(null);
  const lockModal = lock ? (
    <Modal onClose={() => setLock(null)} heading={`Can’t ${lock.verb} ${lock.name}`}>
      <s-paragraph>
        {lock.count === 1
          ? `It’s part of a live contract. To ${lock.verb} it, edit the contract.`
          : `It’s part of ${lock.count} live contracts. To ${lock.verb} it, edit those contracts.`}
      </s-paragraph>
      <s-button slot="secondary-actions" onClick={() => setLock(null)}>
        Close
      </s-button>
    </Modal>
  ) : null;
  return [setLock, lockModal];
}

// Switching a pricing or limit to D2C Wholesale takes it off the contracts holding it
// (`leaving`); `emptied` are the ones it's the last term of. Shown in the switch
// dialog of both editors.
// Only Inactive contracts (drafts) hold it: switching takes it off them, named here.
export function LeavingContracts({ db, leaving, emptied }) {
  if (!leaving.length) return null;
  const lead =
    leaving.length === 1
      ? `It’s in the Inactive contract ${contractNames(db, leaving)}, and switching takes it off that contract.`
      : `It’s in ${leaving.length} Inactive contracts: ${contractNames(db, leaving)}. Switching takes it off all of them.`;
  const left = emptied.length ? ` ${joinAnd(emptied.map((a) => a.number))} will have no terms left.` : '';
  return <s-paragraph>{`${lead}${left}`}</s-paragraph>;
}

// Live contracts hold it: switching to D2C Wholesale saves only as new (a new D2C
// copy with the changes; this one stays Company-based B2B, in the contracts and
// assigned as before, and no contract changes). `what`: 'pricing' or 'limit'. The
// editor adds the button.
export function SwitchToD2CAsNew({ db, name, what, held }) {
  const where = held.length === 1 ? 'the contract' : 'the contracts';
  return (
    <s-stack gap="small">
      <s-paragraph>{`${name} is part of ${contractNames(db, held)}.`}</s-paragraph>
      <s-paragraph>
        <s-text fontWeight="semibold">{`Save as new ${what}: `}</s-text>
        {`your changes go to a new D2C Wholesale ${what}. ${name} stays as it is: Company-based B2B, in ${where} and ${
          what === 'pricing' ? 'assigned to the same companies' : 'applying where it does now'
        }. No contract changes.`}
      </s-paragraph>
    </s-stack>
  );
}

// Deleting a pricing or limit takes it off the Inactive contracts holding it: its
// delete confirmation names them. (Turning one off doesn't — they keep it, and
// Activate warns.)
export function DraftsLosingIt({ db, id }) {
  const drafts = draftsHolding(db, id);
  if (!drafts.length) return null;
  return (
    <s-paragraph>
      {drafts.length === 1
        ? `It also comes off the Inactive contract ${contractNames(db, drafts)}.`
        : `It also comes off ${drafts.length} Inactive contracts: ${contractNames(db, drafts)}.`}
    </s-paragraph>
  );
}
