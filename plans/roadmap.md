# Drone Generator Feature Roadmap

## Vision
Make this the definitive web-based drone generator - combining real-time synthesis quality, educational depth, and accessibility for meditation, yoga, sound healing, and ambient music creation.

---

## Phase 1: Core Enhancements (Immediate)
*Goal: Differentiate from competitors with better harmonic options and evolution*

### 1.1 Extended Drone Types
- [ ] Add suspended 2nd (sus2) chord
- [ ] Add suspended 4th (sus4) chord
- [ ] Add power chord (root + 5th + octave)
- [ ] Add open fifth (root + 5th below + 5th above)
- [ ] Add Dorian mode drone
- [ ] Add Phrygian mode drone
- [ ] Add Lydian mode drone
- [ ] Add just intonation option

### 1.2 Tuning System Options
- [ ] A4 = 440 Hz (standard - current default)
- [ ] A4 = 432 Hz ("Verdi tuning" - popular with sound healers)
- [ ] Solfeggio frequency presets:
  - 396 Hz - Liberation
  - 417 Hz - Change
  - 528 Hz - Transformation
  - 639 Hz - Connection
  - 741 Hz - Expression
  - 852 Hz - Intuition

### 1.3 Evolution Mode
- [ ] Add "Evolution" toggle
- [ ] Slow random drift of filter cutoff (±10% over 30-60 seconds)
- [ ] Subtle volume undulation (breathing effect)
- [ ] Occasional harmonic emphasis changes
- [ ] Configurable evolution speed (Slow/Medium/Fast)

### 1.4 More Presets
- [ ] Deep Sleep (very low, filtered, slow movement)
- [ ] Sound Bath (528 Hz, rich harmonics)
- [ ] Yoga Flow (brighter, moderate movement)
- [ ] Creative Focus (432 Hz, balanced)
- [ ] Grounding (root-heavy, minimal movement)

---

## Phase 2: Professional Features (Short-term)
*Goal: Serve yoga teachers, sound healers, and musicians*

### 2.1 Recording/Export
- [ ] Record to WAV using MediaRecorder API
- [ ] Record duration selector (1min, 5min, 15min, 30min, 1hr)
- [ ] Download button with file naming
- [ ] Clear commercial use licensing

### 2.2 Nature Sound Layer
- [ ] Optional ambient layer (rain, wind, water, forest)
- [ ] Individual volume control for ambient layer
- [ ] High-quality, seamlessly looping samples
- [ ] Mix with drone at user-controlled ratio

### 2.3 Session Planning
- [ ] Extended timer options (up to 4 hours)
- [ ] Gradual fade out before timer end
- [ ] Session presets (Yoga class, Sound bath, Sleep session)
- [ ] Optional reminder chime before ending

### 2.4 Binaural Beat Option
- [ ] Optional binaural beat layer
- [ ] Selectable target frequency (Delta/Theta/Alpha/Beta)
- [ ] Headphone recommendation notice
- [ ] Scientific disclaimer about evidence

---

## Phase 3: Educational Depth (Medium-term)
*Goal: Become the educational authority on drone music and sound*

### 3.1 Interactive Harmonic Series Display
- [ ] Visual representation of active frequencies
- [ ] Show fundamental and overtones
- [ ] Real-time frequency spectrum analyzer
- [ ] Educational labels and explanations

### 3.2 Expanded Educational Content
- [ ] History of drone music section (Indian classical, minimalism, ambient)
- [ ] Drone in world music traditions
- [ ] Science of sound and consciousness
- [ ] Honest assessment of frequency healing claims
- [ ] Meditation technique guides

### 3.3 Guided Sessions
- [ ] Breath synchronization visual guide
- [ ] Suggested breathing patterns with drone
- [ ] Body scan meditation guide
- [ ] Focus session guide

---

## Phase 4: Community & Sharing (Long-term)
*Goal: Build community and user-generated content*

### 4.1 Preset Sharing
- [ ] Save custom presets locally
- [ ] Export preset as shareable link/code
- [ ] Import presets from others
- [ ] Community preset gallery (curated)

### 4.2 PWA Enhancement
- [ ] Offline capability
- [ ] Install as app
- [ ] Background audio on mobile
- [ ] Home screen installation

---

## Technical Priorities

### Performance
- [ ] Optimize for long sessions (8+ hours)
- [ ] Minimize CPU usage
- [ ] Memory leak prevention
- [ ] Audio glitch prevention

### Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] High contrast mode option
- [ ] Reduced motion option

### Mobile
- [ ] Touch-optimized controls
- [ ] Portrait and landscape support
- [ ] Background audio on iOS Safari
- [ ] Progressive enhancement

---

## Success Metrics

### Phase 1 Success:
- User session length > 15 minutes average
- Return visitor rate > 30%
- Feature usage across new drone types

### Phase 2 Success:
- Export feature usage > 10% of sessions
- Nature layer activation > 20%
- Timer usage > 40%

### Phase 3 Success:
- Educational content engagement
- Time on page increase
- Search traffic for educational terms

---

## Implementation Notes

### Phase 1 Technical Details:

**Extended Drone Types (1.1):**
```javascript
// Frequency ratios for new chord types
const chordRatios = {
    'sus2': [1, 9/8, 3/2],      // Root, Major 2nd, Perfect 5th
    'sus4': [1, 4/3, 3/2],      // Root, Perfect 4th, Perfect 5th
    'power': [1, 3/2, 2],       // Root, 5th, Octave
    'open5': [1, 3/4, 3/2],     // Root, 5th below (inverted), 5th above
};

// Modal drones (simplified - root + characteristic note + fifth)
const modes = {
    'dorian': [1, 6/5, 3/2],    // Minor feel, raised 6th characteristic
    'phrygian': [1, 16/15, 3/2], // Minor 2nd characteristic
    'lydian': [1, 45/32, 3/2],  // Raised 4th characteristic
};
```

**Tuning Systems (1.2):**
```javascript
// Tuning reference frequencies
const tunings = {
    'standard': 440,
    'verdi': 432,
    // Solfeggio presets map to specific root notes
};
```

**Evolution Mode (1.3):**
```javascript
// Slow parameter drift using requestAnimationFrame
// Target parameters: filter cutoff, LFO depth, oscillator balance
// Drift range: ±10-20% from center
// Drift speed: 0.001 to 0.01 change per frame
```
