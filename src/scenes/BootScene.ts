import Phaser from 'phaser';
import assets from '../content/assets.json';
import { assetUrl } from '../context';
import { UI } from '../content/ui';
export class BootScene extends Phaser.Scene {
  constructor(){super('Boot');}
  preload():void {
    const loading=document.querySelector<HTMLElement>('#loading')!;
    const bar=loading.querySelector('progress')!;
    this.load.on('progress',(value:number)=>{bar.value=value;});
    this.load.on('loaderror',()=>{loading.querySelector('p')!.textContent=UI.loadingFailed;});
    Object.entries(assets).forEach(([key,m])=>this.load.image(key,assetUrl(m.src)));
  }
  create():void {
    document.querySelector<HTMLElement>('#loading')!.hidden=true;
    document.querySelector<HTMLElement>('#loading')!.style.display='none';
    this.anims.create({key:'frog-walk',frames:[{key:'frog_walk_a'},{key:'frog_walk_b'}],frameRate:5,repeat:-1});
    this.scene.start('Title');
  }
}
