import React, { useCallback, useState, useEffect } from "react";
import { useStore } from "@/shared/store";
import { SLIDE_WIDTH, SLIDE_HEIGHT, getSlideRenderMode } from "@/features/canvas/types";
import type { Slide } from "@/features/canvas/types";
import { Plus } from "lucide-react";
import { useThumbnailImage } from "./useThumbnailRenderer";
import { HtmlSlideRenderer } from "@/features/canvas/HtmlSlideRenderer";

function ThumbnailItem({
  index,
  isActive,
  slide,
  onSelect,
  onContextMenu,
}: {
  index: number;
  isActive: boolean;
  slide: Slide;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const isHtml = getSlideRenderMode(slide) === "html";
  const thumbUrl = useThumbnailImage(isHtml ? undefined : slide);

  // Thumbnail width is ~192px (panel width minus padding)
  const thumbWidth = 192;
  const thumbHeight = Math.round(thumbWidth * (SLIDE_HEIGHT / SLIDE_WIDTH));

  return (
    <button
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`group relative w-full rounded-lg overflow-hidden transition-all duration-150 ${
        isActive
          ? "ring-2 ring-morado-500 ring-offset-2 ring-offset-slide-panel"
          : "ring-1 ring-white/10 hover:ring-white/20"
      }`}
      style={{ aspectRatio: `${SLIDE_WIDTH}/${SLIDE_HEIGHT}` }}
    >
      {isHtml && slide.html ? (
        <HtmlSlideRenderer
          html={slide.html}
          width={thumbWidth}
          height={thumbHeight}
        />
      ) : thumbUrl ? (
        <img
          src={thumbUrl}
          alt={`Slide ${index + 1}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            backgroundColor:
              slide.background?.type === "solid"
                ? slide.background.color
                : "#0f0f17",
          }}
        >
          <span className="text-white/20 text-xs">Loading...</span>
        </div>
      )}
      <div className="absolute bottom-1 right-1.5 text-[10px] text-white/40 bg-black/40 px-1 rounded">
        {index + 1}
      </div>
    </button>
  );
}

export default function ThumbnailPanel() {
  const presentation = useStore((s) => s.presentation);
  const currentSlideIndex = useStore((s) => s.currentSlideIndex);
  const setCurrentSlide = useStore((s) => s.setCurrentSlide);
  const addSlide = useStore((s) => s.addSlide);
  const removeSlide = useStore((s) => s.removeSlide);
  const duplicateSlide = useStore((s) => s.duplicateSlide);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, index });
    },
    []
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Close context menu on any click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  return (
    <div
      className="h-full flex flex-col bg-slide-panel border-r border-slide-border"
      onClick={closeContextMenu}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slide-border">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Slides
        </span>
        <button
          onClick={() => addSlide(currentSlideIndex)}
          className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
          title="Add slide"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Thumbnails */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {presentation.slides.map((slide, i) => (
            <ThumbnailItem
              key={slide.id}
              index={i}
              isActive={i === currentSlideIndex}
              slide={slide}
              onSelect={() => setCurrentSlide(i)}
              onContextMenu={(e) => handleContextMenu(e, i)}
            />
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-neutral-900 border border-slide-border rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-morado-500/20 text-white/80"
            onClick={() => {
              addSlide(contextMenu.index);
              closeContextMenu();
            }}
          >
            Add slide after
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-morado-500/20 text-white/80"
            onClick={() => {
              duplicateSlide(contextMenu.index);
              closeContextMenu();
            }}
          >
            Duplicate
          </button>
          {presentation.slides.length > 1 && (
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-500/20 text-red-400"
              onClick={() => {
                removeSlide(contextMenu.index);
                closeContextMenu();
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
