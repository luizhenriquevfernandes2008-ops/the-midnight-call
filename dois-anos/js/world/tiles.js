// tiles.js — o terreno: a grade, a colisão e o desenho.
//
// O mapa é uma grade de bytes de 16 em 16 pixels. O DESENHO dela é feito
// uma vez só, no carregamento, num canvas do tamanho da fase inteira; a
// cada quadro o jogo só recorta o pedaço que a câmera vê. Uma fase de 220
// tiles vira uma imagem de 3520x384 — cinco megabytes de memória em troca
// de um único drawImage por quadro, e de poder desenhar detalhe por tile
// (rachadura, tufo de grama, concha na areia) sem custo nenhum em jogo.
//
// A borda do terreno é automática: cada tile olha os quatro vizinhos e
// desenha superfície onde tem ar em cima, quina onde tem ar do lado. É o
// que evita ter que autorar 47 variações de canto à mão.

import { makeBuffer, mulberry32 } from '../core/gfx.js';
import { ret, granular, linha, disco } from '../art/pixel.js';

export const T = 16;

export const VAZIO = 0;
export const SOLIDO = 1;
export const PLATAFORMA = 2;   // atravessa por baixo, pisa por cima
export const ESPINHO = 3;
export const AGUA = 4;
export const FRAGIL = 5;       // nuvem que some quando pisada

export class Mapa {
  constructor(largura, altura) {
    this.l = largura;
    this.a = altura;
    this.g = new Uint8Array(largura * altura);
  }
  em(x, y) {
    if (x < 0 || y < 0 || x >= this.l || y >= this.a) return VAZIO;
    return this.g[y * this.l + x];
  }
  por(x, y, v) {
    if (x < 0 || y < 0 || x >= this.l || y >= this.a) return;
    this.g[y * this.l + x] = v;
  }
  // Sólido de verdade: bloqueia por todos os lados.
  solido(x, y) {
    const t = this.em(x, y);
    return t === SOLIDO || t === FRAGIL;
  }
  plataforma(x, y) { return this.em(x, y) === PLATAFORMA; }
  espinho(x, y) { return this.em(x, y) === ESPINHO; }
  agua(x, y) { return this.em(x, y) === AGUA; }

  get larguraPx() { return this.l * T; }
  get alturaPx() { return this.a * T; }
}

function semente(x, y) {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

// ---------------------------------------------------------------------------
// desenho de um tile sólido
// ---------------------------------------------------------------------------
function tileSolido(x, mapa, tx, ty, tema) {
  const px = tx * T, py = ty * T;
  const te = tema.terra;
  const rnd = mulberry32(semente(tx, ty));
  const arCima = !mapa.solido(tx, ty - 1);
  const arEsq = !mapa.solido(tx - 1, ty);
  const arDir = !mapa.solido(tx + 1, ty);
  const arBaixo = !mapa.solido(tx, ty + 1);
  // Profundidade: se existe terra dois tiles acima, este tile está enterrado
  // de verdade. A primeira versão pintava uma faixa escura no topo de TODO
  // tile enterrado, e o resultado era um paredão listrado de 16 em 16 pixels
  // — parecia bloco de concreto empilhado, não terra.
  const profundo = !arCima && mapa.solido(tx, ty - 2);
  const nuvem = tema.superficie === 'nuvem';
  const corLinha = nuvem ? te.topoDk : te.linha;

  // corpo
  ret(x, px, py, T, T, te.corpo[0]);
  granular(x, px, py, T, T, [te.corpo[1], te.corpo[2]], 0.14, semente(tx, ty));

  if (!arCima && !profundo) {
    // Só o primeiro tile abaixo da superfície leva a sombra do que está por
    // cima. Daí para baixo é terra lisa com grão.
    ret(x, px, py, T, 3, te.fundo);
    granular(x, px, py + 3, T, 5, [te.fundo], 0.2, semente(tx, ty) ^ 3);
  } else if (profundo) {
    granular(x, px, py, T, T, [te.fundo], 0.12, semente(tx, ty) ^ 5);
    // pedrinha ocasional no miolo
    if (rnd() < 0.18) {
      const bx = px + 3 + Math.floor(rnd() * 8), by = py + 4 + Math.floor(rnd() * 7);
      ret(x, bx, by, 3, 2, te.pedra[0]);
      ret(x, bx, by + 2, 3, 1, te.pedra[1]);
    }
  }

  // Bordas ANTES da superfície: assim a borda fofa da nuvem e o tufo de
  // grama ficam por cima da quina, e não cortados por ela.
  if (arEsq) { ret(x, px, py, 1, T, corLinha); ret(x, px + 1, py, 1, T, te.fundo); }
  if (arDir) { ret(x, px + T - 1, py, 1, T, corLinha); ret(x, px + T - 2, py, 1, T, te.fundo); }
  if (arBaixo) { ret(x, px, py + T - 1, T, 1, corLinha); ret(x, px, py + T - 3, T, 2, te.fundo); }

  // Nuvem tem que ser fofa dos QUATRO lados, senão vira laje branca com
  // chapéu de algodão.
  if (nuvem) {
    const C = te.corpo[0];
    if (arEsq) {
      disco(x, px + 3, py + 4, 5, C); disco(x, px + 2, py + 11, 4, C);
      ret(x, px, py + 2, 4, 12, C);
    }
    if (arDir) {
      disco(x, px + T - 4, py + 4, 5, C); disco(x, px + T - 3, py + 11, 4, C);
      ret(x, px + T - 4, py + 2, 4, 12, C);
    }
    if (arBaixo) {
      disco(x, px + 4, py + T - 4, 5, C); disco(x, px + 12, py + T - 4, 5, C);
      ret(x, px, py + T - 8, T, 5, C);
      ret(x, px + 2, py + T - 2, T - 4, 1, te.topoDk);
    }
  }

  if (arCima) superficie(x, px, py, te, tema.superficie, rnd, semente(tx, ty));
}

// A cara da superfície muda por mundo. É o detalhe que mais rende: a mesma
// grade de tiles vira areia, grama, laje de concreto ou nuvem só trocando
// esta função.
function superficie(x, px, py, te, estilo, rnd, sem) {
  const h = 5;
  ret(x, px, py, T, h, te.topo[0]);
  granular(x, px, py, T, h, [te.topo[1]], 0.28, sem ^ 7);
  ret(x, px, py + h, T, 2, te.topoDk);

  if (estilo === 'nuvem') {
    // Borda fofa: discos de raios diferentes mordendo o topo. Nuvem com
    // borda reta é laje branca.
    for (let i = 0; i < 3; i++) {
      const cx = px + 3 + i * 5 + Math.floor(rnd() * 2);
      disco(x, cx, py + 2, 3 + Math.floor(rnd() * 2), te.topo[0]);
    }
    ret(x, px, py + 1, T, 1, '#ffffff');
    return;
  }

  if (estilo === 'concreto') {
    // laje molhada: um brilho de chuva na quina

    // Laje: uma junta escura e uma quina clara. Sem elas o telhado é um
    // retângulo cinza de 200 tiles.
    ret(x, px, py, T, 1, te.topo[0]);
    ret(x, px, py + 2, T, 1, te.topoDk);
    ret(x, px + T - 1, py, 1, h + 2, te.topoDk);
    if (rnd() < 0.3) ret(x, px + 3 + Math.floor(rnd() * 8), py + 3, 3, 1, te.corpo[1]);
    return;
  }

  // areia e grama: borda mordida + tufo
  for (let i = 0; i < T; i += 2) {
    if (rnd() < 0.45) ret(x, px + i, py + h + 2, 2, 1, te.topoDk);
  }
  if (rnd() < 0.35) {
    const bx = px + 2 + Math.floor(rnd() * (T - 5));
    ret(x, bx, py - 2, 1, 2, te.topo[0]);
    ret(x, bx + 1, py - 1, 1, 1, te.topo[1]);
  }
  if (estilo === 'grama' && rnd() < 0.22) {
    const bx = px + 1 + Math.floor(rnd() * (T - 3));
    ret(x, bx, py - 4, 1, 4, te.topo[0]);
    ret(x, bx + 1, py - 2, 1, 2, te.topo[1]);
  }
}

function tilePlataforma(x, tx, ty, tema) {
  const px = tx * T, py = ty * T;
  const p = tema.plataforma;
  if (tema.superficie === 'nuvem') {
    // No céu, plataforma de uma via é uma nuvenzinha achatada. Tábua de
    // madeira flutuando no espaço não convence ninguém.
    const t = tema.terra;
    ret(x, px, py + 2, T, 4, t.topo[0]);
    disco(x, px + 4, py + 3, 4, t.topo[0]);
    disco(x, px + 12, py + 3, 4, t.topo[0]);
    ret(x, px, py + 1, T, 1, '#ffffff');
    ret(x, px + 1, py + 6, T - 2, 1, t.topoDk);
    return;
  }
  // A plataforma tem 6 pixels de altura e fica colada no TOPO do tile: é
  // ali que o pé encosta, e desenhar ela no meio deixa o personagem
  // flutuando visualmente.
  ret(x, px, py, T, 6, p.madeira);
  ret(x, px, py, T, 1, p.madeiraHi);
  ret(x, px, py + 5, T, 1, p.madeiraDk);
  for (let i = 3; i < T; i += 6) ret(x, px + i, py + 1, 1, 4, p.madeiraDk);
}

function tileEspinho(x, tx, ty, tema) {
  const px = tx * T, py = ty * T;
  const te = tema.terra;
  ret(x, px, py + T - 4, T, 4, te.fundo);
  ret(x, px, py + T - 1, T, 1, te.linha);
  // três pontas. Ponta em pixel art é um triângulo escadinha, e a linha de
  // luz do lado esquerdo é o que faz ela parecer afiada.
  for (let i = 0; i < 3; i++) {
    const bx = px + 1 + i * 5;
    for (let k = 0; k < 6; k++) {
      const w = Math.max(1, 5 - k);
      ret(x, bx + Math.floor((5 - w) / 2), py + T - 4 - k, w, 1,
        k > 3 ? '#ffffff' : te.pedra[0]);
    }
    ret(x, bx + 1, py + T - 8, 1, 4, '#ffffff');
  }
}

// ---------------------------------------------------------------------------
// camada pronta
// ---------------------------------------------------------------------------
export function desenharTerreno(mapa, tema) {
  const b = makeBuffer(mapa.larguraPx, mapa.alturaPx);
  const x = b.x;
  x.imageSmoothingEnabled = false;
  for (let ty = 0; ty < mapa.a; ty++) {
    for (let tx = 0; tx < mapa.l; tx++) {
      const t = mapa.em(tx, ty);
      if (t === SOLIDO) tileSolido(x, mapa, tx, ty, tema);
      else if (t === PLATAFORMA) tilePlataforma(x, tx, ty, tema);
      else if (t === ESPINHO) tileEspinho(x, tx, ty, tema);
    }
  }
  return b.c;
}

// ---------------------------------------------------------------------------
// as coisas que se mexem — desenhadas por quadro, não na camada
// ---------------------------------------------------------------------------

export function desenharAgua(ctx, mapa, tema, camX, camY, tempo) {
  const m = tema.mar;
  const tx0 = Math.max(0, Math.floor(camX / T) - 1);
  const tx1 = Math.min(mapa.l - 1, Math.ceil((camX + 480) / T));
  const ty0 = Math.max(0, Math.floor(camY / T) - 1);
  const ty1 = Math.min(mapa.a - 1, Math.ceil((camY + 270) / T));
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (mapa.em(tx, ty) !== AGUA) continue;
      const px = tx * T - camX, py = ty * T - camY;
      // A cor depende de quantos tiles de água existem ACIMA, não da posição
      // dentro do tile. Pintar metade clara e metade escura em cada tile
      // fazia o mar inteiro virar um pijama listrado.
      const topo = mapa.em(tx, ty - 1) !== AGUA;
      ret(ctx, px, py, T, T, topo ? m.cima : m.baixo);
      if (topo) ret(ctx, px, py + 11, T, 5, m.baixo);
      if (topo) {
        // Superfície: uma onda de dois pixels que anda com o tempo. Simples
        // assim já lê como água — o olho procura movimento, não realismo.
        for (let i = 0; i < T; i++) {
          const h = Math.round(1.5 + Math.sin((tx * T + i) * 0.22 + tempo * 2.4) * 1.5);
          ret(ctx, px + i, py + h, 1, 2, m.espuma);
        }
      } else {
        // No corpo da água, riscos claros que andam devagar. Sem eles o mar
        // é um retângulo azul de trinta tiles.
        const o = (tempo * 9 + ty * 13) % 48;
        for (let i = 0; i < 2; i++) {
          const rx = px + ((tx * 7 + i * 9 + Math.floor(o)) % T);
          ret(ctx, rx, py + 4 + i * 7, 3, 1, m.cima);
        }
      }
    }
  }
}
