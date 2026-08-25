// gfx.js — a camada fina em cima do canvas 2D.
//
// O jogo inteiro desenha em coordenadas logicas de 960x540. Aqui a gente
// descobre quanto isso vale em pixels de verdade na tela do jogador e
// coloca a matriz certa no contexto — assim o desenho sai nitido em tela
// 4K e continua sendo 960x540 para quem escreve o codigo.
//
// Nada de imagem: cada pixel deste jogo e curva, gradiente ou sombra
// calculada na hora. Foi escolha, nao falta de tempo — a estetica precisa
// brilhar no escuro, e brilho pintado a mao envelhece mal.

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

  redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const dispW = window.innerWidth, dispH = window.innerHeight;
    // Encaixa 16:9 dentro da janela sem cortar nada.
    const escalaCss = Math.min(dispW / VW, dispH / VH);
    this.larguraCss = Math.round(VW * escalaCss);
    this.alturaCss = Math.round(VH * escalaCss);

    for (const t of [this.tela, this.telaFrente, this.tela3d]) {
      if (!t) continue;
      t.style.width = this.larguraCss + 'px';
      t.style.height = this.alturaCss + 'px';
    }
    for (const [t, c] of [[this.tela, this.ctx], [this.telaFrente, this.frente]]) {
      if (!t || !c) continue;
      t.width = Math.round(this.larguraCss * dpr);
      t.height = Math.round(this.alturaCss * dpr);
      c.setTransform(t.width / VW, 0, 0, t.width / VW, 0, 0);
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

// Texto com espacamento entre letras feito na mao. ctx.letterSpacing existe
// em navegador novo, mas nao em todos — e o espacamento largo e metade da
// identidade visual deste jogo, entao vale desenhar letra por letra.
export function texto(ctx, txt, x, y, op = {}) {
  const {
    tam = 16, tipo = 'hud', peso = 'normal', cor = '#cbbfae',
    alinha = 'esquerda', espaco = 0, sombra = 0, corSombra = null, alfa = 1,
  } = op;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.font = fonte(tam, tipo, peso);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const letras = String(txt).split('');
  let largura = 0;
  for (const l of letras) largura += ctx.measureText(l).width + espaco;
  if (espaco) largura -= espaco;

  let px = x;
  if (alinha === 'centro') px = x - largura / 2;
  else if (alinha === 'direita') px = x - largura;

  if (sombra > 0) {
    ctx.shadowColor = corSombra || cor;
    ctx.shadowBlur = sombra;
  }
  ctx.fillStyle = cor;
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

// Vinheta + grao. Passa por cima de tudo, todo quadro. E o que faz o jogo
// parecer filmado num porao em vez de desenhado num navegador.
let bufGrao = null, faseGrao = 0;
export function acabamento(ctx, forca = 1, tremor = 0) {
  const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.28, VW / 2, VH / 2, VH * 0.86);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,' + (0.82 * forca) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);

  if (!bufGrao) {
    bufGrao = document.createElement('canvas');
    bufGrao.width = 160; bufGrao.height = 90;
    const bx = bufGrao.getContext('2d');
    const img = bx.createImageData(160, 90);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 26;
    }
    bx.putImageData(img, 0, 0);
  }
  faseGrao = (faseGrao + 1) % 4;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5 * forca;
  const dx = (faseGrao % 2) * 7, dy = ((faseGrao / 2) | 0) * 11;
  ctx.drawImage(bufGrao, -dx, -dy, VW + 20, VH + 20);
  ctx.restore();

  if (tremor > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(120,10,20,' + Math.min(0.4, tremor * 0.3) + ')';
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
