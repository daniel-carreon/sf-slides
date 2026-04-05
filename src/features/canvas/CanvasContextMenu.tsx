import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/shared/store";
import type { SlideElement } from "@/features/canvas/types";
import {
  Copy,
  Scissors,
  ClipboardPaste,
  Trash2,
  CopyPlus,
  ArrowUpToLine,
  ArrowDownToLine,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlignCenterHorizontal,
  AlignCenterVertical,
} from "lucide-react";

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
}

// Module-level clipboard so it persists across re-renders
let clipboardElements: SlideElement[] = [];

export default function CanvasContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false });
  const selectedElementIds = useStore((s) => s.selectedElementIds);
  const currentSlideIndex = useStore((s) => s.currentSlideIndex);
  const presentation = useStore((s) => s.presentation);
  const removeElements = useStore((s) => s.removeElements);
  const duplicateElements = useStore((s) => s.duplicateElements);
  const bringToFront = useStore((s) => s.bringToFront);
  const sendToBack = useStore((s) => s.sendToBack);
  const updateElement = useStore((s) => s.updateElement);
  const addElement = useStore((s) => s.addElement);
  const alignElements = useStore((s) => s.alignElements);

  const hasSelection = selectedElementIds.length > 0;
  const singleSelection = selectedElementIds.length === 1;
  const slide = presentation.slides[currentSlideIndex];

  const selectedElement = singleSelection
    ? slide?.elements.find((e) => e.id === selectedElementIds[0])
    : null;

  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Only show on canvas area (not toolbar, panels, thumbnails)
    if (target.closest("[data-canvas-area]") || target.closest(".slide-canvas-wrapper")) {
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY, visible: true });
    }
  }, []);

  const close = useCallback(() => setMenu((m) => ({ ...m, visible: false })), []);

  useEffect(() => {
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [handleContextMenu, close]);

  const doCopy = () => {
    if (!slide) return;
    clipboardElements = selectedElementIds
      .map((id) => slide.elements.find((e) => e.id === id))
      .filter((e): e is SlideElement => !!e)
      .map((e) => JSON.parse(JSON.stringify(e)));
    close();
  };

  const doCut = () => {
    doCopy();
    removeElements(selectedElementIds);
  };

  const doPaste = () => {
    if (clipboardElements.length === 0) return;
    const newIds: string[] = [];
    for (const el of clipboardElements) {
      const { id: _, ...rest } = el;
      const newId = addElement({ ...rest, x: el.x + 30, y: el.y + 30 } as Omit<SlideElement, "id">);
      newIds.push(newId);
    }
    clipboardElements = clipboardElements.map((el) => ({ ...el, x: el.x + 30, y: el.y + 30 }));
    useStore.getState().setSelectedElements(newIds);
    close();
  };

  const doDuplicate = () => {
    duplicateElements(selectedElementIds);
    close();
  };

  const doDelete = () => {
    removeElements(selectedElementIds);
    close();
  };

  const doBringToFront = () => {
    if (singleSelection) bringToFront(selectedElementIds[0]);
    close();
  };

  const doSendToBack = () => {
    if (singleSelection) sendToBack(selectedElementIds[0]);
    close();
  };

  const doToggleLock = () => {
    if (selectedElement) {
      updateElement(selectedElement.id, { locked: !selectedElement.locked });
    }
    close();
  };

  const doAlignCenter = () => {
    if (hasSelection) alignElements(selectedElementIds, "center");
    close();
  };

  const doAlignMiddle = () => {
    if (hasSelection) alignElements(selectedElementIds, "middle");
    close();
  };

  const doSelectAll = () => {
    if (slide) {
      useStore.getState().setSelectedElements(
        slide.elements.filter((e) => !e.locked).map((e) => e.id)
      );
    }
    close();
  };

  if (!menu.visible) return null;

  return (
    <div
      className="fixed z-[9999] min-w-[200px] py-1 bg-slide-panel border border-slide-border rounded-lg shadow-2xl"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Edit actions */}
      <MenuItem icon={<Scissors size={14} />} label="Cut" shortcut="Cmd+X" onClick={doCut} disabled={!hasSelection} />
      <MenuItem icon={<Copy size={14} />} label="Copy" shortcut="Cmd+C" onClick={doCopy} disabled={!hasSelection} />
      <MenuItem icon={<ClipboardPaste size={14} />} label="Paste" shortcut="Cmd+V" onClick={doPaste} disabled={clipboardElements.length === 0} />
      <MenuItem icon={<CopyPlus size={14} />} label="Duplicate" shortcut="Cmd+D" onClick={doDuplicate} disabled={!hasSelection} />

      <Divider />

      {/* Layer actions */}
      <MenuItem icon={<ArrowUpToLine size={14} />} label="Bring to Front" shortcut="Cmd+]" onClick={doBringToFront} disabled={!singleSelection} />
      <MenuItem icon={<ArrowDownToLine size={14} />} label="Send to Back" shortcut="Cmd+[" onClick={doSendToBack} disabled={!singleSelection} />

      <Divider />

      {/* Align */}
      <MenuItem icon={<AlignCenterHorizontal size={14} />} label="Center Horizontally" onClick={doAlignCenter} disabled={!hasSelection} />
      <MenuItem icon={<AlignCenterVertical size={14} />} label="Center Vertically" onClick={doAlignMiddle} disabled={!hasSelection} />

      <Divider />

      {/* Lock/Unlock */}
      {selectedElement && (
        <MenuItem
          icon={selectedElement.locked ? <Unlock size={14} /> : <Lock size={14} />}
          label={selectedElement.locked ? "Unlock" : "Lock"}
          onClick={doToggleLock}
        />
      )}

      {/* Select All */}
      <MenuItem icon={<Eye size={14} />} label="Select All" shortcut="Cmd+A" onClick={doSelectAll} />

      <Divider />

      {/* Delete */}
      <MenuItem icon={<Trash2 size={14} />} label="Delete" shortcut="Del" onClick={doDelete} disabled={!hasSelection} variant="danger" />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "danger";
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
        disabled
          ? "text-white/20 cursor-default"
          : variant === "danger"
            ? "text-red-400 hover:bg-red-500/10"
            : "text-white/80 hover:bg-white/8"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="text-[10px] text-white/30 ml-4">{shortcut}</span>}
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-white/10 my-1" />;
}
