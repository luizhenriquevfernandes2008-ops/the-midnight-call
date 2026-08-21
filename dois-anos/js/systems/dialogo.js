// dialogo.js — a caixa de fala e a carta aberta.
//
// Duas coisas diferentes de propósito:
//   DIÁLOGO  a conversa dos dois. Caixa embaixo, retrato do lado, texto
//            digitado letra por letra. Interrompível.
//   CARTA    uma memória coletada. Ocupa o meio da tela, o jogo para, e o
//            texto tem cara de papel — porque é o conteúdo pelo qual o
//            jogo inteiro existe, e ele não pode passar como legenda.

import { VW, VH, clamp, lerp, easeBack, easeOut } from '../core/gfx.js';
import { ret, disco, coracao } from '../art/pixel.js';
import { COR } from '../art/paleta.js';
import { text, quebrar, medir } from '../core/text.js';
import { audio } from '../core/audio.js';

const VEL_LETRA = 42;    // caracteres por segundo

export function caixa(ctx, x, y, w, h, corFundo = COR.uiCaixa, corBorda = COR.uiBorda) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  // Caixa com quina cortada: retângulo puro parece HTML, e o corte de um
  // pixel em cada canto já dá cara de jogo.
  ret(ctx, x + 1, y, w - 2, h, corFundo);
  ret(ctx, x, y + 1, w, h - 2, corFundo);
  ret(ctx, x + 2, y + 1, w - 4, 1, corBorda);
  ret(ctx, x + 2, y + h - 2, w - 4, 1, corBorda);
  ret(ctx, x + 1, y + 2, 1, h - 4, corBorda);
  ret(ctx, x + w - 2, y + 2, 1, h - 4, corBorda);
  ret(ctx, x + 2, y + 2, 1, 1, corBorda);
  ret(ctx, x + w - 3, y + 2, 1, 1, corBorda);
  ret(ctx, x + 2, y + h - 3, 1, 1, corBorda);
  ret(ctx, x + w - 3, y + h - 3, 1, 1, corBorda);
}

export class Dialogo {
  constructor() {
    this.fila = [];
    this.ativo = false;
    this.linha = null;
    this.mostrado = 0;
    this.entrada = 0;
    this.pisca = 0;
    this.aoFechar = null;
  }

  falar(linhas, aoFechar) {
    this.fila = linhas.slice();
    this.aoFechar = aoFechar || null;
    this._proxima();
    this.ativo = true;
    this.entrada = 0;
  }

  _proxima() {
    if (!this.fila.length) {
      this.ativo = false;
      this.linha = null;
      const cb = this.aoFechar; this.aoFechar = null;
      if (cb) cb();
      return;
    }
    this.linha = this.fila.shift();
    this.mostrado = 0;
    this.quebradas = quebrar(this.linha.texto, VW - 130, { size: 11, font: 'ui' });
    this.total = this.quebradas.join('\n').length;
  }

  atualizar(dt, entrada) {
    if (!this.ativo) return;
    this.entrada = Math.min(1, this.entrada + dt * 5);
    this.pisca += dt;
    const antes = Math.floor(this.mostrado);
    this.mostrado = Math.min(this.total, this.mostrado + VEL_LETRA * dt);
    if (Math.floor(this.mostrado) > antes && Math.floor(this.mostrado) % 2 === 0) audio.digitar();

    if (entrada.pressed('confirm') || entrada.pressed('jump')) {
      if (this.mostrado < this.total) this.mostrado = this.total;   // adianta
      else { audio.menuConfirma(); this._proxima(); }
    }
  }

  desenhar(ctx, bonecos, t) {
    if (!this.ativo || !this.linha) return;
    const k = easeOut(this.entrada);
    const h = 62;
    const y = VH - h - 8 + Math.round((1 - k) * 40);
    const x = 10, w = VW - 20;

    caixa(ctx, x, y, w, h);

    // retrato
    const b = bonecos[this.linha.quem];
    if (b) {
      ret(ctx, x + 6, y + 6, 44, 44, COR.uiCaixaDk);
      ret(ctx, x + 6, y + 6, 44, 1, COR.uiBorda);
      ret(ctx, x + 6, y + 49, 44, 1, COR.uiBorda);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 6, y + 6, 44, 44);
      ctx.clip();
      // A cabeça é desenhada grande e cortada pela moldura: assim o rosto
      // ocupa o quadro inteiro em vez de nadar no meio dele. A âncora está
      // deslocada porque o pivô do sprite é o PESCOÇO, não o centro do rosto.
      b.desenharCabeca(ctx, x + 20, y + 42, 2.6, this.linha.quem === 'ele' ? -1 : 1);
      ctx.restore();
    }

    const nome = this.linha.nome || '';
    if (nome) {
      text(ctx, nome, x + 58, y + 6, { size: 10, color: COR.uiDestaque, outline: 1 });
    }

    // texto digitado
    let restante = Math.floor(this.mostrado);
    let ly = y + (nome ? 20 : 12);
    for (const linha of this.quebradas) {
      if (restante <= 0) break;
      const pedaco = linha.slice(0, restante);
      restante -= linha.length;
      text(ctx, pedaco, x + 58, ly, { size: 11, color: COR.uiTexto, outline: 1 });
      ly += 14;
    }

    if (this.mostrado >= this.total && Math.sin(this.pisca * 6) > 0) {
      coracao(ctx, x + w - 14, y + h - 12, 3, COR.coracao, COR.coracaoHi);
    }
  }
}

// ---------------------------------------------------------------------------
// a carta aberta
// ---------------------------------------------------------------------------
export class CartaAberta {
  constructor() { this.ativa = false; this.memoria = null; this.t = 0; this.saindo = 0; }

  abrir(memoria) {
    this.memoria = memoria;
    this.ativa = true;
    this.t = 0;
    this.saindo = 0;
  }

  atualizar(dt, entrada) {
    if (!this.ativa) return false;
    this.t += dt;
    if (this.saindo > 0) {
      this.saindo += dt;
      if (this.saindo > 0.3) { this.ativa = false; return true; }
      return false;
    }
    if (this.t > 0.35 && (entrada.pressed('confirm') || entrada.pressed('jump') ||
        entrada.pressed('cancel'))) {
      this.saindo = 0.001;
      audio.menuConfirma();
    }
    return false;
  }

  desenhar(ctx) {
    if (!this.ativa || !this.memoria) return;
    const abrindo = clamp(this.t / 0.32, 0, 1);
    const k = this.saindo > 0 ? 1 - clamp(this.saindo / 0.3, 0, 1) : easeBack(abrindo);

    ctx.globalAlpha = 0.62 * clamp(k, 0, 1);
    ret(ctx, 0, 0, VW, VH, '#1a1020');
    ctx.globalAlpha = 1;

    const w = Math.round(268 * clamp(k, 0.01, 1.2));
    const h = Math.round(112 * clamp(k, 0.01, 1.2));
    const x = Math.round(VW / 2 - w / 2), y = Math.round(VH / 2 - h / 2 - 8);
    if (w < 8 || h < 8) return;

    // o papel
    ret(ctx, x - 2, y - 2, w + 4, h + 4, COR.cartaDk);
    ret(ctx, x, y, w, h, COR.carta);
    ret(ctx, x, y, w, 2, '#ffffff');
    // dobra do papel, no meio, de cima a baixo
    ret(ctx, x + Math.round(w / 2), y + 4, 1, h - 8, '#efe0bd');

    if (k < 0.9) return;

    coracao(ctx, x + 18, y + 17, 5, COR.cartaSelo, '#ff9d9d');
    text(ctx, this.memoria.titulo, x + 34, y + 10,
      { size: 14, font: 'carta', color: '#7a3b2e', weight: 'bold' });
    ret(ctx, x + 16, y + 30, w - 32, 1, '#d9b874');

    // Junta tudo antes de desenhar para poder CENTRALIZAR verticalmente no
    // papel. Texto colado no topo deixa metade da carta vazia.
    const linhas = [];
    for (const l of String(this.memoria.texto).split('\n')) {
      for (const q of quebrar(l, w - 44, { size: 12, font: 'carta', weight: 'normal' })) {
        linhas.push(q);
      }
    }
    const alturaTexto = linhas.length * 15;
    let ly = y + 34 + Math.max(0, ((h - 42) - alturaTexto) / 2);
    for (const q of linhas) {
      text(ctx, q, x + 22, ly, { size: 12, font: 'carta', weight: 'normal', color: '#4a3326' });
      ly += 15;
    }

    text(ctx, 'ESPAÇO para guardar', VW / 2, y + h + 8,
      { size: 9, align: 'center', color: COR.uiDim, outline: 1 });
  }
}

// ---------------------------------------------------------------------------
// plaquinha com o nome do mundo, no começo da fase
// ---------------------------------------------------------------------------
export class Plaquinha {
  constructor() { this.t = -1; this.info = null; }
  mostrar(info) { this.info = info; this.t = 0; }
  atualizar(dt) { if (this.t >= 0) { this.t += dt; if (this.t > 4.2) this.t = -1; } }
  desenhar(ctx) {
    if (this.t < 0 || !this.info) return;
    // entra deslizando, fica, e sai
    let k = 1;
    if (this.t < 0.5) k = easeOut(this.t / 0.5);
    else if (this.t > 3.4) k = 1 - easeOut((this.t - 3.4) / 0.8);
    const dx = Math.round((1 - k) * -90);
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * k;
    const y = 30;
    ret(ctx, 0 + dx, y, 172, 34, COR.uiCaixaDk);
    ret(ctx, 0 + dx, y, 172, 1, COR.uiBorda);
    ret(ctx, 0 + dx, y + 33, 172, 1, COR.uiBorda);
    ret(ctx, 168 + dx, y, 4, 34, COR.uiBorda);
    text(ctx, this.info.nome, 14 + dx, y + 5,
      { size: 15, font: 'titulo', color: COR.uiDestaque, outline: 1 });
    text(ctx, this.info.legenda, 14 + dx, y + 22,
      { size: 9, color: COR.uiDim, outline: 1 });
    ctx.globalAlpha = a0;
  }
}
