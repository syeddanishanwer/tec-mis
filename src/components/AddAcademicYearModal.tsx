import React, { useState } from 'react';
import { CalendarPlus, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  existingYears: string[];
  currentYear: string;
  onClose: () => void;
  onAddYear: (newYear: string, rolloverStudents: boolean, setAsActive: boolean) => void;
}

export const AddAcademicYearModal: React.FC<Props> = ({
  existingYears,
  currentYear,
  onClose,
  onAddYear,
}) => {
  // Compute default suggestion for next year, e.g. "2026-2027" -> "2027-2028"
  const getNextYearSuggestion = (baseYear: string): string => {
    const parts = baseYear.split('-');
    if (parts.length === 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        return `${start + 1}-${end + 1}`;
      }
    }
    const currentCalendarYear = new Date().getFullYear();
    return `${currentCalendarYear}-${currentCalendarYear + 1}`;
  };

  const [newYearInput, setNewYearInput] = useState<string>(getNextYearSuggestion(currentYear));
  const [rolloverStudents, setRolloverStudents] = useState<boolean>(true);
  const [setAsActive, setSetAsActive] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newYearInput.trim();

    if (!trimmed) {
      setError('Please enter a valid academic year session.');
      return;
    }

    // Check for duplicate
    if (existingYears.some((y) => y.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Academic Year "${trimmed}" already exists.`);
      return;
    }

    // Basic format validation warning or check (e.g. 2027-2028)
    const formatRegex = /^\d{4}-\d{4}$/;
    if (!formatRegex.test(trimmed)) {
      setError('Please use the standard format YYYY-YYYY (e.g. 2027-2028).');
      return;
    }

    setError(null);
    onAddYear(trimmed, rolloverStudents, setAsActive);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="bg-neutral-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutral-800 rounded-lg">
              <CalendarPlus className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Add New Academic Year</h3>
              <p className="text-xs text-neutral-400">The Educational Centre Secondary School</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              New Academic Year Session *
            </label>
            <input
              type="text"
              value={newYearInput}
              onChange={(e) => {
                setNewYearInput(e.target.value);
                setError(null);
              }}
              placeholder="e.g. 2027-2028"
              className="w-full text-sm font-semibold border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              required
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Standard format: <code>YYYY-YYYY</code> (e.g., 2027-2028 for the next school year)
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Configuration Checkboxes */}
          <div className="space-y-3 bg-neutral-50 p-3.5 rounded-lg border border-neutral-200">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={rolloverStudents}
                onChange={(e) => setRolloverStudents(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
              <div>
                <span className="font-semibold text-neutral-800">
                  Rollover Enrolled Students
                </span>
                <p className="text-[11px] text-neutral-500 mt-0.5 leading-normal">
                  Initializes a fresh annual fee register for all existing students in the new session with monthly fee status set to unpaid.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={setAsActive}
                onChange={(e) => setSetAsActive(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
              <div>
                <span className="font-semibold text-neutral-800">
                  Switch Active Session Immediately
                </span>
                <p className="text-[11px] text-neutral-500 mt-0.5 leading-normal">
                  Sets the newly created year as the active view across Dashboard, Fee Ledger, and Aging reports.
                </p>
              </div>
            </label>
          </div>

          {/* Existing Sessions reference */}
          <div className="text-[11px] text-neutral-500">
            <span className="font-semibold">Existing Sessions:</span>{' '}
            {existingYears.join(', ')}
          </div>

          {/* Actions */}
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
              <CalendarPlus className="w-3.5 h-3.5 text-indigo-300" />
              Create Academic Year
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
