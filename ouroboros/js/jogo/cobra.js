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
      this.travadaAte = this.tempo + 90;
      jogo.fx.emitir(arena.px(nx), arena.py(ny), { n: 5, cor: '#8a7a6a', vel: 80, vida: 0.3, tam: 2 });
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

    jogo.aoAndarCobra(nx, ny, emBote);
  }

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

  desenhar(ctx, arena, corA = '#3ad07a', corB = '#0e3a2a') {
    const pts = this.pontos(arena);
    if (!pts.length) return;
    const c = arena.celula;
    const devorando = this.devorando();
    const piscando = this.invulneravel() && Math.floor(this.tempo / 70) % 2 === 0;
    const dx = this.deslocamentoDano * (Math.random() - 0.5);
    const dy = this.deslocamentoDano * (Math.random() - 0.5);

    ctx.save();
    ctx.translate(dx, dy);
    if (piscando) ctx.globalAlpha = 0.55;

    const corpo = (largura, estilo, comp = 'source-over', alfa = 1) => {
      ctx.globalCompositeOperation = comp;
      ctx.globalAlpha = alfa * (piscando ? 0.55 : 1);
      ctx.strokeStyle = estilo;
      ctx.lineWidth = largura;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };

    // brilho externo
    corpo(c * 1.15, devorando ? 'rgba(255,60,60,0.30)' : 'rgba(60,255,150,0.13)', 'lighter');
    // corpo
    const g = ctx.createLinearGradient(pts[0].x, pts[0].y,
      pts[pts.length - 1].x, pts[pts.length - 1].y);
    g.addColorStop(0, devorando ? '#ff5a4a' : corA);
    g.addColorStop(1, devorando ? '#5a0a12' : corB);
    corpo(c * 0.80, g);
    // faixa clara em cima
    corpo(c * 0.34, devorando ? 'rgba(255,200,160,0.5)' : 'rgba(180,255,210,0.22)');

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = piscando ? 0.55 : 1;

    // escamas
    for (let i = 2; i < pts.length; i += 2) {
      const p = pts[i];
      const q = pts[i - 1];
      const a = Math.atan2(p.y - q.y, p.x - q.x);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      ctx.fillStyle = devorando ? 'rgba(255,140,120,0.30)' : 'rgba(10,40,30,0.34)';
      ctx.beginPath();
      ctx.ellipse(0, 0, c * 0.16, c * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // cabeca
    const h = pts[0];
    const ang = Math.atan2(this.dir.y, this.dir.x);
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(ang);
    ctx.fillStyle = devorando ? '#ff7a5a' : corA;
    ctx.beginPath();
    ctx.ellipse(c * 0.06, 0, c * 0.52, c * 0.44, 0, 0, TAU);
    ctx.fill();
    // mandibula
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(c * 0.42, 0, c * 0.14, c * 0.26, 0, 0, TAU);
    ctx.fill();
    // olhos
    const abertura = this.piscarOlho > 0 ? 0.25 : 1;
    for (const lado of [-1, 1]) {
      ctx.fillStyle = devorando ? '#fff0d0' : '#ffe66a';
      ctx.beginPath();
      ctx.ellipse(c * 0.16, lado * c * 0.2, c * 0.12, c * 0.12 * abertura, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#100810';
      ctx.beginPath();
      ctx.ellipse(c * 0.19, lado * c * 0.2, c * 0.05, c * 0.11 * abertura, 0, 0, TAU);
      ctx.fill();
    }
    // lingua
    if (Math.sin(this.tempo / 210) > 0.72) {
      ctx.strokeStyle = '#ff4a6a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c * 0.5, 0);
      ctx.lineTo(c * 0.78, 0);
      ctx.moveTo(c * 0.78, 0);
      ctx.lineTo(c * 0.92, -c * 0.1);
      ctx.moveTo(c * 0.78, 0);
      ctx.lineTo(c * 0.92, c * 0.1);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  brilhoCabeca(arena) {
    const pts = this.pontos(arena);
    return pts.length ? pts[0] : { x: 0, y: 0 };
  }
}
