import { useState, useRef } from "react";
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

export function App() {
  const [activeTab, setActiveTab] = useState("app");
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());

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
            src={tab.src}
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
