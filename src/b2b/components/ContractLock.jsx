import React, { useState } from 'react';
import { Modal } from '../../shared/wc.jsx';

// Deleting a contract pricing or limit — or taking one off a company or location —
// while running contracts hold it goes through those contracts. Its button stays: it
// opens this box, which says so — no list of contracts, no links, only Close.
// `showLock({ name, count, verb, message })` opens it (`message`: its own line instead,
// e.g. where it comes from); render `lockModal` once.
export function useContractLock() {
  const [lock, setLock] = useState(null);
  const lockModal = lock ? (
    <Modal onClose={() => setLock(null)} heading={`Can’t ${lock.verb} ${lock.name}`}>
      <s-paragraph>
        {lock.message ||
          (lock.count === 1
            ? 'It’s in 1 running contract. Remove it from that contract first.'
            : `It’s in ${lock.count} running contracts. Remove it from those contracts first.`)}
      </s-paragraph>
      <s-button slot="secondary-actions" onClick={() => setLock(null)}>
        Close
      </s-button>
    </Modal>
  ) : null;
  return [setLock, lockModal];
}
