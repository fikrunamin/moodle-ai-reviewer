# Product Requirements Document

## Product

Moodle AI Review Assistant adalah aplikasi lokal untuk membantu dosen mengumpulkan data assignment dan forum discussion dari Moodle, mengekstrak submission, lalu membuat draft review akademik berbasis rubrik.

## Goals

- Mempercepat review assignment dan discussion.
- Menyimpan semua data secara lokal.
- Menjaga Moodle tetap read-only.
- Memberikan rekomendasi, bukan keputusan final.

## Non Goals

- Tidak mengirim nilai ke Moodle.
- Tidak mengirim feedback ke Moodle.
- Tidak menggantikan keputusan dosen.

## Primary User

Dosen atau pengajar yang perlu mereview submission mahasiswa dalam jumlah banyak.

## Core Flow

1. Dosen membuka aplikasi lokal.
2. Dosen login Moodle lewat browser Puppeteer non-headless.
3. Dosen menambahkan URL activity.
4. Aplikasi melakukan scraping read-only.
5. Submission dan file disimpan lokal.
6. PDF diekstrak jika tersedia.
7. AI membuat rekomendasi skor dan feedback.
8. Dosen meninjau dan menyalin feedback bila sesuai.

## Safety Requirements

- Semua operasi Moodle harus read-only.
- Bulk job harus bisa retry dan tidak menduplikasi proses.
- Error harus disimpan di log dan tampil di UI.
