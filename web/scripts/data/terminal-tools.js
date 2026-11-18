export const TOOL_KINDS = {
  Bash: "shell", PowerShell: "shell",
  Read: "read", Glob: "read", Grep: "read", LS: "read", NotebookRead: "read",
  Edit: "edit", MultiEdit: "edit", Write: "write", NotebookEdit: "write",
  WebFetch: "web", WebSearch: "web",
  Agent: "delegate", Task: "delegate",
  TodoWrite: "plan", TaskCreate: "plan", TaskUpdate: "plan",
  AskUserQuestion: "ask", ExitPlanMode: "ask",
};

export const TOOL_GLYPHS = {
  shell: "$", read: "◇", edit: "✎", write: "✎", web: "◎", delegate: "→", plan: "☰", ask: "?", other: "●",
};

export const CODE_LANGUAGES = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  json: "json", py: "python", go: "go", cs: "csharp", java: "java", kt: "kotlin", swift: "swift", rs: "rust",
  rb: "ruby", php: "php", css: "css", scss: "scss", html: "xml", xml: "xml", svg: "xml", vue: "xml",
  md: "markdown", yml: "yaml", yaml: "yaml", toml: "ini", ini: "ini", sh: "bash", sql: "sql", lua: "lua",
  c: "c", h: "c", cpp: "cpp", graphql: "graphql", dockerfile: "dockerfile",
};
