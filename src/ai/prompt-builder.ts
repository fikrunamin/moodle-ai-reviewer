export function buildAssignmentPrompt(input: {
  courseContext?: string | null;
  instruction: string;
  rubricGuide?: string | null;
  submissionText: string;
  extractedText?: string | null;
}) {
  const rubricGuide =
    input.rubricGuide ||
    "Rubrik default: Kesesuaian Instruksi 20, Kreativitas Ide 20, Teknik dan Bahan 20, Kualitas Hasil Akhir 20, Dokumentasi Proses 10, Refleksi Mahasiswa 10.";

  return [
    "Anda adalah asisten dosen yang membantu membuat draft review akademik berdasarkan konteks mata kuliah dan tugas dari Moodle.",
    "AI hanya memberi rekomendasi, bukan nilai final.",
    "Buat draft review akademik dalam JSON valid tanpa markdown.",
    'Schema: {"summary":"string","recommended_score":0,"scores":{"instruction_match":0,"creativity":0,"technique_material":0,"final_quality":0,"documentation":0,"reflection":0},"feedback":"string","manual_review_required":false,"manual_review_reason":null}',
    `Rubrik dan format penilaian: ${rubricGuide}`,
    "Jika bukti tidak cukup atau PDF tidak terbaca, set manual_review_required=true dan jangan memberi skor tinggi.",
    `Konteks mata kuliah: ${input.courseContext ?? ""}`,
    `Instruksi: ${input.instruction}`,
    `Submission: ${input.submissionText}`,
    `Teks PDF: ${input.extractedText ?? ""}`,
  ].join("\n\n");
}

export function buildDiscussionPrompt(input: {
  courseContext?: string | null;
  rubricGuide?: string | null;
  prompt: string;
  posts: string;
  interactionCount: number;
}) {
  const rubricGuide =
    input.rubricGuide ||
    "Rubrik default: Kualitas Argumen 25, Relevansi 25, Kedalaman Analisis 20, Jumlah Interaksi 20, Etika Komunikasi 10.";

  return [
    "Anda adalah asisten dosen untuk menilai kualitas diskusi mahasiswa.",
    "AI hanya memberi rekomendasi, bukan nilai final.",
    "Buat draft review akademik dalam JSON valid tanpa markdown.",
    'Schema: {"summary":"string","recommended_score":0,"scores":{"argument_quality":0,"relevance":0,"analysis_depth":0,"interaction_quantity":0,"communication_ethics":0},"interaction_count":0,"feedback":"string","manual_review_required":false,"manual_review_reason":null}',
    `Rubrik dan format penilaian: ${rubricGuide}`,
    `Konteks mata kuliah: ${input.courseContext ?? ""}`,
    `Prompt: ${input.prompt}`,
    `Komentar: ${input.posts}`,
    `Jumlah interaksi: ${input.interactionCount}`,
  ].join("\n\n");
}

export function buildPdfSummaryPrompt(input: {
  filename?: string | null;
  courseContext?: string | null;
  instruction?: string | null;
  extractedText: string;
  truncated: boolean;
}) {
  return [
    "Anda adalah asisten dosen yang membantu meringkas isi dokumen PDF mahasiswa.",
    "Tujuan ringkasan: membantu dosen memahami inti dokumen dengan cepat tanpa harus membaca penuh.",
    "Jangan memberi nilai. Jangan membuat keputusan akademik. Jangan menyebut AI.",
    "Tulis ringkasan dalam Bahasa Indonesia akademik yang netral dan padat.",
    "Buat JSON valid tanpa markdown.",
    'Schema: {"language":"id|en","summary":"string ringkas 4-6 kalimat","bullet_points":["poin 1","poin 2","..."]}',
    "bullet_points berisi 4-8 poin penting (tema, metode, temuan, struktur, atau argumen utama).",
    `Nama file: ${input.filename ?? "tidak diketahui"}`,
    `Konteks mata kuliah: ${input.courseContext ?? ""}`,
    `Instruksi tugas: ${input.instruction ?? ""}`,
    input.truncated
      ? "Catatan: dokumen dipotong karena terlalu panjang, fokus pada bagian yang tersedia."
      : "",
    `Isi dokumen:\n${input.extractedText}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildReferenceParserPrompt(input: { rawText: string; truncated: boolean }) {
  return [
    "Anda adalah asisten dosen yang mengekstrak daftar referensi/sitasi dari teks PDF mahasiswa.",
    "Cari bagian Daftar Pustaka, References, Bibliography, atau pola sitasi akademik (APA, IEEE, Vancouver, MLA).",
    "Jangan mengarang referensi. Hanya ekstrak yang benar-benar tertulis di teks.",
    "Buat JSON valid tanpa markdown.",
    'Schema: {"references":[{"raw_text":"string asli citation","authors":["nama lengkap penulis","..."],"year":2023,"title":"judul artikel/buku","source":"jurnal/penerbit/conference","doi":"10.xxxx/yyyy atau null","url":"https://... atau null","arxiv_id":"2301.xxxxx atau null"}]}',
    "Jika tidak ada bagian referensi sama sekali, kembalikan {\"references\":[]}.",
    "Jangan masukkan in-text citation seperti (Smith, 2020). Hanya entry penuh dari daftar pustaka.",
    input.truncated
      ? "Catatan: teks dipotong, fokus mengekstrak referensi yang utuh saja."
      : "",
    `Teks dokumen:\n${input.rawText}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
