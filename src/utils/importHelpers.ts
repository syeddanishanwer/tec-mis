import * as XLSX from 'xlsx';
import { StudentRecord, SchoolClass, AcademicMonth, ACADEMIC_MONTHS, PaymentStatus, FeeSchedule, Invoice } from '../types';

export const ALL_CLASSES: SchoolClass[] = [
  'Reception', 'Junior', 'Senior',
  'Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
  'Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X'
];

export function formatSerialNo(serialNo?: string, fallbackId?: number): string {
  if (serialNo) return String(serialNo).trim().padStart(3, '0');
  if (fallbackId) return String(fallbackId).padStart(3, '0');
  return '001';
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
    return allowEmpty? undefined : '923001234567';
  }
  let cleaned = String(rawPhone).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('03') && cleaned.length === 11) cleaned = '92' + cleaned.slice(1);
  else if (cleaned.length === 10 && cleaned.startsWith('3')) cleaned = '92' + cleaned;
  else if (!cleaned.startsWith('92') && cleaned.length >= 10) cleaned = '92' + cleaned.slice(-10);
  return cleaned || (allowEmpty? undefined : '923001234567');
}

function parseFeeChangeSlot(
  monthlyFee: number,
  rawFee: any,
  rawMonth: any,
  slotNumber: number,
  warnings: string[],
  errors: string[]
): FeeChange | null {
  const feeStr = rawFee!== undefined && rawFee!== null? String(rawFee).trim() : '';
  const monthStr = rawMonth!== undefined && rawMonth!== null? String(rawMonth).trim() : '';
  const feeFilled = feeStr!== '';
  const monthFilled = monthStr!== '';
  if (!feeFilled &&!monthFilled) return null;
  if (feeFilled!== monthFilled) {
    errors.push(`Fee Change Slot ${slotNumber}: both "New Fee ${slotNumber}" and "Effective From ${slotNumber}" must be filled together.`);
    return null;
  }
  const cleanFee = feeStr.replace(/[^0-9.]/g, '');
  const parsedFee = parseFloat(cleanFee);
  if (isNaN(parsedFee) || parsedFee < 0) {
    errors.push(`Fee Change Slot ${slotNumber}: invalid fee "${feeStr}".`);
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
    errors.push(`Fee Change Slot ${slotNumber}: "${monthStr}" is not a valid month. Use Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar, Apr, May.`);
    return null;
  }
  return { newFee: roundedFee, effectiveFromMonth: matchedMonth };
}

function validateFeeChangeSequence(slots: (FeeChange | null)[], errors: string[]): FeeChange[] {
  let sawBlank = false;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === null) sawBlank = true;
    else if (sawBlank) errors.push(`Fee Change Slot ${i + 1} is filled but earlier slot blank. Fill in order 1,2,3.`);
  }
  const filled = slots.filter((s): s is FeeChange => s!== null);
  for (let i = 1; i < filled.length; i++) {
    const prevIdx = ACADEMIC_MONTHS.indexOf(filled[i - 1].effectiveFromMonth);
    const currIdx = ACADEMIC_MONTHS.indexOf(filled[i].effectiveFromMonth);
    if (currIdx === prevIdx) errors.push(`Duplicate month: ${filled[i].effectiveFromMonth}`);
    else if (currIdx < prevIdx) errors.push(`Must be chronological: ${filled[i].effectiveFromMonth} comes before ${filled[i - 1].effectiveFromMonth}`);
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
  if (rawRows.length === 0) throw new Error('No data found.');

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const rowStr = rawRows[i].map((c) => String(c).toLowerCase()).join(' ');
    if (rowStr.includes('student') || rowStr.includes('roll') || rowStr.includes('class') || rowStr.includes('fee')) { headerRowIndex = i; break; }
  }

  const headers = rawRows[headerRowIndex].map((h) => String(h || '').trim());
  const headerLower = headers.map((h) => h.toLowerCase());
  const findCol = (...candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headerLower.findIndex((h) => h === c || h.includes(c));
      if (idx!== -1) return idx;
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
  const globalWarnings: string[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.every((c) => String(c).trim() === '')) continue;

    const rowNumber = r + 1;
    const warnings: string[] = [];
    const errors: string[] = [];

    let rawSerial = sNoCol!== -1? String(row[sNoCol] || '').trim() : '';
    const serialNo = formatSerialNo(rawSerial, startingSerialIndex + validRows.length);
    const className = normalizeClassName(classCol!== -1? row[classCol] : '');
    let rollNo = rollCol!== -1? String(row[rollCol] || '').trim() : '';
    if (!rollNo) { rollNo = `ETC-${1000 + startingSerialIndex + validRows.length}`; warnings.push(`Auto Roll No: ${rollNo}`); }
    let studentName = studentNameCol!== -1? String(row[studentNameCol] || '').trim() : String(row[3] || '').trim();
    if (!studentName) errors.push('Student Name required.');
    let fatherName = fatherNameCol!== -1? String(row[fatherNameCol] || '').trim() : '';
    if (!fatherName) { fatherName = 'Guardian'; warnings.push("Father missing -> Guardian"); }

    const contactNo = normalizeContactNumber(phoneCol!== -1? row[phoneCol] : '', false) as string;
    const contactNo2 = normalizeContactNumber(phoneCol2!== -1? row[phoneCol2] : '', true);

    let rawFee = feeCol!== -1? String(row[feeCol] || '').trim() : '';
    let monthlyFee = 5000;
    if (rawFee) {
      const parsed = parseFloat(rawFee.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed >= 0) monthlyFee = Math.round(parsed);
    }

    const slot1 = parseFeeChangeSlot(monthlyFee, newFeeCol1!== -1? row[newFeeCol1] : '', effFromCol1!== -1? row[effFromCol1] : '', 1, warnings, errors);
    const slot2 = parseFeeChangeSlot(monthlyFee, newFeeCol2!== -1? row[newFeeCol2] : '', effFromCol2!== -1? row[effFromCol2] : '', 2, warnings, errors);
    const slot3 = parseFeeChangeSlot(monthlyFee, newFeeCol3!== -1? row[newFeeCol3] : '', effFromCol3!== -1? row[effFromCol3] : '', 3, warnings, errors);
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

    // FIXED: First pass - parse raw Excel values
    ACADEMIC_MONTHS.forEach((m) => {
      const colIdx = monthCols[m];
      const expectedFee = feeForMonth(m);
      if (colIdx!== -1 && row[colIdx]!== undefined && String(row[colIdx]).trim()!== '') {
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
          monthlyStatuses[m] = amt >= expectedFee && expectedFee > 0? 'paid' : amt > 0? 'partial' : 'unpaid';
        } else {
          const cleanDigits = rawVal.replace(/[^0-9.]/g, '');
          if (cleanDigits.length > 0 &&!isNaN(parseFloat(cleanDigits))) {
            const amt = Math.max(0, Math.round(parseFloat(cleanDigits)));
            monthlyAmounts[m] = amt;
            monthlyStatuses[m] = amt >= expectedFee && expectedFee > 0? 'paid' : amt > 0? 'partial' : 'unpaid';
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

   // FIXED: Second pass - auto-fill NEW ADMISSION - TS safe with type assertion
    let admissionIdx = 0;
    for (let i = 0; i < ACADEMIC_MONTHS.length; i++) {
      const m = ACADEMIC_MONTHS[i];
      const status = monthlyStatuses[m] as PaymentStatus;
      const isNewAdmission = (status as string) === 'new_admission';

      if (!isNewAdmission && (monthlyAmounts[m] > 0 || i === 0)) {
        if (i > 0 && status === 'unpaid' && monthlyAmounts[m] === 0) {
          const hasLaterPaid = ACADEMIC_MONTHS.slice(i).some(mm => {
            const s = monthlyStatuses[mm] as PaymentStatus;
            return monthlyAmounts[mm] > 0 || s === 'paid' || s === 'partial';
          });
          const hasExplicitNewAdmissionBefore = ACADEMIC_MONTHS.slice(0, i).some(mm => {
            return (monthlyStatuses[mm] as string) === 'new_admission';
          });
          if (hasExplicitNewAdmissionBefore && hasLaterPaid) {
            monthlyStatuses[m] = 'new_admission' as PaymentStatus;
            continue;
          }
        }
        admissionIdx = i;
        break;
      }
      if (isNewAdmission) {
        admissionIdx = i + 1;
      }
    }
    // Force all months before admissionIdx to new_admission
    for (let i = 0; i < admissionIdx; i++) {
      const m = ACADEMIC_MONTHS[i];
      if ((monthlyStatuses[m] as string)!== 'new_admission') {
        monthlyStatuses[m] = 'new_admission' as PaymentStatus;
        monthlyAmounts[m] = 0;
      }
    }

    const admissionMonth = ACADEMIC_MONTHS[admissionIdx];
    const yearStart = parseInt(targetAcademicYear.split('-')[0]);
    const monthToNum: Record<string, number> = { Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11, Jan:0, Feb:1, Mar:2, Apr:3, May:4 };
    const jsMonth = monthToNum[admissionMonth];
    const admYear = jsMonth >=5? yearStart : yearStart+1;
    const admissionDate = `${admYear}-${String(jsMonth+1).padStart(2,'0')}-01`;

    const parsedRow: ParsedImportRow = {
      rowNumber, serialNo, className, rollNo, studentName, fatherName,
      contactNo, contactNo2, monthlyFee, discount: 0, feeChanges,
      monthlyAmounts, monthlyStatuses, admissionMonth, admissionDate,
      isValid: errors.length === 0, warnings, errors,
    };
    if (parsedRow.isValid) validRows.push(parsedRow); else invalidRows.push(parsedRow);
  }

  return { fileName: file.name, totalRowsFound: validRows.length + invalidRows.length, validRows, invalidRows, warnings: globalWarnings };
}

export function convertParsedRowToStudentRecord(row: ParsedImportRow, academicYear: string = '2026-2027'): any {
  const invoices = ACADEMIC_MONTHS.map(month => {
    const status = row.monthlyStatuses[month];
    const paidAmount = row.monthlyAmounts[month];
    const expectedFee = (() => {
      let fee = row.monthlyFee;
      for (const ch of row.feeChanges) {
        if (ACADEMIC_MONTHS.indexOf(ch.effectiveFromMonth) <= ACADEMIC_MONTHS.indexOf(month)) fee = ch.newFee;
      }
      return fee;
    })();

    return {
      month,
      academicYear,
      baseFee: expectedFee,
      concessionAmount: 0,
      netDue: status === 'new_admission'? 0 : expectedFee,
      paidAmount: status === 'new_admission'? 0 : paidAmount,
      status,
    };
  });

  const feeSchedules = [
    { monthlyFee: row.monthlyFee, effectiveFromMonth: 'Jun' as AcademicMonth },
  ...row.feeChanges.map(fc => ({ monthlyFee: fc.newFee, effectiveFromMonth: fc.effectiveFromMonth }))
  ];

  return {
    serialNo: row.serialNo,
    rollNo: row.rollNo,
    studentName: row.studentName,
    fatherName: row.fatherName,
    className: row.className,
    contactNo: row.contactNo,
    contactNo2: row.contactNo2,
    monthlyFee: row.monthlyFee,
    discount: row.discount, 
    academicYear,
    admissionDate: row.admissionDate,
    admissionMonth: row.admissionMonth,
    feeChanges: row.feeChanges,
    monthlyAmountsPaid: row.monthlyAmounts,
    invoices,
    feeSchedules,
  };
}

export function downloadSampleImportTemplate(): void {
  const headers = [
    'S#', 'Class', 'Roll No', 'Student Name', 'Father Name', 'Contact No 1 (Phone)', 'Contact No 2 (Phone)',
    'Monthly Fee (PKR)', 'New Fee 1', 'Effective From 1', 'New Fee 2', 'Effective From 2', 'New Fee 3', 'Effective From 3',
    'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May',
  ];
  const sampleRows = [
    ['001', 'Class X', 'ETC-1001', 'Muhammad Hamza', 'Tariq Mehmood', '03001234567', '', 6000, 6500, 'Sep', 7000, 'Nov', '', '', 'NEW ADMISSION', 'NEW ADMISSION', 'NEW ADMISSION', 6500, 6500, 7000, 7000, 7000, 7000],
    ['002', 'Class IX', 'ETC-1002', 'Ayesha Fatima', 'Nadeem Akhtar', '03219876543', '03211234567', 6000, '', '', '', '', '', '', 6000, 6000, 6000, 6000, 0, 0, 0, 0, 0, 0, 0, 0],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers,...sampleRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student Fee Ledger');
  XLSX.writeFile(wb, 'Student_Fee_Import_Template.xlsx');
}