// jogador.js — como ela se move. É o arquivo que decide se o jogo é bom.
//
// Números importam mais que qualquer outra coisa aqui, e todos eles foram
// escolhidos juntos: mudar a gravidade sem mudar o pulo estraga o desenho
// das fases, porque os vãos de mapas.js foram medidos com ESTES valores.
//
// Os três perdões que fazem um jogo de plataforma parecer justo:
//   TEMPO DE COIOTE  ela ainda pode pular por 0,10 s depois de sair do
//                    chão. Sem isso, pular na beirada falha e o jogador
//                    jura que apertou.
//   PULO NA FILA     apertar até 0,12 s ANTES de aterrissar já conta. Sem
//                    isso, encadear pulos exige precisão de milissegundo.
//   PULO VARIÁVEL    soltar o botão no meio da subida corta a velocidade.
//                    É o que dá pulo curto e pulo longo com um botão só.
//
// A colisão resolve X e Y em passos SEPARADOS. Resolver junto faz a
// personagem grudar em quina e escalar parede sozinha.

import { clamp } from '../core/gfx.js';
import { T, FRAGIL } from '../world/tiles.js';
import { Boneco } from '../art/rig.js';
import { audio } from '../core/audio.js';

export const GRAVIDADE = 1200;
export const PULO = 350;              // ~51 px de altura = 3,2 tiles
export const VEL_ANDAR = 92;
export const VEL_CORRER = 158;
export const ACEL_CHAO = 900;
export const ACEL_AR = 560;
export const ATRITO_CHAO = 1500;
export const ATRITO_AR = 220;
export const VEL_MAX_QUEDA = 460;
export const COIOTE = 0.10;
export const FILA_PULO = 0.12;
export const PULO_PISAO = 300;        // quique ao pisar num bicho

export const LARG = 10;
export const ALT = 34;

export class Jogador {
  constructor(look) {
    this.rig = new Boneco(look);
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.ax = 0;
    this.olhar = 1;                 // 1 direita, -1 esquerda
    this.noChao = false;
    this.foiChao = 0;               // tempo de coiote restante
    this.filaPulo = 0;
    this.segurandoPulo = false;
    this.corações = 3;
    this.invul = 0;
    this.atordoada = 0;
    this.agachada = false;
    this.viva = true;
    this.morrendo = 0;
    this.plataforma = null;         // plataforma móvel embaixo dos pés
    this.aterrissou = 0;
    this.tempoNoAr = 0;
    this.congelada = 0;             // trava o controle em cutscene
    this.caiu = false;              // caiu na água ou no vazio
    this.passoT = 0;
  }

  definirAparencia(look) { this.rig.definirAparencia(look); }

  nascer(x, y, corações = 3) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.viva = true; this.morrendo = 0;
    this.invul = 1.2;
    this.atordoada = 0;
    this.caiu = false;
    this.plataforma = null;
    this.corações = corações;
    this.rig.tocar('parada', true);
  }

  get caixa() {
    return { x0: this.x - LARG / 2, x1: this.x + LARG / 2, y0: this.y - ALT, y1: this.y };
  }

  // -------------------------------------------------------------------------
  // colisão com a grade
  // -------------------------------------------------------------------------
  _solidoNaCaixa(mapa, x0, y0, x1, y1) {
    const tx0 = Math.floor(x0 / T), tx1 = Math.floor((x1 - 0.001) / T);
    const ty0 = Math.floor(y0 / T), ty1 = Math.floor((y1 - 0.001) / T);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (mapa.solido(tx, ty)) return true;
      }
    }
    return false;
  }

  _moverX(mapa, dx) {
    if (!dx) return;
    this.x += dx;
    const c = this.caixa;
    if (!this._solidoNaCaixa(mapa, c.x0, c.y0, c.x1, c.y1)) return;
    // Empurra de volta até sair. Passo de 1 px: a personagem nunca anda
    // rápido o bastante (2,6 px por quadro) para valer a pena bissecionar.
    const passo = dx > 0 ? -1 : 1;
    for (let i = 0; i < Math.ceil(Math.abs(dx)) + 2; i++) {
      this.x += passo;
      const c2 = this.caixa;
      if (!this._solidoNaCaixa(mapa, c2.x0, c2.y0, c2.x1, c2.y1)) break;
    }
    this.vx = 0;
  }

  _moverY(mapa, dy, moveis, fragilTocado) {
    if (!dy) return;
    const antesY = this.y;
    this.y += dy;
    const c = this.caixa;

    if (this._solidoNaCaixa(mapa, c.x0, c.y0, c.x1, c.y1)) {
      const passo = dy > 0 ? -1 : 1;
      for (let i = 0; i < Math.ceil(Math.abs(dy)) + 2; i++) {
        this.y += passo;
        const c2 = this.caixa;
        if (!this._solidoNaCaixa(mapa, c2.x0, c2.y0, c2.x1, c2.y1)) break;
      }
      if (dy > 0) {
        this._aterrissar();
        // Nuvem frágil: só começa a desmanchar quando o pé encosta.
        const tx0 = Math.floor((this.x - LARG / 2) / T);
        const tx1 = Math.floor((this.x + LARG / 2 - 0.001) / T);
        const ty = Math.floor((this.y + 1) / T);
        for (let tx = tx0; tx <= tx1; tx++) {
          if (mapa.em(tx, ty) === FRAGIL) fragilTocado(tx, ty);
        }
      } else this.vy = 0;
      return;
    }

    // plataforma de uma via: só existe quando ela está DESCENDO e os pés
    // vinham de cima. É isso que permite atravessar por baixo.
    if (dy > 0) {
      const tx0 = Math.floor((this.x - LARG / 2) / T);
      const tx1 = Math.floor((this.x + LARG / 2 - 0.001) / T);
      const tyNovo = Math.floor(this.y / T);
      const tyVelho = Math.floor(antesY / T);
      for (let ty = tyVelho; ty <= tyNovo; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (!mapa.plataforma(tx, ty)) continue;
          const topo = ty * T;
          if (antesY <= topo + 0.5 && this.y >= topo) {
            this.y = topo;
            this._aterrissar();
            return;
          }
        }
      }
      // plataformas móveis, que não vivem na grade
      for (const m of moveis) {
        if (this.x + LARG / 2 < m.x || this.x - LARG / 2 > m.x + m.w) continue;
        if (antesY <= m.y + 0.5 && this.y >= m.y && this.y <= m.y + 10) {
          this.y = m.y;
          this.plataforma = m;
          this._aterrissar();
          return;
        }
      }
    }
  }

  _aterrissar() {
    if (!this.noChao && this.vy > 120) {
      this.aterrissou = 0.18;
      if (this.tempoNoAr > 0.25) audio.aterrissar();
      this.pousou = this.vy;
    }
    this.vy = 0;
    this.noChao = true;
    this.foiChao = COIOTE;
    this.tempoNoAr = 0;
  }

  // -------------------------------------------------------------------------
  atualizar(dt, entrada, fase, fx) {
    const mapa = fase.mapa;
    if (this.morrendo > 0) {
      this.morrendo -= dt;
      this.vy = Math.min(this.vy + GRAVIDADE * dt, VEL_MAX_QUEDA);
      this.y += this.vy * dt;
      this.rig.atualizar(dt, { ax: 0, vy: this.vy });
      return;
    }

    const podeAgir = this.congelada <= 0 && this.atordoada <= 0;
    let eixo = podeAgir ? entrada.eixoX() : 0;
    if (Math.abs(eixo) < 0.2) eixo = 0;
    const correndo = podeAgir && entrada.isDown('run');
    this.agachada = podeAgir && this.noChao && entrada.isDown('down') && eixo === 0;
    if (this.agachada) eixo = 0;

    // --- horizontal ---
    const alvo = eixo * (correndo ? VEL_CORRER : VEL_ANDAR);
    const acel = this.noChao ? ACEL_CHAO : ACEL_AR;
    const antesVx = this.vx;
    if (eixo !== 0) {
      this.vx += Math.sign(alvo - this.vx) * acel * dt;
      // não passa do alvo (senão vibra em torno dele)
      if ((alvo - this.vx) * Math.sign(alvo) < 0) this.vx = alvo;
      this.olhar = eixo > 0 ? 1 : -1;
    } else {
      const at = (this.noChao ? ATRITO_CHAO : ATRITO_AR) * dt;
      if (Math.abs(this.vx) <= at) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * at;
    }
    this.ax = (this.vx - antesVx) / Math.max(dt, 0.0001);

    // --- pulo ---
    if (podeAgir && entrada.pressed('jump')) this.filaPulo = FILA_PULO;
    this.filaPulo = Math.max(0, this.filaPulo - dt);
    this.foiChao = Math.max(0, this.foiChao - dt);

    if (this.filaPulo > 0 && this.foiChao > 0) {
      this.vy = -PULO;
      this.noChao = false;
      this.foiChao = 0;
      this.filaPulo = 0;
      this.segurandoPulo = true;
      this.plataforma = null;
      audio.pular();
      if (fx) fx.pulo(this.x, this.y, '#ffffff');
    }
    // Soltar o botão no meio da subida corta o pulo. O corte é multiplicativo
    // (não zera) para que soltar no fim da subida não trave a personagem no ar.
    if (this.segurandoPulo && !entrada.isDown('jump')) {
      if (this.vy < -90) this.vy = -90;
      this.segurandoPulo = false;
    }
    if (this.vy >= 0) this.segurandoPulo = false;

    // --- vertical ---
    // Gravidade menor no topo do arco: dá aquela "flutuada" que faz o pulo
    // parecer controlável mesmo sendo balístico.
    const g = Math.abs(this.vy) < 70 ? GRAVIDADE * 0.72 : GRAVIDADE;
    this.vy = Math.min(this.vy + g * dt, VEL_MAX_QUEDA);

    // --- plataforma móvel carrega junto ---
    const estavaNoChao = this.noChao;
    if (this.plataforma) {
      const m = this.plataforma;
      this.x += m.ultimoDX || 0;
      this.y += m.ultimoDY || 0;
      // saiu de cima dela?
      if (this.x + LARG / 2 < m.x - 2 || this.x - LARG / 2 > m.x + m.w + 2 ||
          Math.abs(this.y - m.y) > 8) this.plataforma = null;
    }

    this.noChao = false;
    this._moverX(mapa, this.vx * dt);
    this._moverY(mapa, this.vy * dt, fase.moveis, (tx, ty) => {
      const f = fase.fragilAtivos && fase.fragilAtivos.get(ty * mapa.l + tx);
      if (f && f.vida > 0 && f.tocado <= 0) f.tocado = 0.45;
    });

    // Ainda no chão? Um raio de 2 px abaixo dos pés. Sem esta checagem, andar
    // numa superfície plana alterna entre "no chão" e "no ar" a cada quadro.
    if (!this.noChao && this.vy >= 0) {
      const c = this.caixa;
      if (this._solidoNaCaixa(mapa, c.x0, c.y1, c.x1, c.y1 + 2)) {
        this.noChao = true; this.foiChao = COIOTE;
      } else if (this.plataforma) {
        this.noChao = true; this.foiChao = COIOTE;
      }
    }
    if (!this.noChao) {
      this.tempoNoAr += dt;
      this.plataforma = null;
    }

    // --- molas ---
    for (const m of fase.molas) {
      if (this.vy < 0) break;
      if (this.x + LARG / 2 < m.x || this.x - LARG / 2 > m.x + T) continue;
      if (this.y >= m.y + 4 && this.y <= m.y + T + 6) {
        this.y = m.y + 4;
        this.vy = -PULO * 1.62;
        this.noChao = false;
        this.segurandoPulo = false;
        m.comp = 0.28;
        audio.mola();
        if (fx) fx.brilho(this.x, this.y, 10, ['#fff6c9', '#ffffff']);
      }
    }

    // --- perigos ---
    this.invul = Math.max(0, this.invul - dt);
    this.atordoada = Math.max(0, this.atordoada - dt);
    this.congelada = Math.max(0, this.congelada - dt);
    this.aterrissou = Math.max(0, this.aterrissou - dt);

    // Espinho tira um coração e empurra. Água e buraco NÃO matam: custam um
    // coração e devolvem a jogadora ao último ponto seguro. Morrer de vez
    // num presente de aniversário é o tipo de frustração que faz a pessoa
    // largar o controle — e o objetivo aqui é ela chegar ao fim.
    const tPe = Math.floor((this.y - 2) / T);
    const tMeio = Math.floor((this.y - ALT / 2) / T);
    const tCol = Math.floor(this.x / T);
    if (mapa.espinho(tCol, tPe)) this.machucar(fx, 1);
    if (mapa.agua(tCol, tPe) || mapa.agua(tCol, tMeio) || this.y > mapa.alturaPx + 40) {
      this.caiu = true;
    }

    // --- poeira do passo ---
    if (this.noChao && Math.abs(this.vx) > 30) {
      this.passoT += dt * Math.abs(this.vx) / 60;
      if (this.passoT >= 1) {
        this.passoT = 0;
        if (fx) fx.poeira(this.x - this.olhar * 4, this.y, 2, '#ffffff');
        audio.passo();
      }
    }

    this._animar(dt, eixo, correndo);
  }

  _animar(dt, eixo, correndo) {
    if (this.atordoada > 0) this.rig.tocar('machucada');
    else if (this.aterrissou > 0) this.rig.tocar('aterrissando');
    else if (!this.noChao) this.rig.tocar(this.vy < -20 ? 'pulando' : 'caindo');
    else if (this.agachada) this.rig.tocar('agachada');
    else if (Math.abs(this.vx) > 8) {
      this.rig.tocar(Math.abs(this.vx) > VEL_ANDAR + 12 ? 'correndo' : 'andando');
      this.rig.velAnim = clamp(Math.abs(this.vx) / (correndo ? VEL_CORRER : VEL_ANDAR), 0.55, 1.5);
    } else { this.rig.tocar('parada'); this.rig.velAnim = 1; }

    this.rig.atualizar(dt, { ax: -this.ax * this.olhar, vy: this.vy });
  }

  machucar(fx, quanto = 1) {
    if (this.invul > 0 || this.morrendo > 0) return false;
    this.corações -= quanto;
    this.invul = 1.4;
    this.atordoada = 0.45;
    this.vy = -190;
    this.vx = -this.olhar * 110;
    this.noChao = false;
    audio.dano();
    if (fx) fx.poeira(this.x, this.y - ALT / 2, 8, '#ffb0b0');
    if (this.corações <= 0) {
      this.corações = 0;
      this.morrendo = 1.1;
      this.vy = -260;
      audio.morte();
    }
    return true;
  }

  quicar(fx) {
    this.vy = -PULO_PISAO;
    this.noChao = false;
    this.segurandoPulo = false;
    this.tempoNoAr = 0;
    audio.pisao();
    if (fx) fx.brilho(this.x, this.y, 8, ['#ffffff', '#ffe98a']);
  }

  desenhar(ctx, camX, camY) {
    // Piscada de invulnerabilidade: some e volta a 12 Hz. Alpha contínuo
    // seria mais bonito e MUITO menos legível.
    if (this.invul > 0 && Math.floor(this.invul * 12) % 2 === 0 && this.morrendo <= 0) return;
    this.rig.alpha = this.morrendo > 0 ? clamp(this.morrendo, 0, 1) : 1;
    this.rig.desenhar(ctx, this.x - camX, this.y - camY, this.olhar);
  }
}

export default Jogador;
