// camera.js — segue a heroína sem enjoar o jogador.
//
// Três coisas que separam uma câmera boa de uma ruim num jogo de plataforma:
//   1. ZONA MORTA. A câmera não reage a movimento pequeno. Sem isso ela
//      treme junto com o ciclo de caminhada.
//   2. ANTECIPAÇÃO. Ela olha um pouco para o lado em que a personagem
//      está indo, e devolve a sobra da tela para onde o jogador precisa
//      enxergar — que é para a frente.
//   3. TRAVA VERTICAL. Enquanto os pés estão no chão, a câmera acompanha o
//      chão, não a personagem: pular não deve arrastar a tela para cima.

import { clamp, lerp, VW, VH } from '../core/gfx.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.alvoX = 0; this.alvoY = 0;
    this.limite = { x0: 0, y0: 0, x1: 1e9, y1: 1e9 };
    this.antecipa = 0;
    this.chaoY = 0;
    this.travada = false;
  }

  definirLimites(larguraPx, alturaPx) {
    this.limite = { x0: 0, y0: 0, x1: Math.max(VW, larguraPx), y1: Math.max(VH, alturaPx) };
  }

  irPara(x, y) {
    this.x = clamp(x - VW / 2, this.limite.x0, this.limite.x1 - VW);
    this.y = clamp(y - VH * 0.62, this.limite.y0, this.limite.y1 - VH);
    this.alvoX = this.x; this.alvoY = this.y;
  }

  seguir(p, dt) {
    // antecipação suave, pela velocidade
    const desejo = clamp(p.vx * 0.16, -46, 46);
    this.antecipa = lerp(this.antecipa, desejo, 1 - Math.pow(0.001, dt));

    const alvoX = p.x + this.antecipa - VW / 2;

    // Enquanto ela está no chão (ou caiu há pouco), a câmera mira a ALTURA
    // DO CHÃO, não a dela. Assim um pulo de 60 pixels não sacode a tela.
    if (p.noChao) this.chaoY = p.y;
    const alvoBase = p.noChao ? this.chaoY : Math.max(this.chaoY, p.y + 24);
    let alvoY = alvoBase - VH * 0.62;
    // ...mas se ela subiu muito (plataformas altas), a câmera vai atrás.
    if (p.y < this.y + VH * 0.28) alvoY = p.y - VH * 0.28;
    if (p.y > this.y + VH * 0.80) alvoY = p.y - VH * 0.80;

    const kx = 1 - Math.pow(0.0006, dt);
    const ky = 1 - Math.pow(0.004, dt);
    this.x = lerp(this.x, alvoX, kx);
    this.y = lerp(this.y, alvoY, ky);

    this.x = clamp(this.x, this.limite.x0, this.limite.x1 - VW);
    this.y = clamp(this.y, this.limite.y0, this.limite.y1 - VH);
  }

  // Arredondado só na hora de usar: guardar o valor inteiro faria a câmera
  // andar aos trancos em movimento lento.
  get px() { return Math.round(this.x); }
  get py() { return Math.round(this.y); }
}

export default Camera;
