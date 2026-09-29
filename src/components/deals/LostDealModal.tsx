import { useState } from 'react';
import { Button, Modal, RadioOption } from '@/src/components/ui';
import { LOSS_REASONS, type LossReason } from '@/src/lib/constants';

export interface LostDealModalProps {
  /** e.g. "Smart Pack Ukraine LLC · Overdraft · 900 000 ₴" */
  subtitle: string;
  /** Preselected when the system suggests Lost ("All banks declined"). */
  initialReason?: LossReason;
  onCancel: () => void;
  onConfirm: (reason: LossReason) => void;
}

/** "Mark deal as lost" — the reason is required; it feeds the Loss reasons report. */
export function LostDealModal({
  subtitle,
  initialReason,
  onCancel,
  onConfirm,
}: LostDealModalProps) {
  const [reason, setReason] = useState<LossReason | null>(initialReason ?? null);
  return (
    <Modal
      open
      onClose={onCancel}
      title="Mark deal as lost"
      subtitle={subtitle}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" disabled={!reason} onClick={() => reason && onConfirm(reason)}>
            Mark as lost
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Loss reason" className="flex flex-col gap-1.5">
        <div className="mb-0.5 text-sm text-text-tertiary">
          Reason is required. It feeds the “Loss reasons” report.
        </div>
        {LOSS_REASONS.map((r) => (
          <RadioOption
            key={r}
            name="loss-reason"
            value={r}
            checked={reason === r}
            onChange={() => setReason(r)}
          >
            {r}
          </RadioOption>
        ))}
      </div>
    </Modal>
  );
}
