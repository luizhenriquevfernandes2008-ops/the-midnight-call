# Notas do projeto

O que existe, o que foi decidido e por quê, e o que ficou de fora.

## Estado

Jogável do começo ao fim: menu → quatro fases → cena final → menu. O
progresso e a aparência sobrevivem a fechar o navegador. Roda a 60 fps
constantes no Chromium, tanto servido quanto pelo `JOGO_OFFLINE.html`
aberto por `file://`.

## As decisões que mais mudaram o resultado

**A personagem é um objeto de dezoito números, não um desenho.** Foi a
primeira decisão e é a que sustenta o jogo inteiro. Se ela fosse uma folha
de sprites, "deixar parecida com ela" seria um pedido para o autor, não uma
tela do jogo.

**O olho fica a 60% da altura da cabeça, não no meio.** Rosto com olho
centrado lê como adulto. A testa alta é o que faz a cara ser fofa. A
primeira versão tinha o olho na linha 5 e a franja na 1–5: a franja comia o
olho inteiro e a personagem ficava sem rosto.

**A fase é um roteiro, não um bloco de ASCII.** Duzentas e vinte colunas de
texto são impossíveis de conferir: um espaço a mais no meio e a fase
desanda sem que ninguém ache onde.

**Degrau máximo de dois tiles.** O pulo sobe exatamente três. Projetar no
limite significa que só acerta quem sai no pixel certo — um robô de teste
travou cinco minutos no mesmo lugar provando isso.

**Não existe fim de jogo.** Cair custa um coração e devolve ao último ponto
salvo; se era o último coração, ela volta com os três. Bicho nenhum
persegue. É um presente, não uma prova.

## Ferramentas de conferência

Nada disso é parte do jogo; são páginas soltas para olhar coisa isolada.

- `ferramentas/teste-personagem.html` — a personagem em todas as animações,
  e as variações de cabelo, pele, franja e óculos lado a lado.
- `ferramentas/teste-zoom.html` — o mesmo, gigante, para conferir pixel.

Ambas precisam do servidor local (`./abrir_jogo.sh` sem o
`JOGO_OFFLINE.html` presente, ou `python -m http.server`).

## O que ficou de fora, e por quê

- **Chefe de fase.** Um chefe pediria um sistema de vida do inimigo, fases
  de ataque e telegrafia — e mudaria o tom do jogo de "passeio" para
  "prova". A bolha de luz no fim de cada mundo cumpre o papel de marco sem
  virar obstáculo.
- **Segundo jogador.** O rig e a física suportam (o companheiro já anda
  sozinho), mas co-op exige repensar a câmera inteira.
- **Música gravada.** O sequenciador cabe em 500 linhas e o jogo continua
  sendo um arquivo só. Um mp3 de dois minutos por mundo dobraria o tamanho
  do pacote e quebraria a promessa dos dois cliques.
- **Voz.** Mesma razão.

## Ajustes prováveis depois de ela jogar

- Se ela achar difícil: `VEL_CORRER` e `PULO` em `js/systems/jogador.js`.
  Subir o pulo para 380 dá quatro tiles de altura e afrouxa tudo.
- Se ela achar fácil: tirar corações do caminho, não pôr mais bichos.
- Se um trecho travar: as fases estão em `js/world/mapas.js` e cada linha é
  um verbo. Mover uma plataforma é mudar um número.
