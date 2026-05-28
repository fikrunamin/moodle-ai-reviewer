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
bun run dev
```

## Build Windows

```bash
bun run build:windows
```

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
