import React, { useState } from 'react';
import { StudentRecord, AcademicMonth, ACADEMIC_MONTHS, PaymentStatus } from '../types';
import { CreditCard, X, CheckCircle2 } from 'lucide-react';

interface Props {
  student: StudentRecord;
  activeAcademicYear?: string;
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
  onClose,
  onSavePayment,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<AcademicMonth>('Feb');
  const [amount, setAmount] = useState<number>(student.monthlyFee - student.discount);
  const [status, setStatus] = useState<PaymentStatus>('paid');
  const [method, setMethod] = useState<'Cash' | 'Bank Transfer' | 'Online/EasyPaisa/JazzCash'>('Cash');
  const [receiptNo] = useState<string>(
    'REC-' + Math.floor(100000 + Math.random() * 900000)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePayment(student.id, selectedMonth, amount, status, method, receiptNo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
        <div className="bg-blue-700 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-800/80 rounded-lg">
              <CreditCard className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Record Student Fee Payment</h3>
              <p className="text-xs text-blue-100">Session {activeAcademicYear} &bull; Updates Ledger & Issues Receipt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-blue-200 hover:text-white hover:bg-blue-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">Academic Session:</span>
              <span className="font-semibold text-neutral-900 bg-neutral-200/80 px-1.5 py-0.5 rounded text-[11px]">{activeAcademicYear}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Student:</span>
              <strong className="text-neutral-900">{student.studentName} ({student.rollNo})</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Class:</span>
              <span className="font-semibold text-neutral-800">{student.className}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Base Monthly Fee:</span>
              <span className="font-semibold text-neutral-800">Rs. {student.monthlyFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Auto Generated Receipt #:</span>
              <span className="font-mono text-blue-700 font-semibold">{receiptNo}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Target Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value as AcademicMonth)}
              className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {ACADEMIC_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m} (Current Status: {student.monthlyStatus[m].toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Amount Paid (PKR)</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Mark Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="paid">Paid (Fully Cleared)</option>
                <option value="partial">Partial (Partially Paid)</option>
                <option value="pending">Pending (Unpaid)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Payment Method</label>
            <select
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as 'Cash' | 'Bank Transfer' | 'Online/EasyPaisa/JazzCash')
              }
              className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Cash">Cash (Counter Collection)</option>
              <option value="Bank Transfer">Bank Transfer / Deposit Slip</option>
              <option value="Online/EasyPaisa/JazzCash">Online (EasyPaisa / JazzCash / Nayapay)</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm & Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
