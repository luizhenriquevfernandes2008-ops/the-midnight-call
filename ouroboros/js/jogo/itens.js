// itens.js — o que fica no chao esperando ser engolido.
//
// Alma e comida e experiencia ao mesmo tempo: cresce o corpo e enche a
// barra de nivel. Coracao e raro e cura. Essencia e a moeda que sobrevive a
// morte — e a unica coisa aqui que sai da corrida.

import { TAU, dist } from '../nucleo/util.js';
import { luz, sombraChao, anelPremio, pintar, clarear, CONTORNO } from '../arte/pincel.js';

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

  // Item nunca pode ser confundido com bicho. Tres coisas garantem isso:
  //   - ele FLUTUA: sobe e desce acima de uma sombrinha parada no chao;
  //   - o anel do chao FECHA para dentro (o de bicho abre para fora);
  //   - a cor e sempre fria ou rosa, nunca laranja/vermelho de ameaca.
  desenhar(ctx, arena, tempo) {
    const c = arena.celula;
    const sobe = Math.sin(tempo * 2.6 + this.fase) * c * 0.13 - c * 0.16;
    const x = this.x || arena.px(this.cx);
    const chao = (this.y || arena.py(this.cy));
    const y = chao + sobe;
    const pulso = 0.8 + 0.2 * Math.sin(tempo * 4.5 + this.fase);

    let cor = '#5ce08a', aceso = '#c8ffd8', raio = c * 0.24;
    if (this.tipo === 'coracao') { cor = '#ff5a80'; aceso = '#ffc0d0'; raio = c * 0.27; }
    else if (this.tipo === 'essencia') { cor = '#ffc24a'; aceso = '#fff0c0'; raio = c * 0.25; }
    else if (this.tipo === 'banquete') { cor = '#9cff5a'; aceso = '#e0ffc0'; raio = c * 0.36; }

    ctx.save();
    sombraChao(ctx, x, chao + c * 0.3, raio * 1.1, raio * 0.42, 0.6);
    anelPremio(ctx, x, chao + c * 0.3, raio * 1.5, cor, tempo, this.fase);
    luz(ctx, x, y, raio * 3.1 * pulso, cor, 0.34);

    ctx.translate(x, y);
    const traco = Math.max(1.8, c * 0.075);

    if (this.tipo === 'coracao') {
      const bate = 1 + 0.09 * Math.sin(tempo * 7 + this.fase);
      ctx.scale(bate, bate);
      ctx.beginPath();
      ctx.moveTo(0, raio * 0.95);
      ctx.bezierCurveTo(-raio * 1.7, -raio * 0.1, -raio * 0.9, -raio * 1.25, 0, -raio * 0.45);
      ctx.bezierCurveTo(raio * 0.9, -raio * 1.25, raio * 1.7, -raio * 0.1, 0, raio * 0.95);
      ctx.closePath();
      pintar(ctx, cor, CONTORNO, traco);
      ctx.beginPath();
      ctx.ellipse(-raio * 0.42, -raio * 0.42, raio * 0.22, raio * 0.16, -0.6, 0, TAU);
      ctx.fillStyle = aceso; ctx.fill();
    } else if (this.tipo === 'essencia') {
      // gema de seis lados: forma dura, so dela, para ler "moeda"
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU - Math.PI / 2;
        const px = Math.cos(a) * raio, py = Math.sin(a) * raio * 1.15;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      pintar(ctx, cor, CONTORNO, traco);
      ctx.beginPath();
      ctx.moveTo(0, -raio * 1.15); ctx.lineTo(raio * 0.5, -raio * 0.2); ctx.lineTo(0, raio * 0.2);
      ctx.closePath();
      ctx.fillStyle = clarear(cor, 0.45); ctx.fill();
    } else {
      // alma: chama fria, ponta para cima, com nucleo aceso
      ctx.beginPath();
      ctx.moveTo(0, -raio * 1.5);
      ctx.quadraticCurveTo(raio * 1.05, -raio * 0.25, raio * 0.55, raio * 0.6);
      ctx.quadraticCurveTo(raio * 0.2, raio * 1.15, 0, raio * 0.95);
      ctx.quadraticCurveTo(-raio * 0.2, raio * 1.15, -raio * 0.55, raio * 0.6);
      ctx.quadraticCurveTo(-raio * 1.05, -raio * 0.25, 0, -raio * 1.5);
      ctx.closePath();
      pintar(ctx, cor, CONTORNO, traco);
      ctx.beginPath();
      ctx.ellipse(0, raio * 0.28, raio * 0.34 * pulso, raio * 0.55 * pulso, 0, 0, TAU);
      ctx.fillStyle = aceso; ctx.fill();
    }

    // faisquinha girando: diz "pegue-me" sem escrever nada
    const a = tempo * 2.2 + this.fase;
    ctx.fillStyle = aceso;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(tempo * 6 + this.fase);
    ctx.fillRect(Math.cos(a) * raio * 1.6 - 1, Math.sin(a) * raio * 1.6 - 1, 2.4, 2.4);
    ctx.restore();
  }
}
