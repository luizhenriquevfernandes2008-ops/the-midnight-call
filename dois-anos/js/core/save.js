// save.js — o que sobrevive a fechar o navegador.
//
// Três coisas separadas de propósito:
//   APARENCIA  como ela (e ele) são. Nunca some, nem em "novo jogo" —
//              ninguém quer remontar o rosto da namorada do zero porque
//              recomeçou a fase 1.
//   PROGRESSO  mundo liberado, memórias coletadas, tempo jogado.
//   OPCOES     volume, tela cheia de pixel exato, tremida.
//
// Tudo em localStorage, que é o único armazenamento que funciona com o
// jogo aberto por file:// (dois cliques no arquivo, sem servidor).

const P = 'doisanos.';

function ler(chave, padrao) {
  try {
    const s = localStorage.getItem(P + chave);
    if (!s) return padrao;
    const v = JSON.parse(s);
    return (v && typeof v === 'object') ? v : padrao;
  } catch (e) {
    // Navegador com armazenamento bloqueado, JSON corrompido pela metade:
    // em qualquer dos casos o jogo tem que abrir mesmo assim.
    return padrao;
  }
}

function gravar(chave, valor) {
  try { localStorage.setItem(P + chave, JSON.stringify(valor)); return true; }
  catch (e) { return false; }
}

export const save = {
  lerAparencia(padraoEla, padraoEle) {
    const a = ler('aparencia', null);
    if (!a) return { ela: { ...padraoEla }, ele: { ...padraoEle } };
    return {
      ela: { ...padraoEla, ...(a.ela || {}) },
      ele: { ...padraoEle, ...(a.ele || {}) },
    };
  },
  gravarAparencia(a) { return gravar('aparencia', a); },

  lerProgresso() {
    return ler('progresso', {
      mundo: 1,             // maior mundo já liberado
      resgates: 0,          // quantos pedaços dele já foram soltos
      memorias: [],         // títulos das memórias coletadas
      tempo: 0,
      terminou: false,
      recordes: {},         // mundo -> menor tempo
    });
  },
  gravarProgresso(p) { return gravar('progresso', p); },
  apagarProgresso() {
    try { localStorage.removeItem(P + 'progresso'); } catch (e) { /* tudo bem */ }
  },

  lerOpcoes() {
    return ler('opcoes', {
      volume: 0.75, musica: 0.6, efeitos: 0.85,
      tremida: true, pixelExato: false, mostrarDicas: true,
    });
  },
  gravarOpcoes(o) { return gravar('opcoes', o); },

  temJogoSalvo() {
    const p = ler('progresso', null);
    return !!(p && (p.mundo > 1 || (p.memorias && p.memorias.length) || p.terminou));
  },
};

export function formatarTempo(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

export default save;
