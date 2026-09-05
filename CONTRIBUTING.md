# Contributing

Contributions that improve extraction reliability, schema coverage, replica
detection, accessibility, or provider-change resilience are welcome.

## Development

```bash
npm install
npx playwright install chromium
npm run check
npm test
npm run build
```

Add a sanitized fixture and regression test for parser changes. Never commit
downloaded host data, generated websites, credentials, deployment
infrastructure, private URLs, or content that you are not authorized to reuse.

## Pull requests

- Keep changes focused and explain the behavior being changed.
- Preserve the public-page-only and authorization safeguards.
- Add tests for new parsing and replica-detection behavior.
- Run the validation commands above before opening a pull request.
