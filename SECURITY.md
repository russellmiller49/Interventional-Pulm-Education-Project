# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main    | ✅         |

Security fixes are applied to the `main` branch. Downstream deploys should track `main` or apply patches promptly.

## Reporting a Vulnerability

Please report security issues confidentially to security@interventionalpulm.org with the following information:

1. Detailed description of the vulnerability.
2. Steps to reproduce and potential impact.
3. Suggested remediation or mitigation, if known.

We will acknowledge receipt within 3 business days and provide a timeline for remediation. Public disclosure should only occur after a fix or workaround is available.

## Data Handling

- No protected health information (PHI) is collected, processed, or stored.
- Analytics are anonymous and aggregated.
- API endpoints validate input with `zod` and are rate limited to reduce abuse.

## Security Best Practices

- Configure environment variables via `.env.local`; never commit secrets.
- Enforce HTTPS with HSTS and restrictive CSP (configured in `next.config.mjs`).
- Keep dependencies patched by running `pnpm audit` regularly.
