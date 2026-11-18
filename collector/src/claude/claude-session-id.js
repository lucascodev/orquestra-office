import { SESSION_ID_LIMIT } from "../shared/text/field-limits.js";

export const claudeSessionIdOf = (payload) => String(payload.session_id ?? "").slice(0, SESSION_ID_LIMIT);
