import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { DialogueManager } from '../src/systems/DialogueManager.ts';
import type { AudioManager } from '../src/systems/AudioManager.ts';
import type { SaveManager } from '../src/systems/SaveManager.ts';
import { dialogue } from '../src/content/dialogue.ts';

class ElementStub {
  className = '';
  textContent = '';
  children: ElementStub[] = [];
  private classes = new Set<string>();
  classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
    contains: (name: string) => this.classes.has(name),
  };
  replaceChildren(): void { this.children = []; }
  append(...children: ElementStub[]): void { this.children.push(...children); }
  setAttribute(): void {}
  addEventListener(): void {}
}

class NarrationStub {
  played: string[] = [];
  private ended?: () => void;
  get voiceActive(): boolean { return this.ended !== undefined; }
  playVoice(id: string): Promise<void> {
    this.stopVoice();
    this.played.push(id);
    return new Promise(resolve => { this.ended = resolve; });
  }
  finish(): void { const end = this.ended; this.ended = undefined; end?.(); }
  stopVoice(): void { this.finish(); }
}

async function microtasks(): Promise<void> {
  // Flush the nested say()/sequence() continuations without real-time waits.
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

function fixture(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const subtitle = new ElementStub();
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { querySelector: () => subtitle, createElement: () => new ElementStub() },
  });
  const narration = new NarrationStub();
  const save = { data: { reactionFlags: {} }, persist() {} };
  const manager = new DialogueManager(narration as unknown as AudioManager, save as unknown as SaveManager);
  t.after(() => {
    manager.clear();
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  return { manager, narration, subtitle, save };
}

test('restarting immediately clears cooldowns so the opening reaction plays again', async t => {
  const { manager, narration, save } = fixture(t);
  manager.reaction('home.intro', 'N01');
  assert.deepEqual(narration.played, ['N01']);
  manager.resetReactions();
  save.data.reactionFlags = {};
  manager.reaction('home.intro', 'N01');
  assert.deepEqual(narration.played, ['N01', 'N01']);
  manager.clear();
  await microtasks();
});

test('a new line cancels the previous reading hold while retaining the new subtitle', { timeout: 1000 }, async t => {
  const { manager, narration, subtitle } = fixture(t);
  const oldLine = manager.say('N01');
  narration.finish();
  await microtasks();
  assert.equal(subtitle.classList.contains('visible'), true);
  const nextLine = manager.say('N07');
  await oldLine;
  assert.equal(subtitle.children[1]?.textContent, dialogue.N07.text);
  assert.equal(subtitle.classList.contains('visible'), true);
  narration.finish();
  await microtasks();
  t.mock.timers.tick(6500);
  await nextLine;
  assert.equal(subtitle.classList.contains('visible'), false);
});

test('clearing a scene settles an active reading hold and removes its subtitle', { timeout: 1000 }, async t => {
  const { manager, narration, subtitle } = fixture(t);
  const line = manager.say('N01');
  narration.finish();
  await microtasks();
  manager.clear();
  await line;
  assert.equal(subtitle.classList.contains('visible'), false);
  assert.equal(narration.voiceActive, false);
});

test('an unrelated line aborts an apology sequence instead of resuming old narration', { timeout: 1000 }, async t => {
  const { manager, narration, subtitle } = fixture(t);
  const apology = manager.sequence(['P04', 'P05', 'P06']);
  const reaction = manager.say('N07');
  await apology;
  assert.deepEqual(narration.played, ['P04', 'N07']);
  assert.equal(subtitle.children[1]?.textContent, dialogue.N07.text);
  manager.skip();
  await microtasks();
  t.mock.timers.tick(0);
  await reaction;
});

test('skipping a spoken line advances to the next apology line', { timeout: 1000 }, async t => {
  const { manager, narration, subtitle } = fixture(t);
  const apology = manager.sequence(['P04', 'P05', 'P06']);
  for (const expected of ['P05', 'P06']) {
    manager.skip();
    await microtasks();
    t.mock.timers.tick(0);
    await microtasks();
    assert.equal(narration.played.at(-1), expected);
    assert.equal(narration.voiceActive, true);
    assert.equal(subtitle.classList.contains('visible'), true);
  }
  manager.skip();
  await microtasks();
  t.mock.timers.tick(0);
  await apology;
  assert.deepEqual(narration.played, ['P04', 'P05', 'P06']);
  assert.equal(subtitle.classList.contains('visible'), false);
});

test('skipping the reading hold advances the sequence without waiting for its timer', { timeout: 1000 }, async t => {
  const { manager, narration, subtitle } = fixture(t);
  const apology = manager.sequence(['P04', 'P05']);
  narration.finish();
  await microtasks();
  assert.equal(narration.voiceActive, false);
  manager.skip();
  await microtasks();
  assert.deepEqual(narration.played, ['P04', 'P05']);
  assert.equal(subtitle.children[1]?.textContent, dialogue.P05.text);
  assert.equal(subtitle.classList.contains('visible'), true);
  manager.clear();
  await apology;
});

test('skipping a standalone subtitle during its reading hold hides it immediately', { timeout: 1000 }, async t => {
  const { manager, narration, subtitle } = fixture(t);
  const line = manager.say('N01');
  narration.finish();
  await microtasks();
  manager.skip();
  await line;
  assert.equal(subtitle.classList.contains('visible'), false);
});
