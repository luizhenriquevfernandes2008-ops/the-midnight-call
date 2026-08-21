// pausa.js — o menu que aparece com ESC.

import { VW, VH } from '../core/gfx.js';
import { ret, coracao } from '../art/pixel.js';
import { COR } from '../art/paleta.js';
import { text } from '../core/text.js';
import { caixa } from '../systems/dialogo.js';
import { audio } from '../core/audio.js';

const OPCOES = [
  { id: 'voltar', rot: 'CONTINUAR' },
  { id: 'album', rot: 'ÁLBUM' },
  { id: 'editor', rot: 'COMO ELA É' },
  { id: 'refazer', rot: 'RECOMEÇAR A FASE' },
  { id: 'menu', rot: 'VOLTAR AO MENU' },
];

export class Pausa {
  constructor() { this.sel = 0; this.escolha = null; this.t = 0; }

  abrir() { this.sel = 0; this.escolha = null; this.t = 0; }

  atualizar(dt, entrada) {
    this.t += dt;
    if (entrada.pressed('menuDown')) { this.sel = (this.sel + 1) % OPCOES.length; audio.menuMover(); }
    if (entrada.pressed('menuUp')) { this.sel = (this.sel + OPCOES.length - 1) % OPCOES.length; audio.menuMover(); }
    if (entrada.pressed('confirm')) { this.escolha = OPCOES[this.sel].id; audio.menuConfirma(); }
    if (entrada.pressed('pause') || entrada.pressed('cancel')) { this.escolha = 'voltar'; audio.menuVolta(); }
  }

  desenhar(ctx, fase, cartas, total) {
    ctx.globalAlpha = 0.66; ret(ctx, 0, 0, VW, VH, '#1a1020'); ctx.globalAlpha = 1;
    const w = 190, h = 150, x = (VW - w) / 2, y = (VH - h) / 2;
    caixa(ctx, x, y, w, h);
    text(ctx, 'PAUSA', VW / 2, y + 9,
      { size: 14, font: 'titulo', align: 'center', color: COR.uiDestaque, outline: 1 });
    if (fase) {
      text(ctx, `${fase.info.nome}  ·  ${cartas}/${total} memórias`, VW / 2, y + 27,
        { size: 9, align: 'center', color: COR.uiDim });
    }
    for (let i = 0; i < OPCOES.length; i++) {
      const ly = y + 46 + i * 18, ativo = i === this.sel;
      if (ativo) {
        ret(ctx, x + 10, ly - 3, w - 20, 16, '#5a3f6e');
        coracao(ctx, x + 18, ly + 5, 3, COR.coracao, COR.coracaoHi);
      }
      text(ctx, OPCOES[i].rot, VW / 2 + (ativo ? 6 : 0), ly,
        { size: 11, align: 'center', color: ativo ? COR.uiDestaque : COR.uiTexto, outline: 1 });
    }
  }
}

export default Pausa;
