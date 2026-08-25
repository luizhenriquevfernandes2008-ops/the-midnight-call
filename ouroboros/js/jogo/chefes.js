// chefes.js — os seis donos dos circulos.
//
// Cada ataque e uma acao com tres tempos: AVISO (o telegrafo que da ao
// jogador a chance de sair), EFEITO (o instante em que machuca) e SOBRA (o
// tempo em que o chefe fica exposto). Chefe sem o terceiro tempo e chefe
// injusto — e onde a constricao entra: e na sobra que voce cerca ele.
//
// A fase e decidida pela vida restante e vem do JSON: intervalo entre
// ataques e a lista do que ele pode fazer mudam conforme apanha.

import { TAU, limita, distGrade, dist, sorteia, chance } from '../nucleo/util.js';
import { luz, sombraChao, CONTORNO } from '../arte/pincel.js';

export class Chefe {
  constructor(def, jogo) {
    this.def = def;
    this.id = def.id;
    this.jogo = jogo;
    this.p = def.parametros || {};
    this.tamanho = def.tamanho || 3;
    this.vidaMax = def.vida;
    this.vida = def.vida;
    this.morto = false;
    this.flash = 0;
    this.tempo = 0;
    this.acao = null;
    this.proximoAtaque = 2200;
    this.fase = 0;
    this.disperso = 0;
    this.invisivel = 0;
    this.feixe = null;
    this.onda = null;
    this.carga = null;
    this.corpo = null;          // so o Ouroboros usa
    this.filaEspelho = [];
    this.acumulado = 0;
    this.intervaloPasso = 420;

    const arena = jogo.arena;
    this.cx = arena.cols - 7;
    this.cy = (arena.rows / 2) | 0;
    this.ax = this.cx; this.ay = this.cy;
    this.progresso = 1;

    if (this.id === 'ouroboros') this.nascerSerpente(jogo);
  }

  nascerSerpente(jogo) {
    const n = this.p.comprimentoInicial || 12;
    this.corpo = [];
    for (let i = 0; i < n; i++) {
      this.corpo.push({ cx: limita(this.cx + i, 1, jogo.arena.cols - 2), cy: this.cy, ax: this.cx + i, ay: this.cy });
    }
    this.dir = { x: -1, y: 0 };
    this.intervaloPasso = this.p.passo || 130;
    this.tamanho = 1;
  }

  posicao(arena) {
    return {
      x: arena.px(this.ax) + (arena.px(this.cx) - arena.px(this.ax)) * this.progresso,
      y: arena.py(this.ay) + (arena.py(this.cy) - arena.py(this.ay)) * this.progresso,
    };
  }

  ocupa(cx, cy) {
    if (this.id === 'ouroboros') {
      for (const s of this.corpo) if (s.cx === cx && s.cy === cy) return true;
      return this.cx === cx && this.cy === cy;
    }
    const r = (this.tamanho - 1) / 2;
    return Math.abs(cx - this.cx) <= r && Math.abs(cy - this.cy) <= r;
  }

  faseAtual() {
    const frac = this.vida / this.vidaMax;
    let escolhida = this.def.fases[0];
    for (const f of this.def.fases) if (frac <= f.ate) escolhida = f;
    return escolhida;
  }

  // ---------- ciclo ----------

  atualizar(dt, jogo) {
    if (this.morto) return;
    this.tempo += dt * 1000;
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.disperso > 0) this.disperso -= dt * 1000;
    if (this.invisivel > 0) this.invisivel -= dt * 1000;

    const f = this.def.fases.indexOf(this.faseAtual());
    if (f !== this.fase) {
      this.fase = f;
      this.aoTrocarFase(jogo);
    }

    this.mover(dt, jogo);
    this.atualizarContinuos(dt, jogo);

    if (this.acao) {
      this.acao.t += dt * 1000;
      if (!this.acao.feito && this.acao.t >= this.acao.aviso) {
        this.acao.feito = true;
        this.efeito(this.acao.nome, jogo);
      }
      if (this.acao.t >= this.acao.duracao) {
        this.acao = null;
        this.proximoAtaque = this.faseAtual().intervalo;
      }
    } else {
      this.proximoAtaque -= dt * 1000;
      if (this.proximoAtaque <= 0 && this.invisivel <= 0) this.escolherAtaque(jogo);
    }
  }

  aoTrocarFase(jogo) {
    if (this.fase <= 0) return;
    jogo.audio.gritoChefe();
    jogo.fx.sacudir(16);
    jogo.fx.clarao(0.6, '255,60,60');
    const p = this.posicao(jogo.arena);
    jogo.fx.onda(p.x, p.y, 260, '255,80,80', 0.8, 6);
    jogo.avisar('FASE ' + (this.fase + 1));
    if (this.id === 'ouroboros') {
      const cresce = this.p.crescimentoPorFase || 6;
      for (let i = 0; i < cresce; i++) {
        const ultimo = this.corpo[this.corpo.length - 1];
        this.corpo.push({ cx: ultimo.cx, cy: ultimo.cy, ax: ultimo.cx, ay: ultimo.cy });
      }
      this.intervaloPasso = this.p.passoFinal || 100;
    }
  }

  escolherAtaque(jogo) {
    const fase = this.faseAtual();
    const nome = sorteia(Math.random, fase.ataques);
    const cfg = TEMPOS[nome] || { aviso: 700, duracao: 1400 };
    this.acao = { nome, t: 0, aviso: cfg.aviso, duracao: cfg.duracao, feito: false, dados: {} };
    this.preparar(nome, jogo);
  }

  preparar(nome, jogo) {
    const c = jogo.cobra;
    const cab = c.viva ? c.cabeca : { cx: this.cx, cy: this.cy };
    const d = this.acao.dados;
    if (nome === 'martelo' || nome === 'salto' || nome === 'foice') {
      d.alvo = { cx: cab.cx, cy: cab.cy };
    } else if (nome === 'maos') {
      d.celulas = [];
      for (let i = 0; i < (this.p.maosPorVez || 4); i++) {
        const alvo = i === 0 ? cab : jogo.arena.celulaLivreAleatoria(Math.random, null, 0);
        d.celulas.push({ cx: alvo.cx, cy: alvo.cy });
      }
    } else if (nome === 'coluna' || nome === 'ceifa') {
      d.linhas = [];
      const quantas = nome === 'coluna' ? (this.p.colunas || 4) : (this.p.linhasCeifa || 3);
      for (let i = 0; i < quantas; i++) {
        const vertical = chance(Math.random, 0.5);
        d.linhas.push({
          vertical,
          pos: vertical
            ? limita(cab.cx + (i - quantas / 2) * 2 + ((Math.random() * 3) | 0) - 1, 1, jogo.arena.cols - 2)
            : limita(cab.cy + (i - quantas / 2) * 2 + ((Math.random() * 3) | 0) - 1, 1, jogo.arena.rows - 2),
        });
      }
    } else if (nome === 'investida') {
      const dx = cab.cx - this.cx, dy = cab.cy - this.cy;
      const n = Math.hypot(dx, dy) || 1;
      d.dir = { x: dx / n, y: dy / n };
    }
  }

  // ---------- movimento ----------

  mover(dt, jogo) {
    if (this.id === 'ouroboros') { this.moverSerpente(dt, jogo); return; }
    if (this.carga) {
      const arena = jogo.arena;
      this.carga.t += dt * 1000;
      const passo = dt * (this.p.velocidadeInvestida || 60) / arena.celula;
      const nx = this.cx + this.carga.dir.x * passo;
      const ny = this.cy + this.carga.dir.y * passo;
      const bloqueado = jogo.arena.parede(Math.round(nx), Math.round(ny));
      if (bloqueado || this.carga.t > 1500) {
        this.carga = null;
        jogo.fx.sacudir(9);
        jogo.audio.parede();
      } else {
        this.ax = this.cx; this.ay = this.cy;
        this.cx = nx; this.cy = ny;
        this.progresso = 1;
        this.danoDeContato(jogo, this.p.danoInvestida || 3);
      }
      return;
    }

    this.acumulado += dt * 1000;
    this.progresso = limita(this.acumulado / this.intervaloPasso, 0, 1);
    if (this.acumulado >= this.intervaloPasso) {
      this.acumulado = 0;
      this.ax = Math.round(this.cx); this.ay = Math.round(this.cy);
      this.cx = this.ax; this.cy = this.ay;
      if (this.invisivel > 0 || this.acao) return;
      const c = jogo.cobra;
      if (!c.viva) return;
      // vagueia mantendo distancia media: chefe colado e chefe chato
      const dd = distGrade(this.cx, this.cy, c.cabeca.cx, c.cabeca.cy);
      const alvo = dd < 5 ? -1 : 1;
      const opcoes = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = this.cx + dx, ny = this.cy + dy;
        if (!this.cabeNaArena(jogo, nx, ny)) continue;
        const nd = distGrade(nx, ny, c.cabeca.cx, c.cabeca.cy);
        opcoes.push({ dx, dy, v: alvo * -nd });
      }
      if (!opcoes.length) return;
      opcoes.sort((a, b) => b.v - a.v);
      const escolha = chance(Math.random, 0.25) && opcoes.length > 1 ? opcoes[1] : opcoes[0];
      this.cx += escolha.dx; this.cy += escolha.dy;
      this.danoDeContato(jogo, this.def.contato);
    }
  }

  cabeNaArena(jogo, cx, cy) {
    const r = (this.tamanho - 1) / 2;
    for (let x = -r; x <= r; x++) {
      for (let y = -r; y <= r; y++) {
        if (jogo.arena.parede(Math.round(cx + x), Math.round(cy + y))) return false;
      }
    }
    return true;
  }

  moverSerpente(dt, jogo) {
    this.acumulado += dt * 1000;
    this.progresso = limita(this.acumulado / this.intervaloPasso, 0, 1);
    if (this.acumulado < this.intervaloPasso) return;
    this.acumulado = 0;
    const c = jogo.cobra;
    const arena = jogo.arena;

    let escolha = null;
    if (this.espelhando > 0 && this.filaEspelho.length) {
      const d = this.filaEspelho.shift();
      if (d && !arena.parede(this.cx + d.x, this.cy + d.y)) escolha = d;
      this.espelhando--;
    }
    if (!escolha && c.viva) {
      const cab = c.cabeca;
      const opcoes = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = this.cx + dx, ny = this.cy + dy;
        if (arena.parede(nx, ny)) continue;
        if (this.corpoOcupa(nx, ny, 3)) continue;
        opcoes.push({ x: dx, y: dy, d: Math.abs(cab.cx - nx) + Math.abs(cab.cy - ny) });
      }
      opcoes.sort((a, b) => a.d - b.d);
      escolha = opcoes[0] || null;
    }
    if (!escolha) return;
    this.dir = escolha;
    for (const s of this.corpo) { s.ax = s.cx; s.ay = s.cy; }
    this.ax = this.cx; this.ay = this.cy;
    this.cx += escolha.x; this.cy += escolha.y;
    this.corpo.unshift({ cx: this.cx, cy: this.cy, ax: this.ax, ay: this.ay });
    this.corpo.pop();
    this.danoDeContato(jogo, this.p.danoCabeca || 4);
  }

  corpoOcupa(cx, cy, ignorar = 0) {
    if (!this.corpo) return false;
    for (let i = ignorar; i < this.corpo.length; i++) {
      if (this.corpo[i].cx === cx && this.corpo[i].cy === cy) return true;
    }
    return false;
  }

  danoDeContato(jogo, dano) {
    const c = jogo.cobra;
    if (!c.viva) return;
    const cab = c.cabeca;
    if (this.ocupa(cab.cx, cab.cy)) c.levarDano(jogo, dano, 'chefe');
  }

  atualizarContinuos(dt, jogo) {
    const arena = jogo.arena;
    const c = jogo.cobra;

    if (this.onda) {
      this.onda.r += dt * (this.onda.velocidade || 9);
      const cab = c.viva ? c.cabeca : null;
      if (cab && !this.onda.acertou) {
        const d = dist(cab.cx, cab.cy, this.cx, this.cy);
        if (Math.abs(d - this.onda.r) < 0.8) {
          c.levarDano(jogo, this.onda.dano, 'onda');
          this.onda.acertou = true;
        }
      }
      if (this.onda.r > this.onda.max) this.onda = null;
    }

    if (this.feixe) {
      this.feixe.ang += dt * (this.feixe.velocidade || 0.9);
      this.feixe.restante -= dt * 1000;
      const cab = c.viva ? c.cabeca : null;
      if (cab) {
        const ang = Math.atan2(cab.cy - this.cy, cab.cx - this.cx);
        let dif = Math.abs(((ang - this.feixe.ang + Math.PI * 3) % TAU) - Math.PI);
        if (dif < 0.16 && dist(cab.cx, cab.cy, this.cx, this.cy) < 16) {
          c.levarDano(jogo, this.feixe.dano, 'feixe');
        }
      }
      if (this.feixe.restante <= 0) this.feixe = null;
    }

    if (this.anel) {
      this.anel.r -= dt * 0.9;
      this.anel.restante -= dt * 1000;
      const cab = c.viva ? c.cabeca : null;
      if (cab) {
        const d = dist(cab.cx, cab.cy, this.anel.cx, this.anel.cy);
        if (Math.abs(d - this.anel.r) < 0.75) c.levarDano(jogo, this.anel.dano, 'anel');
      }
      if (this.anel.restante <= 0 || this.anel.r < 1) this.anel = null;
    }
  }

  // ---------- efeitos ----------

  efeito(nome, jogo) {
    const arena = jogo.arena;
    const c = jogo.cobra;
    const cab = c.viva ? c.cabeca : { cx: this.cx, cy: this.cy };
    const p = this.posicao(arena);
    const d = this.acao ? this.acao.dados : {};
    const P = this.p;

    switch (nome) {
      case 'ovos': {
        for (let i = 0; i < (P.ovosPorVez || 3); i++) {
          const vaga = jogo.celulaLivrePerto(this.cx, this.cy, 4);
          if (!vaga) continue;
          jogo.criarInimigo(P.filhote || 'larva', vaga.cx, vaga.cy);
          jogo.fx.emitir(arena.px(vaga.cx), arena.py(vaga.cy),
            { n: 12, cor: '#ff8ac0', vel: 110, vida: 0.6, tam: 3 });
        }
        jogo.audio.matar();
        break;
      }
      case 'investida': {
        this.carga = { dir: d.dir || { x: -1, y: 0 }, t: 0 };
        jogo.audio.bote();
        jogo.fx.sacudir(8);
        break;
      }
      case 'onda': {
        this.onda = { r: 0, max: P.raioOnda || 9, dano: P.danoOnda || 3, velocidade: 11 };
        jogo.fx.onda(p.x, p.y, (P.raioOnda || 9) * arena.celula, '255,120,180', 0.8, 5);
        jogo.audio.constricao(0.7);
        jogo.fx.sacudir(11);
        break;
      }
      case 'chuva': {
        const n = P.tirosChuva || 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + this.tempo * 0.001;
          jogo.criarProjetil({
            x: p.x, y: p.y, dx: Math.cos(a), dy: Math.sin(a),
            velocidade: 6.5, dano: 2, alcance: 26, dono: 'inimigo', cor: this.def.brilho,
          });
        }
        jogo.audio.cuspe();
        break;
      }
      case 'mare': {
        const idx = jogo.indicePerigo('lodo');
        for (let i = 0; i < (P.celulasMare || 24); i++) {
          const alvo = jogo.arena.celulaLivreAleatoria(Math.random, null, 0);
          arena.poePerigo(alvo.cx, alvo.cy, idx, P.duracaoMare || 6000);
        }
        jogo.avisar('A MARE SOBE');
        jogo.audio.porta();
        break;
      }
      case 'vomito': {
        const n = P.tirosVomito || 6;
        const base = Math.atan2(arena.py(cab.cy) - p.y, arena.px(cab.cx) - p.x);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.2;
          jogo.criarProjetil({
            x: p.x, y: p.y, dx: Math.cos(a), dy: Math.sin(a),
            velocidade: P.velocidadeVomito || 8, dano: P.danoVomito || 3,
            alcance: 24, dono: 'inimigo', cor: '#7affe0',
          });
        }
        jogo.audio.cuspe();
        break;
      }
      case 'maos': {
        const idx = jogo.indicePerigo('espinho');
        for (const cel of (d.celulas || [])) {
          arena.poePerigo(cel.cx, cel.cy, idx, 2600);
          jogo.fx.emitir(arena.px(cel.cx), arena.py(cel.cy),
            { n: 10, cor: '#7affe0', vel: 130, vida: 0.5, tam: 3 });
          if (c.viva && cab.cx === cel.cx && cab.cy === cel.cy) c.levarDano(jogo, P.danoMao || 3, 'mao');
        }
        jogo.fx.sacudir(7);
        break;
      }
      case 'mergulho': {
        this.invisivel = P.duracaoMergulho || 1500;
        jogo.fx.emitir(p.x, p.y, { n: 24, cor: '#7affe0', vel: 180, vida: 0.7, tam: 4 });
        setTimeout(() => {
          if (this.morto) return;
          const vaga = jogo.celulaLivrePerto(cab.cx, cab.cy, 3) || { cx: this.cx, cy: this.cy };
          this.cx = vaga.cx; this.cy = vaga.cy;
          this.ax = vaga.cx; this.ay = vaga.cy;
          this.onda = { r: 0, max: 6, dano: 3, velocidade: 12 };
          jogo.fx.sacudir(12);
        }, P.duracaoMergulho || 1500);
        break;
      }
      case 'martelo': {
        const alvo = d.alvo || cab;
        const raio = P.raioMartelo || 3.2;
        jogo.fx.onda(arena.px(alvo.cx), arena.py(alvo.cy), raio * arena.celula, '255,180,90', 0.5, 6);
        jogo.fx.sacudir(18);
        jogo.audio.dano();
        if (c.viva && dist(cab.cx, cab.cy, alvo.cx, alvo.cy) <= raio) {
          c.levarDano(jogo, P.danoMartelo || 4, 'martelo');
        }
        const idxFogo = jogo.indicePerigo('fogo');
        for (let i = 0; i < (P.rachadurasMartelo || 6); i++) {
          const a = Math.random() * TAU, r = 1 + Math.random() * raio;
          arena.poePerigo(Math.round(alvo.cx + Math.cos(a) * r), Math.round(alvo.cy + Math.sin(a) * r), idxFogo, 4500);
        }
        break;
      }
      case 'bigorna': {
        for (let i = 0; i < (P.bigornas || 3); i++) {
          const alvo = arena.celulaLivreAleatoria(Math.random, cab, 2);
          arena.poeParede(alvo.cx, alvo.cy, P.duracaoParede || 7000);
          jogo.fx.emitir(arena.px(alvo.cx), arena.py(alvo.cy),
            { n: 14, cor: '#ffb04a', vel: 160, vida: 0.5, tam: 3.4 });
          if (c.viva && cab.cx === alvo.cx && cab.cy === alvo.cy) c.levarDano(jogo, P.danoBigorna || 3, 'bigorna');
        }
        jogo.fx.sacudir(9);
        jogo.audio.parede();
        break;
      }
      case 'feixe': {
        this.feixe = {
          ang: Math.random() * TAU,
          velocidade: P.velocidadeFeixe || 0.9,
          dano: P.danoFeixe || 3,
          restante: P.duracaoFeixe || 5000,
        };
        jogo.avisar('O FEIXE GIRA');
        jogo.audio.furia();
        break;
      }
      case 'forja': {
        for (let i = 0; i < (P.brasasForja || 3); i++) {
          const vaga = jogo.celulaLivrePerto(this.cx, this.cy, 4);
          if (vaga) jogo.criarInimigo('brasa', vaga.cx, vaga.cy);
        }
        break;
      }
      case 'dispersar': {
        this.disperso = P.duracaoDispersao || 5000;
        for (let i = 0; i < (P.vespasDispersao || 6); i++) {
          const vaga = jogo.celulaLivrePerto(this.cx, this.cy, 5);
          if (vaga) jogo.criarInimigo('vespa', vaga.cx, vaga.cy);
        }
        jogo.avisar('O ENXAME SE ABRE');
        jogo.audio.gritoChefe();
        break;
      }
      case 'coluna': case 'ceifa': {
        const dano = nome === 'coluna' ? (P.danoColuna || 3) : (P.danoCeifa || 4);
        for (const l of (d.linhas || [])) {
          if (!c.viva) break;
          const pego = l.vertical ? cab.cx === l.pos : cab.cy === l.pos;
          if (pego) c.levarDano(jogo, dano, nome);
          for (let i = 1; i < (l.vertical ? arena.rows : arena.cols) - 1; i++) {
            const x = l.vertical ? l.pos : i;
            const y = l.vertical ? i : l.pos;
            jogo.fx.emitir(arena.px(x), arena.py(y),
              { n: 1, cor: nome === 'coluna' ? '#ffe07a' : '#ff5a6a', vel: 40, vida: 0.35, tam: 3 });
          }
        }
        jogo.fx.sacudir(10);
        jogo.audio.dano();
        break;
      }
      case 'furia': {
        for (let i = 0; i < (P.vespasFuria || 8); i++) {
          const vaga = jogo.celulaLivrePerto(this.cx, this.cy, 6);
          if (vaga) jogo.criarInimigo('vespa', vaga.cx, vaga.cy);
        }
        jogo.audio.gritoChefe();
        jogo.fx.clarao(0.5, '255,220,90');
        break;
      }
      case 'foice': {
        const raio = P.raioFoice || 5;
        jogo.fx.onda(p.x, p.y, raio * arena.celula, '255,70,90', 0.45, 7);
        jogo.audio.severado();
        jogo.fx.sacudir(14);
        if (c.viva && dist(cab.cx, cab.cy, this.cx, this.cy) <= raio) {
          c.levarDano(jogo, P.danoFoice || 4, 'foice');
          const corte = P.cortaSegmentos || 3;
          if (c.comprimento - corte > 4) c.severar(jogo, c.comprimento - corte);
        }
        break;
      }
      case 'salto': {
        const alvo = d.alvo || cab;
        const vaga = jogo.celulaLivrePerto(alvo.cx, alvo.cy, 3) || { cx: this.cx, cy: this.cy };
        jogo.fx.emitir(p.x, p.y, { n: 18, cor: this.def.brilho, vel: 170, vida: 0.5, tam: 3.4 });
        this.cx = vaga.cx; this.cy = vaga.cy;
        this.ax = vaga.cx; this.ay = vaga.cy;
        const np = this.posicao(arena);
        jogo.fx.onda(np.x, np.y, arena.celula * 2.4, '255,70,90', 0.4, 5);
        jogo.fx.sacudir(10);
        this.danoDeContato(jogo, this.def.contato);
        break;
      }
      case 'escuridao': {
        jogo.escurecer(P.raioEscuridao || 4, P.duracaoEscuridao || 6000);
        jogo.avisar('A LUZ FOI EMBORA');
        jogo.audio.gritoChefe();
        break;
      }
      case 'espelho': {
        this.espelhando = 26;
        this.filaEspelho = jogo.ultimasDirecoes.slice(-26).map(d => ({ x: d.x, y: d.y }));
        jogo.avisar('ELE ESTA REFAZENDO O SEU CAMINHO');
        break;
      }
      case 'cuspe': {
        const n = P.tirosCuspe || 5;
        const base = Math.atan2(arena.py(cab.cy) - p.y, arena.px(cab.cx) - p.x);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.26;
          jogo.criarProjetil({
            x: p.x, y: p.y, dx: Math.cos(a), dy: Math.sin(a),
            velocidade: P.velocidadeCuspe || 9, dano: P.danoCuspe || 3,
            alcance: 26, dono: 'inimigo', cor: '#ff2a6a',
          });
        }
        jogo.audio.cuspe();
        break;
      }
      case 'cerco': {
        const raio = 4;
        let postas = 0;
        for (let a = 0; a < TAU && postas < (P.celulasCerco || 12); a += 0.28) {
          if (chance(Math.random, 0.28)) continue;
          const x = Math.round(cab.cx + Math.cos(a) * raio);
          const y = Math.round(cab.cy + Math.sin(a) * raio);
          if (!arena.dentro(x, y) || arena.parede(x, y)) continue;
          if (jogo.cobra.ocupa(x, y, false) >= 0) continue;
          arena.poeParede(x, y, P.duracaoCerco || 5000);
          postas++;
        }
        jogo.avisar('CERCO');
        jogo.audio.porta();
        break;
      }
      case 'anel': {
        this.anel = {
          cx: cab.cx, cy: cab.cy, r: P.raioAnel || 6.5,
          dano: P.danoAnel || 5, restante: P.duracaoAnel || 6000,
        };
        jogo.fx.clarao(0.5, '255,40,90');
        jogo.audio.furia();
        break;
      }
    }
  }

  // ---------- vida ----------

  ferir(jogo, dano, silencioso, ondeX, ondeY) {
    if (this.morto) return 0;
    let real = dano;
    if (this.disperso > 0) real *= (1 - (this.p.reducaoDano || 0.35));
    real = Math.max(1, Math.round(real));
    this.vida -= real;
    this.flash = 1;
    const p = this.posicao(jogo.arena);
    jogo.fx.texto(ondeX || p.x, (ondeY || p.y) - 14, String(real), '#ffd07a', { tam: 17 });
    jogo.fx.emitir(ondeX || p.x, ondeY || p.y, { n: 6, cor: this.def.brilho, vel: 130, vida: 0.4, tam: 3 });
    if (this.vida <= 0) { this.vida = 0; this.morrer(jogo); }
    return real;
  }

  morrer(jogo) {
    if (this.morto) return;
    this.morto = true;
    const p = this.posicao(jogo.arena);
    jogo.fx.clarao(1, '255,220,180');
    jogo.fx.sacudir(24);
    jogo.fx.onda(p.x, p.y, 420, '255,180,120', 1.2, 9);
    for (let i = 0; i < 5; i++) {
      setTimeout(() => jogo.fx.emitir(p.x + (Math.random() - 0.5) * 60, p.y + (Math.random() - 0.5) * 60,
        { n: 20, cor: this.def.brilho, vel: 220, vida: 0.9, tam: 4.5 }), i * 130);
    }
    jogo.audio.morte();
    jogo.aoMorrerChefe(this);
  }

  // ---------- desenho ----------

  desenhar(ctx, arena, tempo) {
    if (this.morto) return;
    if (this.invisivel > 0) {
      const p = this.posicao(arena);
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = this.def.brilho;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, arena.celula * 1.6, 0, TAU);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (this.id === 'ouroboros') { this.desenharSerpente(ctx, arena, tempo); return; }

    const p = this.posicao(arena);
    const s = arena.celula * this.tamanho;
    const cor = this.flash > 0.02 ? 'rgba(255,255,255,' + (0.5 + this.flash * 0.5) + ')' : this.def.cor;

    sombraChao(ctx, p.x, p.y + s * 0.42, s * 0.5, s * 0.2, 0.9);
    luz(ctx, p.x, p.y, s * 0.95, this.def.brilho, this.disperso > 0 ? 0.16 : 0.42);

    ctx.save();
    if (this.disperso > 0) ctx.globalAlpha = 0.4;
    desenharChefe(ctx, this.id, p.x, p.y, s, cor, this.def.brilho, tempo, this);
    ctx.restore();

    this.desenharTelegrafos(ctx, arena, tempo);
  }

  desenharSerpente(ctx, arena, tempo) {
    const pts = [];
    for (const s of this.corpo) {
      pts.push({
        x: arena.px(s.ax) + (arena.px(s.cx) - arena.px(s.ax)) * this.progresso,
        y: arena.py(s.ay) + (arena.py(s.cy) - arena.py(s.ay)) * this.progresso,
      });
    }
    if (!pts.length) return;
    const c = arena.celula;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const traco = (larg, estilo, comp) => {
      ctx.globalCompositeOperation = comp || 'source-over';
      ctx.strokeStyle = estilo;
      ctx.lineWidth = larg;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };
    traco(c * 1.25, 'rgba(255,20,70,0.22)', 'lighter');
    const g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
    g.addColorStop(0, this.flash > 0.02 ? '#ffffff' : '#8a0a2a');
    g.addColorStop(1, '#2a0210');
    traco(c * 0.86, g);
    traco(c * 0.3, 'rgba(255,120,150,0.35)');
    ctx.globalCompositeOperation = 'source-over';

    const h = pts[0];
    const ang = Math.atan2(this.dir.y, this.dir.x);
    ctx.translate(h.x, h.y);
    ctx.rotate(ang);
    ctx.fillStyle = this.flash > 0.02 ? '#fff' : '#a00a2a';
    ctx.beginPath();
    ctx.ellipse(c * 0.1, 0, c * 0.66, c * 0.52, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff2a6a';
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(c * 0.2, lado * c * 0.24, c * 0.14, c * 0.14, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    this.desenharTelegrafos(ctx, arena, tempo);
  }

  desenharTelegrafos(ctx, arena, tempo) {
    const a = this.acao;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (a && !a.feito) {
      const t = limita(a.t / a.aviso, 0, 1);
      const alfa = 0.25 + t * 0.6;
      const d = a.dados;
      if (d.alvo) {
        const raio = (a.nome === 'martelo' ? (this.p.raioMartelo || 3.2)
          : a.nome === 'foice' ? (this.p.raioFoice || 5) : 2.2) * arena.celula;
        ctx.strokeStyle = 'rgba(255,120,90,' + alfa + ')';
        ctx.lineWidth = 2 + t * 3;
        ctx.beginPath();
        ctx.arc(arena.px(d.alvo.cx), arena.py(d.alvo.cy), raio * (1.15 - t * 0.15), 0, TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,90,60,' + (alfa * 0.16) + ')';
        ctx.fill();
      }
      if (d.celulas) {
        for (const cel of d.celulas) {
          ctx.fillStyle = 'rgba(120,255,220,' + (alfa * 0.35) + ')';
          ctx.fillRect(arena.px(cel.cx) - arena.celula / 2, arena.py(cel.cy) - arena.celula / 2, arena.celula, arena.celula);
        }
      }
      if (d.linhas) {
        for (const l of d.linhas) {
          ctx.fillStyle = 'rgba(255,190,90,' + (alfa * 0.28) + ')';
          if (l.vertical) ctx.fillRect(arena.px(l.pos) - arena.celula / 2, arena.oy, arena.celula, arena.altura);
          else ctx.fillRect(arena.ox, arena.py(l.pos) - arena.celula / 2, arena.largura, arena.celula);
        }
      }
      if (a.nome === 'investida' && d.dir) {
        const p = this.posicao(arena);
        ctx.strokeStyle = 'rgba(255,90,90,' + alfa + ')';
        ctx.lineWidth = 3 + t * 6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + d.dir.x * 400, p.y + d.dir.y * 400);
        ctx.stroke();
      }
    }

    if (this.feixe) {
      const p = this.posicao(arena);
      const comprimento = arena.largura;
      ctx.strokeStyle = 'rgba(255,170,60,0.75)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(this.feixe.ang) * comprimento, p.y + Math.sin(this.feixe.ang) * comprimento);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,200,0.9)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    if (this.onda) {
      const p = this.posicao(arena);
      ctx.strokeStyle = 'rgba(255,140,180,0.6)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.onda.r * arena.celula, 0, TAU);
      ctx.stroke();
    }

    if (this.anel) {
      ctx.strokeStyle = 'rgba(255,60,110,0.8)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(arena.px(this.anel.cx), arena.py(this.anel.cy), this.anel.r * arena.celula, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

const TEMPOS = {
  ovos: { aviso: 620, duracao: 1300 },
  investida: { aviso: 780, duracao: 1800 },
  onda: { aviso: 700, duracao: 1500 },
  chuva: { aviso: 620, duracao: 1200 },
  mare: { aviso: 900, duracao: 1600 },
  vomito: { aviso: 640, duracao: 1200 },
  maos: { aviso: 900, duracao: 1600 },
  mergulho: { aviso: 400, duracao: 2400 },
  martelo: { aviso: 850, duracao: 1700 },
  bigorna: { aviso: 700, duracao: 1400 },
  feixe: { aviso: 800, duracao: 1500 },
  forja: { aviso: 600, duracao: 1200 },
  dispersar: { aviso: 700, duracao: 1500 },
  coluna: { aviso: 820, duracao: 1500 },
  ceifa: { aviso: 950, duracao: 1700 },
  furia: { aviso: 700, duracao: 1400 },
  foice: { aviso: 780, duracao: 1600 },
  salto: { aviso: 700, duracao: 1300 },
  escuridao: { aviso: 800, duracao: 1500 },
  espelho: { aviso: 600, duracao: 1200 },
  cuspe: { aviso: 620, duracao: 1200 },
  cerco: { aviso: 800, duracao: 1500 },
  anel: { aviso: 900, duracao: 1800 },
};

function hexA(hex, a) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

function desenharChefe(ctx, id, x, y, s, cor, brilho, tempo, chefe) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = cor;
  ctx.strokeStyle = cor;
  ctx.lineJoin = 'round';
  const r = s * 0.5;
  const t = tempo * 2;
  // Mesmo contorno grosso dos bichos pequenos: o chefe e enorme e cheio de
  // efeito em volta, e sem recorte ele vira mancha.
  const traco = Math.max(2.5, s * 0.028);
  const fp = () => {
    const guardado = ctx.strokeStyle;
    const larg = ctx.lineWidth;
    ctx.fill();
    ctx.strokeStyle = CONTORNO;
    ctx.lineWidth = traco;
    ctx.stroke();
    ctx.strokeStyle = guardado;
    ctx.lineWidth = larg;
  };

  if (id === 'mae_dos_ovos') {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 0.92, r * 0.82 + Math.sin(t) * r * 0.05, 0, 0, TAU);
    fp();
    ctx.fillStyle = hexA(brilho, 0.5);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + t * 0.3;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.5, r * 0.2 + Math.sin(a) * r * 0.35, r * 0.19, r * 0.24, a, 0, TAU);
      fp();
    }
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.68, r * 0.42, r * 0.36, 0, 0, TAU);
    fp();
    ctx.fillStyle = brilho;
    for (const lx of [-0.2, 0.2]) {
      ctx.beginPath(); ctx.ellipse(lx * r, -r * 0.72, r * 0.08, r * 0.12, 0, 0, TAU); fp();
    }
  } else if (id === 'o_afogado') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, r);
    ctx.quadraticCurveTo(-r * 1.05, -r * 0.4, 0, -r * 0.95);
    ctx.quadraticCurveTo(r * 1.05, -r * 0.4, r * 0.8, r);
    for (let i = 4; i >= 0; i--) {
      const px = -r * 0.8 + (i / 4) * r * 1.6;
      ctx.quadraticCurveTo(px + r * 0.16, r * (0.7 + Math.sin(t + i) * 0.22), px, r);
    }
    ctx.closePath(); fp();
    ctx.fillStyle = '#04100f';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.3, r * 0.46, r * 0.42, 0, 0, TAU); fp();
    ctx.fillStyle = brilho;
    for (const lx of [-0.2, 0.2]) {
      ctx.beginPath(); ctx.arc(lx * r, -r * 0.34, r * 0.1, 0, TAU); fp();
    }
    ctx.strokeStyle = hexA(brilho, 0.55);
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-r, r * (0.2 + i * 0.28) + Math.sin(t + i) * 3);
      ctx.lineTo(r, r * (0.2 + i * 0.28) + Math.cos(t + i) * 3);
      ctx.stroke();
    }
  } else if (id === 'ferreiro_cego') {
    ctx.fillRect(-r * 0.72, -r * 0.5, r * 1.44, r * 1.35);
    ctx.fillStyle = hexA('#000000', 0.5);
    ctx.fillRect(-r * 0.72, -r * 0.5, r * 1.44, r * 0.2);
    ctx.fillStyle = cor;
    ctx.beginPath(); ctx.ellipse(0, -r * 0.75, r * 0.42, r * 0.38, 0, 0, TAU); fp();
    ctx.strokeStyle = hexA('#2a1408', 0.9);
    ctx.lineWidth = r * 0.18;
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.78); ctx.lineTo(r * 0.5, -r * 0.7); ctx.stroke();
    // martelo girando
    const a = t * 1.4;
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(r * 0.7, -r * 0.07, r * 0.7, r * 0.14);
    ctx.fillStyle = hexA(brilho, 0.85);
    ctx.fillRect(r * 1.3, -r * 0.28, r * 0.38, r * 0.56);
    ctx.restore();
    ctx.fillStyle = hexA(brilho, 0.35 + 0.3 * Math.sin(t * 3));
    ctx.beginPath(); ctx.arc(0, r * 0.3, r * 0.3, 0, TAU); fp();
  } else if (id === 'o_enxame') {
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 0.6;
      const rr = r * (0.35 + 0.6 * Math.abs(Math.sin(i * 2.4 + t)));
      ctx.fillStyle = i % 3 ? cor : brilho;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr * 0.9, r * 0.15, r * 0.11, a, 0, TAU);
      fp();
    }
    ctx.fillStyle = hexA(brilho, 0.75);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.3 + Math.sin(t * 4) * r * 0.05, 0, TAU); fp();
  } else if (id === 'o_ceifador') {
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.1, r * 0.66, r);
    ctx.lineTo(-r * 0.66, r);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.1, 0, -r * 1.05);
    ctx.closePath(); fp();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.42, r * 0.42, r * 0.46, 0, 0, TAU); fp();
    ctx.fillStyle = brilho;
    for (const lx of [-0.16, 0.16]) {
      ctx.beginPath(); ctx.ellipse(lx * r, -r * 0.44, r * 0.1, r * 0.16, 0, 0, TAU); fp();
    }
    // foice
    ctx.save();
    ctx.rotate(Math.sin(t) * 0.5);
    ctx.strokeStyle = '#4a3a30';
    ctx.lineWidth = r * 0.1;
    ctx.beginPath(); ctx.moveTo(r * 0.6, r * 0.9); ctx.lineTo(r * 0.9, -r * 0.9); ctx.stroke();
    ctx.strokeStyle = hexA(brilho, 0.95);
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(r * 0.9, -r * 0.9, r * 0.62, Math.PI * 0.9, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export { desenharChefe };
