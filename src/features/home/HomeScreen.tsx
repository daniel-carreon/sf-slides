import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/shared/store";
import type { Presentation } from "@/features/canvas/types";
import { createDefaultPresentation } from "@/features/canvas/types";
import {
  Plus,
  FolderOpen,
  Upload,
  Clock,
  Trash2,
  MoreVertical,
  Layers,
  FileText,
} from "lucide-react";

/** Resolve the presentations directory to an absolute path that works in both dev and built app */
async function getPresentationsDir(): Promise<string> {
  try {
    const pathMod = await import("@tauri-apps/api/path");
    // Try documentDir first (~/Documents/), fall back to homeDir
    let base: string;
    try {
      base = await pathMod.documentDir();
    } catch {
      const home = await pathMod.homeDir();
      base = home.endsWith("/") ? home + "Documents/" : home + "/Documents/";
    }
    const dir = base.endsWith("/") ? `${base}SF-Slides/presentations` : `${base}/SF-Slides/presentations`;
    console.log("[HomeScreen] presentations dir:", dir);
    return dir;
  } catch (err) {
    console.warn("[HomeScreen] Failed to resolve presentations dir, using relative:", err);
    return "presentations";
  }
}

interface ProjectInfo {
  path: string;
  name: string;
  title: string;
  author: string;
  created: string;
  slideCount: number;
  modified: number; // timestamp
  thumbnailColor: string; // bg color of first slide for preview
  coverImageDataUrl: string | null; // base64 data URL for cover image
}

// Brand logo
function SFLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/sf-logo.png"
        alt="SF-Slides"
        className="w-8 h-8 rounded-lg"
        draggable={false}
      />
      <span className="text-lg font-semibold text-white tracking-tight">
        SF-Slides
      </span>
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectInfo;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const accentColors = ["#8B5CF6", "#f69f02", "#00CC66", "#4488FF", "#FF3333"];
  const accent =
    accentColors[
      Math.abs(project.title.charCodeAt(0) || 0) % accentColors.length
    ];

  return (
    <div className="group relative">
      {/* Thumbnail */}
      <button
        onClick={onOpen}
        className="w-full aspect-video rounded-xl overflow-hidden border border-white/8 hover:border-morado-500/50 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-morado-500/10 focus:outline-none focus:ring-2 focus:ring-morado-500/50"
        style={{ backgroundColor: project.thumbnailColor || "#0f0f17" }}
      >
        {project.coverImageDataUrl ? (
          <div className="w-full h-full relative">
            <img
              src={project.coverImageDataUrl}
              alt={project.title}
              className="w-full h-full object-cover"
              draggable={false}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            {/* Slide count badge */}
            <div className="absolute top-2.5 right-3 text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
              {project.slideCount} slides
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 relative">
            {/* Decorative accent line */}
            <div
              className="absolute top-3 left-3 w-8 h-1 rounded-full"
              style={{ backgroundColor: accent }}
            />
            {/* Slide count badge */}
            <div className="absolute top-2.5 right-3 text-[10px] text-white/30 bg-black/40 px-1.5 py-0.5 rounded">
              {project.slideCount} slides
            </div>
            {/* Title preview */}
            <span className="text-white/80 font-bold text-sm text-center line-clamp-2 mt-2">
              {project.title}
            </span>
            {project.author && (
              <span className="text-white/30 text-[10px] mt-1">
                {project.author}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Info bar */}
      <div className="flex items-center justify-between mt-2.5 px-0.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 font-medium truncate">
            {project.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <FileText size={11} className="text-white/30 flex-shrink-0" />
            <p className="text-[11px] text-white/30 truncate">
              {project.created || "Unknown date"}
            </p>
          </div>
        </div>

        {/* More menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1 rounded-md text-white/20 hover:text-white/60 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 z-50 bg-neutral-900 border border-white/10 rounded-lg shadow-xl py-1 min-w-[140px]">
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 flex items-center gap-2"
                  onClick={() => {
                    onOpen();
                    setMenuOpen(false);
                  }}
                >
                  <FolderOpen size={14} /> Open
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomeScreen() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const setPresentation = useStore((s) => s.setPresentation);
  const setAppView = useStore((s) => s.setAppView);

  // Scan presentations directory
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const fs = await import("@tauri-apps/plugin-fs");
      const presDir = await getPresentationsDir();
      console.log("[HomeScreen] Scanning:", presDir);
      // Ensure the directory exists
      try { await fs.mkdir(presDir, { recursive: true }); } catch { /* already exists */ }
      const entries = await fs.readDir(presDir);
      console.log("[HomeScreen] Found entries:", entries.length, entries.map(e => e.name));
      const projectList: ProjectInfo[] = [];

      for (const entry of entries) {
        if (
          entry.name &&
          (entry.name.endsWith(".sfslides") || entry.name.endsWith(".json"))
        ) {
          try {
            const path = `${presDir}/${entry.name}`;
            const content = await fs.readTextFile(path);
            const data = JSON.parse(content) as Presentation;
            const firstSlideBg = data.slides?.[0]?.background;
            const bgColor =
              firstSlideBg?.type === "solid"
                ? firstSlideBg.color
                : firstSlideBg?.type === "gradient"
                  ? firstSlideBg.stops?.[0]?.color || "#0f0f17"
                  : "#0f0f17";

            projectList.push({
              path,
              name: entry.name,
              title: data.metadata?.title || entry.name.replace(/\.(sfslides|json)$/, ""),
              author: data.metadata?.author || "",
              created: data.metadata?.created || "",
              slideCount: data.slides?.length || 0,
              modified: Date.now(),
              thumbnailColor: bgColor,
              coverImageDataUrl: (data.metadata as any)?.cover_image_data || null,
            });
          } catch {
            // Skip invalid files
          }
        }
      }

      // Sort by created date (newest first)
      projectList.sort((a, b) => b.created.localeCompare(a.created));
      setProjects(projectList);
    } catch (err) {
      console.error("[HomeScreen] Tauri FS failed, trying dev fallback:", err);
      // Dev mode fallback: load from public/ via HTTP
      try {
        const devFiles = ["Mi-Business-OS-v4.sfslides", "recursividad-agentica.sfslides"];
        const projectList: ProjectInfo[] = [];
        for (const name of devFiles) {
          try {
            const res = await fetch(`/${name}`);
            if (!res.ok) continue;
            const data = JSON.parse(await res.text()) as Presentation;
            const firstSlideBg = data.slides?.[0]?.background;
            const bgColor =
              firstSlideBg?.type === "solid"
                ? firstSlideBg.color
                : firstSlideBg?.type === "gradient"
                  ? firstSlideBg.stops?.[0]?.color || "#0f0f17"
                  : "#0f0f17";
            projectList.push({
              path: name,
              name,
              title: data.metadata?.title || name.replace(/\.(sfslides|json)$/, ""),
              author: data.metadata?.author || "",
              created: data.metadata?.created || "",
              slideCount: data.slides?.length || 0,
              modified: Date.now(),
              thumbnailColor: bgColor,
              coverImageDataUrl: (data.metadata as any)?.cover_image_data || null,
            });
          } catch { /* skip */ }
        }
        setProjects(projectList);
      } catch {
        setProjects([]);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const openProject = async (project: ProjectInfo) => {
    try {
      const fs = await import("@tauri-apps/plugin-fs");
      const content = await fs.readTextFile(project.path);
      const data = JSON.parse(content) as Presentation;
      if (data && data.slides) {
        setPresentation(data, project.path);
        setAppView("editor");
      }
    } catch (err) {
      console.error("Failed to open project:", err);
    }
  };

  const deleteProject = async (project: ProjectInfo) => {
    try {
      const dialog = await import("@tauri-apps/plugin-dialog");
      const confirmed = await dialog.confirm(`Delete "${project.title}"?`, {
        title: "SF-Slides",
        kind: "warning",
      });
      if (!confirmed) return;
      const fs = await import("@tauri-apps/plugin-fs");
      await fs.remove(project.path);
      loadProjects();
    } catch (err) {
      // Fallback to browser confirm
      if (!confirm(`Delete "${project.title}"?`)) return;
      try {
        const fs = await import("@tauri-apps/plugin-fs");
        await fs.remove(project.path);
        loadProjects();
      } catch (e) {
        console.error("Failed to delete:", e);
      }
    }
  };

  const createNew = () => {
    setPresentation(createDefaultPresentation(), null);
    setAppView("editor");
  };

  const openFile = async () => {
    try {
      const dialog = await import("@tauri-apps/plugin-dialog");
      const path = await dialog.open({
        filters: [{ name: "SF-Slides", extensions: ["sfslides", "json"] }],
        multiple: false,
      });
      if (path && typeof path === "string") {
        const fs = await import("@tauri-apps/plugin-fs");
        const content = await fs.readTextFile(path);
        const data = JSON.parse(content) as Presentation;
        if (data && data.slides) {
          setPresentation(data, path);
          setAppView("editor");
        }
      }
    } catch (err) {
      console.error("Open failed:", err);
    }
  };

  const importPptx = async () => {
    try {
      const dialog = await import("@tauri-apps/plugin-dialog");
      const path = await dialog.open({
        filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
        multiple: false,
      });
      if (path && typeof path === "string") {
        const fs = await import("@tauri-apps/plugin-fs");
        const data = await fs.readFile(path);
        const file = new File([data], path.split("/").pop() || "import.pptx");
        const { importPptx: parseFile } = await import("@/features/file-io/importPptx");
        const presentation = await parseFile(file);
        setPresentation(presentation, null);
        setAppView("editor");
      }
    } catch {
      // Browser fallback
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pptx";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const { importPptx: parseFile } = await import("@/features/file-io/importPptx");
        const presentation = await parseFile(file);
        setPresentation(presentation, null);
        setAppView("editor");
      };
      input.click();
    }
  };

  const filteredProjects = searchQuery
    ? projects.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.author.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects;

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between pl-24 pr-8 py-4 border-b border-white/5 titlebar-drag">
        <SFLogo />
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search presentations..."
              className="w-64 bg-white/5 border border-white/8 rounded-lg px-4 py-2 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-morado-500/50 focus:bg-white/8 transition-all"
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {/* Quick actions */}
          <section className="mb-10">
            <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-4">
              Start a new presentation
            </h2>
            <div className="flex gap-4">
              {/* Blank */}
              <button
                onClick={createNew}
                className="w-44 aspect-video rounded-xl border-2 border-dashed border-white/10 hover:border-morado-500/50 hover:bg-morado-500/5 flex flex-col items-center justify-center gap-2 transition-all duration-200 group"
              >
                <Plus
                  size={28}
                  className="text-white/20 group-hover:text-morado-400 transition-colors"
                />
                <span className="text-xs text-white/30 group-hover:text-white/60 transition-colors">
                  Blank
                </span>
              </button>

              {/* Open file */}
              <button
                onClick={openFile}
                className="w-44 aspect-video rounded-xl border border-white/8 hover:border-white/20 hover:bg-white/3 flex flex-col items-center justify-center gap-2 transition-all duration-200 group"
              >
                <FolderOpen
                  size={24}
                  className="text-white/20 group-hover:text-white/50 transition-colors"
                />
                <span className="text-xs text-white/30 group-hover:text-white/60 transition-colors">
                  Open file
                </span>
              </button>

              {/* Import PPTX */}
              <button
                onClick={importPptx}
                className="w-44 aspect-video rounded-xl border border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/5 flex flex-col items-center justify-center gap-2 transition-all duration-200 group"
              >
                <Upload
                  size={24}
                  className="text-amber-500/30 group-hover:text-amber-500/70 transition-colors"
                />
                <span className="text-xs text-amber-500/40 group-hover:text-amber-500/80 transition-colors">
                  Import .pptx
                </span>
              </button>
            </div>
          </section>

          {/* Recent presentations */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} className="text-white/30" />
              <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider">
                Recent presentations
              </h2>
              {projects.length > 0 && (
                <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded">
                  {projects.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-white/20 text-sm">
                  Loading presentations...
                </div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Layers
                  size={40}
                  className="text-white/10 mb-3"
                />
                <p className="text-white/30 text-sm">
                  {searchQuery
                    ? "No presentations match your search"
                    : "No presentations yet"}
                </p>
                <p className="text-white/15 text-xs mt-1">
                  {searchQuery
                    ? "Try a different search term"
                    : "Create a new one or open an existing file"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.path}
                    project={project}
                    onOpen={() => openProject(project)}
                    onDelete={() => deleteProject(project)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-[11px] text-white/15">
          SF-Slides v1.0 — The Agentic Presentation Engine
        </span>
        <span className="text-[11px] text-white/15">
          {projects.length} presentation{projects.length !== 1 ? "s" : ""}
        </span>
      </footer>
    </div>
  );
}
