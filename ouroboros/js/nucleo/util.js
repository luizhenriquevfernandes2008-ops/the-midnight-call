// util.js — as contas pequenas que todo o resto usa.
//
// Nada aqui conhece o jogo. Se uma funcao daqui souber o que e uma cobra,
// ela esta no arquivo errado.

export const TAU = Math.PI * 2;

export const limita = (v, a, b) => (v < a ? a : v > b ? b : v);
export const mistura = (a, b, t) => a + (b - a) * t;
export const inverso = (v, a, b) => (b === a ? 0 : (v - a) / (b - a));

// Aproximacao exponencial independente de framerate. Chamar todo quadro com
// o mesmo 'taxa' converge no mesmo tempo real em 30 ou em 144 fps.
export const seguir = (atual, alvo, taxa, dt) =>
  atual + (alvo - atual) * (1 - Math.exp(-taxa * dt));

export const suaveEntra = (t) => t * t * t;
export const suaveSai = (t) => 1 - Math.pow(1 - t, 3);
export const suaveAmbos = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const costas = (t) => { const c = 2.70158; return 1 + c * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2); };
export const elastico = (t) => {
  if (t === 0 || t === 1) return t;
  const p = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * p) + 1;
};

// Gerador com semente: a mesma semente da a mesma corrida inteira, o que
// torna um bug reproduzivel em vez de folclore.
export function semente(s) {
  let a = s >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sementeDeTexto(txt) {
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const entre = (r, a, b) => a + r() * (b - a);
export const inteiro = (r, a, b) => Math.floor(a + r() * (b - a + 1));
export const sorteia = (r, lista) => lista[Math.floor(r() * lista.length)];
export const chance = (r, p) => r() < p;

export function embaralha(r, lista) {
  const c = lista.slice();
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = c[i]; c[i] = c[j]; c[j] = tmp;
  }
  return c;
}

// Sorteio com peso: cada item traz um campo 'peso' (ausente = 1).
export function sorteiaPesado(r, lista, campo = 'peso') {
  let total = 0;
  for (const it of lista) total += it[campo] ?? 1;
  let v = r() * total;
  for (const it of lista) { v -= it[campo] ?? 1; if (v <= 0) return it; }
  return lista[lista.length - 1];
}

export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

// Distancia em grade (quantos passos de cobra) — a que importa para IA.
export const distGrade = (ax, ay, bx, by) => Math.abs(bx - ax) + Math.abs(by - ay);

export const DIRECOES = [
  { x: 0, y: -1, nome: 'cima' },
  { x: 1, y: 0, nome: 'direita' },
  { x: 0, y: 1, nome: 'baixo' },
  { x: -1, y: 0, nome: 'esquerda' },
];

export function corHex(hex, alfa = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alfa + ')';
}

export function misturaCor(a, b, t) {
  const pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16);
  const r = Math.round(mistura((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(mistura((pa >> 8) & 255, (pb >> 8) & 255, t));
  const z = Math.round(mistura(pa & 255, pb & 255, t));
  return 'rgb(' + r + ',' + g + ',' + z + ')';
}

export function corParaVetor(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const agora = () => performance.now();
