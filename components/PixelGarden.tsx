'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorldItem {
  id: number; type: 'plant' | 'deco'; key: string;
  x: number; y: number; stage: number; water: number;
  harvestable: boolean; placedAt: number; boosted?: boolean;
}

interface Animal {
  id: number; name: string; icon: string;
  x: number; y: number; vx: number; vy: number;
  speed: number; hunger: number; happiness: number;
  target: { x: number; y: number } | null; pauseUntil: number;
}

type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';

interface Quest {
  id: string; description: string; npc: string;
  target: number; progress: number;
  coins: number; exp: number;
  type: string; param?: string; minLevel: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  opacity: number; color: string; size: number; spin: number;
}

// Greenhouse display item (placed decoratively inside the greenhouse window)
interface GhItem { id: number; key: string; x: number; y: number; }

interface GameState {
  coins: number; level: number; exp: number;
  tool: string; selectedItemKey: string | null;
  inventory: Record<string, number>;
  worldItems: WorldItem[];
  animals: Animal[];
  nextId: number; page: string;
  season: SeasonName; seasonStart: number; seasonsSeen: SeasonName[];
  resources: { water: number; compost: number };
  quests: Quest[]; completedQuestIds: string[];
  greenhouse: Record<string, number>;   // stored plant counts
  greenhouseDisplay: GhItem[];          // arranged inside the greenhouse window
  ghNextId: number;
  barnOpen: boolean;
  achievements: string[];
  totalCoinsEarned: number; totalHarvests: number; totalWaters: number;
  totalGreenhouseStored: number; totalAnimalsOwned: number;
  totalPets: number; totalFeeds: number;
}

interface ItemDef {
  name: string; icon: string; type: 'plant' | 'deco';
  price: number; growTime?: number; harvestCoins?: number; exp?: number; unlock: number;
}

interface AnimalDef {
  name: string; icon: string;
  price: number; speed: number; hunger: number; happiness: number; unlock: number;
}

interface QuestDef {
  id: string; description: string; npc: string;
  target: number; coins: number; exp: number;
  type: string; param?: string; minLevel: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TILE = 32;
const SEASON_DURATION = 180000;

const ITEMS: Record<string, ItemDef> = {
  sunflower:      { name: 'Sunflower',      icon: '🌻', type: 'plant', price: 15,  growTime: 15000,  harvestCoins: 30,  exp: 20,  unlock: 1  },
  rose:           { name: 'Rose',           icon: '🌹', type: 'plant', price: 20,  growTime: 20000,  harvestCoins: 40,  exp: 25,  unlock: 1  },
  tulip:          { name: 'Tulip',          icon: '🌷', type: 'plant', price: 12,  growTime: 12000,  harvestCoins: 25,  exp: 15,  unlock: 1  },
  mushroom:       { name: 'Mushroom',       icon: '🍄', type: 'plant', price: 25,  growTime: 25000,  harvestCoins: 55,  exp: 35,  unlock: 2  },
  cactus:         { name: 'Cactus',         icon: '🌵', type: 'plant', price: 18,  growTime: 30000,  harvestCoins: 45,  exp: 30,  unlock: 2  },
  fourleaf:       { name: '4-Leaf Clover',  icon: '🍀', type: 'plant', price: 50,  growTime: 60000,  harvestCoins: 150, exp: 80,  unlock: 3  },
  cherry_blossom: { name: 'Cherry Blossom', icon: '🌸', type: 'plant', price: 65,  growTime: 45000,  harvestCoins: 120, exp: 60,  unlock: 5  },
  bamboo:         { name: 'Bamboo',         icon: '🎋', type: 'plant', price: 70,  growTime: 50000,  harvestCoins: 130, exp: 65,  unlock: 5  },
  lotus:          { name: 'Lotus',          icon: '🪷', type: 'plant', price: 90,  growTime: 70000,  harvestCoins: 200, exp: 100, unlock: 8  },
  corn:           { name: 'Corn',           icon: '🌽', type: 'plant', price: 100, growTime: 80000,  harvestCoins: 250, exp: 120, unlock: 10 },
  grapes:         { name: 'Grapes',         icon: '🍇', type: 'plant', price: 110, growTime: 90000,  harvestCoins: 280, exp: 130, unlock: 10 },
  oak_tree:       { name: 'Oak Tree',       icon: '🌳', type: 'plant', price: 150, growTime: 120000, harvestCoins: 400, exp: 180, unlock: 12 },
  rainbow_flower: { name: 'Rainbow Bloom',  icon: '🌈', type: 'plant', price: 200, growTime: 150000, harvestCoins: 600, exp: 250, unlock: 15 },
  rock:           { name: 'Rock',           icon: '🪨', type: 'deco',  price: 8,   unlock: 1  },
  fence:          { name: 'Fence',          icon: '🪵', type: 'deco',  price: 10,  unlock: 1  },
  scarecrow:      { name: 'Scarecrow',      icon: '🧱', type: 'deco',  price: 25,  unlock: 1  },
  pond:           { name: 'Pond',           icon: '🫧', type: 'deco',  price: 30,  unlock: 2  },
  lantern:        { name: 'Lantern',        icon: '🏮', type: 'deco',  price: 35,  unlock: 2  },
  well:           { name: 'Well',           icon: '🪣', type: 'deco',  price: 60,  unlock: 3  },
  windmill:       { name: 'Windmill',       icon: '💨', type: 'deco',  price: 80,  unlock: 5  },
  fountain:       { name: 'Fountain',       icon: '⛲', type: 'deco',  price: 100, unlock: 7  },
  garden_arch:    { name: 'Garden Arch',    icon: '🎪', type: 'deco',  price: 120, unlock: 10 },
  crystal:        { name: 'Crystal',        icon: '💎', type: 'deco',  price: 200, unlock: 12 },
};

const ANIMALS_DEF: Record<string, AnimalDef> = {
  bunny:     { name: 'Bunny',     icon: '🐰', price: 50,  speed: 0.6, hunger: 30, happiness: 80, unlock: 1  },
  chick:     { name: 'Chick',     icon: '🐥', price: 40,  speed: 0.8, hunger: 40, happiness: 70, unlock: 1  },
  cat:       { name: 'Cat',       icon: '🐱', price: 80,  speed: 0.4, hunger: 25, happiness: 75, unlock: 2  },
  dog:       { name: 'Dog',       icon: '🐶', price: 90,  speed: 0.7, hunger: 35, happiness: 85, unlock: 2  },
  fox:       { name: 'Fox',       icon: '🦊', price: 120, speed: 0.9, hunger: 30, happiness: 65, unlock: 3  },
  frog:      { name: 'Frog',      icon: '🐸', price: 60,  speed: 0.5, hunger: 20, happiness: 90, unlock: 2  },
  deer:      { name: 'Deer',      icon: '🦌', price: 150, speed: 0.7, hunger: 25, happiness: 80, unlock: 5  },
  butterfly: { name: 'Butterfly', icon: '🦋', price: 100, speed: 1.1, hunger: 15, happiness: 95, unlock: 5  },
  owl:       { name: 'Owl',       icon: '🦉', price: 180, speed: 0.3, hunger: 20, happiness: 70, unlock: 7  },
  parrot:    { name: 'Parrot',    icon: '🦜', price: 200, speed: 0.6, hunger: 30, happiness: 85, unlock: 8  },
  penguin:   { name: 'Penguin',   icon: '🐧', price: 250, speed: 0.4, hunger: 35, happiness: 75, unlock: 10 },
  panda:     { name: 'Panda',     icon: '🐼', price: 280, speed: 0.3, hunger: 40, happiness: 80, unlock: 10 },
  hedgehog:  { name: 'Hedgehog',  icon: '🦔', price: 350, speed: 0.4, hunger: 25, happiness: 70, unlock: 12 },
  dragon:    { name: 'Dragon',    icon: '🐲', price: 500, speed: 1.2, hunger: 50, happiness: 90, unlock: 15 },
};

const SEASON_CFG: Record<SeasonName, { growMult: number; harvestMult: number; skyColors: string[]; grassA: string; grassB: string; label: string; icon: string }> = {
  spring: { growMult: 1.3, harvestMult: 1.0, skyColors: ['#7eb8f7','#9dc8ff','#b3d8ff','#c6e4ff'], grassA: '#52c41a', grassB: '#5dcf1e', label: 'Spring', icon: '🌸' },
  summer: { growMult: 0.9, harvestMult: 1.5, skyColors: ['#f0b429','#f7c84a','#fad76a','#fde98a'], grassA: '#5ecf22', grassB: '#6bde28', label: 'Summer', icon: '☀️' },
  autumn: { growMult: 1.0, harvestMult: 1.2, skyColors: ['#d4692a','#e07c3a','#ec9050','#f5a86a'], grassA: '#8a9e3a', grassB: '#9aae42', label: 'Autumn', icon: '🍁' },
  winter: { growMult: 0.6, harvestMult: 0.8, skyColors: ['#8fa8d4','#a5bce0','#bcd0ec','#d0e4f8'], grassA: '#9fc0a0', grassB: '#b0d0b2', label: 'Winter', icon: '❄️' },
};
const SEASON_ORDER: SeasonName[] = ['spring', 'summer', 'autumn', 'winter'];

const QUEST_POOL: QuestDef[] = [
  { id: 'water5',      description: 'Water 5 plants',               npc: 'Gardener Elm',  target: 5,   coins: 50,  exp: 30,  type: 'water',      minLevel: 1 },
  { id: 'water10',     description: 'Water 10 plants',              npc: 'Gardener Elm',  target: 10,  coins: 100, exp: 60,  type: 'water',      minLevel: 3 },
  { id: 'harvest5',    description: 'Harvest 5 plants',             npc: 'Farmer Rose',   target: 5,   coins: 75,  exp: 50,  type: 'harvest',    minLevel: 1 },
  { id: 'harvest10',   description: 'Harvest 10 plants',            npc: 'Farmer Rose',   target: 10,  coins: 130, exp: 85,  type: 'harvest',    minLevel: 3 },
  { id: 'plant_sun3',  description: 'Plant 3 Sunflowers',           npc: 'Gardener Sol',  target: 3,   coins: 60,  exp: 40,  type: 'plant',      param: 'sunflower',      minLevel: 1 },
  { id: 'plant_rose3', description: 'Plant 3 Roses',                npc: 'Florist Lily',  target: 3,   coins: 60,  exp: 40,  type: 'plant',      param: 'rose',           minLevel: 1 },
  { id: 'plant_tulip3',description: 'Plant 3 Tulips',               npc: 'Florist Lily',  target: 3,   coins: 55,  exp: 35,  type: 'plant',      param: 'tulip',          minLevel: 1 },
  { id: 'feed3',       description: 'Feed your animals 3 times',    npc: 'Rancher Buck',  target: 3,   coins: 40,  exp: 25,  type: 'feed',       minLevel: 1 },
  { id: 'pet5',        description: 'Pet your animals 5 times',     npc: 'Rancher Buck',  target: 5,   coins: 45,  exp: 35,  type: 'pet',        minLevel: 1 },
  { id: 'greenhouse3', description: 'Store 3 plants in Greenhouse', npc: 'Botanist Vera', target: 3,   coins: 80,  exp: 50,  type: 'greenhouse', minLevel: 2 },
  { id: 'season1',     description: 'Witness a season change',      npc: 'Elder Sage',    target: 1,   coins: 100, exp: 75,  type: 'season',     minLevel: 1 },
  { id: 'coins500',    description: 'Earn 500 total coins',         npc: 'Merchant Gold', target: 500, coins: 100, exp: 75,  type: 'totalCoins', minLevel: 2 },
  { id: 'mushroom3',   description: 'Plant 3 Mushrooms',            npc: 'Chef Morrel',   target: 3,   coins: 80,  exp: 55,  type: 'plant',      param: 'mushroom',       minLevel: 2 },
  { id: 'cherry2',     description: 'Plant 2 Cherry Blossoms',      npc: 'Botanist Vera', target: 2,   coins: 120, exp: 80,  type: 'plant',      param: 'cherry_blossom', minLevel: 5 },
  { id: 'harvest20',   description: 'Harvest 20 plants',            npc: 'Farmer Rose',   target: 20,  coins: 200, exp: 130, type: 'harvest',    minLevel: 5 },
  { id: 'pet10',       description: 'Pet animals 10 times',         npc: 'Rancher Buck',  target: 10,  coins: 90,  exp: 70,  type: 'pet',        minLevel: 3 },
];

const ACHIEVEMENTS: Record<string, { name: string; icon: string; desc: string }> = {
  first_harvest: { name: 'First Harvest',   icon: '🌾', desc: 'Harvest your first plant'       },
  level5:        { name: 'Green Thumb',      icon: '🌿', desc: 'Reach Level 5'                  },
  level10:       { name: 'Master Gardener',  icon: '🏆', desc: 'Reach Level 10'                 },
  level15:       { name: 'Garden Legend',    icon: '👑', desc: 'Reach Level 15'                 },
  first_animal:  { name: 'Animal Friend',    icon: '🐾', desc: 'Adopt your first animal'        },
  greenhouse5:   { name: 'Conservationist',  icon: '🏡', desc: 'Store 5 plants in Greenhouse'   },
  all_seasons:   { name: 'Seasonal Expert',  icon: '🌍', desc: 'Experience all 4 seasons'       },
  quest10:       { name: 'Quest Master',     icon: '📜', desc: 'Complete 10 quests'             },
  coins1000:     { name: 'Wealthy Gardener', icon: '💰', desc: 'Earn 1000 total coins'          },
};

// ─── Module helpers ───────────────────────────────────────────────────────────
function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ([[0,0,14,10],[12,0,18,12],[28,2,14,10],[-4,4,12,8],[30,5,12,8]] as number[][]).forEach(
    ([ox,oy,w,h]) => ctx.fillRect(Math.round(x+ox*scale), Math.round(y+oy*scale), Math.round(w*scale), Math.round(h*scale))
  );
}

function pixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  for (let py = -r; py <= r; py++)
    for (let px = -r; px <= r; px++)
      if (px*px + py*py <= r*r) ctx.fillRect(Math.round(cx+px), Math.round(cy+py), 1, 1);
}

function getShopEntries(tab: 'plants' | 'deco' | 'animals'): [string, ItemDef | AnimalDef][] {
  if (tab === 'plants') return Object.entries(ITEMS).filter(([,v]) => v.type === 'plant');
  if (tab === 'deco')   return Object.entries(ITEMS).filter(([,v]) => v.type === 'deco');
  return Object.entries(ANIMALS_DEF);
}

function playTone(freq: number, dur: number, type: OscillatorType = 'square') {
  try {
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.frequency.value = freq; osc.type = type;
    g.gain.setValueAtTime(0.07, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.start(); osc.stop(ac.currentTime + dur);
  } catch { /* no audio ctx */ }
}

function playSound(type: 'harvest'|'plant'|'water'|'levelup'|'quest'|'achievement'|'barn') {
  const map: Record<string, [number,number,OscillatorType?][]> = {
    harvest:     [[523,.12],[659,.12]],
    plant:       [[392,.10]],
    water:       [[330,.12,'sine'],[262,.12,'sine']],
    levelup:     [[523,.14],[659,.14],[784,.14],[1047,.24]],
    quest:       [[523,.14],[784,.14],[1047,.2]],
    achievement: [[784,.17],[1047,.17],[1319,.27]],
    barn:        [[294,.14,'triangle'],[220,.19,'triangle']],
  };
  (map[type]??[]).forEach(([f,d,t],i)=>setTimeout(()=>playTone(f,d,t??'square'),i*130));
}

// ─── Greenhouse Window (separate mini-garden) ─────────────────────────────────
const GH_TILE = 44;
const GH_COLS = 10;
const GH_ROWS = 7;
const GH_W = GH_COLS * GH_TILE;
const GH_H = GH_ROWS * GH_TILE;

function GreenhouseWindow({
  open, onClose,
  storedPlants, displayItems,
  onPlace, onRemove,
}: {
  open: boolean;
  onClose: () => void;
  storedPlants: Record<string, number>;
  displayItems: GhItem[];
  onPlace: (key: string, x: number, y: number) => void;
  onRemove: (id: number) => void;
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rafRef       = useRef(0);
  const itemsRef     = useRef(displayItems);
  const [selKey, setSelKey] = useState<string | null>(null);

  itemsRef.current = displayItems;

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function draw() {
      ctx.clearRect(0, 0, GH_W, GH_H);

      // ── Glass / sky background (top 3 rows) ──
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < GH_COLS; col++) {
          ctx.fillStyle = (col + row) % 2 === 0 ? '#caf0ca' : '#d8f8d8';
          ctx.fillRect(col * GH_TILE, row * GH_TILE, GH_TILE, GH_TILE);
        }
      }

      // Glass shine diagonal streaks
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      for (let i = -4; i < GH_COLS + 6; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GH_TILE * 1.4 - GH_H, 0);
        ctx.lineTo(i * GH_TILE * 1.4,         GH_H);
        ctx.stroke();
      }
      ctx.restore();

      // ── Grass strip ──
      for (let col = 0; col < GH_COLS; col++) {
        ctx.fillStyle = col % 2 === 0 ? '#52c41a' : '#5dcf1e';
        ctx.fillRect(col * GH_TILE, 3 * GH_TILE, GH_TILE, Math.round(GH_TILE * 0.35));
      }

      // ── Soil (rows 3-6) ──
      for (let row = 3; row < GH_ROWS; row++) {
        for (let col = 0; col < GH_COLS; col++) {
          ctx.fillStyle = (col + row) % 2 === 0 ? '#7c4f1e' : '#8a5a22';
          ctx.fillRect(col * GH_TILE, row * GH_TILE + Math.round(GH_TILE * 0.35), GH_TILE, GH_TILE);
        }
      }

      // ── Grid ──
      ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1;
      for (let c = 0; c <= GH_COLS; c++) { ctx.beginPath(); ctx.moveTo(c*GH_TILE,0); ctx.lineTo(c*GH_TILE,GH_H); ctx.stroke(); }
      for (let r = 0; r <= GH_ROWS; r++) { ctx.beginPath(); ctx.moveTo(0,r*GH_TILE); ctx.lineTo(GH_W,r*GH_TILE); ctx.stroke(); }

      // ── Greenhouse frame pillars ──
      ctx.fillStyle = '#3a6a3a';
      for (let c = 0; c <= GH_COLS; c += 2) {
        ctx.fillRect(c * GH_TILE - 2, 0, 4, GH_H);
      }

      // ── Placed decorative plants ──
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const t = Date.now() / 1200;
      itemsRef.current.forEach((item, i) => {
        const def = ITEMS[item.key];
        if (!def) return;
        const sway = Math.sin(t + i * 1.3) * 1.5;
        ctx.save();
        ctx.translate(item.x * GH_TILE + GH_TILE/2, item.y * GH_TILE + GH_TILE/2);
        ctx.rotate(sway * Math.PI / 180);
        ctx.shadowColor = '#52c41a'; ctx.shadowBlur = 10;
        ctx.font = `${GH_TILE - 8}px serif`;
        ctx.fillText(def.icon, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();

        // sparkle overlay when harvestable-sized
        const pulse = (Math.sin(t * 2 + i) + 1) / 2;
        ctx.globalAlpha = pulse * 0.6;
        ctx.fillStyle = '#ffd700';
        ctx.font = '9px serif';
        ctx.fillText('✨', item.x*GH_TILE + GH_TILE - 6, item.y*GH_TILE + 6);
        ctx.globalAlpha = 1;
      });
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [open]);

  if (!open) return null;

  const hasStored = Object.values(storedPlants).some(v => v > 0);

  return (
    <div className="gh-win-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gh-win">
        {/* Header */}
        <div className="gh-win-header">
          <span>🏡 GREENHOUSE — Decorative Garden</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Plant palette */}
        <div className="gh-win-palette">
          {!hasStored ? (
            <div className="gh-win-empty-msg">
              Use the <strong>🏡 GREENHOUSE</strong> tool on a ready plant in the main garden to store it here.
            </div>
          ) : (
            <>
              <span className="gh-pal-label">SELECT PLANT:</span>
              {Object.entries(storedPlants).filter(([,v])=>v>0).map(([key,count])=>{
                const def = ITEMS[key]; if (!def) return null;
                return (
                  <div key={key}
                    className={`gh-pal-item${selKey===key?' sel':''}`}
                    onClick={() => setSelKey(selKey===key ? null : key)}
                  >
                    {def.icon} <span>×{count}</span>
                  </div>
                );
              })}
              {selKey && (
                <div className="gh-pal-placing">▶ Placing {ITEMS[selKey]?.icon} {ITEMS[selKey]?.name}</div>
              )}
            </>
          )}
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={GH_W}
          height={GH_H}
          className="gh-canvas"
          style={{ cursor: selKey ? 'crosshair' : 'default' }}
          onClick={e => {
            if (!selKey) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / GH_TILE);
            const y = Math.floor((e.clientY - rect.top)  / GH_TILE);
            onPlace(selKey, x, y);
          }}
          onContextMenu={e => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / GH_TILE);
            const y = Math.floor((e.clientY - rect.top)  / GH_TILE);
            const item = itemsRef.current.find(i => i.x===x && i.y===y);
            if (item) onRemove(item.id);
          }}
        />

        <div className="gh-win-footer">
          Left-click to place · Right-click to remove · Click palette to select plant
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PixelGarden() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLDivElement>(null);
  const worldWrapRef = useRef<HTMLDivElement>(null);
  const animalElsRef = useRef<Record<number, HTMLDivElement>>({});
  const particlesRef = useRef<Particle[]>([]);

  const gsRef = useRef<GameState>({
    coins: 150, level: 1, exp: 0, tool: 'select', selectedItemKey: null,
    inventory: {}, worldItems: [], animals: [], nextId: 1, page: 'garden',
    season: 'spring', seasonStart: Date.now(), seasonsSeen: ['spring'],
    resources: { water: 20, compost: 3 },   // ← 20 water from the start
    quests: [], completedQuestIds: [],
    greenhouse: {}, greenhouseDisplay: [], ghNextId: 1,
    barnOpen: true,
    achievements: [],
    totalCoinsEarned: 0, totalHarvests: 0, totalWaters: 0,
    totalGreenhouseStored: 0, totalAnimalsOwned: 0, totalPets: 0, totalFeeds: 0,
  });

  const cursorRef   = useRef({ x: -1, y: -1 });
  const gridRef     = useRef({ cols: 0, rows: 0 });
  const rafRef      = useRef(0);
  const draggingRef = useRef<{ item: WorldItem } | null>(null);

  const actionsRef = useRef({
    setToolFn:              (_t: string) => {},
    selectInventoryItem:    (_k: string) => {},
    buyItemFn:              (_k: string) => {},
    feedAnimal:             (_id: number) => {},
    playAnimal:             (_id: number) => {},
    switchPageFn:           (_p: string) => {},
    recallAnimals:          () => {},
    storeInGreenhouseFn:    (_id: number) => {},
    toggleBarnFn:           () => {},
    claimQuestFn:           (_id: string) => {},
    waterAllPlantsFn:       () => {},
    boostPlantFn:           (_id: number) => {},
    ghPlaceFn:              (_key: string, _x: number, _y: number) => {},
    ghRemoveFn:             (_id: number) => {},
  });

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [hud, setHud]                   = useState({ coins: 150, level: 1, exp: 0, expNeeded: 100 });
  const [page, setPage]                 = useState('garden');
  const [tool, setTool]                 = useState('select');
  const [showShop, setShowShop]         = useState(false);
  const [shopTab, setShopTab]           = useState<'plants'|'deco'|'animals'>('plants');
  const [showLevelUp, setShowLevelUp]   = useState(false);
  const [levelUpNum, setLevelUpNum]     = useState(2);
  const [inventory, setInventory]       = useState<Record<string, number>>({});
  const [selectedKey, setSelectedKey]   = useState<string | null>(null);
  const [shelterAnimals, setShelterAnimals] = useState<Animal[]>([]);
  const [hasAnimals, setHasAnimals]     = useState(false);
  const [season, setSeason]             = useState<SeasonName>('spring');
  const [resources, setResources]       = useState({ water: 20, compost: 3 });
  const [questsUI, setQuestsUI]         = useState<Quest[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [greenhouse, setGreenhouse]     = useState<Record<string, number>>({});
  const [ghDisplayUI, setGhDisplayUI]   = useState<GhItem[]>([]);
  const [showGreenhouse, setShowGreenhouse] = useState(false);
  const [barnOpen, setBarnOpen]         = useState(true);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  const [questToast, setQuestToast]     = useState<string | null>(null);

  // ─── Stable callbacks ─────────────────────────────────────────────────────────
  const gainExpFn = useCallback((amt: number) => {
    const s = gsRef.current;
    s.exp += amt;
    const needed = s.level * 100;
    if (s.exp >= needed) {
      s.exp -= needed; s.level++;
      setLevelUpNum(s.level); setShowLevelUp(true);
      playSound('levelup');
    }
    setHud({ coins: s.coins, level: s.level, exp: s.exp, expNeeded: s.level * 100 });
  }, []);

  const saveGameFn = useCallback(() => {
    try {
      const s = gsRef.current;
      localStorage.setItem('pixelgarden_v3', JSON.stringify({
        coins: s.coins, level: s.level, exp: s.exp,
        inventory: s.inventory,
        worldItems: s.worldItems.map(i=>({...i})),
        animals:    s.animals.map(a=>({...a, target: null})),
        nextId: s.nextId,
        season: s.season, seasonStart: s.seasonStart, seasonsSeen: s.seasonsSeen,
        resources: s.resources,
        quests: s.quests, completedQuestIds: s.completedQuestIds,
        greenhouse: s.greenhouse,
        greenhouseDisplay: s.greenhouseDisplay, ghNextId: s.ghNextId,
        barnOpen: s.barnOpen,
        achievements: s.achievements,
        totalCoinsEarned: s.totalCoinsEarned, totalHarvests: s.totalHarvests,
        totalWaters: s.totalWaters, totalGreenhouseStored: s.totalGreenhouseStored,
        totalAnimalsOwned: s.totalAnimalsOwned, totalPets: s.totalPets, totalFeeds: s.totalFeeds,
      }));
    } catch { /* ignore */ }
  }, []);

  // ─── Main effect ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const canvas  = canvasRef.current!;
    const ctx     = canvas.getContext('2d')!;
    const overlay = overlayRef.current!;
    const s       = gsRef.current;
    const aEls    = animalElsRef.current;
    const cursor  = cursorRef.current;
    const grid    = gridRef.current;
    const particles = particlesRef.current;

    // ── Sync helpers ──────────────────────────────────────────────────────────
    function syncHud()       { setHud({ coins: s.coins, level: s.level, exp: s.exp, expNeeded: s.level * 100 }); }
    function syncInventory() { setInventory({ ...s.inventory }); }
    function syncAnimals()   { setShelterAnimals([...s.animals]); setHasAnimals(s.animals.length > 0); }
    function syncQuests()    { setQuestsUI(s.quests.map(q=>({...q}))); setCompletedCount(s.completedQuestIds.length); }
    function syncGreenhouse(){ setGreenhouse({ ...s.greenhouse }); setGhDisplayUI([...s.greenhouseDisplay]); }
    function syncResources() { setResources({ ...s.resources }); }
    function syncSeason()    { setSeason(s.season); }
    function syncBarn()      { setBarnOpen(s.barnOpen); }

    // ── Quests ────────────────────────────────────────────────────────────────
    function initQuests() {
      if (s.quests.length >= 3) return;
      const eligible = QUEST_POOL.filter(q =>
        q.minLevel <= s.level &&
        !s.completedQuestIds.includes(q.id) &&
        !s.quests.find(aq => aq.id === q.id)
      );
      while (s.quests.length < 3 && eligible.length > 0) {
        const idx = Math.floor(Math.random() * eligible.length);
        const qd  = eligible.splice(idx, 1)[0];
        s.quests.push({ ...qd, progress: 0 });
      }
      syncQuests();
    }

    function updateQuestProgress(type: string, amount = 1, param?: string) {
      let changed = false;
      s.quests.forEach(q => {
        if (q.type !== type) return;
        if (q.param && q.param !== param) return;
        q.progress = type === 'totalCoins'
          ? Math.min(s.totalCoinsEarned, q.target)
          : Math.min(q.progress + amount, q.target);
        changed = true;
      });
      if (changed) syncQuests();
    }

    // ── Achievements ──────────────────────────────────────────────────────────
    function checkAchievements() {
      const checks: [string, boolean][] = [
        ['first_harvest', s.totalHarvests >= 1],
        ['level5',        s.level >= 5],
        ['level10',       s.level >= 10],
        ['level15',       s.level >= 15],
        ['first_animal',  s.totalAnimalsOwned >= 1],
        ['greenhouse5',   s.totalGreenhouseStored >= 5],
        ['all_seasons',   s.seasonsSeen.length >= 4],
        ['quest10',       s.completedQuestIds.length >= 10],
        ['coins1000',     s.totalCoinsEarned >= 1000],
      ];
      checks.forEach(([id, cond]) => {
        if (cond && !s.achievements.includes(id)) {
          s.achievements.push(id);
          const ach = ACHIEVEMENTS[id];
          setAchievementToast(`${ach.icon} ${ach.name} — ${ach.desc}`);
          playSound('achievement');
          setTimeout(() => setAchievementToast(null), 4000);
        }
      });
    }

    // ── Save / Load ───────────────────────────────────────────────────────────
    function loadGame() {
      try {
        const raw = localStorage.getItem('pixelgarden_v3');
        if (!raw) return;
        const sv = JSON.parse(raw);
        s.coins      = sv.coins     ?? 150;
        s.level      = sv.level     ?? 1;
        s.exp        = sv.exp       ?? 0;
        s.inventory  = sv.inventory ?? {};
        s.worldItems = (sv.worldItems ?? []).map((i: WorldItem) => ({ ...i }));
        s.animals    = (sv.animals   ?? []).map((a: Animal) => ({
          ...a, x: a.x||200, y: a.y||400, vx: 0, vy: 0, target: null, pauseUntil: 0,
        }));
        s.nextId     = sv.nextId    ?? 1;
        s.season     = sv.season    ?? 'spring';
        s.seasonStart= sv.seasonStart ?? Date.now();
        s.seasonsSeen= sv.seasonsSeen ?? ['spring'];
        s.resources  = sv.resources  ?? { water: 20, compost: 3 };
        // Ensure water is at least 20 on first load with this version
        if (s.resources.water < 20 && (sv.resources?.water ?? 0) < 20) s.resources.water = 20;
        s.quests     = sv.quests     ?? [];
        s.completedQuestIds = sv.completedQuestIds ?? [];
        s.greenhouse = sv.greenhouse ?? {};
        s.greenhouseDisplay = sv.greenhouseDisplay ?? [];
        s.ghNextId   = sv.ghNextId   ?? 1;
        s.barnOpen   = sv.barnOpen   ?? true;
        s.achievements = sv.achievements ?? [];
        s.totalCoinsEarned      = sv.totalCoinsEarned      ?? 0;
        s.totalHarvests         = sv.totalHarvests         ?? 0;
        s.totalWaters           = sv.totalWaters           ?? 0;
        s.totalGreenhouseStored = sv.totalGreenhouseStored ?? 0;
        s.totalAnimalsOwned     = sv.totalAnimalsOwned     ?? 0;
        s.totalPets             = sv.totalPets             ?? 0;
        s.totalFeeds            = sv.totalFeeds            ?? 0;
      } catch { /* ignore */ }
    }

    // ── Canvas resize ─────────────────────────────────────────────────────────
    function resizeCanvas() {
      const wrap = worldWrapRef.current;
      if (!wrap) return;
      canvas.width  = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      grid.cols = Math.floor(canvas.width  / TILE);
      grid.rows = Math.floor(canvas.height / TILE);
    }

    // ── Float text ────────────────────────────────────────────────────────────
    function floatText(msg: string, x: number, y: number, color: string) {
      const el = document.createElement('div');
      el.className = 'float-text';
      el.style.cssText = `left:${x}px;top:${y}px;color:${color}`;
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }

    // ── Barn geometry ─────────────────────────────────────────────────────────
    function getBarnRect() {
      const horizonY = Math.floor(grid.rows * 0.28) * TILE;
      return { bx: TILE, by: horizonY, bw: TILE * 5, bh: TILE * 3 };
    }

    // ── Draw: Barn ────────────────────────────────────────────────────────────
    function drawBarn() {
      const { bx, by, bw, bh } = getBarnRect();
      // Body
      ctx.fillStyle = '#8B1A1A';
      ctx.fillRect(bx, by + TILE, bw, bh - TILE);
      ctx.strokeStyle = '#3a0000'; ctx.lineWidth = 2;
      ctx.strokeRect(bx, by + TILE, bw, bh - TILE);

      // Stepped pixel roof
      [[0.5,0,bw-TILE*1,6],[1,6,bw-TILE*2,6],[1.5,12,bw-TILE*3,6],[2,18,bw-TILE*4,5]].forEach(([ox,oy,rw,rh])=>{
        ctx.fillStyle = '#5a0a0a';
        ctx.fillRect(bx+ox*TILE, by+TILE-rh-(oy as number), Math.round(rw as number), rh as number);
      });

      // Windows
      ctx.fillStyle = '#ffe090';
      ctx.fillRect(bx+6, by+TILE+8, 14, 10);
      ctx.fillRect(bx+bw-20, by+TILE+8, 14, 10);

      // Door
      const dw = TILE+12, dh = bh-TILE-18;
      const dx = bx+(bw-dw)/2, dy = by+TILE+18;
      if (s.barnOpen) {
        ctx.fillStyle = '#2a0800';
        ctx.fillRect(dx, dy, dw, dh);
        ctx.fillStyle = '#7a3a0f';
        ctx.fillRect(dx-10, dy, 10, dh);
        ctx.fillRect(dx+dw, dy, 10, dh);
      } else {
        ctx.fillStyle = '#7a3a0f';
        ctx.fillRect(dx, dy, dw, dh);
        ctx.strokeStyle = '#3a1500'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(dx+dw/2, dy); ctx.lineTo(dx+dw/2, dy+dh); ctx.stroke();
        // z z z indicator
        if (s.animals.length > 0) {
          ctx.fillStyle = 'rgba(255,215,0,0.9)'; ctx.font = '7px serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('z z z', bx+bw/2, by+TILE+7);
        }
      }

      // Label
      ctx.fillStyle = '#fff9e0'; ctx.font = '6px "Press Start 2P",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BARN', bx+bw/2, by+TILE+7+(s.barnOpen?0:8));
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }

    // ── Draw: season particles (drawn BEFORE barn/items so barn blocks them) ──
    function updateParticles() {
      const W = canvas.width;
      const { bx, bw } = getBarnRect();

      // Spawn
      if (Math.random() < 0.15) {
        const px = Math.random() * W;
        // Don't spawn directly over barn area (they'll still drift into view)
        if (!(px > bx - 10 && px < bx + bw + 10)) {
          if (s.season === 'spring') {
            particles.push({ x: px, y: -8, vx: (Math.random()-.5)*.6, vy: .6+Math.random()*.8, opacity: .85, color: '#ffb7d5', size: 4, spin: 0 });
          } else if (s.season === 'autumn') {
            particles.push({ x: px, y: -8, vx: (Math.random()-.5)*1.2, vy: .8+Math.random(), opacity: .9, color: Math.random()<.5?'#e07833':'#c0392b', size: 5, spin: (Math.random()-.5)*.1 });
          } else if (s.season === 'winter') {
            particles.push({ x: px, y: -8, vx: (Math.random()-.5)*.4, vy: .5+Math.random()*.6, opacity: .8, color: '#ddeeff', size: 2+Math.round(Math.random()*2), spin: 0 });
          }
        }
      }

      // Update + draw
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x  += p.vx + Math.sin(Date.now()*.002 + i) * .25;
        p.y  += p.vy;
        p.vx += p.spin;
        p.opacity -= .003;
        if (p.opacity <= 0 || p.y > canvas.height) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle   = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    // ── Draw: single world item ───────────────────────────────────────────────
    function drawItem(item: WorldItem) {
      const def = ITEMS[item.key];
      const cx = item.x * TILE + TILE / 2;
      const cy = item.y * TILE + TILE / 2;

      if (item.boosted) { ctx.shadowColor = '#52ff52'; ctx.shadowBlur = 10; }

      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(cx-10, item.y*TILE+TILE-5, 20, 5);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      if (def.type === 'plant') {
        const cfg = SEASON_CFG[s.season];
        const gm  = item.boosted ? cfg.growMult * 2 : cfg.growMult;
        const elapsed  = (Date.now() - item.placedAt) * gm;
        const progress = Math.min(elapsed / (def.growTime ?? 1), 1);
        item.stage = progress;

        let icon: string;
        if (item.water < 30)      icon = '🌱';
        else if (progress < 0.4)  icon = '🌿';
        else {
          icon = def.icon;
          if (progress >= 0.8) { item.harvestable = true; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8; }
        }

        if (item.water > 0) {
          const bw2 = TILE - 8;
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#000'; ctx.fillRect(item.x*TILE+4, item.y*TILE+TILE-9, bw2, 5);
          ctx.fillStyle = '#4ec9f5'; ctx.fillRect(item.x*TILE+4, item.y*TILE+TILE-9, bw2*(item.water/100), 5);
        }

        ctx.font = `${Math.round(TILE*.72)}px serif`;
        ctx.fillText(icon!, cx, cy-2);
        ctx.shadowBlur = 0;

        if (item.harvestable) {
          const t = (Date.now()/300) % (Math.PI*2);
          ctx.fillStyle = `rgba(255,220,0,${.5+.5*Math.sin(t)})`;
          ctx.font = '10px serif';
          ctx.fillText('✨', cx+10, item.y*TILE+4);
        }
      } else {
        ctx.font = `${Math.round(TILE*.78)}px serif`;
        ctx.fillText(def.icon, cx, cy);
      }

      ctx.shadowBlur = 0;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }

    // ── Draw: world ───────────────────────────────────────────────────────────
    function drawWorld() {
      const { cols, rows } = grid;
      const W = canvas.width, H = canvas.height;
      const horizonY = Math.floor(rows * 0.28) * TILE;
      const soilY    = horizonY + TILE * 3;
      const cfg      = SEASON_CFG[s.season];

      // Sky
      const bandH = Math.ceil(horizonY / cfg.skyColors.length);
      cfg.skyColors.forEach((c,i) => { ctx.fillStyle=c; ctx.fillRect(0, i*bandH, W, bandH+2); });

      // Sun / Moon
      if (s.season === 'winter') {
        ctx.fillStyle = '#e8e8f0'; pixelCircle(ctx, W-60, 28, 16);
        ctx.fillStyle = '#8fa8d4'; pixelCircle(ctx, W-56, 24, 10);
      } else {
        ctx.fillStyle = '#fff9a0'; pixelCircle(ctx, W-60, 30, 18);
        ctx.fillStyle = s.season==='summer' ? '#ff9900' : '#ffd700'; pixelCircle(ctx, W-60, 30, 14);
      }

      // Clouds
      ctx.globalAlpha = s.season==='winter' ? .55 : 1;
      drawCloud(ctx, 80, 18, .9); drawCloud(ctx, 310, 12, 1.1); drawCloud(ctx, 570, 22, .8);
      ctx.globalAlpha = 1;

      // Grass
      const { bx:BX, by:BY, bw:BW, bh:BH } = getBarnRect();
      for (let row = Math.floor(horizonY/TILE); row < Math.floor(horizonY/TILE)+3; row++) {
        for (let col = 0; col < cols; col++) {
          const px = col*TILE, py = row*TILE;
          if (px+TILE>BX && px<BX+BW && py+TILE>BY && py<BY+BH) continue;
          ctx.fillStyle = (col+row)%2===0 ? cfg.grassA : cfg.grassB;
          ctx.fillRect(px, py, TILE, TILE);
        }
      }
      if (s.season==='winter') { ctx.fillStyle='rgba(220,235,255,.3)'; ctx.fillRect(0,horizonY,W,TILE*3); }

      // Soil
      for (let row=Math.floor(soilY/TILE); row<=rows; row++) {
        for (let col=0; col<cols; col++) {
          ctx.fillStyle = (col+row)%2===0 ? '#7c4f1e' : '#8a5a22';
          ctx.fillRect(col*TILE, row*TILE, TILE, TILE);
        }
      }
      ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1;
      for (let c=0;c<=cols;c++){ctx.beginPath();ctx.moveTo(c*TILE,soilY);ctx.lineTo(c*TILE,H);ctx.stroke();}
      for (let r=Math.floor(soilY/TILE);r<=rows;r++){ctx.beginPath();ctx.moveTo(0,r*TILE);ctx.lineTo(W,r*TILE);ctx.stroke();}

      // ── PARTICLES drawn BEFORE barn so barn appears in front ──
      updateParticles();

      // ── BARN ──
      drawBarn();

      // ── World items ──
      s.worldItems.forEach(item => drawItem(item));

      // Cursor
      if (['place','water','harvest','erase','greenhouse','boost'].includes(s.tool) && cursor.x>=0) {
        const cols2: Record<string,string> = {
          place:'rgba(255,255,255,.18)', water:'rgba(78,201,245,.25)',
          harvest:'rgba(255,215,0,.25)', erase:'rgba(231,76,60,.25)',
          greenhouse:'rgba(82,196,26,.25)', boost:'rgba(147,112,219,.25)',
        };
        ctx.fillStyle = cols2[s.tool]??'rgba(255,255,255,.18)';
        ctx.fillRect(cursor.x*TILE, cursor.y*TILE, TILE, TILE);
        ctx.strokeStyle='#fff'; ctx.lineWidth=2;
        ctx.strokeRect(cursor.x*TILE+1, cursor.y*TILE+1, TILE-2, TILE-2);
      }
    }

    // ── Animal overlay ────────────────────────────────────────────────────────
    function syncAnimalEls() {
      s.animals.forEach(a => {
        if (!aEls[a.id]) {
          const el = document.createElement('div');
          el.className = 'roam-animal'; el.textContent = a.icon;
          el.dataset.id = String(a.id); el.dataset.tip = `${a.name} — click to pet!`;
          el.addEventListener('click', () => {
            if (!s.barnOpen) return;
            a.happiness = Math.min(a.happiness+10,100); s.totalPets++;
            gainExpFn(3); floatText('♡ +3 EXP', a.x+10, a.y-10, '#ff69b4');
            updateQuestProgress('pet'); checkAchievements(); saveGameFn();
          });
          el.addEventListener('contextmenu', e => {
            e.preventDefault();
            const W2=window.innerWidth, H2=window.innerHeight;
            a.x=100+Math.random()*(W2*.5); a.y=H2*.5+Math.random()*(H2*.3);
            a.target=null; a.pauseUntil=Date.now()+500;
          });
          overlay.appendChild(el); aEls[a.id]=el;
        }
      });
      Object.keys(aEls).forEach(id => {
        const nid=parseInt(id);
        if (!s.animals.find(a=>a.id===nid)) { aEls[nid].remove(); delete aEls[nid]; }
      });
    }

    function updateAnimalEls() {
      s.animals.forEach(a => {
        const el = aEls[a.id]; if (!el) return;
        el.style.left      = Math.round(a.x)+'px';
        el.style.top       = Math.round(a.y)+'px';
        el.style.transform = a.vx<0 ? 'scaleX(-1)' : 'scaleX(1)';
        el.style.opacity   = s.barnOpen ? '1' : '0';
        el.style.pointerEvents = s.barnOpen ? 'all' : 'none';
        el.dataset.tip = a.happiness>70 ? `${a.name} ♡ Happy!`
                       : a.hunger>70    ? `${a.name} 😢 Hungry!`
                       :                  `${a.name} — click to pet!`;
      });
      setHasAnimals(s.animals.length > 0);
    }

    function updateAnimals() {
      const W=window.innerWidth, H=window.innerHeight, PAD=40;
      const { bx, by, bw, bh } = getBarnRect();
      const wrect = worldWrapRef.current?.getBoundingClientRect();
      const barnCX = bx + bw/2 + (wrect?.left??0);
      const barnCY = by + bh/2 + (wrect?.top??0);

      s.animals.forEach(a => {
        if (!a.x||a.x<=0) a.x=PAD+Math.random()*(W-PAD*2);
        if (!a.y||a.y<=0) a.y=PAD+Math.random()*(H-PAD*2);
        if (!s.barnOpen) {
          const dx=barnCX-a.x, dy=barnCY-a.y;
          const dist=Math.sqrt(dx*dx+dy*dy);
          if (dist>5) { a.vx=(dx/dist)*a.speed*1.5; a.vy=(dy/dist)*a.speed*1.5; a.x+=a.vx; a.y+=a.vy; }
          else { a.vx=0; a.vy=0; }
          return;
        }
        if (!a.target||(Math.abs(a.x-a.target.x)<3&&Math.abs(a.y-a.target.y)<3)) {
          a.target={x:PAD+Math.random()*(W-PAD*2), y:PAD+Math.random()*(H-PAD*2)};
          a.pauseUntil=Date.now()+600+Math.random()*2500;
        }
        if (Date.now()<(a.pauseUntil||0)) { a.vx=0; a.vy=0; return; }
        const dx=a.target.x-a.x, dy=a.target.y-a.y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if (dist>3){ a.vx=(dx/dist)*a.speed; a.vy=(dy/dist)*a.speed; a.x+=a.vx; a.y+=a.vy; }
        else { a.vx=0; a.vy=0; }
        a.x=Math.max(PAD,Math.min(W-PAD,a.x)); a.y=Math.max(PAD,Math.min(H-PAD,a.y));
        const wHunger=s.season==='winter'?.003:0;
        a.hunger=Math.min(a.hunger+.002+wHunger,100);
        a.happiness=Math.max(a.happiness-.001,0);
        if (a.happiness>60&&Math.random()<.0005){ s.coins++; s.totalCoinsEarned++; syncHud(); }
      });
      syncAnimalEls(); updateAnimalEls();
    }

    // ── Season tick ───────────────────────────────────────────────────────────
    function updateSeason() {
      if (Date.now() - s.seasonStart >= SEASON_DURATION) {
        const ni = (SEASON_ORDER.indexOf(s.season)+1)%4;
        s.season = SEASON_ORDER[ni]; s.seasonStart = Date.now();
        if (!s.seasonsSeen.includes(s.season)) s.seasonsSeen.push(s.season);
        syncSeason();
        floatText(`${SEASON_CFG[s.season].icon} ${SEASON_CFG[s.season].label}!`, window.innerWidth/2-60, 80, '#ffd700');
        updateQuestProgress('season'); checkAchievements(); initQuests(); saveGameFn();
      }
    }

    // ── Resources regen ───────────────────────────────────────────────────────
    let lastWater=Date.now(), lastCompost=Date.now(), lastPassive=Date.now();
    function updateResources() {
      const now=Date.now();
      if (now-lastWater>30000)  { s.resources.water=Math.min(s.resources.water+1,20); lastWater=now; syncResources(); }
      if (now-lastCompost>60000){ s.resources.compost=Math.min(s.resources.compost+1,10); lastCompost=now; syncResources(); }
      const passInt=Math.max(60000/s.level,5000);
      if (now-lastPassive>passInt){ s.coins++; s.totalCoinsEarned++; lastPassive=now; syncHud(); updateQuestProgress('totalCoins'); }
    }

    // ── Canvas events ─────────────────────────────────────────────────────────
    function handleMouseMove(e: MouseEvent) {
      const rect=canvas.getBoundingClientRect();
      cursor.x=Math.floor((e.clientX-rect.left)/TILE);
      cursor.y=Math.floor((e.clientY-rect.top)/TILE);
      if (draggingRef.current) { draggingRef.current.item.x=cursor.x; draggingRef.current.item.y=cursor.y; }
    }
    function handleMouseLeave() { cursor.x=-1; }

    function handleMouseDown(e: MouseEvent) {
      if (s.page !== 'garden') return;
      const rect=canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      const tx=Math.floor(mx/TILE), ty=Math.floor(my/TILE);

      // Barn click
      const {bx,by,bw,bh}=getBarnRect();
      if (mx>=bx&&mx<=bx+bw&&my>=by&&my<=by+bh) { actionsRef.current.toggleBarnFn(); return; }

      if (s.tool==='select') {
        const item=s.worldItems.find(i=>i.x===tx&&i.y===ty);
        if (item) { draggingRef.current={item}; canvas.style.cursor='grabbing'; }
        else {
          const am=s.animals.find(a=>Math.abs(a.x-e.clientX)<24&&Math.abs(a.y-e.clientY)<24);
          if (am) { am.happiness=Math.min(am.happiness+10,100); s.totalPets++; gainExpFn(3); floatText('+❤️ +3 EXP',e.clientX,e.clientY,'#ff69b4'); updateQuestProgress('pet'); saveGameFn(); }
        }
      } else if (s.tool==='place') {
        if (!s.selectedItemKey) { floatText('SELECT ITEM FIRST →',e.clientX,e.clientY,'#ff8c00'); return; }
        const key=s.selectedItemKey;
        if (!s.inventory[key])  { floatText('NOT ENOUGH!',e.clientX,e.clientY,'#e74c3c'); return; }
        if (s.worldItems.find(i=>i.x===tx&&i.y===ty)) { floatText('TILE OCCUPIED!',e.clientX,e.clientY,'#e74c3c'); return; }
        if (mx>=bx&&mx<=bx+bw&&my>=by&&my<=by+bh) { floatText('BARN AREA!',e.clientX,e.clientY,'#e74c3c'); return; }
        s.inventory[key]--; if (s.inventory[key]<=0) delete s.inventory[key];
        s.worldItems.push({id:s.nextId++,type:ITEMS[key].type,key,x:tx,y:ty,stage:0,water:50,harvestable:false,placedAt:Date.now()});
        playSound('plant'); floatText('✓ PLACED!',e.clientX,e.clientY,'#52c41a');
        gainExpFn(5); syncInventory(); updateQuestProgress('plant',1,key); saveGameFn();
      } else if (s.tool==='water') {
        const item=s.worldItems.find(i=>i.x===tx&&i.y===ty);
        if (!item||item.type!=='plant') { floatText('NO PLANT HERE',e.clientX,e.clientY,'#aaa'); return; }
        item.water=Math.min(item.water+30,100); s.totalWaters++;
        playSound('water'); floatText('💧 +WATER',e.clientX,e.clientY,'#4ec9f5');
        gainExpFn(3); updateQuestProgress('water'); saveGameFn();
      } else if (s.tool==='harvest') {
        const item=s.worldItems.find(i=>i.x===tx&&i.y===ty);
        if (!item||item.type!=='plant') { floatText('NO PLANT HERE',e.clientX,e.clientY,'#aaa'); return; }
        if (!item.harvestable) { floatText('NOT READY!',e.clientX,e.clientY,'#ff8c00'); return; }
        const def=ITEMS[item.key];
        const coins=Math.round(((def.harvestCoins??0)+s.level*3)*SEASON_CFG[s.season].harvestMult);
        s.coins+=coins; s.totalCoinsEarned+=coins; s.totalHarvests++;
        gainExpFn(def.exp??0); playSound('harvest'); floatText(`+${coins} 💰`,e.clientX,e.clientY,'#ffd700');
        s.worldItems=s.worldItems.filter(i=>i.id!==item.id);
        syncHud(); updateQuestProgress('harvest'); updateQuestProgress('totalCoins'); checkAchievements(); saveGameFn();
      } else if (s.tool==='greenhouse') {
        const item=s.worldItems.find(i=>i.x===tx&&i.y===ty);
        if (!item||item.type!=='plant') { floatText('NO PLANT HERE',e.clientX,e.clientY,'#aaa'); return; }
        if (!item.harvestable) { floatText('NOT READY!',e.clientX,e.clientY,'#ff8c00'); return; }
        actionsRef.current.storeInGreenhouseFn(item.id);
      } else if (s.tool==='boost') {
        if (s.resources.compost<1) { floatText('NO COMPOST!',e.clientX,e.clientY,'#9b59b6'); return; }
        const item=s.worldItems.find(i=>i.x===tx&&i.y===ty);
        if (!item||item.type!=='plant') { floatText('NO PLANT HERE',e.clientX,e.clientY,'#aaa'); return; }
        actionsRef.current.boostPlantFn(item.id);
      } else if (s.tool==='erase') {
        const idx=s.worldItems.findIndex(i=>i.x===tx&&i.y===ty);
        if (idx===-1) { floatText('NOTHING HERE',e.clientX,e.clientY,'#aaa'); return; }
        s.worldItems.splice(idx,1); floatText('🗑️ REMOVED',e.clientX,e.clientY,'#e74c3c'); saveGameFn();
      }
    }
    function handleMouseUp() {
      if (draggingRef.current) { draggingRef.current=null; canvas.style.cursor='crosshair'; saveGameFn(); }
    }

    canvas.addEventListener('mousemove',  handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mousedown',  handleMouseDown);
    canvas.addEventListener('mouseup',    handleMouseUp);
    window.addEventListener('resize',     resizeCanvas);

    // ── Actions ───────────────────────────────────────────────────────────────
    actionsRef.current = {
      setToolFn: (t) => { s.tool=t; setTool(t); if (t!=='place'){s.selectedItemKey=null;setSelectedKey(null);} syncInventory(); },
      selectInventoryItem: (key) => { s.selectedItemKey=key; setSelectedKey(key); s.tool='place'; setTool('place'); },
      buyItemFn: (key) => {
        const def=ITEMS[key]??ANIMALS_DEF[key];
        if (!def||s.coins<def.price) return;
        s.coins-=def.price;
        if (ANIMALS_DEF[key]) {
          const adef=ANIMALS_DEF[key];
          s.animals.push({id:s.nextId++,name:adef.name,icon:adef.icon,
            x:80+Math.random()*(canvas.width-160),y:canvas.height*.5+Math.random()*(canvas.height*.4),
            vx:0,vy:0,speed:adef.speed,hunger:adef.hunger,happiness:adef.happiness,target:null,pauseUntil:0});
          s.totalAnimalsOwned++;
          floatText(`🐾 ${adef.name} ADOPTED!`,400,300,'#ff69b4');
          gainExpFn(20); syncAnimals(); checkAchievements();
        } else {
          s.inventory[key]=(s.inventory[key]||0)+1;
          floatText(`+1 ${def.icon} ${def.name}`,400,300,'#52c41a');
          gainExpFn(5); syncInventory();
        }
        syncHud(); saveGameFn();
      },
      feedAnimal: (id) => {
        const a=s.animals.find(x=>x.id===id); if (!a) return;
        a.hunger=Math.max(a.hunger-25,0); s.totalFeeds++;
        gainExpFn(5); syncAnimals(); updateQuestProgress('feed'); saveGameFn();
      },
      playAnimal: (id) => {
        const a=s.animals.find(x=>x.id===id); if (!a) return;
        a.happiness=Math.min(a.happiness+15,100); gainExpFn(8); syncAnimals(); saveGameFn();
      },
      switchPageFn: (p) => {
        s.page=p; setPage(p);
        if (p==='shelter') syncAnimals();
        if (p==='quests')  syncQuests();
      },
      recallAnimals: () => {
        const W2=window.innerWidth, H2=window.innerHeight;
        s.animals.forEach(a=>{a.x=100+Math.random()*(W2*.5);a.y=H2*.5+Math.random()*(H2*.3);a.target=null;a.pauseUntil=Date.now()+500;});
      },
      storeInGreenhouseFn: (itemId) => {
        const idx=s.worldItems.findIndex(i=>i.id===itemId); if (idx===-1) return;
        const item=s.worldItems[idx];
        s.greenhouse[item.key]=(s.greenhouse[item.key]||0)+1;
        s.worldItems.splice(idx,1); s.totalGreenhouseStored++;
        floatText('🏡 STORED IN GREENHOUSE!',canvas.width/2-80,canvas.height/2,'#52c41a');
        gainExpFn(5); syncGreenhouse(); updateQuestProgress('greenhouse'); checkAchievements(); saveGameFn();
      },
      toggleBarnFn: () => {
        s.barnOpen=!s.barnOpen; setBarnOpen(s.barnOpen); playSound('barn');
        floatText(s.barnOpen?'🏠 Barn Open!':'🚪 Barn Closed!',canvas.width/2-60,150,'#ffd700');
        saveGameFn();
      },
      claimQuestFn: (id) => {
        const qi=s.quests.findIndex(q=>q.id===id); if (qi===-1) return;
        const q=s.quests[qi]; if (q.progress<q.target) return;
        s.coins+=q.coins; s.totalCoinsEarned+=q.coins; gainExpFn(q.exp);
        playSound('quest');
        setQuestToast(`✅ ${q.description} — +${q.coins}💰 +${q.exp}EXP`);
        setTimeout(()=>setQuestToast(null),3000);
        s.completedQuestIds.push(q.id); s.quests.splice(qi,1);
        const eligible=QUEST_POOL.filter(q2=>q2.minLevel<=s.level&&!s.completedQuestIds.includes(q2.id)&&!s.quests.find(aq=>aq.id===q2.id));
        if (eligible.length>0) { const nq=eligible[Math.floor(Math.random()*eligible.length)]; s.quests.push({...nq,progress:0}); }
        checkAchievements(); syncHud(); syncQuests(); saveGameFn();
      },
      waterAllPlantsFn: () => {
        if (s.resources.water<5) { floatText('NEED 5 💧!',window.innerWidth/2,window.innerHeight/2,'#4ec9f5'); return; }
        s.resources.water-=5;
        const plants=s.worldItems.filter(i=>i.type==='plant');
        plants.forEach(p=>{p.water=Math.min(p.water+40,100);}); s.totalWaters+=plants.length;
        playSound('water'); floatText(`💧 All ${plants.length} plants watered!`,window.innerWidth/2-80,window.innerHeight/2,'#4ec9f5');
        gainExpFn(plants.length*2); updateQuestProgress('water',plants.length); syncResources(); saveGameFn();
      },
      boostPlantFn: (itemId) => {
        if (s.resources.compost<1) return;
        const item=s.worldItems.find(i=>i.id===itemId); if (!item) return;
        s.resources.compost--; item.boosted=true;
        item.placedAt=Date.now()-(Date.now()-item.placedAt)*2;
        floatText('⚡ BOOSTED!',canvas.width/2,canvas.height/2,'#9b59b6');
        syncResources(); saveGameFn();
      },
      ghPlaceFn: (key, x, y) => {
        if (!s.greenhouse[key]) return;
        if (s.greenhouseDisplay.find(i=>i.x===x&&i.y===y)) return; // tile occupied
        s.greenhouse[key]--; if (s.greenhouse[key]<=0) delete s.greenhouse[key];
        s.greenhouseDisplay.push({id:s.ghNextId++,key,x,y});
        syncGreenhouse(); saveGameFn();
      },
      ghRemoveFn: (id) => {
        const idx=s.greenhouseDisplay.findIndex(i=>i.id===id); if (idx===-1) return;
        const item=s.greenhouseDisplay[idx];
        s.greenhouse[item.key]=(s.greenhouse[item.key]||0)+1;
        s.greenhouseDisplay.splice(idx,1);
        syncGreenhouse(); saveGameFn();
      },
    };

    // ── Game loop ─────────────────────────────────────────────────────────────
    let lastSave=0;
    function loop() {
      updateAnimals(); updateSeason(); updateResources();
      if (s.page==='garden') drawWorld();
      const now=Date.now();
      if (now-lastSave>15000) { saveGameFn(); lastSave=now; }
      rafRef.current=requestAnimationFrame(loop);
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    resizeCanvas(); loadGame();
    syncHud(); syncInventory(); syncAnimals(); syncSeason(); syncResources(); syncGreenhouse(); syncBarn();
    initQuests(); syncQuests();
    if (Object.keys(s.inventory).length===0&&s.worldItems.length===0) {
      s.inventory={sunflower:3,rock:2,tulip:2}; syncInventory();
    }
    rafRef.current=requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('mousemove',  handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mousedown',  handleMouseDown);
      canvas.removeEventListener('mouseup',    handleMouseUp);
      window.removeEventListener('resize',     resizeCanvas);
    };
  }, []);

  const seasonCfg = SEASON_CFG[season];

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Header ── */}
      <div id="header">
        <h1>🌱 PIXEL GARDEN</h1>
        <div className="stat-chip">💰 <span>{hud.coins}</span></div>
        <div className="stat-chip">⭐ LV <span>{hud.level}</span></div>
        <div id="exp-bar-wrap">
          <div id="exp-bar" style={{ width: `${Math.min((hud.exp/hud.expNeeded)*100,100)}%` }} />
          <div id="exp-label">{hud.exp} / {hud.expNeeded} EXP</div>
        </div>
        <div className="season-chip">{seasonCfg.icon} <span>{seasonCfg.label}</span></div>
        <div className="res-chips">
          <div className="res-chip" title="Water — auto-refills, Water All costs 5">💧 {resources.water}</div>
          <div className="res-chip" title="Compost — boost plant with ⚡ tool">🌿 {resources.compost}</div>
        </div>
        <div className="tab-group">
          <button className={`tab-btn${page==='garden'  ?'  active':''}`} onClick={()=>actionsRef.current.switchPageFn('garden')}>🌻 GARDEN</button>
          <button className={`tab-btn${page==='shelter' ?' active':''}`} onClick={()=>actionsRef.current.switchPageFn('shelter')}>🐾 SHELTER</button>
          <button className={`tab-btn${page==='quests'  ?' active':''}`} onClick={()=>actionsRef.current.switchPageFn('quests')}>
            📜 QUESTS{questsUI.some(q=>q.progress>=q.target)&&<span className="quest-dot"/>}
          </button>
          <button className="tab-btn gh-open-btn" onClick={()=>setShowGreenhouse(true)}>🏡 GREENHOUSE</button>
          <button className="tab-btn" onClick={()=>setShowShop(true)}>🛒 SHOP</button>
        </div>
      </div>

      {/* ── Main ── */}
      <div id="main">
        {/* World canvas */}
        <div id="world-wrap" ref={worldWrapRef} style={{ display: page==='garden'?'':'none' }}>
          <canvas ref={canvasRef} id="world" />
        </div>

        {/* Shelter */}
        <div id="shelter-page" className={page==='shelter'?'active':''}>
          <div className="panel-title" style={{fontSize:'12px',padding:'0 0 12px 0',color:'var(--text-gold)'}}>
            🐾 YOUR ANIMALS{!barnOpen&&<span style={{fontSize:'7px',color:'#ffd700',marginLeft:'8px'}}>(In barn 🚪)</span>}
          </div>
          <div id="shelter-list">
            {shelterAnimals.length===0?(
              <div style={{fontSize:'8px',color:'#666',textAlign:'center',marginTop:'40px'}}>NO ANIMALS YET!<br/><br/>BUY FROM SHOP 🛒</div>
            ):shelterAnimals.map(a=>(
              <div key={a.id} className="animal-row">
                <div className="a-icon">{a.icon}</div>
                <div className="a-info">
                  <div className="a-name">{a.name}</div>
                  <div className="bar-label">😊 Happiness</div>
                  <div className="bar-wrap"><div className="bar-fill" style={{width:`${a.happiness}%`,background:'linear-gradient(90deg,#ff69b4,#ff8c00)'}}/></div>
                  <div className="bar-label">🍖 Hunger</div>
                  <div className="bar-wrap"><div className="bar-fill" style={{width:`${100-a.hunger}%`,background:'linear-gradient(90deg,#ffd700,#ff8c00)'}}/></div>
                </div>
                <div className="a-btns">
                  <button className="a-btn" onClick={()=>actionsRef.current.feedAnimal(a.id)}>🍖 FEED</button>
                  <button className="a-btn" onClick={()=>actionsRef.current.playAnimal(a.id)}>🎾 PLAY</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quests */}
        <div id="quests-page" className={page==='quests'?'active':''}>
          <div className="panel-title" style={{fontSize:'10px',padding:'0 0 10px 0',color:'var(--text-gold)'}}>
            📜 ACTIVE QUESTS — {completedCount} completed
          </div>
          <div id="quest-list">
            {questsUI.length===0?(
              <div style={{fontSize:'8px',color:'#666',textAlign:'center',marginTop:'30px'}}>LOADING QUESTS...</div>
            ):questsUI.map(q=>{
              const pct=Math.min((q.progress/q.target)*100,100);
              const done=q.progress>=q.target;
              return (
                <div key={q.id} className={`quest-card${done?' done':''}`}>
                  <div className="quest-npc">📣 {q.npc}</div>
                  <div className="quest-desc">{q.description}</div>
                  <div className="quest-prog-wrap"><div className="quest-prog-bar" style={{width:`${pct}%`}}/></div>
                  <div className="quest-prog-label">{q.progress} / {q.target}</div>
                  <div className="quest-reward">Reward: 💰{q.coins} + ⭐{q.exp} EXP</div>
                  {done&&<button className="quest-claim-btn" onClick={()=>actionsRef.current.claimQuestFn(q.id)}>✅ CLAIM REWARD</button>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div id="side-panel" style={{display:page==='garden'?'':'none'}}>
          <div className="panel-title">🔧 TOOLS</div>
          <div id="toolbar">
            {([
              ['select',     '👆 SELECT / MOVE'],
              ['place',      '✏️ PLACE ITEM'],
              ['water',      '💧 WATER'],
              ['harvest',    '🌾 HARVEST'],
              ['greenhouse', '🏡 STORE PLANT'],
              ['boost',      '⚡ BOOST PLANT'],
              ['erase',      '🗑️ ERASE'],
            ] as [string,string][]).map(([t,label])=>(
              <button key={t}
                className={`tool-btn${tool===t?' active':''}${t==='boost'?' boost-btn':''}`}
                onClick={()=>actionsRef.current.setToolFn(t)}
              >
                {label}
                {t==='water'&&<span className="tool-resource">({resources.water}💧)</span>}
                {t==='boost'&&<span className="tool-resource">({resources.compost}🌿)</span>}
              </button>
            ))}
            <button className="tool-btn water-all-btn" onClick={()=>actionsRef.current.waterAllPlantsFn()}>
              💧 WATER ALL (5💧)
            </button>
          </div>
          <div className="panel-title">📦 INVENTORY</div>
          <div id="item-grid">
            {Object.keys(inventory).length===0?(
              <div style={{fontSize:'7px',color:'#666',gridColumn:'1 / -1',padding:'8px',textAlign:'center'}}>EMPTY — BUY FROM SHOP!</div>
            ):Object.entries(inventory).map(([key,count])=>{
              const def=ITEMS[key]; if (!def) return null;
              return (
                <div key={key} className={`item-card${selectedKey===key?' selected':''}`}
                  onClick={()=>actionsRef.current.selectInventoryItem(key)}>
                  <div className="icon">{def.icon}</div>
                  <div className="name">{def.name}</div>
                  <div style={{fontSize:'8px',color:'#fff'}}>x{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Shop overlay ── */}
      {showShop&&(
        <div id="shop-overlay" className="open">
          <div id="shop-box">
            <div id="shop-header">
              <h2>🛒 SHOP</h2>
              <button className="close-btn" onClick={()=>setShowShop(false)}>✕</button>
            </div>
            <div className="shop-tabs">
              {(['plants','deco','animals'] as const).map(tab=>(
                <button key={tab} className={`shop-tab${shopTab===tab?' active':''}`} onClick={()=>setShopTab(tab)}>
                  {tab==='plants'?'🌱 PLANTS':tab==='deco'?'🪨 DECO':'🐾 ANIMALS'}
                </button>
              ))}
            </div>
            <div id="shop-items">
              {getShopEntries(shopTab).map(([key,def])=>{
                const locked=def.unlock>hud.level, canAfford=hud.coins>=def.price;
                const pdef=shopTab==='plants'?def as ItemDef:null;
                return (
                  <div key={key} className={`shop-card${locked?' locked-card':''}`}>
                    <div className="icon">{def.icon}</div>
                    <div className="name">{def.name}{locked?' 🔒':''}</div>
                    {locked
                      ?<div className="unlock-lv">Lv.{def.unlock} required</div>
                      :<><div className="price">💰 {def.price}</div>{pdef?.growTime&&<div className="shop-detail">⏱{Math.round(pdef.growTime/1000)}s · 💰{pdef.harvestCoins}</div>}</>
                    }
                    <button className="buy-btn" disabled={locked||!canAfford} onClick={()=>actionsRef.current.buyItemFn(key)}>
                      {locked?`LV${def.unlock}`:canAfford?'BUY':'BROKE'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Greenhouse window ── */}
      <GreenhouseWindow
        open={showGreenhouse}
        onClose={()=>setShowGreenhouse(false)}
        storedPlants={greenhouse}
        displayItems={ghDisplayUI}
        onPlace={(key,x,y)=>actionsRef.current.ghPlaceFn(key,x,y)}
        onRemove={(id)=>actionsRef.current.ghRemoveFn(id)}
      />

      {/* ── Animal overlay ── */}
      <div id="animal-overlay" ref={overlayRef} />

      {/* ── Recall + Barn buttons ── */}
      <button id="recall-btn" className={hasAnimals?'visible':''} onClick={()=>actionsRef.current.recallAnimals()}>
        🏡 RECALL ANIMALS
      </button>
      {hasAnimals&&(
        <button id="barn-toggle-btn" className={barnOpen?'':'closed'} onClick={()=>actionsRef.current.toggleBarnFn()}>
          {barnOpen?'🚪 CLOSE BARN':'🏠 OPEN BARN'}
        </button>
      )}

      {/* ── Level up modal ── */}
      {showLevelUp&&(
        <div id="levelup-modal" className="open">
          <div className="lv-box">
            <div className="lv-title">✨ LEVEL UP! ✨</div>
            <div className="lv-num">{levelUpNum}</div>
            <div style={{fontSize:'7px',color:'#aaa',marginBottom:'4px'}}>NEW UNLOCKS:</div>
            <div className="lv-unlocks">
              {Object.entries({...ITEMS,...ANIMALS_DEF}).filter(([,d])=>d.unlock===levelUpNum).map(([,d])=>(
                <div key={d.name} className="lv-unlock-item">{d.icon} {d.name}</div>
              ))}
            </div>
            <button className="lv-ok" onClick={()=>setShowLevelUp(false)}>AWESOME!</button>
          </div>
        </div>
      )}

      {achievementToast&&<div className="achievement-toast">🏆 ACHIEVEMENT UNLOCKED<br/><span>{achievementToast}</span></div>}
      {questToast&&<div className="quest-toast">{questToast}</div>}
    </>
  );
}
