// nivel.js — uma fase rodando: o que existe nela, o que ela atualiza e em
// que ordem ela desenha.
//
// A ORDEM DE DESENHO é metade do visual do jogo, e ela é sempre esta:
//   fundo → cenário de trás → terreno → cenário da frente → plataformas →
//   itens → bichos → ELA → água → partículas → LUZ → interface
// A interface vem depois da luz porque, se vier antes, os corações do canto
// escurecem junto com a floresta e ninguém enxerga a própria vida.

import { VW, VH, clamp, gfx } from '../core/gfx.js';
import { ret, disco, coracao } from '../art/pixel.js';
import { COR } from '../art/paleta.js';
import { T, FRAGIL, desenharTerreno, desenharAgua } from '../world/tiles.js';
import { Fundo } from '../world/ceu.js';
import { Ambiente, Particulas } from '../world/fx.js';
import { Camera } from '../world/camera.js';
import { pecaDecor } from '../world/decor.js';
import { construirFase } from '../world/mapas.js';
import { Jogador, ALT } from './jogador.js';
import { Inimigo, resolverColisao } from './inimigos.js';
import { Item, Checkpoint, Gaiola, Fragil, atualizarMoveis, desenharMovel, desenharMola }
  from './coletaveis.js';
import { Dialogo, CartaAberta, Plaquinha } from './dialogo.js';
import { Companheiro } from './companheiro.js';
import { audio } from '../core/audio.js';
import { RESGATES, NOMES } from '../dados/personalizacao.js';

// Decoração que acende. É o que dá alma à floresta e à cidade à noite.
const DECOR_LUZ = {
  lanterna: { dx: 7, dy: -38, r: 46, cor: '#ffd98a', f: 0.95 },
  poste:    { dx: 20, dy: -52, r: 60, cor: '#ffe4a8', f: 1.0 },
  letreiro: { dx: 16, dy: -14, r: 44, cor: '#ff8ab0', f: 0.7 },
  cogumelo: { dx: 11, dy: -14, r: 26, cor: '#ffb0e0', f: 0.45 },
};

export class Nivel {
  constructor(numero, aparencia, progresso) {
    this.d = construirFase(numero);
    this.numero = numero;
    this.tema = this.d.tema;
    this.nomeTema = this.d.nomeTema;

    this.terreno = desenharTerreno(this.d.mapa, this.tema);
    this.fundo = new Fundo(this.nomeTema, this.tema);
    this.ar = new Ambiente(this.tema);
    this.fx = new Particulas();
    this.cam = new Camera();
    this.cam.definirLimites(this.d.mapa.larguraPx, this.d.mapa.alturaPx);

    this.jogador = new Jogador(aparencia.ela);
    this.jogador.nascer(this.d.inicio.x, this.d.inicio.y);
    this.nascimento = { x: this.d.inicio.x, y: this.d.inicio.y };
    this.cam.irPara(this.jogador.x, this.jogador.y);

    this.companheiro = new Companheiro(aparencia.ele);
    // Ele só aparece andando com ela nas fases seguintes às que ele já foi
    // solto. Na fase 1 ele está preso e não existe fora da gaiola.
    const soltos = Math.min(4, progresso.resgates || 0);
    if (soltos >= numero) {
      this.companheiro.ligar(this.jogador.x - 24, this.jogador.y, soltos / 4);
    } else if (soltos > 0) {
      this.companheiro.ligar(this.jogador.x - 24, this.jogador.y, soltos / 4);
    }

    // o boneco dele DENTRO da gaiola, com a solidez do progresso
    this.presoRig = new Companheiro(aparencia.ele);
    this.presoRig.rig.tocar('flutuando', true);
    this.presoRig.solidez = soltos / 4;
    this.presoRig.solidezAlvo = soltos / 4;

    this.inimigos = this.d.inimigos.map(i => new Inimigo(i));
    this.itens = this.d.itens.map((it, i) => new Item(it, i));
    this.checkpoints = this.d.checkpoints.map(c => new Checkpoint(c));
    this.gaiola = this.d.gaiola ? new Gaiola(this.d.gaiola) : null;

    // nuvens frágeis viram objetos, para poderem sumir e voltar
    this.fragilAtivos = new Map();
    for (let ty = 0; ty < this.d.mapa.a; ty++) {
      for (let tx = 0; tx < this.d.mapa.l; tx++) {
        if (this.d.mapa.em(tx, ty) === FRAGIL) {
          this.fragilAtivos.set(ty * this.d.mapa.l + tx, new Fragil(tx, ty));
        }
      }
    }

    this.dialogo = new Dialogo();
    this.carta = new CartaAberta();
    this.plaquinha = new Plaquinha();
    this.plaquinha.mostrar(this.d.info);

    this.t = 0;
    this.cartas = 0;
    this.coletadas = [];
    this.terminou = false;
    this.saindo = 0;
    this.resgatou = false;
    this.mostrouEntrada = false;
  }

  // acesso que o jogador precisa da fase
  get contexto() {
    return { mapa: this.d.mapa, moveis: this.d.moveis, molas: this.d.molas,
      fragilAtivos: this.fragilAtivos };
  }

  atualizar(dt, entrada, bonecos) {
    this.t += dt;
    this.fundo.atualizar(dt);
    this.plaquinha.atualizar(dt);

    // A carta aberta e o diálogo PARAM o mundo. Ler uma memória com um
    // caranguejo andando atrás tira o peso do texto.
    if (this.carta.ativa) {
      this.carta.atualizar(dt, entrada);
      this.fx.atualizar(dt);
      return;
    }
    if (this.dialogo.ativo) {
      this.dialogo.atualizar(dt, entrada);
      this.jogador.rig.atualizar(dt, { ax: 0, vy: 0 });
      this.presoRig.rig.atualizar(dt, { ax: 0, vy: 0 });
      this.companheiro.atualizar(dt, this.jogador);
      if (this.gaiola) this.gaiola.atualizar(dt);
      this.fx.atualizar(dt);
      return;
    }

    // fala de entrada, uma vez, depois da plaquinha
    if (!this.mostrouEntrada && this.t > 1.2 && this.d.info.entrada) {
      this.mostrouEntrada = true;
      this.dialogo.falar([{ quem: 'ela', nome: NOMES.ela, texto: this.d.info.entrada }]);
      return;
    }

    atualizarMoveis(this.d.moveis, dt);
    for (const f of this.fragilAtivos.values()) f.atualizar(dt, this.d.mapa);
    for (const m of this.d.molas) m.comp = Math.max(0, m.comp - dt * 2.4);

    this.jogador.atualizar(dt, entrada, this.contexto, this.fx);
    this.companheiro.atualizar(dt, this.jogador);
    this.presoRig.rig.atualizar(dt, { ax: 0, vy: 0 });

    for (const i of this.inimigos) {
      i.atualizar(dt, this.d.mapa);
      if (i.vivo) {
        const r = resolverColisao(this.jogador, i, this.fx);
        if (r === 'dano') this.aoPerderVida();
      }
    }

    const caixa = this.jogador.caixa;
    for (const it of this.itens) {
      it.atualizar(dt, this.t);
      if (it.encostou(caixa)) {
        it.pego = true;
        if (it.tipo === 'coracao') {
          audio.coracao();
          this.jogador.corações = Math.min(3, this.jogador.corações + (Math.random() < 0.25 ? 1 : 0));
        } else {
          audio.carta();
          this.cartas++;
          this.coletadas.push(it.memoria.titulo);
          this.carta.abrir(it.memoria);
          this.aoPegarCarta();
        }
      }
    }

    for (const c of this.checkpoints) {
      c.atualizar(dt);
      if (c.encostou(caixa)) {
        c.pego = true;
        this.nascimento = { x: c.x, y: c.y };
        audio.menuConfirma();
        this.fx.brilho(c.x, c.y - 30, 12, ['#ff9db1', '#ffffff']);
      }
    }

    if (this.gaiola) {
      this.gaiola.atualizar(dt);
      if (!this.gaiola.aberta && this.gaiola.encostou(caixa)) {
        this._resgatar();
      }
    }

    if (this.jogador.caiu) this._cair();
    if (this.jogador.morrendo > 0 && this.jogador.morrendo < 0.06) this._renascer();

    this.fx.atualizar(dt);
    this.ar.atualizar(dt, this.cam.x, this.cam.y);
    this.cam.seguir(this.jogador, dt);

    if (this.saindo > 0) this.saindo += dt;
  }

  _resgatar() {
    this.gaiola.abrir(this.fx);
    this.resgatou = true;
    this.jogador.congelada = 6;
    this.jogador.vx = 0;
    this.jogador.rig.tocar('comemorando', true);
    gfx.piscar('#ffffff', 0.55);
    const fala = RESGATES[Math.min(RESGATES.length - 1, this.numero - 1)];
    this.dialogo.falar([
      { quem: 'ela', nome: NOMES.ela, texto: fala.ela },
      { quem: 'ele', nome: NOMES.ele, texto: fala.ele },
    ], () => {
      this.terminou = true;
      this.saindo = 0.001;
      this.fx.confete(this.gaiola.x, this.gaiola.y - 30, 40);
      audio.fanfarra();
    });
  }

  // Caiu na água ou no vazio: perde um coração e volta ao último ponto
  // seguro. Se era o último coração, volta com os três — nunca existe
  // "fim de jogo" nesta história.
  _cair() {
    const j = this.jogador;
    j.caiu = false;
    if (j.invul > 0.9) return;
    audio.dano();
    this.fx.brilho(j.x, j.y, 14, ['#dff4ff', '#8fd8ff', '#ffffff']);
    gfx.tremer(0.5, 0.2);
    const restam = j.corações - 1;
    this._renascer(restam <= 0 ? 3 : restam);
    this.aoPerderVida();
  }

  _renascer(corações = 3) {
    this.jogador.nascer(this.nascimento.x, this.nascimento.y, corações);
    this.cam.irPara(this.jogador.x, this.jogador.y);
    this.companheiro.rastro.length = 0;
    this.companheiro.x = this.jogador.x - 24;
    this.companheiro.y = this.jogador.y;
  }

  aoPerderVida() { if (this.hud) this.hud.avisarVida(); }
  aoPegarCarta() { if (this.hud) this.hud.avisarCarta(); }

  // -------------------------------------------------------------------------
  desenhar(ctx, bonecos) {
    const cx = this.cam.px, cy = this.cam.py;
    this.fundo.desenhar(ctx, cx, cy);

    this._decor(ctx, cx, cy, true);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terreno, -cx, -cy);

    this._decor(ctx, cx, cy, false);

    for (const m of this.d.moveis) desenharMovel(ctx, m, cx, cy, this.tema);
    for (const m of this.d.molas) desenharMola(ctx, m, cx, cy);
    for (const f of this.fragilAtivos.values()) f.desenhar(ctx, cx, cy, this.tema);

    for (const c of this.checkpoints) c.desenhar(ctx, cx, cy, this.t);
    for (const it of this.itens) it.desenhar(ctx, cx, cy, this.t);

    if (this.gaiola) {
      this.gaiola.desenhar(ctx, cx, cy,
        this.gaiola.aberta ? null : this.presoRig.rig);
      if (this.gaiola.aberta && this.resgatou && !this.terminou) {
        // solto: ele fica ao lado dela enquanto os dois conversam
        this.presoRig.rig.tocar('parada');
        this.presoRig.rig.alpha = clamp(0.3 + this.numero * 0.18, 0, 1);
        this.presoRig.rig.desenhar(ctx, this.gaiola.x - cx, this.gaiola.y - cy, -1);
        this.presoRig.rig.alpha = 1;
      }
    }

    for (const i of this.inimigos) i.desenhar(ctx, cx, cy);

    this.companheiro.desenhar(ctx, cx, cy);
    this.jogador.desenhar(ctx, cx, cy);

    desenharAgua(ctx, this.d.mapa, this.tema, cx, cy, this.t);
    this.fx.desenhar(ctx, cx, cy);

    // ---- luz ----
    if (this.tema.ambiente) {
      gfx.luzInicio(this.tema.ambiente);
      this._luzes(cx, cy);
      // 0,5 de halo somava luz demais: com quarenta vaga-lumes na tela o
      // buffer saturava, o multiplicador virava branco e a floresta inteira
      // ficava uma névoa esverdeada sem forma. O halo tem que ser tempero.
      gfx.luzFim(0.18);
    }

    this.ar.desenhar(ctx);
  }

  _luzes(cx, cy) {
    for (const d of this.d.decor) {
      const L = DECOR_LUZ[d.tipo];
      if (!L) continue;
      const x = d.x - cx + L.dx, y = d.y - cy + L.dy;
      if (x < -80 || x > VW + 80) continue;
      const tremula = 0.9 + Math.sin(this.t * 7 + d.x) * 0.08;
      gfx.luz(x, y, L.r, L.cor, L.f * tremula * 0.62);
    }
    for (const i of this.inimigos) i.luz(gfx, cx, cy);
    this.ar.luzes(gfx);
    if (this.gaiola) this.gaiola.luz(gfx, cx, cy);
    // uma luzinha nela, para nunca sumir no escuro
    gfx.luz(this.jogador.x - cx, this.jogador.y - cy - ALT / 2, 48, '#ffe8c8', 0.42);
    for (const it of this.itens) {
      if (it.pego) continue;
      gfx.luz(it.x - cx, it.y - cy, it.tipo === 'carta' ? 26 : 16,
        it.tipo === 'carta' ? '#fff0b8' : '#ffb0c8', it.tipo === 'carta' ? 0.5 : 0.3);
    }
  }

  _decor(ctx, cx, cy, atras) {
    for (const d of this.d.decor) {
      if (!!d.atras !== atras) continue;
      const p = pecaDecor(d.tipo, this.tema, this.nomeTema, d.v);
      if (!p) continue;
      // CONVENÇÃO: o `y` do enfeite é a LINHA DE TILE ONDE ELE PISA, e a
      // peça é desenhada com a base exatamente ali. A primeira versão somava
      // um tile e a floresta inteira ficou plantada um palmo acima do chão.
      const x = Math.round(d.x - cx), y = Math.round(d.y - cy) - p.h;
      if (x + p.w < 0 || x > VW) continue;
      ctx.drawImage(p.c, x, y);
    }
  }

  desenharCaixas(ctx, bonecos) {
    this.plaquinha.desenhar(ctx);
    this.dialogo.desenhar(ctx, bonecos, this.t);
    this.carta.desenhar(ctx);
  }
}

export default Nivel;
