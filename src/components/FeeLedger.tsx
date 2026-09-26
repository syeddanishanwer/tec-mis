import React, { useState, useMemo } from 'react';
import { StudentRecord, SchoolClass, AcademicMonth, ACADEMIC_MONTHS, PaymentStatus, Invoice } from '../types';
import { exportToCSV, exportToExcel, printFeeLedger } from '../utils/exportHelpers';
import { FileSpreadsheet, FileText, Printer, Search, Filter, Plus, ArrowUpDown, CreditCard, Phone, Pencil, Trash2, Upload, RefreshCw } from 'lucide-react';

const ALL_CLASSES: SchoolClass[] = ['Reception', 'Junior', 'Senior', 'Class I', 'Class II', 'Class III', 'Class IV', 'Class V', 'Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X'];

const formatPhoneDisplay = (phone?: string) => {
  if (!phone) return '-';
  return phone.startsWith('92') ? `0${phone.slice(2)}` : phone;
};

const formatSerialNo = (serialNo?: string, fallbackId?: number) => {
  if (serialNo) return serialNo;
  if (fallbackId) return String(fallbackId).padStart(3, '0');
  return '---';
};

interface Props {
  students: StudentRecord[];
  activeAcademicYear?: string;
  activeMonth?: AcademicMonth;
  onActiveMonthChange?: (month: AcademicMonth) => void;
  onOpenWhatsApp: (student: StudentRecord, month: AcademicMonth) => void;
  onOpenPaymentModal: (student: StudentRecord) => void;
  onOpenAddStudent: () => void;
  onOpenImport: () => void;
  onEditStudent: (student: StudentRecord) => void;
  onDeleteStudent: (student: StudentRecord) => void;
  onToggleMonthStatus: (studentId: number, month: AcademicMonth) => void;
  onUpdateMonthAmount?: (studentId: number, month: AcademicMonth, amount: number) => void;
  onToggleWaived: (studentId: number, month: AcademicMonth) => void;
}

export const FeeLedger: React.FC<Props> = ({
  students,
  activeAcademicYear = '2026-2027',
  activeMonth,
  onActiveMonthChange,
  onOpenWhatsApp,
  onOpenPaymentModal,
  onOpenAddStudent,
  onOpenImport,
  onEditStudent,
  onDeleteStudent,
  onToggleMonthStatus,
  onUpdateMonthAmount,
  onToggleWaived,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [internalActiveMonth, setInternalActiveMonth] = useState<AcademicMonth>('Sep');
  const [cellDisplayMode, setCellDisplayMode] = useState<'both' | 'amounts' | 'status'>('both');
  const [sortField, setSortField] = useState<'id' | 'className' | 'studentName' | 'collected' | 'total'>('id');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ studentId: number; month: AcademicMonth } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const activeReminderMonth = activeMonth || internalActiveMonth;
  const activeMonthIndex = ACADEMIC_MONTHS.indexOf(activeReminderMonth);
  const visibleMonths = ACADEMIC_MONTHS.slice(0, activeMonthIndex + 1);

  const handleGenerateInvoices = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/fees/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ academicYear: activeAcademicYear, month: activeReminderMonth }),
      });
      const data = await res.json();
      setGenerateMessage(data.message || data.error);
      setTimeout(() => setGenerateMessage(null), 4000);
      window.location.reload();
    } catch (err) {
      setGenerateMessage('⚠ Network error');
    } finally {
      setIsGenerating(false);
    }
  };

  const invoiceMap = useMemo(() => {
    const map = new Map<string, Invoice>();
    students.forEach(s => {
      s.invoices?.forEach(inv => {
        if (inv.academicYear === activeAcademicYear) {
          map.set(`${s.id}_${inv.academicYear}_${inv.month}`, inv);
        }
      });
    });
    return map;
  }, [students, activeAcademicYear]);

  const getInv = (studentId: number, month: AcademicMonth): Invoice | undefined => {
    return invoiceMap.get(`${studentId}_${activeAcademicYear}_${month}`);
  };

  const handleStartEditAmount = (studentId: number, month: AcademicMonth, currentAmount: number) => {
    setEditingCell({ studentId, month });
    setEditValue(currentAmount > 0 ? String(currentAmount) : '');
  };

  const handleCommitAmount = async (studentId: number, month: AcademicMonth) => {
    const parsed = parseInt(editValue, 10);
    const finalAmt = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    if (onUpdateMonthAmount) await onUpdateMonthAmount(studentId, month, finalAmt);
    setEditingCell(null);
  };

  const handleActiveMonthChange = (m: AcademicMonth) => {
    if (onActiveMonthChange) onActiveMonthChange(m);
    else setInternalActiveMonth(m);
  };

  const filteredStudents = useMemo(() => {
    return students
      .filter(s => {
        if (selectedClass !== 'ALL' && s.className !== selectedClass) return false;
        if (selectedStatus !== 'ALL') {
          const inv = getInv(s.id, activeReminderMonth);
          if (!inv || inv.status !== selectedStatus) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return s.studentName.toLowerCase().includes(q) || s.fatherName.toLowerCase().includes(q) || s.contactNo.includes(q) || s.rollNo.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'id') {
          const numA = parseInt(a.serialNo || String(a.id), 10) || 0;
          const numB = parseInt(b.serialNo || String(b.id), 10) || 0;
          return sortAsc ? numA - numB : numB - numA;
        }
        if (sortField === 'className') return sortAsc ? a.className.localeCompare(b.className) : b.className.localeCompare(a.className);
        if (sortField === 'studentName') return sortAsc ? a.studentName.localeCompare(b.studentName) : b.studentName.localeCompare(a.studentName);
        if (sortField === 'collected' || sortField === 'total') {
          const getDue = (s: StudentRecord) => {
            let c = 0, d = 0;
            visibleMonths.forEach(m => {
              const inv = getInv(s.id, m as AcademicMonth);
              if (!inv || (inv.status as string) === 'new_admission') return;
              c += Number(inv.paidAmount);
              d += Math.max(0, Number(inv.netDue) - Number(inv.paidAmount));
            });
            return sortField === 'collected' ? c : d;
          };
          return sortAsc ? getDue(a) - getDue(b) : getDue(b) - getDue(a);
        }
        return 0;
      });
  }, [students, selectedClass, selectedStatus, searchQuery, activeReminderMonth, sortField, sortAsc, invoiceMap, visibleMonths, activeAcademicYear]);

  const ledgerTotals = useMemo(() => {
    let billed = 0, collected = 0, due = 0, fullClearCount = 0, overdueCount = 0;
    filteredStudents.forEach(student => {
      let studentDue = 0;
      visibleMonths.forEach(m => {
        const inv = getInv(student.id, m as AcademicMonth);
        if (!inv || (inv.status as string) === 'new_admission') return;
        billed += Number(inv.netDue);
        collected += Number(inv.paidAmount);
        const invDue = Math.max(0, Number(inv.netDue) - Number(inv.paidAmount));
        due += invDue;
        studentDue += invDue;
      });
      if (studentDue === 0) fullClearCount++; else overdueCount++;
    });
    const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;
    return { billed, collected, due, fullClearCount, overdueCount, rate };
  }, [filteredStudents, visibleMonths, invoiceMap, activeAcademicYear]);

  interface GroupTotals {
    monthlyFee: number; discounts: number; netMonthlyFee: number;
    months: Record<string, { collected: number; due: number }>;
    totalCollected: number; totalDue: number;
  }

  const computeTotalsForStudents = (studentList: StudentRecord[]): GroupTotals => {
    let monthlyFee = 0, discounts = 0, totalCollected = 0, totalDue = 0;
    const monthsMap: Record<string, { collected: number; due: number }> = {};
    ACADEMIC_MONTHS.forEach(m => monthsMap[m] = { collected: 0, due: 0 });

    studentList.forEach(s => {
      const currentFee = s.feeSchedules?.length ? s.feeSchedules[s.feeSchedules.length - 1].monthlyFee : 0;
      monthlyFee += currentFee;
      visibleMonths.forEach(m => {
        const inv = getInv(s.id, m as AcademicMonth);
        if (!inv || (inv.status as string) === 'new_admission') return;
        const paid = Number(inv.paidAmount) || 0;
        const dueAmt = Math.max(0, Number(inv.netDue) - paid);
        monthsMap[m].collected += paid;
        monthsMap[m].due += dueAmt;
        totalCollected += paid;
        totalDue += dueAmt;
      });
    });
    return { monthlyFee, discounts, netMonthlyFee: monthlyFee, months: monthsMap, totalCollected, totalDue };
  };

  const classGroups = useMemo(() => {
    if (filteredStudents.length === 0) return [];
    const classMap = new Map<string, StudentRecord[]>();
    filteredStudents.forEach(student => {
      if (!classMap.has(student.className)) classMap.set(student.className, []);
      classMap.get(student.className)!.push(student);
    });
    const groups: any[] = [];
    classMap.forEach((cStudents, cName) => {
      groups.push({ className: cName, students: cStudents, totals: computeTotalsForStudents(cStudents) });
    });
    return groups;
  }, [filteredStudents, visibleMonths, invoiceMap, activeAcademicYear]);

  const overallTotals = useMemo(() => computeTotalsForStudents(filteredStudents), [filteredStudents, visibleMonths, invoiceMap, activeAcademicYear]);

  const handleSort = (field: any) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(field === 'collected' || field === 'total' ? false : true); }
  };

  const getStatusBadge = (inv: Invoice, studentId: number, month: AcademicMonth) => {
    const status = inv.status as PaymentStatus;
    const paidAmount = Number(inv.paidAmount);
    const netDue = Number(inv.netDue);
    const isWaived = !!inv.isWaived;
    const isNewAdmissionMonth = status === 'new_admission';

    const handleRightClick = (e: React.MouseEvent) => {
      e.preventDefault();
      onToggleWaived(studentId, month);
    };

    if (isWaived) {
      return (
        <button
          type="button"
          onContextMenu={handleRightClick}
          title={`${month} • WAIVED • Right-click to remove waiver`}
          className="px-1.5 py-1 text-xs font-semibold rounded-md border cursor-pointer min-w- bg-neutral-200 text-neutral-600 border-neutral-300"
        >
          WAIVED
        </button>
      );
    }

    if (isNewAdmissionMonth) {
      return (
        <button
          type="button"
          onContextMenu={handleRightClick}
          title={`${month} • NEW ADMISSION • Right-click to mark Waived instead`}
          className="bg-black text-white px-2 py-1 rounded text-xs font-bold cursor-pointer"
        >
          NEW ADMISSION
        </button>
      );
    }

    let bg = 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
    let label = 'Unpaid';
    if (status === 'paid') { bg = 'bg-emerald-50 text-emerald-700 border-emerald-200'; label = 'Paid'; }
    else if (status === 'partial') { bg = 'bg-amber-50 text-amber-700 border-amber-200'; label = 'Partial'; }

    const isEditing = editingCell?.studentId === studentId && editingCell?.month === month;
    if (isEditing) {
      return (
        <div className="inline-block" onClick={e => e.stopPropagation()}>
          <input
            type="number"
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => handleCommitAmount(studentId, month)}
            onKeyDown={e => { if (e.key === 'Enter') handleCommitAmount(studentId, month); if (e.key === 'Escape') setEditingCell(null); }}
            className="w-16 px-1 py-0.5 text-xs font-mono font-bold text-center border-2 border-blue-600 rounded bg-white"
          />
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onToggleMonthStatus(studentId, month)}
        onDoubleClick={() => handleStartEditAmount(studentId, month, paidAmount)}
        onContextMenu={handleRightClick}
        title={`${month} • Due: Rs. ${netDue} • Paid: Rs. ${paidAmount} • Double-click to edit amount • Right-click to waive`}
        className={`px-1.5 py-1 text-xs font-semibold rounded-md border cursor-pointer min-w- ${bg}`}
      >
        {cellDisplayMode === 'status' ? (
          <span>{label}</span>
        ) : (
          <div className="leading-tight">
            <span>{label}</span>
            <span className="block text-[9.5px] font-mono opacity-85">
              {paidAmount > 0 ? `${paidAmount.toLocaleString()}` : `0 / ${netDue.toLocaleString()}`}
            </span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-neutral-500 uppercase mr-1">Exports:</span>
            <button onClick={() => exportToExcel(filteredStudents, `School_Fee_Ledger_${activeAcademicYear}.xlsx`, activeAcademicYear!)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-medium"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
            <button onClick={() => printFeeLedger(filteredStudents, `Ledger ${activeAcademicYear}`, activeAcademicYear!)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-300 rounded-lg text-xs font-medium"><FileText className="w-3.5 h-3.5" />PDF</button>
            <button onClick={() => exportToCSV(filteredStudents, `Ledger.csv`, activeAcademicYear!)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 border rounded-lg text-xs font-medium">CSV</button>
            <button onClick={() => printFeeLedger(filteredStudents, `Ledger`, activeAcademicYear!)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 border rounded-lg text-xs font-medium"><Printer className="w-3.5 h-3.5" />Print</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleGenerateInvoices} disabled={isGenerating} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"><RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />{isGenerating ? 'Generating...' : `Generate ${activeReminderMonth}`}</button>
            <button onClick={onOpenImport} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold"><Upload className="w-3.5 h-3.5" />Import</button>
            <button onClick={onOpenAddStudent} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold"><Plus className="w-3.5 h-3.5" />Enroll</button>
          </div>
        </div>
        {generateMessage && <div className="text-xs px-3 py-2 rounded bg-neutral-50 border">{generateMessage}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t">
          <div>
            <label className="text-xs font-semibold block mb-1"><Filter className="w-3 h-3 inline mr-1" />Class</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full text-xs bg-neutral-50 border rounded-lg px-2.5 py-1.5">
              <option value="ALL">All Classes</option>
              {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Active Month</label>
            <select value={activeReminderMonth} onChange={e => handleActiveMonthChange(e.target.value as AcademicMonth)} className="w-full text-xs bg-neutral-50 border rounded-lg px-2.5 py-1.5">
              {ACADEMIC_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Status ({activeReminderMonth})</label>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="w-full text-xs bg-neutral-50 border rounded-lg px-2.5 py-1.5">
              <option value="ALL">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="new_admission">New Admission</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="roll, name, father..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border">
          <span className="text- font-semibold text-neutral-500 uppercase block">Billed (Jun-{activeReminderMonth})</span>
          <div className="text-lg font-bold mt-1">Rs. {ledgerTotals.billed.toLocaleString()}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200">
          <span className="text- font-semibold text-emerald-800 uppercase block">Collected</span>
          <div className="text-lg font-bold text-emerald-700 mt-1">Rs. {ledgerTotals.collected.toLocaleString()}</div>
          <span className="text- text-emerald-600">{ledgerTotals.rate}% recovery</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-red-200">
          <span className="text- font-semibold text-red-800 uppercase block">Due / Overdue</span>
          <div className="text-lg font-bold text-red-600 mt-1">Rs. {ledgerTotals.due.toLocaleString()}</div>
          <span className="text- text-red-500">{ledgerTotals.overdueCount} students</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-blue-200">
          <span className="text- font-semibold text-blue-800 uppercase block">Active Evaluation</span>
          <div className="text-lg font-bold mt-1">Through {activeReminderMonth}</div>
          <span className="text- text-blue-600">{visibleMonths.length} months</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs" style={{ minWidth: `${780 + visibleMonths.length * 68}px` }}>
            <thead>
              <tr className="bg-neutral-900 text-white font-semibold text- uppercase tracking-wider">
                <th onClick={() => handleSort('id')} className="py-3 px-3 cursor-pointer w-12 text-center">
                  <div className="flex items-center justify-center gap-1">S#<ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('className')} className="py-3 px-3 cursor-pointer">Class</th>
                <th onClick={() => handleSort('studentName')} className="py-3 px-3 cursor-pointer min-w-">Student</th>
                <th className="py-3 px-3 min-w-">Father</th>
                <th className="py-3 px-3 min-w-">Contact</th>
                <th className="py-3 px-3 text-right min-w-">M. FEE</th>
                {visibleMonths.map(m => (
                  <th key={m} className={`py-3 px-1.5 text-center min-w- ${m === activeReminderMonth ? 'bg-blue-900/80' : ''}`}>{m}</th>
                ))}
                <th onClick={() => handleSort('collected')} className="py-3 px-3 text-right cursor-pointer min-w-">Collected</th>
                <th onClick={() => handleSort('total')} className="py-3 px-3 text-right cursor-pointer min-w-">Due</th>
                <th className="py-3 px-3 text-center min-w-">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/70">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9 + visibleMonths.length} className="py-12 text-center text-neutral-400">No records</td>
                </tr>
              ) : (
                <>
                  {classGroups.map((group: any) => (
                    <React.Fragment key={group.className}>
                      {group.students.map((student: StudentRecord) => {
                        const globalIdx = filteredStudents.indexOf(student);
                        const displaySNo = formatSerialNo(student.serialNo, globalIdx + 1);
                        let studentCollected = 0, studentDue = 0, studentOverdueCount = 0;
                        
                        visibleMonths.forEach(m => {
                          const inv = getInv(student.id, m as AcademicMonth);
                          if (!inv || (inv.status as string) === 'new_admission') return;
                          studentCollected += Number(inv.paidAmount);
                          studentDue += Math.max(0, Number(inv.netDue) - Number(inv.paidAmount));
                          if (Number(inv.netDue) - Number(inv.paidAmount) > 0) studentOverdueCount++;
                        });

                        const isCritical = studentOverdueCount >= 3;
                        const sortedSchedules = [...(student.feeSchedules || [])].sort((a, b) => ACADEMIC_MONTHS.indexOf(a.effectiveFromMonth) - ACADEMIC_MONTHS.indexOf(b.effectiveFromMonth));
                        const baseFee = sortedSchedules[0]?.monthlyFee || 0;
                        const currentFeeSch = sortedSchedules[sortedSchedules.length - 1];
                        const currentFee = currentFeeSch?.monthlyFee || baseFee;
                        const effectiveFrom = currentFeeSch?.effectiveFromMonth;
                        const hasRevision = baseFee !== currentFee && baseFee > 0;

                        return (
                          <tr key={student.id} className={`hover:bg-neutral-50/90 ${isCritical ? 'bg-red-50/30' : ''}`}>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-xs bg-neutral-50/50">{displaySNo}</td>
                            <td className="py-2.5 px-3"><span className="inline-block px-2 py-0.5 rounded-full text- font-bold bg-neutral-100 border whitespace-nowrap">{student.className}</span></td>
                            <td className="py-2.5 px-3"><div className="font-semibold leading-tight">{student.studentName}</div><div className="text- font-mono text-neutral-400">{student.rollNo}</div></td>
                            <td className="py-2.5 px-3 font-medium whitespace-nowrap">{student.fatherName}</td>
                            <td className="py-2.5 px-3 font-mono text- whitespace-nowrap">{formatPhoneDisplay(student.contactNo)}{student.contactNo2 && <span className="block text-neutral-400">{formatPhoneDisplay(student.contactNo2)}</span>}</td>
                            <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                              <span>Rs. {currentFee.toLocaleString()}</span>
                              {effectiveFrom && <span className="block text- text-blue-600 font-medium">w.e.f {effectiveFrom}</span>}
                              {hasRevision && <span className="block text- text-neutral-500 font-normal">was {baseFee.toLocaleString()} w.e.f Jun</span>}
                            </td>
                            {visibleMonths.map(m => {
                              const inv = getInv(student.id, m as AcademicMonth);
                              if (!inv) return <td key={m} className="py-2 px-1 text-center text-neutral-300 text-xs">—</td>;
                              return (
                                <td key={m} className={`py-2 px-1 text-center ${m === activeReminderMonth ? 'bg-blue-50/50' : ''}`}>
                                  {getStatusBadge(inv, student.id, m as AcademicMonth)}
                                </td>
                              );
                            })}
                            <td className="py-2.5 px-3 text-right"><span className="font-bold text-emerald-700 text-xs">Rs. {studentCollected.toLocaleString()}</span></td>
                            <td className="py-2.5 px-3 text-right">{studentDue > 0 ? <span className="font-bold text-red-600 text-xs">Rs. {studentDue.toLocaleString()}</span> : <span className="font-bold text-emerald-600 text-xs">Rs. 0</span>}{studentOverdueCount > 0 && <span className="block text- text-neutral-400">{studentOverdueCount} mos.</span>}</td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => onEditStudent(student)} className="p-1.5 bg-neutral-100 border rounded-md"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => onDeleteStudent(student)} className="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => onOpenWhatsApp(student, activeReminderMonth)} className="p-1.5 bg-emerald-600 text-white rounded-md"><Phone className="w-3.5 h-3.5" /></button>
                                <button onClick={() => onOpenPaymentModal(student)} className="p-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md"><CreditCard className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr key={`total-${group.className}`} className="bg-neutral-100/90 font-semibold border-t-2 border-b">
                        <td colSpan={5} className="py-2.5 px-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold uppercase">Total — {group.className}</span>
                            <span className="text- bg-white px-2 py-0.5 rounded border">{group.students.length} students</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs">Rs. {group.totals.monthlyFee.toLocaleString()}</td>
                        {visibleMonths.map(m => {
                          const mData = group.totals.months[m] || { collected: 0, due: 0 };
                          return (
                            <td key={`ct-${group.className}-${m}`} className="py-2 px-1 text-center font-mono text-xs">
                              <span className="font-bold text-emerald-700 block text-">{mData.collected.toLocaleString()}</span>
                              <span className="text- text-rose-600 block">Due: {mData.due.toLocaleString()}</span>
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 text-xs">Rs. {group.totals.totalCollected.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 text-xs">Rs. {group.totals.totalDue.toLocaleString()}</td>
                        <td className="text-center">—</td>
                      </tr>
                    </React.Fragment>
                  ))}
                  <tr className="bg-neutral-900 text-white font-bold border-t-2">
                    <td colSpan={5} className="py-3 px-3 text-xs"><span className="font-extrabold uppercase">Overall Grand Total</span></td>
                    <td className="py-3 px-3 text-right font-mono text-xs">Rs. {overallTotals.monthlyFee.toLocaleString()}</td>
                    {visibleMonths.map(m => {
                      const mData = overallTotals.months[m] || { collected: 0, due: 0 };
                      return (
                        <td key={`ot-${m}`} className="py-3 px-1 text-center font-mono text-xs">
                          <span className="font-bold text-emerald-400 block text-">{mData.collected.toLocaleString()}</span>
                          <span className="text- text-rose-300 block">Due: {mData.due.toLocaleString()}</span>
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400 text-xs">Rs. {overallTotals.totalCollected.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-400 text-xs">Rs. {overallTotals.totalDue.toLocaleString()}</td>
                    <td className="text-center">—</td>
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