import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StudentRecord, AcademicMonth, ACADEMIC_MONTHS, Invoice } from '../types';
import { MessageSquare, ExternalLink, Copy, Check, X, ShieldAlert, Phone, Move } from 'lucide-react';

interface Props {
  student: StudentRecord;
  month?: AcademicMonth;
  customOutstanding?: number;
  activeAcademicYear?: string;
  onClose: () => void;
}

function cleanPhoneNumber(raw?: string): string {
  if (!raw) return '923001234567';
  let cleaned = String(raw).replace(/[^0-9]/g, '');
  if (cleaned.startsWith('03') && cleaned.length === 11) cleaned = '92' + cleaned.slice(1);
  else if (cleaned.length === 10 && cleaned.startsWith('3')) cleaned = '92' + cleaned;
  else if (!cleaned.startsWith('92') && cleaned.length >= 10) cleaned = '92' + cleaned.slice(-10);
  return cleaned || '923001234567';
}

function generateWhatsAppLink(
  student: StudentRecord,
  targetMonth: AcademicMonth,
  customOutstanding: number | undefined,
  activeAcademicYear: string = '2026-2027'
) {
  const cleanNumber = cleanPhoneNumber(student.contactNo);

  const getInvoice = (month: AcademicMonth): Invoice | undefined => {
    return student.invoices?.find(inv => inv.month === month && inv.academicYear === activeAcademicYear);
  };

  const targetMonthIdx = ACADEMIC_MONTHS.indexOf(targetMonth);
  const visibleMonths = ACADEMIC_MONTHS.slice(0, targetMonthIdx + 1);

  let totalOutstanding = 0;
  let totalBilled = 0;
  let totalCollected = 0;
  const overdueMonths: string[] = [];

  visibleMonths.forEach(m => {
    const inv = getInvoice(m as AcademicMonth);
    if (!inv || inv.status === 'new_admission') return;
    const netDue = Number(inv.netDue) || 0;
    const paid = Number(inv.paidAmount) || 0;
    const due = Math.max(0, netDue - paid);
    totalBilled += netDue;
    totalCollected += paid;
    totalOutstanding += due;
    if (due > 0) overdueMonths.push(`${m} (Rs. ${due.toLocaleString()})`);
  });

  const finalOutstanding = customOutstanding !== undefined ? customOutstanding : totalOutstanding;

  const feeSchedules = student.feeSchedules || [];
  const baseFee = feeSchedules.length > 0 ? feeSchedules[0].monthlyFee : 0;
  const currentFee = feeSchedules.length > 0 ? feeSchedules[feeSchedules.length - 1].monthlyFee : baseFee;
  const wef = feeSchedules.length > 0 ? feeSchedules[feeSchedules.length - 1].effectiveFromMonth : 'Jun';

  let message = '';
  if (finalOutstanding <= 0) {
    message = `Assalam-o-Alaikum *${student.fatherName} Sahib*,

This is a confirmation from *The Educational Centre Secondary School*.

Student: *${student.studentName}* (${student.className}, Roll: ${student.rollNo})
Status: *All dues cleared* up to *${targetMonth} ${activeAcademicYear}*.

Total Paid: Rs. ${totalCollected.toLocaleString()}
Current Monthly Fee: Rs. ${currentFee.toLocaleString()} ${currentFee !== baseFee ? `(w.e.f ${wef}, was Rs.${baseFee.toLocaleString()})` : ''}

JazakAllah for timely payment.

*Enter to learn, Go forth to serve.*
The Educational Centre Secondary School`;
  } else {
    message = `Assalam-o-Alaikum *${student.fatherName} Sahib*,

Gentle fee reminder from *The Educational Centre Secondary School*.

Student: *${student.studentName}* (${student.className}, Roll: ${student.rollNo})
Month: *${targetMonth} ${activeAcademicYear}*

*Outstanding Details (Jun to ${targetMonth}):*
Total Billed: Rs. ${totalBilled.toLocaleString()}
Total Collected: Rs. ${totalCollected.toLocaleString()}
*Total Outstanding: Rs. ${finalOutstanding.toLocaleString()}*

${overdueMonths.length > 0 ? `Breakup: ${overdueMonths.join(', ')}` : ''}

Current Monthly Fee: Rs. ${currentFee.toLocaleString()} ${currentFee !== baseFee ? `(w.e.f ${wef}, was Rs.${baseFee.toLocaleString()})` : ''}

Please arrange payment at earliest. You can reply to this message for receipt.

JazakAllah.

*Enter to learn, Go forth to serve.*
The Educational Centre Secondary School`;
  }

  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;

  return { url, message, cleanNumber, totalOutstanding: finalOutstanding, totalBilled, totalCollected };
}

export const WhatsAppPreviewModal: React.FC<Props> = ({
  student,
  month = 'Sep',
  customOutstanding,
  activeAcademicYear = '2026-2027',
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Self-contained modal dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Primary left click only
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const targetMonth: AcademicMonth = (month as AcademicMonth) || 'Sep';

  const { url, message, cleanNumber, totalOutstanding, totalBilled, totalCollected } = useMemo(() =>
    generateWhatsAppLink(student, targetMonth, customOutstanding, activeAcademicYear),
    [student, targetMonth, customOutstanding, activeAcademicYear]
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-hidden">
      <div
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
        className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200 select-none"
      >
        {/* Draggable Header */}
        <div
          onMouseDown={handleHeaderMouseDown}
          className="bg-emerald-700 px-5 py-4 text-white flex items-center justify-between cursor-grab active:cursor-grabbing shrink-0"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-800/80 rounded-lg">
              <MessageSquare className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-base leading-tight">WhatsApp Fee Reminder Notice</h3>
                <Move className="w-3.5 h-3.5 text-emerald-200 opacity-70" />
              </div>
              <p className="text-xs text-emerald-100 opacity-90">Instant wa.me Click-to-Chat Generator • Drag header to move</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-emerald-200 hover:text-white hover:bg-emerald-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Area */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="bg-neutral-50 rounded-lg p-3.5 border border-neutral-200 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs font-medium text-neutral-500 block">Student</span>
              <span className="font-semibold text-neutral-900">{student.studentName}</span>
              <span className="text-xs text-neutral-600 ml-1">({student.className})</span>
            </div>
            <div>
              <span className="text-xs font-medium text-neutral-500 block">Parent / Guardian</span>
              <span className="font-semibold text-neutral-900">{student.fatherName}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-neutral-500 block">WhatsApp Number</span>
              <span className="font-mono text-emerald-700 font-semibold flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> +{cleanNumber}
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-neutral-500 block">Reminder Month</span>
              <span className="font-semibold text-neutral-800">{targetMonth} ({activeAcademicYear})</span>
            </div>
            <div className="col-span-2 grid grid-cols-3 gap-2 pt-2 border-t border-neutral-200 mt-1">
              <div><span className="text-[10px] text-neutral-500 block">BILLED (Jun-{targetMonth})</span><span className="font-bold text-neutral-900 text-xs">Rs. {totalBilled.toLocaleString()}</span></div>
              <div><span className="text-[10px] text-neutral-500 block">COLLECTED</span><span className="font-bold text-emerald-700 text-xs">Rs. {totalCollected.toLocaleString()}</span></div>
              <div><span className="text-[10px] text-neutral-500 block">OUTSTANDING</span><span className={`font-bold text-xs ${totalOutstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Rs. {totalOutstanding.toLocaleString()}</span></div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block mb-1.5">WhatsApp Message Preview</label>
            <div className="bg-[#e5ddd5] p-4 rounded-xl border border-neutral-300 relative">
              <div className="bg-white rounded-lg p-3.5 shadow-sm max-w-[92%] relative rounded-tl-none border border-neutral-100">
                <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap font-sans">{message}</p>
                <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-neutral-400"><span>10:45 AM</span><span className="text-blue-500 font-bold">✓✓</span></div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block mb-1">Generated wa.me Link</label>
            <div className="flex items-center gap-1 bg-neutral-100 p-2 rounded-md border border-neutral-200">
              <input type="text" readOnly value={url} className="bg-transparent text-xs text-neutral-700 w-full outline-none font-mono truncate" />
            </div>
          </div>

          <div className="flex items-start gap-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>Clicking <strong>Send via WhatsApp</strong> opens parent's chat directly with pre-filled message. NEW ADMISSION months are automatically excluded from outstanding.</span>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="bg-neutral-50 px-5 py-3.5 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex gap-2">
            <button onClick={handleCopyMessage} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100">
              {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}{copiedMessage ? 'Copied Message!' : 'Copy Text'}
            </button>
            <button onClick={handleCopyLink} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100">
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}{copiedLink ? 'Copied Link!' : 'Copy wa.me'}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100">Cancel</button>
            <button onClick={handleOpenWhatsApp} className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"><ExternalLink className="w-3.5 h-3.5" />Send via WhatsApp</button>
          </div>
        </div>
      </div>
    </div>
  );
};