import Phaser from 'phaser';
import metadata from '../content/assets.json';
import { ctx } from '../context';
import { UI } from '../content/ui';
import type { SceneKey } from '../systems/SaveManager';
import type { DialogueId } from '../content/dialogue';

export class BaseScene extends Phaser.Scene {
  protected sceneKey: SceneKey;
  constructor(key: SceneKey) { super(key); this.sceneKey = key; }
  setup(background: string, instruction = ''): void {
    this.add.image(480, 270, background).setDisplaySize(960, 540).setDepth(-10);
    ctx().ui.scene(this.sceneKey, instruction, () => this.hint());
    this.cameras.main.fadeIn(280, 247, 239, 214);
    this.events.once('shutdown', () => { this.input.removeAllListeners(); this.dragInput(false); });
  }
  dragInput(active: boolean): void { document.querySelector('#stage')!.classList.toggle('dragging', active); }
  asset(key: string, x: number, y: number, height: number, onClick?: () => void): Phaser.GameObjects.Sprite {
    const meta = metadata[key as keyof typeof metadata];
    const object = this.add.sprite(x, y, key).setOrigin(meta.origin.x, meta.origin.y).setScale(height / meta.visibleBounds.height);
    object.setData('visibleHeight', height);
    if (onClick) {
      object.setInteractive(new Phaser.Geom.Rectangle(meta.visibleBounds.x, meta.visibleBounds.y, meta.visibleBounds.width, meta.visibleBounds.height), Phaser.Geom.Rectangle.Contains);
      object.input!.cursor = 'pointer';
      object.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); onClick(); });
    }
    return object;
  }
  hotspot(x: number, y: number, width: number, height: number, action: () => void): Phaser.GameObjects.Rectangle {
    const r = this.add.rectangle(x, y, width, height, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    r.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); action(); });
    r.on('pointerover', () => r.setStrokeStyle(2, 0x807957, .5)); r.on('pointerout', () => r.setStrokeStyle());
    return r;
  }
  label(x: number, y: number, text: string, size = 17): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { fontFamily: 'KaiTi, STKaiti, Microsoft YaHei, serif', fontSize: `${size}px`, color: '#4e4935', align: 'center', backgroundColor: '#fff8e3' }).setOrigin(.5).setPadding(6, 3);
  }
  walk(sprite: Phaser.GameObjects.Sprite, x: number, done?: () => void, frame = 'frog_neutral'): void {
    const height = sprite.getData('visibleHeight') as number;
    const frogMeta = metadata.frog_walk_a;
    sprite.setScale(height / frogMeta.animationBounds!.height);
    sprite.play('frog-walk');
    sprite.on('animationupdate', (_a: unknown, f: Phaser.Animations.AnimationFrame) => {
      const m = metadata[f.textureKey as keyof typeof metadata];
      sprite.setOrigin(m.origin.x, m.origin.y); ctx().audio.playSfx('footstep');
    });
    this.tweens.add({ targets: sprite, x, duration: Math.max(450, Math.abs(x - sprite.x) * 4), ease: 'Linear', onComplete: () => {
      sprite.stop(); sprite.removeAllListeners('animationupdate');
      sprite.setTexture(frame); const m = metadata[frame as keyof typeof metadata];
      sprite.setOrigin(m.origin.x, m.origin.y).setScale(height / m.visibleBounds.height); done?.();
    }});
  }
  say(id: DialogueId): void { void ctx().dialogue.say(id); }
  hint(): void { ctx().ui.message(UI.hint, UI.genericHint); }
}
