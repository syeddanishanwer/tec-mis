import * as XLSX from 'xlsx';
import { StudentRecord, SchoolClass, AcademicMonth, ACADEMIC_MONTHS, PaymentStatus } from '../types';

export const ALL_CLASSES: SchoolClass[] = [
  'Reception', 'Junior', 'Senior',
  'Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
  'Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X'
];

export function formatSerialNo(serialNo?: string, fallbackId?: number): string {
  if (serialNo && String(serialNo).trim() !== '') {
    return String(serialNo).trim().padStart(3, '0');
  }
  if (fallbackId !== undefined && fallbackId !== null) {
    return String(fallbackId).padStart(3, '0');
  }
  return '';
}

export interface FeeChange {
  newFee: number;
  effectiveFromMonth: AcademicMonth;
}

export interface ParsedImportRow {
  rowNumber: number;
  serialNo: string;
  className: SchoolClass;
  rollNo: string;
  studentName: string;
  fatherName: string;
  contactNo: string;
  contactNo2?: string;
  monthlyFee: number;
  discount: number;
  feeChanges: FeeChange[];
  monthlyAmounts: Record<AcademicMonth, number>;
  monthlyStatuses: Record<AcademicMonth, PaymentStatus>;
  admissionMonth: AcademicMonth;
  admissionDate: string;
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export interface ImportParseResult {
  fileName: string;
  totalRowsFound: number;
  validRows: ParsedImportRow[];
  invalidRows: ParsedImportRow[];
  warnings: string[];
}

export function normalizeClassName(rawClass: any): SchoolClass {
  if (!rawClass) return 'Class I';
  const str = String(rawClass).trim().toLowerCase();
  if (str.includes('rec') || str.includes('nur') || str.includes('kg')) return 'Reception';
  if (str.includes('jun') || str.includes('prep')) return 'Junior';
  if (str.includes('sen') || str.includes('kg 2')) return 'Senior';
  if (str === '1' || str === 'i' || str.includes('class 1') || str.includes('grade 1')) return 'Class I';
  if (str === '2' || str === 'ii' || str.includes('class 2') || str.includes('grade 2')) return 'Class II';
  if (str === '3' || str === 'iii' || str.includes('class 3') || str.includes('grade 3')) return 'Class III';
  if (str === '4' || str === 'iv' || str.includes('class 4') || str.includes('grade 4')) return 'Class IV';
  if (str === '5' || str === 'v' || str.includes('class 5') || str.includes('grade 5')) return 'Class V';
  if (str === '6' || str === 'vi' || str.includes('class 6') || str.includes('grade 6')) return 'Class VI';
  if (str === '7' || str === 'vii' || str.includes('class 7') || str.includes('grade 7')) return 'Class VII';
  if (str === '8' || str === 'viii' || str.includes('class 8') || str.includes('grade 8')) return 'Class VIII';
  if (str === '9' || str === 'ix' || str.includes('class 9') || str.includes('grade 9')) return 'Class IX';
  if (str === '10' || str === 'x' || str.includes('class 10') || str.includes('grade 10')) return 'Class X';
  const match = ALL_CLASSES.find((c) => c.toLowerCase() === str);
  return match || 'Class I';
}

export function normalizeContactNumber(rawPhone: any, allowEmpty = false): string | undefined {
  if (!rawPhone || String(rawPhone).trim() === '') {
    return allowEmpty ? undefined : '';
  }
  let cleaned = String(rawPhone).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('03') && cleaned.length === 11) cleaned = '92' + cleaned.slice(1);
  else if (cleaned.length === 10 && cleaned.startsWith('3')) cleaned = '92' + cleaned;
  else if (!cleaned.startsWith('92') && cleaned.length >= 10) cleaned = '92' + cleaned.slice(-10);
  
  if (!cleaned) return allowEmpty ? undefined : '';
  return cleaned;
}

function parseFeeChangeSlot(
  monthlyFee: number,
  rawFee: any,
  rawMonth: any,
  slotNumber: number,
  warnings: string[],
  errors: string[]
): FeeChange | null {
  const feeStr = rawFee !== undefined && rawFee !== null ? String(rawFee).trim() : '';
  const monthStr = rawMonth !== undefined && rawMonth !== null ? String(rawMonth).trim() : '';
  const feeFilled = feeStr !== '';
  const monthFilled = monthStr !== '';
  
  if (!feeFilled && !monthFilled) return null;
  if (feeFilled !== monthFilled) {
    errors.push(`Fee Change Slot ${slotNumber}: both fee and effective month must be provided together.`);
    return null;
  }
  const cleanFee = feeStr.replace(/[^0-9.]/g, '');
  const parsedFee = parseFloat(cleanFee);
  if (isNaN(parsedFee) || parsedFee < 0) {
    errors.push(`Fee Change Slot ${slotNumber}: invalid fee amount "${feeStr}".`);
    return null;
  }
  const roundedFee = Math.round(parsedFee);
  if (roundedFee === monthlyFee) return null;

  const monthLower = monthStr.toLowerCase();
  const monthAliasMap: Record<string, AcademicMonth> = {
    jun: 'Jun', june: 'Jun', jul: 'Jul', july: 'Jul', aug: 'Aug', august: 'Aug',
    sep: 'Sep', sept: 'Sep', september: 'Sep', oct: 'Oct', october: 'Oct',
    nov: 'Nov', november: 'Nov', dec: 'Dec', december: 'Dec',
    jan: 'Jan', january: 'Jan', feb: 'Feb', february: 'Feb',
    mar: 'Mar', march: 'Mar', apr: 'Apr', april: 'Apr', may: 'May',
  };
  const matchedMonth = monthAliasMap[monthLower];
  if (!matchedMonth) {
    errors.push(`Fee Change Slot ${slotNumber}: "${monthStr}" is not a valid academic month.`);
    return null;
  }
  return { newFee: roundedFee, effectiveFromMonth: matchedMonth };
}

function validateFeeChangeSequence(slots: (FeeChange | null)[], errors: string[]): FeeChange[] {
  let sawBlank = false;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === null) sawBlank = true;
    else if (sawBlank) errors.push(`Fee Change Slot ${i + 1} filled out of sequential order.`);
  }
  const filled = slots.filter((s): s is FeeChange => s !== null);
  for (let i = 1; i < filled.length; i++) {
    const prevIdx = ACADEMIC_MONTHS.indexOf(filled[i - 1].effectiveFromMonth);
    const currIdx = ACADEMIC_MONTHS.indexOf(filled[i].effectiveFromMonth);
    if (currIdx === prevIdx) errors.push(`Duplicate effective month: ${filled[i].effectiveFromMonth}`);
    else if (currIdx < prevIdx) errors.push(`Fee change dates must be in chronological order.`);
  }
  return filled;
}

export async function parseExcelOrCsvFile(
  file: File,
  targetAcademicYear: string = '2026-2027',
  startingSerialIndex: number = 1
): Promise<ImportParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) throw new Error('File has no sheets.');

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (rawRows.length === 0) throw new Error('No data found in file.');

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const rowStr = rawRows[i].map((c) => String(c).toLowerCase()).join(' ');
    if (rowStr.includes('student') || rowStr.includes('roll') || rowStr.includes('class') || rowStr.includes('fee')) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = rawRows[headerRowIndex].map((h) => String(h || '').trim());
  const headerLower = headers.map((h) => h.toLowerCase());
  const findCol = (...candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headerLower.findIndex((h) => h === c || h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const sNoCol = findCol('s#', 'serial', 's.no', 'sr#');
  const classCol = findCol('class', 'grade');
  const rollCol = findCol('roll no', 'roll', 'reg no', 'admission no');
  const studentNameCol = findCol('student name', 'student', 'full name');
  const fatherNameCol = findCol('father name', 'father', 'parent');
  const phoneCol = findCol('contact no 1 (phone)', 'contact no 1', 'contact 1', 'phone 1', 'contact no', 'phone', 'mobile');
  const phoneCol2 = findCol('contact no 2 (phone)', 'contact no 2', 'contact 2', 'phone 2');
  const feeCol = findCol('monthly fee (pkr)', 'monthly fee', 'm. fee', 'fee (pkr)', 'fee');
  const newFeeCol1 = findCol('new fee 1'); const effFromCol1 = findCol('effective from 1');
  const newFeeCol2 = findCol('new fee 2'); const effFromCol2 = findCol('effective from 2');
  const newFeeCol3 = findCol('new fee 3'); const effFromCol3 = findCol('effective from 3');

  const monthCols: Record<AcademicMonth, number> = { Jun: -1, Jul: -1, Aug: -1, Sep: -1, Oct: -1, Nov: -1, Dec: -1, Jan: -1, Feb: -1, Mar: -1, Apr: -1, May: -1 };
  const monthMap: Record<AcademicMonth, string[]> = {
    Jun: ['jun', 'june'], Jul: ['jul', 'july'], Aug: ['aug', 'august'], Sep: ['sep', 'sept', 'september'],
    Oct: ['oct', 'october'], Nov: ['nov', 'november'], Dec: ['dec', 'december'],
    Jan: ['jan', 'january'], Feb: ['feb', 'february'], Mar: ['mar', 'march'], Apr: ['apr', 'april'], May: ['may'],
  };

  ACADEMIC_MONTHS.forEach((m) => {
    const candidates = monthMap[m];
    for (let c = 0; c < headerLower.length; c++) {
      const ht = headerLower[c].trim();
      if (candidates.some((p) => ht === p || ht.startsWith(p))) { monthCols[m] = c; break; }
    }
  });

  const validRows: ParsedImportRow[] = [];
  const invalidRows: ParsedImportRow[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.every((c) => String(c).trim() === '')) continue;

    const rowNumber = r + 1;
    const warnings: string[] = [];
    const errors: string[] = [];

    const rawSerial = sNoCol !== -1 ? String(row[sNoCol] || '').trim() : '';
    const serialNo = formatSerialNo(rawSerial, startingSerialIndex + validRows.length);
    const className = normalizeClassName(classCol !== -1 ? row[classCol] : '');
    
    const rollNo = rollCol !== -1 ? String(row[rollCol] || '').trim() : '';
    if (!rollNo) errors.push('Roll No is required.');

    const studentName = studentNameCol !== -1 ? String(row[studentNameCol] || '').trim() : '';
    if (!studentName) errors.push('Student Name is required.');

    const fatherName = fatherNameCol !== -1 ? String(row[fatherNameCol] || '').trim() : '';
    if (!fatherName) errors.push('Father Name is required.');

    const contactNo = normalizeContactNumber(phoneCol !== -1 ? row[phoneCol] : '', false) || '';
    const contactNo2 = normalizeContactNumber(phoneCol2 !== -1 ? row[phoneCol2] : '', true);

    const rawFee = feeCol !== -1 ? String(row[feeCol] || '').trim() : '';
    let monthlyFee = 0;
    if (rawFee) {
      const parsed = parseFloat(rawFee.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed >= 0) monthlyFee = Math.round(parsed);
    }

    const slot1 = parseFeeChangeSlot(monthlyFee, newFeeCol1 !== -1 ? row[newFeeCol1] : '', effFromCol1 !== -1 ? row[effFromCol1] : '', 1, warnings, errors);
    const slot2 = parseFeeChangeSlot(monthlyFee, newFeeCol2 !== -1 ? row[newFeeCol2] : '', effFromCol2 !== -1 ? row[effFromCol2] : '', 2, warnings, errors);
    const slot3 = parseFeeChangeSlot(monthlyFee, newFeeCol3 !== -1 ? row[newFeeCol3] : '', effFromCol3 !== -1 ? row[effFromCol3] : '', 3, warnings, errors);
    const feeChanges = validateFeeChangeSequence([slot1, slot2, slot3], errors);

    const feeForMonth = (month: AcademicMonth): number => {
      const monthIdx = ACADEMIC_MONTHS.indexOf(month);
      let activeFee = monthlyFee;
      for (const change of feeChanges) {
        if (ACADEMIC_MONTHS.indexOf(change.effectiveFromMonth) <= monthIdx) activeFee = change.newFee;
      }
      return activeFee;
    };

    const monthlyAmounts: Record<AcademicMonth, number> = { Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0, Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0 };
    const monthlyStatuses: Record<AcademicMonth, PaymentStatus> = { Jun: 'unpaid', Jul: 'unpaid', Aug: 'unpaid', Sep: 'unpaid', Oct: 'unpaid', Nov: 'unpaid', Dec: 'unpaid', Jan: 'unpaid', Feb: 'unpaid', Mar: 'unpaid', Apr: 'unpaid', May: 'unpaid' };

    ACADEMIC_MONTHS.forEach((m) => {
      const colIdx = monthCols[m];
      const expectedFee = feeForMonth(m);
      if (colIdx !== -1 && row[colIdx] !== undefined && String(row[colIdx]).trim() !== '') {
        const rawVal = String(row[colIdx]).trim();
        const upper = rawVal.toUpperCase();
        if (upper.includes('NEW') && upper.includes('ADMISSION')) {
          monthlyStatuses[m] = 'new_admission';
          monthlyAmounts[m] = 0;
          return;
        }
        if (typeof row[colIdx] === 'number') {
          const amt = Math.max(0, Math.round(row[colIdx] as number));
          monthlyAmounts[m] = amt;
          monthlyStatuses[m] = amt >= expectedFee && expectedFee > 0 ? 'paid' : amt > 0 ? 'partial' : 'unpaid';
        } else {
          const cleanDigits = rawVal.replace(/[^0-9.]/g, '');
          if (cleanDigits.length > 0 && !isNaN(parseFloat(cleanDigits))) {
            const amt = Math.max(0, Math.round(parseFloat(cleanDigits)));
            monthlyAmounts[m] = amt;
            monthlyStatuses[m] = amt >= expectedFee && expectedFee > 0 ? 'paid' : amt > 0 ? 'partial' : 'unpaid';
          } else {
            if (upper.includes('PAID') || upper === 'P' || upper === 'YES' || upper === 'DONE') {
              monthlyAmounts[m] = expectedFee; monthlyStatuses[m] = 'paid';
            } else if (upper.includes('PARTIAL') || upper.includes('HALF')) {
              monthlyAmounts[m] = Math.round(expectedFee / 2); monthlyStatuses[m] = 'partial';
            } else {
              monthlyAmounts[m] = 0; monthlyStatuses[m] = 'unpaid';
            }
          }
        }
      } else {
        monthlyAmounts[m] = 0; monthlyStatuses[m] = 'unpaid';
      }
    });

    let admissionIdx = 0;
    for (let i = 0; i < ACADEMIC_MONTHS.length; i++) {
      const m = ACADEMIC_MONTHS[i];
      const status = monthlyStatuses[m];
      if (status === 'new_admission') {
        admissionIdx = i + 1;
      } else if (monthlyAmounts[m] > 0 || i === 0) {
        admissionIdx = i;
        break;
      }
    }

    for (let i = 0; i < admissionIdx; i++) {
      const m = ACADEMIC_MONTHS[i];
      monthlyStatuses[m] = 'new_admission';
      monthlyAmounts[m] = 0;
    }

    const admissionMonth = ACADEMIC_MONTHS[admissionIdx] || 'Jun';
    const yearStart = parseInt(targetAcademicYear.split('-')[0]) || 2026;
    const monthToNum: Record<string, number> = { Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11, Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4 };
    const jsMonth = monthToNum[admissionMonth] ?? 5;
    const admYear = jsMonth >= 5 ? yearStart : yearStart + 1;
    const admissionDate = `${admYear}-${String(jsMonth + 1).padStart(2, '0')}-01`;

    const parsedRow: ParsedImportRow = {
      rowNumber, serialNo, className, rollNo, studentName, fatherName,
      contactNo, contactNo2, monthlyFee, discount: 0, feeChanges,
      monthlyAmounts, monthlyStatuses, admissionMonth, admissionDate,
      isValid: errors.length === 0, warnings, errors,
    };

    if (parsedRow.isValid) validRows.push(parsedRow);
    else invalidRows.push(parsedRow);
  }

  return { fileName: file.name, totalRowsFound: validRows.length + invalidRows.length, validRows, invalidRows, warnings: [] };
}

export function convertParsedRowToStudentRecord(row: ParsedImportRow, academicYear: string = '2026-2027'): any {
  const invoices = ACADEMIC_MONTHS.map(month => {
    const status = row.monthlyStatuses[month] || 'unpaid';
    const paidAmount = Number(row.monthlyAmounts[month]) || 0;
    
    let expectedFee = Number(row.monthlyFee) || 0;
    for (const ch of row.feeChanges || []) {
      if (ACADEMIC_MONTHS.indexOf(ch.effectiveFromMonth) <= ACADEMIC_MONTHS.indexOf(month)) {
        expectedFee = Number(ch.newFee) || expectedFee;
      }
    }

    return {
      month,
      academicYear,
      baseFee: expectedFee,
      concessionAmount: 0,
      netDue: status === 'new_admission' ? 0 : expectedFee,
      paidAmount: status === 'new_admission' ? 0 : paidAmount,
      status,
      isWaived: false,
    };
  });

  const feeSchedules = [
    { monthlyFee: Number(row.monthlyFee) || 0, effectiveFromMonth: 'Jun' as AcademicMonth, academicYear },
    ...(row.feeChanges || []).map(fc => ({
      monthlyFee: Number(fc.newFee) || 0,
      effectiveFromMonth: fc.effectiveFromMonth,
      academicYear
    }))
  ];

  return {
    serialNo: row.serialNo,
    rollNo: row.rollNo,
    studentName: row.studentName,
    fatherName: row.fatherName,
    className: row.className,
    contactNo: row.contactNo,
    contactNo2: row.contactNo2 || null,
    monthlyFee: Number(row.monthlyFee) || 0,
    academicYear,
    admissionDate: row.admissionDate,
    admissionMonth: row.admissionMonth,
    feeSchedules,
    invoices,
  };
}

export function downloadSampleImportTemplate(): void {
  const headers = [
    'S#', 'Class', 'Roll No', 'Student Name', 'Father Name', 'Contact No 1 (Phone)', 'Contact No 2 (Phone)',
    'Monthly Fee (PKR)', 'New Fee 1', 'Effective From 1', 'New Fee 2', 'Effective From 2', 'New Fee 3', 'Effective From 3',
    'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student Fee Ledger');
  XLSX.writeFile(wb, 'Student_Fee_Import_Template.xlsx');
}