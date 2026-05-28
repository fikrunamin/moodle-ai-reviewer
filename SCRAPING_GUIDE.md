# Moodle Scraping Guide

## Principle

Puppeteer hanya boleh membaca dan mengambil data.

Tidak boleh:
- klik submit nilai
- klik save grade
- posting feedback
- menghapus data

## Supported Activity

- Assignment
- Forum Discussion

## Assignment Scraping

Ambil:
- title
- instruction
- student list
- submission status
- online text
- file attachment URL
- submitted time

## Discussion Scraping

Ambil:
- thread title
- prompt
- post content
- author name
- created time
- reply relation
- interaction count

## File Download

PDF disimpan ke:

```txt
data/downloads/
```

Gunakan nama aman:

```txt
{activityId}_{studentId}_{filename}
```

## Selector Strategy

Jangan hardcode selector terlalu spesifik.

Prioritas:

1. href pattern
2. text label
3. Moodle class
4. fallback DOM traversal

## Error Handling

Jika gagal scrape:

- simpan log
- set sync_status = failed
- jangan crash app
- tampilkan pesan di UI

## Session

Session Puppeteer disimpan di:

```txt
data/sessions/
```
