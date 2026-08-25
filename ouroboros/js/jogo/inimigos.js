// inimigos.js — os bichos e o jeito de cada um pensar.
//
// Todos andam em celula, com o proprio relogio. O que muda de um para o
// outro e a funcao de decisao: para onde dar o proximo passo, e o que fazer
// quando a cabeca da cobra esta perto.
//
// Regra de contato que sustenta o desenho do jogo: bicho encostando no
// CORPO da cobra nao machuca (senao cobra comprida seria punicao pura, e o
// jogo inteiro empurra voce a ficar comprido). Machuca a cabeca, machuca de
// longe, ou — no caso do Rato-de-Cauda — arranca a ponta.

import { TAU, limita, distGrade, chance, dist } from '../nucleo/util.js';

const PASSOS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Inimigo {
  constructor(def, cx, cy, escala) {
    this.def = def;
    this.id = def.id;
    this.cx = cx; this.cy = cy;
    this.ax = cx; this.ay = cy;
    this.vidaMax = Math.round(def.vida * escala.vida);
    this.vida = this.vidaMax;
    this.dano = Math.max(1, Math.round(def.dano * escala.dano));
    this.intervalo = def.passo / escala.velocidade;
    this.acumulado = Math.random() * this.intervalo;
    // Precisa nascer definido: a sala e desenhada durante a introducao do
    // andar, antes de qualquer atualizacao, e progresso NaN vira gradiente
    // invalido no canvas.
    this.progresso = 0;
    this.tempo = 0;
    this.estado = 'anda';
    this.tempoEstado = 0;
    this.proximoTiro = 500 + Math.random() * 1200;
    this.morto = false;
    this.flash = 0;
    this.fase = Math.random() * TAU;
    this.filhotes = 0;
    this.solido = true;
    this.veneno = null;
    this.angOrbita = Math.random() * TAU;
    this.alvoSalto = null;
    this.pavio = 0;
  }

  get eixoX() { return this.ax + (this.cx - this.ax) * this.progresso; }
  get eixoY() { return this.ay + (this.cy - this.ay) * this.progresso; }

  posicao(arena) {
    return {
      x: arena.px(this.ax) + (arena.px(this.cx) - arena.px(this.ax)) * this.progresso,
      y: arena.py(this.ay) + (arena.py(this.cy) - arena.py(this.ay)) * this.progresso,
    };
  }

  atualizar(dt, jogo) {
    this.tempo += dt * 1000;
    this.tempoEstado += dt * 1000;
    this.flash = Math.max(0, this.flash - dt * 5);
    if (this.veneno) {
      this.veneno.restante -= dt;
      this.veneno.acumulado += dt;
      if (this.veneno.acumulado >= 1) {
        this.veneno.acumulado -= 1;
        this.ferir(jogo, this.veneno.dano, true);
      }
      if (this.veneno.restante <= 0) this.veneno = null;
    }
    if (this.morto) return;

    this.acumulado += dt * 1000;
    this.progresso = limita(this.acumulado / this.intervalo, 0, 1);
    if (this.acumulado >= this.intervalo) {
      this.acumulado -= this.intervalo;
      this.progresso = 0;
      this.ax = this.cx; this.ay = this.cy;
      this.pensar(jogo);
    }
    this.aoQuadro(dt, jogo);
  }

  // Coisas que acontecem por segundo, nao por passo: tiro, pavio, fase.
  aoQuadro(dt, jogo) {
    const d = this.def;
    const cobra = jogo.cobra;
    if (!cobra.viva) return;

    if (d.comportamento === 'atirador' || d.comportamento === 'orbital') {
      this.proximoTiro -= dt * 1000;
      if (this.proximoTiro <= 0) {
        this.proximoTiro = d.intervaloTiro || 1800;
        this.atirar(jogo, d.tirosPorRajada || 1);
      }
    }

    if (d.comportamento === 'espectro') {
      const ciclo = d.cicloFase || 2400;
      const t = this.tempo % ciclo;
      this.solido = t < (d.tempoSolido || 1400);
    }

    if (d.comportamento === 'bomba' && this.estado === 'pavio') {
      this.pavio -= dt * 1000;
      if (this.pavio <= 0) this.explodir(jogo);
    }

    if (d.comportamento === 'gerador') {
      this.proximoTiro -= dt * 1000;
      if (this.proximoTiro <= 0) {
        this.proximoTiro = d.intervaloSpawn || 3000;
        if (this.filhotes < (d.maximoFilhotes || 3)) {
          const vaga = jogo.celulaLivrePerto(this.cx, this.cy, 2);
          if (vaga) {
            const filho = jogo.criarInimigo(d.filhote || 'larva', vaga.cx, vaga.cy);
            if (filho) { filho.mae = this; this.filhotes++; }
            jogo.fx.emitir(jogo.arena.px(vaga.cx), jogo.arena.py(vaga.cy),
              { n: 8, cor: '#ff8ac0', vel: 70, vida: 0.5, tam: 2.6 });
          }
        }
      }
    }

    if (d.comportamento === 'tecelao') {
      this.proximoTiro -= dt * 1000;
      if (this.proximoTiro <= 0) {
        this.proximoTiro = d.intervaloTeia || 1500;
        jogo.poeTeia(this.cx, this.cy, d.duracaoTeia || 6000);
      }
    }

    if (d.rastro) {
      this.rastroAcum = (this.rastroAcum || 0) + dt * 1000;
      if (this.rastroAcum > 240) {
        this.rastroAcum = 0;
        jogo.poeRastro(d.rastro, this.cx, this.cy);
      }
    }
  }

  // ---------- decisao ----------

  pensar(jogo) {
    const c = jogo.cobra;
    if (!c.viva) { this.andar(jogo, this.passoAleatorio(jogo)); return; }
    const cab = c.cabeca;
    const d = this.def;

    switch (d.comportamento) {
      case 'errante': {
        const perto = distGrade(this.cx, this.cy, cab.cx, cab.cy) < 6;
        this.andar(jogo, perto && chance(Math.random, 0.6)
          ? this.passoPara(jogo, cab.cx, cab.cy)
          : this.passoAleatorio(jogo));
        break;
      }
      case 'perseguidor':
        this.andar(jogo, this.passoPara(jogo, cab.cx, cab.cy));
        break;
      case 'atirador': {
        const dd = distGrade(this.cx, this.cy, cab.cx, cab.cy);
        const ideal = d.distanciaIdeal || 6;
        if (dd < ideal - 1) this.andar(jogo, this.passoPara(jogo, cab.cx, cab.cy, true));
        else if (dd > ideal + 2) this.andar(jogo, this.passoPara(jogo, cab.cx, cab.cy));
        else this.andar(jogo, this.passoLateral(jogo, cab));
        break;
      }
      case 'saltador': {
        const dd = distGrade(this.cx, this.cy, cab.cx, cab.cy);
        if (this.estado === 'preparo') {
          if (this.tempoEstado >= (d.preparo || 600)) this.saltar(jogo);
        } else if (dd <= (d.alcanceSalto || 5) && dd > 1) {
          this.estado = 'preparo';
          this.tempoEstado = 0;
          this.alvoSalto = { cx: cab.cx, cy: cab.cy };
        } else {
          this.andar(jogo, this.passoPara(jogo, cab.cx, cab.cy));
        }
        break;
      }
      case 'mordedor': {
        const cauda = c.segmentos[c.segmentos.length - 1];
        this.andar(jogo, this.passoPara(jogo, cauda.cx, cauda.cy));
        break;
      }
      case 'espectro':
        this.andar(jogo, this.passoPara(jogo, cab.cx, cab.cy), true);
        break;
      case 'bomba': {
        const dd = distGrade(this.cx, this.cy, cab.cx, cab.cy);
        if (dd <= 1 && this.estado !== 'pavio') {
          this.estado = 'pavio';
          this.pavio = d.pavio || 700;
          jogo.audio.negado();
        } else if (this.estado !== 'pavio') {
          this.andar(jogo, this.passoPara(jogo, cab.cx, cab.cy));
        }
        break;
      }
      case 'gerador':
        break;
      case 'tecelao':
        this.andar(jogo, chance(Math.random, 0.5)
          ? this.passoPara(jogo, cab.cx, cab.cy, true)
          : this.passoAleatorio(jogo));
        break;
      case 'enxame': {
        const desvio = Math.sin(this.tempo / 260 + this.fase) > 0;
        const p = this.passoPara(jogo, cab.cx, cab.cy);
        if (desvio && p) this.andar(jogo, this.passoLateral(jogo, cab) || p);
        else this.andar(jogo, p);
        break;
      }
      case 'orbital': {
        this.angOrbita += 0.42;
        const r = d.raioOrbita || 5;
        const alvoX = Math.round(cab.cx + Math.cos(this.angOrbita) * r);
        const alvoY = Math.round(cab.cy + Math.sin(this.angOrbita) * r);
        this.andar(jogo, this.passoPara(jogo, alvoX, alvoY));
        break;
      }
      case 'teleporte': {
        if (this.tempo > (this.proximoTeleporte || (d.intervaloTeleporte || 3000))) {
          this.proximoTeleporte = this.tempo + (d.intervaloTeleporte || 3000);
          this.teleportar(jogo, cab);
        } else {
          this.andar(jogo, this.passoPara(jogo, cab.cx, cab.cy));
        }
        break;
      }
      default:
        this.andar(jogo, this.passoAleatorio(jogo));
    }
  }

  passoPara(jogo, tx, ty, fugir = false) {
    const opcoes = [];
    for (const [dx, dy] of PASSOS) {
      const nx = this.cx + dx, ny = this.cy + dy;
      if (!this.podeIr(jogo, nx, ny)) continue;
      const d = Math.abs(tx - nx) + Math.abs(ty - ny);
      opcoes.push({ dx, dy, d });
    }
    if (!opcoes.length) return null;
    opcoes.sort((a, b) => (fugir ? b.d - a.d : a.d - b.d));
    // um pouco de burrice: senao dez bichos viram uma fila so
    if (opcoes.length > 1 && chance(Math.random, 0.16)) return opcoes[1];
    return opcoes[0];
  }

  passoLateral(jogo, cab) {
    const dx = Math.sign(cab.cx - this.cx), dy = Math.sign(cab.cy - this.cy);
    const laterais = Math.abs(cab.cx - this.cx) > Math.abs(cab.cy - this.cy)
      ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
    const escolha = laterais[Math.random() < 0.5 ? 0 : 1];
    if (this.podeIr(jogo, this.cx + escolha[0], this.cy + escolha[1])) {
      return { dx: escolha[0], dy: escolha[1] };
    }
    return this.passoPara(jogo, cab.cx - dx * 3, cab.cy - dy * 3);
  }

  passoAleatorio(jogo) {
    const livres = PASSOS
      .map(([dx, dy]) => ({ dx, dy }))
      .filter(p => this.podeIr(jogo, this.cx + p.dx, this.cy + p.dy));
    if (!livres.length) return null;
    return livres[Math.floor(Math.random() * livres.length)];
  }

  podeIr(jogo, nx, ny) {
    if (this.def.comportamento === 'espectro') {
      return jogo.arena.dentro(nx, ny) && nx > 0 && ny > 0 &&
        nx < jogo.arena.cols - 1 && ny < jogo.arena.rows - 1;
    }
    if (!jogo.arena.livre(nx, ny)) return false;
    const outro = jogo.inimigoEm(nx, ny);
    if (outro && outro !== this) return false;
    return true;
  }

  andar(jogo, passo, atravessa = false) {
    if (!passo) return;
    const nx = this.cx + passo.dx, ny = this.cy + passo.dy;
    if (!atravessa && !jogo.arena.dentro(nx, ny)) return;
    this.cx = nx; this.cy = ny;
    jogo.aoAndarInimigo(this);
  }

  // ---------- ataques ----------

  atirar(jogo, quantos) {
    const c = jogo.cobra;
    if (!c.viva) return;
    const arena = jogo.arena;
    const p = this.posicao(arena);
    const cab = c.brilhoCabeca(arena);
    const base = Math.atan2(cab.y - p.y, cab.x - p.x);
    for (let i = 0; i < quantos; i++) {
      const a = base + (i - (quantos - 1) / 2) * 0.22;
      jogo.criarProjetil({
        x: p.x, y: p.y, dx: Math.cos(a), dy: Math.sin(a),
        velocidade: this.def.velocidadeTiro || 7,
        dano: this.dano, alcance: 22, dono: 'inimigo',
        cor: this.def.brilho || '#9cff7a', raio: 4.5,
      });
    }
    jogo.audio.cuspe();
    this.flash = 0.4;
  }

  saltar(jogo) {
    const alvo = this.alvoSalto;
    this.estado = 'anda';
    this.tempoEstado = 0;
    if (!alvo) return;
    let destino = alvo;
    if (!jogo.arena.livre(destino.cx, destino.cy) || jogo.inimigoEm(destino.cx, destino.cy)) {
      destino = jogo.celulaLivrePerto(alvo.cx, alvo.cy, 2) || { cx: this.cx, cy: this.cy };
    }
    this.ax = this.cx; this.ay = this.cy;
    this.cx = destino.cx; this.cy = destino.cy;
    this.acumulado = 0;
    const arena = jogo.arena;
    jogo.fx.onda(arena.px(destino.cx), arena.py(destino.cy), arena.celula * 1.6, '255,220,180', 0.35, 3);
    jogo.fx.sacudir(5);
    jogo.audio.parede();
    const cab = jogo.cobra.cabeca;
    if (cab.cx === destino.cx && cab.cy === destino.cy) {
      jogo.cobra.levarDano(jogo, this.dano, 'salto');
    }
  }

  explodir(jogo) {
    const arena = jogo.arena;
    const raio = this.def.raioExplosao || 2.5;
    const p = this.posicao(arena);
    jogo.fx.onda(p.x, p.y, raio * arena.celula, '255,200,90', 0.45, 5);
    jogo.fx.emitir(p.x, p.y, { n: 26, cor: '#ffd07a', vel: 260, vida: 0.6, tam: 4 });
    jogo.fx.sacudir(13);
    jogo.audio.matar();
    const c = jogo.cobra;
    if (c.viva) {
      const cab = c.cabeca;
      if (dist(cab.cx, cab.cy, this.cx, this.cy) <= raio) c.levarDano(jogo, this.dano, 'explosao');
    }
    for (const o of jogo.inimigos) {
      if (o === this || o.morto) continue;
      if (dist(o.cx, o.cy, this.cx, this.cy) <= raio) jogo.ferirInimigo(o, this.dano * 2, 'explosao');
    }
    this.morrer(jogo, true);
  }

  teleportar(jogo, cab) {
    const arena = jogo.arena;
    const antes = this.posicao(arena);
    jogo.fx.emitir(antes.x, antes.y, { n: 16, cor: this.def.brilho, vel: 130, vida: 0.5, tam: 3 });
    const vaga = jogo.celulaLivrePerto(cab.cx, cab.cy, 2) || { cx: this.cx, cy: this.cy };
    this.cx = vaga.cx; this.cy = vaga.cy;
    this.ax = vaga.cx; this.ay = vaga.cy;
    const depois = this.posicao(arena);
    jogo.fx.emitir(depois.x, depois.y, { n: 18, cor: this.def.brilho, vel: 150, vida: 0.5, tam: 3 });
    jogo.audio.voltar();
    // o corte: se a cabeca estiver ao lado, arranca corpo
    const c = jogo.cobra;
    if (c.viva && distGrade(this.cx, this.cy, cab.cx, cab.cy) <= 1) {
      c.levarDano(jogo, this.dano, 'corte');
    }
  }

  // ---------- vida ----------

  ferir(jogo, dano, silencioso = false, ondeX, ondeY) {
    if (this.morto) return 0;
    if (this.def.comportamento === 'espectro' && !this.solido) {
      if (!silencioso) {
        const p = this.posicao(jogo.arena);
        jogo.fx.texto(p.x, p.y - 12, 'ETEREO', '#8ac9ff', { tam: 12 });
      }
      return 0;
    }
    const real = Math.max(1, Math.round(dano));
    this.vida -= real;
    this.flash = 1;
    const pos = this.posicao(jogo.arena);
    const p = { x: ondeX ?? pos.x, y: ondeY ?? pos.y };
    if (!silencioso) {
      jogo.fx.texto(p.x + (Math.random() - 0.5) * 8, p.y - 10, String(real), '#ffe08a', { tam: 14 });
      jogo.fx.emitir(p.x, p.y, { n: 5, cor: this.def.brilho || '#ff8a6a', vel: 110, vida: 0.32, tam: 2.6 });
    }
    if (this.vida <= 0) this.morrer(jogo);
    return real;
  }

  morrer(jogo, semRecompensa = false) {
    if (this.morto) return;
    this.morto = true;
    if (this.mae) this.mae.filhotes = Math.max(0, this.mae.filhotes - 1);
    const p = this.posicao(jogo.arena);
    jogo.fx.emitir(p.x, p.y, { n: 16, cor: this.def.brilho || '#ff8a6a', vel: 170, vida: 0.6, tam: 3.4 });
    jogo.fx.emitir(p.x, p.y, { n: 8, cor: '#2a1018', vel: 90, vida: 0.8, tam: 4, brilho: false });
    jogo.audio.matar();
    if (!semRecompensa) jogo.aoMorrerInimigo(this);
    if (this.def.comportamento === 'bomba' && !semRecompensa) {
      // bolsa de gas estoura ao morrer tambem
      this.morto = false;
      this.explodir(jogo);
    }
  }

  desenhar(ctx, arena, tempo) {
    const p = this.posicao(arena);
    const s = arena.celula * 0.86;
    const d = this.def;
    ctx.save();
    if (d.comportamento === 'espectro') ctx.globalAlpha = this.solido ? 1 : 0.32;

    // brilho por baixo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 1.15);
    g.addColorStop(0, hexA(d.brilho || '#ff6a4a', 0.28));
    g.addColorStop(1, hexA(d.brilho || '#ff6a4a', 0));
    ctx.fillStyle = g;
    ctx.fillRect(p.x - s * 1.2, p.y - s * 1.2, s * 2.4, s * 2.4);
    ctx.restore();

    const cor = this.flash > 0.02
      ? 'rgba(255,255,255,' + (0.55 + this.flash * 0.45) + ')'
      : d.cor;
    desenharForma(ctx, d.forma, p.x, p.y, s, cor, d.brilho, tempo, this.fase, this);

    // telegrafo do salto e do pavio
    if (this.estado === 'preparo' && this.alvoSalto) {
      const t = limita(this.tempoEstado / (d.preparo || 600), 0, 1);
      const ax = arena.px(this.alvoSalto.cx), ay = arena.py(this.alvoSalto.cy);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,220,150,' + (0.3 + t * 0.6) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax, ay, arena.celula * (0.8 - t * 0.35), 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(ax, ay);
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }
    if (this.estado === 'pavio') {
      const t = 1 - limita(this.pavio / (d.pavio || 700), 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,180,80,' + (0.25 + t * 0.6) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * (0.6 + t * 0.7), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (this.veneno) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(140,255,120,0.22)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 0.7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // barra de vida so quando ja levou pancada
    if (this.vida < this.vidaMax) {
      const w = s * 0.9, h = 3;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(p.x - w / 2, p.y - s * 0.75, w, h);
      ctx.fillStyle = '#d04a5a';
      ctx.fillRect(p.x - w / 2, p.y - s * 0.75, w * (this.vida / this.vidaMax), h);
    }
    ctx.restore();
  }
}

function hexA(hex, a) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

// ---------- silhuetas ----------

export function desenharForma(ctx, forma, x, y, s, cor, brilho, tempo, fase = 0, bicho = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = cor;
  ctx.strokeStyle = cor;
  ctx.lineWidth = Math.max(1.5, s * 0.09);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const t = tempo * 4 + fase;
  const r = s * 0.42;

  switch (forma) {
    case 'verme': {
      const ondas = 3;
      ctx.beginPath();
      for (let i = 0; i <= ondas * 4; i++) {
        const p = i / (ondas * 4);
        const px = -r + p * r * 2;
        const py = Math.sin(p * TAU * 1.4 + t) * r * 0.34;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.lineWidth = s * 0.3;
      ctx.stroke();
      ctx.fillStyle = brilho;
      ctx.beginPath(); ctx.arc(r * 0.85, Math.sin(TAU * 1.4 + t) * r * 0.34, s * 0.11, 0, TAU); ctx.fill();
      break;
    }
    case 'garra': {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.9);
      ctx.lineTo(-r * 0.85, -r * 0.2);
      ctx.lineTo(-r * 0.3, -r * 0.85);
      ctx.lineTo(r * 0.3, -r * 0.85);
      ctx.lineTo(r * 0.85, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = brilho;
      for (const lx of [-0.32, 0.32]) {
        ctx.beginPath();
        ctx.ellipse(lx * r * 1.4, -r * 0.3, s * 0.08, s * 0.11, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'boca': {
      const abre = (Math.sin(t) + 1) / 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#100608';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.62, r * (0.16 + abre * 0.5), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = brilho;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.25, -r * (0.1 + abre * 0.4));
        ctx.lineTo(i * r * 0.25 + r * 0.08, -r * 0.02);
        ctx.lineTo(i * r * 0.25 - r * 0.08, -r * 0.02);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'cranio': {
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.15, r * 0.8, r * 0.75, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, r * 0.42); ctx.lineTo(r * 0.42, r * 0.42);
      ctx.lineTo(r * 0.3, r * 0.86); ctx.lineTo(-r * 0.3, r * 0.86);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#12060a';
      for (const lx of [-0.34, 0.34]) {
        ctx.beginPath();
        ctx.ellipse(lx * r, -r * 0.2, r * 0.2, r * 0.26, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'rato': {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.85, r * 0.6, Math.sin(t) * 0.12, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 0.55, -r * 0.45, r * 0.28, 0, TAU);
      ctx.arc(r * 0.1, -r * 0.62, r * 0.24, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = cor;
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(r * 0.8, r * 0.1);
      ctx.quadraticCurveTo(r * 1.3, r * 0.3 + Math.sin(t) * r * 0.3, r * 1.5, -r * 0.2);
      ctx.stroke();
      ctx.fillStyle = brilho;
      ctx.beginPath(); ctx.arc(-r * 0.5, -r * 0.05, s * 0.07, 0, TAU); ctx.fill();
      break;
    }
    case 'sudario': {
      const flutua = Math.sin(t * 0.6) * r * 0.12;
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, r * 0.7 + flutua);
      ctx.quadraticCurveTo(-r * 0.9, -r, 0, -r);
      ctx.quadraticCurveTo(r * 0.9, -r, r * 0.8, r * 0.7 + flutua);
      for (let i = 3; i >= 0; i--) {
        const px = -r * 0.8 + (i / 3) * r * 1.6;
        ctx.quadraticCurveTo(px + r * 0.2, r * (0.4 + Math.sin(t + i) * 0.25), px, r * 0.7 + flutua);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = brilho;
      for (const lx of [-0.3, 0.3]) {
        ctx.beginPath();
        ctx.ellipse(lx * r, -r * 0.3, r * 0.12, r * 0.2, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'bolha': {
      const incha = bicho && bicho.estado === 'pavio' ? 1.25 : 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.9 * incha, r * 0.82 * incha * (1 + Math.sin(t) * 0.06), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = hexA(brilho, 0.6);
      ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.3, r * 0.24, 0, TAU); ctx.fill();
      break;
    }
    case 'ninho': {
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        const rr = r * (0.75 + Math.sin(a * 3 + t * 0.4) * 0.16);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = hexA(brilho, 0.5 + 0.4 * Math.sin(t));
      ctx.beginPath(); ctx.arc(0, 0, r * 0.36, 0, TAU); ctx.fill();
      break;
    }
    case 'aranha': {
      ctx.strokeStyle = cor;
      ctx.lineWidth = s * 0.07;
      for (let i = 0; i < 4; i++) {
        const a = 0.5 + i * 0.55;
        for (const lado of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const meio = Math.sin(t + i) * 0.2;
          ctx.quadraticCurveTo(
            lado * Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.5 - r * 0.5 + meio * r,
            lado * Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.1);
          ctx.stroke();
        }
      }
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * 0.42, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = brilho;
      ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.14, 0, TAU); ctx.fill();
      break;
    }
    case 'chama': {
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.quadraticCurveTo(-r * 0.9, r * 0.1, -r * 0.25, -r * 0.4);
      ctx.quadraticCurveTo(-r * 0.15, -r * (0.7 + Math.sin(t * 2) * 0.2), 0, -r * 1.05);
      ctx.quadraticCurveTo(r * 0.2, -r * (0.6 + Math.cos(t * 2) * 0.2), r * 0.3, -r * 0.35);
      ctx.quadraticCurveTo(r * 0.95, r * 0.1, 0, r);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = hexA(brilho, 0.85);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.15, r * 0.28, r * 0.44, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'afogado': {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.25, r * 0.72, r * 0.72, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.55, r * 0.42, r * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = hexA(brilho, 0.6);
      ctx.lineWidth = s * 0.06;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, r * (0.1 + i * 0.3) + Math.sin(t + i) * 2);
        ctx.lineTo(r * 0.6, r * (0.1 + i * 0.3) + Math.cos(t + i) * 2);
        ctx.stroke();
      }
      ctx.fillStyle = brilho;
      for (const lx of [-0.18, 0.18]) {
        ctx.beginPath(); ctx.arc(lx * r, -r * 0.6, r * 0.08, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'vespa': {
      const asa = Math.sin(tempo * 40 + fase) * 0.5 + 0.5;
      ctx.fillStyle = hexA('#ffffff', 0.35);
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(lado * r * 0.5, -r * 0.3, r * 0.55, r * (0.12 + asa * 0.16), lado * 0.5, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.36, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a1206';
      for (let i = -1; i <= 1; i++) {
        ctx.fillRect(i * r * 0.26 - r * 0.05, -r * 0.32, r * 0.1, r * 0.64);
      }
      break;
    }
    case 'olho': {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.fill();
      const piscando = Math.sin(t * 0.7) > 0.86;
      if (!piscando) {
        ctx.fillStyle = '#f4ecdc';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.fill();
        ctx.fillStyle = brilho;
        ctx.beginPath(); ctx.arc(Math.cos(t * 0.5) * r * 0.16, Math.sin(t * 0.4) * r * 0.16, r * 0.26, 0, TAU); ctx.fill();
        ctx.fillStyle = '#08060c';
        ctx.beginPath(); ctx.arc(Math.cos(t * 0.5) * r * 0.16, Math.sin(t * 0.4) * r * 0.16, r * 0.12, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'manto': {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.95, -r * 0.2, r * 0.6, r);
      ctx.lineTo(-r * 0.6, r);
      ctx.quadraticCurveTo(-r * 0.95, -r * 0.2, 0, -r);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, -r * 0.3, r * 0.4, r * 0.44, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = brilho;
      for (const lx of [-0.16, 0.16]) {
        ctx.beginPath(); ctx.ellipse(lx * r, -r * 0.32, r * 0.09, r * 0.14, 0, 0, TAU); ctx.fill();
      }
      break;
    }
    default:
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
