import React from 'react';
import { Modal } from '../../../shared/wc.jsx';

// production: features/Discount/components/List/DiscountDeleteModal.tsx
const DEFAULT_TITLE = 'Delete discount';
const DEFAULT_MESSAGE = 'Are you sure you want to delete this discount? This action cannot be undone.';

export function DiscountDeleteModal({ open, onClose, onConfirm, title = DEFAULT_TITLE, message = DEFAULT_MESSAGE }) {
  return (
    <Modal open={open} onClose={onClose} heading={title} size="small">
      <s-paragraph>{message}</s-paragraph>
      <s-button slot="primary-action" variant="primary" tone="critical" onClick={onConfirm}>
        Delete
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}
