function boundedText(value: string | null | undefined, maxChars: number, label: string) {
  const text = value ?? "";
  if (!Number.isFinite(maxChars) || maxChars <= 0 || text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[${label} dipotong untuk menjaga request AI tetap responsif. Total karakter asli: ${text.length}.]`;
}

export function buildAssignmentPrompt(input: {
  courseContext?: string | null;
  instruction: string;
  rubricGuide?: string | null;
  rubricCriteria?: Array<{
    name: string;
    max_score: number;
    description?: string | null;
    levels?: Array<{ score: number; definition: string }>;
  }> | null;
  submissionText: string;
  extractedText?: string | null;
}) {
  const rubricGuide = boundedText(
    input.rubricGuide ||
      "Rubrik default: Kesesuaian Instruksi 20, Kreativitas Ide 20, Teknik dan Bahan 20, Kualitas Hasil Akhir 20, Dokumentasi Proses 10, Refleksi Mahasiswa 10.",
    Number(process.env.REVIEW_RUBRIC_GUIDE_MAX_CHARS ?? 4000),
    "Rubrik",
  );
  const submissionText = boundedText(
    input.submissionText,
    Number(process.env.REVIEW_SUBMISSION_TEXT_MAX_CHARS ?? 8000),
    "Submission",
  );
  const extractedText = boundedText(
    input.extractedText,
    Number(process.env.REVIEW_EXTRACTED_TEXT_MAX_CHARS ?? 24000),
    "Teks PDF",
  );

  return [
    "Anda adalah asisten dosen yang membantu membuat draft review akademik berdasarkan konteks mata kuliah dan tugas dari Moodle.",
    "AI hanya memberi rekomendasi, bukan nilai final.",
    "Buat draft review akademik dalam JSON valid tanpa markdown.",
    input.rubricCriteria?.length
      ? 'Schema: {"summary":"string","recommended_score":0,"criteria_scores":[{"criteria_name":"string harus sama dengan nama kriteria rubrik","criteria_score":0,"max_score":0,"recommended_level_score":0,"recommended_level_definition":"string atau null"}],"feedback":"string","manual_review_required":false,"manual_review_reason":null}'
      : 'Schema: {"summary":"string","recommended_score":0,"scores":{"instruction_match":0,"creativity":0,"technique_material":0,"final_quality":0,"documentation":0,"reflection":0},"feedback":"string","manual_review_required":false,"manual_review_reason":null}',
    `Rubrik dan format penilaian: ${rubricGuide}`,
    input.rubricCriteria?.length
      ? `Daftar kriteria rubrik yang WAJIB dipakai untuk criteria_scores, urutan dan max_score harus sama persis: ${JSON.stringify(input.rubricCriteria)}`
      : "",
    input.rubricCriteria?.length
      ? "Jangan memakai breakdown default. Jangan membuat kriteria baru. Isi criteria_scores untuk setiap kriteria rubrik aktif."
      : "",
    input.rubricCriteria?.some((criterion) => criterion.levels?.length)
      ? "Jika kriteria memiliki levels Moodle, criteria_score dan recommended_level_score HARUS sama dengan score salah satu level pada kriteria tersebut. Teacher akan memilih level final di halaman grader Moodle; tugas AI adalah memberi rekomendasi level paling sesuai berdasarkan bukti."
      : "",
    "Jika bukti tidak cukup atau PDF tidak terbaca, set manual_review_required=true dan jangan memberi skor tinggi.",
    `Konteks mata kuliah: ${input.courseContext ?? ""}`,
    `Instruksi: ${input.instruction}`,
    `Submission: ${submissionText}`,
    `Teks PDF: ${extractedText}`,
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
    'Jika tidak ada bagian referensi sama sekali, kembalikan {"references":[]}.',
    "Jangan masukkan in-text citation seperti (Smith, 2020). Hanya entry penuh dari daftar pustaka.",
    input.truncated
      ? "Catatan: teks dipotong, fokus mengekstrak referensi yang utuh saja."
      : "",
    `Teks dokumen:\n${input.rawText}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildInstructionAnalysisPrompt(input: {
  title?: string | null;
  htmlInstruction?: string | null;
  documentText: string;
  truncated: boolean;
}) {
  return [
    "Anda adalah asisten dosen yang menganalisis dokumen instruksi/arahan tugas (dari file PDF atau DOCX yang dilampirkan dosen).",
    "Tujuan: merangkum dokumen menjadi arahan tugas yang jelas dan terstruktur untuk dipakai sebagai konteks penilaian.",
    "Jangan mengarang. Hanya gunakan informasi yang ada di dokumen dan deskripsi tugas.",
    "Jangan memberi nilai. Jangan menyebut AI.",
    "Tulis dalam Bahasa Indonesia akademik yang ringkas.",
    "Buat JSON valid tanpa markdown.",
    'Schema: {"summary":"ringkasan 2-4 kalimat tujuan tugas","objectives":["tujuan/learning outcome"],"deliverables":["yang harus dikumpulkan mahasiswa"],"requirements":["syarat teknis/format/aturan penting"],"deadline":"string atau null","submission_format":"string atau null","grading_notes":["hal yang akan dinilai jika disebutkan"],"rubric":null atau {"rubric_summary":"string","grading_instruction":"string","feedback_format":"string","criteria":[{"name":"string","max_score":0,"description":"string"}]}}',
    "Jika sebuah field tidak disebutkan di dokumen, gunakan array kosong atau null.",
    "Jika dokumen arahan berisi rubrik, tabel penilaian, bobot, kriteria, indikator, atau poin penilaian, ekstrak ke field rubric. Jika tidak ada rubrik eksplisit, set rubric=null. Jangan membuat rubrik baru.",
    `Judul tugas: ${input.title ?? "-"}`,
    `Deskripsi tugas di halaman Moodle: ${input.htmlInstruction ?? "-"}`,
    input.truncated ? "Catatan: dokumen dipotong karena panjang, fokus pada bagian yang tersedia." : "",
    `Isi dokumen instruksi:\n${input.documentText}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
