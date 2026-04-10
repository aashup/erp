import { z } from 'zod';

export const journalLineSchema = z.object({
  ledger_id: z.string().min(1, 'Ledger required'),
  debit:     z.preprocess((v) => (v === '' || v === undefined ? 0 : Number(v)), z.number().min(0)),
  credit:    z.preprocess((v) => (v === '' || v === undefined ? 0 : Number(v)), z.number().min(0)),
  narration: z.string().optional(),
});

export const journalSchema = z
  .object({
    voucher_date: z.string().min(1, 'Date is required'),
    voucher_type: z.enum(['journal', 'contra', 'payment', 'receipt', 'purchase', 'sales']),
    narration:    z.string().optional(),
    lines:        z.array(journalLineSchema).min(2, 'At least 2 lines required'),
  })
  .refine(
    (data) => {
      const totalDebit  = data.lines.reduce((sum, l) => sum + (Number(l.debit)  || 0), 0);
      const totalCredit = data.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
      return Math.abs(totalDebit - totalCredit) < 0.01;
    },
    { message: 'Total debits must equal total credits', path: ['lines'] }
  );

export type JournalForm = z.infer<typeof journalSchema>;

export const paymentSchema = z.object({
  party_id:         z.string().min(1, 'Party is required'),
  type:             z.enum(['payment', 'receipt']),
  receipt_number:   z.string().min(1, 'Number is required'),
  receipt_date:     z.string().min(1, 'Date is required'),
  amount:           z.coerce.number().positive('Amount must be positive'),
  payment_mode:     z.enum(['cash', 'bank', 'cheque', 'upi', 'other']),
  reference_number: z.string().optional(),
  bank_name:        z.string().optional(),
  notes:            z.string().optional(),
});

export type PaymentForm = z.infer<typeof paymentSchema>;
