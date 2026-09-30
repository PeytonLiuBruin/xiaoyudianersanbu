/** Optional real-input E2E: install Playwright or set PLAYWRIGHT_MODULE to its module. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const browser = process.env.BROWSER_CDP_URL
  ? await chromium.connectOverCDP(process.env.BROWSER_CDP_URL)
  : await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
// A fresh isolated context makes reruns reproducible without changing a real save.
const context = await browser.newContext();
const page = await context.newPage();
const baseUrl = process.env.GAME_URL || 'http://127.0.0.1:5173';
const output = path.resolve(process.env.BROWSER_OUTPUT || '../browser-test');
await mkdir(output, { recursive: true });
const errors = [], badResponses = [], checked = [], voiceResponses = [], apologyTexts = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.url().startsWith(baseUrl) && response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  if (/\/audio\/voice\/.+\.(?:mp3|wav)(?:\?|$)/.test(response.url())) voiceResponses.push(response.url());
});
const action = id => page.locator(`[data-action="${id}"]`).first();
const click = async id => { await action(id).click(); };
const state = () => page.evaluate(() => window.__storyState ?? JSON.parse(localStorage.getItem('xiaoyudianersanbu.save.v1') || 'null'));
const waitState = expression => page.waitForFunction(`(() => {
  const _save = window.__storyState ?? JSON.parse(localStorage.getItem('xiaoyudianersanbu.save.v1') || 'null');
  return ${expression.replaceAll('window.__storyState', '_save')};
})()`, undefined, { timeout: 18000 });
const scene = key => waitState(`window.__storyState?.currentScene === '${key}'`);
const mark = text => { checked.push(text); console.log(text); };
async function drag(from, to) {
  const bounds = await page.locator('canvas').boundingBox();
  assert.ok(bounds, 'the scene canvas is visible');
  const point = ([x, y]) => ({ x: bounds.x + bounds.width * x / 960, y: bounds.y + bounds.height * y / 540 });
  const a = point(from), b = point(to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 14 }); await page.mouse.up();
}
async function reloadAndContinue(key) {
  await page.reload(); await action('start').waitFor(); await click('start'); await scene(key);
  await action('start').waitFor({ state: 'detached' });
  await page.waitForTimeout(350); // Capture the resumed scene after its short fade.
}

try {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(baseUrl); await action('start').waitFor();
  const firstVoice = page.waitForResponse(response => /\/N01\.(?:mp3|wav)(?:\?|$)/.test(response.url()), { timeout: 10000 });
  await click('start'); await scene('Home'); await firstVoice;
  await click('sound');
  await click('ammo-paper');
  for (let miss = 1; miss <= 3; miss++) {
    await drag([330, 335], [425, 400]);
    await page.waitForFunction(() => !document.querySelector('[data-action="ammo-paper"]')?.disabled);
  }
  await waitState("window.__storyState.reactionFlags['home.first_miss'] === 1 && window.__storyState.reactionFlags['home.third_miss'] === 1");
  assert.equal((await state()).completedPuzzles.includes('throw'), false);
  await click('assist'); await action('assist-launch').waitFor();
  await drag([330, 335], [235, 400]);
  await waitState("window.__storyState.completedPuzzles.includes('throw')");
  await click('leave'); await scene('Park');
  mark('Home: three physical misses, aid unlock, a real manual hit, and walking through the opened door.');

  await click('gate'); await click('gate');
  assert.equal((await state()).completedPuzzles.includes('stick'), false);
  for (let i = 0; i < 4; i++) await click('pet');
  for (let i = 0; i < 6; i++) await click('rotate-right');
  assert.equal((await state()).stickAngle, 90);
  await click('gate'); await action('flowers').waitFor(); await click('flowers');
  await reloadAndContinue('Park');
  assert.equal((await state()).voiceMuted, true);
  assert.ok((await state()).inventory.includes('bouquet'));
  await click('album'); await scene('Album');
  mark('Park: a blocked horizontal branch, four pets, continuous rotation to fit, flowers, and reload/mute persistence.');

  await click('take-album'); await action('album-next').waitFor();
  await click('album-next'); await click('album-prev'); await click('close');
  await click('open-album'); await click('close'); await click('route-cards');
  await click('check-route');
  assert.equal((await state()).completedPuzzles.includes('cards'), false);
  const preview = page.locator('.card-preview').first();
  const previewBox = await preview.boundingBox(), mapBox = await action('route-map').boundingBox();
  assert.ok(previewBox && mapBox);
  await page.mouse.move(previewBox.x + previewBox.width / 2, previewBox.y + previewBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2, { steps: 12 });
  await page.mouse.up();
  assert.equal((await state()).cardsPlaced[0], true, 'card drag snaps into the common map');
  await click('card-place-1'); await click('card-place-2');
  for (let i = 0; i < 3; i++) for (let turn = 0; turn <= i; turn++) await click(`card-rotate-${i}`);
  await click('check-route'); await waitState("window.__storyState.completedPuzzles.includes('cards')");
  await page.screenshot({ path: path.join(output, 'route-solved.png') });
  await click('close'); await reloadAndContinue('Album'); await click('to-icecream'); await scene('IceCream');
  mark('Album: accessible immediate album, paging/reopening, card drag/snap, a wrong route, connected solved route, and saved progress.');

  await click('launch-rice');
  await waitState("window.__storyState.reactionFlags['icecream.first_recycle'] === 1");
  assert.equal((await state()).completedPuzzles.includes('machine'), false);
  for (let i = 0; i < 3; i++) await click(`switch-${i}`);
  assert.deepEqual((await state()).switches, ['L', 'R', 'R']);
  await click('launch-rice'); await waitState("window.__storyState.completedPuzzles.includes('machine')");
  await click('pull-lever'); await click('inventory-icecream');
  await click('eat'); assert.equal((await state()).icecreamState, 1);
  await click('eat'); assert.equal((await state()).icecreamState, 2);
  await page.screenshot({ path: path.join(output, 'icecream-empty.png') });
  await click('close'); await reloadAndContinue('IceCream');
  assert.equal((await state()).icecreamState, 2);
  await click('to-return'); await scene('Return'); await click('stay');
  await page.waitForTimeout(1600); assert.equal((await state()).currentScene, 'Return');
  await click('home'); await scene('Ending');
  mark('Ice cream: a real wrong recycle/return, L/R/R rails, lever, two bites to empty, reload, and voluntary staying/returning.');

  await click('sound');
  const apology = [
    ['P04', '亲爱的好老婆，是我不好。你陪我收拾，我还只会吃和玩闹。对不起。'],
    ['P05', '家里收拾干净了，饭也做好了。碗我也会洗的。'],
    ['P06', '我等你。'],
  ];
  const apologyAudio = new Map(apology.map(([id]) => [id, page.waitForResponse(response =>
    new RegExp(`/${id}\\.(?:mp3|wav)(?:\\?|$)`).test(response.url()), { timeout: 18000 })]));
  await click('penguin');
  for (const [id, expected] of apology) {
    await page.waitForFunction(text => document.querySelector('#subtitle')?.textContent?.includes(text), expected);
    await apologyAudio.get(id);
    apologyTexts.push(await page.locator('#subtitle').textContent());
    assert.equal(apologyTexts.at(-1), `企鹅${expected}`);
    console.log(`Ending subtitle: ${apologyTexts.at(-1)}`);
    await page.locator('#subtitle').click();
  }
  await click('sound');
  await click('floor'); await click('table'); await click('vase');
  assert.equal((await state()).bouquetPlaced, true);
  await click('throw'); await drag([394, 354], [299, 419]); await page.waitForTimeout(1400); await click('throw');
  await click('sit'); await waitState('window.__storyState.endingComplete === true');
  await page.locator('#overlay.open').waitFor();
  await page.screenshot({ path: path.join(output, 'ending.png') });
  await click('close'); await reloadAndContinue('Ending');
  assert.equal((await state()).endingComplete, true);
  assert.equal((await state()).icecreamState, 2);
  assert.equal((await state()).voiceMuted, true);
  await page.screenshot({ path: path.join(output, 'ending-resumed.png') });
  mark('Ending: exact three apology subtitles, floor/table, flower placement, optional extra ballistic throw, voluntary meal, and saved ending.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(output, 'portrait.png') });
  assert.equal(await page.locator('canvas').isVisible(), true);
  await click('album'); await action('album-next').waitFor(); await click('close');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(output, 'landscape.png') });
  mark('Mobile: portrait keeps the canvas playable with a turn-phone hint; landscape fits the whole scene.');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  assert.deepEqual(badResponses, [], 'no failed game resource requests');
  const report = { passed: true, checked, errors, badResponses, voiceResponses, apologyTexts, finalSave: await state() };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  const report = { passed: false, checked, errors, badResponses, voiceResponses, apologyTexts, error: String(error), finalSave: await state().catch(() => null) };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report, null, 2)); process.exitCode = 1;
} finally { await browser.close(); }
