import { join } from "node:path";

export const OFFICE_HOME_NAME = ".orquestra-office";
export const SECRET_FILE_NAME = "secret";
export const ACTIVITY_HEADER_FILE_NAME = "activity.header";

export function officeFilesOf(homeDir) {
  const dir = join(homeDir, OFFICE_HOME_NAME);
  return { dir, secretFile: join(dir, SECRET_FILE_NAME), activityHeaderFile: join(dir, ACTIVITY_HEADER_FILE_NAME) };
}
