// The folder goes inside node "...": letters and these symbols are inert there in sh, bash, zsh and cmd.exe, unlike $, `, ", ;, % or a line break.
const SAFE_PATH_CHARACTER = /[\p{L}\p{M}\p{N}_ .:\\/~@+,=-]/u;

export function hooksDirProblem(dir) {
  const unsafe = [...new Set(dir)].filter((character) => !SAFE_PATH_CHARACTER.test(character));
  if (unsafe.length === 0) return null;
  const shown = unsafe.map((character) => JSON.stringify(character)).join(", ");
  return `the hooks folder ${dir} has characters that are not safe in a shell command: ${shown}. Move or clone it to a path with only letters, digits, spaces and . _ - : \\ / ~ @ + , =`;
}
