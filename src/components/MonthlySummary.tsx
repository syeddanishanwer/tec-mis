import React, { useState, useMemo, useEffect } from 'react';
import { StudentRecord, AcademicMonth, ACADEMIC_MONTHS, MonthlyClassSummary, Invoice } from '../types';
import { ALL_CLASSES } from '../data/mockStudents';
import { Users, TrendingUp, AlertCircle, CheckCircle2, Calendar, Award, Layers } from 'lucide-react';

// Custom Hook to fetch Invoices from API
export const useInvoices = (year?: string) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const startYear = year ? year.split('-')[0] : undefined;
        const url = startYear ? `/api/invoices?year=${startYear}` : '/api/invoices';
        const res = await fetch(url);
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching invoices:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [year]);

  return { invoices, loading };
};

// Helper to convert AcademicMonth into YYYY-MM-01 ISO date string
const getMonthYearString = (month: AcademicMonth, academicYear: string): string => {
  const [startYearStr] = academicYear.split('-');
  const startYear = parseInt(startYearStr, 10) || 2026;
  const endYear = startYear + 1;

  const monthMap: Record<AcademicMonth, { monthNum: string; year: number }> = {
    Jun: { monthNum: '06', year: startYear },
    Jul: { monthNum: '07', year: startYear },
    Aug: { monthNum: '08', year: startYear },
    Sep: { monthNum: '09', year: startYear },
    Oct: { monthNum: '10', year: startYear },
    Nov: { monthNum: '11', year: startYear },
    Dec: { monthNum: '12', year: startYear },
    Jan: { monthNum: '01', year: endYear },
    Feb: { monthNum: '02', year: endYear },
    Mar: { monthNum: '03', year: endYear },
    Apr: { monthNum: '04', year: endYear },
    May: { monthNum: '05', year: endYear },
  };

  const target = monthMap[month] || { monthNum: '01', year: startYear };
  return `${target.year}-${target.monthNum}-01`;
};

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

  // Fetch Invoices from API
  const { invoices } = useInvoices(activeAcademicYear);

  // Quick lookup map: studentId_YYYY-MM-01 -> Invoice
  const invoiceMap = useMemo(() => {
    const map = new Map<string, Invoice>();
    invoices.forEach((inv) => {
      const formattedMonth = inv.month_year.slice(0, 10);
      map.set(`${inv.student_id}_${formattedMonth}`, inv);
    });
    return map;
  }, [invoices]);

  const handleMonthChange = (m: AcademicMonth) => {
    if (onActiveMonthChange) {
      onActiveMonthChange(m);
    } else {
      setInternalActiveMonth(m);
    }
  };

  // Filter students enrolled or evaluated for this academic year
  const activeYearStudents = useMemo(() => {
    return students.filter(
      (s) => s.academicYear === activeAcademicYear || s.yearlyStatus?.[activeAcademicYear] || true
    );
  }, [students, activeAcademicYear]);

  const activeMonthIndex = ACADEMIC_MONTHS.indexOf(activeMonth);
  const visibleMonths = ACADEMIC_MONTHS.slice(0, activeMonthIndex + 1);

  // Cumulative session totals up to active month computed directly from DB invoices
  const { sessionBilled, sessionCollected, sessionDue } = useMemo(() => {
    let billed = 0;
    let collected = 0;
    let due = 0;

    activeYearStudents.forEach((s) => {
      visibleMonths.forEach((m) => {
        const dateStr = getMonthYearString(m, activeAcademicYear);
        const inv = invoiceMap.get(`${s.id}_${dateStr}`);

        if (inv) {
          const invBilled = Number(inv.net_due) || 0;
          const invPaid = Number(inv.paid_amount) || 0;
          billed += invBilled;
          collected += invPaid;
          due += Math.max(0, invBilled - invPaid);
        } else {
          const net = Math.max(0, (s.monthlyFee || 0) - (s.discount || 0));
          const paid = s.monthlyAmountsPaid?.[m] || 0;
          billed += net;
          collected += paid;
          due += Math.max(0, net - paid);
        }
      });
    });

    return { sessionBilled: billed, sessionCollected: collected, sessionDue: due };
  }, [activeYearStudents, visibleMonths, activeAcademicYear, invoiceMap]);

  const sessionRecoveryRate =
    sessionBilled > 0 ? Math.round((sessionCollected / sessionBilled) * 100) : 0;

  // Compute stats for selected single month
  const totalActiveStudents = activeYearStudents.length;

  let totalExpectedMonth = 0;
  let totalCollectedMonth = 0;

  const targetDateStr = getMonthYearString(activeMonth, activeAcademicYear);

  const classBreakdowns: MonthlyClassSummary[] = ALL_CLASSES.map((cls) => {
    const classStudents = activeYearStudents.filter((s) => s.className === cls);
    let classExpected = 0;
    let classCollected = 0;

    classStudents.forEach((s) => {
      const inv = invoiceMap.get(`${s.id}_${targetDateStr}`);
      if (inv) {
        classExpected += Number(inv.net_due) || 0;
        classCollected += Number(inv.paid_amount) || 0;
      } else {
        const netFee = Math.max(0, (s.monthlyFee || 0) - (s.discount || 0));
        const paidAmt = s.monthlyAmountsPaid?.[activeMonth] || 0;
        classExpected += netFee;
        classCollected += paidAmt;
      }
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

      {/* Cumulative Session Totals Card */}
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
        <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Students</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-neutral-900">{totalActiveStudents}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Across 13 Classes (Reception – X)</div>
        </div>

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