// audio.js — o jogo inteiro soando sem um unico arquivo de audio.
//
// Duas metades:
//
// 1. EFEITOS. Cada som e um punhado de osciladores e ruido filtrado com
//    envelope. Morder e um quadrado caindo de tom com um estalo de ruido
//    por cima; constricao e duas serras descendo juntas desafinadas.
//
// 2. MUSICA. Um sequenciador com lookahead: a cada 25ms ele olha 150ms para
//    frente e agenda as notas que cabem nessa janela. Isso e obrigatorio —
//    setTimeout erra dezenas de milissegundos e a batida sai bebada; o
//    relogio do WebAudio nao erra.
//
// As receitas das faixas (bpm, escala, progressao, quais camadas entram)
// vivem em dados/musica.json. O que esta aqui e so o instrumento.

const AGENDA_MS = 25;
const OLHAR = 0.16;

class Audio {
  constructor() {
    this.pronto = false;
    this.dados = null;
    this.vol = { mestre: 0.75, musica: 0.62, efeitos: 0.85 };
    this.mudo = false;
    this.faixaAtual = null;
    this.nomeFaixa = null;
    this.intensidade = 0.5;
    this.intensidadeAlvo = 0.5;
    this.passo = 0;
    this.proximoPasso = 0;
    this.timer = null;
    this.drone = null;
    this.arpIndice = 0;
  }

  carregarDados(dados) { this.dados = dados; }

  // So nasce depois de um gesto do usuario — navegador bloqueia antes.
  iniciar() {
    if (this.pronto) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const c = new AC();
    this.ctx = c;

    this.mestre = c.createGain();
    this.mestre.gain.value = this.mudo ? 0 : this.vol.mestre;
    this.compressor = c.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.22;
    this.mestre.connect(this.compressor);
    this.compressor.connect(c.destination);

    this.busMusica = c.createGain(); this.busMusica.gain.value = this.vol.musica;
    this.busEfeitos = c.createGain(); this.busEfeitos.gain.value = this.vol.efeitos;
    this.busMusica.connect(this.mestre);
    this.busEfeitos.connect(this.mestre);

    // Reverb: resposta ao impulso gerada na hora (ruido com cauda
    // exponencial). Convolver de verdade, sem arquivo .wav de igreja.
    this.reverb = c.createConvolver();
    this.reverb.buffer = this._impulso(2.6, 2.4);
    this.envioReverb = c.createGain(); this.envioReverb.gain.value = 0.5;
    this.envioReverb.connect(this.reverb);
    this.reverb.connect(this.mestre);

    // Delay para os sinos e o lead — da o eco de poco fundo.
    this.delay = c.createDelay(1.2);
    this.delay.delayTime.value = 0.36;
    this.realimenta = c.createGain(); this.realimenta.gain.value = 0.34;
    this.filtroDelay = c.createBiquadFilter();
    this.filtroDelay.type = 'lowpass'; this.filtroDelay.frequency.value = 1800;
    this.delay.connect(this.filtroDelay);
    this.filtroDelay.connect(this.realimenta);
    this.realimenta.connect(this.delay);
    this.envioDelay = c.createGain(); this.envioDelay.gain.value = 0.4;
    this.envioDelay.connect(this.delay);
    this.delay.connect(this.mestre);

    this.ruidoBuf = this._ruidoBuffer(2.0);
    this.pronto = true;
    return true;
  }

  retomar() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _impulso(dur, decaimento) {
    const c = this.ctx, taxa = c.sampleRate, n = Math.floor(taxa * dur);
    const buf = c.createBuffer(2, n, taxa);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decaimento) * (1 - t * 0.3);
      }
    }
    return buf;
  }

  _ruidoBuffer(dur) {
    const c = this.ctx, n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------- vozes ----------

  _env(no, t, ataque, sustento, queda, pico) {
    const g = no.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + ataque);
    if (sustento > 0) g.setValueAtTime(Math.max(0.0002, pico), t + ataque + sustento);
    g.exponentialRampToValueAtTime(0.0001, t + ataque + sustento + queda);
  }

  _osc(tipo, freq, t) {
    const o = this.ctx.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    return o;
  }

  _ruido(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.ruidoBuf;
    s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.5;
    s.start(t);
    s.stop(t + dur + 0.05);
    return s;
  }

  // Nota curta e seca com corpo — serve de baixo, de arpejo e de pizzicato.
  pluck(freq, t, dur, ganho, tipo = 'sawtooth', corte = 2400, destino = null, q = 6) {
    const c = this.ctx;
    const o = this._osc(tipo, freq, t);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(corte, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, corte * 0.22), t + dur);
    const g = c.createGain();
    this._env(g, t, 0.006, dur * 0.25, dur * 0.8, ganho);
    o.connect(f); f.connect(g);
    g.connect(destino || this.busMusica);
    g.connect(this.envioReverb);
    o.start(t); o.stop(t + dur + 0.1);
  }

  pad(freqs, t, dur, ganho) {
    const c = this.ctx;
    const g = c.createGain();
    this._env(g, t, dur * 0.35, dur * 0.15, dur * 0.7, ganho);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(320, t + dur);
    g.connect(f); f.connect(this.busMusica); f.connect(this.envioReverb);
    for (const fr of freqs) {
      for (const det of [-6, 6]) {
        const o = this._osc('sawtooth', fr, t);
        o.detune.setValueAtTime(det, t);
        const vg = c.createGain(); vg.gain.value = 0.33;
        o.connect(vg); vg.connect(g);
        o.start(t); o.stop(t + dur + 0.2);
      }
    }
  }

  sino(freq, t, ganho) {
    const c = this.ctx;
    const g = c.createGain();
    this._env(g, t, 0.004, 0.02, 2.2, ganho);
    g.connect(this.busMusica); g.connect(this.envioDelay); g.connect(this.envioReverb);
    for (const [mult, vol] of [[1, 1], [2.01, 0.4], [2.98, 0.18], [4.2, 0.08]]) {
      const o = this._osc('sine', freq * mult, t);
      const vg = c.createGain(); vg.gain.value = vol;
      o.connect(vg); vg.connect(g);
      o.start(t); o.stop(t + 2.6);
    }
  }

  bumbo(t, ganho = 0.9) {
    const c = this.ctx;
    const o = this._osc('sine', 150, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.13);
    const g = c.createGain();
    this._env(g, t, 0.002, 0.01, 0.24, ganho);
    o.connect(g); g.connect(this.busMusica);
    o.start(t); o.stop(t + 0.4);
    const n = this._ruido(t, 0.05);
    const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 300;
    const ng = c.createGain(); this._env(ng, t, 0.001, 0, 0.05, ganho * 0.4);
    n.connect(nf); nf.connect(ng); ng.connect(this.busMusica);
  }

  tom(t, ganho = 0.55, base = 190) {
    const c = this.ctx;
    const o = this._osc('triangle', base, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.45, t + 0.22);
    const g = c.createGain();
    this._env(g, t, 0.003, 0.02, 0.3, ganho);
    o.connect(g); g.connect(this.busMusica); g.connect(this.envioReverb);
    o.start(t); o.stop(t + 0.55);
  }

  chimbal(t, ganho = 0.3) {
    const c = this.ctx;
    const n = this._ruido(t, 0.09);
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6200;
    const g = c.createGain();
    this._env(g, t, 0.001, 0.005, 0.07, ganho);
    n.connect(f); f.connect(g); g.connect(this.busMusica);
  }

  caixa(t, ganho = 0.4) {
    const c = this.ctx;
    const n = this._ruido(t, 0.18);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 1.2;
    const g = c.createGain();
    this._env(g, t, 0.002, 0.01, 0.16, ganho);
    n.connect(f); f.connect(g); g.connect(this.busMusica); g.connect(this.envioReverb);
  }

  // ---------- musica ----------

  static nota(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  musica(nome, forcar = false) {
    if (!this.pronto || !this.dados) return;
    if (this.nomeFaixa === nome && !forcar) return;
    const receita = this.dados.faixas[nome];
    if (!receita) return;
    this.nomeFaixa = nome;
    this.faixaAtual = receita;
    this.escala = this.dados.escalas[receita.escala] || this.dados.escalas.menor;
    this.passo = 0;
    this.arpIndice = 0;
    this.proximoPasso = this.ctx.currentTime + 0.08;
    this._trocarDrone(receita);
    if (!this.timer) this.timer = setInterval(() => this._agendar(), AGENDA_MS);
  }

  pararMusica(fade = 0.9) {
    if (!this.pronto) return;
    this.nomeFaixa = null;
    this.faixaAtual = null;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.drone) {
      const t = this.ctx.currentTime;
      this.drone.ganho.gain.cancelScheduledValues(t);
      this.drone.ganho.gain.setValueAtTime(this.drone.ganho.gain.value, t);
      this.drone.ganho.gain.linearRampToValueAtTime(0.0001, t + fade);
      const d = this.drone;
      setTimeout(() => { for (const o of d.oscs) { try { o.stop(); } catch (e) { /* ja parou */ } } }, fade * 1000 + 120);
      this.drone = null;
    }
  }

  _trocarDrone(receita) {
    const c = this.ctx, t = c.currentTime;
    if (this.drone) {
      const d = this.drone;
      d.ganho.gain.cancelScheduledValues(t);
      d.ganho.gain.linearRampToValueAtTime(0.0001, t + 0.7);
      setTimeout(() => { for (const o of d.oscs) { try { o.stop(); } catch (e) { /* ja parou */ } } }, 900);
    }
    const raiz = Audio.nota(receita.raiz - 12);
    const ganho = c.createGain();
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.linearRampToValueAtTime(0.22, t + 2.2);
    const filtro = c.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = receita.filtro || 700;
    filtro.Q.value = 3;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoG = c.createGain();
    lfoG.gain.value = (receita.filtro || 700) * 0.42;
    lfo.connect(lfoG); lfoG.connect(filtro.frequency);
    lfo.start(t);
    ganho.connect(filtro);
    filtro.connect(this.busMusica);
    filtro.connect(this.envioReverb);
    const oscs = [lfo];
    for (const [mult, det, tipo] of [[1, -7, 'sawtooth'], [1, 5, 'sawtooth'], [2, 0, 'triangle'], [1.5, 9, 'sine']]) {
      const o = this._osc(tipo, raiz * mult, t);
      o.detune.setValueAtTime(det, t);
      const g = c.createGain(); g.gain.value = mult === 1 ? 0.4 : 0.18;
      o.connect(g); g.connect(ganho);
      o.start(t);
      oscs.push(o);
    }
    this.drone = { oscs, ganho, filtro };
  }

  definirIntensidade(v) { this.intensidadeAlvo = Math.max(0, Math.min(1, v)); }

  _nivel(base, limiar) {
    if (base <= 0) return 0;
    const i = this.intensidade;
    if (i <= limiar) return 0;
    return base * Math.min(1, (i - limiar) / Math.max(0.05, 1 - limiar));
  }

  _grauParaMidi(receita, grau, oitava = 0) {
    const esc = this.escala;
    const n = esc.length;
    let idx = grau % n;
    let oit = Math.floor(grau / n) + oitava;
    if (idx < 0) { idx += n; oit -= 1; }
    return receita.raiz + esc[idx] + oit * 12;
  }

  _agendar() {
    if (!this.faixaAtual || !this.ctx) return;
    const r = this.faixaAtual;
    const limite = this.ctx.currentTime + OLHAR;
    const dur = 60 / r.bpm / 4;              // duracao de uma semicolcheia
    this.intensidade += (this.intensidadeAlvo - this.intensidade) * 0.06;

    let guarda = 0;
    while (this.proximoPasso < limite && guarda++ < 64) {
      this._tocarPasso(r, this.passo, this.proximoPasso, dur);
      this.passo++;
      this.proximoPasso += dur;
    }
  }

  _tocarPasso(r, passo, t, dur) {
    const cams = r.camadas;
    const compasso = Math.floor(passo / 16) % (r.compassos || 4);
    const noCompasso = passo % 16;
    const grauAcorde = r.progressao[compasso % r.progressao.length];

    // baixo — a fundacao, entra cedo
    const vBaixo = this._nivel(cams.baixo, 0.1);
    if (vBaixo > 0 && (noCompasso === 0 || noCompasso === 6 || (noCompasso === 11 && this.intensidade > 0.6))) {
      const midi = this._grauParaMidi(r, grauAcorde, -1);
      this.pluck(Audio.nota(midi), t, dur * 5, vBaixo * 0.5, 'sawtooth', 620, null, 8);
      this.pluck(Audio.nota(midi - 12), t, dur * 6, vBaixo * 0.35, 'sine', 300);
    }

    // acorde longo no comeco do compasso
    const vPad = this._nivel(cams.pad, 0);
    if (vPad > 0 && noCompasso === 0) {
      const g = [grauAcorde, grauAcorde + 2, grauAcorde + 4];
      if (r.tritono) g.push(grauAcorde + 3);
      this.pad(g.map(x => Audio.nota(this._grauParaMidi(r, x, 0))), t, dur * 16, vPad * 0.16);
    }

    // arpejo
    const vArp = this._nivel(cams.arp, 0.28);
    if (vArp > 0 && passo % (r.arpDiv >= 6 ? 2 : Math.max(1, Math.round(16 / (r.arpDiv * 2)))) === 0) {
      const padrao = r.arpPadrao;
      const grau = grauAcorde + padrao[this.arpIndice % padrao.length];
      this.arpIndice++;
      const midi = this._grauParaMidi(r, grau, r.arpOitava || 1);
      this.pluck(Audio.nota(midi), t, dur * 2.4, vArp * 0.20, 'square', 1900, null, 4);
    }

    // percussao
    const vPerc = this._nivel(cams.perc, 0.16);
    if (vPerc > 0) {
      const ch = r.percPadrao[noCompasso];
      if (ch === 'k') this.bumbo(t, vPerc * 0.85);
      else if (ch === 't') this.tom(t, vPerc * 0.5);
      else if (ch === 'h') this.chimbal(t, vPerc * 0.28);
      else if (ch === 's') this.caixa(t, vPerc * 0.4);
    }

    // sino solto — o que faz a faixa parecer viva em vez de loop
    const vSino = this._nivel(cams.sino, 0);
    if (vSino > 0 && noCompasso % 4 === 0 && Math.random() < (r.sinoChance || 0.15)) {
      const grau = grauAcorde + [0, 2, 4, 6, 7][Math.floor(Math.random() * 5)];
      const midi = this._grauParaMidi(r, grau, 2);
      this.sino(Audio.nota(midi), t, vSino * 0.09);
    }
  }

  // ---------- efeitos ----------

  _simples(freqIni, freqFim, dur, ganho, tipo = 'sine', corte = 0) {
    if (!this.pronto) return;
    const c = this.ctx, t = c.currentTime;
    const o = this._osc(tipo, freqIni, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freqFim), t + dur);
    const g = c.createGain();
    this._env(g, t, 0.004, dur * 0.15, dur * 0.85, ganho);
    let ultimo = o;
    if (corte) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = corte;
      o.connect(f); ultimo = f;
    }
    ultimo.connect(g); g.connect(this.busEfeitos);
    o.start(t); o.stop(t + dur + 0.1);
    return { g, t };
  }

  _estalo(dur, ganho, tipoFiltro, freq, q = 1) {
    if (!this.pronto) return;
    const c = this.ctx, t = c.currentTime;
    const n = this._ruido(t, dur);
    const f = c.createBiquadFilter(); f.type = tipoFiltro; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    this._env(g, t, 0.002, dur * 0.1, dur * 0.9, ganho);
    n.connect(f); f.connect(g); g.connect(this.busEfeitos);
    return { f, g, t };
  }

  comer() {
    this._simples(440, 130, 0.14, 0.32, 'square');
    const e = this._estalo(0.12, 0.3, 'bandpass', 900, 0.8);
    if (e) e.f.frequency.exponentialRampToValueAtTime(180, e.t + 0.12);
  }

  crescer() { this._simples(220, 340, 0.18, 0.16, 'triangle'); }

  dano() {
    this._simples(180, 46, 0.34, 0.5, 'sawtooth', 900);
    this._estalo(0.22, 0.4, 'lowpass', 700, 1);
  }

  parede() { this._simples(120, 60, 0.12, 0.28, 'square', 500); }

  bote() {
    const e = this._estalo(0.3, 0.4, 'bandpass', 400, 2.4);
    if (e) e.f.frequency.exponentialRampToValueAtTime(3400, e.t + 0.26);
    this._simples(320, 900, 0.2, 0.14, 'sawtooth', 2400);
  }

  cuspe() {
    const e = this._estalo(0.18, 0.32, 'highpass', 1200, 1);
    if (e) e.f.frequency.exponentialRampToValueAtTime(400, e.t + 0.16);
    this._simples(700, 220, 0.16, 0.14, 'square');
  }

  constricao(forca = 1) {
    if (!this.pronto) return;
    const c = this.ctx, t = c.currentTime;
    for (const det of [0, 11, -9]) {
      const o = this._osc('sawtooth', 320 + det * 4, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.6);
      const f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(2600, t);
      f.frequency.exponentialRampToValueAtTime(260, t + 0.6);
      const g = c.createGain();
      this._env(g, t, 0.01, 0.1, 0.62, 0.2 * forca);
      o.connect(f); f.connect(g); g.connect(this.busEfeitos); g.connect(this.envioReverb);
      o.start(t); o.stop(t + 0.9);
    }
    this._estalo(0.5, 0.3 * forca, 'lowpass', 500, 1);
  }

  matar() {
    this._simples(300, 80, 0.18, 0.26, 'square', 1400);
    this._estalo(0.16, 0.26, 'bandpass', 2200, 1.4);
  }

  severado() {
    this._simples(90, 40, 0.7, 0.55, 'sawtooth', 600);
    const e = this._estalo(0.5, 0.5, 'bandpass', 1400, 0.7);
    if (e) e.f.frequency.exponentialRampToValueAtTime(200, e.t + 0.45);
  }

  furia() {
    if (!this.pronto) return;
    const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = this._osc('sawtooth', 60 * (i + 1), t);
      o.frequency.exponentialRampToValueAtTime(30 * (i + 1), t + 1.1);
      const g = c.createGain();
      this._env(g, t, 0.05, 0.3, 0.8, 0.13);
      o.connect(g); g.connect(this.busEfeitos); g.connect(this.envioReverb);
      o.start(t); o.stop(t + 1.4);
    }
  }

  nivel() {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    [0, 3, 7, 10, 12].forEach((s, i) => {
      const o = this._osc('sine', Audio.nota(64 + s), t + i * 0.07);
      const g = this.ctx.createGain();
      this._env(g, t + i * 0.07, 0.005, 0.02, 0.6, 0.16);
      o.connect(g); g.connect(this.busEfeitos); g.connect(this.envioDelay);
      o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.8);
    });
  }

  pegar() { this._simples(520, 780, 0.22, 0.18, 'triangle'); }

  porta() {
    const e = this._estalo(0.8, 0.3, 'lowpass', 900, 1);
    if (e) e.f.frequency.exponentialRampToValueAtTime(180, e.t + 0.7);
    this._simples(70, 44, 0.9, 0.3, 'sawtooth', 400);
  }

  gritoChefe() {
    if (!this.pronto) return;
    const c = this.ctx, t = c.currentTime;
    for (const [f0, f1, tipo, gan] of [[110, 62, 'sawtooth', 0.3], [55, 31, 'square', 0.22], [220, 130, 'sawtooth', 0.12]]) {
      const o = this._osc(tipo, f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + 1.5);
      const lfo = this._osc('sine', 7.5, t);
      const lg = c.createGain(); lg.gain.value = f0 * 0.12;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 1.8);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      const g = c.createGain();
      this._env(g, t, 0.08, 0.6, 0.9, gan);
      o.connect(f); f.connect(g); g.connect(this.busEfeitos); g.connect(this.envioReverb);
      o.start(t); o.stop(t + 2.0);
    }
    this._estalo(1.4, 0.24, 'lowpass', 600, 1);
  }

  morte() {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    for (const [f, d] of [[180, 2.2], [120, 2.6], [90, 3.0]]) {
      const o = this._osc('sawtooth', f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.32, t + d);
      const g = this.ctx.createGain();
      this._env(g, t, 0.02, 0.4, d, 0.16);
      o.connect(g); g.connect(this.busEfeitos); g.connect(this.envioReverb);
      o.start(t); o.stop(t + d + 0.3);
    }
  }

  // menu — passar o mouse e clicar tem som proprio, e isso importa muito
  passar() {
    if (!this.pronto) return;
    const t = this.ctx.currentTime;
    const base = 620 + Math.random() * 90;
    for (const [m, g] of [[1, 0.075], [2.02, 0.03]]) {
      const o = this._osc('sine', base * m, t);
      o.frequency.exponentialRampToValueAtTime(base * m * 1.28, t + 0.11);
      const gn = this.ctx.createGain();
      this._env(gn, t, 0.003, 0.01, 0.16, g);
      o.connect(gn); gn.connect(this.busEfeitos); gn.connect(this.envioDelay);
      o.start(t); o.stop(t + 0.32);
    }
  }

  clique() {
    this._simples(160, 70, 0.16, 0.3, 'square', 900);
    const t = this.ctx ? this.ctx.currentTime : 0;
    if (!this.pronto) return;
    const o = this._osc('sine', 300, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.16);
    const g = this.ctx.createGain();
    this._env(g, t, 0.004, 0.01, 0.2, 0.12);
    o.connect(g); g.connect(this.busEfeitos); g.connect(this.envioDelay);
    o.start(t); o.stop(t + 0.4);
    this._estalo(0.1, 0.16, 'highpass', 3000, 0.7);
  }

  voltar() { this._simples(400, 150, 0.18, 0.2, 'triangle'); }

  negado() { this._simples(150, 120, 0.16, 0.22, 'square', 700); }

  // ---------- controles ----------

  definirVolume(canal, v) {
    this.vol[canal] = v;
    if (!this.pronto) return;
    if (canal === 'mestre') this.mestre.gain.value = this.mudo ? 0 : v;
    if (canal === 'musica') this.busMusica.gain.value = v;
    if (canal === 'efeitos') this.busEfeitos.gain.value = v;
  }

  alternarMudo() {
    this.mudo = !this.mudo;
    if (this.pronto) this.mestre.gain.value = this.mudo ? 0 : this.vol.mestre;
    return this.mudo;
  }
}

export const audio = new Audio();
