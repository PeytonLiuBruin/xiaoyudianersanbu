export type SceneKey = 'Home' | 'Park' | 'Album' | 'IceCream' | 'Return' | 'Ending';
export interface SaveData {
  version: 1;
  currentScene: SceneKey;
  completedPuzzles: string[];
  inventory: ('bouquet' | 'album' | 'icecream')[];
  icecreamState: 0 | 1 | 2;
  albumUnlocked: boolean;
  voiceMuted: boolean;
  reactionFlags: Record<string, number>;
  stickAngle: number;
  cardRotations: number[];
  cardsPlaced: boolean[];
  switches: ('L' | 'R')[];
  bouquetPlaced: boolean;
  endingComplete: boolean;
  endingApologyRead: boolean;
}
const KEY = 'xiaoyudianersanbu.save.v1';
export function freshSave(muted = false): SaveData {
  return { version: 1, currentScene: 'Home', completedPuzzles: [], inventory: [],
    icecreamState: 0, albumUnlocked: false, voiceMuted: muted, reactionFlags: {},
    stickAngle: 0, cardRotations: [0, 0, 0], cardsPlaced: [false, false, false],
    switches: ['R', 'L', 'L'], bouquetPlaced: false, endingComplete: false, endingApologyRead: false };
}
export class SaveManager {
  data: SaveData;
  storageAvailable = true;
  hasSave = false;
  constructor() {
    this.data = freshSave();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<SaveData>;
      if (s.version !== 1 || !['Home', 'Park', 'Album', 'IceCream', 'Return', 'Ending'].includes(s.currentScene ?? '')) return;
      const all = ['throw', 'stick', 'cards', 'machine'];
      this.data = { ...freshSave(s.voiceMuted === true), ...s,
        completedPuzzles: Array.isArray(s.completedPuzzles) ? s.completedPuzzles.filter(x => all.includes(x)) : [],
        inventory: Array.isArray(s.inventory) ? s.inventory.filter(x => ['bouquet', 'album', 'icecream'].includes(x)) : [],
        reactionFlags: s.reactionFlags && typeof s.reactionFlags === 'object' ? Object.fromEntries(Object.entries(s.reactionFlags).filter(([,v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0).map(([k,v]) => [k,Math.floor(v)])) : {},
        albumUnlocked: s.albumUnlocked === true,
        voiceMuted: s.voiceMuted === true,
        bouquetPlaced: s.bouquetPlaced === true,
        endingComplete: s.endingComplete === true,
        endingApologyRead: s.endingApologyRead === true,
        stickAngle: typeof s.stickAngle === 'number' && Number.isFinite(s.stickAngle) ? ((s.stickAngle + 180) % 360 + 360) % 360 - 180 : 0,
        cardRotations: Array.isArray(s.cardRotations) && s.cardRotations.length === 3 ? s.cardRotations.map(x => ((Number(x) || 0) % 4 + 4) % 4) : [0, 0, 0],
        cardsPlaced: Array.isArray(s.cardsPlaced) && s.cardsPlaced.length === 3 ? s.cardsPlaced.map(x => x === true) : [false, false, false],
        switches: Array.isArray(s.switches) && s.switches.length === 3 ? s.switches.map(x => x === 'L' ? 'L' : 'R') : ['R', 'L', 'L'],
        icecreamState: s.icecreamState === 1 || s.icecreamState === 2 ? s.icecreamState : 0,
      };
      this.hasSave = true;
    } catch { this.storageAvailable = false; }
  }
  persist(): void { try { localStorage.setItem(KEY, JSON.stringify(this.data)); this.hasSave = true; } catch { this.storageAvailable = false; } }
  complete(id: string): void { if (!this.data.completedPuzzles.includes(id)) this.data.completedPuzzles.push(id); this.persist(); }
  has(id: string): boolean { return this.data.completedPuzzles.includes(id); }
  add(item: SaveData['inventory'][number]): void { if (!this.data.inventory.includes(item)) this.data.inventory.push(item); this.persist(); }
  reset(): void { this.data = freshSave(this.data.voiceMuted); this.persist(); }
}
