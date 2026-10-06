import React, { useEffect, useState } from 'react';

// Production: components/CustomerAccount/Translations.jsx — collapsible groups of
// required label fields; one group open at a time.

const L = (label, key) => ({ label, key });

export const TRANSLATION_SECTIONS = [
  { title: 'Page Translations', labels: [L('Label: Page title', 'page_title')] },
  {
    title: 'Quote Status Translations',
    labels: [
      L('Label: All', 'all'),
      L('Label: New Created', 'new_created'),
      L('Label: New Created By Admin', 'new_created_by_admin'),
      L('Label: Read', 'read'),
      L('Label: Deal Closed', 'deal_closed'),
      L('Label: Deal Rejected', 'deal_rejected'),
      L('Label: Trashed', 'trashed'),
      L('Label: Updated', 'updated'),
      L('Label: Quoted', 'quoted'),
      L('Label: Canceled', 'canceled'),
      L('Label: New Assigned', 'new_assigned'),
      L('Label: Submitted', 'submitted'),
      L('Label: Created', 'created'),
      L('Label: Received', 'received'),
      L('Label: Pending', 'pending'),
    ],
  },
  {
    title: 'Quote Log Translations',
    labels: [
      L('Label: Draft Order Created', 'draft_order_created'),
      L('Label: Draft Order Updated', 'draft_order_updated'),
      L('Label: Auto Confirmed', 'auto_confirmed'),
      L('Label: PDF Exported', 'pdf_exported'),
      L('Label: Email Sent', 'email_sent'),
    ],
  },
  {
    title: 'Action Translations',
    labels: [
      L('Label: Manage your quote list', 'manage_your_quote_list'),
      L('Label: View quote', 'view_quote'),
      L('Label: Quote request', 'quote_request'),
      L('Label: Export PDF', 'export_pdf'),
      L('Label: Export Quote', 'export_quote'),
      L('Label: Download File', 'download_file'),
      L('Label: Accept Quote', 'accept_quote'),
      L('Label: Reject Quote', 'reject_quote'),
      L('Label: More action', 'more_action'),
      L('Toast: Draft Order is created', 'draft_order_is_created'),
      L('Modal: Accept quote title', 'modal_accept_quote_title'),
      L('Modal: Accept quote', 'modal_accept_quote'),
      L('Modal: Reject quote title', 'modal_reject_quote_title'),
      L('Modal: Reject quote', 'modal_reject_quote'),
      L('Label: Reorder', 'reorder'),
      L('Toast: Reorder', 'reorder_toast'),
    ],
  },
  {
    title: 'Product Quote Translations',
    labels: [
      L('Label: Item', 'item'),
      L('Label: Items', 'items'),
      L('Label: Received by', 'received_by'),
      L('Label: Product Information', 'product_information'),
      L('Label: Price', 'price'),
      L('Label: SKU', 'sku'),
      L('Label: Variant', 'variant'),
      L('Label: Show details', 'show_details'),
    ],
  },
  {
    title: 'Quote Payment Translations',
    labels: [
      L('Label: Payment Information', 'payment_information'),
      L('Label: Subtotal', 'subtotal'),
      L('Label: Discount', 'discount'),
      L('Label: Shipping', 'shipping'),
      L('Label: Tax', 'tax'),
      L('Label: Total', 'total'),
    ],
  },
  {
    title: 'Customer Information Translations',
    labels: [
      L('Label: Customer Information', 'customer_information'),
      L('Label: Shipping address', 'shipping_address'),
      L('Label: Billing address', 'billing_address'),
      L('Label: Company', 'company'),
      L('Label: Payment terms', 'payment_terms'),
      L('Label: Due on fulfillment', 'due_on_fulfillment'),
      L('Label: Special note', 'special_note'),
    ],
  },
  {
    title: 'Others Translations',
    labels: [
      L('Label: Not found', 'not_found'),
      L('Label: Quote', 'quote'),
      L('Label: No quotes yet', 'no_quotes'),
      L('Label: Go to store to place quote.', 'go_to_store'),
    ],
  },
];

export function AccountTranslations({ value, errors, onChange, sections }) {
  const [open, setOpen] = useState(sections[0].title);

  // Open the group that holds the first field with an error (after a failed save).
  useEffect(() => {
    const firstKey = Object.keys(errors || {}).find((k) => errors[k]);
    if (!firstKey) return;
    const found = sections.find((s) => s.labels.some((l) => l.key === firstKey));
    if (found) setOpen(found.title);
  }, [errors, sections]);

  return (
    <s-section>
      <s-stack gap="small-200">
        {sections.map((section) => {
          const isOpen = open === section.title;
          return (
            <div key={section.title}>
              <div className="qcfg-collapse-head">
                <s-heading fontSize="large">{section.title}</s-heading>
                <s-button
                  icon={isOpen ? 'chevron-up' : 'chevron-down'}
                  accessibilityLabel={isOpen ? `Collapse ${section.title}` : `Expand ${section.title}`}
                  onClick={() => setOpen(isOpen ? '' : section.title)}
                />
              </div>
              {isOpen ? (
                <div>
                  {section.labels.map(({ label, key }, index) => (
                    <div key={key}>
                      {(index !== 0 && index % 5 === 0) || (key === 'reorder' && index !== 0) ? (
                        <s-box paddingBlockStart="large-200" paddingBlockEnd="base">
                          <s-divider />
                        </s-box>
                      ) : null}
                      <s-box paddingBlock="small-200">
                        <s-text-field
                          label={label}
                          required
                          autocomplete="off"
                          value={value[key] || ''}
                          error={errors?.[key]}
                          onInput={(e) => onChange(key, e.currentTarget.value)}
                          onBlur={(e) => {
                            const trimmed = e.currentTarget.value.trim();
                            if (trimmed !== e.currentTarget.value) onChange(key, trimmed);
                          }}
                        />
                      </s-box>
                    </div>
                  ))}
                </div>
              ) : null}
              <s-divider />
            </div>
          );
        })}
      </s-stack>
    </s-section>
  );
}
