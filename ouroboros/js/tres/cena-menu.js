// cena-menu.js — o menu, que e uma cena 3D de verdade e nao uma lista de
// botoes.
//
// O que tem aqui dentro:
//   - um anel de serpente girando no fundo, mordendo a propria cauda, com
//     os olhos acendendo quando voce mexe o mouse;
//   - o titulo montado em sete placas empilhadas em Z, o que da extrusao
//     real (a letra tem lado, e o lado pega luz);
//   - brasa subindo do poco em nuvem de pontos;
//   - as opcoes como placas de pedra que reagem: passar o mouse empurra a
//     placa para a frente com mola, inclina em direcao ao cursor, acende o
//     entalhe e solta faisca; clicar afunda a placa e devolve com pancada.
//
// Tudo com mola (aceleracao proporcional ao erro, com amortecimento), nunca
// com interpolacao linear: e a diferenca entre um menu que responde e um
// menu que desliza.

import { motor } from './motor3d.js';
import * as M from './matriz.js';
import { texturaPlaca, texturaTitulo, texturaPainel } from './textura-texto.js';
import { audio } from '../nucleo/audio.js';
import { gfx } from '../nucleo/gfx.js';
import { entrada } from '../nucleo/entrada.js';
import { D } from '../nucleo/dados.js';
import { salvar } from '../nucleo/salvar.js';
import { limita, TAU } from '../nucleo/util.js';
import { desenhaIcone } from '../ui/icones.js';

const CIMA = [0, 1, 0];

function mola(e, dt, k = 150, d = 17) {
  const a = (e.alvo - e.v) * k - e.vel * d;
  e.vel += a * dt;
  e.v += e.vel * dt;
}
const novaMola = (v = 0) => ({ v, vel: 0, alvo: v });

// ---------- brasa ----------

class Brasas {
  constructor(n = 320) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.cor = new Float32Array(n * 3);
    this.tam = new Float32Array(n);
    this.alfa = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.vida = new Float32Array(n);
    for (let i = 0; i < n; i++) this.nascer(i, true);
  }

  nascer(i, inicio = false) {
    const a = Math.random() * TAU, r = 2 + Math.random() * 11;
    this.pos[i * 3] = Math.cos(a) * r;
    this.pos[i * 3 + 1] = inicio ? -4 + Math.random() * 9 : -4.5 - Math.random() * 2;
    this.pos[i * 3 + 2] = -6 + Math.sin(a) * r * 0.5 + Math.random() * 4;
    this.vel[i * 3] = (Math.random() - 0.5) * 0.25;
    this.vel[i * 3 + 1] = 0.25 + Math.random() * 0.65;
    this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    this.vida[i] = 3 + Math.random() * 7;
    const q = Math.random();
    this.cor[i * 3] = 0.75 + q * 0.25;
    this.cor[i * 3 + 1] = 0.14 + q * 0.3;
    this.cor[i * 3 + 2] = 0.1 + q * 0.12;
    this.tam[i] = 0.02 + Math.random() * 0.055;
    this.alfa[i] = 0;
  }

  // Faisca de clique: reaproveita as particulas mais velhas.
  explodir(x, y, z, quantidade, cor) {
    let feitos = 0;
    for (let i = 0; i < this.n && feitos < quantidade; i++) {
      if (this.vida[i] > 1.2) continue;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * TAU, s = 1.5 + Math.random() * 4.5;
      this.vel[i * 3] = Math.cos(a) * s;
      this.vel[i * 3 + 1] = (Math.random() - 0.3) * s;
      this.vel[i * 3 + 2] = Math.sin(a) * s * 0.5 + 0.5;
      this.vida[i] = 0.5 + Math.random() * 0.7;
      this.cor[i * 3] = cor[0]; this.cor[i * 3 + 1] = cor[1]; this.cor[i * 3 + 2] = cor[2];
      this.tam[i] = 0.03 + Math.random() * 0.07;
      feitos++;
    }
  }

  atualizar(dt, vento) {
    for (let i = 0; i < this.n; i++) {
      this.vida[i] -= dt;
      if (this.vida[i] <= 0) { this.nascer(i); continue; }
      this.vel[i * 3 + 1] += dt * 0.15;
      this.pos[i * 3] += (this.vel[i * 3] + vento) * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3] *= 1 - dt * 1.4;
      this.vel[i * 3 + 2] *= 1 - dt * 1.4;
      const v = this.vida[i];
      this.alfa[i] = limita(v < 1 ? v : 1, 0, 1) * 0.5 * (0.5 + 0.5 * Math.sin(v * 9 + i));
    }
  }

  desenhar() { motor.pontos(this.pos, this.cor, this.tam, this.alfa, this.n); }
}

// ---------- anel ----------

class Anel {
  constructor(segmentos = 74) {
    this.n = segmentos;
    this.giro = 0;
    this.velocidade = 0.09;
    this.pulso = 0;
    this.modelo = new Float32Array(16);
  }

  atualizar(dt, energia) {
    this.velocidade += ((0.09 + energia * 0.26) - this.velocidade) * Math.min(1, dt * 2);
    this.giro += this.velocidade * dt;
    this.pulso += dt;
  }

  desenhar(tempo, corBase, corLuz) {
    const raio = 7.6;
    for (let i = 0; i < this.n; i++) {
      const t = i / this.n;
      const a = t * TAU + this.giro;
      const respira = Math.sin(tempo * 0.9 + t * TAU * 2) * 0.22;
      const r = raio + respira;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.62 + 0.3;
      const z = -13 + Math.sin(a * 2 + tempo * 0.4) * 0.9;
      // afina em direcao a cauda
      const grossura = 0.92 - t * 0.55;
      const m = M.identidade(this.modelo);
      M.transladar(m, x, y, z);
      M.girarZ(m, a + Math.PI / 2);
      M.girarY(m, Math.sin(tempo * 0.7 + t * 8) * 0.25);
      M.escalar(m, 0.36 + grossura * 0.28, 0.5 + grossura * 0.5, 0.62);
      const brilho = 0.5 + 0.5 * Math.sin(tempo * 2.2 - t * 9);
      motor.desenhar('caixa', m, {
        cor: [corBase[0] * (0.5 + grossura * 0.4), corBase[1] * (0.5 + grossura * 0.4), corBase[2] * (0.5 + grossura * 0.4)],
        emissao: [corLuz[0] * 0.06 * brilho, corLuz[1] * 0.04 * brilho, corLuz[2] * 0.05 * brilho],
        rim: 1.5, rimCor: [corLuz[0] * 0.55, corLuz[1] * 0.2, corLuz[2] * 0.28],
        nevoa: 0.026,
      });
    }
    // cabeca: um bloco maior e dois olhos acesos
    const a0 = this.giro;
    const hx = Math.cos(a0) * raio, hy = Math.sin(a0) * raio * 0.62 + 0.3, hz = -13;
    const mh = M.identidade(this.modelo);
    M.transladar(mh, hx, hy, hz);
    M.girarZ(mh, a0 + Math.PI / 2);
    M.escalar(mh, 1.5, 1.15, 1.6);
    motor.desenhar('caixa', mh, {
      cor: [corBase[0] * 1.1, corBase[1] * 1.1, corBase[2] * 1.1],
      emissao: [0.05, 0.01, 0.02], rim: 2.2, rimCor: corLuz, nevoa: 0.024,
    });
    const piscar = Math.sin(this.pulso * 1.7) > -0.85 ? 1 : 0.05;
    for (const lado of [-0.42, 0.42]) {
      const mo = M.identidade(this.modelo);
      M.transladar(mo, hx + Math.cos(a0 + Math.PI / 2) * lado, hy + Math.sin(a0 + Math.PI / 2) * lado * 0.62, hz + 0.85);
      M.escalar(mo, 0.3, 0.3, 0.3);
      motor.desenhar('esfera', mo, {
        cor: [0, 0, 0],
        emissao: [corLuz[0] * 2.4 * piscar, corLuz[1] * 0.6 * piscar, corLuz[2] * 0.9 * piscar],
        aditivo: true, rim: 0, nevoa: 0.008,
      });
    }
  }
}

// ---------- placa de menu ----------

class Placa {
  constructor(op) {
    Object.assign(this, {
      rotulo: '', sub: '', acao: null, icone: null,
      x: 0, y: 0, z: 0, largura: 4.3, altura: 0.8, prof: 0.3,
      ativa: true, valor: null, tipo: 'menu',
    }, op);
    this.hover = novaMola(0);
    this.pressao = novaMola(0);
    this.entrada = novaMola(0);   // animacao de chegada da pagina
    this.entrada.alvo = 1;
    this.fase = Math.random() * TAU;
    this.modelo = new Float32Array(16);
    this.frente = new Float32Array(16);
    this.cantos = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    this.sobre = false;
    this.textura = null;
    this.chaveTextura = '';
  }

  garantirTextura() {
    const chave = this.rotulo + '|' + this.sub + '|' + (this.ativa ? 1 : 0) + '|' + (this.valor ?? '');
    if (chave === this.chaveTextura && this.textura) return;
    this.chaveTextura = chave;
    const larguraPx = 704, alturaPx = Math.round(704 * (this.altura / this.largura));
    // Placa com barra de valor tem menos espaco para a letra: o rotulo vai
    // para a esquerda e os quadradinhos ficam na direita.
    const tam = this.valor ? 42 : this.sub ? 46 : 56;
    this.textura = texturaPlacaCompleta(this.rotulo, this.sub, this.valor, this.ativa, larguraPx, alturaPx, tam);
  }

  matriz(tempo) {
    const m = M.identidade(this.modelo);
    const h = this.hover.v, p = this.pressao.v, ent = this.entrada.v;
    const flutua = Math.sin(tempo * 1.1 + this.fase) * 0.035;
    const entradaX = (1 - ent) * 6.5;
    M.transladar(m,
      this.x + entradaX,
      this.y + flutua + h * 0.05,
      this.z + h * 0.62 - p * 0.55);
    M.girarY(m, (1 - ent) * 0.9 + h * this.inclinacaoY + Math.sin(tempo * 0.7 + this.fase) * 0.012);
    M.girarX(m, h * this.inclinacaoX - p * 0.06 + Math.cos(tempo * 0.9 + this.fase) * 0.01);
    M.girarZ(m, (1 - ent) * -0.25);
    const s = 1 + h * 0.055 - p * 0.03;
    M.escalar(m, this.largura * s, this.altura * s, this.prof);
    return m;
  }

  atualizar(dt, tempo, mouseX, mouseY) {
    // inclinacao segue o cursor: a placa "olha" para o mouse
    this.inclinacaoY = limita((mouseX - 0.5) * 0.5, -0.3, 0.3);
    this.inclinacaoX = limita((mouseY - 0.5) * 0.36, -0.24, 0.24);
    mola(this.hover, dt, 190, 20);
    mola(this.pressao, dt, 320, 24);
    mola(this.entrada, dt, 120, 17);
    this.matriz(tempo);
    // cantos da face da frente, projetados, para o teste do mouse
    const meia = 0.5;
    const cantosLocais = [[-meia, meia], [meia, meia], [meia, -meia], [-meia, -meia]];
    const p = {}, tela = {};
    for (let i = 0; i < 4; i++) {
      M.transformaPonto(this.modelo, cantosLocais[i][0], cantosLocais[i][1], 0.55, p);
      motor.naTela(p.x, p.y, p.z, tela);
      this.cantos[i].x = tela.x; this.cantos[i].y = tela.y;
      this.cantos[i].atras = tela.atras;
    }
  }

  contem(px, py) {
    if (!this.ativa) return false;
    if (this.cantos.some(c => c.atras)) return false;
    return M.dentroDoQuadrilatero(px, py, this.cantos);
  }

  desenhar(tempo, corAcento) {
    this.garantirTextura();
    const h = this.hover.v;
    const m = this.matriz(tempo);
    const brilhoBase = this.ativa ? 0.06 : 0.02;
    // corpo de pedra
    motor.desenhar('caixa', m, {
      cor: this.ativa ? [0.16, 0.14, 0.18] : [0.09, 0.085, 0.1],
      emissao: [corAcento[0] * brilhoBase * h, corAcento[1] * brilhoBase * h, corAcento[2] * brilhoBase * h],
      // Rim mais quente e mais baixo: a placa fica acima da camera, entao a
      // face de baixo aparece de raspao e um rim forte vira um risco neon.
      rim: 0.6 + h * 0.75,
      rimCor: [0.5 + h * 0.3, 0.17 + h * 0.14, 0.24 + h * 0.2],
      nevoa: 0.012,
    });
    // face com o texto entalhado, logo a frente do bloco
    const f = M.identidade(this.frente);
    f.set(m);
    M.transladar(f, 0, 0, 0.505);
    M.escalar(f, 1, 1, 1);
    motor.desenhar('plano', f, {
      textura: this.textura.tex,
      cor: [1, 1, 1],
      emissao: [corAcento[0] * 0.16 * h, corAcento[1] * 0.09 * h, corAcento[2] * 0.12 * h],
      rim: 0, alfa: this.ativa ? 1 : 0.55, nevoa: 0.012,
    });
  }
}

// Textura da placa com rotulo, subtitulo opcional e barra de valor.
function texturaPlacaCompleta(rotulo, sub, valor, ativa, w, h, tam) {
  return texturaPainel(w, h, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    const base = texturaPlaca(' ', { largura: W, altura: H, semente: rotulo.length * 13 + 1 });
    x.drawImage(base.canvas, 0, 0);
    x.save();
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const temValor = valor !== null && valor !== undefined && typeof valor === 'object';
    const cy = sub ? H * 0.38 : H * 0.5;
    const cor = ativa ? '#dccdb4' : '#6b6459';
    // entalhe manual
    x.font = 'bold ' + tam + 'px Georgia, serif';
    const letras = rotulo.split('');
    const esp = 6;
    let larg = 0;
    for (const l of letras) larg += x.measureText(l).width + esp;
    larg -= esp;
    let px = temValor ? 46 : W / 2 - larg / 2;
    for (const l of letras) {
      x.textAlign = 'left';
      x.fillStyle = 'rgba(255,235,210,0.20)';
      x.fillText(l, px, cy + 3);
      x.fillStyle = 'rgba(0,0,0,0.6)';
      x.fillText(l, px, cy - 2);
      x.fillStyle = cor;
      x.fillText(l, px, cy);
      px += x.measureText(l).width + esp;
    }
    if (sub) {
      x.textAlign = temValor ? 'left' : 'center';
      x.font = '30px "Trebuchet MS", sans-serif';
      x.fillStyle = ativa ? 'rgba(190,170,140,0.8)' : 'rgba(120,110,100,0.6)';
      x.fillText(sub, temValor ? 48 : W / 2, H * 0.74);
    }
    if (temValor) {
      const { cheios, total } = valor;
      const passo = total > 6 ? 20 : 26;
      const lado = total > 6 ? 13 : 18;
      const larguraTotal = total * passo;
      let bx = W - 32 - larguraTotal;
      for (let i = 0; i < total; i++) {
        x.fillStyle = i < cheios ? 'rgba(230,180,120,0.95)' : 'rgba(90,80,70,0.6)';
        x.fillRect(bx, H / 2 - lado / 2, lado, lado);
        bx += passo;
      }
    }
    x.restore();
  }, 'placa2:' + rotulo + '|' + sub + '|' + (ativa ? 1 : 0) + '|' + JSON.stringify(valor ?? null));
}

// ---------- a cena ----------

// Escadinha de resolucao. O buffer de desenho e 960x540 vezes este numero,
// entao cada degrau mexe de verdade no custo por quadro.
const NITIDEZ = [0.75, 1, 1.25, 1.5, 2];
const NOMES_NITIDEZ = ['MUITO RAPIDO', 'RAPIDO', 'EQUILIBRADO', 'NITIDO', 'MAXIMO'];

const CORES = {
  acento: [1.0, 0.16, 0.36],
  serpente: [0.36, 0.12, 0.22],
  luz: [1.0, 0.3, 0.42],
};

class CenaMenu {
  constructor() {
    this.pagina = 'principal';
    this.itens = [];
    this.indice = 0;
    this.tempo = 0;
    this.brasas = null;
    this.anel = null;
    this.tituloTex = null;
    this.subTex = null;
    this.acao = null;          // callback preenchido pelo main
    this.mouse = { x: 0.5, y: 0.5 };
    this.camAlvo = { x: 0, y: 0 };
    this.cam = { x: 0, y: 0 };
    this.energia = 0;          // 0..1, sobe quando o jogador interage
    this.flash = 0;
    this.painel = null;
    this.painelSujo = true;
    this.selCompendio = 0;
    this.paginaCompendio = 0;
    this.rolagemCreditos = 0;
    this.andarEscolhido = 0;
    this.aviso = '';
    this.avisoTempo = 0;
    this.pronta = false;
    // Matrizes reaproveitadas. Alocar Float32Array dentro do laco de
    // desenho da trabalho ao coletor de lixo sessenta vezes por segundo, e
    // coletor rodando no meio de uma animacao aparece como engasgo.
    this.mChao = new Float32Array(16);
    this.mPainel = new Float32Array(16);
    this.mTitulo = new Float32Array(16);
    this.fundoPronto = null;
  }

  iniciar() {
    if (this.pronta) return;
    this.brasas = new Brasas(340);
    this.anel = new Anel(52);
    this.tituloTex = texturaTitulo(D.textos.jogo.titulo, { tam: 200, espaco: 16 });
    this.pronta = true;
    this.abrir('principal', true);
  }

  // ---------- paginas ----------

  abrir(pagina, silencioso = false) {
    this.pagina = pagina;
    this.indice = 0;
    this.painelSujo = true;
    this.rolagemCreditos = 0;
    this.itens = this.construir(pagina);
    if (!silencioso) audio.voltar();
  }

  construir(pagina) {
    const T = D.textos.menu;
    const itens = [];
    const add = (op) => { const p = new Placa(op); itens.push(p); return p; };

    if (pagina === 'principal') {
      const temAtalho = salvar.nivelAltar('atalho') > 0 && salvar.dados.andarLiberado > 0;
      const linhas = [
        { rotulo: T.jogar, acao: 'jogar' },
        { rotulo: T.altar, acao: 'altar', sub: salvar.dados.essencia + ' de essencia guardada' },
        { rotulo: T.compendio, acao: 'compendio' },
        { rotulo: T.opcoes, acao: 'opcoes' },
        { rotulo: T.creditos, acao: 'creditos' },
      ];
      if (temAtalho) {
        linhas.splice(1, 0, {
          rotulo: 'COMECAR NO ANDAR ' + (this.andarEscolhido + 1),
          sub: D.fases.andares[this.andarEscolhido].nome + ' — clique para trocar',
          acao: 'atalho',
        });
      }
      const passo = linhas.length > 5 ? 0.9 : 0.99;
      const topo = (linhas.length - 1) * passo * 0.5;
      linhas.forEach((l, i) => add({
        ...l, x: 0, y: topo - i * passo - 0.55, z: 0,
        largura: 4.5, altura: linhas.length > 5 ? 0.74 : 0.82,
      }));
    }

    else if (pagina === 'altar') {
      D.altar.lista.forEach((it, i) => {
        const col = i % 2, lin = (i / 2) | 0;
        const nivel = salvar.nivelAltar(it.id);
        const maximo = nivel >= it.niveis;
        const custo = salvar.custoAltar(it);
        add({
          rotulo: it.nome,
          sub: maximo ? 'no maximo' : custo + ' de essencia',
          valor: { cheios: nivel, total: it.niveis },
          acao: 'comprar:' + it.id,
          ativa: !maximo && salvar.dados.essencia >= custo,
          x: col ? 2.45 : -2.45, y: 1.75 - lin * 1.02, z: 0,
          largura: 4.3, altura: 0.78,
        });
      });
      add({ rotulo: D.textos.menu.voltar, acao: 'voltar', x: 0, y: -2.85, z: 0, largura: 3.2, altura: 0.7 });
    }

    else if (pagina === 'compendio') {
      const lista = this.listaCompendio();
      const porPagina = 8;
      const inicio = this.paginaCompendio * porPagina;
      const fatia = lista.slice(inicio, inicio + porPagina);
      fatia.forEach((e, i) => add({
        rotulo: e.conhecido ? e.nome : '? ? ?',
        acao: 'ver:' + (inicio + i),
        x: -3.0, y: 2.25 - i * 0.62, z: 0,
        largura: 4.1, altura: 0.52,
        ativa: true,
      }));
      const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
      add({ rotulo: '<', acao: 'compag:-1', x: -4.35, y: -2.95, z: 0, largura: 0.9, altura: 0.58, ativa: this.paginaCompendio > 0 });
      add({ rotulo: (this.paginaCompendio + 1) + ' / ' + paginas, acao: null, x: -3.0, y: -2.95, z: 0, largura: 1.7, altura: 0.58, ativa: false });
      add({ rotulo: '>', acao: 'compag:1', x: -1.65, y: -2.95, z: 0, largura: 0.9, altura: 0.58, ativa: this.paginaCompendio < paginas - 1 });
      add({ rotulo: D.textos.menu.voltar, acao: 'voltar', x: 2.6, y: -2.95, z: 0, largura: 3.0, altura: 0.64 });
    }

    else if (pagina === 'opcoes') {
      const o = salvar.dados.opcoes;
      const nivelPara = (v) => ({ cheios: Math.round(v * 10), total: 10 });
      add({ rotulo: 'VOLUME GERAL', valor: nivelPara(o.mestre), acao: 'vol:mestre', x: 0, y: 1.85, z: 0, largura: 5.4, altura: 0.72 });
      add({ rotulo: 'MUSICA', valor: nivelPara(o.musica), acao: 'vol:musica', x: 0, y: 0.95, z: 0, largura: 5.4, altura: 0.72 });
      add({ rotulo: 'EFEITOS', valor: nivelPara(o.efeitos), acao: 'vol:efeitos', x: 0, y: 0.05, z: 0, largura: 5.4, altura: 0.72 });
      add({ rotulo: 'TREMOR DE TELA', valor: nivelPara(o.tremor), acao: 'vol:tremor', x: 0, y: -0.85, z: 0, largura: 5.4, altura: 0.72 });
      const iq = NITIDEZ.indexOf(gfx.qualidade);
      add({
        rotulo: 'NITIDEZ',
        sub: NOMES_NITIDEZ[iq < 0 ? 2 : iq] + ' — menos nitidez, mais velocidade',
        valor: { cheios: (iq < 0 ? 2 : iq) + 1, total: NITIDEZ.length },
        acao: 'nitidez', x: 0, y: -1.85, z: 0, largura: 5.4, altura: 0.8,
      });
      add({ rotulo: 'APAGAR TUDO', sub: 'essencia, altar, recordes e compendio', acao: 'apagar', x: 0, y: -2.75, z: 0, largura: 5.4, altura: 0.78 });
      add({ rotulo: D.textos.menu.voltar, acao: 'voltar', x: 0, y: -3.6, z: 0, largura: 3.0, altura: 0.66 });
    }

    else if (pagina === 'creditos') {
      add({ rotulo: D.textos.menu.voltar, acao: 'voltar', x: 0, y: -2.7, z: 0, largura: 3.0, altura: 0.68 });
    }

    return itens;
  }

  listaCompendio() {
    const lista = [];
    for (const c of D.chefes.lista) {
      lista.push({ tipo: 'chefe', id: c.id, nome: c.nome, dado: c, conhecido: salvar.conhece('chefes', c.id) });
    }
    for (const i of D.inimigos.lista) {
      lista.push({ tipo: 'inimigo', id: i.id, nome: i.nome, dado: i, conhecido: salvar.conhece('inimigos', i.id) });
    }
    for (const r of D.reliquias.lista) {
      lista.push({ tipo: 'reliquia', id: r.id, nome: r.nome, dado: r, conhecido: salvar.conhece('reliquias', r.id) });
    }
    return lista;
  }

  // ---------- interacao ----------

  atualizar(dt) {
    this.tempo += dt;
    this.energia = Math.max(0, this.energia - dt * 0.5);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.avisoTempo > 0) this.avisoTempo -= dt;

    const m = entrada.mouse;
    this.mouse.x = limita(m.x / 960, 0, 1);
    this.mouse.y = limita(m.y / 540, 0, 1);
    this.camAlvo.x = (this.mouse.x - 0.5) * 1.9;
    this.camAlvo.y = (0.5 - this.mouse.y) * 1.0;
    this.cam.x += (this.camAlvo.x - this.cam.x) * Math.min(1, dt * 3.4);
    this.cam.y += (this.camAlvo.y - this.cam.y) * Math.min(1, dt * 3.4);

    motor.camera(
      [this.cam.x, 0.35 + this.cam.y, 8.9],
      [this.cam.x * 0.28, 0.2 + this.cam.y * 0.3, 0], 52);

    // teclado navega, mouse tambem — e os dois concordam sobre quem esta
    // selecionado, senao o menu parece ter duas cabecas
    const navegaveis = this.itens.filter(i => i.acao && i.ativa);
    if (navegaveis.length) {
      if (entrada.nova('baixo')) { this.mover(1, navegaveis); }
      if (entrada.nova('cima')) { this.mover(-1, navegaveis); }
      if (entrada.nova('direita') && this.pagina === 'opcoes') this.ajustar(1);
      if (entrada.nova('esquerda') && this.pagina === 'opcoes') this.ajustar(-1);
    }

    let sobreAlgum = -1;
    for (let i = 0; i < this.itens.length; i++) {
      const p = this.itens[i];
      p.atualizar(dt, this.tempo, this.mouse.x, this.mouse.y);
      if (p.acao && p.ativa && p.contem(entrada.mouse.x, entrada.mouse.y)) sobreAlgum = i;
    }

    if (sobreAlgum >= 0 && this.itens[sobreAlgum] !== this.itemSelecionado()) {
      this.indice = this.itens.indexOf(this.itens[sobreAlgum]);
      this.aoSelecionar();
    }

    const sel = this.itemSelecionado();
    for (const p of this.itens) p.hover.alvo = (p === sel && p.ativa && p.acao) ? 1 : 0;

    // clique
    for (const c of entrada.cliques) {
      if (c.botao !== 0) continue;
      for (const p of this.itens) {
        if (p.acao && p.ativa && p.contem(c.x, c.y)) { this.acionar(p); break; }
      }
    }
    if (entrada.nova('confirma') && sel) this.acionar(sel);
    if (entrada.nova('menu') && this.pagina !== 'principal') this.abrir('principal');

    this.anel.atualizar(dt, this.energia + (sel ? sel.hover.v * 0.4 : 0));
    this.brasas.atualizar(dt, Math.sin(this.tempo * 0.3) * 0.2);

    if (this.pagina === 'creditos') this.rolagemCreditos += dt * 0.55;
    if (this.painelSujo) this.montarPainel();
  }

  itemSelecionado() {
    const p = this.itens[this.indice];
    return p && p.acao && p.ativa ? p : null;
  }

  mover(passo, navegaveis) {
    const atual = this.itens[this.indice];
    let i = navegaveis.indexOf(atual);
    i = (i + passo + navegaveis.length) % navegaveis.length;
    this.indice = this.itens.indexOf(navegaveis[i]);
    this.aoSelecionar();
  }

  aoSelecionar() {
    audio.passar();
    this.energia = Math.min(1, this.energia + 0.35);
    if (this.pagina === 'compendio') {
      const sel = this.itemSelecionado();
      if (sel && sel.acao && sel.acao.startsWith('ver:')) {
        this.selCompendio = parseInt(sel.acao.slice(4), 10);
        this.painelSujo = true;
      }
    }
  }

  acionar(placa) {
    placa.pressao.v = 1;
    placa.pressao.vel = 0;
    placa.pressao.alvo = 0;
    this.flash = 1;
    this.energia = 1;
    audio.clique();
    const p = {};
    M.transformaPonto(placa.modelo, 0, 0, 0.6, p);
    this.brasas.explodir(p.x, p.y, p.z, 26, [1, 0.4, 0.25]);

    const a = placa.acao;
    if (!a) return;
    if (a === 'voltar') { this.abrir('principal'); return; }
    if (a === 'atalho') {
      const max = Math.min(salvar.dados.andarLiberado, D.fases.andares.length - 1);
      this.andarEscolhido = (this.andarEscolhido + 1) % (max + 1);
      this.itens = this.construir('principal');
      return;
    }
    if (a.startsWith('comprar:')) {
      const item = D.porId.altar[a.slice(8)];
      if (salvar.comprar(item)) {
        audio.nivel();
        this.mostrarAviso(item.nome + ' subiu de nivel.');
      } else { audio.negado(); this.mostrarAviso('Essencia insuficiente.'); }
      this.itens = this.construir('altar');
      return;
    }
    if (a.startsWith('compag:')) {
      this.paginaCompendio += parseInt(a.slice(7), 10);
      this.itens = this.construir('compendio');
      this.painelSujo = true;
      return;
    }
    if (a.startsWith('ver:')) {
      this.selCompendio = parseInt(a.slice(4), 10);
      this.painelSujo = true;
      return;
    }
    if (a.startsWith('vol:') || a === 'nitidez') { this.ajustar(1); return; }
    if (a === 'apagar') {
      if (this.confirmandoApagar) {
        salvar.apagar(); salvar.gravar();
        this.confirmandoApagar = false;
        this.mostrarAviso('Apagado. O poco nao lembra mais de voce.');
        this.itens = this.construir('opcoes');
      } else {
        this.confirmandoApagar = true;
        this.mostrarAviso('Clique de novo para apagar de verdade.');
      }
      return;
    }
    if (['jogar', 'altar', 'compendio', 'opcoes', 'creditos'].includes(a)) {
      if (a === 'jogar') { if (this.acao) this.acao('jogar', { andar: this.andarEscolhido }); return; }
      this.abrir(a);
      return;
    }
    if (this.acao) this.acao(a, {});
  }

  ajustar(dir) {
    const sel = this.itemSelecionado();
    if (!sel || !sel.acao) return;

    if (sel.acao === 'nitidez') {
      let i = NITIDEZ.indexOf(gfx.qualidade);
      if (i < 0) i = 2;
      i = (i + dir + NITIDEZ.length) % NITIDEZ.length;
      gfx.definirQualidade(NITIDEZ[i]);
      salvar.dados.opcoes.qualidade = NITIDEZ[i];
      salvar.gravar();
      audio.passar();
      this.itens = this.construir('opcoes');
      this.indice = this.itens.findIndex(it => it.acao === 'nitidez');
      this.mostrarAviso('Nitidez: ' + NOMES_NITIDEZ[i] + '. Se o jogo estiver travando, desca um nivel.');
      return;
    }

    if (!sel.acao.startsWith('vol:')) return;
    const chave = sel.acao.slice(4);
    const o = salvar.dados.opcoes;
    let v = (o[chave] ?? 0.5) + dir * 0.1;
    if (v > 1.001) v = 0;
    if (v < 0) v = 1;
    o[chave] = Math.round(limita(v, 0, 1) * 10) / 10;
    salvar.gravar();
    if (chave !== 'tremor') audio.definirVolume(chave, o[chave]);
    audio.passar();
    this.itens = this.construir('opcoes');
    this.indice = this.itens.findIndex(i => i.acao === sel.acao);
  }

  mostrarAviso(txt) { this.aviso = txt; this.avisoTempo = 3.2; }

  // ---------- paineis ----------

  montarPainel() {
    this.painelSujo = false;
    if (this.pagina === 'compendio') {
      const lista = this.listaCompendio();
      const e = lista[limita(this.selCompendio, 0, lista.length - 1)];
      this.painel = texturaPainel(560, 620, (x, W, H) => pintarVerbete(x, W, H, e), 'verbete');
    } else if (this.pagina === 'creditos') {
      this.painel = texturaPainel(620, 760, (x, W, H) => pintarCreditos(x, W, H), 'creditos');
    } else if (this.pagina === 'altar') {
      this.painel = texturaPainel(620, 210, (x, W, H) => pintarEssencia(x, W, H), 'essencia');
    } else {
      this.painel = null;
    }
  }

  // ---------- desenho ----------

  desenhar() {
    if (!this.pronta) return;
    motor.comecar(true);
    motor.ambiente({
      luzDir: [0.35 + this.cam.x * 0.2, 0.7, 0.65],
      luzCor: [0.85, 0.6, 0.62],
      amb: [0.13, 0.1, 0.16],
      nevoaCor: [0.03, 0.012, 0.03],
      nevoa: 0.02,
    });

    this.anel.desenhar(this.tempo, CORES.serpente, CORES.luz);

    // chao: uma placa enorme deitada, so para a nevoa ter onde morrer
    const chao = M.identidade(this.mChao);
    M.transladar(chao, 0, -3.9, -18);
    M.girarX(chao, -Math.PI / 2);
    M.escalar(chao, 120, 120, 1);
    motor.desenhar('plano', chao, {
      cor: [0.045, 0.03, 0.055], rim: 0.15, rimCor: [0.3, 0.1, 0.16], nevoa: 0.075, doisLados: true,
    });

    if (this.pagina === 'principal') this.desenharTitulo();

    for (const p of this.itens) p.desenhar(this.tempo, CORES.acento);

    if (this.painel) {
      const m = M.identidade(this.mPainel);
      if (this.pagina === 'compendio') {
        M.transladar(m, 2.75 + this.cam.x * 0.1, 0.35, -0.4);
        M.girarY(m, -0.22 + (this.mouse.x - 0.5) * 0.06);
        M.escalar(m, 4.6, 4.6 * (620 / 560), 1);
      } else if (this.pagina === 'creditos') {
        M.transladar(m, 0, -1.6 + this.rolagemCreditos, -1.2);
        M.girarX(m, -0.12);
        M.escalar(m, 5.4, 5.4 * (760 / 620), 1);
      } else {
        M.transladar(m, 0, 2.95, -0.6);
        M.escalar(m, 5.6, 5.6 * (210 / 620), 1);
      }
      motor.desenhar('plano', m, {
        textura: this.painel.tex, cor: [1, 1, 1],
        emissao: [0.05, 0.02, 0.03], rim: 0, nevoa: 0.012, doisLados: true,
      });
    }

    this.brasas.desenhar();
  }

  desenharTitulo() {
    const tex = this.tituloTex;
    const larg = 7.4;
    const alt = larg / tex.aspecto;
    const respira = Math.sin(this.tempo * 0.8) * 0.045;
    const camadas = 7;
    for (let i = camadas - 1; i >= 0; i--) {
      const z = -1.4 - i * 0.09;
      const m = M.identidade(this.mTitulo);
      M.transladar(m, 0, 2.98 + respira, z);
      M.girarY(m, Math.sin(this.tempo * 0.45) * 0.06 + (this.mouse.x - 0.5) * 0.1);
      M.girarX(m, -0.05 + Math.cos(this.tempo * 0.6) * 0.015);
      M.escalar(m, larg, alt, 1);
      const frente = i === 0;
      const f = 1 - i / camadas;
      motor.desenhar('plano', m, {
        textura: tex.tex,
        cor: frente ? [1, 1, 1] : [0.22 * f, 0.06 * f, 0.1 * f],
        emissao: frente
          ? [0.42 + Math.sin(this.tempo * 1.6) * 0.08, 0.05, 0.12]
          : [0.03 * f, 0.005, 0.01],
        rim: 0, alfa: 1, nevoa: 0.01, doisLados: true,
      });
    }
  }

  // Fundo do menu. Era dois gradientes NOVOS por quadro; agora e uma imagem
  // pintada uma vez e copiada, mais o que de fato se mexe.
  fundo2D(ctx) {
    if (!this.fundoPronto) {
      const c = document.createElement('canvas');
      c.width = 960; c.height = 540;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 540);
      g.addColorStop(0, '#07040a');
      g.addColorStop(0.55, '#0d0510');
      g.addColorStop(1, '#160616');
      x.fillStyle = g;
      x.fillRect(0, 0, 960, 540);
      const r = x.createRadialGradient(480, 620, 30, 480, 620, 620);
      r.addColorStop(0, 'rgba(255,40,80,0.2)');
      r.addColorStop(0.45, 'rgba(120,10,40,0.07)');
      r.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = r;
      x.fillRect(0, 200, 960, 340);
      this.fundoPronto = c;
    }
    ctx.drawImage(this.fundoPronto, 0, 0, 960, 540);

    // arcos concentricos, como ondas na agua parada do fundo do poco
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#ff3a5a';
    for (let i = 0; i < 5; i++) {
      const t = (this.tempo * 0.16 + i / 5) % 1;
      ctx.globalAlpha = 0.14 * (1 - t);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(480, 600, 80 + t * 620, 30 + t * 220, 0, Math.PI, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function pintarVerbete(x, W, H, e) {
  x.clearRect(0, 0, W, H);
  x.fillStyle = 'rgba(10,7,14,0.9)';
  x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(160,60,80,0.55)';
  x.lineWidth = 4;
  x.strokeRect(6, 6, W - 12, H - 12);
  if (!e) return;

  const conhecido = e.conhecido;
  x.textAlign = 'center';
  x.textBaseline = 'middle';

  const cor = e.tipo === 'chefe' ? '#ff5a6a' : e.tipo === 'reliquia' ? '#8ad0ff' : '#c9e08a';
  x.save();
  x.shadowColor = cor; x.shadowBlur = 30;
  const icone = e.tipo === 'reliquia' ? (e.dado.icone || 'escama') : (e.tipo === 'chefe' ? 'olho' : 'presa');
  desenhaIcone(x, icone, W / 2, 110, 120, conhecido ? cor : '#3a3440', conhecido ? 0.95 : 0.4);
  x.restore();

  x.font = 'bold 34px Georgia, serif';
  x.fillStyle = conhecido ? '#e2d3ba' : '#5d5666';
  x.fillText(conhecido ? e.nome : '? ? ?', W / 2, 200);

  x.font = 'italic 22px "Trebuchet MS", sans-serif';
  x.fillStyle = 'rgba(180,150,150,0.75)';
  const rotulo = e.tipo === 'chefe' ? 'CHEFE' : e.tipo === 'reliquia' ? 'RELIQUIA' : 'INIMIGO';
  x.fillText(rotulo, W / 2, 236);

  const linhas = [];
  if (!conhecido) {
    linhas.push(e.tipo === 'reliquia' ? 'Voce ainda nao carregou isto.' : 'Voce ainda nao encontrou isto la embaixo.');
  } else if (e.tipo === 'inimigo') {
    linhas.push(e.dado.descricao, '', 'vida ' + e.dado.vida + '   dano ' + e.dado.dano, 'almas ' + e.dado.almas);
  } else if (e.tipo === 'chefe') {
    linhas.push(e.dado.titulo, '', '"' + e.dado.grito + '"', '', 'vida ' + e.dado.vida);
  } else {
    linhas.push(e.dado.texto, '', 'raridade: ' + e.dado.raridade);
  }

  x.font = '23px "Trebuchet MS", sans-serif';
  x.fillStyle = 'rgba(200,188,168,0.9)';
  let y = 300;
  for (const linha of linhas) {
    const palavras = String(linha).split(' ');
    let atual = '';
    for (const p of palavras) {
      const teste = atual ? atual + ' ' + p : p;
      if (x.measureText(teste).width > W - 70 && atual) { x.fillText(atual, W / 2, y); y += 32; atual = p; }
      else atual = teste;
    }
    x.fillText(atual, W / 2, y);
    y += 32;
  }
}

function pintarCreditos(x, W, H) {
  x.clearRect(0, 0, W, H);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  let y = 70;
  for (const linha of D.textos.creditos) {
    if (!linha) { y += 26; continue; }
    const grande = linha === 'OUROBOROS';
    x.font = grande ? 'bold 54px Georgia, serif' : '25px "Trebuchet MS", sans-serif';
    x.fillStyle = grande ? '#ff5a72' : 'rgba(206,192,172,0.92)';
    x.save();
    if (grande) { x.shadowColor = 'rgba(255,40,80,0.8)'; x.shadowBlur = 30; }
    x.fillText(linha, W / 2, y);
    x.restore();
    y += grande ? 78 : 38;
  }
}

function pintarEssencia(x, W, H) {
  x.clearRect(0, 0, W, H);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 46px Georgia, serif';
  x.save();
  x.shadowColor = 'rgba(255,180,80,0.7)'; x.shadowBlur = 26;
  x.fillStyle = '#f0d49a';
  x.fillText('ALTAR DOS OSSOS', W / 2, 62);
  x.restore();
  x.font = '30px "Trebuchet MS", sans-serif';
  x.fillStyle = 'rgba(220,190,140,0.92)';
  x.fillText(salvar.dados.essencia + ' de essencia', W / 2, 130);
  x.font = 'italic 22px "Trebuchet MS", sans-serif';
  x.fillStyle = 'rgba(170,150,130,0.7)';
  x.fillText('o que a morte deixou cair', W / 2, 172);
}

export const menu3d = new CenaMenu();
export { CORES as coresMenu };
