export const DEFAULT_OFFICE_URL = "http://127.0.0.1:8420";

export const officeUrlFrom = (env) => env.OFFICE_URL ?? DEFAULT_OFFICE_URL;
