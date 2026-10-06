# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Token Entropy Estimator - a static web tool that estimates the random bits of tokens, API keys and secrets from their characters, length and format (UUID, JWT, GitHub tokens), with brute-force time by attack scenario, comparison with standards (OWASP, NIST, RFC) and how secret scanners (detect-secrets, gitleaks) see them. Batch analysis compares many tokens position by position (min-entropy), and a generator makes tokens with rejection sampling. The bits are an upper bound for a uniform random generator; obvious structure is reported instead of a judgment. Input never leaves the browser. Japanese and English UI.

Part of the "100 Security Tools with Generative AI" project (Day048).

## Architecture

All scripts are plain (non-module) scripts so that the page works from `file://` (offline use). Each script puts one object on `globalThis`.

- **index.html**: Header (language and theme buttons), intro, then four tabs (`role="tablist"`): "Check one" `#panel-single` = input (samples, "change the assumptions") and result (verdict, values, gauge, findings, time table, scanner table); "Compare many" `#panel-batch` = batch analysis (textarea, samples, per-position chart, findings); "Make" `#panel-make` = make a secure token (required-length table, generator, copy / send to result / send 100 to batch); "Extras" `#panel-more` = how it works, related tools. Help `<dialog>` (7 topics) sits outside the panels. Meta CSP without `'unsafe-inline'`; no inline scripts, handlers or style attributes. Static text carries `data-i18n` / `data-i18n-attr`
- **js/entropy-core.js** (`TokenEntropy`): pure logic, no DOM. `analyze(input, { override, customSize })` returns format, alphabet, counted characters, bits (`bitsKind`: `uniform` or `spec`), warnings and `basis` (`bits` / `pattern` / `notApplicable` / `unknown` / `none`). Alphabet = smallest standard set containing the characters (digits, hex, base32, base64 needs `+` `/` or `=`, base64url needs `-` or `_`, else class sum). Formats: UUID by version (RFC 9562; v4 122 bits, v7 74 bits and time, v1/v6 time, v3/v5/v8 not counted), JWT (alg from the header; not measured), GitHub tokens (CRC-32 → Base62 `0-9A-Za-z` checksum, 30 random characters). Structure warnings only when unlikely by chance (`CHANCE_LIMIT` 1e-3; runs and keyboard runs scale with length and set size). Readable Base64/hex content (12+ bytes). `scanners()` mirrors detect-secrets (Base64 4.5, hex 3.0 with the digit-only penalty) and gitleaks (3.5), all "greater than". `guesses()` / `timeTable()` work in log10 (average (N+1)/(K+1), worst N−K+1). `STANDARDS` and `SCENARIOS` hold the sourced values. `batchAnalyze(text)`: per-position min-entropy (−log2 pmax) against a seeded baseline (`baselineMinEntropy`, xorshift32 seed 20261004, 200 rounds, cached); alphabet from varying positions only; constants and duplicates reported only when unlikely by chance; weak = non-constant positions below half the baseline; increasing ≥ 95% of pairs; 20–1000 tokens, up to 200 characters. `generate(alphabetId, length, randomBytes)` uses rejection sampling; `requiredLength`, `moduloBias`, `makeUuidV7`
- **js/messages.js** (`TokenMessages`): all strings in Japanese and English (same keys, except the language-specific number scales `scale.*`). `t(key, vars)`
- **js/i18n.js** (`TokenI18n`): language from `?lang=` → saved choice (`token-entropy-estimator-lang`) → browser language; `applyStaticText`
- **js/samples.js** (`TokenSamples`): samples. The GitHub-style sample is assembled at runtime so that no token-shaped literal appears in the source
- **js/tabs.js** (`TokenTabs`): WAI-ARIA tabs. Click, Left/Right (wrapping), Home/End; unselected tabs get `tabindex=-1`. `fromUrl(search, hash)` reads `#tab=` first, then `?tab=` (`single` / `batch` / `make` / `more`). `init(nav, onChange)` returns `select(name, focus)` and `current()`
- **js/theme-init.js / theme.js** (`TokenTheme`): theme applied before paint, toggle saved as `token-entropy-estimator-theme`
- **script.js**: UI only. A `state` object holds input and assumptions; `render()` redraws everything from it on any change. Batch samples and the generator use `crypto.getRandomValues` (works from `file://`); generated tokens are never sent anywhere. "See in the result" and "Send 100 to batch analysis" switch to that tab, scroll to its heading and focus its input. Uses `textContent` only; bar widths via CSSOM `.style.width` / `.style.left`
- **style.css**: color tokens on `:root`, dark overrides in both `:root[data-theme="dark"]` and `prefers-color-scheme` (identical). Tables stack below 600px using `data-label`. Tabs: 4 columns, 2×2 at 720px and below, icon above the label at 380px and below; 8px between tabs so the focus ring (3px + 2px offset) does not reach the next tab
- **theory.md / theory.en.md**: theory notes (Japanese / English), including min-entropy for batch analysis and modulo bias. **SECURITY.md**: security design

## Development Commands

- `npm test` — node:test, no dependencies, Node 22+. Runs in GitHub Actions on push and pull requests. Tests load the plain scripts with `vm.runInThisContext` (`test/load.js`)
- Open `index.html` directly, or serve with `python -m http.server 8000`

## Testing

- `test/core.test.js`: alphabets, bits, UUID versions and times (RFC 9562 examples), JWT (RFC 7519 example), GitHub checksum (CRC-32 check value, Base62), readable content, structure warnings and their false-positive rate on seeded random strings (< 0.5%), overrides, validation
- `test/time.test.js`: guesses, OWASP 585-year example, 755-billion-year example (7553億年 in Japanese), scenarios, time units, number scales
- `test/scanners.test.js`: Shannon entropy and scanner thresholds (exactly equal is not flagged)
- `test/batch.test.js`: batch analysis (seeded random tokens not flagged, counters, UUID v7, constants by chance, limits); `test/generate.test.js`: required length, modulo bias, rejection sampling (0–255 once gives each of 62 characters 4 times), UUID v7 version and time
- `test/readme.test.js`: README.md / README.en.md (same headings), YAML structure, tables recomputed from the implementation (character sets, formats, samples, scenarios, standards, scanner shares with a seeded generator, batch examples with seeded tokens, required length, modulo bias), claims, directory tree, images (6 each); theory.md / theory.en.md values
- `test/tabs.test.js`: `fromUrl`, keys (`nextIndex`), selection with a fake DOM (aria-selected, tabindex, hidden panels, focus only on keys)
- `test/html.test.js`, `test/contrast.test.js`, `test/format.test.js`, `test/messages.test.js`, `test/i18n.test.js`: CSP and markup (including the tabs and what each panel holds), contrast 4.5:1 in light and dark (and the tab colors), line length and LF, dictionary keys and HTML text, no Japanese in English, English count sentences that stay correct for 1 ("Positions …: {count}")

Known answers come from Python (zlib, uuid, base64, math), not from the implementation.

## Key Implementation Notes

- Never use `innerHTML` for user-provided data; tests forbid it and inline styles/handlers
- Do not add a `?text=` URL parameter: tokens are secrets and would end up in history, logs and referrers
- Keep the README YAML metadata structure unchanged; README numbers are recomputed by `readme.test.js` — update them from the implementation, not by hand
- Japanese strings do not put half-width spaces between Japanese and alphanumeric characters
