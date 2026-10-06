import { formatPeso } from '@/lib/currency';

export type ReminderInput = {
  debtorName: string;
  amount: number;
  /** What the money was for, e.g. the group name. */
  reason: string;
  gcashNumber?: string | null;
  mayaNumber?: string | null;
};

/**
 * Builds the friendly payment reminder the creditor copies or shares.
 * Asks for GCash by default, or Maya when that is the only wallet on the creditor's profile.
 */
export function buildReminder({
  debtorName,
  amount,
  reason,
  gcashNumber,
  mayaNumber,
}: ReminderInput) {
  const firstName = debtorName.trim().split(/\s+/)[0] || 'friend';
  const wallet = !gcashNumber && mayaNumber ? 'Maya' : 'GCash';
  const lines = [
    `Uy ${firstName}! Paki-${wallet} naman ng ${formatPeso(amount, { compact: true })} para sa ${reason.trim()} 😭`,
    'Salamat!',
  ];
  if (gcashNumber) lines.push(`GCash: ${gcashNumber}`);
  if (mayaNumber) lines.push(`Maya: ${mayaNumber}`);
  return lines.join('\n');
}
