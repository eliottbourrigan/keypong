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
    this.typingPaddleAnimation = null;
    this.wordState = this.emptyWordState();
    this.audioContext = null;
    this.audioMaster = null;
    this.noiseBuffer = null;

    const dictionaryWords = window.KEYPONG_WORDS || [];
    this.dictionary = new Set(dictionaryWords);
    window.KEYPONG_WORDS = null;

    this.letterPool =
      "AAAAAAAABBBBCCCCCDDDDDEEEEEEEEEEEEEFFFFGGGGHHHHIIIIIIIIJJLLLLLLMMMMMMNNNNNNNNOOOOOOOPPPPPRRRRRRRRSSSSSSSSTTTTTTTTUUUUUUVVVKKQQWWYY";
    this.positions = { top: 0, bottom: 0 };
    this.paddleOffsets = { top: null, bottom: null };
    this.letters = {
      top: this.generateLetters(),
      bottom: this.generateLetters(),
    };
    this.letterCells = { top: [], bottom: [] };
    this.requiredStartIndex = { top: null, bottom: null };
    this.elements = {
      table: root.querySelector("[data-table]"),
      net: root.querySelector("[data-net]"),
      ball: root.querySelector("[data-ball]"),
      shotCallout: root.querySelector("[data-shot-callout]"),
      paddles: [...root.querySelectorAll("[data-paddle]")],
      letterGrid: root.querySelector("[data-letter-grid]"),
      wordPanels: {
        top: document.querySelector('[data-word-panel="top"]'),
        bottom: document.querySelector('[data-word-panel="bottom"]'),
      },
      typedWords: {
        top: document.querySelector('[data-typed-word="top"]'),
        bottom: document.querySelector('[data-typed-word="bottom"]'),
      },
      wordValids: {
        top: document.querySelector('[data-word-valid="top"]'),
        bottom: document.querySelector('[data-word-valid="bottom"]'),
      },
    };
  }

  init() {
    this.prepareAudio();
    this.createLetterGrid();
    this.calibratePaddles();
    this.placeElements();
    this.updateWordState();

    window.addEventListener("keydown", (event) => this.handleKeyDown(event));
    this.setupMobileInput();
    this.trackViewport();
    // Le navigateur suspend l'audio quand l'onglet est caché : on le relance au retour.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.ensureAudio();
    });
    window.addEventListener("focus", () => this.ensureAudio());
    window.addEventListener("pointerdown", () => this.ensureAudio());
    this.root.dataset.state = "waiting";
    this.root.dataset.turn = this.activeSide;
    this.root.dataset.ready = "true";
  }

  // Suit la zone réellement visible (clavier mobile ouvert) pour dimensionner le jeu.
  // Le footer reste calé en bas de la hauteur complète : le clavier le recouvre au lieu de le faire monter.
  trackViewport() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const style = document.documentElement.style;
    const header = document.querySelector(".site-header");
    const footer = document.querySelector(".site-footer");
    let fullHeight = viewport.height;
    let lastWidth = viewport.width;

    const update = () => {
      // Une largeur différente = rotation ou redimensionnement : on repart de zéro.
      if (viewport.width !== lastWidth) fullHeight = 0;
      lastWidth = viewport.width;
      fullHeight = Math.max(fullHeight, viewport.height, window.innerHeight);
      const keyboardOpen = viewport.height < fullHeight - 120;
      const footerSpace = keyboardOpen ? 0 : footer.offsetHeight;
      style.setProperty("--full-height", `${fullHeight}px`);
      style.setProperty("--app-top", `${viewport.offsetTop}px`);
      style.setProperty(
        "--game-height",
        `${viewport.height - header.offsetHeight - footerSpace}px`,
      );
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("orientationchange", () => window.setTimeout(update, 250));
    update();
  }

  // Champ caché pour faire apparaître le clavier sur mobile.
  // Sentinelle "#" toujours présente : si elle disparaît, c'est un Backspace.
  setupMobileInput() {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "mobile-input";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.autofocus = true;
    input.setAttribute("aria-label", "Saisie");
    input.value = "#";
    document.body.appendChild(input);
    this.mobileInput = input;

    const reset = () => {
      input.value = "#";
      input.setSelectionRange(1, 1);
    };
    input.addEventListener("input", () => {
      const value = input.value;
      reset();
      if (!value.includes("#")) {
        this.handleKeyDown({ key: "Backspace", code: "Backspace", preventDefault() {} });
        return;
      }
      for (const char of value.replace("#", "")) {
        this.handleKeyDown(
          char === " "
            ? { key: " ", code: "Space", preventDefault() {} }
            : { key: char, code: "", preventDefault() {} },
        );
      }
    });
    // Un tap n'importe où redonne le focus (le focus auto est souvent bloqué sans geste).
    window.addEventListener("pointerdown", () => input.focus({ preventScroll: true }));
    input.focus({ preventScroll: true });
  }

  emptyWordState() {
    return {
      normalized: "",
      startsCorrectly: false,
      startLetterIndex: -1,
      targetLetterIndex: -1,
      exists: false,
      valid: false,
    };
  }

  generateLetters() {
    const letters = [];

    while (letters.length < 6) {
      const letter = this.letterPool[Math.floor(Math.random() * this.letterPool.length)];
      if (!letters.includes(letter)) letters.push(letter);
    }

    return letters;
  }

  createLetterGrid() {
    const physicalRows = [
      { owner: "top", startIndex: 0 },
      { owner: "top", startIndex: 3 },
      { owner: "bottom", startIndex: 3 },
      { owner: "bottom", startIndex: 0 },
    ];
    const fragment = document.createDocumentFragment();

    physicalRows.forEach(({ owner, startIndex }) => {
      this.letters[owner].slice(startIndex, startIndex + 3).forEach((letter, lane) => {
        const letterIndex = startIndex + lane;
        const cell = document.createElement("div");
        const value = document.createElement("span");
        cell.className = "letter-cell";
        cell.dataset.owner = owner;
        cell.dataset.letterIndex = letterIndex;
        cell.dataset.lane = lane;
        value.className = "letter-cell__value";
        value.textContent = letter;
        cell.append(value);
        fragment.append(cell);
        this.letterCells[owner][letterIndex] = cell;
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

    if (event.key === "Backspace") {
      if (this.typedWord.length === 0) return;
      event.preventDefault();
      this.ensureAudio();
      this.typedWord = event.ctrlKey || event.metaKey ? "" : this.typedWord.slice(0, -1);
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
    this.popTypedWord(this.activeSide);
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
    const ownLetters = this.letters[this.activeSide];
    const opponent = this.activeSide === "top" ? "bottom" : "top";
    const requiredStartIndex = this.requiredStartIndex[this.activeSide];
    const startLetterIndex = ownLetters.indexOf(normalized[0]);
    const startsCorrectly =
      startLetterIndex !== -1 &&
      (requiredStartIndex === null || startLetterIndex === requiredStartIndex);
    let targetLetterIndex = -1;

    if (startsCorrectly) {
      for (let index = 1; index < normalized.length && targetLetterIndex === -1; index += 1) {
        targetLetterIndex = this.letters[opponent].indexOf(normalized[index]);
      }
    }

    const exists = normalized.length >= 2 && this.dictionary.has(normalized);
    this.wordState = {
      normalized,
      startsCorrectly,
      startLetterIndex,
      targetLetterIndex,
      exists,
      valid: exists && startsCorrectly && targetLetterIndex !== -1,
    };

    this.renderWordState();
  }

  renderWordState() {
    const side = this.activeSide;
    const requiredStartIndex = this.requiredStartIndex[side];
    const opponent = side === "top" ? "bottom" : "top";

    Object.values(this.letterCells).forEach((cells) => {
      cells.forEach((cell) => {
        cell.classList.remove("is-current", "is-included");
      });
    });

    const availableStartIndexes =
      requiredStartIndex === null ? this.letters[side].map((_, index) => index) : [requiredStartIndex];
    availableStartIndexes.forEach((index) => this.letterCells[side][index].classList.add("is-current"));
    if (this.wordState.startsCorrectly) {
      this.letterCells[side][this.wordState.startLetterIndex].classList.add("is-included");
    }
    if (this.wordState.targetLetterIndex !== -1) {
      this.letterCells[opponent][this.wordState.targetLetterIndex].classList.add("is-included");
    }
    if (this.wordState.startsCorrectly && !this.isInFlight) {
      const target = this.getLetterTarget(side, this.wordState.startLetterIndex);
      const position = this.getPaddlePosition(side, target);
      const paddle = this.getPaddle(side);
      paddle.style.left = `${position.left}%`;
      paddle.style.top = `${position.top}%`;
      this.elements.ball.style.left = `${target.left}%`;
      this.elements.ball.style.top = `${target.top}%`;
    }

    this.elements.typedWords[side].textContent = this.typedWord || "-";
    this.elements.typedWords[side].classList.toggle("is-valid", this.wordState.valid);
    Object.entries(this.elements.wordValids).forEach(([player, wordValid]) => {
      wordValid.classList.toggle("is-visible", player === side && this.wordState.valid);
    });
    this.updatePaddleTremble();
  }

  handleSpacePress() {
    if (this.isInFlight) {
      this.finishCurrentShot();
      return;
    }

    if (!this.wordState.valid) {
      this.elements.wordPanels[this.activeSide].animate(
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
    this.stopPaddleTremble();
    this.root.dataset.state = "striking";

    const fromSide = this.activeSide;
    const targetSide = fromSide === "top" ? "bottom" : "top";
    const fromTarget = this.getLetterTarget(fromSide, this.wordState.startLetterIndex);
    const targetLetterIndex = this.wordState.targetLetterIndex;
    const targetTarget = this.getLetterTarget(targetSide, targetLetterIndex);
    const receiver = this.getPaddle(targetSide);
    const receiverStyle = getComputedStyle(receiver);
    const receiverStartPosition = { left: receiverStyle.left, top: receiverStyle.top };
    const receiverTargetPosition = this.getPaddlePosition(targetSide, targetTarget);
    const receiverTransforms = this.getPaddleTransforms(targetSide);
    const wordLength = this.wordState.normalized.length;
    const isPowerShot = wordLength > 6;

    this.playPaddleSound();
    receiver.style.left = `${receiverTargetPosition.left}%`;
    receiver.style.top = `${receiverTargetPosition.top}%`;
    receiver.style.transform = receiverTransforms.recoil;
    const receiverAnimation = receiver.animate(
      [
        {
          left: receiverStartPosition.left,
          top: receiverStartPosition.top,
          transform: receiverTransforms.neutral,
        },
        {
          left: `${receiverTargetPosition.left}%`,
          top: `${receiverTargetPosition.top}%`,
          transform: receiverTransforms.recoil,
        },
      ],
      { duration: 1050, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
    );

    const strikeAnimation = this.animateStrike(fromSide);
    strikeAnimation.finished.then(() => this.movePaddleOutside(fromSide));
    const spinAnimation = isPowerShot ? this.animatePaddleSpin(fromSide) : null;
    this.showShotCallout(wordLength, fromSide);
    this.replaceLetter(fromSide, this.wordState.startLetterIndex);
    this.clearGridHighlights();
    this.root.dataset.state = "in-flight";
    this.positions[targetSide] = targetLetterIndex;
    this.requiredStartIndex[targetSide] = targetLetterIndex;
    this.activeSide = targetSide;
    this.typedWord = "";
    this.wordState = this.emptyWordState();
    this.root.dataset.turn = this.activeSide;
    this.updateWordState();

    const bounceProgress = 0.5;
    const bounceLeft = fromTarget.left + (targetTarget.left - fromTarget.left) * bounceProgress;
    const bounceTop = fromTarget.top + (targetTarget.top - fromTarget.top) * bounceProgress;
    const ballAnimation = this.elements.ball.animate(
      [
        { top: `${fromTarget.top}%`, left: `${fromTarget.left}%` },
        { top: `${targetTarget.top}%`, left: `${targetTarget.left}%` },
      ],
      {
        duration: this.travelDuration,
        easing: "cubic-bezier(0.18, 0.65, 0.32, 1)",
      },
    );

    this.elements.ball.style.top = `${targetTarget.top}%`;
    this.elements.ball.style.left = `${targetTarget.left}%`;
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

    this.isInFlight = false;
    this.currentAnimations = [];
    if (this.bounceTimer) window.clearTimeout(this.bounceTimer);
    this.bounceTimer = null;
    this.currentBounce = null;
    this.hideShotCallout();
    this.root.dataset.state = "waiting";
    this.updateWordState();
  }

  replaceLetter(side, letterIndex) {
    const letters = this.letters[side];
    let nextLetter = letters[letterIndex];

    while (letters.includes(nextLetter)) {
      nextLetter = this.letterPool[Math.floor(Math.random() * this.letterPool.length)];
    }

    letters[letterIndex] = nextLetter;
    const value = this.letterCells[side][letterIndex].querySelector(".letter-cell__value");
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
    Object.values(this.letterCells).forEach((cells) => {
      cells.forEach((cell) => {
        cell.classList.remove("is-current", "is-included");
      });
    });
  }

  placeElements() {
    const topTarget = this.getLetterTarget("top", this.positions.top);
    const bottomTarget = this.getLetterTarget("bottom", this.positions.bottom);
    const topPosition = this.getPaddlePosition("top", topTarget);
    const bottomPosition = this.getPaddlePosition("bottom", bottomTarget);

    this.elements.ball.style.top = `${topTarget.top}%`;
    this.elements.ball.style.left = `${topTarget.left}%`;

    const topPaddle = this.getPaddle("top");
    topPaddle.style.left = `${topPosition.left}%`;
    topPaddle.style.top = `${topPosition.top}%`;
    topPaddle.style.transform = this.getPaddleTransforms("top").recoil;
    const bottomPaddle = this.getPaddle("bottom");
    bottomPaddle.style.left = `${bottomPosition.left}%`;
    bottomPaddle.style.top = "85%";
    bottomPaddle.style.transform = this.getPaddleTransforms("bottom").neutral;
  }

  calibratePaddles() {
    // Mesuré une seule fois, puis stocké en % de la scène : valable à toute taille.
    const sceneRect = this.root.getBoundingClientRect();
    ["top", "bottom"].forEach((side) => {
      const paddle = this.getPaddle(side);
      const sweetSpot = paddle.querySelector("[data-sweet-spot]");
      const transforms = this.getPaddleTransforms(side);
      paddle.style.left = "0%";
      paddle.style.top = "0%";
      paddle.style.bottom = "auto";
      paddle.style.transform = transforms.recoil;

      const spotRect = sweetSpot.getBoundingClientRect();
      this.paddleOffsets[side] = {
        left: ((spotRect.left - sceneRect.left) / sceneRect.width) * 100,
        top: ((spotRect.top - sceneRect.top) / sceneRect.height) * 100,
      };
    });
  }

  getPaddle(side) {
    return this.elements.paddles.find((paddle) => paddle.dataset.paddle === side);
  }

  // Géométrie de la scène, en % de sa largeur (x) ou de sa hauteur (y).
  // Doit rester cohérente avec styles.css (.scene, .table, .ball, borders en cqw).
  static GEOMETRY = {
    aspect: 0.53, // largeur / hauteur de .scene
    tableX: 14, // .table { inset: 17% 14% }
    tableY: 17,
    border: 1.5, // bordure de la table, en % de la largeur
    ballSize: 8.5, // largeur de la balle, en % de la largeur
    gap: 1.3, // écart balle/case, en % de la largeur
  };

  // Rangée physique de la grille (0 = tout en haut) pour une lettre d'un camp.
  getPhysicalRow(side, letterIndex) {
    const second = letterIndex >= 3;
    if (side === "top") return second ? 1 : 0;
    return second ? 2 : 3;
  }

  // Position de la balle et point de contact de la raquette devant une case.
  // Tout est calculé en pourcentages : rien à mesurer, rien à recalculer au redimensionnement.
  getLetterTarget(side, letterIndex) {
    const g = PingPongScene.GEOMETRY;
    const borderY = g.border * g.aspect;
    const innerWidth = 100 - 2 * g.tableX - 2 * g.border;
    const innerHeight = 100 - 2 * g.tableY - 2 * borderY;
    const column = letterIndex % 3;
    const row = this.getPhysicalRow(side, letterIndex);
    const cellWidth = innerWidth / 3;
    const cellHeight = innerHeight / 4;

    const centerX = g.tableX + g.border + cellWidth * (column + 0.5);
    const edgeY = g.tableY + borderY + cellHeight * (side === "top" ? row : row + 1);
    const centerY = edgeY + (side === "top" ? -1 : 1) * g.gap * g.aspect;

    return {
      left: centerX - g.ballSize / 2,
      top: centerY - (g.ballSize / 2) * g.aspect,
      centerX,
      centerY,
    };
  }

  getPaddlePosition(side, target) {
    const offset = this.paddleOffsets[side];
    return {
      left: target.centerX - offset.left,
      top: target.centerY - offset.top,
    };
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

  movePaddleOutside(side) {
    const paddle = this.getPaddle(side);
    const transforms = this.getPaddleTransforms(side);
    const startTop = getComputedStyle(paddle).top;
    const outsideTop = side === "top" ? "0%" : "85%";

    const animation = paddle.animate(
      [
        { top: startTop, transform: transforms.neutral },
        { top: outsideTop, transform: transforms.neutral },
      ],
      { duration: 540, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" },
    );
    animation.finished.then(() => {
      paddle.style.top = outsideTop;
      paddle.style.transform = transforms.neutral;
      animation.cancel();
    });
  }

  showShotCallout(wordLength, side) {
    const label = wordLength === 2 ? "AMORTI !" : wordLength > 6 ? "SMASH !" : "";
    if (!label) return;

    this.elements.shotCallout.textContent = label;
    this.elements.shotCallout.style.setProperty(
      "--shot-color",
      side === "top" ? "var(--blue)" : "var(--red)",
    );
    this.elements.shotCallout.classList.add("is-visible");
  }

  hideShotCallout() {
    this.elements.shotCallout.classList.remove("is-visible");
  }

  popTypedWord(side) {
    this.elements.typedWords[side].animate(
      [
        { transform: "scale(0.92)" },
        { transform: "scale(1.05)", offset: 0.55 },
        { transform: "scale(1)" },
      ],
      { duration: 130, easing: "cubic-bezier(0.2, 0.85, 0.3, 1)" },
    );
  }

  updatePaddleTremble() {
    this.stopPaddleTremble();
    if (!this.typedWord || this.isInFlight) return;

    const side = this.activeSide;
    const paddle = this.getPaddle(side);
    const transforms = this.getPaddleTransforms(side);
    const length = this.typedWord.length;
    const distance = Math.min(7, 0.1 + length * 0.45);
    const rotation = Math.min(4, 0.1 + length * 0.26);
    const duration = Math.max(80, 225 - length * 13);
    const positions = [
      [-1, -0.45, -1],
      [0.75, -1, 0.55],
      [-0.5, 1, 1],
      [1, 0.3, -0.65],
    ];
    if (length >= 7) {
      positions.push(
        [-0.9, 0.7, 0.3],
        [0.25, -0.8, -1],
        [0.95, 0.85, 0.8],
        [-0.7, -0.15, -0.4],
      );
    }

    this.typingPaddleAnimation = paddle.animate(
      positions.map(([x, y, angle]) => ({
        transform: `translate(${x * distance}px, ${y * distance}px) rotate(${angle * rotation}deg) ${transforms.recoil}`,
      })),
      { duration, easing: "steps(2, end)", iterations: Infinity },
    );
  }

  stopPaddleTremble() {
    if (!this.typingPaddleAnimation) return;
    this.typingPaddleAnimation.cancel();
    this.typingPaddleAnimation = null;
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
    // "interrupted" = iOS après mise en arrière-plan ; "closed" = à recréer.
    if (this.audioContext.state === "closed") {
      this.audioContext = null;
      this.prepareAudio();
      return;
    }
    if (this.audioContext.state !== "running") {
      this.audioContext.resume().catch(() => {}).then(() => {
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
