import * as fabric from "fabric";
import type {
  SlideElement,
  TextElement,
  RichTextElement,
  ImageElement,
  ShapeElement,
  LineElement,
  GradientFill,
} from "./types";

// ============================================================
// Convert SlideElement JSON → Fabric.js objects
// ============================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
}

function makeFabricGradient(
  g: GradientFill,
  width: number,
  height: number
): fabric.Gradient<"linear"> | fabric.Gradient<"radial"> {
  if (g.type === "radial") {
    return new fabric.Gradient({
      type: "radial",
      coords: {
        x1: width / 2,
        y1: height / 2,
        r1: 0,
        x2: width / 2,
        y2: height / 2,
        r2: Math.max(width, height) / 2,
      },
      colorStops: g.stops.map((s) => ({
        offset: s.offset,
        color: s.color,
      })),
    });
  }
  const angle = ((g.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new fabric.Gradient({
    type: "linear",
    coords: {
      x1: width / 2 - (cos * width) / 2,
      y1: height / 2 - (sin * height) / 2,
      x2: width / 2 + (cos * width) / 2,
      y2: height / 2 + (sin * height) / 2,
    },
    colorStops: g.stops.map((s) => ({
      offset: s.offset,
      color: s.color,
    })),
  });
}

function applyCommon(
  obj: fabric.FabricObject,
  el: SlideElement,
  extraData?: Record<string, unknown>
) {
  obj.set({
    originX: "left",
    originY: "top",
    left: el.x,
    top: el.y,
    angle: el.rotation ?? 0,
    opacity: el.opacity ?? 1,
    selectable: !(el.locked ?? false),
    evented: !(el.locked ?? false),
    data: { elementId: el.id, elementType: el.type, ...extraData },
  });

  // Apply shadow/glow to any element type
  if (el.shadow) {
    obj.set({
      shadow: new fabric.Shadow({
        color: el.shadow.color,
        blur: el.shadow.blur,
        offsetX: el.shadow.offset_x,
        offsetY: el.shadow.offset_y,
      }),
    });
  }
}

// --- Text ---
function createText(el: TextElement): fabric.Textbox {
  const obj = new fabric.Textbox(el.content || " ", {
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    fontFamily: el.font_family || "Inter, system-ui, sans-serif",
    fontSize: el.font_size ?? 32,
    fill: el.color ?? "#ffffff",
    fontWeight: el.bold ? "bold" : "normal",
    fontStyle: el.italic ? "italic" : "normal",
    underline: el.underline ?? false,
    textAlign: el.align ?? "left",
    lineHeight: el.line_spacing ?? 1.2,
    charSpacing: (el.letter_spacing ?? 0) * 10,
    backgroundColor: el.background || "",
    padding: el.padding ?? 0,
    splitByGrapheme: false,
    editable: true,
  });
  applyCommon(obj, el);
  return obj;
}

// --- Image ---
async function createImage(
  el: ImageElement
): Promise<fabric.FabricImage | fabric.Rect> {
  try {
    const img = await fabric.FabricImage.fromURL(el.src, {
      crossOrigin: "anonymous",
    });
    img.set({
      left: el.x,
      top: el.y,
      scaleX: el.width / (img.width || el.width),
      scaleY: el.height / (img.height || el.height),
    });
    if (el.corner_radius && el.corner_radius > 0) {
      img.set({
        clipPath: new fabric.Rect({
          width: img.width || el.width,
          height: img.height || el.height,
          rx: el.corner_radius / (el.width / (img.width || el.width)),
          ry: el.corner_radius / (el.height / (img.height || el.height)),
          originX: "center",
          originY: "center",
        }),
      });
    }
    applyCommon(img, el);
    return img;
  } catch {
    // Placeholder for broken images
    const placeholder = new fabric.Rect({
      left: el.x,
      top: el.y,
      width: el.width,
      height: el.height,
      fill: "#2a2a3e",
      stroke: "#8B5CF6",
      strokeWidth: 2,
      rx: el.corner_radius ?? 0,
      ry: el.corner_radius ?? 0,
    });
    applyCommon(placeholder, el);
    return placeholder;
  }
}

// --- Shape ---
function createShape(el: ShapeElement): fabric.FabricObject {
  let fill: string | fabric.Gradient<"linear"> | fabric.Gradient<"radial"> | undefined;
  if (typeof el.fill === "string") {
    fill = el.fill;
  } else if (el.fill && typeof el.fill === "object" && "type" in el.fill) {
    fill = makeFabricGradient(el.fill, el.width, el.height);
  } else {
    fill = "#8B5CF6";
  }

  const strokeColor = el.stroke?.color ?? undefined;
  const strokeWidth = el.stroke?.width ?? 0;

  let obj: fabric.FabricObject;

  switch (el.shape) {
    case "ellipse":
      obj = new fabric.Ellipse({
        left: el.x,
        top: el.y,
        rx: el.width / 2,
        ry: el.height / 2,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;

    case "triangle":
      obj = new fabric.Triangle({
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;

    case "diamond": {
      const pts = [
        { x: el.width / 2, y: 0 },
        { x: el.width, y: el.height / 2 },
        { x: el.width / 2, y: el.height },
        { x: 0, y: el.height / 2 },
      ];
      obj = new fabric.Polygon(pts, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "star": {
      const cx = el.width / 2;
      const cy = el.height / 2;
      const outerR = Math.min(cx, cy);
      const innerR = outerR * 0.4;
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      obj = new fabric.Polygon(points, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "hexagon": {
      const hcx = el.width / 2;
      const hcy = el.height / 2;
      const hr = Math.min(hcx, hcy);
      const hexPts: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        hexPts.push({ x: hcx + hr * Math.cos(a), y: hcy + hr * Math.sin(a) });
      }
      obj = new fabric.Polygon(hexPts, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "pentagon": {
      const pcx = el.width / 2;
      const pcy = el.height / 2;
      const pr = Math.min(pcx, pcy);
      const penPts: { x: number; y: number }[] = [];
      for (let i = 0; i < 5; i++) {
        const a = ((2 * Math.PI) / 5) * i - Math.PI / 2;
        penPts.push({ x: pcx + pr * Math.cos(a), y: pcy + pr * Math.sin(a) });
      }
      obj = new fabric.Polygon(penPts, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "arrow_right": {
      const aw = el.width;
      const ah = el.height;
      const bodyH = ah * 0.4;
      const bodyW = aw * 0.6;
      const arPts = [
        { x: 0, y: (ah - bodyH) / 2 },
        { x: bodyW, y: (ah - bodyH) / 2 },
        { x: bodyW, y: 0 },
        { x: aw, y: ah / 2 },
        { x: bodyW, y: ah },
        { x: bodyW, y: (ah + bodyH) / 2 },
        { x: 0, y: (ah + bodyH) / 2 },
      ];
      obj = new fabric.Polygon(arPts, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "arrow_left": {
      const alw = el.width;
      const alh = el.height;
      const alBodyH = alh * 0.4;
      const alBodyW = alw * 0.6;
      const headW = alw - alBodyW;
      const alPts = [
        { x: 0, y: alh / 2 },
        { x: headW, y: 0 },
        { x: headW, y: (alh - alBodyH) / 2 },
        { x: alw, y: (alh - alBodyH) / 2 },
        { x: alw, y: (alh + alBodyH) / 2 },
        { x: headW, y: (alh + alBodyH) / 2 },
        { x: headW, y: alh },
      ];
      obj = new fabric.Polygon(alPts, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "rounded_rect":
    default:
      obj = new fabric.Rect({
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        fill,
        stroke: strokeColor,
        strokeWidth,
        rx: el.corner_radius ?? (el.shape === "rounded_rect" ? 12 : 0),
        ry: el.corner_radius ?? (el.shape === "rounded_rect" ? 12 : 0),
      });
      break;
  }

  applyCommon(obj, el);
  return obj;
}

// --- Line ---
function createLine(el: LineElement): fabric.Line {
  const obj = new fabric.Line([el.x1, el.y1, el.x2, el.y2], {
    stroke: el.color ?? "#ffffff",
    strokeWidth: el.line_width ?? 2,
    strokeDashArray: el.dash ?? undefined,
    selectable: !(el.locked ?? false),
    evented: !(el.locked ?? false),
    data: { elementId: el.id, elementType: el.type },
  });
  obj.set({
    opacity: el.opacity ?? 1,
    angle: el.rotation ?? 0,
  });
  return obj;
}

// --- Rich Text (fallback: concatenate runs into a single Textbox) ---
function createRichText(el: RichTextElement): fabric.Textbox {
  const content = el.runs.map((r) => r.text).join("") || " ";
  const firstRun = el.runs[0];
  const obj = new fabric.Textbox(content, {
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    fontFamily: el.font_family || "Inter, system-ui, sans-serif",
    fontSize: firstRun?.font_size ?? 32,
    fill: firstRun?.color ?? "#ffffff",
    fontWeight: firstRun?.bold ? "bold" : "normal",
    fontStyle: firstRun?.italic ? "italic" : "normal",
    underline: firstRun?.underline ?? false,
    textAlign: el.align ?? "left",
    lineHeight: el.line_spacing ?? 1.2,
    backgroundColor: el.background || "",
    padding: el.padding ?? 0,
    splitByGrapheme: false,
    editable: true,
  });
  applyCommon(obj, el);
  return obj;
}

// ============================================================
// Main dispatcher
// ============================================================

export async function createFabricObject(
  el: SlideElement
): Promise<fabric.FabricObject | null> {
  switch (el.type) {
    case "text":
      return createText(el as TextElement);
    case "rich_text":
      return createRichText(el as RichTextElement);
    case "image":
      return createImage(el as ImageElement);
    case "shape":
      return createShape(el as ShapeElement);
    case "line":
      return createLine(el as LineElement);
    default:
      console.warn("Unknown element type:", (el as SlideElement).type);
      return null;
  }
}

// ============================================================
// Reverse: Fabric object → SlideElement update
// ============================================================

export function fabricObjectToElementUpdate(
  obj: fabric.FabricObject
): Partial<SlideElement> {
  const update: Partial<SlideElement> = {
    x: Math.round(obj.left ?? 0),
    y: Math.round(obj.top ?? 0),
    rotation: Math.round(obj.angle ?? 0),
    opacity: obj.opacity ?? 1,
  };

  if (obj instanceof fabric.Textbox) {
    update.width = Math.round(obj.width ?? 0);
    update.height = Math.round(obj.height ?? 0);
    (update as Partial<TextElement>).content = obj.text ?? "";
  } else if (obj instanceof fabric.Line) {
    const line = obj;
    const lineUpdate = update as Partial<LineElement>;
    lineUpdate.x1 = Math.round(line.x1 ?? 0) + (line.left ?? 0);
    lineUpdate.y1 = Math.round(line.y1 ?? 0) + (line.top ?? 0);
    lineUpdate.x2 = Math.round(line.x2 ?? 0) + (line.left ?? 0);
    lineUpdate.y2 = Math.round(line.y2 ?? 0) + (line.top ?? 0);
  } else {
    update.width = Math.round((obj.width ?? 0) * (obj.scaleX ?? 1));
    update.height = Math.round((obj.height ?? 0) * (obj.scaleY ?? 1));
  }

  return update;
}
