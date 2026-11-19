// "beyondFront" is measured forward from the facade, which moves with the number of rows; a plain "z" is measured from the back wall.
export const MAP_MARGIN = 2;
export const YARD_DEPTH = 9;

export const YARD = {
  path: { x: 21.5, beyondFront: 0, w: 2.4, d: 9 },
  parking: { x: 1, beyondFront: 3.4, w: 9, d: 4.6 },
  parkingStripes: [
    { x: 3, beyondFront: 3.4, w: 0.08, d: 2 },
    { x: 5.2, beyondFront: 3.4, w: 0.08, d: 2 },
    { x: 7.4, beyondFront: 3.4, w: 0.08, d: 2 },
  ],
  cars: [
    { x: 1.6, beyondFront: 4, w: 1.6, d: 1, height: 0.7, colorIndex: 0 },
    { x: 4, beyondFront: 4.2, w: 1.6, d: 1, height: 0.7, colorIndex: 1 },
  ],
  sign: {
    base: { x: 10.2, beyondFront: 3.4, w: 11, d: 1.4, height: 0.15 },
    block: { x: 10.4, beyondFront: 3.6, w: 10.6, d: 1, height: 1 },
    text: "ORQUESTRA",
  },
  flagpole: { x: 24.6, beyondFront: 3.2, height: 4.2, flagWidth: 1.3 },
  trees: [
    { x: -1.4, beyondFront: 1 },
    { x: -1.2, beyondFront: 6 },
    { x: 10.6, beyondFront: 7.2 },
    { x: 20, beyondFront: 7 },
    { x: 26.4, beyondFront: 1 },
    { x: 26.6, beyondFront: 5.8 },
    { x: 27, z: 3 },
    { x: 27, z: 9 },
    { x: 27, z: 14 },
  ],
  benches: [
    { x: 14, beyondFront: 6.4, w: 1.4, d: 0.4, height: 0.45 },
    { x: 17, beyondFront: 6.4, w: 1.4, d: 0.4, height: 0.45 },
  ],
  arrival: { x: 22.7, beyondFront: 3 },
  exit: { x: 22.75, beyondFront: 0.6 },
};
