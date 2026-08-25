// salvar.js — o que sobrevive a morte.
//
// Roguelike so faz sentido se a derrota deixar alguma coisa. O que fica:
// essencia, os niveis comprados no Altar, os recordes e o compendio (todo
// bicho que ja te matou vira verbete).
//
// Tudo em localStorage. Se o navegador estiver em anonima e recusar, o jogo
// continua rodando com um save que vive so na memoria — melhor que travar.

const CHAVE = 'ouroboros.save.v1';

const PADRAO = () => ({
  essencia: 0,
  altar: {},
  recordes: { corridas: 0, vitorias: 0, maiorAndar: 0, maiorCorpo: 0, maisAlmas: 0, mortes: {} },
  compendio: { inimigos: [], chefes: [], reliquias: [] },
  opcoes: { mestre: 0.75, musica: 0.62, efeitos: 0.85, mudo: false, tremor: 1, grao: 1 },
  andarLiberado: 0,
  visto: { tutorial: false },
});

class Salvar {
  constructor() {
    this.dados = PADRAO();
    this.temDisco = true;
  }

  carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) {
        const d = JSON.parse(bruto);
        this.dados = Object.assign(PADRAO(), d);
        this.dados.recordes = Object.assign(PADRAO().recordes, d.recordes || {});
        this.dados.opcoes = Object.assign(PADRAO().opcoes, d.opcoes || {});
        this.dados.compendio = Object.assign(PADRAO().compendio, d.compendio || {});
      }
    } catch (e) {
      this.temDisco = false;
    }
    return this.dados;
  }

  gravar() {
    if (!this.temDisco) return;
    try { localStorage.setItem(CHAVE, JSON.stringify(this.dados)); }
    catch (e) { this.temDisco = false; }
  }

  apagar() {
    this.dados = PADRAO();
    try { localStorage.removeItem(CHAVE); } catch (e) { /* sem disco */ }
  }

  nivelAltar(id) { return this.dados.altar[id] || 0; }

  custoAltar(item) {
    const n = this.nivelAltar(item.id);
    return Math.round(item.custo * Math.pow(item.escala || 1, n));
  }

  podeComprar(item) {
    const n = this.nivelAltar(item.id);
    return n < item.niveis && this.dados.essencia >= this.custoAltar(item);
  }

  comprar(item) {
    if (!this.podeComprar(item)) return false;
    this.dados.essencia -= this.custoAltar(item);
    this.dados.altar[item.id] = this.nivelAltar(item.id) + 1;
    this.gravar();
    return true;
  }

  registrar(chave, valor) {
    const r = this.dados.recordes;
    if (valor > (r[chave] || 0)) { r[chave] = valor; return true; }
    return false;
  }

  descobrir(tipo, id) {
    const lista = this.dados.compendio[tipo];
    if (lista && !lista.includes(id)) { lista.push(id); return true; }
    return false;
  }

  conhece(tipo, id) {
    const lista = this.dados.compendio[tipo];
    return !!(lista && lista.includes(id));
  }
}

export const salvar = new Salvar();
