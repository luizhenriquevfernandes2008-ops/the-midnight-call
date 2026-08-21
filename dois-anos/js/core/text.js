// text.js — texto com cara de pixel art sem depender de arquivo de fonte.
//
// O truque (herdado do outro jogo, e bom demais pra refazer): desenha a
// frase com uma fonte do sistema num buffer pequeno, lê os pixels e joga
// fora toda a suavização — alpha vira 0 ou 255. O que sobra tem borda dura
// igual fonte bitmap, mas com acento, cedilha e til funcionando. Num jogo
// escrito inteiro em português isso não é detalhe, é requisito.
//
// Cada frase renderizada fica em cache. A carta do final é digitada letra
// por letra a 30 caracteres por segundo; sem cache o jogo derretia.

import { makeBuffer } from './gfx.js';
import { COR } from '../art/paleta.js';

const FONTES = {
  // Trebuchet tem haste grossa e terminação arredondada — é a que melhor
  // sobrevive ao corte de alpha em tamanho pequeno, e a que mais combina
  // com um jogo colorido. Verdana é a rede de segurança no Windows velho.
  ui:     '"Trebuchet MS","Verdana","DejaVu Sans",sans-serif',
  // Título: pesada, para caber muito preto em pouca altura.
  titulo: '"Arial Black","Franklin Gothic Heavy",Impact,Haettenschweiler,sans-serif',
  // As memórias e a carta final. Serifa dá cara de coisa escrita à mão,
  // e nesses textos o tamanho é maior, então os traços finos sobrevivem.
  carta:  'Georgia,"Times New Roman","DejaVu Serif",serif',
  mono:   'Consolas,"Courier New","DejaVu Sans Mono",monospace',
};

const cache = new Map();
const CACHE_MAX = 700;

function chave(str, o) {
  return `${o.font}|${o.size}|${o.weight}|${o.color}|${o.track}|${o.threshold}|${str}`;
}

function assar(str, o) {
  const size = o.size;
  const pad = Math.ceil(size * 0.7) + 4;
  const sonda = makeBuffer(8, 8);
  sonda.x.font = `${o.weight} ${size}px ${FONTES[o.font] || FONTES.ui}`;
  const chars = [...str];
  let w = 0;
  const avancos = [];
  for (const ch of chars) {
    const a = sonda.x.measureText(ch).width;
    avancos.push(a);
    w += a + o.track;
  }
  w = Math.ceil(w) + pad * 2;
  const h = Math.ceil(size * 1.7) + pad;

  const b = makeBuffer(Math.max(1, w), Math.max(1, h));
  const x = b.x;
  x.font = `${o.weight} ${size}px ${FONTES[o.font] || FONTES.ui}`;
  x.textBaseline = 'alphabetic';
  x.fillStyle = '#ffffff';
  let cx = pad;
  const base = Math.round(size * 1.15);
  for (let i = 0; i < chars.length; i++) {
    x.fillText(chars[i], Math.round(cx), base);
    cx += avancos[i] + o.track;
  }

  const img = x.getImageData(0, 0, b.c.width, b.c.height);
  const d = img.data;
  const rgb = hex2rgb(o.color);
  const lim = o.threshold * 255;
  let minX = b.c.width, maxX = 0, minY = b.c.height, maxY = 0;
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] >= lim) {
      d[p] = rgb[0]; d[p + 1] = rgb[1]; d[p + 2] = rgb[2]; d[p + 3] = 255;
      const idx = p >> 2;
      const px = idx % b.c.width, py = (idx / b.c.width) | 0;
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    } else d[p + 3] = 0;
  }
  x.putImageData(img, 0, 0);

  if (maxX < minX) { minX = 0; maxX = 0; minY = 0; maxY = 0; }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const out = makeBuffer(Math.max(1, cw), Math.max(1, ch));
  out.x.drawImage(b.c, minX, minY, cw, ch, 0, 0, cw, ch);

  // `asc` guarda a distância até a linha de base. Sem isso "amor" e "AMOR"
  // saem em alturas diferentes, porque o recorte é justo na tinta.
  return { c: out.c, w: cw, h: ch, asc: base - minY };
}

function hex2rgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function ops(o = {}) {
  return {
    font: o.font || 'ui',
    size: o.size || 10,
    weight: o.weight || 'bold',
    color: o.color || COR.uiTexto,
    track: o.track === undefined ? 0 : o.track,
    threshold: o.threshold === undefined ? 0.5 : o.threshold,
  };
}

export function glifos(str, o) {
  const oo = ops(o);
  const k = chave(str, oo);
  let e = cache.get(k);
  if (!e) {
    e = assar(str, oo);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(k, e);
  }
  return e;
}

export function medir(str, o) {
  const g = glifos(String(str), o);
  return { w: g.w, h: g.h, asc: g.asc };
}

// x,y é o canto superior-esquerdo. align: 'left' | 'center' | 'right'.
//
// `outline` custa cinco desenhos em vez de um, mas num jogo colorido é o
// que separa o texto do fundo: uma letra clara em cima de céu claro some,
// e o contorno escuro resolve isso em qualquer cenário sem precisar de
// caixa preta atrás.
export function text(ctx, str, x, y, o = {}) {
  if (str === '' || str == null) return 0;
  const g = glifos(String(str), o);
  let dx = Math.round(x);
  if (o.align === 'center') dx = Math.round(x - g.w / 2);
  else if (o.align === 'right') dx = Math.round(x - g.w);
  const dy = Math.round(y);

  const a0 = ctx.globalAlpha;
  const al = o.alpha === undefined ? a0 : a0 * o.alpha;

  if (o.outline) {
    const og = glifos(String(str), { ...o, color: o.outlineColor || COR.uiSombra });
    ctx.globalAlpha = al * (o.outlineAlpha === undefined ? 1 : o.outlineAlpha);
    const raio = o.outline === true ? 1 : o.outline;
    for (let oy = -raio; oy <= raio; oy++) {
      for (let ox = -raio; ox <= raio; ox++) {
        if (!ox && !oy) continue;
        ctx.drawImage(og.c, dx + ox, dy + oy);
      }
    }
  } else if (o.shadow) {
    const sg = glifos(String(str), { ...o, color: o.shadowColor || COR.uiSombra });
    const so = o.shadowOffset === undefined ? 1 : o.shadowOffset;
    ctx.globalAlpha = al * (o.shadowAlpha === undefined ? 0.9 : o.shadowAlpha);
    ctx.drawImage(sg.c, dx + so, dy + so);
  }

  ctx.globalAlpha = al;
  ctx.drawImage(g.c, dx, dy);
  ctx.globalAlpha = a0;
  return g.w;
}

// Quebra por largura respeitando palavras E respeitando \n do autor.
export function quebrar(str, maxW, o = {}) {
  const saida = [];
  for (const paragrafo of String(str).split('\n')) {
    if (paragrafo === '') { saida.push(''); continue; }
    let cur = '';
    for (const w of paragrafo.split(/\s+/)) {
      const teste = cur ? cur + ' ' + w : w;
      if (medir(teste, o).w > maxW && cur) { saida.push(cur); cur = w; }
      else cur = teste;
    }
    if (cur) saida.push(cur);
  }
  return saida;
}

export function bloco(ctx, str, x, y, maxW, alturaLinha, o = {}) {
  const linhas = Array.isArray(str) ? str : quebrar(str, maxW, o);
  for (let i = 0; i < linhas.length; i++) text(ctx, linhas[i], x, y + i * alturaLinha, o);
  return linhas.length * alturaLinha;
}

export function limparCacheTexto() { cache.clear(); }
