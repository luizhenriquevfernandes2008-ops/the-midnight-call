// bichos.js — os bichinhos da fase.
//
// Nenhum deles é ameaçador de propósito: o jogo é um presente, não um
// desafio de sobrevivência. Todos têm olho grande, todos morrem virando
// coração, e todos avisam o que vão fazer antes de fazer.
//
// Cada bicho tem duas poses e alterna entre elas. Duas poses bem escolhidas
// (pata em cima / pata embaixo) leem melhor que oito mal desenhadas, e é
// tudo que um inimigo de 14 pixels precisa.

import { sprite, espelhar } from './pixel.js';

const MAPA = {
  k: '#2b2233',        // contorno
  W: '#ffffff', e: '#2b2233',    // olho
  // caranguejo
  R: '#ff7a5c', r: '#d9482e', q: '#9e2f1c',
  // gaivota / pombo
  G: '#ffffff', g: '#d8dce6', h: '#9aa2b4', o: '#ff9a3c',
  // sombra
  S: '#5a4a86', s: '#3d3164', d: '#251d42', L: '#c8a8ff',
  // vaga-lume
  V: '#3d4a2c', v: '#2a3320', Y: '#e8ff8a', y: '#a8d84c',
  // guarda-chuva
  P: '#ff6b8a', p: '#c9394f', A: '#7fd8ff', a: '#3f8fbe', C: '#c8b49a',
  // nuvenzinha
  N: '#ffffff', n: '#dcd4f0', m: '#b0a4d4',
};

function par(a, b, pivot) {
  return [sprite({ rows: a, map: MAPA, pivot }), sprite({ rows: b, map: MAPA, pivot })];
}

const DESENHOS = {
  // ---- caranguejo: anda de lado, pata sobe e desce -----------------------
  caranguejo: () => par([
    '..k......k....',
    '..krk..krk....',
    '...kRRRRk.....',
    '..kRRRRRRk....',
    '.kRRRRRRRRk...',
    'kRWeRRRRWek...',
    'kRRRRRRRRRRk..',
    'kRrrrrrrrrRk..',
    '.kqk.kk.kqk...',
    '..k...........',
  ], [
    '..k......k....',
    '..krk..krk....',
    '...kRRRRk.....',
    '..kRRRRRRk....',
    '.kRRRRRRRRk...',
    'kRWeRRRRWek...',
    'kRRRRRRRRRRk..',
    'kRrrrrrrrrRk..',
    '.kqkk...kqkk..',
    '.....k....k...',
  ], [6, 10]),

  // ---- gaivota: bate asa em dois tempos ---------------------------------
  gaivota: () => par([
    '....GGGG......',
    '..GGGGGGGG....',
    '.GGGGGGGGGGk..',
    'GGGGGGGWeGk...',
    '.gggGGGGGoo...',
    '..hhgggGGk....',
    '....kkkk......',
  ], [
    '..k...........',
    '..ggk.........',
    '...ggGGGGk....',
    '.GGGGGGGWeGk..',
    'GGGGGGGGGGoo..',
    '.ggggGGGGk....',
    '...kkkkk......',
  ], [7, 7]),

  // ---- sombra: uma gota roxa que pula ------------------------------------
  sombra: () => par([
    '....kkkk....',
    '..kkSSSSkk..',
    '.kSSSSSSSSk.',
    'kSSLeSSLeSk.',
    'kSSSSSSSSSSk',
    'kSsssssssSSk',
    '.kssddddssk.',
    '..kkddddkk..',
    '....kkkk....',
  ], [
    '..kkkkkkkk..',
    '.kSSSSSSSSk.',
    'kSSLeSSLeSSk',
    'kSSSSSSSSSSk',
    'kSssssssssSk',
    '.kssddddssk.',
    '...kkkkkk...',
    '............',
    '............',
  ], [6, 9]),

  // ---- vaga-lume: a lanterna acende e apaga ------------------------------
  vagalume: () => par([
    '..k....k....',
    '..kvk.kvk...',
    '.kVVVVVVk...',
    'kVWeVVVVVk..',
    'kVVVVVVVVk..',
    '.kVVVVYYk...',
    '..kkkYYYYk..',
    '.....kYYk...',
  ], [
    '.k......k...',
    '.kvk..kvk...',
    '.kVVVVVVk...',
    'kVWeVVVVVk..',
    'kVVVVVVVVk..',
    '.kVVVVyyk...',
    '..kkkyyk....',
    '............',
  ], [5, 8]),

  // ---- guarda-chuva voador ----------------------------------------------
  guardachuva: () => par([
    '....kkkk....',
    '..kkPPPPkk..',
    '.kPPAAPPAPk.',
    'kPPAAPPAAPPk',
    'kppppppppppk',
    '.kk.kCCk.kk.',
    '.....CC.....',
    '.....CCk....',
    '....kCk.....',
  ], [
    '....kkkk....',
    '..kkPPPPkk..',
    '.kPAAPPAAPk.',
    'kPAAPPAAPPPk',
    'kppppppppppk',
    '.kk.kCCk.kk.',
    '.....CC.....',
    '....kCC.....',
    '.....kCk....',
  ], [6, 9]),

  // ---- pombo -------------------------------------------------------------
  pombo: () => par([
    '...ggg......',
    '..ghhhgk....',
    '.ghhhhhWek..',
    'ghhhhhhhhoo.',
    '.gghhhhhk...',
    '..kgghhk....',
    '...kkkk.....',
  ], [
    '...k........',
    '..ggk.......',
    '.gghhhgWek..',
    'ghhhhhhhhoo.',
    '.ghhhhhhk...',
    '..ggghhk....',
    '...kkk......',
  ], [6, 7]),

  // ---- nuvenzinha --------------------------------------------------------
  nuvenzinha: () => par([
    '...kkkk.....',
    '.kkNNNNkk...',
    'kNNNNNNNNk..',
    'kNWeNNWeNNk.',
    'kNNNNNNNNNk.',
    'knnnnnnnnnk.',
    '.kmmkkkmmk..',
    '..k.....k...',
  ], [
    '....kkkk....',
    '..kkNNNNkk..',
    '.kNNNNNNNNk.',
    '.kNWeNNWeNk.',
    '.kNNNNNNNNk.',
    '.knnnnnnnk..',
    '..kmmkkmmk..',
    '...k....k...',
  ], [6, 8]),
};

const cache = {};

export function spriteBicho(tipo) {
  if (!cache[tipo]) {
    const f = DESENHOS[tipo] || DESENHOS.caranguejo;
    const dir = f();
    cache[tipo] = { dir, esq: dir.map(espelhar) };
  }
  return cache[tipo];
}

export const TIPOS = Object.keys(DESENHOS);
