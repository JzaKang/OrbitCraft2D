import Phaser from 'phaser';
import { getMission, BODIES } from '../data/missions.js';
import { OUTCOMES } from '../core/simulate.js';
import { buildRocket, computeDisplayLayout } from '../ui/rocketView.js';
import { COLORS, HEX, uiText, bodyText, shadowText } from '../ui/theme.js';
import { drawFrame, drawMeter, button, goto, fadeIn, soundButton } from '../ui/widgets.js';
import { iconKey } from '../art/textures.js';
import { sfx } from '../ui/sfx.js';

// Launch playback. Nothing is computed here: the scene only animates the outcome
// that runMission() already decided, so the show always matches the report.

const PAD_TOP = 620;
const SKY_SCROLL = 2160; // sky image is 2880 px tall, screen is 720

export class LaunchScene extends Phaser.Scene {
  constructor() {
    super('Launch');
  }

  init(data) {
    this.payload = data;
    this.mission = getMission(data.missionId);
    this.result = data.result;
    this.done = false;
    this.alt = 0;
    this.vel = 0;
    this.peakAlt = 1;
    this.stageNo = 1;
    this.logLines = [];
    this.met = 0;
    this.clockOn = false;
  }

  create() {
    fadeIn(this);
    this.buildWorld();
    this.buildHud();
    this.play().catch((e) => console.error(e));
  }

  // ======================================================== setup

  buildWorld() {
    this.world = this.add.container(0, 0);
    this.world.add(this.add.image(0, 720, 'sky').setOrigin(0, 1).setScale(4));
    for (let i = 0; i < 9; i++) {
      const c = this.add.image(Math.random() * 1280, -200 - Math.random() * 1100, `cloud${i % 3}`).setScale(3 + Math.random() * 2).setAlpha(0.85);
      this.tweens.add({ targets: c, x: c.x + 60, duration: 6000, yoyo: true, repeat: -1 });
      this.world.add(c);
    }
    this.world.add(this.add.image(0, 640, 'ground').setOrigin(0).setScale(4));
    this.world.add(this.add.image(560, PAD_TOP + 2, 'tower').setOrigin(0.5, 1).setScale(3));
    this.world.add(this.add.image(640, PAD_TOP + 30, 'pad').setOrigin(0.5, 1).setScale(3));

    const stack = this.payload.stack;
    const h = computeDisplayLayout(stack, 300).height;
    this.rocket = buildRocket(this, stack, { x: 640, y: PAD_TOP - h, maxHeight: 300, bodyWidth: 30 });
    this.rocketH = h;
    this.flame = this.add.image(0, h + 18, 'fx_flame').setScale(3, 3).setOrigin(0.5, 0).setVisible(false);
    this.rocket.root.add(this.flame);
    this.tweens.add({ targets: this.flame, scaleY: 3.8, duration: 70, yoyo: true, repeat: -1 });

    this.smoke = this.add.particles(0, 0, 'fx_smoke', {
      lifespan: { min: 900, max: 1700 },
      speedY: { min: 40, max: 140 },
      speedX: { min: -70, max: 70 },
      scale: { start: 2, end: 7 },
      alpha: { start: 0.5, end: 0 },
      tint: [0xf1f4f8, 0xd5dbe4, 0xb3bccb],
      frequency: 22,
      emitting: false,
    });
    this.sparks = this.add.particles(0, 0, 'fx_spark', {
      lifespan: 900, speed: { min: 80, max: 320 }, scale: { start: 3, end: 0 },
      tint: [0xffd54f, 0xff8a00, 0xff5a52, 0xffffff], emitting: false,
    });
    this.sparks.setDepth(20);
    this.smoke.setDepth(1);
    this.rocket.root.setDepth(2);
  }

  buildHud() {
    const g = this.add.graphics().setDepth(30);
    drawFrame(g, 12, 12, 330, 132, { fill: COLORS.panelDark, light: COLORS.accent, alpha: 0.92 });
    this.hudG = this.add.graphics().setDepth(31);
    uiText(this, 26, 22, this.mission.name.toUpperCase(), 16, HEX.accent).setDepth(31);
    this.hudText = bodyText(this, 26, 44, '', 22, HEX.text).setDepth(31);
    this.phaseText = bodyText(this, 26, 114, 'PRE-LAUNCH', 20, HEX.gold).setDepth(31);

    const lg = this.add.graphics().setDepth(30);
    drawFrame(lg, 928, 12, 340, 220, { fill: COLORS.panelDark, light: 0x26304f, alpha: 0.92 });
    uiText(this, 942, 22, 'FLIGHT LOG', 16, HEX.accent).setDepth(31);
    this.logText = bodyText(this, 942, 46, '', 20, HEX.text, { lineSpacing: 1 }).setDepth(31);

    const banner = shadowText(this, 640, 300, '', 32, HEX.white);
    banner.text.setDepth(40).setOrigin(0.5);
    banner.shadow.setDepth(39).setOrigin(0.5);
    this.banner = banner;

    this.speedBtn = button(this, 1012, 686, { w: 110, h: 40, label: '1x', icon: 'speed', tooltip: 'Playback speed', hotkey: 'S', variant: 'ghost', onClick: (b) => {
      const fast = this.time.timeScale === 1;
      this.setSpeed(fast ? 2.5 : 1);
      b.setLabel(fast ? '2.5x' : '1x');
    } }).setDepth(50);
    button(this, 1160, 686, { w: 170, h: 40, label: 'REPORT', icon: 'skip', variant: 'accent', tooltip: 'Skip to the post-mortem report', hotkey: 'ESC', onClick: () => this.toReport() }).setDepth(50);
    soundButton(this, 1244, 686).setDepth(50);
  }

  setSpeed(s) {
    this.time.timeScale = s;
    this.tweens.timeScale = s;
    this.smoke.timeScale = s;
    this.sparks.timeScale = s;
  }

  update(_, dt) {
    if (this.clockOn) this.met += (dt / 1000) * this.time.timeScale;
    this.hudText.setText(
      `MET   T+${this.met.toFixed(1).padStart(5, '0')} s\n` +
      `ALT   ${Math.round(this.alt).toLocaleString('en-US').padStart(7)} km\n` +
      `VEL   ${Math.round(this.vel).toLocaleString('en-US').padStart(7)} m/s   STAGE ${this.stageNo}`,
    );
    this.hudG.clear();
    drawMeter(this.hudG, 236, 52, 92, 10, this.alt / this.peakAlt, COLORS.accent);
    drawMeter(this.hudG, 236, 74, 92, 10, this.vel / 7800, COLORS.ok);

    // exhaust follows the nozzle, even when the rocket rotates
    const r = this.rocket.root;
    if (r.visible) {
      const d = this.rocketNozzleY();
      this.smoke.particleX = r.x - Math.sin(r.rotation) * d;
      this.smoke.particleY = r.y + Math.cos(r.rotation) * d;
    }
  }

  rocketNozzleY() {
    return this.flame.y + 10;
  }

  // ======================================================== helpers

  wait(ms) {
    return new Promise((res) => this.time.delayedCall(ms, res));
  }

  tween(cfg) {
    return new Promise((res) => this.tweens.add({ ...cfg, onComplete: res }));
  }

  ramp(key, to, duration, ease = 'Sine.easeInOut') {
    const o = { v: this[key] };
    return this.tween({ targets: o, v: to, duration, ease, onUpdate: () => { this[key] = o.v; } });
  }

  say(text, color = HEX.white) {
    this.banner.text.setText(text).setColor(color).setScale(1.4).setAlpha(1);
    this.banner.shadow.setText(text).setScale(1.4).setAlpha(1);
    this.tweens.add({ targets: [this.banner.text, this.banner.shadow], scale: 1, duration: 200, ease: 'Back.easeOut' });
  }

  phase(text) {
    this.phaseText.setText(text);
  }

  log(text, color = HEX.text) {
    this.logLines.push(`T+${this.met.toFixed(1).padStart(5, '0')}  ${text}`);
    this.logText.setText(this.logLines.slice(-8).join('\n'));
    this.logText.setColor(color);
    sfx.blip();
  }

  toReport() {
    if (this.done) return;
    this.done = true;
    this.setSpeed(1);
    goto(this, 'Report', this.payload);
  }

  // ======================================================== the show

  async play() {
    const r = this.result;
    const outcome = r.outcome;
    const root = this.rocket.root;

    if (outcome === OUTCOMES.OVER_BUDGET || outcome === OUTCOMES.INVALID_DESIGN) {
      this.phase('LAUNCH SCRUBBED');
      this.log(outcome === OUTCOMES.OVER_BUDGET ? 'PROGRAM OVER BUDGET' : 'DESIGN REVIEW FAILED', HEX.fail);
      this.say('LAUNCH SCRUBBED', HEX.fail);
      sfx.fail();
      await this.wait(2600);
      return this.toReport();
    }

    this.log('ALL SYSTEMS GO');
    for (const n of ['3', '2', '1']) {
      this.say(n);
      sfx.countdown();
      await this.wait(550);
    }
    this.clockOn = true;
    this.flame.setVisible(true);
    this.smoke.start();
    sfx.launch();
    this.log('IGNITION');

    if (outcome === OUTCOMES.NO_LIFTOFF) {
      this.say('');
      this.phase('THRUST < WEIGHT');
      this.cameras.main.shake(2600, 0.005);
      await this.tween({ targets: root, y: root.y - 3, duration: 90, yoyo: true, repeat: 12 });
      this.log('NO LIFTOFF: TWR < 1', HEX.fail);
      this.flame.setVisible(false);
      this.smoke.stop();
      this.say('STUCK ON THE PAD', HEX.fail);
      sfx.fail();
      await this.wait(1800);
      return this.toReport();
    }

    this.say('LIFTOFF!', HEX.ok);
    this.log('LIFTOFF');
    this.phase('ASCENT');
    this.time.delayedCall(900, () => this.say(''));

    // rocket climbs to mid-screen, then the world scrolls past it
    this.tweens.add({ targets: root, y: 360 - this.rocketH / 2, duration: 2200, ease: 'Sine.easeIn' });
    const failAscent = outcome === OUTCOMES.SUBORBITAL;
    this.peakAlt = failAscent ? 140 : this.mission.body === 'earth' ? this.mission.orbitAltKm : 200;
    const worldTween = this.tweens.add({ targets: this.world, y: SKY_SCROLL, duration: 9000, ease: 'Sine.easeIn' });

    if (outcome === OUTCOMES.UNSTABLE) {
      this.peakAlt = 10;
      await Promise.all([this.ramp('alt', 3, 1800, 'Quad.easeIn'), this.ramp('vel', 320, 1800, 'Quad.easeIn')]);
      this.phase('ATTITUDE LOST');
      this.log('CP AHEAD OF CG', HEX.fail);
      this.say('TUMBLING!', HEX.fail);
      await Promise.all([
        this.tween({ targets: root, angle: 400, x: root.x + 240, duration: 1700, ease: 'Quad.easeIn' }),
        this.ramp('vel', 80, 1700),
      ]);
      worldTween.stop();
      this.flame.setVisible(false);
      this.smoke.stop();
      this.sparks.explode(70, root.x, root.y);
      this.cameras.main.shake(500, 0.02);
      this.cameras.main.flash(150, 255, 200, 120);
      sfx.explode();
      root.setVisible(false);
      this.log('VEHICLE LOST', HEX.fail);
      this.say('VEHICLE LOST', HEX.fail);
      await this.wait(2000);
      return this.toReport();
    }

    // stage separations
    const stages = r.analysis.stages;
    const launchStages = stages.filter((s) => !s.lowThrust).length;
    const seps = Math.max(0, Math.min(launchStages, stages.length - 1));
    const step = 1900;
    for (let i = 0; i < seps; i++) {
      const f = (i + 1) / (seps + 1);
      await Promise.all([this.ramp('alt', f * this.peakAlt, step), this.ramp('vel', f * (failAscent ? 4200 : 7700), step)]);
      this.stageNo = i + 2;
      this.log(`STAGE ${i + 1} SEPARATION`);
      if (i === 0) this.log('FAIRING JETTISON');
      sfx.separation();
      const next = stages[i + 1];
      const bottomItem = this.rocket.layout.items[next.indices.at(-1)];
      this.sparks.explode(10, root.x - Math.sin(root.rotation) * (bottomItem.y + bottomItem.h), root.y + bottomItem.y + bottomItem.h);
      this.flame.y = bottomItem.y + bottomItem.h + 4;
      this.tweens.add({ targets: this.rocket.stageContainers[i], y: 400, angle: 30, alpha: 0, duration: 1800, ease: 'Quad.easeIn' });
    }
    await Promise.all([this.ramp('alt', this.peakAlt, step), this.ramp('vel', failAscent ? 4500 : 7700, step)]);

    if (failAscent) {
      this.flame.setVisible(false);
      this.smoke.stop();
      this.phase('BALLISTIC FALL');
      this.log('FUEL DEPLETED', HEX.fail);
      this.log('BELOW ORBITAL SPEED', HEX.fail);
      this.say('NOT ENOUGH DELTA-V', HEX.fail);
      sfx.fail();
      worldTween.stop();
      await Promise.all([
        this.tween({ targets: root, angle: 165, y: 900, duration: 2600, ease: 'Quad.easeIn' }),
        this.ramp('alt', 0, 2600, 'Quad.easeIn'),
      ]);
      return this.toReport();
    }

    this.flame.setVisible(false);
    this.smoke.stop();
    this.log('ORBIT INSERTION', HEX.ok);
    this.say('ORBIT!', HEX.ok);
    await this.wait(900);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    await this.wait(320);
    worldTween.stop();
    this.world.setVisible(false);
    root.setVisible(false);
    this.say('');
    this.cameras.main.fadeIn(300, 0, 0, 0);
    await this.orbitView(outcome);
    await this.wait(2200);
    this.toReport();
  }

  async orbitView(outcome) {
    const bg = this.add.image(0, 0, 'starfield').setOrigin(0).setScale(4).setDepth(-10);
    bg.setAlpha(1);
    const cx = 640;
    const cy = 400;
    this.phase('PARKING ORBIT');
    this.banner.text.y = 190;
    this.banner.shadow.y = 192;
    const home = this.add.image(cx, cy, 'planet_earth').setScale(2.6).setDepth(5);
    const sat = this.add.image(0, 0, 'sat').setScale(2.5).setDepth(6);
    const orbitG = this.add.graphics().setDepth(4);
    let center = { x: cx, y: cy };
    let rx = 230;
    let ry = 80;
    const drawOrbit = () => {
      orbitG.clear().fillStyle(0x8fd3ff, 0.6);
      for (let a = 0; a < Math.PI * 2; a += 0.08) orbitG.fillRect(Math.round(center.x + Math.cos(a) * rx), Math.round(center.y + Math.sin(a) * ry), 2, 2);
    };
    drawOrbit();
    const orbit = { a: 0, active: true };
    const orbitTween = this.tweens.add({
      targets: orbit, a: Math.PI * 2, duration: 3200, repeat: -1,
      onUpdate: () => {
        if (!orbit.active) return;
        sat.setPosition(center.x + Math.cos(orbit.a) * rx, center.y + Math.sin(orbit.a) * ry);
        sat.setDepth(Math.sin(orbit.a) < 0 ? 4 : 6); // behind the planet on the far side
      },
    });
    await this.wait(1800);

    let earthAnchor = home;
    if (this.mission.dvTransfer > 0) {
      const target = this.add.image(1080, 170, `planet_${this.mission.body}`).setScale(0.7).setDepth(5);
      const tl = bodyText(this, 1080, 230, BODIES[this.mission.body].name.toUpperCase(), 20, HEX.dim).setOrigin(0.5).setDepth(5);
      this.phase('TRANSFER BURN');
      this.log('TRANSFER BURN START');
      if (outcome === OUTCOMES.STRANDED) {
        await this.wait(1200);
        this.log('PROPELLANT DEPLETED', HEX.fail);
        this.phase('STRANDED IN EARTH ORBIT');
        this.say('STRANDED', HEX.fail);
        sfx.fail();
        return;
      }
      orbit.active = false;
      orbitTween.stop();
      orbitG.clear();
      const path = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(sat.x, sat.y), new Phaser.Math.Vector2(820, 80), new Phaser.Math.Vector2(target.x - 40, target.y));
      const pathG = this.add.graphics().setDepth(3);
      const t = { v: 0 };
      await this.tween({
        targets: t, v: 1, duration: 2600, ease: 'Sine.easeInOut',
        onUpdate: () => {
          const p = path.getPoint(t.v);
          sat.setPosition(p.x, p.y);
          if (Math.floor(t.v * 60) % 2 === 0) pathG.fillStyle(0xffd54f, 0.8).fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        },
      });
      this.log(`${BODIES[this.mission.body].name.toUpperCase()} ORBIT INSERTION`, HEX.ok);
      tl.destroy();
      pathG.destroy();
      await Promise.all([
        this.tween({ targets: home, x: 120, y: 620, scale: 0.6, duration: 1400, ease: 'Sine.easeInOut' }),
        this.tween({ targets: target, x: cx, y: cy, scale: 2.6, duration: 1400, ease: 'Sine.easeInOut' }),
        this.tween({ targets: sat, x: cx + rx, y: cy, duration: 1400 }),
      ]);
      center = { x: cx, y: cy };
      rx = 220;
      ry = 76;
      drawOrbit();
      orbit.a = 0;
      orbit.active = true;
      this.tweens.add({ targets: orbit, a: Math.PI * 2, duration: 3600, repeat: -1, onUpdate: () => {
        sat.setPosition(center.x + Math.cos(orbit.a) * rx, center.y + Math.sin(orbit.a) * ry);
        sat.setDepth(Math.sin(orbit.a) < 0 ? 4 : 6);
      } });
      earthAnchor = home;
    }

    this.phase('ORBIT OPERATIONS');
    this.log('INSTRUMENTS ON');
    await this.wait(1200);

    const signal = (reach, color) => {
      const ring = this.add.circle(sat.x, sat.y, 5).setStrokeStyle(2, color).setDepth(7);
      const pkt = this.add.rectangle(sat.x, sat.y, 4, 4, color).setDepth(7);
      this.tween({ targets: ring, scale: 6, alpha: 0, duration: 800 }).then(() => ring.destroy());
      this.tween({
        targets: pkt, x: sat.x + (earthAnchor.x - sat.x) * reach, y: sat.y + (earthAnchor.y - sat.y) * reach,
        alpha: reach < 1 ? 0 : 1, duration: 900,
      }).then(() => pkt.destroy());
    };

    switch (outcome) {
      case OUTCOMES.SUCCESS:
        for (let i = 0; i < 6; i++) { signal(1, COLORS.ok); await this.wait(250); }
        this.log('SCIENCE DATA RECEIVED', HEX.ok);
        this.phase('MISSION SUCCESS');
        this.say('MISSION SUCCESS', HEX.ok);
        this.sparks.explode(40, 640, 300);
        sfx.success();
        return;
      case OUTCOMES.DEAD_BUS:
        this.log('ENTERING ECLIPSE');
        await this.wait(800);
        this.log('BATTERY 0%: BUS VOLTAGE 0.0 V', HEX.fail);
        this.tweens.addCounter({ from: 255, to: 70, duration: 1500, onUpdate: (tw) => { const v = Math.round(tw.getValue()); sat.setTint((v << 16) | (v << 8) | v); } });
        this.say('DEAD BUS', HEX.fail);
        break;
      case OUTCOMES.THERMAL:
        this.log('TEMPERATURE OUT OF LIMITS', HEX.fail);
        this.tweens.add({ targets: sat, alpha: 0.5, duration: 120, yoyo: true, repeat: 8 });
        sat.setTint(0xff6040);
        this.sparks.explode(15, sat.x, sat.y);
        this.say('THERMAL FAILURE', HEX.fail);
        break;
      case OUTCOMES.LOSS_OF_SIGNAL:
        for (let i = 0; i < 4; i++) { signal(0.35, COLORS.warn); await this.wait(300); }
        this.log('NO SIGNAL AT GROUND STATION', HEX.fail);
        this.add.image(earthAnchor.x, earthAnchor.y - 40, iconKey('fail')).setScale(3).setTint(COLORS.fail).setDepth(8);
        this.say('LOSS OF SIGNAL', HEX.fail);
        break;
      case OUTCOMES.DATA_BOTTLENECK:
        for (let i = 0; i < 3; i++) { signal(1, COLORS.warn); await this.wait(600); }
        this.log('ONBOARD BUFFER FULL', HEX.fail);
        this.say('DATA BOTTLENECK', HEX.fail);
        break;
      default:
        for (let i = 0; i < 3; i++) { signal(1, COLORS.ok); await this.wait(300); }
        this.log('SCIENCE GOALS NOT MET', HEX.fail);
        this.say('SCIENCE SHORTFALL', HEX.fail);
    }
    this.phase('MISSION FAILED');
    sfx.fail();
  }
}
