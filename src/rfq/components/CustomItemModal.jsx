import React, { useState } from 'react';
import { Modal, FormLayout, TextField, Checkbox, Select } from '@shopify/polaris';

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
    <Modal
      open={open}
      onClose={close}
      title="Add custom item"
      primaryAction={{ content: 'Add item', onAction: add, disabled: !canAdd }}
      secondaryActions={[{ content: 'Cancel', onAction: close }]}
    >
      <Modal.Section>
        <FormLayout>
          <TextField
            label="Item name"
            value={name}
            onChange={setName}
            placeholder="e.g. Custom fabrication"
            autoComplete="off"
          />
          <FormLayout.Group>
            <TextField label="Price" type="number" min={0} prefix="$" value={price} onChange={setPrice} autoComplete="off" />
            <TextField label="Quantity" type="number" min={1} value={qty} onChange={setQty} autoComplete="off" />
          </FormLayout.Group>
          <Checkbox
            label="Item is physical"
            checked={physical}
            onChange={setPhysical}
            helpText="Physical items may need shipping and a weight."
          />
          {physical ? (
            <FormLayout.Group>
              <TextField label="Weight" type="number" min={0} value={weight} onChange={setWeight} autoComplete="off" />
              <Select label="Unit" options={WEIGHT_UNITS.map((u) => ({ label: u, value: u }))} value={weightUnit} onChange={setWeightUnit} />
            </FormLayout.Group>
          ) : null}
          <Checkbox label="Charge tax on this item" checked={taxable} onChange={setTaxable} />
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}
