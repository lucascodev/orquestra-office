const FOREARM_FORWARD = -Math.PI / 2;
const SEATED_HIP = -Math.PI / 2;
const SEATED_KNEE = Math.PI / 2;
const STEPS_PER_SECOND = 2.2;

const beat = (t, perSecond) => Math.floor(t * perSecond) % 2;
const lerp = (from, to, amount) => from + (to - from) * amount;
const swell = (progress) => Math.sin(progress * Math.PI);
const GLANCE_SIDE_SECONDS = 20;
const RALLY_SECONDS = 1.6;
// The two ends of the ping-pong table in the plan stand this far apart. Both players draw the same ball, so it reads as one.
const RALLY_LENGTH = 3.8;
const BALL_REACH = 0.35;
const BALL_SIDE = 0.3;
const BALL_ARC = 0.35;
const OTHER_END = 0.5;

function arm(person, side, shoulderX, elbowX, shoulderZ = 0) {
  const joint = person.arms[side];
  joint.shoulder.rotation.set(shoulderX, 0, shoulderZ);
  joint.elbow.rotation.x = elbowX;
}

export function resetPose(person, isSeated) {
  person.upper.rotation.set(0, 0, 0);
  person.head.rotation.set(0, 0, 0);
  arm(person, 0, 0, isSeated ? FOREARM_FORWARD : -0.15);
  arm(person, 1, 0, isSeated ? FOREARM_FORWARD : -0.15);
  for (const leg of person.legs) {
    leg.hip.rotation.x = isSeated ? SEATED_HIP : 0;
    leg.knee.rotation.x = isSeated ? SEATED_KNEE : 0;
  }
}

export function walkPose(person, t, pace = 1) {
  const phase = t * STEPS_PER_SECOND * pace * Math.PI * 2;
  person.legs.forEach((leg, i) => {
    const swing = Math.sin(phase + i * Math.PI);
    leg.hip.rotation.x = -swing * 0.6;
    leg.knee.rotation.x = Math.max(0, -swing) * 0.9;
  });
  person.arms.forEach((joint, i) => {
    joint.shoulder.rotation.set(Math.sin(phase + i * Math.PI) * 0.5, 0, 0);
    joint.elbow.rotation.x = -0.35;
  });
  person.upper.rotation.set(0.06, 0, 0);
  person.head.rotation.set(0, 0, 0);
  return Math.abs(Math.sin(phase)) * 0.03;
}

export const POSES = {
  idle: () => {},
  typing: (person, t) => {
    const tap = beat(t, 7);
    arm(person, 0, 0, FOREARM_FORWARD + (tap ? 0.14 : 0));
    arm(person, 1, 0, FOREARM_FORWARD + (tap ? 0 : 0.14));
  },
  reading: (person, t) => {
    arm(person, 0, -0.5, -1.9);
    arm(person, 1, -0.5, -1.9);
    person.head.rotation.set(0.22, Math.sin(t * 1.3) * 0.22, 0);
  },
  browsing: (person, t) => {
    arm(person, 1, 0, FOREARM_FORWARD + (beat(t, 1.5) ? 0.2 : 0));
    person.head.rotation.set(0, Math.sin(t * 0.9) * 0.4, 0);
  },
  watching: (person, t) => {
    person.upper.rotation.x = -0.16;
    arm(person, 1, 0, FOREARM_FORWARD + (beat(t, 4) ? 0.12 : 0));
    person.head.rotation.x = Math.sin(t * 1.6) * 0.06;
  },
  thinking: (person, t) => {
    arm(person, 1, -0.9, -2.25);
    person.head.rotation.set(-0.12, 0, 0.14 + Math.sin(t * 0.8) * 0.04);
  },
  pointing: (person, t) => {
    arm(person, 0, 0, -0.2, 1.25 + Math.sin(t * 3) * 0.12);
    person.head.rotation.y = 0.6;
  },
  writing: (person, t) => {
    arm(person, 1, Math.sin(t * 5) * 0.08, FOREARM_FORWARD + Math.cos(t * 5) * 0.1);
    person.head.rotation.x = 0.3;
  },
  shaking: (person, t) => {
    arm(person, 0, 0, -1.3, 0.5);
    arm(person, 1, 0, -1.3, -0.5);
    person.head.rotation.y = Math.sin(t * 12) * 0.35;
  },
  calling: (person, t) => {
    arm(person, 1, -2.7 + (beat(t, 2.5) ? 0.3 : 0), -0.2);
  },
  leaning: (person, t) => {
    person.upper.rotation.x = -0.2;
    arm(person, 0, -0.3, -1.9);
    arm(person, 1, -0.3, -1.9);
    person.head.rotation.y = Math.sin(t * 0.5) * 0.25;
  },
  facepalm: (person) => {
    arm(person, 1, -1.2, -2.4);
    person.head.rotation.x = 0.38;
  },
  sipping: (person, t) => {
    const isSipping = t % 4 < 1;
    arm(person, 1, isSipping ? -0.9 : -0.35, isSipping ? -2.1 : -1.35);
    person.head.rotation.x = isSipping ? -0.12 : 0;
  },
  gazing: (person, t) => {
    arm(person, 0, 0.45, -0.5);
    arm(person, 1, 0.45, -0.5);
    person.head.rotation.set(-0.08, Math.sin(t * 0.4) * 0.35, 0);
  },
  drawing: (person, t) => {
    arm(person, 1, -2.1 + Math.sin(t * 2.3) * 0.25, -0.3, Math.sin(t * 1.7) * 0.3);
    person.head.rotation.set(-0.15, Math.sin(t * 1.7) * 0.15, 0);
  },
  discussing: (person, t) => {
    const isTalking = t % 6 < 3;
    arm(person, 0, 0, FOREARM_FORWARD + (isTalking ? Math.sin(t * 5) * 0.3 : 0));
    arm(person, 1, 0, FOREARM_FORWARD + (isTalking ? Math.cos(t * 5) * 0.3 : 0));
    person.head.rotation.x = isTalking ? 0 : Math.sin(t * 2.5) * 0.1;
  },
  watering: (person, t) => {
    const isPouring = t % 3 < 1.8;
    arm(person, 1, -0.9, -0.5, 0);
    person.arms[1].shoulder.rotation.z = isPouring ? -0.35 : 0;
    person.head.rotation.x = 0.3;
  },
  stretching: (person, t) => {
    const isStretching = t % 9 < 3;
    if (!isStretching) return;
    person.upper.rotation.x = -0.22;
    arm(person, 0, -2.9, -0.2, 0.3);
    arm(person, 1, -2.9, -0.2, -0.3);
    person.head.rotation.x = -0.25;
  },
  playing: (person, t) => {
    person.upper.rotation.x = 0.15;
    arm(person, 0, -0.5, -0.9);
    person.head.rotation.x = -0.05 + Math.sin(t * 4) * 0.03;
  },
  gaming: (person, t) => {
    person.upper.rotation.x = 0.08;
    arm(person, 0, -1.05 + Math.sin(t * 9) * 0.08, -0.55, Math.sin(t * 7) * 0.12);
    arm(person, 1, -1.05, -0.55 + (beat(t, 6) ? 0.14 : 0));
    person.head.rotation.set(0.12, Math.sin(t * 1.4) * 0.08, 0);
  },
  lounging: (person, t) => {
    person.upper.rotation.x = -0.35;
    for (const leg of person.legs) {
      leg.hip.rotation.x = -1.25;
      leg.knee.rotation.x = 0.25;
    }
    arm(person, 0, -2.6, -2.2, 0.25);
    arm(person, 1, -2.6, -2.2, -0.25);
    person.head.rotation.x = -0.15 + Math.sin(t * 0.9) * 0.04;
  },
  dozing: (person, t) => {
    person.upper.rotation.x = -0.12;
    arm(person, 0, 0, -0.3);
    arm(person, 1, 0, -0.3);
    person.head.rotation.x = 0.42 + Math.sin(t * 1.1) * 0.06;
  },
};

export const CONVERSATION_POSES = {
  speaking: (person, t) => {
    arm(person, 0, -0.55 + Math.sin(t * 4.1) * 0.25, -1.1 + Math.cos(t * 5.3) * 0.35, 0.15);
    person.head.rotation.x = Math.sin(t * 3.2) * 0.06;
    person.head.rotation.z = Math.sin(t * 1.3) * 0.05;
  },
  listening: (person, t) => {
    const isNodding = t % 3 < 0.8;
    person.head.rotation.x = isNodding ? Math.abs(Math.sin(t * 9)) * 0.12 : 0;
    person.head.rotation.z = 0.08;
  },
};

export const FIDGET_POSES = {
  glancing: (person, t, progress) => {
    const side = Math.floor(t / GLANCE_SIDE_SECONDS) % 2 ? 1 : -1;
    person.head.rotation.y = side * 0.75 * swell(progress);
    person.upper.rotation.y = side * 0.15 * swell(progress);
  },
  neckRolling: (person, t, progress) => {
    const amount = swell(progress);
    person.head.rotation.set(0.15 * amount, 0, Math.sin(progress * Math.PI * 3) * 0.35 * amount);
  },
  headScratching: (person, t, progress) => {
    const amount = swell(progress);
    arm(person, 1, lerp(0, -2.5, amount), lerp(FOREARM_FORWARD, -1.7 + Math.sin(t * 14) * 0.15, amount));
    person.head.rotation.z = 0.15 * amount;
  },
  deskSipping: (person, t, progress) => {
    const amount = swell(progress);
    arm(person, 1, lerp(0, -0.9, amount), lerp(FOREARM_FORWARD, -2.1, amount));
    person.head.rotation.x = -0.12 * amount;
  },
  leaningBack: (person, t, progress) => {
    const amount = swell(progress);
    person.upper.rotation.x = -0.25 * amount;
    for (const side of [0, 1]) arm(person, side, lerp(0, -2.8, amount), lerp(FOREARM_FORWARD, -2.2, amount));
    person.head.rotation.x = -0.15 * amount;
  },
  eyeRubbing: (person, t, progress) => {
    const amount = swell(progress);
    for (const side of [0, 1]) arm(person, side, lerp(0, -1.2, amount), lerp(FOREARM_FORWARD, -2.3 + Math.sin(t * 9 + side) * 0.1, amount));
    person.head.rotation.x = 0.2 * amount;
  },
};

// The ball crosses the table and back in one rally, in the same place for both ends; the paddle swings as it arrives.
export function rallyAt(person, seconds) {
  const end = Math.sin(person.stop.facing) >= 0 ? 0 : OTHER_END;
  const phase = (seconds / RALLY_SECONDS + end) % 1;
  const travel = phase < OTHER_END ? phase * 2 : 2 - phase * 2;
  const hit = Math.max(0, Math.cos(phase * Math.PI * 2)) ** 4;
  person.ball.position.set(BALL_SIDE * (1 - 2 * travel), BALL_ARC * Math.sin(Math.PI * travel), BALL_REACH + travel * (RALLY_LENGTH - 2 * BALL_REACH));
  arm(person, 1, -0.5 - 0.9 * hit, -0.5, -0.2 * hit);
  person.head.rotation.y = (1 - 2 * travel) * 0.15;
}
