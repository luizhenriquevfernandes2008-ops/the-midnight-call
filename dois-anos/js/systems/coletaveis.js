// coletaveis.js — coração, carta, bandeira, mola, plataforma móvel, gaiola.
//
// Tudo que fica parado na fase esperando ser tocado mora aqui, junto com o
// que se mexe mas não pensa (plataforma e nuvem frágil).
//
// Detalhe que parece bobo e não é: todo coletável flutua com uma senoide e
// tem sombra no chão? Não — tem BRILHO. A flutuação diz "isto é item, não é
// cenário", e é o que separa uma moeda de um tijolo amarelo.

import { clamp } from '../core/gfx.js';
import { ret, disco, coracao, aro } from '../art/pixel.js';
import { COR } from '../art/paleta.js';
import { T, FRAGIL } from '../world/tiles.js';
import { audio } from '../core/audio.js';

export class Item {
  constructor(def, i) {
    this.tipo = def.tipo;
    this.memoria = def.memoria || null;
    this.x = def.x; this.y = def.y;
    this.fase = i * 0.6;
    this.pego = false;
    this.anim = 0;
  }

  atualizar(dt, t) {
    this.t = t;
    if (this.pego) this.anim = Math.min(1, this.anim + dt * 2.6);
  }

  encostou(caixa) {
    if (this.pego) return false;
    const r = this.tipo === 'carta' ? 12 : 9;
    return !(caixa.x1 < this.x - r || caixa.x0 > this.x + r ||
             caixa.y1 < this.y - r || caixa.y0 > this.y + r);
  }

  desenhar(ctx, camX, camY, t) {
    if (this.pego && this.anim >= 1) return;
    const bob = Math.sin(t * 2.4 + this.fase) * 2.4;
    let x = Math.round(this.x - camX);
    let y = Math.round(this.y - camY + bob);
    const a0 = ctx.globalAlpha;
    if (this.pego) {
      // sobe e some
      y -= Math.round(this.anim * 22);
      ctx.globalAlpha = a0 * (1 - this.anim);
    }
    if (this.tipo === 'coracao') {
      const pulso = 1 + Math.sin(t * 5 + this.fase) * 0.08;
      coracao(ctx, x, y, 4 * pulso, COR.coracao, COR.coracaoHi);
    } else {
      this._carta(ctx, x, y, t);
    }
    ctx.globalAlpha = a0;
  }

  // Envelope: a carta é o item mais importante da fase, então ela é maior,
  // tem brilho girando atrás e um selo vermelho no meio.
  _carta(ctx, x, y, t) {
    const g = (Math.sin(t * 3 + this.fase) * 0.5 + 0.5);
    ctx.globalAlpha *= 0.35 + g * 0.3;
    disco(ctx, x, y, 11, COR.brilho);
    ctx.globalAlpha /= (0.35 + g * 0.3);
    ret(ctx, x - 8, y - 6, 16, 12, COR.linha);
    ret(ctx, x - 7, y - 5, 14, 10, COR.carta);
    ret(ctx, x - 7, y + 3, 14, 2, COR.cartaDk);
    // a aba do envelope, dois riscos em V
    for (let i = 0; i < 7; i++) {
      ret(ctx, x - 7 + i, y - 5 + i, 1, 1, COR.cartaDk);
      ret(ctx, x + 6 - i, y - 5 + i, 1, 1, COR.cartaDk);
    }
    coracao(ctx, x, y + 1, 3, COR.cartaSelo, null);
    // faísca girando
    const a = t * 2.2 + this.fase;
    ret(ctx, Math.round(x + Math.cos(a) * 13), Math.round(y + Math.sin(a) * 9), 2, 2, COR.faisca);
  }
}

// ---------------------------------------------------------------------------
export class Checkpoint {
  constructor(def) { this.x = def.x; this.y = def.y; this.pego = false; this.anim = 0; }

  encostou(caixa) {
    if (this.pego) return false;
    return !(caixa.x1 < this.x - 10 || caixa.x0 > this.x + 10 ||
             caixa.y1 < this.y - 40 || caixa.y0 > this.y + 4);
  }

  atualizar(dt) { if (this.pego) this.anim = Math.min(1, this.anim + dt * 3); }

  desenhar(ctx, camX, camY, t) {
    const x = Math.round(this.x - camX), y = Math.round(this.y - camY);
    // mastro
    ret(ctx, x - 1, y - 34, 2, 34, '#6b5039');
    ret(ctx, x - 1, y - 34, 1, 34, '#8a6440');
    ret(ctx, x - 4, y - 2, 8, 2, '#4a3527');
    if (!this.pego) {
      // bandeira murcha, cinza
      ret(ctx, x + 1, y - 33, 9, 7, '#9aa2b4');
      ret(ctx, x + 1, y - 33, 9, 1, '#c0c6d4');
    } else {
      // bandeira viva, tremulando
      const k = this.anim;
      for (let i = 0; i < 11; i++) {
        const oy = Math.round(Math.sin(t * 6 + i * 0.6) * 1.4 * k);
        ret(ctx, x + 1 + i, y - 34 + oy, 1, Math.round(3 + 5 * k), COR.coracao);
        ret(ctx, x + 1 + i, y - 34 + oy, 1, 1, COR.coracaoHi);
      }
      coracao(ctx, x + 6, y - 29, 3, COR.coracaoHi, null);
    }
  }
}

// ---------------------------------------------------------------------------
// A gaiola de luz onde ele está preso. É o fim de cada fase.
// ---------------------------------------------------------------------------
export class Gaiola {
  constructor(def) {
    this.x = def.x; this.y = def.y;
    this.aberta = false;
    this.anim = 0;
    this.t = 0;
  }

  encostou(caixa) {
    if (this.aberta) return false;
    return !(caixa.x1 < this.x - 18 || caixa.x0 > this.x + 18 ||
             caixa.y1 < this.y - 44 || caixa.y0 > this.y + 4);
  }

  abrir(fx) {
    if (this.aberta) return;
    this.aberta = true;
    this.anim = 0;
    audio.gaiolaAbrindo();
    if (fx) { fx.brilho(this.x, this.y - 22, 26, ['#8fe3ff', '#ffffff', '#c8f0ff']); }
  }

  atualizar(dt) { this.t += dt; if (this.aberta) this.anim = Math.min(1, this.anim + dt * 1.4); }

  desenhar(ctx, camX, camY, boneco) {
    const x = Math.round(this.x - camX), y = Math.round(this.y - camY);
    const flut = Math.sin(this.t * 1.3) * 2;
    const cy = y - 26 + flut;

    if (!this.aberta || this.anim < 1) {
      const k = this.aberta ? 1 - this.anim : 1;
      const a0 = ctx.globalAlpha;
      // bolha: dois aros e um miolo translúcido
      ctx.globalAlpha = a0 * 0.20 * k;
      disco(ctx, x, cy, 21 + (1 - k) * 16, COR.gaiola);
      ctx.globalAlpha = a0 * 0.85 * k;
      aro(ctx, x, cy, 21 + (1 - k) * 16, COR.gaiola);
      aro(ctx, x, cy, 20 + (1 - k) * 16, COR.gaiolaDk);
      // brilho girando na casca
      for (let i = 0; i < 3; i++) {
        const a = this.t * 1.1 + i * 2.1;
        const r = 21 + (1 - k) * 16;
        ret(ctx, Math.round(x + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 2, 2, '#ffffff');
      }
      ctx.globalAlpha = a0;
    }

    if (boneco) {
      // Ele fica translúcido: quanto mais pedaços dele já foram soltos, mais
      // sólido ele aparece. É o progresso do jogo virando imagem.
      boneco.desenhar(ctx, x, cy + 16, -1);
    }
  }

  luz(gfx, camX, camY) {
    const k = this.aberta ? 1 - this.anim * 0.4 : 1;
    gfx.luz(this.x - camX, this.y - camY - 26, 60, COR.gaiola, 0.9 * k);
  }
}

// ---------------------------------------------------------------------------
export function atualizarMoveis(moveis, dt) {
  for (const m of moveis) {
    m.t += dt * (m.vel / 40);
    const k = (Math.sin(m.t) + 1) / 2;
    const nx = m.x0 + m.dx * k;
    const ny = m.y0 + m.dy * k;
    // Guarda o deslocamento do quadro: é ele que o jogador soma à própria
    // posição para ser carregado junto, em vez de escorregar.
    m.ultimoDX = nx - m.x;
    m.ultimoDY = ny - m.y;
    m.x = nx; m.y = ny;
  }
}

export function desenharMovel(ctx, m, camX, camY, tema) {
  const p = tema.plataforma;
  const x = Math.round(m.x - camX), y = Math.round(m.y - camY);
  ret(ctx, x, y, m.w, 7, p.madeira);
  ret(ctx, x, y, m.w, 2, p.madeiraHi);
  ret(ctx, x, y + 6, m.w, 1, p.madeiraDk);
  ret(ctx, x, y, 1, 7, p.madeiraDk);
  ret(ctx, x + m.w - 1, y, 1, 7, p.madeiraDk);
  for (let i = 4; i < m.w - 3; i += 7) ret(ctx, x + i, y + 2, 1, 4, p.madeiraDk);
}

// A mola é uma espiral, não um bloco listrado. O que faz ela LER como mola
// é cada volta estar deslocada da anterior, e a chapa de cima ser larga e
// lisa: o olho entende "isso comprime" antes de a pessoa encostar.
export function desenharMola(ctx, m, camX, camY) {
  const x = Math.round(m.x - camX), y = Math.round(m.y - camY);
  const c = clamp(m.comp, 0, 1);
  const alt = 11 - Math.round(c * 6);
  const baseY = y + 16;

  ret(ctx, x, baseY - 2, 16, 2, '#8a5f38');
  ret(ctx, x, baseY - 3, 16, 1, '#a9743e');

  for (let i = 0; i < alt; i++) {
    const yy = baseY - 3 - i;
    const desloca = (i % 2) ? 2 : 0;
    ret(ctx, x + 2 + desloca, yy, 11, 1, i % 2 ? '#c9436f' : '#ff7ba8');
  }

  const topo = baseY - 4 - alt;
  ret(ctx, x, topo, 16, 4, '#ffd45f');
  ret(ctx, x, topo, 16, 1, '#fff0b0');
  ret(ctx, x, topo + 3, 16, 1, '#c9962a');
  ret(ctx, x + 1, topo + 1, 2, 2, '#fff6e0');
}

// Nuvem frágil: quando pisada, treme e some. Volta sozinha depois de um
// tempo — no céu, sumir para sempre significaria fase impossível.
export class Fragil {
  constructor(tx, ty) {
    this.tx = tx; this.ty = ty;
    this.x = tx * T; this.y = ty * T;
    this.vida = 1; this.tocado = 0; this.volta = 0;
  }
  atualizar(dt, mapa) {
    if (this.tocado > 0) {
      this.tocado -= dt;
      if (this.tocado <= 0) { this.vida = 0; this.volta = 2.4; mapa.por(this.tx, this.ty, 0); }
    } else if (this.volta > 0) {
      this.volta -= dt;
      if (this.volta <= 0) { this.vida = 1; mapa.por(this.tx, this.ty, FRAGIL); }
    }
  }
  desenhar(ctx, camX, camY, tema) {
    if (this.vida <= 0) return;
    const tremor = this.tocado > 0 ? Math.round(Math.sin(this.tocado * 50) * 1.5) : 0;
    const x = Math.round(this.x - camX) + tremor, y = Math.round(this.y - camY);
    const t = tema.terra;
    ret(ctx, x, y, T, 4, t.topo[0]);
    ret(ctx, x, y + 4, T, 3, t.topo[1]);
    ret(ctx, x, y + 6, T, 1, t.topoDk);
    disco(ctx, x + 4, y + 3, 4, t.topo[0]);
    disco(ctx, x + 12, y + 3, 4, t.topo[0]);
  }
}
