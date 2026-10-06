import React, { useState } from 'react';
import { ChoiceGroup, StoreModeSwitch } from './parts.jsx';
import { useWcId } from '../../../shared/wc.jsx';

// "Hide Add To Cart button" / "Hide Buy Now button" tabs — production
// components/CollectQuote/HideAddCart/index.jsx (page = hide_add_cart | hide_buy_now).

export function HideButtonsTab({ page, settings, onChange, mode, onModeChange }) {
  const tipId = useWcId('qset-behaviors');
  // Local state in production: the notice comes back whenever the tab is reopened.
  const [showNotice, setShowNotice] = useState(true);
  const cfg = settings[page];
  const isAtc = page === 'hide_add_cart';

  const setField = (field, value) => onChange({ ...settings, [page]: { ...cfg, [field]: value } });

  const setChoice = (field, raw) => {
    const value = field === 'atc_behavior' ? raw : Number(raw);
    const next = { ...cfg, [field]: value };
    if (isAtc && ((field === 'hide' && value === 0) || (field === 'display_logic' && value === 1))) {
      next.atc_behavior = 'not_required';
      next.use_inventory_threshold = 0;
    }
    if (isAtc && field === 'atc_behavior' && value !== 'quantity_threshold') next.use_inventory_threshold = 0;
    onChange({ ...settings, [page]: next });
  };

  const threshold = cfg.atc_behavior === 'quantity_threshold';
  const useInventory = cfg.use_inventory_threshold === 1;

  return (
    <s-stack gap="small">
      <s-section>
        <s-stack gap="small">
          <s-grid gridTemplateColumns="1fr auto" alignItems="center">
            <s-heading>Logic</s-heading>
            <StoreModeSwitch mode={mode} onChange={onModeChange} />
          </s-grid>
          <ChoiceGroup
            title="Select option"
            name={`${page}-hide`}
            value={cfg.hide}
            onChange={(v) => setChoice('hide', v)}
            choices={[
              { value: 0, label: isAtc ? 'No, do not hide Add To Cart button' : 'No, do not hide Buy Now button' },
              { value: 1, label: isAtc ? 'Yes, hide Add To Cart button' : 'Yes, hide Buy Now button' },
            ]}
          />
          <ChoiceGroup
            title="Select display logic"
            name={`${page}-display-logic`}
            value={cfg.display_logic}
            disabled={cfg.hide === 0}
            onChange={(v) => setChoice('display_logic', v)}
            choices={[
              { value: 0, label: 'The same as Quote button' },
              { value: 1, label: 'The same as Hide price' },
            ]}
          />
        </s-stack>
      </s-section>

      {isAtc && (
        <s-section>
          <s-stack direction="inline" gap="small-400" alignItems="center">
            <s-heading>Behaviors</s-heading>
            <s-link
              href="https://help.omegatheme.com/en/article/hide-add-to-cart-button-1r0uzem/#3-3-behaviors"
              target="_blank"
              tone="neutral"
              interestFor={tipId}
              accessibilityLabel="Learn more"
            >
              <s-icon type="info" color="subdued" />
            </s-link>
            <s-tooltip id={tipId}>Learn more</s-tooltip>
          </s-stack>
          <s-box paddingBlockStart="small-200">
            <ChoiceGroup
              title="Hide Add To Cart button threshold"
              name="atc-behavior"
              value={cfg.atc_behavior ?? 'not_required'}
              disabled={cfg.hide === 0 || cfg.display_logic === 1}
              onChange={(v) => setChoice('atc_behavior', v)}
              choices={[
                { value: 'not_required', label: 'Not required' },
                { value: 'quantity_threshold', label: 'Set Add To Cart quantity threshold' },
              ]}
            />
          </s-box>
          {threshold && (
            <s-box paddingInlineStart="large-200">
              <s-stack gap="small-400">
                <s-number-field
                  label="Quantity threshold"
                  details="This feature hides the Add to Cart button, and display Quote button once the quantity reaches or surpasses the threshold"
                  min={1}
                  value={useInventory ? '' : String(cfg.quantity_threshold ?? 1)}
                  placeholder={useInventory ? 'Greater than the inventory' : undefined}
                  disabled={useInventory}
                  onInput={(e) => {
                    const v = e.currentTarget.value;
                    const n = Number.parseInt(v, 10);
                    setField('quantity_threshold', v === '' ? '' : Number.isNaN(n) || n < 1 ? 1 : n);
                  }}
                  onBlur={() => {
                    if (!cfg.quantity_threshold) setField('quantity_threshold', 1);
                  }}
                />
                <s-checkbox
                  label="Set the threshold greater than the inventory"
                  checked={useInventory}
                  onChange={(e) => setField('use_inventory_threshold', e.currentTarget.checked ? 1 : 0)}
                />
                <s-checkbox
                  label="Always display Quote button"
                  details="Ignore the ATC quantity threshold and always display Quote button"
                  checked={cfg.always_display_quote === 1}
                  onChange={(e) => setField('always_display_quote', e.currentTarget.checked ? 1 : 0)}
                />
              </s-stack>
            </s-box>
          )}
          {showNotice && (
            <s-box paddingBlockStart="small-200">
              <s-banner tone="info" dismissible onDismiss={() => setShowNotice(false)}>
                This feature only applies to the Quote button on Product and Collection pages. It does not affect the Quote button on the Cart page.
              </s-banner>
            </s-box>
          )}
        </s-section>
      )}
    </s-stack>
  );
}
