import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { ctx } from '../context';
import { UI } from '../content/ui';
import { STICK_DATA } from '../content/puzzleData';
import { canPass, projectedWidth } from '../puzzles/StickGatePuzzle';
import metadata from '../content/assets.json';

export class ParkScene extends BaseScene {
  private dog!: Phaser.GameObjects.Sprite;
  private stick?: Phaser.GameObjects.Container;
  private gate?: Phaser.GameObjects.Container;
  private widthText?: Phaser.GameObjects.Text;
  private bouquet?: Phaser.GameObjects.Sprite;
  private bouquetLabel?: Phaser.GameObjects.Text;
  private petFrameTimer?: Phaser.Time.TimerEvent;
  private gateOpened = false;
  private passing = false;
  private dragPointer: number | null = null;
  private dragOffset = 0;

  constructor() { super('Park'); }

  create(): void {
    this.gateOpened = ctx().save.has('stick');
    this.passing = false; this.dragPointer = null;
    this.stick = undefined; this.bouquet = undefined; this.bouquetLabel = undefined; this.widthText = undefined;
    this.setup('bg_park', ctx().save.has('stick') ? UI.stayHelp : UI.parkHelp);
    this.asset('frog_neutral', 230, 435, 112);
    this.dog = this.asset(ctx().save.has('stick') ? 'dog_happy' : 'dog_side', ctx().save.has('stick') ? 713 : 450, 420, 98, () => this.pet());
    this.dog.setFlipX(!ctx().save.has('stick')).setDepth(3);
    this.drawGate();
    if (!ctx().save.has('stick')) this.drawStick();
    else if (!ctx().save.data.inventory.includes('bouquet')) this.showBouquet();
    this.actions();
    ctx().dialogue.reaction('park.enter', 'N07');
  }

  private drawGate(): void {
    const posts = this.add.graphics().setDepth(1);
    posts.lineStyle(8, 0x292820); posts.lineBetween(620, 282, 620, 429); posts.lineBetween(745, 282, 745, 429);
    posts.lineStyle(3, 0xf6ebcc); posts.lineBetween(621, 286, 621, 424); posts.lineBetween(746, 286, 746, 424);
    const panel = this.add.graphics();
    panel.lineStyle(5, 0x37352a); panel.strokeRect(0, -57, STICK_DATA.gateWidth, 107);
    for (const x of [25, 63, 101]) panel.lineBetween(x, -55, x, 47);
    panel.lineBetween(0, -4, STICK_DATA.gateWidth, -4);
    this.gate = this.add.container(620, 350, [panel]).setDepth(2);
    if (this.gateOpened) this.gate.setAngle(-100);
    this.hotspot(683, 348, 145, 153, () => this.tryPass()).setDepth(2);
    this.label(682, 257, UI.gate, 17).setDepth(2);
  }

  private drawStick(): void {
    const branch = this.add.graphics();
    branch.lineStyle(STICK_DATA.thickness + 4, 0x30291d);
    branch.lineBetween(-STICK_DATA.length / 2, 0, STICK_DATA.length / 2, 0);
    branch.lineStyle(STICK_DATA.thickness - 2, 0xad8655);
    branch.lineBetween(-STICK_DATA.length / 2 + 3, 0, STICK_DATA.length / 2 - 3, 0);
    branch.lineStyle(5, 0x30291d); branch.lineBetween(96, 0, 111, -15); branch.lineBetween(-87, 0, -102, 12);
    const grip = this.add.zone(0, 0, STICK_DATA.length + 24, 48).setInteractive({ useHandCursor: true });
    this.stick = this.add.container(552, 354, [branch, grip]).setDepth(6);
    this.stick.setAngle(ctx().save.data.stickAngle);
    grip.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.passing) return;
      this.dragPointer = pointer.id;
      this.dragInput(true);
      this.dragOffset = this.stick!.angle - Phaser.Math.RadToDeg(Math.atan2(pointer.y - this.stick!.y, pointer.x - this.stick!.x));
      ctx().ui.instruction(UI.stickHelp);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.dragPointer !== pointer.id || !pointer.isDown || !this.stick) return;
      if (Phaser.Math.Distance.Between(pointer.x, pointer.y, this.stick.x, this.stick.y) < 18) return;
      this.setAngle(Phaser.Math.RadToDeg(Math.atan2(pointer.y - this.stick.y, pointer.x - this.stick.x)) + this.dragOffset);
    });
    const cancel = () => { this.dragPointer = null; this.dragInput(false); };
    this.input.on('pointerup', cancel);
    this.input.on('gameout', (pointer?: Phaser.Input.Pointer) => {
      // DOM captions can cross the gesture while the touch remains on the stage.
      // Losing hover to such a control must not cancel an active touch rotation.
      if (!pointer || (pointer.id === this.dragPointer && (pointer.x < 0 || pointer.x > 960 || pointer.y < 0 || pointer.y > 540))) cancel();
    });
    this.game.canvas.addEventListener('pointercancel', cancel);
    this.events.once('shutdown', () => this.game.canvas.removeEventListener('pointercancel', cancel));
    this.widthText = this.label(490, 475, '', 16).setDepth(10);
    this.updateWidth();
  }

  private setAngle(angle: number): void {
    if (!this.stick || this.passing) return;
    ctx().save.data.stickAngle = Phaser.Math.Wrap(angle, -180, 180);
    this.stick.setAngle(ctx().save.data.stickAngle);
    ctx().save.persist(); this.updateWidth(); ctx().audio.playSfx('tick');
  }

  private updateWidth(): void {
    const width = projectedWidth(STICK_DATA.length, STICK_DATA.thickness, ctx().save.data.stickAngle);
    this.widthText?.setText(`${UI.width} ${Math.round(width)}  /  ${UI.gateWidth} ${STICK_DATA.gateWidth}`);
  }

  private pet(): void {
    const save = ctx().save;
    const count = (save.data.reactionFlags['park.pet_count'] ?? 0) + 1;
    save.data.reactionFlags['park.pet_count'] = count; save.persist();
    if (count === 1) ctx().dialogue.reaction('park.first_pet', 'N08');
    if (count === 4) ctx().dialogue.reaction('park.fourth_pet', 'N09');
    ctx().audio.playSfx('pop');
    this.petFrameTimer?.remove(false); this.dogTexture('dog_front');
    this.petFrameTimer = this.time.delayedCall(420, () => this.dogTexture(ctx().save.has('stick') ? 'dog_happy' : 'dog_side'));
    this.tweens.add({ targets: this.dog, y: 416, duration: 130, yoyo: true });
  }

  private dogTexture(key: 'dog_front' | 'dog_side' | 'dog_happy'): void {
    if (!this.dog.active) return;
    const meta = metadata[key];
    this.dog.setTexture(key).setOrigin(meta.origin.x, meta.origin.y).setScale(98 / meta.visibleBounds.height).setFlipX(key === 'dog_side');
    this.dog.setInteractive(new Phaser.Geom.Rectangle(meta.visibleBounds.x, meta.visibleBounds.y, meta.visibleBounds.width, meta.visibleBounds.height), Phaser.Geom.Rectangle.Contains, true);
  }

  private tryPass(): void {
    if (this.passing || ctx().save.has('stick')) return;
    if (!this.gateOpened) {
      this.gateOpened = true; ctx().audio.playSfx('door');
      this.tweens.add({ targets: this.gate, angle: -100, duration: 400, ease: 'Sine.Out' });
      ctx().dialogue.reaction('park.dog_blocked', 'N10');
      ctx().ui.instruction(UI.stickHelp); return;
    }
    if (!canPass(STICK_DATA.length, STICK_DATA.thickness, ctx().save.data.stickAngle, STICK_DATA.gateWidth)) {
      ctx().audio.playSfx('latch'); ctx().ui.instruction(UI.stickHelp);
      this.tweens.add({ targets: this.stick, x: 547, duration: 90, yoyo: true });
      return;
    }
    this.passing = true; this.dragPointer = null; this.dragInput(false);
    ctx().save.complete('stick'); ctx().audio.playSfx('success');
    ctx().dialogue.reaction('park.dog_passed', 'N11'); this.actions();
    this.tweens.add({ targets: [this.dog, this.stick], x: '+=263', duration: 1400, ease: 'Sine.InOut', onComplete: () => {
      this.stick?.destroy(); this.stick = undefined; this.widthText?.destroy();
      const happy = this.asset('dog_happy', this.dog.x, 420, 98, () => this.pet()).setDepth(3);
      this.dog.destroy(); this.dog = happy;
      this.passing = false; this.showBouquet(); this.actions();
    }});
  }

  private showBouquet(): void {
    if (this.bouquet || ctx().save.data.inventory.includes('bouquet')) return;
    this.bouquet = this.asset('bouquet', 804, 421, 98, () => this.collectFlowers()).setDepth(5);
    this.bouquetLabel = this.label(805, 453, UI.takeFlowers, 16);
    ctx().ui.instruction(UI.takeFlowers);
  }

  private collectFlowers(): void {
    if (!ctx().save.has('stick') || this.passing) return;
    ctx().save.add('bouquet'); this.bouquet?.destroy(); this.bouquet = undefined;
    this.bouquetLabel?.destroy(); this.bouquetLabel = undefined;
    ctx().ui.refreshInventory(); ctx().audio.playSfx('pickup');
    ctx().dialogue.reaction('park.bouquet_received', 'N12');
    ctx().ui.instruction(UI.toAlbum); this.actions();
  }

  private actions(): void {
    const solved = ctx().save.has('stick'), flowers = ctx().save.data.inventory.includes('bouquet');
    const actions = [
      { id: 'pet', label: UI.pet, run: () => this.pet() },
      ...(!solved ? [
        { id: 'rotate-left', label: UI.rotateLeft, run: () => this.setAngle(ctx().save.data.stickAngle - 15), disabled: this.passing },
        { id: 'rotate-right', label: UI.rotateRight, run: () => this.setAngle(ctx().save.data.stickAngle + 15), disabled: this.passing },
        { id: 'gate', label: UI.gate, run: () => this.tryPass(), primary: true, disabled: this.passing },
      ] : []),
      ...(solved && !flowers ? [{ id: 'flowers', label: UI.takeFlowers, run: () => this.collectFlowers(), primary: true, disabled: this.passing }] : []),
      ...(flowers ? [{ id: 'album', label: UI.toAlbum, run: () => ctx().go('Album'), primary: true }] : []),
      ...(ctx().save.has('machine') ? [{ id: 'return', label: UI.toReturn, run: () => ctx().go('Return') }] : []),
    ];
    ctx().ui.actions(actions);
  }

  override hint(): void { this.say('N31'); ctx().ui.instruction(UI.stickHelp); }
}
