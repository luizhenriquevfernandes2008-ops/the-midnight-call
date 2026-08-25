// gfx.js — a camada fina em cima do canvas 2D.
//
// O jogo inteiro desenha em coordenadas logicas de 960x540. Aqui se decide
// quantos pixels de verdade isso vale.
//
// E AQUI ESTAVA O PIOR PROBLEMA DE DESEMPENHO: a versao anterior fazia o
// buffer acompanhar o tamanho da janela vezes o devicePixelRatio. Numa tela
// 4K isso dava 3840x2160 — oito milhoes de pixels, DOIS canvas, redesenhados
// inteiros a cada quadro, com mistura 'overlay' por cima. Dez quadros por
// segundo e o resultado esperado disso, nao um azar.
//
// Agora o buffer tem tamanho FIXO (960x540 vezes a qualidade escolhida) e
// quem estica ate o tamanho da janela e o CSS — ou seja, a placa de video,
// de graca. A arte e macia e brilhante: aguenta ser esticada sem doer.

export const VW = 960;
export const VH = 540;

export const gfx = {
  tela: null,        // canvas do jogo (fundo)
  telaFrente: null,  // canvas de overlay (fica por cima do 3D)
  tela3d: null,      // canvas WebGL, so para redimensionar junto
  ctx: null,
  frente: null,
  escala: 1,
  larguraCss: VW,
  alturaCss: VH,
  aoRedimensionar: null,

  qualidade: 1.25,   // 1 = 960x540 de buffer; 2 = 1920x1080

  iniciar(telaJogo, telaFrente, tela3d) {
    this.tela = telaJogo;
    this.telaFrente = telaFrente;
    this.tela3d = tela3d;
    this.ctx = telaJogo.getContext('2d', { alpha: false, desynchronized: true });
    this.frente = telaFrente ? telaFrente.getContext('2d', { alpha: true }) : null;
    this.redimensionar();
    window.addEventListener('resize', () => this.redimensionar());
    return this.ctx;
  },

  definirQualidade(q) {
    this.qualidade = Math.max(0.75, Math.min(2, q));
    this.redimensionar();
  },

  redimensionar() {
    const dispW = window.innerWidth, dispH = window.innerHeight;
    // Encaixa 16:9 dentro da janela sem cortar nada. Isto e so CSS: nao
    // custa pixel nenhum de desenho.
    const escalaCss = Math.min(dispW / VW, dispH / VH);
    this.larguraCss = Math.round(VW * escalaCss);
    this.alturaCss = Math.round(VH * escalaCss);

    for (const t of [this.tela, this.telaFrente, this.tela3d]) {
      if (!t) continue;
      t.style.width = this.larguraCss + 'px';
      t.style.height = this.alturaCss + 'px';
    }

    // A camada da frente (HUD e texto) ganha mais resolucao que a do jogo:
    // ela e quase toda transparente, entao pixel a mais ali sai barato, e e
    // onde a nitidez aparece — letra borrada e o que faz um jogo parecer
    // mal acabado.
    const qJogo = this.qualidade;
    const qFrente = Math.min(2, this.qualidade * 1.5);
    for (const [t, c, q] of [[this.tela, this.ctx, qJogo], [this.telaFrente, this.frente, qFrente]]) {
      if (!t || !c) continue;
      const larg = Math.round(VW * q);
      if (t.width !== larg) { t.width = larg; t.height = Math.round(VH * q); }
      c.setTransform(q, 0, 0, q, 0, 0);
      c.imageSmoothingEnabled = true;
    }
    this.escala = this.tela.width / VW;
    if (this.aoRedimensionar) this.aoRedimensionar();
  },

  // Converte um ponto do mouse (coordenada de pagina) para o espaco 960x540.
  paraLogico(cx, cy) {
    const r = this.tela.getBoundingClientRect();
    return {
      x: ((cx - r.left) / r.width) * VW,
      y: ((cy - r.top) / r.height) * VH,
    };
  },
};

// ---------- desenho ----------

export function limpar(ctx, cor) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (cor) { ctx.fillStyle = cor; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
  else ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

export function retanguloRedondo(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Mancha de luz. Usada para tudo que "acende": olho, brasa, alma, explosao.
export function brilho(ctx, x, y, raio, cor, forca = 1) {
  if (raio <= 0 || forca <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, raio);
  g.addColorStop(0, cor.replace('ALFA', String(0.85 * forca)));
  g.addColorStop(0.45, cor.replace('ALFA', String(0.28 * forca)));
  g.addColorStop(1, cor.replace('ALFA', '0'));
  ctx.fillStyle = g;
  ctx.fillRect(x - raio, y - raio, raio * 2, raio * 2);
}

const FONTE_TITULO = 'Georgia, "Times New Roman", "Palatino Linotype", serif';
const FONTE_HUD = '"Trebuchet MS", "Segoe UI", Tahoma, sans-serif';

export function fonte(tam, tipo = 'hud', peso = 'normal') {
  return peso + ' ' + tam + 'px ' + (tipo === 'titulo' ? FONTE_TITULO : FONTE_HUD);
}

// Texto com espacamento entre letras feito na mao (ctx.letterSpacing nao
// existe em todo navegador, e espacamento largo e metade da identidade
// visual deste jogo).
//
// NADA DE shadowBlur AQUI. shadowBlur e uma gaussiana por chamada de
// desenho; com letra por letra, uma frase de vinte caracteres virava vinte
// borroes por quadro. Foi uma das causas do jogo travar. O lugar do brilho
// agora e um contorno escuro (que ainda separa a letra do fundo, que era o
// objetivo) mais, quando pedido, quatro copias deslocadas — quatro desenhos
// baratos no lugar de uma gaussiana cara.
export function texto(ctx, txt, x, y, op = {}) {
  const {
    tam = 16, tipo = 'hud', peso = 'normal', cor = '#cbbfae',
    alinha = 'esquerda', espaco = 0, sombra = 0, corSombra = null, alfa = 1,
    contorno = true,
  } = op;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.font = fonte(tam, tipo, peso);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const letras = String(txt).split('');
  let largura = 0;
  for (const l of letras) largura += ctx.measureText(l).width + espaco;
  if (espaco) largura -= espaco;

  const inicio = alinha === 'centro' ? x - largura / 2 : alinha === 'direita' ? x - largura : x;

  if (sombra > 0) {
    const d = Math.max(1.5, sombra * 0.14);
    ctx.fillStyle = corSombra || cor;
    ctx.globalAlpha = alfa * 0.16;
    for (const [ox, oy] of [[-d, 0], [d, 0], [0, -d], [0, d]]) {
      let px = inicio;
      for (const l of letras) {
        ctx.fillText(l, px + ox, y + oy);
        px += ctx.measureText(l).width + espaco;
      }
    }
    ctx.globalAlpha = alfa;
  }

  if (contorno && tam >= 11) {
    ctx.strokeStyle = 'rgba(4,2,8,0.85)';
    ctx.lineWidth = Math.max(2, tam * 0.13);
    let px = inicio;
    for (const l of letras) {
      ctx.strokeText(l, px, y);
      px += ctx.measureText(l).width + espaco;
    }
  }

  ctx.fillStyle = cor;
  let px = inicio;
  for (const l of letras) {
    ctx.fillText(l, px, y);
    px += ctx.measureText(l).width + espaco;
  }
  ctx.restore();
  return largura;
}

export function larguraTexto(ctx, txt, op = {}) {
  const { tam = 16, tipo = 'hud', peso = 'normal', espaco = 0 } = op;
  ctx.save();
  ctx.font = fonte(tam, tipo, peso);
  let w = 0;
  for (const l of String(txt)) w += ctx.measureText(l).width + espaco;
  ctx.restore();
  return Math.max(0, w - espaco);
}

// Quebra em linhas respeitando largura maxima (em unidades logicas).
export function quebraTexto(ctx, txt, larguraMax, op = {}) {
  const palavras = String(txt).split(/\s+/);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? atual + ' ' + p : p;
    if (larguraTexto(ctx, teste, op) > larguraMax && atual) { linhas.push(atual); atual = p; }
    else atual = teste;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// Vinheta + grao, por cima de tudo, todo quadro.
//
// Antes: um gradiente radial NOVO por quadro (caro) e um grao com mistura
// 'overlay' cobrindo a tela inteira — 'overlay' obriga o navegador a ler o
// que ja estava desenhado, pixel por pixel. Era a conta mais cara do jogo.
//
// Agora: a vinheta e uma imagem pequena, pintada uma vez e esticada; o grao
// e um ladrilho copiado com mistura normal. Mesma sensacao, custo de duas
// copias de imagem.
let bufVinheta = null, bufGrao = null, faseGrao = 0;

function fazerVinheta() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 144;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 72, 40, 128, 72, 150);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.62, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0.92)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 144);
  return c;
}

function fazerGrao() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const img = x.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  x.putImageData(img, 0, 0);
  return c;
}

export function acabamento(ctx, forca = 1, tremor = 0) {
  if (!bufVinheta) bufVinheta = fazerVinheta();
  ctx.save();
  ctx.globalAlpha = forca;
  ctx.drawImage(bufVinheta, 0, 0, VW, VH);
  ctx.restore();

  if (forca > 0.05) {
    if (!bufGrao) bufGrao = fazerGrao();
    faseGrao = (faseGrao + 1) % 4;
    ctx.save();
    ctx.globalAlpha = 0.16 * forca;
    const dx = (faseGrao % 2) * 23, dy = ((faseGrao / 2) | 0) * 31;
    for (let y = -dy; y < VH; y += 128) {
      for (let x = -dx; x < VW; x += 128) ctx.drawImage(bufGrao, x, y);
    }
    ctx.restore();
  }

  if (tremor > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(150,12,26,' + Math.min(0.3, tremor * 0.26) + ')';
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }
}

// Buffer fora da tela, em unidades logicas.
export function buffer(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, x: c.getContext('2d') };
}
