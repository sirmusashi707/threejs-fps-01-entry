// Breakwater Terminal — the map. An original storm-lit container port:
// two beacon sites (Dry Dock north-west, Crane Basin north-east), three
// lanes running north-south between the spawns, and container rows that
// force real choices about which lane to take. Everything is axis-aligned
// boxes, which keeps collision, bullets and line-of-sight all on the same
// simple maths.
import * as THREE from 'three';
import { rayBox, segmentHitsBox2D } from './util.js';
import {
  asphaltTexture, containerTexture, crateTexture,
  hazardTexture, siteLetterTexture, softCircleTexture,
} from './textures.js';

export const MAP = {
  minX: -34, maxX: 34,
  minZ: -24, maxZ: 24,
  wallHeight: 4,
};

// Every solid thing on the map. {x, z} is the centre, w/d the footprint,
// h the height, kind picks the look. Colliders and meshes come from this one
// list, so what you see is always what blocks you.
const OBSTACLES = [
  // Perimeter walls.
  { x: 0, z: -24.5, w: 70, d: 1, h: 4, kind: 'wall' },
  { x: 0, z: 24.5, w: 70, d: 1, h: 4, kind: 'wall' },
  { x: -34.5, z: 0, w: 1, d: 50, h: 4, kind: 'wall' },
  { x: 34.5, z: 0, w: 1, d: 50, h: 4, kind: 'wall' },
  // North container row — makes the north lane, with gaps to cross through.
  { x: -24, z: -6, w: 12, d: 2.6, h: 2.6, kind: 'container', color: '#7a3b2e' },
  { x: -8, z: -6, w: 8, d: 2.6, h: 2.6, kind: 'container', color: '#2e5d6b' },
  { x: 8, z: -6, w: 10, d: 2.6, h: 2.6, kind: 'container', color: '#6b5d2f' },
  { x: 24, z: -6, w: 6, d: 2.6, h: 2.6, kind: 'container', color: '#4a4f55' },
  // South container row, mirrored.
  { x: -24, z: 6, w: 10, d: 2.6, h: 2.6, kind: 'container', color: '#2e5d6b' },
  { x: -6, z: 6, w: 10, d: 2.6, h: 2.6, kind: 'container', color: '#7a3b2e' },
  { x: 10, z: 6, w: 8, d: 2.6, h: 2.6, kind: 'container', color: '#4a4f55' },
  { x: 26, z: 6, w: 4, d: 2.6, h: 2.6, kind: 'container', color: '#5d3a5e' },
  // Double-stacked containers guarding the site approaches.
  { x: -14, z: -14, w: 6, d: 2.6, h: 5.2, kind: 'container', color: '#5d3a5e' },
  { x: 14, z: -14, w: 6, d: 2.6, h: 5.2, kind: 'container', color: '#6b5d2f' },
  // The warehouse: two long blocks with a corridor between them.
  { x: -20, z: 12, w: 8, d: 7, h: 5, kind: 'container', color: '#3c4148' },
  { x: -4, z: 12, w: 8, d: 7, h: 5, kind: 'container', color: '#3c4148' },
  // Mid: the gantry platform you can shoot over but not walk through.
  { x: 0, z: 0, w: 9, d: 3, h: 1.1, kind: 'crate' },
  // Mid crates — the crossfire cover in the middle of the terminal.
  { x: -14, z: 2, w: 2.4, d: 2.4, h: 2.2, kind: 'crate' },
  { x: 12, z: -2, w: 2.4, d: 2.4, h: 2.2, kind: 'crate' },
  { x: 14, z: 4, w: 1.6, d: 1.6, h: 1.1, kind: 'crate' },
  { x: -26, z: -2, w: 2.4, d: 2.4, h: 1.1, kind: 'crate' },
  { x: -26, z: 14, w: 2.4, d: 2.4, h: 1.1, kind: 'crate' },
  { x: 26, z: 14, w: 2.4, d: 2.4, h: 1.1, kind: 'crate' },
  // Site A cover: low crates inside Dry Dock.
  { x: -18, z: -20, w: 2.4, d: 1.2, h: 1.1, kind: 'crate' },
  { x: -26, z: -12, w: 1.6, d: 1.6, h: 1.1, kind: 'crate' },
  // Site B cover: crates around Crane Basin.
  { x: 18, z: -20, w: 2.4, d: 1.2, h: 1.1, kind: 'crate' },
  { x: 26, z: -12, w: 1.6, d: 1.6, h: 1.1, kind: 'crate' },
  // The dry dock basin: tall walls on three sides of site A, open south.
  { x: -27, z: -16, w: 1, d: 10, h: 3.5, kind: 'wall' },
  { x: -22, z: -21, w: 11, d: 1, h: 3.5, kind: 'wall' },
  { x: -17, z: -18, w: 1, d: 6, h: 3.5, kind: 'wall' },
  // Fuel tanks, the landmarks of the north half.
  { x: -14, z: -21, w: 5.4, d: 5.4, h: 6, kind: 'tank' },
  { x: 14, z: -21, w: 5.4, d: 5.4, h: 6, kind: 'tank' },
  { x: 28, z: -10, w: 5.4, d: 5.4, h: 6, kind: 'tank' },
  // Site screens: tall containers that stop the attackers seeing straight
  // into the sites from mid. A site you can shoot from mid is not a site
  // worth attacking.
  { x: -22, z: -10, w: 8, d: 2.6, h: 2.6, kind: 'container', color: '#4a4f55' },
  { x: 22, z: -10, w: 8, d: 2.6, h: 2.6, kind: 'container', color: '#2e5d6b' },
  // Spawn cover so nobody gets shot the second the round starts.
  { x: -8, z: 17, w: 2.4, d: 2.4, h: 2.2, kind: 'crate' },
  { x: 8, z: 17, w: 2.4, d: 2.4, h: 2.2, kind: 'crate' },
  { x: -8, z: -17, w: 2.4, d: 2.4, h: 2.2, kind: 'crate' },
  { x: 8, z: -17, w: 2.4, d: 2.4, h: 2.2, kind: 'crate' },
];

// Waypoint nodes for the bots. Links are computed, not hand-written: two
// nodes link when they are close and no tall obstacle stands between them.
const WAYPOINTS = [
  [-28, 18], [-18, 18], [-8, 18], [0, 18], [8, 18], [18, 18], [28, 18],
  [-28, 8], [-18, 8], [-8, 8], [0, 8], [8, 8], [18, 8], [28, 8],
  [-28, 0], [-18, 0], [-8, 0], [0, 0], [8, 0], [18, 0], [28, 0],
  [-28, -8], [-18, -8], [-8, -8], [0, -8], [8, -8], [18, -8], [28, -8],
  [-28, -18], [-18, -18], [-8, -18], [0, -18], [8, -18], [18, -18], [28, -18],
  [-22, -16], [22, -16],
];

export const SITES = {
  A: { id: 'A', name: 'Dry Dock', x: -22, z: -16, r: 5.5 },
  B: { id: 'B', name: 'Crane Basin', x: 22, z: -16, r: 5.5 },
};

export const SPAWNS = {
  tide: [
    [-6, 20], [0, 21], [6, 20], [-12, 18], [12, 18],
  ],
  reef: [
    [-6, -20], [0, -21], [6, -20], [-12, -18], [12, -18],
  ],
};

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {x0,z0,x1,z1,y0,y1} — 3D boxes
    this.footprints = []; // same boxes, for 2D tests
    this.smoke = []; // {x,y,z,r,until} — live smoke clouds block sight
    this.buildLights();
    this.buildGround();
    this.buildObstacles();
    this.buildSites();
    this.buildSky();
    this.buildWaypoints();
  }

  // --- construction -------------------------------------------------------

  buildLights() {
    const hemi = new THREE.HemisphereLight(0x5a7a9a, 0x1a2028, 0.75);
    this.scene.add(hemi);
    // Cold moonlight from the north-east, low and hard.
    const moon = new THREE.DirectionalLight(0x9ab8d8, 1.2);
    moon.position.set(20, 30, -20);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -40;
    moon.shadow.camera.right = 40;
    moon.shadow.camera.top = 30;
    moon.shadow.camera.bottom = -30;
    moon.shadow.camera.far = 90;
    moon.shadow.bias = -0.0004;
    this.scene.add(moon);
    this.scene.add(moon.target);
    // Sodium work lamps over the sites, the only warm lights in the scene.
    for (const [x, z] of [[-22, -16], [22, -16]]) {
      const lamp = new THREE.PointLight(0xffb347, 26, 28, 1.8);
      lamp.position.set(x, 6.5, z);
      this.scene.add(lamp);
    }
    // One dim lamp over the warehouse corridor.
    const ware = new THREE.PointLight(0xffb347, 12, 18, 1.8);
    ware.position.set(-12, 5.5, 12);
    this.scene.add(ware);
    this.scene.fog = new THREE.Fog(0x0e1a24, 50, 120);
  }

  buildGround() {
    const geo = new THREE.PlaneGeometry(70, 50);
    const mat = new THREE.MeshStandardMaterial({
      map: asphaltTexture(), roughness: 0.55, metalness: 0.25,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  buildObstacles() {
    const containerMats = {};
    const crateMat = new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.85 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2e343c, roughness: 0.9, metalness: 0.25 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x7a8894, roughness: 0.4, metalness: 0.8 });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    for (const o of OBSTACLES) {
      let mat = wallMat;
      let geo = boxGeo;
      let h = o.h;
      if (o.kind === 'container') {
        if (!containerMats[o.color]) {
          containerMats[o.color] = new THREE.MeshStandardMaterial({
            map: containerTexture(o.color, '#ffb347'), roughness: 0.7, metalness: 0.35,
          });
        }
        mat = containerMats[o.color];
      } else if (o.kind === 'crate') {
        mat = crateMat;
      } else if (o.kind === 'tank') {
        geo = new THREE.CylinderGeometry(2.7, 2.7, h, 20);
        mat = tankMat;
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(o.x, h / 2, o.z);
      if (o.kind !== 'tank') mesh.scale.set(o.w, h, o.d);
      mesh.castShadow = o.h > 1.5;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const box = {
        x0: o.x - o.w / 2, x1: o.x + o.w / 2,
        z0: o.z - o.d / 2, z1: o.z + o.d / 2,
        y0: 0, y1: h,
      };
      this.colliders.push(box);
      this.footprints.push(box);
    }

    // Gantry crane over site B — legs collide, the beam is decoration above play.
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xd88f1e, roughness: 0.6, metalness: 0.5 });
    for (const lx of [17, 27]) {
      const leg = new THREE.Mesh(boxGeo, craneMat);
      leg.scale.set(0.8, 9, 0.8);
      leg.position.set(lx, 4.5, -20);
      leg.castShadow = true;
      this.scene.add(leg);
      this.colliders.push({ x0: lx - 0.4, x1: lx + 0.4, z0: -20.4, z1: -19.6, y0: 0, y1: 9 });
    }
    const beam = new THREE.Mesh(boxGeo, craneMat);
    beam.scale.set(12, 0.8, 0.8);
    beam.position.set(22, 9, -20);
    this.scene.add(beam);
    // Hanging hook cable.
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 4.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x222222 }),
    );
    cable.position.set(22, 6.5, -20);
    this.scene.add(cable);

    // Floodlight poles at both sites (visual; the lamps are the point lights).
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.7, metalness: 0.6 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xff9a2a, emissiveIntensity: 2.2 });
    for (const [x, z] of [[-22, -16], [22, -16]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), poleMat);
      pole.position.set(x + 5, 3.5, z);
      this.scene.add(pole);
      const head = new THREE.Mesh(boxGeo, lampMat);
      head.scale.set(0.9, 0.25, 0.4);
      head.position.set(x + 5, 7, z);
      this.scene.add(head);
    }
  }

  buildSites() {
    const hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.9, transparent: true });
    for (const site of Object.values(SITES)) {
      // Hazard ring on the ground marking the plant zone.
      const ring = new THREE.Mesh(new THREE.RingGeometry(site.r - 0.45, site.r, 40), hazard);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(site.x, 0.02, site.z);
      this.scene.add(ring);
      const letter = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 4.4),
        new THREE.MeshBasicMaterial({ map: siteLetterTexture(site.id), transparent: true, depthWrite: false }),
      );
      letter.rotation.x = -Math.PI / 2;
      letter.position.set(site.x, 0.03, site.z);
      this.scene.add(letter);
      // Floating site label post at the edge of the zone.
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 2.4, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x2c2f33 }),
      );
      post.position.set(site.x - site.r - 0.4, 1.2, site.z);
      this.scene.add(post);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.9),
        new THREE.MeshBasicMaterial({ color: 0x1c1e22 }),
      );
      sign.position.set(site.x - site.r - 0.4, 2.6, site.z);
      sign.rotation.y = Math.PI / 4;
      this.scene.add(sign);
    }
  }

  buildSky() {
    // Storm gradient dome: a big sphere, back side, canvas gradient.
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#05080f');
    grad.addColorStop(0.55, '#0d1c2c');
    grad.addColorStop(0.75, '#1c2f42');
    grad.addColorStop(1, '#0e1a24');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(160, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
    );
    this.scene.add(dome);
    this.scene.background = new THREE.Color(0x0a141d);
  }

  buildWaypoints() {
    this.waypoints = WAYPOINTS.map(([x, z]) => ({ x, z, links: [] }));
    // Link pairs that are close with a clear walk between them. Tall
    // obstacles block a link; low crates (h <= 1.4) do not — bots walk around
    // those by steering, and the graph stays connected through the gaps.
    for (let i = 0; i < this.waypoints.length; i++) {
      for (let j = i + 1; j < this.waypoints.length; j++) {
        const a = this.waypoints[i];
        const b = this.waypoints[j];
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        if (d > 13.5) continue;
        let blocked = false;
        for (const box of this.footprints) {
          if (box.y1 <= 1.4) continue;
          if (segmentHitsBox2D(a.x, a.z, b.x, b.z, box)) { blocked = true; break; }
        }
        if (!blocked) {
          a.links.push(j);
          b.links.push(i);
        }
      }
    }
  }

  // --- queries used by gameplay -------------------------------------------

  // Nearest waypoint index to (x, z).
  nearestWaypoint(x, z) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.waypoints.length; i++) {
      const w = this.waypoints[i];
      const d = (w.x - x) * (w.x - x) + (w.z - z) * (w.z - z);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // BFS path of waypoint indices from node `from` to node `to`.
  findPath(from, to) {
    if (from === to) return [to];
    const prev = new Array(this.waypoints.length).fill(-1);
    const queue = [from];
    prev[from] = from;
    while (queue.length) {
      const cur = queue.shift();
      for (const n of this.waypoints[cur].links) {
        if (prev[n] !== -1) continue;
        prev[n] = cur;
        if (n === to) {
          const path = [to];
          let c = to;
          while (c !== from) { c = prev[c]; path.unshift(c); }
          return path;
        }
        queue.push(n);
      }
    }
    return [to];
  }

  // Push a circle (x, z, radius) out of every collider it overlaps.
  // Returns the corrected position. Low crates (h <= 1.1) still block feet.
  collideCircle(x, z, radius) {
    for (const b of this.colliders) {
      const cx = Math.max(b.x0, Math.min(x, b.x1));
      const cz = Math.max(b.z0, Math.min(z, b.z1));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 < 1e-8) {
        // Centre inside the box: push out along the smallest penetration.
        const pl = x - b.x0, pr = b.x1 - x, pt = z - b.z0, pb = b.z1 - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x0 - radius;
        else if (m === pr) x = b.x1 + radius;
        else if (m === pt) z = b.z0 - radius;
        else z = b.z1 + radius;
      } else {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      }
    }
    x = Math.max(MAP.minX + 0.5, Math.min(MAP.maxX - 0.5, x));
    z = Math.max(MAP.minZ + 0.5, Math.min(MAP.maxZ - 0.5, z));
    return { x, z };
  }

  // Nearest wall hit for a ray, up to maxDist. Returns {t, point} or null.
  rayWalls(o, d, maxDist) {
    let best = null;
    for (const b of this.colliders) {
      const t = rayBox(o, d, b);
      if (t !== null && t <= maxDist && (best === null || t < best.t)) {
        best = { t, point: { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t } };
      }
    }
    return best;
  }

  // Line of sight between two eye positions. Walls block; low crates block
  // only when the sight line dips below their top; live smoke blocks too.
  hasLOS(ax, ay, az, bx, by, bz, now) {
    const yAt = (t) => ay + (by - ay) * t;
    for (const b of this.footprints) {
      if (segmentHitsBox2D(ax, az, bx, bz, b, yAt)) return false;
    }
    for (const s of this.smoke) {
      if (now > s.until) continue;
      // Segment vs sphere in 3D, approximated by checking the closest
      // approach of the sight line to the cloud centre.
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const len2 = dx * dx + dy * dy + dz * dz;
      let t = 0;
      if (len2 > 0) {
        t = ((s.x - ax) * dx + (s.y - ay) * dy + (s.z - az) * dz) / len2;
        t = Math.max(0, Math.min(1, t));
      }
      const px = ax + dx * t - s.x;
      const py = ay + dy * t - s.y;
      const pz = az + dz * t - s.z;
      if (px * px + py * py + pz * pz < s.r * s.r) return false;
    }
    return true;
  }
}
