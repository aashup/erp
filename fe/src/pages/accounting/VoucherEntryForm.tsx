import { useParams } from 'react-router-dom';
import { type VoucherTab } from './vouchers/types';
import { JournalVoucherForm } from './vouchers/JournalVoucherForm';
import { ContraVoucherForm } from './vouchers/ContraVoucherForm';
import { PaymentVoucherForm } from './vouchers/PaymentVoucherForm';
import { ReceiptVoucherForm } from './vouchers/ReceiptVoucherForm';

export default function VoucherEntryForm() {
  const { type } = useParams<{ type: VoucherTab }>();
  const voucherType = (type ?? 'journal') as VoucherTab;

  if (voucherType === 'payment') return <PaymentVoucherForm />;
  if (voucherType === 'receipt') return <ReceiptVoucherForm />;
  if (voucherType === 'contra') return <ContraVoucherForm />;
  return <JournalVoucherForm voucherType={voucherType} />;
}
