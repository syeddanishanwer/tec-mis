import * as XLSX from 'xlsx';
import { StudentRecord, SchoolClass, AcademicMonth, ACADEMIC_MONTHS, PaymentStatus } from '../types';
import { ALL_CLASSES, formatSerialNo } from '../data/mockStudents';

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
  feeChanges: FeeChange[]; // 0 to 3 entries, chronologically ordered
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

  const match = ALL_CLASSES.find((c) => c.toLowerCase() === str);
  if (match) return match;

  return 'Class I';
}

/**
 * Normalizes raw contact number to standard 12-digit 923... or cleaned digits.
 * Returns undefined if the input is empty (used for the optional second contact).
 */
export function normalizeContactNumber(rawPhone: any, allowEmpty = false): string | undefined {
  if (!rawPhone || String(rawPhone).trim() === '') {
    return allowEmpty ? undefined : '923001234567';
  }
  let cleaned = String(rawPhone).replace(/[^0-9]/g, '');

  if (cleaned.startsWith('03') && cleaned.length === 11) {
    cleaned = '92' + cleaned.slice(1);
  } else if (cleaned.length === 10 && cleaned.startsWith('3')) {
    cleaned = '92' + cleaned;
  } else if (!cleaned.startsWith('92') && cleaned.length >= 10) {
    cleaned = '92' + cleaned.slice(-10);
  }

  return cleaned || (allowEmpty ? undefined : '923001234567');
}

/**
 * Parses one fee-change slot's raw cell values into a validated FeeChange, or null if blank/unchanged.
 */
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

  if (!feeFilled && !monthFilled) {
    return null; // Slot genuinely unused — no change here
  }

  if (feeFilled !== monthFilled) {
    errors.push(
      `Fee Change Slot ${slotNumber}: both "New Fee ${slotNumber}" and "Effective From ${slotNumber}" must be filled in together, or both left blank.`
    );
    return null;
  }

  const cleanFee = feeStr.replace(/[^0-9.]/g, '');
  const parsedFee = parseFloat(cleanFee);
  if (isNaN(parsedFee) || parsedFee < 0) {
    errors.push(`Fee Change Slot ${slotNumber}: invalid fee amount "${feeStr}".`);
    return null;
  }

  const roundedFee = Math.round(parsedFee);

  // Skip slot if the new fee is identical to the base monthly fee
  if (roundedFee === monthlyFee) {
    return null;
  }

  // Match month name against ACADEMIC_MONTHS
  const monthLower = monthStr.toLowerCase();
  const monthAliasMap: Record<string, AcademicMonth> = {
    jun: 'Jun', june: 'Jun',
    jul: 'Jul', july: 'Jul',
    aug: 'Aug', august: 'Aug',
    sep: 'Sep', sept: 'Sep', september: 'Sep',
    oct: 'Oct', october: 'Oct',
    nov: 'Nov', november: 'Nov',
    dec: 'Dec', december: 'Dec',
    jan: 'Jan', january: 'Jan',
    feb: 'Feb', february: 'Feb',
    mar: 'Mar', march: 'Mar',
    apr: 'Apr', april: 'Apr',
    may: 'May',
  };
  const matchedMonth = monthAliasMap[monthLower];

  if (!matchedMonth) {
    errors.push(
      `Fee Change Slot ${slotNumber}: "${monthStr}" is not a recognized month. Use Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar, Apr, or May.`
    );
    return null;
  }

  return { newFee: roundedFee, effectiveFromMonth: matchedMonth };
}

/**
 * Validates a list of parsed fee-change slots for chronological order,
 * no gaps, and no duplicate months. Mutates nothing; returns cleaned list + errors.
 */
function validateFeeChangeSequence(
  slots: (FeeChange | null)[],
  errors: string[]
): FeeChange[] {
  // Enforce "no gaps": slot 2 can't be filled if slot 1 is blank, etc.
  let sawBlank = false;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === null) {
      sawBlank = true;
    } else if (sawBlank) {
      errors.push(
        `Fee Change Slot ${i + 1} is filled but an earlier slot was left blank. Fill slots in order (1, then 2, then 3) with no gaps.`
      );
    }
  }

  const filled = slots.filter((s): s is FeeChange => s !== null);

  // Enforce chronological order + no duplicate months
  for (let i = 1; i < filled.length; i++) {
    const prevIdx = ACADEMIC_MONTHS.indexOf(filled[i - 1].effectiveFromMonth);
    const currIdx = ACADEMIC_MONTHS.indexOf(filled[i].effectiveFromMonth);
    if (currIdx === prevIdx) {
      errors.push(
        `Fee Change Slots cannot share the same "Effective From" month (duplicate: ${filled[i].effectiveFromMonth}).`
      );
    } else if (currIdx < prevIdx) {
      errors.push(
        `Fee Change Slots must be in chronological order. Slot ${i + 1} ("${filled[i].effectiveFromMonth}") comes before Slot ${i} ("${filled[i - 1].effectiveFromMonth}").`
      );
    }
  }

  return filled;
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

  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rawRows.length === 0) {
    throw new Error('No data found in the spreadsheet.');
  }

  // Find header row
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

  const sNoCol = findCol('s#', 'serial', 's.no', 'sr#', 'sr no', 's no');
  const classCol = findCol('class', 'grade');
  const rollCol = findCol('roll no', 'roll', 'reg no', 'admission no');
  const studentNameCol = findCol('student name', 'student', 'name', 'full name');
  const fatherNameCol = findCol('father name', 'father', 'parent', 'guardian');

  // Contact No 1 — must match "contact no 1" before the generic "contact no" fallback
  const phoneCol = findCol('contact no 1 (phone)', 'contact no 1', 'contact 1', 'phone 1', 'contact no (phone)', 'contact no', 'phone', 'contact', 'mobile', 'whatsapp');
  // Contact No 2 — optional secondary number
  const phoneCol2 = findCol('contact no 2 (phone)', 'contact no 2', 'contact 2', 'phone 2', 'second contact', 'alternate contact');

  const feeCol = findCol('monthly fee (pkr)', 'monthly fee', 'm. fee', 'm.fee', 'fee (pkr)', 'fee');

  // Fee change slots 1-3
  const newFeeCol1 = findCol('new fee 1', 'new monthly fee 1');
  const effFromCol1 = findCol('effective from 1');
  const newFeeCol2 = findCol('new fee 2', 'new monthly fee 2');
  const effFromCol2 = findCol('effective from 2');
  const newFeeCol3 = findCol('new fee 3', 'new monthly fee 3');
  const effFromCol3 = findCol('effective from 3');

  // Month columns
  const monthCols: Record<AcademicMonth, number> = {
    Jun: -1, Jul: -1, Aug: -1, Sep: -1, Oct: -1, Nov: -1,
    Dec: -1, Jan: -1, Feb: -1, Mar: -1, Apr: -1, May: -1,
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

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0 || row.every((c) => String(c).trim() === '')) {
      continue;
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

    // 6. Contact No 1 (required, defaults to placeholder if missing)
    const rawPhone = phoneCol !== -1 ? row[phoneCol] : '';
    const contactNo = normalizeContactNumber(rawPhone, false) as string;

    // 6b. Contact No 2 (optional, stays undefined if blank)
    const rawPhone2 = phoneCol2 !== -1 ? row[phoneCol2] : '';
    const contactNo2 = normalizeContactNumber(rawPhone2, true);

    // 7. Monthly Fee (PKR) — baseline rate, effective from Jun
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

    // 8. Fee change slots (1-3) — parse, then validate as a sequence
    const slot1 = parseFeeChangeSlot(
      newFeeCol1 !== -1 ? row[newFeeCol1] : '',
      effFromCol1 !== -1 ? row[effFromCol1] : '',
      1, warnings, errors
    );
    const slot2 = parseFeeChangeSlot(
      newFeeCol2 !== -1 ? row[newFeeCol2] : '',
      effFromCol2 !== -1 ? row[effFromCol2] : '',
      2, warnings, errors
    );
    const slot3 = parseFeeChangeSlot(
      newFeeCol3 !== -1 ? row[newFeeCol3] : '',
      effFromCol3 !== -1 ? row[effFromCol3] : '',
      3, warnings, errors
    );
    const feeChanges = validateFeeChangeSequence([slot1, slot2, slot3], errors);

    // Build a per-month "fee that was actually billed that month" lookup,
    // using the baseline fee and any confirmed fee changes in order.
    const feeForMonth = (month: AcademicMonth): number => {
      const monthIdx = ACADEMIC_MONTHS.indexOf(month);
      let activeFee = monthlyFee;
      for (const change of feeChanges) {
        if (ACADEMIC_MONTHS.indexOf(change.effectiveFromMonth) <= monthIdx) {
          activeFee = change.newFee;
        }
      }
      return activeFee;
    };

    // 9. Monthly Paid Amounts and Statuses for Jun through May
    const monthlyAmounts: Record<AcademicMonth, number> = {
      Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0,
      Dec: 0, Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0,
    };
    const monthlyStatuses: Record<AcademicMonth, PaymentStatus> = {
      Jun: 'unpaid', Jul: 'unpaid', Aug: 'unpaid', Sep: 'unpaid', Oct: 'unpaid', Nov: 'unpaid',
      Dec: 'unpaid', Jan: 'unpaid', Feb: 'unpaid', Mar: 'unpaid', Apr: 'unpaid', May: 'unpaid',
    };

    ACADEMIC_MONTHS.forEach((m) => {
      const colIdx = monthCols[m];
      const expectedFee = feeForMonth(m); // the fee actually active in this month, not a flat guess

      if (colIdx !== -1 && row[colIdx] !== undefined && row[colIdx] !== null && String(row[colIdx]).trim() !== '') {
        const rawVal = row[colIdx];

        if (typeof rawVal === 'number') {
          const amt = Math.max(0, Math.round(rawVal));
          monthlyAmounts[m] = amt;
          if (amt >= expectedFee && expectedFee > 0) monthlyStatuses[m] = 'paid';
          else if (amt > 0) monthlyStatuses[m] = 'partial';
          else monthlyStatuses[m] = 'unpaid';
        } else {
          const strVal = String(rawVal).trim();
          const cleanDigits = strVal.replace(/[^0-9.]/g, '');

          if (cleanDigits.length > 0 && !isNaN(parseFloat(cleanDigits))) {
            const amt = Math.max(0, Math.round(parseFloat(cleanDigits)));
            monthlyAmounts[m] = amt;
            if (amt >= expectedFee && expectedFee > 0) monthlyStatuses[m] = 'paid';
            else if (amt > 0) monthlyStatuses[m] = 'partial';
            else monthlyStatuses[m] = 'unpaid';
          } else {
            const upper = strVal.toUpperCase();
            if (upper.includes('PAID') || upper === 'P' || upper === 'YES' || upper === 'DONE' || upper === 'CLEARED') {
              monthlyAmounts[m] = expectedFee;
              monthlyStatuses[m] = 'paid';
            } else if (upper.includes('PARTIAL') || upper.includes('HALF')) {
              monthlyAmounts[m] = Math.round(expectedFee / 2);
              monthlyStatuses[m] = 'partial';
            } else {
              monthlyAmounts[m] = 0;
              monthlyStatuses[m] = 'unpaid';
            }
          }
        }
      } else {
        monthlyAmounts[m] = 0;
        monthlyStatuses[m] = 'unpaid';
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
      contactNo2,
      monthlyFee,
      discount: 0,
      feeChanges,
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
 * Downloads a sample Excel file matching the current template:
 * S# | Class | Roll No | Student Name | Father Name | Contact No 1 | Contact No 2 |
 * Monthly Fee (PKR) | New Fee 1 | Effective From 1 | New Fee 2 | Effective From 2 |
 * New Fee 3 | Effective From 3 | Jun..May
 */
export function downloadSampleImportTemplate(): void {
  const headers = [
    'S#',
    'Class',
    'Roll No',
    'Student Name',
    'Father Name',
    'Contact No 1 (Phone)',
    'Contact No 2 (Phone)',
    'Monthly Fee (PKR)',
    'New Fee 1',
    'Effective From 1',
    'New Fee 2',
    'Effective From 2',
    'New Fee 3',
    'Effective From 3',
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
    // Row 1: demonstrates TWO fee changes in one year (Sep, then Nov) — matches the real
    // multi-change scenario this template is built to support.
    [
      '001', 'Class X', 'ETC-1001', 'Muhammad Hamza', 'Tariq Mehmood',
      '03001234567', '',
      6000,
      6500, 'Sep',
      7000, 'Nov',
      '', '',
      6000, 6000, 6000, 6500, 6500, 7000, 7000, 7000, 7000, 7000, 7000,
    ],
    // Row 2: demonstrates the optional second contact number, no fee change.
    [
      '002', 'Class IX', 'ETC-1002', 'Ayesha Fatima', 'Nadeem Akhtar',
      '03219876543', '03211234567',
      6000,
      '', '', '', '', '', '',
      6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 0, 0, 0,
    ],
    // Row 3: no fee change, single contact only — the most common case.
    [
      '003', 'Class VIII', 'ETC-1003', 'Zain Ul Abideen', 'Ghulam Rasool',
      '03335557788', '',
      5500,
      '', '', '', '', '', '',
      5500, 5500, 5500, 5500, 5500, 5500, 5500, 2750, 0, 0, 0,
    ],
    [
      '004', 'Class VII', 'ETC-1004', 'Fatima Zahra', 'Dr. Shakeel Ahmed',
      '03451122334', '',
      5500,
      '', '', '', '', '', '',
      5500, 5500, 5500, 5500, 5500, 5500, 5500, 5500, 0, 0, 0,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  ws['!cols'] = [
    { wch: 8 },  // S#
    { wch: 14 }, // Class
    { wch: 12 }, // Roll No
    { wch: 22 }, // Student Name
    { wch: 22 }, // Father Name
    { wch: 20 }, // Contact No 1
    { wch: 20 }, // Contact No 2
    { wch: 16 }, // Monthly Fee
    { wch: 12 }, // New Fee 1
    { wch: 16 }, // Effective From 1
    { wch: 12 }, // New Fee 2
    { wch: 16 }, // Effective From 2
    { wch: 12 }, // New Fee 3
    { wch: 16 }, // Effective From 3
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

  // Preserve leading zeros / text formatting for S#, Contact No 1, and Contact No 2 columns
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const textColumns = [0, 5, 6]; // S#, Contact No 1, Contact No 2
  for (let r = 1; r <= range.e.r; ++r) {
    for (const colIdx of textColumns) {
      const cellRef = XLSX.utils.encode_cell({ c: colIdx, r });
      if (ws[cellRef]) {
        ws[cellRef].t = 's';
        ws[cellRef].z = '@';
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student Fee Ledger');
  XLSX.writeFile(wb, 'Student_Fee_Import_Template.xlsx');
}