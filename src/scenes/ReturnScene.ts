import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { ctx } from '../context';
import { UI } from '../content/ui';

export class ReturnScene extends BaseScene {
  private frog!: Phaser.GameObjects.Sprite;
  private leaving = false;
  constructor() { super('Return'); }

  create(): void {
    this.leaving = false;
    this.setup('bg_park', UI.stayHelp);
    this.frog = this.asset('frog_back', 335, 433, 115);
    const dog = this.asset('dog_happy', 700, 429, 98, () => {
      ctx().audio.playSfx('pop');
      const count = (ctx().save.data.reactionFlags['park.pet_count'] ?? 0) + 1;
      ctx().save.data.reactionFlags['park.pet_count'] = count; ctx().save.persist();
      if (count === 1) ctx().dialogue.reaction('park.first_pet', 'N08');
      if (count === 4) ctx().dialogue.reaction('park.fourth_pet', 'N09');
      this.tweens.add({ targets: dog, y: 425, duration: 130, yoyo: true });
    });
    this.label(160, 259, UI.goHome, 19);
    this.hotspot(155, 274, 190, 190, () => this.goHome());
    ctx().ui.actions([
      { id: 'stay', label: UI.stay, run: () => {
        ctx().dialogue.reaction('return.stay', 'N25'); ctx().ui.instruction(UI.stayHelp);
      } },
      { id: 'album', label: UI.openAlbum, run: () => ctx().ui.album() },
      { id: 'park', label: UI.revisitPark, run: () => ctx().go('Park') },
      { id: 'shop', label: UI.revisitShop, run: () => ctx().go('IceCream') },
      { id: 'home', label: UI.goHome, primary: true, run: () => this.goHome() },
    ]);
    ctx().dialogue.reaction('return.enter', 'N24');
  }

  private goHome(): void {
    if (this.leaving) return;
    this.leaving = true;
    ctx().save.data.reactionFlags['ending.pending_home'] = 1; ctx().save.persist();
    this.walk(this.frog, 120, () => ctx().go('Ending'), 'frog_back');
  }

  override hint(): void { ctx().ui.message(UI.hint, UI.stayHelp); }
}
