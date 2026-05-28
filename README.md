# Moodle AI Review Assistant

Portable AI assistant untuk membantu dosen mereview assignment dan discussion Moodle.

## Main Features

- Puppeteer headless by default
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
  rubrics/
  sessions/
  logs/
```

## Puppeteer Mode

Puppeteer berjalan headless agar Chrome tidak muncul setiap action.
Untuk debug manual, jalankan:

```bash
PUPPETEER_HEADLESS=false bun run dev
```

## Moodle Session

Login Moodle dilakukan dengan paste cookies agar kompatibel dengan SSO/2FA.

1. Login ke Moodle di browser biasa.
2. Export cookie dari Cookie-Editor Chrome extension dalam format JSON, atau copy raw `Cookie` header.
3. Buka `Settings`, pilih tab `Moodle Cookies`.
4. Paste cookie ke form `Cookies JSON / Header`.
5. Klik `Save Cookies`.
6. Klik `Test Session`.

Cookie disimpan lokal di:

```txt
data/sessions/moodle-cookies.json
```

Format JSON Cookie-Editor didukung, termasuk field `expirationDate`, `httpOnly`, `secure`, `sameSite`, `domain`, dan `path`.

## Local URL

```txt
http://localhost:9876
```

## Telegram Error Alert

Isi `.env` jika ingin error aplikasi dikirim ke Telegram:

```env
TELEGRAM_BOT_TOKEN=123456:bot-token
TELEGRAM_ACCOUNT_ID=123456789
```

## Important Rule

Aplikasi ini read-only terhadap Moodle.

Tidak boleh:

- submit nilai
- submit feedback
- edit Moodle
- hapus data Moodle
