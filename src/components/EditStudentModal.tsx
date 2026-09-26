import React, { useState, useMemo } from 'react';
import { SchoolClass, StudentRecord, AcademicMonth, ACADEMIC_MONTHS } from '../types';
import { UserCheck, X, Hash, CalendarClock, AlertTriangle } from 'lucide-react';

// FIXED: Local - no mockStudents import
const ALL_CLASSES: SchoolClass[] = [
  'Reception', 'Junior', 'Senior',
  'Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
  'Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X'
];

function formatPhoneDisplay(raw?: string): string {
  if (!raw) return '';
  let cleaned = String(raw).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('92') && cleaned.length >= 12) return '0' + cleaned.slice(2);
  if (cleaned.startsWith('03')) return cleaned;
  return cleaned;
}

interface Props {
  student: StudentRecord;
  activeAcademicYear?: string;
  onClose: () => void;
  onSaveStudent: (updatedStudent: StudentRecord) => void;
}

export const EditStudentModal: React.FC<Props> = ({
  student,
  activeAcademicYear = '2026-2027',
  onClose,
  onSaveStudent,
}) => {
  const [serialNo, setSerialNo] = useState<string>(student.serialNo || String(student.id).padStart(3, '0'));
  const [studentName, setStudentName] = useState<string>(student.studentName);
  const [fatherName, setFatherName] = useState<string>(student.fatherName);
  const [className, setClassName] = useState<SchoolClass>(student.className);
  const [contactNo, setContactNo] = useState<string>(student.contactNo);
  const [contactNo2, setContactNo2] = useState<string>(student.contactNo2 || '');
  const [rollNo, setRollNo] = useState<string>(student.rollNo);

  // Get current fee from feeSchedules, not monthlyFee
  const feeSchedules = useMemo(() => student.feeSchedules || [], [student.feeSchedules]);
  const baseFee = feeSchedules.length > 0 ? feeSchedules[0].monthlyFee : 0;
  const currentFeeSch = feeSchedules.length > 0 ? feeSchedules[feeSchedules.length - 1] : null;
  const currentFee = currentFeeSch?.monthlyFee || baseFee || 0;
  const currentWef = currentFeeSch?.effectiveFromMonth || 'Jun';

  const [discount, setDiscount] = useState<number>(0); // Concession
  const [newFeeAmount, setNewFeeAmount] = useState<number>(currentFee);
  const [effectiveFromMonth, setEffectiveFromMonth] = useState<AcademicMonth>(currentWef as AcademicMonth);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // ---- Admission Month feature ----

  // Derive current admission month from invoices: first month NOT marked new_admission.
  const currentAdmissionMonth = useMemo<AcademicMonth>(() => {
    const sorted = [...(student.invoices || [])].sort(
      (a, b) => ACADEMIC_MONTHS.indexOf(a.month as AcademicMonth) - ACADEMIC_MONTHS.indexOf(b.month as AcademicMonth)
    );
    const firstReal = sorted.find(inv => inv.status !== 'new_admission');
    return (firstReal?.month as AcademicMonth) || 'Jun';
  }, [student.invoices]);

  const [newAdmissionMonth, setNewAdmissionMonth] = useState<AcademicMonth>(currentAdmissionMonth);
  const [showAdmissionConfirm, setShowAdmissionConfirm] = useState(false);
  const [isUpdatingAdmission, setIsUpdatingAdmission] = useState(false);
  const [admissionError, setAdmissionError] = useState<string | null>(null);
  const [admissionSuccess, setAdmissionSuccess] = useState<string | null>(null);

  const admissionMonthChanged = newAdmissionMonth !== currentAdmissionMonth;

  // Preview which months will flip, purely for the confirmation dialog's summary text.
  const admissionImpact = useMemo(() => {
    if (!admissionMonthChanged) return null;
    const currentIdx = ACADEMIC_MONTHS.indexOf(currentAdmissionMonth);
    const newIdx = ACADEMIC_MONTHS.indexOf(newAdmissionMonth);
    const affected: { month: AcademicMonth; from: string; to: string; hasPayment: boolean }[] = [];
    student.invoices?.forEach(inv => {
      const idx = ACADEMIC_MONTHS.indexOf(inv.month as AcademicMonth);
      const wasNewAdmission = idx < currentIdx;
      const willBeNewAdmission = idx < newIdx;
      if (wasNewAdmission !== willBeNewAdmission) {
        affected.push({
          month: inv.month as AcademicMonth,
          from: wasNewAdmission ? 'NEW ADMISSION' : 'Billed',
          to: willBeNewAdmission ? 'NEW ADMISSION' : 'Billed',
          hasPayment: Number(inv.paidAmount) > 0,
        });
      }
    });
    return affected;
  }, [admissionMonthChanged, currentAdmissionMonth, newAdmissionMonth, student.invoices]);

  const hasBlockingPayments = admissionImpact?.some(a => a.hasPayment) ?? false;

  const handleConfirmAdmissionChange = async () => {
    setIsUpdatingAdmission(true);
    setAdmissionError(null);
    setAdmissionSuccess(null);
    try {
      const res = await fetch('/api/fees/invoice-actions', {   // was '/api/fees/update-admission'
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'updateAdmission', studentId: student.id, academicYear: student.academicYear || activeAcademicYear, newAdmissionMonth }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdmissionError(data.error || 'Failed to update admission month.');
        return;
      }
      setAdmissionSuccess(`Admission month updated to ${newAdmissionMonth}.`);
      setShowAdmissionConfirm(false);
      // Reflect the change locally so the modal + underlying ledger update without a full page reload.
      onSaveStudent({
        ...student,
        admissionDate: data.admissionDate,
        invoices: (student.invoices || []).map(inv => {
          const idx = ACADEMIC_MONTHS.indexOf(inv.month as AcademicMonth);
          const targetIdx = ACADEMIC_MONTHS.indexOf(newAdmissionMonth);
          if (idx < targetIdx) return { ...inv, status: 'new_admission', netDue: 0, paidAmount: 0 };
          if (inv.status === 'new_admission' && idx >= targetIdx) return { ...inv, status: 'unpaid' };
          return inv;
        }),
      } as StudentRecord);
    } catch {
      setAdmissionError('Network error — admission month not updated.');
    } finally {
      setIsUpdatingAdmission(false);
    }
  };

  // ---- Fee schedule / discount ----

  const handleFeeScheduleUpdate = async () => {
    const hasFeeChanged = Number(newFeeAmount) !== Number(currentFee);
    const hasDiscountChanged = Number(discount) !== 0; // Discount creates concession invoice

    if (!hasFeeChanged && !hasDiscountChanged) return;

    const res = await fetch('/api/fees/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        studentId: student.id,
        rollNo: student.rollNo,
        monthlyFee: Math.max(0, Number(newFeeAmount)),
        concession: Math.max(0, Number(discount)),
        effectiveFromMonth,
        academicYear: student.academicYear || activeAcademicYear,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save fee schedule');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !fatherName.trim()) return;

    setScheduleError(null);
    setIsSaving(true);

    try {
      await handleFeeScheduleUpdate();
    } catch (err: any) {
      console.error('Fee schedule update failed:', err);
      setScheduleError(err.message || 'Could not save fee schedule. Please try again.');
      setIsSaving(false);
      return;
    }

    let cleanSerial = serialNo.trim();
    if (/^\d+$/.test(cleanSerial)) cleanSerial = cleanSerial.padStart(3, '0');

    // Save with updated feeSchedules locally for instant UI update
    const updatedFeeSchedules = [...feeSchedules];
    const existingIdx = updatedFeeSchedules.findIndex(f => f.effectiveFromMonth === effectiveFromMonth);
    if (Number(newFeeAmount) !== currentFee) {
      if (existingIdx >= 0) {
        updatedFeeSchedules[existingIdx] = { ...updatedFeeSchedules[existingIdx], monthlyFee: Math.max(0, Number(newFeeAmount)) };
      } else {
        updatedFeeSchedules.push({
          id: Date.now(),
          studentId: student.id,
          monthlyFee: Math.max(0, Number(newFeeAmount)),
          effectiveFromMonth,
          academicYear: student.academicYear || activeAcademicYear!,
        } as any);
      }
      // Sort by month order
      updatedFeeSchedules.sort((a, b) => ACADEMIC_MONTHS.indexOf(a.effectiveFromMonth as AcademicMonth) - ACADEMIC_MONTHS.indexOf(b.effectiveFromMonth as AcademicMonth));
    }

    onSaveStudent({
      ...student,
      serialNo: cleanSerial || student.serialNo || String(student.id).padStart(3, '0'),
      studentName: studentName.trim(),
      fatherName: fatherName.trim(),
      className,
      contactNo: contactNo.trim(),
      contactNo2: contactNo2.trim() || undefined,
      rollNo: rollNo.trim(),
      academicYear: student.academicYear || activeAcademicYear,
      feeSchedules: updatedFeeSchedules,
    } as StudentRecord);

    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
        <div className="bg-neutral-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutral-800 rounded-lg"><UserCheck className="w-5 h-5 text-neutral-100" /></div>
            <div>
              <h3 className="font-bold text-base leading-tight">Edit Student Record</h3>
              <p className="text-xs text-neutral-400">Update S#, Class, Names, Contact, and Monthly Fee Schedule - Current: Rs. {currentFee.toLocaleString()} w.e.f {currentWef}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1"><Hash className="w-3 h-3 inline mr-1 text-neutral-500" />S# (e.g. 001) *</label>
              <input type="text" value={serialNo} onChange={e => setSerialNo(e.target.value)} placeholder="001" maxLength={6} className="w-full text-sm font-mono font-bold border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none bg-neutral-50" required />
              <span className="text-[10px] text-neutral-400">Register index</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Class *</label>
              <select value={className} onChange={e => setClassName(e.target.value as SchoolClass)} className="w-full text-sm font-medium border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none">
                {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Roll No.</label>
              <input type="text" value={rollNo} onChange={e => setRollNo(e.target.value)} placeholder="ETC-1001" className="w-full text-sm font-mono border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-neutral-700 mb-1">Student Name *</label><input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Student Name" className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none font-medium" required /></div>
            <div><label className="block text-xs font-semibold text-neutral-700 mb-1">Father Name *</label><input type="text" value={fatherName} onChange={e => setFatherName(e.target.value)} placeholder="Father Name" className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none font-medium" required /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Contact No. 1 (WhatsApp) *</label>
              <input type="text" value={contactNo} onChange={e => setContactNo(e.target.value)} placeholder="923001234567 or 03001234567" className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-neutral-900 focus:outline-none" required />
              <p className="text-[10px] text-neutral-500 mt-1">Preview: <strong className="text-neutral-800">{formatPhoneDisplay(contactNo)}</strong></p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Contact No. 2 (Optional)</label>
              <input type="text" value={contactNo2} onChange={e => setContactNo2(e.target.value)} placeholder="Optional alternate" className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-neutral-900 focus:outline-none" />
              {contactNo2 && <p className="text-[10px] text-neutral-500 mt-1">Preview: <strong className="text-neutral-800">{formatPhoneDisplay(contactNo2)}</strong></p>}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs">
            <div className="font-semibold text-blue-900">Current Fee Structure:</div>
            <div className="mt-1 space-y-0.5">
              {feeSchedules.length > 0 ? feeSchedules.map((fs, idx) => (
                <div key={idx} className="flex justify-between"><span className="text-blue-700">{fs.effectiveFromMonth}: Rs. {fs.monthlyFee.toLocaleString()}</span><span className="text-blue-500 text-[10px]">{idx === 0 ? 'Base' : idx === feeSchedules.length - 1 ? 'Current' : `Change ${idx}`}</span></div>
              )) : <span className="text-blue-700">No fee schedule - Base: Rs. 0</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">New Monthly Fee (PKR) *</label>
              <input type="number" min="0" step="50" value={newFeeAmount} onChange={e => setNewFeeAmount(Number(e.target.value))} className="w-full text-sm font-semibold border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none" required />
              <label className="block text-[10px] font-semibold text-neutral-500 mt-2 mb-1">Effective From Month *</label>
              <select value={effectiveFromMonth} onChange={e => setEffectiveFromMonth(e.target.value as AcademicMonth)} className="w-full text-xs font-medium border border-neutral-300 rounded-lg p-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none bg-neutral-50">
                {ACADEMIC_MONTHS.map(m => <option key={m} value={m}>{m} (Academic Month)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Concession / Discount (PKR)</label>
              <input type="number" min="0" step="50" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none" />
              <p className="text-[10px] text-neutral-500 mt-2">Creates concession in invoices table for {effectiveFromMonth} onwards</p>
            </div>
          </div>

          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 text-xs flex justify-between items-center">
            <span className="text-neutral-500">Effective Monthly Payable:</span><span className="font-bold text-neutral-900 text-sm">Rs. {Math.max(0, newFeeAmount - discount).toLocaleString()}</span>
          </div>

          {/* Admission Month section — separate action, own confirm + error/success state */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <CalendarClock className="w-3.5 h-3.5" />Admission Month (Session {student.academicYear || activeAcademicYear})
            </div>
            <p className="text-[11px] text-amber-800">
              Current: <strong>{currentAdmissionMonth}</strong>. Changing this recalculates which months are
              billed vs. marked NEW ADMISSION for this student.
            </p>
            <div className="flex items-center gap-2">
              <select
                value={newAdmissionMonth}
                onChange={e => { setNewAdmissionMonth(e.target.value as AcademicMonth); setAdmissionError(null); setAdmissionSuccess(null); }}
                className="text-xs font-medium border border-amber-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {ACADEMIC_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button
                type="button"
                disabled={!admissionMonthChanged || isUpdatingAdmission}
                onClick={() => setShowAdmissionConfirm(true)}
                className={`text-xs font-bold px-3 py-2 rounded-lg ${admissionMonthChanged ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}
              >
                Update Admission Month
              </button>
            </div>
            {admissionError && <p className="text-[11px] text-red-700 font-medium">⚠ {admissionError}</p>}
            {admissionSuccess && <p className="text-[11px] text-emerald-700 font-medium">✓ {admissionSuccess}</p>}
          </div>

          {scheduleError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5">{scheduleError}</div>}

          <div className="pt-3 flex justify-end gap-2 border-t border-neutral-200">
            <button type="button" onClick={onClose} className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100">Cancel</button>
            <button type="submit" disabled={isSaving} className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"><UserCheck className="w-3.5 h-3.5" />{isSaving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>

      {/* Confirmation dialog, rendered as a nested overlay on top of the edit modal */}
      {showAdmissionConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />Confirm Admission Month Change
            </div>
            <p className="text-xs text-neutral-600">
              Changing admission month from <strong>{currentAdmissionMonth}</strong> to <strong>{newAdmissionMonth}</strong> will affect:
            </p>
            <div className="max-h-40 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100">
              {admissionImpact?.length ? admissionImpact.map(a => (
                <div key={a.month} className="flex items-center justify-between px-2.5 py-1.5 text-xs">
                  <span className="font-semibold">{a.month}</span>
                  <span className="text-neutral-500">{a.from} → {a.to}</span>
                  {a.hasPayment && <span className="text-red-600 font-bold">Has payment!</span>}
                </div>
              )) : <div className="px-2.5 py-1.5 text-xs text-neutral-400">No months affected.</div>}
            </div>
            {hasBlockingPayments && (
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                One or more affected months already have a recorded payment. The server will reject this
                change until those payments are cleared first.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAdmissionConfirm(false)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100">Cancel</button>
              <button
                type="button"
                onClick={handleConfirmAdmissionChange}
                disabled={isUpdatingAdmission}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {isUpdatingAdmission ? 'Updating...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};