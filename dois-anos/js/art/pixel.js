// pixel.js — ferramentas de arte em pixel.
//
// Um sprite aqui é uma grade de caracteres virando canvas. Escrever cabelo,
// laço e sapato como texto é mais fácil de ajustar do que código de desenho,
// e o resultado é pixel exato, sem anti-alias em lugar nenhum.
//
// A diferença pro outro jogo: lá o mapa de cores era fixo. Aqui ele CHEGA
// como argumento, porque o mesmo desenho de cabelo precisa sair castanho,
// ruivo ou rosa dependendo do que o jogador escolheu no editor. É por isso
// que `sprite()` recebe `map` e as peças são reconstruídas quando a
// aparência muda — o custo é uns 40 canvas minúsculos, uma vez.

import { makeBuffer, mulberry32, clamp } from '../core/gfx.js';

export const DEG = Math.PI / 180;

// def = { rows:[...], map:{char:'#rrggbb'}, pivot:[x,y] }
export function sprite(def) {
  const rows = def.rows;
  const h = rows.length;
  const w = Math.max(1, ...rows.map(r => r.length));
  const b = makeBuffer(w, h);
  const img = b.x.createImageData(w, h);
  const d = img.data;
  const cache = {};
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      let c = cache[ch];
      if (c === undefined) {
        const hex = def.map[ch];
        c = cache[ch] = hex ? lerHex(hex) : null;
      }
      if (!c) continue;
      const p = (y * w + x) * 4;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = c[3];
    }
  }
  b.x.putImageData(img, 0, 0);
  return { c: b.c, w, h, px: def.pivot ? def.pivot[0] : 0, py: def.pivot ? def.pivot[1] : 0 };
}

export function lerHex(hex) {
  if (Array.isArray(hex)) return hex;
  let h = String(hex).replace('#', '');
  let a = 255;
  if (h.length === 8) { a = parseInt(h.slice(6, 8), 16); h = h.slice(0, 6); }
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

// Cópia do sprite multiplicada por k — membro de trás fica mais escuro e a
// silhueta ganha profundidade sem custo nenhum em tempo de jogo.
export function escurecer(spr, k, tinta) {
  const b = makeBuffer(spr.w, spr.h);
  b.x.drawImage(spr.c, 0, 0);
  const img = b.x.getImageData(0, 0, spr.w, spr.h);
  const d = img.data;
  const tc = tinta ? lerHex(tinta) : null;
  for (let p = 0; p < d.length; p += 4) {
    if (!d[p + 3]) continue;
    d[p] = Math.round(d[p] * k);
    d[p + 1] = Math.round(d[p + 1] * k);
    d[p + 2] = Math.round(d[p + 2] * k);
    if (tc) {
      d[p] = Math.round(d[p] * 0.7 + tc[0] * 0.3);
      d[p + 1] = Math.round(d[p + 1] * 0.7 + tc[1] * 0.3);
      d[p + 2] = Math.round(d[p + 2] * 0.7 + tc[2] * 0.3);
    }
  }
  b.x.putImageData(img, 0, 0);
  return { c: b.c, w: spr.w, h: spr.h, px: spr.px, py: spr.py };
}

export function espelhar(spr) {
  const b = makeBuffer(spr.w, spr.h);
  b.x.translate(spr.w, 0);
  b.x.scale(-1, 1);
  b.x.imageSmoothingEnabled = false;
  b.x.drawImage(spr.c, 0, 0);
  return { c: b.c, w: spr.w, h: spr.h, px: spr.w - 1 - spr.px, py: spr.py };
}

// Contorno de 1px em volta da silhueta. Num jogo colorido isto vale mais que
// sombra: é o que impede a personagem de sumir dentro de um arbusto verde
// da mesma família de cor.
export function contornar(spr, cor) {
  const w = spr.w + 2, h = spr.h + 2;
  const b = makeBuffer(w, h);
  const x = b.x;
  x.imageSmoothingEnabled = false;
  // pinta a silhueta deslocada nas 8 direções, tinge, e põe o original em cima
  const silh = makeBuffer(w, h);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      silh.x.drawImage(spr.c, 1 + dx, 1 + dy);
    }
  }
  silh.x.globalCompositeOperation = 'source-in';
  silh.x.fillStyle = cor;
  silh.x.fillRect(0, 0, w, h);
  x.drawImage(silh.c, 0, 0);
  x.drawImage(spr.c, 1, 1);
  return { c: b.c, w, h, px: spr.px + 1, py: spr.py + 1 };
}

// Desenha respeitando o pivô, com posição arredondada. Arredondar importa:
// meio pixel de deslocamento faz o sprite inteiro tremer.
export function desenhar(ctx, spr, x, y, rot, flip, alpha) {
  if (!spr) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  if (flip === -1) ctx.scale(-1, 1);
  if (rot) ctx.rotate(rot);
  if (alpha !== undefined && alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(spr.c, -spr.px, -spr.py);
  ctx.restore();
}

// Desenha assumindo que a transformação já está no lugar (usado pelo rig).
export function carimbar(ctx, spr) {
  if (!spr) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr.c, -spr.px, -spr.py);
}

// Recolorir sem apagar a forma: mantém o desenho e joga cor por cima só onde
// já havia pixel. Com k < 1 a sombra original ainda aparece por baixo.
export function tingir(origem, destino, cor, k = 0.72) {
  const x = destino.x, w = destino.c.width, h = destino.c.height;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
  x.clearRect(0, 0, w, h);
  x.drawImage(origem, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.globalAlpha = k;
  x.fillStyle = cor;
  x.fillRect(0, 0, w, h);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
}

export function silhueta(origem, destino, cor) {
  const x = destino.x, w = destino.c.width, h = destino.c.height;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
  x.clearRect(0, 0, w, h);
  x.drawImage(origem, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = cor;
  x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------------------
// pincéis de cenário — tudo desenhado uma vez em canvas de camada
// ---------------------------------------------------------------------------

export function ret(ctx, x, y, w, h, cor) {
  ctx.fillStyle = cor;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function linha(ctx, x1, y1, x2, y2, cor) {
  // Bresenham — o lineTo do canvas tem anti-alias e suja a arte.
  ctx.fillStyle = cor;
  let x0 = Math.round(x1), y0 = Math.round(y1);
  const xf = Math.round(x2), yf = Math.round(y2);
  const dx = Math.abs(xf - x0), sx = x0 < xf ? 1 : -1;
  const dy = -Math.abs(yf - y0), sy = y0 < yf ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 6000; i++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === xf && y0 === yf) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Círculo cheio em pixel (sem anti-alias). Nuvem, bolha, coração, luz.
export function disco(ctx, cx, cy, r, cor) {
  ctx.fillStyle = cor;
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    const meia = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - meia, cy + y, meia * 2 + 1, 1);
  }
}

export function aro(ctx, cx, cy, r, cor) {
  ctx.fillStyle = cor;
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  let x = r, y = 0, err = 1 - r;
  const p = (a, b) => ctx.fillRect(a, b, 1, 1);
  while (x >= y) {
    p(cx + x, cy + y); p(cx + y, cy + x); p(cx - y, cy + x); p(cx - x, cy + y);
    p(cx - x, cy - y); p(cx - y, cy - x); p(cx + y, cy - x); p(cx + x, cy - y);
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

// Textura granulada: areia, casca de árvore, asfalto. Semente fixa = mesmo
// resultado a cada carregamento.
export function granular(ctx, x, y, w, h, cores, densidade, semente) {
  const rnd = mulberry32(semente);
  const n = Math.floor(w * h * densidade);
  for (let i = 0; i < n; i++) {
    const px = x + Math.floor(rnd() * w);
    const py = y + Math.floor(rnd() * h);
    ctx.fillStyle = cores[Math.floor(rnd() * cores.length)];
    ctx.fillRect(px, py, 1, 1);
  }
}

// Gradiente vertical em degraus (dither ordenado). Gradiente liso destrói a
// estética; isto mantém a paleta com cara de pixel art.
export function degradeV(ctx, x, y, w, h, topo, base, passos = 8) {
  const bayer = [
    [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
  ];
  const A = lerHex(topo), B = lerHex(base);
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let yy = 0; yy < h; yy++) {
    const tBruto = yy / Math.max(1, h - 1);
    for (let xx = 0; xx < w; xx++) {
      const th = bayer[yy & 3][xx & 3] / 16;
      const t = clamp(Math.round((tBruto * passos) + (th - 0.5)) / passos, 0, 1);
      const p = (yy * w + xx) * 4;
      d[p] = Math.round(A[0] + (B[0] - A[0]) * t);
      d[p + 1] = Math.round(A[1] + (B[1] - A[1]) * t);
      d[p + 2] = Math.round(A[2] + (B[2] - A[2]) * t);
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, Math.round(x), Math.round(y));
}

// Coração — desenhado uma vez e reaproveitado. Aparece na vida, no item, na
// partícula e na tela final, então vale ter uma função só.
export function coracao(ctx, cx, cy, r, cor, corHi) {
  const g = [
    '.xx.xx.',
    'xxxxxxx',
    'xxxxxxx',
    '.xxxxx.',
    '..xxx..',
    '...x...',
  ];
  const esc = Math.max(1, Math.round(r / 3));
  const w = 7 * esc, h = 6 * esc;
  const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  ctx.fillStyle = cor;
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[y].length; x++) {
      if (g[y][x] === 'x') ctx.fillRect(x0 + x * esc, y0 + y * esc, esc, esc);
    }
  }
  if (corHi) {
    ctx.fillStyle = corHi;
    ctx.fillRect(x0 + esc, y0 + esc, esc, esc);
    ctx.fillRect(x0 + esc, y0 + 2 * esc, esc, esc);
  }
}
