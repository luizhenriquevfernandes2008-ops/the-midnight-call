// inimigos.js — o comportamento dos bichos.
//
// Regras que valem para todos, e que existem para o jogo continuar sendo um
// presente e não uma prova:
//   - todo bicho anda dentro de um alcance em volta de onde nasceu. Nenhum
//     persegue a jogadora. Perseguição transforma exploração em correria.
//   - todo bicho morre pisado, de qualquer altura, e vira corações.
//   - encostar tira UM coração e empurra. Não existe dano que mate de uma vez.
//   - o que mata de verdade é buraco e espinho, que são culpa do pulo.

import { clamp } from '../core/gfx.js';
import { spriteBicho } from '../art/bichos.js';
import { desenhar } from '../art/pixel.js';
import { T } from '../world/tiles.js';
import { audio } from '../core/audio.js';

const PERFIS = {
  caranguejo:  { vel: 34, tipo: 'chao',  larg: 12, alt: 10, quadro: 0.22 },
  sombra:      { vel: 26, tipo: 'pulo',  larg: 12, alt: 9,  quadro: 0.3 },
  gaivota:     { vel: 52, tipo: 'voa',   larg: 13, alt: 7,  quadro: 0.16, onda: 10 },
  pombo:       { vel: 46, tipo: 'voa',   larg: 12, alt: 7,  quadro: 0.14, onda: 14 },
  vagalume:    { vel: 24, tipo: 'flutua', larg: 10, alt: 8, quadro: 0.5,  onda: 16, luz: true },
  guardachuva: { vel: 30, tipo: 'flutua', larg: 12, alt: 9, quadro: 0.34, onda: 20 },
  nuvenzinha:  { vel: 28, tipo: 'flutua', larg: 12, alt: 8, quadro: 0.4,  onda: 12 },
};

export class Inimigo {
  constructor(def) {
    this.tipo = def.tipo;
    this.perfil = PERFIS[def.tipo] || PERFIS.caranguejo;
    this.x0 = def.x; this.y0 = def.y;
    this.x = def.x; this.y = def.y;
    this.alcance = def.alcance || 3 * T;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.vy = 0;
    this.t = Math.random() * 10;
    this.quadro = 0;
    this.quadroT = 0;
    this.vivo = true;
    this.morte = 0;
    this.espera = 0;
  }

  get caixa() {
    const p = this.perfil;
    return { x0: this.x - p.larg / 2, x1: this.x + p.larg / 2,
             y0: this.y - p.alt, y1: this.y };
  }

  atualizar(dt, mapa) {
    if (!this.vivo) { this.morte -= dt; return; }
    this.t += dt;
    const p = this.perfil;

    this.quadroT += dt;
    if (this.quadroT >= p.quadro) { this.quadroT = 0; this.quadro ^= 1; }

    if (p.tipo === 'chao') {
      this.x += this.dir * p.vel * dt;
      // vira na ponta do alcance, na parede, ou na beirada do chão
      const frente = this.x + this.dir * (p.larg / 2 + 2);
      const tx = Math.floor(frente / T);
      const tyPe = Math.floor((this.y - 2) / T);
      const tyChao = Math.floor((this.y + 4) / T);
      if (Math.abs(this.x - this.x0) > this.alcance ||
          mapa.solido(tx, tyPe) ||
          !(mapa.solido(tx, tyChao) || mapa.plataforma(tx, tyChao))) {
        this.dir *= -1;
        this.x = clamp(this.x, this.x0 - this.alcance, this.x0 + this.alcance);
      }
      // cola no chão (a fase tem degraus)
      this.vy = Math.min(this.vy + 900 * dt, 400);
      this.y += this.vy * dt;
      const txc = Math.floor(this.x / T);
      const tyc = Math.floor(this.y / T);
      if (mapa.solido(txc, tyc) || mapa.plataforma(txc, tyc)) {
        this.y = tyc * T; this.vy = 0;
      }
    } else if (p.tipo === 'pulo') {
      this.vy = Math.min(this.vy + 900 * dt, 400);
      this.y += this.vy * dt;
      const txc = Math.floor(this.x / T);
      const tyc = Math.floor(this.y / T);
      const noChao = mapa.solido(txc, tyc) || mapa.plataforma(txc, tyc);
      if (noChao && this.vy > 0) {
        this.y = tyc * T; this.vy = 0;
        this.espera -= dt;
        if (this.espera <= 0) {
          // Pulinho anunciado: ele para, agacha e só então sai. Bicho que
          // salta sem aviso é armadilha, não inimigo.
          this.vy = -270;
          this.espera = 1.1 + Math.random() * 0.5;
          if (Math.abs(this.x - this.x0) > this.alcance) this.dir *= -1;
        }
      }
      if (this.vy !== 0) this.x += this.dir * p.vel * dt;
    } else {
      // voa / flutua: vaivém dentro do alcance, com uma onda por cima
      this.x += this.dir * p.vel * dt;
      if (Math.abs(this.x - this.x0) > this.alcance) {
        this.dir *= -1;
        this.x = clamp(this.x, this.x0 - this.alcance, this.x0 + this.alcance);
      }
      this.y = this.y0 + Math.sin(this.t * 1.6) * (p.onda || 10);
    }
  }

  morrer(fx) {
    this.vivo = false;
    this.morte = 0.5;
    if (fx) { fx.coracoes(this.x, this.y - 6, 5); fx.brilho(this.x, this.y - 6, 8); }
  }

  desenhar(ctx, camX, camY) {
    const spr = spriteBicho(this.tipo);
    const jogo = this.dir > 0 ? spr.dir : spr.esq;
    const s = jogo[this.quadro];
    const x = Math.round(this.x - camX), y = Math.round(this.y - camY);
    if (!this.vivo) {
      const k = clamp(this.morte / 0.5, 0, 1);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(x, y);
      ctx.scale(1 + (1 - k) * 0.6, Math.max(0.05, k));
      desenhar(ctx, s, 0, 0, 0, 1, 1);
      ctx.restore();
      return;
    }
    desenhar(ctx, s, x, y, 0, 1, 1);
  }

  luz(gfx, camX, camY) {
    if (!this.perfil.luz || !this.vivo) return;
    const pisca = 0.5 + 0.5 * Math.abs(Math.sin(this.t * 2.2));
    gfx.luz(this.x - camX, this.y - camY - 4, 20, '#d8ff9a', 0.38 * pisca);
  }
}

// ---------------------------------------------------------------------------
// resolve o encontro entre a jogadora e um bicho
// ---------------------------------------------------------------------------
export function resolverColisao(jogador, inimigo, fx) {
  if (!inimigo.vivo || jogador.morrendo > 0) return;
  const a = jogador.caixa, b = inimigo.caixa;
  if (a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1) return;

  // Pisão: ela tem que estar CAINDO e com os pés acima do meio do bicho. A
  // margem generosa (metade da altura) é de propósito — errar o pisão por
  // dois pixels e tomar dano é a coisa mais injusta que este gênero faz.
  const caindo = jogador.vy > 40;
  const pesAcima = a.y1 <= b.y0 + (b.y1 - b.y0) * 0.72;
  if (caindo && pesAcima) {
    inimigo.morrer(fx);
    jogador.quicar(fx);
    return 'pisao';
  }
  if (jogador.machucar(fx, 1)) return 'dano';
}
