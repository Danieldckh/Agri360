# ElevenLabs Voiceover Guide

A practical reference for ProAgri team members creating voiceovers using ElevenLabs. This guide covers the Voiceover Studio workflow, voice settings, pronunciation control, and best practices for producing natural-sounding audio.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Voiceover Studio Workflow](#2-voiceover-studio-workflow)
3. [Choosing a Model](#3-choosing-a-model)
4. [Voice Settings](#4-voice-settings)
5. [Delivery Control](#5-delivery-control)
6. [Pronunciation Guide (CMU / SSML)](#6-pronunciation-guide-cmu--ssml)
7. [Pronunciation Dictionaries](#7-pronunciation-dictionaries)
8. [Text Normalization](#8-text-normalization)
9. [Eleven v3 Audio Tags](#9-eleven-v3-audio-tags)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Quick Start

1. Open **Voiceover Studio** from the ElevenLabs dashboard.
2. Upload a CSV script (columns: `speaker`, `line`) or type directly in the editor.
3. Assign a voice to each speaker/track.
4. Click **Generate** to synthesize each clip.
5. Arrange clips on the timeline, add SFX if needed.
6. Click **Export** and choose your format (MP3, WAV, etc.).

---

## 2. Voiceover Studio Workflow

### Script Import

Upload a CSV with the following column options:

| Format | Columns |
|--------|---------|
| Basic | `speaker`, `line` |
| Timed | `speaker`, `line`, `start_time`, `end_time` |

### Tracks & Clips

- Each row in the timeline represents a **track** (one speaker or SFX channel).
- Click anywhere on a track to create a new **clip**.
- **Dynamic Duration** (default): clip length adapts to the text and voice, producing natural pacing.
- To override, disable Dynamic Duration and manually set clip start/end times.

### Sound Effects

1. Add a **SFX track** to the timeline.
2. Click on the track to create a SFX clip.
3. Write a prompt describing the sound (e.g., "gentle rain on a window").
4. Click **Generate**.

### Export

Click **Export** in the bottom-right corner. Choose from:

- **MP3** — 22.05-44.1 kHz, 32-192 kbps
- **WAV** — lossless, larger files
- **PCM** — 16-44.1 kHz, 16-bit
- **Opus** — 48 kHz, 32-192 kbps

Higher quality options may require a paid tier.

---

## 3. Choosing a Model

| Model | Languages | Char Limit | Best For |
|-------|-----------|------------|----------|
| **Eleven v3** | 70+ | 5,000 | Most expressive; dramatic delivery, dialogue |
| **Eleven Multilingual v2** | 29 | 10,000 | Highest quality; long-form, stable narration |
| **Eleven Flash v2.5** | 32 | 40,000 | Real-time (~75ms latency); cost-effective |
| **Eleven Flash v2** | — | — | Supports SSML phoneme tags |
| **Eleven English v1** | 1 (English) | — | Legacy; supports SSML phoneme tags |

**Rule of thumb:**
- Long narrations → **Multilingual v2** (most stable)
- Expressive dialogue → **v3** (best emotion)
- Bulk/real-time → **Flash v2.5** (fastest, cheapest)
- Need phoneme control → **Flash v2** (only model that supports `<phoneme>` tags)

---

## 4. Voice Settings

These settings are available per generation and fine-tune how the voice sounds.

| Setting | Range | Default | What It Does |
|---------|-------|---------|--------------|
| **Stability** | 0-1 | ~0.5 | Higher = more consistent between generations; lower = more expressive but variable |
| **Similarity Boost** | 0-1 | ~0.75 | Higher = closer to original voice; lower = more creative interpretation |
| **Style** | 0-1 | 0 | Amplifies the speaker's original style; higher values are more dramatic |
| **Speed** | 0.7-1.2 | 1.0 | Playback rate; extreme values may reduce quality |
| **Speaker Boost** | bool | true | Enhances voice clarity; disable for faster processing |

### Recommended Starting Points

| Use Case | Stability | Similarity | Style | Speed |
|----------|-----------|------------|-------|-------|
| Standard narration | 0.50 | 0.75 | 0.00 | 1.0 |
| Expressive dialogue | 0.30 | 0.75 | 0.40 | 1.0 |
| Consistent branding | 0.70 | 0.85 | 0.00 | 1.0 |
| Fast promo read | 0.50 | 0.75 | 0.20 | 1.1 |

### v3 Stability Presets

| Preset | Behavior |
|--------|----------|
| **Creative** | Most expressive, but prone to occasional hallucinations |
| **Natural** | Balanced — closest to the original voice |
| **Robust** | Highly stable but less responsive to directional prompts |

---

## 5. Delivery Control

### Pauses

**Models with SSML support** (Flash v2, English v1):
```xml
<break time="1.5s" />
```
- Maximum 3 seconds per break.
- Too many break tags in one generation can cause instability.

**v3 and other models** (no SSML breaks):
- Use **ellipses** `...` for a weighted pause
- Use **dashes** `—` or `--` for a shorter pause
- Use **line breaks** to separate thoughts

### Emotion

Emotion is driven by **text context**, not settings sliders.

- Add narrative cues: *"she whispered nervously"*, *"he announced proudly"*
- Explicit dialogue tags yield more predictable results than relying on context alone.
- Match the voice to the emotion: a shouting voice won't whisper well, and vice versa.
- For post-production: generate with cues, then remove them from the final script if needed.

### Pacing

- Adjust the **Speed** setting (0.7-1.2) for global pace.
- Use punctuation to control rhythm: commas for brief pauses, periods for full stops.
- CAPITALIZATION adds emphasis on specific words.
- Longer training samples produce more natural pacing in cloned voices.

---

## 6. Pronunciation Guide (CMU / SSML)

> **Important:** Phoneme tags only work with **Eleven Flash v2** and **Eleven English v1** models. Other models will silently ignore them. Phoneme tags only work for **English**; for other languages, use alias tags.

### What Is CMU?

CMU (Carnegie Mellon Pronouncing Dictionary) represents words as sequences of **ARPABET phonemes** — a standardized sound notation system.

Example: `"hello"` → `HH AH0 L OW1`

### SSML Phoneme Tag Structure

```xml
<phoneme alphabet="cmu-arpabet" ph="HH AH0 L OW1">hello</phoneme>
```

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `alphabet` | `"cmu-arpabet"` or `"ipa"` | Which phoneme system to use |
| `ph` | phoneme string | The pronunciation |
| Inner text | the word | Fallback / display text |

### CMU Phoneme Reference

#### Consonants

| Sound | CMU | Example |
|-------|-----|---------|
| b | B | **b**at |
| d | D | **d**og |
| f | F | **f**an |
| g | G | **g**oat |
| h | HH | **h**at |
| j (as in jar) | JH | **j**oy |
| k | K | **k**ite |
| l | L | **l**eg |
| m | M | **m**an |
| n | N | **n**et |
| ng | NG | si**ng** |
| p | P | **p**en |
| r | R | **r**ed |
| s | S | **s**un |
| sh | SH | **sh**ip |
| t | T | **t**op |
| th (thin) | TH | **th**ink |
| th (this) | DH | **th**is |
| v | V | **v**an |
| w | W | **w**et |
| y | Y | **y**es |
| z | Z | **z**oo |
| zh | ZH | mea**s**ure |
| ch | CH | **ch**in |

#### Vowels (with Stress Markers)

| Sound | CMU | Example |
|-------|-----|---------|
| ah (sofa) | AH0 / AH1 | **a**bout |
| ae (cat) | AE1 | c**a**t |
| ee (see) | IY1 | s**ee** |
| eh (bed) | EH1 | b**e**d |
| ih (sit) | IH1 | s**i**t |
| oh (go) | OW1 | g**o** |
| oo (blue) | UW1 | bl**ue** |
| uh (put) | UH1 | p**u**t |
| aw (saw) | AO1 | s**aw** |
| er (bird) | ER1 | b**ir**d |
| ay (my) | AY1 | m**y** |
| oy (boy) | OY1 | b**oy** |
| ow (cow) | AW1 | c**ow** |

### Stress Markers

| Marker | Meaning | Example |
|--------|---------|---------|
| 0 | No stress (unstressed) | `AH0` in "about" |
| 1 | Primary stress | `AE1` in "cat" |
| 2 | Secondary stress | `AE2` in "trapezoid" |

### Step-by-Step: Crafting a Phoneme Tag

1. **Break the word into syllables**: "ProAgri" → Pro-Ag-ri
2. **Map each sound to CMU phonemes**: → `P R OW1 AE1 G R IY0`
3. **Wrap in SSML**:
   ```xml
   <phoneme alphabet="cmu-arpabet" ph="P R OW1 AE1 G R IY0">ProAgri</phoneme>
   ```

### Practical Examples

**Name correction:**
```xml
<phoneme alphabet="cmu-arpabet" ph="D AE1 N Y AH0 L">Daniel</phoneme>
```

**Brand name:**
```xml
<phoneme alphabet="cmu-arpabet" ph="N AY1 K IY0">Nike</phoneme>
```

**Technical term:**
```xml
<phoneme alphabet="cmu-arpabet" ph="T R AE2 P AH0 Z IY1 AY0">trapezii</phoneme>
```

**Afrikaans name:**
```xml
<phoneme alphabet="cmu-arpabet" ph="Z AH0 N D ER1">Xander</phoneme>
```

**Agriculture terms:**
```xml
<phoneme alphabet="cmu-arpabet" ph="AE1 G R IY0">Agri</phoneme>
```

### Tips for Accuracy

- **Start simple** — approximate from the closest known word.
- **Adjust stress first**, then vowels — stress errors are more noticeable.
- **Test iteratively** — TTS engines may interpret slightly differently between voices.
- **One phoneme tag per word** — each word needs its own `<phoneme>` wrapper.
- **CMU over IPA** — CMU Arpabet generally produces more consistent results than IPA with current ElevenLabs models.

### Common Mistakes

| Issue | Fix |
|-------|-----|
| Missing stress marker | Add `1` to the primary syllable vowel |
| Overcomplicated phonemes | Simplify to the closest natural sound |
| Wrong vowel | Swap between AH / AE / EH — common confusions |
| Tag ignored | Check you're using Flash v2 or English v1 model |
| Non-English word | Use alias tags instead of phoneme tags |

---

## 7. Pronunciation Dictionaries

For words that are frequently mispronounced, create a **pronunciation dictionary** instead of adding inline tags every time.

### PLS File Format (XML)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<lexicon version="1.0" xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
         alphabet="cmu-arpabet" xml:lang="en-US">
  <lexeme>
    <grapheme>ProAgri</grapheme>
    <phoneme>P R OW1 AE1 G R IY0</phoneme>
  </lexeme>
  <lexeme>
    <grapheme>Claughton</grapheme>
    <alias>Cloffton</alias>
  </lexeme>
</lexicon>
```

### Key Rules

- **First match wins** — the system checks from start to end and uses only the first matching replacement.
- **Case-sensitive** — create separate entries for "ProAgri" and "proagri" if needed.
- **Up to 3 dictionaries** per API call via `pronunciation_dictionary_locators`.
- **Alias tags work across all models** — use them when phoneme tags aren't supported.
- Upload via ElevenLabs Studio or the API (`POST /v1/pronunciation-dictionaries`).

---

## 8. Text Normalization

TTS models work best with **written-out, alphabetical text**. Digits, symbols, and abbreviations often cause mispronunciations.

### What to Normalize

| Raw Text | Normalized |
|----------|------------|
| `$42.50` | forty-two dollars and fifty cents |
| `123-456-7890` | one two three, four five six, seven eight nine zero |
| `9:23 AM` | nine twenty-three A M |
| `Dr. Smith` | Doctor Smith |
| `5kg` | five kilograms |
| `2026-04-14` | April fourteenth, twenty twenty-six |
| `Ctrl + Z` | Control Z |
| `25%` | twenty-five percent |

### Approaches

**Manual** — rewrite before pasting into Studio.

**LLM pre-processing** — add this instruction to your text preparation prompt:
```
Convert all numbers, currencies, dates, abbreviations, and symbols 
into their fully spoken forms suitable for text-to-speech narration.
"$42.50" → "forty-two dollars and fifty cents"
"Dr." → "Doctor"
```

**Programmatic** — use libraries like Python's `inflect` or JavaScript's `number-to-words`.

---

## 9. Eleven v3 Audio Tags

v3 introduces **audio tags** — inline text markers that control emotion and sound effects without SSML.

### Emotion Tags

```
[whispers] I never knew it could be this way.
[sarcastic] Oh, what a surprise.
[excited] We just hit our target!
[laughing] That was the funniest thing I've ever heard.
[sad] I'm sorry to hear that.
[angry] This is completely unacceptable.
```

### Sound Effect Tags

```
[applause]
[gunshot]
[doorbell]
[thunder]
```

### Important Notes

- Tag effectiveness **depends on the voice** — some voices respond better than others.
- Match the tag to the voice's natural range: a calm voice won't shout convincingly.
- Neutral voices provide the widest range of tag responsiveness.
- These tags are **v3 only** — they don't work on other models.

---

## 10. Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| Inconsistent voice between clips | Stability too low | Increase Stability to 0.6-0.7 |
| Voice sounds robotic | Similarity too high | Lower Similarity Boost to 0.65 |
| Words mispronounced | No phoneme control | Add CMU phoneme tags (Flash v2 only) or use alias dictionary |
| Numbers read incorrectly | Not normalized | Write out numbers as words |
| Phoneme tags ignored | Wrong model | Switch to Eleven Flash v2 |
| Pauses not working | Using `<break>` on v3 | Use ellipses `...` or dashes `--` instead |
| Emotion sounds flat | Voice doesn't match | Choose a voice with wider emotional range; use audio tags on v3 |
| Hallucinated words | Too many break tags or very long text | Shorten generation; reduce break tags; increase Stability |
| Speed sounds unnatural | Extreme speed value | Keep Speed between 0.8-1.15 |

---

## API Quick Reference

For programmatic generation:

```
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}

Headers:
  xi-api-key: YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "text": "Your script text here",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75,
    "style": 0.0,
    "speed": 1.0,
    "use_speaker_boost": true
  }
}
```

Response: binary audio file (`application/octet-stream`).

Optional query parameters:
- `output_format` — default `mp3_44100_128`
- `optimize_streaming_latency` — 0-4 (higher = faster, lower quality)

---

## Further Reading

- [ElevenLabs TTS Overview](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
- [TTS Best Practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- [Create Speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
- [Pronunciation Dictionaries](https://elevenlabs.io/docs/eleven-api/guides/cookbooks/text-to-speech/pronunciation-dictionaries)
- [Voiceover Studio](https://elevenlabs.io/docs/creative-platform/audio-tools/voiceover-studio)
- [Voice Settings API](https://elevenlabs.io/docs/api-reference/voices/settings/get)
