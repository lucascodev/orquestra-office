import { ensureActivityHeader, ensureSecret } from "./office-secret.mjs";

export const ROTATE_SECRET_FLAG = "--rotate-secret";

export function prepareOfficeSecret({ officeFiles, rotate, fail }) {
  let secret;
  try {
    secret = ensureSecret({ secretFile: officeFiles.secretFile, rotate });
    ensureActivityHeader(officeFiles.activityHeaderFile, secret.key);
  } catch (error) {
    return fail(`Could not prepare the office secret: ${error.message}`);
  }
  if (secret.isRotated) {
    console.log(`Office secret rotated in ${officeFiles.secretFile}. Paired browsers, the runner and hooks with the old secret stop working; in Docker, run docker compose restart office.`);
  } else if (secret.isCreated) {
    console.log(`Office secret created in ${officeFiles.secretFile}.`);
  }
  return secret;
}
