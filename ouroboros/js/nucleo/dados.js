// dados.js — carrega os JSON e deixa tudo indexado por id.
//
// Se um arquivo faltar ou tiver virgula errada, o jogo precisa dizer QUAL
// arquivo. Erro de JSON sem nome de arquivo e meia hora de vida perdida.

const ARQUIVOS = {
  config: 'dados/config.json',
  fases: 'dados/fases.json',
  inimigos: 'dados/inimigos.json',
  chefes: 'dados/chefes.json',
  reliquias: 'dados/reliquias.json',
  melhorias: 'dados/melhorias.json',
  altar: 'dados/altar.json',
  textos: 'dados/textos.json',
  musica: 'dados/musica.json',
};

export const D = {
  carregado: false,
  porId: {},
};

function indexa(lista) {
  const m = {};
  for (const it of lista) m[it.id] = it;
  return m;
}

export async function carregarDados(aoProgresso) {
  const nomes = Object.keys(ARQUIVOS);
  let feitos = 0;
  await Promise.all(nomes.map(async (nome) => {
    const caminho = ARQUIVOS[nome];
    let resp;
    try {
      resp = await fetch(caminho + '?v=' + Date.now(), { cache: 'no-store' });
    } catch (e) {
      throw new Error('Nao consegui buscar ' + caminho + '. O jogo precisa de servidor local — abra pelo ABRIR_OUROBOROS.bat, nao clicando no index.html.');
    }
    if (!resp.ok) throw new Error('Faltou o arquivo ' + caminho + ' (HTTP ' + resp.status + ').');
    try {
      D[nome] = await resp.json();
    } catch (e) {
      throw new Error('O arquivo ' + caminho + ' tem erro de JSON: ' + e.message);
    }
    feitos++;
    if (aoProgresso) aoProgresso(feitos / nomes.length, nome);
  }));

  D.porId.inimigos = indexa(D.inimigos.lista);
  D.porId.chefes = indexa(D.chefes.lista);
  D.porId.reliquias = indexa(D.reliquias.lista);
  D.porId.melhorias = indexa(D.melhorias.lista);
  D.porId.altar = indexa(D.altar.lista);
  D.porId.andares = indexa(D.fases.andares);
  D.carregado = true;
  return D;
}
