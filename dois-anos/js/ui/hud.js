// hud.js — vida, cartas e as dicas do começo.
//
// A interface no jogo é a menor possível: três corações no canto e um
// contador de cartas. Tudo mais que precisar ser dito, o jogo diz com a
// própria cena — a bandeira que muda de cor, o brilho da carta, ele ficando
// mais sólido a cada mundo.

import { VW, VH, clamp, easeOut } from '../core/gfx.js';
import { ret, coracao, disco } from '../art/pixel.js';
import { COR } from '../art/paleta.js';
import { text } from '../core/text.js';

export class Hud {
  constructor() { this.t = 0; this.piscarCarta = 0; this.piscarVida = 0; this.dica = null; this.dicaT = 0; }

  avisarCarta() { this.piscarCarta = 1; }
  avisarVida() { this.piscarVida = 1; }
  mostrarDica(txt) { this.dica = txt; this.dicaT = 0; }

  atualizar(dt) {
    this.t += dt;
    this.piscarCarta = Math.max(0, this.piscarCarta - dt * 1.6);
    this.piscarVida = Math.max(0, this.piscarVida - dt * 1.6);
    if (this.dica) { this.dicaT += dt; if (this.dicaT > 5) this.dica = null; }
  }

  desenhar(ctx, jogador, cartas, total) {
    // corações
    for (let i = 0; i < 3; i++) {
      const cheio = i < jogador.corações;
      const x = 14 + i * 15;
      const pulso = cheio ? 1 + Math.sin(this.t * 3 + i) * 0.06 : 1;
      const salto = (this.piscarVida > 0 && cheio) ? Math.sin(this.piscarVida * 18) * 2 : 0;
      if (cheio) coracao(ctx, x, 14 + salto, 5 * pulso, COR.coracao, COR.coracaoHi);
      else {
        ctx.globalAlpha = 0.4;
        coracao(ctx, x, 14, 5, '#2b2233', null);
        ctx.globalAlpha = 1;
      }
    }

    // cartas
    const bx = VW - 60;
    const k = this.piscarCarta;
    ret(ctx, bx - 4 + (k ? Math.round(Math.sin(k * 20) * 1) : 0), 7, 14, 11, COR.linha);
    ret(ctx, bx - 3, 8, 12, 9, COR.carta);
    for (let i = 0; i < 6; i++) {
      ret(ctx, bx - 3 + i, 8 + i, 1, 1, COR.cartaDk);
      ret(ctx, bx + 8 - i, 8 + i, 1, 1, COR.cartaDk);
    }
    text(ctx, `${cartas}/${total}`, bx + 15, 6,
      { size: 11, color: k > 0 ? COR.uiDestaque : COR.uiTexto, outline: 1 });

    // dica
    if (this.dica) {
      const a = clamp(this.dicaT * 3, 0, 1) * clamp((5 - this.dicaT) * 2, 0, 1);
      const y = VH - 40;
      ctx.globalAlpha = a * 0.75;
      ret(ctx, VW / 2 - 110, y - 3, 220, 18, COR.uiCaixaDk);
      ctx.globalAlpha = a;
      text(ctx, this.dica, VW / 2, y, { size: 10, align: 'center', color: COR.uiTexto, outline: 1 });
      ctx.globalAlpha = 1;
    }
  }
}

export default Hud;
