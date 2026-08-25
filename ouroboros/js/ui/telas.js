// telas.js — as telas que param o jogo: entrada de andar, pausa, morte e fim.
//
// Todas desenham no canvas da frente (o que fica por cima do 3D), e todas
// respeitam a mesma regra: o jogo continua visivel atras. Cortina preta
// total tira o jogador do lugar; escurecer 80% mantem ele la dentro.

import { texto, quebraTexto, retanguloRedondo } from '../nucleo/gfx.js';
import { limita, suaveSai, TAU } from '../nucleo/util.js';
import { D } from '../nucleo/dados.js';
import { desenhaIcone } from './icones.js';

export const OPCOES_PAUSA = ['CONTINUAR', 'RECOMECAR A DESCIDA', 'VOLTAR AO MENU'];

export function telaIntroAndar(ctx, jogo, t, duracao) {
  const andar = jogo.corrida.andarDados;
  const entra = limita(t / 0.7, 0, 1);
  const sai = limita((duracao - t) / 0.6, 0, 1);
  const a = Math.min(entra, sai);

  ctx.save();
  ctx.globalAlpha = a * 0.92;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 960, 540);

  const desl = (1 - suaveSai(entra)) * 40;
  ctx.globalAlpha = a;
  texto(ctx, 'CIRCULO ' + romano(jogo.corrida.andar + 1), 480, 176 - desl, {
    tam: 15, cor: 'rgba(190,170,160,0.75)', alinha: 'centro', espaco: 8,
  });
  texto(ctx, andar.nome, 480, 232 - desl, {
    tam: 62, tipo: 'titulo', peso: 'bold', cor: '#f0e0c8', alinha: 'centro',
    espaco: 10, sombra: 30, corSombra: andar.paleta.acento,
  });
  texto(ctx, andar.subtitulo, 480, 286 + desl * 0.4, {
    tam: 15, cor: 'rgba(200,185,170,0.8)', alinha: 'centro', espaco: 2,
  });

  ctx.globalAlpha = a * limita((t - 0.5) / 0.6, 0, 1);
  const linhas = quebraTexto(ctx, andar.epigrafe, 620, { tam: 17 });
  linhas.forEach((l, i) => {
    texto(ctx, l, 480, 348 + i * 26, {
      tam: 17, tipo: 'titulo', cor: 'rgba(220,190,170,0.85)', alinha: 'centro', espaco: 1,
    });
  });

  // linha decorativa que abre
  ctx.globalAlpha = a;
  ctx.strokeStyle = andar.paleta.acento;
  ctx.lineWidth = 2;
  const largura = 260 * suaveSai(entra);
  ctx.beginPath();
  ctx.moveTo(480 - largura, 308);
  ctx.lineTo(480 + largura, 308);
  ctx.stroke();
  ctx.restore();
}

export function telaPausa(ctx, jogo, indice) {
  ctx.save();
  ctx.fillStyle = 'rgba(4,2,8,0.82)';
  ctx.fillRect(0, 0, 960, 540);

  texto(ctx, 'PAUSA', 480, 96, {
    tam: 52, tipo: 'titulo', peso: 'bold', cor: '#e8d4bc', alinha: 'centro',
    espaco: 12, sombra: 24, corSombra: 'rgba(255,60,80,0.7)',
  });

  OPCOES_PAUSA.forEach((op, i) => {
    const sel = i === indice;
    const y = 200 + i * 46;
    if (sel) {
      ctx.fillStyle = 'rgba(255,60,90,0.12)';
      retanguloRedondo(ctx, 300, y - 18, 360, 36, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,110,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    texto(ctx, op, 480, y, {
      tam: sel ? 22 : 19, tipo: 'titulo', peso: sel ? 'bold' : 'normal',
      cor: sel ? '#ffd8c0' : 'rgba(190,175,160,0.75)', alinha: 'centro', espaco: 4,
      sombra: sel ? 14 : 0, corSombra: 'rgba(255,80,90,0.8)',
    });
  });

  // resumo da corrida
  const r = jogo.corrida;
  const linhas = [
    'andar ' + (r.andar + 1) + ' — sala ' + (r.sala + 1),
    'nivel ' + r.nivel + '   corpo ' + jogo.cobra.comprimento,
    r.almasTotais + ' almas engolidas',
    r.essencia + ' de essencia nesta descida',
    'semente ' + r.semente,
  ];
  linhas.forEach((l, i) => texto(ctx, l, 480, 372 + i * 22, {
    tam: 14, cor: 'rgba(170,160,150,0.7)', alinha: 'centro', espaco: 1,
  }));

  texto(ctx, 'ESC volta ao jogo   ·   M muda o som', 480, 508, {
    tam: 12, cor: 'rgba(140,130,125,0.6)', alinha: 'centro', espaco: 1,
  });
  ctx.restore();
}

export function telaMorte(ctx, jogo, t) {
  const a = limita(t / 1.4, 0, 1);
  ctx.save();
  ctx.fillStyle = 'rgba(2,0,4,' + (a * 0.9) + ')';
  ctx.fillRect(0, 0, 960, 540);

  ctx.globalAlpha = limita((t - 0.4) / 1, 0, 1);
  texto(ctx, 'A DESCIDA PAROU', 480, 130, {
    tam: 46, tipo: 'titulo', peso: 'bold', cor: '#d84a5a', alinha: 'centro',
    espaco: 10, sombra: 26, corSombra: 'rgba(255,20,40,0.8)',
  });
  texto(ctx, jogo.fraseMorte, 480, 176, {
    tam: 17, tipo: 'titulo', cor: 'rgba(210,180,170,0.8)', alinha: 'centro', espaco: 1,
  });

  ctx.globalAlpha = limita((t - 1.0) / 1, 0, 1);
  const r = jogo.corrida.resumo();
  const linhas = [
    ['ANDAR ALCANCADO', r.andar + ' / ' + D.fases.andares.length],
    ['SALAS LIMPAS', String(jogo.salasLimpas)],
    ['ALMAS ENGOLIDAS', String(r.almas)],
    ['MAIOR CORPO', String(jogo.corrida.maiorCorpo)],
    ['BICHOS ESMAGADOS', String(jogo.esmagados)],
    ['TEMPO', formatarTempo(r.tempo)],
  ];
  linhas.forEach((l, i) => {
    const y = 244 + i * 27;
    texto(ctx, l[0], 400, y, { tam: 14, cor: 'rgba(160,150,145,0.75)', alinha: 'direita', espaco: 2 });
    texto(ctx, l[1], 560, y, { tam: 16, peso: 'bold', cor: '#e0d0b8', alinha: 'esquerda', espaco: 2 });
  });

  ctx.globalAlpha = limita((t - 1.6) / 1, 0, 1);
  ctx.fillStyle = 'rgba(255,200,120,0.1)';
  retanguloRedondo(ctx, 288, 412, 384, 40, 8);
  ctx.fill();
  desenhaIcone(ctx, 'moeda', 320, 432, 20, '#ffd07a', 0.95);
  texto(ctx, '+' + jogo.essenciaGanha + ' DE ESSENCIA GUARDADA', 494, 432, {
    tam: 15, peso: 'bold', cor: '#ffd490', alinha: 'centro', espaco: 2,
  });

  const pisca = 0.55 + 0.45 * Math.sin(t * 4);
  texto(ctx, 'ENTER para voltar ao poco   ·   R para descer de novo', 480, 498, {
    tam: 14, cor: 'rgba(200,190,180,' + pisca + ')', alinha: 'centro', espaco: 2,
  });
  ctx.restore();
}

export function telaVitoria(ctx, jogo, t) {
  const a = limita(t / 2, 0, 1);
  ctx.save();
  ctx.fillStyle = 'rgba(2,0,4,' + (a * 0.86) + ')';
  ctx.fillRect(0, 0, 960, 540);

  // anel se fechando
  ctx.globalAlpha = a;
  ctx.strokeStyle = 'rgba(255,80,120,0.5)';
  ctx.lineWidth = 3;
  const raio = 120 + Math.sin(t * 0.8) * 8;
  ctx.beginPath();
  ctx.arc(480, 250, raio, 0, TAU * limita(t / 3, 0, 1));
  ctx.stroke();

  ctx.globalAlpha = limita((t - 0.6) / 1.2, 0, 1);
  texto(ctx, D.textos.vitoria.titulo, 480, 232, {
    tam: 46, tipo: 'titulo', peso: 'bold', cor: '#ffd0b0', alinha: 'centro',
    espaco: 10, sombra: 30, corSombra: 'rgba(255,60,110,0.9)',
  });

  ctx.globalAlpha = limita((t - 1.6) / 1.4, 0, 1);
  const linhas = D.textos.vitoria.texto.split('\n');
  linhas.forEach((l, i) => texto(ctx, l, 480, 320 + i * 26, {
    tam: 17, tipo: 'titulo', cor: 'rgba(220,200,190,0.85)', alinha: 'centro', espaco: 1,
  }));

  ctx.globalAlpha = limita((t - 2.6) / 1, 0, 1);
  texto(ctx, '+' + jogo.essenciaGanha + ' de essencia   ·   ENTER para voltar', 480, 446, {
    tam: 15, cor: 'rgba(240,210,170,0.9)', alinha: 'centro', espaco: 2,
  });
  ctx.restore();
}

// Tutorial: UMA linha por vez, embaixo, pequena. A versao anterior jogava
// seis linhas num painel que cobria um sexto da arena — o jogador nao le
// seis regras de uma vez, e ainda perdia de vista o bicho que vinha.
export function telaTutorial(ctx, jogo, t) {
  const linhas = D.textos.tutorial;
  const porLinha = 4.5;
  const total = linhas.length * porLinha;
  if (t > total) return;
  const i = Math.min(linhas.length - 1, Math.floor(t / porLinha));
  const local = t - i * porLinha;
  const a = Math.min(1, local / 0.4) * Math.min(1, (porLinha - local) / 0.5);
  if (a <= 0) return;

  const txt = linhas[i];
  ctx.save();
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  const w = ctx.measureText(txt).width + 44;
  ctx.globalAlpha = a * 0.8;
  ctx.fillStyle = 'rgba(6,4,10,0.9)';
  retanguloRedondo(ctx, 480 - w / 2, 468, w, 30, 15);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,120,140,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  texto(ctx, txt, 480, 483, {
    tam: 15, cor: '#e8dccc', alinha: 'centro', espaco: 0.5, alfa: a,
  });
  texto(ctx, (i + 1) + '/' + linhas.length, 480, 505, {
    tam: 10, cor: 'rgba(160,150,150,0.55)', alinha: 'centro', espaco: 1, alfa: a,
  });
}

function romano(n) {
  const tabela = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return tabela[n - 1] || String(n);
}

export function formatarTempo(seg) {
  const m = Math.floor(seg / 60), s = Math.floor(seg % 60);
  return m + ':' + String(s).padStart(2, '0');
}
