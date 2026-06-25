import { useState, useRef, useCallback, useEffect, type PointerEvent as ReactPointerEvent } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  SidebarProvider,
  Sidebar,
  SidebarContent,
  useSidebar,
} from "@mieweb/ui";
import { McpConfig } from "./McpConfig";

declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;

interface TabDef {
  id: string;
  label: string;
  src?: string;
}

const TABS: TabDef[] = [
  { id: "app", label: "Application", src: "/preview/" },
  { id: "terminal", label: "Terminal", src: "/ttyd/" },
  { id: "editor", label: "Editor", src: "/code/?folder=/workspace" },
  { id: "kerebron", label: "WYSIWYG Editor", src: "/@kerebron/listdir" },
  { id: "mcp", label: "MCP Config" },
];

function tabFromHash(): string {
  const hash = window.location.hash.replace("#", "");
  return TABS.find((t) => t.id === hash)?.id ?? "app";
}

function PreviewNavBar({ iframeRef }: { iframeRef: HTMLIFrameElement | null }) {
  const [url, setUrl] = useState("/preview/");
  const history = useRef<string[]>(["/preview/"]);
  const historyIndex = useRef(0);
  const navigating = useRef(false);

  const syncUrl = useCallback(() => {
    try {
      const loc = iframeRef?.contentWindow?.location;
      const current = (loc?.pathname ?? "") + (loc?.search ?? "");
      if (!current || current === url) return;
      if (!navigating.current) {
        // User-initiated navigation inside the iframe
        const next = historyIndex.current + 1;
        history.current = history.current.slice(0, next);
        history.current.push(current);
        historyIndex.current = next;
      }
      navigating.current = false;
      setUrl(current);
    } catch {}
  }, [iframeRef, url]);

  useEffect(() => {
    if (!iframeRef) return;
    const onLoad = () => syncUrl();
    iframeRef.addEventListener("load", onLoad);
    return () => iframeRef.removeEventListener("load", onLoad);
  }, [iframeRef, syncUrl]);

  const canGoBack = historyIndex.current > 0;
  const canGoForward = historyIndex.current < history.current.length - 1;

  const goBack = () => {
    if (!canGoBack) return;
    navigating.current = true;
    historyIndex.current--;
    try { iframeRef!.contentWindow!.location.href = history.current[historyIndex.current]; } catch {}
  };
  const goForward = () => {
    if (!canGoForward) return;
    navigating.current = true;
    historyIndex.current++;
    try { iframeRef!.contentWindow!.location.href = history.current[historyIndex.current]; } catch {}
  };
  const reload = () => {
    try { iframeRef?.contentWindow?.location.reload(); } catch {}
  };

  return (
    <div className="flex items-center gap-1 border-b border-border bg-muted px-2 py-1">
      <button onClick={goBack} disabled={!canGoBack} className="cursor-pointer rounded p-1 hover:bg-accent active:scale-90 disabled:cursor-default disabled:opacity-30 disabled:active:scale-100" title="Back">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11 2L5 8l6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <button onClick={goForward} disabled={!canGoForward} className="cursor-pointer rounded p-1 hover:bg-accent active:scale-90 disabled:cursor-default disabled:opacity-30 disabled:active:scale-100" title="Forward">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5 2l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <button onClick={reload} className="cursor-pointer rounded p-1 hover:bg-accent active:scale-90" title="Reload">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/>
          <path d="M14 2v4h-4"/>
        </svg>
      </button>
      <div className="ml-1 flex-1 rounded bg-background px-2 py-0.5 text-xs text-muted-foreground select-all">
        {url}
      </div>
    </div>
  );
}

const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 768;
const SIDEBAR_DEFAULT_WIDTH = 420;
const SIDEBAR_WIDTH_KEY = "opencode-sidebar-width";

function OpenCodeSidebar() {
  const { isCollapsed } = useSidebar();
  const [width, setWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(stored) && stored >= SIDEBAR_MIN_WIDTH && stored <= SIDEBAR_MAX_WIDTH
      ? stored
      : SIDEBAR_DEFAULT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  }, [width]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const next = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, startWidth + (ev.clientX - startX)),
      );
      setWidth(next);
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [width]);

  return (
    <div className="relative flex h-full">
      <Sidebar
        className={`!h-full overflow-hidden border-r border-border bg-background ${isDragging ? "!transition-none" : ""}`}
        collapsedWidth="0px"
        expandedWidth={`${width}px`}
      >
        <SidebarContent className="p-0">
          <iframe
            src="/opencode/"
            title="OpenCode Web"
            className={`h-full w-full border-none ${isDragging ? "pointer-events-none" : ""}`}
          />
        </SidebarContent>
      </Sidebar>
      {!isCollapsed && (
        <div
          onPointerDown={onPointerDown}
          className={`absolute right-0 top-0 z-20 h-full w-1 -translate-x-1/2 cursor-col-resize bg-transparent hover:bg-accent ${isDragging ? "bg-accent" : ""}`}
          title="Drag to resize"
          role="separator"
          aria-orientation="vertical"
        />
      )}
    </div>
  );
}

function SidebarToggle() {
  const { isCollapsed, toggleCollapsed } = useSidebar();
  return (
    <button
      onClick={toggleCollapsed}
      className="mr-1 cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent active:scale-90"
      title={isCollapsed ? "Open OpenCode AI" : "Close OpenCode AI"}
      aria-label="Toggle OpenCode sidebar"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState(tabFromHash);
  const [previewFrame, setPreviewFrame] = useState<HTMLIFrameElement | null>(null);

  const changeTab = useCallback((id: string) => {
    window.location.hash = id;
    setActiveTab(id);
  }, []);

  useEffect(() => {
    const onHashChange = () => setActiveTab(tabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <SidebarProvider storageKey="opencode-sidebar-v2">
      <div className="flex h-screen flex-col bg-background text-foreground">
        <div className="relative flex flex-1">
          <OpenCodeSidebar />
          <div className="flex flex-1 flex-col">
            <Tabs value={activeTab} onValueChange={changeTab}>
              <TabsList className="shrink-0 px-2">
                <SidebarToggle />
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="relative flex-1">
              {TABS.map((tab) => (
                <div
                  key={tab.id}
                  className={`absolute inset-0 flex flex-col ${
                    activeTab === tab.id ? "" : "hidden"
                  }`}
                >
                  {tab.id === "app" && (
                    <PreviewNavBar iframeRef={previewFrame} />
                  )}
                  {tab.id === "mcp" ? (
                    <McpConfig />
                  ) : (
                    <iframe
                      ref={tab.id === "app" ? setPreviewFrame : undefined}
                      src={tab.src}
                      title={tab.label}
                      className="flex-1 border-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          <span>
            Ozwell Studio v{__APP_VERSION__}
            {__GIT_COMMIT__ && (
              <>
                {" ("}
                <a
                  href={`https://github.com/mieweb/ozwell-studio/commit/${__GIT_COMMIT__}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {__GIT_COMMIT__}
                </a>
                {")"}
              </>
            )}
          </span>
          <a
            href={`https://github.com/mieweb/ozwell-studio/issues/new?template=bug_report.yml&url=${encodeURIComponent(window.location.href)}&version=${encodeURIComponent(`v${__APP_VERSION__}${__GIT_COMMIT__ ? ` (${__GIT_COMMIT__})` : ""}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Report a bug
          </a>
        </footer>
      </div>
    </SidebarProvider>
  );
}
