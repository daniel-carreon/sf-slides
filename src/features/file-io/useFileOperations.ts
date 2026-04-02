import { useCallback, useRef } from "react";
import { useStore } from "@/shared/store";
import type { Presentation } from "@/features/canvas/types";
import { createDefaultPresentation } from "@/features/canvas/types";

// Tauri APIs — lazy imported so the app also works in browser dev
async function getTauriFs() {
  return import("@tauri-apps/plugin-fs");
}

async function getTauriDialog() {
  return import("@tauri-apps/plugin-dialog");
}

function validatePresentation(data: unknown): data is Presentation {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!d.slides || !Array.isArray(d.slides)) return false;
  return true;
}

export function useFileOperations() {
  const setPresentation = useStore((s) => s.setPresentation);
  const presentation = useStore((s) => s.presentation);
  const filePath = useStore((s) => s.filePath);
  const setFilePath = useStore((s) => s.setFilePath);
  const setDirty = useStore((s) => s.setDirty);

  const saveToFile = useCallback(
    async (path: string, data: Presentation) => {
      try {
        const fs = await getTauriFs();
        const json = JSON.stringify(data, null, 2);
        await fs.writeTextFile(path, json);
        setDirty(false);
      } catch (err) {
        console.error("Save failed:", err);
        // Fallback: browser download
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          (data.metadata?.title || "presentation") + ".sfslides";
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [setDirty]
  );

  // saveAs defined BEFORE save so the closure captures it correctly
  const saveAs = useCallback(async () => {
    try {
      const dialog = await getTauriDialog();
      const path = await dialog.save({
        filters: [
          { name: "SF-Slides", extensions: ["sfslides"] },
          { name: "JSON", extensions: ["json"] },
        ],
        defaultPath: (presentation.metadata?.title || "presentation") + ".sfslides",
      });
      if (path) {
        setFilePath(path);
        await saveToFile(path, presentation);
      }
    } catch {
      // Fallback handled in saveToFile
      await saveToFile("", presentation);
    }
  }, [presentation, saveToFile, setFilePath]);

  const save = useCallback(async () => {
    if (filePath) {
      await saveToFile(filePath, presentation);
    } else {
      await saveAs();
    }
  }, [filePath, presentation, saveToFile, saveAs]);

  const open = useCallback(async () => {
    try {
      const dialog = await getTauriDialog();
      const path = await dialog.open({
        filters: [
          { name: "SF-Slides", extensions: ["sfslides", "json"] },
        ],
        multiple: false,
      });
      if (path && typeof path === "string") {
        const fs = await getTauriFs();
        const content = await fs.readTextFile(path);
        const data = JSON.parse(content);
        if (validatePresentation(data)) {
          setPresentation(data, path);
        } else {
          console.error("Invalid presentation file");
        }
      }
    } catch (err) {
      console.error("Open failed:", err);
    }
  }, [setPresentation]);

  const newPresentation = useCallback(() => {
    setPresentation(createDefaultPresentation(), null);
  }, [setPresentation]);

  const importPptxFile = useCallback(async () => {
    try {
      // Try Tauri dialog first
      const dialog = await getTauriDialog();
      const path = await dialog.open({
        filters: [
          { name: "PowerPoint", extensions: ["pptx"] },
        ],
        multiple: false,
      });
      if (path && typeof path === "string") {
        const fs = await getTauriFs();
        const data = await fs.readFile(path);
        const file = new File([data], path.split("/").pop() || "import.pptx");
        const { importPptx } = await import("./importPptx");
        const presentation = await importPptx(file);
        setPresentation(presentation, null);
        console.log(`[Import] PPTX imported: ${presentation.slides.length} slides`);
      }
    } catch (err) {
      console.warn("[Import] Tauri import failed, trying browser fallback:", err);
      // Browser fallback: use file input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pptx";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const { importPptx } = await import("./importPptx");
          const presentation = await importPptx(file);
          setPresentation(presentation, null);
          console.log(`[Import] PPTX imported: ${presentation.slides.length} slides`);
        } catch (importErr) {
          console.error("[Import] PPTX parsing failed:", importErr);
        }
      };
      input.click();
    }
  }, [setPresentation]);

  return { save, saveAs, open, newPresentation, importPptxFile };
}
