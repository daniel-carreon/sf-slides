import { useRef, useCallback, useState } from "react";
import type { SlideElement } from "./types";
import { SLIDE_WIDTH } from "./types";

interface ElementOverlayProps {
  elements: SlideElement[];
  selectedIds: string[];
  displayWidth: number;
  displayHeight: number;
  iframeEl: HTMLIFrameElement | null;
  onSelect: (ids: string[]) => void;
  onMove: (id: string, dx: number, dy: number) => void;
}

/**
 * Transparent overlay layer on top of HTML slides.
 * Renders positioned divs matching element bounds for click-to-select and drag-to-move.
 * Injects CSS transforms into the iframe to move HTML elements visually in real-time.
 */
export default function ElementOverlay({
  elements,
  selectedIds,
  displayWidth,
  displayHeight,
  iframeEl,
  onSelect,
  onMove,
}: ElementOverlayProps) {
  const [dragging, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    accumDx: number;
    accumDy: number;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Scale factor: element coords (1920x1080) → display pixels
  const scale = displayWidth / SLIDE_WIDTH;

  // Filter to meaningful elements (skip tiny decorative ones)
  const interactiveElements = elements.filter(
    (el) => el.width > 20 && el.height > 20
  );

  /** Inject a CSS transform on the corresponding HTML element inside the iframe */
  const applyIframeTransform = useCallback(
    (elId: string, dx: number, dy: number) => {
      if (!iframeEl) return;
      try {
        const iframeDoc = iframeEl.contentDocument;
        if (!iframeDoc) return;
        const target = iframeDoc.querySelector(`[data-el="${elId}"]`);
        if (target) {
          (target as HTMLElement).style.transform = `translate(${dx}px, ${dy}px)`;
          (target as HTMLElement).style.transition = "none";
        }
      } catch {
        // Cross-origin iframe access may fail silently
      }
    },
    [iframeEl]
  );

  /** Clear all injected transforms */
  const clearIframeTransforms = useCallback(() => {
    if (!iframeEl) return;
    try {
      const iframeDoc = iframeEl.contentDocument;
      if (!iframeDoc) return;
      iframeDoc.querySelectorAll("[data-el]").forEach((el) => {
        (el as HTMLElement).style.transform = "";
        (el as HTMLElement).style.transition = "";
      });
    } catch {
      // Cross-origin iframe access may fail silently
    }
  }, [iframeEl]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, elId: string) => {
      e.stopPropagation();
      onSelect([elId]);
      setDragging({ id: elId, startX: e.clientX, startY: e.clientY, accumDx: 0, accumDy: 0 });
    },
    [onSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        const totalDx = dragging.accumDx + dx;
        const totalDy = dragging.accumDy + dy;

        // Convert display pixels to 1920x1080 coordinate space for iframe transform
        const scaleInv = SLIDE_WIDTH / displayWidth;
        applyIframeTransform(dragging.id, totalDx * scaleInv, totalDy * scaleInv);

        setDragging({
          ...dragging,
          startX: e.clientX,
          startY: e.clientY,
          accumDx: totalDx,
          accumDy: totalDy,
        });
      }
    },
    [dragging, displayWidth, applyIframeTransform]
  );

  const handleMouseUp = useCallback(() => {
    if (dragging && (Math.abs(dragging.accumDx) > 2 || Math.abs(dragging.accumDy) > 2)) {
      // Commit the move to the store (updates element coordinates for PPTX export)
      const scaleInv = SLIDE_WIDTH / displayWidth;
      onMove(dragging.id, dragging.accumDx * scaleInv, dragging.accumDy * scaleInv);
      // Clear the CSS transform (position is now baked into the element data)
      // Note: the HTML won't visually update since it's static,
      // but the transform stays until the slide re-renders
    }
    setDragging(null);
  }, [dragging, displayWidth, onMove]);

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onSelect([]);
      }
    },
    [onSelect]
  );

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0"
      style={{ pointerEvents: "auto" }}
      onClick={handleBackgroundClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {interactiveElements.map((el) => {
        const isSelected = selectedIds.includes(el.id);
        // Apply accumulated drag offset to overlay position
        const dragOffset =
          dragging && dragging.id === el.id
            ? { x: dragging.accumDx, y: dragging.accumDy }
            : { x: 0, y: 0 };
        const x = el.x * scale + dragOffset.x;
        const y = el.y * scale + dragOffset.y;
        const w = el.width * scale;
        const h = el.height * scale;

        return (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: h,
              border: isSelected
                ? "2px solid #8B5CF6"
                : "1px solid transparent",
              borderRadius: 4,
              cursor: isSelected ? "move" : "pointer",
              transition: dragging ? "none" : "border-color 0.1s",
              boxSizing: "border-box",
            }}
            className={isSelected ? "" : "hover:border-white/20"}
            onMouseDown={(e) => handleMouseDown(e, el.id)}
            title={el.type === "text" ? (el as any).content?.substring(0, 40) : el.type}
          >
            {/* Selection handles */}
            {isSelected && (
              <>
                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-morado-500 rounded-full" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-morado-500 rounded-full" />
                <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-morado-500 rounded-full" />
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-morado-500 rounded-full" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
