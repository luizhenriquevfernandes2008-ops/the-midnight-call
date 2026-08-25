// hud.js — o que o jogador precisa saber sem tirar o olho da cobra.
//
// Tudo encostado nas bordas, nada no meio: a arena e onde a decisao
// acontece. Vida em escamas (nao em barra) porque numero inteiro pequeno se
// le de relance; folego e furia em barra porque o que importa nelas e a
// fracao, nao o valor.

import { texto, retanguloRedondo } from '../nucleo/gfx.js';
import { desenhaIcone } from './icones.js';
import { limita, TAU } from '../nucleo/util.js';
import { D } from '../nucleo/dados.js';

export function desenharHud(ctx, jogo) {
  const c = jogo.cobra;
  const r = jogo.corrida;
  const arena = jogo.arena;
  const t = jogo.tempo;
  const paleta = r.andarDados.paleta;

  // ---- faixa de cima ----
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, 56);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 960, 56);

  texto(ctx, r.andarDados.nome, 24, 22, {
    tam: 19, tipo: 'titulo', peso: 'bold', cor: paleta.acento, espaco: 3, sombra: 12,
  });
  const salaTxt = jogo.salaDeChefe
    ? 'CAMARA DO CHEFE'
    : 'SALA ' + (r.sala + 1) + ' / ' + r.salasNoAndar;
  texto(ctx, salaTxt, 24, 41, { tam: 12, cor: 'rgba(200,190,175,0.7)', espaco: 2 });

  // ---- vida ----
  const vx = 24, vy = 68;
  for (let i = 0; i < c.vidaMax; i++) {
    const cheio = i < c.vida;
    const x = vx + (i % 12) * 17;
    const y = vy + ((i / 12) | 0) * 17;
    ctx.save();
    ctx.globalAlpha = cheio ? 1 : 0.28;
    if (cheio && c.vida <= 2) {
      const p = 0.6 + 0.4 * Math.sin(t * 7);
      ctx.globalAlpha = p;
    }
    desenhaIcone(ctx, 'escama', x, y, 15, cheio ? '#ff5a6a' : '#4a4048', 1);
    ctx.restore();
  }

  // ---- folego e furia ----
  barra(ctx, 24, 92, 150, 7, c.energia / jogo.corrida.atributos.energiaMax,
    '#5ad0ff', 'rgba(20,30,50,0.8)');
  barra(ctx, 24, 104, 150, 7, c.furia / D.config.cobra.furiaMaxima,
    c.furia >= D.config.cobra.furiaMaxima ? '#ff3a4a' : '#a03a6a', 'rgba(40,16,30,0.8)');
  if (c.furia >= D.config.cobra.furiaMaxima) {
    texto(ctx, 'Q — FURIA', 182, 108, {
      tam: 11, cor: 'rgba(255,120,120,' + (0.6 + 0.4 * Math.sin(t * 8)) + ')', espaco: 1.5,
    });
  }

  // ---- nivel e almas ----
  const lx = 936;
  texto(ctx, 'NIVEL ' + r.nivel, lx, 22, {
    tam: 15, peso: 'bold', cor: '#e8d8b8', alinha: 'direita', espaco: 2,
  });
  const prog = limita(r.almas / r.almasParaProximo(), 0, 1);
  barra(ctx, lx - 150, 34, 150, 6, prog, '#8affb0', 'rgba(20,40,30,0.8)');
  texto(ctx, r.almas + ' / ' + r.almasParaProximo() + ' almas', lx, 50, {
    tam: 11, cor: 'rgba(180,220,190,0.75)', alinha: 'direita', espaco: 1,
  });
  texto(ctx, 'CORPO ' + c.comprimento, lx, 68, {
    tam: 12, cor: 'rgba(200,190,175,0.7)', alinha: 'direita', espaco: 1,
  });
  texto(ctx, 'ESSENCIA ' + r.essencia, lx, 84, {
    tam: 12, cor: 'rgba(240,200,140,0.75)', alinha: 'direita', espaco: 1,
  });

  // ---- reliquias ----
  let rx = 24, ry = 522;
  for (const id of r.reliquias) {
    const rel = D.porId.reliquias[id];
    if (!rel) continue;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(10,8,14,0.7)';
    retanguloRedondo(ctx, rx - 11, ry - 11, 22, 22, 5);
    ctx.fill();
    ctx.strokeStyle = rel.raridade === 'maldita' ? 'rgba(255,90,110,0.5)'
      : rel.raridade === 'rara' ? 'rgba(120,200,255,0.45)' : 'rgba(190,170,140,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    desenhaIcone(ctx, rel.icone || 'escama', rx, ry, 14,
      rel.raridade === 'maldita' ? '#ff8a9a' : rel.raridade === 'rara' ? '#9ad8ff' : '#dcc9a8', 0.95);
    ctx.restore();
    rx += 26;
    if (rx > 460) { rx = 24; ry -= 26; }
  }

  // ---- recargas (bote e cuspe) ----
  const bx = 480, by = 522;
  desenharRecarga(ctx, bx - 30, by, 'bote', 1 - limita((c.bote.recargaAte - c.tempo) / (D.config.cobra.bote.recarga * r.atributos.recargaBote), 0, 1), 'ESPACO');
  if (r.tem('cuspe')) {
    desenharRecarga(ctx, bx + 30, by, 'gota', 1 - limita((c.cuspeRecargaAte - c.tempo) / (D.config.cobra.cuspe.recarga * r.atributos.recargaCuspe), 0, 1), 'E');
  }

  // ---- chefe ----
  if (jogo.chefe && !jogo.chefe.morto) {
    desenharBarraChefe(ctx, jogo.chefe, t);
  }

  // ---- aviso central ----
  if (jogo.avisoTempo > 0) {
    const a = limita(jogo.avisoTempo / 0.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    texto(ctx, jogo.avisoTexto, 480, 150, {
      tam: 26, tipo: 'titulo', peso: 'bold', cor: '#ffd8b8', alinha: 'centro',
      espaco: 4, sombra: 20, corSombra: 'rgba(255,80,60,0.9)',
    });
    ctx.restore();
  }

  // ---- combo de constricao ----
  if (jogo.constricaoBrilho > 0) {
    ctx.save();
    ctx.globalAlpha = limita(jogo.constricaoBrilho, 0, 1);
    texto(ctx, 'CONSTRICAO', 480, 110, {
      tam: 22, tipo: 'titulo', peso: 'bold', cor: '#ff6a8a', alinha: 'centro', espaco: 6, sombra: 18,
    });
    ctx.restore();
  }

  ctx.restore();
}

function barra(ctx, x, y, w, h, frac, cor, fundo) {
  ctx.save();
  ctx.fillStyle = fundo;
  retanguloRedondo(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = cor;
  const f = limita(frac, 0, 1);
  if (f > 0) {
    retanguloRedondo(ctx, x, y, Math.max(h, w * f), h, h / 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  retanguloRedondo(ctx, x, y, w, h, h / 2);
  ctx.stroke();
  ctx.restore();
}

function desenharRecarga(ctx, x, y, icone, frac, tecla) {
  const raio = 15;
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,12,0.75)';
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, TAU);
  ctx.fill();
  const pronto = frac >= 1;
  ctx.strokeStyle = pronto ? 'rgba(120,220,255,0.9)' : 'rgba(90,90,110,0.5)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, raio, -Math.PI / 2, -Math.PI / 2 + TAU * limita(frac, 0, 1));
  ctx.stroke();
  desenhaIcone(ctx, icone, x, y, 15, pronto ? '#9ad8ff' : '#6a6a7a', pronto ? 1 : 0.5);
  ctx.restore();
  texto(ctx, tecla, x, y + 24, { tam: 9, cor: 'rgba(160,160,175,0.6)', alinha: 'centro', espaco: 1 });
}

function desenharBarraChefe(ctx, chefe, t) {
  const w = 460, x = 480 - w / 2, y = 512;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  retanguloRedondo(ctx, x - 3, y - 3, w + 6, 20, 5);
  ctx.fill();
  const frac = limita(chefe.vida / chefe.vidaMax, 0, 1);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#8a0a1a');
  g.addColorStop(0.5, chefe.def.brilho);
  g.addColorStop(1, '#8a0a1a');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w * frac, 14);
  // marcas de fase
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  for (const f of chefe.def.fases) {
    if (f.ate >= 1) continue;
    ctx.beginPath();
    ctx.moveTo(x + w * f.ate, y);
    ctx.lineTo(x + w * f.ate, y + 14);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,200,180,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, 14);
  texto(ctx, chefe.def.nome, 480, y - 12, {
    tam: 16, tipo: 'titulo', peso: 'bold', cor: '#ffcfc0', alinha: 'centro', espaco: 4,
    sombra: 14, corSombra: chefe.def.brilho,
  });
  ctx.restore();
}
