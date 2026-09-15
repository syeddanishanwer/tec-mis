import React, { useState } from 'react';
import { Hand, MousePointer, RotateCcw, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface PanControllerProps {
  isPanMode: boolean;
  setIsPanMode: React.Dispatch<React.SetStateAction<boolean>>;
  isSpaceHeld: boolean;
  isDragging: boolean;
  onResetView: () => void;
}

export const PanController: React.FC<PanControllerProps> = ({
  isPanMode,
  setIsPanMode,
  isSpaceHeld,
  isDragging,
  onResetView,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const active = isPanMode || isSpaceHeld;

  return (
    <div className="fixed bottom-5 left-5 z-40 select-none animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Mini Help Popover */}
      {showHelp && (
        <div className="mb-2 w-72 bg-neutral-900 text-white rounded-xl p-3 shadow-2xl border border-neutral-700 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold border-b border-neutral-800 pb-1.5 text-neutral-200">
            <span className="flex items-center gap-1.5">
              <Hand className="w-3.5 h-3.5 text-amber-400" />
              Mouse Pan Navigation
            </span>
            <button
              onClick={() => setShowHelp(false)}
              className="text-neutral-400 hover:text-white px-1"
            >
              &times;
            </button>
          </div>
          <ul className="text-neutral-300 space-y-1.5 text-[11px] leading-relaxed">
            <li className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold">&bull;</span>
              <span><strong>Left-Click &amp; Drag:</strong> Move mouse to pan both page and wide tables smoothly.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold">&bull;</span>
              <span><strong>Spacebar:</strong> Hold Spacebar anytime to temporarily grab and move the page.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold">&bull;</span>
              <span><strong>Press H:</strong> Toggle persistent Pan Mode on / off.</span>
            </li>
          </ul>
        </div>
      )}

      {/* Main Floating Pill */}
      <div className="flex items-center bg-neutral-900/95 text-white backdrop-blur-md border border-neutral-700/80 rounded-full shadow-2xl p-1 gap-1.5">
        {/* Toggle Mode Button */}
        <button
          type="button"
          onClick={() => setIsPanMode((prev) => !prev)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            active
              ? 'bg-amber-400 text-neutral-950 shadow-sm ring-2 ring-amber-300'
              : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-white'
          }`}
          title={active ? 'Pan Mode Active (Press H or click to turn off)' : 'Enable Pan Mode (Press H or hold Spacebar)'}
        >
          {active ? <Hand className="w-3.5 h-3.5" /> : <MousePointer className="w-3.5 h-3.5" />}
          <span>{active ? 'Pan: ON' : 'Pan Mode'}</span>
        </button>

        {/* Live Dragging Indicator or Guide */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-2 text-xs">
            {isDragging ? (
              <span className="inline-flex items-center gap-1.5 text-amber-300 font-bold text-[11px] animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Moving View...
              </span>
            ) : (
              <span className="text-neutral-400 text-[11px] font-medium hidden sm:inline">
                {active ? 'Drag mouse to move view' : 'Click & drag mouse to move'}
              </span>
            )}
          </div>
        )}

        {/* Reset View Button */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={onResetView}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-full transition-colors border border-neutral-700"
            title="Reset View (Scroll to Top-Left)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        {/* Help Toggle */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            className="p-1.5 text-neutral-400 hover:text-amber-300 rounded-full transition-colors"
            title="Keyboard shortcuts & mouse pan help"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Collapse / Expand */}
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="p-1 text-neutral-400 hover:text-white rounded-full transition-colors"
          title={isCollapsed ? 'Expand navigation widget' : 'Minimize navigation widget'}
        >
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
