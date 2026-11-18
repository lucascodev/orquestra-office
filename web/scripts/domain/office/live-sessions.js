export const agentKeyOfSession = (session) => `claude:${session.sessionId}`;

export const liveSessionOf = (sessions, agentKey) => sessions.find((session) => session.sessionId && session.status !== "ended" && agentKeyOfSession(session) === agentKey) ?? null;

export const liveAgentsOf = (sessions) => Object.fromEntries(sessions.filter((session) => liveSessionOf(sessions, agentKeyOfSession(session))).map((session) => [agentKeyOfSession(session), session.status]));
