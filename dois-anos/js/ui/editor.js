// editor.js — "COMO ELA É". O coração do presente.
//
// É aqui que a personagem deixa de ser genérica. Dezoito campos, cada um um
// número, e cada mudança reconstrói o boneco na hora — porque o único jeito
// de acertar o rosto de alguém é olhando para ele enquanto se mexe, nunca
// escolhendo de uma lista fechada.
//
// Três decisões de interface que fazem diferença:
//   1. A personagem do lado esquerdo está SEMPRE ANIMADA (parada e andando
//      se alternam). Rosto parado engana: um cabelo que parece certo de pé
//      pode ficar errado quando balança.
//   2. Campo de cor mostra a amostra da cor ao lado do nome. Ler "azul" e
//      ver o azul não são a mesma coisa.
//   3. Dá para editar ELE também, na mesma tela, com TAB. Ele aparece no
//      jogo inteiro; deixar só ela editável seria estranho.

import { VW, VH, clamp, lerp, easeOut } from '../core/gfx.js';
import { ret, disco, degradeV, coracao } from '../art/pixel.js';
import { COR, NOMES_PELE, NOMES_CABELO, NOMES_ESTILO, NOMES_FRANJA, NOMES_OLHO,
  NOMES_FORMA_OLHO, NOMES_SOBRANCELHA, NOMES_BOCA, NOMES_OCULOS, NOMES_BRINCO,
  NOMES_ENFEITE, NOMES_ROUPA, NOMES_TECIDO, NOMES_SAPATO, NOMES_ALTURA,
  PELES, CABELOS, TECIDOS, SAPATOS, OLHOS } from '../art/paleta.js';
import { text, medir } from '../core/text.js';
import { Boneco } from '../art/rig.js';
import { caixa } from '../systems/dialogo.js';
import { audio } from '../core/audio.js';
import { NOMES } from '../dados/personalizacao.js';

const SIM_NAO = ['não', 'sim'];

// campo: [chave, rótulo, quantidade, nomes, amostraDeCor|null]
const CAMPOS = [
  ['pele', 'tom de pele', PELES.length, NOMES_PELE, i => PELES[i][1]],
  ['cabeloEstilo', 'cabelo', NOMES_ESTILO.length, NOMES_ESTILO, null],
  ['cabeloCor', 'cor do cabelo', CABELOS.length, NOMES_CABELO, i => CABELOS[i][1]],
  ['franja', 'franja', NOMES_FRANJA.length, NOMES_FRANJA, null],
  ['enfeite', 'enfeite', NOMES_ENFEITE.length, NOMES_ENFEITE, null],
  ['olhoForma', 'olho', NOMES_FORMA_OLHO.length, NOMES_FORMA_OLHO, null],
  ['olhoCor', 'cor do olho', OLHOS.length, NOMES_OLHO, i => OLHOS[i]],
  ['sobrancelha', 'sobrancelha', NOMES_SOBRANCELHA.length, NOMES_SOBRANCELHA, null],
  ['boca', 'boca', NOMES_BOCA.length, NOMES_BOCA, null],
  ['blush', 'bochecha rosada', 2, SIM_NAO, null],
  ['sardas', 'sardas', 2, SIM_NAO, null],
  ['oculos', 'óculos', NOMES_OCULOS.length, NOMES_OCULOS, null],
  ['brinco', 'brinco', NOMES_BRINCO.length, NOMES_BRINCO, null],
  ['roupa', 'roupa', NOMES_ROUPA.length, NOMES_ROUPA, null],
  ['corCima', 'cor de cima', TECIDOS.length, NOMES_TECIDO, i => TECIDOS[i][1]],
  ['corBaixo', 'cor de baixo', TECIDOS.length, NOMES_TECIDO, i => TECIDOS[i][1]],
  ['corSapato', 'sapato', SAPATOS.length, NOMES_SAPATO, i => SAPATOS[i][1]],
  ['altura', 'altura', NOMES_ALTURA.length, NOMES_ALTURA, null],
];

const VISIVEIS = 11;

export class Editor {
  constructor(aparencia) {
    this.ap = { ela: { ...aparencia.ela }, ele: { ...aparencia.ele } };
    this.quem = 'ela';
    this.sel = 0;
    this.topo = 0;
    this.t = 0;
    this.trocaAnim = 0;
    this.bonecos = {
      ela: new Boneco(this.ap.ela),
      ele: new Boneco(this.ap.ele),
    };
    this.andando = true;
    this.cicloT = 0;
    this.pronto = false;
    this.cancelou = false;
  }

  get look() { return this.ap[this.quem]; }
  get boneco() { return this.bonecos[this.quem]; }

  _reconstruir() {
    this.boneco.definirAparencia(this.look);
  }

  sortear() {
    const l = this.look;
    for (const [chave, , n] of CAMPOS) {
      l[chave] = Math.floor(Math.random() * n);
    }
    // Sorteio puro entrega óculos de sol e cabelo azul metade das vezes.
    // Estes três voltam para o comum porque o objetivo é parecer com alguém.
    if (Math.random() < 0.7) l.oculos = 0;
    if (Math.random() < 0.6) l.enfeite = 0;
    if (Math.random() < 0.5) l.cabeloCor = Math.floor(Math.random() * 6);
    this._reconstruir();
  }

  atualizar(dt, entrada) {
    this.t += dt;
    this.trocaAnim = Math.min(1, this.trocaAnim + dt * 4);

    // a prévia alterna sozinha entre parada e andando
    this.cicloT += dt;
    if (this.cicloT > 2.6) {
      this.cicloT = 0;
      this.andando = !this.andando;
    }
    const b = this.boneco;
    b.tocar(this.andando ? 'andando' : 'parada');
    b.velAnim = 1;
    b.atualizar(dt, { ax: 0, vy: 0 });

    if (entrada.pressed('menuDown')) { this.sel = (this.sel + 1) % CAMPOS.length; audio.menuMover(); }
    if (entrada.pressed('menuUp')) { this.sel = (this.sel + CAMPOS.length - 1) % CAMPOS.length; audio.menuMover(); }
    this.topo = clamp(this.topo, this.sel - VISIVEIS + 1, this.sel);
    this.topo = clamp(this.topo, 0, Math.max(0, CAMPOS.length - VISIVEIS));

    const campo = CAMPOS[this.sel];
    let mudou = 0;
    if (entrada.pressed('menuRight')) mudou = 1;
    if (entrada.pressed('menuLeft')) mudou = -1;
    if (mudou) {
      const l = this.look;
      l[campo[0]] = ((l[campo[0]] | 0) + mudou + campo[2]) % campo[2];
      this._reconstruir();
      audio.menuMover();
    }

    if (entrada.pressed('album')) {          // TAB troca de personagem
      this.quem = this.quem === 'ela' ? 'ele' : 'ela';
      this.trocaAnim = 0;
      audio.menuConfirma();
    }
    if (entrada.pressed('sortear')) {
      this.sortear();
      audio.menuConfirma();
    }

    if (entrada.pressed('confirm')) { this.pronto = true; audio.menuConfirma(); }
    if (entrada.pressed('cancel')) { this.cancelou = true; audio.menuVolta(); }
  }

  desenhar(ctx) {
    // fundo: um degradê quente, para o rosto não ser julgado em cima de preto
    degradeV(ctx, 0, 0, VW, VH, '#3b2b4a', '#6b4a6e', 8);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % VW, y = (i * 61) % VH;
      ret(ctx, x, y, 1, 1, '#8a6a94');
    }

    const titulo = this.quem === 'ela' ? 'COMO ELA É' : 'COMO ELE É';
    text(ctx, titulo, 12, 8, { size: 17, font: 'titulo', color: COR.uiDestaque, outline: 1 });
    text(ctx, 'TAB troca ' + (this.quem === 'ela' ? 'pra ele' : 'pra ela') + '  ·  R sorteia',
      VW - 12, 12, { size: 9, align: 'right', color: COR.uiDim, outline: 1 });

    // ---- prévia ----
    const px = 12, py = 30, pw = 150, ph = 196;
    caixa(ctx, px, py, pw, ph, '#2a1e36', COR.uiBorda);
    // chãozinho
    ret(ctx, px + 10, py + ph - 34, pw - 20, 3, '#8a6a94');
    ctx.save();
    ctx.beginPath(); ctx.rect(px + 2, py + 2, pw - 4, ph - 4); ctx.clip();
    const k = easeOut(this.trocaAnim);
    ctx.globalAlpha = k;
    ctx.save();
    ctx.translate(px + pw / 2, py + ph - 32 + (1 - k) * 24);
    ctx.scale(3, 3);
    this.boneco.desenhar(ctx, 0, 0, 1);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.restore();

    const nome = this.quem === 'ela' ? NOMES.ela : NOMES.ele;
    text(ctx, nome, px + pw / 2, py + ph - 26,
      { size: 11, align: 'center', color: COR.uiTexto, outline: 1 });

    // ---- lista ----
    const lx = 172, ly = 30, lw = VW - lx - 12, lh = 196;
    caixa(ctx, lx, ly, lw, lh, COR.uiCaixa, COR.uiBorda);

    for (let i = 0; i < VISIVEIS; i++) {
      const idx = this.topo + i;
      if (idx >= CAMPOS.length) break;
      const [chave, rotulo, n, nomes, amostra] = CAMPOS[idx];
      const y = ly + 9 + i * 16;
      const ativo = idx === this.sel;
      if (ativo) {
        ret(ctx, lx + 4, y - 2, lw - 8, 15, '#5a3f6e');
        ret(ctx, lx + 4, y - 2, lw - 8, 1, COR.uiDestaque);
        ret(ctx, lx + 4, y + 12, lw - 8, 1, COR.uiDestaque);
      }
      text(ctx, rotulo, lx + 10, y, { size: 10, color: ativo ? COR.uiDestaque : COR.uiDim });

      const v = clamp(this.look[chave] | 0, 0, n - 1);
      const rot = nomes[v] || String(v);
      const vx = lx + lw - 18;
      if (amostra) {
        ret(ctx, vx - medir(rot, { size: 10 }).w - 16, y + 1, 9, 9, COR.linha);
        ret(ctx, vx - medir(rot, { size: 10 }).w - 15, y + 2, 7, 7, amostra(v));
      }
      text(ctx, rot, vx, y, { size: 10, align: 'right', color: COR.uiTexto });

      if (ativo) {
        const p = Math.sin(this.t * 7) > 0 ? 1 : 0;
        text(ctx, '<', lx + lw - 8, y, { size: 10, align: 'right', color: COR.uiDestaque, alpha: 0.6 + p * 0.4 });
      }
    }

    // barrinha de rolagem — a lista tem mais campo do que cabe
    if (CAMPOS.length > VISIVEIS) {
      const bh = Math.round(lh * VISIVEIS / CAMPOS.length);
      const by = ly + Math.round((lh - bh) * this.topo / (CAMPOS.length - VISIVEIS));
      ret(ctx, lx + lw - 3, ly + 2, 1, lh - 4, '#5a3f6e');
      ret(ctx, lx + lw - 4, by + 2, 3, bh - 4, COR.uiBorda);
    }

    text(ctx, '↑↓ escolhe   ←→ muda   ENTER confirma   ESC volta',
      VW / 2, VH - 16, { size: 9, align: 'center', color: COR.uiDim, outline: 1 });
    coracao(ctx, 22, VH - 14, 4, COR.coracao, COR.coracaoHi);
    coracao(ctx, VW - 22, VH - 14, 4, COR.coracao, COR.coracaoHi);
  }
}

export default Editor;
