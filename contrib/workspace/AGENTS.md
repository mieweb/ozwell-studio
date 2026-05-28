# Ozwell Studio Workspace

This workspace is `/workspace` inside the Ozwell Studio container. Files here
are the project the user is working on.

## Showing your work in the user's Terminal tab

The user has a **Terminal** tab in the Studio UI that is attached to a shared
tmux session named `main`. They cannot see commands you run with the built-in
`bash` tool — those execute in a hidden subprocess.

When the user would benefit from watching a command run live, or when they
ask you to "show" or "demo" something in the terminal, prefer the `tmux`
MCP server over the built-in `bash` tool:

1. Use `tmux_find-session` with `name: "main"` to get the session id.
2. Use `tmux_list-windows` / `tmux_list-panes` to find the active pane.
3. Use `tmux_execute-command` with that `paneId` to run the command.
4. Use `tmux_get-command-result` to read what the user just saw.

For internal scratch work — quickly checking a file exists, running a linter,
inspecting build output — the built-in `bash` tool is faster and quieter.
Use your judgement.

## Project layout

This is a generic workspace. The user will tell you what they're building.
Start a long-running dev server on **port 3000** to make it visible in the
Studio's **Preview** tab.
