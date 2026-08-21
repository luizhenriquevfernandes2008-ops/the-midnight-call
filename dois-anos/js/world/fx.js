// fx.js — partículas: as do ar (sempre presentes) e as de acontecimento.
//
// Tudo aqui é pool de tamanho fixo. Alocar objeto por partícula a 60 fps
// põe o coletor de lixo para trabalhar e o jogo engasga de segundo em
// segundo — o tipo de travadinha que ninguém consegue explicar depois.

import { mulberry32, clamp, VW, VH } from '../core/gfx.js';
import { ret, disco, coracao } from '../art/pixel.js';
import { COR } from '../art/paleta.js';

const MAX = 260;

export class Particulas {
  constructor() {
    this.p = [];
    for (let i = 0; i < MAX; i++) {
      this.p.push({ vivo: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, dur: 1,
        cor: '#fff', tam: 1, grav: 0, tipo: 'quad', giro: 0, rot: 0 });
    }
    this.i = 0;
  }

  soltar(o) {
    // Pool circular: se estourar, a mais velha morre. Melhor perder uma
    // faísca do que alocar no meio do quadro.
    for (let k = 0; k < MAX; k++) {
      const p = this.p[this.i];
      this.i = (this.i + 1) % MAX;
      if (p.vivo && k < MAX - 1) continue;
      p.vivo = true; p.t = 0;
      p.x = o.x; p.y = o.y;
      p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.dur = o.dur || 0.6;
      p.cor = o.cor || '#ffffff';
      p.tam = o.tam || 1;
      p.grav = o.grav === undefined ? 220 : o.grav;
      p.tipo = o.tipo || 'quad';
      p.rot = o.rot || 0;
      p.giro = o.giro || 0;
      return p;
    }
  }

  atualizar(dt) {
    for (const p of this.p) {
      if (!p.vivo) continue;
      p.t += dt;
      if (p.t >= p.dur) { p.vivo = false; continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.giro * dt;
    }
  }

  desenhar(ctx, camX, camY) {
    for (const p of this.p) {
      if (!p.vivo) continue;
      const k = 1 - p.t / p.dur;
      const x = Math.round(p.x - camX), y = Math.round(p.y - camY);
      if (x < -20 || x > VW + 20 || y < -20 || y > VH + 20) continue;
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * clamp(k * 1.6, 0, 1);
      if (p.tipo === 'coracao') {
        coracao(ctx, x, y, Math.max(3, p.tam * 3 * k), p.cor, COR.coracaoHi);
      } else if (p.tipo === 'disco') {
        disco(ctx, x, y, Math.max(1, p.tam * k), p.cor);
      } else if (p.tipo === 'faixa') {
        ret(ctx, x, y, 1, Math.max(1, p.tam * 3), p.cor);
      } else {
        const s = Math.max(1, Math.round(p.tam * k));
        ret(ctx, x - (s >> 1), y - (s >> 1), s, s, p.cor);
      }
      ctx.globalAlpha = a0;
    }
  }

  // --- receitas prontas ----------------------------------------------------

  poeira(x, y, n = 6, cor = '#ffffff') {
    for (let i = 0; i < n; i++) {
      this.soltar({ x, y, vx: (Math.random() * 2 - 1) * 46, vy: -Math.random() * 40,
        dur: 0.34 + Math.random() * 0.2, cor, tam: 2, grav: 160 });
    }
  }

  pulo(x, y, cor = '#ffffff') {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + Math.random() * Math.PI;
      this.soltar({ x, y, vx: Math.cos(a) * 60, vy: Math.abs(Math.sin(a)) * -18,
        dur: 0.3, cor, tam: 2, grav: 100 });
    }
  }

  brilho(x, y, n = 10, cores = ['#fff6c9', '#ffe98a', '#ffffff']) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 80;
      this.soltar({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        dur: 0.5 + Math.random() * 0.4, cor: cores[i % cores.length],
        tam: 2 + Math.random() * 2, grav: 30, tipo: 'disco' });
    }
  }

  coracoes(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
      const v = 50 + Math.random() * 60;
      this.soltar({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        dur: 0.8 + Math.random() * 0.4, cor: COR.coracao, tam: 2, grav: 90,
        tipo: 'coracao' });
    }
  }

  confete(x, y, n = 30) {
    const cores = ['#ff6b8a', '#ffd45f', '#5fe0ff', '#9fe08a', '#c398f0', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 90 + Math.random() * 140;
      this.soltar({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        dur: 1.2 + Math.random() * 0.8, cor: cores[(Math.random() * cores.length) | 0],
        tam: 3, grav: 190 });
    }
  }
}

// ---------------------------------------------------------------------------
// o ar da fase — pétala, vaga-lume, chuva, estrela cadente
// ---------------------------------------------------------------------------
// Estas não vivem no pool: são um número fixo de partículas que dão a volta
// na tela para sempre. Como elas nunca morrem, o custo é constante e
// previsível, e a tela nunca fica vazia.

export class Ambiente {
  constructor(tema) {
    this.tema = tema;
    this.tipo = tema.particula;
    this.tempo = 0;
    const n = this.tipo === 'chuva' ? 150 : this.tipo === 'estrelas' ? 60 : 46;
    const rnd = mulberry32(0xB00);
    this.p = [];
    for (let i = 0; i < n; i++) {
      this.p.push({
        x: rnd() * VW, y: rnd() * VH,
        vx: 0, vy: 0, f: rnd(), fase: rnd() * 6.28,
        cor: tema.corParticula[(rnd() * tema.corParticula.length) | 0],
        tam: 1 + Math.floor(rnd() * 2),
      });
    }
  }

  atualizar(dt, camX, camY) {
    this.tempo += dt;
    const t = this.tema;
    for (const p of this.p) {
      if (this.tipo === 'chuva') {
        p.x += (t.vento + p.f * 30) * dt * 3;
        p.y += (300 + p.f * 200) * dt;
      } else if (this.tipo === 'vagalumes') {
        p.x += Math.cos(this.tempo * 0.7 + p.fase) * 12 * dt + t.vento * dt;
        p.y += Math.sin(this.tempo * 1.1 + p.fase * 1.7) * 14 * dt;
      } else if (this.tipo === 'petalas') {
        p.x += (t.vento + Math.sin(this.tempo + p.fase) * 8) * dt;
        p.y += (10 + p.f * 14) * dt;
      } else {
        p.x += t.vento * 0.2 * dt;
      }
      // Enrola nas bordas da TELA, não do mundo: como a partícula é
      // desenhada em coordenadas de tela, ela acompanha a câmera de graça.
      if (p.x > VW + 8) { p.x = -8; p.y = Math.random() * VH; }
      if (p.x < -8) { p.x = VW + 8; p.y = Math.random() * VH; }
      if (p.y > VH + 8) { p.y = -8; p.x = Math.random() * VW; }
      if (p.y < -8) p.y = VH + 8;
    }
  }

  desenhar(ctx) {
    const a0 = ctx.globalAlpha;
    for (const p of this.p) {
      const x = Math.round(p.x), y = Math.round(p.y);
      if (this.tipo === 'chuva') {
        ctx.globalAlpha = 0.42 + p.f * 0.3;
        ret(ctx, x, y, 1, 5 + p.f * 4, p.cor);
      } else if (this.tipo === 'vagalumes') {
        const pisca = 0.35 + 0.65 * Math.abs(Math.sin(this.tempo * 1.6 + p.fase));
        ctx.globalAlpha = pisca;
        ret(ctx, x, y, 2, 2, p.cor);
      } else if (this.tipo === 'estrelas') {
        const pisca = 0.4 + 0.6 * Math.abs(Math.sin(this.tempo * 2.2 + p.fase));
        ctx.globalAlpha = pisca * 0.9;
        ret(ctx, x, y, p.tam, p.tam, p.cor);
      } else {
        ctx.globalAlpha = 0.7;
        ret(ctx, x, y, 2, 2, p.cor);
      }
    }
    ctx.globalAlpha = a0;
  }

  // As luzes que os vaga-lumes jogam no buffer de luz da floresta.
  luzes(gfx) {
    if (this.tipo !== 'vagalumes') return;
    for (const p of this.p) {
      const pisca = 0.35 + 0.65 * Math.abs(Math.sin(this.tempo * 1.6 + p.fase));
      // Cada vaga-lume é uma luz minúscula. São quarenta e tantos deles: o
      // que importa é o conjunto, e força individual alta estoura a cena.
      gfx.luz(p.x, p.y, 9 + p.f * 5, p.cor, 0.22 * pisca);
    }
  }
}
