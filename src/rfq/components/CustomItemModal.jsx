import React, { useState } from 'react';
import { Modal } from '../../shared/wc.jsx';

// Shopify draft-order "Add custom item" dialog, ported for the manual-quote flow:
// a free-form line that isn't in the catalog — item name + price + quantity, an
// "Item is physical" toggle that reveals a weight, and a charge-tax checkbox.
const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'];

export function CustomItemModal({ open, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [physical, setPhysical] = useState(false);
  const [taxable, setTaxable] = useState(true);
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');

  const priceNum = Number(price);
  const canAdd = name.trim().length > 0 && price !== '' && Number.isFinite(priceNum) && priceNum >= 0;

  const reset = () => {
    setName('');
    setPrice('');
    setQty('1');
    setPhysical(false);
    setTaxable(true);
    setWeight('');
    setWeightUnit('kg');
  };
  const close = () => {
    reset();
    onClose();
  };
  const add = () => {
    onAdd({
      custom: true,
      title: name.trim(),
      price: priceNum,
      qty: Math.max(1, Number(qty) || 1),
      physical,
      taxable,
      weight: physical ? Number(weight) || 0 : null,
      weightUnit: physical ? weightUnit : null,
    });
    reset();
  };

  return (
    <Modal open={!!open} onClose={close} heading="Add custom item">
      <s-stack gap="base">
        <s-text-field
          label="Item name"
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="e.g. Custom fabrication"
          autocomplete="off"
        />
        <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="base">
          <s-number-field label="Price" min={0} prefix="$" value={price} onInput={(e) => setPrice(e.currentTarget.value)} autocomplete="off" />
          <s-number-field label="Quantity" min={1} inputMode="numeric" value={qty} onInput={(e) => setQty(e.currentTarget.value)} autocomplete="off" />
        </s-grid>
        <s-checkbox
          label="Item is physical"
          checked={physical}
          onChange={(e) => setPhysical(e.currentTarget.checked)}
          details="Physical items may need shipping and a weight."
        />
        {physical ? (
          <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="base">
            <s-number-field label="Weight" min={0} value={weight} onInput={(e) => setWeight(e.currentTarget.value)} autocomplete="off" />
            <s-select label="Unit" value={weightUnit} onChange={(e) => setWeightUnit(e.currentTarget.value)}>
              {WEIGHT_UNITS.map((u) => (
                <s-option key={u} value={u}>
                  {u}
                </s-option>
              ))}
            </s-select>
          </s-grid>
        ) : null}
        <s-checkbox label="Charge tax on this item" checked={taxable} onChange={(e) => setTaxable(e.currentTarget.checked)} />
      </s-stack>
      <s-button slot="primary-action" variant="primary" disabled={!canAdd} onClick={add}>
        Add item
      </s-button>
      <s-button slot="secondary-actions" onClick={close}>
        Cancel
      </s-button>
    </Modal>
  );
}
