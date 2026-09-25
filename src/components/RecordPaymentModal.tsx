import React, { useState, useMemo } from 'react';
import { StudentRecord, AcademicMonth, ACADEMIC_MONTHS, PaymentStatus, Invoice } from '../types';
import { CreditCard, X, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  student: StudentRecord;
  activeAcademicYear?: string;
  activeMonth?: AcademicMonth;
  onClose: () => void;
  onSavePayment: (
    studentId: number,
    month: AcademicMonth,
    amount: number,
    status: PaymentStatus,
    method: 'Cash' | 'Bank Transfer' | 'Online/EasyPaisa/JazzCash',
    receiptNo: string
  ) => void;
}

export const RecordPaymentModal: React.FC<Props> = ({
  student,
  activeAcademicYear = '2026-2027',
  activeMonth,
  onClose,
  onSavePayment,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<AcademicMonth>(activeMonth || 'Sep');
  const [method, setMethod] = useState<'Cash' | 'Bank Transfer' | 'Online/EasyPaisa/JazzCash'>('Cash');
  const [receiptNo] = useState<string>('REC-' + Math.floor(100000 + Math.random() * 900000));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // FIXED: Build invoice lookup from student.invoices
  const invoiceMap = useMemo(() => {
    const map = new Map<string, Invoice>();
    student.invoices?.forEach(inv => {
      if (inv.academicYear === activeAcademicYear) {
        map.set(inv.month, inv);
      }
    });
    return map;
  }, [student.invoices, activeAcademicYear]);

  const selectedInvoice = invoiceMap.get(selectedMonth);
  const isNewAdmission =!selectedInvoice || selectedInvoice.status === 'new_admission';

  // FIXED: Amount and status derived from invoice
  const [amount, setAmount] = useState<number>(() => {
    const inv = invoiceMap.get(activeMonth || 'Sep');
    if (!inv || inv.status === 'new_admission') return 0;
    return Number(inv.netDue) || 0;
  });

  const [status, setStatus] = useState<PaymentStatus>(() => {
    const inv = invoiceMap.get(activeMonth || 'Sep');
    if (!inv) return 'unpaid';
    return inv.status === 'new_admission'? 'unpaid' : inv.status as PaymentStatus;
  });

  // When month changes, auto-update amount and status
  const handleMonthChange = (m: AcademicMonth) => {
    setSelectedMonth(m);
    const inv = invoiceMap.get(m);
    if (!inv || inv.status === 'new_admission') {
      setAmount(0);
      setStatus('unpaid');
    } else {
      setAmount(Number(inv.netDue) || 0);
      setStatus(inv.status as PaymentStatus);
    }
    setErrorMessage(null);
  };

  const feeSchedules = student.feeSchedules || [];
  const baseFee = feeSchedules.length > 0? feeSchedules[0].monthlyFee : 0;
  const currentFeeSch = feeSchedules.length > 0? feeSchedules[feeSchedules.length - 1] : null;
  const currentFee = currentFeeSch?.monthlyFee || baseFee;
  const wef = currentFeeSch?.effectiveFromMonth || 'Jun';

  const handlePaymentSubmit = async (
    studentId: number,
    month: AcademicMonth,
    academicYear: string,
    paidAmount: number
  ) => {
    const res = await fetch('/api/fees/record-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ studentId, month, academicYear, paidAmount }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to record payment');
    }
    return res.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNewAdmission) {
      setErrorMessage(`Cannot record payment for ${selectedMonth}: Student has NEW ADMISSION status (joined after this month)`);
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await handlePaymentSubmit(student.id, selectedMonth, activeAcademicYear!, amount);
      onSavePayment(student.id, selectedMonth, amount, status, method, receiptNo);
      onClose();
    } catch (err: any) {
      console.error('Error recording payment:', err);
      setErrorMessage(err.message || 'Error recording payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
        <div className="bg-blue-700 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-800/80 rounded-lg"><CreditCard className="w-5 h-5 text-blue-100" /></div>
            <div>
              <h3 className="font-bold text-base leading-tight">Record Student Fee Payment</h3>
              <p className="text-xs text-blue-100">Session {activeAcademicYear} • Updates Ledger & Issues Receipt</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-blue-200 hover:text-white hover:bg-blue-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-neutral-500">Academic Session:</span><span className="font-semibold text-neutral-900 bg-neutral-200/80 px-1.5 py-0.5 rounded text-">{activeAcademicYear}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Student:</span><strong className="text-neutral-900">{student.studentName} ({student.rollNo})</strong></div>
            <div className="flex justify-between"><span className="text-neutral-500">Class:</span><span className="font-semibold text-neutral-800">{student.className}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">M. Fee:</span><span className="font-semibold text-neutral-800">Rs. {currentFee.toLocaleString()} <span className="text- text-blue-600">w.e.f {wef}</span>{baseFee!== currentFee && baseFee > 0 && <span className="text- text-neutral-500 ml-1">(was {baseFee.toLocaleString()})</span>}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Receipt #:</span><span className="font-mono text-blue-700 font-semibold">{receiptNo}</span></div>
            {selectedInvoice && <div className="flex justify-between pt-1 border-t border-neutral-200 mt-1"><span className="text-neutral-500">Current {selectedMonth} Status:</span><span className={`font-bold text- px-2 py-0.5 rounded ${selectedInvoice.status === 'paid'? 'bg-emerald-100 text-emerald-700' : selectedInvoice.status === 'partial'? 'bg-amber-100 text-amber-700' : selectedInvoice.status === 'new_admission'? 'bg-black text-white' : 'bg-red-100 text-red-700'}`}>{selectedInvoice.status.toUpperCase()} (Paid: Rs. {Number(selectedInvoice.paidAmount).toLocaleString()} / Due: Rs. {Number(selectedInvoice.netDue).toLocaleString()})</span></div>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Target Month</label>
            <select value={selectedMonth} onChange={e => handleMonthChange(e.target.value as AcademicMonth)} className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none">
              {ACADEMIC_MONTHS.map(m => {
                const inv = invoiceMap.get(m);
                const statusLabel =!inv? 'NO INVOICE' : inv.status === 'new_admission'? 'NEW ADMISSION' : `${inv.status.toUpperCase()} (Rs. ${Number(inv.paidAmount).toLocaleString()}/${Number(inv.netDue).toLocaleString()})`;
                return <option key={m} value={m} disabled={inv?.status === 'new_admission'}>{m} - {statusLabel} {inv?.status === 'new_admission'? ' - DISABLED' : ''}</option>;
              })}
            </select>
            {isNewAdmission && <div className="mt-2 flex items-center gap-2 bg-black text-white text-xs px-3 py-2 rounded-lg"><AlertTriangle className="w-4 h-4" />{selectedMonth} is NEW ADMISSION for this student (joined after {selectedMonth}). Payment not allowed.</div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Amount Paid (PKR)</label>
              <input type="number" min="0" max={selectedInvoice? Number(selectedInvoice.netDue) : 100000} value={amount} onChange={e => setAmount(Number(e.target.value))} disabled={isNewAdmission} className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-400" required />
              {selectedInvoice &&!isNewAdmission && <span className="text- text-neutral-500">Net Due: Rs. {Number(selectedInvoice.netDue).toLocaleString()}</span>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Mark Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as PaymentStatus)} disabled={isNewAdmission} className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-neutral-100">
                <option value="paid">Paid (Fully Cleared)</option>
                <option value="partial">Partial (Partially Paid)</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <span className="text- text-neutral-500">Auto-calculated from amount, but you can override</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value as any)} className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <option value="Cash">Cash (Counter Collection)</option>
              <option value="Bank Transfer">Bank Transfer / Deposit Slip</option>
              <option value="Online/EasyPaisa/JazzCash">Online (EasyPaisa / JazzCash / Nayapay)</option>
            </select>
          </div>

          {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5">{errorMessage}</div>}

          <div className="pt-2 flex justify-end gap-2 border-t border-neutral-200">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting || isNewAdmission} className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
              <CheckCircle2 className="w-4 h-4" />{isSubmitting? 'Saving...' : `Confirm & Save ${selectedMonth} Payment`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};