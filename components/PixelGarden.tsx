'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorldItem {
  id: number; type: 'plant' | 'deco'; key: string;
  x: number; y: number; stage: number; water: number;
  harvestable: boolean; placedAt: number;
}

interface Animal {
  id: number; name: string; icon: string;
  x: number; y: number; vx: number; vy: number;
  speed: number; hunger: number; happiness: number;
  target: { x: number; y: number } | null; pauseUntil: number;
}

interface GameState {
  coins: number; level: number; exp: number;
  tool: string; selectedItemKey: string | null;
  inventory: Record<string, number>;
  worldItems: WorldItem[];
  animals: Animal[];
  nextId: number; page: string;
}

interface ItemDef {
  name: string; icon: string; type: 'plant' | 'deco';
  price: number; growTime?: number; harvestCoins?: number; exp?: number; unlock: number;
}

interface AnimalDef {
  name: string; icon: string;
  price: number; speed: number; hunger: number; happiness: number; unlock: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TILE = 32;

const ITEMS: Record<string, ItemDef> = {
  sunflower: { name: 'Sunflower', icon: '🌻', type: 'plant', price: 15, growTime: 15000, harvestCoins: 30, exp: 20, unlock: 1 },
  rose:      { name: 'Rose',      icon: '🌹', type: 'plant', price: 20, growTime: 20000, harvestCoins: 40, exp: 25, unlock: 1 },
  tulip:     { name: 'Tulip',     icon: '🌷', type: 'plant', price: 12, growTime: 12000, harvestCoins: 25, exp: 15, unlock: 1 },
  mushroom:  { name: 'Mushroom',  icon: '🍄', type: 'plant', price: 25, growTime: 25000, harvestCoins: 55, exp: 35, unlock: 2 },
  cactus:    { name: 'Cactus',    icon: '🌵', type: 'plant', price: 18, growTime: 30000, harvestCoins: 45, exp: 30, unlock: 2 },
  fourleaf:  { name: '4-Leaf',    icon: '🍀', type: 'plant', price: 50, growTime: 60000, harvestCoins: 150, exp: 80, unlock: 3 },
  rock:      { name: 'Rock',      icon: '🪨', type: 'deco', price: 8,  unlock: 1 },
  fence:     { name: 'Fence',     icon: '🪵', type: 'deco', price: 10, unlock: 1 },
  pond:      { name: 'Pond',      icon: '🫧', type: 'deco', price: 30, unlock: 2 },
  lantern:   { name: 'Lantern',   icon: '🏮', type: 'deco', price: 35, unlock: 2 },
  well:      { name: 'Well',      icon: '🪣', type: 'deco', price: 60, unlock: 3 },
  scarecrow: { name: 'Scarecrow', icon: '🧱', type: 'deco', price: 25, unlock: 1 },
};

const ANIMALS_DEF: Record<string, AnimalDef> = {
  bunny: { name: 'Bunny', icon: '🐰', price: 50,  speed: 0.6, hunger: 30, happiness: 80, unlock: 1 },
  chick: { name: 'Chick', icon: '🐥', price: 40,  speed: 0.8, hunger: 40, happiness: 70, unlock: 1 },
  cat:   { name: 'Cat',   icon: '🐱', price: 80,  speed: 0.4, hunger: 25, happiness: 75, unlock: 2 },
  dog:   { name: 'Dog',   icon: '🐶', price: 90,  speed: 0.7, hunger: 35, happiness: 85, unlock: 2 },
  fox:   { name: 'Fox',   icon: '🦊', price: 120, speed: 0.9, hunger: 30, happiness: 65, unlock: 3 },
  frog:  { name: 'Frog',  icon: '🐸', price: 60,  speed: 0.5, hunger: 20, happiness: 90, unlock: 2 },
};

// ─── Pure helpers (module-level, no state) ────────────────────────────────────
function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ([[0,0,14,10],[12,0,18,12],[28,2,14,10],[-4,4,12,8],[30,5,12,8]] as number[][]).forEach(([ox,oy,w,h]) => {
    ctx.fillRect(Math.round(x+ox*scale), Math.round(y+oy*scale), Math.round(w*scale), Math.round(h*scale));
  });
}

function pixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x*x + y*y <= r*r) ctx.fillRect(Math.round(cx+x), Math.round(cy+y), 1, 1);
}

function getShopEntries(tab: 'plants' | 'deco' | 'animals'): [string, ItemDef | AnimalDef][] {
  if (tab === 'plants') return Object.entries(ITEMS).filter(([,v]) => v.type === 'plant');
  if (tab === 'deco')   return Object.entries(ITEMS).filter(([,v]) => v.type === 'deco');
  return Object.entries(ANIMALS_DEF);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PixelGarden() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLDivElement>(null);
  const worldWrapRef = useRef<HTMLDivElement>(null);
  const animalElsRef = useRef<Record<number, HTMLDivElement>>({});
  const gsRef = useRef<GameState>({
    coins: 100, level: 1, exp: 0, tool: 'select', selectedItemKey: null,
    inventory: {}, worldItems: [], animals: [], nextId: 1, page: 'garden',
  });
  const cursorRef   = useRef({ x: -1, y: -1 });
  const gridRef     = useRef({ cols: 0, rows: 0 });
  const rafRef      = useRef(0);
  const draggingRef = useRef<{ item: WorldItem } | null>(null);

  // Actions populated by useEffect — safe to call from JSX after mount
  const actionsRef = useRef({
    setToolFn:           (_t: string) => {},
    selectInventoryItem: (_k: string) => {},
    buyItemFn:           (_k: string) => {},
    feedAnimal:          (_id: number) => {},
    playAnimal:          (_id: number) => {},
    switchPageFn:        (_p: 'garden' | 'shelter') => {},
    recallAnimals:       () => {},
  });

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [hud, setHud]                     = useState({ coins: 100, level: 1, exp: 0, expNeeded: 100 });
  const [page, setPage]                   = useState<'garden' | 'shelter'>('garden');
  const [tool, setTool]                   = useState('select');
  const [showShop, setShowShop]           = useState(false);
  const [shopTab, setShopTab]             = useState<'plants' | 'deco' | 'animals'>('plants');
  const [showLevelUp, setShowLevelUp]     = useState(false);
  const [levelUpNum, setLevelUpNum]       = useState(2);
  const [inventory, setInventory]         = useState<Record<string, number>>({});
  const [selectedKey, setSelectedKey]     = useState<string | null>(null);
  const [shelterAnimals, setShelterAnimals] = useState<Animal[]>([]);
  const [hasAnimals, setHasAnimals]       = useState(false);

  // ─── Stable helpers (only use refs + stable setters — safe with [] deps) ───
  const gainExpFn = useCallback((amt: number) => {
    const s = gsRef.current;
    s.exp += amt;
    const needed = s.level * 100;
    if (s.exp >= needed) {
      s.exp -= needed;
      s.level++;
      setLevelUpNum(s.level);
      setShowLevelUp(true);
    }
    setHud({ coins: s.coins, level: s.level, exp: s.exp, expNeeded: s.level * 100 });
  }, []);

  const saveGameFn = useCallback(() => {
    try {
      const s = gsRef.current;
      localStorage.setItem('pixelgarden_v2', JSON.stringify({
        coins: s.coins, level: s.level, exp: s.exp,
        inventory: s.inventory,
        worldItems: s.worldItems.map(i => ({ ...i })),
        animals:    s.animals.map(a => ({ ...a, target: null })),
        nextId: s.nextId,
      }));
    } catch { /* ignore */ }
  }, []);

  // ─── Main setup effect (runs once after mount) ─────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const canvas  = canvasRef.current!;
    const ctx     = canvas.getContext('2d')!;
    const overlay = overlayRef.current!;
    const s       = gsRef.current;
    const aEls    = animalElsRef.current;
    const cursor  = cursorRef.current;
    const grid    = gridRef.current;

    // ── Sync helpers ─────────────────────────────────────────────────────────
    function syncHud()      { setHud({ coins: s.coins, level: s.level, exp: s.exp, expNeeded: s.level * 100 }); }
    function syncInventory() { setInventory({ ...s.inventory }); }
    function syncAnimals()  { setShelterAnimals([...s.animals]); setHasAnimals(s.animals.length > 0); }

    // ── Save / Load ──────────────────────────────────────────────────────────
    function loadGame() {
      try {
        const raw = localStorage.getItem('pixelgarden_v2');
        if (!raw) return;
        const save = JSON.parse(raw);
        s.coins     = save.coins     ?? 100;
        s.level     = save.level     ?? 1;
        s.exp       = save.exp       ?? 0;
        s.inventory = save.inventory ?? {};
        s.worldItems = (save.worldItems ?? []).map((i: WorldItem) => ({ ...i }));
        s.animals    = (save.animals   ?? []).map((a: Animal) => ({
          ...a, x: a.x || 200, y: a.y || 400, vx: 0, vy: 0, target: null, pauseUntil: 0,
        }));
        s.nextId = save.nextId ?? 1;
      } catch { /* ignore */ }
    }

    // ── Canvas resize ────────────────────────────────────────────────────────
    function resizeCanvas() {
      const wrap = worldWrapRef.current;
      if (!wrap) return;
      canvas.width  = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      grid.cols = Math.floor(canvas.width  / TILE);
      grid.rows = Math.floor(canvas.height / TILE);
    }

    // ── Float text ───────────────────────────────────────────────────────────
    function floatText(msg: string, x: number, y: number, color: string) {
      const el = document.createElement('div');
      el.className   = 'float-text';
      el.style.left  = x + 'px';
      el.style.top   = y + 'px';
      el.style.color = color;
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }

    // ── Drawing ──────────────────────────────────────────────────────────────
    function drawItem(item: WorldItem) {
      const def = ITEMS[item.key];
      const cx = item.x * TILE + TILE / 2;
      const cy = item.y * TILE + TILE / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(cx - 10, item.y * TILE + TILE - 5, 20, 5);
      ctx.font = `${TILE - 4}px serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      if (def.type === 'plant') {
        const elapsed  = Date.now() - item.placedAt;
        const progress = Math.min(elapsed / (def.growTime ?? 1), 1);
        item.stage = progress;

        let icon: string;
        if (item.water < 30)      { icon = '🌱'; }
        else if (progress < 0.4)  { icon = '🌿'; }
        else {
          icon = def.icon;
          if (progress >= 0.8) { item.harvestable = true; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8; }
        }

        if (item.water > 0) {
          const barW = TILE - 8;
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#000';
          ctx.fillRect(item.x * TILE + 4, item.y * TILE + TILE - 9, barW, 5);
          ctx.fillStyle = '#4ec9f5';
          ctx.fillRect(item.x * TILE + 4, item.y * TILE + TILE - 9, barW * (item.water / 100), 5);
        }

        ctx.font = `${Math.round(TILE * 0.72)}px serif`;
        ctx.fillText(icon!, cx, cy - 2);
        ctx.shadowBlur = 0;

        if (item.harvestable) {
          const t = (Date.now() / 300) % (Math.PI * 2);
          ctx.fillStyle = `rgba(255,220,0,${0.5 + 0.5 * Math.sin(t)})`;
          ctx.font = '10px serif';
          ctx.fillText('✨', cx + 10, item.y * TILE + 4);
        }
      } else {
        ctx.font = `${Math.round(TILE * 0.78)}px serif`;
        ctx.fillText(def.icon, cx, cy);
      }

      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    function drawWorld() {
      const { cols, rows } = grid;
      const W = canvas.width, H = canvas.height;
      const horizonY = Math.floor(rows * 0.28) * TILE;

      const skyColors = ['#5c94fc','#6aa0fc','#78acfd','#86b8fd','#94c4fe'];
      const bandH = Math.ceil(horizonY / skyColors.length);
      skyColors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bandH, W, bandH + 2); });

      drawCloud(ctx, 80,  20, 0.9);
      drawCloud(ctx, 300, 15, 1.1);
      drawCloud(ctx, 560, 25, 0.8);

      ctx.fillStyle = '#fff9a0'; pixelCircle(ctx, W - 60, 30, 18);
      ctx.fillStyle = '#ffd700'; pixelCircle(ctx, W - 60, 30, 14);

      for (let row = Math.floor(horizonY / TILE); row < Math.floor(horizonY / TILE) + 3; row++) {
        for (let col = 0; col < cols; col++) {
          ctx.fillStyle = (col + row) % 2 === 0 ? '#52c41a' : '#5dcf1e';
          ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
        }
      }

      const soilY = horizonY + TILE * 3;
      for (let row = Math.floor(soilY / TILE); row <= rows; row++) {
        for (let col = 0; col < cols; col++) {
          ctx.fillStyle = (col + row) % 2 === 0 ? '#7c4f1e' : '#8a5a22';
          ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
        }
      }

      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
      for (let col = 0; col <= cols; col++) {
        ctx.beginPath(); ctx.moveTo(col * TILE, soilY); ctx.lineTo(col * TILE, H); ctx.stroke();
      }
      for (let row = Math.floor(soilY / TILE); row <= rows; row++) {
        ctx.beginPath(); ctx.moveTo(0, row * TILE); ctx.lineTo(W, row * TILE); ctx.stroke();
      }

      s.worldItems.forEach(item => drawItem(item));

      if (['place','water','harvest','erase'].includes(s.tool) && cursor.x >= 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(cursor.x * TILE, cursor.y * TILE, TILE, TILE);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.strokeRect(cursor.x * TILE + 1, cursor.y * TILE + 1, TILE - 2, TILE - 2);
      }
    }

    // ── Animal overlay ────────────────────────────────────────────────────────
    function syncAnimalEls() {
      s.animals.forEach(a => {
        if (!aEls[a.id]) {
          const el = document.createElement('div');
          el.className   = 'roam-animal';
          el.textContent = a.icon;
          el.dataset.id  = String(a.id);
          el.dataset.tip = `${a.name} — click to pet!`;
          el.addEventListener('click', () => {
            a.happiness = Math.min(a.happiness + 10, 100);
            gainExpFn(3);
            floatText('♡', a.x + 10, a.y - 10, '#ff69b4');
            saveGameFn();
          });
          el.addEventListener('contextmenu', e => {
            e.preventDefault();
            const W = window.innerWidth, H = window.innerHeight;
            a.x = 100 + Math.random() * (W * 0.5);
            a.y = H * 0.5 + Math.random() * (H * 0.3);
            a.target = null; a.pauseUntil = Date.now() + 500;
            floatText('🏡 Recalled!', a.x, a.y, '#52c41a');
          });
          overlay.appendChild(el);
          aEls[a.id] = el;
        }
      });
      Object.keys(aEls).forEach(id => {
        const nid = parseInt(id);
        if (!s.animals.find(a => a.id === nid)) { aEls[nid].remove(); delete aEls[nid]; }
      });
    }

    function updateAnimalEls() {
      s.animals.forEach(a => {
        const el = aEls[a.id];
        if (!el) return;
        el.style.left      = Math.round(a.x) + 'px';
        el.style.top       = Math.round(a.y) + 'px';
        el.style.transform = a.vx < 0 ? 'scaleX(-1)' : 'scaleX(1)';
        el.dataset.tip = a.happiness > 70 ? `${a.name} ♡ Happy!`
                       : a.hunger    > 70 ? `${a.name} 😢 Hungry!`
                       :                    `${a.name} — click to pet!`;
      });
      setHasAnimals(s.animals.length > 0);
    }

    function updateAnimals() {
      const W = window.innerWidth, H = window.innerHeight, PAD = 40;
      s.animals.forEach(a => {
        if (!a.x || a.x <= 0) a.x = PAD + Math.random() * (W - PAD * 2);
        if (!a.y || a.y <= 0) a.y = PAD + Math.random() * (H - PAD * 2);
        if (!a.target || (Math.abs(a.x - a.target.x) < 3 && Math.abs(a.y - a.target.y) < 3)) {
          a.target      = { x: PAD + Math.random() * (W - PAD * 2), y: PAD + Math.random() * (H - PAD * 2) };
          a.pauseUntil  = Date.now() + 600 + Math.random() * 2500;
        }
        if (Date.now() < (a.pauseUntil || 0)) { a.vx = 0; a.vy = 0; return; }
        const dx = a.target.x - a.x, dy = a.target.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 3) { a.vx = (dx / dist) * a.speed; a.vy = (dy / dist) * a.speed; a.x += a.vx; a.y += a.vy; }
        else          { a.vx = 0; a.vy = 0; }
        a.x = Math.max(PAD, Math.min(W - PAD, a.x));
        a.y = Math.max(PAD, Math.min(H - PAD, a.y));
        a.hunger    = Math.min(a.hunger    + 0.002, 100);
        a.happiness = Math.max(a.happiness - 0.001, 0);
        if (a.happiness > 60 && Math.random() < 0.0005) { s.coins += 1; syncHud(); }
      });
      syncAnimalEls();
      updateAnimalEls();
    }

    // ── Canvas events ─────────────────────────────────────────────────────────
    function handleMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      cursor.x = Math.floor((e.clientX - rect.left) / TILE);
      cursor.y = Math.floor((e.clientY - rect.top)  / TILE);
      if (draggingRef.current) {
        draggingRef.current.item.x = cursor.x;
        draggingRef.current.item.y = cursor.y;
      }
    }
    function handleMouseLeave() { cursor.x = -1; }
    function handleMouseDown(e: MouseEvent) {
      if (s.page !== 'garden') return;
      const rect = canvas.getBoundingClientRect();
      const tx = Math.floor((e.clientX - rect.left) / TILE);
      const ty = Math.floor((e.clientY - rect.top)  / TILE);

      if (s.tool === 'select') {
        const item = s.worldItems.find(i => i.x === tx && i.y === ty);
        if (item) { draggingRef.current = { item }; canvas.style.cursor = 'grabbing'; }
        else {
          const mx = e.clientX - rect.left, my = e.clientY - rect.top;
          const a = s.animals.find(a => Math.abs(a.x - mx) < 24 && Math.abs(a.y - my) < 24);
          if (a) { a.happiness = Math.min(a.happiness + 10, 100); gainExpFn(3); floatText('+❤️ +3 EXP', e.clientX, e.clientY, '#ff69b4'); saveGameFn(); }
        }
      } else if (s.tool === 'place') {
        if (!s.selectedItemKey)                  { floatText('SELECT ITEM FIRST →', e.clientX, e.clientY, '#ff8c00'); return; }
        const key = s.selectedItemKey;
        if (!s.inventory[key])                    { floatText('NOT ENOUGH!', e.clientX, e.clientY, '#e74c3c'); return; }
        if (s.worldItems.find(i => i.x === tx && i.y === ty)) { floatText('TILE OCCUPIED!', e.clientX, e.clientY, '#e74c3c'); return; }
        s.inventory[key]--;
        if (s.inventory[key] <= 0) delete s.inventory[key];
        s.worldItems.push({ id: s.nextId++, type: ITEMS[key].type, key, x: tx, y: ty, stage: 0, water: 50, harvestable: false, placedAt: Date.now() });
        floatText('✓ PLACED!', e.clientX, e.clientY, '#52c41a');
        gainExpFn(5); syncInventory(); saveGameFn();
      } else if (s.tool === 'water') {
        const item = s.worldItems.find(i => i.x === tx && i.y === ty);
        if (!item || item.type !== 'plant') { floatText('NO PLANT HERE', e.clientX, e.clientY, '#aaa'); return; }
        item.water = Math.min(item.water + 30, 100);
        floatText('💧 +WATER', e.clientX, e.clientY, '#4ec9f5');
        gainExpFn(3); saveGameFn();
      } else if (s.tool === 'harvest') {
        const item = s.worldItems.find(i => i.x === tx && i.y === ty);
        if (!item || item.type !== 'plant') { floatText('NO PLANT HERE', e.clientX, e.clientY, '#aaa'); return; }
        if (!item.harvestable)              { floatText('NOT READY!', e.clientX, e.clientY, '#ff8c00'); return; }
        const def   = ITEMS[item.key];
        const coins = (def.harvestCoins ?? 0) + s.level * 3;
        s.coins += coins;
        gainExpFn(def.exp ?? 0);
        floatText(`+${coins} 💰`, e.clientX, e.clientY, '#ffd700');
        s.worldItems = s.worldItems.filter(i => i.id !== item.id);
        syncHud(); saveGameFn();
      } else if (s.tool === 'erase') {
        const idx = s.worldItems.findIndex(i => i.x === tx && i.y === ty);
        if (idx === -1) { floatText('NOTHING HERE', e.clientX, e.clientY, '#aaa'); return; }
        s.worldItems.splice(idx, 1);
        floatText('🗑️ REMOVED', e.clientX, e.clientY, '#e74c3c');
        saveGameFn();
      }
    }
    function handleMouseUp() {
      if (draggingRef.current) { draggingRef.current = null; canvas.style.cursor = 'crosshair'; saveGameFn(); }
    }

    canvas.addEventListener('mousemove',  handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mousedown',  handleMouseDown);
    canvas.addEventListener('mouseup',    handleMouseUp);
    window.addEventListener('resize',     resizeCanvas);

    // ── Actions exposed to JSX ────────────────────────────────────────────────
    actionsRef.current = {
      setToolFn: (t: string) => {
        s.tool = t;
        setTool(t);
        if (t !== 'place') { s.selectedItemKey = null; setSelectedKey(null); }
        syncInventory();
      },
      selectInventoryItem: (key: string) => {
        s.selectedItemKey = key;
        setSelectedKey(key);
        s.tool = 'place';
        setTool('place');
      },
      buyItemFn: (key: string) => {
        const def = ITEMS[key] ?? ANIMALS_DEF[key];
        if (!def || s.coins < def.price) return;
        s.coins -= def.price;
        if (ANIMALS_DEF[key]) {
          const adef = ANIMALS_DEF[key];
          s.animals.push({
            id: s.nextId++, name: adef.name, icon: adef.icon,
            x: 80 + Math.random() * (canvas.width - 160),
            y: canvas.height * 0.5 + Math.random() * (canvas.height * 0.4),
            vx: 0, vy: 0, speed: adef.speed, hunger: adef.hunger, happiness: adef.happiness,
            target: null, pauseUntil: 0,
          });
          floatText(`🐾 ${adef.name} ADOPTED!`, 400, 300, '#ff69b4');
          gainExpFn(20); syncAnimals();
        } else {
          s.inventory[key] = (s.inventory[key] || 0) + 1;
          floatText(`+1 ${def.icon} ${def.name}`, 400, 300, '#52c41a');
          gainExpFn(5); syncInventory();
        }
        syncHud(); saveGameFn();
      },
      feedAnimal: (id: number) => {
        const a = s.animals.find(x => x.id === id);
        if (!a) return;
        a.hunger = Math.max(a.hunger - 25, 0);
        gainExpFn(5); syncAnimals(); saveGameFn();
      },
      playAnimal: (id: number) => {
        const a = s.animals.find(x => x.id === id);
        if (!a) return;
        a.happiness = Math.min(a.happiness + 15, 100);
        gainExpFn(8); syncAnimals(); saveGameFn();
      },
      switchPageFn: (p: 'garden' | 'shelter') => {
        s.page = p;
        setPage(p);
        if (p === 'shelter') syncAnimals();
      },
      recallAnimals: () => {
        const W = window.innerWidth, H = window.innerHeight;
        s.animals.forEach(a => {
          a.x = 100 + Math.random() * (W * 0.5);
          a.y = H * 0.5 + Math.random() * (H * 0.3);
          a.target = null; a.pauseUntil = Date.now() + 500;
        });
      },
    };

    // ── Game loop ─────────────────────────────────────────────────────────────
    let lastSave = 0;
    function loop() {
      updateAnimals();
      if (s.page === 'garden') drawWorld();
      const now = Date.now();
      if (now - lastSave > 15000) { saveGameFn(); lastSave = now; }
      rafRef.current = requestAnimationFrame(loop);
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    resizeCanvas();
    loadGame();
    syncHud();
    syncInventory();
    syncAnimals();
    if (Object.keys(s.inventory).length === 0 && s.worldItems.length === 0) {
      s.inventory = { sunflower: 3, rock: 2, tulip: 2 };
      syncInventory();
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('mousemove',  handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mousedown',  handleMouseDown);
      canvas.removeEventListener('mouseup',    handleMouseUp);
      window.removeEventListener('resize',     resizeCanvas);
    };
  }, []); // gainExpFn and saveGameFn are stable (useCallback [])

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Header ── */}
      <div id="header">
        <h1>🌱 PIXEL GARDEN</h1>
        <div className="stat-chip">💰 <span>{hud.coins}</span></div>
        <div className="stat-chip">⭐ LV <span>{hud.level}</span></div>
        <div id="exp-bar-wrap">
          <div id="exp-bar" style={{ width: `${Math.min((hud.exp / hud.expNeeded) * 100, 100)}%` }} />
          <div id="exp-label">{hud.exp} / {hud.expNeeded} EXP</div>
        </div>
        <div className="tab-group">
          <button className={`tab-btn${page === 'garden'  ? ' active' : ''}`} onClick={() => actionsRef.current.switchPageFn('garden')}>🌻 GARDEN</button>
          <button className={`tab-btn${page === 'shelter' ? ' active' : ''}`} onClick={() => actionsRef.current.switchPageFn('shelter')}>🐾 SHELTER</button>
          <button className="tab-btn" onClick={() => setShowShop(true)}>🛒 SHOP</button>
        </div>
      </div>

      {/* ── Main ── */}
      <div id="main">
        {/* World canvas — always mounted so RAF keeps running */}
        <div id="world-wrap" ref={worldWrapRef} style={{ display: page === 'garden' ? '' : 'none' }}>
          <canvas ref={canvasRef} id="world" />
        </div>

        {/* Shelter page */}
        <div id="shelter-page" className={page === 'shelter' ? 'active' : ''}>
          <div className="panel-title" style={{ fontSize: '12px', padding: '0 0 12px 0', color: 'var(--text-gold)' }}>
            🐾 YOUR ANIMALS
          </div>
          <div id="shelter-list">
            {shelterAnimals.length === 0 ? (
              <div style={{ fontSize: '8px', color: '#666', textAlign: 'center', marginTop: '40px' }}>
                NO ANIMALS YET!<br /><br />BUY FROM SHOP 🛒
              </div>
            ) : shelterAnimals.map(a => (
              <div key={a.id} className="animal-row">
                <div className="a-icon">{a.icon}</div>
                <div className="a-info">
                  <div className="a-name">{a.name}</div>
                  <div className="bar-label">😊 Happiness</div>
                  <div className="bar-wrap">
                    <div className="bar-fill" style={{ width: `${a.happiness}%`, background: 'linear-gradient(90deg,#ff69b4,#ff8c00)' }} />
                  </div>
                  <div className="bar-label">🍖 Hunger</div>
                  <div className="bar-wrap">
                    <div className="bar-fill" style={{ width: `${100 - a.hunger}%`, background: 'linear-gradient(90deg,#ffd700,#ff8c00)' }} />
                  </div>
                </div>
                <div className="a-btns">
                  <button className="a-btn" onClick={() => actionsRef.current.feedAnimal(a.id)}>🍖 FEED</button>
                  <button className="a-btn" onClick={() => actionsRef.current.playAnimal(a.id)}>🎾 PLAY</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div id="side-panel" style={{ display: page === 'garden' ? '' : 'none' }}>
          <div className="panel-title">🔧 TOOLS</div>
          <div id="toolbar">
            {([
              ['select',  '👆 SELECT / MOVE'],
              ['place',   '✏️ PLACE ITEM'],
              ['water',   '💧 WATER'],
              ['harvest', '🌾 HARVEST'],
              ['erase',   '🗑️ ERASE'],
            ] as [string, string][]).map(([t, label]) => (
              <button
                key={t}
                id={`tool-${t}`}
                className={`tool-btn${tool === t ? ' active' : ''}`}
                onClick={() => actionsRef.current.setToolFn(t)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="panel-title">📦 INVENTORY</div>
          <div id="item-grid">
            {Object.keys(inventory).length === 0 ? (
              <div style={{ fontSize: '7px', color: '#666', gridColumn: '1 / -1', padding: '8px', textAlign: 'center' }}>
                EMPTY<br /><br />BUY FROM SHOP!
              </div>
            ) : Object.entries(inventory).map(([key, count]) => {
              const def = ITEMS[key];
              if (!def) return null;
              return (
                <div
                  key={key}
                  className={`item-card${selectedKey === key ? ' selected' : ''}`}
                  onClick={() => actionsRef.current.selectInventoryItem(key)}
                >
                  <div className="icon">{def.icon}</div>
                  <div className="name">{def.name}</div>
                  <div style={{ fontSize: '8px', color: '#fff' }}>x{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Shop overlay ── */}
      {showShop && (
        <div id="shop-overlay" className="open">
          <div id="shop-box">
            <div id="shop-header">
              <h2>🛒 SHOP</h2>
              <button className="close-btn" onClick={() => setShowShop(false)}>✕</button>
            </div>
            <div className="shop-tabs">
              {(['plants', 'deco', 'animals'] as const).map(tab => (
                <button
                  key={tab}
                  className={`shop-tab${shopTab === tab ? ' active' : ''}`}
                  onClick={() => setShopTab(tab)}
                >
                  {tab === 'plants' ? '🌱 PLANTS' : tab === 'deco' ? '🪨 DECO' : '🐾 ANIMALS'}
                </button>
              ))}
            </div>
            <div id="shop-items">
              {getShopEntries(shopTab).map(([key, def]) => {
                const locked    = def.unlock > hud.level;
                const canAfford = hud.coins >= def.price;
                return (
                  <div key={key} className="shop-card">
                    <div className="icon">{def.icon}</div>
                    <div className="name">{def.name}{locked ? ' 🔒' : ''}</div>
                    {locked
                      ? <div style={{ fontSize: '6px', color: '#888' }}>Unlock Lv.{def.unlock}</div>
                      : <div className="price">💰 {def.price}</div>
                    }
                    <button
                      className="buy-btn"
                      disabled={locked || !canAfford}
                      onClick={() => actionsRef.current.buyItemFn(key)}
                    >
                      {locked ? 'LOCKED' : canAfford ? 'BUY' : 'BROKE'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Animal overlay (imperatively managed by RAF loop) ── */}
      <div id="animal-overlay" ref={overlayRef} />

      {/* ── Recall button ── */}
      <button
        id="recall-btn"
        className={hasAnimals ? 'visible' : ''}
        onClick={() => actionsRef.current.recallAnimals()}
      >
        🏡 RECALL ANIMALS
      </button>

      {/* ── Level-up modal ── */}
      {showLevelUp && (
        <div id="levelup-modal" className="open">
          <div className="lv-box">
            <div className="lv-title">✨ LEVEL UP! ✨</div>
            <div className="lv-num">{levelUpNum}</div>
            <div style={{ fontSize: '8px', color: '#aaa' }}>NEW ITEMS UNLOCKED!</div>
            <button className="lv-ok" onClick={() => setShowLevelUp(false)}>AWESOME!</button>
          </div>
        </div>
      )}
    </>
  );
}
