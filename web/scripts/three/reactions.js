const reaction = (pose, emote = null, prop = null, { fidgets = false } = {}) => ({ pose, emote, prop, fidgets, hidesOnArrival: false });
const atWork = (pose, emote = null, prop = null) => reaction(pose, emote, prop, { fidgets: true });

export const REACTIONS = {
  typing: atWork("typing"),
  reading: atWork("reading", null, "paper"),
  browsing: atWork("browsing", "globe"),
  running: atWork("watching", "terminal"),
  thinking: atWork("thinking", "dots"),
  delegating: atWork("pointing", "arrow"),
  planning: atWork("writing", "list"),
  failed: reaction("shaking", "cross"),
  permission: reaction("calling", "alert"),
  asking: reaction("calling", "question"),
  blocked: reaction("facepalm", "cross"),
  unwinding: reaction("leaning", "check"),
  handingOver: reaction("idle", null, "paper"),
  leaving: { ...reaction("idle"), hidesOnArrival: true },

  coffee: reaction("sipping", "check", "mug"),
  water: reaction("sipping", null, "mug"),
  gazing: reaction("gazing"),
  shelving: reaction("reaching"),
  filing: reaction("rummaging"),
  copying: reaction("copying", null, "paper"),
  drawing: reaction("drawing"),
  meeting: reaction("discussing", "talk"),
  resting: reaction("dozing", "zzz"),
  watering: reaction("watering", null, "can"),
  stretching: reaction("stretching"),
};
