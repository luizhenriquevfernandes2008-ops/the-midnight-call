// menu.js — a tela de título.
//
// Ela é o cartão de visita do presente: é a primeira coisa que ela vê, e
// tem que dizer "isto foi feito pra você" antes de qualquer texto. Por isso
// os dois personagens estão ali, do jeito que ficaram no editor, parados na
// praia ao pôr do sol, com o nome dela na tela.

import { VW, VH, clamp, lerp, easeOut, easeBack } from '../core/gfx.js';
import { ret, disco, coracao, degradeV } from '../art/pixel.js';
import { COR } from '../art/paleta.js';
import { text, medir } from '../core/text.js';
import { audio } from '../core/audio.js';
import { NOMES, DATAS } from '../dados/personalizacao.js';
import { caixa } from '../systems/dialogo.js';

export class Titulo {
  constructor(temJogo) {
    this.t = 0;
    this.sel = 0;
    this.escolha = null;
    this.opcoes = [];
    this.reconstruir(temJogo);
  }

  reconstruir(temJogo) {
    this.opcoes = [];
    if (temJogo) this.opcoes.push({ id: 'continuar', rot: 'CONTINUAR' });
    this.opcoes.push({ id: 'novo', rot: temJogo ? 'COMEÇAR DE NOVO' : 'COMEÇAR' });
    this.opcoes.push({ id: 'editor', rot: 'COMO ELA É' });
    this.opcoes.push({ id: 'album', rot: 'ÁLBUM' });
    this.opcoes.push({ id: 'opcoes', rot: 'OPÇÕES' });
    this.sel = clamp(this.sel, 0, this.opcoes.length - 1);
  }

  atualizar(dt, entrada, bonecos) {
    this.t += dt;
    for (const b of Object.values(bonecos)) {
      if (b) { b.tocar('parada'); b.atualizar(dt, { ax: 0, vy: 0 }); }
    }
    if (entrada.pressed('menuDown')) { this.sel = (this.sel + 1) % this.opcoes.length; audio.menuMover(); }
    if (entrada.pressed('menuUp')) { this.sel = (this.sel + this.opcoes.length - 1) % this.opcoes.length; audio.menuMover(); }
    if (entrada.pressed('confirm')) {
      this.escolha = this.opcoes[this.sel].id;
      audio.menuConfirma();
    }
  }

  desenhar(ctx, fundo, bonecos) {
    fundo.desenhar(ctx, this.t * 8, 0);

    // Chão de areia no rodapé. A altura NÃO é decorativa: a base das
    // árvores da paralaxe fica em y=214, e é este areal que precisa cobrir
    // os troncos — sem ele a mata do fundo fica plantada dentro do mar.
    const SOLO = 206;
    ret(ctx, 0, SOLO, VW, VH - SOLO, '#f7d18c');
    ret(ctx, 0, SOLO, VW, 3, '#ffe3a8');
    ret(ctx, 0, SOLO + 3, VW, 2, '#e0b46b');
    // espuma quebrando na areia — fina e irregular, senão vira faixa de neve
    for (let i = 0; i < VW; i += 4) {
      const onda = Math.sin(i * 0.09 + this.t * 1.6) + Math.sin(i * 0.031 - this.t);
      if (onda < 0.2) continue;
      ret(ctx, i, SOLO - 1 - Math.round(onda), 4, 1 + Math.round(onda), '#dff4ff');
    }

    // --- os dois ---
    // Um pouco maiores que no jogo: aqui eles são o assunto da tela, não
    // uma peça do cenário.
    const bob = Math.sin(this.t * 1.6) * 1.2;
    const pe = SOLO + 56;
    const ESC = 1.35;
    ctx.save();
    ctx.scale(ESC, ESC);
    if (bonecos.ele) bonecos.ele.desenhar(ctx, 62 / ESC, (pe + bob) / ESC, 1);
    if (bonecos.ela) bonecos.ela.desenhar(ctx, 100 / ESC, (pe - bob) / ESC, -1);
    ctx.restore();
    // coraçãozinho pulando entre os dois
    const hp = Math.abs(Math.sin(this.t * 2.2));
    coracao(ctx, 81, pe - 66 - hp * 5, 5 + hp * 1.5, COR.coracao, COR.coracaoHi);

    // --- título ---
    const ent = easeBack(clamp(this.t / 0.9, 0, 1));
    const ty = Math.round(lerp(-40, 30, ent));
    const tit = NOMES.titulo;
    // Sombra dura de 3 px, depois o texto: título em cima de céu claro sem
    // sombra some, e contorno fino demais não aguenta letra grande.
    text(ctx, tit, VW / 2 + 3, ty + 3, { size: 40, font: 'titulo', align: 'center', color: '#7a2f4a' });
    text(ctx, tit, VW / 2, ty, { size: 40, font: 'titulo', align: 'center', color: COR.uiDestaque, outline: 2, outlineColor: '#5a1f36' });
    text(ctx, NOMES.subtitulo, VW / 2, ty + 44,
      { size: 10, align: 'center', color: '#fff0d8', outline: 1, alpha: clamp((this.t - 0.6) / 0.6, 0, 1) });

    // --- opções ---
    const ox = VW - 130;
    const oy = 88;
    for (let i = 0; i < this.opcoes.length; i++) {
      const y = oy + i * 19;
      const ativo = i === this.sel;
      const ap = clamp((this.t - 0.9 - i * 0.09) / 0.3, 0, 1);
      if (ap <= 0) continue;
      const dx = Math.round((1 - easeOut(ap)) * 40);
      if (ativo) {
        const w = 116 + Math.sin(this.t * 5) * 2;
        ret(ctx, ox - 8 + dx, y - 3, w, 17, '#00000055');
        ret(ctx, ox - 8 + dx, y - 3, w, 1, COR.uiDestaque);
        ret(ctx, ox - 8 + dx, y + 13, w, 1, COR.uiDestaque);
        coracao(ctx, ox - 14 + dx, y + 5, 3, COR.coracao, COR.coracaoHi);
      }
      text(ctx, this.opcoes[i].rot, ox + dx, y,
        { size: 12, color: ativo ? COR.uiDestaque : COR.uiTexto, outline: 1, alpha: ap });
    }

    text(ctx, `${DATAS.anos} anos  ·  ${DATAS.inicio}`, 8, VH - 14,
      { size: 9, color: '#8a5f38', alpha: 0.9 });
  }
}

// ---------------------------------------------------------------------------
export class Opcoes {
  constructor(cfg) { this.cfg = cfg; this.sel = 0; this.sair = false; this.t = 0; }

  get campos() {
    return [
      { id: 'volume', rot: 'volume geral', tipo: 'barra' },
      { id: 'musica', rot: 'música', tipo: 'barra' },
      { id: 'efeitos', rot: 'efeitos', tipo: 'barra' },
      { id: 'tremida', rot: 'tremida de tela', tipo: 'sim' },
      { id: 'pixelExato', rot: 'pixel exato', tipo: 'sim' },
      { id: 'mostrarDicas', rot: 'mostrar dicas', tipo: 'sim' },
    ];
  }

  atualizar(dt, entrada, aoMudar) {
    this.t += dt;
    const cs = this.campos;
    if (entrada.pressed('menuDown')) { this.sel = (this.sel + 1) % cs.length; audio.menuMover(); }
    if (entrada.pressed('menuUp')) { this.sel = (this.sel + cs.length - 1) % cs.length; audio.menuMover(); }
    const c = cs[this.sel];
    let d = 0;
    if (entrada.pressed('menuRight')) d = 1;
    if (entrada.pressed('menuLeft')) d = -1;
    if (d) {
      if (c.tipo === 'barra') this.cfg[c.id] = clamp((this.cfg[c.id] || 0) + d * 0.1, 0, 1);
      else this.cfg[c.id] = !this.cfg[c.id];
      audio.menuMover();
      if (aoMudar) aoMudar();
    }
    if (entrada.pressed('cancel') || entrada.pressed('confirm')) { this.sair = true; audio.menuVolta(); }
  }

  desenhar(ctx) {
    ctx.globalAlpha = 0.7; ret(ctx, 0, 0, VW, VH, '#1a1020'); ctx.globalAlpha = 1;
    const w = 250, h = 150, x = (VW - w) / 2, y = (VH - h) / 2;
    caixa(ctx, x, y, w, h);
    text(ctx, 'OPÇÕES', VW / 2, y + 10, { size: 14, font: 'titulo', align: 'center', color: COR.uiDestaque, outline: 1 });
    const cs = this.campos;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], ly = y + 34 + i * 17, ativo = i === this.sel;
      if (ativo) ret(ctx, x + 8, ly - 2, w - 16, 15, '#5a3f6e');
      text(ctx, c.rot, x + 16, ly, { size: 10, color: ativo ? COR.uiDestaque : COR.uiDim });
      if (c.tipo === 'barra') {
        const v = this.cfg[c.id] || 0;
        ret(ctx, x + w - 78, ly + 3, 62, 6, '#2a1e36');
        ret(ctx, x + w - 78, ly + 3, Math.round(62 * v), 6, COR.uiDestaque);
        ret(ctx, x + w - 78, ly + 3, 62, 1, '#7d6a84');
      } else {
        text(ctx, this.cfg[c.id] ? 'sim' : 'não', x + w - 16, ly,
          { size: 10, align: 'right', color: COR.uiTexto });
      }
    }
    text(ctx, 'ESC volta', VW / 2, y + h - 16, { size: 9, align: 'center', color: COR.uiDim });
  }
}
