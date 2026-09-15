import { StudentRecord, SchoolClass, ACADEMIC_MONTHS, AcademicMonth, PaymentStatus } from '../types';

export const ALL_CLASSES: SchoolClass[] = [
  'Reception',
  'Junior',
  'Senior',
  'Class I',
  'Class II',
  'Class III',
  'Class IV',
  'Class V',
  'Class VI',
  'Class VII',
  'Class VIII',
  'Class IX',
  'Class X',
];

export const INITIAL_STUDENTS: StudentRecord[] = [
  {
    id: 1,
    serialNo: '001',
    rollNo: 'ETC-1001',
    studentName: 'Muhammad Hamza',
    fatherName: 'Tariq Mehmood',
    className: 'Class X',
    contactNo: '923001234567',
    monthlyFee: 6500,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2021-04-10',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'paid',
      Nov: 'paid',
      Dec: 'partial',
      Jan: 'pending',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 2,
    serialNo: '002',
    rollNo: 'ETC-1002',
    studentName: 'Ayesha Fatima',
    fatherName: 'Nadeem Akhtar',
    className: 'Class IX',
    contactNo: '923219876543',
    monthlyFee: 6000,
    discount: 500,
    academicYear: '2026-2027',
    admissionDate: '2022-03-15',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'paid',
      Nov: 'paid',
      Dec: 'paid',
      Jan: 'paid',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 3,
    serialNo: '003',
    rollNo: 'ETC-1003',
    studentName: 'Zain Ul Abideen',
    fatherName: 'Ghulam Rasool',
    className: 'Class VIII',
    contactNo: '923335551234',
    monthlyFee: 5500,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2024-06-01',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'pending',
      Sep: 'pending',
      Oct: 'pending',
      Nov: 'pending',
      Dec: 'pending',
      Jan: 'pending',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 4,
    serialNo: '004',
    rollNo: 'ETC-1004',
    studentName: 'Fatima Zahra',
    fatherName: 'Dr. Shakeel Ahmed',
    className: 'Class VII',
    contactNo: '923451122334',
    monthlyFee: 5000,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2023-08-01',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'paid',
      Nov: 'paid',
      Dec: 'paid',
      Jan: 'paid',
      Feb: 'paid',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 5,
    serialNo: '005',
    rollNo: 'ETC-1005',
    studentName: 'Bilal Hassan',
    fatherName: 'Hassan Raza',
    className: 'Class VI',
    contactNo: '923124445566',
    monthlyFee: 4800,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2022-01-10',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'partial',
      Nov: 'pending',
      Dec: 'pending',
      Jan: 'pending',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 6,
    serialNo: '006',
    rollNo: 'ETC-1006',
    studentName: 'Zoya Noor',
    fatherName: 'Khurram Shehzad',
    className: 'Class V',
    contactNo: '923017788990',
    monthlyFee: 4500,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2023-04-12',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'paid',
      Nov: 'paid',
      Dec: 'paid',
      Jan: 'pending',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 7,
    serialNo: '007',
    rollNo: 'ETC-1007',
    studentName: 'Ali Arham',
    fatherName: 'Arshad Ali',
    className: 'Class IV',
    contactNo: '923223334455',
    monthlyFee: 4200,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2024-05-20',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'partial',
      Aug: 'pending',
      Sep: 'pending',
      Oct: 'pending',
      Nov: 'pending',
      Dec: 'pending',
      Jan: 'pending',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 8,
    serialNo: '008',
    rollNo: 'ETC-1008',
    studentName: 'Hoorain Kashif',
    fatherName: 'Kashif Mehmood',
    className: 'Class III',
    contactNo: '923058889900',
    monthlyFee: 4000,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2023-09-01',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'paid',
      Nov: 'paid',
      Dec: 'paid',
      Jan: 'paid',
      Feb: 'paid',
      Mar: 'paid',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 9,
    serialNo: '009',
    rollNo: 'ETC-1009',
    studentName: 'Abdullah Tahir',
    fatherName: 'Tahir Abbas',
    className: 'Class II',
    contactNo: '923467771234',
    monthlyFee: 3800,
    discount: 300,
    academicYear: '2026-2027',
    admissionDate: '2023-03-10',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'paid',
      Nov: 'paid',
      Dec: 'paid',
      Jan: 'pending',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 10,
    serialNo: '010',
    rollNo: 'ETC-1010',
    studentName: 'Maryam Imran',
    fatherName: 'Imran Bashir',
    className: 'Class I',
    contactNo: '923136665544',
    monthlyFee: 3500,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2024-01-15',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'paid',
      Nov: 'pending',
      Dec: 'pending',
      Jan: 'pending',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 11,
    serialNo: '011',
    rollNo: 'ETC-1011',
    studentName: 'Syed Rohaan',
    fatherName: 'Syed Daniyal',
    className: 'Senior',
    contactNo: '923005554433',
    monthlyFee: 3200,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2023-11-01',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'paid',
      Nov: 'paid',
      Dec: 'paid',
      Jan: 'paid',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 12,
    serialNo: '012',
    rollNo: 'ETC-1012',
    studentName: 'Anaya Usman',
    fatherName: 'Usman Farooq',
    className: 'Junior',
    contactNo: '923214443322',
    monthlyFee: 3000,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2024-03-01',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'paid',
      Nov: 'paid',
      Dec: 'partial',
      Jan: 'pending',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 13,
    serialNo: '013',
    rollNo: 'ETC-1013',
    studentName: 'Hamdan Qureshi',
    fatherName: 'Farhan Qureshi',
    className: 'Reception',
    contactNo: '923337778899',
    monthlyFee: 2800,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2024-06-01',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'pending',
      Aug: 'pending',
      Sep: 'pending',
      Oct: 'pending',
      Nov: 'pending',
      Dec: 'pending',
      Jan: 'pending',
      Feb: 'pending',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
  {
    id: 14,
    serialNo: '014',
    rollNo: 'ETC-1014',
    studentName: 'Eshal Mansoor',
    fatherName: 'Mansoor Haider',
    className: 'Reception',
    contactNo: '923024446688',
    monthlyFee: 2800,
    discount: 0,
    academicYear: '2026-2027',
    admissionDate: '2024-06-15',
    monthlyStatus: {
      Jun: 'paid',
      Jul: 'paid',
      Aug: 'paid',
      Sep: 'paid',
      Oct: 'paid',
      Nov: 'paid',
      Dec: 'paid',
      Jan: 'paid',
      Feb: 'paid',
      Mar: 'pending',
      Apr: 'pending',
      May: 'pending',
    },
  },
];

// Helper to get effective monthly status map for a given academic year
export function getEffectiveMonthlyStatus(
  student: StudentRecord,
  activeYear?: string
): Record<AcademicMonth, PaymentStatus> {
  if (activeYear && student.yearlyStatus && student.yearlyStatus[activeYear]) {
    return student.yearlyStatus[activeYear];
  }
  return student.monthlyStatus;
}

// Helper to get effective monthly fee amounts paid map for a given academic year
export function getEffectiveMonthlyAmounts(
  student: StudentRecord,
  activeYear?: string
): Partial<Record<AcademicMonth, number>> {
  if (activeYear && student.yearlyAmountsPaid && student.yearlyAmountsPaid[activeYear]) {
    return student.yearlyAmountsPaid[activeYear];
  }
  return student.monthlyAmountsPaid || {};
}

// Helper to get effective paid amount for a single month
export function getStudentMonthPaidAmount(
  student: StudentRecord,
  month: AcademicMonth,
  activeYear?: string
): number {
  const amounts = getEffectiveMonthlyAmounts(student, activeYear);
  if (amounts[month] !== undefined && amounts[month] !== null) {
    return Number(amounts[month]);
  }
  const statusMap = getEffectiveMonthlyStatus(student, activeYear);
  const status = statusMap[month] || 'pending';
  const effectiveFee = Math.max(0, student.monthlyFee - student.discount);
  if (status === 'paid') return effectiveFee;
  if (status === 'partial') return Math.round(effectiveFee / 2);
  return 0;
}

// Helper to calculate total received, pending, and overall balances strictly based on M. FEE
export function calculateStudentTotals(
  student: StudentRecord,
  upToMonthIndex: number = 8,
  activeYear?: string
) {
  let totalBilled = 0;
  let totalReceived = 0;
  const statusMap = getEffectiveMonthlyStatus(student, activeYear);
  const amountsMap = getEffectiveMonthlyAmounts(student, activeYear);

  // Determine evaluation bound: evaluate up to the active month index (inclusive)
  const maxIndex =
    upToMonthIndex < 0 || upToMonthIndex >= ACADEMIC_MONTHS.length
      ? ACADEMIC_MONTHS.length - 1
      : upToMonthIndex;

  for (let i = 0; i <= maxIndex; i++) {
    const month = ACADEMIC_MONTHS[i];
    const effectiveFee = Math.max(0, student.monthlyFee - student.discount);
    totalBilled += effectiveFee;

    if (amountsMap[month] !== undefined && amountsMap[month] !== null) {
      totalReceived += Number(amountsMap[month]);
    } else {
      const status = statusMap[month] || 'pending';
      if (status === 'paid') {
        totalReceived += effectiveFee;
      } else if (status === 'partial') {
        totalReceived += Math.round(effectiveFee / 2);
      }
    }
  }

  const totalOutstanding = Math.max(0, totalBilled - totalReceived);

  // Calculate overdue months count (pending or partial up to current month index)
  let overdueMonthsCount = 0;
  for (let i = 0; i <= maxIndex; i++) {
    const m = ACADEMIC_MONTHS[i];
    const status = statusMap[m] || 'pending';
    if (status === 'pending' || status === 'partial') {
      overdueMonthsCount++;
    }
  }

  return {
    totalBilled,
    totalReceived,
    totalCollected: totalReceived,
    totalOutstanding,
    totalDue: totalOutstanding,
    overdueMonthsCount,
  };
}

// Format phone number for display (e.g. +92 300 1234567)
export function formatPhoneDisplay(rawNumber: string): string {
  const clean = rawNumber.replace(/[^0-9]/g, '');
  if (clean.length === 12 && clean.startsWith('92')) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
  }
  if (clean.length === 11 && clean.startsWith('0')) {
    return `+92 ${clean.slice(1, 4)} ${clean.slice(4)}`;
  }
  return `+${clean}`;
}

// Generate the WhatsApp URL based on prompt specification:
// "Dear [Father Name], the fee for [Student Name] (Class: [Class]) for [Month] is pending. Total Outstanding: Rs. [Amount]. Please clear it at your earliest."
export function generateWhatsAppLink(
  student: StudentRecord,
  activeMonth: AcademicMonth = 'Feb',
  customOutstanding?: number,
  activeYear?: string
): { url: string; message: string; cleanNumber: string } {
  const totals = calculateStudentTotals(student, 8, activeYear);
  const outstanding = customOutstanding !== undefined ? customOutstanding : totals.totalOutstanding;

  // Clean phone number: remove non-digits, leading +, etc.
  let cleanNumber = student.contactNo.replace(/[^0-9]/g, '');
  if (cleanNumber.startsWith('0')) {
    cleanNumber = '92' + cleanNumber.substring(1);
  }

  const message = `Dear ${student.fatherName}, the fee for ${student.studentName} (Class: ${student.className}) for ${activeMonth} is pending. Total Outstanding: Rs. ${outstanding.toLocaleString()}. Please clear it at your earliest.`;

  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;

  return { url, message, cleanNumber };
}

// Format S# manually assigned to student (standard 3-digit format like 001, 002)
export function formatSerialNo(val?: string | number, fallbackIndex?: number): string {
  if (typeof val === 'string' && val.trim().length > 0) {
    const trimmed = val.trim();
    if (/^\d+$/.test(trimmed)) {
      return trimmed.padStart(3, '0');
    }
    return trimmed;
  }
  if (typeof val === 'number') {
    return String(val).padStart(3, '0');
  }
  if (typeof fallbackIndex === 'number') {
    return String(fallbackIndex).padStart(3, '0');
  }
  return '001';
}
