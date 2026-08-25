// entrada.js — teclado e mouse.
//
// Duas listas: o que esta apertado AGORA e o que foi apertado NESTE quadro.
// A segunda e limpa no fim de cada quadro pelo laco principal. Menu usa a
// segunda; a cobra usa as duas (segurar seta continua valendo).
//
// A fila de direcoes existe porque a cobra so vira quando o passo acontece.
// Sem fila, uma curva rapida em L (cima+direita em 40ms) perde a segunda
// tecla e o jogador jura que o jogo ignorou o comando dele.

import { gfx } from './gfx.js';

const MAPA = {
  ArrowUp: 'cima', KeyW: 'cima',
  ArrowDown: 'baixo', KeyS: 'baixo',
  ArrowLeft: 'esquerda', KeyA: 'esquerda',
  ArrowRight: 'direita', KeyD: 'direita',
  Space: 'bote', ShiftLeft: 'bote', ShiftRight: 'bote',
  KeyE: 'cuspe',
  KeyQ: 'furia',
  Escape: 'menu', KeyP: 'menu',
  Enter: 'confirma', NumpadEnter: 'confirma',
  KeyM: 'mudo',
  KeyR: 'recomecar',
  F1: 'depurar',
  Digit1: 'op1', Digit2: 'op2', Digit3: 'op3',
  Tab: 'mapa',
};

const NAO_ROLAR = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'F1',
]);

class Entrada {
  constructor() {
    this.ativas = new Set();
    this.novas = new Set();
    this.soltas = new Set();
    this.fila = [];              // direcoes bufferizadas para a cobra
    this.mouse = { x: 480, y: 270, dentro: false, movimentoX: 0, movimentoY: 0 };
    this.botoes = [false, false, false];
    this.cliques = [];           // {x, y, botao} deste quadro
    this.qualquerTecla = false;
    this.roda = 0;
  }

  iniciar() {
    window.addEventListener('keydown', (e) => {
      if (NAO_ROLAR.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      const a = MAPA[e.code];
      this.qualquerTecla = true;
      if (!a) return;
      if (!this.ativas.has(a)) this.novas.add(a);
      this.ativas.add(a);
      if (a === 'cima' || a === 'baixo' || a === 'esquerda' || a === 'direita') {
        if (this.fila.length < 3) this.fila.push(a);
      }
    });

    window.addEventListener('keyup', (e) => {
      const a = MAPA[e.code];
      if (!a) return;
      this.ativas.delete(a);
      this.soltas.add(a);
    });

    window.addEventListener('mousemove', (e) => {
      const p = gfx.paraLogico(e.clientX, e.clientY);
      this.mouse.movimentoX = p.x - this.mouse.x;
      this.mouse.movimentoY = p.y - this.mouse.y;
      this.mouse.x = p.x; this.mouse.y = p.y;
      this.mouse.dentro = true;
    });

    window.addEventListener('mousedown', (e) => {
      const p = gfx.paraLogico(e.clientX, e.clientY);
      this.mouse.x = p.x; this.mouse.y = p.y;
      this.botoes[e.button] = true;
      this.cliques.push({ x: p.x, y: p.y, botao: e.button });
      this.qualquerTecla = true;
      if (e.button === 2) e.preventDefault();
    });

    window.addEventListener('mouseup', (e) => { this.botoes[e.button] = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { this.roda += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('blur', () => { this.ativas.clear(); this.botoes = [false, false, false]; });
  }

  ativa(a) { return this.ativas.has(a); }
  nova(a) { return this.novas.has(a); }
  solta(a) { return this.soltas.has(a); }
  proximaDirecao() { return this.fila.shift() || null; }
  limparFila() { this.fila.length = 0; }

  fimDoQuadro() {
    this.novas.clear();
    this.soltas.clear();
    this.cliques.length = 0;
    this.qualquerTecla = false;
    this.roda = 0;
    this.mouse.movimentoX = 0;
    this.mouse.movimentoY = 0;
  }
}

export const entrada = new Entrada();
