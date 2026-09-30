import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { ctx } from '../context';
import { UI } from '../content/ui';
import assets from '../content/assets.json';
import type { Action } from '../ui/GameUI';
import { pointAt, velocityFromDrag, segmentHitsRect, suggestedVelocity, type Point } from '../puzzles/ThrowPuzzle';

export class HomeScene extends BaseScene {
  private origin:Point={x:330,y:335};
  private target={x:532,y:244,width:143,height:166};
  private selected:'paper'|'slipper'|undefined;
  private aiming=false;
  private flying=false;
  private flight=0;
  private velocity:Point={x:0,y:0};
  private last:Point={x:0,y:0};
  private projectile?:Phaser.GameObjects.Container;
  private preview!:Phaser.GameObjects.Graphics;
  private penguin!:Phaser.GameObjects.Sprite;
  private frog!:Phaser.GameObjects.Sprite;
  private ring!:Phaser.GameObjects.Graphics;
  private misses=0;
  private trash:Phaser.GameObjects.GameObject[]=[];
  constructor(){super('Home');}
  create():void {
    this.selected=undefined;this.aiming=false;this.flying=false;this.misses=0;
    this.setup('bg_home',UI.throwHelp);
    this.penguin=this.asset(ctx().save.has('throw')?'penguin_surprised':'penguin_snacking',602,413,171,()=>{
      const count=(ctx().save.data.reactionFlags['home.penguin_clicks']??0)+1;ctx().save.data.reactionFlags['home.penguin_clicks']=count;ctx().save.persist();
      if(count===3)ctx().dialogue.reaction('home.trash_loop_3','N02');
    });
    this.frog=this.asset('frog_angry',258,433,119);
    this.trash=[];
    if(!ctx().save.has('throw')) {
      const p=this.makeProjectile('paper',399,427);this.trash.push(p);this.hotspot(399,427,60,52,()=>this.select('paper'));
      const slipper=this.makeProjectile('slipper',450,438);this.trash.push(slipper);this.hotspot(450,436,62,48,()=>this.select('slipper'));
      const scraps=this.add.graphics();scraps.lineStyle(3,0x766a51);scraps.strokePoints([{x:690,y:435},{x:708,y:432},{x:700,y:451},{x:682,y:444}],true);scraps.lineBetween(701,438,691,446);this.trash.push(scraps);
    }
    this.preview=this.add.graphics().setDepth(8);this.ring=this.add.graphics().setDepth(7);
    this.drawRing();this.refreshControls();ctx().dialogue.reaction('home.intro','N01');
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      if(this.selected&&!this.flying&&!ctx().save.has('throw')&&Phaser.Math.Distance.Between(p.x,p.y,this.origin.x,this.origin.y)<56){this.aiming=true;this.dragInput(true);this.drawAim({x:p.x,y:p.y});}
    });
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{if(this.aiming)this.drawAim({x:p.x,y:p.y});});
    this.input.on('pointerup',()=>{if(this.aiming){this.aiming=false;this.dragInput(false);this.launch();}});
    this.input.on('pointerupoutside',()=>this.cancelAim());this.input.on('gameout',()=>this.cancelAim());
    const cancel=()=>this.cancelAim();this.game.canvas.addEventListener('pointercancel',cancel);
    this.events.once('shutdown',()=>this.game.canvas.removeEventListener('pointercancel',cancel));
    if(ctx().save.has('throw'))this.openDoor();
  }
  private makeProjectile(kind:'paper'|'slipper',x:number,y:number):Phaser.GameObjects.Container {
    const g=this.add.graphics();g.fillStyle(kind==='paper'?0xfffdf3:0xc29b70);g.lineStyle(2.5,0x29281e);
    if(kind==='paper') {g.fillPoints([{x:-11,y:-7},{x:-3,y:-12},{x:10,y:-8},{x:12,y:5},{x:2,y:12},{x:-12,y:7}],true);g.strokePoints([{x:-11,y:-7},{x:-3,y:-12},{x:10,y:-8},{x:12,y:5},{x:2,y:12},{x:-12,y:7}],true);g.lineBetween(-8,-3,2,3);g.lineBetween(2,3,8,-5);g.lineBetween(2,3,-3,9);}
    else {g.fillRoundedRect(-22,-9,43,18,7);g.strokeRoundedRect(-22,-9,43,18,7);g.lineBetween(2,-9,2,9);g.lineBetween(13,-7,15,7);}
    return this.add.container(x,y,[g]);
  }
  private select(kind:'paper'|'slipper'):void {this.selected=kind;ctx().audio.playSfx('paper');ctx().dialogue.reaction('home.ammo_selected','N03');ctx().ui.instruction(UI.throwSelected);this.drawRing();this.refreshControls();}
  private drawRing():void {
    this.ring.clear();if(!this.selected||ctx().save.has('throw'))return;
    this.ring.lineStyle(2,0x867a5a,.8);this.ring.strokeCircle(this.origin.x,this.origin.y,24);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;this.ring.fillStyle(0x867a5a,.7);this.ring.fillCircle(this.origin.x+Math.cos(a)*29,this.origin.y+Math.sin(a)*29,1.5);}
  }
  private drawAim(drag:Point):void {this.velocity=velocityFromDrag(this.origin,drag);this.renderPrediction();}
  private renderPrediction():void {
    this.preview.clear();this.preview.fillStyle(0x675d42,.8);
    let prev=this.origin;
    for(let t=.08;t<2.6;t+=.08){const p=pointAt(this.origin,this.velocity,t);if(p.y>445||p.x>955||p.x<0)break;this.preview.fillCircle(p.x,p.y,2.2);if(segmentHitsRect(prev,p,this.target,10)){this.preview.lineStyle(2,0x675d42,.65);this.preview.strokeCircle(p.x,p.y,14);break;}prev=p;}
  }
  private cancelAim():void {if(!this.aiming)return;this.aiming=false;this.dragInput(false);this.preview.clear();}
  private launch():void {
    if(!this.selected||this.flying||ctx().save.has('throw'))return;
    this.flying=true;this.flight=0;this.last={...this.origin};this.preview.clear();this.projectile?.destroy();
    this.projectile=this.makeProjectile(this.selected,this.origin.x,this.origin.y).setDepth(10);ctx().audio.playSfx('throw');ctx().ui.instruction(UI.throwing);this.refreshControls();
  }
  update(_time:number,delta:number):void {
    if(!this.flying||!this.projectile)return;
    this.flight+=Math.min(delta/1000,.05);const p=pointAt(this.origin,this.velocity,this.flight);
    this.projectile.setPosition(p.x,p.y);this.projectile.rotation+=delta*.006;
    if(segmentHitsRect(this.last,p,this.target,10)){this.hit();return;}
    this.last=p;
    if(p.y>=448||p.x< -30||p.x>990||this.flight>5){
      this.flying=false;this.projectile.y=Math.min(448,p.y);ctx().audio.playSfx('hit');this.misses++;
      if(this.misses===1)ctx().dialogue.reaction('home.first_miss','N04');if(this.misses===3)ctx().dialogue.reaction('home.third_miss','N05');
      ctx().ui.instruction(UI.throwSelected);this.refreshControls();
    }
  }
  private hit():void {
    this.flying=false;ctx().save.complete('throw');ctx().audio.playSfx('hit');this.penguin.setTexture('penguin_surprised');
    const m=assets.penguin_surprised;this.penguin.setOrigin(m.origin.x,m.origin.y).setScale(171/m.visibleBounds.height);
    ctx().dialogue.reaction('home.hit','N06');this.ring.clear();
    const ball=this.projectile!;const from={x:ball.x,y:ball.y};const curve=new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(from.x,from.y),new Phaser.Math.Vector2(760,95),new Phaser.Math.Vector2(881,260));
    this.tweens.addCounter({from:0,to:1,duration:750,onUpdate:t=>{const p=curve.getPoint(t.getValue()??0);ball.setPosition(p.x,p.y);},onComplete:()=>{ball.destroy();this.openDoor();this.refreshControls();}});
    ctx().ui.instruction('');this.refreshControls();
  }
  private openDoor():void {
    if(this.children.getByName('door-open'))return;
    const g=this.add.graphics().setName('door-open');g.fillStyle(0xcad7a0);g.fillRect(804,92,104,197);g.lineStyle(5,0x29281e);g.strokeRect(804,92,104,197);
    g.fillStyle(0xc8a270);g.fillPoints([{x:804,y:92},{x:835,y:109},{x:835,y:286},{x:804,y:289}],true);g.strokePoints([{x:804,y:92},{x:835,y:109},{x:835,y:286},{x:804,y:289}],true);
    ctx().audio.playSfx('door');this.hotspot(858,220,100,190,()=>this.leave());
  }
  private leave():void {if(!ctx().save.has('throw'))return;ctx().ui.actions([]);this.walk(this.frog,852,()=>ctx().go('Park'));}
  refreshControls():void {
    if(ctx().save.has('throw')){ctx().ui.actions([{id:'leave',label:UI.leave,primary:true,run:()=>this.leave()}]);return;}
    const actions:Action[]=[{id:'ammo-paper',label:UI.paperball,disabled:this.flying,run:()=>this.select('paper')},{id:'ammo-slipper',label:UI.slipper,disabled:this.flying,run:()=>this.select('slipper')}];
    if(this.misses>=3)actions.push({id:'assist',label:UI.assist,disabled:this.flying,run:()=>{this.selected??='paper';this.velocity=suggestedVelocity(this.origin,{x:601,y:310});this.renderPrediction();this.drawRing();ctx().ui.actions([...actions,{id:'assist-launch',label:UI.assistLaunch,disabled:false,run:()=>this.launch()}]);}});
    ctx().ui.actions(actions);
  }
  override hint():void {ctx().ui.message(UI.helpTitle,UI.throwSelected);}
}
