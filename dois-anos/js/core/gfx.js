// gfx.js — o pipeline de imagem.
//
// Mesma regra de ouro do outro jogo: TUDO é desenhado numa tela interna de
// 480x270 e o navegador só amplia no fim, com nearest-neighbor, pra que o
// pixel nunca borre.
//
// O que muda aqui é a intenção. No jogo de terror a cena era multiplicada
// por uma luz quase preta e a cor morria de propósito. Este é um jogo de
// dia (e de noite bonita), então a luz ambiente padrão é BRANCA: multiplicar
// por branco não muda nada, e a cor sai do jeito que foi pintada. O buffer
// de luz continua existindo porque a floresta de vaga-lumes e a cidade à
// noite precisam dele — lá a ambiente escurece e cada luzinha soma de volta.
//
// Ordem de um frame:
//   gfx.limpar(cor)          fundo
//   ... desenha o mundo ...  em gfx.s
//   gfx.luzInicio(ambiente)  só se a fase for escura
//   ... gfx.luz(x,y,r,cor)   cada vaga-lume, poste, brilho
//   gfx.luzFim()             multiplica a luz e soma o halo
//   ... desenha a interface  (depois da luz, senão ela escurece junto)
//   gfx.apresentar(dt)       tremida, fade, flash, barras, e o upscale

export const VW = 480;
export const VH = 270;

export function makeBuffer(w, h, alpha = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { alpha });
  x.imageSmoothingEnabled = false;
  return { c, x };
}

// Ruído determinístico: mesma semente, mesmo resultado. Serve pra areia,
// estrela, folhagem — coisas que precisam parecer aleatórias e idênticas a
// cada carregamento, senão o cenário pisca quando é reconstruído.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeIn = t => t * t * t;
// Volta um pouco além e retorna — o que dá "peso" a menu abrindo e a item
// aparecendo. Sem isso tudo entra em velocidade constante e parece morto.
export const easeBack = t => {
  const c = 1.70158, u = t - 1;
  return u * u * ((c + 1) * u + c) + 1;
};
export const easeElastic = t => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
};

export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const f = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}

// Mistura duas cores hex. Usada o tempo todo pelo céu e pela água.
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

class Gfx {
  constructor() {
    this.escala = 1;
    this.tremorForca = 0;
    this.tremorTempo = 0;
    this.tremorX = 0;
    this.tremorY = 0;
    this.fade = 0;                  // 0 = nada, 1 = cor cheia
    this.fadeCor = '#000000';
    this.flash = 0;
    this.flashCor = '#ffffff';
    this.barras = 0;                // 0..1 — altura das barras de cinema
    this.vinheta = 0.26;            // discreta: só fecha os cantos
    this.grao = 0;                  // desligado por padrão; a arte é limpa
    this.tempo = 0;
    this.usandoLuz = false;
    this.pixelExato = false;
  }

  init() {
    this.saida = document.getElementById('jogo');
    this.o = this.saida.getContext('2d', { alpha: false });
    this.o.imageSmoothingEnabled = false;

    const cena = makeBuffer(VW, VH, false);
    this.cenaC = cena.c; this.s = cena.x;

    const luz = makeBuffer(VW, VH, false);
    this.luzC = luz.c; this.l = luz.x;

    // Buffer de brilho em 1/4 da resolução. Ampliar de volta com suavização
    // LIGADA é um blur gaussiano de pobre — é isso que faz o vaga-lume ter
    // halo em vez de borda dura.
    const halo = makeBuffer(VW >> 2, VH >> 2);
    this.haloC = halo.c; this.h = halo.x;
    this.h.imageSmoothingEnabled = true;

    const tmp = makeBuffer(VW, VH);
    this.tmpC = tmp.c; this.t = tmp.x;

    const tmp2 = makeBuffer(VW, VH);
    this.tmp2C = tmp2.c; this.t2 = tmp2.x;

    this._montarGrao();
    this._montarVinheta();

    this.redimensionar();
    window.addEventListener('resize', () => this.redimensionar());
    return this;
  }

  _montarGrao() {
    this.graos = [];
    const rnd = mulberry32(0x5EED);
    for (let i = 0; i < 4; i++) {
      const b = makeBuffer(VW, VH);
      const img = b.x.createImageData(VW, VH);
      const d = img.data;
      for (let p = 0; p < d.length; p += 4) {
        const v = (rnd() * 255) | 0;
        d[p] = v; d[p + 1] = v; d[p + 2] = v; d[p + 3] = 255;
      }
      b.x.putImageData(img, 0, 0);
      this.graos.push(b.c);
    }
    this.graoIdx = 0; this.graoT = 0;
  }

  _montarVinheta() {
    const b = makeBuffer(VW, VH);
    const g = b.x.createRadialGradient(VW / 2, VH / 2, VH * 0.42, VW / 2, VH / 2, VH * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,10,30,1)');
    b.x.fillStyle = g;
    b.x.fillRect(0, 0, VW, VH);
    this.vinhetaC = b.c;
  }

  redimensionar() {
    const lp = window.innerWidth, ap = window.innerHeight;
    let e = Math.min(lp / VW, ap / VH);
    // Escala inteira deixa cada pixel do jogo com exatamente o mesmo tamanho
    // na tela. Fica mais nítido, mas sobra tarja preta; por isso é opção.
    if (this.pixelExato) e = Math.max(1, Math.floor(e));
    this.escala = e;
    this.saida.width = Math.round(VW * e);
    this.saida.height = Math.round(VH * e);
    this.saida.style.width = Math.round(VW * e) + 'px';
    this.saida.style.height = Math.round(VH * e) + 'px';
    this.o = this.saida.getContext('2d', { alpha: false });
    this.o.imageSmoothingEnabled = false;
  }

  limpar(cor) {
    const s = this.s;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalAlpha = 1;
    s.globalCompositeOperation = 'source-over';
    s.imageSmoothingEnabled = false;
    if (cor) { s.fillStyle = cor; s.fillRect(0, 0, VW, VH); }
    else s.clearRect(0, 0, VW, VH);
    this.usandoLuz = false;
  }

  // ---- luz ----------------------------------------------------------------

  luzInicio(ambiente = '#ffffff') {
    this.usandoLuz = true;
    const l = this.l;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.globalAlpha = 1;
    l.fillStyle = ambiente;
    l.fillRect(0, 0, VW, VH);
    l.globalCompositeOperation = 'lighter';
  }

  // Uma luz é um degradê radial somado ao buffer. `forca` acima de 1 estoura
  // o branco — é o que vira halo no passe de brilho.
  luz(x, y, raio, cor = '#ffffff', forca = 1) {
    if (!this.usandoLuz || raio <= 0) return;
    if (x + raio < 0 || x - raio > VW || y + raio < 0 || y - raio > VH) return;
    const l = this.l;
    const g = l.createRadialGradient(x, y, 0, x, y, raio);
    const [r, gg, b] = hexToRgb(cor);
    g.addColorStop(0, `rgba(${r},${gg},${b},${clamp(forca, 0, 2)})`);
    g.addColorStop(0.45, `rgba(${r},${gg},${b},${clamp(forca * 0.42, 0, 1)})`);
    g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    l.fillStyle = g;
    l.fillRect(x - raio, y - raio, raio * 2, raio * 2);
  }

  luzFim(brilho = 0.55) {
    if (!this.usandoLuz) return;
    const s = this.s;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalAlpha = 1;

    // 1. multiplica: onde a luz é branca a cena não muda; onde é escura ela
    //    apaga. É por isso que ambiente branca custa nada visualmente.
    s.globalCompositeOperation = 'multiply';
    s.drawImage(this.luzC, 0, 0);

    // 2. halo: a luz reduzida a 1/4 e devolvida grande e suave, somada.
    if (brilho > 0) {
      const h = this.h;
      h.setTransform(1, 0, 0, 1, 0, 0);
      h.globalCompositeOperation = 'source-over';
      h.globalAlpha = 1;
      h.clearRect(0, 0, this.haloC.width, this.haloC.height);
      h.drawImage(this.luzC, 0, 0, this.haloC.width, this.haloC.height);
      s.globalCompositeOperation = 'lighter';
      s.globalAlpha = brilho;
      s.imageSmoothingEnabled = true;
      s.drawImage(this.haloC, 0, 0, VW, VH);
      s.imageSmoothingEnabled = false;
    }
    s.globalAlpha = 1;
    s.globalCompositeOperation = 'source-over';
    this.usandoLuz = false;
  }

  // ---- efeitos de tela ----------------------------------------------------

  tremer(forca, tempo = 0.25) {
    this.tremorForca = Math.max(this.tremorForca, forca);
    this.tremorTempo = Math.max(this.tremorTempo, tempo);
  }

  piscar(cor = '#ffffff', forca = 0.7) {
    this.flashCor = cor;
    this.flash = Math.max(this.flash, forca);
  }

  // ---- saída --------------------------------------------------------------

  apresentar(dt) {
    this.tempo += dt;

    if (this.tremorTempo > 0) {
      this.tremorTempo -= dt;
      const k = Math.max(0, this.tremorTempo) * this.tremorForca;
      this.tremorX = (Math.random() * 2 - 1) * k * 9;
      this.tremorY = (Math.random() * 2 - 1) * k * 9;
      if (this.tremorTempo <= 0) { this.tremorForca = 0; this.tremorX = this.tremorY = 0; }
    }

    const s = this.s;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalAlpha = 1;
    s.globalCompositeOperation = 'source-over';

    if (this.vinheta > 0) {
      s.globalAlpha = this.vinheta;
      s.drawImage(this.vinhetaC, 0, 0);
      s.globalAlpha = 1;
    }

    if (this.grao > 0) {
      this.graoT += dt;
      if (this.graoT > 1 / 18) { this.graoT = 0; this.graoIdx = (this.graoIdx + 1) % this.graos.length; }
      s.globalCompositeOperation = 'overlay';
      s.globalAlpha = this.grao;
      s.drawImage(this.graos[this.graoIdx], 0, 0);
      s.globalAlpha = 1;
      s.globalCompositeOperation = 'source-over';
    }

    if (this.flash > 0) {
      s.globalAlpha = clamp(this.flash, 0, 1);
      s.fillStyle = this.flashCor;
      s.fillRect(0, 0, VW, VH);
      s.globalAlpha = 1;
      this.flash = Math.max(0, this.flash - dt * 3.2);
    }

    if (this.barras > 0) {
      const h = Math.round(VH * 0.13 * clamp(this.barras, 0, 1));
      s.fillStyle = '#000000';
      s.fillRect(0, 0, VW, h);
      s.fillRect(0, VH - h, VW, h);
    }

    if (this.fade > 0) {
      s.globalAlpha = clamp(this.fade, 0, 1);
      s.fillStyle = this.fadeCor;
      s.fillRect(0, 0, VW, VH);
      s.globalAlpha = 1;
    }

    const o = this.o;
    const e = this.escala;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.imageSmoothingEnabled = false;
    o.fillStyle = '#000000';
    o.fillRect(0, 0, this.saida.width, this.saida.height);
    o.drawImage(this.cenaC,
      Math.round(this.tremorX * e), Math.round(this.tremorY * e),
      Math.round(VW * e), Math.round(VH * e));
  }
}

export const gfx = new Gfx();
export default gfx;
