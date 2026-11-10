class PingPongScene {
  constructor(root) {
    this.root = root;
    this.activeSide = "top";
    this.isInFlight = false;
    this.currentAnimations = [];
    this.bounceTimer = null;
    this.currentBounce = null;
    this.travelDuration = 1300;
    this.typedWord = "";
    this.wordState = this.emptyWordState();
    this.audioContext = null;
    this.audioMaster = null;
    this.noiseBuffer = null;

    const dictionaryWords = window.KEYPONG_WORDS || [];
    this.dictionary = new Set(dictionaryWords);
    window.KEYPONG_WORDS = null;

    this.receptionPool =
      "AAAAAAAABBBBCCCCCDDDDDEEEEEEEEEEEEEFFFFGGGGHHHHIIIIIIIIJJLLLLLLMMMMMMNNNNNNNNOOOOOOOPPPPPRRRRRRRRSSSSSSSSTTTTTTTTUUUUUUVVV";
    this.sendPool = `${this.receptionPool}KKQQWWYY`;
    this.lanes = [
      { ball: 18, topPaddle: 0, bottomPaddle: 14 },
      { ball: 46, topPaddle: 28, bottomPaddle: 42 },
      { ball: 74, topPaddle: 56, bottomPaddle: 70 },
    ];
    this.positions = { top: 0, bottom: 2 };
    this.letters = {
      top: {
        reception: this.generateRow("reception"),
        send: this.generateRow("send"),
      },
      bottom: {
        reception: this.generateRow("reception"),
        send: this.generateRow("send"),
      },
    };
    this.letterCells = {
      top: { reception: [], send: [] },
      bottom: { reception: [], send: [] },
    };
    this.elements = {
      table: root.querySelector("[data-table]"),
      net: root.querySelector("[data-net]"),
      ball: root.querySelector("[data-ball]"),
      paddles: [...root.querySelectorAll("[data-paddle]")],
      letterGrid: root.querySelector("[data-letter-grid]"),
      wordPanel: document.querySelector("[data-word-panel]"),
      playerDot: document.querySelector("[data-player-dot]"),
      playerLabel: document.querySelector("[data-player-label]"),
      typedWord: document.querySelector("[data-typed-word]"),
      wordValid: document.querySelector("[data-word-valid]"),
      wordInstruction: document.querySelector("[data-word-instruction]"),
    };
  }

  init() {
    this.prepareAudio();
    this.createLetterGrid();
    this.calibratePaddles();
    this.placeElements();
    this.updateWordState();

    window.addEventListener("keydown", (event) => this.handleKeyDown(event));
    this.root.dataset.state = "waiting";
    this.root.dataset.turn = this.activeSide;
    this.root.dataset.ready = "true";
  }

  emptyWordState() {
    return {
      normalized: "",
      startsCorrectly: false,
      targetLane: -1,
      exists: false,
      valid: false,
    };
  }

  generateRow(role) {
    const pool = role === "reception" ? this.receptionPool : this.sendPool;
    const row = [];

    while (row.length < 3) {
      const letter = pool[Math.floor(Math.random() * pool.length)];
      if (!row.includes(letter)) row.push(letter);
    }

    return row;
  }

  createLetterGrid() {
    const physicalRows = [
      { owner: "top", role: "reception" },
      { owner: "bottom", role: "send" },
      { owner: "top", role: "send" },
      { owner: "bottom", role: "reception" },
    ];
    const fragment = document.createDocumentFragment();

    physicalRows.forEach(({ owner, role }) => {
      this.letters[owner][role].forEach((letter, lane) => {
        const cell = document.createElement("div");
        const value = document.createElement("span");
        cell.className = "letter-cell";
        cell.dataset.owner = owner;
        cell.dataset.role = role;
        cell.dataset.lane = lane;
        value.className = "letter-cell__value";
        value.textContent = letter;
        cell.append(value);
        fragment.append(cell);
        this.letterCells[owner][role][lane] = cell;
      });
    });

    this.elements.letterGrid.replaceChildren(fragment);
    this.elements.letterGrid.querySelectorAll(".letter-cell__value").forEach((value) => {
      this.popLetter(value);
    });
  }

  handleKeyDown(event) {
    if (event.code === "Space") {
      if (event.repeat) return;
      event.preventDefault();
      this.ensureAudio();
      this.handleSpacePress();
      return;
    }

    if (this.isInFlight) return;

    if (event.key === "Backspace") {
      if (this.typedWord.length === 0) return;
      event.preventDefault();
      this.ensureAudio();
      this.typedWord = this.typedWord.slice(0, -1);
      this.playTypingSound(this.typedWord.length);
      this.updateWordState();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;

    const letters = this.normalizeWord(event.key);
    if (!letters || this.typedWord.length + letters.length > 24) return;

    event.preventDefault();
    this.ensureAudio();
    this.typedWord += letters;
    this.playTypingSound(this.typedWord.length);
    this.updateWordState();
  }

  normalizeWord(word) {
    return word
      .toLowerCase()
      .replaceAll("œ", "oe")
      .replaceAll("æ", "ae")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
  }

  updateWordState() {
    const normalized = this.normalizeWord(this.typedWord);
    const receptionLane = this.positions[this.activeSide];
    const receptionLetter = this.letters[this.activeSide].reception[receptionLane];
    const sendLetters = this.letters[this.activeSide].send;
    const startsCorrectly = normalized.length > 0 && normalized[0] === receptionLetter;
    let targetLane = -1;

    if (startsCorrectly) {
      for (let index = 1; index < normalized.length && targetLane === -1; index += 1) {
        targetLane = sendLetters.indexOf(normalized[index]);
      }
    }

    const exists = normalized.length >= 2 && this.dictionary.has(normalized);
    this.wordState = {
      normalized,
      startsCorrectly,
      targetLane,
      exists,
      valid: exists && startsCorrectly && targetLane !== -1,
    };

    this.renderWordState();
  }

  renderWordState() {
    const side = this.activeSide;
    const playerName = side === "top" ? "Joueur bleu" : "Joueur rouge";
    const playerColor = side === "top" ? "var(--blue)" : "var(--red)";
    const receptionLane = this.positions[side];

    Object.values(this.letterCells).forEach((roles) => {
      Object.values(roles).flat().forEach((cell) => {
        cell.classList.remove("is-current", "is-included");
      });
    });

    const receptionCell = this.letterCells[side].reception[receptionLane];
    receptionCell.classList.add("is-current");
    if (this.wordState.startsCorrectly) receptionCell.classList.add("is-included");
    if (this.wordState.targetLane !== -1) {
      this.letterCells[side].send[this.wordState.targetLane].classList.add("is-included");
    }

    this.elements.wordPanel.style.setProperty("--player-color", playerColor);
    this.elements.playerLabel.textContent = playerName;
    this.elements.typedWord.textContent = this.typedWord || "Tape un mot";
    this.elements.typedWord.classList.toggle("is-valid", this.wordState.valid);
    this.elements.wordValid.classList.toggle("is-visible", this.wordState.valid);

    if (this.dictionary.size === 0) {
      this.elements.wordInstruction.textContent = "Dictionnaire indisponible";
    } else {
      this.elements.wordInstruction.textContent = "";
    }
  }

  handleSpacePress() {
    if (this.isInFlight) {
      this.finishCurrentShot();
      return;
    }

    if (!this.wordState.valid) {
      this.elements.wordPanel.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-7px)" },
          { transform: "translateX(7px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 180 },
      );
      return;
    }

    this.returnBall();
  }

  finishCurrentShot() {
    this.currentAnimations.forEach((animation) => {
      if (animation.playState !== "finished") animation.finish();
    });

    if (this.bounceTimer) {
      window.clearTimeout(this.bounceTimer);
      this.bounceTimer = null;
    }

    if (this.currentBounce && !this.currentBounce.shown) {
      this.showBounce(this.currentBounce.x, this.currentBounce.y);
      this.currentBounce.shown = true;
    }
  }

  async returnBall() {
    if (this.isInFlight || !this.wordState.valid) return;

    this.isInFlight = true;
    this.root.dataset.state = "striking";

    const fromSide = this.activeSide;
    const targetSide = fromSide === "top" ? "bottom" : "top";
    const fromLaneIndex = this.positions[fromSide];
    const fromLane = this.lanes[fromLaneIndex];
    const targetLaneIndex = this.wordState.targetLane;
    const targetLane = this.lanes[targetLaneIndex];
    const receiver = this.getPaddle(targetSide);
    const receiverStart = this.lanes[this.positions[targetSide]];
    const receiverStartPosition = this.getPaddlePosition(targetSide, receiverStart);
    const receiverTargetPosition = this.getPaddlePosition(targetSide, targetLane);
    const receiverTransforms = this.getPaddleTransforms(targetSide);
    const isPowerShot = this.wordState.normalized.length > 6;

    this.playPaddleSound();
    receiver.style.left = `${receiverTargetPosition}%`;
    receiver.style.transform = receiverTransforms.recoil;
    const receiverAnimation = receiver.animate(
      [
        { left: `${receiverStartPosition}%`, transform: receiverTransforms.neutral },
        { left: `${receiverTargetPosition}%`, transform: receiverTransforms.recoil },
      ],
      { duration: 1050, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
    );

    const strikeAnimation = this.animateStrike(fromSide);
    const spinAnimation = isPowerShot ? this.animatePaddleSpin(fromSide) : null;
    this.consumeLetters(fromSide, fromLaneIndex, targetLaneIndex);
    this.clearGridHighlights();
    this.root.dataset.state = "in-flight";

    const targetTop = targetSide === "top" ? "12%" : "82%";
    const fromTop = fromSide === "top" ? 12 : 82;
    const targetTopValue = targetSide === "top" ? 12 : 82;
    const bounceTop = targetSide === "top" ? 35 : 65;
    const bounceProgress = (bounceTop - fromTop) / (targetTopValue - fromTop);
    const bounceLeft = fromLane.ball + (targetLane.ball - fromLane.ball) * bounceProgress;
    const ballAnimation = this.elements.ball.animate(
      [
        { top: `${fromTop}%`, left: `${fromLane.ball}%` },
        { top: targetTop, left: `${targetLane.ball}%` },
      ],
      {
        duration: this.travelDuration,
        easing: "cubic-bezier(0.18, 0.65, 0.32, 1)",
      },
    );

    this.elements.ball.style.top = targetTop;
    this.elements.ball.style.left = `${targetLane.ball}%`;
    this.currentBounce = { x: bounceLeft, y: bounceTop, shown: false };
    this.bounceTimer = window.setTimeout(() => {
      this.showBounce(bounceLeft, bounceTop);
      this.currentBounce.shown = true;
      this.bounceTimer = null;
    }, this.travelDuration * this.getEasedTime(bounceProgress));
    this.currentAnimations = [strikeAnimation, receiverAnimation, ballAnimation, spinAnimation].filter(
      Boolean,
    );
    try {
      await ballAnimation.finished;
    } catch {
      // The final inline position is already set, so a cancelled animation still resolves the turn.
    }

    this.positions[targetSide] = targetLaneIndex;
    this.activeSide = targetSide;
    this.isInFlight = false;
    this.currentAnimations = [];
    if (this.bounceTimer) window.clearTimeout(this.bounceTimer);
    this.bounceTimer = null;
    this.currentBounce = null;
    this.typedWord = "";
    this.wordState = this.emptyWordState();
    this.root.dataset.state = "waiting";
    this.root.dataset.turn = this.activeSide;
    this.updateWordState();
  }

  consumeLetters(side, receptionLane, sendLane) {
    this.replaceLetter(side, "reception", receptionLane);
    this.replaceLetter(side, "send", sendLane);
  }

  replaceLetter(side, role, lane) {
    const row = this.letters[side][role];
    const pool = role === "reception" ? this.receptionPool : this.sendPool;
    let nextLetter = row[lane];

    while (row.includes(nextLetter)) {
      nextLetter = pool[Math.floor(Math.random() * pool.length)];
    }

    row[lane] = nextLetter;
    const value = this.letterCells[side][role][lane].querySelector(".letter-cell__value");
    value.textContent = nextLetter;
    this.popLetter(value);
  }

  popLetter(value) {
    value.animate(
      [
        { transform: "scale(0.65)", opacity: 0 },
        { transform: "scale(1.18)", opacity: 1, offset: 0.65 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 210, easing: "cubic-bezier(0.2, 0.85, 0.3, 1)" },
    );
  }

  clearGridHighlights() {
    Object.values(this.letterCells).forEach((roles) => {
      Object.values(roles).flat().forEach((cell) => {
        cell.classList.remove("is-current", "is-included");
      });
    });
  }

  placeElements() {
    const topLane = this.lanes[this.positions.top];
    const bottomLane = this.lanes[this.positions.bottom];
    this.elements.ball.style.top = "12%";
    this.elements.ball.style.left = `${topLane.ball}%`;

    const topPaddle = this.getPaddle("top");
    topPaddle.style.left = `${topLane.topPaddle}%`;
    topPaddle.style.transform = this.getPaddleTransforms("top").recoil;
    const bottomPaddle = this.getPaddle("bottom");
    bottomPaddle.style.left = `${bottomLane.bottomPaddle}%`;
    bottomPaddle.style.transform = this.getPaddleTransforms("bottom").neutral;
  }

  calibratePaddles() {
    const sceneRect = this.root.getBoundingClientRect();
    const ballSize = this.elements.ball.getBoundingClientRect().width;

    ["top", "bottom"].forEach((side) => {
      const paddle = this.getPaddle(side);
      const sweetSpot = paddle.querySelector("[data-sweet-spot]");
      const transforms = this.getPaddleTransforms(side);
      paddle.style.left = "0%";
      paddle.style.top = "0%";
      paddle.style.bottom = "auto";
      paddle.style.transform = transforms.recoil;

      const spotRect = sweetSpot.getBoundingClientRect();
      const ballTop = side === "top" ? 0.12 : 0.82;
      const targetCenterY = sceneRect.top + sceneRect.height * ballTop + ballSize / 2;
      const alignedTop = ((targetCenterY - spotRect.top) / sceneRect.height) * 100;
      const paddleProperty = side === "top" ? "topPaddle" : "bottomPaddle";
      paddle.style.top = `${alignedTop}%`;

      this.lanes.forEach((lane) => {
        const targetCenterX =
          sceneRect.left + sceneRect.width * (lane.ball / 100) + ballSize / 2;
        lane[paddleProperty] = ((targetCenterX - spotRect.left) / sceneRect.width) * 100;
      });
    });
  }

  getPaddle(side) {
    return this.elements.paddles.find((paddle) => paddle.dataset.paddle === side);
  }

  getPaddlePosition(side, lane) {
    return side === "top" ? lane.topPaddle : lane.bottomPaddle;
  }

  animateStrike(side) {
    const paddle = this.getPaddle(side);
    const { neutral, recoil, strike } = this.getPaddleTransforms(side);
    const animation = paddle.animate(
      [
        { transform: recoil, offset: 0 },
        { transform: strike, offset: 0.22 },
        { transform: neutral, offset: 1 },
      ],
      { duration: 260, easing: "linear" },
    );

    animation.finished.then(() => {
      paddle.style.transform = neutral;
    });
    return animation;
  }

  animatePaddleSpin(side) {
    const body = this.getPaddle(side).querySelector("[data-paddle-body]");
    return body.animate(
      [
        { transform: "rotate3d(-1, 1, 0, 0deg)" },
        { transform: "rotate3d(-1, 1, 0, 180deg)", offset: 0.5 },
        { transform: "rotate3d(-1, 1, 0, 360deg)" },
      ],
      { duration: 560, easing: "cubic-bezier(0.3, 0.05, 0.2, 1)" },
    );
  }

  getPaddleTransforms(side) {
    if (side === "top") {
      return {
        neutral: "translateY(0) rotate(180deg)",
        recoil: "translateY(-28%) rotate(192deg)",
        strike: "translateY(10%) rotate(168deg)",
      };
    }

    return {
      neutral: "translateY(0) rotate(0deg)",
      recoil: "translateY(28%) rotate(12deg)",
      strike: "translateY(-10%) rotate(-12deg)",
    };
  }

  showBounce(left, top) {
    this.playBounceSound();
    const ring = document.createElement("span");
    ring.className = "bounce-ring";
    ring.style.left = `${left}%`;
    ring.style.top = `${top}%`;
    this.root.append(ring);

    const animation = ring.animate(
      [
        { opacity: 0.9, transform: "translate(-50%, -50%) scale(0.25)" },
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.45)" },
      ],
      { duration: 520, easing: "cubic-bezier(0.15, 0.7, 0.3, 1)" },
    );
    animation.finished.then(() => ring.remove());
  }

  getEasedTime(progress) {
    let low = 0;
    let high = 1;
    for (let index = 0; index < 16; index += 1) {
      const parameter = (low + high) / 2;
      const easedProgress = this.cubicBezierValue(parameter, 0.65, 1);
      if (easedProgress < progress) low = parameter;
      else high = parameter;
    }
    return this.cubicBezierValue((low + high) / 2, 0.18, 0.32);
  }

  cubicBezierValue(parameter, firstControl, secondControl) {
    const inverse = 1 - parameter;
    return (
      3 * inverse * inverse * parameter * firstControl +
      3 * inverse * parameter * parameter * secondControl +
      parameter * parameter * parameter
    );
  }

  prepareAudio() {
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      try {
        this.audioContext = new AudioContext({ latencyHint: "interactive" });
      } catch {
        this.audioContext = new AudioContext();
      }
      this.audioMaster = this.audioContext.createGain();
      this.audioMaster.gain.value = 0.55;
      this.audioMaster.connect(this.audioContext.destination);
      console.info("[Keypong audio] context created", {
        state: this.audioContext.state,
        baseLatency: this.audioContext.baseLatency,
        outputLatency: this.audioContext.outputLatency,
        sampleRate: this.audioContext.sampleRate,
      });
      this.noiseBuffer = this.audioContext.createBuffer(
        1,
        Math.floor(this.audioContext.sampleRate * 0.08),
        this.audioContext.sampleRate,
      );
      const samples = this.noiseBuffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = Math.random() * 2 - 1;
      }
    }
  }

  ensureAudio() {
    this.prepareAudio();
    if (!this.audioContext) return;
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().then(() => {
        console.info("[Keypong audio] context resumed", {
          state: this.audioContext.state,
          baseLatency: this.audioContext.baseLatency,
          outputLatency: this.audioContext.outputLatency,
        });
      });
    }
  }

  playTypingSound(length) {
    if (!this.audioContext || !this.audioMaster) return;
    const now = this.audioContext.currentTime;
    const step = Math.max(0, length - 1);
    const frequency = Math.min(1200, 330 * 2 ** (step / 12));
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    oscillator.connect(gain).connect(this.audioMaster);
    oscillator.start(now);
    oscillator.stop(now + 0.06);
  }

  playPaddleSound() {
    this.playKnockSound(1.22);
  }

  playBounceSound() {
    this.playKnockSound(0.88);
  }

  playKnockSound(pitch) {
    if (!this.audioContext || !this.audioMaster) return;
    const now = this.audioContext.currentTime;
    const pitchVariation = pitch * (0.97 + Math.random() * 0.06);
    const resonance = this.audioContext.createOscillator();
    const resonanceGain = this.audioContext.createGain();
    resonance.type = "triangle";
    resonance.frequency.setValueAtTime(520 * pitchVariation, now);
    resonance.frequency.exponentialRampToValueAtTime(374 * pitchVariation, now + 0.026);
    resonanceGain.gain.setValueAtTime(0.035, now);
    resonanceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);
    resonance.connect(resonanceGain).connect(this.audioMaster);
    resonance.start(now);
    resonance.stop(now + 0.036);

    const click = this.audioContext.createBufferSource();
    const clickFilter = this.audioContext.createBiquadFilter();
    const clickGain = this.audioContext.createGain();
    click.buffer = this.noiseBuffer;
    clickFilter.type = "highpass";
    clickFilter.frequency.value = 800 * pitchVariation;
    clickFilter.Q.value = 0.7;
    clickGain.gain.setValueAtTime(0.18, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.019);
    click.connect(clickFilter).connect(clickGain).connect(this.audioMaster);
    click.start(now);
    click.stop(now + 0.022);
  }
}

const scene = document.querySelector("[data-game-scene]");
if (scene) {
  window.keypongGame = new PingPongScene(scene);
  window.keypongGame.init();
}
