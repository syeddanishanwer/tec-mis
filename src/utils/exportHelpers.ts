import * as XLSX from 'xlsx';
import { StudentRecord, ACADEMIC_MONTHS } from '../types';
import { calculateStudentTotals, formatPhoneDisplay, getEffectiveMonthlyStatus, formatSerialNo, getStudentMonthPaidAmount } from '../data/mockStudents';

/**
 * Format phone number for CSV so Excel displays it as a Special Phone Number
 * rather than converting to scientific notation (e.g., 9.23E+11).
 * In Excel CSV format, enclosing the text as `="<phone>"` forces text/special format.
 */
function formatContactForCSV(rawNumber: string): string {
  const formatted = formatPhoneDisplay(rawNumber);
  // Excel formula format: "=""<formatted>""" forces cell to evaluate as text string
  return `"=""${formatted}"""`;
}

/**
 * Exports genuine Microsoft Excel (.xlsx) file using SheetJS.
 * Fully compatible with Excel 2010, Excel 2013, 2016, 2019, 2021, Office 365, etc.
 */
export function exportToExcel(
  students: StudentRecord[],
  filename?: string,
  activeYear: string = '2026-2027'
) {
  const actualFilename = filename || `School_Fee_Ledger_${activeYear.replace('-', '_')}.xlsx`;

  const headers = [
    'S#',
    'Class',
    'Roll No',
    'Student Name',
    'Father Name',
    'Contact No (Phone)',
    'Monthly Fee (PKR)',
    ...ACADEMIC_MONTHS,
    'Total Outstanding (PKR)',
  ];

  const sheetData: (string | number)[][] = [headers];

  students.forEach((student, idx) => {
    const totals = calculateStudentTotals(student, 8, activeYear);
    const monthAmounts = ACADEMIC_MONTHS.map((m) => getStudentMonthPaidAmount(student, m, activeYear));
    const sNo = student.serialNo ? formatSerialNo(student.serialNo) : formatSerialNo(student.id, idx + 1);

    sheetData.push([
      sNo,
      student.className,
      student.rollNo,
      student.studentName,
      student.fatherName,
      formatPhoneDisplay(student.contactNo),
      student.monthlyFee,
      ...monthAmounts,
      totals.totalOutstanding,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths so content is legible and not truncated in Excel 2010/2021
  ws['!cols'] = [
    { wch: 8 },  // S# (e.g. 001, 002)
    { wch: 14 }, // Class
    { wch: 10 }, // Roll No
    { wch: 22 }, // Student Name
    { wch: 22 }, // Father Name
    { wch: 18 }, // Contact No (Phone)
    { wch: 18 }, // Monthly Fee (PKR)
    ...ACADEMIC_MONTHS.map(() => ({ wch: 9 })), // Month statuses
    { wch: 24 }, // Total Outstanding (PKR)
  ];

  // Ensure S# and contact numbers are treated as text cells (type 's') to avoid stripping leading zeros or scientific notation
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
  const safeSheetName = `Ledger ${activeYear.replace('-', '_')}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  // Generates genuine .xlsx binary package that passes Excel 2010-2021 format verification
  XLSX.writeFile(wb, actualFilename, { bookType: 'xlsx', type: 'binary' });
}

export function exportToCSV(
  students: StudentRecord[],
  filename?: string,
  activeYear: string = '2026-2027'
) {
  const actualFilename = filename || `The_Educational_Centre_Fee_Ledger_${activeYear.replace('-', '_')}.csv`;
  const headers = [
    'S#',
    'Class',
    'Roll No',
    'Student Name',
    'Father Name',
    'Contact No (Phone)',
    'M. Fee (PKR)',
    ...ACADEMIC_MONTHS,
    'Total Outstanding (PKR)',
  ];

  const rows = students.map((student, idx) => {
    const totals = calculateStudentTotals(student, 8, activeYear);
    const monthAmounts = ACADEMIC_MONTHS.map((m) => getStudentMonthPaidAmount(student, m, activeYear));
    const sNo = student.serialNo ? formatSerialNo(student.serialNo) : formatSerialNo(student.id, idx + 1);

    return [
      `"=""${sNo}"""`,
      `"${student.className}"`,
      `"${student.rollNo}"`,
      `"${student.studentName}"`,
      `"${student.fatherName}"`,
      formatContactForCSV(student.contactNo),
      student.monthlyFee,
      ...monthAmounts,
      totals.totalOutstanding,
    ];
  });

  // Include UTF-8 BOM so Excel opens CSV with proper encoding directly without mangling
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
  activeYear: string = '2026-2027'
) {
  const actualTitle = title || `The Educational Centre Secondary School - Fee Ledger ${activeYear}`;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print the fee ledger.');
    return;
  }

  const rowsHtml = students
    .map((s, idx) => {
      const totals = calculateStudentTotals(s, 8, activeYear);
      const statusMap = getEffectiveMonthlyStatus(s, activeYear);
      const sNo = s.serialNo ? formatSerialNo(s.serialNo) : formatSerialNo(s.id, idx + 1);
      return `<tr>
        <td style="border:1px solid #ddd;padding:6px;text-align:center;font-family:monospace;font-weight:bold;">${sNo}</td>
        <td style="border:1px solid #ddd;padding:6px;"><strong>${s.className}</strong></td>
        <td style="border:1px solid #ddd;padding:6px;">${s.studentName}</td>
        <td style="border:1px solid #ddd;padding:6px;">${s.fatherName}</td>
        <td style="border:1px solid #ddd;padding:6px;font-family:monospace;">${formatPhoneDisplay(s.contactNo)}</td>
        <td style="border:1px solid #ddd;padding:6px;text-align:right;">Rs. ${s.monthlyFee.toLocaleString()}</td>
        ${ACADEMIC_MONTHS.map((m) => {
          const st = statusMap[m] || 'pending';
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
