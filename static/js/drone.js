/**
 * Drone Generator - Web Audio API Implementation
 * Generates ambient drone sounds using multiple layered oscillators
 * Features: Multiple drone types, tuning systems, evolution mode, and presets
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

        // Tuning systems
        this.tunings = {
            'standard': 440,      // A4 = 440 Hz (modern standard)
            'verdi': 432,         // A4 = 432 Hz (Verdi tuning)
            'baroque': 415,       // A4 = 415 Hz (Baroque pitch)
            'scientific': 430.54  // A4 based on C4 = 256 Hz (Scientific pitch)
        };

        // Solfeggio frequencies (as root notes, not A4 references)
        this.solfeggioFrequencies = {
            '174': 174,    // Pain relief
            '285': 285,    // Tissue healing
            '396': 396,    // Liberation from fear
            '417': 417,    // Facilitating change
            '528': 528,    // Transformation (Love frequency)
            '639': 639,    // Connecting relationships
            '741': 741,    // Awakening intuition
            '852': 852,    // Spiritual order
            '963': 963     // Higher consciousness
        };

        // Current tuning reference
        this.currentTuning = 'standard';

        // Base note frequencies calculated from A4 reference
        this.noteFrequencies = this.calculateNoteFrequencies(440);

        this.isPlaying = false;
        this.timerInterval = null;
        this.timerRemaining = 0;

        // Evolution mode
        this.evolutionEnabled = false;
        this.evolutionSpeed = 'medium';
        this.evolutionInterval = null;
        this.evolutionTargets = {};

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
            lfoDepth: 0.1,
            tuning: 'standard',
            evolution: false,
            evolutionSpeed: 'medium'
        };

        // Visualization
        this.canvas = null;
        this.canvasCtx = null;
        this.animationId = null;

        this.init();
    }

    calculateNoteFrequencies(a4Reference) {
        // Calculate all note frequencies based on A4 reference
        const notes = {};
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // A4 is the 49th key on a piano, middle C (C4) is key 40
        // Formula: freq = a4Reference * 2^((n-49)/12) where n is the piano key number

        for (let octave = 1; octave <= 5; octave++) {
            noteNames.forEach((note, index) => {
                // Calculate semitones from A4
                const semitones = (octave - 4) * 12 + (index - 9); // -9 because A is at index 9
                const freq = a4Reference * Math.pow(2, semitones / 12);
                const noteName = note + octave;

                // Only include notes we want
                if (octave >= 2 && octave <= 4 && !note.includes('#')) {
                    notes[noteName] = freq;
                }
            });
        }

        return notes;
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
        this.lfoGain.gain.value = this.settings.lfoDepth * 10;

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

        // Signal chain
        this.lowpassFilter.connect(this.dryGain);
        this.lowpassFilter.connect(this.delays[0]);

        this.dryGain.connect(this.masterGain);
        this.reverbGain.connect(this.masterGain);

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
    }

    createReverb() {
        this.dryGain = this.audioContext.createGain();
        this.dryGain.gain.value = 1 - this.settings.reverbAmount;

        this.reverbGain = this.audioContext.createGain();
        this.reverbGain.gain.value = this.settings.reverbAmount;

        const delayTimes = [0.03, 0.05, 0.07, 0.11, 0.13];
        const feedbackAmounts = [0.5, 0.4, 0.35, 0.3, 0.25];

        let lastNode = null;

        for (let i = 0; i < delayTimes.length; i++) {
            const delay = this.audioContext.createDelay();
            delay.delayTime.value = delayTimes[i];

            const feedback = this.audioContext.createGain();
            feedback.gain.value = feedbackAmounts[i];

            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(this.reverbGain);

            this.delays.push(delay);
            this.feedbacks.push(feedback);

            if (lastNode) {
                lastNode.connect(delay);
            }
            lastNode = delay;
        }
    }

    createVoices() {
        this.stopVoices();
        this.voices = [];

        let rootFreq;

        // Check if using Solfeggio frequency
        if (this.settings.rootNote.startsWith('solfeggio_')) {
            const freqKey = this.settings.rootNote.replace('solfeggio_', '');
            rootFreq = this.solfeggioFrequencies[freqKey];
        } else {
            rootFreq = this.noteFrequencies[this.settings.rootNote];
        }

        const frequencies = this.getDroneFrequencies(rootFreq);

        frequencies.forEach((freq, index) => {
            const voice = this.createVoice(freq, index);
            this.voices.push(voice);
        });
    }

    getDroneFrequencies(rootFreq) {
        const type = this.settings.droneType;
        const useJust = document.getElementById('justIntonation')?.checked || false;

        // Just intonation ratios (pure mathematical ratios)
        const justRatios = {
            fifth: 3/2,
            majorThird: 5/4,
            minorThird: 6/5,
            fourth: 4/3,
            majorSecond: 9/8,
            minorSecond: 16/15
        };

        // Equal temperament ratios (12-TET)
        const equalRatios = {
            fifth: Math.pow(2, 7/12),      // ~1.498
            majorThird: Math.pow(2, 4/12),  // ~1.260
            minorThird: Math.pow(2, 3/12),  // ~1.189
            fourth: Math.pow(2, 5/12),      // ~1.335
            majorSecond: Math.pow(2, 2/12), // ~1.122
            minorSecond: Math.pow(2, 1/12)  // ~1.059
        };

        const ratios = useJust ? justRatios : equalRatios;

        switch (type) {
            case 'pure':
                return [rootFreq];
            case 'fifth':
                return [rootFreq, rootFreq * ratios.fifth];
            case 'octave':
                return [rootFreq, rootFreq * 2];
            case 'major':
                return [rootFreq, rootFreq * ratios.majorThird, rootFreq * ratios.fifth];
            case 'minor':
                return [rootFreq, rootFreq * ratios.minorThird, rootFreq * ratios.fifth];
            case 'sus2':
                return [rootFreq, rootFreq * ratios.majorSecond, rootFreq * ratios.fifth];
            case 'sus4':
                return [rootFreq, rootFreq * ratios.fourth, rootFreq * ratios.fifth];
            case 'power':
                return [rootFreq, rootFreq * ratios.fifth, rootFreq * 2];
            case 'open5':
                return [rootFreq / ratios.fifth, rootFreq, rootFreq * ratios.fifth];
            case 'dorian':
                // Root + minor 3rd + major 6th feel
                return [rootFreq, rootFreq * ratios.minorThird, rootFreq * ratios.fifth, rootFreq * (useJust ? 5/3 : Math.pow(2, 9/12))];
            case 'phrygian':
                // Root + minor 2nd + minor 3rd
                return [rootFreq, rootFreq * ratios.minorSecond, rootFreq * ratios.minorThird, rootFreq * ratios.fifth];
            case 'lydian':
                // Root + raised 4th + 5th
                return [rootFreq, rootFreq * (useJust ? 45/32 : Math.pow(2, 6/12)), rootFreq * ratios.fifth];
            case 'mixolydian':
                // Root + major 3rd + minor 7th
                return [rootFreq, rootFreq * ratios.majorThird, rootFreq * ratios.fifth, rootFreq * (useJust ? 9/5 : Math.pow(2, 10/12))];
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

        voice.mainGain = this.audioContext.createGain();
        voice.mainGain.gain.value = 0;
        voice.mainGain.connect(this.lowpassFilter);

        const oscTypes = [
            { type: 'sine', level: this.settings.osc1Level },
            { type: 'triangle', level: this.settings.osc2Level },
            { type: 'sawtooth', level: this.settings.osc3Level }
        ];

        oscTypes.forEach((oscConfig, oscIndex) => {
            if (oscConfig.level === 0) return;

            const detuneAmount = this.settings.detune;

            const oscLeft = this.audioContext.createOscillator();
            oscLeft.type = oscConfig.type;
            oscLeft.frequency.value = baseFreq;
            oscLeft.detune.value = -detuneAmount + (voiceIndex * 0.5);

            const oscRight = this.audioContext.createOscillator();
            oscRight.type = oscConfig.type;
            oscRight.frequency.value = baseFreq;
            oscRight.detune.value = detuneAmount + (voiceIndex * 0.5);

            const oscGain = this.audioContext.createGain();
            oscGain.gain.value = oscConfig.level * 0.5;

            const pannerLeft = this.audioContext.createStereoPanner();
            pannerLeft.pan.value = -0.3;

            const pannerRight = this.audioContext.createStereoPanner();
            pannerRight.pan.value = 0.3;

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

        this.createVoices();

        const fadeTime = this.settings.fadeTime;
        const now = this.audioContext.currentTime;

        this.masterGain.gain.setValueAtTime(0, now);
        this.masterGain.gain.linearRampToValueAtTime(this.settings.volume, now + fadeTime);

        this.voices.forEach(voice => {
            voice.mainGain.gain.setValueAtTime(0, now);
            voice.mainGain.gain.linearRampToValueAtTime(1, now + fadeTime);
        });

        this.isPlaying = true;
        this.updatePlayButton();
        this.updateStatus('playing');
        this.startVisualization();

        // Start evolution if enabled
        if (this.evolutionEnabled) {
            this.startEvolution();
        }
    }

    stop() {
        if (!this.audioContext || !this.isPlaying) return;

        const fadeTime = this.settings.fadeTime;
        const now = this.audioContext.currentTime;

        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0, now + fadeTime);

        setTimeout(() => {
            this.stopVoices();
        }, (fadeTime + 0.1) * 1000);

        this.isPlaying = false;
        this.updatePlayButton();
        this.updateStatus('ready');
        this.stopVisualization();
        this.stopEvolution();
    }

    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }

    // Evolution mode - subtle parameter drift over time
    startEvolution() {
        if (this.evolutionInterval) return;

        const speeds = {
            slow: 3000,
            medium: 1500,
            fast: 800
        };

        const intervalTime = speeds[this.evolutionSpeed] || speeds.medium;

        // Initialize targets
        this.evolutionTargets = {
            filterFreq: this.settings.filterFreq,
            lfoDepth: this.settings.lfoDepth,
            detune: this.settings.detune
        };

        this.evolutionInterval = setInterval(() => {
            if (!this.isPlaying) return;

            // Drift filter frequency
            const filterRange = this.settings.filterFreq * 0.2;
            const filterDrift = (Math.random() - 0.5) * filterRange;
            let newFilterFreq = this.evolutionTargets.filterFreq + filterDrift;
            newFilterFreq = Math.max(500, Math.min(5000, newFilterFreq));
            this.evolutionTargets.filterFreq = newFilterFreq;

            if (this.lowpassFilter) {
                this.lowpassFilter.frequency.setTargetAtTime(
                    newFilterFreq,
                    this.audioContext.currentTime,
                    1.0
                );
            }

            // Drift LFO depth
            const depthDrift = (Math.random() - 0.5) * 0.05;
            let newDepth = this.evolutionTargets.lfoDepth + depthDrift;
            newDepth = Math.max(0.02, Math.min(0.3, newDepth));
            this.evolutionTargets.lfoDepth = newDepth;

            if (this.lfoGain) {
                this.lfoGain.gain.setTargetAtTime(
                    newDepth * this.settings.filterFreq * 0.5,
                    this.audioContext.currentTime,
                    1.0
                );
            }

            // Occasionally drift detune slightly
            if (Math.random() > 0.7) {
                const detuneDrift = (Math.random() - 0.5) * 2;
                let newDetune = this.evolutionTargets.detune + detuneDrift;
                newDetune = Math.max(1, Math.min(15, newDetune));
                this.evolutionTargets.detune = newDetune;

                this.voices.forEach(voice => {
                    voice.oscillators.forEach((osc, i) => {
                        const isLeft = i % 2 === 0;
                        osc.detune.setTargetAtTime(
                            isLeft ? -newDetune : newDetune,
                            this.audioContext.currentTime,
                            0.5
                        );
                    });
                });
            }

        }, intervalTime);
    }

    stopEvolution() {
        if (this.evolutionInterval) {
            clearInterval(this.evolutionInterval);
            this.evolutionInterval = null;
        }
    }

    setEvolution(enabled) {
        this.evolutionEnabled = enabled;
        this.settings.evolution = enabled;

        if (enabled && this.isPlaying) {
            this.startEvolution();
        } else {
            this.stopEvolution();
        }
    }

    setEvolutionSpeed(speed) {
        this.evolutionSpeed = speed;
        this.settings.evolutionSpeed = speed;

        if (this.evolutionEnabled && this.isPlaying) {
            this.stopEvolution();
            this.startEvolution();
        }
    }

    setTuning(tuning) {
        this.currentTuning = tuning;
        this.settings.tuning = tuning;

        if (this.tunings[tuning]) {
            this.noteFrequencies = this.calculateNoteFrequencies(this.tunings[tuning]);
        }

        if (this.isPlaying) {
            this.recreateVoices();
        }
    }

    recreateVoices() {
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

    setRootNote(note) {
        this.settings.rootNote = note;

        // Update display
        const displayNote = note.startsWith('solfeggio_')
            ? note.replace('solfeggio_', '') + ' Hz'
            : note;
        document.getElementById('currentNote').textContent = displayNote;

        if (this.isPlaying) {
            this.recreateVoices();
        }
    }

    setDroneType(type) {
        this.settings.droneType = type;

        if (this.isPlaying) {
            this.recreateVoices();
        }
    }

    setOscLevel(oscIndex, value) {
        const key = `osc${oscIndex}Level`;
        this.settings[key] = value;

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
                lfoDepth: 15,
                evolution: true,
                evolutionSpeed: 'slow'
            },
            sleep: {
                rootNote: 'C2',
                droneType: 'octave',
                osc1Level: 90,
                osc2Level: 10,
                osc3Level: 0,
                detune: 2,
                filterFreq: 600,
                filterRes: 0,
                reverbAmount: 50,
                lfoRate: 2,
                lfoDepth: 5,
                evolution: true,
                evolutionSpeed: 'slow'
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
                lfoDepth: 8,
                evolution: false,
                evolutionSpeed: 'medium'
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
                lfoDepth: 20,
                evolution: true,
                evolutionSpeed: 'medium'
            },
            soundBath: {
                rootNote: 'solfeggio_528',
                droneType: 'fifth',
                osc1Level: 85,
                osc2Level: 15,
                osc3Level: 0,
                detune: 4,
                filterFreq: 2000,
                filterRes: 1,
                reverbAmount: 55,
                lfoRate: 4,
                lfoDepth: 12,
                evolution: true,
                evolutionSpeed: 'slow'
            },
            yogaFlow: {
                rootNote: 'G3',
                droneType: 'sus4',
                osc1Level: 70,
                osc2Level: 25,
                osc3Level: 5,
                detune: 5,
                filterFreq: 2800,
                filterRes: 2,
                reverbAmount: 35,
                lfoRate: 6,
                lfoDepth: 10,
                evolution: true,
                evolutionSpeed: 'medium'
            },
            deepGrounding: {
                rootNote: 'C2',
                droneType: 'power',
                osc1Level: 95,
                osc2Level: 5,
                osc3Level: 0,
                detune: 2,
                filterFreq: 500,
                filterRes: 0,
                reverbAmount: 40,
                lfoRate: 2,
                lfoDepth: 3,
                evolution: false,
                evolutionSpeed: 'slow'
            },
            cosmicDrift: {
                rootNote: 'E3',
                droneType: 'lydian',
                osc1Level: 55,
                osc2Level: 30,
                osc3Level: 15,
                detune: 10,
                filterFreq: 3500,
                filterRes: 4,
                reverbAmount: 70,
                lfoRate: 3,
                lfoDepth: 25,
                evolution: true,
                evolutionSpeed: 'fast'
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

            // Update evolution controls
            const evolutionToggle = document.getElementById('evolutionToggle');
            const evolutionSpeed = document.getElementById('evolutionSpeed');
            if (evolutionToggle) {
                evolutionToggle.checked = p.evolution;
            }
            if (evolutionSpeed) {
                evolutionSpeed.value = p.evolutionSpeed;
            }

            // Update note display
            const displayNote = p.rootNote.startsWith('solfeggio_')
                ? p.rootNote.replace('solfeggio_', '') + ' Hz'
                : p.rootNote;
            document.getElementById('currentNote').textContent = displayNote;

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

            // Set evolution
            this.evolutionEnabled = p.evolution;
            this.evolutionSpeed = p.evolutionSpeed;
            this.settings.evolution = p.evolution;
            this.settings.evolutionSpeed = p.evolutionSpeed;

            // Apply to audio if playing
            if (this.audioContext) {
                this.setFilterFreq(p.filterFreq);
                this.setFilterRes(p.filterRes);
                this.setReverbAmount(p.reverbAmount / 100);
                this.setLfoRate(p.lfoRate / 100);
                this.setLfoDepth(p.lfoDepth / 100);
            }

            // Handle evolution
            if (this.isPlaying) {
                if (p.evolution) {
                    this.startEvolution();
                } else {
                    this.stopEvolution();
                }
            }

            // Recreate voices if playing
            if (this.isPlaying) {
                this.recreateVoices();
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

        if (state === 'playing') {
            if (this.evolutionEnabled) {
                text.textContent = 'Evolving';
            } else {
                text.textContent = 'Playing';
            }
        } else {
            text.textContent = 'Ready';
        }
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

        // Tuning selector
        document.getElementById('tuning')?.addEventListener('change', (e) => {
            this.setTuning(e.target.value);
        });

        // Just intonation toggle
        document.getElementById('justIntonation')?.addEventListener('change', (e) => {
            if (this.isPlaying) {
                this.recreateVoices();
            }
        });

        // Evolution toggle
        document.getElementById('evolutionToggle')?.addEventListener('change', (e) => {
            this.setEvolution(e.target.checked);
            this.updateStatus(this.isPlaying ? 'playing' : 'ready');
        });

        // Evolution speed
        document.getElementById('evolutionSpeed')?.addEventListener('change', (e) => {
            this.setEvolutionSpeed(e.target.value);
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
