import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { ctx } from '../context';
import { UI } from '../content/ui';
import type { Action } from '../ui/GameUI';
import assets from '../content/assets.json';
import { MACHINE_NODES, MACHINE_EDGES, MACHINE_SWITCHES, routeBall, type MachineNode } from '../puzzles/IceCreamMachinePuzzle';
export class IceCreamScene extends BaseScene {
  private rails!:Phaser.GameObjects.Graphics;
  private ball!:Phaser.GameObjects.Arc;
  private machineOffset={x:508,y:164};
  private running=false;
  private switchLabels:Phaser.GameObjects.Text[]=[];
  private cup?:Phaser.GameObjects.Sprite;
  constructor(){super('IceCream');}
  create():void {
    this.running=false;this.switchLabels=[];
    this.setup('bg_icecream_shop',ctx().save.has('machine')?UI.machineReady:UI.machineHelp);
    this.asset('frog_neutral',269,449,117);
    this.rails=this.add.graphics();this.drawMachine();
    const start=MACHINE_NODES.find(n=>n.id==='entrance')??MACHINE_NODES[0]!;
    const startAt=this.pos(start);
    this.ball=this.add.circle(startAt.x,startAt.y,5,0xfffef5).setStrokeStyle(2,0x554d36).setDepth(4);
    const cupAt=this.pos(MACHINE_NODES.find(n=>n.id==='cup')!);
    this.asset('rice_icecream_empty',cupAt.x,cupAt.y+17,28);
    const recycle=this.pos(MACHINE_NODES.find(n=>n.kind==='recycle')!);
    this.label(recycle.x,recycle.y+16,UI.recycle,12);
    const g=this.add.graphics();g.lineStyle(6,0x29281e);g.lineBetween(869,323,869,359);g.fillStyle(0xcfa376);g.fillCircle(869,321,11);g.lineStyle(3,0x29281e);g.strokeCircle(869,321,11);
    this.hotspot(869,337,52,66,()=>this.pullLever());
    for(const s of MACHINE_SWITCHES){const p=this.pos(s);this.hotspot(p.x,p.y,48,36,()=>this.toggle(s.index));}
    if(ctx().save.data.inventory.includes('icecream'))this.showCup();
    const updateCup=()=>this.showCup();this.game.events.on('icecream-changed',updateCup);
    this.events.once('shutdown',()=>this.game.events.off('icecream-changed',updateCup));
    this.refreshControls();ctx().dialogue.reaction('icecream.enter','N19');
  }
  private pos(node:{x:number;y:number}):{x:number;y:number} {return{x:this.machineOffset.x+node.x*.98,y:this.machineOffset.y+node.y*.53};}
  private drawMachine():void {
    this.rails.clear();this.switchLabels.forEach(t=>t.destroy());this.switchLabels=[];
    const map=new Map(MACHINE_NODES.map(n=>[n.id,n]));
    for(const edge of MACHINE_EDGES){
      const a=this.pos(map.get(edge.from)!);const b=this.pos(map.get(edge.to)!);
      this.rails.lineStyle(7,0x9d967f,.38);this.rails.lineBetween(a.x,a.y,b.x,b.y);
      const active=edge.switchIndex===undefined||ctx().save.data.switches[edge.switchIndex]===edge.direction;
      this.rails.lineStyle(active?4:2,active?0x554d35:0xb8af98,active?.9:.55);this.rails.lineBetween(a.x,a.y,b.x,b.y);
    }
    for(const s of MACHINE_SWITCHES){
      const p=this.pos(s);this.rails.fillStyle(0xfaf1d4);this.rails.fillCircle(p.x,p.y,15);this.rails.lineStyle(2.5,0x443f2e);this.rails.strokeCircle(p.x,p.y,15);
      const sign=ctx().save.data.switches[s.index]==='L'?-1:1;this.rails.lineStyle(5,0xa46d43);this.rails.lineBetween(p.x,p.y,p.x+sign*14,p.y+12);
      const text=this.label(p.x+(s.index===0?28:-39),p.y-12,`${s.index+1}`,13);this.switchLabels.push(text);
    }
    const entry=MACHINE_NODES.find(n=>n.kind==='entrance')??MACHINE_NODES[0]!;const p=this.pos(entry);this.rails.fillStyle(0xfff8e7);this.rails.fillCircle(p.x,p.y,9);this.rails.lineStyle(2,0x554d35);this.rails.strokeCircle(p.x,p.y,9);
  }
  private toggle(index:number):void {if(this.running||ctx().save.has('machine'))return;ctx().save.data.switches[index]=ctx().save.data.switches[index]==='L'?'R':'L';ctx().save.persist();ctx().audio.playSfx('tick');this.drawMachine();this.refreshControls();}
  private launch():void {
    if(this.running||ctx().save.has('machine'))return;
    this.running=true;ctx().ui.instruction(UI.machineRunning);this.refreshControls();
    const route=routeBall([...ctx().save.data.switches]);const first=this.pos(route.nodes[0]!);this.ball.setPosition(first.x,first.y).setVisible(true);ctx().audio.playSfx('marble');
    const advance=(index:number):void=>{
      if(index>=route.nodes.length){
        this.running=false;
        if(route.success){ctx().save.complete('machine');ctx().audio.playSfx('success');ctx().dialogue.reaction('icecream.solved','N21');ctx().ui.instruction(UI.machineReady);}
        else {ctx().dialogue.reaction('icecream.first_recycle','N20');ctx().ui.instruction(UI.machineHelp);}
        this.refreshControls();return;
      }
      const a=this.pos(route.nodes[index-1]!);const b=this.pos(route.nodes[index]!);
      this.tweens.add({targets:this.ball,x:b.x,y:b.y,duration:Math.max(220,Phaser.Math.Distance.Between(a.x,a.y,b.x,b.y)*5),ease:'Linear',onComplete:()=>{ctx().audio.playSfx('tick');advance(index+1);}});
    };advance(1);
  }
  private pullLever():void {
    if(this.running||!ctx().save.has('machine')||ctx().save.data.inventory.includes('icecream'))return;
    ctx().audio.playSfx('latch');ctx().save.add('icecream');ctx().ui.refreshInventory();this.showCup();ctx().ui.instruction('');
    ctx().dialogue.reaction('icecream.received','N22');this.refreshControls();
  }
  private showCup():void {
    this.cup?.destroy();
    const state=ctx().save.data.icecreamState;
    this.cup=this.asset(state===2?'rice_icecream_empty':'rice_icecream_full',703,436,state===2?42:73,()=>ctx().ui.item('icecream'));
    if(state===1){const m=assets.rice_icecream_full;this.cup.setCrop(0,m.height*.18,m.width,m.height*.82);}
  }
  refreshControls():void {
    const actions:Action[]=[{id:'back-album',label:UI.back,run:()=>ctx().go('Album'),disabled:this.running}];
    if(!ctx().save.has('machine')) {
      ctx().save.data.switches.forEach((s,i)=>actions.push({id:`switch-${i}`,label:`${i+1}：${s==='L'?UI.left:UI.right}`,disabled:this.running,run:()=>this.toggle(i)}));
      actions.push({id:'launch-rice',label:this.running?UI.machineRunning:UI.launch,disabled:this.running,run:()=>this.launch()});
    } else if(!ctx().save.data.inventory.includes('icecream'))actions.push({id:'pull-lever',label:UI.pullLever,disabled:false,run:()=>this.pullLever()});
    else {actions.push({id:'eat-icecream',label:UI.taste,disabled:false,run:()=>ctx().ui.item('icecream')},{id:'to-return',label:UI.keepWalking,disabled:false,run:()=>ctx().go('Return')});}
    ctx().ui.actions(actions);
  }
  override hint():void {this.say('N33');}
}
