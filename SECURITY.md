# Security Policy

## Security Considerations

Token Entropy Estimator is a static page for GitHub Pages. It handles secrets that you paste, so it is designed so that they never leave the browser.

### Client-Side Only
- All calculations run in the browser. Nothing is sent to a server, and the token is never put in the URL
- The token is not stored. localStorage keeps only the theme and language choices (the tool still works where storage is unavailable)
- The page also works when `index.html` is opened directly as a file (`file://`), so it can be used offline

### Input Handling
- Only the first 10,000 characters (code points) are analyzed
- Every input and result is written with `textContent`, never interpreted as HTML (no `innerHTML`)
- Numeric fields (bits, valid values, GPUs, custom speed) are validated, and invalid input is reported next to the field instead of being silently replaced

### Content Security Policy (meta)
- `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`
- `connect-src 'none'` (no network connections from scripts), `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`
- No inline scripts, inline event handlers or `style` attributes are used, so `'unsafe-inline'` is not needed
- `frame-ancestors`, `X-Frame-Options` and `X-Content-Type-Options` cannot be set with `<meta>` (browsers ignore them there), and GitHub Pages does not let a repository set response headers. They are therefore not claimed

### Other Measures
- `<meta name="referrer" content="no-referrer">`
- External links open in a new tab with `rel="noopener noreferrer"`
- No external libraries, CDNs or fonts are loaded

## Reporting Security Issues

If you discover a security vulnerability, please report it via:
1. GitHub Issues (for non-sensitive issues)
2. Direct contact with the repository maintainer

## Disclaimer

This tool is for education and design support. The bits it shows are an upper bound under the assumption of a uniform random generator; a single string cannot prove that it was generated randomly. Do not use it as the only check for cryptographic security.
