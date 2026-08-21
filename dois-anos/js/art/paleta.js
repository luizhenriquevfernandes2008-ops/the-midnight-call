// paleta.js — todas as cores do jogo, e as rampas de aparência.
//
// A diferença de fundo pro Midnight Call: aqui a cena NÃO é multiplicada
// por uma luz quase preta, então a cor pode ser saturada de verdade. O que
// sustenta a leitura em pixel art colorido não é sombra, é contorno: quase
// tudo tem uma linha escura da própria família de cor em volta.
//
// Cada "rampa" é [claro, médio, escuro] (e a pele tem quatro). Elas existem
// pra que o editor de personagem seja só um índice: trocar cabelo de
// castanho pra ruivo é `cabeloCor = 6`, e todos os três tons trocam juntos,
// mantendo o volume do desenho.

// ---------------------------------------------------------------------------
// pele — [luz, base, sombra, contorno]
// ---------------------------------------------------------------------------
export const PELES = [
  ['#ffe6d0', '#fbcfae', '#dda684', '#a87a5c'],
  ['#ffdcb8', '#f2c095', '#cf9469', '#9d6c48'],
  ['#f7c99c', '#e2ab7c', '#bd8355', '#8d5c38'],
  ['#eeb383', '#d29464', '#a86e42', '#7a4d2b'],
  ['#d59763', '#b57646', '#8d5730', '#633b1f'],
  ['#ac713f', '#8b5730', '#66401f', '#432814'],
  ['#875234', '#663c22', '#492a15', '#2c180d'],
];

export const NOMES_PELE = [
  'muito clara', 'clara', 'clara quente', 'média', 'morena', 'escura', 'bem escura',
];

// ---------------------------------------------------------------------------
// cabelo — [luz, base, sombra]
// ---------------------------------------------------------------------------
export const CABELOS = [
  ['#3d3648', '#251f2e', '#14111b'],   // preto azulado
  ['#6a4430', '#43291d', '#291810'],   // castanho escuro
  ['#8d5f3c', '#613e27', '#3d2716'],   // castanho
  ['#b98444', '#8b5d2e', '#5e3d1d'],   // mel
  ['#f4d78f', '#d6ac5c', '#a37d3a'],   // loiro
  ['#f9eed6', '#ddd1b0', '#a99d7e'],   // loiro platinado
  ['#e0742f', '#ac4c22', '#7a3115'],   // ruivo
  ['#9a4038', '#6d2924', '#481716'],   // acaju
  ['#ffa6c8', '#e06d9e', '#a94a73'],   // rosa
  ['#8ad0f2', '#4e97c8', '#326a94'],   // azul
];

export const NOMES_CABELO = [
  'preto', 'castanho escuro', 'castanho', 'mel', 'loiro',
  'platinado', 'ruivo', 'acaju', 'rosa', 'azul',
];

export const NOMES_ESTILO = [
  'curto', 'chanel', 'médio', 'longo', 'cacheado',
  'rabo de cavalo', 'coque', 'trança',
];

export const NOMES_FRANJA = ['sem franja', 'reta', 'lateral', 'cortina'];

// ---------------------------------------------------------------------------
// olhos — a íris. A esclera e a pupila são fixas: variar as três de uma vez
// só suja a cor, e a íris tem quatro pixels de área.
// ---------------------------------------------------------------------------
export const OLHOS = [
  '#3b2418', '#6b4126', '#a5762c', '#3f7a45',
  '#3a6ea8', '#6d757e', '#79b6dd', '#6e4a97',
];

export const NOMES_OLHO = [
  'castanho escuro', 'castanho', 'mel', 'verde',
  'azul', 'cinza', 'azul claro', 'violeta',
];

export const ESCLERA = '#fdf6ec';
export const PUPILA = '#1a1420';
export const BRILHO_OLHO = '#ffffff';

// ---------------------------------------------------------------------------
// roupa — [luz, base, sombra]
// ---------------------------------------------------------------------------
export const TECIDOS = [
  ['#ffffff', '#e9e4da', '#b6b0a3'],   // branco
  ['#565163', '#332f3d', '#1d1a24'],   // preto
  ['#ff8878', '#e0453c', '#a02a26'],   // vermelho
  ['#ffbc6d', '#f08a2e', '#b45f16'],   // laranja
  ['#ffe587', '#f5c53f', '#bf9420'],   // amarelo
  ['#9fe98a', '#4fb85c', '#2f7e3d'],   // verde
  ['#8ef0e0', '#3fb9ad', '#23837c'],   // água
  ['#8fbcf7', '#4a7ed4', '#2c539b'],   // azul
  ['#cfa5f7', '#9367cc', '#664195'],   // roxo
  ['#ffb6d6', '#f06fa4', '#b34472'],   // rosa
];

export const NOMES_TECIDO = [
  'branco', 'preto', 'vermelho', 'laranja', 'amarelo',
  'verde', 'água', 'azul', 'roxo', 'rosa',
];

export const SAPATOS = [
  ['#ffffff', '#ded9cf', '#a9a396'],
  ['#4d4756', '#2b2833', '#17151d'],
  ['#a3703f', '#7a4f28', '#503118'],
  ['#f08a80', '#c9463c', '#8e2b24'],
  ['#7fa7e0', '#4a72b8', '#2c4a80'],
  ['#ffb0d0', '#e06b9e', '#a3446f'],
];

export const NOMES_SAPATO = ['branco', 'preto', 'marrom', 'vermelho', 'azul', 'rosa'];

export const NOMES_ROUPA = ['camiseta e shorts', 'vestido', 'blusa e calça', 'jardineira'];
export const NOMES_FORMA_OLHO = ['redondo', 'amendoado', 'grande'];
export const NOMES_SOBRANCELHA = ['fina', 'média', 'marcada'];
export const NOMES_BOCA = ['sorriso', 'discreta', 'aberta'];
export const NOMES_OCULOS = ['nenhum', 'redondo', 'retangular', 'de sol'];
export const NOMES_BRINCO = ['nenhum', 'argola', 'pingente'];
export const NOMES_ENFEITE = ['nenhum', 'laço', 'tiara', 'presilha'];
export const NOMES_ALTURA = ['baixinha', 'média', 'alta'];

// ---------------------------------------------------------------------------
// cores soltas do jogo
// ---------------------------------------------------------------------------
export const COR = {
  // contorno universal. Não é preto: preto puro em cima de céu claro corta
  // a imagem em duas. Este roxo escuro some no fundo e ainda segura a forma.
  linha:      '#2b2233',
  linhaSuave: '#4a3d52',

  coracao:    '#ff5a7a',
  coracaoHi:  '#ff9db1',
  coracaoDk:  '#c02c4c',

  carta:      '#fff4d6',
  cartaDk:    '#d9b874',
  cartaSelo:  '#e0574f',

  brilho:     '#fff6c9',
  faisca:     '#ffe98a',

  // a gaiola de luz onde ele fica preso
  gaiola:     '#8fe3ff',
  gaiolaDk:   '#3f8fbe',

  // interface
  uiTexto:    '#fff6e6',
  uiSombra:   '#3a2b40',
  uiDim:      '#c3aec0',
  uiFraco:    '#7d6a84',
  uiCaixa:    '#3b2b4a',
  uiCaixaDk:  '#251a30',
  uiBorda:    '#ffd98a',
  uiDestaque: '#ffcf5c',
  uiPerigo:   '#ff6b6b',
};

export function pele(i) { return PELES[clampIdx(i, PELES.length)]; }
export function cabelo(i) { return CABELOS[clampIdx(i, CABELOS.length)]; }
export function tecido(i) { return TECIDOS[clampIdx(i, TECIDOS.length)]; }
export function sapato(i) { return SAPATOS[clampIdx(i, SAPATOS.length)]; }
export function olho(i) { return OLHOS[clampIdx(i, OLHOS.length)]; }

function clampIdx(i, n) {
  i = Math.round(i || 0);
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}

export default COR;
