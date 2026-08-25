# OUROBOROS

*roguelike da serpente* — um jogo da cobrinha que virou roguelike de masmorra:
seis circulos, chefes com fases, reliquias, maldicoes e uma mecanica que so
existe porque o personagem e uma cobra.

Escrito do zero em HTML, JavaScript e JSON. Sem engine, sem biblioteca, sem
build, sem um unico arquivo de imagem ou de audio.

---

## Rodando

**Windows:** `ABRIR_OUROBOROS.bat`  ·  **Linux/macOS:** `./abrir_ouroboros.sh`

Sobe um servidor local (`servidor.py`, porta 8140) e abre o navegador. Nao
abra o `index.html` direto: o jogo usa modulos ES, e navegador bloqueia
modulo em `file://`.

O servidor manda `Cache-Control: no-store` — editar um arquivo em `js/` e
apertar F5 ja mostra a mudanca.

## A ideia

Snake tem uma regra: encostar em si mesmo mata. Isso e uma regra de arcade,
nao de roguelike — roguelike precisa que o erro custe alguma coisa e a
partida continue. Entao a regra virou tres:

- **Constricao.** Se o corpo fecha um espaco (com ele mesmo ou usando
  parede), tudo preso la dentro e esmagado. Nao ha botao para isso: e
  consequencia de como voce andou. Custa um segmento por aperto.
- **Severacao.** Bater no proprio corpo arranca a cauda a partir do ponto da
  batida. Os pedacos caem como alma e podem ser recolhidos.
- **Comprimento e recurso.** Corpo grande cerca melhor e alimenta reliquias
  como o Pacto da Cauda (+1 de dano a cada 10 segmentos), mas fecha as suas
  proprias saidas.

Em cima disso: vida, folego (bote e cuspe), furia, niveis, 30 reliquias, 18
melhorias, 14 bichos com comportamento proprio e 6 chefes.

## O que e interessante tecnicamente

- **O menu e uma cena 3D de verdade**, em WebGL escrito na mao: matriz 4x4
  propria (`js/tres/matriz.js`), um shader com luz direcional, luz de borda e
  nevoa, e nuvem de pontos para brasa. As opcoes sao placas de pedra que
  respondem com mola — passar o mouse empurra a placa para a frente, inclina
  em direcao ao cursor e solta faisca; clicar afunda e devolve com pancada.
- **Nao existe fonte 3D.** O titulo e desenhado num canvas 2D e aplicado em
  sete placas empilhadas em Z: da extrusao com lado que pega luz, ao custo de
  dois triangulos por camada.
- **Nao existe arquivo de audio.** Efeitos sao osciladores e ruido filtrado.
  A musica e um sequenciador com lookahead de 150ms (setTimeout erra dezenas
  de milissegundos; o relogio do WebAudio nao erra) tocando dez faixas cujas
  receitas — bpm, escala, progressao, quais camadas entram — estao em
  `dados/musica.json`. A intensidade sobe com o perigo da sala.
- **Constricao e um flood fill.** As celulas livres formam um grafo conexo por
  construcao; qualquer componente extra so pode ter sido criado pelo corpo da
  cobra. O maior componente e o lado de fora, o resto esta cercado. 544
  celulas por passo — barato.
- **A arena e desenhada uma vez** num buffer quando a sala nasce. Chao, veio de
  pedra, sombra projetada e volume de parede sao milhares de retangulos
  semeados; so o que anda em cima e redesenhado a 60 fps.
- **Todo conteudo e JSON.** Andar, bicho, chefe, reliquia, melhoria, altar,
  texto e musica. Dava para fazer outro jogo sem abrir um arquivo `.js`.

## Layout

```
index.html            as tres camadas de tela e a rede de seguranca de erro
dados/*.json          todo o conteudo: fases, bichos, chefes, itens, musica
js/nucleo/            canvas, entrada, audio sintetizado, save, utilidades
js/tres/              motor WebGL, matrizes, texturas de texto, menu, cartas
js/jogo/              arena, cobra, bichos, chefes, constricao, corrida, laco
js/ui/                HUD, telas de pausa/morte/vitoria, icones vetoriais
servidor.py           servidor local sem cache, procura porta livre
```

## Camadas de tela

Tres canvas empilhados, e a ordem importa:

| camada | o que desenha |
|---|---|
| `#jogo` (2D) | arena, bichos, cobra — e o fundo do menu |
| `#cena3d` (WebGL) | menu, titulo, anel, cartas de recompensa |
| `#frente` (2D) | HUD, avisos, pausa, morte |

O 3D fica no meio de proposito: as cartas de reliquia flutuam por cima da
arena, e o HUD continua legivel por cima das cartas.

Sem WebGL o jogo nao quebra — o menu cai para uma lista 2D e a partida roda
igual.

## Os seis circulos

| # | andar | chefe |
|---|---|---|
| I | A Cripta | A Mae dos Ovos |
| II | O Charco | O Afogado |
| III | A Forja | O Ferreiro Cego |
| IV | O Ninho | O Enxame |
| V | O Silencio | O Ceifador |
| VI | Ouroboros | Ouroboros — a serpente que refaz o seu caminho |
