// Screenshot pass for BREAKWATER: 960x540, lowfx, real renders of the
// game's own code. Takes 4 shots: menu, buy phase, combat, planted beacon.
// Usage: node tools/shots.mjs   (serve the game first on port 8902:
//   node serve.ts --port 8902)
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = new URL('../screenshots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/home/hatch/.cache/chrome-for-testing/chrome-linux64/chrome',
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle', '--use-angle=swiftshader',
    '--disable-gpu-sandbox', '--no-sandbox',
  ],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://127.0.0.1:8902/?demo=1&lowfx=1', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3000);

// 1 — main menu over the orbiting terminal.
await page.evaluate(() => {
  const g = window.__breakwater;
  g.match.phase = 'menu';
  g.game.hud.showOverlay('menu-overlay');
});
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT + '1-menu.jpg', type: 'jpeg', quality: 82 });

// 2 — buy phase with the shop open.
await page.evaluate(() => {
  const g = window.__breakwater;
  g.game.hud.hideOverlays();
  g.match.startMatch();
  g.game.player.money = 10000;
});
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + '2-buy.jpg', type: 'jpeg', quality: 82 });

// 3 — combat: deploy, buy the rifle, step into mid facing north and fire
// at the bots pushing down the lanes. (SwiftShader runs ~2 fps here, so
// the player is placed by teleport instead of walked.)
await page.evaluate(() => {
  const g = window.__breakwater;
  g.match.tryBuy('weapon:breaker');
  g.game.deploy();
  g.game.player.pos.set(0, 0, 10);
  g.game.player.yaw = 0; // face north, up the mid lane
});
await page.waitForTimeout(2000);
await page.evaluate(() => { window.__breakwater.game.mouseHeld = true; });
await page.waitForTimeout(4000);
await page.evaluate(() => { window.__breakwater.game.mouseHeld = false; });
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + '3-combat.jpg', type: 'jpeg', quality: 82 });
console.log('COMBAT', JSON.stringify(await page.evaluate(() => {
  const g = window.__breakwater;
  return { hp: Math.round(g.player.health), mag: g.game.mag, pos: g.player.pos.toArray().map((v) => +v.toFixed(1)), botsAlive: g.bots.filter((b) => b.alive).length };
})));

// 4 — the beacon planted at site A: restart the round, plant fast, shoot
// the frame while the beacon timer runs.
await page.evaluate(() => {
  const g = window.__breakwater;
  g.match.startRound();
  g.game.player.money = 10000;
  g.match.tryBuy('weapon:breaker');
  g.game.deploy();
});
await page.waitForTimeout(800);
await page.evaluate(async () => {
  const g = window.__breakwater;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  g.game.player.pos.set(-22, 0, -16);
  g.game.player.yaw = 0; // look back south down the lane at the defenders
  g.game.keys.KeyE = true;
  // SwiftShader runs ~2 fps and dt clamps at 0.05, so game time advances
  // ~0.1 s per real second: a 4 s plant needs ~40 s of real time.
  for (let i = 0; i < 400; i++) {
    await sleep(200);
    if (g.match.bombPlanted || !g.game.player.alive) break;
  }
  g.game.keys.KeyE = false;
});
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + '4-plant.jpg', type: 'jpeg', quality: 82 });
console.log('PLANT-SHOT', JSON.stringify(await page.evaluate(() => {
  const g = window.__breakwater;
  return { bombPlanted: g.match.bombPlanted, site: g.match.bombSite, bombTimer: Math.round(g.match.bombTimer || 0), hp: Math.round(g.player.health) };
})));

console.log('ERRORS:', errors.length ? errors : 'none');
for (const f of fs.readdirSync(OUT).sort()) {
  console.log('SHOT', f, fs.statSync(OUT + f).size, 'bytes');
}
await browser.close();
