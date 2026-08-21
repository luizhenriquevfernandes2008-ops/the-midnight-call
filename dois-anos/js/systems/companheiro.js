// companheiro.js — ele, depois de solto, andando atrás dela.
//
// Ele NÃO tem física própria. Ele anda por cima do rastro dela: o jogo
// guarda por onde ela passou e ele fica sempre a uma distância fixa atrás,
// nesse mesmo caminho. Isso resolve de graça o problema difícil (ele nunca
// fica preso numa quina, nunca cai num buraco, nunca atravessa parede) e
// resolve bonito o problema fácil (ele pula onde ela pulou, com atraso —
// que é exatamente o que a gente espera de alguém seguindo alguém).
//
// A solidez sobe a cada resgate. No primeiro mundo ele é quase transparente;
// no quarto, inteiro. É o progresso do jogo virando imagem, sem barra e sem
// número.

import { clamp, lerp } from '../core/gfx.js';
import { Boneco } from '../art/rig.js';

const DIST = 26;          // pixels atrás dela
const MAX_RASTRO = 260;

export class Companheiro {
  constructor(look) {
    this.rig = new Boneco(look);
    this.rastro = [];
    this.x = 0; this.y = 0;
    this.olhar = 1;
    this.vx = 0;
    this.ativo = false;
    this.solidez = 0;
    this.solidezAlvo = 0;
  }

  definirAparencia(look) { this.rig.definirAparencia(look); }

  ligar(x, y, solidez) {
    this.ativo = true;
    this.x = x; this.y = y;
    this.rastro.length = 0;
    this.solidezAlvo = solidez;
  }

  desligar() { this.ativo = false; this.rastro.length = 0; }

  atualizar(dt, jogador) {
    this.solidez = lerp(this.solidez, this.solidezAlvo, 1 - Math.pow(0.02, dt));
    if (!this.ativo) return;

    // amostra o rastro só quando ela andou de verdade
    const ult = this.rastro[0];
    if (!ult || Math.abs(ult.x - jogador.x) + Math.abs(ult.y - jogador.y) > 2) {
      this.rastro.unshift({ x: jogador.x, y: jogador.y, chao: jogador.noChao });
      if (this.rastro.length > MAX_RASTRO) this.rastro.pop();
    }

    // caminha pelo rastro somando distância até chegar em DIST
    let acumulado = 0;
    let alvo = null;
    for (let i = 1; i < this.rastro.length; i++) {
      const a = this.rastro[i - 1], b = this.rastro[i];
      acumulado += Math.hypot(a.x - b.x, a.y - b.y);
      if (acumulado >= DIST) { alvo = b; break; }
    }
    if (!alvo) alvo = this.rastro[this.rastro.length - 1] || { x: jogador.x, y: jogador.y, chao: true };

    const antesX = this.x;
    // Suavização por tempo, não por quadro: em 30 fps ele não fica para trás.
    const k = 1 - Math.pow(0.00002, dt);
    this.x = lerp(this.x, alvo.x, k);
    this.y = lerp(this.y, alvo.y, k);
    this.vx = (this.x - antesX) / Math.max(dt, 0.0001);
    if (Math.abs(this.vx) > 12) this.olhar = this.vx > 0 ? 1 : -1;

    const noChao = alvo.chao;
    if (!noChao) this.rig.tocar(this.y > (this.rastro[0] || alvo).y ? 'caindo' : 'pulando');
    else if (Math.abs(this.vx) > 110) { this.rig.tocar('correndo'); this.rig.velAnim = 1.1; }
    else if (Math.abs(this.vx) > 12) { this.rig.tocar('andando'); this.rig.velAnim = clamp(Math.abs(this.vx) / 92, 0.6, 1.4); }
    else { this.rig.tocar('parada'); this.rig.velAnim = 1; }

    this.rig.atualizar(dt, { ax: 0, vy: this.vx * 0.2 });
  }

  desenhar(ctx, camX, camY) {
    if (!this.ativo) return;
    this.rig.alpha = clamp(0.28 + this.solidez * 0.72, 0, 1);
    this.rig.desenhar(ctx, this.x - camX, this.y - camY, this.olhar);
    this.rig.alpha = 1;
  }
}

export default Companheiro;
