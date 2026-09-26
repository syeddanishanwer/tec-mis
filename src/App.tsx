/**
 * The Educational Centre Secondary School - FIXED FINAL
 * Uses invoices table as single source of truth
 * Rollover creates real DB invoices
 */

import React, { useState, useMemo, useEffect } from 'react';
import { LoginModal } from './components/LoginModal';
import { LogOut } from 'lucide-react';
import { StudentRecord, AcademicMonth, ACADEMIC_MONTHS, PaymentStatus } from './types';
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
import { Table, BarChart3, ClockAlert, Plus, CheckCircle, Calendar, CalendarPlus, Upload, Hand, RefreshCw } from 'lucide-react';

const formatSerialNo = (serialNo?: string, fallbackId?: number) => {
  if (serialNo) return serialNo;
  if (fallbackId) return String(fallbackId).padStart(3, '0');
  return '---';
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>(['2026-2027', '2025-2026']);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('2026-2027');
  const [activeTab, setActiveTab] = useState<'summary' | 'ledger' | 'aging'>('summary');
  const [sharedActiveMonth, setSharedActiveMonth] = useState<AcademicMonth>(() => {
    const currentMonthName = new Date().toLocaleString('en-US', { month: 'short' }) as AcademicMonth;
    return ACADEMIC_MONTHS.includes(currentMonthName) ? currentMonthName : 'Sep';
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const { isPanMode, setIsPanMode, isSpaceHeld, isDragging, resetView } = useMousePan();

  const [whatsAppTarget, setWhatsAppTarget] = useState<{ student: StudentRecord; month: AcademicMonth; customOutstanding?: number } | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<StudentRecord | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<StudentRecord | null>(null);
  const [showAddStudent, setShowAddStudent] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showAddAcademicYear, setShowAddAcademicYear] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 3500); };

  const handleLogin = async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ pin }) });
      if (res.ok) { setIsAuthenticated(true); showToast('Authenticated!'); return true; }
      showToast('Incorrect PIN'); return false;
    } catch { showToast('⚠ Login failed'); return false; }
  };

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch { }
    setIsAuthenticated(false);
  };

  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/verify', { credentials: 'include' });
        if (isMounted) setIsAuthenticated(res.ok);
      } catch { if (isMounted) setIsAuthenticated(false); }
      finally { if (isMounted) setAuthChecked(true); }
    }
    checkAuth();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;   // ← don't fetch until logged in
    let isMounted = true;
    async function loadDatabaseStudents() {
      setIsSyncing(true);
      try {
        const response = await fetch(`/api/students?academicYear=${selectedAcademicYear}`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (isMounted && Array.isArray(data)) setStudents(data);
        }
      } catch (err) { console.warn('DB fetch failed', err); }
      finally { if (isMounted) setIsSyncing(false); }
    }
    loadDatabaseStudents();
    return () => { isMounted = false; };
  }, [selectedAcademicYear, isAuthenticated]);

  const handleToggleMonthStatus = async (studentId: number, month: AcademicMonth) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const currentInvoice = student.invoices?.find(inv => inv.month === month && inv.academicYear === selectedAcademicYear);
    if (!currentInvoice) { showToast(`No invoice for ${month}`); return; }
    if (currentInvoice.status === 'new_admission') { showToast(`Cannot change ${month}: NEW ADMISSION`); return; }

    let newStatus: PaymentStatus;
    let newPaidAmount: number;
    const netDue = Number(currentInvoice.netDue);
    if (currentInvoice.status === 'unpaid') { newStatus = 'paid'; newPaidAmount = netDue; }
    else if (currentInvoice.status === 'paid') { newStatus = 'partial'; newPaidAmount = Math.round(netDue / 2); }
    else { newStatus = 'unpaid'; newPaidAmount = 0; }

    const originalStudents = students;
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      return { ...s, invoices: s.invoices.map(inv => inv.month === month && inv.academicYear === selectedAcademicYear ? { ...inv, status: newStatus, paidAmount: newPaidAmount } : inv) };
    }));

    try {
      const res = await fetch('/api/fees/record-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ studentId, month, academicYear: selectedAcademicYear, paidAmount: newPaidAmount })
      });
      const data = await res.json();
      if (!res.ok) { setStudents(originalStudents); showToast(`⚠ ${data.error}`); }
      else showToast(`Updated ${month} to ${newStatus}`);
    } catch { setStudents(originalStudents); showToast('⚠ Network error'); }
  };

  const handleUpdateMonthAmount = async (studentId: number, month: AcademicMonth, amount: number) => {
    const validAmount = Math.max(0, isNaN(amount) ? 0 : amount);
    const student = students.find(s => s.id === studentId);
    const currentInvoice = student?.invoices?.find(inv => inv.month === month && inv.academicYear === selectedAcademicYear);
    if (!currentInvoice || currentInvoice.status === 'new_admission') { showToast(`Cannot edit ${month}: NEW ADMISSION`); return; }

    const netDue = Number(currentInvoice.netDue);
    let derivedStatus: PaymentStatus = 'unpaid';
    if (validAmount >= netDue && netDue > 0) derivedStatus = 'paid';
    else if (validAmount > 0) derivedStatus = 'partial';

    const originalStudents = students;
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      return { ...s, invoices: s.invoices.map(inv => inv.month === month && inv.academicYear === selectedAcademicYear ? { ...inv, paidAmount: validAmount, status: derivedStatus } : inv) };
    }));

    try {
      const res = await fetch('/api/fees/record-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ studentId, month, academicYear: selectedAcademicYear, paidAmount: validAmount })
      });
      if (!res.ok) { const err = await res.json(); setStudents(originalStudents); showToast(`⚠ ${err.error}`); }
      else showToast(`Updated ${month} to Rs. ${validAmount.toLocaleString()}`);
    } catch { setStudents(originalStudents); showToast('⚠ Network error'); }
  };

  const sessionTotals = useMemo(() => {
    let billed = 0, collected = 0, due = 0;
    const activeIdx = ACADEMIC_MONTHS.indexOf(sharedActiveMonth);
    const visibleMonths = ACADEMIC_MONTHS.slice(0, activeIdx + 1);
    students.forEach(s => {
      s.invoices?.forEach(inv => {
        if (inv.status === 'new_admission') return;
        if (!visibleMonths.includes(inv.month as AcademicMonth)) return;
        if (inv.academicYear !== selectedAcademicYear) return;
        billed += Number(inv.netDue);
        collected += Number(inv.paidAmount);
        due += Math.max(0, Number(inv.netDue) - Number(inv.paidAmount));
      });
    });
    return { billed, collected, due };
  }, [students, sharedActiveMonth, selectedAcademicYear]);

  const handleSavePayment = async (studentId: number, month: AcademicMonth, amount: number) => {
    await handleUpdateMonthAmount(studentId, month, amount);
    showToast(`Payment Rs. ${amount.toLocaleString()} recorded`);
  };

  const handleAddStudent = async (newStudent: any) => {
    try {
      const res = await fetch('/api/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ students: [newStudent] })
      });
      if (res.ok) {
        const reload = await fetch(`/api/students?academicYear=${selectedAcademicYear}`, { credentials: 'include' });
        if (reload.ok) setStudents(await reload.json());
        showToast(`Student ${newStudent.studentName} enrolled!`);
      }
    } catch { showToast('⚠ Enroll failed'); }
  };

  const handleSaveEditedStudent = async (updatedStudent: StudentRecord) => {
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    try {
      await fetch('/api/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ students: [updatedStudent] })
      });
      showToast(`Updated ${updatedStudent.studentName}`);
    } catch { showToast('⚠ Update failed'); }
  };

  const handleConfirmDeleteStudent = async (studentId: number) => {
    const target = students.find(s => s.id === studentId);
    setStudents(prev => prev.filter(s => s.id !== studentId));
    try {
      const res = await fetch(`/api/students?id=${studentId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) showToast('⚠ Delete failed');
      else showToast(`Deleted ${target?.studentName || ''}`);
    } catch { showToast('⚠ Network error'); }
  };

  const handleImportSuccess = async (importedStudents: any[], strategy: string, stats?: any, targetYear?: string) => {
    const activeYear = targetYear || selectedAcademicYear;
    setIsSyncing(true);
    try {
      const res = await fetch(strategy === 'replace' ? '/api/students-replace' : '/api/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ students: importedStudents, academicYear: activeYear })
      });
      if (res.ok) {
        const reload = await fetch(`/api/students?academicYear=${activeYear}`, { credentials: 'include' });
        if (reload.ok) setStudents(await reload.json());
        showToast(`Import complete! ${importedStudents.length} records for ${activeYear}`);
      }
    } catch { showToast('⚠ Import failed'); }
    finally { setIsSyncing(false); }
  };

  // FIXED: Rollover now creates real invoices in DB
  const handleAddAcademicYear = async (newYear: string, rollover: boolean, setAsActive: boolean) => {
    if (!academicYears.includes(newYear)) setAcademicYears(prev => [newYear, ...prev]);

    if (rollover) {
      setIsSyncing(true);
      try {
        // Call backend to create invoices for new year
        // Backend should: for each student in selectedAcademicYear, create 12 invoices for newYear
        // Jun-May all unpaid, feeSchedules copied with w.e.f Jun
        const res = await fetch('/api/academic-years/rollover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fromYear: selectedAcademicYear,
            toYear: newYear,
          })
        });

        if (res.ok) {
          const data = await res.json();
          showToast(`Year ${newYear} created with ${data.count || students.length} students rolled over!`);
        } else {
          const err = await res.json().catch(() => ({}));
          // Fallback: if rollover endpoint doesn't exist, create invoices client-side via students API
          // This ensures new year has invoices even if backend endpoint missing
          const rolloverStudents = students.map(s => {
            const currentFee = s.feeSchedules && s.feeSchedules.length > 0 ? s.feeSchedules[s.feeSchedules.length - 1].monthlyFee : 3500;
            const invoices = ACADEMIC_MONTHS.map(m => ({
              month: m,
              academicYear: newYear,
              baseFee: currentFee,
              concessionAmount: 0,
              netDue: currentFee,
              paidAmount: 0,
              status: 'unpaid'
            }));
            return {
              ...s,
              academicYear: newYear,
              invoices,
              feeSchedules: [{ monthlyFee: currentFee, effectiveFromMonth: 'Jun', academicYear: newYear }]
            };
          });

          const fallbackRes = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ students: rolloverStudents, academicYear: newYear })
          });

          if (fallbackRes.ok) {
            showToast(`Year ${newYear} created with ${rolloverStudents.length} students (fallback rollover)!`);
          } else {
            showToast(`Year ${newYear} added but rollover failed: ${err.error || 'API error'}. Students will be empty for new year.`);
          }
        }
      } catch (err) {
        console.error('Rollover failed:', err);
        showToast(`Year ${newYear} added but rollover failed. New year will be empty.`);
      } finally {
        setIsSyncing(false);
      }
    } else {
      showToast(`Year ${newYear} added (empty, no rollover)!`);
    }

    if (setAsActive) setSelectedAcademicYear(newYear);
  };

  if (!authChecked) return <div className="min-h-screen bg-neutral-100 flex items-center justify-center"><p className="text-sm text-neutral-500">Verifying session...</p></div>;
  if (!isAuthenticated) return <LoginModal onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 font-sans flex flex-col">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-neutral-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /><span>{toastMessage}</span>
        </div>
      )}

      <header className="bg-neutral-900 text-white border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 relative">
            <div className="w-11 h-11 rounded-lg bg-white p-0.5 flex items-center justify-center overflow-hidden border border-neutral-700">
              <img src="/school_logo.jpg" alt="Logo" className="w-full h-full object-contain" onError={e => (e.currentTarget as HTMLElement).style.display = 'none'} />
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 text-center px-4">
              <h1 className="font-bold text-base leading-tight flex items-center justify-center gap-2 whitespace-nowrap">
                The Educational Centre Secondary School
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-1 mr-3">
                  {isSyncing ? <><RefreshCw className="w-3 h-3 animate-spin" />Syncing...</> : 'Live Fee System'}
                </span>
              </h1>
              <p className="text-xs text-neutral-400"><span className="text-indigo-300 font-medium">Enter to learn. Go forth to serve.</span></p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center bg-neutral-800/90 border border-neutral-700/80 rounded-lg p-1 text-xs">
                <div className="flex items-center gap-1.5 px-2 py-0.5 text-neutral-300 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" /><span className="hidden sm:inline text-neutral-400">Session:</span>
                  <select value={selectedAcademicYear} onChange={e => { setSelectedAcademicYear(e.target.value); showToast(`Switched to ${e.target.value}`); }} className="bg-neutral-900 text-white font-semibold border border-neutral-700 rounded px-2 py-1 cursor-pointer">
                    {academicYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => setShowAddAcademicYear(true)} className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded text- font-semibold border border-neutral-600 ml-1"><CalendarPlus className="w-3.5 h-3.5 text-indigo-300" /><span className="hidden md:inline">Add Year</span></button>
              <button onClick={() => setIsPanMode(prev => !prev)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${isPanMode || isSpaceHeld ? 'bg-amber-400 text-neutral-950 font-bold ring-2 ring-amber-300' : 'bg-neutral-800 text-neutral-200 border border-neutral-700'}`}><Hand className="w-3.5 h-3.5" /><span className="hidden sm:inline">{isPanMode ? 'Pan: ON' : 'Pan View'}</span></button>
              <button onClick={() => setShowImportModal(true)} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"><Upload className="w-3.5 h-3.5" />Import Excel</button>
              <button onClick={() => setShowAddStudent(true)} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"><Plus className="w-3.5 h-3.5" />Enroll Student</button>
              <button onClick={handleLogout} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-rose-600/20 text-neutral-300 hover:text-rose-400 border border-neutral-700 rounded-lg text-xs font-semibold ml-1"><LogOut className="w-3.5 h-3.5" />Logout</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between border-t border-neutral-800/80 pt-1 pb-2 gap-2">
            <div className="flex space-x-1 sm:space-x-2 overflow-x-auto">
              <button onClick={() => setActiveTab('summary')} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${activeTab === 'summary' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}><BarChart3 className="w-3.5 h-3.5" />Monthly Summary</button>
              <button onClick={() => setActiveTab('ledger')} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${activeTab === 'ledger' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}><Table className="w-3.5 h-3.5" />Fee Ledger</button>
              <button onClick={() => setActiveTab('aging')} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${activeTab === 'aging' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}><ClockAlert className="w-3.5 h-3.5" />Aging Report</button>
            </div>
            <div className="hidden sm:flex items-center gap-2.5 text- bg-neutral-800/90 border border-neutral-700/80 px-3 py-1 rounded-lg">
              <span className="text-neutral-400">Active (<strong className="text-white">{sharedActiveMonth}</strong>):</span>
              <span className="text-emerald-400 font-semibold">Collected: Rs. {sessionTotals.collected.toLocaleString()}</span><span className="text-neutral-600">|</span><span className="text-rose-400 font-semibold">Due: Rs. {sessionTotals.due.toLocaleString()}</span>
              <span className="text-neutral-600">|</span><span className="text-neutral-300">{students.length} Students</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'summary' && <MonthlySummary students={students} activeAcademicYear={selectedAcademicYear} activeMonth={sharedActiveMonth} onActiveMonthChange={setSharedActiveMonth} />}
        {activeTab === 'ledger' && (
          <FeeLedger students={students} activeAcademicYear={selectedAcademicYear} activeMonth={sharedActiveMonth} onActiveMonthChange={setSharedActiveMonth}
            onOpenWhatsApp={(student, month) => setWhatsAppTarget({ student, month })}
            onOpenPaymentModal={student => setPaymentTarget(student)}
            onOpenAddStudent={() => setShowAddStudent(true)}
            onOpenImport={() => setShowImportModal(true)}
            onEditStudent={student => setEditingStudent(student)}
            onDeleteStudent={student => setDeletingStudent(student)}
            onToggleMonthStatus={handleToggleMonthStatus}
            onUpdateMonthAmount={handleUpdateMonthAmount}
          />
        )}
        {activeTab === 'aging' && <AgingReport students={students} activeAcademicYear={selectedAcademicYear} activeMonth={sharedActiveMonth} onActiveMonthChange={setSharedActiveMonth} onOpenWhatsApp={(student, month, customOutstanding) => setWhatsAppTarget({ student, month, customOutstanding })} />}
      </main>

      {whatsAppTarget && <WhatsAppPreviewModal student={whatsAppTarget.student} month={whatsAppTarget.month} customOutstanding={whatsAppTarget.customOutstanding} activeAcademicYear={selectedAcademicYear} onClose={() => setWhatsAppTarget(null)} />}
      {paymentTarget && <RecordPaymentModal student={paymentTarget} activeAcademicYear={selectedAcademicYear} activeMonth={sharedActiveMonth} onClose={() => setPaymentTarget(null)} onSavePayment={handleSavePayment} />}
      {editingStudent && <EditStudentModal student={editingStudent} activeAcademicYear={selectedAcademicYear} onClose={() => setEditingStudent(null)} onSaveStudent={handleSaveEditedStudent} />}
      {deletingStudent && <DeleteConfirmModal student={deletingStudent} activeAcademicYear={selectedAcademicYear} onClose={() => setDeletingStudent(null)} onConfirmDelete={handleConfirmDeleteStudent} />}
      {showAddStudent && <AddStudentModal currentAcademicYear={selectedAcademicYear} availableAcademicYears={academicYears} suggestedSerialNo={formatSerialNo(undefined, students.length + 1)} onClose={() => setShowAddStudent(false)} onAddStudent={handleAddStudent} />}
      {showAddAcademicYear && <AddAcademicYearModal existingYears={academicYears} currentYear={selectedAcademicYear} onClose={() => setShowAddAcademicYear(false)} onAddYear={handleAddAcademicYear} />}
      {showImportModal && <ImportStudentsModal activeAcademicYear={selectedAcademicYear} availableAcademicYears={academicYears} existingStudents={students} onClose={() => setShowImportModal(false)} onImportSuccess={handleImportSuccess} />}
      <PanController isPanMode={isPanMode} setIsPanMode={setIsPanMode} isSpaceHeld={isSpaceHeld} isDragging={isDragging} onResetView={resetView} />
      <footer className="border-t border-neutral-200 bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-2">
          <p>The Educational Centre Secondary School • Fee Management • NEW ADMISSION Excluded</p>
          <p className="font-mono text-">Session: {selectedAcademicYear} • Live DB • wa.me Integrated • {students.length} Students</p>
        </div>
      </footer>
    </div>
  );
}