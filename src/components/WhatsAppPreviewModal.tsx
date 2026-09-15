import React, { useState } from 'react';
import { StudentRecord, AcademicMonth } from '../types';
import { generateWhatsAppLink } from '../data/mockStudents';
import { MessageSquare, ExternalLink, Copy, Check, X, ShieldAlert, Phone } from 'lucide-react';

interface Props {
  student: StudentRecord;
  month?: AcademicMonth;
  customOutstanding?: number;
  activeAcademicYear?: string;
  onClose: () => void;
}

export const WhatsAppPreviewModal: React.FC<Props> = ({
  student,
  month = 'Feb',
  customOutstanding,
  activeAcademicYear = '2026-2027',
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const targetMonth: AcademicMonth = (month as AcademicMonth) || 'Feb';
  const { url, message, cleanNumber } = generateWhatsAppLink(
    student,
    targetMonth,
    customOutstanding,
    activeAcademicYear
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="bg-emerald-700 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-800/80 rounded-lg">
              <MessageSquare className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">WhatsApp Fee Reminder Notice</h3>
              <p className="text-xs text-emerald-100 opacity-90">Instant `wa.me` Click-to-Chat Generator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-emerald-200 hover:text-white hover:bg-emerald-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Recipient Details */}
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
              <span className="font-semibold text-neutral-800">{month} ({activeAcademicYear})</span>
            </div>
          </div>

          {/* WhatsApp Chat Preview */}
          <div>
            <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block mb-1.5">
              WhatsApp Message Preview
            </label>
            <div className="bg-[#e5ddd5] p-4 rounded-xl border border-neutral-300 relative">
              <div className="bg-white rounded-lg p-3.5 shadow-sm max-w-[92%] relative rounded-tl-none border border-neutral-100">
                <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {message}
                </p>
                <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-neutral-400">
                  <span>10:45 AM</span>
                  <span className="text-blue-500 font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Direct wa.me URL */}
          <div>
            <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block mb-1">
              Generated `wa.me` Link Format
            </label>
            <div className="flex items-center gap-1 bg-neutral-100 p-2 rounded-md border border-neutral-200">
              <input
                type="text"
                readOnly
                value={url}
                className="bg-transparent text-xs text-neutral-700 w-full outline-none font-mono truncate"
              />
            </div>
          </div>

          {/* Notice info */}
          <div className="flex items-start gap-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Clicking <strong>Send via WhatsApp</strong> opens the parent's chat directly in WhatsApp Web or App with pre-filled message text. No phonebook saving required.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-neutral-50 px-5 py-3.5 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={handleCopyMessage}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedMessage ? 'Copied Message!' : 'Copy Text'}
            </button>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Copied Link!' : 'Copy wa.me'}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleOpenWhatsApp}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Send via WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
