# KMS CLOUD V2

Czysta wersja KMS do nowego repozytorium GitHub i Vercel.

## Pliki

- `index.html` — aplikacja KMS
- `api/analyze-drawing.js` — backend AI Analiza Rysunku
- `api/analyze.js` — alias backendu
- `package.json` — brak Next.js, brak `next build`
- `vercel.json` — routing statycznej aplikacji i API

## Wdrożenie

1. Wgraj zawartość tego folderu do pustego repozytorium GitHub.
2. Podłącz repozytorium do Vercel.
3. W Vercel dodaj zmienną środowiskową:
   `OPENAI_API_KEY`
4. Po deployu test backendu:
   `/api/analyze-drawing`

## Ważne

Nie wgrywaj ZIP-a do GitHub. Wgraj zawartość folderu.
