// temas.js — a identidade visual de cada um dos quatro mundos.
//
// Um tema é: um céu, uma paleta de terreno, uma cor de luz ambiente, um
// tipo de partícula no ar e uma trilha. Tudo que muda de fase para fase
// passa por aqui — os mapas em mapas.js só dizem ONDE tem chão, nunca de
// que cor ele é.
//
// A regra que segura a leitura em jogo colorido: o terreno é sempre mais
// escuro e menos saturado que o céu. Se o chão competir com o fundo, a
// personagem some no meio dos dois.

export const TEMAS = {
  // -------------------------------------------------------------------
  praia: {
    musica: 'praia',
    // O céu do fim de tarde, de cima para baixo. O degradê é feito em
    // degraus com dither, não liso: gradiente suave destrói a estética.
    ceu: ['#3f5aa8', '#7f6fc0', '#e08a92', '#ffb877', '#ffd9a0'],
    ambiente: null,             // sem escurecimento: é dia
    sol: { x: 0.72, y: 0.60, r: 30, cor: '#fff0b8', halo: '#ff9a5c' },
    mar: { cima: '#4fa8c8', baixo: '#2a6b96', espuma: '#dff4ff' },
    terra: {
      topo:   ['#ffe3a8', '#f7d18c'],       // areia iluminada
      topoDk: '#e0b46b',
      corpo:  ['#d9a862', '#c99a56', '#e0b46b'],
      fundo:  '#a87c42',
      linha:  '#7d5730',
      pedra:  ['#c2a184', '#a8886c'],
    },
    plataforma: { madeira: '#a9743e', madeiraHi: '#c99459', madeiraDk: '#6e4622' },
    superficie: 'areia',
    particula: 'petalas',       // pétalas e areia levantando no vento
    corParticula: ['#ffd9e2', '#fff0c0', '#ffffff'],
    nuvens: ['#ffe8d0', '#ffd0b0'],
    vento: 12,
  },

  // -------------------------------------------------------------------
  floresta: {
    musica: 'floresta',
    ceu: ['#0b1230', '#141d46', '#22305c', '#2d4166', '#3b5a6e'],
    // A floresta é o único mundo que usa o buffer de luz de verdade: a
    // ambiente escurece tudo e cada vaga-lume devolve um pedaço.
    ambiente: '#8b96c2',
    sol: { x: 0.24, y: 0.18, r: 16, cor: '#dfe9ff', halo: '#7f9fd8' },  // a lua
    mar: { cima: '#2c5a6b', baixo: '#173947', espuma: '#8fd8e0' },
    terra: {
      topo:   ['#4fbf6a', '#3ea058'],
      topoDk: '#2c7a45',
      corpo:  ['#5b4331', '#4a3527', '#6b5039'],
      fundo:  '#33241a',
      linha:  '#22160f',
      pedra:  ['#5a6470', '#454e58'],
    },
    plataforma: { madeira: '#6b4a2e', madeiraHi: '#8a6440', madeiraDk: '#40291a' },
    superficie: 'grama',
    particula: 'vagalumes',
    corParticula: ['#c8ff8a', '#fff3a0', '#8affd0'],
    nuvens: ['#26325c', '#1b2444'],
    vento: 4,
  },

  // -------------------------------------------------------------------
  cidade: {
    musica: 'cidade',
    ceu: ['#101a34', '#1b2748', '#2a3760', '#3d4a72', '#55597f'],
    ambiente: '#9aa0c4',
    sol: null,
    mar: { cima: '#33436b', baixo: '#1d2743', espuma: '#8fa6d8' },
    terra: {
      topo:   ['#7c8496', '#6a7284'],       // concreto molhado
      topoDk: '#525a6c',
      corpo:  ['#4a5164', '#3d4356', '#565d70'],
      fundo:  '#2b3044',
      linha:  '#1a1d2c',
      pedra:  ['#5d6478', '#474e60'],
    },
    plataforma: { madeira: '#5a6076', madeiraHi: '#78809a', madeiraDk: '#383d4e' },
    superficie: 'concreto',
    particula: 'chuva',
    corParticula: ['#9fc4ff', '#c8dcff'],
    nuvens: ['#2b3350', '#1e2440'],
    neon: ['#ff5f8a', '#5fe0ff', '#ffd45f', '#a06bff'],
    vento: 26,
  },

  // -------------------------------------------------------------------
  ceu: {
    musica: 'ceu',
    ceu: ['#1b1550', '#3b2a7a', '#6b4a9e', '#a86bb0', '#f0a0a8'],
    ambiente: null,
    sol: { x: 0.80, y: 0.22, r: 22, cor: '#fffbe8', halo: '#c8b0ff' },  // a lua cheia
    mar: { cima: '#6b5ab8', baixo: '#3d3378', espuma: '#d8c8ff' },
    terra: {
      topo:   ['#ffffff', '#f0e8ff'],       // nuvem
      topoDk: '#d0c4ee',
      corpo:  ['#e8e0ff', '#d8cef2', '#f6f0ff'],
      fundo:  '#b8aade',
      linha:  '#8a7cb8',
      pedra:  ['#c8bce8', '#a89ad0'],
    },
    plataforma: { madeira: '#c8b8f0', madeiraHi: '#e8dcff', madeiraDk: '#9484c0' },
    superficie: 'nuvem',
    particula: 'estrelas',
    corParticula: ['#ffffff', '#fff0b8', '#c8e0ff'],
    nuvens: ['#8a6fc0', '#6b53a0'],
    vento: 8,
  },
};

// Ordem das fases. É esta lista que o jogo percorre.
export const ORDEM = ['praia', 'floresta', 'cidade', 'ceu'];

export function tema(n) { return TEMAS[ORDEM[Math.max(0, Math.min(3, n - 1))]]; }

export default TEMAS;
