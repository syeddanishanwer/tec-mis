import * as XLSX from 'xlsx';
import { StudentRecord, ACADEMIC_MONTHS, AcademicMonth, Invoice, PaymentStatus } from '../types';
import { formatPhoneDisplay, formatSerialNo } from '../data/mockStudents';

/**
 * Determines the index (0-11) of the current academic month within ACADEMIC_MONTHS
 * (Jun=0 ... May=11) based on today's real calendar date.
 */
function getCurrentAcademicMonthIndex(): number {
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'short' }) as AcademicMonth;
  const idx = ACADEMIC_MONTHS.indexOf(currentMonthName);
  return idx !== -1 ? idx : 0;
}

/**
 * Format phone number for CSV so Excel displays it as a Special Phone Number string.
 */
function formatContactForCSV(rawNumber: string | undefined): string {
  if (!rawNumber) return '';
  const formatted = formatPhoneDisplay(rawNumber);
  return `"=""${formatted}"""`;
}

/**
 * Calculates a student's total collected and outstanding balance up to the target month
 * directly from the normalized invoices map.
 */
function calculateInvoiceTotals(
  student: StudentRecord,
  invoicesMap?: Map<string, Invoice>,
  untilMonthIndex: number = getCurrentAcademicMonthIndex()
) {
  let totalCollected = 0;
  let totalOutstanding = 0;

  const targetMonths = ACADEMIC_MONTHS.slice(0, untilMonthIndex + 1);

  targetMonths.forEach((m) => {
    const inv = invoicesMap?.get(`${student?.id}_${m}`);
    if (inv) {
      totalCollected += inv.paidAmount || 0;
      totalOutstanding += Math.max(0, (inv.netDue || 0) - (inv.paidAmount || 0));
    } else {
      const netFee = Math.max(0, (student?.monthlyFee || 0) - (student?.discount || 0));
      const paid = student?.monthlyAmountsPaid?.[m] || 0;
      totalCollected += paid;
      totalOutstanding += Math.max(0, netFee - paid);
    }
  });

  return { totalCollected, totalOutstanding };
}

/**
 * Exports genuine Microsoft Excel (.xlsx) file including multi-slot fee revisions
 * and reading from DB Invoices.
 */
export function exportToExcel(
  students: (StudentRecord & { feeChanges?: any[] })[],
  filename?: string,
  activeYear: string = '2026-2027',
  invoicesMap?: Map<string, Invoice>
) {
  const actualFilename = filename || `School_Fee_Ledger_${activeYear.replace('-', '_')}.xlsx`;
  const currentMonthIndex = getCurrentAcademicMonthIndex();

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
    ...ACADEMIC_MONTHS,
    'Total Outstanding (PKR)',
  ];

  const sheetData: (string | number)[][] = [headers];

  (students || []).forEach((student, idx) => {
    const totals = calculateInvoiceTotals(student, invoicesMap, currentMonthIndex);
    const monthAmounts = ACADEMIC_MONTHS.map((m) => {
      const inv = invoicesMap?.get(`${student?.id}_${m}`);
      return inv ? inv.paidAmount : student?.monthlyAmountsPaid?.[m] || 0;
    });
    const sNo = student?.serialNo ? formatSerialNo(student.serialNo) : formatSerialNo(student?.id || idx + 1, idx + 1);

    // Defensive check to avoid runtime slice/index errors
    const changes = Array.isArray(student?.feeChanges) ? student.feeChanges : [];
    const change1 = changes[0] || {};
    const change2 = changes[1] || {};
    const change3 = changes[2] || {};

    sheetData.push([
      sNo,
      student?.className || '',
      student?.rollNo || '',
      student?.studentName || '',
      student?.fatherName || '',
      formatPhoneDisplay(student?.contactNo),
      student?.contactNo2 ? formatPhoneDisplay(student.contactNo2) : '',
      student?.monthlyFee || 0,
      change1.newFee || '',
      change1.effectiveFromMonth || '',
      change2.newFee || '',
      change2.effectiveFromMonth || '',
      change3.newFee || '',
      change3.effectiveFromMonth || '',
      ...monthAmounts,
      totals.totalOutstanding,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = [
    { wch: 8 },  // S#
    { wch: 14 }, // Class
    { wch: 10 }, // Roll No
    { wch: 22 }, // Student Name
    { wch: 22 }, // Father Name
    { wch: 18 }, // Contact No 1
    { wch: 18 }, // Contact No 2
    { wch: 18 }, // Monthly Fee (PKR)
    { wch: 12 }, // New Fee 1
    { wch: 16 }, // Effective From 1
    { wch: 12 }, // New Fee 2
    { wch: 16 }, // Effective From 2
    { wch: 12 }, // New Fee 3
    { wch: 16 }, // Effective From 3
    ...ACADEMIC_MONTHS.map(() => ({ wch: 9 })),
    { wch: 24 }, // Total Outstanding
  ];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const textColumns = [0, 5, 6];
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
  const safeSheetName = `Ledger ${activeYear.replace('-', '_')}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  XLSX.writeFile(wb, actualFilename, { bookType: 'xlsx', type: 'binary' });
}

export function exportToCSV(
  students: (StudentRecord & { feeChanges?: any[] })[],
  filename?: string,
  activeYear: string = '2026-2027',
  invoicesMap?: Map<string, Invoice>
) {
  const actualFilename = filename || `The_Educational_Centre_Fee_Ledger_${activeYear.replace('-', '_')}.csv`;
  const currentMonthIndex = getCurrentAcademicMonthIndex();

  const headers = [
    'S#',
    'Class',
    'Roll No',
    'Student Name',
    'Father Name',
    'Contact No 1 (Phone)',
    'Contact No 2 (Phone)',
    'M. Fee (PKR)',
    'New Fee 1',
    'Effective From 1',
    'New Fee 2',
    'Effective From 2',
    'New Fee 3',
    'Effective From 3',
    ...ACADEMIC_MONTHS,
    'Total Outstanding (PKR)',
  ];

  const rows = (students || []).map((student, idx) => {
    const totals = calculateInvoiceTotals(student, invoicesMap, currentMonthIndex);
    const monthAmounts = ACADEMIC_MONTHS.map((m) => {
      const inv = invoicesMap?.get(`${student?.id}_${m}`);
      return inv ? inv.paidAmount : student?.monthlyAmountsPaid?.[m] || 0;
    });
    const sNo = student?.serialNo ? formatSerialNo(student.serialNo) : formatSerialNo(student?.id || idx + 1, idx + 1);

    // Defensive check to avoid runtime slice/index errors
    const changes = Array.isArray(student?.feeChanges) ? student.feeChanges : [];
    const change1 = changes[0] || {};
    const change2 = changes[1] || {};
    const change3 = changes[2] || {};

    return [
      `"=""${sNo}"""`,
      `"${student?.className || ''}"`,
      `"${student?.rollNo || ''}"`,
      `"${student?.studentName || ''}"`,
      `"${student?.fatherName || ''}"`,
      formatContactForCSV(student?.contactNo),
      formatContactForCSV(student?.contactNo2),
      student?.monthlyFee || 0,
      change1.newFee || '',
      change1.effectiveFromMonth || '',
      change2.newFee || '',
      change2.effectiveFromMonth || '',
      change3.newFee || '',
      change3.effectiveFromMonth || '',
      ...monthAmounts,
      totals.totalOutstanding,
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', actualFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function printFeeLedger(
  students: StudentRecord[],
  title?: string,
  activeYear: string = '2026-2027',
  invoicesMap?: Map<string, Invoice>
) {
  const actualTitle = title || `The Educational Centre Secondary School - Fee Ledger ${activeYear}`;
  const currentMonthIndex = getCurrentAcademicMonthIndex();
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print the fee ledger.');
    return;
  }

  const rowsHtml = (students || [])
    .map((s, idx) => {
      const totals = calculateInvoiceTotals(s, invoicesMap, currentMonthIndex);
      const sNo = s?.serialNo ? formatSerialNo(s.serialNo) : formatSerialNo(s?.id || idx + 1, idx + 1);

      return `<tr>
        <td style="border:1px solid #ddd;padding:6px;text-align:center;font-family:monospace;font-weight:bold;">${sNo}</td>
        <td style="border:1px solid #ddd;padding:6px;"><strong>${s?.className || ''}</strong></td>
        <td style="border:1px solid #ddd;padding:6px;">${s?.studentName || ''}</td>
        <td style="border:1px solid #ddd;padding:6px;">${s?.fatherName || ''}</td>
        <td style="border:1px solid #ddd;padding:6px;font-family:monospace;">${formatPhoneDisplay(s?.contactNo)}${s?.contactNo2 ? `<br/>${formatPhoneDisplay(s.contactNo2)}` : ''}</td>
        <td style="border:1px solid #ddd;padding:6px;text-align:right;">Rs. ${(s?.monthlyFee || 0).toLocaleString()}</td>
        ${ACADEMIC_MONTHS.map((m) => {
          const inv = invoicesMap?.get(`${s?.id}_${m}`);
          const st: PaymentStatus = inv ? inv.status : 'unpaid';
          const color = st === 'paid' ? '#198754' : st === 'partial' ? '#fd7e14' : '#dc3545';
          return `<td style="border:1px solid #ddd;padding:6px;text-align:center;color:${color};font-weight:bold;font-size:11px;">${st.toUpperCase()}</td>`;
        }).join('')}
        <td style="border:1px solid #ddd;padding:6px;text-align:right;font-weight:bold;color:${totals.totalOutstanding > 0 ? '#dc3545' : '#198754'};">Rs. ${totals.totalOutstanding.toLocaleString()}</td>
      </tr>`;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${actualTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header-container { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 12px; }
          .logo-img { height: 64px; width: 64px; object-fit: contain; }
          h2 { margin: 0; text-align: center; color: #1e1b4b; font-size: 20px; }
          p.motto { text-align: center; margin: 2px 0 0 0; font-size: 11px; font-weight: bold; letter-spacing: 1px; color: #4338ca; text-transform: uppercase; }
          p.sub { text-align: center; margin-top: 4px; font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
          th { background: #1e1b4b; color: #fff; padding: 7px 4px; border: 1px solid #1e1b4b; }
          @media print {
            @page { size: landscape; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <img src="/school_logo.jpg" alt="Logo" class="logo-img" onerror="this.style.display='none'" />
          <div>
            <h2>THE EDUCATIONAL CENTRE SECONDARY SCHOOL</h2>
            <p class="motto">ENTER TO LEARN &bull; GO FORTH TO SERVE</p>
            <p class="sub">Official Student Fee Register & Financial Ledger (Session: ${activeYear}) &bull; Printed: ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>S#</th>
              <th>Class</th>
              <th>Student Name</th>
              <th>Father Name</th>
              <th>Contact No.</th>
              <th>M. FEE</th>
              ${ACADEMIC_MONTHS.map((m) => `<th>${m}</th>`).join('')}
              <th>Total Due</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}