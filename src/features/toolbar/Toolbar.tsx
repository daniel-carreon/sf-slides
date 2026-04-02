import { useStore } from "@/shared/store";
import type { ToolMode } from "@/features/canvas/types";
import { useFileOperations } from "@/features/file-io/useFileOperations";
import {
  MousePointer2,
  Type,
  Square,
  Image,
  Minus,
  Plus,
  Download,
  Upload,
  Play,
  FilePlus,
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  ZoomIn,
  ZoomOut,
  Layers,
  Grid3x3,
} from "lucide-react";

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  variant?: "default" | "danger";
}

function ToolButton({ icon, label, active, onClick, variant }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-2 rounded-md transition-all duration-100 ${
        active
          ? "bg-morado-500/30 text-morado-400"
          : variant === "danger"
            ? "text-white/50 hover:text-red-400 hover:bg-red-500/10"
            : "text-white/50 hover:text-white/80 hover:bg-white/8"
      }`}
    >
      {icon}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-white/10 mx-1" />;
}

export default function Toolbar() {
  const toolMode = useStore((s) => s.toolMode);
  const setToolMode = useStore((s) => s.setToolMode);
  const zoom = useStore((s) => s.zoom);
  const setZoom = useStore((s) => s.setZoom);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const addSlide = useStore((s) => s.addSlide);
  const selectedElementIds = useStore((s) => s.selectedElementIds);
  const removeElements = useStore((s) => s.removeElements);
  const duplicateElements = useStore((s) => s.duplicateElements);
  const currentSlideIndex = useStore((s) => s.currentSlideIndex);
  const setPresenterActive = useStore((s) => s.setPresenterActive);
  const undoStack = useStore((s) => s.undoStack);
  const redoStack = useStore((s) => s.redoStack);
  const setAppView = useStore((s) => s.setAppView);
  const presentationTitle = useStore((s) => s.presentation.metadata?.title || "Untitled");
  const showGrid = useStore((s) => s.showGrid);
  const setShowGrid = useStore((s) => s.setShowGrid);
  const { save, open, importPptxFile } = useFileOperations();

  const tools: { mode: ToolMode; icon: React.ReactNode; label: string }[] = [
    { mode: "select", icon: <MousePointer2 size={16} />, label: "Select (V)" },
    { mode: "text", icon: <Type size={16} />, label: "Text (T)" },
    { mode: "shape", icon: <Square size={16} />, label: "Shape (S)" },
    { mode: "image", icon: <Image size={16} />, label: "Image (I)" },
    { mode: "line", icon: <Minus size={16} />, label: "Line (L)" },
  ];

  return (
    <div className="flex items-center gap-0.5 pl-24 pr-3 py-1.5 bg-slide-panel border-b border-slide-border titlebar-drag">
      {/* Home button + title */}
      <div className="flex items-center gap-2 titlebar-no-drag mr-2">
        <button
          onClick={() => setAppView("home")}
          title="Back to Home"
          className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
        >
          <img src="/sf-logo.png" alt="Home" className="w-full h-full" draggable={false} />
        </button>
        <span className="text-sm text-white/60 font-medium truncate max-w-[160px]">
          {presentationTitle}
        </span>
      </div>

      <Separator />

      {/* File actions */}
      <div className="flex items-center gap-0.5 titlebar-no-drag">
        <ToolButton
          icon={<FilePlus size={16} />}
          label="New presentation"
          onClick={() => {
            import("@/features/canvas/types").then((m) =>
              useStore.getState().setPresentation(m.createDefaultPresentation())
            );
          }}
        />
        <ToolButton
          icon={<FolderOpen size={16} />}
          label="Open (Cmd+O)"
          onClick={() => { open(); }}
        />
        <ToolButton
          icon={<Save size={16} />}
          label="Save (Cmd+S)"
          onClick={() => { save(); }}
        />
        <ToolButton
          icon={<Upload size={16} />}
          label="Import PPTX"
          onClick={() => { importPptxFile(); }}
        />
      </div>

      <Separator />

      {/* Tools */}
      <div className="flex items-center gap-0.5 titlebar-no-drag">
        {tools.map((t) => (
          <ToolButton
            key={t.mode}
            icon={t.icon}
            label={t.label}
            active={toolMode === t.mode}
            onClick={() => setToolMode(t.mode)}
          />
        ))}
      </div>

      <Separator />

      {/* Edit actions */}
      <div className="flex items-center gap-0.5 titlebar-no-drag">
        <ToolButton
          icon={<Undo2 size={16} />}
          label="Undo (Cmd+Z)"
          onClick={undo}
        />
        <ToolButton
          icon={<Redo2 size={16} />}
          label="Redo (Cmd+Shift+Z)"
          onClick={redo}
        />
        {selectedElementIds.length > 0 && (
          <>
            <ToolButton
              icon={<Copy size={16} />}
              label="Duplicate (Cmd+D)"
              onClick={() => duplicateElements(selectedElementIds)}
            />
            <ToolButton
              icon={<Trash2 size={16} />}
              label="Delete"
              variant="danger"
              onClick={() => removeElements(selectedElementIds)}
            />
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-1 titlebar-no-drag">
        {/* Zoom */}
        <ToolButton
          icon={<ZoomOut size={14} />}
          label="Zoom out"
          onClick={() => setZoom(zoom - 0.1)}
        />
        <span className="text-xs text-white/40 w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <ToolButton
          icon={<ZoomIn size={14} />}
          label="Zoom in"
          onClick={() => setZoom(zoom + 0.1)}
        />

        <ToolButton
          icon={<Grid3x3 size={14} />}
          label="Toggle grid"
          active={showGrid}
          onClick={() => setShowGrid(!showGrid)}
        />

        <Separator />

        {/* Add slide */}
        <ToolButton
          icon={<Plus size={16} />}
          label="Add slide"
          onClick={() => addSlide(currentSlideIndex)}
        />

        <Separator />

        {/* Export PPTX */}
        <button
          onClick={() => {
            import("@/features/export/exportPptx").then((m) =>
              m.exportPresentation()
            );
          }}
          title="Export as PowerPoint (.pptx)"
          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-white/50 hover:text-white/80 hover:bg-white/8 transition-all text-xs"
        >
          <Download size={14} />
          <span>.pptx</span>
        </button>

        {/* Present */}
        <button
          onClick={() => setPresenterActive(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-morado-500 hover:bg-morado-600 text-white text-sm font-medium transition-colors"
        >
          <Play size={14} />
          Present
        </button>
      </div>
    </div>
  );
}
