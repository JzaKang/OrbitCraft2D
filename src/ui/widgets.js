// Pixel UI kit: bevelled frames, buttons with hover/press/disabled states and hotkeys,
// tooltips, toasts, meters, status lamps and a modal dialog.

import Phaser from 'phaser';
import { COLORS, HEX, uiText, bodyText } from './theme.js';
import { iconKey } from '../art/textures.js';
import { sfx } from './sfx.js';

// ---------- frames ----------

/** Bevelled pixel frame with cut corners, drawn into a Graphics object. */
export function drawFrame(g, x, y, w, h, s = {}) {
  const fill = s.fill ?? COLORS.panel;
  const light = s.light ?? COLORS.bevelLight;
  const dark = s.dark ?? COLORS.bevelDark;
  const border = s.border ?? COLORS.border;
  const b = 2;
  g.fillStyle(border, s.alpha ?? 1);
  g.fillRect(x + b, y, w - 2 * b, b);
  g.fillRect(x + b, y + h - b, w - 2 * b, b);
  g.fillRect(x, y + b, b, h - 2 * b);
  g.fillRect(x + w - b, y + b, b, h - 2 * b);
  g.fillStyle(fill, s.alpha ?? 1);
  g.fillRect(x + b, y + b, w - 2 * b, h - 2 * b);
  g.fillStyle(light, s.alpha ?? 1);
  g.fillRect(x + b, y + b, w - 2 * b, b);
  g.fillRect(x + b, y + b, b, h - 2 * b);
  g.fillStyle(dark, s.alpha ?? 1);
  g.fillRect(x + b, y + h - 2 * b, w - 2 * b, b);
  g.fillRect(x + w - 2 * b, y + 2 * b, b, h - 3 * b);
  return g;
}

/** Panel with optional title tab. Returns the Graphics. */
export function panel(scene, x, y, w, h, { title, fill, titleColor = HEX.accent } = {}) {
  const g = scene.add.graphics();
  drawFrame(g, x, y, w, h, { fill: fill ?? COLORS.panel });
  if (title) {
    g.fillStyle(COLORS.panelDark).fillRect(x + 4, y + 4, w - 8, 26);
    g.fillStyle(COLORS.accent, 0.5).fillRect(x + 4, y + 30, w - 8, 2);
    uiText(scene, x + 12, y + 9, title, 16, titleColor);
  }
  return g;
}

// ---------- buttons ----------

const VARIANTS = {
  default: { fill: 0x26304f, hover: 0x33406a, light: 0x45558a, dark: 0x141a30, text: HEX.text },
  primary: { fill: 0x2a8a3c, hover: 0x33a449, light: 0x6bd17a, dark: 0x164f22, text: '#ffffff' },
  danger: { fill: 0x9c2f2f, hover: 0xb83a3a, light: 0xe06a6a, dark: 0x561616, text: '#ffffff' },
  accent: { fill: 0x1f6fb2, hover: 0x2884cf, light: 0x63b6f0, dark: 0x0e3c66, text: '#ffffff' },
  ghost: { fill: 0x161b2e, hover: 0x222a45, light: 0x2c3558, dark: 0x0b0d18, text: HEX.text },
};

export class PixelButton extends Phaser.GameObjects.Container {
  constructor(scene, x, y, opts) {
    super(scene, x, y);
    this.o = { w: 160, h: 40, label: '', icon: null, variant: 'default', size: 16, iconScale: 2, onClick: () => {}, sound: 'click', ...opts };
    this.enabled = true;
    this.selected = false;
    this.state_ = 'normal';
    this.pressed = false;

    this.bg = scene.add.graphics();
    this.content = scene.add.container(0, 0);
    this.add([this.bg, this.content]);
    this.buildContent();

    const hit = scene.add.rectangle(0, 0, this.o.w, this.o.h, 0x000000, 0).setInteractive({ useHandCursor: true });
    this.hit = hit;
    this.add(hit);
    hit.on('pointerover', () => {
      if (!this.enabled) return;
      this.setVisual('hover');
      sfx.hover();
      if (this.o.tooltip) tooltip(scene).show(this.tooltipText(), this);
    });
    hit.on('pointerout', () => {
      this.pressed = false;
      this.setVisual('normal');
      if (this.o.tooltip) tooltip(scene).hide();
    });
    hit.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.setVisual('down');
    });
    hit.on('pointerup', () => {
      if (!this.pressed || !this.enabled) return;
      this.pressed = false;
      this.setVisual('hover');
      this.fire();
    });

    if (this.o.hotkey) {
      scene.input.keyboard.on(`keydown-${this.o.hotkey}`, () => {
        if (!this.enabled || !this.visible || scene.modalOpen) return;
        this.setVisual('down');
        scene.time.delayedCall(90, () => this.setVisual('normal'));
        this.fire();
      });
    }
    this.setVisual('normal');
    scene.add.existing(this);
  }

  tooltipText() {
    const key = this.o.hotkeyLabel ?? this.o.hotkey;
    return key ? `${this.o.tooltip}  [${key}]` : this.o.tooltip;
  }

  fire() {
    if (this.o.sound && sfx[this.o.sound]) sfx[this.o.sound]();
    this.o.onClick(this);
  }

  buildContent() {
    this.content.removeAll(true);
    const { icon, label, size, iconScale } = this.o;
    const parts = [];
    if (icon) parts.push(this.scene.add.image(0, 0, iconKey(icon)).setScale(iconScale));
    if (label) parts.push(uiText(this.scene, 0, 0, label, size, VARIANTS[this.o.variant].text).setOrigin(0.5));
    const gap = 8;
    const widths = parts.map((p) => p.displayWidth);
    let x = -(widths.reduce((s, w) => s + w, 0) + gap * (parts.length - 1)) / 2;
    parts.forEach((p, i) => {
      p.setPosition(Math.round(x + widths[i] / 2), 0);
      x += widths[i] + gap;
    });
    this.labelObj = parts.find((p) => p.type === 'Text');
    this.iconObj = icon ? parts[0] : null;
    this.content.add(parts);
  }

  setVisual(state) {
    this.state_ = state;
    const v = VARIANTS[this.selected ? 'accent' : this.o.variant];
    const { w, h } = this.o;
    const off = state === 'down' ? 2 : 0;
    const g = this.bg.clear();
    if (state !== 'down') g.fillStyle(0x000000, 0.35).fillRect(-w / 2 + 2, -h / 2 + 4, w, h - 2);
    drawFrame(g, -w / 2, -h / 2 + off, w, h - 2, {
      fill: !this.enabled ? 0x2a2e3e : state === 'hover' ? v.hover : v.fill,
      light: this.enabled ? v.light : 0x3a3f52,
      dark: v.dark,
    });
    this.content.y = off - 1;
    this.content.setAlpha(this.enabled ? 1 : 0.45);
  }

  setEnabled(on) {
    this.enabled = on;
    this.hit.input.cursor = on ? 'pointer' : 'default';
    this.setVisual('normal');
    return this;
  }

  setSelected(on) {
    this.selected = on;
    this.setVisual(this.state_ === 'down' ? 'normal' : this.state_);
    return this;
  }

  setLabel(label) {
    this.o.label = label;
    this.buildContent();
    this.setVisual(this.state_);
    return this;
  }

  setIcon(icon) {
    this.o.icon = icon;
    this.buildContent();
    this.setVisual(this.state_);
    return this;
  }
}

export function button(scene, x, y, opts) {
  return new PixelButton(scene, x, y, opts);
}

export function iconButton(scene, x, y, icon, opts = {}) {
  return new PixelButton(scene, x, y, { w: 40, h: 40, icon, ...opts });
}

// ---------- tooltip ----------

class Tooltip {
  constructor(scene) {
    this.scene = scene;
    this.box = scene.add.container(0, 0).setDepth(9000).setVisible(false);
    this.g = scene.add.graphics();
    this.text = bodyText(scene, 10, 6, '', 20, HEX.text, { wordWrap: { width: 320 } });
    this.box.add([this.g, this.text]);
    this.timer = null;
  }

  /** anchor: a game object (positioned near it) or {x, y}. */
  show(str, anchor) {
    this.hide();
    this.timer = this.scene.time.delayedCall(250, () => {
      this.text.setText(str);
      const w = Math.ceil(this.text.width) + 20;
      const h = Math.ceil(this.text.height) + 12;
      this.g.clear();
      drawFrame(this.g, 0, 0, w, h, { fill: 0x0f1322, light: 0x2f3a60 });
      const p = this.scene.input.activePointer;
      let x = (anchor?.x != null && !anchor.getBounds ? anchor.x : p.x) + 16;
      let y = (anchor?.y != null && !anchor.getBounds ? anchor.y : p.y) + 20;
      const { width, height } = this.scene.scale;
      if (x + w > width - 4) x = width - w - 4;
      if (y + h > height - 4) y = p.y - h - 10;
      this.box.setPosition(Math.round(x), Math.round(y)).setVisible(true);
    });
  }

  hide() {
    this.timer?.remove();
    this.timer = null;
    this.box.setVisible(false);
  }
}

export function tooltip(scene) {
  if (!scene.__tooltip || !scene.__tooltip.box.scene) scene.__tooltip = new Tooltip(scene);
  return scene.__tooltip;
}

/** Make any interactive object show a tooltip on hover. */
export function withTooltip(obj, textOrFn) {
  obj.on('pointerover', () => tooltip(obj.scene).show(typeof textOrFn === 'function' ? textOrFn() : textOrFn, null));
  obj.on('pointerout', () => tooltip(obj.scene).hide());
  return obj;
}

// ---------- toast ----------

export function toast(scene, msg, kind = 'info') {
  scene.__toast?.destroy();
  const color = { info: COLORS.accent, ok: COLORS.ok, warn: COLORS.warn, fail: COLORS.fail }[kind];
  const t = bodyText(scene, 0, 0, msg, 22, HEX.text);
  const w = Math.ceil(t.width) + 32;
  const h = 36;
  const g = scene.add.graphics();
  drawFrame(g, -w / 2, -h / 2, w, h, { fill: 0x0f1322, light: color });
  g.fillStyle(color).fillRect(-w / 2 + 6, -h / 2 + 8, 4, h - 16);
  t.setOrigin(0.5).setPosition(6, -1);
  const box = scene.add.container(scene.scale.width / 2, 610, [g, t]).setDepth(8000).setAlpha(0);
  scene.__toast = box;
  scene.tweens.add({ targets: box, alpha: 1, y: 600, duration: 150 });
  scene.tweens.add({ targets: box, alpha: 0, delay: 1800, duration: 300, onComplete: () => box.destroy() });
  return box;
}

// ---------- meters & lamps ----------

/**
 * Segmented bar. frac in [0,1]; marks = array of fractions drawn as ticks.
 */
export function drawMeter(g, x, y, w, h, frac, color, marks = []) {
  g.fillStyle(0x07090f).fillRect(x, y, w, h);
  g.fillStyle(0x1a2036).fillRect(x + 1, y + 1, w - 2, h - 2);
  const seg = 5;
  const inner = w - 4;
  const filled = Math.round(Math.max(0, Math.min(1, frac)) * inner);
  g.fillStyle(color);
  for (let i = 0; i < filled; i += seg) g.fillRect(x + 2 + i, y + 2, Math.min(seg - 1, filled - i), h - 4);
  g.fillStyle(0xffffff, 0.25);
  for (let i = 0; i < filled; i += seg) g.fillRect(x + 2 + i, y + 2, Math.min(seg - 1, filled - i), 1);
  g.fillStyle(0xffffff);
  for (const m of marks) g.fillRect(Math.round(x + 2 + m * inner) - 1, y - 2, 2, h + 4);
}

export function lamp(scene, x, y, status) {
  const color = { pass: COLORS.ok, warn: COLORS.warn, fail: COLORS.fail }[status] ?? 0x6a7090;
  return scene.add.image(x, y, iconKey(status === 'pass' ? 'ok' : status === 'warn' ? 'warn' : 'fail')).setTint(color).setScale(2);
}

// ---------- modal ----------

export function modal(scene, { title, body, width = 720, onClose }) {
  const { width: W, height: H } = scene.scale;
  scene.modalOpen = true;
  const root = scene.add.container(0, 0).setDepth(9500);
  const shade = scene.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive();
  const text = bodyText(scene, 0, 0, body, 22, HEX.text, { wordWrap: { width: width - 56 }, lineSpacing: 2 });
  const height = Math.ceil(text.height) + 140;
  const x = (W - width) / 2;
  const y = (H - height) / 2;
  const g = scene.add.graphics();
  drawFrame(g, x, y, width, height, { fill: COLORS.panel, light: 0x4fc3f7 });
  const t = uiText(scene, x + 28, y + 22, title, 24, HEX.accent);
  text.setPosition(x + 28, y + 64);
  root.add([shade, g, t, text]);
  const close = () => {
    root.destroy();
    scene.input.keyboard.off('keydown-ESC', close);
    scene.time.delayedCall(0, () => { scene.modalOpen = false; });
    onClose?.();
  };
  const btn = button(scene, W / 2, y + height - 36, { w: 180, h: 40, label: 'GOT IT', variant: 'accent', onClick: close });
  root.add(btn);
  scene.input.keyboard.once('keydown-ESC', close);
  return root;
}

/** Fade-out then start another scene (consistent transitions). */
export function goto(scene, key, data) {
  if (scene.__leaving) return;
  scene.__leaving = true;
  tooltip(scene).hide();
  scene.cameras.main.fadeOut(180, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

export function fadeIn(scene) {
  scene.__leaving = false;
  scene.cameras.main.fadeIn(200, 0, 0, 0);
}

/** Sound toggle button used on every screen (hotkey M). */
export function soundButton(scene, x, y) {
  const b = iconButton(scene, x, y, sfx.isMuted() ? 'mute' : 'sound', {
    tooltip: 'Sound on / off', hotkey: 'M', variant: 'ghost',
    onClick: (btn) => btn.setIcon(sfx.toggleMute() ? 'mute' : 'sound'),
  });
  return b;
}
