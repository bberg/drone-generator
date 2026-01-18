/**
 * Drone Generator - Web Audio API Implementation
 * Generates ambient drone sounds using multiple layered oscillators
 */

class DroneGenerator {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.analyser = null;

        // Filter
        this.lowpassFilter = null;

        // Reverb (using delay-based reverb)
        this.reverbGain = null;
        this.dryGain = null;
        this.delays = [];
        this.feedbacks = [];

        // LFO for modulation
        this.lfo = null;
        this.lfoGain = null;

        // Oscillator groups for each voice
        this.voices = [];

        // Note frequencies (A4 = 440Hz standard tuning)
        this.noteFrequencies = {
            'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
            'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
            'C4': 261.63, 'D4': 293.66, 'E4': 329.63
        };

        this.isPlaying = false;
        this.timerInterval = null;
        this.timerRemaining = 0;

        // Settings
        this.settings = {
            rootNote: 'C3',
            droneType: 'fifth',
            osc1Level: 0.7,
            osc2Level: 0.3,
            osc3Level: 0,
            detune: 5,
            volume: 0.5,
            fadeTime: 5,
            filterFreq: 2000,
            filterRes: 1,
            reverbAmount: 0.3,
            lfoRate: 0.1,
            lfoDepth: 0.1
        };

        // Visualization
        this.canvas = null;
        this.canvasCtx = null;
        this.animationId = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCanvas();
    }

    initAudioContext() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create lowpass filter
        this.lowpassFilter = this.audioContext.createBiquadFilter();
        this.lowpassFilter.type = 'lowpass';
        this.lowpassFilter.frequency.value = this.settings.filterFreq;
        this.lowpassFilter.Q.value = this.settings.filterRes;

        // Create LFO for modulation
        this.lfo = this.audioContext.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = this.settings.lfoRate;

        this.lfoGain = this.audioContext.createGain();
        this.lfoGain.gain.value = this.settings.lfoDepth * 10; // Scale for filter modulation

        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.lowpassFilter.frequency);
        this.lfo.start();

        // Create master gain
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0;

        // Create reverb using multiple delays
        this.createReverb();

        // Create analyser for visualization
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;

        // Signal chain: voices -> lowpassFilter -> dry/wet mix -> analyser -> destination
        this.lowpassFilter.connect(this.dryGain);
        this.lowpassFilter.connect(this.delays[0]);

        this.dryGain.connect(this.masterGain);
        this.reverbGain.connect(this.masterGain);

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
    }

    createReverb() {
        // Simple delay-based reverb
        this.dryGain = this.audioContext.createGain();
        this.dryGain.gain.value = 1 - this.settings.reverbAmount;

        this.reverbGain = this.audioContext.createGain();
        this.reverbGain.gain.value = this.settings.reverbAmount;

        // Create multiple delay lines for richer reverb
        const delayTimes = [0.03, 0.05, 0.07, 0.11, 0.13];
        const feedbackAmounts = [0.5, 0.4, 0.35, 0.3, 0.25];

        let lastNode = null;

        for (let i = 0; i < delayTimes.length; i++) {
            const delay = this.audioContext.createDelay();
            delay.delayTime.value = delayTimes[i];

            const feedback = this.audioContext.createGain();
            feedback.gain.value = feedbackAmounts[i];

            // Create feedback loop
            delay.connect(feedback);
            feedback.connect(delay);

            // Connect to reverb output
            delay.connect(this.reverbGain);

            this.delays.push(delay);
            this.feedbacks.push(feedback);

            if (i === 0) {
                // First delay receives from filter
            } else if (lastNode) {
                lastNode.connect(delay);
            }
            lastNode = delay;
        }
    }

    createVoices() {
        // Clear existing voices
        this.stopVoices();
        this.voices = [];

        const rootFreq = this.noteFrequencies[this.settings.rootNote];
        const frequencies = this.getDroneFrequencies(rootFreq);

        // Create oscillator groups for each frequency
        frequencies.forEach((freq, index) => {
            const voice = this.createVoice(freq, index);
            this.voices.push(voice);
        });
    }

    getDroneFrequencies(rootFreq) {
        const type = this.settings.droneType;

        switch (type) {
            case 'pure':
                return [rootFreq];
            case 'fifth':
                return [rootFreq, rootFreq * 1.5]; // Perfect fifth (3:2 ratio)
            case 'octave':
                return [rootFreq, rootFreq * 2]; // Octave
            case 'major':
                return [rootFreq, rootFreq * 1.25, rootFreq * 1.5]; // Major chord (root, major 3rd, 5th)
            case 'minor':
                return [rootFreq, rootFreq * 1.2, rootFreq * 1.5]; // Minor chord (root, minor 3rd, 5th)
            default:
                return [rootFreq];
        }
    }

    createVoice(baseFreq, voiceIndex) {
        const voice = {
            oscillators: [],
            gains: [],
            mainGain: null
        };

        // Main gain for this voice
        voice.mainGain = this.audioContext.createGain();
        voice.mainGain.gain.value = 0;
        voice.mainGain.connect(this.lowpassFilter);

        // Oscillator types and their corresponding settings
        const oscTypes = [
            { type: 'sine', level: this.settings.osc1Level },
            { type: 'triangle', level: this.settings.osc2Level },
            { type: 'sawtooth', level: this.settings.osc3Level }
        ];

        oscTypes.forEach((oscConfig, oscIndex) => {
            if (oscConfig.level === 0) return;

            // Create slightly detuned oscillator pair for chorus effect
            const detuneAmount = this.settings.detune;

            // Left oscillator (slightly flat)
            const oscLeft = this.audioContext.createOscillator();
            oscLeft.type = oscConfig.type;
            oscLeft.frequency.value = baseFreq;
            oscLeft.detune.value = -detuneAmount + (voiceIndex * 0.5);

            // Right oscillator (slightly sharp)
            const oscRight = this.audioContext.createOscillator();
            oscRight.type = oscConfig.type;
            oscRight.frequency.value = baseFreq;
            oscRight.detune.value = detuneAmount + (voiceIndex * 0.5);

            // Gain for this oscillator pair
            const oscGain = this.audioContext.createGain();
            oscGain.gain.value = oscConfig.level * 0.5;

            // Create stereo panner for width
            const pannerLeft = this.audioContext.createStereoPanner();
            pannerLeft.pan.value = -0.3;

            const pannerRight = this.audioContext.createStereoPanner();
            pannerRight.pan.value = 0.3;

            // Connect
            oscLeft.connect(pannerLeft);
            pannerLeft.connect(oscGain);

            oscRight.connect(pannerRight);
            pannerRight.connect(oscGain);

            oscGain.connect(voice.mainGain);

            voice.oscillators.push(oscLeft, oscRight);
            voice.gains.push(oscGain);

            oscLeft.start();
            oscRight.start();
        });

        return voice;
    }

    stopVoices() {
        this.voices.forEach(voice => {
            voice.oscillators.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {}
            });
            voice.gains.forEach(gain => {
                try {
                    gain.disconnect();
                } catch (e) {}
            });
            if (voice.mainGain) {
                try {
                    voice.mainGain.disconnect();
                } catch (e) {}
            }
        });
        this.voices = [];
    }

    play() {
        this.initAudioContext();

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Create new voices
        this.createVoices();

        // Fade in
        const fadeTime = this.settings.fadeTime;
        const now = this.audioContext.currentTime;

        // Fade in master
        this.masterGain.gain.setValueAtTime(0, now);
        this.masterGain.gain.linearRampToValueAtTime(this.settings.volume, now + fadeTime);

        // Fade in each voice
        this.voices.forEach(voice => {
            voice.mainGain.gain.setValueAtTime(0, now);
            voice.mainGain.gain.linearRampToValueAtTime(1, now + fadeTime);
        });

        this.isPlaying = true;
        this.updatePlayButton();
        this.updateStatus('playing');
        this.startVisualization();
    }

    stop() {
        if (!this.audioContext || !this.isPlaying) return;

        const fadeTime = this.settings.fadeTime;
        const now = this.audioContext.currentTime;

        // Fade out master
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0, now + fadeTime);

        // Schedule voice cleanup after fade
        setTimeout(() => {
            this.stopVoices();
        }, (fadeTime + 0.1) * 1000);

        this.isPlaying = false;
        this.updatePlayButton();
        this.updateStatus('ready');
        this.stopVisualization();
    }

    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }

    // Update methods
    setRootNote(note) {
        this.settings.rootNote = note;
        document.getElementById('currentNote').textContent = note;

        if (this.isPlaying) {
            // Recreate voices with new note
            const fadeTime = 0.5;
            const now = this.audioContext.currentTime;

            // Quick crossfade
            this.voices.forEach(voice => {
                voice.mainGain.gain.linearRampToValueAtTime(0, now + fadeTime);
            });

            setTimeout(() => {
                this.stopVoices();
                this.createVoices();

                const newNow = this.audioContext.currentTime;
                this.voices.forEach(voice => {
                    voice.mainGain.gain.setValueAtTime(0, newNow);
                    voice.mainGain.gain.linearRampToValueAtTime(1, newNow + fadeTime);
                });
            }, fadeTime * 1000);
        }
    }

    setDroneType(type) {
        this.settings.droneType = type;

        if (this.isPlaying) {
            // Recreate voices with new type
            const fadeTime = 0.5;
            const now = this.audioContext.currentTime;

            this.voices.forEach(voice => {
                voice.mainGain.gain.linearRampToValueAtTime(0, now + fadeTime);
            });

            setTimeout(() => {
                this.stopVoices();
                this.createVoices();

                const newNow = this.audioContext.currentTime;
                this.voices.forEach(voice => {
                    voice.mainGain.gain.setValueAtTime(0, newNow);
                    voice.mainGain.gain.linearRampToValueAtTime(1, newNow + fadeTime);
                });
            }, fadeTime * 1000);
        }
    }

    setOscLevel(oscIndex, value) {
        const key = `osc${oscIndex}Level`;
        this.settings[key] = value;

        // Update existing voices
        this.voices.forEach(voice => {
            if (voice.gains[oscIndex - 1]) {
                voice.gains[oscIndex - 1].gain.setTargetAtTime(
                    value * 0.5,
                    this.audioContext.currentTime,
                    0.1
                );
            }
        });
    }

    setDetune(value) {
        this.settings.detune = value;

        // Update existing oscillators
        this.voices.forEach(voice => {
            voice.oscillators.forEach((osc, i) => {
                const isLeft = i % 2 === 0;
                osc.detune.setTargetAtTime(
                    isLeft ? -value : value,
                    this.audioContext.currentTime,
                    0.1
                );
            });
        });
    }

    setMasterVolume(value) {
        this.settings.volume = value;
        if (this.masterGain && this.isPlaying) {
            this.masterGain.gain.setTargetAtTime(
                value,
                this.audioContext.currentTime,
                0.1
            );
        }
    }

    setFadeTime(value) {
        this.settings.fadeTime = value;
    }

    setFilterFreq(value) {
        this.settings.filterFreq = value;
        if (this.lowpassFilter) {
            this.lowpassFilter.frequency.setTargetAtTime(
                value,
                this.audioContext.currentTime,
                0.1
            );
        }
    }

    setFilterRes(value) {
        this.settings.filterRes = value;
        if (this.lowpassFilter) {
            this.lowpassFilter.Q.setTargetAtTime(
                value,
                this.audioContext.currentTime,
                0.1
            );
        }
    }

    setReverbAmount(value) {
        this.settings.reverbAmount = value;
        if (this.dryGain && this.reverbGain) {
            this.dryGain.gain.setTargetAtTime(
                1 - value,
                this.audioContext.currentTime,
                0.1
            );
            this.reverbGain.gain.setTargetAtTime(
                value,
                this.audioContext.currentTime,
                0.1
            );
        }
    }

    setLfoRate(value) {
        this.settings.lfoRate = value;
        if (this.lfo) {
            this.lfo.frequency.setTargetAtTime(
                value,
                this.audioContext.currentTime,
                0.1
            );
        }
    }

    setLfoDepth(value) {
        this.settings.lfoDepth = value;
        if (this.lfoGain) {
            // Scale depth to filter frequency modulation
            this.lfoGain.gain.setTargetAtTime(
                value * this.settings.filterFreq * 0.5,
                this.audioContext.currentTime,
                0.1
            );
        }
    }

    applyPreset(preset) {
        const presets = {
            meditation: {
                rootNote: 'C3',
                droneType: 'fifth',
                osc1Level: 80,
                osc2Level: 20,
                osc3Level: 0,
                detune: 3,
                filterFreq: 1500,
                filterRes: 1,
                reverbAmount: 40,
                lfoRate: 5,
                lfoDepth: 15
            },
            sleep: {
                rootNote: 'C2',
                droneType: 'octave',
                osc1Level: 90,
                osc2Level: 10,
                osc3Level: 0,
                detune: 2,
                filterFreq: 800,
                filterRes: 0,
                reverbAmount: 50,
                lfoRate: 3,
                lfoDepth: 5
            },
            focus: {
                rootNote: 'A3',
                droneType: 'fifth',
                osc1Level: 60,
                osc2Level: 30,
                osc3Level: 10,
                detune: 5,
                filterFreq: 3000,
                filterRes: 2,
                reverbAmount: 20,
                lfoRate: 8,
                lfoDepth: 8
            },
            cinematic: {
                rootNote: 'D2',
                droneType: 'minor',
                osc1Level: 50,
                osc2Level: 30,
                osc3Level: 20,
                detune: 8,
                filterFreq: 2500,
                filterRes: 3,
                reverbAmount: 60,
                lfoRate: 6,
                lfoDepth: 20
            }
        };

        if (presets[preset]) {
            const p = presets[preset];

            // Update UI elements
            document.getElementById('rootNote').value = p.rootNote;
            document.getElementById('droneType').value = p.droneType;

            document.getElementById('osc1Level').value = p.osc1Level;
            document.getElementById('osc1Value').textContent = p.osc1Level + '%';

            document.getElementById('osc2Level').value = p.osc2Level;
            document.getElementById('osc2Value').textContent = p.osc2Level + '%';

            document.getElementById('osc3Level').value = p.osc3Level;
            document.getElementById('osc3Value').textContent = p.osc3Level + '%';

            document.getElementById('detune').value = p.detune;
            document.getElementById('detuneValue').textContent = p.detune + ' cents';

            document.getElementById('filterFreq').value = p.filterFreq;
            document.getElementById('filterFreqValue').textContent = p.filterFreq + ' Hz';

            document.getElementById('filterRes').value = p.filterRes;
            document.getElementById('filterResValue').textContent = p.filterRes;

            document.getElementById('reverbAmount').value = p.reverbAmount;
            document.getElementById('reverbValue').textContent = p.reverbAmount + '%';

            document.getElementById('lfoRate').value = p.lfoRate;
            document.getElementById('lfoRateValue').textContent = (p.lfoRate / 100).toFixed(2) + ' Hz';

            document.getElementById('lfoDepth').value = p.lfoDepth;
            document.getElementById('lfoDepthValue').textContent = p.lfoDepth + '%';

            document.getElementById('currentNote').textContent = p.rootNote;

            // Apply settings
            this.settings.rootNote = p.rootNote;
            this.settings.droneType = p.droneType;
            this.settings.osc1Level = p.osc1Level / 100;
            this.settings.osc2Level = p.osc2Level / 100;
            this.settings.osc3Level = p.osc3Level / 100;
            this.settings.detune = p.detune;
            this.settings.filterFreq = p.filterFreq;
            this.settings.filterRes = p.filterRes;
            this.settings.reverbAmount = p.reverbAmount / 100;
            this.settings.lfoRate = p.lfoRate / 100;
            this.settings.lfoDepth = p.lfoDepth / 100;

            // Apply to audio if playing
            if (this.audioContext) {
                this.setFilterFreq(p.filterFreq);
                this.setFilterRes(p.filterRes);
                this.setReverbAmount(p.reverbAmount / 100);
                this.setLfoRate(p.lfoRate / 100);
                this.setLfoDepth(p.lfoDepth / 100);
            }

            // Recreate voices if playing
            if (this.isPlaying) {
                const fadeTime = 0.5;
                const now = this.audioContext.currentTime;

                this.voices.forEach(voice => {
                    voice.mainGain.gain.linearRampToValueAtTime(0, now + fadeTime);
                });

                setTimeout(() => {
                    this.stopVoices();
                    this.createVoices();

                    const newNow = this.audioContext.currentTime;
                    this.voices.forEach(voice => {
                        voice.mainGain.gain.setValueAtTime(0, newNow);
                        voice.mainGain.gain.linearRampToValueAtTime(1, newNow + fadeTime);
                    });
                }, fadeTime * 1000);
            }

            // Update active button
            document.querySelectorAll('.preset-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.preset === preset) {
                    btn.classList.add('active');
                }
            });
        }
    }

    updatePlayButton() {
        const btn = document.getElementById('playButton');
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');

        if (this.isPlaying) {
            btn.classList.add('playing');
            icon.className = 'ri-stop-fill';
            text.textContent = 'Stop';
        } else {
            btn.classList.remove('playing');
            icon.className = 'ri-play-fill';
            text.textContent = 'Play';
        }
    }

    updateStatus(state) {
        const badge = document.getElementById('statusBadge');
        const text = badge.querySelector('.status-text');

        badge.className = 'status-badge ' + state;
        text.textContent = state === 'playing' ? 'Playing' : 'Ready';
    }

    // Timer functionality
    startTimer(minutes) {
        this.stopTimer();

        this.timerRemaining = minutes * 60;
        this.updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            this.timerRemaining--;
            this.updateTimerDisplay();

            if (this.timerRemaining <= 0) {
                this.stopTimer();
                this.stop();
            }
        }, 1000);

        document.getElementById('timerDisplay').classList.add('active');
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timerRemaining = 0;
        document.getElementById('timerDisplay').classList.remove('active');
        document.getElementById('timerValue').textContent = '--:--';
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timerRemaining / 60);
        const seconds = this.timerRemaining % 60;
        document.getElementById('timerValue').textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Visualization
    setupCanvas() {
        this.canvas = document.getElementById('waveformCanvas');
        if (!this.canvas) return;

        this.canvasCtx = this.canvas.getContext('2d');
        this.resizeCanvas();

        window.addEventListener('resize', () => this.resizeCanvas());

        // Draw initial static state
        this.drawStaticWaveform();
    }

    resizeCanvas() {
        if (!this.canvas) return;

        const container = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = container.clientWidth * dpr;
        this.canvas.height = 120 * dpr;

        this.canvas.style.width = container.clientWidth + 'px';
        this.canvas.style.height = '120px';

        this.canvasCtx.scale(dpr, dpr);

        if (!this.isPlaying) {
            this.drawStaticWaveform();
        }
    }

    drawStaticWaveform() {
        if (!this.canvasCtx) return;

        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);

        this.canvasCtx.fillStyle = '#000';
        this.canvasCtx.fillRect(0, 0, width, height);

        // Draw center line
        this.canvasCtx.strokeStyle = '#333';
        this.canvasCtx.lineWidth = 1;
        this.canvasCtx.beginPath();
        this.canvasCtx.moveTo(0, height / 2);
        this.canvasCtx.lineTo(width, height / 2);
        this.canvasCtx.stroke();
    }

    startVisualization() {
        if (!this.analyser) return;

        const draw = () => {
            if (!this.isPlaying) return;

            this.animationId = requestAnimationFrame(draw);

            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteTimeDomainData(dataArray);

            const width = this.canvas.width / (window.devicePixelRatio || 1);
            const height = this.canvas.height / (window.devicePixelRatio || 1);

            this.canvasCtx.fillStyle = '#000';
            this.canvasCtx.fillRect(0, 0, width, height);

            this.canvasCtx.lineWidth = 2;
            this.canvasCtx.strokeStyle = '#10b981';
            this.canvasCtx.beginPath();

            const sliceWidth = width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * height) / 2;

                if (i === 0) {
                    this.canvasCtx.moveTo(x, y);
                } else {
                    this.canvasCtx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            this.canvasCtx.lineTo(width, height / 2);
            this.canvasCtx.stroke();
        };

        draw();
    }

    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.drawStaticWaveform();
    }

    setupEventListeners() {
        // Play button
        document.getElementById('playButton')?.addEventListener('click', () => {
            this.toggle();
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyPreset(btn.dataset.preset);
                if (!this.isPlaying) {
                    this.play();
                }
            });
        });

        // Root note selector
        document.getElementById('rootNote')?.addEventListener('change', (e) => {
            this.setRootNote(e.target.value);
        });

        // Drone type selector
        document.getElementById('droneType')?.addEventListener('change', (e) => {
            this.setDroneType(e.target.value);
        });

        // Oscillator level sliders
        [1, 2, 3].forEach(num => {
            const slider = document.getElementById(`osc${num}Level`);
            const display = document.getElementById(`osc${num}Value`);

            slider?.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                display.textContent = Math.round(value * 100) + '%';
                this.setOscLevel(num, value);
            });
        });

        // Detune slider
        const detuneSlider = document.getElementById('detune');
        const detuneDisplay = document.getElementById('detuneValue');
        detuneSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            detuneDisplay.textContent = value + ' cents';
            this.setDetune(value);
        });

        // Master volume
        const volumeSlider = document.getElementById('volume');
        const volumeDisplay = document.getElementById('volumeValue');
        volumeSlider?.addEventListener('input', (e) => {
            const value = e.target.value / 100;
            volumeDisplay.textContent = Math.round(value * 100) + '%';
            this.setMasterVolume(value);
        });

        // Fade time
        const fadeSlider = document.getElementById('fadeTime');
        const fadeDisplay = document.getElementById('fadeTimeValue');
        fadeSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            fadeDisplay.textContent = value + ' sec';
            this.setFadeTime(value);
        });

        // Filter frequency
        const filterFreqSlider = document.getElementById('filterFreq');
        const filterFreqDisplay = document.getElementById('filterFreqValue');
        filterFreqSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            filterFreqDisplay.textContent = value + ' Hz';
            this.setFilterFreq(value);
        });

        // Filter resonance
        const filterResSlider = document.getElementById('filterRes');
        const filterResDisplay = document.getElementById('filterResValue');
        filterResSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            filterResDisplay.textContent = value;
            this.setFilterRes(value);
        });

        // Reverb amount
        const reverbSlider = document.getElementById('reverbAmount');
        const reverbDisplay = document.getElementById('reverbValue');
        reverbSlider?.addEventListener('input', (e) => {
            const value = e.target.value / 100;
            reverbDisplay.textContent = Math.round(value * 100) + '%';
            this.setReverbAmount(value);
        });

        // LFO rate
        const lfoRateSlider = document.getElementById('lfoRate');
        const lfoRateDisplay = document.getElementById('lfoRateValue');
        lfoRateSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) / 100;
            lfoRateDisplay.textContent = value.toFixed(2) + ' Hz';
            this.setLfoRate(value);
        });

        // LFO depth
        const lfoDepthSlider = document.getElementById('lfoDepth');
        const lfoDepthDisplay = document.getElementById('lfoDepthValue');
        lfoDepthSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) / 100;
            lfoDepthDisplay.textContent = Math.round(value * 100) + '%';
            this.setLfoDepth(value);
        });

        // Timer controls
        document.querySelectorAll('.timer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const minutes = parseInt(btn.dataset.time);

                document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));

                if (minutes === 0) {
                    this.stopTimer();
                } else {
                    btn.classList.add('active');
                    this.startTimer(minutes);
                    if (!this.isPlaying) {
                        this.play();
                    }
                }
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            if (e.code === 'Space') {
                e.preventDefault();
                this.toggle();
            }
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.droneGenerator = new DroneGenerator();
});
