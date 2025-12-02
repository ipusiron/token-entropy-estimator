# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Token Entropy Estimator - A web-based security tool for evaluating token/secret key strength through entropy measurement, search space calculation, and brute-force time estimation.

## Architecture

### Core Components

- **index.html**: Main entry point, contains the UI structure with input forms, result display, and sample buttons
- **script.js**: Core logic implementing:
  - Token format detection (UUID v4, Hex, Base64-ish, Generic)
  - Alphabet size calculation based on character classes
  - Entropy estimation (H ≈ n * log2(|Σ|))
  - Brute-force time calculation
  - Shannon entropy reference calculation
- **style.css**: Styling for the application UI
- **theory.md**: Theoretical background documentation
- **assets/**: Directory for screenshots and images

### Key Algorithms

1. **Format Detection** (`detectFormat` at script.js:93-107):
   - UUID v4: Validates format with regex, checks version=4 and variant fields
   - Hex: Detects hexadecimal-only strings
   - Base64-ish: Identifies Base64-like patterns with optional padding

2. **Alphabet Detection** (`detectAlphabetSet` at script.js:109-151):
   - Returns format, label, alphabet size, and hyphen flag
   - UUID v4: Fixed 16 (hex) with ~122 bits entropy
   - Detects character classes: lowercase, uppercase, digits, symbols, space

3. **Entropy Calculation** (`analyze` at script.js:183-302):
   - Generic tokens: H = n × log2(|Σ|) where n=length, |Σ|=alphabet size
   - UUID v4: Fixed ~122 bits (accounting for version/variant fixed bits)
   - Search space: |Σ|^n calculated with BigInt (`powBig` at script.js:168-180)

4. **Strength Classification** (script.js:274-288):
   - Weak: < 64 bits
   - Normal: 64-99 bits
   - Strong: ≥ 100 bits

## Common Development Tasks

### Running the Application
```bash
# Open directly in browser (no build needed)
start index.html

# Or serve with any static web server
python -m http.server 8000
# Then open http://localhost:8000
```

### Testing
No automated tests are configured. Manual testing approach:
- Test format detection with sample tokens (UUID, Hex, Base64, alphanumeric)
- Verify entropy calculations against known values
- Check edge cases (empty input, special characters, very long tokens)

### Deployment
This is a static site suitable for GitHub Pages:
- All files (HTML, CSS, JS) are client-side only
- No build process required
- No external dependencies

## Code Conventions

- Pure vanilla JavaScript (no frameworks or libraries)
- DOM access via `$` helper (script.js:2): `const $ = (id) => document.getElementById(id)`
- BigInt used for large number calculations to avoid overflow (`powBig`)
- Japanese text used in UI labels (bilingual project)
- `textContent` used instead of `innerHTML` for XSS prevention
- Input length limits enforced (token: 10000 chars, thresholds: 50 chars)
- Whitelist approach for sample token types (`fillSample`)

## Security Considerations

- All calculations performed client-side (no server communication)
- Input tokens never leave the browser
- Educational tool - provides estimates based on uniform distribution assumptions
- Not suitable for cryptographic validation of actual random number generators