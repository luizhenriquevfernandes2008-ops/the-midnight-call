// fx.js — particula, onda de choque, numero subindo e tremor de tela.
//
// Nada aqui muda o jogo; tudo aqui muda como o jogo e sentido. Uma mordida
// sem faisca, sem tremor e sem o numero vermelho subindo parece um bug.

import { limita, TAU } from '../nucleo/util.js';

export class Fx {
  constructor() {
    this.particulas = [];
    this.textos = [];
    this.ondas = [];
    this.raios = [];
    this.tremor = 0;
    this.tremorX = 0;
    this.tremorY = 0;
    this.flash = 0;
    this.corFlash = '255,60,60';
    this.escalaTremor = 1;
  }

  limpar() {
    this.particulas.length = 0;
    this.textos.length = 0;
    this.ondas.length = 0;
    this.raios.length = 0;
    this.tremor = 0;
    this.flash = 0;
  }

  emitir(x, y, op = {}) {
    const {
      n = 8, cor = '#ff6a4a', vel = 90, velMin = 20, vida = 0.55, tam = 3,
      gravidade = 0, espalha = TAU, angulo = 0, brilho = true, atrito = 3.2,
    } = op;
    for (let i = 0; i < n; i++) {
      const a = angulo + (Math.random() - 0.5) * espalha;
      const v = velMin + Math.random() * (vel - velMin);
      this.particulas.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: vida * (0.6 + Math.random() * 0.7), vidaMax: vida,
        tam: tam * (0.6 + Math.random() * 0.8), cor, gravidade, brilho, atrito,
      });
    }
    if (this.particulas.length > 900) this.particulas.splice(0, this.particulas.length - 900);
  }

  texto(x, y, txt, cor = '#e8d8b8', op = {}) {
    this.textos.push({
      x, y, txt, cor,
      vida: op.vida || 0.9, vidaMax: op.vida || 0.9,
      tam: op.tam || 15, vy: op.vy ?? -34, peso: op.peso || 'bold',
      tremendo: op.tremendo || false,
    });
  }

  onda(x, y, raioMax, cor = '255,90,90', duracao = 0.5, larguraLinha = 3) {
    this.ondas.push({ x, y, r: 0, raioMax, cor, t: 0, duracao, larguraLinha });
  }

  raio(x1, y1, x2, y2, cor = '#ffd08a', vida = 0.18) {
    this.raios.push({ x1, y1, x2, y2, cor, vida, vidaMax: vida });
  }

  sacudir(forca) { this.tremor = Math.min(26, this.tremor + forca); }
  clarao(forca, cor = '255,60,60') { this.flash = Math.min(1, this.flash + forca); this.corFlash = cor; }

  atualizar(dt) {
    for (let i = this.particulas.length - 1; i >= 0; i--) {
      const p = this.particulas[i];
      p.vida -= dt;
      if (p.vida <= 0) { this.particulas.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravidade * dt;
      const f = 1 - Math.min(0.95, p.atrito * dt);
      p.vx *= f; p.vy *= f;
    }
    for (let i = this.textos.length - 1; i >= 0; i--) {
      const t = this.textos[i];
      t.vida -= dt;
      if (t.vida <= 0) { this.textos.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy *= 1 - dt * 1.8;
    }
    for (let i = this.ondas.length - 1; i >= 0; i--) {
      const o = this.ondas[i];
      o.t += dt;
      if (o.t >= o.duracao) { this.ondas.splice(i, 1); continue; }
      o.r = o.raioMax * (1 - Math.pow(1 - o.t / o.duracao, 2));
    }
    for (let i = this.raios.length - 1; i >= 0; i--) {
      this.raios[i].vida -= dt;
      if (this.raios[i].vida <= 0) this.raios.splice(i, 1);
    }

    this.tremor = Math.max(0, this.tremor - dt * 42);
    const f = this.tremor * this.escalaTremor;
    this.tremorX = (Math.random() - 0.5) * f;
    this.tremorY = (Math.random() - 0.5) * f;
    this.flash = Math.max(0, this.flash - dt * 3.4);
  }

  desenhar(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const o of this.ondas) {
      const a = 1 - o.t / o.duracao;
      ctx.strokeStyle = 'rgba(' + o.cor + ',' + (a * 0.8) + ')';
      ctx.lineWidth = o.larguraLinha * a + 0.5;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, TAU);
      ctx.stroke();
    }
    for (const r of this.raios) {
      const a = r.vida / r.vidaMax;
      ctx.strokeStyle = r.cor;
      ctx.globalAlpha = a;
      ctx.lineWidth = 2 + a * 3;
      ctx.beginPath();
      ctx.moveTo(r.x1, r.y1);
      ctx.lineTo(r.x2, r.y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const p of this.particulas) {
      const a = limita(p.vida / p.vidaMax, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.cor;
      const t = p.tam * (0.4 + a * 0.6);
      if (p.brilho) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, t, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - t / 2, p.y - t / 2, t, t);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    for (const t of this.textos) {
      const a = limita(t.vida / t.vidaMax, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = t.peso + ' ' + t.tam + 'px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const dx = t.tremendo ? (Math.random() - 0.5) * 3 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(t.txt, t.x + dx + 1, t.y + 1.5);
      ctx.fillStyle = t.cor;
      ctx.fillText(t.txt, t.x + dx, t.y);
      ctx.restore();
    }
  }

  desenharClarao(ctx, w, h) {
    if (this.flash <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(' + this.corFlash + ',' + (this.flash * 0.3) + ')';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
