// BREAKWATER — tuning, weapons and economy.
// Every number that shapes how the game feels lives here, so a balance pass
// touches one file. All names, prices and stats are original to this game.

export const TEAMS = {
  TIDE: 'tide', // attackers: the player's team, plants the beacon
  REEF: 'reef', // defenders: hold the two sites, defuse the beacon
};

export const TEAM_INFO = {
  tide: { name: 'TIDE', color: 0x2fb8a6, css: '#3fd2c0', spawnYaw: 0 },
  reef: { name: 'REEF', color: 0xe85a3c, css: '#ff7a5c', spawnYaw: Math.PI },
};

// First team to this many round wins takes the match.
export const ROUNDS_TO_WIN = 7;
export const MAX_ROUNDS = 13;
// Buy / freeze time before a round goes live, in seconds.
export const BUY_TIME = 12;
export const ROUND_TIME = 90;
export const BOMB_TIMER = 40;
export const PLANT_TIME = 4.0;
export const DEFUSE_TIME = 6.0;

export const ECONOMY = {
  startMoney: 1000,
  killReward: 250,
  plantReward: 350,
  defuseReward: 350,
  winReward: 3000,
  lossReward: 2000,
  lossBonusStep: 400, // +$400 per consecutive loss, up to the cap
  lossBonusCap: 3200,
  maxMoney: 16000,
};

// Weapons. Accuracy is the skill: standing still and aiming down sights
// shrinks the spread cone a lot, sprinting and jumping blow it up, and every
// gun kicks the view up a little per shot.
export const WEAPONS = {
  gull: {
    id: 'gull', name: 'K7 Gull', kind: 'pistol', price: 0,
    damage: 30, headshotMult: 2.0, mag: 15, reserve: 60,
    fireInterval: 0.15, reloadTime: 1.3, auto: false,
    spread: 0.010, moveSpread: 0.028, adsMult: 0.45, recoil: 0.010,
    pellets: 1, range: 55, tracer: 0xffc27a, sound: 'pistol',
  },
  squall: {
    id: 'squall', name: 'MP-9 Squall', kind: 'smg', price: 1400,
    damage: 24, headshotMult: 1.8, mag: 32, reserve: 128,
    fireInterval: 0.08, reloadTime: 1.8, auto: true,
    spread: 0.019, moveSpread: 0.042, adsMult: 0.5, recoil: 0.008,
    pellets: 1, range: 42, tracer: 0xffc27a, sound: 'smg',
  },
  breaker: {
    id: 'breaker', name: 'AR-4 Breaker', kind: 'rifle', price: 2600,
    damage: 31, headshotMult: 2.0, mag: 28, reserve: 84,
    fireInterval: 0.11, reloadTime: 2.2, auto: true,
    spread: 0.008, moveSpread: 0.033, adsMult: 0.35, recoil: 0.015,
    pellets: 1, range: 85, tracer: 0xffc27a, sound: 'rifle',
  },
  gaff: {
    id: 'gaff', name: 'SG-9 Gaff', kind: 'shotgun', price: 1600,
    damage: 10, headshotMult: 1.6, mag: 7, reserve: 28,
    fireInterval: 0.8, reloadTime: 2.6, auto: false,
    spread: 0.042, moveSpread: 0.058, adsMult: 0.7, recoil: 0.048,
    pellets: 9, range: 20, tracer: 0xff9a5a, sound: 'shotgun',
  },
  horizon: {
    id: 'horizon', name: 'LR-60 Horizon', kind: 'sniper', price: 4600,
    damage: 105, headshotMult: 2.0, mag: 5, reserve: 15,
    fireInterval: 1.2, reloadTime: 3.0, auto: false,
    spread: 0.0015, moveSpread: 0.085, adsMult: 0.25, recoil: 0.065,
    pellets: 1, range: 140, tracer: 0xbfe3ff, sound: 'sniper',
    zoomFov: 20, scope: true,
  },
};

export const GRENADES = {
  surge: {
    id: 'surge', name: 'Surge Grenade', price: 300,
    desc: 'Frag. 1.5s fuse, heavy damage in a 6.5 m blast.',
    fuse: 1.5, radius: 6.5, maxDamage: 100,
  },
  mist: {
    id: 'mist', name: 'Mist Grenade', price: 300,
    desc: 'Smoke. Blocks sight for 14 s. Throw it to cross a lane.',
    fuse: 1.1, radius: 0, duration: 14,
  },
  strobe: {
    id: 'strobe', name: 'Strobe Grenade', price: 250,
    desc: 'Flash. Blinds anyone looking at the pop for up to 2.8 s.',
    fuse: 1.3, radius: 20, blindTime: 2.8,
  },
};

export const ARMOR_PRICE = 600;
export const ARMOR_ABSORB = 0.5; // half of incoming damage eats armor first

// Bot tuning. Skill is a 0..1 roll per bot: it bends reaction time, aim error
// and burst discipline, so a round never feels like shooting statues — or
// aimbots. Nothing here reads the player's position through walls: bots only
// ever know what they can see or hear.
export const BOT = {
  countPerTeam: 5, // includes the player on TIDE, so 4 friendly bots
  health: 100,
  walkSpeed: 3.5,
  runSpeed: 4.3,
  reactionMin: 0.3,
  reactionMax: 0.8,
  aimErrorBase: 0.019, // radians of aim error at 10 m
  aimErrorPerMetre: 0.001,
  burstMin: 3,
  burstMax: 5,
  burstPauseMin: 0.5,
  burstPauseMax: 1.2,
  hearRadius: 28, // gunfire inside this radius pulls a bot to investigate
  fovCos: 0.25, // ~75 degrees half-angle of vision
  sightRange: 60,
};

export const PLAYER = {
  health: 100,
  eyeHeight: 1.62,
  crouchEyeHeight: 1.12,
  radius: 0.38,
  walkSpeed: 4.4,
  crouchSpeed: 2.1,
  adsSpeed: 2.6,
  sprintSpeed: 6.3,
  jumpSpeed: 5.2,
  gravity: 14.5,
  staminaMax: 100,
  staminaDrain: 26, // per second of sprinting
  staminaRegen: 20, // per second while not sprinting
};
