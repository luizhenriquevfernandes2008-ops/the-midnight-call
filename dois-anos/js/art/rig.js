// rig.js — o esqueleto animado.
//
// As peças montadas por pessoa.js entram aqui e viram gente que anda. Não
// existe folha de sprites: cada animação é um punhado de POSES-CHAVE e o
// rig interpola entre elas. Vantagens que valem o trabalho:
//   - a animação roda a 60 fps de verdade, não a 8 quadros por segundo;
//   - trocar o cabelo não obriga a redesenhar 40 quadros;
//   - dá pra somar coisas em cima da pose (o cabelo balançando, a cabeça
//     virando pra onde ela olha) sem tocar na animação.
//
// CONVENÇÃO DE ÂNGULO: todo ângulo de pose é em graus e POSITIVO PARA A
// FRENTE (a direção para onde a personagem olha). O rig nega na hora de
// girar, porque no canvas o positivo é horário e a frente é +x. Se essa
// convenção se perder, as pernas andam para trás — já aconteceu.

import { carimbar, DEG } from './pixel.js';
import { montarPecas, QUADRIL_Y, OMBRO_OFF, CABECA_OFF, BRACO_X,
  BRACO_X_TRAS, PERNA_X, COXA, CANELA, BRACO, ANTEBRACO } from './pessoa.js';
import { clamp, lerp } from '../core/gfx.js';

const ZERO = {
  bob: 0, inclinacao: 0, cabeca: 0,
  coxaF: 0, canelaF: 0, coxaT: 0, canelaT: 0,
  bracoF: 0, anteF: 0, bracoT: 0, anteT: 0,
  bracoAbre: 0,     // afasta os braços do tronco (usado no susto e na queda)
};

function pose(o) { return { ...ZERO, ...o }; }

// ---------------------------------------------------------------------------
// as animações
// ---------------------------------------------------------------------------
// { loop, dur, quadros: [{ t, p }] } — t vai de 0 a 1.

const ANIMS = {
  parada: {
    loop: true, dur: 2.6, quadros: [
      { t: 0.0, p: pose({ bob: 0, bracoF: 3, anteF: 4, bracoT: -3, anteT: 5, cabeca: 0 }) },
      { t: 0.5, p: pose({ bob: -1, bracoF: 6, anteF: 7, bracoT: -6, anteT: 8, cabeca: -1 }) },
      { t: 1.0, p: pose({ bob: 0, bracoF: 3, anteF: 4, bracoT: -3, anteT: 5, cabeca: 0 }) },
    ],
  },

  // Ciclo de caminhada clássico: contato, passagem, contato invertido,
  // passagem invertida. O `bob` sobe na passagem — é o que dá o peso.
  andando: {
    loop: true, dur: 0.72, quadros: [
      { t: 0.00, p: pose({ coxaF: 24, canelaF: -10, coxaT: -20, canelaT: -6,
                           bracoF: -18, anteF: -8, bracoT: 20, anteT: 10, bob: 0 }) },
      { t: 0.25, p: pose({ coxaF: 6, canelaF: -4, coxaT: -4, canelaT: -34,
                           bracoF: -6, anteF: -4, bracoT: 6, anteT: 6, bob: -2 }) },
      { t: 0.50, p: pose({ coxaF: -20, canelaF: -6, coxaT: 24, canelaT: -10,
                           bracoF: 20, anteF: 10, bracoT: -18, anteT: -8, bob: 0 }) },
      { t: 0.75, p: pose({ coxaF: -4, canelaF: -34, coxaT: 6, canelaT: -4,
                           bracoF: 6, anteF: 6, bracoT: -6, anteT: -4, bob: -2 }) },
      { t: 1.00, p: pose({ coxaF: 24, canelaF: -10, coxaT: -20, canelaT: -6,
                           bracoF: -18, anteF: -8, bracoT: 20, anteT: 10, bob: 0 }) },
    ],
  },

  correndo: {
    loop: true, dur: 0.44, quadros: [
      { t: 0.00, p: pose({ inclinacao: 9, coxaF: 46, canelaF: -34, coxaT: -34, canelaT: -30,
                           bracoF: -46, anteF: -50, bracoT: 42, anteT: -50, bob: 0 }) },
      { t: 0.25, p: pose({ inclinacao: 9, coxaF: 14, canelaF: -12, coxaT: -10, canelaT: -70,
                           bracoF: -14, anteF: -60, bracoT: 14, anteT: -60, bob: -3 }) },
      { t: 0.50, p: pose({ inclinacao: 9, coxaF: -34, canelaF: -30, coxaT: 46, canelaT: -34,
                           bracoF: 42, anteF: -50, bracoT: -46, anteT: -50, bob: 0 }) },
      { t: 0.75, p: pose({ inclinacao: 9, coxaF: -10, canelaF: -70, coxaT: 14, canelaT: -12,
                           bracoF: 14, anteF: -60, bracoT: -14, anteT: -60, bob: -3 }) },
      { t: 1.00, p: pose({ inclinacao: 9, coxaF: 46, canelaF: -34, coxaT: -34, canelaT: -30,
                           bracoF: -46, anteF: -50, bracoT: 42, anteT: -50, bob: 0 }) },
    ],
  },

  // Subindo. Pernas recolhidas e braços abertos pra cima: é a pose que faz
  // o pulo parecer alto mesmo quando ele tem 5 pixels.
  pulando: {
    loop: false, dur: 0.3, quadros: [
      { t: 0.0, p: pose({ inclinacao: -6, coxaF: 34, canelaF: -50, coxaT: -14, canelaT: -40,
                          bracoF: -80, anteF: -30, bracoT: -66, anteT: -26, bob: 1 }) },
      { t: 1.0, p: pose({ inclinacao: -4, coxaF: 26, canelaF: -40, coxaT: -20, canelaT: -30,
                          bracoF: -96, anteF: -20, bracoT: -80, anteT: -18, bob: 0 }) },
    ],
  },

  caindo: {
    loop: false, dur: 0.35, quadros: [
      { t: 0.0, p: pose({ inclinacao: 4, coxaF: 12, canelaF: -18, coxaT: -22, canelaT: -14,
                          bracoF: -54, anteF: -14, bracoT: -46, anteT: -12, bracoAbre: 1 }) },
      { t: 1.0, p: pose({ inclinacao: 6, coxaF: 18, canelaF: -12, coxaT: -26, canelaT: -10,
                          bracoF: -60, anteF: -8, bracoT: -52, anteT: -8, bracoAbre: 1 }) },
    ],
  },

  aterrissando: {
    loop: false, dur: 0.18, quadros: [
      { t: 0.0, p: pose({ bob: 5, inclinacao: 12, coxaF: 30, canelaF: -44, coxaT: 24, canelaT: -40,
                          bracoF: -30, anteF: -34, bracoT: 26, anteT: -30 }) },
      { t: 1.0, p: pose({ bob: 0, inclinacao: 2, coxaF: 6, canelaF: -6, coxaT: 4, canelaT: -6,
                          bracoF: -6, anteF: -6, bracoT: 6, anteT: -6 }) },
    ],
  },

  agachada: {
    loop: false, dur: 0.14, quadros: [
      { t: 0.0, p: pose({ bob: 4, inclinacao: 14, coxaF: 44, canelaF: -66, coxaT: 38, canelaT: -60,
                          bracoF: 10, anteF: -30, bracoT: -8, anteT: -26 }) },
      { t: 1.0, p: pose({ bob: 6, inclinacao: 16, coxaF: 48, canelaF: -70, coxaT: 42, canelaT: -64,
                          bracoF: 12, anteF: -32, bracoT: -10, anteT: -28 }) },
    ],
  },

  machucada: {
    loop: false, dur: 0.5, quadros: [
      { t: 0.0, p: pose({ inclinacao: -16, cabeca: -10, coxaF: -20, canelaF: -20, coxaT: 16, canelaT: -18,
                          bracoF: 40, anteF: -50, bracoT: 34, anteT: -46, bracoAbre: 1 }) },
      { t: 1.0, p: pose({ inclinacao: -6, cabeca: -4, coxaF: -8, canelaF: -12, coxaT: 8, canelaT: -12,
                          bracoF: 20, anteF: -30, bracoT: 16, anteT: -28, bracoAbre: 1 }) },
    ],
  },

  comemorando: {
    loop: true, dur: 1.1, quadros: [
      { t: 0.0, p: pose({ bob: 0, cabeca: -4, bracoF: -150, anteF: -20, bracoT: -140, anteT: -18 }) },
      { t: 0.5, p: pose({ bob: -3, cabeca: -6, bracoF: -164, anteF: -8, bracoT: -152, anteT: -8 }) },
      { t: 1.0, p: pose({ bob: 0, cabeca: -4, bracoF: -150, anteF: -20, bracoT: -140, anteT: -18 }) },
    ],
  },

  acenando: {
    loop: true, dur: 0.9, quadros: [
      { t: 0.0, p: pose({ bracoF: -140, anteF: -30, bracoT: -6, anteT: 6, cabeca: -3 }) },
      { t: 0.5, p: pose({ bracoF: -140, anteF: 24, bracoT: -6, anteT: 6, cabeca: -3 }) },
      { t: 1.0, p: pose({ bracoF: -140, anteF: -30, bracoT: -6, anteT: 6, cabeca: -3 }) },
    ],
  },

  // Ele preso na gaiola: encolhido, flutuando.
  flutuando: {
    loop: true, dur: 3.0, quadros: [
      { t: 0.0, p: pose({ bob: 0, inclinacao: 6, cabeca: 4, coxaF: 40, canelaF: -60,
                          coxaT: 34, canelaT: -56, bracoF: 16, anteF: -40, bracoT: -14, anteT: -36 }) },
      { t: 0.5, p: pose({ bob: -2, inclinacao: 3, cabeca: 2, coxaF: 44, canelaF: -64,
                          coxaT: 38, canelaT: -60, bracoF: 20, anteF: -44, bracoT: -18, anteT: -40 }) },
      { t: 1.0, p: pose({ bob: 0, inclinacao: 6, cabeca: 4, coxaF: 40, canelaF: -60,
                          coxaT: 34, canelaT: -56, bracoF: 16, anteF: -40, bracoT: -14, anteT: -36 }) },
    ],
  },
};

export const NOMES_ANIM = Object.keys(ANIMS);

function interpolar(a, b, t) {
  const r = {};
  for (const k in ZERO) r[k] = lerp(a[k], b[k], t);
  return r;
}

function amostrar(anim, t) {
  const q = anim.quadros;
  for (let i = 0; i < q.length - 1; i++) {
    if (t >= q[i].t && t <= q[i + 1].t) {
      const span = q[i + 1].t - q[i].t;
      const k = span <= 0 ? 0 : (t - q[i].t) / span;
      return interpolar(q[i].p, q[i + 1].p, k);
    }
  }
  return { ...q[q.length - 1].p };
}

export class Boneco {
  constructor(look) {
    this.definirAparencia(look);
    this.anim = 'parada';
    this.t = 0;
    this.velAnim = 1;
    this.pose = { ...ZERO };
    this.mistura = null;     // pose de onde estamos vindo, para transição
    this.misturaT = 0;
    this.cabeloAng = 0;      // balanço do cabelo
    this.cabeloVel = 0;
    this.piscarEm = 1.5 + Math.random() * 3;
    this.piscando = 0;
    this.alpha = 1;
    this.olharY = 0;         // -1 olhando pra cima, +1 pra baixo
  }

  definirAparencia(look) {
    this.look = { ...look };
    this.p = montarPecas(this.look);
  }

  tocar(nome, forcar = false) {
    if (this.anim === nome && !forcar) return;
    if (!ANIMS[nome]) return;
    // Guarda a pose atual e mistura em 0,1 s. Sem isso, sair de "correndo"
    // para "pulando" troca as pernas de lugar num único quadro e a
    // personagem pisca.
    this.mistura = { ...this.pose };
    this.misturaT = 1;
    this.anim = nome;
    this.t = 0;
  }

  atualizar(dt, ctx = {}) {
    const anim = ANIMS[this.anim] || ANIMS.parada;
    const dur = anim.dur / Math.max(0.05, this.velAnim);
    this.t += dt / dur;
    if (this.t > 1) this.t = anim.loop ? this.t % 1 : 1;

    let p = amostrar(anim, this.t);
    if (this.misturaT > 0) {
      this.misturaT = Math.max(0, this.misturaT - dt / 0.1);
      p = interpolar(p, this.mistura, this.misturaT);
    }
    this.pose = p;

    // Balanço do cabelo: uma mola puxada pela aceleração horizontal e pela
    // velocidade vertical. É o detalhe que mais faz falta quando não tem —
    // sem ele o cabelo longo parece uma placa pregada na nuca.
    const alvo = clamp((ctx.ax || 0) * 0.05 + (ctx.vy || 0) * 0.035, -26, 26);
    const k = 26, amort = 7.5;
    this.cabeloVel += (alvo - this.cabeloAng) * k * dt - this.cabeloVel * amort * dt;
    this.cabeloAng += this.cabeloVel * dt;
    this.cabeloAng = clamp(this.cabeloAng, -34, 34);

    // piscada
    this.piscarEm -= dt;
    if (this.piscarEm <= 0) {
      this.piscando = 0.11;
      this.piscarEm = 2.4 + Math.random() * 4.2;
    }
    if (this.piscando > 0) this.piscando -= dt;
  }

  // ---- desenho ------------------------------------------------------------

  _membro(ctx, sprSup, sprInf, sprPonta, x, angSup, angInf, comprSup, comprInf) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate(-angSup * DEG);
    carimbar(ctx, sprSup);
    ctx.translate(0, comprSup);
    ctx.rotate(-angInf * DEG);
    carimbar(ctx, sprInf);
    if (sprPonta) {
      ctx.translate(0, comprInf);
      carimbar(ctx, sprPonta);
    }
    ctx.restore();
  }

  // Rabo de cavalo / trança: um apêndice preso na nuca que balança junto
  // com a mola do cabelo, só que com mais amplitude — é a ponta do chicote.
  _rabo(ctx, P) {
    ctx.save();
    ctx.translate(P.raboAncora[0] - 10, P.raboAncora[1] - 14);
    ctx.rotate((this.cabeloAng * 1.4 + P.raboBase) * DEG);
    carimbar(ctx, P.rabo);
    ctx.restore();
  }

  _cadeiaCabeca(ctx, p) {
    ctx.rotate(-p.inclinacao * DEG);
    ctx.translate(0, CABECA_OFF);
    ctx.rotate(-(p.cabeca + this.olharY * -6) * DEG);
  }

  desenhar(ctx, x, y, flip = 1) {
    const P = this.p, p = this.pose;
    const a0 = ctx.globalAlpha;
    if (this.alpha !== 1) ctx.globalAlpha = a0 * this.alpha;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(x), Math.round(y));
    if (flip === -1) ctx.scale(-1, 1);
    if (P.escala !== 1) ctx.scale(P.escala, P.escala);
    ctx.translate(0, QUADRIL_Y + p.bob);

    // 1. cabelo de trás — precisa da transformação da cabeça, mas vai por
    //    baixo de tudo. Por isso a cadeia é percorrida duas vezes.
    if (P.cabeloTras || (P.rabo && !P.raboNaFrente)) {
      ctx.save();
      this._cadeiaCabeca(ctx, p);
      ctx.save();
      ctx.rotate(this.cabeloAng * 0.6 * DEG);
      if (P.cabeloTras) carimbar(ctx, P.cabeloTras);
      ctx.restore();
      if (P.rabo && !P.raboNaFrente) this._rabo(ctx, P);
      ctx.restore();
    }

    // 2. perna de trás
    this._membro(ctx, P.coxaT, P.canelaT, P.peT, -PERNA_X,
      p.coxaT, p.canelaT, COXA, CANELA);

    // 3. perna da frente
    this._membro(ctx, P.coxa, P.canela, P.pe, PERNA_X,
      p.coxaF, p.canelaF, COXA, CANELA);

    // 4. saia por cima das duas coxas
    if (P.saia) {
      ctx.save();
      ctx.rotate(-p.inclinacao * 0.5 * DEG);
      ctx.translate(0, -2);
      carimbar(ctx, P.saia);
      ctx.restore();
    }

    // 5. braço de trás, tronco, braço da frente
    ctx.save();
    ctx.rotate(-p.inclinacao * DEG);

    ctx.save();
    ctx.translate(0, OMBRO_OFF);
    this._membro(ctx, P.bracoSupT, P.bracoInfT, P.maoT,
      -BRACO_X_TRAS - p.bracoAbre, p.bracoT, p.anteT, BRACO, ANTEBRACO);
    ctx.restore();

    carimbar(ctx, P.tronco);

    ctx.save();
    ctx.translate(0, OMBRO_OFF);
    this._membro(ctx, P.bracoSup, P.bracoInf, P.mao,
      BRACO_X + p.bracoAbre, p.bracoF, p.anteF, BRACO, ANTEBRACO);
    ctx.restore();
    ctx.restore();

    // 6. cabeça e cabelo da frente
    ctx.save();
    this._cadeiaCabeca(ctx, p);
    carimbar(ctx, this.piscando > 0 ? P.cabecaPiscando : P.cabeca);
    carimbar(ctx, P.cabelo);
    if (P.acessorios) carimbar(ctx, P.acessorios);
    if (P.rabo && P.raboNaFrente) this._rabo(ctx, P);
    ctx.restore();

    ctx.restore();
    ctx.globalAlpha = a0;
  }

  // Só a cabeça, no tamanho que a interface pedir. Usado no editor e na
  // caixa de diálogo.
  desenharCabeca(ctx, x, y, escala = 1, flip = 1) {
    const P = this.p;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(escala * flip, escala);
    if (P.cabeloTras) carimbar(ctx, P.cabeloTras);
    if (P.rabo && !P.raboNaFrente) this._rabo(ctx, P);
    carimbar(ctx, this.piscando > 0 ? P.cabecaPiscando : P.cabeca);
    carimbar(ctx, P.cabelo);
    if (P.acessorios) carimbar(ctx, P.acessorios);
    if (P.rabo && P.raboNaFrente) this._rabo(ctx, P);
    ctx.restore();
  }
}

export default Boneco;
