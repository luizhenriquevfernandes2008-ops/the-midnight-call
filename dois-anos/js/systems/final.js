// final.js — a última cena. É pra isso que o jogo inteiro existe.
//
// Nada aqui é interativo além de "continuar", e é de propósito: depois de
// quatro mundos, a última coisa que se pede a alguém é habilidade.
//
// A cena tem quatro tempos:
//   1. a subida — os dois caminham até o meio da tela e param
//   2. os fogos  — e ele diz a primeira linha
//   3. a carta   — as frases de CARTA_FINAL aparecem, uma por vez
//   4. o fecho   — a data, o número de memórias, e fim.

import { VW, VH, clamp, lerp, easeOut, easeInOut } from '../core/gfx.js';
import { ret, disco, coracao, degradeV } from '../art/pixel.js';
import { COR } from '../art/paleta.js';
import { text, medir } from '../core/text.js';
import { audio } from '../core/audio.js';
import { CARTA_FINAL, NOMES, DATAS, MEMORIAS } from '../dados/personalizacao.js';

const T_ANDAR = 3.4;
const T_FOGOS = 2.6;
const T_LINHA = 2.5;

export class Final {
  constructor(bonecos, memoriasColetadas, tempoTotal) {
    this.b = bonecos;
    this.memorias = memoriasColetadas;
    this.tempo = tempoTotal;
    this.t = 0;
    this.fogos = [];
    this.proxFogo = 0.5;
    this.estrelas = [];
    this.acabou = false;
    this.pediuSair = false;
    for (let i = 0; i < 90; i++) {
      this.estrelas.push({
        x: Math.random() * VW, y: Math.random() * (VH - 60),
        f: Math.random(), fase: Math.random() * 6.3,
      });
    }
  }

  get fase() {
    if (this.t < T_ANDAR) return 'andar';
    if (this.t < T_ANDAR + T_FOGOS) return 'fogos';
    const dep = this.t - T_ANDAR - T_FOGOS;
    if (dep < CARTA_FINAL.length * T_LINHA + 1.4) return 'carta';
    return 'fecho';
  }

  atualizar(dt, entrada) {
    this.t += dt;
    const f = this.fase;

    // Acelerar é permitido; pular a cena inteira, não. Quem chegou aqui
    // jogou quatro fases — vale a pena esperar as seis frases.
    if (entrada.pressed('confirm') || entrada.pressed('jump')) {
      if (f === 'fecho') { this.pediuSair = true; }
      else this.t += 0.9;
    }

    this.proxFogo -= dt;
    if (this.proxFogo <= 0 && (f === 'fogos' || f === 'carta' || f === 'fecho')) {
      this.proxFogo = 0.7 + Math.random() * 1.3;
      this._soltarFogo();
    }
    for (const g of this.fogos) {
      g.t += dt;
      for (const p of g.p) {
        p.vy += 90 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 1 - 0.9 * dt; p.vy *= 1 - 0.4 * dt;
      }
    }
    this.fogos = this.fogos.filter(g => g.t < g.dur);

    for (const nome of ['ela', 'ele']) {
      const b = this.b[nome];
      if (!b) continue;
      if (f === 'andar') { b.tocar('andando'); b.velAnim = 0.85; }
      else if (f === 'fogos') b.tocar('comemorando');
      else b.tocar('parada');
      b.atualizar(dt, { ax: 0, vy: 0 });
    }
  }

  _soltarFogo() {
    const cores = ['#ff7ba8', '#ffd45f', '#8fd8ff', '#9fe08a', '#c398f0', '#ffffff'];
    const cor = cores[(Math.random() * cores.length) | 0];
    const cx = 40 + Math.random() * (VW - 80);
    const cy = 30 + Math.random() * 90;
    const p = [];
    const n = 26 + Math.floor(Math.random() * 14);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const v = 60 + Math.random() * 60;
      p.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
    }
    this.fogos.push({ p, t: 0, dur: 1.6, cor, cx, cy });
    audio.fogosDeArtificio();
  }

  desenhar(ctx, gfx) {
    degradeV(ctx, 0, 0, VW, VH, '#0e0b28', '#3a2050', 8);
    degradeV(ctx, 0, VH - 80, VW, 80, '#3a2050', '#6b3560', 6);

    for (const e of this.estrelas) {
      const b = 0.35 + 0.65 * Math.abs(Math.sin(this.t * 1.6 + e.fase));
      ctx.globalAlpha = b;
      ret(ctx, Math.round(e.x), Math.round(e.y), e.f > 0.85 ? 2 : 1, e.f > 0.85 ? 2 : 1,
        e.f > 0.6 ? '#ffffff' : '#c8d4ff');
    }
    ctx.globalAlpha = 1;

    // lua. O halo entra somando (lighter): desenhado por cima com alpha
    // normal ele TAPA as estrelas e vira um buraco escuro em volta da lua.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16; disco(ctx, VW - 62, 44, 34, '#6b6090');
    ctx.globalAlpha = 0.20; disco(ctx, VW - 62, 44, 22, '#7a6ea0');
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    disco(ctx, VW - 62, 44, 16, '#fff6d8');
    disco(ctx, VW - 56, 38, 4, '#efe0bd');
    disco(ctx, VW - 68, 50, 3, '#efe0bd');

    // fogos
    for (const g of this.fogos) {
      const k = 1 - g.t / g.dur;
      ctx.globalAlpha = clamp(k * 1.5, 0, 1);
      for (const p of g.p) ret(ctx, Math.round(p.x), Math.round(p.y), 2, 2, g.cor);
      ctx.globalAlpha = 1;
    }

    // o morro onde os dois estão
    ctx.fillStyle = '#2a1b3c';
    for (let x = 0; x < VW; x++) {
      const h = 34 + Math.sin(x * 0.011) * 12 + Math.sin(x * 0.037) * 4;
      ctx.fillRect(x, VH - h, 1, h);
    }
    ctx.fillStyle = '#3d2a52';
    for (let x = 0; x < VW; x++) {
      const h = 34 + Math.sin(x * 0.011) * 12 + Math.sin(x * 0.037) * 4;
      ctx.fillRect(x, VH - h, 1, 2);
    }

    // os dois: entram andando e param no meio
    const f = this.fase;
    const kAndar = clamp(this.t / T_ANDAR, 0, 1);
    const xEle = lerp(-30, VW / 2 - 16, easeInOut(kAndar));
    const xEla = lerp(-58, VW / 2 + 14, easeInOut(kAndar));
    const chao = VH - 40;
    if (this.b.ele) this.b.ele.desenhar(ctx, xEle, chao, 1);
    if (this.b.ela) this.b.ela.desenhar(ctx, xEla, chao, -1);
    if (f !== 'andar') {
      const hp = Math.abs(Math.sin(this.t * 2));
      coracao(ctx, VW / 2, chao - 54 - hp * 4, 4 + hp, COR.coracao, COR.coracaoHi);
    }

    // ---- texto ----
    // A carta e o bloco de fecho DIVIDEM o mesmo espaço, um de cada vez: a
    // carta some, o fecho entra. Antes o fecho aparecia por cima do casal e
    // o nome dos dois ficava escrito na cara deles.
    const depCarta = this.t - T_ANDAR - T_FOGOS;
    const fimCarta = CARTA_FINAL.length * T_LINHA;
    if (f === 'carta' || f === 'fecho') {
      const somindo = clamp(1 - (depCarta - fimCarta) / 0.9, 0, 1);
      if (somindo > 0.01) {
        const linhas = Math.min(CARTA_FINAL.length, Math.floor(depCarta / T_LINHA) + 1);
        for (let i = 0; i < linhas; i++) {
          const ap = clamp((depCarta - i * T_LINHA) / 0.8, 0, 1);
          ctx.globalAlpha = ap * somindo;
          text(ctx, CARTA_FINAL[i], VW / 2, 46 + i * 18 + (1 - easeOut(ap)) * 6,
            { size: 12, font: 'carta', weight: 'normal', align: 'center',
              color: '#ffeccd', outline: 1, outlineColor: '#2a1030' });
          ctx.globalAlpha = 1;
        }
      }
    }

    if (f === 'fecho') {
      const dep = depCarta - fimCarta;
      const ap = clamp((dep - 0.9) / 1.2, 0, 1);
      if (ap <= 0) return;
      ctx.globalAlpha = ap;
      const y = 72;
      text(ctx, `${NOMES.ela} e ${NOMES.ele}`, VW / 2, y,
        { size: 13, align: 'center', color: COR.uiDestaque, outline: 1 });
      text(ctx, `${DATAS.anos} anos  ·  desde ${DATAS.inicio}`, VW / 2, y + 18,
        { size: 10, align: 'center', color: '#ffd9e2', outline: 1 });
      text(ctx, `${this.memorias} de ${MEMORIAS.length} memórias guardadas`, VW / 2, y + 32,
        { size: 9, align: 'center', color: '#c3aec0', outline: 1 });
      if (dep > 3.2) {
        ctx.globalAlpha = ap * (0.5 + 0.5 * Math.sin(this.t * 4));
        text(ctx, 'ENTER', VW / 2, VH - 16,
          { size: 9, align: 'center', color: COR.uiDim, outline: 1 });
      }
      ctx.globalAlpha = 1;
    }
  }
}

export default Final;
