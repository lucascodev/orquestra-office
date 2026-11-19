// The signature proves the request came from this machine; the challenge proves it was made now, not captured earlier.
export function createBootstrapPairing({ bootstrapChallenges, issuePairingCode }) {
  return function bootstrapPairing({ challenge, requestHost }) {
    if (!bootstrapChallenges.redeem(challenge)) return { isFresh: false, issued: null };
    return { isFresh: true, issued: issuePairingCode({ requestHost }) };
  };
}
