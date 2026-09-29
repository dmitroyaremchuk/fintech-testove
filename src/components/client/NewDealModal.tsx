import { useState } from 'react';
import { Button, Field, Modal, Select, TextInput } from '@/src/components/ui';
import { PRODUCTS, type Product } from '@/src/lib/constants';
import type { NewLeadInput } from '@/src/lib/data/mutations';

export interface NewDealModalProps {
  clientName: string;
  onCancel: () => void;
  onCreate: (lead: NewLeadInput) => void;
}

const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;

/** New financing request for an existing client; starts in "New lead". */
export function NewDealModal({ clientName, onCancel, onCreate }: NewDealModalProps) {
  const [product, setProduct] = useState<Product>('Loan');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    amount: digits(amount) > 0 ? undefined : 'Enter the requested amount',
    purpose: purpose.trim() ? undefined : 'Enter the purpose',
  };

  const submit = () => {
    setSubmitted(true);
    if (errors.amount || errors.purpose) return;
    onCreate({ product, requestedAmount: digits(amount), purpose });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="New deal"
      subtitle={`${clientName} · starts in “New lead” with a call task for tomorrow 10:00`}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Create deal
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-2.5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Product">
            {({ id }) => (
              <Select
                id={id}
                value={product}
                onChange={(e) => setProduct(e.target.value as Product)}
              >
                {PRODUCTS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Requested amount, ₴" error={submitted ? errors.amount : undefined}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="numeric"
                placeholder="3 200 000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Purpose" error={submitted ? errors.purpose : undefined}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="Working capital for the season"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
