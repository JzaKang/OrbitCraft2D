import Phaser from 'phaser';
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/vt323/400.css';
import { BootScene } from './scenes/BootScene.js';
import { MissionSelectScene } from './scenes/MissionSelectScene.js';
import { BuilderScene } from './scenes/BuilderScene.js';
import { LaunchScene } from './scenes/LaunchScene.js';
import { ReportScene } from './scenes/ReportScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#0b0d18',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 1 },
  scene: [BootScene, MissionSelectScene, BuilderScene, LaunchScene, ReportScene],
};

// Wait for the bundled pixel fonts so Phaser text renders with them from the first frame.
function start() {
  const game = new Phaser.Game(config);
  if (import.meta.env.DEV) window.__ORBITCRAFT__ = game; // dev-only debug handle
}

Promise.all([
  document.fonts.load('16px Silkscreen'),
  document.fonts.load('bold 16px Silkscreen'),
  document.fonts.load('20px VT323'),
])
  .catch(() => {})
  .finally(start);
