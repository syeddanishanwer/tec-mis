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

export type PaymentStatus = 'paid' | 'pending' | 'partial';

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



export interface StudentRecord {

  id: number;

  serialNo?: string; // S# e.g. '001', '002' manually assigned to each student

  rollNo: string;

  studentName: string;

  fatherName: string;

  className: SchoolClass;

  contactNo: string; // e.g. '923001234567'

  monthlyFee: number; // M. FEE (Base Monthly Fee)

  monthlyStatus: Record<AcademicMonth, PaymentStatus>;

  monthlyAmountsPaid?: Partial<Record<AcademicMonth, number>>; // Exact PKR fee amounts recorded or imported for each month

  yearlyStatus?: Record<string, Record<AcademicMonth, PaymentStatus>>;

  yearlyAmountsPaid?: Record<string, Partial<Record<AcademicMonth, number>>>;

  discount: number; // Optional scholarship/sibling concession

  academicYear: string;

  admissionDate: string;

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

export interface FeeSchedule {
  id?: number;
  student_id: number;
  base_fee: number;
  concession_amount: number;
  effective_from_date: string; // ISO Format: 'YYYY-MM-01'
  created_at?: string;
}

export interface Invoice {
  id?: number;
  student_id: number;
  month_year: string; // ISO Format: 'YYYY-MM-01'
  base_fee: number;
  concession_amount: number;
  net_due: number; // Generated in DB (base_fee - concession_amount)
  paid_amount: number;
  status: 'paid' | 'partial' | 'unpaid';
  created_at?: string;
}
