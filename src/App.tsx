import { useState, useRef, useCallback, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@mieweb/ui";

interface TabDef {
  id: string;
  label: string;
  src: string;
}

const TABS: TabDef[] = [
  { id: "app", label: "Application", src: "/preview/" },
  { id: "terminal", label: "Terminal", src: "/ttyd/" },
  { id: "editor", label: "Editor", src: "/code/?folder=/workspace" },
];

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

export function App() {
  const [activeTab, setActiveTab] = useState("app");
  const [previewFrame, setPreviewFrame] = useState<HTMLIFrameElement | null>(null);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="shrink-0 px-2">
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
            <iframe
              ref={tab.id === "app" ? setPreviewFrame : undefined}
              src={tab.src}
              title={tab.label}
              className="flex-1 border-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
