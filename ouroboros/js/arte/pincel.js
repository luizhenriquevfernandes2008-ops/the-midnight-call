// pincel.js — a linguagem visual do jogo, e o motivo de ela ser barata.
//
// DUAS REGRAS DE ESTILO, que valem para tudo que aparece na arena:
//
//   1. Silhueta primeiro. Todo bicho, item e parede tem contorno escuro
//      grosso e corpo chapado. Sombra colorida e bonita e ilegivel; forma
//      recortada se le em 200ms no meio do caos.
//   2. Sombra no chao. Tudo que esta vivo pousa uma elipse escura embaixo.
//      E o que separa "coisa no chao" de "coisa no ar" e o que impede a
//      arena de virar sopa de manchas brilhantes.
//
// LINGUAGEM DE COR (o jogador nao precisa aprender, precisa sentir):
//   vermelho/laranja = te machuca      verde/ciano = te alimenta
//   roxo = passagem                    amarelo = aviso, vai acontecer
//
// E O DESEMPENHO: createRadialGradient custa caro e estava sendo chamado
// uma vez por bicho, por item e por celula de fogo, TODO QUADRO. Aqui o
// brilho e desenhado UMA vez num canvas pequeno e depois so copiado com
// drawImage — que a placa de video faz de olhos fechados.

const cacheLuz = new Map();
const cacheSombra = new Map();

const TAM_LUZ = 128;

function spriteLuz(cor) {
  let s = cacheLuz.get(cor);
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = c.height = TAM_LUZ;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(TAM_LUZ / 2, TAM_LUZ / 2, 0, TAM_LUZ / 2, TAM_LUZ / 2, TAM_LUZ / 2);
  g.addColorStop(0, corComAlfa(cor, 1));
  g.addColorStop(0.25, corComAlfa(cor, 0.55));
  g.addColorStop(0.6, corComAlfa(cor, 0.16));
  g.addColorStop(1, corComAlfa(cor, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, TAM_LUZ, TAM_LUZ);
  cacheLuz.set(cor, c);
  return c;
}

function spriteSombra() {
  let s = cacheSombra.get('base');
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  cacheSombra.set('base', c);
  return c;
}

export function corComAlfa(cor, a) {
  if (cor.startsWith('rgba')) return cor.replace(/[\d.]+\)$/, a + ')');
  if (cor.startsWith('rgb')) return cor.replace('rgb(', 'rgba(').replace(')', ',' + a + ')');
  const h = cor.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(k => k + k).join('') : h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

export function clarear(cor, t) {
  const h = cor.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(k => k + k).join('') : h, 16);
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * t);
  const g = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * t);
  const b = Math.round((n & 255) + (255 - (n & 255)) * t);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

export function escurecer(cor, t) {
  const h = cor.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(k => k + k).join('') : h, 16);
  return 'rgb(' + Math.round(((n >> 16) & 255) * (1 - t)) + ',' +
    Math.round(((n >> 8) & 255) * (1 - t)) + ',' +
    Math.round((n & 255) * (1 - t)) + ')';
}

// Mancha de luz. Barata: e uma copia de imagem, nao um gradiente novo.
export function luz(ctx, x, y, raio, cor, forca = 1) {
  if (raio <= 0 || forca <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, forca);
  ctx.drawImage(spriteLuz(cor), x - raio, y - raio, raio * 2, raio * 2);
  ctx.restore();
}

export function sombraChao(ctx, x, y, raioX, raioY = raioX * 0.45, alfa = 1) {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.drawImage(spriteSombra(), x - raioX, y - raioY, raioX * 2, raioY * 2);
  ctx.restore();
}

export const CONTORNO = 'rgba(6,4,10,0.92)';

// Preenche e contorna de uma vez. O contorno vem sempre depois, para nao
// ser comido pelo preenchimento do vizinho.
export function pintar(ctx, corpo, contorno = CONTORNO, largura = 2.4) {
  if (corpo) { ctx.fillStyle = corpo; ctx.fill(); }
  if (contorno && largura > 0) {
    ctx.strokeStyle = contorno;
    ctx.lineWidth = largura;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

// Brilho de cima: a mesma forma, encolhida e deslocada para cima, clara e
// translucida. Da volume sem gradiente e sem custo.
export function brilhoDeCima(ctx, desenharForma, escala = 0.62, desloca = -0.22, alfa = 0.28) {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(0, desloca);
  ctx.scale(escala, escala * 0.8);
  ctx.beginPath();
  desenharForma(ctx);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

// Anel de ameaca: fica embaixo do bicho, pulsa, e e a unica coisa vermelha
// no chao. Depois de dois minutos de jogo o olho ja sabe: circulo vermelho
// no chao = nao pise ai.
export function anelAmeaca(ctx, x, y, raio, cor, tempo, fase = 0) {
  const p = 0.5 + 0.5 * Math.sin(tempo * 3 + fase);
  ctx.save();
  ctx.globalAlpha = 0.28 + p * 0.22;
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(x, y, raio * (0.92 + p * 0.12), raio * 0.42 * (0.92 + p * 0.12), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Marca de coisa boa: anel que se fecha para dentro, como se o chao
// estivesse oferecendo. O movimento e o oposto do anel de ameaca — um abre,
// o outro fecha.
export function anelPremio(ctx, x, y, raio, cor, tempo, fase = 0) {
  const t = (tempo * 0.9 + fase) % 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 * (1 - t);
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(x, y, raio * (1.5 - t * 0.7), raio * (1.5 - t * 0.7) * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Texto com contorno em vez de sombra borrada. shadowBlur e uma gaussiana
// por chamada de desenho — com letra por letra, e o caminho mais rapido
// para 10 quadros por segundo.
export function textoContornado(ctx, txt, x, y, op = {}) {
  const {
    tam = 16, peso = 'bold', familia = '"Trebuchet MS", sans-serif',
    cor = '#f0e4d0', contorno = 'rgba(4,2,8,0.95)', largura = 3,
    alinha = 'center', espaco = 0, alfa = 1,
  } = op;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.font = peso + ' ' + tam + 'px ' + familia;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  if (!espaco) {
    ctx.textAlign = alinha;
    ctx.strokeStyle = contorno;
    ctx.lineWidth = largura;
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = cor;
    ctx.fillText(txt, x, y);
    ctx.restore();
    return;
  }

  ctx.textAlign = 'left';
  const letras = String(txt).split('');
  let w = 0;
  for (const l of letras) w += ctx.measureText(l).width + espaco;
  w -= espaco;
  let px = alinha === 'center' ? x - w / 2 : alinha === 'right' ? x - w : x;
  ctx.strokeStyle = contorno;
  ctx.lineWidth = largura;
  for (const l of letras) {
    ctx.strokeText(l, px, y);
    px += ctx.measureText(l).width + espaco;
  }
  px = alinha === 'center' ? x - w / 2 : alinha === 'right' ? x - w : x;
  ctx.fillStyle = cor;
  for (const l of letras) {
    ctx.fillText(l, px, y);
    px += ctx.measureText(l).width + espaco;
  }
  ctx.restore();
}

export function limparCache() { cacheLuz.clear(); cacheSombra.clear(); }
