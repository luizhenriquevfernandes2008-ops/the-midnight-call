// jogo.js — o laco da corrida: salas, ondas, chefe, recompensa e morte.
//
// Este arquivo e o unico que conhece todo mundo. As outras pecas (cobra,
// bicho, chefe, arena) so conhecem a si mesmas e recebem "jogo" quando
// precisam falar com o mundo. E o que permite mexer no comportamento de um
// bicho sem abrir mais nenhum arquivo.
//
// Fluxo de uma corrida:
//   intro do andar -> N salas de bicho -> camara do chefe -> reliquia ->
//   proximo andar. Nivel sobe no meio disso e abre a tela de cartas.

import { D } from '../nucleo/dados.js';
import { audio } from '../nucleo/audio.js';
import { entrada } from '../nucleo/entrada.js';
import { salvar } from '../nucleo/salvar.js';
import { VW, VH, limpar, acabamento, texto } from '../nucleo/gfx.js';
import {
  semente, sementeDeTexto, sorteiaPesado, sorteia, limita, inteiro,
  distGrade, TAU, chance,
} from '../nucleo/util.js';
import { Arena } from './arena.js';
import { Cobra } from './cobra.js';
import { Inimigo } from './inimigos.js';
import { Chefe } from './chefes.js';
import { Projetil } from './projeteis.js';
import { Item } from './itens.js';
import { Corrida } from './corrida.js';
import { Fx } from './fx.js';
import { acharCercados } from './constricao.js';
import { desenharHud } from '../ui/hud.js';
import * as Telas from '../ui/telas.js';
import { cartas3d } from '../tres/cena-cartas.js';

const DUR_INTRO = 3.4;

export class Jogo {
  constructor() {
    this.estado = 'parado';
    this.audio = audio;
    this.textos = D.textos;
    this.fx = new Fx();
    this.tempo = 0;
    this.aoSair = null;         // callback: voltar ao menu
    this.nomesPerigo = [];
    this.dadosPerigo = {};
    this.indicePausa = 0;
    this.avisoTexto = '';
    this.avisoTempo = 0;
    this.constricaoBrilho = 0;
    this.ultimasDirecoes = [];
    this.filaRecompensas = [];
    this.escuridao = null;
    this.mostrarTutorial = 0;
  }

  // ---------- comeco ----------

  iniciar(op = {}) {
    const nomes = Object.keys(D.fases.perigos);
    this.nomesPerigo = nomes;
    this.dadosPerigo = D.fases.perigos;

    const sementeNum = op.semente ?? (Math.random() * 0xffffffff) >>> 0;
    this.corrida = new Corrida(sementeNum, op.andar || 0);
    this.rng = semente(sementeNum ^ 0x9e3779b9);

    this.arena = new Arena(D.config.arena);
    this.cobra = new Cobra(D.config.cobra, this.corrida.atributos);
    this.inimigos = [];
    this.projeteis = [];
    this.itens = [];
    this.chefe = null;
    this.salasLimpas = 0;
    this.esmagados = 0;
    this.essenciaGanha = 0;
    this.fx.limpar();
    this.fx.escalaTremor = salvar.dados.opcoes.tremor ?? 1;
    this.filaRecompensas.length = 0;
    this.ultimasDirecoes.length = 0;
    this.corridaNova = true;
    this.tempo = 0;
    this.mostrarTutorial = salvar.dados.visto.tutorial ? 0 : 0.0001;

    // reliquia inicial comprada no altar
    if (this.corrida.tem('reliquia_inicial')) {
      const r = this.corrida.sortearReliquias(1)[0];
      if (r) this.corrida.pegarCarta(r);
    }

    this.entrarAndar(this.corrida.andar);
  }

  entrarAndar(n) {
    this.corrida.andar = n;
    this.corrida.sala = 0;
    this.salaDeChefe = false;
    this.estado = 'intro';
    this.tIntro = 0;
    this.gerarSala();
    audio.musica(this.corrida.andarDados.musica);
    audio.definirIntensidade(0.35);
  }

  gerarSala() {
    const r = this.corrida;
    const andar = r.andarDados;
    this.salaDeChefe = r.sala >= r.salasNoAndar;
    const sementeSala = sementeDeTexto(r.semente + ':' + r.andar + ':' + r.sala);

    // Camara do chefe pede espaco: padrao de sala normal vira armadilha
    // quando o bicho ocupa 3x3 e enche a tela de projetil.
    const andarUsado = this.salaDeChefe
      ? Object.assign({}, andar, {
        estilos: ['vazio', 'ilhas'], densidadeParede: 0.04, poucosPerigos: true,
      })
      : andar;
    this.arena.gerar(andarUsado, r.sala, sementeSala, this.nomesPerigo);
    this.inimigos.length = 0;
    this.projeteis.length = 0;
    this.itens.length = 0;
    this.chefe = null;
    this.escuridao = null;
    this.portaAberta = false;

    const nasce = this.arena.nascimento;
    const comprimentoAtual = this.cobra.segmentos.length || D.config.cobra.comprimentoInicial;
    const comprimento = this.corridaNova
      ? D.config.cobra.comprimentoInicial
      : Math.max(4, comprimentoAtual + (r.atributos.segmentosPorSala || 0));
    this.corridaNova = false;
    this.cobra.nascer(nasce.cx, nasce.cy, comprimento);
    this.cobra.at = r.atributos;
    this.cobra.vidaMax = r.atributos.vidaMax;
    this.cobra.vida = Math.min(this.cobra.vida || r.atributos.vidaInicial, this.cobra.vidaMax);
    if (this.cobra.vida <= 0) this.cobra.vida = r.atributos.vidaInicial;
    this.cobra.viva = true;
    entrada.limparFila();

    if (r.tem('cura_por_sala')) this.cobra.curar(1);

    if (this.salaDeChefe) {
      const def = D.porId.chefes[andar.chefe];
      this.chefe = new Chefe(def, this);
      salvar.descobrir('chefes', def.id);
      this.avisar(D.textos.aviso.chefe);
      audio.gritoChefe();
      audio.musica(r.ultimoAndar ? 'chefeFinal' : 'chefe');
      audio.definirIntensidade(1);
      this.fx.clarao(0.7, '255,40,40');
      this.fx.sacudir(14);
      this.falaChefe = def.grito;
      this.falaChefeTempo = 4.5;
    } else {
      this.povoar(andar);
      audio.definirIntensidade(0.45 + r.sala * 0.12);
    }
  }

  povoar(andar) {
    const r = this.corrida;
    const base = 4 + r.andar + r.sala * 2;
    const quantos = Math.min(16, base + inteiro(this.rng, 0, 2));
    const disponiveis = andar.inimigos.map(id => D.porId.inimigos[id]).filter(Boolean);
    for (let i = 0; i < quantos; i++) {
      const def = sorteiaPesado(this.rng, disponiveis);
      // Duas tentativas para nao empilhar bicho na mesma celula: dois
      // desenhos no mesmo lugar viram uma mancha que o jogador le como um
      // bicho so, e ele morre sem entender.
      let cel = this.arena.celulaLivreAleatoria(this.rng, this.arena.nascimento, 8);
      if (this.inimigoEm(cel.cx, cel.cy)) {
        cel = this.celulaLivrePerto(cel.cx, cel.cy, 3) || cel;
      }
      this.criarInimigo(def.id, cel.cx, cel.cy);
    }
    // um pouco de comida ja no chao, para nao comecar seco
    for (let i = 0; i < 3; i++) {
      const cel = this.arena.celulaLivreAleatoria(this.rng, this.arena.nascimento, 3);
      this.itens.push(new Item({ tipo: 'alma', cx: cel.cx, cy: cel.cy, valor: 1 }));
    }
    if (chance(this.rng, 0.35)) {
      const cel = this.arena.celulaLivreAleatoria(this.rng, this.arena.nascimento, 6);
      this.itens.push(new Item({ tipo: 'coracao', cx: cel.cx, cy: cel.cy, valor: 1 }));
    }
  }

  // ---------- fabricas ----------

  criarInimigo(id, cx, cy) {
    const def = D.porId.inimigos[id];
    if (!def) return null;
    const bicho = new Inimigo(def, cx, cy, this.corrida.escalaInimigos());
    this.inimigos.push(bicho);
    salvar.descobrir('inimigos', id);
    return bicho;
  }

  criarProjetil(op) { this.projeteis.push(new Projetil(op)); }

  criarAlma(cx, cy, valor = 1) {
    this.itens.push(new Item({ tipo: 'alma', cx, cy, valor }));
  }

  // ---------- consultas ----------

  entradaDirecao() { return entrada.proximaDirecao(); }

  inimigoEm(cx, cy) {
    for (const i of this.inimigos) {
      if (!i.morto && i.cx === cx && i.cy === cy) return i;
    }
    return null;
  }

  chefeEm(cx, cy) {
    return this.chefe && !this.chefe.morto && this.chefe.ocupa(cx, cy) ? this.chefe : null;
  }

  celulaLivrePerto(cx, cy, raio) {
    for (let tentativa = 0; tentativa < 40; tentativa++) {
      const x = cx + inteiro(this.rng, -raio, raio);
      const y = cy + inteiro(this.rng, -raio, raio);
      if (!this.arena.livre(x, y)) continue;
      if (this.inimigoEm(x, y)) continue;
      if (this.cobra.ocupa(x, y, false) >= 0) continue;
      return { cx: x, cy: y };
    }
    return null;
  }

  indicePerigo(nome) { return this.nomesPerigo.indexOf(nome) + 1; }

  poeTeia(cx, cy, dur) { this.arena.poePerigo(cx, cy, this.indicePerigo('teia'), dur); }
  poeRastro(nome, cx, cy) { this.arena.poePerigo(cx, cy, this.indicePerigo(nome), 2600); }
  poePocaVeneno(cx, cy) { this.arena.poePerigo(cx, cy, this.indicePerigo('lodo'), 1800); }

  escurecer(raio, dur) { this.escuridao = { raio, ate: this.tempo * 1000 + dur }; }

  avisar(txt) { this.avisoTexto = txt; this.avisoTempo = 2.2; }

  // ---------- eventos ----------

  aoAndarCobra(cx, cy, emBote) {
    this.ultimasDirecoes.push({ x: this.cobra.dir.x, y: this.cobra.dir.y });
    if (this.ultimasDirecoes.length > 80) this.ultimasDirecoes.shift();
    this.corrida.maiorCorpo = Math.max(this.corrida.maiorCorpo, this.cobra.comprimento);

    // morder o que estiver na celula
    const bicho = this.inimigoEm(cx, cy);
    if (bicho) {
      const dano = (this.cobra.devorando() ? D.config.cobra.devorar.dano : this.danoMordida())
        * (emBote ? 1.6 : 1);
      this.ferirInimigo(bicho, dano, 'mordida');
      if (!this.cobra.devorando() && !this.cobra.invulneravel() && !emBote) {
        this.cobra.levarDano(this, bicho.dano, 'contato');
      }
    }
    const chefe = this.chefeEm(cx, cy);
    if (chefe) {
      this.ferirInimigo(chefe, this.danoMordida() * (emBote ? 1.6 : 1), 'mordida');
    }

    // perigo do chao
    const nome = this.arena.porPerigo(this.nomesPerigo, cx, cy);
    if (nome) {
      const p = this.dadosPerigo[nome];
      if (p.dano > 0 && this.tempo * 1000 - this.cobra.danoUltimoPerigo > (p.intervalo || 800)) {
        this.cobra.danoUltimoPerigo = this.tempo * 1000;
        this.cobra.levarDano(this, p.dano, 'perigo');
      }
    }

    this.checarConstricao();
  }

  aoAndarInimigo(bicho) {
    const c = this.cobra;
    if (!c.viva) return;
    const cab = c.cabeca;
    if (bicho.cx === cab.cx && bicho.cy === cab.cy) {
      c.levarDano(this, bicho.dano, 'contato');
      this.ferirInimigo(bicho, this.danoMordida() * 0.5, 'contato');
      return;
    }
    // Rato-de-Cauda: chegou na ponta, arranca
    if (bicho.def.comportamento === 'mordedor') {
      const cauda = c.segmentos[c.segmentos.length - 1];
      if (bicho.cx === cauda.cx && bicho.cy === cauda.cy && c.comprimento > 5) {
        const quantos = bicho.def.segmentosArrancados || 3;
        c.severar(this, Math.max(4, c.comprimento - quantos));
        this.avisar(D.textos.aviso.severado);
      }
    }
  }

  danoMordida() {
    const a = this.corrida.atributos;
    return (a.danoMordida) * (1 + a.danoGeral) + this.bonusPorTamanho();
  }

  bonusPorTamanho() {
    if (!this.corrida.tem('dano_por_tamanho')) return 0;
    return Math.floor(this.cobra.comprimento / 10);
  }

  ferirInimigo(alvo, dano, origem, x, y) {
    if (!alvo || alvo.morto) return 0;
    const real = alvo.ferir(this, dano, false, x, y);
    if (real > 0) {
      this.cobra.furia = Math.min(D.config.cobra.furiaMaxima,
        this.cobra.furia + 1.2 * this.corrida.atributos.furiaMult);
    }
    return real;
  }

  envenenar(alvo, dano, duracao) {
    if (!alvo || alvo.morto) return;
    alvo.veneno = { dano, restante: duracao, acumulado: 0 };
  }

  aoMorrerInimigo(bicho) {
    const r = this.corrida;
    const arena = this.arena;
    const p = bicho.posicao(arena);
    // A alma NAO e creditada aqui: ela cai no chao e so conta quando for
    // engolida. E o que da sentido ao ima, ao raio de coleta e ao risco de
    // voltar buscar o que ficou para tras.
    const total = bicho.def.almas || 1;
    const pedacos = Math.min(3, total);
    const porPedaco = Math.max(1, Math.round(total / pedacos));
    for (let i = 0; i < pedacos; i++) {
      this.itens.push(new Item({
        tipo: 'alma', cx: bicho.cx, cy: bicho.cy, valor: porPedaco,
        x: p.x + (Math.random() - 0.5) * 18, y: p.y + (Math.random() - 0.5) * 18,
      }));
    }
    this.cobra.furia = Math.min(D.config.cobra.furiaMaxima,
      this.cobra.furia + D.config.cobra.furiaPorMorte * r.atributos.furiaMult);
    if (r.atributos.roubaVida > 0 && Math.random() < r.atributos.roubaVida) {
      this.cobra.curar(1);
      this.fx.texto(p.x, p.y - 20, '+1', '#ff8aa0', { tam: 15 });
    }
    if (chance(this.rng, 0.06)) {
      this.itens.push(new Item({ tipo: 'coracao', cx: bicho.cx, cy: bicho.cy }));
    }
  }

  aoMorrerChefe(chefe) {
    const r = this.corrida;
    r.ganharAlma(chefe.def.almas);
    const ganho = r.ganharEssencia(D.config.corrida.essenciaPorChefe);
    this.avisar(chefe.def.morte);
    audio.definirIntensidade(0.3);
    salvar.dados.andarLiberado = Math.max(salvar.dados.andarLiberado, Math.min(r.andar + 1, D.fases.andares.length - 1));
    salvar.gravar();
    this.fx.texto(480, 200, '+' + ganho + ' essencia', '#ffd07a', { tam: 20, vida: 2 });

    setTimeout(() => {
      if (this.estado === 'morte') return;
      if (r.ultimoAndar) { this.vencer(); return; }
      this.filaRecompensas.push({ tipo: 'reliquia' });
      this.abrirProximaRecompensa(() => {
        r.andar++;
        this.cobra.vida = Math.min(this.cobra.vidaMax, this.cobra.vida + D.config.corrida.curaEntreAndares);
        this.entrarAndar(r.andar);
      });
    }, 1800);
  }

  recolher(item) {
    if (item.morto) return;
    item.morto = true;
    const r = this.corrida;
    if (item.tipo === 'coracao') {
      this.cobra.curar(2);
      audio.pegar();
      this.fx.texto(item.x, item.y - 12, '+2 VIDA', '#ff8aa0', { tam: 15 });
      return;
    }
    if (item.tipo === 'essencia') {
      const g = r.ganharEssencia(item.valor);
      this.fx.texto(item.x, item.y - 12, '+' + g, '#ffd07a', { tam: 14 });
      audio.pegar();
      return;
    }
    const ganho = r.ganharAlma(item.valor);
    this.cobra.crescer(r.atributos.crescimentoPorAlma);
    this.cobra.furia = Math.min(D.config.cobra.furiaMaxima,
      this.cobra.furia + D.config.cobra.furiaPorAlma * r.atributos.furiaMult);
    audio.comer();
    this.fx.emitir(item.x, item.y, { n: 7, cor: '#8affb0', vel: 90, vida: 0.4, tam: 2.6 });

    if (r.tem('explosao_ao_comer')) {
      const dano = r.atributos.danoExplosao || 3;
      this.fx.onda(item.x, item.y, this.arena.celula * 2.2, '255,180,90', 0.35, 4);
      for (const b of this.inimigos) {
        if (b.morto) continue;
        if (distGrade(b.cx, b.cy, item.cx, item.cy) <= 2) this.ferirInimigo(b, dano, 'explosao');
      }
    }

    while (r.podeSubirNivel()) {
      r.subirNivel();
      this.filaRecompensas.push({ tipo: 'melhoria' });
    }
    if (this.filaRecompensas.length && this.estado === 'jogando') {
      this.abrirProximaRecompensa();
    }
  }

  // ---------- constricao ----------

  checarConstricao() {
    const cfg = D.config.cobra.constricao;
    if (this.cobra.comprimento < cfg.comprimentoMinimo) { this.cercoAtivo = false; return; }
    const achado = acharCercados(this.arena, this.cobra);
    if (!achado) { this.cercoAtivo = false; this.cercoCelulas = null; return; }
    this.cercoCelulas = achado.conjunto;
    if (this.cercoAtivo) return;                 // ja contou este fechamento
    if (this.tempo * 1000 < this.constricaoAte) return;
    this.cercoAtivo = true;
    this.constricaoAte = this.tempo * 1000 + cfg.recarga;

    const cols = this.arena.cols;
    const alvos = [];
    for (const b of this.inimigos) {
      if (!b.morto && achado.conjunto.has(b.cy * cols + b.cx)) alvos.push(b);
    }
    if (this.chefe && !this.chefe.morto) {
      const cx = Math.round(this.chefe.cx), cy = Math.round(this.chefe.cy);
      if (achado.conjunto.has(cy * cols + cx)) alvos.push(this.chefe);
    }

    const area = achado.celulas.length;
    const mult = 1 + (this.corrida.atributos.danoConstricao || 0);
    let dano = (cfg.danoBase + area * cfg.danoPorCelula) * mult * (1 + this.corrida.atributos.danoGeral);
    dano = Math.min(cfg.danoMaximo * mult, dano);

    // desenho do aperto
    for (const idx of achado.celulas) {
      const cx = idx % cols, cy = (idx / cols) | 0;
      if (Math.random() < 0.5) {
        this.fx.emitir(this.arena.px(cx), this.arena.py(cy),
          { n: 1, cor: '#ff6a8a', vel: 50, vida: 0.5, tam: 3 });
      }
    }

    if (!alvos.length) return;

    audio.constricao(limita(area / 20, 0.4, 1.3));
    this.fx.sacudir(6 + Math.min(10, area * 0.4));
    this.fx.clarao(0.25, '255,80,120');
    this.constricaoBrilho = 1.4;
    for (const alvo of alvos) {
      this.ferirInimigo(alvo, dano, 'constricao');
      if (alvo.morto) this.esmagados++;   // o dano e arredondado la dentro
    }
    if (this.corrida.tem('cura_constricao')) this.cobra.curar(1);
    if (!this.corrida.tem('constricao_gratis') && this.cobra.comprimento > 5) {
      for (let i = 0; i < cfg.custoSegmentos; i++) this.cobra.segmentos.pop();
    }
  }

  // ---------- morte e vitoria ----------

  matarCobra(causa) {
    if (this.estado === 'morte') return;
    const r = this.corrida;
    if (r.tem('revive') && !r.reviveUsado) {
      r.reviveUsado = true;
      this.cobra.vida = Math.max(1, Math.round(this.cobra.vidaMax / 2));
      this.cobra.invulneravelAte = this.cobra.tempo + 2400;
      this.avisar('A SEGUNDA PELE SE ROMPE');
      audio.furia();
      this.fx.clarao(0.9, '255,220,180');
      this.fx.sacudir(20);
      return;
    }
    this.cobra.viva = false;
    this.estado = 'morte';
    this.tMorte = 0;
    this.fraseMorte = sorteia(Math.random, D.textos.morte);
    audio.morte();
    audio.pararMusica(1.6);
    this.fx.clarao(1, '160,20,30');
    this.fx.sacudir(22);
    const arena = this.arena;
    for (const s of this.cobra.segmentos) {
      this.fx.emitir(arena.px(s.cx), arena.py(s.cy),
        { n: 3, cor: '#7acf6a', vel: 120, vida: 1.1, tam: 3 });
    }
    this.fecharCorrida(false);
  }

  vencer() {
    this.estado = 'vitoria';
    this.tVitoria = 0;
    audio.musica('vitoria');
    audio.definirIntensidade(0.7);
    this.fecharCorrida(true);
  }

  fecharCorrida(venceu) {
    const r = this.corrida;
    this.essenciaGanha = r.essencia;
    salvar.dados.essencia += this.essenciaGanha;
    salvar.dados.recordes.corridas++;
    if (venceu) salvar.dados.recordes.vitorias++;
    salvar.registrar('maiorAndar', r.andar + 1);
    salvar.registrar('maiorCorpo', r.maiorCorpo);
    salvar.registrar('maisAlmas', r.almasTotais);
    salvar.dados.visto.tutorial = true;
    salvar.gravar();
  }

  // ---------- recompensa ----------

  abrirProximaRecompensa(aoTerminar) {
    const proxima = this.filaRecompensas.shift();
    if (!proxima) { if (aoTerminar) aoTerminar(); return; }
    const r = this.corrida;
    const eReliquia = proxima.tipo === 'reliquia';
    const cartas = eReliquia ? r.sortearReliquias(3) : r.sortearMelhorias(3);
    if (!cartas.length) { this.abrirProximaRecompensa(aoTerminar); return; }
    this.estado = 'recompensa';
    audio.nivel();
    audio.definirIntensidade(0.25);
    const paleta = r.andarDados.paleta;
    cartas3d.abrir(
      cartas,
      eReliquia ? 'O CHEFE DEIXOU CAIR ALGO' : 'NIVEL ' + r.nivel,
      eReliquia ? D.textos.aviso.reliquia : sorteia(Math.random, D.textos.dicas),
      (escolhida) => {
        r.pegarCarta(escolhida);
        this.cobra.at = r.atributos;
        this.cobra.vidaMax = r.atributos.vidaMax;
        if (escolhida.cura) this.cobra.curar(escolhida.cura);
        this.fx.clarao(0.4, '255,200,140');
        if (this.filaRecompensas.length) this.abrirProximaRecompensa(aoTerminar);
        else {
          this.estado = 'jogando';
          audio.definirIntensidade(this.chefe ? 1 : 0.6);
          if (aoTerminar) aoTerminar();
        }
      },
      [1, 0.35, 0.4]);
  }

  // ---------- laco ----------

  atualizar(dt) {
    this.tempo += dt;
    this.fx.atualizar(dt);
    if (this.avisoTempo > 0) this.avisoTempo -= dt;
    if (this.falaChefeTempo > 0) this.falaChefeTempo -= dt;
    this.constricaoBrilho = Math.max(0, this.constricaoBrilho - dt * 1.6);
    if (this.mostrarTutorial > 0) this.mostrarTutorial += dt;

    switch (this.estado) {
      case 'intro':
        this.tIntro += dt;
        if (this.tIntro >= DUR_INTRO || entrada.nova('confirma') || entrada.nova('bote')) {
          this.estado = 'jogando';
          entrada.limparFila();
        }
        break;

      case 'jogando':
        this.atualizarJogo(dt);
        break;

      case 'recompensa':
        cartas3d.atualizar(dt);
        break;

      case 'pausa':
        this.atualizarPausa();
        break;

      case 'morte':
        this.tMorte += dt;
        this.atualizarMundo(dt * 0.25);   // o mundo continua, mais devagar
        if (this.tMorte > 1.4) {
          if (entrada.nova('recomecar')) { audio.clique(); this.iniciar({ andar: 0 }); break; }
          if (entrada.nova('confirma') || entrada.cliques.length) {
            audio.clique();
            if (this.aoSair) this.aoSair();
          }
        }
        break;

      case 'vitoria':
        this.tVitoria += dt;
        this.atualizarMundo(dt * 0.4);
        if (this.tVitoria > 3 && (entrada.nova('confirma') || entrada.cliques.length)) {
          if (this.aoSair) this.aoSair();
        }
        break;
    }
  }

  atualizarJogo(dt) {
    if (entrada.nova('menu')) {
      this.estado = 'pausa';
      this.indicePausa = 0;
      audio.definirIntensidade(0.15);
      audio.voltar();
      return;
    }
    if (entrada.nova('bote')) this.cobra.usarBote(this);
    if (entrada.nova('cuspe') || entrada.cliques.some(c => c.botao === 2)) this.cobra.cuspir(this);
    if (entrada.nova('furia')) this.cobra.usarFuria(this);

    this.atualizarMundo(dt);

    // sala limpa: abre a porta
    const vivos = this.inimigos.filter(i => !i.morto).length;
    if (!this.salaDeChefe && vivos === 0 && !this.portaAberta) {
      this.portaAberta = true;
      this.arena.abrirPorta(this.rng);
      this.avisar(D.textos.aviso.salaLimpa);
      audio.porta();
      audio.definirIntensidade(0.3);
      this.salasLimpas++;
      const g = this.corrida.ganharEssencia(D.config.corrida.essenciaPorSala);
      this.fx.texto(this.arena.px(this.arena.porta.cx), this.arena.py(this.arena.porta.cy) - 20,
        '+' + g, '#ffd07a', { tam: 15 });
    }

    // entrou na porta
    if (this.portaAberta && this.arena.porta && this.cobra.viva) {
      const cab = this.cobra.cabeca;
      if (cab.cx === this.arena.porta.cx && cab.cy === this.arena.porta.cy) {
        this.corrida.sala++;
        audio.porta();
        this.fx.clarao(0.4, '180,140,255');
        this.gerarSala();
        if (!this.salaDeChefe) audio.definirIntensidade(0.5 + this.corrida.sala * 0.1);
      }
    }

    // intensidade da musica acompanha o perigo
    if (!this.salaDeChefe) {
      const total = Math.max(1, 4 + this.corrida.andar + this.corrida.sala * 2);
      const perigo = limita(vivos / total, 0, 1);
      const vidaBaixa = this.cobra.vida <= 2 ? 0.25 : 0;
      audio.definirIntensidade(limita(0.3 + perigo * 0.6 + vidaBaixa, 0, 1));
    }
  }

  atualizarMundo(dt) {
    const c = this.cobra;
    // Sangue frio: o tempo desacelera quando a vida esta no fim
    let escala = 1;
    if (this.corrida.tem('tempo_lento') && c.vida <= 2 && c.viva) escala = 0.62;
    const d = dt * escala;

    this.arena.atualizar(d);
    c.atualizar(d, this);

    for (const b of this.inimigos) b.atualizar(d, this);
    for (let i = this.inimigos.length - 1; i >= 0; i--) {
      if (this.inimigos[i].morto) this.inimigos.splice(i, 1);
    }

    if (this.chefe) this.chefe.atualizar(d, this);

    for (const p of this.projeteis) p.atualizar(d, this);
    for (let i = this.projeteis.length - 1; i >= 0; i--) {
      if (this.projeteis[i].morto) this.projeteis.splice(i, 1);
    }

    for (const it of this.itens) it.atualizar(d, this);
    for (let i = this.itens.length - 1; i >= 0; i--) {
      if (this.itens[i].morto) this.itens.splice(i, 1);
    }

    // cauda espinhosa: quem encosta no corpo se machuca
    if (this.corrida.tem('cauda_espinhosa')) {
      for (const b of this.inimigos) {
        if (b.morto) continue;
        const idx = c.ocupa(b.cx, b.cy, false);
        if (idx > 0) {
          b.espinhoAcum = (b.espinhoAcum || 0) + d;
          if (b.espinhoAcum > 0.5) {
            b.espinhoAcum = 0;
            this.ferirInimigo(b, this.corrida.atributos.danoCauda || 2, 'espinho');
          }
        }
      }
    }

    if (this.escuridao && this.tempo * 1000 > this.escuridao.ate) this.escuridao = null;
  }

  atualizarPausa() {
    if (entrada.nova('menu')) {
      this.estado = 'jogando';
      audio.definirIntensidade(0.6);
      return;
    }
    if (entrada.nova('baixo')) { this.indicePausa = (this.indicePausa + 1) % 3; audio.passar(); }
    if (entrada.nova('cima')) { this.indicePausa = (this.indicePausa + 2) % 3; audio.passar(); }
    for (const c of entrada.cliques) {
      const i = Math.round((c.y - 200) / 46);
      if (i >= 0 && i < 3 && Math.abs(c.x - 480) < 180) {
        this.indicePausa = i;
        this.confirmarPausa();
        return;
      }
    }
    if (entrada.nova('confirma')) this.confirmarPausa();
  }

  confirmarPausa() {
    audio.clique();
    if (this.indicePausa === 0) {
      this.estado = 'jogando';
      audio.definirIntensidade(0.6);
    } else if (this.indicePausa === 1) {
      this.fecharCorrida(false);
      this.iniciar({ andar: 0 });
    } else {
      this.fecharCorrida(false);
      if (this.aoSair) this.aoSair();
    }
  }

  // ---------- desenho ----------

  desenhar(ctx, frente) {
    const paleta = this.corrida.andarDados.paleta;
    limpar(ctx, paleta.fundo);

    ctx.save();
    ctx.translate(this.fx.tremorX, this.fx.tremorY);

    // fundo com respiro
    const g = ctx.createRadialGradient(VW / 2, VH / 2, 60, VW / 2, VH / 2, 620);
    g.addColorStop(0, paleta.fundo2);
    g.addColorStop(1, paleta.fundo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    this.arena.desenhar(ctx, this.tempo);
    this.desenharCerco(ctx);
    this.desenharPorta(ctx);

    for (const it of this.itens) it.desenhar(ctx, this.arena, this.tempo);
    for (const b of this.inimigos) b.desenhar(ctx, this.arena, this.tempo);
    if (this.chefe) this.chefe.desenhar(ctx, this.arena, this.tempo);
    this.cobra.desenhar(ctx, this.arena, corCobraA(), corCobraB());
    for (const p of this.projeteis) p.desenhar(ctx);
    this.fx.desenhar(ctx);

    this.desenharEscuridao(ctx);
    ctx.restore();

    this.fx.desenharClarao(ctx, VW, VH);
    acabamento(ctx, 0.62 * (salvar.dados.opcoes.grao ?? 1),
      this.cobra.vida <= 2 && this.cobra.viva ? 0.5 : 0);

    // ---- camada da frente ----
    limpar(frente, null);
    if (this.estado !== 'recompensa') desenharHud(frente, this);

    if (this.falaChefeTempo > 0 && this.chefe) {
      const a = limita(this.falaChefeTempo / 1.2, 0, 1);
      frente.save();
      frente.globalAlpha = a;
      texto(frente, '"' + this.falaChefe + '"', 480, 460, {
        tam: 17, tipo: 'titulo', cor: '#ffc0b0', alinha: 'centro', espaco: 1,
        sombra: 12, corSombra: 'rgba(255,60,60,0.8)',
      });
      frente.restore();
    }

    if (this.estado === 'intro') Telas.telaIntroAndar(frente, this, this.tIntro, DUR_INTRO);
    if (this.estado === 'pausa') Telas.telaPausa(frente, this, this.indicePausa);
    if (this.estado === 'morte') Telas.telaMorte(frente, this, this.tMorte);
    if (this.estado === 'vitoria') Telas.telaVitoria(frente, this, this.tVitoria);
    if (this.mostrarTutorial > 0 && this.estado === 'jogando') {
      Telas.telaTutorial(frente, this, this.mostrarTutorial);
      if (this.mostrarTutorial > 11) this.mostrarTutorial = 0;
    }
    if (this.estado === 'recompensa') cartas3d.frente2D(frente);
  }

  desenharCerco(ctx) {
    if (!this.cercoCelulas || !this.cercoCelulas.size) return;
    const cols = this.arena.cols, c = this.arena.celula;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulso = 0.10 + 0.07 * Math.sin(this.tempo * 7);
    ctx.fillStyle = 'rgba(255,60,110,' + pulso + ')';
    for (const idx of this.cercoCelulas) {
      const cx = idx % cols, cy = (idx / cols) | 0;
      ctx.fillRect(this.arena.ox + cx * c, this.arena.oy + cy * c, c, c);
    }
    ctx.restore();
  }

  desenharPorta(ctx) {
    const p = this.arena.porta;
    if (!p) return;
    const x = this.arena.px(p.cx), y = this.arena.py(p.cy);
    const c = this.arena.celula;
    const t = this.tempo;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 2, x, y, c * 1.6);
    g.addColorStop(0, 'rgba(180,140,255,0.7)');
    g.addColorStop(0.4, 'rgba(120,80,220,0.25)');
    g.addColorStop(1, 'rgba(60,20,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - c * 1.6, y - c * 1.6, c * 3.2, c * 3.2);
    for (let i = 0; i < 3; i++) {
      const f = ((t * 0.6 + i / 3) % 1);
      ctx.strokeStyle = 'rgba(200,160,255,' + (0.5 * (1 - f)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, c * 0.3 + f * c * 1.1, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(230,210,255,0.9)';
    ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DESCER', x, y - c * 0.9);
    ctx.restore();
  }

  desenharEscuridao(ctx) {
    const andar = this.corrida.andarDados;
    let raio = andar.luz || 0;
    if (this.escuridao) raio = raio ? Math.min(raio, this.escuridao.raio) : this.escuridao.raio;
    if (!raio) return;
    const cab = this.cobra.brilhoCabeca(this.arena);
    const r = raio * this.arena.celula;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(cab.x, cab.y, r * 0.35, cab.x, cab.y, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.72)');
    g.addColorStop(1, 'rgba(0,0,0,0.96)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = 'rgba(0,0,0,0.96)';
    ctx.fillRect(0, 0, VW, Math.max(0, cab.y - r));
    ctx.fillRect(0, cab.y + r, VW, VH);
    ctx.fillRect(0, Math.max(0, cab.y - r), Math.max(0, cab.x - r), Math.min(VH, r * 2));
    ctx.fillRect(cab.x + r, Math.max(0, cab.y - r), VW, Math.min(VH, r * 2));
    ctx.restore();
  }
}

// A cobra guarda a mesma cor em todos os andares: ela e a unica constante
// da tela, e o jogador precisa achar a propria cabeca no meio do caos.
function corCobraA() { return '#4ae08a'; }
function corCobraB() { return '#0d3324'; }
