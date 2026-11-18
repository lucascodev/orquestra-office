export function createPublicOfficeView({ store, decisions, outbox }) {
  return function publicOfficeView() {
    // meters are the raw usage counters of each session; only the daily totals they feed are shown.
    const { meters, ...office } = store.snapshot();
    return { ...office, pending: decisions.list(), outbox: outbox.counts() };
  };
}
