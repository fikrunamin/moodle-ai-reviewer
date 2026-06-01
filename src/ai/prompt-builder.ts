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
  tutorReplies?: string | null;
  ratingMax?: number | null;
}) {
  const rubricGuide =
    input.rubricGuide ||
    "Rubrik forum default: Kesesuaian jawaban 20, Kedalaman analisis 25, Keterkaitan teori/konsep 20, Relevansi contoh/argumentasi 15, Kualitas referensi 10, Etika dan kejelasan komunikasi 10.";
  const ratingMax = input.ratingMax ?? 100;

  return [
    "Anda adalah asisten dosen untuk menilai kualitas diskusi mahasiswa.",
    "AI hanya memberi rekomendasi, bukan nilai final.",
    `Skor rekomendasi menggunakan skala Moodle 0-${ratingMax}. Tutor tetap memilih nilai final secara manual di Moodle.`,
    "Buat draft review akademik dalam JSON valid tanpa markdown.",
    'Schema: {"summary":"string","recommended_score":0,"scores":{"instruction_alignment":0,"analysis_depth":0,"conceptual_grounding":0,"argument_relevance":0,"reference_quality":0,"communication_ethics":0},"interaction_count":0,"feedback":"string","manual_review_required":false,"manual_review_reason":null}',
    `Rubrik dan format penilaian: ${rubricGuide}`,
    `Konteks mata kuliah: ${input.courseContext ?? ""}`,
    `Instruksi/study case forum: ${boundedText(input.prompt, Number(process.env.REVIEW_FORUM_PROMPT_MAX_CHARS ?? 6000), "Instruksi forum")}`,
    `Jawaban dan follow-up mahasiswa: ${boundedText(input.posts, Number(process.env.REVIEW_FORUM_POSTS_MAX_CHARS ?? 18000), "Post mahasiswa")}`,
    input.tutorReplies ? `Reply tutor sebagai konteks, bukan bahan yang dinilai: ${boundedText(input.tutorReplies, 8000, "Reply tutor")}` : "",
    `Jumlah post mahasiswa dalam thread: ${input.interactionCount}`,
  ].join("\n\n");
}

export function buildForumReplySuggestionPrompt(input: {
  courseContext?: string | null;
  prompt: string;
  studentPosts: string;
  tutorReplies?: string | null;
  assessmentSummary?: string | null;
  referenceAnalysis?: string | null;
}) {
  return [
    "Anda adalah tutor/dosen forum Moodle yang akan menulis balasan akademik kepada mahasiswa.",
    "Buat saran reply copy-ready dalam Bahasa Indonesia. Jangan menyebut AI. Jangan mengirim atau mengubah apa pun di Moodle.",
    "Nada: ramah, ringkas, spesifik, dan membimbing. Beri apresiasi, koreksi jika perlu, dan arahan perbaikan.",
    "Buat JSON valid tanpa markdown.",
    '{"suggestion":"string reply tutor siap copy","key_points":["poin singkat"],"needs_reference_note":false}',
    `Konteks mata kuliah: ${input.courseContext ?? ""}`,
    `Instruksi/study case forum: ${boundedText(input.prompt, 6000, "Instruksi forum")}`,
    `Jawaban/follow-up mahasiswa: ${boundedText(input.studentPosts, 16000, "Post mahasiswa")}`,
    input.tutorReplies ? `Reply tutor yang sudah ada: ${boundedText(input.tutorReplies, 6000, "Reply tutor")}` : "",
    input.assessmentSummary ? `Hasil review AI sebelumnya: ${input.assessmentSummary}` : "",
    input.referenceAnalysis ? `Analisis referensi: ${boundedText(input.referenceAnalysis, 8000, "Analisis referensi")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildForumReferenceRelevancePrompt(input: {
  prompt: string;
  studentPosts: string;
  referenceRawText: string;
  resolvedMetadata?: string | null;
}) {
  return [
    "Anda membantu tutor mengecek apakah referensi yang dikutip mahasiswa relevan dengan jawaban diskusi.",
    "Jangan mengarang metadata. Jika referensi tidak terlacak, nilai relevansi hanya dari teks sitasi yang tersedia.",
    "Buat JSON valid tanpa markdown.",
    '{"validity":"valid|unverified|invalid","relevance":"high|medium|low|none","supports_argument":true,"possible_random_citation":false,"analysis":"string ringkas untuk tutor"}',
    `Instruksi/study case forum: ${boundedText(input.prompt, 5000, "Instruksi forum")}`,
    `Jawaban/follow-up mahasiswa: ${boundedText(input.studentPosts, 14000, "Post mahasiswa")}`,
    `Referensi yang dikutip: ${input.referenceRawText}`,
    input.resolvedMetadata ? `Metadata hasil pencarian: ${boundedText(input.resolvedMetadata, 8000, "Metadata referensi")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildCitationValidationPrompt(input: {
  mode: "assignment" | "forum";
  courseContext?: string | null;
  instruction?: string | null;
  forumPrompt?: string | null;
  studentText: string;
  reference: {
    rawText: string;
    authors?: string[] | null;
    year?: number | null;
    title?: string | null;
    source?: string | null;
    doi?: string | null;
    url?: string | null;
    arxivId?: string | null;
  };
  resolvedMetadata?: string | null;
}) {
  return [
    "Anda adalah Citation & Reference Validation Agent untuk membantu dosen memeriksa referensi mahasiswa.",
    "Anda TIDAK boleh mengakses internet dan TIDAK boleh mengarang metadata. Gunakan hanya data yang diberikan: teks mahasiswa, sitasi mentah, parsed metadata, dan metadata hasil resolve yang sudah tersimpan.",
    "Tugas utama: cek apakah sitasi tampak valid/terlacak, apakah metadata cocok dengan hasil resolve, kualitas sumber, dan apakah referensi mendukung klaim/topik mahasiswa sejauh bisa dinilai dari data yang tersedia.",
    "Buat JSON valid tanpa markdown.",
    'Schema: {"validation_status":"valid|likely_valid|unverified|invalid","claim_support":"supports|partially_supports|does_not_support|not_assessed","metadata_match_score":0,"source_quality_score":0,"reference_type":"journal_article|conference_paper|book|chapter|webpage|pdf_document|preprint|report|video|unknown","matched_url":"string atau null","matched_doi":"string atau null","matched_title":"string atau null","evidence":["bukti ringkas"],"issues":["masalah/risiko ringkas"],"analysis":"ringkasan untuk tutor"}',
    "metadata_match_score dan source_quality_score gunakan skala 0-100. Jika bukti kurang, pilih unverified/not_assessed dan skor konservatif.",
    "Jangan menyatakan sumber mendukung klaim jika hanya ada judul/metadata tanpa abstrak/snippet yang relevan.",
    `Mode: ${input.mode}`,
    `Konteks mata kuliah: ${input.courseContext ?? ""}`,
    input.instruction ? `Instruksi tugas: ${boundedText(input.instruction, 5000, "Instruksi")}` : "",
    input.forumPrompt ? `Instruksi/study case forum: ${boundedText(input.forumPrompt, 5000, "Instruksi forum")}` : "",
    `Teks mahasiswa: ${boundedText(input.studentText, Number(process.env.CITATION_VALIDATION_STUDENT_TEXT_MAX_CHARS ?? 16000), "Teks mahasiswa")}`,
    `Referensi yang dikutip: ${JSON.stringify(input.reference)}`,
    input.resolvedMetadata
      ? `Metadata resolve yang sudah tersimpan: ${boundedText(input.resolvedMetadata, Number(process.env.CITATION_VALIDATION_METADATA_MAX_CHARS ?? 12000), "Metadata resolve")}`
      : "Metadata resolve yang sudah tersimpan: null",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildReferenceSearchPlanPrompt(input: {
  rawText: string;
  title?: string | null;
  authors?: string[] | null;
  year?: number | null;
  doi?: string | null;
  url?: string | null;
  arxivId?: string | null;
  contextText?: string | null;
}) {
  const known = {
    title: input.title ?? null,
    authors: input.authors ?? null,
    year: input.year ?? null,
    doi: input.doi ?? null,
    url: input.url ?? null,
    arxiv_id: input.arxivId ?? null,
  };
  return [
    "Anda adalah Research Search Agent yang menyusun RENCANA pencarian referensi akademik dari sebuah sitasi mahasiswa.",
    "Anda TIDAK mengakses internet. Tugas Anda hanya menghasilkan query pencarian terbaik dan klasifikasi sumber. Jangan mengarang metadata atau hasil.",
    "Buat JSON valid tanpa markdown.",
    'Schema: {"intent":"academic|pdf_document|general|technical|news","is_academic":true,"language":"id|en","queries":["query umum terurut prioritas"],"pdf_queries":["pola pencarian PDF"],"expected_doi":"string atau null","expected_arxiv_id":"string atau null","title_guess":"string atau null"}',
    "queries: 2-5 query Google yang paling mungkin menemukan sumber asli. Gunakan judul dalam tanda kutip bila ada, tambahkan penulis utama dan tahun bila tersedia.",
    'pdf_queries: 3-6 pola untuk menemukan PDF, contoh: \'"{judul}" filetype:pdf\', \'site:ac.id filetype:pdf {judul}\', \'site:edu filetype:pdf {judul}\', \'site:go.id filetype:pdf {topik}\', \'site:gov filetype:pdf {topik}\', \'site:org filetype:pdf {topik}\', \'intitle:{judul} pdf\'.',
    "Ganti {judul}/{topik} dengan kata kunci nyata dari sitasi. Jangan menyertakan placeholder kurung kurawal di output.",
    "Jika sitasi jelas non-akademik (berita, blog, Wikipedia, video), set is_academic=false dan intent yang sesuai.",
    `Metadata yang sudah diketahui: ${JSON.stringify(known)}`,
    `Sitasi mentah: ${boundedText(input.rawText, 1500, "Sitasi")}`,
    input.contextText
      ? `Konteks kalimat di sekitar sitasi (untuk memahami topik): ${boundedText(input.contextText, 1500, "Konteks")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
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
