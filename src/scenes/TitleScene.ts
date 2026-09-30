import Phaser from 'phaser';
import assets from '../content/assets.json';
import { ctx } from '../context';
export class TitleScene extends Phaser.Scene {
  constructor(){super('Title');}
  create():void {
    let starting=false;
    this.add.image(480,270,'bg_park').setDisplaySize(960,540);
    const m=assets.frog_neutral;this.add.image(280,416,'frog_neutral').setOrigin(m.origin.x,m.origin.y).setScale(142/m.visibleBounds.height);
    const d=assets.dog_happy;this.add.image(467,423,'dog_happy').setOrigin(d.origin.x,d.origin.y).setScale(95/d.visibleBounds.height);
    ctx().ui.title(()=>{
      // Called in the actual pointer/keyboard gesture, before any async work.
      if(starting)return;starting=true;
      void ctx().audio.unlock().then(()=>ctx().go(ctx().save.data.currentScene));
    });
  }
}
