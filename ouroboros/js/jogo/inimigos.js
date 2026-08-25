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
import {
  luz, sombraChao, anelAmeaca, pintar, brilhoDeCima, clarear, escurecer, CONTORNO,
} from '../arte/pincel.js';

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
    let nx = this.cx + passo.dx, ny = this.cy + passo.dy;
    if (!atravessa && !jogo.arena.dentro(nx, ny)) return;

    // O espectro ATRAVESSA parede, mas nao PARA dentro dela. Parar dentro
    // era um beco sem saida de verdade: o bicho ficava inalcancavel, a sala
    // nunca limpava e a porta nunca abria — o jogador ficava presa num
    // andar sem entender por que.
    if (atravessa && jogo.arena.parede(nx, ny)) {
      let achou = false;
      for (let k = 2; k <= 4; k++) {
        const tx = this.cx + passo.dx * k, ty = this.cy + passo.dy * k;
        if (!jogo.arena.dentro(tx, ty)) break;
        if (!jogo.arena.parede(tx, ty)) { nx = tx; ny = ty; achou = true; break; }
      }
      if (!achou) return;
    }

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

  // ---------- desenho ----------
  //
  // Ordem fixa, de tras para frente: sombra no chao, anel de ameaca, brilho,
  // corpo com contorno, detalhes, telegrafo, barra de vida. Manter a ordem
  // igual para todo bicho e o que faz a arena parecer desenhada pela mesma
  // mao.
  desenhar(ctx, arena, tempo) {
    const p = this.posicao(arena);
    const c = arena.celula;
    const s = c * 1.16;
    const d = this.def;
    const bal = Math.sin(tempo * 3.2 + this.fase) * c * 0.05;   // respiracao
    const y = p.y + bal;

    ctx.save();
    if (d.comportamento === 'espectro') ctx.globalAlpha = this.solido ? 1 : 0.34;

    sombraChao(ctx, p.x, p.y + c * 0.36, s * 0.4, s * 0.17, 0.85);
    if (this.solido !== false) {
      anelAmeaca(ctx, p.x, p.y + c * 0.36, s * 0.44, '#ff4a5a', tempo, this.fase);
    }
    luz(ctx, p.x, y, s * 0.8, d.brilho || '#ff6a4a', this.flash > 0.02 ? 0.6 : 0.24);

    const corpo = this.flash > 0.02 ? '#fff4f0' : d.cor;
    desenharForma(ctx, d.forma, p.x, y, s, corpo, d.brilho, tempo, this.fase, this);

    this.desenharTelegrafo(ctx, arena, p, s, tempo);

    if (this.veneno) {
      luz(ctx, p.x, y, s * 0.6, '#9cff7a', 0.35);
    }

    if (this.vida < this.vidaMax) {
      const w = s * 0.78, h = 3.5;
      const bx = p.x - w / 2, by = p.y - c * 0.62;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
      ctx.fillStyle = '#e0424f';
      ctx.fillRect(bx, by, w * (this.vida / this.vidaMax), h);
    }
    ctx.restore();
  }

  desenharTelegrafo(ctx, arena, p, s, tempo) {
    const d = this.def;
    if (this.estado === 'preparo' && this.alvoSalto) {
      const t = limita(this.tempoEstado / (d.preparo || 600), 0, 1);
      const ax = arena.px(this.alvoSalto.cx), ay = arena.py(this.alvoSalto.cy);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,190,90,' + (0.35 + t * 0.55) + ')';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,170,60,' + (0.12 + t * 0.28) + ')';
      ctx.beginPath();
      ctx.arc(ax, ay, arena.celula * (0.85 - t * 0.3), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,140,' + (0.5 + t * 0.5) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (this.estado === 'pavio') {
      const t = 1 - limita(this.pavio / (d.pavio || 700), 0, 1);
      luz(ctx, p.x, p.y, s * (0.9 + t * 1.1), '#ffcf6a', 0.4 + t * 0.5);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,120,60,' + (0.4 + t * 0.6) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (d.raioExplosao || 2.5) * arena.celula * (0.35 + t * 0.65), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function hexA(hex, a) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

// ---------- silhuetas ----------
//
// Cada bicho e feito de duas ou tres formas grandes, corpo chapado, contorno
// escuro grosso e um detalhe aceso (quase sempre o olho). Nada de gradiente:
// forma recortada se le no meio de doze bichos, sombra macia nao.

function caminho(ctx, f) { ctx.beginPath(); f(); }

export function desenharForma(ctx, forma, x, y, s, cor, brilho, tempo, fase = 0, bicho = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const t = tempo * 4 + fase;
  const r = s * 0.46;
  const traco = Math.max(2, s * 0.09);
  const claro = clarear(cor, 0.3);
  const escuro = escurecer(cor, 0.42);
  const aceso = brilho || '#ffd08a';

  const olho = (ox, oy, raio, aberto = 1) => {
    caminho(ctx, () => ctx.ellipse(ox, oy, raio, raio * aberto, 0, 0, TAU));
    pintar(ctx, aceso, CONTORNO, traco * 0.7);
    ctx.fillStyle = 'rgba(10,4,10,0.9)';
    ctx.beginPath();
    ctx.ellipse(ox + raio * 0.16, oy, raio * 0.38, raio * 0.72 * aberto, 0, 0, TAU);
    ctx.fill();
  };

  switch (forma) {
    case 'verme': {
      // corpo em tres bolas, a da frente maior: le como "cabeca + corpo"
      const onda = Math.sin(t) * r * 0.16;
      for (let i = 2; i >= 0; i--) {
        const px = -r * 0.55 + i * r * 0.55;
        const raio = r * (0.42 + i * 0.12);
        caminho(ctx, () => ctx.ellipse(px, onda * (i - 1), raio, raio * 0.92, 0, 0, TAU));
        pintar(ctx, i === 2 ? claro : cor, CONTORNO, traco);
      }
      olho(r * 0.42, -r * 0.1, r * 0.16);
      break;
    }
    case 'garra': {
      caminho(ctx, () => {
        ctx.moveTo(0, r * 0.95);
        ctx.lineTo(-r * 0.92, r * 0.1);
        ctx.lineTo(-r * 0.55, -r * 0.55);
        ctx.lineTo(-r * 0.2, -r * 0.1);
        ctx.lineTo(0, -r * 0.85);
        ctx.lineTo(r * 0.2, -r * 0.1);
        ctx.lineTo(r * 0.55, -r * 0.55);
        ctx.lineTo(r * 0.92, r * 0.1);
        ctx.closePath();
      });
      pintar(ctx, cor, CONTORNO, traco);
      brilhoDeCima(ctx, (c2) => {
        c2.moveTo(0, r * 0.9); c2.lineTo(-r * 0.9, 0); c2.lineTo(0, -r * 0.9); c2.lineTo(r * 0.9, 0);
        c2.closePath();
      }, 0.6, -r * 0.25, 0.22);
      olho(-r * 0.3, -r * 0.05, r * 0.15);
      olho(r * 0.3, -r * 0.05, r * 0.15);
      break;
    }
    case 'boca': {
      caminho(ctx, () => ctx.arc(0, 0, r * 0.92, 0, TAU));
      pintar(ctx, cor, CONTORNO, traco);
      const abre = 0.25 + 0.35 * (Math.sin(t) + 1) / 2;
      caminho(ctx, () => ctx.ellipse(0, r * 0.06, r * 0.62, r * abre, 0, 0, TAU));
      pintar(ctx, '#180a12', CONTORNO, traco * 0.6);
      ctx.fillStyle = aceso;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.34, r * 0.06 - r * abre);
        ctx.lineTo(i * r * 0.34 + r * 0.11, r * 0.06 - r * abre * 0.2);
        ctx.lineTo(i * r * 0.34 - r * 0.11, r * 0.06 - r * abre * 0.2);
        ctx.closePath(); ctx.fill();
      }
      olho(-r * 0.4, -r * 0.55, r * 0.13);
      olho(r * 0.4, -r * 0.55, r * 0.13);
      break;
    }
    case 'cranio': {
      caminho(ctx, () => {
        ctx.moveTo(-r * 0.8, r * 0.1);
        ctx.quadraticCurveTo(-r * 0.86, -r * 0.9, 0, -r * 0.9);
        ctx.quadraticCurveTo(r * 0.86, -r * 0.9, r * 0.8, r * 0.1);
        ctx.lineTo(r * 0.45, r * 0.32);
        ctx.lineTo(r * 0.4, r * 0.8);
        ctx.lineTo(-r * 0.4, r * 0.8);
        ctx.lineTo(-r * 0.45, r * 0.32);
        ctx.closePath();
      });
      pintar(ctx, cor, CONTORNO, traco);
      ctx.fillStyle = '#140a12';
      for (const lx of [-0.36, 0.36]) {
        ctx.beginPath();
        ctx.ellipse(lx * r, -r * 0.28, r * 0.22, r * 0.26, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = aceso;
      for (const lx of [-0.36, 0.36]) {
        ctx.beginPath();
        ctx.arc(lx * r + r * 0.05, -r * 0.24, r * 0.09, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = CONTORNO;
      ctx.lineWidth = traco * 0.6;
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) { ctx.moveTo(i * r * 0.26, r * 0.34); ctx.lineTo(i * r * 0.26, r * 0.78); }
      ctx.stroke();
      break;
    }
    case 'rato': {
      caminho(ctx, () => {
        ctx.moveTo(r * 0.75, r * 0.1);
        ctx.quadraticCurveTo(r * 1.25, r * 0.35 + Math.sin(t) * r * 0.3, r * 1.4, -r * 0.25);
      });
      ctx.strokeStyle = escuro; ctx.lineWidth = traco * 1.1; ctx.stroke();
      caminho(ctx, () => ctx.arc(-r * 0.5, -r * 0.5, r * 0.3, 0, TAU));
      pintar(ctx, escuro, CONTORNO, traco * 0.8);
      caminho(ctx, () => ctx.arc(r * 0.05, -r * 0.62, r * 0.26, 0, TAU));
      pintar(ctx, escuro, CONTORNO, traco * 0.8);
      caminho(ctx, () => ctx.ellipse(0, 0, r * 0.88, r * 0.6, Math.sin(t) * 0.1, 0, TAU));
      pintar(ctx, cor, CONTORNO, traco);
      olho(-r * 0.48, -r * 0.06, r * 0.14);
      ctx.fillStyle = '#fff0f6';
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, r * 0.06); ctx.lineTo(-r * 0.6, r * 0.02); ctx.lineTo(-r * 0.66, r * 0.28);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'sudario': {
      const fl = Math.sin(t * 0.6) * r * 0.1;
      caminho(ctx, () => {
        ctx.moveTo(-r * 0.82, r * 0.6 + fl);
        ctx.quadraticCurveTo(-r * 0.95, -r * 0.95, 0, -r * 0.95);
        ctx.quadraticCurveTo(r * 0.95, -r * 0.95, r * 0.82, r * 0.6 + fl);
        for (let i = 3; i >= 0; i--) {
          const px = -r * 0.82 + (i / 3) * r * 1.64;
          ctx.quadraticCurveTo(px + r * 0.2, r * (0.32 + Math.sin(t + i * 1.4) * 0.22) + fl, px, r * 0.6 + fl);
        }
        ctx.closePath();
      });
      pintar(ctx, cor, CONTORNO, traco);
      olho(-r * 0.28, -r * 0.28, r * 0.17);
      olho(r * 0.28, -r * 0.28, r * 0.17);
      break;
    }
    case 'bolha': {
      const incha = bicho && bicho.estado === 'pavio' ? 1.22 + Math.sin(t * 6) * 0.08 : 1;
      caminho(ctx, () => ctx.ellipse(0, 0, r * 0.92 * incha, r * 0.86 * incha, 0, 0, TAU));
      pintar(ctx, cor, CONTORNO, traco);
      ctx.globalAlpha = 0.4;
      caminho(ctx, () => ctx.ellipse(-r * 0.28, -r * 0.3, r * 0.26, r * 0.2, -0.5, 0, TAU));
      pintar(ctx, '#ffffff', null, 0);
      ctx.globalAlpha = 1;
      // pavio
      ctx.strokeStyle = escuro; ctx.lineWidth = traco * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.86 * incha);
      ctx.quadraticCurveTo(r * 0.2, -r * 1.2, r * 0.05, -r * 1.35);
      ctx.stroke();
      ctx.fillStyle = aceso;
      ctx.beginPath(); ctx.arc(r * 0.05, -r * 1.38, r * 0.12, 0, TAU); ctx.fill();
      break;
    }
    case 'ninho': {
      caminho(ctx, () => {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          const rr = r * (0.82 + Math.sin(a * 3 + t * 0.3) * 0.14);
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.9;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
      });
      pintar(ctx, cor, CONTORNO, traco);
      const pulso = 0.5 + 0.5 * Math.sin(t);
      caminho(ctx, () => ctx.arc(0, 0, r * (0.34 + pulso * 0.08), 0, TAU));
      pintar(ctx, aceso, CONTORNO, traco * 0.7);
      for (let i = 0; i < 3; i++) {
        const a = t * 0.4 + (i / 3) * TAU;
        caminho(ctx, () => ctx.ellipse(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.44, r * 0.16, r * 0.2, a, 0, TAU));
        pintar(ctx, claro, CONTORNO, traco * 0.6);
      }
      break;
    }
    case 'aranha': {
      ctx.strokeStyle = escuro;
      ctx.lineWidth = traco;
      for (let i = 0; i < 3; i++) {
        const a = 0.55 + i * 0.55;
        for (const lado of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const meio = Math.sin(t + i) * 0.22;
          ctx.quadraticCurveTo(
            lado * Math.cos(a) * r * 1.0, Math.sin(a) * r * 0.5 - r * 0.55 + meio * r,
            lado * Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.15);
          ctx.stroke();
        }
      }
      caminho(ctx, () => ctx.ellipse(0, r * 0.12, r * 0.6, r * 0.5, 0, 0, TAU));
      pintar(ctx, cor, CONTORNO, traco);
      caminho(ctx, () => ctx.ellipse(0, -r * 0.42, r * 0.36, r * 0.3, 0, 0, TAU));
      pintar(ctx, claro, CONTORNO, traco * 0.8);
      olho(-r * 0.14, -r * 0.46, r * 0.1);
      olho(r * 0.14, -r * 0.46, r * 0.1);
      break;
    }
    case 'chama': {
      const lamber = Math.sin(t * 2) * r * 0.14;
      caminho(ctx, () => {
        ctx.moveTo(0, r * 0.9);
        ctx.quadraticCurveTo(-r * 0.95, r * 0.15, -r * 0.3, -r * 0.4);
        ctx.quadraticCurveTo(-r * 0.16, -r * 0.85 + lamber, 0, -r * 1.05);
        ctx.quadraticCurveTo(r * 0.2, -r * 0.7 - lamber, r * 0.34, -r * 0.36);
        ctx.quadraticCurveTo(r * 0.98, r * 0.15, 0, r * 0.9);
        ctx.closePath();
      });
      pintar(ctx, cor, CONTORNO, traco);
      caminho(ctx, () => ctx.ellipse(0, r * 0.2, r * 0.3, r * 0.46, 0, 0, TAU));
      pintar(ctx, aceso, null, 0);
      olho(-r * 0.18, -r * 0.1, r * 0.1);
      olho(r * 0.2, -r * 0.14, r * 0.1);
      break;
    }
    case 'afogado': {
      caminho(ctx, () => {
        ctx.moveTo(-r * 0.72, r * 0.9);
        ctx.quadraticCurveTo(-r * 0.85, -r * 0.1, -r * 0.34, -r * 0.34);
        ctx.lineTo(r * 0.34, -r * 0.34);
        ctx.quadraticCurveTo(r * 0.85, -r * 0.1, r * 0.72, r * 0.9);
        ctx.closePath();
      });
      pintar(ctx, cor, CONTORNO, traco);
      caminho(ctx, () => ctx.ellipse(0, -r * 0.6, r * 0.42, r * 0.4, 0, 0, TAU));
      pintar(ctx, claro, CONTORNO, traco);
      olho(-r * 0.16, -r * 0.62, r * 0.12);
      olho(r * 0.16, -r * 0.62, r * 0.12);
      ctx.strokeStyle = hexA(aceso, 0.5);
      ctx.lineWidth = traco * 0.7;
      ctx.beginPath();
      for (let i = 0; i < 2; i++) {
        ctx.moveTo(-r * 0.6, r * (0.2 + i * 0.34) + Math.sin(t + i) * 2);
        ctx.lineTo(r * 0.6, r * (0.2 + i * 0.34) + Math.cos(t + i) * 2);
      }
      ctx.stroke();
      break;
    }
    case 'vespa': {
      const asa = (Math.sin(tempo * 30 + fase) + 1) / 2;
      ctx.globalAlpha = 0.45;
      for (const lado of [-1, 1]) {
        caminho(ctx, () => ctx.ellipse(lado * r * 0.5, -r * 0.42, r * 0.55, r * (0.1 + asa * 0.2), lado * 0.6, 0, TAU));
        pintar(ctx, '#ffffff', null, 0);
      }
      ctx.globalAlpha = 1;
      caminho(ctx, () => ctx.ellipse(0, 0, r * 0.62, r * 0.42, 0, 0, TAU));
      pintar(ctx, cor, CONTORNO, traco);
      ctx.fillStyle = '#1a1206';
      for (let i = -1; i <= 1; i++) ctx.fillRect(i * r * 0.28 - r * 0.06, -r * 0.36, r * 0.12, r * 0.72);
      caminho(ctx, () => ctx.arc(-r * 0.62, -r * 0.06, r * 0.24, 0, TAU));
      pintar(ctx, claro, CONTORNO, traco * 0.7);
      ctx.fillStyle = CONTORNO;
      ctx.beginPath();
      ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 0.95, -r * 0.12); ctx.lineTo(r * 0.6, r * 0.16);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'olho': {
      caminho(ctx, () => ctx.arc(0, 0, r * 0.92, 0, TAU));
      pintar(ctx, cor, CONTORNO, traco);
      const piscando = Math.sin(t * 0.6) > 0.9;
      if (!piscando) {
        caminho(ctx, () => ctx.arc(0, 0, r * 0.6, 0, TAU));
        pintar(ctx, '#f6efdf', CONTORNO, traco * 0.7);
        const ox = Math.cos(t * 0.5) * r * 0.18, oy = Math.sin(t * 0.4) * r * 0.18;
        caminho(ctx, () => ctx.arc(ox, oy, r * 0.3, 0, TAU));
        pintar(ctx, aceso, null, 0);
        ctx.fillStyle = '#0a0610';
        ctx.beginPath(); ctx.arc(ox, oy, r * 0.15, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = CONTORNO; ctx.lineWidth = traco;
        ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
      }
      break;
    }
    case 'manto': {
      caminho(ctx, () => {
        ctx.moveTo(0, -r * 1.05);
        ctx.quadraticCurveTo(r * 0.98, -r * 0.15, r * 0.68, r * 0.95);
        ctx.lineTo(-r * 0.68, r * 0.95);
        ctx.quadraticCurveTo(-r * 0.98, -r * 0.15, 0, -r * 1.05);
        ctx.closePath();
      });
      pintar(ctx, cor, CONTORNO, traco);
      caminho(ctx, () => ctx.ellipse(0, -r * 0.36, r * 0.42, r * 0.46, 0, 0, TAU));
      pintar(ctx, '#0b0410', CONTORNO, traco * 0.7);
      ctx.fillStyle = aceso;
      for (const lx of [-0.17, 0.17]) {
        ctx.beginPath();
        ctx.ellipse(lx * r, -r * 0.38, r * 0.09, r * 0.15, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    default:
      caminho(ctx, () => ctx.arc(0, 0, r * 0.85, 0, TAU));
      pintar(ctx, cor, CONTORNO, traco);
  }
  ctx.restore();
}
