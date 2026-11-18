// Coordinates of the approved plan (Sede.dc.html). A "z" is measured from the back wall; "fromFront" is measured back from the
// facade and "untilFront" stretches the piece up to it, because the facade moves forward with every new row of islands.
export const HEADQUARTERS_WIDTH = 26;

export const AREAS = [
  { id: "meeting", name: "Sala de reuniões", x: 0, z: 0, w: 7, d: 6 },
  { id: "pantry", name: "Copa", x: 7, z: 0, w: 7, d: 6 },
  { id: "games", name: "Sala de jogos", x: 14, z: 0, w: 6, d: 6 },
  { id: "lounge", name: "Lounge", x: 20, z: 0, w: 6, d: 6 },
  { id: "corridor", name: "Corredor", x: 0, z: 6, w: 26, d: 2 },
  { id: "work", name: "Área de trabalho", x: 0, z: 8, w: 20, untilFront: true },
  { id: "reception", name: "Recepção", x: 20, z: 8, w: 6, untilFront: true },
];

const OUTER_WALL_HEIGHT = 2.4;
const PARTITION_HEIGHT = 1;
const LOW_WALL_HEIGHT = 0.5;
const GLASS_TOP = 2;
const THIN = 0.12;
const FACADE_BAY = 5;

const partition = (id, x, z, w, d) => ({ id, kind: "partition", x, z, w, d, height: PARTITION_HEIGHT });
const lowWall = (id, x, z, w, d) => ({ id, kind: "lowWall", x, z, w, d, height: LOW_WALL_HEIGHT });

export const WALLS = [
  { id: "back-wall", kind: "wall", x: 0, z: 0, w: 26, d: 0.2, height: OUTER_WALL_HEIGHT },
  { id: "left-wall", kind: "wall", x: 0, z: 0, w: 0.2, untilFront: true, height: OUTER_WALL_HEIGHT },
  { id: "right-wall", kind: "lowWall", x: 25.9, z: 0, w: THIN, untilFront: true, height: LOW_WALL_HEIGHT },
  partition("meeting-pantry", 7, 0, THIN, 6),
  partition("pantry-games", 14, 0, THIN, 6),
  partition("games-lounge", 20, 0, THIN, 6),
  partition("meeting-front-west", 0, 5.9, 3, THIN),
  partition("meeting-front-east", 4.2, 5.9, 2.8, THIN),
  partition("pantry-front-west", 7, 5.9, 3, THIN),
  partition("pantry-front-east", 11.2, 5.9, 2.8, THIN),
  partition("games-front-west", 14, 5.9, 2.4, THIN),
  partition("games-front-east", 17.8, 5.9, 2.2, THIN),
  partition("lounge-front-west", 20, 5.9, 2.4, THIN),
  partition("lounge-front-east", 23.8, 5.9, 2.2, THIN),
  lowWall("corridor-work-1", 0, 8, 3.4, THIN),
  lowWall("corridor-work-2", 5.2, 8, 4.2, THIN),
  lowWall("corridor-work-3", 11.2, 8, 4.2, THIN),
  lowWall("corridor-work-4", 17.2, 8, 2.8, THIN),
  lowWall("corridor-reception-west", 20, 8, 2.4, THIN),
  lowWall("corridor-reception-east", 23.6, 8, 2.4, THIN),
  partition("reception-divider-back", 20, 8, THIN, 3),
  { id: "reception-divider-front", kind: "partition", x: 20, z: 13, w: THIN, untilFront: true, height: PARTITION_HEIGHT },
  { id: "facade-0", kind: "facade", x: 0, fromFront: 0.1, w: FACADE_BAY, d: THIN, height: LOW_WALL_HEIGHT, glassTop: GLASS_TOP },
  { id: "facade-1", kind: "facade", x: 5, fromFront: 0.1, w: FACADE_BAY, d: THIN, height: LOW_WALL_HEIGHT, glassTop: GLASS_TOP },
  { id: "facade-2", kind: "facade", x: 10, fromFront: 0.1, w: FACADE_BAY, d: THIN, height: LOW_WALL_HEIGHT, glassTop: GLASS_TOP },
  { id: "facade-3", kind: "facade", x: 15, fromFront: 0.1, w: FACADE_BAY, d: THIN, height: LOW_WALL_HEIGHT, glassTop: GLASS_TOP },
  { id: "reception-facade-west", kind: "lowWall", x: 20, fromFront: 0.1, w: 1.5, d: THIN, height: LOW_WALL_HEIGHT },
  { id: "reception-facade-east", kind: "lowWall", x: 24, fromFront: 0.1, w: 2, d: THIN, height: LOW_WALL_HEIGHT },
];

export const DOORS = [
  { id: "meeting-door", from: "corridor", to: "meeting", x: 3, z: 5.9, w: 1.2, d: THIN },
  { id: "pantry-door", from: "corridor", to: "pantry", x: 10, z: 5.9, w: 1.2, d: THIN },
  { id: "games-door", from: "corridor", to: "games", x: 16.4, z: 5.9, w: 1.4, d: THIN },
  { id: "lounge-door", from: "corridor", to: "lounge", x: 22.4, z: 5.9, w: 1.4, d: THIN },
  { id: "work-west-passage", from: "corridor", to: "work", x: 3.4, z: 8, w: 1.8, d: THIN },
  { id: "work-middle-passage", from: "corridor", to: "work", x: 9.4, z: 8, w: 1.8, d: THIN },
  { id: "work-east-passage", from: "corridor", to: "work", x: 15.4, z: 8, w: 1.8, d: THIN },
  { id: "reception-passage", from: "corridor", to: "reception", x: 22.4, z: 8, w: 1.2, d: THIN },
  { id: "reception-side-passage", from: "work", to: "reception", x: 20, z: 11, w: THIN, d: 2 },
  { id: "main-door", from: "reception", to: "yard", x: 21.5, fromFront: 0.1, w: 2.5, d: THIN },
];

const meetingChair = (index, x, z, faces) => ({ id: `meeting-chair-${index}`, kind: "chair", areaId: "meeting", x, z, w: 0.5, d: 0.5, height: 0.45, faces });

export const FURNITURE = [
  { id: "meeting-table", kind: "meetingTable", areaId: "meeting", x: 1.4, z: 2, w: 4, d: 1.8, height: 0.75 },
  meetingChair(0, 1.8, 1.4, "front"),
  meetingChair(1, 3.2, 1.4, "front"),
  meetingChair(2, 4.6, 1.4, "front"),
  meetingChair(3, 1.8, 4, "back"),
  meetingChair(4, 3.2, 4, "back"),
  meetingChair(5, 4.6, 4, "back"),
  { id: "whiteboard", kind: "whiteboard", areaId: "meeting", x: 1.6, z: 0.2, w: 3.6, d: 0.06, y: 1, height: 1.1 },
  { id: "coffee-counter", kind: "coffeeCounter", areaId: "pantry", x: 7.4, z: 0.3, w: 5.4, d: 0.8, height: 1 },
  { id: "fridge", kind: "fridge", areaId: "pantry", x: 13, z: 0.3, w: 0.8, d: 0.8, height: 1.9 },
  { id: "high-table-west", kind: "highTable", areaId: "pantry", x: 9, z: 3, w: 1, d: 1, height: 0.7 },
  { id: "high-table-east", kind: "highTable", areaId: "pantry", x: 11.4, z: 3.4, w: 1, d: 1, height: 0.7 },
  { id: "pantry-window", kind: "window", areaId: "pantry", x: 8, z: 0.2, w: 2, d: 0.06, y: 1.4, height: 0.6 },
  { id: "pingpong-table", kind: "pingpongTable", areaId: "games", x: 15, z: 2, w: 3, d: 1.6, height: 0.75 },
  { id: "arcade", kind: "arcade", areaId: "games", x: 19, z: 0.4, w: 0.8, d: 0.8, height: 1.8 },
  { id: "puff", kind: "puff", areaId: "games", x: 14.6, z: 4.6, w: 0.9, d: 0.9, height: 0.4 },
  { id: "sofa", kind: "sofa", areaId: "lounge", x: 21, z: 1, w: 3, d: 1, height: 0.5 },
  { id: "coffee-table", kind: "coffeeTable", areaId: "lounge", x: 21.4, z: 3.2, w: 1.6, d: 1, height: 0.4 },
  { id: "lounge-plant", kind: "plant", areaId: "lounge", x: 24.8, z: 0.4, w: 0.8, d: 0.8, height: 1 },
  { id: "reception-counter", kind: "receptionCounter", areaId: "reception", x: 21.4, z: 11.6, w: 3, d: 0.9, height: 1 },
  { id: "reception-sign", kind: "sign", areaId: "reception", x: 21.4, z: 8.2, w: 3.4, d: 0.06, y: 1.1, height: 0.8, text: "ORQUESTRA" },
  { id: "waiting-bench", kind: "bench", areaId: "reception", x: 21, fromFront: 2.8, w: 2.6, d: 0.8, height: 0.45 },
  { id: "reception-plant", kind: "plant", areaId: "reception", x: 25, z: 9, w: 0.8, d: 0.8, height: 1.2 },
];

export const RECEPTIONIST = { x: 22.8, z: 11.1, faces: "front" };

// Offsets from the corner of an island place left over on the last row: the first one gets the water cooler.
export const CONVIVENCE_CORNERS = [
  [
    { kind: "waterCooler", dx: 1, dz: 0.2, w: 1.2, d: 0.8, height: 1.1 },
    { kind: "plant", dx: 2.6, dz: 0.6, w: 0.9, d: 0.9, height: 1.1 },
  ],
  [{ kind: "plant", dx: 1.6, dz: 0.2, w: 0.9, d: 0.9, height: 1.3 }],
];

export const RECEPTION_WATER_COOLER = { id: "reception-water-cooler", kind: "waterCooler", areaId: "reception", x: 25, fromFront: 3, w: 0.8, d: 1.2, height: 1.1 };
