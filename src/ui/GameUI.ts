import { ctx, assetUrl } from '../context';
import { UI } from '../content/ui';
import { photos } from '../content/photos';
import { CARD_DATA, MARKERS, rotatedEdges, evaluateRoutes, type Edge, type Point } from '../puzzles/RouteCardPuzzle';
import type { SceneKey } from '../systems/SaveManager';

export interface Action { id: string; label: string; run: () => void; primary?: boolean; disabled?: boolean }
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); e.className = className; e.textContent = text; return e;
};
function button(action: Action): HTMLButtonElement {
  const b = node('button', action.primary ? 'primary' : '', action.label);
  b.type = 'button'; b.dataset.action = action.id; b.disabled = action.disabled ?? false;
  b.addEventListener('click', () => { ctx().audio.playSfx('click'); action.run(); }); return b;
}

export class GameUI {
  private root = document.querySelector<HTMLElement>('#ui')!;
  private overlay = document.querySelector<HTMLElement>('#overlay')!;
  private cleanup?: () => void;
  private returnFocus?: HTMLElement;
  private hintCallback?: () => void;
  constructor() {
    document.addEventListener('keydown', e => {
      if (!this.overlay.classList.contains('open')) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'Tab') {
        const focusable = Array.from(this.overlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = focusable[0], last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    });
  }
  private topControls(withHint = true): void {
    const controls = node('div', 'top-controls');
    if (withHint) controls.append(button({ id:'hint', label:UI.hint, run: () => this.hintCallback?.() }));
    const sound = button({ id:'sound', label:ctx().audio.isMuted ? UI.soundOff : UI.soundOn, run:() => {
      const muted = !ctx().audio.isMuted; ctx().audio.setMuted(muted); ctx().save.data.voiceMuted = muted; ctx().save.persist();
      sound.textContent = muted ? UI.soundOff : UI.soundOn; sound.setAttribute('aria-pressed', String(!muted));
      if (!muted) void ctx().audio.unlock();
    }});
    sound.setAttribute('aria-pressed', String(!ctx().audio.isMuted)); controls.append(sound);
    controls.append(button({ id:'restart',label:UI.newStory,run:() => this.confirmRestart() })); this.root.append(controls);
  }
  scene(key: SceneKey, instruction: string, hintCallback?: () => void): void {
    this.close(); this.root.replaceChildren(); this.hintCallback = hintCallback;
    this.root.append(node('p','scene-title',UI.sceneNames[key]));
    this.topControls(); this.instruction(instruction); this.refreshInventory();
    const actions = node('div','action-bar'); this.root.append(actions);
  }
  title(start: () => void): void {
    this.close(); this.root.replaceChildren(); this.topControls(false);
    const copy = node('div','title-copy'); copy.append(node('h1','',UI.title),node('p','',UI.subtitle)); this.root.append(copy);
    const buttons = node('div','title-buttons');
    buttons.append(button({id:'start',label:ctx().save.hasSave ? UI.continue : UI.start,run:start,primary:true}));
    buttons.append(node('p','title-note',UI.titleNote)); this.root.append(buttons);
  }
  actions(actions: Action[]): void {
    const bar = this.root.querySelector('.action-bar');
    if (!bar) return; bar.replaceChildren(...actions.map(button));
  }
  instruction(text: string): void {
    let hint = this.root.querySelector<HTMLElement>('.instruction');
    if (!hint) { hint = node('div','instruction'); this.root.append(hint); }
    hint.textContent = text; hint.hidden = !text;
  }
  refreshInventory(): void {
    this.root.querySelector('.inventory')?.remove();
    const inv = node('div','inventory'); inv.setAttribute('aria-label','口袋里的东西');
    for (const item of ctx().save.data.inventory) {
      const b = button({ id:`inventory-${item}`,label:'',run:() => this.item(item) });
      const image = node('img');
      const src = item === 'bouquet' ? 'bouquet' : item === 'album' ? 'album_closed' : ctx().save.data.icecreamState === 2 ? 'rice_icecream_empty' : 'rice_icecream_full';
      image.src = assetUrl(`assets/${src}.png`); image.alt = '';
      b.append(image,node('span','',item === 'bouquet' ? UI.flower : item === 'album' ? UI.album : UI.icecream)); inv.append(b);
    }
    this.root.append(inv);
  }
  close(): void {
    this.cleanup?.(); this.cleanup = undefined;
    this.overlay.replaceChildren(); this.overlay.classList.remove('open');
    this.root.removeAttribute('inert'); this.returnFocus?.focus(); this.returnFocus = undefined;
  }
  private modal(className = '', title?: string): HTMLDivElement {
    this.close(); this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.overlay.classList.add('open'); this.root.setAttribute('inert', '');
    const m = node('div', `modal ${className}`); m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true'); m.setAttribute('aria-label',title ?? UI.album);
    const close = button({id:'close',label:UI.close,run:() => {ctx().audio.playSfx('paper');this.close();}}); close.classList.add('close'); m.append(close);
    this.overlay.append(m); close.focus(); return m;
  }
  message(title: string, body: string): void { const m=this.modal('small',title);m.append(node('h2','',title),node('p','',body)); }
  confirmRestart(): void {
    const m=this.modal('small',UI.newStory); m.append(node('p','',UI.restartConfirm));
    const actions=node('div','modal-actions');actions.append(button({id:'confirm-restart',label:UI.restart,run:()=>{ctx().dialogue.resetReactions();ctx().save.reset();this.close();void ctx().audio.unlock().then(()=>ctx().go('Home'));},primary:true}),button({id:'cancel-restart',label:UI.cancel,run:()=>this.close()})); m.append(actions);
  }
  album(): void {
    if (!ctx().save.data.albumUnlocked) return;
    ctx().audio.playSfx('paper'); ctx().dialogue.reaction('album.first_open','N14');
    const m=this.modal('album-modal',UI.album); let page=0;
    const spread=node('div','album-spread'); spread.style.backgroundImage=`url("${assetUrl('assets/album_open.png')}")`; m.append(spread);
    const nav=node('div','album-nav'); m.append(nav);
    const count=Math.max(5,Math.ceil((photos.length+2)/2));
    const render = (): void => {
      spread.replaceChildren();
      for(let slot=0;slot<2;slot++) {
        const entry=photos[page*2+slot]; const figure=node('figure','photo');
        if(entry) {
          const im=node('img');im.src=assetUrl(entry.src);im.alt=entry.alt || entry.caption || `相册里的第 ${page*2+slot+1} 张照片`;
          im.addEventListener('error',()=>{im.replaceWith(node('div','empty-photo',UI.emptyPhoto));},{once:true});figure.append(im);
          if(entry.caption) figure.append(node('figcaption','',entry.caption));
        } else figure.append(node('div','empty-photo',UI.emptyPhoto));
        spread.append(figure);
      }
      nav.replaceChildren(button({id:'album-prev',label:UI.prev,disabled:page===0,run:()=>{page--;ctx().audio.playSfx('paper');render();}}),node('span','',`${page+1} / ${count}`),button({id:'album-next',label:UI.next,disabled:page===count-1,run:()=>{page++;ctx().audio.playSfx('paper');ctx().dialogue.reaction('album.photos','N15');render();}}),button({id:'album-note',label:UI.note,run:()=>{void ctx().dialogue.say('P02');}}));
    }; render();
  }
  item(item: 'bouquet'|'album'|'icecream'): void {
    if(item==='album') {this.album();return;}
    const m=this.modal('small item-modal',item==='bouquet'?UI.flower:UI.icecream);
    const title=node('h2','',item==='bouquet'?UI.flower:UI.icecream);m.append(title);
    const art=node('img','item-art');art.alt=title.textContent!;m.append(art);
    const actions=node('div','modal-actions');m.append(actions);
    const render=():void=>{
      const empty=ctx().save.data.icecreamState===2;
      art.src=assetUrl(`assets/${item==='bouquet'?'bouquet':empty?'rice_icecream_empty':'rice_icecream_full'}.png`);
      art.style.clipPath=item==='icecream'&&ctx().save.data.icecreamState===1?'inset(18% 0 0 0)':'';
      art.style.height=item==='icecream'&&empty?'30%':'50%';
      actions.replaceChildren(button({id:'item-note',label:UI.note,run:()=>{void ctx().dialogue.say(item==='bouquet'?'P01':'P03');}}));
      if(item==='icecream') actions.append(button({id:'eat',label:empty?UI.empty:ctx().save.data.icecreamState===0?UI.taste:UI.eatAgain,disabled:empty,run:()=>{
        ctx().save.data.icecreamState=ctx().save.data.icecreamState===0?1:2;ctx().save.persist();ctx().audio.playSfx('hit');
        ctx().dialogue.reaction('icecream.first_taste','N23');this.refreshInventory();ctx().game.events.emit('icecream-changed');render();
      },primary:true}));
    };render();
  }
  routes(onSolved?:()=>void): void {
    ctx().dialogue.reaction('album.cards_open','N16');ctx().audio.playSfx('paper');
    const m=this.modal('route-modal',UI.cardTitle);m.append(node('h2','',UI.cardTitle),node('p','route-help',UI.cardHelp));
    const layout=node('div','route-layout');const mapWrap=node('div','map-wrap');const list=node('div','route-list');layout.append(mapWrap,list);m.append(layout);
    const bottom=node('div','route-bottom');const feedback=node('span','route-feedback');m.append(bottom);
    const state=ctx().save.data;
    let selected=0;let solvedPath:Point[]=[];const cleanupFns:Array<()=>void>=[];
    const ns='http://www.w3.org/2000/svg';
    const svg=(className:string):SVGSVGElement=>{const s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','-.6 -.6 5.2 5.2');s.classList.add(className);return s;};
    const drawEdges=(s:SVGSVGElement,edges:Edge[],colorNumber:number,index:number):void=>{
      const color='#'+colorNumber.toString(16).padStart(6,'0');
      for(const [a,b]of edges){
        const line=document.createElementNS(ns,'line');line.setAttribute('x1',String(a.x));line.setAttribute('y1',String(a.y));line.setAttribute('x2',String(b.x));line.setAttribute('y2',String(b.y));
        line.setAttribute('stroke',color);line.setAttribute('stroke-width','.11');line.setAttribute('stroke-linecap','round');line.setAttribute('opacity','.76');
        if(index===1)line.setAttribute('stroke-dasharray','.16 .1');if(index===2)line.setAttribute('stroke-dasharray','.03 .12');s.append(line);
        for(const p of[a,b]){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',String(p.x));dot.setAttribute('cy',String(p.y));dot.setAttribute('r','.07');dot.setAttribute('fill',color);s.append(dot);}
      }
    };
    const render=():void=>{
      cleanupFns.splice(0).forEach(f=>f());mapWrap.replaceChildren();list.replaceChildren();
      const map=svg('route-map');map.dataset.action='route-map';mapWrap.append(map);
      for(let x=0;x<5;x++)for(let y=0;y<5;y++){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',String(x));dot.setAttribute('cy',String(y));dot.setAttribute('r','.025');dot.setAttribute('fill','#c4baa0');map.append(dot);}
      CARD_DATA.forEach((c,i)=>{if(state.cardsPlaced[i])drawEdges(map,rotatedEdges(i,state.cardRotations[i]!),c.color,i);});
      const markers:[Point,string][]=[[MARKERS.frog_start,'frog_neutral'],[MARKERS.flower_checkpoint,'bouquet'],[MARKERS.icecream_goal,'rice_icecream_full']];
      for(const[p,key]of markers){const im=document.createElementNS(ns,'image');im.setAttribute('href',assetUrl(`assets/${key}.png`));im.setAttribute('x',String(p.x-.27));im.setAttribute('y',String(p.y-.4));im.setAttribute('width','.54');im.setAttribute('height','.5');map.append(im);}
      if(solvedPath.length){const line=document.createElementNS(ns,'polyline');line.setAttribute('points',solvedPath.map(p=>`${p.x},${p.y}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#383c22');line.setAttribute('stroke-width','.13');line.setAttribute('pathLength','1');line.classList.add('path-lit');map.prepend(line);}
      CARD_DATA.forEach((c,i)=>{
        const card=node('div',`route-card ${i===selected?'selected':''}`);const preview=svg('card-preview');drawEdges(preview,rotatedEdges(i,state.cardRotations[i]!),c.color,i);preview.setAttribute('aria-label',`第 ${i+1} 张路线卡，拖到地图上`);card.append(preview);
        const info=node('div','card-info',`${i+1}. ${c.name} · ${state.cardRotations[i]!*90}°`);const buttons=node('div','card-buttons');
        const change=()=>{selected=i;solvedPath=[];state.cardRotations[i]=(state.cardRotations[i]!+1)%4;ctx().save.persist();ctx().audio.playSfx('paper');render();};
        buttons.append(button({id:`card-rotate-${i}`,label:UI.cardRotate,run:change}),button({id:`card-place-${i}`,label:state.cardsPlaced[i]?UI.cardRemove:UI.cardPlace,run:()=>{selected=i;solvedPath=[];state.cardsPlaced[i]=!state.cardsPlaced[i];ctx().save.persist();ctx().audio.playSfx('paper');render();}}));info.append(buttons);card.append(info);list.append(card);
        let dragging=false;
        const finish=(e:PointerEvent)=>{
          if(!dragging)return;dragging=false;preview.style.opacity='1';map.classList.remove('drop-active');
          const r=map.getBoundingClientRect();if(e.type!=='pointercancel'&&e.clientX>=r.left-18&&e.clientX<=r.right+18&&e.clientY>=r.top-18&&e.clientY<=r.bottom+18){selected=i;state.cardsPlaced[i]=true;ctx().save.persist();ctx().audio.playSfx('paper');render();}
          if(preview.hasPointerCapture(e.pointerId))preview.releasePointerCapture(e.pointerId);
        };
        preview.addEventListener('pointerdown',e=>{dragging=true;preview.setPointerCapture(e.pointerId);preview.style.opacity='.4';selected=i;});
        preview.addEventListener('pointermove',e=>{if(!dragging)return;const r=map.getBoundingClientRect();map.classList.toggle('drop-active',e.clientX>=r.left-18&&e.clientX<=r.right+18&&e.clientY>=r.top-18&&e.clientY<=r.bottom+18);});
        preview.addEventListener('pointerup',finish);preview.addEventListener('pointercancel',finish);preview.addEventListener('lostpointercapture',()=>{dragging=false;preview.style.opacity='1';map.classList.remove('drop-active');});
      });
    };
    const check=button({id:'check-route',label:UI.checkRoute,primary:true,run:()=>{
      const result=evaluateRoutes(state.cardRotations,state.cardsPlaced);
      if(result.solved){solvedPath=result.path;feedback.textContent=UI.routeSolved;if(!ctx().save.has('cards')){ctx().save.complete('cards');ctx().audio.playSfx('success');void ctx().dialogue.say('N18');}render();onSolved?.();}
      else{feedback.textContent=UI.routeWrong;ctx().dialogue.reaction('album.first_wrong','N17');}
    }});bottom.append(check,feedback);render();
    this.cleanup=()=>cleanupFns.splice(0).forEach(f=>f());
  }
}
