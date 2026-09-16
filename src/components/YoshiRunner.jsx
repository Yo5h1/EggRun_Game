import { useEffect, useRef, useState } from 'react';
import yoshiRunSrc from '../assets/yoshi-run.png';
import yoshiPointSrc from '../assets/yoshi-point.png';
import defaultCoinSrc from '../assets/default-coin.png';
import bunnyMochiSrc from '../assets/bunny-mochi.png';
import bunnyPistachoSrc from '../assets/bunny-pistacho.png';
import mikuSrc from '../assets/miku.png';
import bunnyPointSrc from '../assets/bunny-point.webp';
import mikuPointSrc from '../assets/miku-point.png';
import eggSrc from '../assets/egg.png';
import coinSrc from '../assets/yoshi-point.png';
import { initAudio, isMuted, sfx, startMusic, stopMusic, toggleMute } from '../audio.js';

const W = 900;
const H = 360;
const GROUND_Y = 292;
const HERO_X = 120;
const HERO_H = 62;
const DUCK_H = 40;
const JUMP_V = -13;
const IF_TIME = 70;
const POWER_TIME = 420;
const STEP = 1000 / 60;

const CUSTOM_SKINS_KEY = 'Yoshi-run-custom-skins';
const MAX_CUSTOM_SKINS = 8;
const MAX_CUSTOM_SIZE = 1024 * 1024;
const HERO_MAX_W = 130;

const SKINS = [
  { id: 'Yoshi', name: 'YoZzhi', sprite: yoshiRunSrc, point: yoshiPointSrc },
  { id: 'mochi', name: 'BUNNY MOCHI', sprite: bunnyMochiSrc, point: bunnyPointSrc },
  { id: 'pistacho', name: 'BUNNY PISTACHO', sprite: bunnyPistachoSrc, point: bunnyPointSrc },
  { id: 'miku', name: 'MIKU', sprite: mikuSrc, point: mikuPointSrc },
];

SKINS.forEach((s) => {
  const img = new Image();
  img.src = s.sprite;
  s.img = img;
  const pointImg = new Image();
  pointImg.src = s.point;
  s.pointImg = pointImg;
});

function readCustomSkins() {
  let raw = [];
  try {
    raw = JSON.parse(localStorage.getItem(CUSTOM_SKINS_KEY) || '[]');
  } catch {
    raw = [];
  }
  if (!Array.isArray(raw)) raw = [];
  return raw
    .filter((c) => c && typeof c.id === 'string' && typeof c.sprite === 'string')
    .map((c) => {
      const img = new Image();
      img.src = c.sprite;
      const pointImg = new Image();
      pointImg.src = defaultCoinSrc;
      return { id: c.id, name: c.name || 'PERSONAJE', sprite: c.sprite, point: defaultCoinSrc, img, pointImg };
    });
}

function saveCustomSkins(list) {
  localStorage.setItem(
    CUSTOM_SKINS_KEY,
    JSON.stringify(list.map((s) => ({ id: s.id, name: s.name, sprite: s.sprite }))),
  );
}

function findSkin(id) {
  return [...SKINS, ...readCustomSkins()].find((s) => s.id === id) || null;
}

function skinAspect(img, fallback = 183 / 149) {
  return img.width > 0 && img.height > 0 ? img.width / img.height : fallback;
}

function heroWidth(img) {
  return Math.max(10, Math.min(HERO_MAX_W, skinAspect(img) * HERO_H));
}

function defaultValueSkins() {
  const saved = localStorage.getItem('Yoshi-run-skin');
  return findSkin(saved) ? saved : SKINS[0].id;
}

const PAL_DAY = {
  sky: '#8dd3e4',
  cloud: '#f7ffff',
  hill1: '#78bf70',
  hill2: '#a0d77d',
  spot1: '#e8f1af',
  spot2: '#e8f1af',
  trunk: '#9b6b42',
  tree1: '#4eaa5c',
  tree2: '#58bb64',
  treeDark: '#4eaa5c',
  ground: '#7fbd58',
  groundTop: '#f5e18a',
  dash: '#5b9a4d',
  flowerLeaf: '#f9e16c',
  flower: '#ef7a74',
};

const PAL_SUNSET = {
  sky: '#f6a86b',
  cloud: '#ffe7c4',
  hill1: '#c97b5a',
  hill2: '#e0a06c',
  spot1: '#ffdf9e',
  spot2: '#ffdf9e',
  trunk: '#6f4a38',
  tree1: '#8f6b4a',
  tree2: '#a3794f',
  treeDark: '#8f6b4a',
  ground: '#b0865a',
  groundTop: '#ffd98a',
  dash: '#8a6a46',
  flowerLeaf: '#ffd98a',
  flower: '#ffb34d',
};

const PAL_NIGHT = {
  sky: '#1d2b53',
  cloud: '#31456b',
  hill1: '#26385c',
  hill2: '#31456b',
  spot1: '#4b6b93',
  spot2: '#4b6b93',
  trunk: '#2b1d3a',
  tree1: '#27415f',
  tree2: '#2c4a6e',
  treeDark: '#27415f',
  ground: '#3a2a4a',
  groundTop: '#7a6a4a',
  dash: '#2b1d3a',
  flowerLeaf: '#ffd98a',
  flower: '#ff9dd0',
};

const eggImg = new Image();
const coinImg = new Image();
eggImg.src = eggSrc;
coinImg.src = coinSrc;

function pad(n) {
  return String(n).padStart(4, '0');
}

function parseHex(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function mixColor(a, b, t) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function mixPalette(a, b, t) {
  const out = {};
  for (const key in a) out[key] = mixColor(a[key], b[key], t);
  return out;
}

function currentPalette(score) {
  const LEN = 1500;
  const t = ((score % LEN) / LEN) * 3;
  if (t < 1) return { pal: mixPalette(PAL_DAY, PAL_SUNSET, t), night: 0 };
  if (t < 2) return { pal: mixPalette(PAL_SUNSET, PAL_NIGHT, t - 1), night: t - 1 };
  return { pal: mixPalette(PAL_NIGHT, PAL_DAY, t - 2), night: 1 - (t - 2) };
}

const STARS = [];

for (let i = 0; i < 14; i++) {
  STARS.push({ x: (i * 67 + 31) % 900, y: 12 + ((i * 37) % 90), s: 1 + (i % 3) });
}

function createGame() {
  const initial = defaultValueSkins();
  const skin = findSkin(initial) || SKINS[0];
  return {
    running: false,
    frame: 0,
    score: 0,
    speed: 5,
    spawnTimer: 0,
    nextSpawn: 110,
    obstacles: [],
    coins: [],
    coinTimer: 0,
    nextCoinSpawn: 70,
    powerups: [],
    powerTimer: 0,
    nextPower: 180,
    coinsGot: 0,
    meters: 0,
    streak: 0,
    maxStreak: 0,
    comboTimer: 0,
    iframes: 0,
    ducking: false,
    jumpHeld: false,
    duckHeld: false,
    eff: { shield: 0, magnet: 0, mult: 0 },
    hero: { x: HERO_X, y: GROUND_Y - HERO_H, vy: 0, grounded: true, w: 0, h: 0, jumps: 2 },
    skinImg: skin.img,
    skinPoint: skin.pointImg,
    raf: 0,
  };
}

export default function YoshiRunner() {
  const canvasRef = useRef(null);
  const scoreRef = useRef(null);
  const coinRef = useRef(null);
  const comboRef = useRef(null);
  const bestScoreRef = useRef(null);
  const effectRef = useRef(null);
  const renderRef = useRef(null);
  const statusRef = useRef('idle');
  const actionRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [muted, setMuted] = useState(() => isMuted());
  const [best, setBest] = useState(() => Number(localStorage.getItem('Yoshi-run-best') || 0));
  const [result, setResult] = useState(null);
  const [skinId, setSkinId] = useState(defaultValueSkins);
  const gameRef = useRef(createGame());
  const [customSkins, setCustomSkins] = useState(readCustomSkins);
  const [pendingAdd, setPendingAdd] = useState(null);
  const [customMsg, setCustomMsg] = useState('');
  const [lastAddedId, setLastAddedId] = useState(null);
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const customIdRef = useRef(customSkins.length);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  function toggleSound() {
    setMuted(toggleMute());
  }

  async function onFileChosen(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
      setCustomMsg('Solo se permiten imágenes PNG.');
      return;
    }
    if (file.size > MAX_CUSTOM_SIZE) {
      setCustomMsg('La imagen supera el tamaño máximo de 1 MB.');
      return;
    }
    if (customSkins.length >= MAX_CUSTOM_SKINS) {
      setCustomMsg(`Máximo ${MAX_CUSTOM_SKINS} personajes personalizados.`);
      return;
    }
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (!dataUrl || !dataUrl.startsWith('data:image/png;')) {
      setCustomMsg('El archivo no es un PNG válido.');
      return;
    }
    const defName =
      file.name.replace(/\.png$/i, '').trim().toUpperCase().slice(0, 20) || 'PERSONAJE';
    setPendingAdd({ dataUrl, defName });
    setCustomMsg('');
  }

  function confirmAdd() {
    if (!pendingAdd) return;
    const name =
      (nameInputRef.current?.value || '').trim().toUpperCase().slice(0, 20) || 'PERSONAJE';
    const img = new Image();
    img.src = pendingAdd.dataUrl;
    const pointImg = new Image();
    pointImg.src = defaultCoinSrc;
    const skin = {
      id: `custom-${++customIdRef.current}`,
      name,
      sprite: pendingAdd.dataUrl,
      point: defaultCoinSrc,
      img,
      pointImg,
    };
    const next = [...customSkins, skin];
    try {
      saveCustomSkins(next);
    } catch {
      setCustomMsg('No se pudo guardar: la imagen supera el almacenamiento disponible.');
      setPendingAdd(null);
      return;
    }
    setCustomSkins(next);
    setLastAddedId(skin.id);
    setPendingAdd(null);
    setCustomMsg('');
    selectSkin(skin.id);
  }

  function cancelAdd() {
    setPendingAdd(null);
    setCustomMsg('');
  }

  function removeSkin(id) {
    setCustomSkins((prev) => {
      const remains = prev.filter((s) => s.id !== id);
      try {
        saveCustomSkins(remains);
      } catch {
        // best effort: si no se puede guardar, se mantiene en memoria
      }
      return remains;
    });
    if (lastAddedId === id) setLastAddedId(null);
    if (skinId === id) {
      const first = SKINS[0];
      const state = gameRef.current;
      state.skinImg = first.img;
      state.skinPoint = first.pointImg;
      state.hero.w = heroWidth(first.img);
      state.hero.h = HERO_H;
      localStorage.setItem('Yoshi-run-skin', first.id);
      setSkinId(first.id);
      renderRef.current?.();
    }
    setCustomMsg('');
  }

  function undoLastAdd() {
    if (lastAddedId) removeSkin(lastAddedId);
  }

  function selectSkin(id) {
    const skin = findSkin(id);
    if (!skin || id === skinId) return;
    initAudio();
    const state = gameRef.current;
    state.skinImg = skin.img;
    state.skinPoint = skin.pointImg;
    state.hero.w = heroWidth(skin.img);
    state.hero.h = HERO_H;
    skin.img
      .decode()
      .then(() => {
        const st = gameRef.current;
        if (st.skinImg === skin.img) st.hero.w = heroWidth(skin.img);
        renderRef.current?.();
      })
      .catch(() => {});
    localStorage.setItem('Yoshi-run-skin', id);
    setSkinId(id);
    sfx.power();
    renderRef.current?.();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const state = gameRef.current;
    const bestRef = bestScoreRef.current;
    const scoreRefEl = scoreRef.current;
    const coinRefEl = coinRef.current;
    const comboRefEl = comboRef.current;
    const effectRefEl = effectRef.current;
    const powerTypes = ['shield', 'magnet', 'mult'];
    let lastTs = 0;
    let acc = 0;

    function rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    }

    function circle(x, y, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawBackground() {
      const { pal, night } = currentPalette(state.score);
      rect(0, 0, W, H, pal.sky);
      if (night > 0) {
        STARS.forEach((s, i) => {
          const twinkle = 0.5 + 0.5 * Math.sin(state.frame * 0.06 + i * 1.7);
          ctx.fillStyle = `rgba(255,255,255,${(night * twinkle).toFixed(3)})`;
          ctx.fillRect(s.x, s.y, s.s, s.s);
        });
      }
      for (let x = -40; x < W + 100; x += 230) {
        const shift = (state.frame * 0.25) % 230;
        rect(x - shift, 58, 58, 10, pal.cloud);
        rect(x + 12 - shift, 47, 33, 12, pal.cloud);
        rect(x + 20 - shift, 40, 16, 8, pal.cloud);
      }
      for (let x = -100; x < W + 120; x += 170) {
        const shift = (state.frame * 0.45) % 170;
        ctx.fillStyle = pal.hill1;
        ctx.beginPath();
        ctx.arc(x - shift + 78, 294, 86, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = pal.hill2;
        ctx.beginPath();
        ctx.arc(x - shift + 23, 294, 55, Math.PI, 0);
        ctx.fill();
        rect(x - shift + 50, 235, 13, 13, pal.spot1);
        rect(x - shift + 91, 254, 18, 18, pal.spot2);
      }
      for (let x = -40; x < W + 120; x += 250) {
        const shift = (state.frame * 1.15) % 250;
        rect(x - shift + 31, 235, 10, 58, pal.trunk);
        rect(x - shift + 6, 221, 58, 19, pal.tree1);
        rect(x - shift + 17, 209, 35, 20, pal.tree2);
        rect(x - shift, 229, 22, 13, pal.treeDark);
        rect(x - shift + 49, 229, 22, 13, pal.treeDark);
      }
      rect(0, GROUND_Y, W, H - GROUND_Y, pal.ground);
      rect(0, GROUND_Y, W, 8, pal.groundTop);
      for (let x = -20; x < W + 30; x += 42) {
        const px = x - (state.frame * state.speed) % 42;
        rect(px, 330, 19, 5, pal.dash);
        rect(px + 25, 310, 4, 10, pal.flowerLeaf);
        rect(px + 21, 306, 12, 5, pal.flower);
      }
    }

    function drawAura() {
      const hero = state.hero;
      const cx = hero.x + hero.w / 2;
      const cy = hero.y + hero.h / 2;
      const pulse = 1 + Math.sin(state.frame * 0.15) * 0.1;
      const colors = [];
      if (state.eff.shield > 0) colors.push('rgba(80,190,255,0.5)');
      if (state.eff.magnet > 0) colors.push('rgba(255,110,130,0.5)');
      if (state.eff.mult > 0) colors.push('rgba(255,210,60,0.5)');
      colors.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 46 * pulse + i * 7, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    function drawHero() {
      const hero = state.hero;
      if (!state.skinImg) return;
      if (state.iframes > 0 && Math.floor(state.frame / 6) % 2 === 0) return;
      const ducking = state.ducking && hero.grounded;
      const h = ducking ? DUCK_H : HERO_H;
      const bounce = hero.grounded && !ducking && state.running ? Math.sin(state.frame * 0.4) * 2 : 0;
      const y = ducking ? GROUND_Y - DUCK_H : hero.y + bounce;
      const w = ducking ? hero.w * 1.18 : hero.w;
      ctx.imageSmoothingEnabled = false;
      drawAura();
      ctx.drawImage(
        state.skinImg,
        Math.round(hero.x),
        Math.round(y),
        Math.round(w),
        Math.round(h),
      );
    }

    function drawObstacles() {
      ctx.imageSmoothingEnabled = false;
      state.obstacles.forEach((o) => {
        if (o.kind === 'flyer') {
          const flap = Math.sin(state.frame * 0.45) * 9;
          ctx.fillStyle = '#5b3a2e';
          ctx.fillRect(Math.round(o.x + 8), Math.round(o.y + o.h - 16), o.w - 14, 11);
          ctx.fillStyle = '#7a5647';
          ctx.beginPath();
          ctx.moveTo(o.x + 6, o.y + o.h - 10);
          ctx.lineTo(o.x + o.w * 0.55, o.y - flap);
          ctx.lineTo(o.x + o.w - 8, o.y + o.h - 10);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#f6c244';
          ctx.fillRect(Math.round(o.x + o.w - 6), Math.round(o.y + o.h - 20), 9, 6);
          ctx.fillStyle = '#3a241c';
          ctx.fillRect(Math.round(o.x + 10), Math.round(o.y + o.h - 22), 6, 6);
        } else {
          ctx.drawImage(eggImg, Math.round(o.x), Math.round(o.y), Math.round(o.w), Math.round(o.h));
        }
      });
    }

    function drawCoins() {
      ctx.imageSmoothingEnabled = false;
      const pt = state.skinPoint || coinImg;
      state.coins.forEach((coin) => {
        const size = coin.collected ? Math.max(0, (coin.life / 8) * 28) : 28;
        if (size <= 0) return;
        if (pt.width > 0 && pt.height > 0) {
          const ar = pt.height / pt.width;
          let w = size;
          let h = size * ar;
          if (h > 34) {
            h = 34;
            w = 34 / ar;
          }
          ctx.drawImage(
            pt,
            Math.round(coin.x + (size - w) / 2),
            Math.round(coin.y - h),
            Math.round(w),
            Math.round(h),
          );
        } else {
          ctx.drawImage(coinImg, Math.round(coin.x), Math.round(coin.y - size), Math.round(size), Math.round(size));
        }
      });
    }

    function drawPowerups() {
      ctx.imageSmoothingEnabled = false;
      state.powerups.forEach((p) => {
        const bob = Math.sin(state.frame * 0.09 + p.x) * 2;
        const cx = p.x + 14;
        const cy = p.y + 14 + bob;
        if (p.type === 'shield') {
          circle(cx, cy, 14, '#3aa7f0');
          circle(cx, cy, 10, '#bfe6ff');
          ctx.fillStyle = '#3aa7f0';
          ctx.fillRect(cx - 3, cy - 6, 6, 12);
        } else if (p.type === 'magnet') {
          ctx.fillStyle = '#e23f3f';
          ctx.fillRect(cx - 8, cy - 4, 6, 10);
          ctx.fillRect(cx + 2, cy - 4, 6, 10);
          ctx.beginPath();
          ctx.arc(cx - 1, cy - 4, 4, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillRect(cx - 8, cy + 4, 6, 3);
          ctx.fillRect(cx + 2, cy + 4, 6, 3);
        } else {
          circle(cx, cy, 14, '#ffd23e');
          circle(cx, cy, 10, '#fff4b0');
          ctx.fillStyle = '#b54717';
          ctx.font = 'bold 12px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('×2', cx, cy + 1);
        }
      });
    }

    function render() {
      ctx.imageSmoothingEnabled = false;
      drawBackground();
      drawObstacles();
      drawCoins();
      drawPowerups();
      drawHero();
    }

    function spawnEgg() {
      const scale = 0.85 + Math.random() * 0.35;
      const h = 47 * scale;
      const w = (eggImg.width / eggImg.height) * h;
      state.obstacles.push({ kind: 'egg', x: W + 25, y: GROUND_Y - h, w, h });
    }

    function spawnFlyer() {
      const h = 34;
      const w = 66;
      state.obstacles.push({ kind: 'flyer', x: W + 30, y: GROUND_Y - 44 - h, w, h });
    }

    function hitbox() {
      const hero = state.hero;
      if (state.ducking) {
        return { x: hero.x + 10, y: GROUND_Y - DUCK_H + 6, w: hero.w - 20, h: DUCK_H - 10 };
      }
      return { x: hero.x + 12, y: hero.y + 8, w: hero.w - 26, h: hero.h - 12 };
    }

    function update() {
      const hero = state.hero;
      const eff = state.eff;

      const gravity = (hero.vy < 0 && state.jumpHeld ? 0.3 : 0.68) * (state.ducking ? 1.45 : 1);
      hero.vy += gravity;
      hero.y += hero.vy;
      if (hero.y >= GROUND_Y - HERO_H) {
        hero.y = GROUND_Y - HERO_H;
        hero.vy = 0;
        if (!hero.grounded) {
          hero.grounded = true;
          hero.jumps = 2;
        }
      }

      if (eff.shield > 0) eff.shield--;
      if (eff.magnet > 0) eff.magnet--;
      if (eff.mult > 0) eff.mult--;
      if (state.iframes > 0) state.iframes--;

      state.meters += state.speed * 0.02;
      const mult = eff.mult > 0 ? 2 : 1;
      state.score += 0.1 * mult;
      state.speed = Math.min(11, 5 + Math.floor(state.score / 100) * 0.5);
      scoreRefEl.textContent = pad(Math.floor(state.score));

      state.spawnTimer++;
      if (state.spawnTimer >= state.nextSpawn) {
        if (Math.random() < 0.75) spawnEgg();
        else spawnFlyer();
        state.spawnTimer = 0;
        state.nextSpawn = 62 + Math.random() * 90;
      }
      state.obstacles.forEach((o) => (o.x -= state.speed));
      state.obstacles = state.obstacles.filter((o) => o.x > -70 && !o.dead);

      state.coinTimer++;
      if (state.coinTimer >= state.nextCoinSpawn) {
        const lanes = [18, 46, 76, 104];
        const lane = lanes[Math.floor(Math.random() * lanes.length)];
        const coin = { x: W + 30, y: GROUND_Y - lane, collected: false, life: 0 };
        const clear = !state.obstacles.some((o) => o.x > coin.x - 150 && o.x < coin.x + 60);
        if (clear && state.obstacles.length < 4) {
          state.coins.push(coin);
          state.coinTimer = 0;
          state.nextCoinSpawn = 38 + Math.random() * 70;
        } else {
          state.coinTimer = 0;
          state.nextCoinSpawn = 26;
        }
      }

      state.comboTimer++;
      if (state.comboTimer >= 200) {
        state.comboTimer = 0;
        state.streak = 0;
      }

      state.coins.forEach((coin) => {
        coin.x -= state.speed;
        if (eff.magnet > 0 && !coin.collected) {
          const heroCY = hero.y + hero.h / 2;
          coin.x += (hero.x + 40 - (coin.x + 4)) * 0.08;
          coin.y += (heroCY - coin.y) * 0.08;
        }
        if (coin.collected) coin.life--;
      });
      state.coins = state.coins.filter((coin) => coin.x > -40 && coin.life > -1);

      state.powerTimer++;
      if (state.powerTimer >= state.nextPower) {
        const type = powerTypes[Math.floor(Math.random() * powerTypes.length)];
        const p = { x: W + 30, y: GROUND_Y - 26, type };
        const clear = !state.obstacles.some((o) => o.x > p.x - 160 && o.x < p.x + 80);
        if (clear) {
          state.powerups.push(p);
          state.powerTimer = 0;
          state.nextPower = 260 + Math.random() * 240;
        } else {
          state.powerTimer = 0;
          state.nextPower = 40;
        }
      }
      state.powerups.forEach((p) => (p.x -= state.speed));
      state.powerups = state.powerups.filter((p) => p.x > -50);

      const box = hitbox();
      const hitObstacle = state.obstacles.find(
        (o) =>
          box.x < o.x + o.w - 7 &&
          box.x + box.w > o.x + 7 &&
          box.y < o.y + o.h &&
          box.y + box.h > o.y,
      );
      if (hitObstacle && state.iframes <= 0) {
        if (eff.shield > 0) {
          eff.shield = 0;
          state.iframes = IF_TIME;
          hitObstacle.dead = true;
          state.streak = 0;
          state.comboTimer = 0;
          sfx.power();
        } else {
          endGame();
          return;
        }
      }

      state.coins.forEach((coin) => {
        if (coin.collected) return;
        const cx = coin.x + 4;
        const cy = coin.y + 4;
        if (
          box.x < cx + 20 &&
          box.x + box.w > cx &&
          box.y < cy + 20 &&
          box.y + box.h > cy
        ) {
          coin.collected = true;
          coin.life = 8;
          state.streak++;
          state.maxStreak = Math.max(state.maxStreak, state.streak);
          state.comboTimer = 0;
          state.coinsGot++;
          const value = (10 + Math.min(40, Math.floor((state.streak - 1) / 3) * 10)) * mult;
          state.score += value;
          scoreRefEl.textContent = pad(Math.floor(state.score));
          sfx[state.streak >= 5 ? 'combo' : 'coin']();
        }
      });

      state.powerups.forEach((p) => {
        const cx = p.x + 14;
        const cy = p.y + 14;
        if (
          box.x < cx + 18 &&
          box.x + box.w > cx - 4 &&
          box.y < cy + 18 &&
          box.y + box.h > cy - 4
        ) {
          eff[p.type] = POWER_TIME;
          p.dead = true;
          sfx.power();
        }
      });
      state.powerups = state.powerups.filter((p) => !p.dead);

      coinRefEl.textContent = String(state.coinsGot).padStart(2, '0');
      comboRefEl.textContent = state.streak >= 3 ? `CADENA ${state.streak}` : '';
      comboRefEl.hidden = state.streak < 3;
      const buffs = [];
      if (eff.shield > 0) buffs.push(`ESCUDO ${Math.ceil(eff.shield / 60)}s`);
      if (eff.magnet > 0) buffs.push(`IMÁN ${Math.ceil(eff.magnet / 60)}s`);
      if (eff.mult > 0) buffs.push(`×2 ${Math.ceil(eff.mult / 60)}s`);
      effectRefEl.innerHTML = buffs.join('   ');
      effectRefEl.hidden = buffs.length === 0;
    }

    function loop(now) {
      if (!state.running) return;
      if (!lastTs) lastTs = now;
      acc += now - lastTs;
      lastTs = now;
      if (acc > STEP * 3) acc = STEP * 3;
      while (acc >= STEP) {
        acc -= STEP;
        state.frame++;
        update();
      }
      render();
      state.raf = requestAnimationFrame(loop);
    }

    function startGame() {
      initAudio();
      sfx.start();
      Object.assign(state, {
        running: true,
        score: 0,
        speed: 5,
        frame: 0,
        spawnTimer: 0,
        nextSpawn: 110,
        obstacles: [],
        coins: [],
        coinTimer: 0,
        nextCoinSpawn: 70,
        powerups: [],
        powerTimer: 0,
        nextPower: 180,
        coinsGot: 0,
        meters: 0,
        streak: 0,
        maxStreak: 0,
        comboTimer: 0,
        iframes: 0,
        eff: { shield: 0, magnet: 0, mult: 0 },
      });
      Object.assign(state.hero, {
        y: GROUND_Y - HERO_H,
        vy: 0,
        grounded: true,
        jumps: 2,
        w: heroWidth(state.skinImg),
        h: HERO_H,
      });
      state.ducking = false;
      state.jumpHeld = false;
      state.duckHeld = false;
      effectRefEl.textContent = '';
      effectRefEl.hidden = true;
      comboRefEl.textContent = '';
      comboRefEl.hidden = true;
      coinRefEl.textContent = '00';
      scoreRefEl.textContent = pad(0);
      setStatus('playing');
      startMusic();
      cancelAnimationFrame(state.raf);
      lastTs = 0;
      acc = 0;
      state.raf = requestAnimationFrame(loop);
    }

    function endGame() {
      state.running = false;
      stopMusic();
      const score = Math.floor(state.score);
      const currentBest = Number(localStorage.getItem('Yoshi-run-best') || 0);
      const isRecord = score > currentBest;
      if (isRecord) {
        localStorage.setItem('Yoshi-run-best', score);
        setBest(score);
      }
      bestRef.textContent = pad(Math.max(currentBest, score));
      comboRefEl.hidden = true;
      if (isRecord) sfx.record();
      else sfx.hurt();
      setResult({
        score,
        coins: state.coinsGot,
        meters: Math.floor(state.meters),
        combo: state.maxStreak,
        record: isRecord,
      });
      setStatus('over');
    }

    function resumeGame() {
      state.running = true;
      setStatus('playing');
      startMusic();
      lastTs = 0;
      acc = 0;
      state.raf = requestAnimationFrame(loop);
    }

    function pauseGame() {
      state.running = false;
      cancelAnimationFrame(state.raf);
      stopMusic();
      state.jumpHeld = false;
      state.duckHeld = false;
      state.ducking = false;
      setStatus('paused');
    }

    function togglePause() {
      if (statusRef.current === 'playing') pauseGame();
      else if (statusRef.current === 'paused') resumeGame();
    }

    function jump() {
      if (!state.running) return;
      const hero = state.hero;
      if (hero.jumps > 0) {
        const first = hero.jumps === 2;
        hero.vy = JUMP_V;
        hero.grounded = false;
        hero.jumps--;
        state.ducking = false;
        state.duckHeld = false;
        sfx[first ? 'jump' : 'doubleJump']();
      }
    }

    function setDuck(on) {
      if (on && !state.running) return;
      state.duckHeld = on;
      state.ducking = on;
      if (on && state.running && state.hero.grounded) sfx.duck();
    }

    function handleAction() {
      const s = statusRef.current;
      if (s === 'paused') {
        resumeGame();
        return;
      }
      if (!state.running) {
        if (s === 'idle' || s === 'over') startGame();
      } else {
        jump();
      }
    }

    const onKeyDown = (event) => {
      if (event.target instanceof HTMLButtonElement) return;
      if (event.target instanceof HTMLInputElement) return;
      const code = event.code;
      if (code === 'Space' || code === 'ArrowUp') {
        event.preventDefault();
        if (!event.repeat) handleAction();
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        event.preventDefault();
        setDuck(true);
      } else if (code === 'KeyP' || code === 'Escape') {
        event.preventDefault();
        togglePause();
      } else if (code === 'KeyM') {
        event.preventDefault();
        toggleSound();
      }
    };

    const onKeyUp = (event) => {
      if (event.code === 'ArrowDown' || event.code === 'KeyS') setDuck(false);
      if (event.code === 'Space' || event.code === 'ArrowUp') state.jumpHeld = false;
    };

    const onPointerDown = () => {
      state.jumpHeld = true;
      handleAction();
    };

    const onPointerUp = () => {
      state.jumpHeld = false;
    };

    const onBlur = () => {
      if (statusRef.current === 'playing') pauseGame();
    };

    const onVisibility = () => {
      if (document.hidden && statusRef.current === 'playing') pauseGame();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    actionRef.current = handleAction;
    renderRef.current = render;

    Promise.all(
      [
        ...SKINS.flatMap((s) => [s.img, s.pointImg]),
        ...readCustomSkins().flatMap((s) => [s.img, s.pointImg]),
        eggImg,
        coinImg,
      ].map((img) => img.decode().catch(() => {})),
    ).then(() => {
      if (!state.skinImg) state.skinImg = SKINS[0].img;
      state.hero.w = heroWidth(state.skinImg);
      state.hero.h = HERO_H;
      if (!state.raf) render();
    });

    return () => {
      cancelAnimationFrame(state.raf);
      stopMusic();
      actionRef.current = null;
      renderRef.current = null;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const overlayVisible = status === 'idle' || status === 'over' || status === 'paused';
  const allSkins = [...SKINS, ...customSkins];

  return (
    <section className="game-card" aria-labelledby="game-title">
      <div className="game-header">
        <div>
          <p className="eyebrow">MINI JUEGO</p>
          <h1 id="game-title">Egg Run</h1>
        </div>
        <p className="instructions">
          ESPACIO/↑/TOCAR SALTAR (×2 EN EL AIRE) · ↓ AGACHARSE · P PAUSA · M SONIDO
        </p>
      </div>

      <div className="game-shell">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          aria-label="Juego de saltar huevos de YoZzhi"
        />
        <div className="game-overlay" hidden={!overlayVisible}>
          {status === 'over' ? (
            <>
              <p className="overlay-title">FIN DEL JUEGO</p>
              {result?.record && <p className="record-badge">¡NUEVO RÉCORD!</p>}
              <div className="summary">
                <div><span>PUNTOS</span><strong>{pad(result?.score ?? 0)}</strong></div>
                <div><span>MONEDAS</span><strong>{result?.coins ?? 0}</strong></div>
                <div><span>DISTANCIA</span><strong>{result?.meters ?? 0}m</strong></div>
                <div><span>MEJOR CADENA</span><strong>{result?.combo ?? 0}</strong></div>
              </div>
              <button type="button" onClick={() => actionRef.current?.()} onMouseDown={(e) => e.preventDefault()}>JUGAR DE NUEVO</button>
            </>
          ) : status === 'paused' ? (
            <>
              <p className="overlay-title">PAUSA</p>
              <p>El juego está en pausa. Pulsa ESC o el botón para continuar.</p>
              <button type="button" onClick={() => actionRef.current?.()} onMouseDown={(e) => e.preventDefault()}>SEGUIR</button>
            </>
          ) : (
            <>
              <p className="overlay-title">¡A CORRER!</p>
              <p>Salta los huevos, esquiva los pájaros, recoge monedas y consigue el récord.</p>
              <button type="button" onClick={() => actionRef.current?.()} onMouseDown={(e) => e.preventDefault()}>JUGAR</button>
            </>
          )}
        </div>
      </div>

      <div className="char-picker">
        <span className="p-label">PERSONAJE</span>
        <div className="picker-wrap">
          <div className="skin-picker" role="radiogroup" aria-label="Elegir personaje">
            {allSkins.map((s) => (
              <div className="skin-slot" key={s.id}>
                <button
                  type="button"
                  className={`skin-btn${s.id === skinId ? ' active' : ''}`}
                  onClick={() => selectSkin(s.id)}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-pressed={s.id === skinId}
                  aria-label={`Usar ${s.name}`}
                >
                  <img className="skin-point" src={s.point} alt="" />
                  <span>{s.name}</span>
                </button>
                {customSkins.some((c) => c.id === s.id) && (
                  <button
                    type="button"
                    className="remove-skin-btn"
                    onClick={() => removeSkin(s.id)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    aria-label={`Eliminar ${s.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="skin-btn add-skin-btn"
              onClick={() => fileInputRef.current?.click()}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span className="add-plus">+</span>
              <span>AÑADIR</span>
            </button>
          </div>

          {pendingAdd && (
            <div className="custom-name-form">
              <label htmlFor="custom-name">NOMBRE DEL PERSONAJE</label>
              <input id="custom-name" ref={nameInputRef} type="text" maxLength={20} defaultValue={pendingAdd.defName} autoFocus />
              <button type="button" onClick={confirmAdd} onMouseDown={(e) => e.preventDefault()}>GUARDAR</button>
              <button type="button" onClick={cancelAdd} onMouseDown={(e) => e.preventDefault()}>CANCELAR</button>
            </div>
          )}

          {!pendingAdd && lastAddedId && (
            <button
              type="button"
              className="undo-add-btn"
              onClick={undoLastAdd}
              onMouseDown={(e) => e.preventDefault()}
            >
              ↩ DESHACER ÚLTIMA ADICIÓN
            </button>
          )}

          {customMsg && (
            <p className="custom-msg" role="status">{customMsg}</p>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/png" hidden onChange={onFileChosen} />

      <div className="effects-bar" ref={effectRef} hidden aria-live="polite" />

      <div className="game-footer" aria-live="polite">
        <span className="points">
          <img src={(allSkins.find((s) => s.id === skinId) || allSkins[0]).point} alt="" className="coin" />
          <span>PUNTOS <strong ref={scoreRef}>0000</strong></span>
        </span>
        <span>MONEDAS <strong ref={coinRef}>00</strong></span>
        <span className="combo-text" ref={comboRef}></span>
        <span>RÉCORD <strong ref={bestScoreRef}>{pad(best)}</strong></span>
        <button className="sound-btn" type="button" onClick={toggleSound}>
          SONIDO {muted ? 'OFF' : 'ON'}
        </button>
      </div>
    </section>
  );
}