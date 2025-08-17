# Security Policy

## Security Considerations

This Token Entropy Estimator is designed with security in mind for safe deployment on GitHub Pages:

### Client-Side Only
- All calculations are performed entirely in the browser
- No data is sent to any external servers
- No cookies or local storage is used to store tokens
- Input tokens remain private to the user

### Input Validation
- Token input is limited to 10,000 characters to prevent performance issues
- Rate input is capped at 1e15 to prevent numerical overflow
- Threshold values are validated and limited to reasonable ranges (0-500 bits)
- All user inputs are sanitized using `textContent` (not `innerHTML`) to prevent XSS

### Content Security Policy
The application implements a strict CSP that:
- Blocks all external connections (`connect-src 'none'`)
- Prevents framing attacks (`frame-ancestors 'none'`)
- Restricts base URIs (`base-uri 'self'`)
- Limits form actions (`form-action 'self'`)

### Additional Security Headers
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: SAMEORIGIN` - Prevents clickjacking
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information

### Best Practices
- Uses `defer` attribute for script loading
- Implements `rel="noopener noreferrer"` on external links
- Includes `autocomplete="off"` on sensitive input fields
- Implements input rate limiting to prevent UI freezing
- Uses whitelisting approach for sample data insertion

## Reporting Security Issues

If you discover a security vulnerability, please report it via:
1. GitHub Issues (for non-sensitive issues)
2. Direct contact with the repository maintainer

## Disclaimer

This tool is for educational and design validation purposes only. It provides entropy estimates based on uniform distribution assumptions and should not be used as the sole criterion for cryptographic security validation.