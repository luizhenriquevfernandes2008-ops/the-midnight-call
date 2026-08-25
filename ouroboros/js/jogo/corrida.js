// corrida.js — o estado de UMA descida.
//
// Guarda o que foi escolhido (reliquias e melhorias), a que altura da queda
// voce esta e, principalmente, os ATRIBUTOS: um objeto recalculado do zero
// toda vez que algo muda. Somar modificador em cima de valor ja somado e
// como bug de balanceamento nasce; recalcular do zero e barato e nunca
// mente.

import { D } from '../nucleo/dados.js';
import { salvar } from '../nucleo/salvar.js';
import { semente, embaralha, sorteiaPesado, limita } from '../nucleo/util.js';

const PESO_RARIDADE = { comum: 10, rara: 5, maldita: 3 };

export class Corrida {
  constructor(sementeNum, andarInicial = 0) {
    this.semente = sementeNum;
    this.rng = semente(sementeNum);
    this.andar = andarInicial;
    this.sala = 0;
    this.reliquias = [];
    this.melhorias = {};
    this.marcas = new Set();
    this.almas = 0;
    this.almasTotais = 0;
    this.nivel = 1;
    this.essencia = 0;
    this.mortes = 0;
    this.tempoInicio = performance.now();
    this.reviveUsado = false;
    this.maiorCorpo = 0;
    this.recalcular();
  }

  get andarDados() { return D.fases.andares[Math.min(this.andar, D.fases.andares.length - 1)]; }
  get salasNoAndar() { return this.andarDados.salas; }
  get ultimoAndar() { return this.andar >= D.fases.andares.length - 1; }

  tem(marca) { return this.marcas.has(marca); }

  recalcular() {
    const c = D.config.cobra;
    const a = {
      vidaMax: c.vidaInicial,
      vidaInicial: c.vidaInicial,
      danoMordida: c.danoMordida,
      danoBote: c.bote.dano,
      danoCuspe: 0,
      danoCauda: 0,
      danoExplosao: 0,
      danoConstricao: 0,     // multiplicador extra (0 = normal)
      danoGeral: 0,
      danoRecebido: 0,
      armadura: 0,
      tickMult: 1,
      energiaMax: c.energiaMaxima,
      energiaRegen: c.energiaRegen,
      recargaBote: 1,
      recargaCuspe: 1,
      celulasBote: 0,
      boteInvulneravel: 0,
      almasMult: 1,
      essenciaMult: 1,
      crescimentoPorAlma: 1,
      raioColeta: 0,
      roubaVida: 0,
      furiaMult: 1,
      invulneravel: 0,
      segmentosPorSala: 0,
      sorte: 0,
      semCrescimento: false,
    };

    // Todo modificador do JSON e SOMADO. Os que parecem multiplicador
    // (tickMult, recargaBote) sao deltas sobre a base 1: -0.06 = 6% mais
    // rapido. Manter uma regra so evita o classico "por que este item
    // deixou a cobra parada".
    const aplicar = (mods) => {
      if (!mods) return;
      for (const [k, v] of Object.entries(mods)) {
        a[k] = (a[k] === undefined ? 0 : a[k]) + v;
      }
    };

    // altar: progressao permanente
    for (const item of D.altar.lista) {
      const n = salvar.nivelAltar(item.id);
      if (!n) continue;
      for (let i = 0; i < n; i++) aplicar(item.mods);
      if (item.marca) this.marcas.add(item.marca);
    }

    for (const id of this.reliquias) {
      const r = D.porId.reliquias[id];
      if (!r) continue;
      aplicar(r.mods);
      if (r.marca) this.marcas.add(r.marca);
    }

    for (const [id, n] of Object.entries(this.melhorias)) {
      const m = D.porId.melhorias[id];
      if (!m) continue;
      for (let i = 0; i < n; i++) aplicar(m.mods);
      if (m.marca) this.marcas.add(m.marca);
    }

    if (this.marcas.has('sem_crescimento')) a.semCrescimento = true;
    a.vidaMax = Math.max(1, Math.round(a.vidaMax));
    a.vidaInicial = a.vidaMax;
    a.tickMult = limita(a.tickMult, 0.45, 1.6);
    a.recargaBote = limita(a.recargaBote, 0.25, 2);
    a.recargaCuspe = limita(a.recargaCuspe, 0.25, 2);
    a.armadura = Math.max(0, a.armadura);
    this.atributos = a;
    return a;
  }

  ganharAlma(n) {
    const ganho = Math.max(1, Math.round(n * this.atributos.almasMult));
    this.almas += ganho;
    this.almasTotais += ganho;
    return ganho;
  }

  almasParaProximo() {
    const tabela = D.config.corrida.almasPorNivel;
    return tabela[Math.min(this.nivel - 1, tabela.length - 1)] +
      Math.max(0, this.nivel - tabela.length) * 14;
  }

  podeSubirNivel() { return this.almas >= this.almasParaProximo(); }

  subirNivel() {
    this.almas -= this.almasParaProximo();
    this.nivel++;
  }

  ganharEssencia(n) {
    const g = Math.round(n * this.atributos.essenciaMult);
    this.essencia += g;
    return g;
  }

  // ---------- cartas ----------

  sortearMelhorias(quantas = 3) {
    const disponiveis = D.melhorias.lista.filter(m => {
      const n = this.melhorias[m.id] || 0;
      if (n >= (m.maximo || 99)) return false;
      if (m.requer && !this.tem(m.requer)) return false;
      return true;
    });
    return embaralha(this.rng, disponiveis).slice(0, quantas).map(m => ({
      ...m,
      tipoCarta: 'melhoria',
      nivelTexto: (this.melhorias[m.id] || 0) > 0
        ? 'ja tem ' + this.melhorias[m.id] + ' de ' + (m.maximo || 99) : '',
    }));
  }

  sortearReliquias(quantas = 3) {
    const sorte = this.atributos.sorte || 0;
    const disponiveis = D.reliquias.lista
      .filter(r => !this.reliquias.includes(r.id))
      .map(r => ({
        ...r,
        peso: (PESO_RARIDADE[r.raridade] || 5) * (r.raridade === 'comum' ? 1 - sorte : 1 + sorte),
      }));
    const escolhidas = [];
    const copia = disponiveis.slice();
    while (escolhidas.length < quantas && copia.length) {
      const r = sorteiaPesado(this.rng, copia);
      escolhidas.push({ ...r, tipoCarta: 'reliquia' });
      copia.splice(copia.indexOf(r), 1);
    }
    return escolhidas;
  }

  pegarCarta(carta) {
    if (carta.tipoCarta === 'melhoria') {
      this.melhorias[carta.id] = (this.melhorias[carta.id] || 0) + 1;
    } else {
      if (!this.reliquias.includes(carta.id)) this.reliquias.push(carta.id);
      salvar.descobrir('reliquias', carta.id);
    }
    this.recalcular();
    return carta;
  }

  escalaInimigos() {
    const d = D.config.dificuldade;
    const n = this.andar;
    return {
      vida: 1 + n * d.vidaInimigoPorAndar,
      dano: 1 + n * d.danoInimigoPorAndar,
      velocidade: 1 + n * d.velocidadeInimigoPorAndar,
    };
  }

  resumo() {
    return {
      andar: this.andar + 1,
      sala: this.sala + 1,
      nivel: this.nivel,
      almas: this.almasTotais,
      reliquias: this.reliquias.length,
      essencia: this.essencia,
      tempo: (performance.now() - this.tempoInicio) / 1000,
    };
  }
}
