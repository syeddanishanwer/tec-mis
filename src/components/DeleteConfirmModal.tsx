import React from 'react';
import { StudentRecord } from '../types';
import { calculateStudentTotals, formatPhoneDisplay } from '../data/mockStudents';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface Props {
  student: StudentRecord;
  activeAcademicYear?: string;
  onClose: () => void;
  onConfirmDelete: (studentId: number) => void;
}

export const DeleteConfirmModal: React.FC<Props> = ({
  student,
  activeAcademicYear = '2026-2027',
  onClose,
  onConfirmDelete,
}) => {
  const totals = calculateStudentTotals(student, 8, activeAcademicYear);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-red-200 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-red-600 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-700/80 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Delete Student Record</h3>
              <p className="text-xs text-red-100">Permanent removal from school register</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-red-200 hover:text-white hover:bg-red-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-neutral-600 leading-relaxed">
            Are you sure you want to delete this student? All historical fee ledger status records,
            monthly dues, and WhatsApp links for this student will be removed.
          </p>

          <div className="bg-neutral-50 rounded-lg p-3.5 border border-neutral-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-neutral-500">S# (Serial No):</span>
              <strong className="font-mono text-neutral-900 bg-neutral-200/80 px-2 py-0.5 rounded text-[11px]">
                {student.serialNo || String(student.id).padStart(3, '0')}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Student Name:</span>
              <strong className="text-neutral-900">{student.studentName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Father's Name:</span>
              <span className="text-neutral-700">{student.fatherName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Class & Roll No:</span>
              <span className="text-neutral-800 font-medium">
                {student.className} ({student.rollNo})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Contact No:</span>
              <span className="font-mono text-neutral-700">{formatPhoneDisplay(student.contactNo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Monthly Fee:</span>
              <span className="text-neutral-900 font-semibold">Rs. {student.monthlyFee.toLocaleString()}</span>
            </div>
            {totals.totalOutstanding > 0 && (
              <div className="flex justify-between pt-1 border-t border-neutral-200 text-rose-600 font-bold">
                <span>Outstanding Dues:</span>
                <span>Rs. {totals.totalOutstanding.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-red-50/80 rounded-lg border border-red-100 flex items-start gap-2 text-[11px] text-red-700">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>
              This action cannot be undone. Confirming will immediately remove this student from
              the active register.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirmDelete(student.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Yes, Delete Student
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
