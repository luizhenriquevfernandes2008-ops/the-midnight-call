// textura-texto.js — as texturas das placas e cartas do menu 3D.
//
// Truque central do visual: nao existe fonte 3D nem geometria de letra. As
// letras sao desenhadas num canvas 2D (com entalhe, sombra e brilho) e esse
// canvas vira textura de uma placa de pedra em 3D. Da o peso de tipografia
// de verdade com o custo de dois triangulos.
//
// Tudo fica em cache pela chave — gerar textura no meio do quadro engasga.

import { motor } from './motor3d.js';
import { desenhaIcone } from '../ui/icones.js';

const cache = new Map();

function novoCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Granito: milhares de pontinhos com semente fixa. Sem isso a placa parece
// plastico.
function pedra(x, w, h, cor1, cor2, semente = 1) {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, cor1);
  g.addColorStop(0.55, cor2);
  g.addColorStop(1, cor1);
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);

  let s = semente;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < (w * h) / 26; i++) {
    const px = rnd() * w, py = rnd() * h;
    const v = rnd();
    x.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.09)';
    x.fillRect(px, py, 1 + (v > 0.93 ? 1 : 0), 1);
  }
  // veios
  x.strokeStyle = 'rgba(0,0,0,0.12)';
  x.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    x.beginPath();
    let px = rnd() * w, py = rnd() * h;
    x.moveTo(px, py);
    for (let k = 0; k < 6; k++) {
      px += (rnd() - 0.5) * w * 0.3;
      py += (rnd() - 0.5) * h * 0.4;
      x.lineTo(px, py);
    }
    x.stroke();
  }
}

function moldura(x, w, h, cor, larg = 5) {
  x.strokeStyle = cor;
  x.lineWidth = larg;
  x.strokeRect(larg / 2, larg / 2, w - larg, h - larg);
  x.strokeStyle = 'rgba(0,0,0,0.5)';
  x.lineWidth = 2;
  x.strokeRect(larg + 3, larg + 3, w - larg * 2 - 6, h - larg * 2 - 6);
}

// Letra entalhada: uma copia clara empurrada para baixo (a luz batendo na
// borda de baixo do sulco) e a letra escura por cima.
function entalhe(x, txt, cx, cy, tam, cor, espaco = 6, peso = 'bold', familia = 'Georgia, serif') {
  x.font = peso + ' ' + tam + 'px ' + familia;
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  const letras = String(txt).split('');
  let largura = 0;
  for (const l of letras) largura += x.measureText(l).width + espaco;
  largura -= espaco;
  let px = cx - largura / 2;
  for (const l of letras) {
    x.fillStyle = 'rgba(255,240,220,0.22)';
    x.fillText(l, px, cy + 2.5);
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.fillText(l, px, cy - 1.5);
    x.fillStyle = cor;
    x.fillText(l, px, cy);
    px += x.measureText(l).width + espaco;
  }
  return largura;
}

export function texturaPlaca(txt, op = {}) {
  const chave = 'placa:' + txt + ':' + JSON.stringify(op);
  if (cache.has(chave)) return cache.get(chave);
  const w = op.largura || 640, h = op.altura || 160;
  const c = novoCanvas(w, h), x = c.getContext('2d');
  const {
    cor1 = '#2a2430', cor2 = '#171320', corTexto = '#d8c9b4',
    corMoldura = 'rgba(150,120,90,0.5)', tam = 62, espaco = 7, semente = 7,
  } = op;
  pedra(x, w, h, cor1, cor2, semente);
  moldura(x, w, h, corMoldura, 5);
  entalhe(x, txt, w / 2, h / 2 + 2, tam, corTexto, espaco);
  const tex = motor.criarTextura(c);
  const r = { tex, canvas: c, largura: w, altura: h, aspecto: w / h };
  cache.set(chave, r);
  return r;
}

// Titulo: sem pedra, so letra brilhando no vazio. Vai em varias placas
// empilhadas em Z para dar volume de verdade.
export function texturaTitulo(txt, op = {}) {
  const chave = 'titulo:' + txt + ':' + JSON.stringify(op);
  if (cache.has(chave)) return cache.get(chave);
  const tam = op.tam || 190;
  const espaco = op.espaco ?? 14;
  const medida = novoCanvas(8, 8).getContext('2d');
  medida.font = 'bold ' + tam + 'px Georgia, serif';
  let larguraTxt = 0;
  for (const l of txt) larguraTxt += medida.measureText(l).width + espaco;
  const w = Math.ceil(larguraTxt + tam * 0.6);
  const h = Math.ceil(tam * 1.7);
  const c = novoCanvas(w, h), x = c.getContext('2d');

  x.font = 'bold ' + tam + 'px Georgia, serif';
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  const letras = txt.split('');
  let px = (w - larguraTxt + espaco) / 2;
  const cy = h / 2;

  for (const l of letras) {
    const lw = x.measureText(l).width;
    x.save();
    x.shadowColor = op.corBrilho || 'rgba(255,60,90,0.85)';
    x.shadowBlur = tam * 0.32;
    const g = x.createLinearGradient(0, cy - tam * 0.6, 0, cy + tam * 0.6);
    g.addColorStop(0, op.cor1 || '#f0e2cc');
    g.addColorStop(0.5, op.cor2 || '#b9a68c');
    g.addColorStop(0.52, op.cor3 || '#6e5a4a');
    g.addColorStop(1, op.cor4 || '#2b2028');
    x.fillStyle = g;
    x.fillText(l, px, cy);
    x.restore();
    x.strokeStyle = op.corBorda || 'rgba(255,120,140,0.35)';
    x.lineWidth = 2;
    x.strokeText(l, px, cy);
    px += lw + espaco;
  }

  const tex = motor.criarTextura(c);
  const r = { tex, canvas: c, largura: w, altura: h, aspecto: w / h };
  cache.set(chave, r);
  return r;
}

const CORES_RARIDADE = {
  comum: { borda: '#8a7f6a', luz: '#d9c9a8', nome: 'COMUM' },
  rara: { borda: '#4a7fa0', luz: '#8ad0ff', nome: 'RARA' },
  maldita: { borda: '#8a2a3a', luz: '#ff6a7a', nome: 'MALDITA' },
  melhoria: { borda: '#6a7a4a', luz: '#c8e08a', nome: 'MELHORIA' },
};

// A carta de recompensa. Mesma textura serve para reliquia e melhoria.
export function texturaCarta(item, tipo = 'reliquia') {
  const chave = 'carta:' + tipo + ':' + item.id + ':' + (item.nivelTexto || '');
  if (cache.has(chave)) return cache.get(chave);
  const w = 512, h = 768;
  const c = novoCanvas(w, h), x = c.getContext('2d');
  const rar = CORES_RARIDADE[tipo === 'melhoria' ? 'melhoria' : (item.raridade || 'comum')];

  pedra(x, w, h, '#221d28', '#0e0b14', item.id.length * 31 + 3);

  // halo de raridade no meio da carta
  const halo = x.createRadialGradient(w / 2, h * 0.36, 10, w / 2, h * 0.36, w * 0.6);
  halo.addColorStop(0, hexA(rar.luz, 0.22));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = halo;
  x.fillRect(0, 0, w, h);

  moldura(x, w, h, hexA(rar.borda, 0.85), 8);

  // icone
  x.save();
  x.shadowColor = hexA(rar.luz, 0.8);
  x.shadowBlur = 40;
  desenhaIcone(x, item.icone || 'escama', w / 2, h * 0.33, 210, rar.luz, 0.95);
  x.restore();

  // faixa de raridade
  x.fillStyle = hexA(rar.borda, 0.28);
  x.fillRect(24, h * 0.505, w - 48, 44);
  x.font = 'bold 26px "Trebuchet MS", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = hexA(rar.luz, 0.95);
  x.fillText(rar.nome, w / 2, h * 0.505 + 23);

  // nome
  const tamNome = item.nome.length > 16 ? 38 : item.nome.length > 12 ? 43 : 48;
  entalhe(x, item.nome.toUpperCase(), w / 2, h * 0.615, tamNome, '#e6d9c2', 2, 'bold');

  // texto
  x.font = '30px "Trebuchet MS", sans-serif';
  x.textAlign = 'center';
  x.fillStyle = 'rgba(196,182,160,0.92)';
  const palavras = (item.texto || '').split(' ');
  let linha = '', y = h * 0.705;
  for (const p of palavras) {
    const teste = linha ? linha + ' ' + p : p;
    if (x.measureText(teste).width > w - 90 && linha) {
      x.fillText(linha, w / 2, y); y += 38; linha = p;
    } else linha = teste;
  }
  if (linha) x.fillText(linha, w / 2, y);

  if (item.nivelTexto) {
    x.font = 'italic 24px "Trebuchet MS", sans-serif';
    x.fillStyle = hexA(rar.luz, 0.7);
    x.fillText(item.nivelTexto, w / 2, h - 46);
  }

  const tex = motor.criarTextura(c);
  const r = { tex, canvas: c, largura: w, altura: h, aspecto: w / h };
  cache.set(chave, r);
  return r;
}

function hexA(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

// Painel generico (usado no Altar, Compendio e Opcoes) desenhado em 2D e
// jogado numa placa 3D.
export function texturaPainel(w, h, pintar, chave) {
  if (chave && cache.has(chave)) {
    const r = cache.get(chave);
    pintar(r.canvas.getContext('2d'), w, h);
    motor.atualizarTextura(r.tex, r.canvas);
    return r;
  }
  const c = novoCanvas(w, h), x = c.getContext('2d');
  pintar(x, w, h);
  const tex = motor.criarTextura(c);
  const r = { tex, canvas: c, largura: w, altura: h, aspecto: w / h };
  if (chave) cache.set(chave, r);
  return r;
}

export function limparCache() { cache.clear(); }
