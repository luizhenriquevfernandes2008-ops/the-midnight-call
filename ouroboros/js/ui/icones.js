// icones.js — os simbolos das reliquias e melhorias, desenhados a mao em
// caminho vetorial. Cada um cabe numa caixa de -1 a 1 e e desenhado no
// contexto que voce passar: serve para o HUD (canvas 2D do jogo) e para a
// textura das cartas 3D, sem duplicar arte.

function contorno(c, cor, larg) {
  c.strokeStyle = cor;
  c.lineWidth = larg;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke();
}

const DESENHOS = {
  presa(c) {
    c.beginPath();
    c.moveTo(-0.55, -0.75); c.quadraticCurveTo(-0.1, -0.3, 0, 0.85);
    c.quadraticCurveTo(0.15, -0.3, 0.55, -0.75);
    c.quadraticCurveTo(0, -0.5, -0.55, -0.75);
    c.closePath(); c.fill();
  },
  escama(c) {
    c.beginPath();
    c.moveTo(0, -0.85); c.quadraticCurveTo(0.9, -0.2, 0, 0.85);
    c.quadraticCurveTo(-0.9, -0.2, 0, -0.85);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(-0.35, 0.15); c.quadraticCurveTo(0, -0.15, 0.35, 0.15);
    contorno(c, 'rgba(0,0,0,0.45)', 0.1);
  },
  coracao(c) {
    c.beginPath();
    c.moveTo(0, 0.8);
    c.bezierCurveTo(-1.15, 0.05, -0.62, -0.9, 0, -0.35);
    c.bezierCurveTo(0.62, -0.9, 1.15, 0.05, 0, 0.8);
    c.closePath(); c.fill();
  },
  coracaoNegro(c) {
    DESENHOS.coracao(c);
    c.beginPath();
    c.moveTo(-0.1, -0.35); c.lineTo(0.12, 0.05); c.lineTo(-0.12, 0.2); c.lineTo(0.1, 0.55);
    contorno(c, 'rgba(0,0,0,0.7)', 0.12);
  },
  fome(c) {
    c.beginPath(); c.arc(0, 0, 0.8, 0.35, Math.PI - 0.35); c.stroke();
    c.beginPath(); c.arc(0, 0, 0.8, Math.PI + 0.35, -0.35); c.stroke();
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(i * 0.3, -0.28); c.lineTo(i * 0.3 + 0.09, 0.02); c.lineTo(i * 0.3 - 0.09, 0.02);
      c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(i * 0.3, 0.28); c.lineTo(i * 0.3 + 0.09, -0.02); c.lineTo(i * 0.3 - 0.09, -0.02);
      c.closePath(); c.fill();
    }
  },
  lingua(c) {
    c.beginPath();
    c.moveTo(0, 0.85); c.quadraticCurveTo(-0.1, 0, -0.05, -0.25);
    c.lineTo(-0.55, -0.8);
    c.moveTo(-0.05, -0.25); c.lineTo(0.5, -0.8);
    contorno(c, c.fillStyle, 0.2);
  },
  espinho(c) {
    for (const dx of [-0.5, 0, 0.5]) {
      c.beginPath();
      c.moveTo(dx - 0.22, 0.7); c.lineTo(dx, -0.8); c.lineTo(dx + 0.22, 0.7);
      c.closePath(); c.fill();
    }
  },
  corda(c) {
    c.beginPath(); c.arc(0, -0.28, 0.42, 0, Math.PI * 2); contorno(c, c.fillStyle, 0.18);
    c.beginPath(); c.moveTo(0, 0.14); c.quadraticCurveTo(0.18, 0.5, 0, 0.85);
    contorno(c, c.fillStyle, 0.18);
  },
  pele(c) {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      const o = -0.5 + i * 0.5;
      c.moveTo(-0.8, o + 0.15);
      c.quadraticCurveTo(-0.25, o - 0.35, 0.1, o + 0.1);
      c.quadraticCurveTo(0.5, o + 0.45, 0.85, o - 0.05);
      contorno(c, c.fillStyle, 0.14);
    }
  },
  gelo(c) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      c.beginPath();
      c.moveTo(-Math.cos(a) * 0.85, -Math.sin(a) * 0.85);
      c.lineTo(Math.cos(a) * 0.85, Math.sin(a) * 0.85);
      contorno(c, c.fillStyle, 0.16);
    }
    c.beginPath(); c.arc(0, 0, 0.16, 0, Math.PI * 2); c.fill();
  },
  olho(c) {
    c.beginPath();
    c.moveTo(-0.9, 0); c.quadraticCurveTo(0, -0.85, 0.9, 0);
    c.quadraticCurveTo(0, 0.85, -0.9, 0);
    c.closePath(); contorno(c, c.fillStyle, 0.15);
    c.beginPath(); c.ellipse(0, 0, 0.16, 0.38, 0, 0, Math.PI * 2); c.fill();
  },
  ima(c) {
    c.beginPath();
    c.arc(0, 0.1, 0.62, Math.PI, 0);
    c.lineTo(0.62, 0.62); c.lineTo(0.28, 0.62); c.lineTo(0.28, 0.1);
    c.arc(0, 0.1, 0.28, 0, Math.PI, true);
    c.lineTo(-0.28, 0.62); c.lineTo(-0.62, 0.62);
    c.closePath(); c.fill();
  },
  bote(c) {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      const x = -0.6 + i * 0.45;
      c.moveTo(x, -0.6); c.lineTo(x + 0.4, 0); c.lineTo(x, 0.6);
      contorno(c, c.fillStyle, 0.16);
    }
  },
  gota(c) {
    c.beginPath();
    c.moveTo(0, -0.85);
    c.bezierCurveTo(0.7, -0.1, 0.6, 0.8, 0, 0.8);
    c.bezierCurveTo(-0.6, 0.8, -0.7, -0.1, 0, -0.85);
    c.closePath(); c.fill();
  },
  segunda(c) {
    c.beginPath(); c.ellipse(-0.22, 0, 0.5, 0.72, 0, 0, Math.PI * 2); contorno(c, c.fillStyle, 0.14);
    c.beginPath(); c.ellipse(0.22, 0, 0.5, 0.72, 0, 0, Math.PI * 2); contorno(c, c.fillStyle, 0.14);
  },
  forno(c) {
    c.beginPath();
    c.moveTo(-0.7, 0.75); c.lineTo(-0.7, -0.1);
    c.arc(0, -0.1, 0.7, Math.PI, 0);
    c.lineTo(0.7, 0.75); c.closePath();
    contorno(c, c.fillStyle, 0.16);
    c.beginPath();
    c.moveTo(-0.2, 0.6); c.quadraticCurveTo(-0.35, 0.05, 0, -0.35);
    c.quadraticCurveTo(0.35, 0.05, 0.2, 0.6);
    c.closePath(); c.fill();
  },
  chumbo(c) {
    c.beginPath();
    c.moveTo(-0.7, -0.4); c.lineTo(0.7, -0.4); c.lineTo(0.55, 0.7); c.lineTo(-0.55, 0.7);
    c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-0.5, -0.4); c.lineTo(-0.35, -0.75); c.lineTo(0.35, -0.75); c.lineTo(0.5, -0.4);
    contorno(c, c.fillStyle, 0.14);
  },
  febre(c) {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      const x = -0.5 + i * 0.5;
      c.moveTo(x, 0.8);
      c.bezierCurveTo(x - 0.35, 0.2, x + 0.35, -0.1, x, -0.8);
      contorno(c, c.fillStyle, 0.15);
    }
  },
  pacto(c) {
    c.beginPath(); c.ellipse(-0.3, -0.2, 0.34, 0.24, -0.5, 0, Math.PI * 2); contorno(c, c.fillStyle, 0.16);
    c.beginPath(); c.ellipse(0.3, 0.2, 0.34, 0.24, -0.5, 0, Math.PI * 2); contorno(c, c.fillStyle, 0.16);
  },
  sangue(c) { DESENHOS.gota(c); },
  bile(c) {
    DESENHOS.gota(c);
    c.globalAlpha *= 0.6;
    c.beginPath(); c.arc(-0.22, 0.2, 0.13, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(0.2, 0.35, 0.09, 0, Math.PI * 2); c.fill();
    c.globalAlpha /= 0.6;
  },
  casco(c) {
    c.beginPath();
    c.moveTo(0, -0.85);
    c.lineTo(0.72, -0.5); c.lineTo(0.6, 0.35);
    c.quadraticCurveTo(0, 0.9, -0.6, 0.35);
    c.lineTo(-0.72, -0.5);
    c.closePath(); c.fill();
  },
  dente(c) {
    c.beginPath();
    c.moveTo(-0.55, -0.7);
    c.quadraticCurveTo(0, -0.95, 0.55, -0.7);
    c.quadraticCurveTo(0.5, 0.1, 0.2, 0.8);
    c.quadraticCurveTo(0.05, 0.2, -0.15, 0.8);
    c.quadraticCurveTo(-0.5, 0.1, -0.55, -0.7);
    c.closePath(); c.fill();
  },
  moeda(c) {
    c.beginPath(); c.arc(0, 0, 0.78, 0, Math.PI * 2); contorno(c, c.fillStyle, 0.16);
    c.beginPath(); c.arc(0, 0, 0.34, 0, Math.PI * 2); contorno(c, c.fillStyle, 0.14);
    c.beginPath(); c.moveTo(0, -0.78); c.lineTo(0, -0.34); c.moveTo(0, 0.34); c.lineTo(0, 0.78);
    contorno(c, c.fillStyle, 0.12);
  },
  sopro(c) {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      const y = -0.45 + i * 0.45;
      c.moveTo(-0.85, y);
      c.quadraticCurveTo(0.1, y - 0.3, 0.5, y);
      c.quadraticCurveTo(0.75, y + 0.2, 0.45, y + 0.28);
      contorno(c, c.fillStyle, 0.14);
    }
  },
  anel(c) {
    c.beginPath(); c.arc(0, 0, 0.68, 0.6, Math.PI * 2 - 0.1); contorno(c, c.fillStyle, 0.22);
  },
  poco(c) {
    c.beginPath(); c.ellipse(0, -0.3, 0.75, 0.3, 0, 0, Math.PI * 2); contorno(c, c.fillStyle, 0.15);
    c.beginPath();
    c.moveTo(-0.75, -0.3); c.lineTo(-0.5, 0.75); c.lineTo(0.5, 0.75); c.lineTo(0.75, -0.3);
    contorno(c, c.fillStyle, 0.15);
  },
  muda(c) {
    c.beginPath();
    c.moveTo(-0.7, 0.7);
    c.quadraticCurveTo(-0.2, -0.9, 0.75, -0.65);
    c.quadraticCurveTo(0.6, 0.5, -0.7, 0.7);
    c.closePath(); c.fill();
  },
  vidro(c) {
    c.beginPath(); c.arc(0, 0, 0.72, 0, Math.PI * 2); contorno(c, c.fillStyle, 0.16);
    c.beginPath();
    c.moveTo(-0.45, -0.5); c.lineTo(0.1, 0.05); c.lineTo(-0.15, 0.3); c.lineTo(0.4, 0.62);
    contorno(c, c.fillStyle, 0.12);
  },
  cadeado(c) {
    c.beginPath(); c.arc(0, -0.25, 0.42, Math.PI, 0); contorno(c, c.fillStyle, 0.18);
    c.beginPath();
    c.moveTo(-0.62, -0.2); c.lineTo(0.62, -0.2); c.lineTo(0.62, 0.72); c.lineTo(-0.62, 0.72);
    c.closePath(); c.fill();
  },
  raio(c) {
    c.beginPath();
    c.moveTo(0.15, -0.9); c.lineTo(-0.55, 0.1); c.lineTo(-0.05, 0.1);
    c.lineTo(-0.2, 0.9); c.lineTo(0.55, -0.15); c.lineTo(0.05, -0.15);
    c.closePath(); c.fill();
  },
};

export function desenhaIcone(c, nome, x, y, tamanho, cor, alfa = 1) {
  const f = DESENHOS[nome] || DESENHOS.escama;
  c.save();
  c.translate(x, y);
  c.scale(tamanho / 2, tamanho / 2);
  c.globalAlpha = alfa;
  c.fillStyle = cor;
  c.strokeStyle = cor;
  c.lineWidth = 0.16;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  f(c);
  c.restore();
}

export const nomesDeIcone = Object.keys(DESENHOS);
