import { BaseScene } from './BaseScene';
import { ctx } from '../context';
import { UI } from '../content/ui';
import type { Action } from '../ui/GameUI';
export class AlbumScene extends BaseScene {
  constructor(){super('Album');}
  create():void {
    this.setup('bg_album_pavilion',ctx().save.data.albumUnlocked?'':UI.albumHelp);
    this.asset('frog_neutral',246,437,106);
    this.asset('dog_happy',425,432,90,()=>{ctx().dialogue.reaction('park.first_pet','N08');});
    this.asset('album_closed',593,415,95,()=>this.takeAlbum());
    ctx().dialogue.reaction('album.enter','N13');this.refreshControls();
  }
  private takeAlbum():void {
    if(!ctx().save.data.albumUnlocked){ctx().save.data.albumUnlocked=true;ctx().save.add('album');ctx().ui.refreshInventory();this.refreshControls();ctx().ui.instruction('');}
    ctx().ui.album();
  }
  refreshControls():void {
    const actions:Action[]=[{id:'back-park',label:UI.back,run:()=>ctx().go('Park')}];
    if(!ctx().save.data.albumUnlocked)actions.push({id:'take-album',label:UI.takeAlbum,run:()=>this.takeAlbum()});
    else {actions.push({id:'open-album',label:UI.openAlbum,run:()=>ctx().ui.album()},{id:'route-cards',label:UI.routeCards,run:()=>ctx().ui.routes(()=>this.refreshControls())});}
    if(ctx().save.has('cards'))actions.push({id:'to-icecream',label:UI.toIcecream,run:()=>ctx().go('IceCream')});
    if(ctx().save.has('machine'))actions.push({id:'to-return',label:UI.toReturn,run:()=>ctx().go('Return')});
    ctx().ui.actions(actions);
  }
  override hint():void {if(ctx().save.data.albumUnlocked)this.say('N32');else ctx().ui.message(UI.hint,UI.albumHelp);}
}
