import React, { useState } from 'react';
import { SchoolClass, StudentRecord } from '../types';
import { ALL_CLASSES } from '../data/mockStudents';
import { UserPlus, X, Hash } from 'lucide-react';

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
  const [serialNo, setSerialNo] = useState(suggestedSerialNo);
  const [studentName, setStudentName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [className, setClassName] = useState<SchoolClass>('Class I');
  const [contactNo, setContactNo] = useState('923001234567');
  const [monthlyFee, setMonthlyFee] = useState<number>(3500);
  const [discount, setDiscount] = useState<number>(0);
  const [year, setYear] = useState<string>(currentAcademicYear);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !fatherName.trim()) return;

    // Standardize serial number (e.g. '1' -> '001', '02' -> '002')
    let cleanSerial = serialNo.trim();
    if (/^\d+$/.test(cleanSerial)) {
      cleanSerial = cleanSerial.padStart(3, '0');
    }

    const rollNo = 'ETC-' + Math.floor(1000 + Math.random() * 9000);

    onAddStudent({
      serialNo: cleanSerial || suggestedSerialNo,
      rollNo,
      studentName: studentName.trim(),
      fatherName: fatherName.trim(),
      className,
      contactNo: contactNo.trim(),
      monthlyFee: Number(monthlyFee),
      discount: Number(discount),
      academicYear: year,
      admissionDate: new Date().toISOString().split('T')[0],
      monthlyStatus: {
        Jun: 'paid',
        Jul: 'pending',
        Aug: 'pending',
        Sep: 'pending',
        Oct: 'pending',
        Nov: 'pending',
        Dec: 'pending',
        Jan: 'pending',
        Feb: 'pending',
        Mar: 'pending',
        Apr: 'pending',
        May: 'pending',
      },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
        <div className="bg-neutral-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutral-800 rounded-lg">
              <UserPlus className="w-5 h-5 text-neutral-100" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Enroll Student & Create Fee Ledger</h3>
              <p className="text-xs text-neutral-400">The Educational Centre Secondary School &bull; Jun–May Fee Matrix</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                <Hash className="w-3 h-3 inline mr-1 text-neutral-500" />
                S# (e.g. 001, 002) *
              </label>
              <input
                type="text"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="001"
                maxLength={6}
                className="w-full text-sm font-mono font-bold border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none bg-neutral-50"
                required
              />
              <span className="text-[10px] text-neutral-400">Manual index</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Class Enrollment *</label>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value as SchoolClass)}
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              >
                {ALL_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Academic Session *</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none font-medium"
              >
                {availableAcademicYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Student Full Name *</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Muhammad Rayyan"
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Father's Name *</label>
              <input
                type="text"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                placeholder="e.g. Tariq Mehmood"
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                WhatsApp Contact No. *
              </label>
              <input
                type="text"
                value={contactNo}
                onChange={(e) => setContactNo(e.target.value)}
                placeholder="923001234567"
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">M. FEE (Base Monthly Fee) *</label>
              <input
                type="number"
                min="0"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(Number(e.target.value))}
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Concession / Discount (PKR)</label>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm"
            >
              Enroll Student
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
