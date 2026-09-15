/**
 * The Educational Centre Secondary School
 * Fee Management & Financial Tracking Application
 */

import React, { useState, useMemo, useEffect } from 'react';
import { StudentRecord, AcademicMonth, ACADEMIC_MONTHS, PaymentStatus } from './types';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import {
  INITIAL_STUDENTS,
  getEffectiveMonthlyStatus,
  getEffectiveMonthlyAmounts,
  formatSerialNo,
  calculateStudentTotals,
} from './data/mockStudents';
import { FeeLedger } from './components/FeeLedger';
import { MonthlySummary } from './components/MonthlySummary';
import { AgingReport } from './components/AgingReport';
import { WhatsAppPreviewModal } from './components/WhatsAppPreviewModal';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { AddStudentModal } from './components/AddStudentModal';
import { AddAcademicYearModal } from './components/AddAcademicYearModal';
import { EditStudentModal } from './components/EditStudentModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ImportStudentsModal } from './components/ImportStudentsModal';
import { PanController } from './components/PanController';
import { useMousePan } from './hooks/useMousePan';
import {
  Table,
  BarChart3,
  ClockAlert,
  Plus,
  CheckCircle,
  Calendar,
  CalendarPlus,
  Upload,
  Hand,
  RefreshCw,
} from 'lucide-react';

const STORAGE_KEY = 'educentre_fee_register_cache';

export default function App() {
  // 1. INSTANT LOAD: Initialize state from LocalStorage first, fallback to INITIAL_STUDENTS
  const [students, setStudents] = useState<StudentRecord[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse local cache:', e);
    }
    return INITIAL_STUDENTS;
  });

  const [academicYears, setAcademicYears] = useState<string[]>(['2026-2027', '2025-2026']);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('2026-2027');
  const [activeTab, setActiveTab] = useState<'summary' | 'ledger' | 'aging'>('ledger');
  const [sharedActiveMonth, setSharedActiveMonth] = useState<AcademicMonth>('Feb');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Mouse pan hook
  const { isPanMode, setIsPanMode, isSpaceHeld, isDragging, resetView } = useMousePan();

  // Modal States
  const [whatsAppTarget, setWhatsAppTarget] = useState<{
    student: StudentRecord;
    month: AcademicMonth;
    customOutstanding?: number;
  } | null>(null);

  const [paymentTarget, setPaymentTarget] = useState<StudentRecord | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<StudentRecord | null>(null);
  const [showAddStudent, setShowAddStudent] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showAddAcademicYear, setShowAddAcademicYear] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Keep local storage in sync whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    } catch (e) {
      console.warn('Failed to update local cache:', e);
    }
  }, [students]);

  // Helper to persist array updates to Vercel Postgres API in background
  // const syncStudentToBackend = async (student: StudentRecord) => {
  //   setIsSyncing(true);
  //   try {
  //     await fetch('/api/update', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         studentId: student.id,
  //         updatedStudent: student,
  //         academicYear: selectedAcademicYear,
  //       }),
  //     });
  //   } catch (err) {
  //     console.error('Failed to persist student change to backend database:', err);
  //   } finally {
  //     setIsSyncing(false);
  //   }
  // };

// Helper to persist array updates to Vercel Postgres API in background
  // 1. PERSIST SINGLE STUDENT UPDATE (POST)
const syncStudentToBackend = async (student: StudentRecord) => {
  setIsSyncing(true);
  try {
    const res = await fetch('/api/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', // <-- STRIPS BULKY CLERK COOKIES FROM POST
      body: JSON.stringify({
        studentId: student.id,
        updatedStudent: student,
        academicYear: selectedAcademicYear,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('API Update Error:', res.status, errData);
      showToast(`⚠️ Server save failed (${res.status}). Saved locally.`);
    }
  } catch (err) {
    console.error('Failed to persist student change to backend database:', err);
    showToast('⚠️ Network error saving to database.');
  } finally {
    setIsSyncing(false);
  }
};

// 2. BULK SAVE STUDENTS (POST)
const syncBulkStudentsToBackend = async (studentList: StudentRecord[], targetYear?: string) => {
  setIsSyncing(true);
  try {
    await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', // <-- STRIPS BULKY CLERK COOKIES FROM BULK POST
      body: JSON.stringify({
        students: studentList,
        academicYear: targetYear || selectedAcademicYear,
      }),
    });
  } catch (err) {
    console.error('Failed to sync bulk students with backend database:', err);
  } finally {
    setIsSyncing(false);
  }
};

// 3. SILENT BACKGROUND DB FETCH (GET)
useEffect(() => {
  let isMounted = true;
  async function loadDatabaseStudents() {
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/students?academicYear=${selectedAcademicYear}`, {
        credentials: 'omit', // <-- STRIPS BULKY CLERK COOKIES FROM GET
      });
      if (response.ok) {
        const data = await response.json();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setStudents(data);
        }
      }
    } catch (err) {
      console.warn('Backend database fetch unavailable, using local state:', err);
    } finally {
      if (isMounted) setIsSyncing(false);
    }
  }

  loadDatabaseStudents();
  return () => {
    isMounted = false;
  };
}, [selectedAcademicYear]);

  // Compute session totals
  const activeMonthIndex = ACADEMIC_MONTHS.indexOf(sharedActiveMonth);
  const sessionTotals = useMemo(() => {
    let billed = 0;
    let collected = 0;
    let due = 0;
    students.forEach((s) => {
      const totals = calculateStudentTotals(s, activeMonthIndex, selectedAcademicYear);
      billed += totals.totalBilled;
      collected += totals.totalCollected;
      due += totals.totalDue;
    });
    return { billed, collected, due };
  }, [students, activeMonthIndex, selectedAcademicYear]);

  // Status toggle handler
  const handleToggleMonthStatus = (studentId: number, month: AcademicMonth) => {
    let newStatus: PaymentStatus = 'paid';
    let updatedStudentObj: StudentRecord | null = null;

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const currentMap = getEffectiveMonthlyStatus(s, selectedAcademicYear);
        const current = currentMap[month] || 'pending';
        let next: PaymentStatus = 'paid';
        if (current === 'paid') next = 'partial';
        else if (current === 'partial') next = 'pending';
        else next = 'paid';
        newStatus = next;

        const updatedMap = { ...currentMap, [month]: next };
        const effectiveFee = Math.max(0, s.monthlyFee - s.discount);
        let nextAmount = 0;
        if (next === 'paid') nextAmount = effectiveFee;
        else if (next === 'partial') nextAmount = Math.round(effectiveFee / 2);
        else nextAmount = 0;

        const currentAmounts = getEffectiveMonthlyAmounts(s, selectedAcademicYear);
        const updatedAmounts = { ...currentAmounts, [month]: nextAmount };

        updatedStudentObj = {
          ...s,
          yearlyStatus: { ...(s.yearlyStatus || {}), [selectedAcademicYear]: updatedMap },
          yearlyAmountsPaid: { ...(s.yearlyAmountsPaid || {}), [selectedAcademicYear]: updatedAmounts },
          monthlyStatus: s.academicYear === selectedAcademicYear ? updatedMap : s.monthlyStatus,
          monthlyAmountsPaid: s.academicYear === selectedAcademicYear ? updatedAmounts : s.monthlyAmountsPaid,
        };

        return updatedStudentObj;
      })
    );

    if (updatedStudentObj) syncStudentToBackend(updatedStudentObj);
    showToast(`Updated ${month} status to ${newStatus} (${selectedAcademicYear})`);
  };

  // Update exact fee amount for a student in a specific month
  const handleUpdateMonthAmount = (studentId: number, month: AcademicMonth, amount: number) => {
    const validAmount = Math.max(0, isNaN(amount) ? 0 : amount);
    let studentName = '';
    let updatedStudentObj: StudentRecord | null = null;

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        studentName = s.studentName;
        const effectiveFee = Math.max(0, s.monthlyFee - s.discount);

        let derivedStatus: PaymentStatus = 'pending';
        if (validAmount >= effectiveFee && effectiveFee > 0) derivedStatus = 'paid';
        else if (validAmount > 0) derivedStatus = 'partial';
        else derivedStatus = 'pending';

        const currentMap = getEffectiveMonthlyStatus(s, selectedAcademicYear);
        const updatedMap = { ...currentMap, [month]: derivedStatus };
        const currentAmounts = getEffectiveMonthlyAmounts(s, selectedAcademicYear);
        const updatedAmounts = { ...currentAmounts, [month]: validAmount };

        updatedStudentObj = {
          ...s,
          yearlyStatus: { ...(s.yearlyStatus || {}), [selectedAcademicYear]: updatedMap },
          yearlyAmountsPaid: { ...(s.yearlyAmountsPaid || {}), [selectedAcademicYear]: updatedAmounts },
          monthlyStatus: s.academicYear === selectedAcademicYear ? updatedMap : s.monthlyStatus,
          monthlyAmountsPaid: s.academicYear === selectedAcademicYear ? updatedAmounts : s.monthlyAmountsPaid,
        };

        return updatedStudentObj;
      })
    );

    if (updatedStudentObj) syncStudentToBackend(updatedStudentObj);
    showToast(`Updated ${month} fee for ${studentName || 'student'} to Rs. ${validAmount.toLocaleString()} (${selectedAcademicYear})`);
  };

  // Record payment handler
  const handleSavePayment = (
    studentId: number,
    month: AcademicMonth,
    amount: number,
    status: PaymentStatus,
    method: string,
    receiptNo: string
  ) => {
    let updatedStudentObj: StudentRecord | null = null;

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const currentMap = getEffectiveMonthlyStatus(s, selectedAcademicYear);
        const updatedMap = { ...currentMap, [month]: status };
        const currentAmounts = getEffectiveMonthlyAmounts(s, selectedAcademicYear);
        const updatedAmounts = { ...currentAmounts, [month]: amount };

        updatedStudentObj = {
          ...s,
          yearlyStatus: { ...(s.yearlyStatus || {}), [selectedAcademicYear]: updatedMap },
          yearlyAmountsPaid: { ...(s.yearlyAmountsPaid || {}), [selectedAcademicYear]: updatedAmounts },
          monthlyStatus: s.academicYear === selectedAcademicYear ? updatedMap : s.monthlyStatus,
          monthlyAmountsPaid: s.academicYear === selectedAcademicYear ? updatedAmounts : s.monthlyAmountsPaid,
        };

        return updatedStudentObj;
      })
    );

    if (updatedStudentObj) syncStudentToBackend(updatedStudentObj);
    showToast(`Payment of Rs. ${amount.toLocaleString()} recorded (${receiptNo}) for Session ${selectedAcademicYear}`);
  };

  // Add student handler
  const handleAddStudent = (newStudent: Omit<StudentRecord, 'id'>) => {
    const nextId = Math.max(...students.map((s) => s.id), 0) + 1;
    const studentWithId: StudentRecord = {
      ...newStudent,
      id: nextId,
      yearlyStatus: { [newStudent.academicYear]: newStudent.monthlyStatus },
    };

    setStudents((prev) => [studentWithId, ...prev]);
    syncStudentToBackend(studentWithId);
    showToast(`Student ${newStudent.studentName} enrolled successfully for Session ${newStudent.academicYear}!`);
  };

  // Edit student handler
  const handleSaveEditedStudent = (updatedStudent: StudentRecord) => {
    setStudents((prev) => prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s)));
    syncStudentToBackend(updatedStudent);
    showToast(`Student record for ${updatedStudent.studentName} updated successfully!`);
  };

  // Delete student handler
  const handleConfirmDeleteStudent = (studentId: number) => {
    const target = students.find((s) => s.id === studentId);
    setStudents((prev) => prev.filter((s) => s.id !== studentId));

    fetch(`/api/students?id=${studentId}`, { method: 'DELETE' }).catch((err) =>
      console.error('Failed to delete student from backend database:', err)
    );

    showToast(`Student ${target ? target.studentName : ''} deleted from school register.`);
  };

  // Import student records handler
  const handleImportSuccess = (
    importedStudents: StudentRecord[],
    strategy: 'update_or_add' | 'append' | 'replace' | 'merge',
    stats?: { total: number; updated: number; added: number },
    targetYear?: string
  ) => {
    const activeYear = targetYear || selectedAcademicYear;
    let finalStudents: StudentRecord[] = [];

    if (strategy === 'replace') {
      finalStudents = importedStudents;
    } else if (strategy === 'append') {
      finalStudents = [...students, ...importedStudents];
    } else {
      let updatedCount = 0;
      let addedCount = 0;

      const result = [...students];
      importedStudents.forEach((imp) => {
        const existingIdx = result.findIndex(
          (s) =>
            (s.rollNo && imp.rollNo && s.rollNo.trim().toLowerCase() === imp.rollNo.trim().toLowerCase()) ||
            (s.serialNo && imp.serialNo && s.serialNo.trim().toLowerCase() === imp.serialNo.trim().toLowerCase()) ||
            (s.studentName.trim().toLowerCase() === imp.studentName.trim().toLowerCase() &&
              s.fatherName.trim().toLowerCase() === imp.fatherName.trim().toLowerCase())
        );

        if (existingIdx >= 0) {
          updatedCount++;
          const existing = result[existingIdx];
          result[existingIdx] = {
            ...existing,
            ...imp,
            id: existing.id,
            monthlyAmountsPaid: { ...(existing.monthlyAmountsPaid || {}), ...(imp.monthlyAmountsPaid || {}) },
            yearlyAmountsPaid: {
              ...(existing.yearlyAmountsPaid || {}),
              ...(imp.yearlyAmountsPaid || {}),
              [activeYear]: {
                ...(existing.yearlyAmountsPaid?.[activeYear] || existing.monthlyAmountsPaid || {}),
                ...(imp.yearlyAmountsPaid?.[activeYear] || imp.monthlyAmountsPaid || {}),
              },
            },
            yearlyStatus: {
              ...(existing.yearlyStatus || {}),
              ...(imp.yearlyStatus || {}),
              [activeYear]: {
                ...(existing.yearlyStatus?.[activeYear] || existing.monthlyStatus || {}),
                ...(imp.yearlyStatus?.[activeYear] || imp.monthlyStatus || {}),
              } as Record<AcademicMonth, PaymentStatus>,
            },
          };
        } else {
          addedCount++;
          result.push(imp);
        }
      });

      finalStudents = result;
    }

    setStudents(finalStudents);
    syncBulkStudentsToBackend(finalStudents, activeYear);

    const finalUpdated = stats?.updated ?? 0;
    const finalAdded = stats?.added ?? 0;
    showToast(`Import complete! Loaded ${finalStudents.length} student records.`);
  };

  // Add academic year handler
  const handleAddAcademicYear = (newYear: string, rolloverStudents: boolean, setAsActive: boolean) => {
    if (!academicYears.includes(newYear)) {
      setAcademicYears((prev) => [newYear, ...prev]);
    }

    if (rolloverStudents) {
      const defaultStatuses: Record<AcademicMonth, PaymentStatus> = {
        Jun: 'pending', Jul: 'pending', Aug: 'pending', Sep: 'pending',
        Oct: 'pending', Nov: 'pending', Dec: 'pending', Jan: 'pending',
        Feb: 'pending', Mar: 'pending', Apr: 'pending', May: 'pending',
      };

      const rolledOverStudents: StudentRecord[] = students.map((s) => ({
        ...s,
        yearlyStatus: {
          ...(s.yearlyStatus || {}),
          [newYear]: defaultStatuses,
        },
      }));

      setStudents(rolledOverStudents);
      syncBulkStudentsToBackend(rolledOverStudents, newYear);
    }

    if (setAsActive) setSelectedAcademicYear(newYear);
    showToast(`Academic Year ${newYear} successfully added!`);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 font-sans flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-neutral-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Primary Navigation Header */}
      <header className="bg-neutral-900 text-white border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* School Branding */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-white p-0.5 flex items-center justify-center shadow-sm overflow-hidden shrink-0 border border-neutral-700">
                <img
                  src="/school_logo.jpg"
                  alt="The Educational Centre Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div>
                <h1 className="font-bold text-base leading-tight flex items-center gap-2">
                  The Educational Centre Secondary School
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                        Syncing...
                      </>
                    ) : (
                      'Live Fee System'
                    )}
                  </span>
                </h1>
                <p className="text-xs text-neutral-400">
                  <span className="text-indigo-300 font-medium">Enter to learn. Go forth to serve.</span> &bull; Fee Management & Financial Tracking
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5">
              {/* Session Selector */}
              <div className="flex items-center bg-neutral-800/90 border border-neutral-700/80 rounded-lg p-1 text-xs">
                <div className="flex items-center gap-1.5 px-2 py-0.5 text-neutral-300 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="hidden sm:inline text-neutral-400">Session:</span>
                  <select
                    value={selectedAcademicYear}
                    onChange={(e) => {
                      setSelectedAcademicYear(e.target.value);
                      showToast(`Switched active session to ${e.target.value}`);
                    }}
                    className="bg-neutral-900 text-white font-semibold border border-neutral-700 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {academicYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setShowAddAcademicYear(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-[11px] font-semibold transition-colors border border-neutral-600 ml-1 cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="hidden md:inline">Add Year</span>
                </button>
              </div>

              {/* Pan View Toggle */}
              <button
                onClick={() => setIsPanMode((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer ${isPanMode || isSpaceHeld
                    ? 'bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold ring-2 ring-amber-300 shadow-sm'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                  }`}
              >
                <Hand className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isPanMode ? 'Pan: ON' : 'Pan View'}</span>
              </button>

              {/* Import Excel */}
              <button
                onClick={() => setShowImportModal(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Excel
              </button>

              {/* Enroll Student */}
              <button
                onClick={() => setShowAddStudent(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Enroll Student
              </button>

              {/* Clerk Authentication Controls */}
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer border border-indigo-500">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>

              <SignedIn>
                <div className="flex items-center pl-1 border-l border-neutral-700">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>

            </div>
          </div>

          {/* Navigation Tabs and Synchronized Totals Bar */}
          <div className="flex flex-wrap items-center justify-between border-t border-neutral-800/80 pt-1 pb-2 gap-2">
            <div className="flex space-x-1 sm:space-x-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${activeTab === 'summary' ? 'bg-blue-600 text-white shadow-xs' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Monthly Summary Dashboard
              </button>

              <button
                onClick={() => setActiveTab('ledger')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${activeTab === 'ledger' ? 'bg-blue-600 text-white shadow-xs' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
              >
                <Table className="w-3.5 h-3.5" />
                Student Fee Ledger
              </button>

              <button
                onClick={() => setActiveTab('aging')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${activeTab === 'aging' ? 'bg-blue-600 text-white shadow-xs' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
              >
                <ClockAlert className="w-3.5 h-3.5" />
                Fee Receivable Aging Report
              </button>
            </div>

            {/* Synchronized Totals Badge */}
            <div className="hidden sm:flex items-center gap-2.5 text-[11px] bg-neutral-800/90 border border-neutral-700/80 px-3 py-1 rounded-lg">
              <span className="text-neutral-400 font-medium">
                Active Month (<strong className="text-white">{sharedActiveMonth}</strong>):
              </span>
              <span className="text-emerald-400 font-semibold">
                Collected: Rs. {sessionTotals.collected.toLocaleString()}
              </span>
              <span className="text-neutral-600">|</span>
              <span className="text-rose-400 font-semibold">
                Due: Rs. {sessionTotals.due.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'summary' && (
          <MonthlySummary
            students={students}
            activeAcademicYear={selectedAcademicYear}
            activeMonth={sharedActiveMonth}
            onActiveMonthChange={setSharedActiveMonth}
          />
        )}

        {activeTab === 'ledger' && (
          <FeeLedger
            students={students}
            activeAcademicYear={selectedAcademicYear}
            activeMonth={sharedActiveMonth}
            onActiveMonthChange={setSharedActiveMonth}
            onOpenWhatsApp={(student, month) => setWhatsAppTarget({ student, month })}
            onOpenPaymentModal={(student) => setPaymentTarget(student)}
            onOpenAddStudent={() => setShowAddStudent(true)}
            onOpenImport={() => setShowImportModal(true)}
            onEditStudent={(student) => setEditingStudent(student)}
            onDeleteStudent={(student) => setDeletingStudent(student)}
            onToggleMonthStatus={handleToggleMonthStatus}
            onUpdateMonthAmount={handleUpdateMonthAmount}
          />
        )}

        {activeTab === 'aging' && (
          <AgingReport
            students={students}
            activeAcademicYear={selectedAcademicYear}
            activeMonth={sharedActiveMonth}
            onActiveMonthChange={setSharedActiveMonth}
            onOpenWhatsApp={(student, month, customOutstanding) =>
              setWhatsAppTarget({ student, month, customOutstanding })
            }
          />
        )}
      </main>

      {/* Modals */}
      {whatsAppTarget && (
        <WhatsAppPreviewModal
          student={whatsAppTarget.student}
          month={whatsAppTarget.month}
          customOutstanding={whatsAppTarget.customOutstanding}
          activeAcademicYear={selectedAcademicYear}
          onClose={() => setWhatsAppTarget(null)}
        />
      )}

      {paymentTarget && (
        <RecordPaymentModal
          student={paymentTarget}
          activeAcademicYear={selectedAcademicYear}
          onClose={() => setPaymentTarget(null)}
          onSavePayment={handleSavePayment}
        />
      )}

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaveStudent={handleSaveEditedStudent}
        />
      )}

      {deletingStudent && (
        <DeleteConfirmModal
          student={deletingStudent}
          activeAcademicYear={selectedAcademicYear}
          onClose={() => setDeletingStudent(null)}
          onConfirmDelete={handleConfirmDeleteStudent}
        />
      )}

      {showAddStudent && (
        <AddStudentModal
          currentAcademicYear={selectedAcademicYear}
          availableAcademicYears={academicYears}
          suggestedSerialNo={formatSerialNo(undefined, students.length + 1)}
          onClose={() => setShowAddStudent(false)}
          onAddStudent={handleAddStudent}
        />
      )}

      {showAddAcademicYear && (
        <AddAcademicYearModal
          existingYears={academicYears}
          currentYear={selectedAcademicYear}
          onClose={() => setShowAddAcademicYear(false)}
          onAddYear={handleAddAcademicYear}
        />
      )}

      {showImportModal && (
        <ImportStudentsModal
          activeAcademicYear={selectedAcademicYear}
          availableAcademicYears={academicYears}
          existingStudents={students}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={handleImportSuccess}
        />
      )}

      {/* Floating Mouse Drag-Pan Controller */}
      <PanController
        isPanMode={isPanMode}
        setIsPanMode={setIsPanMode}
        isSpaceHeld={isSpaceHeld}
        isDragging={isDragging}
        onResetView={resetView}
      />

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-2">
          <p>
            The Educational Centre Secondary School &bull; Fee Management & Financial Ledger
          </p>
          <p className="flex items-center gap-1 font-mono text-[11px]">
            Session: {selectedAcademicYear} &bull; wa.me API Integrated
          </p>
        </div>
      </footer>
    </div>
  );
}