const NO_SECURITY_NOTICE = Object.freeze({ legacyHooksSeenAt: null, isSecretMissing: false });

export function createPublicOfficeView({ store, decisions, outbox, security = () => NO_SECURITY_NOTICE }) {
  return function publicOfficeView() {
    // meters are the raw usage counters of each session; only the daily totals they feed are shown.
    const { meters, ...office } = store.snapshot();
    return { ...office, pending: decisions.list(), outbox: outbox.counts(), security: security() };
  };
}
