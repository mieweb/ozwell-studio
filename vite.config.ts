import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "child_process";

const gitCommit = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
})();

export default defineConfig({
  root: "src",
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
