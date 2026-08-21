// ceu.js — o fundo: céu, astro e as camadas de paralaxe.
//
// Cada camada é um canvas que se repete na horizontal. Desenhar é achar o
// deslocamento (câmera vezes o fator da camada), tirar o resto da divisão
// pela largura da camada, e carimbar duas ou três vezes lado a lado. Como
// as camadas são desenhadas UMA vez no carregamento, o fundo inteiro custa
// meia dúzia de drawImage por quadro, por mais detalhe que ele tenha.
//
// O que dá profundidade não é o número de camadas, são duas coisas:
//   1. camada mais longe = mais clara e mais próxima da cor do céu
//      (perspectiva atmosférica);
//   2. camada mais longe = anda mais devagar.
// Uma silhueta preta lá no fundo mata as duas e o desenho vira adesivo.

import { makeBuffer, mulberry32, VW, VH, mixHex, clamp } from '../core/gfx.js';
import { ret, degradeV, disco, granular, linha } from '../art/pixel.js';

// ---------------------------------------------------------------------------
// céu
// ---------------------------------------------------------------------------
function montarCeu(tema) {
  const b = makeBuffer(VW, VH, false);
  const cores = tema.ceu;
  const faixa = VH / (cores.length - 1);
  for (let i = 0; i < cores.length - 1; i++) {
    degradeV(b.x, 0, Math.floor(i * faixa), VW, Math.ceil(faixa) + 1,
      cores[i], cores[i + 1], 7);
  }
  return b.c;
}

// ---------------------------------------------------------------------------
// camadas por tema
// ---------------------------------------------------------------------------

function camadaNuvens(tema, largura, escala, alpha, semente) {
  const b = makeBuffer(largura, 110);
  const x = b.x;
  const rnd = mulberry32(semente);
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const cx = rnd() * largura;
    const cy = 18 + rnd() * 60;
    const r = (9 + rnd() * 9) * escala;
    // Nuvem é um punhado de discos sobrepostos com uma barriga reta. Quatro
    // discos já leem como nuvem; a barriga é o que impede de virar pipoca.
    // Cinco discos de raios diferentes, a barriga baixinha, e um disco a
    // mais em cima do meio. Barriga alta demais transforma a nuvem numa
    // mesa; discos todos do mesmo raio, num trem de vagões.
    const raios = [0.6, 0.95, 1.0, 0.8, 0.55];
    for (let k = 0; k < raios.length; k++) {
      const dx = (k - 2) * r * 0.72;
      const rr = r * raios[k];
      const dy = (k === 2 ? -r * 0.18 : 0);
      for (const off of [0, -largura, largura]) {
        const px2 = cx + dx + off;
        if (px2 < -60 || px2 > largura + 60) continue;
        disco(x, px2, cy + dy, rr, tema.nuvens[0]);
      }
    }
    ret(x, cx - r * 1.75, cy, r * 3.5, r * 0.55, tema.nuvens[0]);
    ret(x, cx - r * 1.5, cy + r * 0.35, r * 3.0, 2, tema.nuvens[1]);
  }
  return { c: b.c, alpha, y: 0 };
}

function camadaMar(tema, largura) {
  const b = makeBuffer(largura, 90);
  const x = b.x;
  const m = tema.mar;
  degradeV(x, 0, 0, largura, 90, m.cima, m.baixo, 6);
  const rnd = mulberry32(0xA11);
  // Brilhos horizontais espalhados: é o sol batendo na água. Sem eles o mar
  // é um retângulo azul.
  for (let i = 0; i < largura * 0.5; i++) {
    const px = Math.floor(rnd() * largura);
    const py = Math.floor(Math.pow(rnd(), 1.7) * 70);
    ret(x, px, py, 1 + Math.floor(rnd() * 3), 1,
      rnd() < 0.3 ? m.espuma : mixHex(m.cima, m.espuma, 0.45));
  }
  return b.c;
}

function camadaMorros(tema, largura, altura, cor, semente, aspereza) {
  const b = makeBuffer(largura, altura);
  const x = b.x;
  const rnd = mulberry32(semente);
  const perfil = new Array(largura);
  let h = altura * 0.5;
  for (let i = 0; i < largura; i++) {
    h += (rnd() - 0.5) * aspereza;
    h = clamp(h, altura * 0.22, altura * 0.82);
    perfil[i] = h;
  }
  // costura: força as pontas a se encontrarem para a camada repetir sem
  // degrau visível
  for (let i = 0; i < 60; i++) {
    const t = i / 60;
    perfil[largura - 1 - i] = perfil[largura - 1 - i] * t + perfil[i] * (1 - t);
  }
  x.fillStyle = cor;
  for (let i = 0; i < largura; i++) {
    const y = Math.round(perfil[i]);
    x.fillRect(i, y, 1, altura - y);
  }
  return b.c;
}

function camadaArvores(tema, largura, cor, corDk, semente, escala) {
  const b = makeBuffer(largura, 130);
  const x = b.x;
  const rnd = mulberry32(semente);
  const n = Math.floor(largura / (26 / escala));
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(rnd() * largura);
    const h = (44 + rnd() * 40) * escala;
    const base = 130;
    // Tronco fino demais lê como poste. Quatro pixels no mínimo.
    const largTronco = Math.max(4, Math.round(5 * escala));
    ret(x, cx, base - h, largTronco, h, corDk);
    // copa: três discos empilhados e desencontrados
    const r = (10 + rnd() * 6) * escala;
    disco(x, cx + largTronco / 2, base - h - r * 0.2, r, cor);
    disco(x, cx + largTronco / 2 - r * 0.7, base - h + r * 0.5, r * 0.7, cor);
    disco(x, cx + largTronco / 2 + r * 0.7, base - h + r * 0.4, r * 0.75, cor);
    disco(x, cx + largTronco / 2 - r * 0.3, base - h - r * 0.9, r * 0.6, corDk);
  }
  return b.c;
}

function camadaPredios(tema, largura, cor, corJanela, semente, altMax, chanceJanela) {
  const b = makeBuffer(largura, 170);
  const x = b.x;
  const rnd = mulberry32(semente);
  let px = -10;
  while (px < largura + 10) {
    const w = 18 + Math.floor(rnd() * 26);
    const h = 40 + Math.floor(rnd() * altMax);
    const base = 170;
    ret(x, px, base - h, w, h, cor);
    ret(x, px, base - h, w, 2, mixHex(cor, '#ffffff', 0.12));
    // caixa d'água / antena de vez em quando
    if (rnd() < 0.3) ret(x, px + w / 2 - 3, base - h - 6, 6, 6, cor);
    if (rnd() < 0.25) ret(x, px + w / 2, base - h - 12, 1, 12, cor);
    for (let jy = base - h + 6; jy < base - 6; jy += 7) {
      for (let jx = px + 3; jx < px + w - 4; jx += 6) {
        if (rnd() < chanceJanela) {
          ret(x, jx, jy, 3, 4, corJanela[Math.floor(rnd() * corJanela.length)]);
        }
      }
    }
    px += w + 2 + Math.floor(rnd() * 6);
  }
  return b.c;
}

function camadaEstrelas(largura, altura, semente, densidade) {
  const b = makeBuffer(largura, altura);
  const x = b.x;
  const rnd = mulberry32(semente);
  const n = Math.floor(largura * altura * densidade);
  for (let i = 0; i < n; i++) {
    const px = Math.floor(rnd() * largura);
    const py = Math.floor(Math.pow(rnd(), 1.4) * altura);
    const b2 = rnd();
    const c = b2 > 0.9 ? '#ffffff' : b2 > 0.6 ? '#dfe6ff' : '#a8b4e0';
    ret(x, px, py, 1, 1, c);
    if (b2 > 0.95) {
      // estrela grande: uma cruz de cinco pixels
      ret(x, px - 1, py, 3, 1, c); ret(x, px, py - 1, 1, 3, c);
    }
  }
  return b.c;
}

// ---------------------------------------------------------------------------
// o fundo montado
// ---------------------------------------------------------------------------
export class Fundo {
  constructor(nomeTema, tema) {
    this.tema = tema;
    this.nome = nomeTema;
    this.ceu = montarCeu(tema);
    this.camadas = [];
    this.tempo = 0;

    const L = 640;   // largura de repetição das camadas

    // A LINHA DO HORIZONTE fica por volta de y=150 em todos os temas, e a
    // BASE das camadas de frente fica por volta de y=210 — abaixo de onde o
    // chão da fase costuma estar, para o terreno cobrir os pés delas. Foi
    // errando isso que as árvores nasceram plantadas dentro do mar.
    if (nomeTema === 'praia') {
      this.camadas.push({ c: camadaNuvens(tema, L, 1.2, 0.85, 11).c, f: 0.06, y: 8 });
      this.camadas.push({ c: camadaMar(tema, L), f: 0.16, y: 150 });
      this.camadas.push({ c: camadaMorros(tema, L, 70, mixHex(tema.terra.corpo[0], tema.ceu[3], 0.55), 21, 1.6), f: 0.24, y: 122 });
      this.camadas.push({ c: camadaArvores(tema, L, mixHex('#3f9e5a', tema.ceu[3], 0.42), mixHex('#7a5330', tema.ceu[3], 0.4), 33, 0.85), f: 0.42, y: 84 });
    } else if (nomeTema === 'floresta') {
      this.camadas.push({ c: camadaEstrelas(L, 150, 7, 0.006), f: 0.03, y: 0 });
      this.camadas.push({ c: camadaMorros(tema, L, 90, mixHex('#1b2a48', tema.ceu[3], 0.35), 41, 1.3), f: 0.12, y: 120 });
      this.camadas.push({ c: camadaArvores(tema, L, mixHex('#1e5a3a', tema.ceu[3], 0.45), mixHex('#14301f', tema.ceu[3], 0.4), 51, 1.15), f: 0.26, y: 74 });
      this.camadas.push({ c: camadaArvores(tema, L, '#183f2c', '#0e2418', 61, 1.5), f: 0.5, y: 88 });
    } else if (nomeTema === 'cidade') {
      this.camadas.push({ c: camadaPredios(tema, L, mixHex('#232c4c', tema.ceu[3], 0.42), ['#6f7fae', '#8a94c0'], 71, 60, 0.22), f: 0.1, y: 30 });
      this.camadas.push({ c: camadaPredios(tema, L, mixHex('#1b2440', tema.ceu[3], 0.22), ['#ffd45f', '#ff9a6b', '#7fd8ff'], 81, 78, 0.3), f: 0.22, y: 46 });
      this.camadas.push({ c: camadaPredios(tema, L, '#141b30', ['#ffd45f', '#ff5f8a', '#5fe0ff'], 91, 90, 0.34), f: 0.42, y: 60 });
    } else {
      this.camadas.push({ c: camadaEstrelas(L, 200, 13, 0.010), f: 0.02, y: 0 });
      this.camadas.push({ c: camadaNuvens(tema, L, 1.7, 0.55, 23).c, f: 0.08, y: 40 });
      this.camadas.push({ c: camadaNuvens(tema, L, 1.2, 0.8, 29).c, f: 0.2, y: 110 });
      this.camadas.push({ c: camadaNuvens(tema, L, 0.9, 1, 31).c, f: 0.4, y: 178 });
    }
  }

  atualizar(dt) { this.tempo += dt; }

  desenhar(ctx, camX, camY) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.ceu, 0, 0);

    // O astro fica preso ao céu, mas com um empurrãozinho de paralaxe: sem
    // isso ele parece colado no vidro da tela.
    const s = this.tema.sol;
    if (s) {
      const sx = VW * s.x - camX * 0.02;
      const sy = VH * s.y - camY * 0.04;
      const pulso = 1 + Math.sin(this.tempo * 0.7) * 0.03;
      ctx.globalAlpha = 0.30;
      disco(ctx, sx, sy, s.r * 2.1 * pulso, s.halo);
      ctx.globalAlpha = 0.42;
      disco(ctx, sx, sy, s.r * 1.4 * pulso, s.halo);
      ctx.globalAlpha = 1;
      disco(ctx, sx, sy, s.r, s.cor);
    }

    for (const cam of this.camadas) {
      const w = cam.c.width;
      let off = -(camX * cam.f) % w;
      if (off > 0) off -= w;
      const y = Math.round(cam.y - camY * cam.f * 0.5);
      ctx.globalAlpha = cam.alpha === undefined ? 1 : cam.alpha;
      for (let i = 0; i * w + off < VW + w; i++) {
        ctx.drawImage(cam.c, Math.round(off + i * w), y);
      }
      ctx.globalAlpha = 1;
    }
  }
}

export default Fundo;
