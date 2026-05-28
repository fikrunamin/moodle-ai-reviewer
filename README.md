# Moodle AI Review Assistant

Portable AI assistant untuk membantu dosen mereview assignment dan discussion Moodle.

## Main Features

- Puppeteer non-headless
- Moodle read-only scraping
- Assignment review
- Discussion review
- PDF extraction
- AI feedback generator
- Bulk generate review
- SQLite local database
- Portable Windows executable
- Localhost server on port 9876

## Run Development

```bash
bun install
cd src/web && bun install && bun run build
cd ../..
bun run dev
```

Frontend development server:

```bash
cd src/web
bun run dev
```

## Build Windows

```bash
bun run build:windows
```

## Build macOS

```bash
bun run build:macos
```

## GitHub Release

Push tag `v0.1.0` atau jalankan workflow `Build and Release` secara manual.
Workflow akan membuat downloadable `.zip` dan `.tar.gz` untuk Windows x64, macOS arm64, dan macOS x64.

## Runtime

Saat aplikasi dijalankan, folder berikut akan dibuat otomatis:

```txt
data/
  app.sqlite
  downloads/
  extracted/
  sessions/
  logs/
```

## Moodle Session

Login Moodle dilakukan dengan paste cookies agar kompatibel dengan SSO/2FA.

1. Login ke Moodle di browser biasa.
2. Copy cookie dari domain Moodle sebagai raw `Cookie` header atau JSON cookies.
3. Paste ke panel `Moodle Session Cookies`.
4. Klik `Save Cookies`.
5. Klik `Test Session`.

Cookie disimpan lokal di:

```txt
data/sessions/moodle-cookies.json
```

## Local URL

```txt
http://localhost:9876
```

## Important Rule

Aplikasi ini read-only terhadap Moodle.

Tidak boleh:

- submit nilai
- submit feedback
- edit Moodle
- hapus data Moodle
