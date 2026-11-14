import Phaser from 'phaser';
import { getMission } from '../data/missions.js';
import { getPart } from '../core/design.js';
import { OUTCOME_TITLES } from '../core/simulate.js';
import { scoreResult } from '../core/score.js';
import { COLORS, HEX, STATUS_HEX, STATUS_COLOR, STATUS_ICON, uiText, bodyText, shadowText } from '../ui/theme.js';
import { drawFrame, panel, button, withTooltip, goto, fadeIn, soundButton } from '../ui/widgets.js';
import { partTextureKey, iconKey } from '../art/textures.js';
import { recordResult } from '../ui/progress.js';

// Post-Mortem Diagnostic report.
export class ReportScene extends Phaser.Scene {
  constructor() {
    super('Report');
  }

  init(data) {
    this.payload = data;
    this.mission = getMission(data.missionId);
    this.result = data.result;
  }

  create() {
    fadeIn(this);
    const { width } = this.scale;
    const r = this.result;
    const ok = r.success;
    this.add.image(0, 0, 'starfield').setOrigin(0).setScale(4).setAlpha(0.6);

    // banner
    const bg = this.add.graphics();
    drawFrame(bg, 40, 14, width - 80, 104, { fill: ok ? 0x123821 : 0x3a1418, light: ok ? COLORS.ok : COLORS.fail });
    uiText(this, width / 2, 24, 'POST-MORTEM ENGINEERING REPORT', 16, HEX.dim).setOrigin(0.5, 0);
    shadowText(this, width / 2, 62, ok ? 'MISSION SUCCESS' : OUTCOME_TITLES[r.outcome].toUpperCase(), 32, ok ? HEX.ok : HEX.fail).setOrigin(0.5);
    bodyText(this, width / 2, 100, `${this.mission.name}  ·  ${this.mission.target}`, 20, HEX.dim).setOrigin(0.5);
    this.add.image(96, 66, iconKey(ok ? 'ok' : 'fail')).setScale(5).setTint(ok ? COLORS.ok : COLORS.fail);

    if (ok) this.successPanel();
    else this.causePanel();
    this.checksPanel();

    const stack = this.payload.stack;
    button(this, 230, 676, {
      w: 340, h: 50, label: ok ? 'BACK TO WORKSHOP' : 'FIX IN WORKSHOP', icon: ok ? 'back' : 'reset', variant: 'primary', size: 16,
      tooltip: ok ? 'Improve your design' : 'Return with the faulty parts highlighted', hotkey: 'ENTER',
      onClick: () => goto(this, 'Builder', { missionId: this.mission.id, stack, highlight: r.failure ? r.failure.culprits : [] }),
    });
    button(this, 560, 676, { w: 220, h: 50, label: 'RELAUNCH', icon: 'rocket', tooltip: 'Watch the flight again', hotkey: 'R', onClick: () => goto(this, 'Launch', this.payload) });
    button(this, 830, 676, { w: 240, h: 50, label: 'MISSIONS', icon: 'back', variant: 'ghost', tooltip: 'Choose another mission', hotkey: 'ESC', onClick: () => goto(this, 'MissionSelect') });
    soundButton(this, 1236, 676);
  }

  causePanel() {
    const f = this.result.failure;
    const stack = this.payload.stack;
    const x = 40;
    const y = 132;
    panel(this, x, y, 600, 506, { title: 'ROOT CAUSE', titleColor: HEX.gold });
    uiText(this, x + 18, y + 46, f.title.toUpperCase(), 16, HEX.fail);
    if (f.value) bodyText(this, x + 18, y + 66, f.value, 22, HEX.warn);
    const detail = bodyText(this, x + 18, y + 94, f.detail, 22, HEX.text, { wordWrap: { width: 564 } });

    let py = y + 106 + detail.height;
    uiText(this, x + 18, py, 'PARTS INVOLVED', 16, HEX.accent);
    py += 26;
    const ids = [...new Set(f.culprits.map((i) => stack[i]))].slice(0, 4);
    if (!ids.length) bodyText(this, x + 18, py, '-', 22, HEX.dim);
    ids.forEach((id, k) => {
      const cx = x + 18 + k * 146;
      const g = this.add.graphics();
      drawFrame(g, cx, py, 136, 86, { fill: COLORS.panelDark, light: COLORS.fail });
      const img = this.add.image(cx + 68, py + 32, partTextureKey(id));
      const s = Math.min(48 / img.width, 44 / img.height);
      img.setScale(s);
      bodyText(this, cx + 68, py + 68, getPart(id).name, 16, HEX.text, { wordWrap: { width: 128 }, align: 'center' }).setOrigin(0.5);
    });
    py += 100;
    uiText(this, x + 18, py, 'HOW TO FIX', 16, HEX.ok);
    this.add.image(x + 28, py + 38, iconKey('reset')).setScale(2).setTint(COLORS.ok);
    bodyText(this, x + 46, py + 26, f.fix, 22, HEX.text, { wordWrap: { width: 536 } });
  }

  successPanel() {
    const r = this.result;
    const a = r.analysis;
    const score = scoreResult(r, this.mission);
    recordResult(this.mission.id, score);
    const x = 40;
    const y = 132;
    panel(this, x, y, 600, 506, { title: 'MISSION SCORE', titleColor: HEX.gold });
    for (let k = 0; k < 3; k++) {
      const s = this.add.image(x + 220 + k * 80, y + 92, iconKey('star')).setScale(6).setTint(k < score.stars ? COLORS.cg : 0x2c3354);
      if (k < score.stars) this.tweens.add({ targets: s, scale: 7, duration: 220, yoyo: true, delay: 300 + k * 250 });
    }
    const lines = [
      ['ok', 'Mission success', true],
      ['money', `Thrifty: cost $${a.cost.toFixed(1)}M <= 80% of $${this.mission.budget}M`, score.thrifty],
      ['science', `Bonus science: score ${a.spacecraft.science.score} >= ${this.mission.minScience * 1.5}`, score.bonusScience],
    ];
    lines.forEach(([icon, text, got], k) => {
      const ly = y + 160 + k * 34;
      this.add.image(x + 32, ly + 11, iconKey(icon)).setScale(2).setTint(got ? COLORS.ok : 0x6a7090);
      bodyText(this, x + 52, ly, text, 22, got ? HEX.text : HEX.dim);
    });
    const dv = a.dv;
    bodyText(this, x + 18, y + 284, [
      `Delta-v   ${Math.round(dv.ascent)} m/s to orbit (needed ${Math.round(dv.ascentRequired)})`,
      this.mission.dvTransfer ? `          ${Math.round(dv.transfer)} m/s transfer (needed ${this.mission.dvTransfer})` : null,
      `Stability ${a.aero.minMargin.toFixed(2)} calibers`,
      `Power     ${a.spacecraft.power.avgGen.toFixed(0)} W avg for a ${a.spacecraft.power.load} W load`,
      `Mass      ${(a.totalMass / 1000).toFixed(1)} t at liftoff`,
    ].filter(Boolean).join('\n'), 22, HEX.text);
    bodyText(this, x + 18, y + 450, score.stars < 3 ? 'Can you earn all three stars? Try a cheaper rocket or more instruments.' : 'Perfect mission. Try a harder target!', 20, HEX.accent, { wordWrap: { width: 564 } });
  }

  checksPanel() {
    const r = this.result;
    const x = 656;
    const y = 132;
    panel(this, x, y, 584, 506, { title: 'FLIGHT CHECKS' });
    let cy = y + 44;
    for (const c of r.checks) {
      const predicted = !c.reached;
      const color = predicted ? 0x6a7090 : STATUS_COLOR[c.status];
      this.add.image(x + 26, cy + 12, iconKey(STATUS_ICON[c.status])).setScale(2).setTint(color);
      bodyText(this, x + 44, cy, c.title + (predicted ? '  (predicted)' : ''), 21, predicted ? '#6a7090' : STATUS_HEX[c.status]);
      if (c.value) bodyText(this, x + 44, cy + 18, c.value, 18, HEX.dim);
      const hit = this.add.rectangle(x + 292, cy + 18, 560, 38, 0, 0).setInteractive();
      withTooltip(hit, `${c.detail}${c.status !== 'pass' && c.fix ? `\n\nFix: ${c.fix}` : ''}`);
      cy += c.value ? 38 : 28;
    }
    if (!r.success) bodyText(this, x + 18, y + 482, 'Grey = not reached in flight. Hover any line for details.', 18, HEX.dim);
  }
}
