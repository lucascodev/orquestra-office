const LIBUV_BEFORE_SAFE_LOOKUP = "1.47.0";

// Preloaded with --import: the hook reads process.versions.uv at start up and takes this for the libuv it runs on.
Object.defineProperty(process.versions, "uv", { value: LIBUV_BEFORE_SAFE_LOOKUP });
