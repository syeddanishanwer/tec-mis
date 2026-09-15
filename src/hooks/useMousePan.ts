import { useEffect, useRef, useState } from 'react';

export function useMousePan() {
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const isPanModeRef = useRef(isPanMode);
  isPanModeRef.current = isPanMode;

  const isSpaceHeldRef = useRef(isSpaceHeld);
  isSpaceHeldRef.current = isSpaceHeld;

  const dragRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    targetXElement: null as HTMLElement | null,
    targetYElement: null as HTMLElement | null,
    hasMovedPastThreshold: false,
  });

  useEffect(() => {
    // Keyboard listener for Spacebar (hold to pan) and H key (toggle pan mode)
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpaceHeld(true);
      } else if (e.key === 'h' || e.key === 'H') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          setIsPanMode((prev) => !prev);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update body class for pan mode
  useEffect(() => {
    if (isPanMode || isSpaceHeld) {
      document.body.classList.add('pan-mode-active');
    } else {
      document.body.classList.remove('pan-mode-active');
    }
  }, [isPanMode, isSpaceHeld]);

  useEffect(() => {
    const findScrollableAncestor = (
      el: HTMLElement | null,
      direction: 'x' | 'y'
    ): HTMLElement | null => {
      let curr = el;
      while (curr && curr !== document.body && curr !== document.documentElement) {
        const style = window.getComputedStyle(curr);
        if (direction === 'x') {
          const overflowX = style.overflowX;
          if (
            (overflowX === 'auto' || overflowX === 'scroll') &&
            curr.scrollWidth > curr.clientWidth + 2
          ) {
            return curr;
          }
        } else {
          const overflowY = style.overflowY;
          if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            curr.scrollHeight > curr.clientHeight + 2
          ) {
            return curr;
          }
        }
        curr = curr.parentElement;
      }
      return null;
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Only process primary (left) mouse button click
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Do not pan if inside an open modal popup
      if (target.closest('.fixed.inset-0.z-50')) {
        return;
      }

      // If clicking inside an editable input and not in explicit pan mode, permit native text focus/selection
      const isInput = target.closest('input, textarea, select, [contenteditable="true"]');
      if (isInput && !isPanModeRef.current && !isSpaceHeldRef.current) {
        return;
      }

      const scrollParentX = findScrollableAncestor(target, 'x');
      const scrollParentY = findScrollableAncestor(target, 'y');

      dragRef.current = {
        isDown: true,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        targetXElement: scrollParentX,
        targetYElement: scrollParentY,
        hasMovedPastThreshold: false,
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.isDown) return;

      const deltaXFromStart = e.clientX - dragRef.current.startX;
      const deltaYFromStart = e.clientY - dragRef.current.startY;
      const totalDist = Math.hypot(deltaXFromStart, deltaYFromStart);

      // Subtle 4px threshold prevents treating casual clicks as drags
      if (!dragRef.current.hasMovedPastThreshold) {
        if (totalDist < 4) {
          return;
        }
        dragRef.current.hasMovedPastThreshold = true;
        document.body.classList.add('is-dragging-pan');
        setIsDragging(true);
      }

      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;

      // Move view horizontally: first scroll table/container if present, otherwise window
      if (dragRef.current.targetXElement) {
        const prevScrollLeft = dragRef.current.targetXElement.scrollLeft;
        dragRef.current.targetXElement.scrollLeft -= dx;
        const scrolled = prevScrollLeft - dragRef.current.targetXElement.scrollLeft;
        const remainderDx = dx - scrolled;
        if (Math.abs(remainderDx) > 0.5) {
          window.scrollBy(-remainderDx, 0);
        }
      } else {
        window.scrollBy(-dx, 0);
      }

      // Move view vertically: first scroll nested container if present, otherwise document/window
      if (dragRef.current.targetYElement) {
        const prevScrollTop = dragRef.current.targetYElement.scrollTop;
        dragRef.current.targetYElement.scrollTop -= dy;
        const scrolled = prevScrollTop - dragRef.current.targetYElement.scrollTop;
        const remainderDy = dy - scrolled;
        if (Math.abs(remainderDy) > 0.5) {
          window.scrollBy(0, -remainderDy);
        }
      } else {
        window.scrollBy(0, -dy);
      }

      // Prevent default text selection and native drag ghost while panning
      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (!dragRef.current.isDown) return;

      const hadMoved = dragRef.current.hasMovedPastThreshold;
      dragRef.current.isDown = false;
      document.body.classList.remove('is-dragging-pan');
      setIsDragging(false);

      if (hadMoved) {
        // Prevent click trigger on whatever element is underneath mouseup after a drag
        const captureClick = (clickEvent: MouseEvent) => {
          clickEvent.stopPropagation();
          clickEvent.preventDefault();
        };
        window.addEventListener('click', captureClick, { capture: true, once: true });
        setTimeout(() => {
          window.removeEventListener('click', captureClick, { capture: true });
        }, 120);
      }
    };

    window.addEventListener('mousedown', handleMouseDown, { passive: false });
    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('is-dragging-pan');
      document.body.classList.remove('pan-mode-active');
    };
  }, []);

  const resetView = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    document.querySelectorAll('.overflow-x-auto').forEach((el) => {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    });
  };

  return {
    isPanMode,
    setIsPanMode,
    isSpaceHeld,
    isDragging,
    resetView,
  };
}
