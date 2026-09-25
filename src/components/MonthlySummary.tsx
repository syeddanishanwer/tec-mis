import React, { useState, useMemo } from 'react';
import { StudentRecord, AcademicMonth, ACADEMIC_MONTHS, MonthlyClassSummary, SchoolClass, Invoice } from '../types';
import { Users, TrendingUp, AlertCircle, CheckCircle2, Calendar, Award, Layers } from 'lucide-react';

const ALL_CLASSES: SchoolClass[] = [
  'Reception', 'Junior', 'Senior',
  'Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
  'Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X'
];

interface Props {
  students: StudentRecord[];
  activeAcademicYear?: string;
  activeMonth?: AcademicMonth;
  onActiveMonthChange?: (month: AcademicMonth) => void;
}

export const MonthlySummary: React.FC<Props> = ({
  students,
  activeAcademicYear = '2026-2027',
  activeMonth: activeMonthProp,
  onActiveMonthChange,
}) => {
  const [internalActiveMonth, setInternalActiveMonth] = useState<AcademicMonth>('Sep');
  const activeMonth = activeMonthProp || internalActiveMonth;

  const handleMonthChange = (m: AcademicMonth) => {
    if (onActiveMonthChange) onActiveMonthChange(m);
    else setInternalActiveMonth(m);
  };

  const activeYearStudents = useMemo(() => {
    return students.filter(s => s.academicYear === activeAcademicYear);
  }, [students, activeAcademicYear]);

  const activeMonthIndex = ACADEMIC_MONTHS.indexOf(activeMonth);
  const visibleMonths = ACADEMIC_MONTHS.slice(0, activeMonthIndex + 1);

  const invoiceMap = useMemo(() => {
    const map = new Map<string, Invoice>();
    activeYearStudents.forEach(s => {
      s.invoices?.forEach(inv => {
        if (inv.academicYear === activeAcademicYear) {
          map.set(`${s.id}_${inv.month}`, inv);
        }
      });
    });
    return map;
  }, [activeYearStudents, activeAcademicYear]);

  const { sessionBilled, sessionCollected, sessionDue } = useMemo(() => {
    let billed = 0, collected = 0, due = 0;
    activeYearStudents.forEach(s => {
      visibleMonths.forEach(m => {
        const inv = invoiceMap.get(`${s.id}_${m}`);
        if (!inv || inv.status === 'new_admission') return;
        billed += Number(inv.netDue) || 0;
        collected += Number(inv.paidAmount) || 0;
        due += Math.max(0, (Number(inv.netDue) || 0) - (Number(inv.paidAmount) || 0));
      });
    });
    return { sessionBilled: billed, sessionCollected: collected, sessionDue: due };
  }, [activeYearStudents, visibleMonths, invoiceMap]);

  const sessionRecoveryRate = sessionBilled > 0? Math.round((sessionCollected / sessionBilled) * 100) : 0;
  const totalActiveStudents = activeYearStudents.length;

  let totalExpectedMonth = 0;
  let totalCollectedMonth = 0;

  const classBreakdowns: MonthlyClassSummary[] = ALL_CLASSES.map((cls) => {
    const classStudents = activeYearStudents.filter(s => s.className === cls);
    let classExpected = 0;
    let classCollected = 0;
    classStudents.forEach(s => {
      const inv = invoiceMap.get(`${s.id}_${activeMonth}`);
      if (!inv || inv.status === 'new_admission') return;
      classExpected += Number(inv.netDue) || 0;
      classCollected += Number(inv.paidAmount) || 0;
    });
    totalExpectedMonth += classExpected;
    totalCollectedMonth += classCollected;
    const classPending = Math.max(0, classExpected - classCollected);
    const efficiency = classExpected > 0? Math.round((classCollected / classExpected) * 100) : 0;
    return { className: cls, totalStudents: classStudents.length, expectedRevenue: classExpected, collectedRevenue: classCollected, pendingRevenue: classPending, efficiency };
  });

  const totalPendingMonth = Math.max(0, totalExpectedMonth - totalCollectedMonth);
  const overallEfficiency = totalExpectedMonth > 0? Math.round((totalCollectedMonth / totalExpectedMonth) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg text-neutral-900 leading-tight">Monthly Fee Summary & Analytics Dashboard</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Evaluation of fee collections, target vs realization (Session {activeAcademicYear}) - Excludes NEW ADMISSION months</p>
        </div>
        <div className="flex items-center gap-2 bg-neutral-100 p-1.5 rounded-lg border border-neutral-200">
          <Calendar className="w-4 h-4 text-neutral-500 ml-1" />
          <span className="text-xs font-semibold text-neutral-700">Active Month:</span>
          <select value={activeMonth} onChange={e => handleMonthChange(e.target.value as AcademicMonth)} className="text-xs font-bold bg-white border border-neutral-300 rounded-md px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none">
            {ACADEMIC_MONTHS.map(m => <option key={m} value={m}>{m} ({activeAcademicYear})</option>)}
          </select>
        </div>
      </div>

      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-slate-900 rounded-xl p-5 text-white shadow-sm border border-neutral-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-700/80">
          <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-blue-400" /><span className="font-bold text-sm tracking-wide">Cumulative Session Totals (June through {activeMonth})</span></div>
          <span className="text-xs text-neutral-300 bg-neutral-800/80 px-2.5 py-1 rounded-md border border-neutral-700">Synchronized • {activeMonthIndex + 1} Months • Excludes NEW ADMISSION</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3.5">
          <div><span className="text- font-medium text-neutral-400 block uppercase tracking-wider">Total Billed To Date</span><div className="text-lg font-bold text-white mt-1">Rs. {sessionBilled.toLocaleString()}</div><span className="text- text-neutral-400">June to {activeMonth} schedule</span></div>
          <div><span className="text- font-medium text-emerald-400 block uppercase tracking-wider">Total Collected</span><div className="text-lg font-bold text-emerald-400 mt-1">Rs. {sessionCollected.toLocaleString()}</div><span className="text- text-emerald-300/80">{sessionRecoveryRate}% recovery</span></div>
          <div><span className="text- font-medium text-rose-400 block uppercase tracking-wider">Total Due / Outstanding</span><div className="text-lg font-bold text-rose-400 mt-1">Rs. {sessionDue.toLocaleString()}</div><span className="text- text-rose-300/80">Net unpaid dues</span></div>
          <div><span className="text- font-medium text-blue-300 block uppercase tracking-wider">Session Health</span><div className="text-lg font-bold text-blue-200 mt-1">{sessionRecoveryRate}% Realized</div><span className="text- text-blue-300/80">{totalActiveStudents} students evaluated</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2"><span className="text-xs font-semibold uppercase tracking-wider">Active Students</span><Users className="w-4 h-4 text-blue-600" /></div>
          <div className="text-2xl font-bold text-neutral-900">{totalActiveStudents}</div><div className="text- text-neutral-500 mt-1">Across 13 Classes</div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2"><span className="text-xs font-semibold uppercase tracking-wider">Expected ({activeMonth})</span><TrendingUp className="w-4 h-4 text-neutral-600" /></div>
          <div className="text-2xl font-bold text-neutral-900">Rs. {totalExpectedMonth.toLocaleString()}</div><div className="text- text-neutral-500 mt-1">Excludes NEW ADMISSION</div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 mb-2"><span className="text-xs font-semibold uppercase tracking-wider">Collected Revenue</span><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          <div className="text-2xl font-bold text-emerald-700">Rs. {totalCollectedMonth.toLocaleString()}</div><div className="text- text-emerald-700 mt-1">Realized cash & bank</div>
        </div>
        <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-800 mb-2"><span className="text-xs font-semibold uppercase tracking-wider">Unpaid Dues</span><AlertCircle className="w-4 h-4 text-rose-600" /></div>
          <div className="text-2xl font-bold text-rose-700">Rs. {totalPendingMonth.toLocaleString()}</div><div className="text- text-rose-700 mt-1">Uncollected for {activeMonth}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2"><Award className="w-5 h-5 text-emerald-600" /><span className="font-bold text-sm text-neutral-900">Overall Collection Efficiency for {activeMonth}</span></div>
          <div className="flex items-baseline gap-1"><span className="text-2xl font-extrabold text-emerald-600">{overallEfficiency}%</span><span className="text-xs text-neutral-500">collected</span></div>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-3 overflow-hidden"><div className="bg-emerald-600 h-3 rounded-full transition-all duration-500" style={{ width: `${overallEfficiency}%` }}></div></div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3"><h4 className="font-bold text-neutral-900 text-sm">Revenue Breakdown by Class ({activeMonth})</h4><span className="text-xs text-neutral-500">13 Divisions</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {classBreakdowns.map(item => (
            <div key={item.className} className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-xs hover:border-neutral-300">
              <div className="flex items-center justify-between mb-2"><span className="font-bold text-sm text-neutral-900">{item.className}</span><span className="text- font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border">{item.totalStudents} Students</span></div>
              <div className="space-y-1.5 text-xs text-neutral-600 mt-3">
                <div className="flex justify-between"><span className="text-neutral-500">Expected:</span><span className="font-medium text-neutral-800">Rs. {item.expectedRevenue.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500">Collected:</span><span className="font-semibold text-emerald-600">Rs. {item.collectedRevenue.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500">Unpaid:</span><span className="font-semibold text-rose-600">Rs. {item.pendingRevenue.toLocaleString()}</span></div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-neutral-100">
                <div className="flex justify-between text- font-semibold mb-1"><span className="text-neutral-500">Recovery</span><span className={item.efficiency >= 75? 'text-emerald-600' : item.efficiency >= 50? 'text-amber-600' : 'text-rose-600'}>{item.efficiency}%</span></div>
                <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden"><div className={`h-1.5 rounded-full ${item.efficiency >= 75? 'bg-emerald-600' : item.efficiency >= 50? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${item.efficiency}%` }}></div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};