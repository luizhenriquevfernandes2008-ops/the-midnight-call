# Dois Anos

Um jogo de plataforma 2D feito de presente de dois anos de namoro.
Ela é a personagem jogável; ele foi parar, em pedaços, no fim de quatro
mundos. Pelo caminho há dezesseis cartas, e cada uma é uma memória.

Construído do zero em HTML5 Canvas — sem engine, sem build, sem
dependência nenhuma. Mesma stack do
[The Midnight Call](../README.md), com o clima virado do avesso: em vez
de noite suja e luz quase preta, cor saturada e fim de tarde.

---

## Rodando

**Clique duas vezes em `JOGO_OFFLINE.html`.** Sem servidor, sem Python,
sem internet, sem instalar nada. Qualquer navegador, qualquer máquina.

Esse arquivo é o jogo inteiro empacotado num HTML só. O código-fonte é
escrito em módulos ES, que navegador nenhum carrega por `file://`, então
`ferramentas/gerar_offline.py` junta os 31 módulos num arquivo com um
registro mínimo. Cada módulo mantém o próprio escopo — o que importa,
porque `pixel.js` e `ceu.js` exportam os dois um `disco`.

**Para desenvolver**, rode `ABRIR_JOGO.bat` (Windows) ou
`./abrir_jogo.sh`. Aí é editar um arquivo em `js/` e apertar F5.
Depois, regere o pacote:

```
python ferramentas/gerar_offline.py
```

## Controles

| Tecla | Ação |
|---|---|
| `←` `→` ou `A` `D` | Andar |
| `Espaço` / `Z` | Pular — **segurar pula mais alto** |
| `Shift` / `X` | Correr |
| `↓` | Agachar |
| `Tab` | Álbum das memórias |
| `Esc` | Pausa |
| `Enter` | Confirmar, passar fala |
| `F1` | Números de depuração |

Controle de videogame funciona (mapeamento padrão).

## Os dois arquivos que você vai querer abrir

**`js/dados/personalizacao.js`** — tudo que é de vocês dois: os nomes, a
data, as dezesseis memórias, as falas de cada resgate, a carta do final.
Só texto entre aspas. Trocar o número de memórias não quebra nada: o jogo
distribui as que existirem pelos pontos de coleta e converte o que sobrar
em coração.

**O editor dentro do jogo** (menu → `COMO ELA É`) — dezoito campos que
montam a personagem. Salva em `localStorage` e vale para o jogo todo:
retrato de diálogo, tela de título, cena final. `Tab` troca para editar
ele, `R` sorteia.

## O que é interessante aqui, tecnicamente

- **A personagem é montada em tempo de execução, não desenhada.**
  Não existe folha de sprites. `art/pessoa.js` recebe um objeto com
  dezoito números e monta ~40 imagens minúsculas onde cada caractere da
  grade é um *papel* (`S` = pele base, `h` = cabelo base), e o mapa que
  traduz papel em cor nasce da aparência escolhida. Trocar castanho por
  ruivo troca os três tons juntos e o volume do desenho continua de pé.
- **O boneco é um esqueleto articulado.** `art/rig.js` interpola
  poses-chave, então a animação roda a 60 fps de verdade e trocar o
  cabelo não obriga a redesenhar quarenta quadros. O cabelo longo balança
  numa mola presa à aceleração dela.
- **Nenhum arquivo de som.** As quatro músicas, os passos, o pulo, a
  moeda e os fogos são osciladores criados na hora em WebAudio. A música
  é um sequenciador de passos com agendamento antecipado, para não tremer
  quando o navegador engasga num quadro.
- **Nenhum arquivo de fonte.** O texto é desenhado com uma fonte do
  sistema e tem o canal alpha cortado a seco, o que devolve borda dura de
  fonte bitmap com acento e cedilha funcionando.
- **As fases são um roteiro, não um bloco de ASCII.** `world/mapas.js`
  tem verbos — `chao()`, `plat()`, `mola()`, `inimigo()` — e cada fase se
  lê de cima para baixo na ordem em que é jogada.
- **O terreno é desenhado uma vez.** A fase inteira vira um canvas no
  carregamento; por quadro o jogo recorta o pedaço visível. Cinco
  megabytes de memória em troca de um `drawImage` e de poder ter detalhe
  por tile.
- **Ele fica mais sólido a cada resgate.** O companheiro não tem física:
  ele anda por cima do rastro dela, sempre 26 pixels atrás. Isso resolve
  de graça o problema difícil (nunca prende numa quina, nunca cai) e
  resolve bonito o fácil (ele pula onde ela pulou, com atraso).

## Como é gentil de propósito

Não existe fim de jogo. Cair na água ou no vazio custa um coração e
devolve ao último ponto salvo; se era o último coração, ela volta com os
três. Bicho nenhum persegue — todos andam num trecho fixo em volta de
onde nasceram. O pisão tem margem generosa. Tem tempo de coiote e pulo na
fila.

É um presente, não uma prova.

## Layout

```
index.html                shell + tela de erro copiável
js/core/                  imagem, entrada, texto, save, áudio
js/art/                   paleta, ferramentas de pixel, a personagem, o rig
js/world/                 temas, tiles, paralaxe, cenário, as quatro fases
js/systems/               jogador, bichos, coletáveis, diálogo, fase, final
js/ui/                    menu, editor de aparência, HUD, álbum, pausa
js/dados/personalizacao.js  <- os nomes, as datas, as memórias
ferramentas/gerar_offline.py  empacotador
```
