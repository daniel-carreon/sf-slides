import { useEffect, useRef, useCallback } from "react";
import * as fabric from "fabric";
import { useStore } from "@/shared/store";
import { createFabricObject, fabricObjectToElementUpdate } from "./element-renderers";
import { SLIDE_WIDTH, SLIDE_HEIGHT } from "./types";
import type { SlideElement, TextElement, ShapeElement, ImageElement } from "./types";

type FabricObjectWithData = fabric.FabricObject & { data?: Record<string, unknown> };

export default function SlideCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const currentSlideIndex = useStore((s) => s.currentSlideIndex);
  const presentation = useStore((s) => s.presentation);
  const selectedElementIds = useStore((s) => s.selectedElementIds);
  const toolMode = useStore((s) => s.toolMode);
  const zoom = useStore((s) => s.zoom);

  const slide = presentation.slides[currentSlideIndex];

  // --- Initialize Fabric Canvas ---
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      backgroundColor: "#0f0f17",
      selection: true,
      preserveObjectStacking: true,
      controlsAboveOverlay: true,
    });

    // Style controls — must set originX/Y to "left"/"top" (Fabric v7 defaults to "center")
    fabric.FabricObject.prototype.set({
      originX: "left",
      originY: "top",
      cornerColor: "#8B5CF6",
      cornerStrokeColor: "#8B5CF6",
      cornerSize: 10,
      cornerStyle: "circle",
      transparentCorners: false,
      borderColor: "#8B5CF6",
      borderScaleFactor: 2,
      padding: 4,
    });

    fabricRef.current = canvas;
    // Expose for E2E testing
    (window as any).__FABRIC_CANVAS__ = canvas;

    // Handle selection
    canvas.on("selection:created", (e) => {
      if (syncingRef.current) return;
      const ids = (e.selected ?? [])
        .map((obj) => (obj as FabricObjectWithData).data?.elementId as string | undefined)
        .filter((id): id is string => Boolean(id));
      useStore.getState().setSelectedElements(ids);
    });

    canvas.on("selection:updated", (e) => {
      if (syncingRef.current) return;
      const ids = (e.selected ?? [])
        .map((obj) => (obj as FabricObjectWithData).data?.elementId as string | undefined)
        .filter((id): id is string => Boolean(id));
      useStore.getState().setSelectedElements(ids);
    });

    canvas.on("selection:cleared", () => {
      if (syncingRef.current) return;
      useStore.getState().clearSelection();
    });

    // Handle object modifications
    canvas.on("object:modified", (e) => {
      if (syncingRef.current) return;
      const obj = e.target as FabricObjectWithData | undefined;
      if (!obj?.data?.elementId) return;

      // Push undo before applying changes
      useStore.getState().pushUndo();

      const update = fabricObjectToElementUpdate(obj);
      useStore.getState().updateElement(obj.data.elementId as string, update);

      // Reset scale to 1 after applying (size baked into width/height)
      if (!(obj instanceof fabric.Textbox) && !(obj instanceof fabric.Line)) {
        obj.set({ scaleX: 1, scaleY: 1 });
        obj.setCoords();
      }
    });

    // Snap guidelines
    const guideLines: fabric.Line[] = [];
    const SNAP_THRESHOLD = 10;
    const centerX = SLIDE_WIDTH / 2;
    const centerY = SLIDE_HEIGHT / 2;

    canvas.on("object:moving", (e) => {
      const obj = e.target;
      if (!obj) return;

      // Remove old guides
      guideLines.forEach((l) => canvas.remove(l));
      guideLines.length = 0;

      const objCenterX = (obj.left ?? 0) + ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
      const objCenterY = (obj.top ?? 0) + ((obj.height ?? 0) * (obj.scaleY ?? 1)) / 2;

      // Snap to horizontal center
      if (Math.abs(objCenterX - centerX) < SNAP_THRESHOLD) {
        obj.set({ left: centerX - ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2 });
        const vLine = new fabric.Line([centerX, 0, centerX, SLIDE_HEIGHT], {
          stroke: "#8B5CF6",
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          opacity: 0.7,
        });
        canvas.add(vLine);
        guideLines.push(vLine);
      }

      // Snap to vertical center
      if (Math.abs(objCenterY - centerY) < SNAP_THRESHOLD) {
        obj.set({ top: centerY - ((obj.height ?? 0) * (obj.scaleY ?? 1)) / 2 });
        const hLine = new fabric.Line([0, centerY, SLIDE_WIDTH, centerY], {
          stroke: "#8B5CF6",
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          opacity: 0.7,
        });
        canvas.add(hLine);
        guideLines.push(hLine);
      }
    });

    canvas.on("object:modified", () => {
      guideLines.forEach((l) => canvas.remove(l));
      guideLines.length = 0;
      canvas.renderAll();
    });

    // Handle text editing
    canvas.on("text:changed", (e) => {
      if (syncingRef.current) return;
      const obj = e.target as fabric.Textbox & { data?: Record<string, unknown> };
      if (!obj?.data?.elementId) return;
      useStore.getState().updateElement(obj.data.elementId as string, {
        content: obj.text ?? "",
      } as Partial<TextElement>);
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // --- Sync slide elements to canvas ---
  const elementsJson = JSON.stringify(slide?.elements);
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !slide) return;

    let cancelled = false;
    syncingRef.current = true;

    const syncSlide = async () => {
      canvas.clear();

      // Background
      const bg = slide.background;
      if (bg?.type === "solid") {
        canvas.backgroundColor = bg.color;
      } else if (bg?.type === "gradient" && bg.stops) {
        const gradient = new fabric.Gradient({
          type: "linear",
          coords: {
            x1: 0,
            y1: 0,
            x2: SLIDE_WIDTH * Math.cos(((bg.angle ?? 0) * Math.PI) / 180),
            y2: SLIDE_HEIGHT * Math.sin(((bg.angle ?? 0) * Math.PI) / 180),
          },
          colorStops: bg.stops.map((s) => ({ offset: s.offset, color: s.color })),
        });
        canvas.backgroundColor = gradient as unknown as string;
      } else {
        canvas.backgroundColor = "#0f0f17";
      }

      // Sort by z_index
      const sorted = [...slide.elements].sort(
        (a, b) => (a.z_index ?? 0) - (b.z_index ?? 0)
      );

      for (const el of sorted) {
        if (cancelled) return;
        const obj = await createFabricObject(el);
        if (cancelled) return;
        if (obj) {
          canvas.add(obj);
        }
      }

      canvas.renderAll();
      syncingRef.current = false;
    };

    syncSlide();

    return () => {
      cancelled = true;
      syncingRef.current = false;
    };
  }, [slide?.id, elementsJson, currentSlideIndex]);

  // --- Handle tool mode changes ---
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (toolMode === "select" || toolMode === "hand") {
      canvas.selection = toolMode === "select";
      canvas.defaultCursor = toolMode === "hand" ? "grab" : "default";
      canvas.forEachObject((obj) => {
        obj.selectable = toolMode === "select" && !((obj as FabricObjectWithData).data?.locked);
        obj.evented = toolMode === "select" && !((obj as FabricObjectWithData).data?.locked);
      });
    } else {
      canvas.selection = false;
      canvas.defaultCursor = "crosshair";
      canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
    }
  }, [toolMode]);

  // --- Handle click-to-add for tools ---
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: fabric.TPointerEventInfo) => {
      if (toolMode === "select" || toolMode === "hand") return;
      const pointer = canvas.getScenePoint(e.e);

      if (toolMode === "text") {
        useStore.getState().addElement({
          type: "text",
          content: "Text",
          x: Math.round(pointer.x),
          y: Math.round(pointer.y),
          width: 400,
          height: 60,
          font_size: 32,
          color: "#ffffff",
        } as Omit<TextElement, "id">);
        useStore.getState().setToolMode("select");
      } else if (toolMode === "shape") {
        useStore.getState().addElement({
          type: "shape",
          shape: "rounded_rect",
          x: Math.round(pointer.x),
          y: Math.round(pointer.y),
          width: 200,
          height: 150,
          fill: "#8B5CF6",
          corner_radius: 12,
        } as Omit<ShapeElement, "id">);
        useStore.getState().setToolMode("select");
      } else if (toolMode === "image") {
        const url = window.prompt("Enter image URL:");
        if (url) {
          useStore.getState().addElement({
            type: "image",
            src: url,
            x: Math.round(pointer.x),
            y: Math.round(pointer.y),
            width: 300,
            height: 200,
          } as Omit<ImageElement, "id">);
        }
        useStore.getState().setToolMode("select");
      } else if (toolMode === "line") {
        useStore.getState().addElement({
          type: "line",
          x: Math.round(pointer.x),
          y: Math.round(pointer.y),
          width: 200,
          height: 0,
          x1: Math.round(pointer.x),
          y1: Math.round(pointer.y),
          x2: Math.round(pointer.x) + 200,
          y2: Math.round(pointer.y),
          color: "#ffffff",
          line_width: 2,
        } as unknown as Omit<SlideElement, "id">);
        useStore.getState().setToolMode("select");
      }
    };

    canvas.on("mouse:down", handleMouseDown);
    return () => {
      canvas.off("mouse:down", handleMouseDown);
    };
  }, [toolMode]);

  // --- Resize canvas to fit container ---
  const resizeCanvas = useCallback(() => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const padding = 40;
    const availW = rect.width - padding * 2;
    const availH = rect.height - padding * 2;

    const scale =
      Math.min(availW / SLIDE_WIDTH, availH / SLIDE_HEIGHT) * zoom;

    canvas.setZoom(scale);
    canvas.setDimensions({
      width: SLIDE_WIDTH * scale,
      height: SLIDE_HEIGHT * scale,
    });
  }, [zoom]);

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex items-center justify-center bg-neutral-950 overflow-hidden"
    >
      <div className="shadow-2xl shadow-black/50 rounded-sm">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
