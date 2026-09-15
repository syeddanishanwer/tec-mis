import * as XLSX from 'xlsx';
import { StudentRecord, SchoolClass, AcademicMonth, ACADEMIC_MONTHS, PaymentStatus } from '../types';
import { ALL_CLASSES, formatSerialNo } from '../data/mockStudents';

export interface ParsedImportRow {
  rowNumber: number;
  serialNo: string;
  className: SchoolClass;
  rollNo: string;
  studentName: string;
  fatherName: string;
  contactNo: string;
  monthlyFee: number;
  discount: number;
  monthlyAmounts: Record<AcademicMonth, number>;
  monthlyStatuses: Record<AcademicMonth, PaymentStatus>;
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

/**
 * Normalizes any variation of class name to standard SchoolClass
 */
export function normalizeClassName(rawClass: any): SchoolClass {
  if (!rawClass) return 'Class I';
  const str = String(rawClass).trim().toLowerCase();

  if (str.includes('rec') || str.includes('nur') || str.includes('kg')) return 'Reception';
  if (str.includes('jun') || str.includes('prep')) return 'Junior';
  if (str.includes('sen') || str.includes('kg 2')) return 'Senior';

  // Roman / Numeric matches
  if (str === '1' || str === 'i' || str === 'class 1' || str === 'class i' || str === 'grade 1') return 'Class I';
  if (str === '2' || str === 'ii' || str === 'class 2' || str === 'class ii' || str === 'grade 2') return 'Class II';
  if (str === '3' || str === 'iii' || str === 'class 3' || str === 'class iii' || str === 'grade 3') return 'Class III';
  if (str === '4' || str === 'iv' || str === 'class 4' || str === 'class iv' || str === 'grade 4') return 'Class IV';
  if (str === '5' || str === 'v' || str === 'class 5' || str === 'class v' || str === 'grade 5') return 'Class V';
  if (str === '6' || str === 'vi' || str === 'class 6' || str === 'class vi' || str === 'grade 6') return 'Class VI';
  if (str === '7' || str === 'vii' || str === 'class 7' || str === 'class vii' || str === 'grade 7') return 'Class VII';
  if (str === '8' || str === 'viii' || str === 'class 8' || str === 'class viii' || str === 'grade 8') return 'Class VIII';
  if (str === '9' || str === 'ix' || str === 'class 9' || str === 'class ix' || str === 'grade 9') return 'Class IX';
  if (str === '10' || str === 'x' || str === 'class 10' || str === 'class x' || str === 'grade 10') return 'Class X';

  // Try matching directly from ALL_CLASSES
  const match = ALL_CLASSES.find((c) => c.toLowerCase() === str);
  if (match) return match;

  return 'Class I';
}

/**
 * Normalizes raw contact number to standard 12-digit 923... or cleaned digits
 */
export function normalizeContactNumber(rawPhone: any): string {
  if (!rawPhone) return '923001234567';
  let cleaned = String(rawPhone).replace(/[^0-9]/g, '');

  if (cleaned.startsWith('03') && cleaned.length === 11) {
    cleaned = '92' + cleaned.slice(1);
  } else if (cleaned.length === 10 && cleaned.startsWith('3')) {
    cleaned = '92' + cleaned;
  } else if (!cleaned.startsWith('92') && cleaned.length >= 10) {
    cleaned = '92' + cleaned.slice(-10);
  }

  return cleaned || '923001234567';
}

/**
 * Parse an Excel or CSV file buffer into structured rows
 */
export async function parseExcelOrCsvFile(
  file: File,
  targetAcademicYear: string = '2026-2027',
  startingSerialIndex: number = 1
): Promise<ImportParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded file has no sheets or is empty.');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to 2D array to inspect headers and data
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rawRows.length === 0) {
    throw new Error('No data found in the spreadsheet.');
  }

  // Find header row (look for row containing "student", "roll", "class", or "s#")
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

  // Helper to find column index by candidate names
  const findCol = (...candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headerLower.findIndex((h) => h === c || h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const sNoCol = findCol('s#', 'serial', 's.no', 'sr#', 'sr no', 's no');
  const classCol = findCol('class', 'grade');
  const rollCol = findCol('roll no', 'roll', 'reg no', 'admission no');
  const studentNameCol = findCol('student name', 'student', 'name', 'full name');
  const fatherNameCol = findCol('father name', 'father', 'parent', 'guardian');
  const phoneCol = findCol('contact no (phone)', 'contact no', 'phone', 'contact', 'mobile', 'whatsapp');
  const feeCol = findCol('monthly fee (pkr)', 'monthly fee', 'm. fee', 'm.fee', 'fee (pkr)', 'fee');

  // Month columns
  const monthCols: Record<AcademicMonth, number> = {
    Jun: -1,
    Jul: -1,
    Aug: -1,
    Sep: -1,
    Oct: -1,
    Nov: -1,
    Dec: -1,
    Jan: -1,
    Feb: -1,
    Mar: -1,
    Apr: -1,
    May: -1,
  };

  const monthMap: Record<AcademicMonth, string[]> = {
    Jun: ['jun', 'june'],
    Jul: ['jul', 'july'],
    Aug: ['aug', 'august'],
    Sep: ['sep', 'sept', 'september'],
    Oct: ['oct', 'october'],
    Nov: ['nov', 'november'],
    Dec: ['dec', 'december'],
    Jan: ['jan', 'january'],
    Feb: ['feb', 'february'],
    Mar: ['mar', 'march'],
    Apr: ['apr', 'april'],
    May: ['may'],
  };

  ACADEMIC_MONTHS.forEach((m) => {
    const candidates = monthMap[m];
    for (let c = 0; c < headerLower.length; c++) {
      const headerText = headerLower[c].trim();
      if (candidates.some((prefix) => headerText === prefix || headerText.startsWith(prefix))) {
        monthCols[m] = c;
        break;
      }
    }
  });

  const validRows: ParsedImportRow[] = [];
  const invalidRows: ParsedImportRow[] = [];
  const globalWarnings: string[] = [];

  if (studentNameCol === -1) {
    globalWarnings.push('Could not find a "Student Name" column. Defaulting to column 3.');
  }

  // Iterate over data rows
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0 || row.every((c) => String(c).trim() === '')) {
      continue; // Skip empty rows
    }

    const rowNumber = r + 1;
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. S#
    let rawSerial = sNoCol !== -1 ? String(row[sNoCol] || '').trim() : '';
    const serialNo = formatSerialNo(rawSerial, startingSerialIndex + validRows.length);

    // 2. Class
    const rawClass = classCol !== -1 ? row[classCol] : '';
    const className = normalizeClassName(rawClass);

    // 3. Roll No
    let rollNo = rollCol !== -1 ? String(row[rollCol] || '').trim() : '';
    if (!rollNo) {
      rollNo = `ETC-${1000 + startingSerialIndex + validRows.length}`;
      warnings.push(`Auto-generated Roll No: ${rollNo}`);
    }

    // 4. Student Name
    let studentName = studentNameCol !== -1 ? String(row[studentNameCol] || '').trim() : '';
    if (!studentName && row[3]) {
      studentName = String(row[3]).trim();
    }
    if (!studentName) {
      errors.push('Student Name is required.');
    }

    // 5. Father Name
    let fatherName = fatherNameCol !== -1 ? String(row[fatherNameCol] || '').trim() : '';
    if (!fatherName) {
      fatherName = 'Guardian';
      warnings.push("Father's Name missing; defaulted to Guardian");
    }

    // 6. Contact No
    const rawPhone = phoneCol !== -1 ? row[phoneCol] : '';
    const contactNo = normalizeContactNumber(rawPhone);

    // 7. Monthly Fee (PKR)
    let rawFee = feeCol !== -1 ? String(row[feeCol] || '').trim() : '';
    let monthlyFee = 5000;
    if (rawFee) {
      const cleanFee = rawFee.replace(/[^0-9.]/g, '');
      const parsedFee = parseFloat(cleanFee);
      if (!isNaN(parsedFee) && parsedFee >= 0) {
        monthlyFee = Math.round(parsedFee);
      } else {
        warnings.push(`Invalid fee "${rawFee}"; defaulted to 5000`);
      }
    }

    // 8. Monthly Fee Amounts and Statuses for Jun through May
    const monthlyAmounts: Record<AcademicMonth, number> = {
      Jun: 0,
      Jul: 0,
      Aug: 0,
      Sep: 0,
      Oct: 0,
      Nov: 0,
      Dec: 0,
      Jan: 0,
      Feb: 0,
      Mar: 0,
      Apr: 0,
      May: 0,
    };

    const monthlyStatuses: Record<AcademicMonth, PaymentStatus> = {
      Jun: 'pending',
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
    };

    ACADEMIC_MONTHS.forEach((m) => {
      const colIdx = monthCols[m];
      if (colIdx !== -1 && row[colIdx] !== undefined && row[colIdx] !== null && String(row[colIdx]).trim() !== '') {
        const rawVal = row[colIdx];

        if (typeof rawVal === 'number') {
          const amt = Math.max(0, Math.round(rawVal));
          monthlyAmounts[m] = amt;
          if (amt >= monthlyFee) {
            monthlyStatuses[m] = 'paid';
          } else if (amt > 0) {
            monthlyStatuses[m] = 'partial';
          } else {
            monthlyStatuses[m] = 'pending';
          }
        } else {
          const strVal = String(rawVal).trim();
          const cleanDigits = strVal.replace(/[^0-9.]/g, '');

          if (cleanDigits.length > 0 && !isNaN(parseFloat(cleanDigits))) {
            const amt = Math.max(0, Math.round(parseFloat(cleanDigits)));
            monthlyAmounts[m] = amt;
            if (amt >= monthlyFee) {
              monthlyStatuses[m] = 'paid';
            } else if (amt > 0) {
              monthlyStatuses[m] = 'partial';
            } else {
              monthlyStatuses[m] = 'pending';
            }
          } else {
            const upper = strVal.toUpperCase();
            if (upper.includes('PAID') || upper === 'P' || upper === 'YES' || upper === 'DONE' || upper === 'CLEARED') {
              monthlyAmounts[m] = monthlyFee;
              monthlyStatuses[m] = 'paid';
            } else if (upper.includes('PARTIAL') || upper.includes('HALF')) {
              monthlyAmounts[m] = Math.round(monthlyFee / 2);
              monthlyStatuses[m] = 'partial';
            } else {
              monthlyAmounts[m] = 0;
              monthlyStatuses[m] = 'pending';
            }
          }
        }
      } else {
        monthlyAmounts[m] = 0;
        monthlyStatuses[m] = 'pending';
      }
    });

    const parsedRow: ParsedImportRow = {
      rowNumber,
      serialNo,
      className,
      rollNo,
      studentName,
      fatherName,
      contactNo,
      monthlyFee,
      discount: 0,
      monthlyAmounts,
      monthlyStatuses,
      isValid: errors.length === 0,
      warnings,
      errors,
    };

    if (parsedRow.isValid) {
      validRows.push(parsedRow);
    } else {
      invalidRows.push(parsedRow);
    }
  }

  return {
    fileName: file.name,
    totalRowsFound: validRows.length + invalidRows.length,
    validRows,
    invalidRows,
    warnings: globalWarnings,
  };
}

/**
 * Downloads a sample Excel file formatted with the exact columns requested:
 * S# | Class | Roll No | Student Name | Father Name | Contact No (Phone) | Monthly Fee (PKR) | Jun..May (fees in amounts)
 */
export function downloadSampleImportTemplate(): void {
  const headers = [
    'S#',
    'Class',
    'Roll No',
    'Student Name',
    'Father Name',
    'Contact No (Phone)',
    'Monthly Fee (PKR)',
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
  ];

  const sampleRows = [
    [
      '001',
      'Class X',
      'ETC-1001',
      'Muhammad Hamza',
      'Tariq Mehmood',
      '03001234567',
      6500,
      6500,
      6500,
      6500,
      6500,
      6500,
      6500,
      3250,
      0,
      0,
      0,
      0,
      0,
    ],
    [
      '002',
      'Class IX',
      'ETC-1002',
      'Ayesha Fatima',
      'Nadeem Akhtar',
      '03219876543',
      6000,
      6000,
      6000,
      6000,
      6000,
      6000,
      6000,
      6000,
      6000,
      0,
      0,
      0,
      0,
    ],
    [
      '003',
      'Class VIII',
      'ETC-1003',
      'Zain Ul Abideen',
      'Ghulam Rasool',
      '03335557788',
      5500,
      5500,
      5500,
      5500,
      5500,
      5500,
      5500,
      5500,
      2750,
      0,
      0,
      0,
      0,
    ],
    [
      '004',
      'Class VII',
      'ETC-1004',
      'Fatima Zahra',
      'Dr. Shakeel Ahmed',
      '03451122334',
      5500,
      5500,
      5500,
      5500,
      5500,
      5500,
      5500,
      5500,
      5500,
      0,
      0,
      0,
      0,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  ws['!cols'] = [
    { wch: 8 },  // S#
    { wch: 14 }, // Class
    { wch: 12 }, // Roll No
    { wch: 22 }, // Student Name
    { wch: 22 }, // Father Name
    { wch: 20 }, // Contact No (Phone)
    { wch: 18 }, // Monthly Fee (PKR)
    { wch: 10 }, // Jun
    { wch: 10 }, // Jul
    { wch: 10 }, // Aug
    { wch: 10 }, // Sep
    { wch: 10 }, // Oct
    { wch: 10 }, // Nov
    { wch: 10 }, // Dec
    { wch: 10 }, // Jan
    { wch: 10 }, // Feb
    { wch: 10 }, // Mar
    { wch: 10 }, // Apr
    { wch: 10 }, // May
  ];

  // Explicit string formatting for S# and Phone columns to preserve leading zeros
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let r = 1; r <= range.e.r; ++r) {
    const sNoCell = XLSX.utils.encode_cell({ c: 0, r });
    if (ws[sNoCell]) {
      ws[sNoCell].t = 's';
      ws[sNoCell].z = '@';
    }
    const phoneCell = XLSX.utils.encode_cell({ c: 5, r });
    if (ws[phoneCell]) {
      ws[phoneCell].t = 's';
      ws[phoneCell].z = '@';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student Fee Ledger');
  XLSX.writeFile(wb, 'Student_Fee_Import_Template.xlsx');
}
