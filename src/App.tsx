import { useState, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@mieweb/ui";

interface TabDef {
  id: string;
  label: string;
  url: (base: string, domain: string) => string;
  /** Fallback port for local (bare hostname) development */
  devPort: number;
}

const TABS: TabDef[] = [
  { id: "app", label: "Application", url: (b, d) => `//${b}.${d}/`, devPort: 80 },
  { id: "terminal", label: "Terminal", url: (b, d) => `//${b}-ttyd.${d}/`, devPort: 7681 },
  { id: "editor", label: "Editor", url: (b, d) => `//${b}-code-server.${d}/`, devPort: 8080 },
];

/**
 * Derive the base hostname and root domain from the current URL.
 *
 * If served at  my-server-studio.example.com  we extract:
 *   base   = "my-server"
 *   domain = "example.com"
 *
 * The "-studio" suffix is stripped from the first label.
 */
function discoverOrigin(): { base: string; domain: string } {
  const host = window.location.hostname;
  const dot = host.indexOf(".");
  if (dot === -1) return { base: host, domain: "" };
  const firstLabel = host.slice(0, dot);
  const domain = host.slice(dot + 1);
  const base = firstLabel.replace(/-studio$/, "");
  return { base, domain };
}

function buildSrc(tab: TabDef, base: string, domain: string): string {
  if (domain) return tab.url(base, domain);
  return `http://${base}:${tab.devPort}/`;
}

export function App() {
  const [activeTab, setActiveTab] = useState("app");
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const { base, domain } = discoverOrigin();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Tab bar */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="shrink-0 px-2">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Iframe panels — all mounted, only the active one visible */}
      <div className="relative flex-1">
        {TABS.map((tab) => (
          <iframe
            key={tab.id}
            ref={(el) => {
              if (el) iframeRefs.current.set(tab.id, el);
            }}
            src={buildSrc(tab, base, domain)}
            title={tab.label}
            className={`absolute inset-0 h-full w-full border-none ${
              activeTab === tab.id ? "block" : "hidden"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
