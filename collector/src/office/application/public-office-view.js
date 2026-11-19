const NO_SECURITY_NOTICE = Object.freeze({ legacyHooksSeenAt: null, isSecretMissing: false });

export function createPublicOfficeView({ store, decisions, outbox, security = () => NO_SECURITY_NOTICE, now = Date.now }) {
  return function publicOfficeView() {
    // meters are the raw usage counters of each session; only the daily totals they feed are shown.
    const { meters, ...office } = store.snapshot();
    // generatedAt lets the page measure times stamped by this clock, such as how long tests have been running, even when
    // the container's clock and the browser's disagree.
    return { ...office, pending: decisions.list(), outbox: outbox.counts(), security: security(), generatedAt: now() };
  };
}
