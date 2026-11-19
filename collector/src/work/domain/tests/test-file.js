const TEST_FOLDERS = new Set(["test", "tests", "spec", "__tests__"]);
const TEST_FILE_NAMES = [
  /\.(?:test|spec|cy)\./,
  /^test_.*\.py$/,
  /_test\.(?:py|go|exs|dart)$/,
  /Tests?\.(?:java|cs)$/,
  /Test\.(?:kt|php)$/,
  /_spec\.rb$/,
  /Tests\.swift$/,
  /\.feature$/,
];

// Folder names only count inside the project, so the caller passes a path relative to its root.
export function isTestFile(path) {
  const parts = String(path ?? "").split(/[\\/]+/).filter(Boolean);
  const name = parts.pop();
  if (!name) return false;
  return parts.some((folder) => TEST_FOLDERS.has(folder.toLowerCase())) || TEST_FILE_NAMES.some((pattern) => pattern.test(name));
}
