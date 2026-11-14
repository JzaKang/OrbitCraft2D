import Phaser from 'phaser';
import { getMission } from '../data/missions.js';
import { CATEGORY_LABELS, SOURCES, PARTS } from '../data/parts.js';
import { insertPart, removePart, movePart, defaultInsertIndex, getPart, splitStages } from '../core/design.js';
import { runMission, OUTCOME_TITLES } from '../core/simulate.js';
import { buildRocket, computeDisplayLayout, partDisplayWidth } from '../ui/rocketView.js';
import { partTextureKey, iconKey } from '../art/textures.js';
import { COLORS, HEX, STATUS_COLOR, STATUS_HEX, uiText, bodyText, fmtMass, hex } from '../ui/theme.js';
import {
  drawFrame, panel, button, iconButton, tooltip, withTooltip, toast, drawMeter, modal, goto, fadeIn, soundButton,
} from '../ui/widgets.js';
import { sfx } from '../ui/sfx.js';
import { loadPref, savePref } from '../ui/progress.js';

const CATEGORIES = Object.keys(CATEGORY_LABELS);
const TOP_H = 52;
const LEFT = { x: 8, y: 60, w: 292, h: 652 };
const CENTER = { x: 308, y: 60, w: 560, h: 652 };
const RIGHT = { x: 876, y: 60, w: 396, h: 652 };
const ROCKET_X = CENTER.x + CENTER.w / 2;
const PAD_Y = 624;
const ROCKET_MAX_H = 530;
const BODY_W = 56;

const HELP = [
  'GOAL  Build a rocket + spacecraft that survives every check on the right, then press LAUNCH.',
  '',
  'BUILD',
  '  Drag a part from the PARTS BIN onto the rocket (or click it to add).',
  '  Drag a part on the rocket to move it. Drop it on the bin to remove it.',
  '  Click a part to select it: UP / DOWN / REMOVE, or the arrow keys and Delete.',
  '',
  'READ THE BLUEPRINT',
  '  Yellow CG = centre of gravity. Orange CP = centre of pressure.',
  '  CP must sit BELOW the CG (fins at the bottom!) or the rocket tumbles.',
  '  dv = Isp x g0 x ln(m0 / mf): every extra kilogram costs delta-v.',
  '',
  'IN ORBIT  Solar power must cover the load, the battery must last the',
  '  eclipse, the radio must reach Earth and send all the science data.',
  '',
  'Hover any bar or button for details.   Ctrl+Z undo   Ctrl+Y redo   H help',
].join('\n');

export class BuilderScene extends Phaser.Scene {
  constructor() {
    super('Builder');
  }

  init(data) {
    this.mission = getMission(data.missionId);
    this.stack = [...(data.stack ?? this.mission.starterDesign)];
    this.highlight = new Set(data.highlight ?? []);
    this.selected = -1;
    this.history = [];
    this.future = [];
    this.drag = null;
    this.category = this.category && CATEGORIES.includes(this.category) ? this.category : 'nose';
  }

  create() {
    fadeIn(this);
    this.input.dragDistanceThreshold = 8;
    this.drawFrameUI();

    this.tabLayer = this.add.container();
    this.listLayer = this.add.container();
    this.infoLayer = this.add.container();
    this.rocketLayer = this.add.container();
    this.overlayLayer = this.add.container().setDepth(100);
    this.statsLayer = this.add.container();

    this.createToolbar();
    this.createTopBar();
    this.createLaunch();
    this.createKeys();

    this.drawTabs();
    this.drawPartList();
    this.showInfo(null);
    this.refresh();

    if (this.highlight.size) toast(this, 'Parts that caused the failure are flashing red', 'fail');
    if (!loadPref('helpSeen', false)) {
      savePref('helpSeen', true);
      this.time.delayedCall(300, () => this.openHelp());
    }
  }

  // ======================================================== static frame

  drawFrameUI() {
    this.add.rectangle(0, 0, 1280, 720, COLORS.bg).setOrigin(0);
    // top bar
    const g = this.add.graphics();
    g.fillStyle(COLORS.panelDark).fillRect(0, 0, 1280, TOP_H);
    g.fillStyle(COLORS.accent, 0.35).fillRect(0, TOP_H - 2, 1280, 2);

    panel(this, LEFT.x, LEFT.y, LEFT.w, LEFT.h, { title: 'PARTS BIN' });
    panel(this, RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h, { title: 'LIVE ENGINEERING DATA' });

    // blueprint
    const b = this.add.graphics();
    drawFrame(b, CENTER.x, CENTER.y, CENTER.w, CENTER.h, { fill: COLORS.blueprint, light: COLORS.gridMajor });
    for (let x = CENTER.x + 4; x < CENTER.x + CENTER.w - 4; x += 16) {
      b.fillStyle((x - CENTER.x) % 64 < 16 ? COLORS.gridMajor : COLORS.grid, 1).fillRect(x, CENTER.y + 4, 1, CENTER.h - 8);
    }
    for (let y = CENTER.y + 4; y < CENTER.y + CENTER.h - 4; y += 16) {
      b.fillStyle((y - CENTER.y) % 64 < 16 ? COLORS.gridMajor : COLORS.grid, 1).fillRect(CENTER.x + 4, y, CENTER.w - 8, 1);
    }
    uiText(this, CENTER.x + 12, CENTER.y + 10, 'BLUEPRINT', 16, '#3f78b8');
    // launch pad
    this.add.image(ROCKET_X, PAD_Y + 6, 'pad').setScale(2, 2);
    this.add.image(ROCKET_X - 130, PAD_Y - 118, 'tower').setScale(2).setAlpha(0.35);
  }

  createTopBar() {
    button(this, 74, 26, { w: 132, h: 36, label: 'MISSIONS', icon: 'back', size: 16, variant: 'ghost', tooltip: 'Back to mission select', onClick: () => goto(this, 'MissionSelect') });
    uiText(this, 158, 10, this.mission.name.toUpperCase(), 16, HEX.white);
    bodyText(this, 158, 27, `${this.mission.target}  ·  budget $${this.mission.budget}M  ·  needs ${this.mission.requiredTags.join(' + ')}`, 20, HEX.dim);

    this.undoBtn = iconButton(this, 1092, 26, 'undo', { tooltip: 'Undo', hotkeyLabel: 'Ctrl+Z', variant: 'ghost', h: 38, onClick: () => this.undo() });
    this.redoBtn = iconButton(this, 1138, 26, 'redo', { tooltip: 'Redo', hotkeyLabel: 'Ctrl+Y', variant: 'ghost', h: 38, onClick: () => this.redo() });
    iconButton(this, 1184, 26, 'help', { tooltip: 'How to play', hotkey: 'H', variant: 'ghost', h: 38, onClick: () => this.openHelp() });
    soundButton(this, 1230, 26);
  }

  createToolbar() {
    const y = 676;
    this.toolbar = this.add.container(0, 0);
    this.upBtn = button(this, ROCKET_X - 204, y, { w: 84, h: 40, label: 'UP', icon: 'up', tooltip: 'Move selected part up', hotkey: 'UP', sound: 'blip', onClick: () => this.moveSelected(-1) });
    this.downBtn = button(this, ROCKET_X - 112, y, { w: 96, h: 40, label: 'DOWN', icon: 'down', tooltip: 'Move selected part down', hotkey: 'DOWN', sound: 'blip', onClick: () => this.moveSelected(1) });
    this.removeBtn = button(this, ROCKET_X + 6, y, { w: 124, h: 40, label: 'REMOVE', icon: 'trash', variant: 'danger', tooltip: 'Remove selected part', hotkey: 'DELETE', sound: null, onClick: () => this.removeSelected() });
    this.resetBtn = button(this, ROCKET_X + 130, y, { w: 108, h: 40, label: 'RESET', icon: 'reset', tooltip: 'Back to the starter design', sound: 'remove', onClick: () => this.setStack([...this.mission.starterDesign], -1, 'Starter design restored') });
    this.clearBtn = button(this, ROCKET_X + 236, y, { w: 88, h: 40, label: 'CLEAR', tooltip: 'Remove every part', variant: 'ghost', sound: 'remove', onClick: () => this.setStack([], -1, 'Launch pad cleared') });
    this.toolbar.add([this.upBtn, this.downBtn, this.removeBtn, this.resetBtn, this.clearBtn]);

    // trash zone shown while dragging a part off the rocket
    const tz = this.add.container(ROCKET_X, y).setVisible(false).setDepth(50);
    const g = this.add.graphics();
    drawFrame(g, -230, -22, 460, 44, { fill: 0x5e1717, light: COLORS.fail });
    tz.add([g, this.add.image(-120, 0, iconKey('trash')).setScale(2).setTint(0xffffff), uiText(this, 10, 0, 'DROP HERE TO REMOVE', 16, '#ffffff').setOrigin(0.5)]);
    this.trashZone = tz;
  }

  createLaunch() {
    this.predictG = this.add.graphics();
    this.predictText = bodyText(this, RIGHT.x + 20, 590, '', 20, HEX.text, { wordWrap: { width: RIGHT.w - 40 } });
    this.launchBtn = button(this, RIGHT.x + RIGHT.w / 2, 672, {
      w: RIGHT.w - 28, h: 54, label: 'LAUNCH', icon: 'rocket', size: 24, iconScale: 3, variant: 'primary',
      tooltip: 'Fly the mission', hotkey: 'ENTER', sound: null, onClick: () => this.launch(),
    });
    this.tweens.add({ targets: this.launchBtn, scale: 1.02, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  createKeys() {
    const kb = this.input.keyboard;
    kb.on('keydown-BACKSPACE', () => !this.modalOpen && this.removeSelected());
    kb.on('keydown-ESC', () => !this.modalOpen && this.select(-1));
    kb.on('keydown-Z', (e) => e.ctrlKey && !this.modalOpen && this.undo());
    kb.on('keydown-Y', (e) => e.ctrlKey && !this.modalOpen && this.redo());
  }

  openHelp() {
    if (this.modalOpen) return;
    modal(this, { title: 'HOW TO PLAY', body: HELP, width: 760 });
  }

  // ======================================================== state changes

  setStack(stack, selected = -1, msg = null, kind = 'info') {
    this.history.push(this.stack);
    if (this.history.length > 100) this.history.shift();
    this.future = [];
    this.stack = stack;
    this.selected = selected;
    this.highlight.clear();
    this.refresh();
    if (msg) toast(this, msg, kind);
  }

  undo() {
    if (!this.history.length) return sfx.error();
    this.future.push(this.stack);
    this.stack = this.history.pop();
    this.selected = -1;
    sfx.blip();
    this.refresh();
    toast(this, 'Undo');
  }

  redo() {
    if (!this.future.length) return sfx.error();
    this.history.push(this.stack);
    this.stack = this.future.pop();
    this.selected = -1;
    sfx.blip();
    this.refresh();
    toast(this, 'Redo');
  }

  select(i) {
    this.selected = i;
    if (i >= 0) this.showInfo(getPart(this.stack[i]), i);
    this.refresh();
  }

  addPart(id, index = null) {
    const at = index ?? (this.selected >= 0 ? this.selected + 1 : defaultInsertIndex(this.stack, id));
    sfx.place();
    this.setStack(insertPart(this.stack, id, at), at, `Added ${getPart(id).name}`, 'ok');
  }

  moveSelected(delta) {
    if (this.selected < 0) return toast(this, 'Select a part on the rocket first', 'warn');
    const j = this.selected + delta;
    if (j < 0 || j >= this.stack.length) return sfx.error();
    this.setStack(movePart(this.stack, this.selected, delta), j);
  }

  removeSelected() {
    if (this.selected < 0) return toast(this, 'Select a part on the rocket first', 'warn');
    this.removeAt(this.selected);
  }

  removeAt(i) {
    const name = getPart(this.stack[i]).name;
    sfx.remove();
    this.setStack(removePart(this.stack, i), Math.min(i, this.stack.length - 2), `Removed ${name}`);
  }

  launch() {
    const result = runMission(this.stack, this.mission);
    if (result.outcome === 'INVALID_DESIGN') {
      sfx.error();
      this.cameras.main.shake(150, 0.004);
      toast(this, 'Design review failed: fix the red items first', 'fail');
      return;
    }
    sfx.click();
    goto(this, 'Launch', { missionId: this.mission.id, stack: [...this.stack], result });
  }

  // ======================================================== parts bin

  drawTabs() {
    this.tabLayer.removeAll(true);
    CATEGORIES.forEach((cat, i) => {
      const x = LEFT.x + 32 + (i % 6) * 46;
      const y = LEFT.y + 60 + Math.floor(i / 6) * 46;
      const b = button(this, x, y, { w: 42, h: 42, variant: 'ghost', tooltip: CATEGORY_LABELS[cat], sound: 'blip', onClick: () => {
        this.category = cat;
        this.drawTabs();
        this.drawPartList();
      } });
      b.setSelected(cat === this.category);
      const first = PARTS.find((p) => p.category === cat);
      const img = this.add.image(0, 0, partTextureKey(first.id));
      fit(img, 30, 30);
      b.content.add(img);
      this.tabLayer.add(b);
    });
    this.tabLayer.add(uiText(this, LEFT.x + 14, LEFT.y + 148, CATEGORY_LABELS[this.category].toUpperCase(), 16, HEX.gold));
    this.tabLayer.add(bodyText(this, LEFT.x + 14, LEFT.y + 168, 'drag onto the rocket, or click', 18, HEX.dim));
  }

  drawPartList() {
    this.listLayer.removeAll(true);
    const parts = PARTS.filter((p) => p.category === this.category);
    parts.forEach((p, i) => {
      const x = LEFT.x + 10;
      const y = LEFT.y + 194 + i * 60;
      const w = LEFT.w - 20;
      const h = 56;
      const g = this.add.graphics();
      const draw = (hover) => {
        g.clear();
        drawFrame(g, x, y, w, h, { fill: hover ? 0x2a3459 : COLORS.panelLight, light: hover ? COLORS.accent : COLORS.bevelLight });
        g.fillStyle(0x0b0d18).fillRect(x + 6, y + 6, 44, 44);
      };
      draw(false);
      const img = this.add.image(x + 28, y + 28, partTextureKey(p.id));
      fit(img, 40, 40);
      const name = bodyText(this, x + 58, y + 5, p.name, 22, HEX.text);
      const stat = bodyText(this, x + 58, y + 29, `${fmtMass(p.mass + (p.fuelMass || 0))}  ·  ${keyStat(p)}`, 18, HEX.dim);
      const cost = bodyText(this, x + w - 10, y + 5, `$${p.cost}M`, 20, HEX.gold).setOrigin(1, 0);
      const hit = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0, 0).setInteractive({ useHandCursor: true, draggable: true });
      hit.on('pointerover', () => { draw(true); this.showInfo(p); sfx.hover(); });
      hit.on('pointerout', () => draw(false));
      hit.on('pointerup', () => { if (hit.__dragged) { hit.__dragged = false; return; } this.addPart(p.id); });
      this.makeDraggable(hit, { kind: 'new', id: p.id });
      this.listLayer.add([g, img, name, stat, cost, hit]);
    });
  }

  showInfo(p, stackIndex = null) {
    this.infoLayer.removeAll(true);
    const x = LEFT.x + 10;
    const y = 474;
    const w = LEFT.w - 20;
    const g = this.add.graphics();
    drawFrame(g, x, y, w, 230, { fill: COLORS.panelDark, light: 0x26304f });
    this.infoLayer.add(g);
    if (!p) {
      this.infoLayer.add(bodyText(this, x + 12, y + 12, 'Hover a part to see its specs and the NASA source behind its numbers.', 20, HEX.dim, { wordWrap: { width: w - 24 } }));
      return;
    }
    this.infoLayer.add(bodyText(this, x + 12, y + 6, p.name, 24, HEX.white));
    let sub = CATEGORY_LABELS[p.category];
    if (stackIndex != null) {
      const st = splitStages(this.stack).findIndex((s) => s.indices.includes(stackIndex));
      sub += `  ·  on rocket, stage ${st + 1}`;
    }
    this.infoLayer.add(bodyText(this, x + 12, y + 30, sub, 18, HEX.accent));
    const specs = partSpecs(p);
    specs.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      this.infoLayer.add(bodyText(this, x + 12 + col * 136, y + 54 + row * 18, `${k} `, 18, HEX.dim));
      this.infoLayer.add(bodyText(this, x + 12 + col * 136 + 52, y + 54 + row * 18, v, 18, HEX.text));
    });
    const descY = y + 58 + Math.ceil(specs.length / 2) * 18;
    this.infoLayer.add(bodyText(this, x + 12, descY, p.desc, 18, HEX.text, { wordWrap: { width: w - 24 } }));
    const src = SOURCES[p.source];
    this.infoLayer.add(bodyText(this, x + 12, y + 206, `Source: ${src ? src.title.replace('NASA ', '') : '-'}`, 16, HEX.dim, { wordWrap: { width: w - 24 }, maxLines: 1 }).setCrop(0, 0, w - 24, 20));
  }

  // ======================================================== drag and drop

  makeDraggable(obj, info) {
    this.input.setDraggable(obj);
    obj.on('dragstart', (pointer) => {
      obj.__dragged = true;
      tooltip(this).hide();
      const id = info.kind === 'new' ? info.id : this.stack[info.index];
      const ghost = this.add.image(pointer.x, pointer.y, partTextureKey(id)).setDepth(6000).setAlpha(0.9);
      fit(ghost, 64, 64);
      this.drag = { ...info, id, ghost };
      if (info.kind === 'move') {
        this.selected = info.index;
        this.toolbar.setVisible(false);
        this.trashZone.setVisible(true);
        obj.setAlpha(0.25);
      }
      sfx.blip();
    });
    obj.on('drag', (pointer) => {
      if (!this.drag) return;
      this.drag.ghost.setPosition(pointer.x, pointer.y);
      this.drawDropIndicator(pointer);
    });
    obj.on('dragend', (pointer) => {
      const d = this.drag;
      this.drag = null;
      this.time.delayedCall(0, () => { obj.__dragged = false; });
      if (!d) return;
      d.ghost.destroy();
      this.overlayLayer.removeAll(true);
      this.toolbar.setVisible(true);
      this.trashZone.setVisible(false);
      obj.setAlpha?.(1);
      const target = this.dropTarget(pointer);
      if (d.kind === 'new') {
        if (target.type === 'insert') this.addPart(d.id, target.index);
        return;
      }
      if (target.type === 'remove') return this.removeAt(d.index);
      if (target.type === 'insert') {
        const to = target.index > d.index ? target.index - 1 : target.index;
        if (to === d.index) return this.refresh();
        const s = removePart(this.stack, d.index);
        sfx.place();
        return this.setStack(insertPart(s, d.id, to), to);
      }
      this.refresh();
    });
  }

  dropTarget(p) {
    const overTrash = Math.abs(p.x - ROCKET_X) < 230 && Math.abs(p.y - 676) < 26;
    const overBin = p.x < LEFT.x + LEFT.w;
    if (this.drag?.kind === 'move' && (overTrash || overBin)) return { type: 'remove' };
    if (p.x > CENTER.x && p.x < CENTER.x + CENTER.w && p.y > CENTER.y && p.y < 650) {
      return { type: 'insert', index: this.boundaryAt(p.y) };
    }
    return { type: 'none' };
  }

  boundaryAt(y) {
    if (!this.rocketView) return 0;
    const items = this.rocketView.layout.items;
    let b = 0;
    for (const it of items) if (this.rocketTop + it.y + it.h / 2 < y) b++;
    return b;
  }

  drawDropIndicator(p) {
    this.overlayLayer.removeAll(true);
    const t = this.dropTarget(p);
    if (t.type === 'remove') {
      this.overlayLayer.add(bodyText(this, p.x + 20, p.y - 30, 'remove', 20, HEX.fail));
      return;
    }
    if (t.type !== 'insert') return;
    let y;
    const items = this.rocketView?.layout.items ?? [];
    if (!items.length) y = PAD_Y - 10;
    else if (t.index < items.length) y = this.rocketTop + items[t.index].y;
    else y = this.rocketTop + items.at(-1).y + items.at(-1).h;
    const g = this.add.graphics();
    g.fillStyle(COLORS.accent).fillRect(ROCKET_X - 80, y - 2, 160, 4);
    g.fillTriangle(ROCKET_X - 92, y - 8, ROCKET_X - 92, y + 8, ROCKET_X - 82, y);
    g.fillTriangle(ROCKET_X + 92, y - 8, ROCKET_X + 92, y + 8, ROCKET_X + 82, y);
    this.overlayLayer.add(g);
    this.overlayLayer.add(bodyText(this, ROCKET_X + 98, y - 11, 'insert here', 20, HEX.accent));
  }

  // ======================================================== redraw

  refresh() {
    this.result = runMission(this.stack, this.mission);
    tooltip(this).hide();
    this.drawRocket();
    this.drawStats();
    const sel = this.selected >= 0;
    this.upBtn.setEnabled(sel && this.selected > 0);
    this.downBtn.setEnabled(sel && this.selected < this.stack.length - 1);
    this.removeBtn.setEnabled(sel);
    this.clearBtn.setEnabled(this.stack.length > 0);
    this.undoBtn.setEnabled(this.history.length > 0);
    this.redoBtn.setEnabled(this.future.length > 0);
  }

  drawRocket() {
    this.rocketLayer.removeAll(true);
    this.rocketView = null;
    if (!this.stack.length) {
      this.rocketLayer.add(bodyText(this, ROCKET_X, 330, 'Empty launch pad.\nDrag parts here from the PARTS BIN.', 24, HEX.dim, { align: 'center' }).setOrigin(0.5));
      return;
    }
    const height = computeDisplayLayout(this.stack, ROCKET_MAX_H).height;
    this.rocketTop = PAD_Y - height;
    const rocket = buildRocket(this, this.stack, { x: ROCKET_X, y: this.rocketTop, maxHeight: ROCKET_MAX_H, bodyWidth: BODY_W });
    this.rocketView = rocket;
    this.rocketLayer.add(rocket.root);

    const g = this.add.graphics();
    this.rocketLayer.add(g);
    rocket.layout.items.forEach((it, i) => {
      const w = partDisplayWidth(it.part, BODY_W);
      const img = rocket.sprites[i];
      img.setInteractive({ useHandCursor: true, draggable: true });
      img.on('pointerover', () => { this.showInfo(it.part, i); if (i !== this.selected) img.setTint(0xcfe8ff); });
      img.on('pointerout', () => img.clearTint());
      img.on('pointerup', () => { if (img.__dragged) { img.__dragged = false; return; } sfx.blip(); this.select(i === this.selected ? -1 : i); });
      this.makeDraggable(img, { kind: 'move', index: i });
      const top = this.rocketTop + it.y;
      if (this.highlight.has(i)) {
        const r = this.add.graphics();
        brackets(r, ROCKET_X - w / 2 - 6, top - 2, w + 12, it.h + 4, COLORS.fail);
        this.tweens.add({ targets: r, alpha: 0.15, duration: 380, yoyo: true, repeat: -1 });
        this.rocketLayer.add(r);
      }
      if (i === this.selected) {
        brackets(g, ROCKET_X - w / 2 - 8, top - 3, w + 16, it.h + 6, COLORS.accent);
        this.rocketLayer.add(bodyText(this, ROCKET_X - w / 2 - 14, top + it.h / 2, it.part.name, 20, HEX.accent).setOrigin(1, 0.5));
      }
    });

    const a = this.result.analysis;
    if (!a) return;

    // stage brackets with delta-v
    a.stages.forEach((s, k) => {
      const first = rocket.layout.items[s.indices[0]];
      const last = rocket.layout.items[s.indices.at(-1)];
      const y0 = this.rocketTop + first.y + 2;
      const y1 = this.rocketTop + last.y + last.h - 2;
      const lx = CENTER.x + 92;
      g.fillStyle(0x3f78b8).fillRect(lx, y0, 2, y1 - y0).fillRect(lx, y0, 8, 2).fillRect(lx, y1 - 2, 8, 2);
      const label = uiText(this, lx - 8, (y0 + y1) / 2 - 10, `S${k + 1}`, 16, '#6fa8e8').setOrigin(1, 0.5);
      const dv = bodyText(this, lx - 8, (y0 + y1) / 2 + 8, s.dv ? `${Math.round(s.dv).toLocaleString('en-US')} m/s` : 'no dv', 18, HEX.dim).setOrigin(1, 0.5);
      this.rocketLayer.add([label, dv]);
    });

    // CG / CP markers + static margin bracket (TIR-33)
    const mx = ROCKET_X + 74;
    const marker = (realX, key, label, color) => {
      const yy = rocket.layout.mapX(realX);
      if (yy == null) return null;
      const y = this.rocketTop + yy;
      g.fillStyle(color, 0.55).fillRect(ROCKET_X - 40, y, mx - ROCKET_X + 30, 1);
      const img = this.add.image(mx, y, key).setScale(2);
      const t = bodyText(this, mx + 16, y, label, 20, hex(color)).setOrigin(0, 0.5);
      withTooltip(img.setInteractive(), key === 'marker_cg'
        ? 'Centre of gravity: the balance point of all the mass (moves up as stage-1 fuel burns).'
        : 'Centre of pressure: where the air pushes. It must be below the CG for a stable flight.');
      this.rocketLayer.add([img, t]);
      return y;
    };
    if (a.aero.cgBurnout != null && Math.abs(a.aero.cgBurnout - a.aero.cgFull) > 0.05) {
      const yy = this.rocketTop + rocket.layout.mapX(a.aero.cgBurnout);
      const ghost = this.add.image(mx, yy, 'marker_cg').setScale(1.5).setAlpha(0.45);
      this.rocketLayer.add([ghost, bodyText(this, mx + 14, yy, 'CG empty', 16, HEX.dim).setOrigin(0, 0.5)]);
    }
    const cgY = marker(a.aero.cgFull, 'marker_cg', 'CG', COLORS.cg);
    const cpY = a.aero.cp != null ? marker(a.aero.cp, 'marker_cp', 'CP', COLORS.cp) : null;
    if (cpY == null) {
      this.rocketLayer.add(bodyText(this, mx - 10, this.rocketTop - 26, 'No CP: add a nose or fins', 18, HEX.fail));
    } else if (cgY != null) {
      const m = a.aero.minMargin;
      const color = m < 0 ? COLORS.fail : m < 1 ? COLORS.warn : COLORS.ok;
      const bx = mx + 66;
      g.fillStyle(color).fillRect(bx, Math.min(cgY, cpY), 3, Math.abs(cpY - cgY) + 1);
      g.fillRect(bx - 4, cgY - 1, 8, 2).fillRect(bx - 4, cpY - 1, 8, 2);
      this.rocketLayer.add(bodyText(this, bx + 8, (cgY + cpY) / 2, `${m >= 0 ? '+' : ''}${m.toFixed(1)} cal\n${m < 0 ? 'UNSTABLE' : m < 1 ? 'marginal' : 'stable'}`, 18, hex(color)).setOrigin(0, 0.5));
    }
  }

  drawStats() {
    this.statsLayer.removeAll(true);
    const r = this.result;
    const a = r.analysis;
    const x = RIGHT.x + 14;
    const w = RIGHT.w - 28;
    let y = RIGHT.y + 42;

    if (a) {
      this.statsLayer.add(bodyText(this, x, y, `${fmtMass(a.totalMass)}  ·  ${a.aero.length.toFixed(1)} m tall  ·  ${a.stages.length} stage${a.stages.length > 1 ? 's' : ''}`, 20, HEX.dim));
      y += 28;
      for (const row of statRows(r, this.mission)) {
        this.statRow(row, x, y, w);
        y += 40;
      }
    } else {
      const fail = r.checks[0];
      this.statsLayer.add(this.add.image(x + 10, y + 14, iconKey('fail')).setScale(2).setTint(COLORS.fail));
      this.statsLayer.add(uiText(this, x + 28, y + 4, 'DESIGN REVIEW FAILED', 16, HEX.fail));
      this.statsLayer.add(bodyText(this, x, y + 34, fail.detail.split('. ').join('.\n\n'), 20, HEX.text, { wordWrap: { width: w } }));
    }

    // prediction box
    const ok = r.success;
    const color = ok ? COLORS.ok : COLORS.warn;
    this.predictG.clear();
    drawFrame(this.predictG, RIGHT.x + 10, 582, RIGHT.w - 20, 54, { fill: COLORS.panelDark, light: color });
    this.predictText.setPosition(RIGHT.x + 22, 588).setColor(hex(color)).setText(ok
      ? 'Prediction: all checks pass.\nLaunch it!'
      : `Prediction: ${OUTCOME_TITLES[r.outcome].toLowerCase()}.\nHover the red bar to see why.`);
  }

  statRow(row, x, y, w) {
    const color = STATUS_COLOR[row.status];
    this.statsLayer.add(this.add.image(x + 9, y + 11, iconKey(row.icon)).setScale(2).setTint(color));
    this.statsLayer.add(bodyText(this, x + 26, y - 1, row.label, 20, HEX.text));
    this.statsLayer.add(bodyText(this, x + w, y - 1, row.value, 20, STATUS_HEX[row.status]).setOrigin(1, 0));
    const g = this.add.graphics();
    drawMeter(g, x + 26, y + 20, w - 26, 10, row.frac, color, row.marks);
    this.statsLayer.add(g);
    const hit = this.add.rectangle(x + w / 2, y + 14, w, 36, 0, 0).setInteractive();
    withTooltip(hit, row.tip);
    this.statsLayer.add(hit);
  }
}

// ======================================================== helpers

function fit(img, maxW, maxH) {
  const s = Math.min(maxW / img.width, maxH / img.height);
  img.setScale(s >= 1 ? Math.floor(s * 2) / 2 : s);
  return img;
}

/** Corner brackets (pixel selection marker). */
function brackets(g, x, y, w, h, color) {
  const l = Math.min(10, w / 3, h / 2);
  g.fillStyle(color);
  g.fillRect(x, y, l, 2).fillRect(x, y, 2, l);
  g.fillRect(x + w - l, y, l, 2).fillRect(x + w - 2, y, 2, l);
  g.fillRect(x, y + h - 2, l, 2).fillRect(x, y + h - l, 2, l);
  g.fillRect(x + w - l, y + h - 2, l, 2).fillRect(x + w - 2, y + h - l, 2, l);
}

function keyStat(p) {
  if (p.thrustVac) return p.lowThrust ? `Isp ${p.ispVac} s` : `${p.thrustSL || p.thrustVac} kN`;
  if (p.fuelMass) return `${fmtMass(p.fuelMass)} fuel`;
  if (p.gen) return `+${p.gen} W`;
  if (p.battery) return `${p.battery} Wh`;
  if (p.science) return `science ${p.science}`;
  if (p.thermalRating) return `thermal ${p.thermalRating}`;
  if (p.rateKbps) return `${p.rateKbps} kbps`;
  if (p.maxSpacecraftMass) return `holds ${p.maxSpacecraftMass} kg`;
  if (p.aero) return `CNa ${p.aero.cna}`;
  return `${p.length} m`;
}

function partSpecs(p) {
  const s = [['mass', fmtMass(p.mass)], ['cost', `$${p.cost}M`]];
  if (p.fuelMass) s.push(['fuel', fmtMass(p.fuelMass)]);
  if (p.thrustVac) s.push(['thrust', `${p.thrustSL}/${p.thrustVac}kN`], ['Isp', `${p.ispSL}/${p.ispVac}s`]);
  if (p.gen) s.push(['power', `+${p.gen} W`]);
  if (p.draw) s.push(['uses', `${p.draw} W`]);
  if (p.battery) s.push(['store', `${p.battery} Wh`]);
  if (p.thermalRating) s.push(['level', `${p.thermalRating}`]);
  if (p.rateKbps) s.push(['rate', `${p.rateKbps} kbps`], ['range', `${p.rangeKm.toExponential(0)} km`]);
  if (p.science) s.push(['science', `${p.science}`], ['data', `${p.dataMBPerDay} MB/d`]);
  if (p.maxSpacecraftMass) s.push(['holds', `${p.maxSpacecraftMass} kg`]);
  if (p.aero) s.push(['CNa', `${p.aero.cna}`]);
  if (p.dragLoss) s.push(['drag', `+${p.dragLoss} m/s`]);
  s.push(['length', `${p.length} m`]);
  return s.slice(0, 8);
}

const n0 = (v) => Math.round(v).toLocaleString('en-US');

/** Rows for the live data panel, each tied to a simulator check. */
function statRows(r, mission) {
  const a = r.analysis;
  const rows = [];
  const tip = (c) => `${c.title}\n${c.detail}${c.status !== 'pass' && c.fix ? `\n\nFix: ${c.fix}` : ''}`;
  const add = (id, icon, label, value, frac, marks, status) => {
    const c = r.checks.find((k) => k.id === id);
    if (c) rows.push({ icon, label, value, frac, marks, status: status ?? c.status, tip: tip(c) });
  };
  add('budget', 'money', 'Budget', `$${a.cost.toFixed(1)}M / $${a.budget}M`, a.cost / a.budget / 1.25, [0.8]);
  add('liftoff', 'twr', 'Liftoff thrust/weight', a.liftoffTWR.toFixed(2), a.liftoffTWR / 3, [1 / 3, 1.2 / 3]);
  const m = a.aero.minMargin;
  add('stability', 'stability', 'Stability margin', m == null ? 'no CP' : `${m >= 0 ? '+' : ''}${m.toFixed(2)} cal`, m == null ? 0 : (m + 3) / 9, [3 / 9, 4 / 9]);
  add('ascent', 'dv', 'Delta-v to orbit', `${n0(a.dv.ascent)} / ${n0(a.dv.ascentRequired)}`, a.dv.ascent / a.dv.ascentRequired / 1.5, [1 / 1.5]);
  if (mission.dvTransfer) add('transfer', 'dv', 'Delta-v transfer', `${n0(a.dv.transfer)} / ${n0(mission.dvTransfer)}`, a.dv.transfer / mission.dvTransfer / 1.5, [1 / 1.5]);
  const p = a.spacecraft.power;
  add('power', 'power', 'Solar (orbit avg)', `${p.avgGen.toFixed(0)} / ${p.load.toFixed(0)} W`, p.load ? p.avgGen / p.load / 1.5 : 1, [1 / 1.5], p.avgGen >= p.load ? 'pass' : 'fail');
  add('power', 'power', 'Battery (eclipse)', `${n0(p.batteryWh)} / ${n0(p.batteryNeedWh)} Wh`, p.batteryNeedWh ? p.batteryWh / p.batteryNeedWh / 1.5 : 1, [1 / 1.5], p.batteryWh >= p.batteryNeedWh ? 'pass' : 'fail');
  const t = a.spacecraft.thermal;
  add('thermal', 'thermal', 'Thermal control', `level ${t.rating} / ${t.required}`, t.rating / t.required / 1.5, [1 / 1.5]);
  const cm = a.spacecraft.comms;
  add('comms', 'comms', 'Radio reaches Earth', cm.inRange ? 'yes' : 'no', cm.inRange ? 1 : 0.02, []);
  add('data', 'data', 'Data return', `${n0(cm.downlinkMB)} / ${n0(cm.dataMB)} MB/d`, cm.dataMB ? cm.downlinkMB / cm.dataMB / 1.5 : 1, [1 / 1.5]);
  const s = a.spacecraft.science;
  add('science', 'science', 'Science', `${s.score} / ${s.required}`, s.score / s.required / 1.5, [1 / 1.5]);
  return rows;
}
