// Small synthesized sound palette for the 1975 city. Audio starts after the first user gesture.
export function createGameAudio() {
  const AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext;
  let context = null;
  let master = null;
  let rainGain = null;
  let humGain = null;
  let engineGain = null;
  let engineFilter = null;
  let engineLow = null;
  let engineHigh = null;
  let noiseBuffer = null;
  let started = false;
  let muted = false;
  let vehicleActive = false;
  let vehicleSpeed = 0;
  let lastEngineUpdate = 0;
  let lastEngineActive = false;

  function prepare() {
    if (context || !AudioContextType) return Boolean(context);
    try {
      context = new AudioContextType();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.36;
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -18;
      limiter.knee.value = 16;
      limiter.ratio.value = 5;
      limiter.attack.value = .004;
      limiter.release.value = .18;
      master.connect(limiter);
      limiter.connect(context.destination);

      noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 2), context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < samples.length; i++) {
        const white = Math.random() * 2 - 1;
        previous = previous * .84 + white * .16;
        samples[i] = previous;
      }

      const engineBus = context.createGain();
      engineBus.gain.value = 0;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = "lowpass";
      engineFilter.frequency.value = 170;
      engineLow = context.createOscillator();
      engineLow.type = "sawtooth";
      engineLow.frequency.value = 42;
      engineHigh = context.createOscillator();
      engineHigh.type = "triangle";
      engineHigh.frequency.value = 64;
      const engineLowGain = context.createGain();
      engineLowGain.gain.value = .58;
      const engineHighGain = context.createGain();
      engineHighGain.gain.value = .42;
      engineLow.connect(engineLowGain).connect(engineFilter);
      engineHigh.connect(engineHighGain).connect(engineFilter);
      engineFilter.connect(engineBus).connect(master);
      engineGain = engineBus;
      engineLow.start();
      engineHigh.start();
      updateVehicle(vehicleSpeed, vehicleActive);
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function startAmbience() {
    if (!context || started) return;
    started = true;
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 760;
    filter.Q.value = .45;
    rainGain = context.createGain();
    rainGain.gain.value = .052;
    noise.connect(filter).connect(rainGain).connect(master);
    noise.start();

    const hum = context.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 50;
    humGain = context.createGain();
    humGain.gain.value = .026;
    hum.connect(humGain).connect(master);
    hum.start();
  }

  function unlock() {
    if (!prepare()) return;
    if (context.state === "suspended") context.resume().catch(() => {});
    startAmbience();
  }

  function envelope(gain, peak, duration, attack = .006) {
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), now + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  }

  function playTone(frequency, duration = .07, peak = .045, type = "square", slideTo = frequency) {
    if (!context || context.state !== "running" || muted) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    envelope(gain, peak, duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + .015);
  }

  function playNoise(duration, peak, filterType = "lowpass", frequency = 1200) {
    if (!context || context.state !== "running" || muted) return;
    const now = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(90, frequency * .22), now + duration);
    envelope(gain, peak, duration, .003);
    source.connect(filter).connect(gain).connect(master);
    source.start(now);
    source.stop(now + duration + .01);
  }

  function updateVehicle(speed, active) {
    vehicleSpeed = Number(speed) || 0;
    vehicleActive = Boolean(active);
    if (!context || !engineGain) return;
    const now = context.currentTime;
    if (vehicleActive === lastEngineActive && now - lastEngineUpdate < .08) return;
    lastEngineUpdate = now;
    lastEngineActive = vehicleActive;
    const throttle = Math.min(1, Math.abs(vehicleSpeed) / 12);
    const targetGain = vehicleActive ? .075 + throttle * .13 : 0;
    engineGain.gain.setTargetAtTime(muted ? 0 : targetGain, now, .16);
    engineFilter.frequency.setTargetAtTime(145 + throttle * 470, now, .12);
    engineLow.frequency.setTargetAtTime(38 + throttle * 55, now, .12);
    engineHigh.frequency.setTargetAtTime(58 + throttle * 83, now, .12);
  }

  return {
    unlock,
    setMuted(value) {
      muted = Boolean(value);
      if (master && context) master.gain.setTargetAtTime(muted ? 0 : .36, context.currentTime, .025);
      updateVehicle(vehicleSpeed, vehicleActive);
    },
    updateVehicle,
    ui() { playTone(520, .045, .035, "square", 660); },
    confirm() { playTone(420, .065, .045, "square", 790); },
    shot() {
      playNoise(.22, .23, "lowpass", 3900);
      playTone(118, .13, .16, "sawtooth", 39);
    },
    impact() {
      playNoise(.15, .11, "lowpass", 1500);
      playTone(92, .16, .09, "triangle", 46);
    },
    door(open) {
      playNoise(.2, .075, "lowpass", open ? 540 : 380);
      playTone(open ? 94 : 72, .19, .09, "triangle", 42);
    },
    step() {
      playNoise(.065, .028, "bandpass", 920);
      playTone(105, .06, .018, "triangle", 62);
    },
    reward() {
      playTone(440, .12, .05, "square", 520);
      setTimeout(() => playTone(660, .16, .045, "square", 780), 95);
    }
  };
}
