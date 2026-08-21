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

import { Mapa, T, SOLIDO, PLATAFORMA, ESPINHO, AGUA, FRAGIL } from './tiles.js';
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
    this.dicas = [];
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
  // Dica que aparece quando ela passa por este ponto. Só a fase 1 usa: quem
  // não joga plataforma há vinte anos precisa que alguém diga como pular.
  dica(x, texto) { this.dicas.push({ x: x * T, texto, dito: false }); return this; }
  comecar(x, y) { this.inicio = { x: x * T + T / 2, y: y * T }; return this; }
  final(x, y) { this.gaiola = { x: x * T + T / 2, y: y * T, aberta: false }; return this; }
}

// ---------------------------------------------------------------------------
// REGRAS DE PROJETO DAS FASES (medidas com a física de systems/jogador.js)
//
//   pulo parado sobe .......... 48 px = 3 tiles, no limite exato
//   alcance correndo .......... ~100 px = 6 tiles
//   mola arremessa ............ ~134 px = 8 tiles
//
// Por isso, aqui:
//   DEGRAU MÁXIMO = 2 TILES (32 px). Três tiles é a altura exata do pulo,
//     e "exato" significa que só acerta quem sai no pixel certo com a
//     velocidade certa. Um robô de teste travou justamente nisso, e uma
//     pessoa travaria também.
//   VÃO MÁXIMO = 4 TILES no plano, 3 se ainda estiver subindo.
//   CARTA fica no máximo 2 tiles acima de algum lugar onde dê pra pisar.
//     Memória inalcançável é pior do que memória nenhuma.
//   BICHO DE CHÃO fica a pelo menos 2 tiles da beirada. Um esbarrão atordoa
//     por meio segundo, e meio segundo andando é o bastante para ela sair
//     andando do penhasco sem poder fazer nada. Levar um coração por uma
//     escolha ruim é justo; levar por uma que ela não pôde tomar, não.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FASE 1 — A PRAIA. Ensina andar, pular e pisar. O primeiro erro do jogador
// não pode custar caro: até a metade não existe buraco que puna.
// ---------------------------------------------------------------------------
function fasePraia() {
  const c = new Construtor(196, 22);
  const CH = 16;
  c.comecar(4, CH);

  // respiro: chão liso e reto, só pra sentir o controle
  c.chao(0, 26, CH);
  c.enfeite('palmeira', 8, CH);
  c.enfeite('guardasol', 15, CH);
  c.enfeite('concha', 12, CH, false);
  c.enfeite('castelo', 20, CH, false);
  c.trilha(10, CH - 3, 5);
  c.dica(6, 'setas ou A/D para andar   ·   shift corre');
  c.dica(16, 'espaço para pular — segurando, pula mais alto');
  c.dica(30, 'os corações mostram por onde dá pra ir');

  // primeiro degrau e primeiro caranguejo
  c.agua(27, 28, CH);
  c.chao(29, 44, CH - 1);
  c.inimigo(38, CH - 1, 'caranguejo', 4);
  c.arco(29, CH - 3, 5, 2);
  c.enfeite('palmeira', 41, CH - 1);
  c.enfeite('pedra', 33, CH - 1, false);

  // plataformas sobre a água, subindo de dois em dois tiles
  c.agua(45, 57, CH);
  c.plat(46, CH - 3, 4);
  c.plat(52, CH - 5, 4);
  c.carta(53, CH - 7);
  c.dica(45, 'a carta lá em cima é uma memória. Encoste nela.');
  c.trilha(47, CH - 5, 3);

  c.chao(59, 78, CH);
  c.checkpoint(61, CH);
  c.enfeite('palmeira', 63, CH);
  c.dica(63, 'pule EM CIMA do caranguejo. Encostar de lado dói.');
  c.inimigo(68, CH, 'caranguejo', 5);
  c.inimigo(74, CH, 'caranguejo', 3);
  c.bloco(71, CH - 2, 2, 1);
  c.coracao(71, CH - 4); c.coracao(72, CH - 4);

  // escadinha e mirante
  c.escada(79, CH - 1, 4);
  c.chao(83, 96, CH - 4);
  c.enfeite('guardasol', 88, CH - 4);
  c.inimigo(92, CH - 4, 'caranguejo', 4);
  c.plat(87, CH - 6, 3);
  c.plat(92, CH - 8, 3);
  c.carta(93, CH - 10);
  c.trilha(85, CH - 6, 3);

  // descida em plataformas, com uma gaivota cruzando
  c.agua(97, 108, CH);
  c.plat(98, CH - 5, 3);
  c.plat(102, CH - 3, 3);
  c.inimigo(104, CH - 8, 'gaivota', 6);
  c.plat(106, CH - 2, 3);

  c.chao(110, 130, CH);
  c.checkpoint(112, CH);
  c.enfeite('palmeira', 115, CH);
  c.enfeite('concha', 119, CH, false);
  c.inimigo(122, CH, 'caranguejo', 5);
  c.dica(112, 'a bandeira salva o ponto. Cair custa um coração, só isso.');
  c.dica(124, 'pise na mola.');
  c.mola(126, CH - 1);
  c.coracao(126, CH - 5); c.coracao(126, CH - 7);
  c.carta(126, CH - 7);   // a mola sobe 8 tiles; 7 deixa folga

  // vãos de verdade, agora que já sabe pular
  c.chao(133, 140, CH);
  c.chao(144, 150, CH);
  c.chao(154, 162, CH);
  c.arco(140, CH - 2, 4, 2);
  c.arco(150, CH - 2, 4, 2);
  c.inimigo(147, CH, 'caranguejo', 2);
  c.enfeite('palmeira', 158, CH);

  // o píer: madeira sobre a água, e ele no fim dela
  c.agua(163, 195, CH + 1);
  for (let x = 164; x <= 190; x++) c.plat(x, CH, 1);
  c.enfeite('palmeira', 166, CH);
  c.enfeite('guardasol', 176, CH);
  c.inimigo(172, CH, 'caranguejo', 3);
  c.inimigo(180, CH - 5, 'gaivota', 5);
  c.trilha(168, CH - 3, 4);
  c.plat(177, CH - 3, 3);
  c.carta(178, CH - 5);
  c.dica(180, 'ele está ali dentro. Encoste na bolha.');
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
  c.enfeite('tronco', 7, CH, false);
  c.enfeite('cogumelo', 12, CH, false);
  c.enfeite('arbusto', 16, CH, false);
  c.enfeite('lanterna', 19, CH);
  c.trilha(9, CH - 3, 4);

  c.arco(22, CH - 2, 4, 2);
  c.chao(25, 40, CH);
  c.enfeite('arbusto', 27, CH, false);
  c.inimigo(31, CH, 'sombra', 5);
  c.mola(36, CH - 1);
  c.plat(34, CH - 7, 5);        // alcançada pela mola (8 tiles de impulso)
  c.carta(36, CH - 9);
  c.enfeite('lanterna', 39, CH);

  // plataformas móveis sobre o vazio
  c.movel(43, CH - 2, 3, 6, 0, 30);
  c.movel(52, CH - 4, 3, 0, 4, 24);
  c.chao(58, 72, CH - 2);
  c.checkpoint(60, CH - 2);
  c.enfeite('cogumelo', 63, CH - 2, false);
  c.inimigo(66, CH - 2, 'sombra', 4);
  c.inimigo(69, CH - 8, 'vagalume', 5);
  c.trilha(44, CH - 4, 3);

  // subida em cogumelos
  c.chao(75, 82, CH);
  c.mola(78, CH - 1);
  c.plat(76, CH - 7, 4);
  c.plat(81, CH - 9, 4);
  c.carta(83, CH - 11);
  c.trilha(77, CH - 9, 3);
  c.enfeite('lanterna', 81, CH);

  c.chao(86, 104, CH - 4);
  c.checkpoint(88, CH - 4);
  c.inimigo(94, CH - 4, 'sombra', 6);
  c.inimigo(99, CH - 10, 'vagalume', 6);
  c.espinhos(97, 99, CH - 5);
  c.plat(95, CH - 6, 6);        // ponte por cima dos espinhos
  c.carta(97, CH - 8);
  c.enfeite('tronco', 101, CH - 4, false);

  // corredor de vaga-lumes
  c.arco(104, CH - 2, 4, 2);
  c.chao(107, 126, CH);
  c.enfeite('arbusto', 110, CH, false);
  c.enfeite('cogumelo', 116, CH, false);
  c.inimigo(112, CH - 6, 'vagalume', 4);
  c.inimigo(118, CH - 7, 'vagalume', 5);
  c.inimigo(123, CH - 5, 'vagalume', 4);
  c.arco(110, CH - 3, 7, 3);
  c.plat(118, CH - 2, 4);
  c.carta(120, CH - 4);

  // descida com plataformas móveis verticais
  c.movel(129, CH - 2, 3, 0, 5, 30);
  c.movel(136, CH - 6, 3, 0, 5, 26);
  c.chao(142, 158, CH - 1);
  c.checkpoint(144, CH - 1);
  c.mola(150, CH - 2);
  c.inimigo(151, CH - 1, 'sombra', 3);
  c.plat(148, CH - 8, 5);
  c.trilha(149, CH - 10, 4);

  c.arco(158, CH - 3, 5, 2);
  c.chao(161, 178, CH);
  c.espinhos(166, 168, CH - 1);
  c.plat(165, CH - 2, 5);
  c.inimigo(173, CH, 'sombra', 4);
  c.enfeite('tronco', 176, CH, false);

  // a clareira
  c.arco(178, CH - 2, 4, 2);
  c.chao(181, 213, CH);
  c.enfeite('lanterna', 184, CH);
  c.enfeite('lanterna', 200, CH);
  c.enfeite('cogumelo', 190, CH, false);
  c.enfeite('arbusto', 196, CH, false);
  c.inimigo(188, CH - 7, 'vagalume', 6);
  c.trilha(186, CH - 3, 6);
  c.checkpoint(203, CH);
  c.final(208, CH);
  return c;
}

// ---------------------------------------------------------------------------
// FASE 3 — A CIDADE NA CHUVA. Telhados, vão largo, e um beco que sobe.
// ---------------------------------------------------------------------------
function faseCidade() {
  const c = new Construtor(226, 28);
  const CH = 22;
  c.comecar(4, CH);

  c.chao(0, 24, CH);
  c.enfeite('poste', 8, CH);
  c.enfeite('lixeira', 13, CH, false);
  c.enfeite('letreiro', 18, CH - 4);
  c.trilha(10, CH - 3, 5);
  c.inimigo(20, CH, 'guardachuva', 4);

  // sobe para o telhado
  c.escada(26, CH - 1, 3);
  c.chao(29, 44, CH - 3);
  c.enfeite('poste', 33, CH - 3);
  c.inimigo(38, CH - 3, 'guardachuva', 5);
  c.checkpoint(31, CH - 3);
  c.plat(38, CH - 5, 3);
  c.plat(42, CH - 7, 3);
  c.carta(43, CH - 9);

  // vão largo entre prédios, com plataforma móvel no meio
  c.movel(47, CH - 5, 4, 7, 0, 40);
  c.chao(58, 74, CH - 6);
  c.enfeite('letreiro', 62, CH - 8);
  c.inimigo(66, CH - 6, 'guardachuva', 5);
  c.inimigo(70, CH - 12, 'pombo', 6);
  c.plat(61, CH - 8, 3);
  c.plat(65, CH - 10, 4);
  c.trilha(66, CH - 12, 4);

  // escadaria de plataformas descendo
  c.plat(77, CH - 8, 3);
  c.plat(82, CH - 6, 3);
  c.plat(87, CH - 4, 3);
  c.arco(88, CH - 6, 4, 2);
  c.chao(91, 108, CH - 2);
  c.checkpoint(93, CH - 2);
  c.enfeite('lixeira', 96, CH - 2, false);
  c.enfeite('poste', 101, CH - 2);
  c.inimigo(99, CH - 2, 'guardachuva', 4);
  c.espinhos(104, 106, CH - 3);
  c.plat(103, CH - 4, 5);
  c.carta(105, CH - 6);

  // o beco: subida vertical, dois tiles por vez, alternando os lados
  c.arco(108, CH - 3, 4, 2);
  c.chao(111, 116, CH);
  c.bloco(117, CH - 1, 1, 1);
  c.plat(112, CH - 2, 3);
  c.plat(116, CH - 4, 3);
  c.plat(112, CH - 6, 3);
  c.plat(116, CH - 8, 3);
  c.plat(112, CH - 10, 3);
  c.plat(116, CH - 12, 3);
  c.trilha(113, CH - 4, 2);
  c.carta(117, CH - 14);
  c.inimigo(114, CH - 12, 'pombo', 4);

  c.chao(120, 140, CH - 14);
  c.checkpoint(122, CH - 14);
  c.enfeite('letreiro', 126, CH - 16);
  c.enfeite('poste', 132, CH - 14);
  c.inimigo(130, CH - 14, 'guardachuva', 5);
  c.inimigo(137, CH - 20, 'pombo', 6);
  c.trilha(124, CH - 17, 5);

  // travessia alta, plataformas móveis nos dois eixos
  c.movel(144, CH - 14, 3, 0, 5, 34);
  c.movel(151, CH - 12, 3, 6, 0, 44);
  c.movel(162, CH - 15, 3, 0, 5, 30);
  c.chao(168, 184, CH - 10);
  c.checkpoint(170, CH - 10);
  c.inimigo(176, CH - 10, 'guardachuva', 5);
  c.plat(176, CH - 12, 4);
  c.carta(178, CH - 14);
  c.enfeite('letreiro', 173, CH - 12);

  // descida final até a rua
  c.plat(187, CH - 8, 4);
  c.plat(192, CH - 5, 4);
  c.plat(197, CH - 3, 3);
  c.arco(197, CH - 4, 4, 2);
  c.chao(200, 225, CH);
  c.enfeite('poste', 204, CH);
  c.enfeite('lixeira', 208, CH, false);
  c.enfeite('letreiro', 212, CH - 4);
  c.inimigo(206, CH, 'guardachuva', 5);
  c.trilha(202, CH - 3, 6);
  c.checkpoint(215, CH);
  c.final(220, CH);
  return c;
}

// ---------------------------------------------------------------------------
// FASE 4 — O CÉU. Subida. Nuvem que desmancha, muito ar embaixo.
// ---------------------------------------------------------------------------
function faseCeu() {
  const c = new Construtor(150, 46);
  const B = 42;
  c.comecar(4, B);

  // No céu não existe "chão": existe ilha de nuvem. Por isso aqui é bloco de
  // três tiles de espessura e não chao(), que preencheria até o fundo do
  // mapa e transformaria cada plataforma numa coluna branca de dez andares.
  const ilha = (x0, x1, y, h = 3) => c.bloco(x0, y, x1 - x0 + 1, h);

  ilha(0, 20, B, 4);
  c.enfeite('balao', 8, B - 4);
  c.enfeite('passarinho', 14, B - 6);
  c.trilha(9, B - 3, 5);

  // começo da subida: zigue-zague de dois em dois tiles
  c.plat(23, B - 2, 4);
  c.plat(28, B - 4, 4);
  c.plat(24, B - 6, 4);
  c.plat(29, B - 8, 4);
  c.plat(25, B - 10, 4);
  c.plat(30, B - 12, 5);
  c.carta(32, B - 14);
  c.inimigo(27, B - 6, 'nuvenzinha', 4);
  c.trilha(25, B - 4, 3);

  ilha(36, 50, B - 14);
  c.checkpoint(38, B - 14);
  c.enfeite('balao', 42, B - 18);
  c.mola(46, B - 15);
  c.inimigo(44, B - 14, 'nuvenzinha', 5);
  c.plat(44, B - 21, 5);       // a mola sobe 8 tiles, sobra folga
  c.trilha(46, B - 23, 3);
  c.carta(48, B - 23);

  // nuvens frágeis: pisou, tem meio segundo
  c.fragil(52, B - 21, 3);
  c.fragil(57, B - 23, 3);
  c.fragil(63, B - 21, 3);
  c.plat(68, B - 22, 4);
  c.carta(70, B - 24);
  c.inimigo(60, B - 27, 'nuvenzinha', 6);

  ilha(74, 88, B - 24);
  c.checkpoint(76, B - 24);
  c.enfeite('passarinho', 80, B - 28);
  c.inimigo(82, B - 24, 'nuvenzinha', 4);
  c.movel(90, B - 24, 3, 0, 4, 30);
  c.plat(96, B - 26, 4);
  c.trilha(91, B - 26, 3);

  // trecho mais alto: móveis largas e uma nuvem frágil no meio
  c.movel(102, B - 28, 4, 6, 0, 38);
  c.fragil(112, B - 30, 3);
  c.movel(117, B - 31, 3, 0, 4, 28);
  ilha(123, 136, B - 32);
  c.checkpoint(125, B - 32);
  c.plat(128, B - 34, 4);
  c.carta(130, B - 36);
  c.inimigo(131, B - 32, 'nuvenzinha', 3);
  c.enfeite('balao', 127, B - 36);

  // o terraço da lua
  c.plat(139, B - 34, 3);
  ilha(142, 149, B - 36, 4);
  c.trilha(139, B - 36, 3);
  c.enfeite('balao', 145, B - 40);
  c.checkpoint(144, B - 36);
  c.final(146, B - 36);
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
  // personalizacao.js.
  //
  // O número de memórias por mundo é livre, e as duas sobras são tratadas:
  // se sobrar PONTO, ele vira coração (melhor que carta vazia); se sobrar
  // MEMÓRIA, um coração espaçado vira carta. Sem isso, escrever seis
  // memórias num mundo com quatro pontos deixaria duas inalcançáveis para
  // sempre, e o álbum nunca fecharia.
  const mems = memoriasDoMundo(n);
  let k = 0;
  for (const it of c.itens) {
    if (it.tipo !== 'carta') continue;
    if (k < mems.length) it.memoria = mems[k++];
    else it.tipo = 'coracao';
  }
  if (k < mems.length) {
    const corações = c.itens.filter(i => i.tipo === 'coracao');
    const passo = Math.max(1, Math.floor(corações.length / (mems.length - k + 1)));
    for (let i = 0; k < mems.length && i < corações.length; i += passo) {
      corações[i].tipo = 'carta';
      corações[i].memoria = mems[k++];
    }
  }
  const totalCartas = c.itens.filter(i => i.tipo === 'carta').length;

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
    dicas: c.dicas,
    gaiola: c.gaiola,
    inicio: c.inicio,
    totalCartas,
  };
}

export const NUM_FASES = FABRICAS.length;
