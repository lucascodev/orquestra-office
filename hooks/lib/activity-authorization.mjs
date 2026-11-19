import { officeFilesOf } from "./office-home.mjs";
import { activityTokenOf, readSecretFile } from "./office-secret.mjs";

export function activityAuthorizationOf(homeDir) {
  const key = readSecretFile(officeFilesOf(homeDir).secretFile);
  return key ? `Bearer ${activityTokenOf(key)}` : null;
}
