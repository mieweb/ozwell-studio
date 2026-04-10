import { useState, useMemo } from "react";
import { Select } from "@mieweb/ui";

const MCP_SERVERS = [
  "filesystem",
  "tmux",
  "git",
];

interface Flavor {
  label: string;
  generate: (baseUrl: string) => string;
}

const FLAVORS: Record<string, Flavor> = {
  "vscode": {
    label: "VS Code / GitHub Copilot",
    generate: (baseUrl) =>
      JSON.stringify(
        {
          servers: Object.fromEntries(
            MCP_SERVERS.map((name) => [
              name,
              { type: "http", url: `${baseUrl}/servers/${name}/mcp` },
            ])
          ),
        },
        null,
        2
      ),
  },
  "copilot-cli": {
    label: "GitHub Copilot CLI",
    generate: (baseUrl) =>
      JSON.stringify(
        {
          mcpServers: Object.fromEntries(
            MCP_SERVERS.map((name) => [
              name,
              { type: "http", url: `${baseUrl}/servers/${name}/mcp` },
            ])
          ),
        },
        null,
        2
      ),
  },
};

const FLAVOR_OPTIONS = Object.entries(FLAVORS).map(([value, { label }]) => ({
  label,
  value,
}));

export function McpConfig() {
  const [flavor, setFlavor] = useState("vscode");
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined"
    ? `${window.location.origin}/mcp`
    : "http://localhost:5000/mcp";

  const config = useMemo(
    () => FLAVORS[flavor].generate(baseUrl),
    [flavor, baseUrl]
  );

  const copy = async () => {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full flex-col items-center overflow-auto bg-background p-6">
      <div className="w-full max-w-2xl">
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          MCP Server Configuration
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Copy this configuration into your AI tool to connect to the MCP
          servers running in this workspace.
        </p>

        <div className="mb-4 w-48">
          <Select
            options={FLAVOR_OPTIONS}
            value={flavor}
            onValueChange={setFlavor}
            label="Tool"
            hideLabel
          />
        </div>

        <div className="relative">
          <pre className="overflow-auto rounded-lg border border-border bg-muted p-4 text-sm leading-relaxed text-foreground">
            <code>{config}</code>
          </pre>
          <button
            onClick={copy}
            className="absolute right-2 top-2 cursor-pointer rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          <strong>VS Code / GitHub Copilot:</strong> Paste into{" "}
          <code className="rounded bg-muted px-1">.vscode/mcp.json</code>.
          <br />
          <strong>GitHub Copilot CLI:</strong> Paste into{" "}
          <code className="rounded bg-muted px-1">~/.copilot/mcp-config.json</code>.
        </p>
      </div>
    </div>
  );
}
