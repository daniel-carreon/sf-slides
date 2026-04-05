import { create } from "zustand";
import type {
  Presentation,
  Slide,
  SlideElement,
  ToolMode,
} from "@/features/canvas/types";
import {
  createDefaultPresentation,
  createEmptySlide,
  generateElementId,
  SLIDE_WIDTH,
  SLIDE_HEIGHT,
} from "@/features/canvas/types";

interface UndoSnapshot {
  slides: Slide[];
  currentSlideIndex: number;
}

export type AppView = "home" | "editor";

interface SlidesStore {
  // --- App View ---
  appView: AppView;
  setAppView: (view: AppView) => void;

  // --- Document ---
  presentation: Presentation;
  filePath: string | null;
  dirty: boolean;

  // --- Navigation ---
  currentSlideIndex: number;
  selectedElementIds: string[];
  toolMode: ToolMode;
  zoom: number;
  panX: number;
  panY: number;

  // --- Undo/Redo ---
  undoStack: UndoSnapshot[];
  redoStack: UndoSnapshot[];

  // --- Presenter ---
  presenterActive: boolean;

  // --- Grid ---
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;

  // --- Document Actions ---
  setPresentation: (p: Presentation, filePath?: string | null) => void;
  setFilePath: (path: string | null) => void;
  setDirty: (d: boolean) => void;

  // --- Navigation Actions ---
  setCurrentSlide: (index: number) => void;
  setSelectedElements: (ids: string[]) => void;
  clearSelection: () => void;
  setToolMode: (mode: ToolMode) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  resetView: () => void;

  // --- Slide Actions ---
  addSlide: (index?: number) => void;
  duplicateSlide: (index: number) => void;
  removeSlide: (index: number) => void;
  reorderSlide: (from: number, to: number) => void;
  updateSlideBackground: (
    index: number,
    bg: Slide["background"]
  ) => void;
  updateSlideNotes: (index: number, notes: string) => void;

  // --- Element Actions ---
  addElement: (element: Omit<SlideElement, "id">) => string;
  updateElement: (id: string, changes: Partial<SlideElement>) => void;
  removeElements: (ids: string[]) => void;
  duplicateElements: (ids: string[]) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // --- Alignment ---
  alignElements: (ids: string[], alignment: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  distributeElements: (ids: string[], direction: "horizontal" | "vertical") => void;

  // --- Undo/Redo ---
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;

  // --- Presenter ---
  setPresenterActive: (active: boolean) => void;

  // --- Helpers ---
  getCurrentSlide: () => Slide | undefined;
  getElement: (id: string) => SlideElement | undefined;
}

export const useStore = create<SlidesStore>((set, get) => ({
  // --- App View ---
  appView: "home" as AppView,
  setAppView: (view) => set({ appView: view }),

  // --- Initial State ---
  presentation: createDefaultPresentation(),
  filePath: null,
  dirty: false,
  currentSlideIndex: 0,
  selectedElementIds: [],
  toolMode: "select",
  zoom: 1,
  panX: 0,
  panY: 0,
  undoStack: [],
  redoStack: [],
  presenterActive: false,
  showGrid: false,
  setShowGrid: (show) => set({ showGrid: show }),

  // --- Document ---
  setPresentation: (p, filePath) => {
    // Normalize: ensure every slide has an elements array (HTML slides may omit it)
    const normalized = {
      ...p,
      slides: p.slides.map((s) => ({
        ...s,
        elements: s.elements ?? [],
      })),
    };
    set({
      presentation: normalized,
      filePath: filePath ?? get().filePath,
      dirty: false,
      currentSlideIndex: 0,
      selectedElementIds: [],
      undoStack: [],
      redoStack: [],
    });
  },

  setFilePath: (path) => set({ filePath: path }),
  setDirty: (d) => set({ dirty: d }),

  // --- Navigation ---
  setCurrentSlide: (index) =>
    set({ currentSlideIndex: index, selectedElementIds: [], panX: 0, panY: 0 }),

  setSelectedElements: (ids) => set({ selectedElementIds: ids }),
  clearSelection: () => set({ selectedElementIds: [] }),
  setToolMode: (mode) => set({ toolMode: mode }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(5, zoom)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),

  // --- Slide Actions ---
  addSlide: (index) => {
    get().pushUndo();
    set((state) => {
      const slides = [...state.presentation.slides];
      const maxId = slides.reduce((max, s) => Math.max(max, s.id), 0);
      const newSlide = createEmptySlide(maxId + 1);
      const insertAt = index !== undefined ? index + 1 : slides.length;
      slides.splice(insertAt, 0, newSlide);
      return {
        presentation: { ...state.presentation, slides },
        currentSlideIndex: insertAt,
        selectedElementIds: [],
        dirty: true,
      };
    });
  },

  duplicateSlide: (index) => {
    get().pushUndo();
    set((state) => {
      const slides = [...state.presentation.slides];
      const source = slides[index];
      if (!source) return state;
      const maxId = slides.reduce((max, s) => Math.max(max, s.id), 0);
      const dup: Slide = JSON.parse(JSON.stringify(source));
      dup.id = maxId + 1;
      // Give new IDs to all elements
      dup.elements = dup.elements.map((el) => ({
        ...el,
        id: generateElementId(),
      }));
      slides.splice(index + 1, 0, dup);
      return {
        presentation: { ...state.presentation, slides },
        currentSlideIndex: index + 1,
        selectedElementIds: [],
        dirty: true,
      };
    });
  },

  removeSlide: (index) => {
    const { presentation } = get();
    if (presentation.slides.length <= 1) return;
    get().pushUndo();
    set((state) => {
      const slides = state.presentation.slides.filter((_, i) => i !== index);
      const newIndex = Math.min(state.currentSlideIndex, slides.length - 1);
      return {
        presentation: { ...state.presentation, slides },
        currentSlideIndex: newIndex,
        selectedElementIds: [],
        dirty: true,
      };
    });
  },

  reorderSlide: (from, to) => {
    if (from === to) return;
    get().pushUndo();
    set((state) => {
      const slides = [...state.presentation.slides];
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      return {
        presentation: { ...state.presentation, slides },
        currentSlideIndex: to,
        dirty: true,
      };
    });
  },

  updateSlideBackground: (index, bg) => {
    get().pushUndo();
    set((state) => {
      const slides = [...state.presentation.slides];
      slides[index] = { ...slides[index], background: bg };
      return {
        presentation: { ...state.presentation, slides },
        dirty: true,
      };
    });
  },

  updateSlideNotes: (index, notes) => {
    set((state) => {
      const slides = [...state.presentation.slides];
      slides[index] = { ...slides[index], notes };
      return {
        presentation: { ...state.presentation, slides },
        dirty: true,
      };
    });
  },

  // --- Element Actions ---
  addElement: (elementWithoutId) => {
    get().pushUndo();
    const id = generateElementId();
    const element = { ...elementWithoutId, id } as SlideElement;
    set((state) => {
      const slides = [...state.presentation.slides];
      const slide = { ...slides[state.currentSlideIndex] };
      slide.elements = [...slide.elements, element];
      slides[state.currentSlideIndex] = slide;
      return {
        presentation: { ...state.presentation, slides },
        selectedElementIds: [id],
        dirty: true,
      };
    });
    return id;
  },

  updateElement: (id, changes) => {
    set((state) => {
      const slides = [...state.presentation.slides];
      const slide = { ...slides[state.currentSlideIndex] };
      slide.elements = slide.elements.map((el) =>
        el.id === id ? ({ ...el, ...changes } as SlideElement) : el
      );
      slides[state.currentSlideIndex] = slide;
      return {
        presentation: { ...state.presentation, slides },
        dirty: true,
      };
    });
  },

  removeElements: (ids) => {
    if (ids.length === 0) return;
    get().pushUndo();
    set((state) => {
      const slides = [...state.presentation.slides];
      const slide = { ...slides[state.currentSlideIndex] };
      slide.elements = slide.elements.filter((el) => !ids.includes(el.id));
      slides[state.currentSlideIndex] = slide;
      return {
        presentation: { ...state.presentation, slides },
        selectedElementIds: [],
        dirty: true,
      };
    });
  },

  duplicateElements: (ids) => {
    if (ids.length === 0) return;
    get().pushUndo();
    const newIds: string[] = [];
    set((state) => {
      const slides = [...state.presentation.slides];
      const slide = { ...slides[state.currentSlideIndex] };
      const newElements = [...slide.elements];
      for (const id of ids) {
        const original = slide.elements.find((el) => el.id === id);
        if (original) {
          const newId = generateElementId();
          newIds.push(newId);
          newElements.push({
            ...JSON.parse(JSON.stringify(original)),
            id: newId,
            x: original.x + 20,
            y: original.y + 20,
          });
        }
      }
      slide.elements = newElements;
      slides[state.currentSlideIndex] = slide;
      return {
        presentation: { ...state.presentation, slides },
        selectedElementIds: newIds,
        dirty: true,
      };
    });
  },

  bringToFront: (id) => {
    get().pushUndo();
    set((state) => {
      const slides = [...state.presentation.slides];
      const slide = { ...slides[state.currentSlideIndex] };
      const maxZ = Math.max(...slide.elements.map((e) => e.z_index ?? 0), 0);
      slide.elements = slide.elements.map((el) =>
        el.id === id ? { ...el, z_index: maxZ + 1 } : el
      );
      slides[state.currentSlideIndex] = slide;
      return {
        presentation: { ...state.presentation, slides },
        dirty: true,
      };
    });
  },

  sendToBack: (id) => {
    get().pushUndo();
    set((state) => {
      const slides = [...state.presentation.slides];
      const slide = { ...slides[state.currentSlideIndex] };
      const minZ = Math.min(...slide.elements.map((e) => e.z_index ?? 0), 0);
      slide.elements = slide.elements.map((el) =>
        el.id === id ? { ...el, z_index: minZ - 1 } : el
      );
      slides[state.currentSlideIndex] = slide;
      return {
        presentation: { ...state.presentation, slides },
        dirty: true,
      };
    });
  },

  // --- Alignment ---
  alignElements: (ids, alignment) => {
    if (ids.length < 1) return;
    get().pushUndo();
    set((state) => {
      const slides = [...state.presentation.slides];
      const slide = { ...slides[state.currentSlideIndex] };
      const elements = [...slide.elements];
      const targets = elements.filter((el) => ids.includes(el.id));
      if (targets.length === 0) return state;

      if (ids.length === 1) {
        // Align single element to slide
        const el = targets[0];
        let changes: Partial<SlideElement> = {};
        switch (alignment) {
          case "left": changes = { x: 0 }; break;
          case "center": changes = { x: Math.round((SLIDE_WIDTH - el.width) / 2) }; break;
          case "right": changes = { x: SLIDE_WIDTH - el.width }; break;
          case "top": changes = { y: 0 }; break;
          case "middle": changes = { y: Math.round((SLIDE_HEIGHT - el.height) / 2) }; break;
          case "bottom": changes = { y: SLIDE_HEIGHT - el.height }; break;
        }
        slide.elements = elements.map((e) => e.id === el.id ? ({ ...e, ...changes } as SlideElement) : e);
      } else {
        // Align multiple elements relative to each other
        const bounds = {
          left: Math.min(...targets.map((e) => e.x)),
          right: Math.max(...targets.map((e) => e.x + e.width)),
          top: Math.min(...targets.map((e) => e.y)),
          bottom: Math.max(...targets.map((e) => e.y + e.height)),
        };
        const updateMap = new Map<string, Partial<SlideElement>>();
        for (const el of targets) {
          switch (alignment) {
            case "left": updateMap.set(el.id, { x: bounds.left }); break;
            case "center": updateMap.set(el.id, { x: Math.round(bounds.left + (bounds.right - bounds.left) / 2 - el.width / 2) }); break;
            case "right": updateMap.set(el.id, { x: bounds.right - el.width }); break;
            case "top": updateMap.set(el.id, { y: bounds.top }); break;
            case "middle": updateMap.set(el.id, { y: Math.round(bounds.top + (bounds.bottom - bounds.top) / 2 - el.height / 2) }); break;
            case "bottom": updateMap.set(el.id, { y: bounds.bottom - el.height }); break;
          }
        }
        slide.elements = elements.map((e) => {
          const u = updateMap.get(e.id);
          return u ? ({ ...e, ...u } as SlideElement) : e;
        });
      }

      slides[state.currentSlideIndex] = slide;
      return { presentation: { ...state.presentation, slides }, dirty: true };
    });
  },

  distributeElements: (ids, direction) => {
    if (ids.length < 3) return;
    get().pushUndo();
    set((state) => {
      const slides = [...state.presentation.slides];
      const slide = { ...slides[state.currentSlideIndex] };
      const elements = [...slide.elements];
      const targets = elements.filter((el) => ids.includes(el.id));
      if (targets.length < 3) return state;

      const sorted = [...targets].sort((a, b) =>
        direction === "horizontal" ? a.x - b.x : a.y - b.y
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      if (direction === "horizontal") {
        const totalSpace = (last.x + last.width) - first.x;
        const totalWidths = sorted.reduce((sum, e) => sum + e.width, 0);
        const gap = (totalSpace - totalWidths) / (sorted.length - 1);
        let currentX = first.x;
        const updateMap = new Map<string, number>();
        for (const el of sorted) {
          updateMap.set(el.id, Math.round(currentX));
          currentX += el.width + gap;
        }
        slide.elements = elements.map((e) => {
          const x = updateMap.get(e.id);
          return x !== undefined ? ({ ...e, x } as SlideElement) : e;
        });
      } else {
        const totalSpace = (last.y + last.height) - first.y;
        const totalHeights = sorted.reduce((sum, e) => sum + e.height, 0);
        const gap = (totalSpace - totalHeights) / (sorted.length - 1);
        let currentY = first.y;
        const updateMap = new Map<string, number>();
        for (const el of sorted) {
          updateMap.set(el.id, Math.round(currentY));
          currentY += el.height + gap;
        }
        slide.elements = elements.map((e) => {
          const y = updateMap.get(e.id);
          return y !== undefined ? ({ ...e, y } as SlideElement) : e;
        });
      }

      slides[state.currentSlideIndex] = slide;
      return { presentation: { ...state.presentation, slides }, dirty: true };
    });
  },

  // --- Undo/Redo ---
  pushUndo: () =>
    set((state) => ({
      undoStack: [
        ...state.undoStack.slice(-50), // keep last 50
        {
          slides: JSON.parse(JSON.stringify(state.presentation.slides)),
          currentSlideIndex: state.currentSlideIndex,
        },
      ],
      redoStack: [],
    })),

  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [
          ...state.redoStack,
          {
            slides: JSON.parse(JSON.stringify(state.presentation.slides)),
            currentSlideIndex: state.currentSlideIndex,
          },
        ],
        presentation: { ...state.presentation, slides: prev.slides },
        currentSlideIndex: prev.currentSlideIndex,
        selectedElementIds: [],
        dirty: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [
          ...state.undoStack,
          {
            slides: JSON.parse(JSON.stringify(state.presentation.slides)),
            currentSlideIndex: state.currentSlideIndex,
          },
        ],
        presentation: { ...state.presentation, slides: next.slides },
        currentSlideIndex: next.currentSlideIndex,
        selectedElementIds: [],
        dirty: true,
      };
    }),

  // --- Presenter ---
  setPresenterActive: (active) => set({ presenterActive: active }),

  // --- Helpers ---
  getCurrentSlide: () => {
    const { presentation, currentSlideIndex } = get();
    return presentation.slides[currentSlideIndex];
  },

  getElement: (id) => {
    const slide = get().getCurrentSlide();
    return slide?.elements.find((el) => el.id === id);
  },
}));

// Expose store for E2E testing and Claude integration
if (typeof window !== "undefined") {
  (window as any).__ZUSTAND_STORE__ = useStore;
}
