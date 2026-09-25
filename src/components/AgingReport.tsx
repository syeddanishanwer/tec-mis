import React, { useState, useMemo } from 'react';
import { StudentRecord, AcademicMonth, ACADEMIC_MONTHS, Invoice } from '../types';
import { Clock, AlertTriangle, Flame, Phone, CheckCircle2, ChevronRight } from 'lucide-react';

// FIXED: Local helpers - no mockStudents import
function formatPhoneDisplay(raw?: string): string {
  if (!raw) return '';
  let cleaned = String(raw).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('92') && cleaned.length >= 12) return '0' + cleaned.slice(2);
  if (cleaned.startsWith('03')) return cleaned;
  return cleaned;
}
function formatSerialNo(serialNo?: string | number, fallback?: number): string {
  if (serialNo!== undefined && serialNo!== null) return String(serialNo).trim().padStart(3, '0');
  if (fallback) return String(fallback).padStart(3, '0');
  return '001';
}

interface Props {
  students: StudentRecord[];
  activeAcademicYear?: string;
  activeMonth?: AcademicMonth;
  onActiveMonthChange?: (month: AcademicMonth) => void;
  onOpenWhatsApp: (student: StudentRecord, month: AcademicMonth, customOutstanding?: number) => void;
}

export const AgingReport: React.FC<Props> = ({
  students,
  activeAcademicYear = '2026-2027',
  activeMonth = 'Feb',
  onActiveMonthChange,
  onOpenWhatsApp,
}) => {
  const [selectedBucket, setSelectedBucket] = useState<'all' | '30' | '60' | '90'>('all');

  const activeMonthIndex = ACADEMIC_MONTHS.indexOf(activeMonth);
  const visibleMonths = ACADEMIC_MONTHS.slice(0, activeMonthIndex + 1);

  // FIXED: InvoiceMap from students[].invoices - single source, no extra fetch
  const invoiceMap = useMemo(() => {
    const map = new Map<string, Invoice>();
    students.forEach(s => {
      s.invoices?.forEach(inv => {
        if (inv.academicYear === activeAcademicYear) {
          map.set(`${s.id}_${inv.month}`, inv);
        }
      });
    });
    return map;
  }, [students, activeAcademicYear]);

  // FIXED: Categorize using invoices only, excluding new_admission
  const evaluated = useMemo(() => {
    return students
     .filter(s => s.academicYear === activeAcademicYear)
     .map(s => {
        let totalCollected = 0;
        let totalDue = 0;
        let overdueMonthsCount = 0;

        visibleMonths.forEach(m => {
          const inv = invoiceMap.get(`${s.id}_${m}`);
          if (!inv || inv.status === 'new_admission') return; // Exclude NEW ADMISSION
          const paid = Number(inv.paidAmount) || 0;
          const netDue = Number(inv.netDue) || 0;
          const dueAmt = Math.max(0, netDue - paid);
          totalCollected += paid;
          totalDue += dueAmt;
          if (dueAmt > 0) overdueMonthsCount++;
        });

        return { student: s, totals: { totalCollected, totalDue, overdueMonthsCount } };
      });
  }, [students, visibleMonths, activeAcademicYear, invoiceMap]);

  const bucket30Items = useMemo(() => evaluated.filter(e => e.totals.overdueMonthsCount === 1), [evaluated]);
  const bucket60Items = useMemo(() => evaluated.filter(e => e.totals.overdueMonthsCount === 2), [evaluated]);
  const bucket90Items = useMemo(() => evaluated.filter(e => e.totals.overdueMonthsCount >= 3), [evaluated]);

  const amount30 = useMemo(() => bucket30Items.reduce((acc, curr) => acc + curr.totals.totalDue, 0), [bucket30Items]);
  const amount60 = useMemo(() => bucket60Items.reduce((acc, curr) => acc + curr.totals.totalDue, 0), [bucket60Items]);
  const amount90 = useMemo(() => bucket90Items.reduce((acc, curr) => acc + curr.totals.totalDue, 0), [bucket90Items]);
  const totalOverdue = amount30 + amount60 + amount90;
  const totalCollectedAll = useMemo(() => evaluated.reduce((acc, curr) => acc + curr.totals.totalCollected, 0), [evaluated]);

  let displayedItems = useMemo(() => {
    let items = evaluated.filter(e => e.totals.overdueMonthsCount > 0);
    if (selectedBucket === '30') items = bucket30Items;
    else if (selectedBucket === '60') items = bucket60Items;
    else if (selectedBucket === '90') items = bucket90Items;
    return [...items].sort((a, b) => b.totals.totalDue - a.totals.totalDue);
  }, [evaluated, selectedBucket, bucket30Items, bucket60Items, bucket90Items]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-lg text-neutral-900 leading-tight">Fee Receivable Aging & Overdue Recovery Report</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Prioritize recovery with aging buckets (Session: {activeAcademicYear} • Jun-{activeMonth}) - Excludes NEW ADMISSION months</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onActiveMonthChange? (
            <div className="flex items-center gap-1.5 text-xs text-neutral-700 bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-200">
              <Clock className="w-3.5 h-3.5 text-blue-600" /><span className="font-medium">Active Month:</span>
              <select value={activeMonth} onChange={e => onActiveMonthChange(e.target.value as AcademicMonth)} className="bg-white text-xs font-semibold text-neutral-800 rounded px-2 py-0.5 border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {ACADEMIC_MONTHS.map(m => <option key={m} value={m}>{m} (Jun - {m})</option>)}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 bg-neutral-100 px-3 py-1.5 rounded-lg"><Clock className="w-3.5 h-3.5 text-neutral-500" /><span>Evaluation Cycle: June to {activeMonth}</span></div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div onClick={() => setSelectedBucket(selectedBucket === '30'? 'all' : '30')} className={`cursor-pointer bg-white rounded-xl border p-4.5 shadow-xs transition-all ${selectedBucket === '30'? 'ring-2 ring-amber-500 border-amber-300' : 'border-neutral-200 hover:border-amber-300'}`}>
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">30 Days Overdue</span><Clock className="w-4 h-4 text-amber-600" /></div>
          <div className="text-2xl font-bold text-neutral-900">Rs. {amount30.toLocaleString()}</div>
          <p className="text-xs text-neutral-500 mt-1"><strong>{bucket30Items.length}</strong> Students (1 month behind)</p>
          <div className="mt-3 text- font-semibold text-amber-700 flex items-center justify-between"><span>Mild Recovery Risk</span><ChevronRight className="w-3.5 h-3.5" /></div>
        </div>
        <div onClick={() => setSelectedBucket(selectedBucket === '60'? 'all' : '60')} className={`cursor-pointer bg-white rounded-xl border p-4.5 shadow-xs transition-all ${selectedBucket === '60'? 'ring-2 ring-orange-500 border-orange-300' : 'border-neutral-200 hover:border-orange-300'}`}>
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">60 Days Overdue</span><AlertTriangle className="w-4 h-4 text-orange-600" /></div>
          <div className="text-2xl font-bold text-orange-700">Rs. {amount60.toLocaleString()}</div>
          <p className="text-xs text-neutral-500 mt-1"><strong>{bucket60Items.length}</strong> Students (2 months behind)</p>
          <div className="mt-3 text- font-semibold text-orange-700 flex items-center justify-between"><span>Moderate Delinquency</span><ChevronRight className="w-3.5 h-3.5" /></div>
        </div>
        <div onClick={() => setSelectedBucket(selectedBucket === '90'? 'all' : '90')} className={`cursor-pointer bg-white rounded-xl border p-4.5 shadow-xs transition-all ${selectedBucket === '90'? 'ring-2 ring-rose-600 border-rose-400 bg-rose-50/20' : 'border-neutral-200 hover:border-rose-300'}`}>
          <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">90+ Days Overdue (Critical)</span><Flame className="w-4 h-4 text-rose-600" /></div>
          <div className="text-2xl font-bold text-rose-700">Rs. {amount90.toLocaleString()}</div>
          <p className="text-xs text-neutral-500 mt-1"><strong>{bucket90Items.length}</strong> Students (Severe Defaulters)</p>
          <div className="mt-3 text- font-semibold text-rose-700 flex items-center justify-between"><span>Urgent Notice Required</span><ChevronRight className="w-3.5 h-3.5" /></div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedBucket('all')} className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${selectedBucket === 'all'? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>All Overdue ({displayedItems.length})</button>
          <button onClick={() => setSelectedBucket('30')} className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${selectedBucket === '30'? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}`}>30 Days ({bucket30Items.length})</button>
          <button onClick={() => setSelectedBucket('60')} className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${selectedBucket === '60'? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-800 hover:bg-orange-100'}`}>60 Days ({bucket60Items.length})</button>
          <button onClick={() => setSelectedBucket('90')} className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${selectedBucket === '90'? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'}`}>90+ Days Critical ({bucket90Items.length})</button>
        </div>
        <div className="text-xs text-neutral-500 hidden sm:flex items-center gap-3">
          <span>Total Collected: <strong className="text-emerald-700">Rs. {totalCollectedAll.toLocaleString()}</strong></span><span className="text-neutral-300">|</span><span>Total Overdue: <strong className="text-rose-600">Rs. {totalOverdue.toLocaleString()}</strong></span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar w-full">
          <table className="w-full text-left text-xs border-collapse min-w-">
            <thead><tr className="bg-neutral-900 text-white font-semibold text- uppercase tracking-wider select-none"><th className="py-3 px-3 text-center w-12">S#</th><th className="py-3 px-3 min-w-">Class</th><th className="py-3 px-3 min-w-">Student Name</th><th className="py-3 px-3 min-w-">Father Name</th><th className="py-3 px-3 min-w-">Contact No.</th><th className="py-3 px-3 text-center min-w-">Unpaid Months</th><th className="py-3 px-3 text-right min-w-">M. Fee</th><th className="py-3 px-3 text-right min-w-">Total Collected</th><th className="py-3 px-3 text-right min-w-">Total Overdue</th><th className="py-3 px-3 text-center min-w-">Aging Status</th><th className="py-3 px-3 text-center min-w-">WhatsApp Notice</th></tr></thead>
            <tbody className="divide-y divide-neutral-200">
              {displayedItems.length === 0? (
                <tr><td colSpan={11} className="py-12 text-center text-neutral-400"><CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />No students in this aging bucket - All clear up to {activeMonth}! (NEW ADMISSION excluded)</td></tr>
              ) : (
                displayedItems.map(({ student, totals }, idx) => {
                  const is90Plus = totals.overdueMonthsCount >= 3;
                  const is60 = totals.overdueMonthsCount === 2;
                  const displaySNo = student.serialNo? formatSerialNo(student.serialNo) : formatSerialNo(student.id, idx + 1);
                  const feeSchedules = student.feeSchedules || [];
                  const currentFee = feeSchedules.length > 0? feeSchedules[feeSchedules.length - 1].monthlyFee : 0;
                  const wef = feeSchedules.length > 0? feeSchedules[feeSchedules.length - 1].effectiveFromMonth : 'Jun';
                  return (
                    <tr key={student.id} className={`hover:bg-neutral-50 ${is90Plus? 'bg-rose-50/20' : ''}`}>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-xs text-neutral-800 bg-neutral-50/50">{displaySNo}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap"><span className="px-2 py-0.5 rounded-full text- font-bold bg-neutral-100 text-neutral-800 border">{student.className}</span></td>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900">{student.studentName}<span className="block text- font-mono text-neutral-400">{student.rollNo}</span></td>
                      <td className="py-2.5 px-3 text-neutral-700 whitespace-nowrap">{student.fatherName}</td>
                      <td className="py-2.5 px-3 font-mono text-neutral-600 text- whitespace-nowrap">{formatPhoneDisplay(student.contactNo)}</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap"><span className={`font-bold px-2 py-0.5 rounded-full text- ${is90Plus? 'bg-rose-100 text-rose-800' : is60? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800'}`}>{totals.overdueMonthsCount} Months</span></td>
                      <td className="py-2.5 px-3 text-right text-neutral-700 whitespace-nowrap">Rs. {currentFee.toLocaleString()}<span className="block text- text-blue-600">w.e.f {wef}</span></td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">Rs. {totals.totalCollected.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600 text-xs whitespace-nowrap">Rs. {totals.totalDue.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap"><span className={`text- font-bold px-2 py-0.5 rounded ${is90Plus? 'bg-rose-600 text-white' : is60? 'bg-orange-600 text-white' : 'bg-amber-500 text-white'}`}>{is90Plus? '90+ Days Overdue' : is60? '60 Days' : '30 Days'}</span></td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap"><button onClick={() => onOpenWhatsApp(student, activeMonth, totals.totalDue)} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text- font-semibold rounded-md shadow-xs"><Phone className="w-3 h-3" />Send Notice</button></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};