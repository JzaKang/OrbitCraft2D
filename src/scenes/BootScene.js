import Phaser from 'phaser';
import { PROVIDED_PART_ART } from '../data/assets.js';
import { registerAllTextures, partTextureKey } from '../art/textures.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Optional hand-made PNGs override the generated art (see src/data/assets.js).
    for (const id of PROVIDED_PART_ART) this.load.image(partTextureKey(id), `assets/parts/${id}.png`);
    this.load.on('loaderror', (file) => console.warn(`[assets] missing ${file.src}, using generated art`));
  }

  create() {
    registerAllTextures(this);
    this.scene.start('MissionSelect');
  }
}
