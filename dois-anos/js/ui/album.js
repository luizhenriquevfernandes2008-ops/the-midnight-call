// album.js — todas as memórias, as achadas e as que faltam.
//
// É a tela que sobra depois que o jogo acaba: dá pra abrir, ler tudo de
// novo e ver o que ficou pra trás. As memórias não coletadas aparecem como
// carta fechada com o nome escondido — o que sobra é vontade de voltar
// naquela fase, que é exatamente o ponto.

import { VW, VH } from '../core/gfx.js';
import { ret, coracao } from '../art/pixel.js';
import { COR } from '../art/paleta.js';
import { text, quebrar } from '../core/text.js';
import { audio } from '../core/audio.js';
import { MEMORIAS, MUNDOS } from '../dados/personalizacao.js';

const COLS = 4;

export class Album {
  constructor(coletadas) {
    this.coletadas = new Set(coletadas || []);
    this.sel = 0;
    this.sair = false;
    this.t = 0;
    this.aberta = null;
  }

  temEssa(m) { return this.coletadas.has(m.titulo); }

  atualizar(dt, entrada) {
    this.t += dt;
    if (this.aberta) {
      if (entrada.pressed('confirm') || entrada.pressed('cancel') || entrada.pressed('jump')) {
        this.aberta = null; audio.menuVolta();
      }
      return;
    }
    const n = MEMORIAS.length;
    if (entrada.pressed('menuRight')) { this.sel = (this.sel + 1) % n; audio.menuMover(); }
    if (entrada.pressed('menuLeft')) { this.sel = (this.sel + n - 1) % n; audio.menuMover(); }
    if (entrada.pressed('menuDown')) { this.sel = (this.sel + COLS) % n; audio.menuMover(); }
    if (entrada.pressed('menuUp')) { this.sel = (this.sel - COLS + n) % n; audio.menuMover(); }
    if (entrada.pressed('confirm')) {
      const m = MEMORIAS[this.sel];
      if (this.temEssa(m)) { this.aberta = m; audio.carta(); }
      else audio.menuVolta();
    }
    if (entrada.pressed('cancel') || entrada.pressed('album')) { this.sair = true; audio.menuVolta(); }
  }

  desenhar(ctx) {
    ctx.globalAlpha = 0.82; ret(ctx, 0, 0, VW, VH, '#1a1020'); ctx.globalAlpha = 1;

    text(ctx, 'ÁLBUM', VW / 2, 8,
      { size: 16, font: 'titulo', align: 'center', color: COR.uiDestaque, outline: 1 });
    text(ctx, `${this.coletadas.size} de ${MEMORIAS.length} memórias`, VW / 2, 26,
      { size: 9, align: 'center', color: COR.uiDim });

    const cw = 106, ch = 40, gx = 14, gy = 46;
    for (let i = 0; i < MEMORIAS.length; i++) {
      const m = MEMORIAS[i];
      const col = i % COLS, lin = Math.floor(i / COLS);
      const x = gx + col * (cw + 8), y = gy + lin * (ch + 8);
      const tem = this.temEssa(m);
      const ativo = i === this.sel;

      ret(ctx, x, y, cw, ch, tem ? COR.carta : '#3b2b4a');
      ret(ctx, x, y, cw, 1, tem ? '#ffffff' : '#5a3f6e');
      ret(ctx, x, y + ch - 1, cw, 1, tem ? COR.cartaDk : '#5a3f6e');
      if (ativo) {
        const p = Math.sin(this.t * 6) * 0.5 + 0.5;
        ctx.globalAlpha = 0.6 + p * 0.4;
        for (let k = 0; k < 4; k++) {
          ret(ctx, x - 2, y - 2 + k * (ch + 2), cw + 4, 2, COR.uiDestaque);
        }
        ret(ctx, x - 2, y - 2, 2, ch + 4, COR.uiDestaque);
        ret(ctx, x + cw, y - 2, 2, ch + 4, COR.uiDestaque);
        ctx.globalAlpha = 1;
      }

      if (tem) {
        coracao(ctx, x + 10, y + 12, 4, COR.cartaSelo, null);
        const linhas = quebrar(m.titulo, cw - 26, { size: 10, font: 'carta' });
        text(ctx, linhas[0], x + 20, y + 6, { size: 10, font: 'carta', color: '#7a3b2e' });
        if (linhas[1]) text(ctx, linhas[1], x + 20, y + 18, { size: 10, font: 'carta', color: '#7a3b2e' });
        text(ctx, MUNDOS[m.mundo - 1].nome.toLowerCase(), x + cw - 6, y + ch - 13,
          { size: 8, align: 'right', color: '#b09258' });
      } else {
        text(ctx, '?', x + cw / 2, y + 10, { size: 18, align: 'center', color: '#5a3f6e' });
        text(ctx, MUNDOS[m.mundo - 1].nome.toLowerCase(), x + cw / 2, y + ch - 13,
          { size: 8, align: 'center', color: '#5a3f6e' });
      }
    }

    text(ctx, 'ENTER abre   ESC volta', VW / 2, VH - 14,
      { size: 9, align: 'center', color: COR.uiDim });

    if (this.aberta) this._lerCarta(ctx);
  }

  _lerCarta(ctx) {
    const m = this.aberta;
    ctx.globalAlpha = 0.7; ret(ctx, 0, 0, VW, VH, '#1a1020'); ctx.globalAlpha = 1;
    const w = 268, h = 126, x = (VW - w) / 2, y = (VH - h) / 2 - 6;
    ret(ctx, x - 2, y - 2, w + 4, h + 4, COR.cartaDk);
    ret(ctx, x, y, w, h, COR.carta);
    ret(ctx, x, y, w, 2, '#ffffff');
    coracao(ctx, x + 18, y + 17, 5, COR.cartaSelo, '#ff9d9d');
    text(ctx, m.titulo, x + 34, y + 10,
      { size: 14, font: 'carta', color: '#7a3b2e', weight: 'bold' });
    ret(ctx, x + 16, y + 30, w - 32, 1, '#d9b874');
    let ly = y + 40;
    for (const l of String(m.texto).split('\n')) {
      for (const q of quebrar(l, w - 40, { size: 12, font: 'carta', weight: 'normal' })) {
        text(ctx, q, x + 20, ly, { size: 12, font: 'carta', weight: 'normal', color: '#4a3326' });
        ly += 15;
      }
    }
  }
}

export default Album;
