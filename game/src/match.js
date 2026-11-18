// The match: rounds, money, the beacon, and who won.
// Phases: menu -> buy (freeze) -> live -> roundEnd -> buy ... -> matchEnd.
// TIDE attacks and plants; REEF defends and defuses. First to 7 rounds.
import {
  ROUNDS_TO_WIN, MAX_ROUNDS, BUY_TIME, ROUND_TIME, BOMB_TIMER,
  PLANT_TIME, ECONOMY, WEAPONS, GRENADES, ARMOR_PRICE, TEAM_INFO,
} from './config.js';
import { SITES, SPAWNS } from './world.js';
import { dist2D } from './util.js';

export class Match {
  constructor(game) {
    this.game = game; // main controller: player, bots, world, hud, audio, effects
    this.phase = 'menu';
    this.round = 0;
    this.maxRounds = MAX_ROUNDS;
    this.score = { tide: 0, reef: 0 };
    this.timer = 0;
    this.lossStreak = { tide: 0, reef: 0 };
    this.bombPlanted = false;
    this.bombSite = null;
    this.bombPos = null;
    this.bombTimer = 0;
    this.bombPlanter = null;
    this.carrier = null;
    this.channel = null; // { progress, label } while the player plants
    this.stats = { kills: 0, deaths: 0, headshots: 0, plants: 0, damage: 0 };
    this.roundOver = false;
    this.lastTickSecond = -1;
  }

  get sites() {
    return SITES;
  }

  get carrierIsPlayer() {
    return this.carrier === this.game.player;
  }

  siteNode(siteId) {
    const s = SITES[siteId];
    return this.game.world.nearestWaypoint(s.x, s.z);
  }

  get objectiveText() {
    if (this.phase === 'buy') return 'BUY PHASE — spend your money, then deploy (B to close)';
    if (this.phase === 'menu') return '';
    if (this.bombPlanted) return 'BEACON PLANTED AT SITE ' + this.bombSite + ' — hold the site, TIDE';
    if (this.carrierIsPlayer) return 'PLANT THE BEACON AT SITE A (DRY DOCK) OR SITE B (CRANE BASIN)';
    if (this.carrier) return 'ESCORT ' + this.carrier.name.toUpperCase() + ' — THEY CARRY THE BEACON';
    return 'ELIMINATE REEF OR PLANT THE BEACON';
  }

  // --- match flow ---------------------------------------------------------------

  startMatch() {
    this.score = { tide: 0, reef: 0 };
    this.lossStreak = { tide: 0, reef: 0 };
    this.round = 0;
    this.stats = { kills: 0, deaths: 0, headshots: 0, plants: 0, damage: 0 };
    this.game.player.money = ECONOMY.startMoney;
    this.game.setWeapon('gull');
    this.game.grenades = { surge: 0, mist: 0, strobe: 0 };
    this.startRound();
  }

  startRound() {
    this.round++;
    this.roundOver = false;
    this.bombPlanted = false;
    this.bombSite = null;
    this.bombPos = null;
    this.bombTimer = 0;
    this.bombPlanter = null;
    this.channel = null;
    this.phase = 'buy';
    this.timer = BUY_TIME;

    const g = this.game;
    // Respawns: the player and every bot back at their spawn, healthy.
    g.player.reset(SPAWNS.tide[0][0], SPAWNS.tide[0][1], TEAM_INFO.tide.spawnYaw);
    g.player.healFull();
    // Armour carries over between rounds; health and ammo do not.
    g.refillCurrentWeapon();

    // TIDE bots: two push A, two push B. The beacon goes to the player
    // while they live; if the player is down it passes to a bot.
    const tideBots = g.bots.filter((b) => b.team === 'tide');
    const reefBots = g.bots.filter((b) => b.team === 'reef');
    tideBots.forEach((b, i) => {
      const site = i < 2 ? 'A' : 'B';
      const spawn = SPAWNS.tide[(i + 1) % SPAWNS.tide.length];
      b.reset(spawn[0], spawn[1], TEAM_INFO.tide.spawnYaw, site, this.siteNode(site));
    });
    reefBots.forEach((b, i) => {
      // Two hold A, two hold B, the fifth roams mid.
      const site = i < 2 ? 'A' : i < 4 ? 'B' : null;
      const spawn = SPAWNS.reef[i % SPAWNS.reef.length];
      const node = site ? this.siteNode(site) : this.game.world.nearestWaypoint(0, 0);
      b.reset(spawn[0], spawn[1], TEAM_INFO.reef.spawnYaw, site, node);
    });
    this.carrier = g.player;
    const carrierBot = tideBots.find((b) => b.alive);
    if (carrierBot) carrierBot.isCarrier = false; // player carries while alive
    g.hud.showBuy(g.player.money);
    g.hud.markOwned(g.weapon.id, g.grenades);
    g.hud.banner('ROUND ' + this.round, 'Buy phase — B opens the shop, click DEPLOY when ready', '#ffb347');
    g.audio.ensure();
  }

  endBuyPhase() {
    this.phase = 'live';
    this.timer = ROUND_TIME;
    this.game.hud.hideBuy();
    this.game.hud.hint('Round live — plant the beacon at A or B, or eliminate REEF.');
  }

  // --- economy ---------------------------------------------------------------------

  awardMoney(amount, reason) {
    const p = this.game.player;
    p.money = Math.min(ECONOMY.maxMoney, p.money + amount);
    return amount;
  }

  tryBuy(item) {
    const p = this.game.player;
    const g = this.game;
    const [kind, id] = item.split(':');
    if (this.phase !== 'buy') return { ok: false, reason: 'The buy phase is over.' };
    if (kind === 'weapon') {
      const w = WEAPONS[id];
      if (!w) return { ok: false, reason: 'Unknown weapon.' };
      if (g.weapon.id === id) return { ok: false, reason: 'Already carrying the ' + w.name + '.' };
      if (p.money < w.price) return { ok: false, reason: 'Not enough money for the ' + w.name + '.' };
      p.money -= w.price;
      g.setWeapon(id);
      g.audio.buy();
      return { ok: true };
    }
    if (kind === 'grenade') {
      const gr = GRENADES[id];
      if (!gr) return { ok: false, reason: 'Unknown grenade.' };
      if ((g.grenades[id] || 0) >= 2) return { ok: false, reason: 'Carrying the max of ' + gr.name + '.' };
      if (p.money < gr.price) return { ok: false, reason: 'Not enough money for ' + gr.name + '.' };
      p.money -= gr.price;
      g.grenades[id] = (g.grenades[id] || 0) + 1;
      g.audio.buy();
      return { ok: true };
    }
    if (kind === 'armor') {
      if (p.armor >= 100) return { ok: false, reason: 'Armour already full.' };
      if (p.money < ARMOR_PRICE) return { ok: false, reason: 'Not enough money for the vest.' };
      p.money -= ARMOR_PRICE;
      p.armor = 100;
      g.audio.buy();
      return { ok: true };
    }
    return { ok: false, reason: 'Unknown item.' };
  }

  // --- the beacon -----------------------------------------------------------------------

  siteAt(x, z) {
    for (const site of Object.values(SITES)) {
      if (dist2D(x, z, site.x, site.z) <= site.r) return site;
    }
    return null;
  }

  // The player holds E inside a site to plant. Called every frame while live.
  updatePlayerPlant(dt, holding) {
    if (this.phase !== 'live' || !this.carrierIsPlayer || !this.game.player.alive || this.bombPlanted) {
      this.channel = null;
      return;
    }
    const site = this.siteAt(this.game.player.pos.x, this.game.player.pos.z);
    if (!holding || !site) {
      this.channel = null;
      return;
    }
    if (!this.channel) this.channel = { progress: 0, label: 'PLANTING BEACON…' };
    this.channel.progress += dt / PLANT_TIME;
    if (this.channel.progress >= 1) {
      this.channel = null;
      this.plantBomb(this.game.player, site);
    }
  }

  plantBomb(actor, site) {
    site = site || this.siteAt(actor.pos.x, actor.pos.z);
    if (!site || this.bombPlanted) return;
    this.bombPlanted = true;
    this.bombSite = site.id;
    this.bombPos = { x: actor.pos.x, z: actor.pos.z };
    this.bombTimer = BOMB_TIMER;
    this.bombPlanter = actor;
    if (actor === this.game.player) {
      this.awardMoney(ECONOMY.plantReward);
      this.stats.plants++;
      this.game.hud.banner('BEACON PLANTED', 'Site ' + site.id + ' — ' + site.name + '. Hold it for ' + BOMB_TIMER + ' seconds.', '#ffcf3d');
    } else {
      this.game.hud.banner('BEACON PLANTED', actor.name + ' planted at Site ' + site.id + ' — ' + site.name + '.', '#ffcf3d');
    }
    this.game.audio.plantBeep();
    // Every REEF bot still standing now rushes the site to defuse.
    for (const b of this.game.bots) {
      if (b.team === 'reef' && b.alive) {
        b.objectiveNode = this.siteNode(site.id);
        b.planPathTo(b.objectiveNode);
        b.investigate = null;
      }
    }
  }

  defuseBomb(actor) {
    if (!this.bombPlanted) return;
    this.bombPlanted = false;
    this.game.hud.banner('BEACON DEFUSED', actor.name + ' cut the signal. REEF takes the round.', '#ff7a5c');
    this.winRound('reef', 'defuse');
  }

  explodeBomb() {
    const pos = this.bombPos;
    this.bombPlanted = false;
    this.game.effects.explosion({ x: pos.x, y: 1, z: pos.z });
    this.game.audio.explosion();
    // The blast hurts everyone still near the site, either team.
    for (const a of this.game.allActors()) {
      if (!a.alive) continue;
      const d = dist2D(a.pos.x, a.pos.z, pos.x, pos.z);
      if (d < 12) {
        const dmg = 130 * (1 - d / 12) + 20;
        const died = a.takeDamage(dmg, this.bombPlanter || this.game.player, false);
        if (died && a !== this.game.player) this.onKill(a, this.bombPlanter || this.game.player, false);
      }
    }
    this.game.hud.banner('BEACON TRANSMITTED', 'Site ' + this.bombSite + ' is ours. TIDE takes the round.', '#3fd2c0');
    this.winRound('tide', 'detonation');
  }

  // --- kills and round ends ----------------------------------------------------------------

  onKill(victim, attacker, headshot) {
    const g = this.game;
    g.hud.killfeed(attacker === g.player ? 'YOU' : attacker.name, victim === g.player ? 'YOU' : victim.name, headshot, attacker.team);
    if (attacker === g.player) {
      this.awardMoney(ECONOMY.killReward);
      this.stats.kills++;
      if (headshot) this.stats.headshots++;
      g.audio.kill();
    }
    if (victim === g.player) {
      this.stats.deaths++;
      g.audio.hurt();
      this.passCharge();
    } else if (victim.isCarrier) {
      // A carrier bot went down: the beacon passes to a living teammate.
      this.passCharge();
    }
    this.checkElimination();
  }

  // Hand the beacon to a living TIDE member (the player first, else a bot).
  passCharge() {
    const g = this.game;
    const nextBot = g.bots.find((b) => b.team === 'tide' && b.alive);
    if (g.player.alive) {
      this.carrier = g.player;
      if (nextBot) nextBot.isCarrier = false;
    } else if (nextBot) {
      this.carrier = nextBot;
      nextBot.isCarrier = true;
      g.hud.hint(nextBot.name + ' picked up the beacon.');
    } else {
      this.carrier = null;
    }
  }

  checkElimination() {
    if (this.roundOver || this.phase !== 'live') return;
    const g = this.game;
    const tideAlive = (g.player.alive ? 1 : 0) + g.bots.filter((b) => b.team === 'tide' && b.alive).length;
    const reefAlive = g.bots.filter((b) => b.team === 'reef' && b.alive).length;
    if (reefAlive === 0) {
      this.winRound('tide', 'elimination');
    } else if (tideAlive === 0 && !this.bombPlanted) {
      this.winRound('reef', 'elimination');
    }
    // If TIDE is wiped with the beacon planted, the round plays on until the
    // transmission or a defuse — REEF can still lose it.
  }

  winRound(team, reason) {
    if (this.roundOver) return;
    this.roundOver = true;
    this.phase = 'roundEnd';
    this.timer = 4.5;
    this.score[team]++;
    const other = team === 'tide' ? 'reef' : 'tide';
    this.lossStreak[team] = 0;
    this.lossStreak[other] = Math.min(4, this.lossStreak[other] + 1);
    const lossBonus = Math.min(
      ECONOMY.lossBonusCap,
      ECONOMY.lossReward + ECONOMY.lossBonusStep * (this.lossStreak[other] - 1),
    );
    // Only the player's wallet is real; bots just fight.
    if (team === 'tide') this.awardMoney(ECONOMY.winReward);
    else this.awardMoney(lossBonus);
    const reasonText = {
      elimination: 'Enemy team eliminated',
      detonation: 'Beacon transmitted',
      defuse: 'Beacon defused',
      time: 'Time expired — site held',
    }[reason] || reason;
    if (team === 'tide') {
      this.game.hud.banner('ROUND TO TIDE', reasonText + '  ·  +' + ECONOMY.winReward, '#3fd2c0');
      this.game.audio.roundWin();
    } else {
      this.game.hud.banner('ROUND TO REEF', reasonText + '  ·  +$' + lossBonus, '#ff7a5c');
      this.game.audio.roundLose();
    }
  }

  endMatch() {
    this.phase = 'matchEnd';
    const won = this.score.tide > this.score.reef;
    const s = this.stats;
    const statsHtml =
      '<div>ROUNDS — TIDE <b>' + this.score.tide + '</b> : <b>' + this.score.reef + '</b> REEF</div>' +
      '<div>YOUR KILLS <b>' + s.kills + '</b> · DEATHS <b>' + s.deaths + '</b> · HEADSHOTS <b>' + s.headshots + '</b></div>' +
      '<div>BEACONS PLANTED <b>' + s.plants + '</b> · FINAL MONEY <b>$' + this.game.player.money.toLocaleString() + '</b></div>';
    this.game.hud.showEnd(won, statsHtml);
    if (won) this.game.audio.roundWin();
    else this.game.audio.roundLose();
  }

  // --- per-frame ----------------------------------------------------------------------------

  update(dt) {
    if (this.phase === 'menu' || this.phase === 'matchEnd') return;
    this.timer -= dt;
    if (this.phase === 'buy') {
      if (this.timer <= 0) this.endBuyPhase();
      return;
    }
    if (this.phase === 'roundEnd') {
      if (this.timer <= 0) {
        if (this.score.tide >= ROUNDS_TO_WIN || this.score.reef >= ROUNDS_TO_WIN || this.round >= this.maxRounds) {
          this.endMatch();
        } else {
          this.startRound();
        }
      }
      return;
    }
    // Live round.
    if (this.bombPlanted) {
      this.bombTimer -= dt;
      const sec = Math.ceil(this.bombTimer);
      if (sec !== this.lastTickSecond && sec <= 10 && sec > 0) {
        this.lastTickSecond = sec;
        this.game.audio.bombTick();
      }
      if (this.bombTimer <= 0) this.explodeBomb();
    } else if (this.timer <= 0) {
      this.winRound('reef', 'time');
    }
  }
}
