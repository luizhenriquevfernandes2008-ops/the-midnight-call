// cena-cartas.js — a tela de recompensa, em 3D, usando o mesmo motor do menu.
//
// Tres cartas de pedra chegam girando de baixo, ficam boiando com o cursor
// e, quando uma e escolhida, ela vem na cara do jogador enquanto as outras
// duas caem e apagam. E o unico momento de pausa do jogo, entao vale gastar
// meio segundo de teatro.

import { motor } from './motor3d.js';
import * as M from './matriz.js';
import { texturaCarta } from './textura-texto.js';
import { audio } from '../nucleo/audio.js';
import { entrada } from '../nucleo/entrada.js';
import { limita, TAU, suaveSai, costas } from '../nucleo/util.js';

const LARGURA = 2.5, ALTURA = 3.75, PROF = 0.16;

function mola(e, dt, k = 170, d = 18) {
  const a = (e.alvo - e.v) * k - e.vel * d;
  e.vel += a * dt;
  e.v += e.vel * dt;
}

class Carta {
  constructor(dados, indice, total) {
    this.dados = dados;
    this.indice = indice;
    this.tex = texturaCarta(dados, dados.tipoCarta || 'reliquia');
    const espalha = 3.4;
    this.baseX = (indice - (total - 1) / 2) * espalha;
    this.baseY = -0.1 - Math.abs(indice - (total - 1) / 2) * 0.18;
    this.giroBase = -(indice - (total - 1) / 2) * 0.2;
    this.hover = { v: 0, vel: 0, alvo: 0 };
    this.entrada = { v: 0, vel: 0, alvo: 1 };
    this.saida = 0;
    this.escolhida = false;
    this.fase = indice * 1.7;
    this.modelo = new Float32Array(16);
    this.cantos = [{}, {}, {}, {}];
  }

  matriz(tempo) {
    const m = M.identidade(this.modelo);
    const ent = costas(limita(this.entrada.v, 0, 1));
    const h = this.hover.v;
    const flutua = Math.sin(tempo * 1.3 + this.fase) * 0.07;

    if (this.escolhida) {
      const s = suaveSai(limita(this.saida, 0, 1));
      M.transladar(m, this.baseX * (1 - s), this.baseY * (1 - s) + s * 0.2, s * 4.4);
      M.girarY(m, this.giroBase * (1 - s) + s * TAU);
      M.girarZ(m, Math.sin(s * Math.PI) * 0.12);
      const es = 1 + s * 0.25;
      M.escalar(m, LARGURA * es, ALTURA * es, PROF);
      return m;
    }
    if (this.saida > 0) {
      const s = limita(this.saida, 0, 1);
      M.transladar(m, this.baseX + s * this.baseX * 1.6, this.baseY - s * 7, -s * 2);
      M.girarZ(m, s * 2.4 * Math.sign(this.baseX || 1));
      M.girarX(m, s * 1.4);
      M.escalar(m, LARGURA, ALTURA, PROF);
      return m;
    }

    M.transladar(m,
      this.baseX,
      this.baseY + flutua + (1 - ent) * -6 + h * 0.28,
      h * 0.75);
    M.girarY(m, this.giroBase * (1 - h * 0.75) + (1 - ent) * 2.2);
    M.girarX(m, (1 - ent) * 1.1 + Math.sin(tempo * 0.9 + this.fase) * 0.03 - h * 0.05);
    M.girarZ(m, Math.sin(tempo * 0.7 + this.fase) * 0.02);
    const s = (0.6 + 0.4 * ent) * (1 + h * 0.07);
    M.escalar(m, LARGURA * s, ALTURA * s, PROF);
    return m;
  }

  atualizar(dt, tempo) {
    mola(this.entrada, dt, 90, 14);
    mola(this.hover, dt, 200, 20);
    if (this.escolhida || this.saindo) this.saida = Math.min(1.4, this.saida + dt * 1.6);
    this.matriz(tempo);
    const p = {}, t = {};
    const cantos = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]];
    for (let i = 0; i < 4; i++) {
      M.transformaPonto(this.modelo, cantos[i][0], cantos[i][1], 0.55, p);
      motor.naTela(p.x, p.y, p.z, t);
      this.cantos[i].x = t.x; this.cantos[i].y = t.y; this.cantos[i].atras = t.atras;
    }
  }

  contem(px, py) {
    if (this.saida > 0) return false;
    if (this.cantos.some(c => c.atras)) return false;
    return M.dentroDoQuadrilatero(px, py, this.cantos);
  }

  desenhar(tempo, corAcento) {
    const m = this.matriz(tempo);
    const h = this.hover.v;
    const alfa = this.saida > 1 ? Math.max(0, 1.4 - this.saida) / 0.4 : 1;
    motor.desenhar('caixa', m, {
      cor: [0.1, 0.09, 0.12],
      emissao: [corAcento[0] * 0.08 * h, corAcento[1] * 0.05 * h, corAcento[2] * 0.07 * h],
      rim: 1 + h * 2.6,
      rimCor: [corAcento[0] * (0.5 + h), corAcento[1] * (0.3 + h * 0.6), corAcento[2] * (0.4 + h * 0.8)],
      alfa, nevoa: 0.01,
    });
    const f = new Float32Array(16);
    f.set(m);
    M.transladar(f, 0, 0, 0.52);
    motor.desenhar('plano', f, {
      textura: this.tex.tex, cor: [1, 1, 1],
      emissao: [0.05 + h * 0.13, 0.04 + h * 0.08, 0.05 + h * 0.11],
      rim: 0, alfa, nevoa: 0.01,
    });
  }
}

class CenaCartas {
  constructor() {
    this.ativa = false;
    this.cartas = [];
    this.tempo = 0;
    this.titulo = '';
    this.subtitulo = '';
    this.aoEscolher = null;
    this.indice = 0;
    this.fechando = 0;
    this.corAcento = [1, 0.3, 0.4];
  }

  abrir(cartas, titulo, subtitulo, aoEscolher, corAcento) {
    this.cartas = cartas.map((c, i) => new Carta(c, i, cartas.length));
    this.titulo = titulo;
    this.subtitulo = subtitulo || '';
    this.aoEscolher = aoEscolher;
    this.ativa = true;
    this.tempo = 0;
    this.indice = 0;
    this.fechando = 0;
    if (corAcento) this.corAcento = corAcento;
  }

  atualizar(dt) {
    if (!this.ativa) return;
    this.tempo += dt;

    motor.camera(
      [(entrada.mouse.x / 960 - 0.5) * 1.1, 0.2 + (0.5 - entrada.mouse.y / 540) * 0.6, 7.4],
      [0, 0.05, 0], 52);

    if (entrada.nova('direita')) this.mover(1);
    if (entrada.nova('esquerda')) this.mover(-1);

    let sobre = -1;
    for (let i = 0; i < this.cartas.length; i++) {
      const c = this.cartas[i];
      c.atualizar(dt, this.tempo);
      if (!this.fechando && c.contem(entrada.mouse.x, entrada.mouse.y)) sobre = i;
    }
    if (sobre >= 0 && sobre !== this.indice) {
      this.indice = sobre;
      audio.passar();
    }
    for (let i = 0; i < this.cartas.length; i++) {
      this.cartas[i].hover.alvo = (!this.fechando && i === this.indice) ? 1 : 0;
    }

    if (!this.fechando) {
      let escolher = -1;
      for (const c of entrada.cliques) {
        if (c.botao !== 0) continue;
        for (let i = 0; i < this.cartas.length; i++) {
          if (this.cartas[i].contem(c.x, c.y)) escolher = i;
        }
      }
      if (entrada.nova('confirma') || entrada.nova('bote')) escolher = this.indice;
      if (entrada.nova('op1')) escolher = 0;
      if (entrada.nova('op2')) escolher = 1;
      if (entrada.nova('op3')) escolher = 2;
      if (escolher >= 0 && escolher < this.cartas.length) this.escolher(escolher);
    } else {
      this.fechando += dt;
      if (this.fechando > 1.15) {
        this.ativa = false;
        const escolhida = this.cartas.find(c => c.escolhida);
        if (this.aoEscolher && escolhida) this.aoEscolher(escolhida.dados);
      }
    }
  }

  mover(passo) {
    this.indice = (this.indice + passo + this.cartas.length) % this.cartas.length;
    audio.passar();
  }

  escolher(i) {
    this.fechando = 0.0001;
    this.cartas.forEach((c, k) => {
      if (k === i) c.escolhida = true;
      else c.saindo = true;
    });
    audio.pegar();
    audio.clique();
  }

  desenhar() {
    if (!this.ativa) return;
    motor.comecar(true);
    motor.ambiente({
      luzDir: [0.3, 0.8, 0.7],
      luzCor: [0.9, 0.72, 0.7],
      amb: [0.16, 0.13, 0.18],
      nevoaCor: [0.02, 0.01, 0.02],
      nevoa: 0.015,
    });
    for (const c of this.cartas) c.desenhar(this.tempo, this.corAcento);
  }

  frente2D(ctx) {
    if (!this.ativa) return;
    const alfa = limita(this.tempo * 2.2, 0, 1) * (this.fechando ? Math.max(0, 1 - this.fechando * 1.6) : 1);
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.shadowColor = 'rgba(255,60,90,0.8)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#f0dcc0';
    ctx.fillText(this.titulo, 480, 62);
    ctx.shadowBlur = 0;
    if (this.subtitulo) {
      ctx.font = 'italic 20px "Trebuchet MS", sans-serif';
      ctx.fillStyle = 'rgba(200,180,160,0.85)';
      ctx.fillText(this.subtitulo, 480, 100);
    }
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillStyle = 'rgba(180,165,150,0.7)';
    ctx.fillText('clique na carta, ou use as setas e ENTER', 480, 508);
    ctx.restore();
  }
}

export const cartas3d = new CenaCartas();
