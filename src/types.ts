export type SchoolClass =
  | 'Reception'
  | 'Junior'
  | 'Senior'
  | 'Class I'
  | 'Class II'
  | 'Class III'
  | 'Class IV'
  | 'Class V'
  | 'Class VI'
  | 'Class VII'
  | 'Class VIII'
  | 'Class IX'
  | 'Class X';

export type PaymentStatus = 'paid' | 'unpaid' | 'partial';

export const ACADEMIC_MONTHS = [
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
] as const;

export type AcademicMonth = typeof ACADEMIC_MONTHS[number];

export interface FeeChange {
  newFee: number;
  effectiveFromMonth: AcademicMonth;
}

export interface StudentRecord {
  id: number;
  serialNo?: string;
  rollNo: string;
  studentName: string;
  fatherName: string;
  className: SchoolClass;
  contactNo: string;
  contactNo2?: string;
  monthlyFee: number;
  discount: number; // Required number (defaults to 0)
  academicYear?: string;
  admissionDate?: string;
  feeChanges?: FeeChange[];
  monthlyStatus: Record<AcademicMonth, PaymentStatus>; // Required map for grid compatibility
  monthlyAmountsPaid?: Partial<Record<AcademicMonth, number>>;
  yearlyStatus?: Record<string, Record<AcademicMonth, PaymentStatus>>;
  yearlyAmountsPaid?: Record<string, Partial<Record<AcademicMonth, number>>>;
}

export interface PaymentLog {
  id: string;
  studentId: number;
  studentName: string;
  amount: number;
  month: AcademicMonth;
  paymentDate: string;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Online/EasyPaisa/JazzCash';
  receiptNo: string;
  collectedBy: string;
  notes?: string;
}

export interface AgingBucketSummary {
  bucket: 'current' | '30_days' | '60_days' | '90_plus_days';
  label: string;
  description: string;
  count: number;
  totalOutstanding: number;
  students: StudentRecord[];
}

export interface MonthlyClassSummary {
  className: SchoolClass;
  totalStudents: number;
  expectedRevenue: number;
  collectedRevenue: number;
  pendingRevenue: number;
  efficiency: number;
}

/**
 * A single mid-year fee change parsed from the import spreadsheet
 * (one of up to 3 "New Fee N" / "Effective From N" column pairs).
 */
export interface FeeChange {
  newFee: number;
  effectiveFromMonth: AcademicMonth;
}

/**
 * Mirrors the real `student_fee_schedules` table:
 *   id, student_id, monthly_fee, concession, effective_from_month, academic_year, created_at
 */
export interface FeeSchedule {
  id?: number;
  studentId: number;
  monthlyFee: number;
  concession: number;
  effectiveFromMonth: AcademicMonth;
  academicYear: string;
  createdAt?: string;
}

/**
 * Mirrors the real `invoices` table:
 *   id, student_id, academic_year, month, base_fee, concession_amount,
 *   net_due, paid_amount, status, note, created_at, updated_at
 */
export interface Invoice {
  id?: number;
  studentId: number;
  academicYear: string;
  month: AcademicMonth;
  baseFee: number;
  concessionAmount: number;
  netDue: number;
  paidAmount: number;
  status: 'paid' | 'partial' | 'unpaid';
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Mirrors the real `one_time_charges` table (schema exists, no endpoints yet):
 *   id, student_id, charge_type, amount, charge_date, paid_amount, status, is_refundable, notes
 */
export interface OneTimeCharge {
  id?: number;
  studentId: number;
  chargeType: string; // e.g. 'admission_fee', 'security_deposit', 'exam_fee'
  amount: number;
  chargeDate: string; // ISO date, e.g. '2026-06-15'
  paidAmount: number;
  status: 'paid' | 'partial' | 'unpaid';
  isRefundable: boolean;
  notes?: string;
}