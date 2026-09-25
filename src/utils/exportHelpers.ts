import * as XLSX from 'xlsx';
import { StudentRecord, ACADEMIC_MONTHS, AcademicMonth, Invoice, PaymentStatus } from '../types';

// FIXED: Local helpers - no mockStudents import
function formatPhoneDisplay(raw?: string): string {
  if (!raw) return '';
  let cleaned = String(raw).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('92') && cleaned.length >= 12) return '0' + cleaned.slice(2);
  if (cleaned.startsWith('03')) return cleaned;
  return cleaned;
}

function formatSerialNo(serialNo?: string | number, fallback?: number): string {
  if (serialNo!== undefined && serialNo!== null) return String(serialNo).trim().padStart(3, '0');
  if (fallback) return String(fallback).padStart(3, '0');
  return '001';
}

function getCurrentAcademicMonthIndex(): number {
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'short' }) as AcademicMonth;
  const idx = ACADEMIC_MONTHS.indexOf(currentMonthName);
  return idx!== -1? idx : ACADEMIC_MONTHS.indexOf('Sep'); // Default Sep
}

function formatContactForCSV(rawNumber: string | undefined): string {
  if (!rawNumber) return '';
  const formatted = formatPhoneDisplay(rawNumber);
  return `"=""${formatted}"""`;
}

// FIXED: Calculate from invoices only, excluding new_admission
function calculateInvoiceTotals(
  student: StudentRecord,
  invoicesMap?: Map<string, Invoice>,
  untilMonthIndex: number = getCurrentAcademicMonthIndex()
) {
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalBilled = 0;
  const targetMonths = ACADEMIC_MONTHS.slice(0, untilMonthIndex + 1);

  // Build map from student.invoices if invoicesMap not provided
  const getInvoice = (month: AcademicMonth): Invoice | undefined => {
    if (invoicesMap) return invoicesMap.get(`${student?.id}_${month}`);
    return student.invoices?.find(inv => inv.month === month);
  };

  targetMonths.forEach((m) => {
    const inv = getInvoice(m as AcademicMonth);
    if (!inv || inv.status === 'new_admission') return; // Exclude NEW ADMISSION
    totalBilled += Number(inv.netDue) || 0;
    totalCollected += Number(inv.paidAmount) || 0;
    totalOutstanding += Math.max(0, (Number(inv.netDue) || 0) - (Number(inv.paidAmount) || 0));
  });

  return { totalCollected, totalOutstanding, totalBilled };
}

// FIXED: Export Excel with invoices + feeSchedules
export function exportToExcel(
  students: StudentRecord[],
  filename?: string,
  activeYear: string = '2026-2027',
  invoicesMap?: Map<string, Invoice>
) {
  const actualFilename = filename || `School_Fee_Ledger_${activeYear.replace('-', '_')}.xlsx`;
  const currentMonthIndex = getCurrentAcademicMonthIndex();

  const headers = [
    'S#', 'Class', 'Roll No', 'Student Name', 'Father Name',
    'Contact No 1 (Phone)', 'Contact No 2 (Phone)',
    'Monthly Fee (PKR)', 'Current Fee', 'w.e.f', 'Base Fee',
    'New Fee 1', 'Effective From 1', 'New Fee 2', 'Effective From 2', 'New Fee 3', 'Effective From 3',
   ...ACADEMIC_MONTHS.map(m => `${m} Status`),
   ...ACADEMIC_MONTHS.map(m => `${m} Paid`),
    'Total Billed (PKR)', 'Total Collected (PKR)', 'Total Outstanding (PKR)',
  ];

  const sheetData: (string | number)[][] = [headers];

  (students || []).forEach((student, idx) => {
    const totals = calculateInvoiceTotals(student, invoicesMap, currentMonthIndex);

    const getInvoice = (month: AcademicMonth): Invoice | undefined => {
      if (invoicesMap) return invoicesMap.get(`${student?.id}_${month}`);
      return student.invoices?.find(inv => inv.month === month);
    };

    const monthStatuses = ACADEMIC_MONTHS.map(m => {
      const inv = getInvoice(m as AcademicMonth);
      if (!inv) return 'NO INVOICE';
      return inv.status === 'new_admission'? 'NEW ADMISSION' : inv.status.toUpperCase();
    });

    const monthAmounts = ACADEMIC_MONTHS.map(m => {
      const inv = getInvoice(m as AcademicMonth);
      if (!inv || inv.status === 'new_admission') return 0;
      return Number(inv.paidAmount) || 0;
    });

    const sNo = student?.serialNo? formatSerialNo(student.serialNo) : formatSerialNo(student?.id || idx + 1, idx + 1);

    // M.FEE logic: base + current w.e.f
    const feeSchedules = student.feeSchedules || [];
    const baseFee = feeSchedules.length > 0? feeSchedules[0].monthlyFee : 0;
    const currentFeeSch = feeSchedules.length > 0? feeSchedules[feeSchedules.length - 1] : null;
    const currentFee = currentFeeSch?.monthlyFee || baseFee;
    const wef = currentFeeSch?.effectiveFromMonth || 'Jun';

    const changes = feeSchedules.slice(1); // Skip base fee (Jun)
    const change1 = changes[0] || {}; const change2 = changes[1] || {}; const change3 = changes[2] || {};

    sheetData.push([
      sNo, student?.className || '', student?.rollNo || '', student?.studentName || '', student?.fatherName || '',
      formatPhoneDisplay(student?.contactNo), student?.contactNo2? formatPhoneDisplay(student.contactNo2) : '',
      baseFee, currentFee, wef, baseFee,
      (change1 as any).monthlyFee || '', (change1 as any).effectiveFromMonth || '',
      (change2 as any).monthlyFee || '', (change2 as any).effectiveFromMonth || '',
      (change3 as any).monthlyFee || '', (change3 as any).effectiveFromMonth || '',
     ...monthStatuses,
     ...monthAmounts,
      totals.totalBilled, totals.totalCollected, totals.totalOutstanding,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [
    { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 18 },
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
   ...ACADEMIC_MONTHS.map(() => ({ wch: 12 })),
   ...ACADEMIC_MONTHS.map(() => ({ wch: 10 })),
    { wch: 16 }, { wch: 18 }, { wch: 20 },
  ];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const textColumns = [0, 5, 6];
  for (let r = 1; r <= range.e.r; ++r) {
    for (const colIdx of textColumns) {
      const cellRef = XLSX.utils.encode_cell({ c: colIdx, r });
      if (ws[cellRef]) { ws[cellRef].t = 's'; ws[cellRef].z = '@'; }
    }
  }

  const wb = XLSX.utils.book_new();
  const safeSheetName = `Ledger ${activeYear.replace('-', '_')}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  XLSX.writeFile(wb, actualFilename, { bookType: 'xlsx', type: 'binary' });
}

export function exportToCSV(
  students: StudentRecord[],
  filename?: string,
  activeYear: string = '2026-2027',
  invoicesMap?: Map<string, Invoice>
) {
  const actualFilename = filename || `Fee_Ledger_${activeYear.replace('-', '_')}.csv`;
  const currentMonthIndex = getCurrentAcademicMonthIndex();

  const headers = [
    'S#', 'Class', 'Roll No', 'Student Name', 'Father Name',
    'Contact No 1', 'Contact No 2', 'M. Fee', 'Current Fee', 'w.e.f',
   ...ACADEMIC_MONTHS, 'Billed', 'Collected', 'Outstanding',
  ];

  const rows = (students || []).map((student, idx) => {
    const totals = calculateInvoiceTotals(student, invoicesMap, currentMonthIndex);

    const getInvoice = (month: AcademicMonth): Invoice | undefined => {
      if (invoicesMap) return invoicesMap.get(`${student?.id}_${month}`);
      return student.invoices?.find(inv => inv.month === month);
    };

    const monthCells = ACADEMIC_MONTHS.map(m => {
      const inv = getInvoice(m as AcademicMonth);
      if (!inv || inv.status === 'new_admission') return 'NEW ADMISSION';
      return `${inv.status.toUpperCase()} (${inv.paidAmount})`;
    });

    const sNo = student?.serialNo? formatSerialNo(student.serialNo) : formatSerialNo(student?.id || idx + 1, idx + 1);
    const feeSchedules = student.feeSchedules || [];
    const baseFee = feeSchedules.length > 0? feeSchedules[0].monthlyFee : 0;
    const currentFee = feeSchedules.length > 0? feeSchedules[feeSchedules.length - 1].monthlyFee : baseFee;
    const wef = feeSchedules.length > 0? feeSchedules[feeSchedules.length - 1].effectiveFromMonth : 'Jun';

    return [
      `"=""${sNo}"""`, `"${student?.className || ''}"`, `"${student?.rollNo || ''}"`,
      `"${student?.studentName || ''}"`, `"${student?.fatherName || ''}"`,
      formatContactForCSV(student?.contactNo), formatContactForCSV(student?.contactNo2),
      baseFee, currentFee, wef,
     ...monthCells.map(v => `"${v}"`),
      totals.totalBilled, totals.totalCollected, totals.totalOutstanding,
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','),...rows.map(e => e.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url); link.setAttribute('download', actualFilename);
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

export function printFeeLedger(
  students: StudentRecord[],
  title?: string,
  activeYear: string = '2026-2027',
  invoicesMap?: Map<string, Invoice>
) {
  const actualTitle = title || `The Educational Centre - Fee Ledger ${activeYear}`;
  const currentMonthIndex = getCurrentAcademicMonthIndex();
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Please allow popups to print.'); return; }

  const rowsHtml = (students || []).map((s, idx) => {
    const totals = calculateInvoiceTotals(s, invoicesMap, currentMonthIndex);
    const sNo = s?.serialNo? formatSerialNo(s.serialNo) : formatSerialNo(s?.id || idx + 1, idx + 1);

    const getInvoice = (month: AcademicMonth): Invoice | undefined => {
      if (invoicesMap) return invoicesMap.get(`${s?.id}_${month}`);
      return s.invoices?.find(inv => inv.month === month);
    };

    return `<tr>
      <td style="border:1px solid #ddd;padding:6px;text-align:center;font-family:monospace;font-weight:bold;">${sNo}</td>
      <td style="border:1px solid #ddd;padding:6px;"><strong>${s?.className || ''}</strong></td>
      <td style="border:1px solid #ddd;padding:6px;">${s?.studentName || ''}<br><small style="color:#888;">${s?.rollNo || ''}</small></td>
      <td style="border:1px solid #ddd;padding:6px;">${s?.fatherName || ''}</td>
      <td style="border:1px solid #ddd;padding:6px;font-family:monospace;">${formatPhoneDisplay(s?.contactNo)}</td>
      <td style="border:1px solid #ddd;padding:6px;text-align:right;">${(() => {
        const fs = s.feeSchedules || [];
        const base = fs.length > 0? fs[0].monthlyFee : 0;
        const curr = fs.length > 0? fs[fs.length - 1].monthlyFee : base;
        const wef = fs.length > 0? fs[fs.length - 1].effectiveFromMonth : 'Jun';
        return `Rs. ${curr.toLocaleString()}<br><small style="color:blue;">w.e.f ${wef}</small>${base!== curr? `<br><small style="color:#888;">was ${base.toLocaleString()}</small>` : ''}`;
      })()}</td>
      ${ACADEMIC_MONTHS.slice(0, currentMonthIndex + 1).map(m => {
        const inv = getInvoice(m as AcademicMonth);
        if (!inv || inv.status === 'new_admission') {
          return `<td style="border:1px solid #ddd;padding:6px;text-align:center;background:#000;color:#fff;font-weight:bold;font-size:9px;">NEW<br>ADMISSION</td>`;
        }
        const st: PaymentStatus = inv.status as PaymentStatus;
        const color = st === 'paid'? '#198754' : st === 'partial'? '#fd7e14' : '#dc3545';
        const bg = st === 'paid'? '#d1e7dd' : st === 'partial'? '#fff3cd' : '#f8d7da';
        return `<td style="border:1px solid #ddd;padding:6px;text-align:center;color:${color};background:${bg};font-weight:bold;font-size:10px;">${st.toUpperCase()}<br><small>Rs.${Number(inv.paidAmount).toLocaleString()}</small></td>`;
      }).join('')}
      <td style="border:1px solid #ddd;padding:6px;text-align:right;font-weight:bold;color:${totals.totalOutstanding > 0? '#dc3545' : '#198754'};">Rs. ${totals.totalOutstanding.toLocaleString()}<br><small style="font-weight:normal;color:#666;">Coll: ${totals.totalCollected.toLocaleString()}</small></td>
    </tr>`;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html><html><head><title>${actualTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
     .header { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 12px; }
     .logo { height: 64px; width: 64px; object-fit: contain; }
      h2 { margin: 0; text-align: center; color: #1e1b4b; font-size: 20px; }
      p.motto { text-align: center; margin: 2px 0; font-size: 11px; font-weight: bold; color: #4338ca; text-transform: uppercase; }
      p.sub { text-align: center; margin-top: 4px; font-size: 12px; color: #666; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
      th { background: #1e1b4b; color: #fff; padding: 7px 4px; border: 1px solid #1e1b4b; }
      @media print { @page { size: landscape; margin: 10mm; } }
    </style></head><body>
    <div class="header"><img src="/school_logo.jpg" alt="Logo" class="logo" onerror="this.style.display='none'"/><div><h2>THE EDUCATIONAL CENTRE SECONDARY SCHOOL</h2><p class="motto">ENTER TO LEARN • GO FORTH TO SERVE</p><p class="sub">Fee Ledger Session: ${activeYear} • Printed: ${new Date().toLocaleDateString()} • Months: Jun to ${ACADEMIC_MONTHS[currentMonthIndex]}</p></div></div>
    <table><thead><tr><th>S#</th><th>Class</th><th>Student</th><th>Father</th><th>Contact</th><th>M. FEE</th>${ACADEMIC_MONTHS.slice(0, currentMonthIndex + 1).map(m => `<th>${m}</th>`).join('')}<th>Total Due</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>
  `);
  printWindow.document.close(); printWindow.focus();
  setTimeout(() => printWindow.print(), 400);
}