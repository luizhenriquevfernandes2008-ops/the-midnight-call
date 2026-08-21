// input.js — teclado e controle atrás de nomes de ação.
// Nenhum sistema pergunta por 'KeyD'; pergunta por 'right'.
//
// O controle entra aqui e não em cada sistema porque um jogo de plataforma
// vive de `pressed()` e `released()` — pulo variável depende de saber o
// quadro exato em que o botão subiu. Fazer isso espalhado dá bug garantido.

const TECLAS = {
  left:      ['ArrowLeft', 'KeyA'],
  right:     ['ArrowRight', 'KeyD'],
  up:        ['ArrowUp', 'KeyW'],
  down:      ['ArrowDown', 'KeyS'],
  jump:      ['Space', 'KeyZ', 'ArrowUp', 'KeyW'],
  run:       ['ShiftLeft', 'ShiftRight', 'KeyX'],
  confirm:   ['Enter', 'NumpadEnter', 'Space', 'KeyZ'],
  cancel:    ['Escape', 'Backspace', 'KeyX'],
  pause:     ['Escape', 'KeyP'],
  album:     ['Tab', 'KeyQ'],
  skip:      ['Escape', 'Enter'],
  menuUp:    ['ArrowUp', 'KeyW'],
  menuDown:  ['ArrowDown', 'KeyS'],
  menuLeft:  ['ArrowLeft', 'KeyA'],
  menuRight: ['ArrowRight', 'KeyD'],
  sortear:   ['KeyR'],
  debug:     ['F1'],
};

// Índices do mapeamento padrão de gamepad ("standard"), que é o que Xbox e
// PlayStation entregam no navegador.
const BOTOES = {
  jump:      [0],            // A / X
  confirm:   [0],
  cancel:    [1],            // B / círculo
  run:       [2, 5, 7],      // X / quadrado, RB, RT
  pause:     [9],            // start
  album:     [8],            // select
  up:        [12],
  down:      [13],
  left:      [14],
  right:     [15],
  menuUp:    [12],
  menuDown:  [13],
  menuLeft:  [14],
  menuRight: [15],
};

class Input {
  constructor() {
    this.down = new Set();
    this.pressedFrame = new Set();
    this.releasedFrame = new Set();
    this.heldTime = new Map();
    this.padDown = new Set();
    this.padPressed = new Set();
    this.padReleased = new Set();
    this.padEixo = 0;
    this.qualquerTecla = false;
    this.ultimo = 'teclado';
  }

  init() {
    window.addEventListener('keydown', e => {
      if (!['F5', 'F12', 'F11'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressedFrame.add(e.code);
      this.heldTime.set(e.code, 0);
      this.qualquerTecla = true;
      this.ultimo = 'teclado';
    });
    window.addEventListener('keyup', e => {
      this.down.delete(e.code);
      this.releasedFrame.add(e.code);
      this.heldTime.delete(e.code);
    });
    // Sair da aba com a tecla apertada deixaria o personagem correndo pra
    // sempre. Perder o foco solta tudo.
    window.addEventListener('blur', () => { this.down.clear(); this.heldTime.clear(); });
    window.addEventListener('contextmenu', e => e.preventDefault());
    return this;
  }

  update(dt) {
    for (const [k] of this.heldTime) this.heldTime.set(k, this.heldTime.get(k) + dt);
    this._lerControle();
  }

  _lerControle() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    const antes = this.padDown;
    const agora = new Set();
    this.padEixo = 0;
    if (pad) {
      for (let i = 0; i < pad.buttons.length; i++) {
        if (pad.buttons[i] && pad.buttons[i].pressed) agora.add(i);
      }
      // Zona morta generosa: analógico de controle usado descansa em 0.08.
      const ax = pad.axes[0] || 0;
      if (Math.abs(ax) > 0.28) this.padEixo = ax;
      if (agora.size || this.padEixo) this.ultimo = 'controle';
    }
    this.padPressed.clear();
    this.padReleased.clear();
    for (const b of agora) if (!antes.has(b)) { this.padPressed.add(b); this.qualquerTecla = true; }
    for (const b of antes) if (!agora.has(b)) this.padReleased.add(b);
    this.padDown = agora;
  }

  flush() {
    this.pressedFrame.clear();
    this.releasedFrame.clear();
    this.qualquerTecla = false;
  }

  isDown(acao) {
    const ks = TECLAS[acao];
    if (ks) for (const k of ks) if (this.down.has(k)) return true;
    const bs = BOTOES[acao];
    if (bs) for (const b of bs) if (this.padDown.has(b)) return true;
    if (acao === 'left' && this.padEixo < -0.28) return true;
    if (acao === 'right' && this.padEixo > 0.28) return true;
    return false;
  }

  pressed(acao) {
    const ks = TECLAS[acao];
    if (ks) for (const k of ks) if (this.pressedFrame.has(k)) return true;
    const bs = BOTOES[acao];
    if (bs) for (const b of bs) if (this.padPressed.has(b)) return true;
    return false;
  }

  released(acao) {
    const ks = TECLAS[acao];
    if (ks) for (const k of ks) if (this.releasedFrame.has(k)) return true;
    const bs = BOTOES[acao];
    if (bs) for (const b of bs) if (this.padReleased.has(b)) return true;
    return false;
  }

  held(acao) {
    const ks = TECLAS[acao];
    if (!ks) return 0;
    let m = 0;
    for (const k of ks) { const t = this.heldTime.get(k); if (t !== undefined && t > m) m = t; }
    return m;
  }

  eixoX() {
    if (this.padEixo) return this.padEixo;
    return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
  }
}

export const input = new Input();
export default input;
