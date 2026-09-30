import Phaser from 'phaser';
import './style.css';
import { setContext, ctx, assetUrl } from './context';
import { AudioManager } from './systems/AudioManager';
import { DialogueManager } from './systems/DialogueManager';
import { SaveManager, type SceneKey } from './systems/SaveManager';
import { GameUI } from './ui/GameUI';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { HomeScene } from './scenes/HomeScene';
import { ParkScene } from './scenes/ParkScene';
import { AlbumScene } from './scenes/AlbumScene';
import { IceCreamScene } from './scenes/IceCreamScene';
import { ReturnScene } from './scenes/ReturnScene';
import { EndingScene } from './scenes/EndingScene';
import { dialogue as content } from './content/dialogue';
import { UI } from './content/ui';

const save=new SaveManager();
let voiceMap:Record<string,string>={};
try {const r=await fetch(assetUrl('audio/voice/voice-map.json'));if(r.ok)voiceMap=await r.json();}catch{/* subtitles are always available */}
if(!Object.keys(voiceMap).length)Object.keys(content).forEach(id=>voiceMap[id]=`audio/voice/${id}.mp3`);
const audio=new AudioManager(voiceMap,import.meta.env.BASE_URL,save.data.voiceMuted);
const dialogue=new DialogueManager(audio,save);const ui=new GameUI();
const game=new Phaser.Game({
  type:Phaser.AUTO,width:960,height:540,parent:'canvas-host',backgroundColor:'#fff7e3',
  antialias:true,roundPixels:true,transparent:false,
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  input:{activePointers:2,windowEvents:true},
  scene:[BootScene,TitleScene,HomeScene,ParkScene,AlbumScene,IceCreamScene,ReturnScene,EndingScene],
  audio:{noAudio:true},
});
function go(key:SceneKey):void {
  dialogue.clear();ui.close();
  for(const scene of game.scene.getScenes(true))game.scene.stop(scene.scene.key);
  save.data.currentScene=key;save.persist();game.scene.start(key);
  if(!save.storageAvailable)ui.instruction(UI.saveUnavailable);
}
setContext({game,audio,dialogue,save,ui,go});
document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.suspend();game.loop.sleep();}else{audio.resume();game.loop.wake();}});
window.addEventListener('pagehide',()=>save.persist());
window.addEventListener('blur',()=>{for(const s of game.scene.getScenes(true))s.input.emit('gameout');});
// Read-only inspection for local browser verification; never grants puzzle completion.
if(import.meta.env.DEV)Object.defineProperty(window,'__storyState',{get:()=>structuredClone(ctx().save.data)});
