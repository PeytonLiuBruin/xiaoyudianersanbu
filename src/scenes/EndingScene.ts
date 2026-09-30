import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { ctx } from '../context';
import { UI } from '../content/ui';
import { pointAt, segmentHitsRect, velocityFromDrag, type Point } from '../puzzles/ThrowPuzzle';
import metadata from '../content/assets.json';

export class EndingScene extends BaseScene {
  private frog!: Phaser.GameObjects.Sprite;
  private penguin!: Phaser.GameObjects.Sprite;
  private flowers?: Phaser.GameObjects.Sprite;
  private projectile?: Phaser.GameObjects.Arc;
  private preview?: Phaser.GameObjects.Graphics;
  private launchVelocity?: Point;
  private projectileTime = 0;
  private aiming = false;
  private throwMode = false;
  private pointerId: number | null = null;
  private origin: Point = { x: 394, y: 354 };
  private seated = false;
  private sitting = false;
  constructor() { super('Ending'); }

  create(): void {
    this.throwMode = false; this.aiming = false; this.pointerId = null; this.launchVelocity = undefined;
    this.projectile = undefined; this.preview = undefined; this.flowers = undefined;
    this.seated = ctx().save.data.endingComplete; this.sitting = false;
    this.setup('bg_home', UI.sitLater);
    this.frog = this.asset(this.seated ? 'frog_sit' : 'frog_neutral', this.seated ? 501 : 336, this.seated ? 399 : 440, 115).setDepth(6);
    this.penguin = this.asset('penguin_waiting', 706, 402, 145, () => this.hearPenguin()).setDepth(4);
    this.asset('dinner_food', 558, 265, 38, () => ctx().dialogue.reaction('home_clean.inspect_table', 'N28')).setDepth(7);
    this.hotspot(485, 452, 265, 56, () => ctx().dialogue.reaction('home_clean.inspect_floor', 'N27'));
    this.hotspot(558, 246, 226, 72, () => ctx().dialogue.reaction('home_clean.inspect_table', 'N28')).setDepth(1);
    this.drawVase();
    if (ctx().save.data.bouquetPlaced) this.showFlowers();
    this.setupThrowInput(); this.actions();
    if (ctx().save.data.reactionFlags['ending.pending_home']) {
      delete ctx().save.data.reactionFlags['ending.pending_home']; ctx().save.persist();
      ctx().dialogue.reaction('return.go_home', 'N26');
    }
  }

  private drawVase(): void {
    const vase = this.add.graphics().setDepth(5);
    vase.fillStyle(0xc9dbdc); vase.lineStyle(4, 0x292922);
    const points = [{ x: 778, y: 363 }, { x: 785, y: 397 }, { x: 815, y: 397 }, { x: 822, y: 363 }];
    vase.fillPoints(points, true); vase.strokePoints(points, true);
    vase.lineBetween(778, 363, 822, 363);
    this.hotspot(800, 365, 72, 105, () => this.placeFlowers()).setDepth(8);
  }

  private showFlowers(): void {
    if (!this.flowers) this.flowers = this.asset('bouquet', 800, 379, 92).setDepth(4);
  }

  private placeFlowers(): void {
    if (ctx().save.data.bouquetPlaced || !ctx().save.data.inventory.includes('bouquet')) return;
    ctx().save.data.bouquetPlaced = true; ctx().save.persist();
    this.showFlowers(); ctx().audio.playSfx('paper');
    ctx().dialogue.reaction('ending.bouquet_placed', 'N29'); this.actions();
  }

  private hearPenguin(): void {
    this.leaveThrowMode();
    ctx().save.data.endingApologyRead = true; ctx().save.persist();
    void ctx().dialogue.sequence(['P04', 'P05', 'P06']);
  }

  private sit(): void {
    if (this.sitting) return;
    this.leaveThrowMode();
    this.sitting = true;
    this.seated = true; ctx().save.data.endingComplete = true; ctx().save.persist();
    this.actions();
    this.walk(this.frog, 501, () => {
      this.sitting = false; this.frog.setY(399); this.say('P07'); this.actions();
      ctx().ui.message(UI.endingTitle, UI.endingSubtitle);
    }, 'frog_sit');
  }

  private actions(): void {
    ctx().ui.actions([
      { id: 'floor', label: UI.inspectFloor, run: () => ctx().dialogue.reaction('home_clean.inspect_floor', 'N27') },
      { id: 'table', label: UI.inspectTable, run: () => ctx().dialogue.reaction('home_clean.inspect_table', 'N28') },
      { id: 'penguin', label: UI.hearPenguin, run: () => this.hearPenguin() },
      ...(!ctx().save.data.bouquetPlaced ? [{ id: 'vase', label: UI.placeFlowers, run: () => this.placeFlowers() }] : []),
      { id: 'throw', label: this.throwMode ? UI.cancel : UI.extraThrow, run: () => this.throwMode ? this.leaveThrowMode() : this.beginThrowMode() },
      ...(this.seated ? [{ id: 'album', label: UI.openAlbum, run: () => ctx().ui.album() }] : [{ id: 'sit', label: UI.sit, run: () => this.sit(), primary: true }]),
      { id: 'revisit', label: UI.revisit, run: () => { this.leaveThrowMode(); ctx().go('Return'); } },
    ]);
  }

  private beginThrowMode(): void {
    if (this.seated) {
      const meta = metadata.frog_neutral;
      this.frog.setTexture('frog_neutral').setOrigin(meta.origin.x, meta.origin.y).setScale(115 / meta.visibleBounds.height).setPosition(336, 440);
    }
    this.throwMode = true; this.origin = { x: 394, y: 354 };
    this.preview = this.add.graphics().setDepth(20);
    ctx().ui.instruction(UI.throwSelected);
    ctx().dialogue.reaction('ending.extra_paperball', 'N30'); this.drawAim(); this.actions();
  }

  private leaveThrowMode(): void {
    this.throwMode = false; this.aiming = false; this.pointerId = null; this.dragInput(false);
    this.preview?.destroy(); this.preview = undefined;
    this.projectile?.destroy(); this.projectile = undefined; this.launchVelocity = undefined;
    if (this.seated) {
      const meta = metadata.frog_sit;
      this.frog.setTexture('frog_sit').setOrigin(meta.origin.x, meta.origin.y).setScale(115 / meta.visibleBounds.height).setPosition(501, 399);
    }
    ctx().ui.instruction(UI.sitLater); this.actions();
  }

  private setupThrowInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.throwMode || this.launchVelocity || Phaser.Math.Distance.Between(pointer.x, pointer.y, this.origin.x, this.origin.y) > 65) return;
      this.aiming = true; this.pointerId = pointer.id; this.dragInput(true);
      this.drawAim(pointer);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.aiming && this.pointerId === pointer.id) this.drawAim(pointer);
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.aiming || this.pointerId !== pointer.id) return;
      this.aiming = false; this.pointerId = null; this.dragInput(false);
      const velocity = velocityFromDrag(this.origin, pointer);
      if (Math.hypot(velocity.x, velocity.y) < 35) { this.drawAim(); return; }
      this.launchVelocity = velocity; this.projectileTime = 0; this.preview?.clear();
      this.projectile = this.add.circle(this.origin.x, this.origin.y, 9, 0xfff9e8).setStrokeStyle(3, 0x312f26).setDepth(20);
      ctx().audio.playSfx('throw');
    });
    const cancel = () => { this.aiming = false; this.pointerId = null; this.dragInput(false); if (this.throwMode && !this.launchVelocity) this.drawAim(); };
    this.input.on('gameout', cancel);
    this.game.canvas.addEventListener('pointercancel', cancel);
    this.events.once('shutdown', () => this.game.canvas.removeEventListener('pointercancel', cancel));
  }

  private drawAim(pointer?: Point): void {
    if (!this.preview) return;
    this.preview.clear(); this.preview.lineStyle(2, 0x635e46, .75);
    this.preview.strokeCircle(this.origin.x, this.origin.y, 32);
    if (!pointer) return;
    this.preview.lineBetween(this.origin.x, this.origin.y, pointer.x, pointer.y);
    const velocity = velocityFromDrag(this.origin, pointer);
    for (let t = 0.08; t < 2; t += .08) {
      const at = pointAt(this.origin, velocity, t); if (at.y > 462 || at.x < 0 || at.x > 960) break;
      this.preview.fillStyle(0x5f5945, .7); this.preview.fillCircle(at.x, at.y, 2);
    }
  }

  update(_time: number, delta: number): void {
    if (!this.launchVelocity || !this.projectile) return;
    const previous = pointAt(this.origin, this.launchVelocity, this.projectileTime);
    this.projectileTime += Math.min(delta, 60) / 1000;
    const next = pointAt(this.origin, this.launchVelocity, this.projectileTime);
    this.projectile.setPosition(next.x, next.y);
    if (segmentHitsRect(previous, next, { x: 653, y: 257, width: 106, height: 145 }, 9)) {
      ctx().audio.playSfx('hit');
      this.tweens.add({ targets: this.penguin, angle: 6, duration: 100, yoyo: true });
      this.projectile.destroy(); this.projectile = undefined; this.launchVelocity = undefined; this.drawAim();
    } else if (next.y > 464 || next.x < -20 || next.x > 980) {
      ctx().audio.playSfx('paper');
      this.projectile.destroy(); this.projectile = undefined; this.launchVelocity = undefined; this.drawAim();
    }
  }

  override hint(): void { ctx().ui.message(UI.hint, this.throwMode ? UI.throwSelected : UI.genericHint); }
}
