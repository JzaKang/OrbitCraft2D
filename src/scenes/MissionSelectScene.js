import Phaser from 'phaser';
import { MISSIONS } from '../data/missions.js';
import { COLORS, HEX, uiText, bodyText, shadowText } from '../ui/theme.js';
import { drawFrame, button, goto, fadeIn, soundButton } from '../ui/widgets.js';
import { iconKey } from '../art/textures.js';
import { getProgress } from '../ui/progress.js';
import { sfx } from '../ui/sfx.js';

const CARD_W = 372;
const CARD_H = 488;

export class MissionSelectScene extends Phaser.Scene {
  constructor() {
    super('MissionSelect');
  }

  create() {
    const { width } = this.scale;
    fadeIn(this);
    this.add.image(0, 0, 'starfield').setOrigin(0).setScale(4);
    this.twinkle();
    this.add.image(1180, 70, 'planet_earth').setScale(1.4).setAlpha(0.25);

    shadowText(this, width / 2, 46, 'ORBITCRAFT 2D', 48, HEX.accent, '#0b2a40').setOrigin(0.5, 0.5);
    bodyText(this, width / 2, 92, 'Build it.  Launch it.  Find out exactly why it failed.', 26, HEX.dim).setOrigin(0.5);
    uiText(this, width / 2, 130, 'CHOOSE A MISSION', 16, HEX.gold).setOrigin(0.5);

    const progress = getProgress();
    const gap = 28;
    const x0 = width / 2 - CARD_W - gap;
    MISSIONS.forEach((m, i) => this.card(m, i, x0 + i * (CARD_W + gap), 156 + CARD_H / 2, progress[m.id]));

    bodyText(this, width / 2, 700, 'Data: NASA Small Spacecraft SOA 2024 · VCLS · GMAT · TIR-33      Keys: 1 2 3 choose · M sound', 18, HEX.dim).setOrigin(0.5);
    soundButton(this, width - 32, 32);
  }

  twinkle() {
    for (let i = 0; i < 40; i++) {
      const s = this.add.image(Math.random() * 1280, Math.random() * 720, 'fx_spark').setScale(Math.random() < 0.8 ? 1 : 2).setAlpha(0.2);
      this.tweens.add({ targets: s, alpha: 0.9, duration: 600 + Math.random() * 1400, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
    }
  }

  card(m, i, cx, cy, prog) {
    const c = this.add.container(cx, cy);
    const g = this.add.graphics();
    const drawBg = (hover) => {
      g.clear();
      g.fillStyle(0x000000, 0.4).fillRect(-CARD_W / 2 + 4, -CARD_H / 2 + 6, CARD_W, CARD_H);
      drawFrame(g, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, {
        fill: hover ? 0x1c2340 : COLORS.panel,
        light: hover ? COLORS.accent : COLORS.bevelLight,
      });
    };
    drawBg(false);
    c.add(g);

    const top = -CARD_H / 2;
    const planet = this.add.image(0, top + 74, `planet_${m.body}`).setScale(1.15);
    this.tweens.add({ targets: planet, y: planet.y - 5, duration: 1800 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    c.add(planet);
    if (m.body !== 'earth') c.add(this.add.image(-120, top + 110, 'planet_earth').setScale(0.35));

    c.add(uiText(this, 0, top + 146, m.name.toUpperCase(), 16, HEX.white).setOrigin(0.5));
    c.add(bodyText(this, 0, top + 168, m.target, 20, HEX.accent).setOrigin(0.5));

    // difficulty pips
    for (let k = 0; k < 3; k++) {
      c.add(this.add.rectangle(-26 + k * 26, top + 198, 18, 10, k < m.difficulty ? COLORS.warn : 0x2a3150).setStrokeStyle(2, 0x0b0d18));
    }

    const rows = [
      ['money', `Budget`, `$${m.budget}M`],
      ['dv', 'Delta-v', `${(m.dvToOrbit + m.dvTransfer).toLocaleString('en-US')} m/s`],
      ['science', 'Science', `score ${m.minScience} or more`],
      ['science', 'Needs', m.requiredTags.join(' + ')],
      ['comms', 'Distance', `${m.commsDistanceKm.toLocaleString('en-US')} km`],
    ];
    rows.forEach(([icon, label, value], k) => {
      const y = top + 216 + k * 25;
      c.add(this.add.image(-CARD_W / 2 + 32, y + 10, iconKey(icon)).setScale(2).setTint(COLORS.accent));
      c.add(bodyText(this, -CARD_W / 2 + 52, y, label, 20, HEX.dim));
      c.add(bodyText(this, -CARD_W / 2 + 140, y, value, 20, HEX.text));
    });
    c.add(bodyText(this, -CARD_W / 2 + 22, top + 346, m.brief, 19, HEX.dim, { wordWrap: { width: CARD_W - 44 } }));

    if (prog?.stars) {
      for (let k = 0; k < 3; k++) {
        c.add(this.add.image(CARD_W / 2 - 78 + k * 22, top + 22, iconKey('star')).setScale(2).setTint(k < prog.stars ? COLORS.cg : 0x3a4060));
      }
      c.add(bodyText(this, -CARD_W / 2 + 16, top + 10, `BEST $${prog.bestCost.toFixed(1)}M`, 18, HEX.ok));
    }

    const go = () => goto(this, 'Builder', { missionId: m.id, stack: [...m.starterDesign] });
    const btn = button(this, 0, CARD_H / 2 - 34, { w: CARD_W - 40, h: 44, label: prog?.stars ? 'PLAY AGAIN' : 'START MISSION', icon: 'rocket', variant: 'primary', onClick: go });
    c.add(btn);

    // whole card is hoverable / clickable
    const hit = this.add.rectangle(0, -30, CARD_W, CARD_H - 70, 0, 0).setInteractive({ useHandCursor: true });
    c.addAt(hit, 1);
    hit.on('pointerover', () => { drawBg(true); sfx.hover(); this.tweens.add({ targets: c, y: cy - 6, duration: 120 }); });
    hit.on('pointerout', () => { drawBg(false); this.tweens.add({ targets: c, y: cy, duration: 120 }); });
    hit.on('pointerup', () => { sfx.click(); go(); });
    this.input.keyboard.on(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, () => { sfx.click(); go(); });
  }
}
