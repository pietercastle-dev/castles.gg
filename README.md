# castles.gg

Personal site of Pieter Castle — security · infrastructure · automation.

Pure type over a quiet field: a grid of dim cells, each holding one bit.
Ambient disturbances cascade through it — every cell a wavefront touches
flips with probability ½ (the cryptographic avalanche effect, played
slowly enough to read as weather). Clicking strikes a Lichtenberg
discharge that permanently rewrites the bits it crosses.

## Stack

- [Astro](https://astro.build) static build — one page, ~40 KB total
- Vanilla JS canvas, no frameworks, no third-party requests of any kind
- Strict CSP (`default-src 'none'`), HSTS, and friends via `_headers`
- [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) `security.txt`
- Deployed on Cloudflare Pages

## Develop

```sh
npm install
npm run dev
```

## Type

Display face is [Michroma](https://fonts.google.com/specimen/Michroma)
(Vernon Adams), licensed under the SIL Open Font License, self-hosted.
Everything else is your system's own type.
