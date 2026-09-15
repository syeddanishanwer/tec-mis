import React, { useState } from 'react';
import { StudentRecord, AcademicMonth, ACADEMIC_MONTHS, MonthlyClassSummary } from '../types';
import {
  ALL_CLASSES,
  getEffectiveMonthlyStatus,
  calculateStudentTotals,
  getStudentMonthPaidAmount,
} from '../data/mockStudents';
import { Users, TrendingUp, AlertCircle, CheckCircle2, Calendar, Award, Layers } from 'lucide-react';

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
  const [internalActiveMonth, setInternalActiveMonth] = useState<AcademicMonth>('Feb');
  const activeMonth = activeMonthProp || internalActiveMonth;

  const handleMonthChange = (m: AcademicMonth) => {
    if (onActiveMonthChange) {
      onActiveMonthChange(m);
    } else {
      setInternalActiveMonth(m);
    }
  };

  // Filter students enrolled or evaluated for this academic year
  const activeYearStudents = students.filter(
    (s) => s.academicYear === activeAcademicYear || s.yearlyStatus?.[activeAcademicYear] || true
  );

  const activeMonthIndex = ACADEMIC_MONTHS.indexOf(activeMonth);

  // Cumulative session totals up to active month (strictly matches FeeLedger & AgingReport!)
  let sessionBilled = 0;
  let sessionCollected = 0;
  let sessionDue = 0;

  activeYearStudents.forEach((s) => {
    const totals = calculateStudentTotals(s, activeMonthIndex, activeAcademicYear);
    sessionBilled += totals.totalBilled;
    sessionCollected += totals.totalCollected;
    sessionDue += totals.totalDue;
  });

  const sessionRecoveryRate =
    sessionBilled > 0 ? Math.round((sessionCollected / sessionBilled) * 100) : 0;

  // Compute stats for selected single month
  const totalActiveStudents = activeYearStudents.length;

  let totalExpectedMonth = 0;
  let totalCollectedMonth = 0;

  const classBreakdowns: MonthlyClassSummary[] = ALL_CLASSES.map((cls) => {
    const classStudents = activeYearStudents.filter((s) => s.className === cls);
    let classExpected = 0;
    let classCollected = 0;

    classStudents.forEach((s) => {
      const netFee = Math.max(0, s.monthlyFee - s.discount);
      classExpected += netFee;

      const paidAmt = getStudentMonthPaidAmount(s, activeMonth, activeAcademicYear);
      classCollected += paidAmt;
    });

    totalExpectedMonth += classExpected;
    totalCollectedMonth += classCollected;

    const classPending = Math.max(0, classExpected - classCollected);
    const efficiency = classExpected > 0 ? Math.round((classCollected / classExpected) * 100) : 0;

    return {
      className: cls,
      totalStudents: classStudents.length,
      expectedRevenue: classExpected,
      collectedRevenue: classCollected,
      pendingRevenue: classPending,
      efficiency,
    };
  });

  const totalPendingMonth = Math.max(0, totalExpectedMonth - totalCollectedMonth);
  const overallEfficiency =
    totalExpectedMonth > 0 ? Math.round((totalCollectedMonth / totalExpectedMonth) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Month Selector & Banner */}
      <div className="bg-white p-5 rounded-xl border border-neutral-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg text-neutral-900 leading-tight">
            Monthly Fee Summary & Analytics Dashboard
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Evaluation of active monthly fee collections, target vs realization & grade performance (Session {activeAcademicYear})
          </p>
        </div>

        <div className="flex items-center gap-2 bg-neutral-100 p-1.5 rounded-lg border border-neutral-200">
          <Calendar className="w-4 h-4 text-neutral-500 ml-1" />
          <span className="text-xs font-semibold text-neutral-700">Active Month:</span>
          <select
            value={activeMonth}
            onChange={(e) => handleMonthChange(e.target.value as AcademicMonth)}
            className="text-xs font-bold bg-white border border-neutral-300 rounded-md px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {ACADEMIC_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m} (Session: {activeAcademicYear})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cumulative Session Totals Card (Reflected consistently with Fee Ledger & Aging Report) */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-slate-900 rounded-xl p-5 text-white shadow-sm border border-neutral-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-700/80">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-sm tracking-wide text-white">
              Cumulative Academic Session Totals (June through {activeMonth})
            </span>
          </div>
          <span className="text-xs text-neutral-300 bg-neutral-800/80 px-2.5 py-1 rounded-md border border-neutral-700">
            Synchronized with Student Fee Ledger &bull; {activeMonthIndex + 1} Months
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3.5">
          <div>
            <span className="text-[11px] font-medium text-neutral-400 block uppercase tracking-wider">
              Total Billed To Date
            </span>
            <div className="text-lg font-bold text-white mt-1">
              Rs. {sessionBilled.toLocaleString()}
            </div>
            <span className="text-[10px] text-neutral-400">June to {activeMonth} schedule</span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-emerald-400 block uppercase tracking-wider">
              Total Collected
            </span>
            <div className="text-lg font-bold text-emerald-400 mt-1">
              Rs. {sessionCollected.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-300/80">
              {sessionRecoveryRate}% cumulative recovery
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-rose-400 block uppercase tracking-wider">
              Total Due / Outstanding
            </span>
            <div className="text-lg font-bold text-rose-400 mt-1">
              Rs. {sessionDue.toLocaleString()}
            </div>
            <span className="text-[10px] text-rose-300/80">Net pending dues across session</span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-blue-300 block uppercase tracking-wider">
              Session Collection Health
            </span>
            <div className="text-lg font-bold text-blue-200 mt-1">
              {sessionRecoveryRate}% Realized
            </div>
            <span className="text-[10px] text-blue-300/80">
              {totalActiveStudents} students evaluated
            </span>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Students */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Students</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-neutral-900">{totalActiveStudents}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Across 13 Classes (Reception – X)</div>
        </div>

        {/* Expected Monthly Revenue */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Expected ({activeMonth})</span>
            <TrendingUp className="w-4 h-4 text-neutral-600" />
          </div>
          <div className="text-2xl font-bold text-neutral-900">
            Rs. {totalExpectedMonth.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Total scheduled tuition fees</div>
        </div>

        {/* Collected Fees */}
        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Collected Revenue</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            Rs. {totalCollectedMonth.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            Realized cash & bank collections
          </div>
        </div>

        {/* Pending Fees */}
        <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-800 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Dues</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-700">
            Rs. {totalPendingMonth.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-700 mt-1">Uncollected receivables for {activeMonth}</div>
        </div>
      </div>

      {/* Collection Efficiency Banner */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-sm text-neutral-900">
              Overall Collection Efficiency for {activeMonth}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-emerald-600">{overallEfficiency}%</span>
            <span className="text-xs text-neutral-500">of total expected revenue collected</span>
          </div>
        </div>

        <div className="w-full bg-neutral-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-emerald-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${overallEfficiency}%` }}
          ></div>
        </div>
      </div>

      {/* Revenue Breakdown by Class Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-neutral-900 text-sm">
            Revenue Breakdown by Class ({activeMonth})
          </h4>
          <span className="text-xs text-neutral-500">13 Educational Divisions</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {classBreakdowns.map((item) => (
            <div
              key={item.className}
              className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-xs hover:border-neutral-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-neutral-900">{item.className}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                  {item.totalStudents} Students
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-neutral-600 mt-3">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Expected:</span>
                  <span className="font-medium text-neutral-800">
                    Rs. {item.expectedRevenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Collected:</span>
                  <span className="font-semibold text-emerald-600">
                    Rs. {item.collectedRevenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Pending:</span>
                  <span className="font-semibold text-rose-600">
                    Rs. {item.pendingRevenue.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 pt-2.5 border-t border-neutral-100">
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span className="text-neutral-500">Recovery</span>
                  <span
                    className={
                      item.efficiency >= 75
                        ? 'text-emerald-600'
                        : item.efficiency >= 50
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }
                  >
                    {item.efficiency}%
                  </span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${
                      item.efficiency >= 75
                        ? 'bg-emerald-600'
                        : item.efficiency >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${item.efficiency}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
