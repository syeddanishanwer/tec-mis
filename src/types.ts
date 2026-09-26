export type SchoolClass = 'Reception' | 'Junior' | 'Senior' | 'Class I' | 'Class II' | 'Class III' | 'Class IV' | 'Class V' | 'Class VI' | 'Class VII' | 'Class VIII' | 'Class IX' | 'Class X';

// FIXED: Added 'new_admission'
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'new_admission';

export const ACADEMIC_MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'] as const;
export type AcademicMonth = typeof ACADEMIC_MONTHS[number];

export interface FeeChange { newFee: number; effectiveFromMonth: AcademicMonth; }

export interface FeeSchedule {
  id?: number; studentId: number; monthlyFee: number; concession: number;
  effectiveFromMonth: AcademicMonth; academicYear: string; createdAt?: string;
}

export interface Invoice {
  month: AcademicMonth;
  academicYear: string;
  baseFee: number;
  concessionAmount: number;
  netDue: number;
  paidAmount: number;
  status: PaymentStatus;
  isWaived: boolean; // NEW: independent of status — forgives net_due while preserving paid_amount history
}

export interface StudentRecord {
  id: number; serialNo?: string; rollNo: string; studentName: string; fatherName: string;
  className: SchoolClass; contactNo: string; contactNo2?: string;
  academicYear?: string; admissionDate?: string;
  // NEW - single source of truth
  invoices: Invoice[];
  feeSchedules: FeeSchedule[];
  // DEPRECATED - keep optional for backward compat but DO NOT USE IN UI
  monthlyFee?: number; discount?: number; feeChanges?: FeeChange[];
  monthlyStatus?: Record<AcademicMonth, PaymentStatus>;
  monthlyAmountsPaid?: Partial<Record<AcademicMonth, number>>;
  yearlyStatus?: any; yearlyAmountsPaid?: any;
}

export interface PaymentLog { id: string; studentId: number; studentName: string; amount: number; month: AcademicMonth; paymentDate: string; paymentMethod: 'Cash' | 'Bank Transfer' | 'Online/EasyPaisa/JazzCash'; receiptNo: string; collectedBy: string; notes?: string; }
export interface AgingBucketSummary { bucket: 'current' | '30_days' | '60_days' | '90_plus_days'; label: string; description: string; count: number; totalOutstanding: number; students: StudentRecord[]; }
export interface MonthlyClassSummary { className: SchoolClass; totalStudents: number; expectedRevenue: number; collectedRevenue: number; pendingRevenue: number; efficiency: number; }
export interface OneTimeCharge { id?: number; studentId: number; chargeType: string; amount: number; chargeDate: string; paidAmount: number; status: 'paid' | 'partial' | 'unpaid' | 'new_admission'; isRefundable: boolean; notes?: string; }