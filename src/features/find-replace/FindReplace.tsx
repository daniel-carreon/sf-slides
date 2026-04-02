import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/shared/store";
import type { TextElement } from "@/features/canvas/types";
import { X, Search, Replace, ArrowDown, ArrowUp } from "lucide-react";

interface Match {
  slideIndex: number;
  elementId: string;
  text: string;
}

export default function FindReplace({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [showReplace, setShowReplace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const presentation = useStore((s) => s.presentation);
  const setCurrentSlide = useStore((s) => s.setCurrentSlide);
  const setSelectedElements = useStore((s) => s.setSelectedElements);
  const updateElement = useStore((s) => s.updateElement);
  const pushUndo = useStore((s) => s.pushUndo);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Search
  const doSearch = useCallback(() => {
    if (!findText.trim()) {
      setMatches([]);
      return;
    }
    const found: Match[] = [];
    const query = findText.toLowerCase();
    presentation.slides.forEach((slide, si) => {
      slide.elements.forEach((el) => {
        if (el.type === "text" || el.type === "rich_text") {
          const content = (el as TextElement).content ?? "";
          if (content.toLowerCase().includes(query)) {
            found.push({ slideIndex: si, elementId: el.id, text: content });
          }
        }
      });
    });
    setMatches(found);
    setCurrentMatch(0);
    if (found.length > 0) {
      setCurrentSlide(found[0].slideIndex);
      setSelectedElements([found[0].elementId]);
    }
  }, [findText, presentation, setCurrentSlide, setSelectedElements]);

  useEffect(() => {
    doSearch();
  }, [findText, doSearch]);

  const navigateMatch = (direction: 1 | -1) => {
    if (matches.length === 0) return;
    const next = (currentMatch + direction + matches.length) % matches.length;
    setCurrentMatch(next);
    setCurrentSlide(matches[next].slideIndex);
    setSelectedElements([matches[next].elementId]);
  };

  const replaceCurrent = () => {
    if (matches.length === 0) return;
    const match = matches[currentMatch];
    pushUndo();
    const newContent = match.text.replace(
      new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      replaceText
    );
    updateElement(match.elementId, { content: newContent });
    // Re-search after replace
    setTimeout(doSearch, 50);
  };

  const replaceAll = () => {
    if (matches.length === 0) return;
    pushUndo();
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    for (const match of matches) {
      const newContent = match.text.replace(regex, replaceText);
      updateElement(match.elementId, { content: newContent });
    }
    setTimeout(doSearch, 50);
  };

  if (!open) return null;

  return (
    <div className="absolute top-14 right-4 z-50 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl p-3 w-80">
      {/* Find */}
      <div className="flex items-center gap-2">
        <Search size={14} className="text-white/30 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigateMatch(1);
            if (e.key === "Escape") onClose();
          }}
          placeholder="Find..."
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-morado-500/50"
        />
        <span className="text-[10px] text-white/30 w-12 text-center">
          {matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : "0"}
        </span>
        <button onClick={() => navigateMatch(-1)} className="p-1 text-white/40 hover:text-white/70">
          <ArrowUp size={14} />
        </button>
        <button onClick={() => navigateMatch(1)} className="p-1 text-white/40 hover:text-white/70">
          <ArrowDown size={14} />
        </button>
        <button onClick={onClose} className="p-1 text-white/40 hover:text-white/70">
          <X size={14} />
        </button>
      </div>

      {/* Replace toggle */}
      <button
        onClick={() => setShowReplace(!showReplace)}
        className="flex items-center gap-1 mt-2 text-[10px] text-white/30 hover:text-white/50"
      >
        <Replace size={10} />
        {showReplace ? "Hide" : "Show"} Replace
      </button>

      {/* Replace */}
      {showReplace && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace with..."
            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-morado-500/50"
          />
          <button
            onClick={replaceCurrent}
            className="px-2 py-1 text-[10px] bg-morado-500/20 text-morado-400 rounded hover:bg-morado-500/30"
          >
            Replace
          </button>
          <button
            onClick={replaceAll}
            className="px-2 py-1 text-[10px] bg-morado-500/20 text-morado-400 rounded hover:bg-morado-500/30"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
