// decor.js — o cenário que não é chão: palmeira, cogumelo, poste, balão.
//
// Cada peça é desenhada uma vez num canvas próprio, no carregamento, e
// depois só é carimbada. Vale a pena porque quase todas têm dezenas de
// retângulos: uma palmeira redesenhada por quadro, vinte vezes na tela, é
// mais custosa do que a fase inteira.
//
// A cor NÃO vem fixa: chega do tema. A mesma palmeira serve de árvore da
// praia e de árvore de sombra, e o poste da cidade vira lanterna na
// floresta só trocando a paleta.

import { makeBuffer, mulberry32, mixHex } from '../core/gfx.js';
import { ret, disco, linha, granular } from '../art/pixel.js';
import { COR } from '../art/paleta.js';

const cache = new Map();

function fazer(chave, w, h, pintar) {
  let c = cache.get(chave);
  if (c) return c;
  const b = makeBuffer(w, h);
  b.x.imageSmoothingEnabled = false;
  pintar(b.x, mulberry32(hash(chave)));
  c = { c: b.c, w, h };
  cache.set(chave, c);
  return c;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function limparDecor() { cache.clear(); }

// ---------------------------------------------------------------------------
// as peças. Todas desenhadas com o "chão" na última linha do canvas.
// ---------------------------------------------------------------------------
const PECAS = {
  // Palmeira. Ela tem que ser CLARAMENTE mais alta que a personagem (44 px):
  // árvore da altura de gente não lê como árvore, lê como arbusto grande.
  palmeira(x, rnd, t, v) {
    const tronco = '#a9743e', troncoHi = '#c99459', troncoDk = '#6e4622';
    const folha = '#3fa85e', folhaDk = '#2b7a44', folhaHi = '#6ad07f';
    const base = 108;
    const h = 74 + (v % 3) * 8;
    // O tronco entorta: palmeira reta parece poste com salada em cima.
    for (let i = 0; i < h; i++) {
      const dx = Math.round(Math.sin(i / h * 1.6) * 7);
      const larg = i > h - 12 ? 5 : 7;
      ret(x, 28 + dx - larg / 2, base - i, larg, 1, tronco);
      ret(x, 28 + dx - larg / 2, base - i, 1, 1, troncoDk);
      ret(x, 28 + dx + larg / 2 - 1, base - i, 1, 1, troncoHi);
      if (i % 6 === 0) ret(x, 28 + dx - larg / 2, base - i, larg, 1, troncoDk);
    }
    const tx = 28 + Math.round(Math.sin(1.6) * 7), ty = base - h;
    // seis folhas em leque, caindo pelas pontas
    for (let f = 0; f < 7; f++) {
      const a = Math.PI + (f / 6) * Math.PI;
      const comp = 22 + (f % 2) * 6;
      for (let s2 = 0; s2 <= comp; s2++) {
        const px = tx + Math.cos(a) * s2;
        const py = ty + Math.sin(a) * s2 * 0.5 + s2 * s2 * 0.022;
        const esp = Math.max(1, 5 - Math.floor(s2 / 7));
        ret(x, px - esp / 2, py, esp, esp,
          s2 > comp * 0.65 ? folhaDk : (f % 2 ? folha : folhaHi));
      }
    }
    disco(x, tx, ty, 4, folhaDk);
    ret(x, tx - 5, ty + 4, 4, 4, '#6b4a2a');
    ret(x, tx + 2, ty + 5, 4, 4, '#6b4a2a');
  },

  concha(x, rnd, t) {
    const c = '#ffd9e2', d = '#e0a0b4';
    for (let i = 0; i < 4; i++) ret(x, 2 + i, 7 - i, 8 - i * 2, i + 1, i % 2 ? d : c);
    ret(x, 1, 7, 10, 1, d);
  },

  guardasol(x, rnd, t) {
    ret(x, 22, 26, 3, 36, '#c8b49a');
    ret(x, 22, 26, 1, 36, '#a08c72');
    for (let i = 0; i < 10; i++) {
      const w = 46 - i * 4;
      ret(x, 23 - w / 2, 26 - i * 2, w, 2, i % 2 ? '#ff6b8a' : '#fff3e0');
    }
    ret(x, 22, 4, 2, 6, '#c8b49a');
    ret(x, 20, 60, 8, 2, '#e0c8a8');
  },

  castelo(x, rnd, t) {
    const a = '#f0cd8c', b = '#d9ab63', c = '#ffe3a8';
    ret(x, 2, 17, 30, 13, a);
    ret(x, 2, 17, 30, 2, c);
    ret(x, 2, 28, 30, 2, b);
    for (let i = 0; i < 3; i++) {
      ret(x, 3 + i * 11, 5, 9, 13, a);
      ret(x, 3 + i * 11, 5, 9, 2, c);
      ret(x, 3 + i * 11, 12, 9, 1, b);
      ret(x, 7 + i * 11, 0, 1, 5, '#ff6b8a');
      ret(x, 8 + i * 11, 0, 4, 3, '#ffffff');
    }
    ret(x, 14, 22, 6, 8, b);
  },

  cogumelo(x, rnd, t, v) {
    const chapeu = v % 2 ? '#ff5f6b' : '#c07fe0';
    const chapeuDk = mixHex(chapeu, '#2b2233', 0.35);
    ret(x, 8, 13, 6, 11, '#f0e8d8');
    ret(x, 8, 13, 2, 11, '#d0c4b0');
    // Cúpula: estreita em cima, larga embaixo. A primeira versão era mais
    // larga NO MEIO, o que desenha uma lente, não um cogumelo.
    const larguras = [8, 13, 17, 20, 22, 22];
    for (let i = 0; i < larguras.length; i++) {
      const w = larguras[i];
      ret(x, 11 - w / 2, 4 + i * 2, w, 2, i >= 4 ? chapeuDk : chapeu);
    }
    ret(x, 1, 14, 20, 2, chapeuDk);
    ret(x, 7, 6, 3, 2, '#fff6e0');
    ret(x, 13, 9, 2, 2, '#fff6e0');
    ret(x, 5, 11, 2, 2, '#fff6e0');
  },

  arbusto(x, rnd, t) {
    const c = t.terra.topo[0], d = t.terra.topoDk;
    disco(x, 10, 14, 8, c); disco(x, 20, 15, 7, c); disco(x, 15, 10, 8, c);
    disco(x, 12, 12, 3, d); disco(x, 21, 13, 2, d);
    ret(x, 0, 20, 30, 2, d);
  },

  flor(x, rnd, t, v) {
    const cores = ['#ff7ba8', '#ffd45f', '#8fd8ff', '#ffffff'];
    const c = cores[v % cores.length];
    ret(x, 3, 5, 1, 6, '#3fa85e');
    ret(x, 2, 3, 4, 2, c); ret(x, 3, 2, 2, 4, c);
    ret(x, 3, 3, 2, 2, '#ffe98a');
  },

  tronco(x, rnd, t) {
    ret(x, 0, 8, 34, 12, '#5b4331');
    ret(x, 0, 8, 34, 2, '#6b5039');
    ret(x, 0, 18, 34, 2, '#33241a');
    disco(x, 32, 14, 5, '#4a3527');
    for (let i = 0; i < 5; i++) ret(x, 4 + i * 7, 11, 2, 6, '#4a3527');
    disco(x, 8, 7, 4, t.terra.topo[0]);
    disco(x, 18, 6, 5, t.terra.topo[0]);
  },

  lanterna(x, rnd, t) {
    ret(x, 6, 16, 2, 28, '#3a2f26');
    ret(x, 4, 42, 6, 2, '#3a2f26');
    // corpo da luminária: moldura escura, vidro quente, chama no meio
    ret(x, 2, 5, 10, 12, '#4a3f36');
    ret(x, 3, 6, 8, 10, '#ffd98a');
    ret(x, 4, 7, 6, 8, '#fff3c0');
    ret(x, 6, 9, 2, 4, '#ffffff');
    ret(x, 2, 5, 10, 1, '#6b5a4a');
    ret(x, 2, 16, 10, 1, '#3a2f26');
    ret(x, 5, 2, 4, 3, '#3a2f26');
    ret(x, 6, 0, 2, 2, '#3a2f26');
  },

  poste(x, rnd, t) {
    ret(x, 8, 10, 3, 54, '#3d4356');
    ret(x, 8, 6, 12, 3, '#3d4356');
    ret(x, 16, 9, 8, 5, '#565d70');
    ret(x, 17, 10, 6, 4, '#ffe4a8');
  },

  letreiro(x, rnd, t, v) {
    const cores = t.neon || ['#ff5f8a', '#5fe0ff', '#ffd45f'];
    const c = cores[v % cores.length];
    ret(x, 0, 0, 4, 26, '#2b3044');
    ret(x, 3, 3, 26, 20, '#1a1d2c');
    ret(x, 5, 5, 22, 2, c);
    ret(x, 5, 10, 16, 2, c);
    ret(x, 5, 15, 20, 2, c);
    ret(x, 5, 19, 10, 2, c);
  },

  lixeira(x, rnd, t) {
    ret(x, 2, 8, 14, 16, '#4a5164');
    ret(x, 1, 6, 16, 3, '#5d6478');
    ret(x, 4, 10, 2, 12, '#3d4356');
    ret(x, 10, 10, 2, 12, '#3d4356');
  },

  balao(x, rnd, t, v) {
    const cores = ['#ff7ba8', '#ffd45f', '#8fd8ff', '#c398f0'];
    const c = cores[v % cores.length];
    disco(x, 11, 12, 10, c);
    disco(x, 8, 9, 4, mixHex(c, '#ffffff', 0.5));
    ret(x, 10, 21, 3, 3, mixHex(c, '#2b2233', 0.4));
    for (let i = 0; i < 14; i++) ret(x, 11 + Math.round(Math.sin(i / 3) * 2), 24 + i, 1, 1, '#ffffff');
  },

  passarinho(x, rnd, t, v) {
    const c = v % 2 ? '#ffffff' : '#ffe0a8';
    ret(x, 4, 5, 7, 4, c);
    ret(x, 10, 3, 4, 4, c);
    ret(x, 13, 4, 2, 1, '#ff9a5c');
    ret(x, 12, 4, 1, 1, '#2b2233');
    ret(x, 2, 6, 4, 2, mixHex(c, '#2b2233', 0.25));
    ret(x, 5, 3, 5, 2, mixHex(c, '#2b2233', 0.15));
  },

  pedra(x, rnd, t, v) {
    const c = t.terra.pedra[0], d = t.terra.pedra[1];
    const w = 12 + (v % 3) * 5;
    disco(x, w / 2, 10, w / 2, c);
    ret(x, 0, 10, w, 4, c);
    ret(x, 0, 12, w, 2, d);
    ret(x, 3, 6, 3, 2, mixHex(c, '#ffffff', 0.3));
  },

  placa(x, rnd, t) {
    ret(x, 7, 12, 2, 14, '#6b4a2e');
    ret(x, 0, 2, 17, 11, '#8a6440');
    ret(x, 0, 2, 17, 2, '#a9743e');
    ret(x, 2, 6, 13, 1, '#5e3f22');
    ret(x, 2, 9, 9, 1, '#5e3f22');
  },
};

const TAM = {
  palmeira: [60, 109], concha: [12, 8], guardasol: [48, 62], castelo: [34, 30],
  cogumelo: [24, 24], arbusto: [30, 22], flor: [8, 11], tronco: [36, 20],
  lanterna: [14, 44], poste: [26, 64], letreiro: [30, 26], lixeira: [18, 24],
  balao: [24, 38], passarinho: [16, 10], pedra: [24, 14], placa: [18, 26],
};

export function pecaDecor(tipo, tema, nomeTema, variante = 0) {
  const t = TAM[tipo];
  if (!t || !PECAS[tipo]) return null;
  return fazer(`${tipo}|${nomeTema}|${variante}`, t[0], t[1],
    (x, rnd) => PECAS[tipo](x, rnd, tema, variante));
}
