import type { AudioManager } from './AudioManager';
import type { SaveManager } from './SaveManager';
import { dialogue, type DialogueId } from '../content/dialogue';

export class DialogueManager {
  private token = 0;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private finishHold?: () => void;
  private skipped = false;
  private cooldowns = new Map<string, number>();
  private node = document.querySelector<HTMLElement>('#subtitle')!;
  constructor(private audio: AudioManager, private save: SaveManager) {
    this.node.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); this.node.setPointerCapture(e.pointerId);
    });
    this.node.addEventListener('pointerup', e => {
      e.preventDefault(); e.stopPropagation();
      if (this.node.hasPointerCapture(e.pointerId)) this.node.releasePointerCapture(e.pointerId);
      this.skip();
    });
    this.node.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
  }
  async say(id: DialogueId): Promise<void> {
    const own = ++this.token;
    this.releaseHold(); this.skipped = false;
    const line = dialogue[id];
    this.node.replaceChildren();
    const name = document.createElement('span'); name.className = 'speaker'; name.textContent = line.speaker;
    const text = document.createElement('span'); text.textContent = line.text;
    this.node.append(name, text); this.node.classList.add('visible');
    this.node.setAttribute('title', '点击跳过这句配音');
    const began = performance.now();
    await this.audio.playVoice(id);
    if (own !== this.token) return;
    // Muted or unavailable voice still leaves enough time to read, without blocking play.
    const readingTime = Math.min(6500, Math.max(2600, line.text.length * 115));
    const tail = this.skipped ? 0 : Math.max(950, readingTime - (performance.now() - began));
    await new Promise<void>(resolve => {
      this.finishHold = resolve;
      this.hideTimer = setTimeout(() => { if (own === this.token) this.node.classList.remove('visible'); this.finishHold = undefined; resolve(); }, tail);
    });
  }
  async sequence(ids: DialogueId[]): Promise<void> {
    const start = this.token;
    for (let i = 0; i < ids.length; i++) {
      if (this.token !== start + i) return;
      await this.say(ids[i]);
    }
  }
  reaction(key: string, id: DialogueId, maxCount = 1, cooldown = 1500): void {
    const count = this.save.data.reactionFlags[key] ?? 0;
    if (count >= maxCount || performance.now() - (this.cooldowns.get(key) ?? -Infinity) < cooldown) return;
    this.save.data.reactionFlags[key] = count + 1; this.save.persist(); this.cooldowns.set(key, performance.now());
    void this.say(id);
  }
  private releaseHold(): void { clearTimeout(this.hideTimer); const finish = this.finishHold; this.finishHold = undefined; finish?.(); }
  resetReactions(): void { this.clear(); this.cooldowns.clear(); }
  skip(): void { this.skipped = true; this.audio.stopVoice(); this.releaseHold(); this.node.classList.remove('visible'); }
  clear(): void { this.token++; this.releaseHold(); this.audio.stopVoice(); this.node.classList.remove('visible'); }
}
