class PingPongScene {
  constructor(root) {
    this.root = root;
    this.activeSide = "top";
    this.isInFlight = false;
    this.queuedReturn = false;
    this.currentAnimations = [];
    this.bounceTimer = null;
    this.currentBounce = null;
    this.audioContext = null;
    this.audioMaster = null;
    this.noiseBuffer = null;
    this.travelDuration = 1300;
    this.lanes = [
      { ball: 18, topPaddle: 0, bottomPaddle: 14 },
      { ball: 46, topPaddle: 28, bottomPaddle: 42 },
      { ball: 74, topPaddle: 56, bottomPaddle: 70 },
    ];
    this.positions = {
      top: 0,
      bottom: 2,
    };
    this.elements = {
      table: root.querySelector("[data-table]"),
      net: root.querySelector("[data-net]"),
      ball: root.querySelector("[data-ball]"),
      paddles: [...root.querySelectorAll("[data-paddle]")],
    };
  }

  init() {
    this.calibratePaddles();
    this.placeElements();
    window.addEventListener("keydown", (event) => {
      if (event.code !== "Space" || event.repeat) return;

      event.preventDefault();
      this.ensureAudio();
      this.handleSpacePress();
    });
    this.root.dataset.state = "waiting";
    this.root.dataset.turn = this.activeSide;
    this.root.dataset.ready = "true";
  }

  pickLane() {
    return Math.floor(Math.random() * this.lanes.length);
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

  handleSpacePress() {
    if (!this.isInFlight) {
      this.returnBall();
      return;
    }

    this.queuedReturn = true;
    this.finishCurrentShot();
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
    if (this.isInFlight) return;

    this.isInFlight = true;
    this.root.dataset.state = "striking";

    const fromSide = this.activeSide;
    const targetSide = fromSide === "top" ? "bottom" : "top";
    const fromLane = this.lanes[this.positions[fromSide]];
    const targetLaneIndex = this.pickLane();
    const targetLane = this.lanes[targetLaneIndex];
    const receiver = this.getPaddle(targetSide);
    const receiverStart = this.lanes[this.positions[targetSide]];
    const receiverStartPosition = this.getPaddlePosition(targetSide, receiverStart);
    const receiverTargetPosition = this.getPaddlePosition(targetSide, targetLane);
    const receiverTransforms = this.getPaddleTransforms(targetSide);

    this.playPaddleSound();
    receiver.style.left = `${receiverTargetPosition}%`;
    receiver.style.transform = receiverTransforms.recoil;
    const receiverAnimation = receiver.animate(
      [
        {
          left: `${receiverStartPosition}%`,
          transform: receiverTransforms.neutral,
        },
        {
          left: `${receiverTargetPosition}%`,
          transform: receiverTransforms.recoil,
        },
      ],
      {
        duration: 1050,
        easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
      },
    );

    const strikeAnimation = this.animateStrike(fromSide);
    this.root.dataset.state = "in-flight";
    const targetTop = targetSide === "top" ? "12%" : "82%";
    const fromTop = fromSide === "top" ? 12 : 82;
    const targetTopValue = targetSide === "top" ? 12 : 82;
    const bounceTop = targetSide === "top" ? 35 : 65;
    const bounceProgress = (bounceTop - fromTop) / (targetTopValue - fromTop);
    const bounceLeft = fromLane.ball + (targetLane.ball - fromLane.ball) * bounceProgress;
    const ballAnimation = this.elements.ball.animate(
      [
        {
          top: fromSide === "top" ? "12%" : "82%",
          left: `${fromLane.ball}%`,
        },
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
    this.currentAnimations = [strikeAnimation, receiverAnimation, ballAnimation];
    await ballAnimation.finished;

    this.positions[targetSide] = targetLaneIndex;
    this.activeSide = targetSide;
    this.isInFlight = false;
    this.currentAnimations = [];
    if (this.bounceTimer) window.clearTimeout(this.bounceTimer);
    this.bounceTimer = null;
    this.currentBounce = null;
    this.root.dataset.state = "waiting";
    this.root.dataset.turn = this.activeSide;

    if (this.queuedReturn) {
      this.queuedReturn = false;
      this.returnBall();
    }
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

  ensureAudio() {
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      this.audioContext = new AudioContext();
      this.audioMaster = this.audioContext.createGain();
      this.audioMaster.gain.value = 0.55;
      this.audioMaster.connect(this.audioContext.destination);

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

    if (this.audioContext.state === "suspended") this.audioContext.resume();
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
    const frequencies = [520];
    const volumes = [0.035];
    const durations = [0.026];

    frequencies.forEach((frequency, index) => {
      const resonance = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      resonance.type = "triangle";
      resonance.frequency.setValueAtTime(frequency * pitchVariation, now);
      resonance.frequency.exponentialRampToValueAtTime(
        frequency * pitchVariation * 0.72,
        now + durations[index],
      );
      gain.gain.setValueAtTime(volumes[index], now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durations[index]);
      resonance.connect(gain).connect(this.audioMaster);
      resonance.start(now);
      resonance.stop(now + durations[index] + 0.01);
    });

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
  new PingPongScene(scene).init();
}
