import { useEffect, useCallback, useRef } from "react";
import { useStore } from "@/shared/store";
import type { SlideElement } from "@/features/canvas/types";
import { generateElementId } from "@/features/canvas/types";
import Toolbar from "@/features/toolbar/Toolbar";
import ThumbnailPanel from "@/features/thumbnails/ThumbnailPanel";
import SlideCanvas from "@/features/canvas/SlideCanvas";
import PropertiesPanel from "@/features/properties/PropertiesPanel";
import PresenterMode from "@/features/presenter/PresenterMode";
import HomeScreen from "@/features/home/HomeScreen";
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
      // Cmd+V Paste
      if (meta && e.key === "v" && !shift && clipboardRef.current.length > 0) {
        // Don't paste if typing in an input
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
        // Update clipboard with new positions for cascading paste
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
      // Delete / Backspace
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !meta &&
        selectedElementIds.length > 0
      ) {
        // Don't delete if we're editing text
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
      // F5 or Cmd+Shift+P: Present
      if (e.key === "F5" || (meta && shift && e.key === "p")) {
        e.preventDefault();
        setPresenterActive(true);
        return;
      }

      // Tool shortcuts (single key, no modifier)
      if (!meta && !shift && !e.altKey) {
        switch (e.key) {
          case "v":
          case "V":
            setToolMode("select");
            break;
          case "t":
          case "T":
            // Don't switch to text tool if typing in an input
            if (
              document.activeElement?.tagName !== "INPUT" &&
              document.activeElement?.tagName !== "TEXTAREA"
            ) {
              setToolMode("text");
            }
            break;
          case "s":
          case "S":
            if (
              document.activeElement?.tagName !== "INPUT" &&
              document.activeElement?.tagName !== "TEXTAREA"
            ) {
              setToolMode("shape");
            }
            break;
          case "l":
          case "L":
            if (
              document.activeElement?.tagName !== "INPUT" &&
              document.activeElement?.tagName !== "TEXTAREA"
            ) {
              setToolMode("line");
            }
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
        <div className="flex-1 min-w-0">
          <SlideCanvas />
        </div>

        {/* Properties */}
        <div className="w-[280px] min-w-[200px] border-l border-slide-border flex-shrink-0">
          <PropertiesPanel />
        </div>
      </div>

      {/* Presenter overlay */}
      <PresenterMode />
    </div>
  );
}
