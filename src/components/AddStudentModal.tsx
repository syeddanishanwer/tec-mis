import React, { useState, useMemo } from 'react';
import { SchoolClass, StudentRecord, AcademicMonth, ACADEMIC_MONTHS } from '../types';
import { UserPlus, X, Hash } from 'lucide-react';

// FIXED: Local - no mockStudents import
const ALL_CLASSES: SchoolClass[] = [
  'Reception', 'Junior', 'Senior',
  'Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
  'Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X'
];

function getAdmissionMonth(): AcademicMonth {
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'short' }) as AcademicMonth;
  return ACADEMIC_MONTHS.includes(currentMonthName)? currentMonthName : 'Sep';
}

interface Props {
  onClose: () => void;
  onAddStudent: (student: Omit<StudentRecord, 'id'>) => void;
  currentAcademicYear?: string;
  availableAcademicYears?: string[];
  suggestedSerialNo?: string;
}

export const AddStudentModal: React.FC<Props> = ({
  onClose,
  onAddStudent,
  currentAcademicYear = '2026-2027',
  availableAcademicYears = ['2026-2027'],
  suggestedSerialNo = '015',
}) => {
  const admissionMonth = useMemo(() => getAdmissionMonth(), []);

  const [serialNo, setSerialNo] = useState(suggestedSerialNo);
  const [studentName, setStudentName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [className, setClassName] = useState<SchoolClass>('Class I');
  const [contactNo, setContactNo] = useState('923001234567');
  const [contactNo2, setContactNo2] = useState('');
  const [monthlyFee, setMonthlyFee] = useState<number>(3500);
  const [discount, setDiscount] = useState<number>(0);
  const [year, setYear] = useState<string>(currentAcademicYear);
  const [selectedAdmissionMonth, setSelectedAdmissionMonth] = useState<AcademicMonth>(admissionMonth);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() ||!fatherName.trim()) return;

    let cleanSerial = serialNo.trim();
    if (/^\d+$/.test(cleanSerial)) cleanSerial = cleanSerial.padStart(3, '0');

    const rollNo = 'ETC-' + Math.floor(1000 + Math.random() * 9000);
    const admissionMonthIdx = ACADEMIC_MONTHS.indexOf(selectedAdmissionMonth);

    // FIXED: Create invoices with NEW ADMISSION for months before admission
    const invoices = ACADEMIC_MONTHS.map((month, idx) => {
      const isBeforeAdmission = idx < admissionMonthIdx;
      const netDue = isBeforeAdmission? 0 : Math.max(0, Number(monthlyFee) - Number(discount));

      return {
        month,
        academicYear: year,
        baseFee: Number(monthlyFee),
        concessionAmount: isBeforeAdmission? 0 : Number(discount),
        netDue,
        paidAmount: 0,
        status: isBeforeAdmission? 'new_admission' : 'unpaid',
      };
    });

    // FIXED: Create feeSchedules with base fee
    const feeSchedules = [
      {
        monthlyFee: Number(monthlyFee),
        effectiveFromMonth: selectedAdmissionMonth,
        academicYear: year,
      }
    ];

    onAddStudent({
      serialNo: cleanSerial || suggestedSerialNo,
      rollNo,
      studentName: studentName.trim(),
      fatherName: fatherName.trim(),
      className,
      contactNo: contactNo.trim(),
      contactNo2: contactNo2.trim() || undefined,
      academicYear: year,
      admissionDate: new Date().toISOString().split('T')[0],
      // NEW STRUCTURE
      invoices: invoices as any,
      feeSchedules: feeSchedules as any,
      // Keep for backward compatibility with API
      monthlyFee: Number(monthlyFee),
      feeChanges: [],
    } as any);

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
        <div className="bg-neutral-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutral-800 rounded-lg"><UserPlus className="w-5 h-5 text-neutral-100" /></div>
            <div>
              <h3 className="font-bold text-base leading-tight">Enroll Student & Create Fee Ledger</h3>
              <p className="text-xs text-neutral-400">The Educational Centre • Auto NEW ADMISSION for months before joining</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1"><Hash className="w-3 h-3 inline mr-1 text-neutral-500" />S# *</label>
              <input type="text" value={serialNo} onChange={e => setSerialNo(e.target.value)} placeholder="001" maxLength={6} className="w-full text-sm font-mono font-bold border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none bg-neutral-50" required />
              <span className="text- text-neutral-400">Manual index</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Class *</label>
              <select value={className} onChange={e => setClassName(e.target.value as SchoolClass)} className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none">
                {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Academic Session *</label>
              <select value={year} onChange={e => setYear(e.target.value)} className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none font-medium">
                {availableAcademicYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Student Full Name *</label>
              <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="e.g. Muhammad Rayyan" className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Father's Name *</label>
              <input type="text" value={fatherName} onChange={e => setFatherName(e.target.value)} placeholder="e.g. Tariq Mehmood" className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none" required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">WhatsApp Contact No. 1 *</label>
              <input type="text" value={contactNo} onChange={e => setContactNo(e.target.value)} placeholder="923001234567" className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-neutral-900 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Contact No. 2 (Optional)</label>
              <input type="text" value={contactNo2} onChange={e => setContactNo2(e.target.value)} placeholder="Optional alternate" className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-neutral-900 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Admission Month *</label>
              <select value={selectedAdmissionMonth} onChange={e => setSelectedAdmissionMonth(e.target.value as AcademicMonth)} className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none font-medium bg-blue-50">
                {ACADEMIC_MONTHS.map(m => <option key={m} value={m}>{m} {ACADEMIC_MONTHS.indexOf(m) < ACADEMIC_MONTHS.indexOf(admissionMonth)? '(Will be NEW ADMISSION)' : m === admissionMonth? '(Current)' : ''}</option>)}
              </select>
              <span className="text- text-neutral-500">Months before this will be NEW ADMISSION (0 due)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">M. FEE *</label>
                <input type="number" min="0" value={monthlyFee} onChange={e => setMonthlyFee(Number(e.target.value))} className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Concession</label>
                <input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none" />
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 text-white rounded-lg p-3 text-xs">
            <div className="font-semibold">Preview for {year}:</div>
            <div className="mt-1 grid grid-cols-6 gap-1 text-">
              {ACADEMIC_MONTHS.map(m => {
                const idx = ACADEMIC_MONTHS.indexOf(m);
                const isNewAdm = idx < ACADEMIC_MONTHS.indexOf(selectedAdmissionMonth);
                return <div key={m} className={`px-1.5 py-1 rounded text-center ${isNewAdm? 'bg-white text-black font-bold' : 'bg-neutral-700 text-white'}`}>{m}: {isNewAdm? 'NEW ADMISSION' : `Rs. ${Math.max(0, monthlyFee - discount).toLocaleString()}`}</div>;
              })}
            </div>
            <div className="mt-2 text- text-neutral-400">Total Billed for session: Rs. {(ACADEMIC_MONTHS.length - ACADEMIC_MONTHS.indexOf(selectedAdmissionMonth)) * Math.max(0, monthlyFee - discount)} (not Rs. {ACADEMIC_MONTHS.length * Math.max(0, monthlyFee - discount)}). Excludes NEW ADMISSION months.</div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-neutral-200">
            <button type="button" onClick={onClose} className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100">Cancel</button>
            <button type="submit" className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm">Enroll Student</button>
          </div>
        </form>
      </div>
    </div>
  );
};