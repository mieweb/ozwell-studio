import { useState, useMemo, useEffect } from "react";
import { Select } from "@mieweb/ui";

const MCP_SERVERS = [
  "filesystem",
  "tmux",
  "git",
];

const API_KEY_STORAGE_KEY = "ozwell-studio-mcp-api-key";

interface Flavor {
  label: string;
  generate: (baseUrl: string, apiKey: string) => string;
}

function serverEntry(url: string, apiKey: string) {
  const entry: Record<string, unknown> = { type: "http", url };
  if (apiKey) {
    entry.headers = { Authorization: `Bearer ${apiKey}` };
  }
  return entry;
}

const FLAVORS: Record<string, Flavor> = {
  "vscode": {
    label: "VS Code / GitHub Copilot",
    generate: (baseUrl, apiKey) =>
      JSON.stringify(
        {
          servers: Object.fromEntries(
            MCP_SERVERS.map((name) => [
              name,
              serverEntry(`${baseUrl}/servers/${name}/mcp`, apiKey),
            ])
          ),
        },
        null,
        2
      ),
  },
  "copilot-cli": {
    label: "GitHub Copilot CLI",
    generate: (baseUrl, apiKey) =>
      JSON.stringify(
        {
          mcpServers: Object.fromEntries(
            MCP_SERVERS.map((name) => [
              name,
              serverEntry(`${baseUrl}/servers/${name}/mcp`, apiKey),
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
  const [apiKey, setApiKey] = useState(() =>
    localStorage.getItem(API_KEY_STORAGE_KEY) ?? ""
  );
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  }, [apiKey]);

  const showConfig = apiKey || skipped;

  const baseUrl = typeof window !== "undefined"
    ? `${window.location.origin}/mcp`
    : "http://localhost:6080/mcp";

  const config = useMemo(
    () => FLAVORS[flavor].generate(baseUrl, apiKey),
    [flavor, baseUrl, apiKey]
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

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-foreground">
            API Key
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            An API key is required to authenticate MCP connections from external
            tools. It will be embedded in the generated configuration.
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setSkipped(false);
            }}
            placeholder="Paste your API key here"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {!showConfig && (
            <button
              onClick={() => setSkipped(true)}
              className="mt-2 cursor-pointer text-xs text-muted-foreground underline hover:text-foreground"
            >
              Skip — I know what I'm doing
            </button>
          )}
        </div>

        {showConfig && (
          <>
            {skipped && !apiKey && (
              <p className="mb-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
                No API key provided. The generated configuration will not
                include authentication headers. MCP connections will fail if
                the server requires authentication.
              </p>
            )}

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
          </>
        )}
      </div>
    </div>
  );
}
