import { useStore } from "@/shared/store";
import type {
  TextElement,
  ShapeElement,
  ImageElement,
  LineElement,
  SlideElement,
} from "@/features/canvas/types";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Bold,
  Italic,
  Underline,
  ArrowUpToLine,
  ArrowDownToLine,
  Lock,
  Unlock,
} from "lucide-react";

// --- Mini components ---
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider mt-3 mb-1.5 first:mt-0">
      {children}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-6">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onFocus={() => useStore.getState().pushUndo()}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80 w-16 focus:outline-none focus:border-morado-500/50"
      />
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-6">{label}</span>
      <div className="flex items-center gap-1.5 flex-1">
        <input
          type="color"
          value={value}
          onFocus={() => useStore.getState().pushUndo()}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border border-white/10 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onFocus={() => useStore.getState().pushUndo()}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/60 font-mono focus:outline-none focus:border-morado-500/50"
        />
      </div>
    </div>
  );
}

function ToggleButton({
  icon,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => { useStore.getState().pushUndo(); onClick(); }}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-morado-500/30 text-morado-400"
          : "text-white/40 hover:text-white/60 hover:bg-white/5"
      }`}
    >
      {icon}
    </button>
  );
}

// --- Text Properties ---
function TextProps({ el }: { el: TextElement }) {
  const update = useStore((s) => s.updateElement);

  return (
    <>
      <SectionLabel>Text</SectionLabel>
      <textarea
        value={el.content}
        onFocus={() => useStore.getState().pushUndo()}
        onChange={(e) => update(el.id, { content: e.target.value })}
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 resize-none h-16 focus:outline-none focus:border-morado-500/50"
      />

      <SectionLabel>Font</SectionLabel>
      <select
        value={el.font_family || "Inter, system-ui, sans-serif"}
        onChange={(e) => {
          useStore.getState().pushUndo();
          update(el.id, { font_family: e.target.value });
        }}
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 mb-1.5 focus:outline-none focus:border-morado-500/50"
      >
        <optgroup label="Sans Serif">
          <option value="Inter, system-ui, sans-serif">Inter</option>
          <option value="Poppins, sans-serif">Poppins</option>
          <option value="Montserrat, sans-serif">Montserrat</option>
          <option value="Lato, sans-serif">Lato</option>
          <option value="Open Sans, sans-serif">Open Sans</option>
          <option value="Raleway, sans-serif">Raleway</option>
          <option value="Helvetica Neue, Arial, sans-serif">Helvetica Neue</option>
          <option value="SF Pro Display, system-ui, sans-serif">SF Pro Display</option>
          <option value="Avenir Next, sans-serif">Avenir Next</option>
        </optgroup>
        <optgroup label="Serif">
          <option value="Playfair Display, Georgia, serif">Playfair Display</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Times New Roman, serif">Times New Roman</option>
        </optgroup>
        <optgroup label="Monospace">
          <option value="Roboto Mono, Menlo, monospace">Roboto Mono</option>
          <option value="Source Code Pro, monospace">Source Code Pro</option>
          <option value="Menlo, monospace">Menlo</option>
          <option value="Courier New, monospace">Courier New</option>
        </optgroup>
      </select>
      <NumberInput
        label="Sz"
        value={el.font_size ?? 32}
        onChange={(v) => update(el.id, { font_size: v })}
        min={8}
        max={400}
      />

      <div className="flex items-center gap-1 mt-1.5">
        <ToggleButton
          icon={<Bold size={13} />}
          active={el.bold ?? false}
          onClick={() => update(el.id, { bold: !el.bold })}
        />
        <ToggleButton
          icon={<Italic size={13} />}
          active={el.italic ?? false}
          onClick={() => update(el.id, { italic: !el.italic })}
        />
        <ToggleButton
          icon={<Underline size={13} />}
          active={el.underline ?? false}
          onClick={() => update(el.id, { underline: !el.underline })}
        />
        <div className="w-px h-4 bg-white/10 mx-1" />
        <ToggleButton
          icon={<AlignLeft size={13} />}
          active={el.align === "left" || !el.align}
          onClick={() => update(el.id, { align: "left" })}
        />
        <ToggleButton
          icon={<AlignCenter size={13} />}
          active={el.align === "center"}
          onClick={() => update(el.id, { align: "center" })}
        />
        <ToggleButton
          icon={<AlignRight size={13} />}
          active={el.align === "right"}
          onClick={() => update(el.id, { align: "right" })}
        />
      </div>

      <ColorInput
        label="Clr"
        value={el.color ?? "#ffffff"}
        onChange={(v) => update(el.id, { color: v })}
      />

      <NumberInput
        label="Lh"
        value={el.line_spacing ?? 1.2}
        onChange={(v) => update(el.id, { line_spacing: v })}
        min={0.5}
        max={3}
        step={0.1}
      />

      <ColorInput
        label="Bg"
        value={el.background ?? "transparent"}
        onChange={(v) => update(el.id, { background: v === "transparent" ? null : v })}
      />
    </>
  );
}

// --- Shape Properties ---
function ShapeProps({ el }: { el: ShapeElement }) {
  const update = useStore((s) => s.updateElement);
  const fillColor =
    typeof el.fill === "string" ? el.fill : el.fill ? "#8B5CF6" : "transparent";

  return (
    <>
      <SectionLabel>Shape</SectionLabel>
      <select
        value={el.shape}
        onFocus={() => useStore.getState().pushUndo()}
        onChange={(e) =>
          update(el.id, { shape: e.target.value } as Partial<ShapeElement>)
        }
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-morado-500/50"
      >
        <option value="rect">Rectangle</option>
        <option value="rounded_rect">Rounded Rect</option>
        <option value="ellipse">Ellipse</option>
        <option value="triangle">Triangle</option>
        <option value="diamond">Diamond</option>
        <option value="star">Star</option>
        <option value="hexagon">Hexagon</option>
        <option value="pentagon">Pentagon</option>
        <option value="arrow_right">Arrow Right</option>
        <option value="arrow_left">Arrow Left</option>
      </select>

      <ColorInput
        label="Fill"
        value={fillColor}
        onChange={(v) => update(el.id, { fill: v })}
      />

      <NumberInput
        label="Rad"
        value={el.corner_radius ?? 0}
        onChange={(v) => update(el.id, { corner_radius: v })}
        min={0}
        max={100}
      />

      <SectionLabel>Stroke</SectionLabel>
      <ColorInput
        label="Clr"
        value={el.stroke?.color ?? "#ffffff"}
        onChange={(v) =>
          update(el.id, {
            stroke: { color: v, width: el.stroke?.width ?? 2 },
          })
        }
      />
      <NumberInput
        label="W"
        value={el.stroke?.width ?? 0}
        onChange={(v) =>
          update(el.id, {
            stroke: { color: el.stroke?.color ?? "#ffffff", width: v },
          })
        }
        min={0}
        max={20}
      />
    </>
  );
}

// --- Image Properties ---
function ImageProps({ el }: { el: ImageElement }) {
  const update = useStore((s) => s.updateElement);
  return (
    <>
      <SectionLabel>Image</SectionLabel>
      <input
        type="text"
        value={el.src}
        onFocus={() => useStore.getState().pushUndo()}
        onChange={(e) => update(el.id, { src: e.target.value })}
        placeholder="Image URL or path"
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-morado-500/50"
      />
      <NumberInput
        label="Rad"
        value={el.corner_radius ?? 0}
        onChange={(v) => update(el.id, { corner_radius: v })}
        min={0}
        max={100}
      />
      <SectionLabel>Fit</SectionLabel>
      <select
        value={el.fit ?? "cover"}
        onChange={(e) => {
          useStore.getState().pushUndo();
          update(el.id, { fit: e.target.value as ImageElement["fit"] });
        }}
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-morado-500/50"
      >
        <option value="cover">Cover</option>
        <option value="contain">Contain</option>
        <option value="stretch">Stretch</option>
        <option value="none">None</option>
      </select>
    </>
  );
}

// --- Line Properties ---
function LineProps({ el }: { el: LineElement }) {
  const update = useStore((s) => s.updateElement);
  return (
    <>
      <SectionLabel>Line</SectionLabel>
      <ColorInput
        label="Clr"
        value={el.color ?? "#ffffff"}
        onChange={(v) => update(el.id, { color: v })}
      />
      <NumberInput
        label="W"
        value={el.line_width ?? 2}
        onChange={(v) => update(el.id, { line_width: v })}
        min={1}
        max={20}
      />
    </>
  );
}

// --- Position/Size (shared) ---
function PositionProps({ el }: { el: SlideElement }) {
  const update = useStore((s) => s.updateElement);
  return (
    <>
      <SectionLabel>Position</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberInput
          label="X"
          value={el.x}
          onChange={(v) => update(el.id, { x: v })}
        />
        <NumberInput
          label="Y"
          value={el.y}
          onChange={(v) => update(el.id, { y: v })}
        />
        <NumberInput
          label="W"
          value={el.width}
          onChange={(v) => update(el.id, { width: v })}
          min={1}
        />
        <NumberInput
          label="H"
          value={el.height}
          onChange={(v) => update(el.id, { height: v })}
          min={1}
        />
      </div>

      <SectionLabel>Style</SectionLabel>
      <NumberInput
        label="Rot"
        value={el.rotation ?? 0}
        onChange={(v) => update(el.id, { rotation: v })}
        min={0}
        max={360}
      />
      <NumberInput
        label="Opa"
        value={el.opacity ?? 1}
        onChange={(v) => update(el.id, { opacity: v })}
        min={0}
        max={1}
        step={0.05}
      />

      <SectionLabel>Layer</SectionLabel>
      <div className="flex items-center gap-1">
        <button
          onClick={() => useStore.getState().bringToFront(el.id)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 rounded transition-colors"
          title="Bring to front"
        >
          <ArrowUpToLine size={11} /> Front
        </button>
        <button
          onClick={() => useStore.getState().sendToBack(el.id)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 rounded transition-colors"
          title="Send to back"
        >
          <ArrowDownToLine size={11} /> Back
        </button>
        <button
          onClick={() => update(el.id, { locked: !el.locked })}
          className={`p-1 rounded transition-colors ${
            el.locked
              ? "text-ambar-500 bg-ambar-500/10"
              : "text-white/40 hover:text-white/60 bg-white/5 hover:bg-white/10"
          }`}
          title={el.locked ? "Unlock" : "Lock"}
        >
          {el.locked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
      </div>
    </>
  );
}

// --- Notes Panel (when no element selected) ---
function NotesEditor() {
  const currentSlideIndex = useStore((s) => s.currentSlideIndex);
  const slide = useStore(
    (s) => s.presentation.slides[s.currentSlideIndex]
  );
  const updateSlideNotes = useStore((s) => s.updateSlideNotes);

  return (
    <div className="mt-3">
      <SectionLabel>Speaker Notes</SectionLabel>
      <textarea
        value={slide?.notes ?? ""}
        onChange={(e) => updateSlideNotes(currentSlideIndex, e.target.value)}
        placeholder="Add speaker notes..."
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 resize-none h-32 focus:outline-none focus:border-morado-500/50"
      />
    </div>
  );
}

// --- Slide Background (when no element selected) ---
const GRADIENT_PRESETS = [
  { name: "Dark", angle: 135, stops: [{ offset: 0, color: "#1a1a2e" }, { offset: 1, color: "#16213e" }] },
  { name: "Morado", angle: 135, stops: [{ offset: 0, color: "#2d1b69" }, { offset: 1, color: "#11001c" }] },
  { name: "Ocean", angle: 135, stops: [{ offset: 0, color: "#0c3547" }, { offset: 1, color: "#092028" }] },
  { name: "Sunset", angle: 135, stops: [{ offset: 0, color: "#3d1c02" }, { offset: 1, color: "#1a0a00" }] },
  { name: "Forest", angle: 180, stops: [{ offset: 0, color: "#0a2e1a" }, { offset: 1, color: "#051209" }] },
  { name: "Slate", angle: 180, stops: [{ offset: 0, color: "#1e293b" }, { offset: 1, color: "#0f172a" }] },
];

const SOLID_PRESETS = ["#0f0f17", "#1a1a2e", "#ffffff", "#000000", "#1e293b", "#0c0a09"];

function SlideTransitionEditor() {
  const currentSlideIndex = useStore((s) => s.currentSlideIndex);
  const slide = useStore((s) => s.presentation.slides[s.currentSlideIndex]);

  const setTransition = (transition: string) => {
    // We need to update the slide's transition field directly
    useStore.setState((state) => {
      const slides = [...state.presentation.slides];
      slides[currentSlideIndex] = { ...slides[currentSlideIndex], transition };
      return { presentation: { ...state.presentation, slides }, dirty: true };
    });
  };

  return (
    <>
      <SectionLabel>Transition</SectionLabel>
      <select
        value={slide?.transition || "fade"}
        onChange={(e) => setTransition(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:border-morado-500/50"
      >
        <option value="fade">Fade</option>
        <option value="slide">Slide</option>
        <option value="none">None</option>
      </select>
    </>
  );
}

function SlideBackgroundEditor() {
  const currentSlideIndex = useStore((s) => s.currentSlideIndex);
  const slide = useStore(
    (s) => s.presentation.slides[s.currentSlideIndex]
  );
  const updateSlideBackground = useStore((s) => s.updateSlideBackground);

  const bgColor =
    slide?.background?.type === "solid"
      ? slide.background.color
      : "#0f0f17";

  return (
    <>
      <SectionLabel>Slide Background</SectionLabel>
      <ColorInput
        label="BG"
        value={bgColor}
        onChange={(v) =>
          updateSlideBackground(currentSlideIndex, {
            type: "solid",
            color: v,
          })
        }
      />

      <div className="flex gap-1 mt-1.5 flex-wrap">
        {SOLID_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() =>
              updateSlideBackground(currentSlideIndex, { type: "solid", color: c })
            }
            className="w-5 h-5 rounded border border-white/10 hover:border-morado-500/50 transition-colors"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>

      <SectionLabel>Gradient Presets</SectionLabel>
      <div className="flex gap-1 flex-wrap">
        {GRADIENT_PRESETS.map((g) => (
          <button
            key={g.name}
            onClick={() =>
              updateSlideBackground(currentSlideIndex, {
                type: "gradient",
                angle: g.angle,
                stops: g.stops,
              })
            }
            className="w-10 h-6 rounded border border-white/10 hover:border-morado-500/50 transition-colors"
            style={{
              background: `linear-gradient(${g.angle}deg, ${g.stops[0].color}, ${g.stops[1].color})`,
            }}
            title={g.name}
          />
        ))}
      </div>
    </>
  );
}

// --- Alignment Tools ---
function AlignmentTools({ ids }: { ids: string[] }) {
  const align = useStore((s) => s.alignElements);
  const distribute = useStore((s) => s.distributeElements);
  const showDistribute = ids.length >= 3;

  return (
    <>
      <SectionLabel>Align</SectionLabel>
      <div className="flex items-center gap-0.5 flex-wrap">
        <button
          onClick={() => align(ids, "left")}
          title="Align left"
          className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <AlignStartVertical size={13} />
        </button>
        <button
          onClick={() => align(ids, "center")}
          title="Align center horizontally"
          className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <AlignCenterVertical size={13} />
        </button>
        <button
          onClick={() => align(ids, "right")}
          title="Align right"
          className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <AlignEndVertical size={13} />
        </button>
        <div className="w-px h-4 bg-white/10 mx-0.5" />
        <button
          onClick={() => align(ids, "top")}
          title="Align top"
          className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <AlignStartHorizontal size={13} />
        </button>
        <button
          onClick={() => align(ids, "middle")}
          title="Align middle vertically"
          className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <AlignCenterHorizontal size={13} />
        </button>
        <button
          onClick={() => align(ids, "bottom")}
          title="Align bottom"
          className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <AlignEndHorizontal size={13} />
        </button>
      </div>
      {showDistribute && (
        <>
          <SectionLabel>Distribute</SectionLabel>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => distribute(ids, "horizontal")}
              title="Distribute horizontally"
              className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <AlignHorizontalSpaceAround size={13} />
            </button>
            <button
              onClick={() => distribute(ids, "vertical")}
              title="Distribute vertically"
              className="p-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <AlignVerticalSpaceAround size={13} />
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ============================================================
// Main Properties Panel
// ============================================================

export default function PropertiesPanel() {
  const selectedElementIds = useStore((s) => s.selectedElementIds);
  const presentation = useStore((s) => s.presentation);
  const currentSlideIndex = useStore((s) => s.currentSlideIndex);

  const slide = presentation.slides[currentSlideIndex];
  const selectedElement =
    selectedElementIds.length === 1
      ? slide?.elements.find((el) => el.id === selectedElementIds[0])
      : null;

  return (
    <div className="h-full flex flex-col bg-slide-panel border-l border-slide-border overflow-y-auto">
      <div className="px-3 py-2 border-b border-slide-border">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
          {selectedElement
            ? selectedElement.type
            : selectedElementIds.length > 1
              ? `${selectedElementIds.length} elements`
              : "Slide"}
        </span>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        {selectedElement ? (
          <>
            {/* Type-specific properties */}
            {selectedElement.type === "text" && (
              <TextProps el={selectedElement as TextElement} />
            )}
            {selectedElement.type === "shape" && (
              <ShapeProps el={selectedElement as ShapeElement} />
            )}
            {selectedElement.type === "image" && (
              <ImageProps el={selectedElement as ImageElement} />
            )}
            {selectedElement.type === "line" && (
              <LineProps el={selectedElement as LineElement} />
            )}

            {/* Position (always shown for selected element) */}
            <PositionProps el={selectedElement} />

            {/* Alignment (single element = align to slide) */}
            <AlignmentTools ids={selectedElementIds} />
          </>
        ) : selectedElementIds.length > 1 ? (
          <>
            {/* Multi-select: show alignment tools */}
            <AlignmentTools ids={selectedElementIds} />
          </>
        ) : (
          <>
            <SlideBackgroundEditor />
            <SlideTransitionEditor />
            <NotesEditor />
          </>
        )}
      </div>
    </div>
  );
}
