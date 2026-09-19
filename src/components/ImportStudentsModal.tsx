import React, { useState, useRef } from 'react';
import { StudentRecord } from '../types';
import { parseExcelOrCsvFile, downloadSampleImportTemplate, ParsedImportRow } from '../utils/importHelpers';
import { formatPhoneDisplay } from '../data/mockStudents';
import { ACADEMIC_MONTHS } from '../types';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface Props {
  existingStudents: StudentRecord[];
  activeAcademicYear: string;
  availableAcademicYears?: string[];
  onClose: () => void;
  onImportSuccess: (
    importedStudents: StudentRecord[],
    strategy: 'update_or_add' | 'append' | 'replace',
    stats: { total: number; updated: number; added: number },
    targetYear: string
  ) => void;
}

export const ImportStudentsModal: React.FC<Props> = ({
  existingStudents = [],
  activeAcademicYear = '2026-2027',
  availableAcademicYears,
  onClose,
  onImportSuccess,
}) => {
  const yearsList =
    availableAcademicYears && availableAcademicYears.length > 0
      ? availableAcademicYears
      : [activeAcademicYear || '2026-2027'];

  const [file, setFile] = useState<File | null>(null);
  const [targetYear, setTargetYear] = useState<string>(activeAcademicYear || '2026-2027');
  const [strategy, setStrategy] = useState<'update_or_add' | 'append' | 'replace'>('update_or_add');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedValidRows, setParsedValidRows] = useState<ParsedImportRow[]>([]);
  const [parsedInvalidRows, setParsedInvalidRows] = useState<ParsedImportRow[]>([]);
  const [globalWarnings, setGlobalWarnings] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = async (selectedFile: File) => {
    setIsParsing(true);
    setParseError(null);
    setFile(selectedFile);

    try {
      const result = await parseExcelOrCsvFile(
        selectedFile,
        targetYear,
        existingStudents.length + 1
      );

      setParsedValidRows(result.validRows);
      setParsedInvalidRows(result.invalidRows);
      setGlobalWarnings(result.warnings);

      if (result.validRows.length === 0 && result.invalidRows.length === 0) {
        setParseError('The file contains no readable student rows.');
      }
    } catch (err: any) {
      setParseError(err?.message || 'Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv format.');
      setParsedValidRows([]);
      setParsedInvalidRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Commit imported rows to API payload
  const handleCommitImport = () => {
    if (parsedValidRows.length === 0) return;

    let nextId = Math.max(0, ...existingStudents.map((s) => s.id)) + 1;
    let updatedCount = 0;
    let addedCount = 0;

    const newStudentRecords: (StudentRecord & { feeChanges?: any[] })[] = parsedValidRows.map((row) => {
      // Check if student exists in current register
      const existingMatch = existingStudents.find(
        (s) =>
          (row.rollNo && s.rollNo && s.rollNo.trim().toLowerCase() === row.rollNo.trim().toLowerCase()) ||
          (row.serialNo && s.serialNo && s.serialNo.trim().toLowerCase() === row.serialNo.trim().toLowerCase()) ||
          (s.studentName.trim().toLowerCase() === row.studentName.trim().toLowerCase() &&
            s.fatherName.trim().toLowerCase() === row.fatherName.trim().toLowerCase())
      );

      if (existingMatch) {
        updatedCount++;
      } else {
        addedCount++;
      }

      const recordId = strategy === 'update_or_add' && existingMatch ? existingMatch.id : nextId++;

      const monthlyStatus = { ...row.monthlyStatuses };
      const monthlyAmountsPaid = { ...row.monthlyAmounts };

      return {
        id: recordId,
        serialNo: row.serialNo,
        rollNo: row.rollNo,
        studentName: row.studentName,
        fatherName: row.fatherName,
        className: row.className,
        contactNo: row.contactNo,
        contactNo2: row.contactNo2, // FIXED: Preserved secondary phone number
        monthlyFee: row.monthlyFee,
        discount: row.discount || 0,
        feeChanges: (row.feeChanges || []).filter(
          (change) => change.newFee && Number(change.newFee) !== Number(row.monthlyFee)
        ),
        academicYear: targetYear,
        admissionDate: existingMatch ? existingMatch.admissionDate : new Date().toISOString().split('T')[0],
        monthlyStatus,
        monthlyAmountsPaid,
        yearlyStatus: {
          ...(existingMatch?.yearlyStatus || {}),
          [targetYear]: monthlyStatus,
        },
        yearlyAmountsPaid: {
          ...(existingMatch?.yearlyAmountsPaid || {}),
          [targetYear]: monthlyAmountsPaid,
        },
      };
    });

    onImportSuccess(
      newStudentRecords as StudentRecord[],
      strategy,
      {
        total: parsedValidRows.length,
        updated: updatedCount,
        added: addedCount,
      },
      targetYear
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-neutral-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-800 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Import Student Fee Ledger</h3>
              <p className="text-xs text-neutral-400">
                Plug in Excel (.xlsx, .xls) or CSV sheet with student details and fee amounts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadSampleImportTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-medium transition-colors"
              title="Download sample spreadsheet with S#, Class, Roll No, Name, Contact, Fee & Month columns"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Download Excel Template
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* File Upload / Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging
                ? 'border-emerald-500 bg-emerald-50/40 scale-[0.99]'
                : file
                  ? 'border-neutral-300 bg-neutral-50/60'
                  : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50/50'
              }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div
                className={`p-3 rounded-full ${file ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
                  }`}
              >
                <Upload className="w-6 h-6" />
              </div>
              {file ? (
                <div>
                  <p className="text-sm font-bold text-neutral-800">{file.name}</p>
                  <p className="text-xs text-neutral-500">
                    {(file.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-neutral-800">
                    Drag and drop your Excel (.xlsx, .csv) file here, or{' '}
                    <span className="text-neutral-900 underline font-bold">browse</span>
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Columns: S#, Class, Roll No, Student Name, Father Name, Contact No 1 & 2, Monthly Fee (PKR), New Fee 1-3 & Effective Months, Jun..May
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Configuration Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 text-xs">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Target Academic Session
              </label>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-neutral-300 rounded-lg p-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              >
                {yearsList.map((yr) => (
                  <option key={yr} value={yr}>
                    Session {yr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Import Strategy
              </label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="w-full text-xs font-semibold bg-white border border-neutral-300 rounded-lg p-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              >
                <option value="update_or_add">
                  Update existing students & add new (Recommended)
                </option>
                <option value="append">Append all as new students</option>
                <option value="replace">Replace entire school register</option>
              </select>
            </div>
          </div>

          {/* Parse error if any */}
          {parseError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Warnings if any */}
          {globalWarnings.length > 0 && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                {globalWarnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            </div>
          )}

          {/* Parsed Summary Banner */}
          {parsedValidRows.length > 0 && (
            <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200 px-4 py-2.5 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-emerald-900">
                  {parsedValidRows.length} Students ready to import
                </span>
                {parsedInvalidRows.length > 0 && (
                  <span className="text-red-600 font-medium">
                    ({parsedInvalidRows.length} rows skipped due to errors)
                  </span>
                )}
              </div>
              <span className="text-neutral-500">
                Total monthly fees: Rs.{' '}
                {parsedValidRows
                  .reduce((acc, r) => acc + r.monthlyFee, 0)
                  .toLocaleString()}
              </span>
            </div>
          )}

          {/* Data Preview Table */}
          {parsedValidRows.length > 0 && (
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <div className="bg-neutral-100 px-3 py-2 border-b border-neutral-200 flex items-center justify-between text-xs font-semibold text-neutral-700">
                <span>Spreadsheet Data Preview</span>
                <span className="text-[11px] text-neutral-500 font-normal">
                  Showing {parsedValidRows.length} rows
                </span>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-neutral-900 text-white text-[10px] uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-2 text-center w-10">S#</th>
                      <th className="py-2 px-2">Class</th>
                      <th className="py-2 px-2">Roll No</th>
                      <th className="py-2 px-2">Student Name</th>
                      <th className="py-2 px-2">Father Name</th>
                      <th className="py-2 px-2">Contact No 1</th>
                      <th className="py-2 px-2">Contact No 2</th>
                      <th className="py-2 px-2 text-right">M. Fee</th>
                      {ACADEMIC_MONTHS.map((m) => (
                        <th key={m} className="py-2 px-1 text-center min-w-[55px]">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {parsedValidRows.map((row) => (
                      <tr key={row.rowNumber} className="hover:bg-neutral-50">
                        <td className="py-2 px-2 text-center font-mono font-bold text-neutral-700 bg-neutral-50">
                          {row.serialNo}
                        </td>
                        <td className="py-2 px-2 font-medium text-neutral-800 whitespace-nowrap">
                          {row.className}
                        </td>
                        <td className="py-2 px-2 font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                          {row.rollNo}
                        </td>
                        <td className="py-2 px-2 font-semibold text-neutral-900 whitespace-nowrap">
                          {row.studentName}
                        </td>
                        <td className="py-2 px-2 text-neutral-700 whitespace-nowrap">
                          {row.fatherName}
                        </td>
                        <td className="py-2 px-2 font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                          {formatPhoneDisplay(row.contactNo)}
                        </td>
                        <td className="py-2 px-2 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                          {row.contactNo2 ? formatPhoneDisplay(row.contactNo2) : '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold text-neutral-800 whitespace-nowrap">
                          Rs. {row.monthlyFee.toLocaleString()}
                        </td>
                        {ACADEMIC_MONTHS.map((m) => {
                          const amt = row.monthlyAmounts[m] || 0;
                          const status = row.monthlyStatuses[m];

                          let badgeColor = 'bg-red-50 text-red-700 border-red-200';
                          if (status === 'paid') {
                            badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                          } else if (status === 'partial') {
                            badgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
                          }

                          return (
                            <td key={m} className="py-1.5 px-1 text-center whitespace-nowrap">
                              <div
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeColor}`}
                                title={`${m}: Rs. ${amt.toLocaleString()} (${status.toUpperCase()})`}
                              >
                                {amt > 0 ? `${amt.toLocaleString()}` : '-'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-neutral-50 px-6 py-3.5 border-t border-neutral-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCommitImport}
            disabled={parsedValidRows.length === 0 || isParsing}
            className={`inline-flex items-center gap-2 text-xs font-bold px-5 py-2 rounded-lg shadow-xs transition-colors ${parsedValidRows.length > 0 && !isParsing
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer'
                : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
              }`}
          >
            {isParsing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Parsing File...
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5" />
                Import {parsedValidRows.length} Students & Fees
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};