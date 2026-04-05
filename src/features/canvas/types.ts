// ============================================================
// SF-Slides Element & Slide Types
// Coordinates: 1920x1080 pixel space (16:9)
// ============================================================

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

// --- Gradient ---
export interface GradientStop {
  offset: number; // 0.0 - 1.0
  color: string; // hex
}

export interface GradientFill {
  type: "linear" | "radial";
  angle?: number; // degrees, for linear
  stops: GradientStop[];
}

// --- Shadow ---
export interface ShadowDef {
  color: string;
  blur: number;
  offset_x: number;
  offset_y: number;
}

// --- Border/Stroke ---
export interface StrokeDef {
  color: string;
  width: number;
}

// --- Background ---
export interface SolidBackground {
  type: "solid";
  color: string;
}

export interface GradientBackground {
  type: "gradient";
  angle: number;
  stops: GradientStop[];
}

export interface ImageBackground {
  type: "image";
  src: string;
  fit?: "cover" | "contain" | "stretch";
  opacity?: number;
}

export type SlideBackground =
  | SolidBackground
  | GradientBackground
  | ImageBackground;

// --- Animation ---
export interface ElementAnimation {
  type: "fade_in" | "slide_left" | "slide_right" | "slide_up" | "zoom_in" | "none";
  order?: number;   // sequence order (1 = first to appear), elements without order show immediately
  delay?: number;    // additional delay in ms
  duration?: number; // animation duration in ms (default 400)
}

// --- Base Element ---
export interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index?: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  name?: string;
  shadow?: ShadowDef | null;
  animation?: ElementAnimation | null;
}

// --- Text Element ---
export interface TextElement extends BaseElement {
  type: "text";
  content: string;
  font_family?: string;
  font_size?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  line_spacing?: number;
  letter_spacing?: number;
  background?: string | null;
  padding?: number;
  corner_radius?: number;
  list_type?: "bullet" | "numbered" | null;
}

// --- Rich Text ---
export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  font_size?: number;
  color?: string;
  font_family?: string;
  letter_spacing?: number;
}

export interface RichTextElement extends BaseElement {
  type: "rich_text";
  runs: TextRun[];
  font_family?: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  line_spacing?: number;
  background?: string | null;
  padding?: number;
  corner_radius?: number;
}

// --- Image Element ---
export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  fit?: "cover" | "contain" | "stretch" | "none";
  corner_radius?: number;
  border?: StrokeDef | null;
  shadow?: ShadowDef | null;
}

// --- Shape Element ---
export type ShapeType =
  | "rect"
  | "rounded_rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "star"
  | "arrow_right"
  | "arrow_left"
  | "hexagon"
  | "pentagon";

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: ShapeType;
  fill?: string | GradientFill | null;
  stroke?: StrokeDef | null;
  corner_radius?: number;
  shadow?: ShadowDef | null;
}

// --- Line Element ---
export interface LineElement extends BaseElement {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  line_width?: number;
  dash?: number[] | null;
  start_arrow?: boolean;
  end_arrow?: boolean;
  curve?: number;
}

// --- Table Element ---
export interface TableCell {
  text: string;
  bold?: boolean;
  color?: string;
  background?: string;
  align?: "left" | "center" | "right";
}

export interface TableElement extends BaseElement {
  type: "table";
  cells: (string | TableCell)[][]; // 2D array: cells[row][col]. String = simple text, TableCell = styled
  header_row?: boolean;            // First row styled as header
  header_color?: string;           // Header bg color
  cell_color?: string;             // Default cell bg color
  alt_row_color?: string;          // Alternating row color
  text_color?: string;             // Default text color
  header_text_color?: string;      // Header text color
  border_color?: string;           // Grid line color
  border_width?: number;           // Grid line width
  font_size?: number;
  font_family?: string;
  corner_radius?: number;
  padding?: number;                // Cell padding
}

// --- Chart Element ---
export interface ChartDataset {
  label: string;
  values: number[];
  color: string;
}

export interface ChartElement extends BaseElement {
  type: "chart";
  chart_type: "bar" | "line" | "pie" | "donut";
  data: {
    labels: string[];
    datasets: ChartDataset[];
  };
  show_legend?: boolean;
  show_labels?: boolean;
  show_values?: boolean;
  title?: string;
  colors?: string[];          // Override colors for pie/donut slices
  background?: string;        // Chart background color
  text_color?: string;
  font_size?: number;
  font_family?: string;
}

// --- Union ---
export type SlideElement =
  | TextElement
  | RichTextElement
  | ImageElement
  | ShapeElement
  | LineElement
  | TableElement
  | ChartElement;

// --- Slide ---
export interface Slide {
  id: number;
  background?: SlideBackground;
  elements: SlideElement[];
  notes?: string;
  transition?: string;
  // HTML slide rendering (ai-agent-first architecture)
  html?: string;           // Full HTML source (Tailwind + Inter + FA)
  render_mode?: "elements" | "html"; // Which renderer to use (default: inferred)
}

// --- Presentation Defaults ---
export interface PresentationDefaults {
  font_family?: string;
  background?: SlideBackground;
  title_style?: Partial<TextElement>;
  body_style?: Partial<TextElement>;
}

// --- Presentation ---
export interface Presentation {
  version: number;
  metadata: {
    title: string;
    author?: string;
    created?: string;
    cover_image?: string; // absolute path to cover image shown in Home Screen
  };
  defaults?: PresentationDefaults;
  slides: Slide[];
}

// --- Tool Mode ---
export type ToolMode =
  | "select"
  | "text"
  | "shape"
  | "image"
  | "line"
  | "hand";

// --- Default factory ---
export function createDefaultPresentation(): Presentation {
  return {
    version: 1,
    metadata: {
      title: "Untitled Presentation",
      author: "",
      created: new Date().toISOString().split("T")[0],
    },
    defaults: {
      font_family: "Inter, system-ui, -apple-system, sans-serif",
      background: { type: "solid", color: "#0f0f17" },
    },
    slides: [
      {
        id: 1,
        background: { type: "solid", color: "#0f0f17" },
        elements: [],
        notes: "",
      },
    ],
  };
}

export function createEmptySlide(id: number): Slide {
  return {
    id,
    background: { type: "solid", color: "#0f0f17" },
    elements: [],
    notes: "",
  };
}

/** Determine how a slide should render */
export function getSlideRenderMode(slide: Slide): "elements" | "html" {
  if (slide.render_mode) return slide.render_mode;
  // Auto-detect: if html field exists and has content, use html mode
  if (slide.html && slide.html.trim().length > 0) return "html";
  return "elements";
}

let _nextElementId = Date.now();
export function generateElementId(): string {
  return `el_${_nextElementId++}`;
}
