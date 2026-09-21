import React, { useState, useMemo, useEffect } from 'react';
import { StudentRecord, SchoolClass, AcademicMonth, ACADEMIC_MONTHS, PaymentStatus, Invoice } from '../types';
import {
  ALL_CLASSES,
  calculateStudentTotals,
  formatPhoneDisplay,
  getEffectiveMonthlyStatus,
  getStudentMonthlyFeeForMonth as getEffectiveFeeForMonth, // Clean & explicit
  formatSerialNo,
} from '../data/mockStudents';
import { exportToCSV, exportToExcel, printFeeLedger } from '../utils/exportHelpers';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  CreditCard,
  Phone,
  Pencil,
  Trash2,
  Upload,
  RefreshCw,
} from 'lucide-react';

// Custom Hook to fetch Invoices from API, filtered by academic year
export const useInvoices = (academicYear?: string) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const url = academicYear ? `/api/invoices?academicYear=${academicYear}` : '/api/invoices';
        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();
        if (isMounted) setInvoices(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching invoices:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInvoices();
    return () => {
      isMounted = false;
    };
  }, [academicYear, refetchTrigger]);

  const refetch = () => setRefetchTrigger((t) => t + 1);

  return { invoices, loading, refetch };
};

interface Props {
  students: StudentRecord[];
  activeAcademicYear?: string;
  activeMonth?: AcademicMonth;
  invoicesMap?: Map<string, Invoice>; // <--- Add this
  onActiveMonthChange?: (month: AcademicMonth) => void;
  onOpenWhatsApp: (student: StudentRecord, month: AcademicMonth) => void;
  onOpenPaymentModal: (student: StudentRecord) => void;
  onOpenAddStudent: () => void;
  onOpenImport: () => void;
  onEditStudent: (student: StudentRecord) => void;
  onDeleteStudent: (student: StudentRecord) => void;
  onToggleMonthStatus: (studentId: number, month: AcademicMonth) => void;
  onUpdateMonthAmount?: (studentId: number, month: AcademicMonth, amount: number) => void;
}

export const FeeLedger: React.FC<Props> = ({
  students,
  activeAcademicYear = '2026-2027',
  activeMonth,
  invoicesMap: externalInvoiceMap, // <--- Add this
  onActiveMonthChange,
  onOpenWhatsApp,
  onOpenPaymentModal,
  onOpenAddStudent,
  onOpenImport,
  onEditStudent,
  onDeleteStudent,
  onToggleMonthStatus,
  onUpdateMonthAmount,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [internalActiveMonth, setInternalActiveMonth] = useState<AcademicMonth>('Jun');
  const [cellDisplayMode, setCellDisplayMode] = useState<'both' | 'amounts' | 'status'>('both');
  const [sortField, setSortField] = useState<'id' | 'className' | 'studentName' | 'collected' | 'total'>('id');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Fetch Invoices from API for the active academic year
  const { invoices, refetch: refetchInvoices } = useInvoices(activeAcademicYear);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);

  const handleGenerateInvoices = async () => {
    setIsGenerating(true);
    setGenerateMessage(null);
    try {
      const res = await fetch('/api/fees/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ academicYear: activeAcademicYear, month: activeReminderMonth }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateMessage(`⚠️ ${data.error || 'Failed to generate invoices.'}`);
      } else {
        setGenerateMessage(`✅ ${data.message}`);
        refetchInvoices();
      }
    } catch (err) {
      console.error('Generate invoices failed:', err);
      setGenerateMessage('⚠️ Network error while generating invoices.');
    } finally {
      setIsGenerating(false);
      setTimeout(() => setGenerateMessage(null), 5000);
    }
  };

  const activeReminderMonth = activeMonth || internalActiveMonth;


  // Quick lookup map: "studentId_month" -> Invoice (e.g. "1000_Sep")
  const invoiceMap = useMemo(() => {
    if (externalInvoiceMap && externalInvoiceMap.size > 0) {
      return externalInvoiceMap;
    }
    const map = new Map<string, Invoice>();
    invoices.forEach((inv) => {
      map.set(`${inv.studentId}_${inv.month}`, inv);
    });
    return map;
  }, [invoices, externalInvoiceMap]);

  // Inline editing state for "Amounts Only (PKR)" mode
  const [editingCell, setEditingCell] = useState<{
    studentId: number;
    month: AcademicMonth;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleStartEditAmount = (
    studentId: number,
    month: AcademicMonth,
    currentAmount: number
  ) => {
    setEditingCell({ studentId, month });
    setEditValue(currentAmount > 0 ? String(currentAmount) : '');
  };

  const handleCommitAmount = async (studentId: number, month: AcademicMonth) => {
    const parsed = parseInt(editValue, 10);
    const finalAmt = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    if (onUpdateMonthAmount) {
      await onUpdateMonthAmount(studentId, month, finalAmt);
    }
    refetchInvoices(); // Immediately refresh local invoices state from API
    setEditingCell(null);
  };

  // Active month synchronization
  const handleActiveMonthChange = (m: AcademicMonth) => {
    if (onActiveMonthChange) {
      onActiveMonthChange(m);
    } else {
      setInternalActiveMonth(m);
    }
  };

  // Derive visible months: show only up to selected active month, hide the rest
  const activeMonthIndex = ACADEMIC_MONTHS.indexOf(activeReminderMonth);
  const visibleMonths = ACADEMIC_MONTHS.slice(0, activeMonthIndex + 1);

  // Filter & Search Logic
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (selectedClass !== 'ALL' && s.className !== selectedClass) {
          return false;
        }

        if (selectedStatus !== 'ALL') {
          const inv = invoiceMap.get(`${s.id}_${activeReminderMonth}`);
          const currentStatus = inv ? inv.status : 'unpaid';
          if (currentStatus !== selectedStatus) {
            return false;
          }
        }

        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const match =
            s.studentName.toLowerCase().includes(q) ||
            s.fatherName.toLowerCase().includes(q) ||
            s.contactNo.includes(q) ||
            s.rollNo.toLowerCase().includes(q) ||
            s.className.toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortField === 'id') {
          const sA = a.serialNo || String(a.id);
          const sB = b.serialNo || String(b.id);
          const numA = parseInt(sA, 10);
          const numB = parseInt(sB, 10);
          if (!isNaN(numA) && !isNaN(numB)) {
            return sortAsc ? numA - numB : numB - numA;
          }
          return sortAsc ? sA.localeCompare(sB) : sB.localeCompare(sA);
        }
        if (sortField === 'className') {
          return sortAsc
            ? a.className.localeCompare(b.className)
            : b.className.localeCompare(a.className);
        }
        if (sortField === 'studentName') {
          return sortAsc
            ? a.studentName.localeCompare(b.studentName)
            : b.studentName.localeCompare(a.studentName);
        }
        if (sortField === 'collected') {
          const cA = calculateStudentTotals(a, activeMonthIndex, activeAcademicYear).totalCollected;
          const cB = calculateStudentTotals(b, activeMonthIndex, activeAcademicYear).totalCollected;
          return sortAsc ? cA - cB : cB - cA;
        }
        if (sortField === 'total') {
          const totalA = calculateStudentTotals(a, activeMonthIndex, activeAcademicYear).totalDue;
          const totalB = calculateStudentTotals(b, activeMonthIndex, activeAcademicYear).totalDue;
          return sortAsc ? totalA - totalB : totalB - totalA;
        }
        return 0;
      });
  }, [students, selectedClass, selectedStatus, searchQuery, activeReminderMonth, sortField, sortAsc, activeAcademicYear, activeMonthIndex, invoiceMap]);

  // Aggregate totals for the filtered ledger up to active month, computed from DB invoices
  const ledgerTotals = useMemo(() => {
    let billed = 0;
    let collected = 0;
    let due = 0;
    let fullClearCount = 0;
    let overdueCount = 0;

    filteredStudents.forEach((student) => {
      let studentDue = 0;
      visibleMonths.forEach((m) => {
        const inv = invoiceMap.get(`${student.id}_${m}`);
        if (inv) {
          billed += inv.netDue;
          collected += inv.paidAmount;
          const invDue = Math.max(0, inv.netDue - inv.paidAmount);
          due += invDue;
          studentDue += invDue;
        } else {
          // No invoice generated yet for this month — fall back to the flat rate
          // so the ledger still shows a sensible number before generation runs.
          const net = getEffectiveFeeForMonth(student, m); billed += net;
          due += net;
          studentDue += net;
        }
      });

      if (studentDue === 0) fullClearCount++;
      else overdueCount++;
    });

    const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;
    return { billed, collected, due, fullClearCount, overdueCount, rate };
  }, [filteredStudents, visibleMonths, invoiceMap]);

  interface GroupTotals {
    monthlyFee: number;
    discounts: number;
    netMonthlyFee: number;
    months: Record<AcademicMonth, { collected: number; due: number }>;
    totalCollected: number;
    totalDue: number;
  }

  const computeTotalsForStudents = (studentList: StudentRecord[]): GroupTotals => {
    let monthlyFee = 0;
    let discounts = 0;
    let totalCollected = 0;
    let totalDue = 0;

    const monthsMap: Record<AcademicMonth, { collected: number; due: number }> = {
      Jun: { collected: 0, due: 0 }, Jul: { collected: 0, due: 0 }, Aug: { collected: 0, due: 0 },
      Sep: { collected: 0, due: 0 }, Oct: { collected: 0, due: 0 }, Nov: { collected: 0, due: 0 },
      Dec: { collected: 0, due: 0 }, Jan: { collected: 0, due: 0 }, Feb: { collected: 0, due: 0 },
      Mar: { collected: 0, due: 0 }, Apr: { collected: 0, due: 0 }, May: { collected: 0, due: 0 },
    };

    studentList.forEach((s) => {
      monthlyFee += s.monthlyFee || 0;
      discounts += s.discount || 0;

      visibleMonths.forEach((m) => {
        const inv = invoiceMap.get(`${s.id}_${m}`);
        let paid = 0;
        let due = 0;

        if (inv) {
          paid = inv.paidAmount;
          due = Math.max(0, inv.netDue - paid);
        } else {
          const netFee = getEffectiveFeeForMonth(s, m);
          paid = s.monthlyAmountsPaid?.[m] || 0;
          due = Math.max(0, netFee - paid);
        }

        monthsMap[m].collected += paid;
        monthsMap[m].due += due;
        totalCollected += paid;
        totalDue += due;
      });
    });

    return {
      monthlyFee,
      discounts,
      netMonthlyFee: Math.max(0, monthlyFee - discounts),
      months: monthsMap,
      totalCollected,
      totalDue,
    };
  };

  interface ClassGroup {
    className: string;
    students: StudentRecord[];
    totals: GroupTotals;
  }

  const classGroups = useMemo<ClassGroup[]>(() => {
    if (filteredStudents.length === 0) return [];

    const classMap = new Map<string, StudentRecord[]>();
    filteredStudents.forEach((student) => {
      if (!classMap.has(student.className)) {
        classMap.set(student.className, []);
      }
      classMap.get(student.className)!.push(student);
    });

    const groups: ClassGroup[] = [];
    classMap.forEach((cStudents, cName) => {
      groups.push({
        className: cName,
        students: cStudents,
        totals: computeTotalsForStudents(cStudents),
      });
    });

    return groups;
  }, [filteredStudents, visibleMonths, invoiceMap]);

  const overallTotals = useMemo<GroupTotals>(() => {
    return computeTotalsForStudents(filteredStudents);
  }, [filteredStudents, visibleMonths, invoiceMap]);

  const handleSort = (field: 'id' | 'className' | 'studentName' | 'collected' | 'total') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'collected' || field === 'total' ? false : true);
    }
  };

  const getStatusBadge = (
    status: PaymentStatus,
    studentId: number,
    month: AcademicMonth,
    amount: number
  ) => {
    let bg = 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
    let label = 'Unpaid';
    if (status === 'paid') {
      bg = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
      label = 'Paid';
    } else if (status === 'partial') {
      bg = 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
      label = 'Partial';
    }
    if (cellDisplayMode === 'amounts') {
      const isEditing =
        editingCell?.studentId === studentId && editingCell?.month === month;

      if (isEditing) {
        return (
          <div className="inline-block relative z-10" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              min="0"
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => handleCommitAmount(studentId, month)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCommitAmount(studentId, month);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingCell(null);
                }
              }}
              placeholder="0"
              className="w-16 px-1 py-0.5 text-xs font-mono font-bold text-center border-2 border-blue-600 rounded bg-white text-neutral-900 shadow-sm focus:outline-none ring-2 ring-blue-300"
            />
          </div>
        );
      }

      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleStartEditAmount(studentId, month, amount);
          }}
          title={`Click to change fee amount for ${month} • Current: Rs. ${amount.toLocaleString()}`}
          className={`px-1.5 py-1 text-[11px] font-semibold rounded-md border transition-all cursor-pointer text-center min-w-[54px] hover:border-blue-500 hover:ring-2 hover:ring-blue-300/60 ${bg}`}
        >
          <span className="font-mono text-[11px] font-bold block">
            {amount > 0 ? amount.toLocaleString() : '0'}
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onToggleMonthStatus(studentId, month)}
        title={`Click to cycle status for ${month} (Paid -> Partial -> Unpaid) • Amount: Rs. ${amount.toLocaleString()}`}
        className={`px-1.5 py-1 text-[11px] font-semibold rounded-md border transition-all cursor-pointer text-center min-w-[54px] ${bg}`}
      >
        {cellDisplayMode === 'status' ? (
          <span>{label}</span>
        ) : (
          <div className="leading-tight">
            <span>{label}</span>
            <span className="block text-[9.5px] font-mono opacity-85 font-normal">
              {amount > 0 ? `${amount.toLocaleString()}` : '0'}
            </span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mr-1">
              Exports:
            </span>
            <button
              onClick={() =>
                exportToExcel(
                  filteredStudents,
                  `School_Fee_Ledger_${activeAcademicYear.replace('-', '_')}.xlsx`,
                  activeAcademicYear
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-medium transition-colors"
              title="Export to Excel Spreadsheet (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Excel (.xlsx)
            </button>
            <button
              onClick={() =>
                printFeeLedger(
                  filteredStudents,
                  `School Fee Ledger ${activeAcademicYear}`,
                  activeAcademicYear
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-lg text-xs font-medium transition-colors"
              title="Export to PDF with landscape autowidth"
            >
              <FileText className="w-3.5 h-3.5 text-red-600" />
              PDF (.pdf)
            </button>
            <button
              onClick={() =>
                exportToCSV(
                  filteredStudents,
                  `School_Fee_Ledger_${activeAcademicYear.replace('-', '_')}.csv`,
                  activeAcademicYear
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-lg text-xs font-medium transition-colors"
              title="Download standard CSV format"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-600" />
              CSV
            </button>
            <button
              onClick={() =>
                printFeeLedger(
                  filteredStudents,
                  `School Fee Ledger ${activeAcademicYear}`,
                  activeAcademicYear
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-lg text-xs font-medium transition-colors"
              title="Print view formatted for school registers"
            >
              <Printer className="w-3.5 h-3.5 text-neutral-600" />
              Print
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateInvoices}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              title={`Generate invoices for ${activeReminderMonth} (${activeAcademicYear}) using the current fee schedule`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Generating...' : `Generate ${activeReminderMonth} Invoices`}
            </button>
            <button
              onClick={onOpenImport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              title="Import student records and monthly fee amounts from Excel (.xlsx, .csv)"
            >
              <Upload className="w-3.5 h-3.5 text-white" />
              Import Excel (.xlsx)
            </button>
            <button
              onClick={onOpenAddStudent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Enroll Student
            </button>
          </div>
          {generateMessage && (
            <div className="text-xs font-medium px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-700">
              {generateMessage}
            </div>
          )}
        </div>

        {/* Dynamic Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-neutral-100">
          <div>
            <label className="text-xs font-semibold text-neutral-600 block mb-1">
              <Filter className="w-3 h-3 inline mr-1" />
              Filter by Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full text-xs font-medium bg-neutral-50 border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Classes (Showing All)</option>
              {ALL_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-600 block mb-1">
              Active Month
            </label>
            <select
              value={activeReminderMonth}
              onChange={(e) => handleActiveMonthChange(e.target.value as AcademicMonth)}
              className="w-full text-xs font-medium bg-neutral-50 border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {ACADEMIC_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m} (Active Academic Session)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-600 block mb-1">
              Payment Status ({activeReminderMonth})
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs font-medium bg-neutral-50 border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="unpaid">Unpaid Only (Defaulters)</option>
              <option value="partial">Partial Payment</option>
              <option value="paid">Paid (Cleared)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-600 block mb-1">
              Search Student / Parent / Phone
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roll, name, father..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* View Mode & Month Columns Configuration Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-600">Month Columns View:</span>
            <div className="inline-flex rounded-lg border border-neutral-300 bg-neutral-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setCellDisplayMode('both')}
                className={`px-2.5 py-1 rounded-md transition-all ${cellDisplayMode === 'both'
                  ? 'bg-white text-neutral-900 font-bold shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
                  }`}
              >
                Status & Amounts
              </button>
              <button
                type="button"
                onClick={() => setCellDisplayMode('amounts')}
                className={`px-2.5 py-1 rounded-md transition-all ${cellDisplayMode === 'amounts'
                  ? 'bg-white text-neutral-900 font-bold shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
                  }`}
              >
                Amounts Only (PKR)
              </button>
              <button
                type="button"
                onClick={() => setCellDisplayMode('status')}
                className={`px-2.5 py-1 rounded-md transition-all ${cellDisplayMode === 'status'
                  ? 'bg-white text-neutral-900 font-bold shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
                  }`}
              >
                Status Only
              </button>
            </div>
          </div>

          <div className="text-xs text-neutral-500 font-medium flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Current Register: <strong className="text-neutral-800">{filteredStudents.length} Students</strong></span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards reflecting cumulative totals up to active month */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
            Total Billed (Jun - {activeReminderMonth})
          </span>
          <div className="text-lg font-bold text-neutral-900 mt-1">
            Rs. {ledgerTotals.billed.toLocaleString()}
          </div>
          <span className="text-[10px] text-neutral-400">
            Across {filteredStudents.length} students
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 bg-gradient-to-br from-white to-emerald-50/20 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
            Total Collected
          </span>
          <div className="text-lg font-bold text-emerald-700 mt-1">
            Rs. {ledgerTotals.collected.toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">
            {ledgerTotals.rate}% recovery rate
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-red-200/70 bg-gradient-to-br from-white to-red-50/20 shadow-xs">
          <span className="text-[11px] font-semibold text-red-800 uppercase tracking-wider block">
            Total Due / Overdue
          </span>
          <div className="text-lg font-bold text-red-600 mt-1">
            Rs. {ledgerTotals.due.toLocaleString()}
          </div>
          <span className="text-[10px] text-red-500">
            {ledgerTotals.overdueCount} students with dues
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200/70 bg-gradient-to-br from-white to-blue-50/20 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider block">
            Active Evaluation
          </span>
          <div className="text-lg font-bold text-blue-900 mt-1">
            Through {activeReminderMonth}
          </div>
          <span className="text-[10px] text-blue-600">
            Session {activeAcademicYear} ({visibleMonths.length} active months)
          </span>
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="px-4 py-2 bg-neutral-50/90 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-800 text-xs">
              Showing active months: June to {activeReminderMonth} ({visibleMonths.length} months visible)
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-emerald-700 font-semibold">
              Collected: Rs. {ledgerTotals.collected.toLocaleString()}
            </span>
            <span className="text-neutral-300">|</span>
            <span className="text-red-600 font-semibold">
              Due: Rs. {ledgerTotals.due.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar w-full">
          <table
            className="w-full text-left border-collapse text-xs"
            style={{ minWidth: `${Math.max(1180, 780 + visibleMonths.length * 68)}px` }}
          >
            <thead>
              <tr className="bg-neutral-900 text-white font-semibold text-[11px] uppercase tracking-wider select-none">
                <th
                  onClick={() => handleSort('id')}
                  className="py-3 px-3 cursor-pointer hover:bg-neutral-800 w-12 text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    S#
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('className')}
                  className="py-3 px-3 cursor-pointer hover:bg-neutral-800"
                >
                  <div className="flex items-center gap-1">
                    Class
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('studentName')}
                  className="py-3 px-3 cursor-pointer hover:bg-neutral-800 min-w-[140px]"
                >
                  <div className="flex items-center gap-1">
                    Student Name
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[130px]">Father Name</th>
                <th className="py-3 px-3 min-w-[110px]">Contact No.</th>
                <th className="py-3 px-3 text-right min-w-[85px]">M. FEE</th>
                {visibleMonths.map((m) => (
                  <th
                    key={m}
                    className={`py-3 px-1.5 text-center min-w-[62px] ${m === activeReminderMonth ? 'bg-blue-900/80 text-blue-200 font-bold border-b-2 border-blue-400' : ''
                      }`}
                  >
                    {m}
                  </th>
                ))}
                <th
                  onClick={() => handleSort('collected')}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-neutral-800 min-w-[115px]"
                >
                  <div className="flex items-center justify-end gap-1">
                    Total Collected
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('total')}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-neutral-800 min-w-[110px]"
                >
                  <div className="flex items-center justify-end gap-1">
                    Total Due
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center min-w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/70">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9 + visibleMonths.length} className="py-12 text-center text-neutral-400">
                    No student records found matching the active criteria.
                  </td>
                </tr>
              ) : (
                <>
                  {classGroups.map((group) => {
                    return (
                      <React.Fragment key={group.className}>
                        {group.students.map((student) => {
                          const globalIdx = filteredStudents.indexOf(student);
                          const displaySNo = student.serialNo
                            ? formatSerialNo(student.serialNo)
                            : formatSerialNo(student.id, globalIdx + 1);

                          // Compute per-student totals directly from DB Invoices
                          let studentCollected = 0;
                          let studentDue = 0;
                          let studentOverdueCount = 0;

                          visibleMonths.forEach((m) => {
                            const inv = invoiceMap.get(`${student.id}_${m}`);
                            if (inv) {
                              const dueAmt = Math.max(0, inv.netDue - inv.paidAmount);
                              studentCollected += inv.paidAmount;
                              studentDue += dueAmt;
                              if (dueAmt > 0) studentOverdueCount++;
                            } else {
                              const netFee = getEffectiveFeeForMonth(student, m);
                              const paid = student.monthlyAmountsPaid?.[m] || 0;
                              const dueAmt = Math.max(0, netFee - paid);
                              studentCollected += paid;
                              studentDue += dueAmt;
                              if (dueAmt > 0) studentOverdueCount++;
                            }
                          });

                          const isCriticalDefaulter = studentOverdueCount >= 3;

                          return (
                            <tr
                              key={student.id}
                              className={`hover:bg-neutral-50/90 transition-colors ${isCriticalDefaulter ? 'bg-red-50/30' : ''
                                }`}
                            >
                              <td className="py-2.5 px-3 text-center text-neutral-800 font-mono font-bold text-xs bg-neutral-50/50">
                                {displaySNo}
                              </td>

                              <td className="py-2.5 px-3">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-800 border border-neutral-300/80 whitespace-nowrap">
                                  {student.className}
                                </span>
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-neutral-900 leading-tight">
                                  {student.studentName}
                                </div>
                                <div className="text-[10px] font-mono text-neutral-400">
                                  {student.rollNo}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-neutral-700 font-medium whitespace-nowrap">
                                {student.fatherName}
                              </td>

                              <td className="py-2.5 px-3 font-mono text-neutral-600 text-[11px] whitespace-nowrap">
                                {formatPhoneDisplay(student.contactNo)}
                                {student.contactNo2 && (
                                  <span className="block text-neutral-400">
                                    {formatPhoneDisplay(student.contactNo2)}
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right font-semibold text-neutral-800 whitespace-nowrap">
                                {/* Base Fee */}
                                Rs. {student.monthlyFee.toLocaleString()}

                                {/* Discount indicator (if applicable) */}
                                {student.discount > 0 && (
                                  <span className="block text-[10px] text-emerald-600 font-normal">
                                    (-{student.discount.toLocaleString()})
                                  </span>
                                )}

                                {/* Mid-year fee revision subtext (if applicable) */}
                                {student.feeChanges && student.feeChanges.length > 0 && (
                                  <span className="block text-[10px] text-blue-600 font-medium">
                                    Rs. {student.feeChanges[student.feeChanges.length - 1].newFee.toLocaleString()} ({student.feeChanges[student.feeChanges.length - 1].effectiveFromMonth})
                                  </span>
                                )}
                              </td>

                              {visibleMonths.map((m) => {
                                const inv = invoiceMap.get(`${student.id}_${m}`);
                                const paidAmount = inv
                                  ? inv.paidAmount
                                  : (student.monthlyAmountsPaid?.[m] || 0);

                                const currentStatus: PaymentStatus = inv
                                  ? (inv.status === 'paid' ? 'paid' : inv.status === 'partial' ? 'partial' : 'unpaid')
                                  : (getEffectiveMonthlyStatus(student, activeAcademicYear)[m] || 'unpaid');

                                return (
                                  <td
                                    key={m}
                                    className={`py-2 px-1 text-center whitespace-nowrap ${m === activeReminderMonth ? 'bg-blue-50/50 font-medium' : ''
                                      }`}
                                  >
                                    {getStatusBadge(currentStatus, student.id, m, paidAmount)}
                                  </td>
                                );
                              })}

                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <span className="font-bold text-emerald-700 text-xs">
                                  Rs. {studentCollected.toLocaleString()}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                {studentDue > 0 ? (
                                  <span className="font-bold text-red-600 text-xs">
                                    Rs. {studentDue.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="font-bold text-emerald-600 text-xs">
                                    Rs. 0 (Cleared)
                                  </span>
                                )}
                                {studentOverdueCount > 0 && (
                                  <span className="block text-[10px] text-neutral-400">
                                    {studentOverdueCount} mos. due
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => onEditStudent(student)}
                                    className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 rounded-md transition-colors"
                                    title="Edit Student Record"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onDeleteStudent(student)}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md transition-colors"
                                    title="Delete Student Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onOpenWhatsApp(student, activeReminderMonth)}
                                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-xs transition-colors"
                                    title="Send WhatsApp Reminder"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onOpenPaymentModal(student)}
                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition-colors"
                                    title="Log Payment"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Class Subtotal Row */}
                        <tr
                          key={`total-${group.className}`}
                          className="bg-neutral-100/90 font-semibold border-t-2 border-b border-neutral-300/90"
                        >
                          <td colSpan={5} className="py-2.5 px-3 text-neutral-800 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-neutral-900 text-xs uppercase tracking-wide">
                                Total — {group.className}
                              </span>
                              <span className="text-[11px] font-medium text-neutral-600 bg-white px-2 py-0.5 rounded border border-neutral-300/80">
                                {group.students.length} students
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-neutral-900 font-mono text-xs">
                            Rs. {group.totals.monthlyFee.toLocaleString()}
                          </td>

                          {visibleMonths.map((m) => {
                            const mData = group.totals.months[m] || { collected: 0, due: 0 };
                            return (
                              <td key={`class-total-${group.className}-${m}`} className="py-2 px-1 text-center font-mono text-xs">
                                <span className="font-bold text-emerald-700 block text-[11px]">
                                  {mData.collected.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-rose-600 block">
                                  Due: {mData.due.toLocaleString()}
                                </span>
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 text-xs">
                            Rs. {group.totals.totalCollected.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 text-xs">
                            Rs. {group.totals.totalDue.toLocaleString()}
                          </td>
                          <td className="text-center text-neutral-400">—</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* Overall Grand Total Row */}
                  <tr className="bg-neutral-900 text-white font-bold border-t-2 border-neutral-950">
                    <td colSpan={5} className="py-3 px-3 text-white text-xs">
                      <span className="font-extrabold uppercase tracking-wider text-xs">
                        Overall Grand Total
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-bold text-white">
                      Rs. {overallTotals.monthlyFee.toLocaleString()}
                    </td>
                    {visibleMonths.map((m) => {
                      const mData = overallTotals.months[m] || { collected: 0, due: 0 };
                      return (
                        <td key={`overall-${m}`} className="py-3 px-1 text-center font-mono text-xs">
                          <span className="font-bold text-emerald-400 block text-[11px]">
                            {mData.collected.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-rose-300 block">
                            Due: {mData.due.toLocaleString()}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400 text-xs">
                      Rs. {overallTotals.totalCollected.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-400 text-xs">
                      Rs. {overallTotals.totalDue.toLocaleString()}
                    </td>
                    <td className="text-center text-neutral-400">—</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
