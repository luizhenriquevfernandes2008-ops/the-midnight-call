// main.js — o fio que liga tudo: carrega dados, sobe as tres camadas de
// tela, e alterna entre o menu 3D e a corrida.
//
// As tres camadas, de tras para frente:
//   #jogo    canvas 2D — a arena, os bichos, a cobra (e o fundo do menu)
//   #cena3d  WebGL     — o menu, o titulo, o anel, as cartas de recompensa
//   #frente  canvas 2D — HUD, avisos e as telas de pausa/morte
//
// O 3D fica NO MEIO de propria: assim as cartas de reliquia flutuam por
// cima da arena, e o HUD continua legivel por cima das cartas.

import { gfx, limpar, acabamento, texto, quebraTexto } from './nucleo/gfx.js';
import { entrada } from './nucleo/entrada.js';
import { audio } from './nucleo/audio.js';
import { salvar } from './nucleo/salvar.js';
import { carregarDados, D } from './nucleo/dados.js';
import { motor } from './tres/motor3d.js';
import { menu3d } from './tres/cena-menu.js';
import { cartas3d } from './tres/cena-cartas.js';
import { Jogo } from './jogo/jogo.js';
import { limita } from './nucleo/util.js';

const app = {
  estado: 'carregando',
  jogo: null,
  tempo: 0,
  ultimo: 0,
  fps: 60,
  som: false,
  temWebGL: false,
  aviso3d: '',
};

// Exposto de proposito: F1 mostra o estado, e o console do navegador vira
// ferramenta de diagnostico ("por que este chefe travou?") sem precisar de
// build de depuracao separado.
window.ouroboros = app;
app.entrada = entrada;
app.audio = audio;
app.salvar = salvar;
app.menu3d = menu3d;
app.cartas3d = cartas3d;
app.dados = D;

function bootMsg(txt) {
  const el = document.getElementById('boot-msg');
  if (el) el.textContent = txt;
}

async function comecar() {
  const telaJogo = document.getElementById('jogo');
  const tela3d = document.getElementById('cena3d');
  const telaFrente = document.getElementById('frente');

  gfx.iniciar(telaJogo, telaFrente, tela3d);
  entrada.iniciar();
  salvar.carregar();

  bootMsg('lendo os ossos...');
  await carregarDados((p, nome) => bootMsg('lendo ' + nome + '... ' + Math.round(p * 100) + '%'));

  bootMsg('acendendo o poco...');
  app.temWebGL = motor.iniciar(tela3d);
  if (!app.temWebGL) {
    app.aviso3d = 'Seu navegador nao deu WebGL: o menu vai rodar em 2D. O jogo funciona igual.';
    tela3d.style.display = 'none';
  }
  gfx.aoRedimensionar = () => { if (app.temWebGL) motor.redimensionar(); };

  // volumes salvos
  audio.carregarDados(D.musica);
  const o = salvar.dados.opcoes;
  audio.vol.mestre = o.mestre; audio.vol.musica = o.musica; audio.vol.efeitos = o.efeitos;
  audio.mudo = !!o.mudo;

  if (app.temWebGL) menu3d.iniciar();
  menu3d.acao = (acao, dados) => {
    if (acao === 'jogar') iniciarCorrida(dados.andar || 0);
  };

  app.jogo = new Jogo();
  app.jogo.aoSair = () => voltarAoMenu();

  const boot = document.getElementById('boot');
  if (boot) boot.hidden = true;
  app.estado = 'menu';
  app.ultimo = performance.now();
  requestAnimationFrame(laco);
}

function acordarSom() {
  if (app.som) return;
  if (!audio.iniciar()) return;
  audio.retomar();
  const o = salvar.dados.opcoes;
  audio.definirVolume('mestre', o.mestre);
  audio.definirVolume('musica', o.musica);
  audio.definirVolume('efeitos', o.efeitos);
  app.som = true;
  if (app.estado === 'menu') audio.musica('menu');
}

function iniciarCorrida(andar) {
  app.jogo.iniciar({ andar });
  app.estado = 'jogo';
  document.body.classList.add('jogando');
}

function voltarAoMenu() {
  app.estado = 'menu';
  document.body.classList.remove('jogando');
  menu3d.andarEscolhido = Math.min(menu3d.andarEscolhido, salvar.dados.andarLiberado || 0);
  menu3d.abrir('principal', true);
  audio.musica('menu');
  audio.definirIntensidade(0.5);
}

function laco(agora) {
  requestAnimationFrame(laco);
  let dt = (agora - app.ultimo) / 1000;
  app.ultimo = agora;
  if (dt > 0.05) dt = 0.05;          // aba em segundo plano nao teleporta a cobra
  app.tempo += dt;
  app.fps = app.fps * 0.92 + (1 / Math.max(0.001, dt)) * 0.08;

  if (entrada.qualquerTecla || entrada.cliques.length) acordarSom();
  if (entrada.nova('mudo')) {
    const m = audio.alternarMudo();
    salvar.dados.opcoes.mudo = m;
    salvar.gravar();
  }

  const ctx = gfx.ctx, frente = gfx.frente;

  if (app.estado === 'menu') {
    menu3d.atualizar(dt);
    menu3d.fundo2D(ctx);
    if (app.temWebGL) menu3d.desenhar();
    limpar(frente, null);
    overlayMenu(frente);
    acabamento(frente, 0.55 * (salvar.dados.opcoes.grao ?? 1), 0);
  } else if (app.estado === 'jogo') {
    app.jogo.atualizar(dt);
    app.jogo.desenhar(ctx, frente);
    if (app.temWebGL) {
      if (app.jogo.estado === 'recompensa') cartas3d.desenhar();
      else motor.comecar(true);      // limpa a camada 3D quando ela nao serve
    }
  }

  if (entrada.nova('depurar')) app.depurar = !app.depurar;
  if (app.depurar) desenharDepuracao(frente);

  entrada.fimDoQuadro();
}

function overlayMenu(ctx) {
  const s = salvar.dados;
  const t = app.tempo;

  // canto superior direito: o que sobrou das outras vidas
  texto(ctx, s.essencia + ' DE ESSENCIA', 936, 26, {
    tam: 13, cor: 'rgba(240,200,140,0.8)', alinha: 'direita', espaco: 2,
  });
  if (s.recordes.corridas > 0) {
    texto(ctx, s.recordes.corridas + ' descidas   ·   ' + s.recordes.vitorias + ' voltas',
      936, 46, { tam: 11, cor: 'rgba(170,160,150,0.6)', alinha: 'direita', espaco: 1 });
    texto(ctx, 'mais fundo: andar ' + s.recordes.maiorAndar + '   ·   maior corpo: ' + s.recordes.maiorCorpo,
      936, 62, { tam: 11, cor: 'rgba(170,160,150,0.5)', alinha: 'direita', espaco: 1 });
  }

  texto(ctx, D.textos.jogo.subtitulo, 480, 500, {
    tam: 13, tipo: 'titulo', cor: 'rgba(200,180,175,' + (0.45 + 0.12 * Math.sin(t * 0.9)) + ')',
    alinha: 'centro', espaco: 3,
  });

  if (!app.som) {
    texto(ctx, 'clique em qualquer lugar para acordar o som', 480, 522, {
      tam: 12, cor: 'rgba(255,150,150,' + (0.4 + 0.35 * Math.sin(t * 3)) + ')', alinha: 'centro', espaco: 1,
    });
  } else {
    texto(ctx, 'setas ou mouse   ·   ENTER escolhe   ·   M tira o som', 480, 522, {
      tam: 11, cor: 'rgba(150,140,140,0.45)', alinha: 'centro', espaco: 1,
    });
  }

  if (menu3d.avisoTempo > 0) {
    ctx.save();
    ctx.globalAlpha = limita(menu3d.avisoTempo, 0, 1);
    texto(ctx, menu3d.aviso, 480, 470, {
      tam: 15, cor: '#ffd8a0', alinha: 'centro', espaco: 1, sombra: 10,
    });
    ctx.restore();
  }

  if (app.aviso3d) {
    const linhas = quebraTexto(ctx, app.aviso3d, 520, { tam: 12 });
    linhas.forEach((l, i) => texto(ctx, l, 24, 500 + i * 16, {
      tam: 12, cor: 'rgba(255,180,140,0.6)', espaco: 1,
    }));
  }

  // sem WebGL o menu vira lista simples, mas continua jogavel
  if (!app.temWebGL) desenharMenuSimples(ctx);
}

function desenharMenuSimples(ctx) {
  texto(ctx, D.textos.jogo.titulo, 480, 120, {
    tam: 64, tipo: 'titulo', peso: 'bold', cor: '#f0e0c8', alinha: 'centro',
    espaco: 12, sombra: 30, corSombra: 'rgba(255,40,80,0.9)',
  });
  menu3d.itens.forEach((p, i) => {
    const sel = menu3d.itens[menu3d.indice] === p;
    const y = 230 + i * 42;
    p.cantos = [
      { x: 300, y: y - 18 }, { x: 660, y: y - 18 },
      { x: 660, y: y + 18 }, { x: 300, y: y + 18 },
    ];
    texto(ctx, p.rotulo, 480, y, {
      tam: sel ? 24 : 20, tipo: 'titulo', peso: sel ? 'bold' : 'normal',
      cor: sel ? '#ffd0b0' : 'rgba(190,175,160,0.7)', alinha: 'centro', espaco: 4,
    });
  });
}

function desenharDepuracao(ctx) {
  const j = app.jogo;
  const linhas = [
    'fps ' + app.fps.toFixed(0),
    'estado ' + app.estado + (j ? ' / ' + j.estado : ''),
  ];
  if (j && app.estado === 'jogo') {
    linhas.push('bichos ' + j.inimigos.length + '  tiros ' + j.projeteis.length + '  itens ' + j.itens.length);
    linhas.push('corpo ' + j.cobra.comprimento + '  vida ' + j.cobra.vida + '/' + j.cobra.vidaMax);
    linhas.push('semente ' + j.corrida.semente);
    linhas.push('particulas ' + j.fx.particulas.length);
  }
  linhas.forEach((l, i) => texto(ctx, l, 12, 200 + i * 15, {
    tam: 12, cor: 'rgba(140,255,180,0.85)', espaco: 0,
  }));
}

window.addEventListener('DOMContentLoaded', () => {
  comecar().catch((e) => {
    console.error(e);
    if (window.__falhou) window.__falhou('Nao consegui abrir o jogo.', e.message + '\n' + (e.stack || ''));
  });
});
