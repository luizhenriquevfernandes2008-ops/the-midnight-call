// personalizacao.js — O ÚNICO ARQUIVO QUE VOCÊ PRECISA EDITAR.
//
// Tudo que é de vocês dois mora aqui: os nomes, a data, as memórias que
// viram cartas espalhadas pelas fases, o que ela diz em cada resgate e a
// carta do final. O resto do jogo lê daqui e se ajusta sozinho — trocar
// um nome não quebra nada, trocar o número de memórias também não.
//
// Abra este arquivo num editor de texto qualquer (Bloco de Notas serve),
// troque o que está entre aspas, salve, e rode
//     python ferramentas/gerar_offline.py
// para o JOGO_OFFLINE.html sair atualizado.

export const NOMES = {
  // Ela: a personagem que se joga.
  ela: 'Você',
  // Você: quem ela vai buscar no fim de cada mundo.
  ele: 'Eu',
  // Como o jogo se chama na tela de título. Duas linhas — a de baixo é
  // menor, serve de subtítulo.
  titulo: 'DOIS ANOS',
  subtitulo: 'uma história em quatro mundos',
};

export const DATAS = {
  // Quando começou. Formato livre: aparece escrito na tela final.
  inicio: '21 de agosto',
  anos: 2,
};

// ---------------------------------------------------------------------------
// AS MEMÓRIAS
// ---------------------------------------------------------------------------
// Cada carta espalhada pelas fases abre uma destas. `mundo` diz em qual das
// quatro fases ela aparece (1 a 4). Pode ter quantas quiser em cada mundo —
// o jogo distribui as cartas do mundo pelos pontos de coleta na ordem em que
// estão aqui, e se sobrarem pontos de coleta ele não coloca carta neles.
//
// `titulo` é curto (cabe em uma linha). `texto` pode ter até umas 4 linhas;
// use \n para quebrar onde você quiser.

export const MEMORIAS = [
  // ---- Mundo 1: a praia, onde tudo começou ----
  {
    mundo: 1,
    titulo: 'O primeiro oi',
    texto: 'Eu ensaiei a frase umas quinze vezes\ne no fim falei outra coisa completamente.\nDeu certo mesmo assim.',
  },
  {
    mundo: 1,
    titulo: 'A primeira risada',
    texto: 'Não foi nem tão engraçado assim.\nMas você riu, e eu decidi ali\nque ia querer ouvir isso muitas vezes.',
  },
  {
    mundo: 1,
    titulo: 'O dia que demorou',
    texto: 'A gente ficou conversando até\na bateria de um dos dois acabar.\nFoi a minha. Fiquei bravo com o celular.',
  },
  {
    mundo: 1,
    titulo: 'O sim',
    texto: 'Eu perguntei com a voz tremendo.\nVocê respondeu antes de eu terminar.',
  },

  // ---- Mundo 2: a floresta dos vaga-lumes ----
  {
    mundo: 2,
    titulo: 'O nosso lugar',
    texto: 'Todo casal tem um canto que é só dele.\nO nosso não é bonito pra ninguém.\nPra gente é o melhor lugar do mundo.',
  },
  {
    mundo: 2,
    titulo: 'A piada que só a gente entende',
    texto: 'Se eu escrever aqui, ninguém entende.\nSe eu falar, você já começa a rir\nantes do fim da frase.',
  },
  {
    mundo: 2,
    titulo: 'A madrugada',
    texto: 'Três da manhã, os dois acordados,\nfalando de nada importante.\nEu não trocaria aquilo por dormir.',
  },
  {
    mundo: 2,
    titulo: 'Quando eu não estava bem',
    texto: 'Você não tentou resolver.\nVocê só ficou. E era exatamente\nisso que eu precisava.',
  },

  // ---- Mundo 3: a cidade na chuva ----
  {
    mundo: 3,
    titulo: 'A briga boba',
    texto: 'Nem lembro do motivo.\nLembro que a gente voltou a conversar\nporque nenhum dos dois aguentou o silêncio.',
  },
  {
    mundo: 3,
    titulo: 'A distância',
    texto: 'Teve semana que foi difícil.\nA gente atravessou. E do outro lado\nera a mesma coisa, só que mais firme.',
  },
  {
    mundo: 3,
    titulo: 'O guarda-chuva',
    texto: 'Um guarda-chuva pra dois\nnunca cobre os dois.\nA gente ficou molhado igual e riu.',
  },
  {
    mundo: 3,
    titulo: 'A comida',
    texto: 'Aquele lugar que a gente sempre volta.\nEu já sei o seu pedido de cor,\ne finjo perguntar mesmo assim.',
  },

  // ---- Mundo 4: o céu ----
  {
    mundo: 4,
    titulo: 'O plano',
    texto: 'A gente já falou sobre a casa,\nsobre a viagem, sobre o cachorro.\nEu falo sério em todos.',
  },
  {
    mundo: 4,
    titulo: 'O jeito que você dorme',
    texto: 'Você fala dormindo, coisas sem sentido.\nEu respondo. Você continua.\nÉ a conversa mais engraçada que a gente tem.',
  },
  {
    mundo: 4,
    titulo: 'Dois anos',
    texto: 'Setecentos e tantos dias.\nNão deu pra guardar todos.\nGuardei os suficientes.',
  },
  {
    mundo: 4,
    titulo: 'O resto',
    texto: 'Isso aqui não é o fim de nada.\nÉ só o pedaço que já deu tempo de contar.',
  },
];

// ---------------------------------------------------------------------------
// OS QUATRO MUNDOS
// ---------------------------------------------------------------------------
// O nome que aparece na plaquinha quando a fase começa, e a frase que ela
// pensa ao entrar. O tema visual é fixo por mundo (praia, floresta, cidade,
// céu) — o que dá pra trocar aqui é o texto.

export const MUNDOS = [
  {
    nome: 'A PRAIA',
    legenda: 'onde a gente se conheceu',
    entrada: 'Eu lembro deste lugar. Foi aqui que tudo começou.',
  },
  {
    nome: 'A FLORESTA',
    legenda: 'as noites que ninguém viu',
    entrada: 'Está escuro. Mas eu conheço o caminho de cor.',
  },
  {
    nome: 'A CIDADE',
    legenda: 'o que a gente atravessou',
    entrada: 'Chovia assim naquele dia. E a gente continuou andando.',
  },
  {
    nome: 'O CÉU',
    legenda: 'o que ainda vem',
    entrada: 'Daqui dá pra ver tudo. E ainda tem muito chão pela frente.',
  },
];

// O que ela diz ao abrir a gaiola de luz no fim de cada mundo. Um par de
// falas por mundo: a dela primeiro, a dele depois.
export const RESGATES = [
  {
    ela: 'Achei você.',
    ele: 'Eu sabia que você vinha.',
  },
  {
    ela: 'Você some e some, hein.',
    ele: 'E você vem e vem.',
  },
  {
    ela: 'Está quase inteiro.',
    ele: 'Falta um pedaço. Está lá em cima.',
  },
  {
    ela: 'Pronto. Agora você fica.',
    ele: 'Agora eu fico.',
  },
];

// A carta do final. Cada string é um parágrafo, e o jogo digita uma linha
// por vez. Escreva à vontade — a tela rola sozinha.
export const CARTA_FINAL = [
  'Eu não sei fazer bolo e não sei escrever poema.',
  'Sei fazer isso aqui.',
  'Então eu passei um tempão desenhando você pixel por pixel',
  'pra poder te dizer, de um jeito que ninguém mais diria:',
  'obrigado pelos dois anos.',
  'E pelos que vêm.',
];

// ---------------------------------------------------------------------------
// A APARÊNCIA DELA
// ---------------------------------------------------------------------------
// Este é só o ponto de partida. Dentro do jogo tem um editor completo
// (menu -> "COMO ELA É") onde você ajusta tudo olhando na tela, e o que
// você salvar lá manda mais que este arquivo.
//
// Se quiser começar mais perto, mexa nos números aqui. Cada campo diz o
// intervalo válido em comentário.

export const APARENCIA_PADRAO = {
  pele: 3,          // 0..6   do mais claro ao mais escuro
  cabeloCor: 1,     // 0..9   0 preto, 1 castanho escuro, 2 castanho, 3 mel, 4 loiro...
  cabeloEstilo: 3,  // 0..7   0 curto, 1 chanel, 2 médio, 3 longo, 4 longo cacheado,
                    //        5 rabo de cavalo, 6 coque, 7 trança
  franja: 1,        // 0..3   0 sem franja, 1 reta, 2 lateral, 3 cortina
  olhoCor: 1,       // 0..7   0 castanho escuro, 1 castanho, 2 mel, 3 verde, 4 azul...
  olhoForma: 0,     // 0..2   0 redondo, 1 amendoado, 2 grande
  sobrancelha: 1,   // 0..2   0 fina, 1 média, 2 marcada
  boca: 0,          // 0..2   0 sorriso, 1 discreto, 2 aberto
  sardas: 0,        // 0..1
  blush: 1,         // 0..1
  oculos: 0,        // 0..3   0 nenhum, 1 redondo, 2 retangular, 3 de sol
  brinco: 1,        // 0..2   0 nenhum, 1 argola, 2 pingente
  enfeite: 0,       // 0..3   0 nenhum, 1 laço, 2 tiara, 3 presilha
  roupa: 1,         // 0..3   0 camiseta e shorts, 1 vestido, 2 blusa e calça, 3 jardineira
  corCima: 4,       // 0..9   cor da parte de cima / do vestido
  corBaixo: 6,      // 0..9   cor da saia, shorts ou calça
  corSapato: 0,     // 0..5
  altura: 1,        // 0..2   0 baixinha, 1 média, 2 alta
};

// A aparência dele, no mesmo espírito (também editável no jogo).
export const APARENCIA_ELE_PADRAO = {
  pele: 2,
  cabeloCor: 0,
  cabeloEstilo: 0,
  franja: 2,
  olhoCor: 0,
  olhoForma: 1,
  sobrancelha: 2,
  boca: 1,
  sardas: 0,
  blush: 0,
  oculos: 0,
  brinco: 0,
  enfeite: 0,
  roupa: 2,
  corCima: 7,
  corBaixo: 8,
  corSapato: 1,
  altura: 2,
};

export function memoriasDoMundo(n) {
  return MEMORIAS.filter(m => m.mundo === n);
}
