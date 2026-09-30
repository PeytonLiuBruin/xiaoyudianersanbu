import type Phaser from 'phaser';
import type { AudioManager } from './systems/AudioManager';
import type { DialogueManager } from './systems/DialogueManager';
import type { SaveManager, SceneKey } from './systems/SaveManager';
import type { GameUI } from './ui/GameUI';
export interface GameContext {
  game: Phaser.Game;
  audio: AudioManager;
  dialogue: DialogueManager;
  save: SaveManager;
  ui: GameUI;
  go(scene: SceneKey): void;
}
let context: GameContext;
export const setContext = (c: GameContext): void => { context = c; };
export const ctx = (): GameContext => context;
export const assetUrl = (src: string): string => `${import.meta.env.BASE_URL}${src}`;
