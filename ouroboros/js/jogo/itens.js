// itens.js — o que fica no chao esperando ser engolido.
//
// Alma e comida e experiencia ao mesmo tempo: cresce o corpo e enche a
// barra de nivel. Coracao e raro e cura. Essencia e a moeda que sobrevive a
// morte — e a unica coisa aqui que sai da corrida.

import { TAU, dist } from '../nucleo/util.js';

export class Item {
  constructor(op) {
    Object.assign(this, {
      tipo: 'alma', cx: 0, cy: 0, valor: 1, x: 0, y: 0,
      fase: Math.random() * TAU, morto: false, vida: 0, atraido: false,
    }, op);
  }

  atualizar(dt, jogo) {
    this.vida += dt;
    const arena = jogo.arena;
    if (!this.x) { this.x = arena.px(this.cx); this.y = arena.py(this.cy); }

    const c = jogo.cobra;
    if (!c.viva) return;
    const cab = c.brilhoCabeca(arena);
    const d = dist(this.x, this.y, cab.x, cab.y);
    const raio = (jogo.corrida.atributos.raioColeta || 0) * arena.celula;

    if (raio > 0 && d < raio) {
      this.atraido = true;
      const f = Math.min(1, dt * (4 + (raio - d) / arena.celula));
      this.x += (cab.x - this.x) * f;
      this.y += (cab.y - this.y) * f;
    }

    if (d < arena.celula * 0.62) { jogo.recolher(this); return; }
    // tambem pega por celula, para nao escapar em velocidade alta
    const meuCx = arena.celulaEmX(this.x), meuCy = arena.celulaEmY(this.y);
    const cabCx = c.cabeca.cx, cabCy = c.cabeca.cy;
    if (meuCx === cabCx && meuCy === cabCy) jogo.recolher(this);
  }

  desenhar(ctx, arena, tempo) {
    const sobe = Math.sin(tempo * 2.4 + this.fase) * 2.4;
    const x = this.x || arena.px(this.cx);
    const y = (this.y || arena.py(this.cy)) + sobe;
    const pulso = 0.75 + 0.25 * Math.sin(tempo * 4 + this.fase);

    let cor = '#8affb0', corGlow = 'rgba(90,255,170,ALFA)', raio = 5.2;
    if (this.tipo === 'coracao') { cor = '#ff6a8a'; corGlow = 'rgba(255,90,120,ALFA)'; raio = 6.5; }
    else if (this.tipo === 'essencia') { cor = '#ffd07a'; corGlow = 'rgba(255,200,110,ALFA)'; raio = 5.5; }
    else if (this.tipo === 'banquete') { cor = '#c9ff7a'; corGlow = 'rgba(190,255,120,ALFA)'; raio = 8.5; }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, raio * 3.4 * pulso);
    g.addColorStop(0, corGlow.replace('ALFA', '0.55'));
    g.addColorStop(1, corGlow.replace('ALFA', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(x - raio * 3.4, y - raio * 3.4, raio * 6.8, raio * 6.8);
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    if (this.tipo === 'coracao') {
      ctx.fillStyle = cor;
      ctx.scale(raio / 8, raio / 8);
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.bezierCurveTo(-9, 0, -5, -7, 0, -2.6);
      ctx.bezierCurveTo(5, -7, 9, 0, 0, 6);
      ctx.fill();
    } else {
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.ellipse(0, 0, raio * pulso, raio * 1.25 * pulso, Math.sin(tempo + this.fase) * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(-raio * 0.28, -raio * 0.42, raio * 0.28, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
