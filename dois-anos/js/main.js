// main.js — a máquina de estados e o laço principal.
//
//   BOOT → MENU → JOGO ⇄ PAUSA
//            ├→ EDITOR   (COMO ELA É)
//            ├→ ÁLBUM
//            └→ OPÇÕES
//   JOGO (fase 4 resgatada) → FINAL → MENU
//
// Regra de desenho respeitada em todo estado: mundo primeiro, LUZ no meio,
// interface por último.

import { VW, VH, gfx, clamp, lerp, easeOut } from './core/gfx.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { save, formatarTempo } from './core/save.js';
import { text, limparCacheTexto } from './core/text.js';
import { ret, coracao } from './art/pixel.js';
import { COR } from './art/paleta.js';
import { Boneco } from './art/rig.js';
import { Fundo } from './world/ceu.js';
import { TEMAS } from './world/temas.js';
import { Nivel } from './systems/nivel.js';
import { Final } from './systems/final.js';
import { Titulo, Opcoes } from './ui/menu.js';
import { Editor } from './ui/editor.js';
import { Album } from './ui/album.js';
import { Pausa } from './ui/pausa.js';
import { Hud } from './ui/hud.js';
import { APARENCIA_PADRAO, APARENCIA_ELE_PADRAO, MEMORIAS, NOMES }
  from './dados/personalizacao.js';
import { NUM_FASES } from './world/mapas.js';

function quadro() { return new Promise(r => requestAnimationFrame(() => r())); }

class Jogo {
  constructor() {
    this.estado = 'boot';
    this.fps = 60; this.quadros = 0; this.fpsT = 0;
    this.transicao = null;
    this.tempo = 0;
  }

  async iniciar() {
    const msg = document.getElementById('boot-msg');
    const passo = s => { if (msg) msg.textContent = s; };

    this.opcoes = save.lerOpcoes();
    this.aparencia = save.lerAparencia(APARENCIA_PADRAO, APARENCIA_ELE_PADRAO);
    this.progresso = save.lerProgresso();

    gfx.init();
    input.init();
    this.aplicarOpcoes();

    passo('desenhando vocês dois...');
    await quadro();
    this.retratos = {
      ela: new Boneco(this.aparencia.ela),
      ele: new Boneco(this.aparencia.ele),
    };

    passo('pintando o pôr do sol...');
    await quadro();
    this.fundoMenu = new Fundo('praia', TEMAS.praia);

    passo('separando as memórias...');
    await quadro();
    this.hud = new Hud();
    this.titulo = new Titulo(save.temJogoSalvo());
    this.pausa = new Pausa();
    this.nivel = null;
    this.editor = null;
    this.album = null;
    this.painelOpcoes = null;
    this.final = null;

    document.getElementById('boot').classList.add('sumindo');
    setTimeout(() => { const b = document.getElementById('boot'); if (b) b.hidden = true; }, 700);

    this.estado = 'menu';
    audio.tocarMusica('menu');

    let ultimo = performance.now();
    const laco = (agora) => {
      let dt = (agora - ultimo) / 1000;
      ultimo = agora;
      // Trava de dt: mudar de aba e voltar entrega um dt de 4 segundos, e a
      // personagem atravessaria o mapa inteiro numa integração só.
      if (dt > 0.05) dt = 0.05;
      this.passo(dt);
      requestAnimationFrame(laco);
    };
    requestAnimationFrame(laco);
  }

  aplicarOpcoes() {
    const o = this.opcoes;
    audio.definirVolumes({ geral: o.volume, musica: o.musica, efeitos: o.efeitos });
    gfx.pixelExato = !!o.pixelExato;
    gfx.redimensionar();
    save.gravarOpcoes(o);
  }

  gravarProgresso() {
    save.gravarProgresso(this.progresso);
  }

  // -------------------------------------------------------------------------
  trocar(para, dados) {
    if (this.transicao) return;
    this.transicao = { fase: 'saindo', t: 0, para, dados };
  }

  _aplicarTroca() {
    const { para, dados } = this.transicao;
    if (para === 'jogo') {
      this.nivel = new Nivel(dados.fase, this.aparencia, this.progresso);
      this.nivel.hud = this.hud;
      this.faseAtual = dados.fase;
      audio.tocarMusica(this.nivel.tema.musica);
    } else if (para === 'menu') {
      this.nivel = null;
      this.titulo.reconstruir(save.temJogoSalvo());
      this.titulo.t = 0;
      audio.tocarMusica('menu');
    } else if (para === 'final') {
      this.final = new Final(this.retratos, this.progresso.memorias.length, this.progresso.tempo);
      audio.tocarMusica('final');
    }
    this.estado = para;
  }

  // -------------------------------------------------------------------------
  passo(dt) {
    this.tempo += dt;
    this.quadros++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = this.quadros / this.fpsT; this.quadros = 0; this.fpsT = 0; }

    input.update(dt);
    if (input.qualquerTecla) { audio.garantir(); audio.retomar(); }
    audio.atualizar();

    if (this.transicao) {
      const tr = this.transicao;
      tr.t += dt;
      if (tr.fase === 'saindo') {
        gfx.fade = clamp(tr.t / 0.28, 0, 1);
        if (tr.t >= 0.28) { this._aplicarTroca(); tr.fase = 'entrando'; tr.t = 0; }
      } else {
        gfx.fade = 1 - clamp(tr.t / 0.34, 0, 1);
        if (tr.t >= 0.34) { gfx.fade = 0; this.transicao = null; }
      }
    }

    const travado = !!this.transicao && this.transicao.fase === 'saindo';
    if (!travado) this.atualizar(dt);
    this.desenhar(dt);
    input.flush();
  }

  atualizar(dt) {
    // Os retratos piscam mesmo quando ninguém está olhando: eles aparecem
    // no menu, no diálogo e no final, e um rosto de olho arregalado fixo é
    // exatamente a diferença entre "personagem" e "boneco".
    for (const b of Object.values(this.retratos)) {
      if (this.estado !== 'menu' && this.estado !== 'final') b.atualizar(dt, { ax: 0, vy: 0 });
    }

    switch (this.estado) {
      case 'menu': return this._menu(dt);
      case 'editor': return this._editor(dt);
      case 'album': return this._album(dt);
      case 'opcoes': return this._opcoes(dt);
      case 'jogo': return this._jogo(dt);
      case 'pausa': return this._pausa(dt);
      case 'final': return this._final(dt);
    }
  }

  _menu(dt) {
    this.fundoMenu.atualizar(dt);
    this.titulo.atualizar(dt, input, this.retratos);
    const e = this.titulo.escolha;
    if (!e) return;
    this.titulo.escolha = null;
    if (e === 'novo') {
      this.progresso = { mundo: 1, resgates: 0, memorias: [], tempo: 0, terminou: false, recordes: {} };
      this.gravarProgresso();
      this.trocar('jogo', { fase: 1 });
    } else if (e === 'continuar') {
      this.trocar('jogo', { fase: clamp(this.progresso.mundo, 1, NUM_FASES) });
    } else if (e === 'editor') {
      this.editor = new Editor(this.aparencia);
      this.voltarDoEditor = 'menu';
      this.estado = 'editor';
    } else if (e === 'album') {
      this.album = new Album(this.progresso.memorias);
      this.voltarDoAlbum = 'menu';
      this.estado = 'album';
    } else if (e === 'opcoes') {
      this.painelOpcoes = new Opcoes(this.opcoes);
      this.voltarDasOpcoes = 'menu';
      this.estado = 'opcoes';
    }
  }

  _editor(dt) {
    this.editor.atualizar(dt, input);
    if (this.editor.pronto || this.editor.cancelou) {
      if (this.editor.pronto) {
        this.aparencia = { ela: { ...this.editor.ap.ela }, ele: { ...this.editor.ap.ele } };
        save.gravarAparencia(this.aparencia);
        this.retratos.ela.definirAparencia(this.aparencia.ela);
        this.retratos.ele.definirAparencia(this.aparencia.ele);
        // Trocar a aparência no meio da fase tem que valer na hora — é o
        // uso mais provável do editor: ajustar, ver em jogo, ajustar de novo.
        if (this.nivel) {
          this.nivel.jogador.definirAparencia(this.aparencia.ela);
          this.nivel.companheiro.definirAparencia(this.aparencia.ele);
          this.nivel.presoRig.definirAparencia(this.aparencia.ele);
        }
      }
      this.estado = this.voltarDoEditor || 'menu';
      this.editor = null;
    }
  }

  _album(dt) {
    this.album.atualizar(dt, input);
    if (this.album.sair) { this.estado = this.voltarDoAlbum || 'menu'; this.album = null; }
  }

  _opcoes(dt) {
    this.painelOpcoes.atualizar(dt, input, () => this.aplicarOpcoes());
    if (this.painelOpcoes.sair) {
      this.aplicarOpcoes();
      this.estado = this.voltarDasOpcoes || 'menu';
      this.painelOpcoes = null;
    }
  }

  _jogo(dt) {
    const n = this.nivel;
    if (!n) return;
    this.progresso.tempo += dt;

    if (input.pressed('pause') && !n.dialogo.ativo && !n.carta.ativa) {
      this.pausa.abrir();
      this.estado = 'pausa';
      return;
    }
    if (input.pressed('album') && !n.dialogo.ativo && !n.carta.ativa) {
      this.album = new Album(this.progresso.memorias.concat(n.coletadas));
      this.voltarDoAlbum = 'jogo';
      this.estado = 'album';
      return;
    }

    n.atualizar(dt, input, this.retratos);
    this.hud.atualizar(dt);

    if (n.terminou && n.saindo > 1.6) {
      // guarda o que ela achou nesta fase
      for (const t of n.coletadas) {
        if (!this.progresso.memorias.includes(t)) this.progresso.memorias.push(t);
      }
      this.progresso.resgates = Math.max(this.progresso.resgates, n.numero);
      const prox = n.numero + 1;
      if (prox > NUM_FASES) {
        this.progresso.terminou = true;
        this.progresso.mundo = NUM_FASES;
        this.gravarProgresso();
        this.trocar('final');
      } else {
        this.progresso.mundo = Math.max(this.progresso.mundo, prox);
        this.gravarProgresso();
        this.trocar('jogo', { fase: prox });
      }
    }
  }

  _pausa(dt) {
    this.pausa.atualizar(dt, input);
    const e = this.pausa.escolha;
    if (!e) return;
    this.pausa.escolha = null;
    if (e === 'voltar') this.estado = 'jogo';
    else if (e === 'album') {
      this.album = new Album(this.progresso.memorias.concat(this.nivel ? this.nivel.coletadas : []));
      this.voltarDoAlbum = 'pausa';
      this.estado = 'album';
    } else if (e === 'editor') {
      this.editor = new Editor(this.aparencia);
      this.voltarDoEditor = 'pausa';
      this.estado = 'editor';
    } else if (e === 'refazer') {
      this.trocar('jogo', { fase: this.faseAtual });
    } else if (e === 'menu') {
      this.gravarProgresso();
      this.trocar('menu');
    }
  }

  _final(dt) {
    this.final.atualizar(dt, input);
    for (const b of Object.values(this.retratos)) { /* animados dentro de Final */ }
    if (this.final.pediuSair) {
      this.gravarProgresso();
      this.trocar('menu');
    }
  }

  // -------------------------------------------------------------------------
  desenhar(dt) {
    const s = gfx.s;
    gfx.limpar('#12101c');

    switch (this.estado) {
      case 'menu':
        this.titulo.desenhar(s, this.fundoMenu, this.retratos);
        break;
      case 'editor':
        this.editor.desenhar(s);
        break;
      case 'album':
        if (this.voltarDoAlbum === 'jogo' && this.nivel) this.nivel.desenhar(s, this.retratos);
        else if (this.voltarDoAlbum === 'pausa' && this.nivel) this.nivel.desenhar(s, this.retratos);
        else this.titulo.desenhar(s, this.fundoMenu, this.retratos);
        this.album.desenhar(s);
        break;
      case 'opcoes':
        this.titulo.desenhar(s, this.fundoMenu, this.retratos);
        this.painelOpcoes.desenhar(s);
        break;
      case 'jogo':
      case 'pausa':
        if (this.nivel) {
          this.nivel.desenhar(s, this.retratos);
          this.hud.desenhar(s, this.nivel.jogador, this.cartasTotais(), MEMORIAS.length);
          this.nivel.desenharCaixas(s, this.retratos);
        }
        if (this.estado === 'pausa') {
          this.pausa.desenhar(s, this.nivel && this.nivel.d, this.cartasTotais(), MEMORIAS.length);
        }
        break;
      case 'final':
        this.final.desenhar(s, gfx);
        break;
      default:
        break;
    }

    if (this.debug) this._debug(s);
    gfx.apresentar(dt);
  }

  cartasTotais() {
    const base = this.progresso.memorias.length;
    if (!this.nivel) return base;
    let extra = 0;
    for (const t of this.nivel.coletadas) if (!this.progresso.memorias.includes(t)) extra++;
    return base + extra;
  }

  _debug(s) {
    const linhas = [
      'fps ' + this.fps.toFixed(0),
      'estado ' + this.estado,
    ];
    if (this.nivel) {
      const j = this.nivel.jogador;
      linhas.push(`x ${j.x.toFixed(0)} y ${j.y.toFixed(0)} vx ${j.vx.toFixed(0)} vy ${j.vy.toFixed(0)}`);
      linhas.push(`chao ${j.noChao ? 'sim' : 'nao'} anim ${j.rig.anim}`);
    }
    ret(s, 2, 2, 150, 8 + linhas.length * 10, '#000000aa');
    linhas.forEach((l, i) => text(s, l, 6, 6 + i * 10, { size: 9, color: '#8fff8f' }));
  }
}

const jogo = new Jogo();
// Ganchos de depuração. `jogo` é o que a tela de erro lê para montar o
// relatório; `entrada` existe para que um teste automatizado consiga jogar
// no lugar de uma pessoa, trocando os métodos de leitura do teclado.
window.jogo = jogo;
window.entrada = input;

window.addEventListener('keydown', e => {
  if (e.code === 'F1') { jogo.debug = !jogo.debug; e.preventDefault(); }
});

jogo.iniciar().catch(err => {
  if (window.__crash) window.__crash('O jogo não conseguiu abrir', err && err.stack ? err.stack : String(err));
  else throw err;
});
