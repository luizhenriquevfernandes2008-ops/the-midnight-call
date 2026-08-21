// pessoa.js — o boneco articulado, montado a partir de uma aparência.
//
// ESTA É A PEÇA CENTRAL DO JOGO. É aqui que "ficar parecida com ela"
// acontece de verdade.
//
// A personagem não é uma folha de sprites pronta. Ela é montada na hora, a
// partir de um objeto `look` com uns vinte números (tom de pele, cor e
// estilo do cabelo, franja, formato do olho, roupa...). Cada peça é uma
// gradezinha de caracteres onde o caractere não é uma cor fixa, e sim um
// PAPEL — 'S' quer dizer "pele base", 'h' quer dizer "cabelo base" — e o
// mapa que traduz papel em cor nasce do `look`. Trocar de castanho para
// ruivo é trocar um número: os três tons do cabelo mudam juntos e o volume
// do desenho continua de pé.
//
// Custo disso: umas quarenta imagens minúsculas geradas quando a aparência
// muda. No editor isso acontece a cada tecla e ninguém percebe.
//
// ESPAÇO DE COORDENADAS
// Todas as peças da cabeça (crânio, cabelo, franja, óculos, laço, brinco)
// são desenhadas numa grade de 22 colunas com o pivô em [10,14] — o ponto
// onde a cabeça encosta no pescoço. Como o pivô é o mesmo para todas, elas
// se encaixam sozinhas, e o rig só precisa saber uma posição de cabeça.

import { sprite, escurecer } from './pixel.js';
import { PELES, CABELOS, TECIDOS, SAPATOS, OLHOS, ESCLERA, PUPILA, BRILHO_OLHO, COR }
  from './paleta.js';
import { clamp, mixHex } from '../core/gfx.js';

// ---------------------------------------------------------------------------
// medidas do esqueleto, em pixels a partir do chão (para cima é negativo)
// ---------------------------------------------------------------------------
// Conferência da soma, que é o que impede o pé de flutuar: o quadril está
// 16 acima do chão, o pescoço 13 acima do quadril, e a cabeça tem 15 de
// altura. 16 + 13 + 15 = 44. Do outro lado: coxa 7 + canela 6 + pé 3 = 16,
// que devolve exatamente o quadril ao chão.
export const ALTURA = 44;
export const QUADRIL_Y = -16;
export const OMBRO_OFF = -12;     // do quadril até a linha do ombro
export const CABECA_OFF = -13;    // do quadril até o encaixe da cabeça
export const COXA = 7;
export const CANELA = 6;
export const BRACO = 6;
export const ANTEBRACO = 6;
// O braço de trás fica mais afastado do centro que o da frente. Com os dois
// no mesmo deslocamento ele some dentro da silhueta do tronco e a
// personagem parece ter um braço só.
export const BRACO_X = 3;
export const BRACO_X_TRAS = 4;
export const PERNA_X = 2;

export const PIVO_CABECA = [10, 14];

// ---------------------------------------------------------------------------
// mapa de papéis -> cores, a partir do look
// ---------------------------------------------------------------------------
function mapaDeCores(look) {
  const pe = PELES[clamp(look.pele | 0, 0, PELES.length - 1)];
  const cb = CABELOS[clamp(look.cabeloCor | 0, 0, CABELOS.length - 1)];
  const cima = TECIDOS[clamp(look.corCima | 0, 0, TECIDOS.length - 1)];
  const baixo = TECIDOS[clamp(look.corBaixo | 0, 0, TECIDOS.length - 1)];
  const sap = SAPATOS[clamp(look.corSapato | 0, 0, SAPATOS.length - 1)];
  const iris = OLHOS[clamp(look.olhoCor | 0, 0, OLHOS.length - 1)];

  return {
    t: pe[0], S: pe[1], s: pe[2], q: pe[3],
    // O rubor não é uma cor nova: é a pele puxada para o rosa. Assim ele
    // funciona em pele clara e em pele escura sem virar mancha.
    r: mixHex(pe[1], '#ff6f8f', 0.30),
    // Sarda: a própria sombra da pele, um degrau mais quente.
    f: mixHex(pe[2], '#8a4a22', 0.35),

    g: cb[0], h: cb[1], H: cb[2],
    // Cílio e sobrancelha seguem o cabelo, mas sempre mais escuros — cílio
    // da cor exata do cabelo some no cabelo.
    o: mixHex(cb[2], '#1a1018', 0.45),

    A: cima[0], a: cima[1], n: cima[2],
    B: baixo[0], b: baixo[1], m: baixo[2],
    P: sap[0], p: sap[1], d: sap[2],

    E: ESCLERA, e: PUPILA, i: iris, w: BRILHO_OLHO,
    k: COR.linha,
    y: '#ffd76e',        // metal do brinco e da fivela
    Y: '#b98b2e',
    W: '#ffffff',
    x: '#00000055',      // sombra translúcida
  };
}

// ---------------------------------------------------------------------------
// grades editáveis
// ---------------------------------------------------------------------------
function grade(linhas) { return linhas.map(l => l.split('')); }
function texto(g) { return g.map(l => l.join('')); }

// Carimba `linhas` em cima da grade a partir de (cx, cy). Ponto vira
// "não mexe": é o que deixa desenhar um olho por cima de um rosto pronto.
function estampar(g, cx, cy, linhas) {
  for (let y = 0; y < linhas.length; y++) {
    const gy = cy + y;
    if (gy < 0 || gy >= g.length) continue;
    for (let x = 0; x < linhas[y].length; x++) {
      const c = linhas[y][x];
      if (c === '.') continue;
      const gx = cx + x;
      if (gx < 0 || gx >= g[gy].length) continue;
      g[gy][gx] = c;
    }
  }
}

function px(g, x, y, c) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[y].length) g[y][x] = c;
}

// ---------------------------------------------------------------------------
// a cabeça
// ---------------------------------------------------------------------------
// Vista de três quartos virada para a DIREITA: o rosto ocupa a metade
// direita da grade, a orelha fica na esquerda e o nariz sai da silhueta.
// Um rosto simétrico nesta altura lê como "de costas".
const CRANIO = [
  '........qqqqqq........',
  '......qqSSSSSSqq......',
  '.....qSSSSSSSSSSq.....',
  '.....qSSSSSSSSSSq.....',
  '....qSSSSSSSSSSSSq....',
  '....qSSSSSSSSSSSSq....',
  '....qSSSSSSSSSSSSq....',
  '....qSSSSSSSSSSSSq....',
  '....qSSSSSSSSSSSSq....',
  '....qSSSSSSSSSSSSq....',
  '....qSSSSSSSSSSSSq....',
  '.....qSSSSSSSSSSq.....',
  '.....qSSSSSSSSSq......',
  '......qSSSSSSSq.......',
  '.......qqSSSSqq.......',
];

// olho: [colunaÂncora, linhaÂncora, linhas]
// LINHAS DO ROSTO — a coisa mais importante deste arquivo.
//   1-6   testa (é aqui que a franja mora)
//   6     sobrancelha
//   7-9   olho
//   10    nariz
//   10-11 maçã do rosto (rubor)
//   11-12 boca
//   13-14 queixo
// O olho fica a uns 60% da altura da cabeça, não no meio: rosto com olho
// no centro lê como adulto, e é a testa alta que faz a cara ser fofa.
// A primeira versão tinha o olho em 5-7 e a franja comia ele inteiro: a
// personagem ficava sem rosto. Vale repetir porque é fácil de reintroduzir
// mexendo em qualquer um dos dois.
const OLHO_FORMAS = [
  // redondo — o padrão. Cílio em cima, íris, pupila e um brilho na quina
  // da frente. O brilho é UM pixel branco e é ele que dá vida ao rosto;
  // sem ele o olho vira um furo.
  { cx: 11, cy: 7, linhas: ['.oooo', '.Eiew', '..qq.'] },
  // amendoado — cílio embaixo também, o que fecha a abertura do olho
  { cx: 11, cy: 7, linhas: ['.oooo', '.Eiew', '.ooq.'] },
  // grande — uma linha a mais de íris
  { cx: 11, cy: 7, linhas: ['.oooo', 'EEiew', '.Eiee', '..qq.'] },
];

const SOBRANCELHAS = [
  { cx: 12, cy: 6, linhas: ['..oo'] },          // fina
  { cx: 12, cy: 6, linhas: ['.ooo'] },          // média
  { cx: 12, cy: 5, linhas: ['.ooo', 'oo..'] },  // marcada
];

const BOCAS = [
  // sorriso: o canto sobe. Um pixel a mais em cima na ponta e o rosto
  // inteiro muda de humor.
  { cx: 13, cy: 11, linhas: ['..k', 'kk.'] },
  { cx: 13, cy: 12, linhas: ['kk'] },           // discreta
  { cx: 13, cy: 11, linhas: ['.kk', 'kee'] },   // aberta
];

// Óculos e brinco são peça SEPARADA porque vão por cima do cabelo. Na
// primeira versão eles moravam junto com o rosto, e a franja — que é
// desenhada depois — apagava os dois.
const OCULOS = [
  null,
  // redondo
  { cx: 9, cy: 7, linhas: ['.kkk.kkk', 'k...k...k', 'k..kWk..k', '.kkk.kkk.'] },
  // retangular
  { cx: 9, cy: 7, linhas: ['kkkkkkkkk', 'k...k...k', 'kkkkkkkkk'] },
  // de sol — lente cheia, escura
  { cx: 9, cy: 7, linhas: ['kkkkkkkkk', 'kkkkkkkWk', 'kkkkkkkkk', '.kkk.kkk.'] },
];

const BRINCOS = [
  null,
  { cx: 5, cy: 12, linhas: ['y', 'Y'] },             // argola
  { cx: 5, cy: 12, linhas: ['y', '.', 'y'] },        // pingente
];

function construirCabeca(look, piscando) {
  const g = grade(CRANIO);

  // orelha (some debaixo do cabelo na maioria dos estilos, e tudo bem)
  estampar(g, 5, 9, ['.s', 'qS', '.s']);
  // nariz: uma sombra de um pixel. Saliência de verdade nesta escala vira
  // focinho — o que dá o volume é a sombra, não o contorno.
  px(g, 16, 10, 's');

  const sob = SOBRANCELHAS[clamp(look.sobrancelha | 0, 0, 2)];
  estampar(g, sob.cx, sob.cy, sob.linhas);

  const olho = OLHO_FORMAS[clamp(look.olhoForma | 0, 0, 2)];
  if (piscando) {
    // Olho fechado é o cílio virando uma curva para baixo. Dois quadros de
    // piscada de vez em quando é o que separa "boneco" de "alguém ali".
    estampar(g, olho.cx, olho.cy + 1, ['.oooo', '..oo.']);
  } else {
    estampar(g, olho.cx, olho.cy, olho.linhas);
  }

  const boca = BOCAS[clamp(look.boca | 0, 0, 2)];
  estampar(g, boca.cx, boca.cy, boca.linhas);

  if (look.blush) {
    // Duas fileiras curtas e deslocadas na maçã do rosto. Um retângulo
    // cheio de rubor parece adesivo colado no rosto.
    px(g, 11, 10, 'r'); px(g, 12, 10, 'r');
    px(g, 12, 11, 'r'); px(g, 13, 11, 'r');
  }
  if (look.sardas) {
    px(g, 12, 10, 'f'); px(g, 15, 10, 'f');
    px(g, 13, 11, 'f'); px(g, 16, 11, 'f');
  }

  return texto(g);
}

// Óculos e brinco, na mesma grade da cabeça, para irem por cima do cabelo.
function construirAcessorios(look) {
  const oc = OCULOS[clamp(look.oculos | 0, 0, 3)];
  const br = BRINCOS[clamp(look.brinco | 0, 0, 2)];
  if (!oc && !br) return null;
  const g = grade(new Array(15).fill('.'.repeat(22)));
  if (oc) estampar(g, oc.cx, oc.cy, oc.linhas);
  if (br) estampar(g, br.cx, br.cy, br.linhas);
  return texto(g);
}

// ---------------------------------------------------------------------------
// cabelo
// ---------------------------------------------------------------------------
// Cada estilo tem até três partes:
//   topo   por cima da cabeça (a coroa e o volume que sobra do lado de trás)
//   tras   a massa que cai atrás do corpo — desenhada antes de tudo
//   rabo   um apêndice que balança (rabo de cavalo, trança)
// Tudo na mesma grade de 22 colunas com pivô [10,14].

const CABELOS_ARTE = [
  { // 0 — curto
    nome: 'curto',
    topo: [
      '........HHHHHH........',
      '......HHhhhhhhHH......',
      '.....HhhgggghhhhH.....',
      '.....Hhhghhhhhhh......',
      '....Hhhghhhhh.........',
      '....Hhhhhhh...........',
      '....Hhhhhh............',
      '.....HHhhh............',
      '......HHh.............',
    ],
    tras: null, rabo: null,
  },
  { // 1 — chanel, na altura do queixo
    nome: 'chanel',
    topo: [
      '........HHHHHH........',
      '......HHhhhhhhHH......',
      '.....HhhgggghhhhH.....',
      '.....Hhhghhhhhhh......',
      '....Hhhghhhhh.........',
      '....Hhhghhh...........',
      '...Hhhghhhh...........',
      '...Hhhghhhh...........',
      '...Hhhghhhh...........',
      '...Hhhghhhh...........',
      '...Hhhghhhh...........',
      '...Hhhhhhhh...........',
      '....Hhhhhhh...........',
      '.....HHHHHH...........',
    ],
    tras: null, rabo: null,
  },
  { // 2 — médio, no ombro
    nome: 'medio',
    topo: [
      '........HHHHHH........',
      '......HHhhhhhhHH......',
      '.....HhhgggghhhhH.....',
      '.....Hhhghhhhhhh......',
      '....Hhhghhhhh.........',
      '....Hhhghhh...........',
      '...Hhhghhhh...........',
      '...Hhhghhhh...........',
      '...Hhhghhhh...........',
      '...Hhhhhhhh...........',
      '....Hhhhhhh...........',
    ],
    tras: [
      '......................',
      '......................',
      '......HHHHHHHH........',
      '.....HhhhhhhhhH.......',
      '....Hhhhhhhhhhh.......',
      '...Hhhhhhhhhhhh.......',
      '...Hhhhhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhhhhhhhhhhh.......',
      '..HhhhhhhhhhhhH.......',
      '..HhhhhhhhhhhH........',
      '...HhhhhhhhhH.........',
      '...HHhhhhhhHH.........',
      '....HHHHHHHH..........',
    ],
    rabo: null,
  },
  { // 3 — longo, até o quadril. É o padrão.
    nome: 'longo',
    topo: [
      '........HHHHHH........',
      '......HHhhhhhhHH......',
      '.....HhhgggghhhhH.....',
      '.....Hhhghhhhhhh......',
      '....Hhhghhhhh.........',
      '....Hhhghhh...........',
      '...Hhhghhhh...........',
      '...Hhhghhhh...........',
      '...Hhhghhhh...........',
      '...Hhhhhhhh...........',
      '....Hhhhhhh...........',
    ],
    tras: [
      '......................',
      '......................',
      '......HHHHHHHH........',
      '.....HhhhhhhhhH.......',
      '....Hhhhhhhhhhh.......',
      '...Hhhhhhhhhhhh.......',
      '...Hhhhhhhhhhhh.......',
      '..Hhhhhhhhhhhhh.......',
      '..Hhhhhhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhhhhhhhhhhh.......',
      '..HhhhhhhhhhhhH.......',
      '...HhhhhhhhhhH........',
      '...HHhhhhhhhHH........',
      '....HHhhhhhHH.........',
      '.....HHHHHHH..........',
    ],
    rabo: null,
  },
  { // 4 — longo cacheado. A silhueta é o que faz o cacho ler: a borda entra
    //     e sai a cada duas linhas, e mechas claras descem na diagonal.
    nome: 'cacheado',
    topo: [
      '.......HHHHHHH........',
      '.....HHhhhhhhhHH......',
      '....HhhgggghhhhhhH....',
      '....Hhhghhhhhhhh......',
      '...Hhhghhhhhh.........',
      '...Hhhghhhh...........',
      '..Hhhghhhhh...........',
      '..Hhhhhhhhh...........',
      '...Hhhghhhh...........',
      '..Hhhhhhhhh...........',
      '...Hhhhhhhh...........',
    ],
    tras: [
      '......................',
      '......................',
      '.....HHHHHHHHH........',
      '....HhhhhhhhhhH.......',
      '...Hhhhhhhhhhhh.......',
      '..Hhhhhhhhhhhhh.......',
      '.Hhhghhhhhhhhhhh......',
      '.Hhhghhhhhhhhhhh......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhhh......',
      '.Hhhhhghhhhhhhhh......',
      '..Hhhhghhhhhhhh.......',
      '..Hhhhhghhhhhhh.......',
      '.Hhhhhhghhhhhhhh......',
      '.Hhhhhghhhhhhhhh......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '.Hhhhghhhhhhhhhh......',
      '.Hhhhhghhhhhhhhh......',
      '..Hhhhghhhhhhhh.......',
      '..HhhhhghhhhhhH.......',
      '...HhhhhghhhhH........',
      '..HhhhhhhhhhhhH.......',
      '..HhhhhhhhhhhH........',
      '...HHhhhhhhhH.........',
      '....HHhhhhhHH.........',
      '.....HHHHHHH..........',
    ],
    rabo: null,
  },
  { // 5 — rabo de cavalo. O rabo é peça à parte e balança com a corrida.
    nome: 'rabo',
    topo: [
      '........HHHHHH........',
      '......HHhhhhhhHH......',
      '.....HhhgggghhhhH.....',
      '.....Hhhghhhhhhh......',
      '....Hhhghhhhh.........',
      '....Hhhhhhh...........',
      '....HHhhhh............',
      '.....HHhh.............',
    ],
    tras: [
      '......................',
      '......................',
      '.......HHHHHH.........',
      '......Hhhhhhhh........',
      '.....Hhhhhhhhh........',
      '.....Hhhghhhhh........',
      '.....Hhhghhhhh........',
      '.....HHhhhhhhh........',
      '......HHhhhhhH........',
      '.......HHhhhH.........',
      '........HHHH..........',
    ],
    rabo: {
      // O pivô é o ponto do PRÓPRIO desenho que fica preso na cabeça: o topo
      // do rabo, no meio. A âncora (mais abaixo) diz onde na grade da cabeça
      // esse ponto vai parar.
      pivot: [3, 1],
      linhas: [
        '..HHH..',
        '.HhhhH.',
        'HhhghhH',
        'HhhghhH',
        'HhhghhH',
        'HhhghhH',
        '.Hhghh.',
        '.Hhghh.',
        '.Hhghh.',
        '.Hhghh.',
        '..Hhgh.',
        '..Hhgh.',
        '..Hhhh.',
        '...Hhh.',
        '...HhH.',
        '....H..',
      ],
    },
  },
  { // 6 — coque preso no alto da nuca
    nome: 'coque',
    topo: [
      '........HHHHHH........',
      '......HHhhhhhhHH......',
      '.....HhhgggghhhhH.....',
      '.....Hhhghhhhhhh......',
      '....Hhhghhhhh.........',
      '....Hhhhhhh...........',
      '....HHhhhh............',
      '.....HHhh.............',
    ],
    tras: [
      '..HHHHH...............',
      '.HhhhhhH..............',
      'HhhgghhhH.............',
      'HhhgghhhH.............',
      'Hhhhhhhhh.............',
      '.HhhhhhH..............',
      '..HHHHH...............',
      '......................',
      '.......HHHHHH.........',
      '......Hhhhhhhh........',
      '.....Hhhhhhhhh........',
      '.....HHhhhhhhh........',
      '......HHhhhhhH........',
      '.......HHHHHH.........',
    ],
    rabo: null,
  },
  { // 7 — trança caindo pela frente do ombro
    nome: 'tranca',
    topo: [
      '........HHHHHH........',
      '......HHhhhhhhHH......',
      '.....HhhgggghhhhH.....',
      '.....Hhhghhhhhhh......',
      '....Hhhghhhhh.........',
      '....Hhhghhh...........',
      '...Hhhghhhh...........',
      '...Hhhghhhh...........',
      '...Hhhhhhhh...........',
      '....Hhhhhhh...........',
    ],
    tras: [
      '......................',
      '......................',
      '......HHHHHHHH........',
      '.....HhhhhhhhhH.......',
      '....Hhhhhhhhhhh.......',
      '...Hhhhhhhhhhhh.......',
      '...Hhhhhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..Hhhghhhhhhhhh.......',
      '..HhhhhhhhhhhhH.......',
      '..HhhhhhhhhhhH........',
      '...HhhhhhhhhH.........',
      '....HHHHHHHH..........',
    ],
    rabo: {
      pivot: [2, 0],
      linhas: [
        '.Hhh.',
        'HhghH',
        'Hhghh',
        'HhghH',
        '.Hhh.',
        'HhghH',
        'Hhghh',
        'HhghH',
        '.Hhh.',
        'HhghH',
        'Hhghh',
        '.Hhh.',
        '..H..',
      ],
    },
  },
];

const FRANJAS = [
  null,
  // reta — cobre a testa inteira e termina numa borda dura
  { cx: 4, cy: 1, linhas: [
    'HhhhhhhhhhhhH',
    'Hhhghhhhhhhhh',
    'Hhhghhhhhhhhh',
    'Hhhhhhhhhhhhh',
    'HhhhhhhhhhhhH',
    '.HHHHHHHHHHH.',
  ] },
  // lateral — cai de um lado só, deixando a testa aparecer do outro
  { cx: 4, cy: 1, linhas: [
    'HhhhhhhhhhhhH',
    'Hhhghhhhhhhhh',
    'Hhhghhhhhhh..',
    'Hhhhhhhhhh...',
    'Hhhhhhhh.....',
    '.HHHHHH......',
  ] },
  // cortina — abre no meio da testa
  { cx: 4, cy: 1, linhas: [
    'HhhhhhhhhhhhH',
    'Hhhghhh..hhhh',
    'Hhhghh....hhh',
    'Hhhhh.....hhh',
    'Hhhh.......hh',
    '.HHH.......HH',
  ] },
];

const ENFEITES = [
  null,
  // laço, atrás e em cima
  { cx: 3, cy: 1, linhas: [
    'nA.....',
    'AAnn...',
    'nAAAn..',
    '.nAAn..',
    '..nn...',
  ] },
  // tiara
  { cx: 4, cy: 2, linhas: ['yyyyyyyyyyyy'] },
  // presilha
  { cx: 5, cy: 4, linhas: ['yy', 'yy'] },
];

// ---------------------------------------------------------------------------
// corpo
// ---------------------------------------------------------------------------
// O tronco muda com a roupa: manga curta deixa braço de pele, jardineira
// tem alça, vestido não tem cós. O que NÃO muda é a silhueta — ombro e
// quadril ficam no mesmo lugar sempre, senão as animações desalinham.

function troncoDe(look) {
  const roupa = clamp(look.roupa | 0, 0, 3);
  const base = [
    '.....SSS....',
    '.....SSs....',
    '...kkaaakk..',
    '..kaaaaaaAk.',
    '..kaaaaaaAk.',
    '..knaaaaaAk.',
    '..knaaaaaAk.',
    '..knaaaaaAk.',
    '..knaaaaaAk.',
    '..knaaaaaAk.',
    '..knaaaaaAk.',
    '..knaaaaaAk.',
    '..knaaaaaAk.',
    '...knaaaAk..',
    '....kkkkk...',
  ];
  const g = grade(base);
  if (roupa === 0) {
    // camiseta: gola redonda, barra clara
    estampar(g, 4, 2, ['.AA.']);
    estampar(g, 2, 12, ['kAAAAAAAk']);
  } else if (roupa === 1) {
    // vestido: cintura marcada por uma faixa mais escura
    estampar(g, 2, 9, ['knnnnnnnk']);
  } else if (roupa === 2) {
    // blusa: barra reta e um botão
    estampar(g, 8, 5, ['A']);
    estampar(g, 8, 8, ['A']);
    estampar(g, 2, 13, ['.kBBBBk..']);
  } else {
    // jardineira: peitilho da cor de baixo, com alça e fivela
    estampar(g, 4, 3, ['BBBBB', 'BBBBB', 'BBBBB', 'BBBBB', 'BBBBB',
                       'BBBBB', 'BBBBB', 'BBBBB', 'BBBBB', 'BBBBB']);
    estampar(g, 3, 3, ['B', 'B']);
    estampar(g, 5, 4, ['y']);
    estampar(g, 8, 4, ['y']);
  }
  return texto(g);
}

// Saia / vestido caindo do quadril. Pivô no topo, no centro do quadril.
function saiaDe(look) {
  const roupa = clamp(look.roupa | 0, 0, 3);
  if (roupa === 1) {
    return { pivot: [7, 0], linhas: [
      '...kaaaaak....',
      '..kaaaaaaAk...',
      '..kaaaaaaAk...',
      '.kaaaaaaaaAk..',
      '.kaaaaaaaaAk..',
      'knaaaaaaaaaAk.',
      'knaaaaaaaaaAk.',
      'knnaaaaaaaaAk.',
      '.kkkkkkkkkkk..',
    ] };
  }
  return null;
}

function membrosDe(look) {
  const roupa = clamp(look.roupa | 0, 0, 3);
  // manga: 0 curta (camiseta), 1 curta (vestido), 2 comprida (blusa), 3 nua
  const mangaLonga = roupa === 2;
  // Contorno só na borda de trás. Braço de 3 pixels com contorno dos DOIS
  // lados sobra um pixel de carne no meio e vira um risco preto atravessado
  // no peito.
  const bracoSup = mangaLonga
    ? ['kaA', 'kaA', 'kaA', 'kaA', 'kaA', 'kaA', 'kSt']
    : ['kaA', 'kaA', 'kSt', 'kSt', 'kSt', 'kSt', 'kSt'];
  const bracoInf = mangaLonga
    ? ['kaA', 'kaA', 'kaA', 'kaA', 'kSt', 'kSt']
    : ['kSt', 'kSt', 'kSt', 'kSt', 'kSt', 'kSt'];

  // perna: calça cobre até o tornozelo; shorts até a coxa; vestido e saia
  // deixam a perna nua.
  const calca = roupa === 2 || roupa === 3;
  const shorts = roupa === 0;

  const coxa = calca
    ? ['kbbB', 'kbbB', 'kbbB', 'kbbB', 'kbbB', 'kbbB', 'kbbB']
    : shorts
      ? ['kbbB', 'kbbB', 'kbbB', 'kSSt', 'kSSt', 'kSSt', 'kSSt']
      : ['kSSt', 'kSSt', 'kSSt', 'kSSt', 'kSSt', 'kSSt', 'kSSt'];
  const canela = calca
    ? ['kbbB', 'kbbB', 'kbbB', 'kbbB', 'kSSt', 'kSSt']
    : ['kSSt', 'kSSt', 'kSSt', 'kSSt', 'kSSt', 'kSSt'];

  return { bracoSup, bracoInf, coxa, canela };
}

const MAO = ['kSt', 'SSt', 'kss'];
const PE = ['kppPk.', 'kpppPk', 'kdddk.'];

// ---------------------------------------------------------------------------
// montagem
// ---------------------------------------------------------------------------
export function montarPecas(look) {
  const map = mapaDeCores(look);
  const arte = CABELOS_ARTE[clamp(look.cabeloEstilo | 0, 0, CABELOS_ARTE.length - 1)];
  const franja = FRANJAS[clamp(look.franja | 0, 0, 3)];
  const enfeite = ENFEITES[clamp(look.enfeite | 0, 0, 3)];
  const membros = membrosDe(look);
  const saia = saiaDe(look);

  const P = {};

  // --- cabeça: crânio + rosto, depois cabelo e enfeites por cima ---
  P.cabeca = sprite({ pivot: PIVO_CABECA, map, rows: construirCabeca(look, false) });
  P.cabecaPiscando = sprite({ pivot: PIVO_CABECA, map, rows: construirCabeca(look, true) });

  // A coroa do cabelo e a franja vão na MESMA imagem que o crânio? Não:
  // separadas, para que o rig possa afastar a franja um pixel quando ela
  // olha para cima. Mais peças, mais controle.
  const gTopo = grade(new Array(15).fill('.'.repeat(22)));
  estampar(gTopo, 0, 0, arte.topo);
  if (franja) estampar(gTopo, franja.cx, franja.cy, franja.linhas);
  if (enfeite) estampar(gTopo, enfeite.cx, enfeite.cy, enfeite.linhas);
  P.cabelo = sprite({ pivot: PIVO_CABECA, map, rows: texto(gTopo) });

  const acc = construirAcessorios(look);
  P.acessorios = acc ? sprite({ pivot: PIVO_CABECA, map, rows: acc }) : null;

  if (arte.tras) {
    P.cabeloTras = sprite({ pivot: PIVO_CABECA, map, rows: arte.tras });
  } else P.cabeloTras = null;

  if (arte.rabo) {
    P.rabo = sprite({ pivot: arte.rabo.pivot, map, rows: arte.rabo.linhas });
    // Âncora em coordenadas da GRADE DA CABEÇA (22 colunas, pivô [10,14]).
    // O rabo de cavalo nasce alto na nuca; a trança nasce na altura do
    // maxilar e cai pela frente do ombro.
    P.raboAncora = arte.nome === 'tranca' ? [7, 9] : [7, 3];
    // A trança cai POR CIMA do ombro; o rabo de cavalo fica atrás da nuca.
    P.raboNaFrente = arte.nome === 'tranca';
    P.raboBase = arte.nome === 'tranca' ? -6 : 20;
  } else { P.rabo = null; P.raboAncora = null; P.raboNaFrente = false; P.raboBase = 0; }

  // --- corpo ---
  P.tronco = sprite({ pivot: [6, 14], map, rows: troncoDe(look) });
  P.saia = saia ? sprite({ pivot: saia.pivot, map, rows: saia.linhas }) : null;

  P.bracoSup = sprite({ pivot: [1, 1], map, rows: membros.bracoSup });
  P.bracoInf = sprite({ pivot: [1, 0], map, rows: membros.bracoInf });
  P.mao = sprite({ pivot: [1, 0], map, rows: MAO });
  P.coxa = sprite({ pivot: [1, 0], map, rows: membros.coxa });
  P.canela = sprite({ pivot: [1, 0], map, rows: membros.canela });
  P.pe = sprite({ pivot: [1, 0], map, rows: PE });

  // Cópias escurecidas para o lado de trás. Custa uma vez, no carregamento,
  // e evita fazer conta de cor a 60 fps.
  // 0,68 deixava o braço de trás praticamente preto em cima de roupa
  // clara — parecia uma faixa atravessada no corpo, não um braço.
  const K = 0.88, TINTA = '#4a4270';
  P.bracoSupT = escurecer(P.bracoSup, K, TINTA);
  P.bracoInfT = escurecer(P.bracoInf, K, TINTA);
  P.maoT = escurecer(P.mao, K, TINTA);
  P.coxaT = escurecer(P.coxa, K, TINTA);
  P.canelaT = escurecer(P.canela, K, TINTA);
  P.peT = escurecer(P.pe, K, TINTA);
  if (P.cabeloTras) P.cabeloTrasEsc = escurecer(P.cabeloTras, 0.86, TINTA);

  P.escala = 1 + (clamp(look.altura | 0, 0, 2) - 1) * 0.07;
  return P;
}
