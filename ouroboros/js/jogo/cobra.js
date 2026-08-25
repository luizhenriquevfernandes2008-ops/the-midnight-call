// cobra.js — a serpente.
//
// Ela anda em passos de celula, mas e desenhada interpolada: cada segmento
// guarda de onde veio, e o desenho mistura as duas posicoes conforme o
// passo avanca. Sem isso o jogo parece um relogio de ponteiro; com isso
// parece um bicho.
//
// As regras que fazem disto um roguelike e nao um snake:
//   - bater no proprio corpo NAO mata: arranca a cauda no ponto da batida.
//     Os pedacos caem no chao como alma e podem ser recolhidos de volta.
//   - bater na parede tira vida e trava um passo.
//   - o BOTE (espaco) atravessa o proprio corpo, machuca quem estiver no
//     caminho e da invencibilidade curta. E a saida de um no mal feito.
//   - o comprimento e recurso: alimenta a constricao e algumas reliquias,
//     mas fecha as suas proprias saidas.

import { limita, TAU } from '../nucleo/util.js';
import { luz, sombraChao, pintar, clarear, escurecer, CONTORNO } from '../arte/pincel.js';

const VETOR = {
  cima: { x: 0, y: -1 }, baixo: { x: 0, y: 1 },
  esquerda: { x: -1, y: 0 }, direita: { x: 1, y: 0 },
};

export class Cobra {
  constructor(cfg, atributos) {
    this.cfg = cfg;
    this.at = atributos;
    this.segmentos = [];
    this.dir = { x: 1, y: 0 };
    this.proxDir = null;
    this.acumulado = 0;
    this.vidaMax = atributos.vidaMax;
    this.vida = Math.min(atributos.vidaInicial ?? cfg.vidaInicial, this.vidaMax);
    this.energia = atributos.energiaMax;
    this.furia = 0;
    this.crescerPendente = 0;
    this.invulneravelAte = 0;
    this.travadaAte = 0;
    this.viva = true;
    this.bote = { celulas: 0, recargaAte: 0 };
    this.cuspeRecargaAte = 0;
    this.devorarAte = 0;
    this.constricaoAte = 0;
    this.tempo = 0;
    this.piscarOlho = 0;
    this.danoUltimoPerigo = 0;
    this.deslocamentoDano = 0;
    // animacoes: cada uma e um numero que cai de 1 a 0 e so o desenho le
    this.mordida = 0;     // mandibula abrindo na mordida
    this.batida = 0;      // recuo ao bater na parede
    this.dirBatida = { x: 0, y: 0 };
    this.rastro = [];     // fantasmas do bote
  }

  nascer(cx, cy, comprimento) {
    this.segmentos.length = 0;
    for (let i = 0; i < comprimento; i++) {
      this.segmentos.push({ cx: cx - i, cy, ax: cx - i, ay: cy });
    }
    this.dir = { x: 1, y: 0 };
    this.proxDir = null;
    this.acumulado = 0;
  }

  get cabeca() { return this.segmentos[0]; }
  get comprimento() { return this.segmentos.length; }

  get intervalo() {
    let base = this.cfg.tickBase * this.at.tickMult;
    if (this.tempo < this.devorarAte) base *= this.cfg.devorar.multiplicadorTick;
    if (this.bote.celulas > 0) base *= 0.34;
    if (this.lentidao > 1) base *= this.lentidao;
    return Math.max(this.cfg.tickMinimo, base);
  }

  invulneravel() { return this.tempo < this.invulneravelAte; }
  devorando() { return this.tempo < this.devorarAte; }

  virar(nome) {
    const v = VETOR[nome];
    if (!v) return;
    // proibido inverter 180 graus: seria morte instantanea sem aviso
    const ultima = this.proxDir || this.dir;
    if (v.x === -ultima.x && v.y === -ultima.y) return;
    if (v.x === ultima.x && v.y === ultima.y) return;
    this.proxDir = v;
  }

  ocupa(cx, cy, ignorarCauda = true) {
    const n = this.segmentos.length;
    for (let i = 0; i < n; i++) {
      if (ignorarCauda && i === n - 1) continue;
      const s = this.segmentos[i];
      if (s.cx === cx && s.cy === cy) return i;
    }
    return -1;
  }

  // ---------- acoes ----------

  usarBote(jogo) {
    if (this.bote.celulas > 0) return false;
    if (this.tempo < this.bote.recargaAte) return false;
    const custo = this.cfg.bote.custo;
    if (this.energia < custo) { jogo.audio.negado(); return false; }
    this.energia -= custo;
    this.bote.celulas = Math.round(this.cfg.bote.celulas + (this.at.celulasBote || 0));
    this.bote.recargaAte = this.tempo + this.cfg.bote.recarga * this.at.recargaBote;
    this.invulneravelAte = Math.max(this.invulneravelAte,
      this.tempo + this.cfg.bote.invulneravel + (this.at.boteInvulneravel || 0));
    jogo.audio.bote();
    const c = this.cabeca;
    jogo.fx.emitir(jogo.arena.px(c.cx), jogo.arena.py(c.cy), {
      n: 16, cor: '#ff9a5a', vel: 190, vida: 0.4, tam: 3.4,
      angulo: Math.atan2(this.dir.y, this.dir.x) + Math.PI, espalha: 1.2,
    });
    jogo.fx.sacudir(3);
    return true;
  }

  cuspir(jogo) {
    if (!jogo.corrida.tem('cuspe')) return false;
    if (this.tempo < this.cuspeRecargaAte) return false;
    const custo = this.cfg.cuspe.custo;
    if (this.energia < custo) { jogo.audio.negado(); return false; }
    this.energia -= custo;
    this.cuspeRecargaAte = this.tempo + this.cfg.cuspe.recarga * this.at.recargaCuspe;
    const c = this.cabeca;
    jogo.criarProjetil({
      x: jogo.arena.px(c.cx), y: jogo.arena.py(c.cy),
      dx: this.dir.x, dy: this.dir.y,
      velocidade: this.cfg.cuspe.velocidade,
      dano: (this.cfg.cuspe.dano + this.at.danoCuspe) * (1 + this.at.danoGeral),
      alcance: this.cfg.cuspe.alcance,
      dono: 'cobra',
      cor: '#9cff7a',
      veneno: jogo.corrida.tem('veneno'),
    });
    jogo.audio.cuspe();
    return true;
  }

  usarFuria(jogo) {
    if (this.furia < this.cfg.furiaMaxima) { jogo.audio.negado(); return false; }
    this.furia = 0;
    this.devorarAte = this.tempo + this.cfg.devorar.duracao;
    this.invulneravelAte = Math.max(this.invulneravelAte, this.tempo + 900);
    jogo.audio.furia();
    jogo.fx.clarao(0.8, '255,40,60');
    jogo.fx.sacudir(12);
    const c = this.cabeca;
    jogo.fx.onda(jogo.arena.px(c.cx), jogo.arena.py(c.cy), 200, '255,60,60', 0.7, 6);
    return true;
  }

  // ---------- dano ----------

  levarDano(jogo, quantidade, causa = 'bicho') {
    if (!this.viva || this.invulneravel()) return false;
    let dano = quantidade * (1 + (this.at.danoRecebido || 0));
    dano = Math.max(1, Math.round(dano - this.at.armadura));
    this.vida -= dano;
    this.invulneravelAte = this.tempo + this.cfg.invulneravelAoDano + (this.at.invulneravel || 0);
    this.deslocamentoDano = 6;
    jogo.audio.dano();
    jogo.fx.sacudir(7 + dano);
    jogo.fx.clarao(0.35 + dano * 0.05, '255,30,40');
    const c = this.cabeca;
    jogo.fx.texto(jogo.arena.px(c.cx), jogo.arena.py(c.cy) - 14, '-' + dano, '#ff5a5a', { tam: 19, tremendo: true });
    jogo.fx.emitir(jogo.arena.px(c.cx), jogo.arena.py(c.cy), {
      n: 12, cor: '#c02a3a', vel: 130, vida: 0.5, tam: 3.2,
    });
    if (this.vida <= 0) { this.vida = 0; jogo.matarCobra(causa); }
    return true;
  }

  curar(n) {
    this.vida = Math.min(this.vidaMax, this.vida + n);
  }

  crescer(n) {
    if (this.at.semCrescimento) return;
    this.crescerPendente += n;
  }

  // Arranca do indice para tras. Os pedacos viram alma no chao — o jogador
  // pode voltar e recolher, o que transforma um erro em decisao (voltar la
  // vale a pena? o bicho ainda esta vivo?).
  severar(jogo, indice) {
    const minimo = 3;
    if (indice < minimo) indice = minimo;
    if (indice >= this.segmentos.length) return 0;
    const perdidos = this.segmentos.splice(indice);
    for (const s of perdidos) {
      if (Math.random() < 0.55) {
        jogo.criarAlma(s.cx, s.cy, 1);
      }
      jogo.fx.emitir(jogo.arena.px(s.cx), jogo.arena.py(s.cy), {
        n: 4, cor: '#7acf6a', vel: 90, vida: 0.6, tam: 2.6,
      });
    }
    jogo.audio.severado();
    jogo.fx.sacudir(10);
    jogo.fx.clarao(0.4, '120,255,140');
    return perdidos.length;
  }

  // ---------- passo ----------

  atualizar(dt, jogo) {
    this.tempo += dt * 1000;
    if (!this.viva) return;

    this.energia = Math.min(this.at.energiaMax,
      this.energia + (this.at.energiaRegen) * dt);
    this.deslocamentoDano *= 1 - Math.min(1, dt * 9);
    this.mordida = Math.max(0, this.mordida - dt * 5.5);
    this.batida = Math.max(0, this.batida - dt * 4.2);
    for (let i = this.rastro.length - 1; i >= 0; i--) {
      this.rastro[i].t -= dt * 3.4;
      if (this.rastro[i].t <= 0) this.rastro.splice(i, 1);
    }
    this.piscarOlho -= dt;
    if (this.piscarOlho < -2.6) this.piscarOlho = 0.16 + Math.random() * 0.1;

    // lodo e teia deixam a cobra lenta enquanto a cabeca estiver em cima
    const c = this.cabeca;
    const nomePerigo = jogo.arena.porPerigo(jogo.nomesPerigo, c.cx, c.cy);
    const perigo = nomePerigo ? jogo.dadosPerigo[nomePerigo] : null;
    this.lentidao = perigo && perigo.lentidao ? perigo.lentidao : 1;

    if (this.tempo < this.travadaAte) return;

    this.acumulado += dt * 1000;
    let guarda = 0;
    while (this.acumulado >= this.intervalo && this.viva && guarda++ < 4) {
      this.acumulado -= this.intervalo;
      this.passo(jogo);
    }
  }

  progresso() { return limita(this.acumulado / this.intervalo, 0, 1); }

  passo(jogo) {
    const proxima = jogo.entradaDirecao();
    if (proxima) this.virar(proxima);
    if (this.proxDir) { this.dir = this.proxDir; this.proxDir = null; }

    const cab = this.cabeca;
    const nx = cab.cx + this.dir.x;
    const ny = cab.cy + this.dir.y;
    const arena = jogo.arena;
    const emBote = this.bote.celulas > 0;

    // parede
    if (arena.parede(nx, ny)) {
      if (emBote) {
        this.bote.celulas = 0;
        jogo.fx.emitir(arena.px(nx), arena.py(ny), { n: 14, cor: '#c9b08a', vel: 150, vida: 0.4, tam: 3 });
        jogo.fx.sacudir(6);
      }
      if (!jogo.corrida.tem('parede_segura') && !this.invulneravel()) {
        this.levarDano(jogo, this.cfg.danoParede, 'parede');
      } else {
        jogo.audio.parede();
      }
      // NAO trava a cobra. A versao anterior congelava 90ms aqui, e era
      // exatamente isso que o jogo parecia: engasgado. Agora ela recua na
      // animacao, solta poeira, e continua respondendo a curva na hora.
      this.batida = 1;
      this.dirBatida = { x: this.dir.x, y: this.dir.y };
      this.acumulado = 0;
      jogo.fx.sacudir(4);
      jogo.fx.emitir(arena.px(nx) - this.dir.x * arena.celula * 0.35,
        arena.py(ny) - this.dir.y * arena.celula * 0.35, {
        n: 9, cor: '#cbb89a', vel: 130, vida: 0.35, tam: 2.6,
        angulo: Math.atan2(-this.dir.y, -this.dir.x), espalha: 1.9,
      });
      return;
    }

    // proprio corpo
    const idx = this.ocupa(nx, ny, true);
    if (idx >= 0) {
      if (emBote) {
        jogo.fx.emitir(arena.px(nx), arena.py(ny), { n: 6, cor: '#ffb06a', vel: 110, vida: 0.3, tam: 2.4 });
      } else if (jogo.corrida.tem('pele_trocada')) {
        this.levarDano(jogo, 1, 'corpo');
      } else {
        const perdidos = this.severar(jogo, idx);
        this.levarDano(jogo, 1, 'corpo');
        jogo.avisar(jogo.textos.aviso.severado + ' (-' + perdidos + ')');
        this.travadaAte = this.tempo + 140;
        return;
      }
    }

    // anda
    for (const s of this.segmentos) { s.ax = s.cx; s.ay = s.cy; }
    this.segmentos.unshift({ cx: nx, cy: ny, ax: cab.cx, ay: cab.cy });
    if (this.crescerPendente > 0) this.crescerPendente--;
    else this.segmentos.pop();

    if (this.bote.celulas > 0) {
      this.bote.celulas--;
      jogo.fx.emitir(arena.px(nx), arena.py(ny), { n: 3, cor: '#ffcf8a', vel: 60, vida: 0.25, tam: 2.2 });
    }

    // rastro de veneno da reliquia
    if (jogo.corrida.tem('rastro_veneno') && this.segmentos.length > 2) {
      const cauda = this.segmentos[this.segmentos.length - 1];
      jogo.poePocaVeneno(cauda.cx, cauda.cy);
    }

    if (this.bote.celulas > 0 || this.rastro.length) {
      this.rastro.push({ pts: this.pontos(arena), t: 1 });
      if (this.rastro.length > 4) this.rastro.shift();
    }

    jogo.aoAndarCobra(nx, ny, emBote);
  }

  // Chamado pelo jogo quando a cabeca acerta alguma coisa: a mandibula
  // fecha. Animacao curta e sincronizada com o dano, que e o que faz a
  // mordida "existir" para quem esta olhando.
  morder() { this.mordida = 1; }

  // ---------- desenho ----------

  pontos(arena) {
    const t = this.progresso();
    const pts = [];
    for (const s of this.segmentos) {
      pts.push({
        x: arena.px(s.ax) + (arena.px(s.cx) - arena.px(s.ax)) * t,
        y: arena.py(s.ay) + (arena.py(s.cy) - arena.py(s.ay)) * t,
      });
    }
    return pts;
  }

  desenhar(ctx, arena, corA = '#4ae08a', corB = '#0e3a2a') {
    const pts = this.pontos(arena);
    if (!pts.length) return;
    const c = arena.celula;
    const devorando = this.devorando();
    const machucada = this.invulneravel() && Math.floor(this.tempo / 90) % 2 === 0;

    // recuo da batida: a cobra inteira e empurrada para tras por um instante
    const rec = this.batida * this.batida;
    const dx = -this.dirBatida.x * rec * c * 0.28 + this.deslocamentoDano * (Math.random() - 0.5);
    const dy = -this.dirBatida.y * rec * c * 0.28 + this.deslocamentoDano * (Math.random() - 0.5);

    // Ao levar dano a cobra clareia, mas NAO vira um tubo branco: perder a
    // silhueta bem na hora do perigo e o pior momento possivel para o
    // jogador nao achar a propria cabeca.
    const corpoCor = machucada ? '#c8ffd8' : devorando ? '#ff5f4a' : corA;
    const corpoEscuro = machucada ? '#3a7a5a' : devorando ? '#6a0d12' : corB;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const tracar = (lista, larg, estilo, alfa = 1) => {
      ctx.globalAlpha = alfa;
      ctx.strokeStyle = estilo;
      ctx.lineWidth = larg;
      ctx.beginPath();
      ctx.moveTo(lista[0].x, lista[0].y);
      for (let i = 1; i < lista.length; i++) ctx.lineTo(lista[i].x, lista[i].y);
      ctx.stroke();
    };

    // fantasmas do bote: o rastro e o que faz o avanco parecer VELOZ em vez
    // de so teleportar
    for (const g of this.rastro) {
      if (g.pts.length < 2) continue;
      tracar(g.pts, c * 0.62, corA, g.t * 0.22);
    }
    ctx.globalAlpha = 1;

    // sombra no chao, deslocada: dá altura ao corpo
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = c * 0.78;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y + c * 0.22);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y + c * 0.22);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // brilho por baixo (barato: sprite copiado, nao gradiente novo)
    luz(ctx, pts[0].x, pts[0].y, c * 1.5, devorando ? '#ff4a3a' : '#4affa0', devorando ? 0.5 : 0.24);

    // contorno + corpo + espinha: tres passadas na mesma linha
    tracar(pts, c * 0.92, CONTORNO);
    tracar(pts, c * 0.74, corpoCor);
    tracar(pts, c * 0.5, corpoEscuro, 0.55);
    tracar(pts, c * 0.26, clarear(corpoCor, 0.35), 0.85);

    // placas dorsais: uma a cada dois segmentos, com contorno
    ctx.lineWidth = Math.max(1.4, c * 0.06);
    for (let i = 2; i < pts.length; i += 2) {
      const p = pts[i], q = pts[i - 1];
      const a = Math.atan2(p.y - q.y, p.x - q.x);
      const f = 1 - (i / pts.length) * 0.55;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, c * 0.14 * f, c * 0.3 * f, 0, 0, TAU);
      ctx.fillStyle = machucada ? 'rgba(255,220,220,0.7)' : escurecer(corpoCor, 0.45);
      ctx.fill();
      ctx.strokeStyle = 'rgba(6,4,10,0.5)';
      ctx.stroke();
      ctx.restore();
    }

    this.desenharCabeca(ctx, pts[0], c, corpoCor, devorando, machucada);
    ctx.restore();
  }

  // A cabeca e desenhada a parte porque e ela que atua: abre a boca ao
  // morder, achata ao bater, e e onde o olho do jogador fica o tempo todo.
  desenharCabeca(ctx, h, c, corpoCor, devorando, machucada) {
    const ang = Math.atan2(this.dir.y, this.dir.x);
    const abre = this.mordida * 0.85;              // 0 fechada, 1 escancarada
    const achata = 1 - this.batida * 0.35;
    const traco = Math.max(2, c * 0.09);
    const aceso = devorando ? '#fff0c0' : '#ffe34a';

    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(ang);
    ctx.scale(achata, 1 + (1 - achata) * 0.6);
    ctx.lineJoin = 'round';

    // goela: so aparece quando a boca abre
    if (abre > 0.02) {
      ctx.beginPath();
      ctx.ellipse(c * 0.3, 0, c * 0.36, c * 0.3 * abre + c * 0.05, 0, 0, TAU);
      pintar(ctx, '#4a0a18', CONTORNO, traco * 0.7);
    }

    // mandibula de baixo
    ctx.save();
    ctx.rotate(abre * 0.55);
    ctx.beginPath();
    ctx.moveTo(-c * 0.2, 0);
    ctx.quadraticCurveTo(c * 0.34, c * 0.1, c * 0.62, c * 0.02);
    ctx.quadraticCurveTo(c * 0.3, c * 0.42, -c * 0.2, c * 0.3);
    ctx.closePath();
    pintar(ctx, escurecer(corpoCor, 0.25), CONTORNO, traco);
    ctx.restore();

    // cranio (mandibula de cima)
    ctx.save();
    ctx.rotate(-abre * 0.35);
    ctx.beginPath();
    ctx.moveTo(-c * 0.5, -c * 0.34);
    ctx.quadraticCurveTo(c * 0.28, -c * 0.5, c * 0.66, -c * 0.06);
    ctx.quadraticCurveTo(c * 0.3, c * 0.06, -c * 0.5, c * 0.3);
    ctx.closePath();
    pintar(ctx, corpoCor, CONTORNO, traco);

    // presas
    ctx.fillStyle = '#fff6e0';
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(c * 0.44, lado * c * 0.06);
      ctx.lineTo(c * 0.6, lado * c * 0.02);
      ctx.lineTo(c * 0.46, lado * c * 0.2);
      ctx.closePath();
      ctx.fill();
    }

    // olhos: sempre acesos, sempre no mesmo lugar — e a referencia visual
    // que o jogador usa para saber para onde a cabeca aponta
    const abertura = this.piscarOlho > 0 ? 0.25 : 1;
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(c * 0.04, lado * c * 0.2, c * 0.13, c * 0.14 * abertura, 0, 0, TAU);
      pintar(ctx, machucada ? '#ffffff' : aceso, CONTORNO, traco * 0.6);
      ctx.fillStyle = '#120612';
      ctx.beginPath();
      ctx.ellipse(c * 0.08, lado * c * 0.2, c * 0.05, c * 0.12 * abertura, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // lingua, so com a boca quase fechada
    if (abre < 0.2 && Math.sin(this.tempo / 240) > 0.7) {
      ctx.strokeStyle = '#ff3a68';
      ctx.lineWidth = Math.max(1.6, c * 0.07);
      ctx.beginPath();
      ctx.moveTo(c * 0.55, 0);
      ctx.lineTo(c * 0.82, 0);
      ctx.moveTo(c * 0.82, 0);
      ctx.lineTo(c * 0.98, -c * 0.11);
      ctx.moveTo(c * 0.82, 0);
      ctx.lineTo(c * 0.98, c * 0.11);
      ctx.stroke();
    }
    ctx.restore();
  }

  brilhoCabeca(arena) {
    const pts = this.pontos(arena);
    return pts.length ? pts[0] : { x: 0, y: 0 };
  }
}
