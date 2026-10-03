# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Token Entropy Estimator - a static web tool that estimates the random bits of tokens, API keys and secrets from their characters, length and format (UUID, JWT, GitHub tokens), with brute-force time by attack scenario, comparison with standards (OWASP, NIST, RFC) and how secret scanners (detect-secrets, gitleaks) see them. The bits are an upper bound for a uniform random generator; obvious structure is reported instead of a judgment. Input never leaves the browser. Japanese and English UI.

Part of the "100 Security Tools with Generative AI" project (Day048).

## Architecture

All scripts are plain (non-module) scripts so that the page works from `file://` (offline use). Each script puts one object on `globalThis`.

- **index.html**: Header (language and theme buttons), intro, input (samples, "change the assumptions"), result (verdict, values, gauge, findings, time table, scanner table), how it works, help `<dialog>`. Meta CSP without `'unsafe-inline'`; no inline scripts, handlers or style attributes. Static text carries `data-i18n` / `data-i18n-attr`
- **js/entropy-core.js** (`TokenEntropy`): pure logic, no DOM. `analyze(input, { override, customSize })` returns format, alphabet, counted characters, bits (`bitsKind`: `uniform` or `spec`), warnings and `basis` (`bits` / `pattern` / `notApplicable` / `unknown` / `none`). Alphabet = smallest standard set containing the characters (digits, hex, base32, base64 needs `+` `/` or `=`, base64url needs `-` or `_`, else class sum). Formats: UUID by version (RFC 9562; v4 122 bits, v7 74 bits and time, v1/v6 time, v3/v5/v8 not counted), JWT (alg from the header; not measured), GitHub tokens (CRC-32 → Base62 `0-9A-Za-z` checksum, 30 random characters). Structure warnings only when unlikely by chance (`CHANCE_LIMIT` 1e-3; runs and keyboard runs scale with length and set size). Readable Base64/hex content (12+ bytes). `scanners()` mirrors detect-secrets (Base64 4.5, hex 3.0 with the digit-only penalty) and gitleaks (3.5), all "greater than". `guesses()` / `timeTable()` work in log10 (average (N+1)/(K+1), worst N−K+1). `STANDARDS` and `SCENARIOS` hold the sourced values
- **js/messages.js** (`TokenMessages`): all strings in Japanese and English (same keys, except the language-specific number scales `scale.*`). `t(key, vars)`
- **js/i18n.js** (`TokenI18n`): language from `?lang=` → saved choice (`token-entropy-estimator-lang`) → browser language; `applyStaticText`
- **js/samples.js** (`TokenSamples`): samples. The GitHub-style sample is assembled at runtime so that no token-shaped literal appears in the source
- **js/theme-init.js / theme.js** (`TokenTheme`): theme applied before paint, toggle saved as `token-entropy-estimator-theme`
- **script.js**: UI only. A `state` object holds input and assumptions; `render()` redraws everything from it on any change. Uses `textContent` only; bar widths via CSSOM `.style.width` / `.style.left`
- **style.css**: color tokens on `:root`, dark overrides in both `:root[data-theme="dark"]` and `prefers-color-scheme` (identical). Tables stack below 600px using `data-label`
- **theory.md**: theory notes (Japanese). **SECURITY.md**: security design

## Development Commands

- `npm test` — node:test, no dependencies, Node 22+. Runs in GitHub Actions on push and pull requests. Tests load the plain scripts with `vm.runInThisContext` (`test/load.js`)
- Open `index.html` directly, or serve with `python -m http.server 8000`

## Testing

- `test/core.test.js`: alphabets, bits, UUID versions and times (RFC 9562 examples), JWT (RFC 7519 example), GitHub checksum (CRC-32 check value, Base62), readable content, structure warnings and their false-positive rate on seeded random strings (< 0.5%), overrides, validation
- `test/time.test.js`: guesses, OWASP 585-year example, 755-billion-year example (7553億年 in Japanese), scenarios, time units, number scales
- `test/scanners.test.js`: Shannon entropy and scanner thresholds (exactly equal is not flagged)
- `test/readme.test.js`: README.md / README.en.md (same headings), YAML structure, tables recomputed from the implementation (character sets, formats, samples, scenarios, standards, scanner shares with a seeded generator), claims, directory tree, images (4 each)
- `test/html.test.js`, `test/contrast.test.js`, `test/format.test.js`, `test/messages.test.js`, `test/i18n.test.js`: CSP and markup, contrast 4.5:1 in light and dark, line length and LF, dictionary keys and HTML text, no Japanese in English

Known answers come from Python (zlib, uuid, base64, math), not from the implementation.

## Key Implementation Notes

- Never use `innerHTML` for user-provided data; tests forbid it and inline styles/handlers
- Do not add a `?text=` URL parameter: tokens are secrets and would end up in history, logs and referrers
- Keep the README YAML metadata structure unchanged; README numbers are recomputed by `readme.test.js` — update them from the implementation, not by hand
- Japanese strings do not put half-width spaces between Japanese and alphanumeric characters
