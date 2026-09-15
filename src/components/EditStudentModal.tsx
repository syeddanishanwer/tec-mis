import React, { useState } from 'react';
import { SchoolClass, StudentRecord } from '../types';
import { ALL_CLASSES, formatPhoneDisplay } from '../data/mockStudents';
import { UserCheck, X, Hash } from 'lucide-react';

interface Props {
  student: StudentRecord;
  onClose: () => void;
  onSaveStudent: (updatedStudent: StudentRecord) => void;
}

export const EditStudentModal: React.FC<Props> = ({ student, onClose, onSaveStudent }) => {
  const [serialNo, setSerialNo] = useState<string>(student.serialNo || String(student.id).padStart(3, '0'));
  const [studentName, setStudentName] = useState<string>(student.studentName);
  const [fatherName, setFatherName] = useState<string>(student.fatherName);
  const [className, setClassName] = useState<SchoolClass>(student.className);
  const [contactNo, setContactNo] = useState<string>(student.contactNo);
  const [monthlyFee, setMonthlyFee] = useState<number>(student.monthlyFee);
  const [discount, setDiscount] = useState<number>(student.discount || 0);
  const [rollNo, setRollNo] = useState<string>(student.rollNo);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !fatherName.trim()) return;

    // Standardize serial number if numeric (e.g. '1' -> '001', '02' -> '002')
    let cleanSerial = serialNo.trim();
    if (/^\d+$/.test(cleanSerial)) {
      cleanSerial = cleanSerial.padStart(3, '0');
    }

    onSaveStudent({
      ...student,
      serialNo: cleanSerial || student.serialNo || String(student.id).padStart(3, '0'),
      studentName: studentName.trim(),
      fatherName: fatherName.trim(),
      className,
      contactNo: contactNo.trim(),
      monthlyFee: Math.max(0, Number(monthlyFee)),
      discount: Math.max(0, Number(discount)),
      rollNo: rollNo.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-neutral-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutral-800 rounded-lg">
              <UserCheck className="w-5 h-5 text-neutral-100" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Edit Student Record</h3>
              <p className="text-xs text-neutral-400">
                Update S#, Class, Names, Contact, and Monthly Fee (M. FEE)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* S# (Serial No) and Class */}
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
              <span className="text-[10px] text-neutral-400">Manual register index</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Class *
              </label>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value as SchoolClass)}
                className="w-full text-sm font-medium border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              >
                {ALL_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Roll No.
              </label>
              <input
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="ETC-1001"
                className="w-full text-sm font-mono border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Student Name & Father Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Student Name *
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Student Name"
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Father Name *
              </label>
              <input
                type="text"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                placeholder="Father Name"
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none font-medium"
                required
              />
            </div>
          </div>

          {/* Contact No. */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Contact No. (WhatsApp Mobile) *
            </label>
            <input
              type="text"
              value={contactNo}
              onChange={(e) => setContactNo(e.target.value)}
              placeholder="923001234567 or 03001234567"
              className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              required
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Formatted Preview: <strong className="text-neutral-800">{formatPhoneDisplay(contactNo)}</strong>
            </p>
          </div>

          {/* M. FEE and Concession */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                M. FEE (Monthly Fee in PKR) *
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(Number(e.target.value))}
                className="w-full text-sm font-semibold border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Concession / Discount (PKR)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full text-sm border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 text-xs flex justify-between items-center">
            <span className="text-neutral-500">Effective Monthly Payable:</span>
            <span className="font-bold text-neutral-900 text-sm">
              Rs. {Math.max(0, monthlyFee - discount).toLocaleString()}
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex justify-end gap-2 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Save Student Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
