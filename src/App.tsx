import { useEffect, useCallback, useRef, useState } from "react";
import { useStore } from "@/shared/store";
import type { SlideElement } from "@/features/canvas/types";
import { generateElementId } from "@/features/canvas/types";
import Toolbar from "@/features/toolbar/Toolbar";
import ThumbnailPanel from "@/features/thumbnails/ThumbnailPanel";
import SlideCanvas from "@/features/canvas/SlideCanvas";
import PropertiesPanel from "@/features/properties/PropertiesPanel";
import PresenterMode from "@/features/presenter/PresenterMode";
import HomeScreen from "@/features/home/HomeScreen";
import FindReplace from "@/features/find-replace/FindReplace";
import CanvasContextMenu from "@/features/canvas/CanvasContextMenu";
import { useFileOperations } from "@/features/file-io/useFileOperations";
import { useFileWatcher } from "@/features/file-io/useFileWatcher";

export default function App() {
  const appView = useStore((s) => s.appView);

  if (appView === "home") {
    return <HomeScreen />;
  }

  return <EditorView />;
}

function EditorView() {
  const { save, saveAs, open, newPresentation } = useFileOperations();
  useFileWatcher();
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);

  const setToolMode = useStore((s) => s.setToolMode);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const selectedElementIds = useStore((s) => s.selectedElementIds);
  const removeElements = useStore((s) => s.removeElements);
  const duplicateElements = useStore((s) => s.duplicateElements);
  const setPresenterActive = useStore((s) => s.setPresenterActive);
  const currentSlideIndex = useStore((s) => s.currentSlideIndex);
  const setCurrentSlide = useStore((s) => s.setCurrentSlide);
  const presentation = useStore((s) => s.presentation);
  const presenterActive = useStore((s) => s.presenterActive);
  const addElement = useStore((s) => s.addElement);

  const clipboardRef = useRef<SlideElement[]>([]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (presenterActive) return; // Presenter handles its own keys

      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;

      // Cmd+S Save
      if (meta && e.key === "s" && !shift) {
        e.preventDefault();
        save();
        return;
      }
      // Cmd+Shift+S Save As
      if (meta && e.key === "s" && shift) {
        e.preventDefault();
        saveAs();
        return;
      }
      // Cmd+O Open
      if (meta && e.key === "o") {
        e.preventDefault();
        open();
        return;
      }
      // Cmd+N New
      if (meta && e.key === "n") {
        e.preventDefault();
        newPresentation();
        return;
      }
      // Cmd+F Find
      if (meta && e.key === "f") {
        e.preventDefault();
        setFindReplaceOpen(true);
        return;
      }
      // Cmd+Z Undo
      if (meta && e.key === "z" && !shift) {
        e.preventDefault();
        undo();
        return;
      }
      // Cmd+Shift+Z Redo
      if (meta && e.key === "z" && shift) {
        e.preventDefault();
        redo();
        return;
      }
      // Cmd+A Select All
      if (meta && e.key === "a") {
        const active = document.activeElement;
        if (
          active?.tagName === "INPUT" ||
          active?.tagName === "TEXTAREA" ||
          (active as HTMLElement)?.contentEditable === "true"
        ) {
          return;
        }
        e.preventDefault();
        const slide = presentation.slides[currentSlideIndex];
        if (slide) {
          useStore.getState().setSelectedElements(
            slide.elements.filter((el) => !el.locked).map((el) => el.id)
          );
        }
        return;
      }
      // Cmd+C Copy
      if (meta && e.key === "c" && !shift && selectedElementIds.length > 0) {
        const slide = presentation.slides[currentSlideIndex];
        if (slide) {
          clipboardRef.current = selectedElementIds
            .map((id) => slide.elements.find((el) => el.id === id))
            .filter((el): el is SlideElement => !!el)
            .map((el) => JSON.parse(JSON.stringify(el)));
        }
        return;
      }
      // Cmd+X Cut
      if (meta && e.key === "x" && !shift && selectedElementIds.length > 0) {
        const slide = presentation.slides[currentSlideIndex];
        if (slide) {
          clipboardRef.current = selectedElementIds
            .map((id) => slide.elements.find((el) => el.id === id))
            .filter((el): el is SlideElement => !!el)
            .map((el) => JSON.parse(JSON.stringify(el)));
          removeElements(selectedElementIds);
        }
        return;
      }
      // Cmd+V Paste
      if (meta && e.key === "v" && !shift && clipboardRef.current.length > 0) {
        const active = document.activeElement;
        if (
          active?.tagName === "INPUT" ||
          active?.tagName === "TEXTAREA" ||
          (active as HTMLElement)?.contentEditable === "true"
        ) {
          return;
        }
        e.preventDefault();
        const newIds: string[] = [];
        for (const el of clipboardRef.current) {
          const { id: _old, ...rest } = el;
          const newEl = { ...rest, x: el.x + 30, y: el.y + 30 };
          const newId = addElement(newEl as Omit<SlideElement, "id">);
          newIds.push(newId);
        }
        clipboardRef.current = clipboardRef.current.map((el) => ({
          ...el,
          x: el.x + 30,
          y: el.y + 30,
        }));
        useStore.getState().setSelectedElements(newIds);
        return;
      }
      // Cmd+D Duplicate
      if (meta && e.key === "d") {
        e.preventDefault();
        if (selectedElementIds.length > 0) {
          duplicateElements(selectedElementIds);
        }
        return;
      }
      // Cmd+] Bring to Front / Cmd+[ Send to Back
      if (meta && e.key === "]" && selectedElementIds.length === 1) {
        e.preventDefault();
        useStore.getState().bringToFront(selectedElementIds[0]);
        return;
      }
      if (meta && e.key === "[" && selectedElementIds.length === 1) {
        e.preventDefault();
        useStore.getState().sendToBack(selectedElementIds[0]);
        return;
      }
      // Delete / Backspace
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !meta &&
        selectedElementIds.length > 0
      ) {
        const active = document.activeElement;
        if (
          active?.tagName === "INPUT" ||
          active?.tagName === "TEXTAREA" ||
          (active as HTMLElement)?.contentEditable === "true"
        ) {
          return;
        }
        e.preventDefault();
        removeElements(selectedElementIds);
        return;
      }
      // Arrow keys: Nudge selected elements (1px, or 10px with Shift)
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) &&
        selectedElementIds.length > 0 &&
        !meta
      ) {
        const active = document.activeElement;
        if (
          active?.tagName === "INPUT" ||
          active?.tagName === "TEXTAREA" ||
          (active as HTMLElement)?.contentEditable === "true"
        ) {
          return;
        }
        e.preventDefault();
        const nudge = shift ? 10 : 1;
        const store = useStore.getState();
        for (const id of selectedElementIds) {
          const slide = store.presentation.slides[store.currentSlideIndex];
          const el = slide?.elements.find((el) => el.id === id);
          if (!el) continue;
          const dx = e.key === "ArrowRight" ? nudge : e.key === "ArrowLeft" ? -nudge : 0;
          const dy = e.key === "ArrowDown" ? nudge : e.key === "ArrowUp" ? -nudge : 0;
          store.updateElement(id, { x: el.x + dx, y: el.y + dy });
        }
        return;
      }
      // F5 or Cmd+Shift+P: Present
      if (e.key === "F5" || (meta && shift && e.key === "p")) {
        e.preventDefault();
        setPresenterActive(true);
        return;
      }

      // Tool shortcuts (single key, no modifier)
      if (!meta && !shift && !e.altKey) {
        const notTyping =
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA";
        switch (e.key) {
          case "v":
          case "V":
            setToolMode("select");
            break;
          case "t":
          case "T":
            if (notTyping) setToolMode("text");
            break;
          case "s":
          case "S":
            if (notTyping) setToolMode("shape");
            break;
          case "i":
          case "I":
            if (notTyping) setToolMode("image");
            break;
          case "l":
          case "L":
            if (notTyping) setToolMode("line");
            break;
          case "h":
          case "H":
            if (notTyping) setToolMode("hand");
            break;
          case "Escape":
            useStore.getState().clearSelection();
            setToolMode("select");
            break;
        }
      }

      // Arrow keys for slide navigation
      if (e.key === "PageDown") {
        e.preventDefault();
        setCurrentSlide(
          Math.min(currentSlideIndex + 1, presentation.slides.length - 1)
        );
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        setCurrentSlide(Math.max(currentSlideIndex - 1, 0));
      }
    },
    [
      save,
      saveAs,
      open,
      newPresentation,
      undo,
      redo,
      selectedElementIds,
      removeElements,
      duplicateElements,
      addElement,
      setToolMode,
      setPresenterActive,
      presenterActive,
      currentSlideIndex,
      presentation,
      setCurrentSlide,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Paste images from clipboard (screenshots, copied images)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        (active as HTMLElement)?.contentEditable === "true"
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const img = new Image();
            img.onload = () => {
              // Scale down if too large (max 800px width)
              let w = img.width;
              let h = img.height;
              if (w > 800) {
                h = Math.round(h * (800 / w));
                w = 800;
              }
              // Center on slide
              const x = Math.round((1920 - w) / 2);
              const y = Math.round((1080 - h) / 2);

              const newId = addElement({
                type: "image",
                x, y, width: w, height: h,
                src: dataUrl,
                opacity: 1,
                rotation: 0,
              } as Omit<SlideElement, "id">);
              useStore.getState().setSelectedElements([newId]);
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addElement]);

  const [notesOpen, setNotesOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const notesSlide = useStore((s) => s.presentation.slides[s.currentSlideIndex]);
  const notesIndex = useStore((s) => s.currentSlideIndex);
  const updateSlideNotes = useStore((s) => s.updateSlideNotes);

  // Option+N toggle notes, Option+P toggle properties panel
  useEffect(() => {
    const handleToggle = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === "n" || e.key === "N" || e.key === "ñ") {
        e.preventDefault();
        setNotesOpen((v) => !v);
      }
      if (e.key === "p" || e.key === "P" || e.key === "π") {
        e.preventDefault();
        setPanelOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleToggle);
    return () => window.removeEventListener("keydown", handleToggle);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-neutral-950">
      {/* Toolbar */}
      <Toolbar />

      {/* Main content */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Thumbnails */}
        <div className="w-[200px] min-w-[160px] border-r border-slide-border flex-shrink-0">
          <ThumbnailPanel />
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0" data-canvas-area>
          <SlideCanvas />
        </div>

        {/* Properties — Toggle with Option+P */}
        {panelOpen && (
          <div className="w-[280px] min-w-[200px] border-l border-slide-border flex-shrink-0">
            <PropertiesPanel />
          </div>
        )}
      </div>

      {/* Speaker Notes Bar (bottom) — Toggle with Option+N */}
      {notesOpen && (
        <div className="border-t border-slide-border bg-slide-panel flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/5">
            <span className="text-[11px] text-white/40 font-medium tracking-wide uppercase">Speaker Notes</span>
            <button onClick={() => setNotesOpen(false)} className="text-[10px] text-white/30 hover:text-white/60">
              Option+N to close
            </button>
          </div>
          <textarea
            value={notesSlide?.notes ?? ""}
            onChange={(e) => updateSlideNotes(notesIndex, e.target.value)}
            placeholder="Add speaker notes..."
            className="w-full bg-transparent px-4 py-2 text-sm text-white/70 resize-none h-[100px] focus:outline-none placeholder:text-white/20"
          />
        </div>
      )}

      {/* Context Menu */}
      <CanvasContextMenu />

      {/* Find & Replace */}
      <FindReplace open={findReplaceOpen} onClose={() => setFindReplaceOpen(false)} />

      {/* Presenter overlay */}
      <PresenterMode />
    </div>
  );
}
