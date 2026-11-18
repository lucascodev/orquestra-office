export const envValue = (env, name) => (env[name]?.trim() ? env[name] : undefined);
