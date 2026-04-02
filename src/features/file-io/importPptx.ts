import JSZip from "jszip";
import type {
  Presentation,
  Slide,
  SlideElement,
  TextElement,
  ShapeElement,
  ImageElement,
  SlideBackground,
} from "@/features/canvas/types";

// Namespace-agnostic element queries for OOXML.
// DOMParser with "text/xml" preserves namespace prefixes (e.g. <a:p>, <p:sp>),
// so plain querySelector("p") will never match <a:p>.  These helpers use
// getElementsByTagNameNS("*", localName) which matches regardless of prefix.
function qs(parent: Element | Document, localName: string): Element | null {
  return parent.getElementsByTagNameNS("*", localName)[0] || null;
}

function qsa(parent: Element | Document, localName: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS("*", localName));
}

// EMU → pixel conversion (PPTX uses English Metric Units)
// Standard widescreen: 12192000 x 6858000 EMU = 13.33" x 7.5"
// Our canvas: 1920 x 1080 px
// Both axes: 1 px = 6350 EMU (12192000/1920 = 6858000/1080 = 6350)
const EMU_PER_PX = 6350;

function emuToPx(emu: number): number {
  return emu / EMU_PER_PX;
}

// Only round at final assignment — preserves sub-pixel accuracy through calculations
function roundPx(v: number): number {
  return Math.round(v * 10) / 10; // keep 1 decimal for precision
}

// Parse hex color from OOXML (e.g., "FF6B00" → "#FF6B00")
function parseColor(node: Element | null, fallback = "#ffffff"): string {
  if (!node) return fallback;
  const srgb = qs(node, "srgbClr");
  if (srgb) return "#" + srgb.getAttribute("val");
  const scheme = qs(node, "schemeClr");
  if (scheme) {
    // Map common scheme colors
    const schemeMap: Record<string, string> = {
      tx1: "#ffffff",
      tx2: "#BBBBBB",
      bg1: "#0D0D0D",
      bg2: "#1A1A1A",
      accent1: "#8B5CF6",
      accent2: "#f69f02",
      lt1: "#ffffff",
      dk1: "#000000",
    };
    return schemeMap[scheme.getAttribute("val") || ""] || fallback;
  }
  return fallback;
}

// Preserve original font names with appropriate fallback chains.
// macOS has Arial, Helvetica, Times New Roman, Georgia, Courier New,
// Verdana, Tahoma, Trebuchet MS built-in — no need to remap these.
// Only remap fonts that truly aren't available on the system.
function mapFont(pptxFont: string): string {
  // Fonts available on macOS — preserve them with fallbacks
  const systemFonts: Record<string, string> = {
    "Arial": "Arial, Helvetica, sans-serif",
    "Helvetica": "Helvetica, Arial, sans-serif",
    "Helvetica Neue": "Helvetica Neue, Helvetica, Arial, sans-serif",
    "Times New Roman": "Times New Roman, Times, serif",
    "Georgia": "Georgia, serif",
    "Courier New": "Courier New, Courier, monospace",
    "Verdana": "Verdana, Geneva, sans-serif",
    "Tahoma": "Tahoma, Geneva, sans-serif",
    "Trebuchet MS": "Trebuchet MS, sans-serif",
    "Impact": "Impact, sans-serif",
    "Comic Sans MS": "Comic Sans MS, cursive",
    "Lucida Grande": "Lucida Grande, sans-serif",
    "Futura": "Futura, sans-serif",
    "Avenir": "Avenir, sans-serif",
    "Avenir Next": "Avenir Next, sans-serif",
    "SF Pro Display": "SF Pro Display, system-ui, sans-serif",
    "Menlo": "Menlo, Monaco, monospace",
  };
  if (systemFonts[pptxFont]) return systemFonts[pptxFont];

  // Windows-only fonts — map to closest available alternative
  const remapFonts: Record<string, string> = {
    "Calibri": "Helvetica Neue, Helvetica, Arial, sans-serif",
    "Calibri Light": "Helvetica Neue, Helvetica, Arial, sans-serif",
    "Segoe UI": "Helvetica Neue, Helvetica, Arial, sans-serif",
    "Cambria": "Georgia, serif",
    "Consolas": "Roboto Mono, Menlo, monospace",
    "Century Gothic": "Poppins, Futura, sans-serif",
    "Gill Sans MT": "Lato, Gill Sans, sans-serif",
    "Franklin Gothic Medium": "Montserrat, sans-serif",
    "Garamond": "Playfair Display, Georgia, serif",
    "Rockwell": "Georgia, serif",
    "Lucida Console": "Source Code Pro, Menlo, monospace",
  };
  if (remapFonts[pptxFont]) return remapFonts[pptxFont];

  // Unknown font: pass through with generic fallback
  return `${pptxFont}, sans-serif`;
}

// Default PPTX text body insets in EMU (the internal padding of text boxes)
// These are defined in the OOXML spec as default values for bodyPr
const DEFAULT_L_INS = 91440;  // ~14.4px — left margin
const DEFAULT_T_INS = 45720;  // ~7.2px  — top margin
const DEFAULT_R_INS = 91440;  // ~14.4px — right margin
const DEFAULT_B_INS = 45720;  // ~7.2px  — bottom margin

// Parse text body properties (margins, vertical alignment)
function parseBodyPr(txBody: Element): {
  lIns: number;
  tIns: number;
  rIns: number;
  bIns: number;
  anchor: "top" | "middle" | "bottom";
} {
  const bodyPr = qs(txBody, "bodyPr");
  let lIns = DEFAULT_L_INS;
  let tIns = DEFAULT_T_INS;
  let rIns = DEFAULT_R_INS;
  let bIns = DEFAULT_B_INS;
  let anchor: "top" | "middle" | "bottom" = "top";

  if (bodyPr) {
    // Parse explicit insets (only override if explicitly present)
    const lVal = bodyPr.getAttribute("lIns");
    const tVal = bodyPr.getAttribute("tIns");
    const rVal = bodyPr.getAttribute("rIns");
    const bVal = bodyPr.getAttribute("bIns");
    if (lVal !== null) lIns = parseInt(lVal);
    if (tVal !== null) tIns = parseInt(tVal);
    if (rVal !== null) rIns = parseInt(rVal);
    if (bVal !== null) bIns = parseInt(bVal);

    // Parse vertical alignment
    const anchorAttr = bodyPr.getAttribute("anchor");
    if (anchorAttr === "ctr") anchor = "middle";
    else if (anchorAttr === "b") anchor = "bottom";
  }

  return { lIns, tIns, rIns, bIns, anchor };
}

// Parse a single shape/text element from XML
function parseShape(
  spNode: Element,
  slideImages: Map<string, string>,
  nextId: () => string
): SlideElement | null {
  // Get transform (position + size)
  const spPr = qs(spNode, "spPr");
  const xfrm = spPr ? qs(spPr, "xfrm") : null;
  if (!xfrm && !spPr) return null;
  const xfrmOrSpPr = xfrm || spPr!;

  const off = qs(xfrmOrSpPr, "off");
  const ext = qs(xfrmOrSpPr, "ext");
  if (!off || !ext) return null;

  // Keep precise floating-point values through the pipeline
  const rawX = emuToPx(parseInt(off.getAttribute("x") || "0"));
  const rawY = emuToPx(parseInt(off.getAttribute("y") || "0"));
  const rawW = emuToPx(parseInt(ext.getAttribute("cx") || "0"));
  const rawH = emuToPx(parseInt(ext.getAttribute("cy") || "0"));

  if (rawW < 1 && rawH < 1) return null;

  // Check rotation
  const rot = xfrmOrSpPr.getAttribute("rot");
  const rotation = rot ? Math.round(parseInt(rot) / 60000) : 0;

  // Check for image (blipFill)
  const blipFill = qs(spNode, "blipFill");
  const blip = blipFill ? qs(blipFill, "blip") : null;
  if (blip) {
    const rEmbed = blip.getAttribute("r:embed") || blip.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "embed"
    );
    const imgSrc = rEmbed ? slideImages.get(rEmbed) || "" : "";

    return {
      id: nextId(),
      type: "image",
      src: imgSrc,
      x: Math.round(rawX),
      y: Math.round(rawY),
      width: Math.round(rawW),
      height: Math.round(rawH),
      corner_radius: 0,
      rotation,
    } as ImageElement;
  }

  // Check for text body
  const txBody = qs(spNode, "txBody");
  if (txBody) {
    // Parse text body margins and vertical alignment
    const body = parseBodyPr(txBody);
    const marginL = emuToPx(body.lIns);
    const marginT = emuToPx(body.tIns);
    const marginR = emuToPx(body.rIns);
    const marginB = emuToPx(body.bIns);

    // Adjust text element position/size to account for internal margins.
    // In PPTX the shape box has margins inside; text renders within the inner area.
    // Our TextElement x/y IS where text starts, so we offset by the margins.
    const textX = roundPx(rawX + marginL);
    const textY = roundPx(rawY + marginT);
    const textW = roundPx(rawW - marginL - marginR);
    const textH = roundPx(rawH - marginT - marginB);

    const paragraphs = qsa(txBody, "p");
    let fullText = "";
    let fontSize = 32;
    let color = "#ffffff";
    let bold = false;
    let italic = false;
    let underline = false;
    let align: "left" | "center" | "right" = "left";
    let fontFamily = "";
    let lineSpacing: number | undefined;
    let letterSpacing: number | undefined;

    paragraphs.forEach((p, pi) => {
      if (pi > 0) fullText += "\n";

      // Get paragraph alignment
      const pPr = qs(p, "pPr");
      if (pPr) {
        const algn = pPr.getAttribute("algn");
        if (algn === "ctr") align = "center";
        else if (algn === "r") align = "right";

        // Line spacing
        const lnSpc = qs(pPr, "lnSpc");
        if (lnSpc) {
          const spcPct = qs(lnSpc, "spcPct");
          if (spcPct) {
            const val = spcPct.getAttribute("val");
            if (val) lineSpacing = parseInt(val) / 100000;
          }
        }
      }

      const runs = qsa(p, "r");
      runs.forEach((r) => {
        const t = qs(r, "t");
        if (t) fullText += t.textContent || "";

        // Extract run properties
        const rPr = qs(r, "rPr");
        if (rPr) {
          const sz = rPr.getAttribute("sz");
          // PPTX stores font size in hundredths of a point (e.g. 3200 = 32pt)
          // Keep precision: round to nearest 0.5pt
          if (sz) {
            const rawSize = parseFloat(sz) / 100;
            fontSize = Math.round(rawSize * 2) / 2; // nearest 0.5
          }

          bold = rPr.getAttribute("b") === "1";
          italic = rPr.getAttribute("i") === "1";
          underline = rPr.getAttribute("u") === "sng" || rPr.getAttribute("u") === "dbl";

          // Character spacing: spc is in hundredths of a point
          const spc = rPr.getAttribute("spc");
          if (spc) {
            letterSpacing = parseFloat(spc) / 100; // Convert to points
          }

          // Color
          const solidFill = qs(rPr, "solidFill");
          if (solidFill) {
            color = parseColor(solidFill);
          }

          // Font
          const latin = qs(rPr, "latin");
          if (latin) {
            fontFamily = latin.getAttribute("typeface") || "";
          }
        }
      });
    });

    if (!fullText.trim()) return null;

    const el: TextElement = {
      id: nextId(),
      type: "text",
      content: fullText.trim(),
      x: Math.round(textX),
      y: Math.round(textY),
      width: Math.round(textW),
      height: Math.round(textH),
      font_size: fontSize,
      color,
      bold,
      italic,
      underline,
      align,
      valign: body.anchor,
      rotation,
    };
    if (fontFamily) el.font_family = mapFont(fontFamily);
    if (lineSpacing !== undefined) el.line_spacing = lineSpacing;
    if (letterSpacing !== undefined) el.letter_spacing = letterSpacing;
    return el;
  }

  // It's a shape (rect, ellipse, etc.)
  const prstGeom = spPr ? qs(spPr, "prstGeom") : null;
  const geomType = prstGeom?.getAttribute("prst") || "rect";

  const shapeMap: Record<string, string> = {
    rect: "rect",
    roundRect: "rounded_rect",
    ellipse: "ellipse",
    triangle: "triangle",
    diamond: "diamond",
    star5: "star",
    hexagon: "hexagon",
    rightArrow: "arrow_right",
    leftArrow: "arrow_left",
    line: "rect", // lines handled separately
  };
  const shape = (shapeMap[geomType] || "rect") as ShapeElement["shape"];

  // Fill color
  let fill: string | null = null;
  const solidFill = spPr ? qs(spPr, "solidFill") : null;
  if (solidFill) {
    fill = parseColor(solidFill, "#8B5CF6");
  }
  const noFill = spPr ? qs(spPr, "noFill") : null;
  if (noFill) fill = null;

  // Stroke
  let stroke: { color: string; width: number } | undefined;
  const ln = spPr ? qs(spPr, "ln") : null;
  if (ln) {
    const lnW = ln.getAttribute("w");
    const lnFill = qs(ln, "solidFill");
    if (lnFill) {
      // Line width in EMU: 12700 EMU = 1pt = ~1.33px
      const widthPt = lnW ? parseFloat(lnW) / 12700 : 1;
      stroke = {
        color: parseColor(lnFill, "#ffffff"),
        width: Math.max(1, Math.round(widthPt)),
      };
    }
  }

  // Corner radius for roundRect
  const x = Math.round(rawX);
  const y = Math.round(rawY);
  const width = Math.round(rawW);
  const height = Math.round(rawH);
  let cornerRadius = 0;
  if (geomType === "roundRect" && prstGeom) {
    const avLst = qs(prstGeom, "avLst");
    const av = avLst ? qs(avLst, "av") : null;
    if (av) {
      const fmla = av.getAttribute("fmla");
      // PPTX uses "val XXXXX" where the value is in 1/50000 of the shape size
      if (fmla) {
        const match = fmla.match(/val\s+(\d+)/);
        if (match) {
          cornerRadius = Math.round(
            (parseInt(match[1]) / 50000) * Math.min(width, height)
          );
        }
      }
    }
    if (cornerRadius === 0) cornerRadius = 12; // default
  }

  return {
    id: nextId(),
    type: "shape",
    shape,
    x,
    y,
    width,
    height,
    fill,
    stroke: stroke || undefined,
    corner_radius: cornerRadius,
    rotation,
  } as ShapeElement;
}

// Parse slide background
function parseBackground(
  slideDoc: Document,
  _zip: JSZip
): SlideBackground | undefined {
  const bg = qs(slideDoc, "bg");
  if (!bg) return undefined;

  const solidFill = qs(bg, "solidFill");
  if (solidFill) {
    return { type: "solid", color: parseColor(solidFill, "#0D0D0D") };
  }

  const gradFill = qs(bg, "gradFill");
  if (gradFill) {
    const stops = qsa(gradFill, "gs");
    if (stops.length >= 2) {
      const gradStops = Array.from(stops).map((gs) => ({
        offset: parseInt(gs.getAttribute("pos") || "0") / 100000,
        color: parseColor(gs, "#0D0D0D"),
      }));
      return {
        type: "gradient",
        angle: 180,
        stops: gradStops,
      };
    }
  }

  return { type: "solid", color: "#0D0D0D" };
}

// Parse speaker notes
async function parseNotes(
  zip: JSZip,
  slideIndex: number
): Promise<string> {
  const notesFile = zip.file(
    `ppt/notesSlides/notesSlide${slideIndex}.xml`
  );
  if (!notesFile) return "";

  try {
    const xml = await notesFile.async("text");
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const texts: string[] = [];
    for (const txBody of qsa(doc, "txBody")) {
      for (const p of qsa(txBody, "p")) {
        for (const r of qsa(p, "r")) {
          const t = qs(r, "t");
          if (t?.textContent) texts.push(t.textContent);
        }
      }
    }
    // Filter out slide number placeholders
    return texts
      .filter((t) => t.trim() && !/^\d+$/.test(t.trim()))
      .join(" ")
      .trim();
  } catch {
    return "";
  }
}

// Extract embedded images from PPTX
async function extractImages(
  zip: JSZip,
  slideIndex: number
): Promise<Map<string, string>> {
  const images = new Map<string, string>();

  // Read slide relationships
  const relsFile = zip.file(
    `ppt/slides/_rels/slide${slideIndex}.xml.rels`
  );
  if (!relsFile) return images;

  const relsXml = await relsFile.async("text");
  const parser = new DOMParser();
  const relsDoc = parser.parseFromString(relsXml, "text/xml");
  const rels = qsa(relsDoc, "Relationship");

  for (const rel of Array.from(rels)) {
    const type = rel.getAttribute("Type") || "";
    if (type.includes("image")) {
      const rId = rel.getAttribute("Id") || "";
      const target = rel.getAttribute("Target") || "";
      // Target is relative to ppt/slides/, so resolve to full path
      const imgPath = target.startsWith("../")
        ? "ppt/" + target.slice(3)
        : "ppt/slides/" + target;

      const imgFile = zip.file(imgPath);
      if (imgFile) {
        try {
          const imgData = await imgFile.async("base64");
          const ext = imgPath.split(".").pop()?.toLowerCase() || "png";
          const mimeMap: Record<string, string> = {
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            svg: "image/svg+xml",
            webp: "image/webp",
          };
          const mime = mimeMap[ext] || "image/png";
          images.set(rId, `data:${mime};base64,${imgData}`);
        } catch {
          // Skip failed images
        }
      }
    }
  }

  return images;
}

// Main import function
export async function importPptx(file: File): Promise<Presentation> {
  const zip = new JSZip();
  await zip.loadAsync(file);

  // Count slides
  const slideFiles: string[] = [];
  zip.folder("ppt/slides")?.forEach((path, _file) => {
    if (path.match(/^slide\d+\.xml$/)) {
      slideFiles.push(path);
    }
  });

  // Sort by slide number
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || "0");
    const numB = parseInt(b.match(/\d+/)?.[0] || "0");
    return numA - numB;
  });

  let elementCounter = 0;
  const nextId = () => `imp_${++elementCounter}`;

  const parser = new DOMParser();
  const slides: Slide[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = zip.file(`ppt/slides/${slideFiles[i]}`);
    if (!slideFile) continue;

    const xml = await slideFile.async("text");
    const doc = parser.parseFromString(xml, "text/xml");

    // Extract images for this slide
    const slideNum = parseInt(slideFiles[i].match(/\d+/)?.[0] || "1");
    const slideImages = await extractImages(zip, slideNum);

    // Parse background
    const background = parseBackground(doc, zip);

    // Parse all shapes (sp = shape, pic = picture)
    const elements: SlideElement[] = [];
    const spTree = qs(doc, "spTree");

    if (spTree) {
      // Iterate ALL direct children of spTree in document order.
      // PPTX z-order = document order (first = back, last = front).
      // We MUST preserve this order so images don't cover text.
      for (const child of Array.from(spTree.children)) {
        const localName = child.localName;
        if (localName === "sp" || localName === "pic") {
          const el = parseShape(child as Element, slideImages, nextId);
          if (el) elements.push(el);
        } else if (localName === "grpSp") {
          // Flatten group shapes — process children in order
          for (const grpChild of Array.from(child.children)) {
            const grpLocalName = grpChild.localName;
            if (grpLocalName === "sp" || grpLocalName === "pic") {
              const el = parseShape(grpChild as Element, slideImages, nextId);
              if (el) elements.push(el);
            }
          }
        }
      }
    }

    // Parse notes
    const notes = await parseNotes(zip, slideNum);

    slides.push({
      id: i + 1,
      background,
      elements,
      notes,
    });
  }

  // Try to get presentation title from core properties
  let title = "Imported Presentation";
  const coreFile = zip.file("docProps/core.xml");
  if (coreFile) {
    try {
      const coreXml = await coreFile.async("text");
      const coreDoc = parser.parseFromString(coreXml, "text/xml");
      const titleEl = qs(coreDoc, "title");
      if (titleEl?.textContent) title = titleEl.textContent;
    } catch {
      // ignore
    }
  }

  return {
    version: 1,
    metadata: {
      title,
      author: "",
      created: new Date().toISOString().split("T")[0],
    },
    defaults: {
      font_family: "Inter, system-ui, sans-serif",
      background: { type: "solid", color: "#0D0D0D" },
    },
    slides,
  };
}
