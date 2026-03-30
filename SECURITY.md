# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in ReactDrop, please report it responsibly.

**Email:** tom@verdient.co.uk

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within 48 hours and provide a fix within 7 days for critical issues.

## Security Architecture

ReactDrop renders user-supplied React components in a sandboxed environment:

- **Sandpack iframe isolation**: Components run in CodeSandbox iframes on a separate origin with no access to the parent window
- **Import allowlist**: Only explicitly approved packages can be imported (Radix UI, lodash, date-fns, etc.)
- **Proxy domain allowlist**: The `/proxy` endpoint only forwards requests to approved CDN domains (tailwindcss, jsdelivr, unpkg, cdnjs, Google Fonts)
- **SSRF prevention**: Private/internal IP ranges are blocked on the proxy
- **Security headers**: All responses include X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers
- **Input validation**: Gist IDs and share IDs are validated against strict format patterns

## Dependency Management

- Dependabot is configured to check for dependency updates weekly
- `pnpm audit` is run as part of the CI pipeline
- Critical vulnerabilities are prioritised for immediate patching
