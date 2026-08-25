// projeteis.js — cuspe, bile, faisca de chefe.
//
// Projetil anda em coordenada continua (nao em celula): ele nao e um bicho,
// e uma coisa rapida passando. So a colisao consulta a grade.

import { TAU } from '../nucleo/util.js';

export class Projetil {
  constructor(op) {
    Object.assign(this, {
      x: 0, y: 0, dx: 1, dy: 0, velocidade: 8, dano: 2, alcance: 20,
      dono: 'inimigo', cor: '#9cff7a', raio: 5, veneno: false,
      atravessaParede: false, girar: 0, morto: false, viajado: 0, cauda: [],
    }, op);
    const n = Math.hypot(this.dx, this.dy) || 1;
    this.dx /= n; this.dy /= n;
  }

  atualizar(dt, jogo) {
    const arena = jogo.arena;
    const passo = this.velocidade * arena.celula * dt;
    this.cauda.unshift({ x: this.x, y: this.y });
    if (this.cauda.length > 7) this.cauda.pop();
    this.x += this.dx * passo;
    this.y += this.dy * passo;
    this.viajado += passo / arena.celula;
    this.girar += dt * 9;

    const cx = arena.celulaEmX(this.x), cy = arena.celulaEmY(this.y);
    if (!this.atravessaParede && arena.parede(cx, cy)) {
      this.morto = true;
      jogo.fx.emitir(this.x, this.y, { n: 6, cor: this.cor, vel: 70, vida: 0.3, tam: 2.4 });
      return;
    }
    if (this.viajado > this.alcance) { this.morto = true; return; }

    if (this.dono === 'cobra') {
      const alvo = jogo.inimigoEm(cx, cy) || jogo.chefeEm(cx, cy);
      if (alvo) {
        jogo.ferirInimigo(alvo, this.dano, 'cuspe', this.x, this.y);
        if (this.veneno) jogo.envenenar(alvo, this.dano * 0.5, 3);
        this.morto = true;
      }
    } else {
      const c = jogo.cobra;
      if (c.viva) {
        const idx = c.ocupa(cx, cy, false);
        if (idx === 0 || (idx > 0 && idx < 3)) {
          c.levarDano(jogo, this.dano, 'tiro');
          this.morto = true;
        } else if (idx > 0 && jogo.corrida.tem('cauda_espinhosa')) {
          this.morto = true;
        }
      }
    }
  }

  desenhar(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.cauda.length - 1; i >= 0; i--) {
      const p = this.cauda[i];
      const a = (1 - i / this.cauda.length) * 0.45;
      ctx.globalAlpha = a;
      ctx.fillStyle = this.cor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.raio * (1 - i / this.cauda.length) * 0.9, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.cor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.raio, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(this.x - this.dx * 1.5, this.y - this.dy * 1.5, this.raio * 0.42, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
