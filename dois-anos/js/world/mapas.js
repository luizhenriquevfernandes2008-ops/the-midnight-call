// mapas.js — as quatro fases.
//
// As fases NÃO são desenhadas como um bloco gigante de texto. Escrever 220
// colunas de ASCII à mão é impossível de conferir: um espaço a mais no meio
// e a fase inteira desanda, e ninguém acha o erro.
//
// Em vez disso existe um construtor com verbos — chao(), plat(), mola(),
// inimigo() — e a fase é um roteiro que se lê de cima para baixo, na mesma
// ordem em que se joga. Trocar a altura de uma plataforma é mexer num
// número, e o começo da fase continua onde estava.
//
// TUDO AQUI ESTÁ EM TILES (16 px). Só os itens saem em pixels, centrados no
// tile, porque é assim que a colisão os quer.
//
// MEDIDAS QUE MANDAM NO DESENHO DAS FASES (vêm de systems/jogador.js):
//   pulo parado ......... 3,2 tiles de altura
//   vão pulando andando . 3,5 tiles
//   vão pulando correndo  5,5 tiles
// Vão de 6 ou degrau de 4 não é desafio, é parede.

import { Mapa, T, VAZIO, SOLIDO, PLATAFORMA, ESPINHO, AGUA, FRAGIL } from './tiles.js';
import { ORDEM, TEMAS } from './temas.js';
import { memoriasDoMundo, MUNDOS } from '../dados/personalizacao.js';

class Construtor {
  constructor(largura, altura) {
    this.mapa = new Mapa(largura, altura);
    this.itens = [];
    this.inimigos = [];
    this.decor = [];
    this.moveis = [];
    this.molas = [];
    this.checkpoints = [];
    this.gaiola = null;
    this.inicio = { x: 3 * T, y: 10 * T };
    this._variante = 0;
  }

  // --- terreno -------------------------------------------------------------
  chao(x0, x1, y) {
    for (let x = x0; x <= x1; x++) {
      for (let yy = y; yy < this.mapa.a; yy++) this.mapa.por(x, yy, SOLIDO);
    }
    return this;
  }
  bloco(x, y, w, h) {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) this.mapa.por(x + i, y + j, SOLIDO);
    return this;
  }
  plat(x, y, w) {
    for (let i = 0; i < w; i++) this.mapa.por(x + i, y, PLATAFORMA);
    return this;
  }
  espinhos(x0, x1, y) {
    for (let x = x0; x <= x1; x++) this.mapa.por(x, y, ESPINHO);
    return this;
  }
  agua(x0, x1, y) {
    for (let x = x0; x <= x1; x++) {
      for (let yy = y; yy < this.mapa.a; yy++) this.mapa.por(x, yy, AGUA);
    }
    return this;
  }
  fragil(x, y, w) {
    for (let i = 0; i < w; i++) this.mapa.por(x + i, y, FRAGIL);
    return this;
  }
  // Escadinha subindo (dir=1) ou descendo (dir=-1), um degrau por tile.
  escada(x, y, passos, dir = 1) {
    for (let i = 0; i < passos; i++) {
      this.chao(x + i, x + i, y - i * dir);
    }
    return this;
  }

  // --- coisas --------------------------------------------------------------
  coracao(x, y) { this.itens.push({ tipo: 'coracao', x: x * T + T / 2, y: y * T + T / 2 }); return this; }
  // Fileira de corações — o guia visual mais antigo do gênero: mostra por
  // onde pular antes do jogador ter que adivinhar.
  trilha(x, y, n, dx = 1, dy = 0) {
    for (let i = 0; i < n; i++) this.coracao(x + i * dx, y + i * dy);
    return this;
  }
  arco(x, y, n, alturaArco = 3) {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      this.coracao(x + i, Math.round(y - Math.sin(t * Math.PI) * alturaArco));
    }
    return this;
  }
  carta(x, y) { this.itens.push({ tipo: 'carta', x: x * T + T / 2, y: y * T + T / 2 }); return this; }
  mola(x, y) { this.molas.push({ x: x * T, y: y * T, comp: 0 }); return this; }
  // y é a MESMA linha que se passa para chao(): o bicho fica em cima da
  // superfície, não um tile enterrado nela. (Era `y * T + T` e todo bicho
  // do jogo nascia com metade do corpo dentro do chão.)
  inimigo(x, y, tipo, alcance = 3) {
    this.inimigos.push({ tipo, x: x * T + T / 2, y: y * T, alcance: alcance * T });
    return this;
  }
  movel(x, y, w, dx, dy, vel = 26) {
    this.moveis.push({ x: x * T, y: y * T, w: w * T, h: 6, x0: x * T, y0: y * T,
      dx: dx * T, dy: dy * T, vel, t: Math.random() * 6 });
    return this;
  }
  enfeite(tipo, x, y, atras = true) {
    this.decor.push({ tipo, x: x * T, y: y * T, atras, v: this._variante++ });
    return this;
  }
  checkpoint(x, y) { this.checkpoints.push({ x: x * T + T / 2, y: y * T, pego: false }); return this; }
  comecar(x, y) { this.inicio = { x: x * T + T / 2, y: y * T }; return this; }
  final(x, y) { this.gaiola = { x: x * T + T / 2, y: y * T, aberta: false }; return this; }
}

// ---------------------------------------------------------------------------
// FASE 1 — A PRAIA. Ensina andar, pular e pisar. Sem buraco mortal até a
// metade: o primeiro erro do jogador não pode custar caro.
// ---------------------------------------------------------------------------
function fasePraia() {
  const c = new Construtor(196, 22);
  const CH = 16;
  c.comecar(4, CH);

  // trecho de respiro: chão liso e reto, só pra sentir o controle
  c.chao(0, 26, CH);
  c.enfeite('palmeira', 8, CH - 4);
  c.enfeite('guardasol', 15, CH - 3);
  c.enfeite('concha', 12, CH - 1, false);
  c.enfeite('castelo', 20, CH - 1, false);
  c.trilha(10, CH - 3, 5);

  // primeiro degrau e primeiro caranguejo
  c.chao(29, 44, CH - 1);
  c.agua(27, 28, CH);
  c.inimigo(38, CH - 1, 'caranguejo', 4);
  c.arco(29, CH - 3, 5, 2);
  c.enfeite('palmeira', 41, CH - 5);
  c.enfeite('pedra', 33, CH - 2, false);

  // plataformas sobre a água — a carta fica no ponto mais alto
  c.agua(45, 55, CH);
  c.plat(46, CH - 4, 3);
  c.plat(51, CH - 6, 3);
  c.carta(52, CH - 8);
  c.plat(56, CH - 4, 3);
  c.trilha(46, CH - 6, 3);

  c.chao(59, 78, CH);
  c.checkpoint(61, CH);
  c.enfeite('palmeira', 63, CH - 4);
  c.inimigo(68, CH, 'caranguejo', 5);
  c.inimigo(74, CH, 'caranguejo', 3);
  c.bloco(71, CH - 3, 2, 1);
  c.coracao(71, CH - 5); c.coracao(72, CH - 5);

  // escadinha e mirante
  c.escada(79, CH - 1, 4);
  c.chao(83, 96, CH - 4);
  c.enfeite('guardasol', 88, CH - 7);
  c.inimigo(92, CH - 4, 'caranguejo', 4);
  c.plat(90, CH - 8, 4);
  c.carta(92, CH - 10);
  c.trilha(85, CH - 6, 4);

  // descida em plataformas, com um pássaro voando
  c.agua(97, 108, CH);
  c.plat(98, CH - 5, 3);
  c.plat(102, CH - 3, 3);
  c.inimigo(104, CH - 8, 'gaivota', 6);
  c.plat(106, CH - 5, 3);

  c.chao(110, 130, CH);
  c.checkpoint(112, CH);
  c.enfeite('palmeira', 115, CH - 4);
  c.enfeite('concha', 119, CH - 1, false);
  c.inimigo(122, CH, 'caranguejo', 5);
  c.mola(126, CH - 1);
  c.coracao(126, CH - 6); c.coracao(126, CH - 8);
  c.carta(126, CH - 11);

  // trecho de vãos de verdade, agora que já sabe pular
  c.chao(133, 140, CH);
  c.chao(144, 150, CH);
  c.chao(154, 162, CH);
  c.arco(140, CH - 2, 4, 2);
  c.arco(150, CH - 2, 4, 2);
  c.inimigo(147, CH, 'caranguejo', 2);
  c.enfeite('palmeira', 158, CH - 4);

  // o píer: madeira sobre a água, e ele no fim dela
  c.agua(163, 195, CH + 1);
  for (let x = 164; x <= 190; x++) c.plat(x, CH, 1);
  c.enfeite('palmeira', 166, CH - 4);
  c.enfeite('guardasol', 176, CH - 1);
  c.inimigo(172, CH, 'caranguejo', 3);
  c.inimigo(180, CH - 5, 'gaivota', 5);
  c.trilha(168, CH - 3, 4);
  c.carta(178, CH - 4);
  c.checkpoint(184, CH);
  c.final(188, CH);
  return c;
}

// ---------------------------------------------------------------------------
// FASE 2 — A FLORESTA. Escura. Cogumelo-mola e plataforma que anda.
// ---------------------------------------------------------------------------
function faseFloresta() {
  const c = new Construtor(214, 24);
  const CH = 18;
  c.comecar(4, CH);

  c.chao(0, 22, CH);
  c.enfeite('tronco', 7, CH - 1, false);
  c.enfeite('cogumelo', 12, CH - 1, false);
  c.enfeite('arbusto', 16, CH - 1, false);
  c.enfeite('lanterna', 19, CH - 3);
  c.trilha(9, CH - 3, 4);

  c.chao(25, 40, CH);
  c.enfeite('arbusto', 27, CH - 1, false);
  c.inimigo(31, CH, 'sombra', 5);
  c.mola(36, CH - 1);
  c.plat(34, CH - 7, 5);
  c.carta(36, CH - 9);
  c.enfeite('lanterna', 39, CH - 3);

  // plataformas móveis sobre o vazio
  c.movel(43, CH - 3, 3, 6, 0, 30);
  c.movel(52, CH - 6, 3, 0, 4, 24);
  c.chao(58, 72, CH - 2);
  c.checkpoint(60, CH - 2);
  c.enfeite('cogumelo', 63, CH - 3, false);
  c.inimigo(66, CH - 2, 'sombra', 4);
  c.inimigo(69, CH - 8, 'vagalume', 5);
  c.trilha(44, CH - 5, 3);

  // subida em cogumelos
  c.chao(75, 82, CH);
  c.mola(78, CH - 1);
  c.plat(76, CH - 7, 4);
  c.plat(82, CH - 10, 4);
  c.carta(84, CH - 12);
  c.trilha(77, CH - 9, 3);
  c.enfeite('lanterna', 81, CH - 3);

  c.chao(86, 104, CH - 4);
  c.checkpoint(88, CH - 4);
  c.inimigo(94, CH - 4, 'sombra', 6);
  c.inimigo(99, CH - 10, 'vagalume', 6);
  c.espinhos(97, 99, CH - 5);
  c.plat(96, CH - 9, 5);
  c.enfeite('tronco', 101, CH - 5, false);

  // corredor de vaga-lumes
  c.chao(107, 126, CH);
  c.enfeite('arbusto', 110, CH - 1, false);
  c.enfeite('cogumelo', 116, CH - 1, false);
  c.inimigo(112, CH - 6, 'vagalume', 4);
  c.inimigo(118, CH - 7, 'vagalume', 5);
  c.inimigo(123, CH - 5, 'vagalume', 4);
  c.arco(110, CH - 3, 7, 3);
  c.carta(120, CH - 9);

  // descida com plataformas móveis verticais
  c.movel(129, CH - 4, 3, 0, 6, 30);
  c.movel(136, CH - 8, 3, 0, 6, 26);
  c.chao(142, 158, CH - 1);
  c.checkpoint(144, CH - 1);
  c.mola(150, CH - 2);
  c.inimigo(154, CH - 1, 'sombra', 4);
  c.plat(148, CH - 8, 5);
  c.trilha(149, CH - 10, 4);

  c.chao(161, 178, CH);
  c.espinhos(166, 168, CH - 1);
  c.plat(165, CH - 4, 5);
  c.inimigo(173, CH, 'sombra', 4);
  c.enfeite('tronco', 176, CH - 1, false);

  // a clareira
  c.chao(181, 213, CH);
  c.enfeite('lanterna', 184, CH - 3);
  c.enfeite('lanterna', 200, CH - 3);
  c.enfeite('cogumelo', 190, CH - 1, false);
  c.enfeite('arbusto', 196, CH - 1, false);
  c.inimigo(188, CH - 7, 'vagalume', 6);
  c.trilha(186, CH - 3, 6);
  c.checkpoint(203, CH);
  c.final(208, CH);
  return c;
}

// ---------------------------------------------------------------------------
// FASE 3 — A CIDADE NA CHUVA. Telhados, vão largo, subida de verdade.
// ---------------------------------------------------------------------------
function faseCidade() {
  const c = new Construtor(226, 28);
  const CH = 22;
  c.comecar(4, CH);

  c.chao(0, 24, CH);
  c.enfeite('poste', 8, CH - 1);
  c.enfeite('lixeira', 13, CH - 1, false);
  c.enfeite('letreiro', 18, CH - 5);
  c.trilha(10, CH - 3, 5);
  c.inimigo(20, CH, 'guardachuva', 4);

  // sobe para o telhado
  c.escada(26, CH - 1, 3);
  c.chao(29, 44, CH - 3);
  c.enfeite('poste', 33, CH - 4);
  c.inimigo(38, CH - 3, 'guardachuva', 5);
  c.plat(40, CH - 8, 4);
  c.carta(42, CH - 10);
  c.checkpoint(31, CH - 3);

  // vão largo entre prédios, com plataforma móvel no meio
  c.movel(47, CH - 6, 4, 7, 0, 40);
  c.chao(58, 74, CH - 6);
  c.enfeite('letreiro', 62, CH - 9);
  c.inimigo(66, CH - 6, 'guardachuva', 5);
  c.inimigo(70, CH - 12, 'pombo', 6);
  c.plat(63, CH - 11, 5);
  c.trilha(64, CH - 13, 4);

  // escadaria de plataformas descendo
  c.plat(77, CH - 9, 3);
  c.plat(82, CH - 7, 3);
  c.plat(87, CH - 5, 3);
  c.chao(91, 108, CH - 2);
  c.checkpoint(93, CH - 2);
  c.enfeite('lixeira', 96, CH - 3, false);
  c.enfeite('poste', 101, CH - 3);
  c.inimigo(99, CH - 2, 'guardachuva', 4);
  c.espinhos(104, 106, CH - 3);
  c.plat(103, CH - 6, 5);
  c.carta(105, CH - 8);

  // beco: subida vertical apertada
  c.chao(111, 116, CH);
  c.bloco(117, CH - 1, 1, 1);
  c.plat(112, CH - 4, 3);
  c.plat(116, CH - 7, 3);
  c.plat(112, CH - 10, 3);
  c.plat(116, CH - 13, 3);
  c.trilha(113, CH - 6, 2);
  c.carta(117, CH - 15);
  c.inimigo(114, CH - 12, 'pombo', 4);

  c.chao(120, 140, CH - 14);
  c.checkpoint(122, CH - 14);
  c.enfeite('letreiro', 126, CH - 17);
  c.enfeite('poste', 132, CH - 15);
  c.inimigo(130, CH - 14, 'guardachuva', 5);
  c.inimigo(137, CH - 20, 'pombo', 6);
  c.trilha(124, CH - 17, 5);

  // travessia alta, plataformas móveis nos dois eixos
  c.movel(144, CH - 14, 3, 0, 5, 34);
  c.movel(151, CH - 12, 3, 6, 0, 44);
  c.movel(162, CH - 16, 3, 0, 6, 30);
  c.chao(168, 184, CH - 10);
  c.checkpoint(170, CH - 10);
  c.inimigo(176, CH - 10, 'guardachuva', 5);
  c.plat(178, CH - 15, 5);
  c.carta(180, CH - 17);
  c.enfeite('letreiro', 173, CH - 13);

  // descida final até a rua
  c.plat(187, CH - 8, 4);
  c.plat(193, CH - 5, 4);
  c.chao(198, 225, CH);
  c.enfeite('poste', 202, CH - 1);
  c.enfeite('lixeira', 207, CH - 1, false);
  c.enfeite('letreiro', 212, CH - 5);
  c.inimigo(205, CH, 'guardachuva', 5);
  c.trilha(200, CH - 3, 6);
  c.checkpoint(215, CH);
  c.final(220, CH);
  return c;
}

// ---------------------------------------------------------------------------
// FASE 4 — O CÉU. Subida. Nuvem que desmancha, muito ar embaixo.
// ---------------------------------------------------------------------------
function faseCeu() {
  const c = new Construtor(150, 46);
  const BASE = 42;
  c.comecar(4, BASE);

  c.chao(0, 20, BASE);
  c.enfeite('balao', 8, BASE - 4);
  c.enfeite('passarinho', 14, BASE - 6);
  c.trilha(9, BASE - 3, 5);

  // começo da subida
  c.plat(23, BASE - 3, 4);
  c.plat(29, BASE - 6, 4);
  c.plat(24, BASE - 9, 4);
  c.plat(30, BASE - 12, 5);
  c.carta(32, BASE - 14);
  c.inimigo(27, BASE - 8, 'nuvenzinha', 4);
  c.trilha(25, BASE - 5, 3);

  c.chao(36, 50, BASE - 14);
  c.checkpoint(38, BASE - 14);
  c.enfeite('balao', 42, BASE - 18);
  c.mola(46, BASE - 15);
  c.inimigo(44, BASE - 14, 'nuvenzinha', 5);
  c.plat(44, BASE - 21, 5);
  c.trilha(46, BASE - 19, 3);

  // nuvens frágeis: pisou, tem meio segundo
  c.fragil(53, BASE - 20, 3);
  c.fragil(58, BASE - 22, 3);
  c.fragil(63, BASE - 20, 3);
  c.plat(68, BASE - 23, 4);
  c.carta(70, BASE - 25);
  c.inimigo(60, BASE - 27, 'nuvenzinha', 6);

  c.chao(74, 88, BASE - 24);
  c.checkpoint(76, BASE - 24);
  c.enfeite('passarinho', 80, BASE - 28);
  c.inimigo(83, BASE - 24, 'nuvenzinha', 5);
  c.movel(90, BASE - 26, 3, 0, 6, 30);
  c.plat(96, BASE - 29, 4);
  c.trilha(91, BASE - 29, 3);

  // trecho de plataformas móveis largas, o mais alto da subida
  c.movel(102, BASE - 30, 4, 6, 0, 38);
  c.fragil(112, BASE - 32, 3);
  c.movel(117, BASE - 33, 3, 0, 5, 28);
  c.chao(123, 136, BASE - 34);
  c.checkpoint(125, BASE - 34);
  c.carta(129, BASE - 36);
  c.inimigo(132, BASE - 34, 'nuvenzinha', 4);
  c.enfeite('balao', 127, BASE - 38);

  // o terraço da lua
  c.plat(139, BASE - 37, 3);
  c.chao(142, 149, BASE - 40);
  c.trilha(139, BASE - 39, 3);
  c.enfeite('balao', 145, BASE - 44);
  c.checkpoint(144, BASE - 40);
  c.final(146, BASE - 40);
  return c;
}

const FABRICAS = [fasePraia, faseFloresta, faseCidade, faseCeu];

// ---------------------------------------------------------------------------
export function construirFase(n) {
  const i = Math.max(0, Math.min(3, n - 1));
  const c = FABRICAS[i]();
  const nomeTema = ORDEM[i];
  const tema = TEMAS[nomeTema];

  // As cartas do mapa recebem, na ordem, as memórias escritas em
  // personalizacao.js. Se houver mais pontos que memórias, os pontos que
  // sobram viram coração — melhor do que uma carta vazia.
  const mems = memoriasDoMundo(n);
  let k = 0;
  for (const it of c.itens) {
    if (it.tipo !== 'carta') continue;
    if (k < mems.length) it.memoria = mems[k++];
    else it.tipo = 'coracao';
  }

  return {
    numero: n,
    nomeTema,
    tema,
    info: MUNDOS[i],
    mapa: c.mapa,
    itens: c.itens,
    inimigos: c.inimigos,
    decor: c.decor,
    moveis: c.moveis,
    molas: c.molas,
    checkpoints: c.checkpoints,
    gaiola: c.gaiola,
    inicio: c.inicio,
    totalCartas: mems.length,
  };
}

export const NUM_FASES = FABRICAS.length;
