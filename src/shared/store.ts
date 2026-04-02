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

  // --- Undo/Redo ---
  undoStack: UndoSnapshot[];
  redoStack: UndoSnapshot[];

  // --- Presenter ---
  presenterActive: boolean;

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
  undoStack: [],
  redoStack: [],
  presenterActive: false,

  // --- Document ---
  setPresentation: (p, filePath) =>
    set({
      presentation: p,
      filePath: filePath ?? get().filePath,
      dirty: false,
      currentSlideIndex: 0,
      selectedElementIds: [],
      undoStack: [],
      redoStack: [],
    }),

  setFilePath: (path) => set({ filePath: path }),
  setDirty: (d) => set({ dirty: d }),

  // --- Navigation ---
  setCurrentSlide: (index) =>
    set({ currentSlideIndex: index, selectedElementIds: [] }),

  setSelectedElements: (ids) => set({ selectedElementIds: ids }),
  clearSelection: () => set({ selectedElementIds: [] }),
  setToolMode: (mode) => set({ toolMode: mode }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),

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
