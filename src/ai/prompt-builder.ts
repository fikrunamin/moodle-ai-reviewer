export function buildAssignmentPrompt(input: {
  courseContext?: string | null;
  instruction: string;
  submissionText: string;
  extractedText?: string | null;
}) {
  return [
    "Anda adalah asisten dosen yang membantu membuat draft review akademik berdasarkan konteks mata kuliah dan tugas dari Moodle.",
    "AI hanya memberi rekomendasi, bukan nilai final.",
    "Buat draft review akademik dalam JSON valid tanpa markdown.",
    'Schema: {"summary":"string","recommended_score":0,"scores":{"instruction_match":0,"creativity":0,"technique_material":0,"final_quality":0,"documentation":0,"reflection":0},"feedback":"string","manual_review_required":false,"manual_review_reason":null}',
    "Rubrik: Kesesuaian Instruksi 20, Kreativitas Ide 20, Teknik dan Bahan 20, Kualitas Hasil Akhir 20, Dokumentasi Proses 10, Refleksi Mahasiswa 10.",
    "Jika bukti tidak cukup atau PDF tidak terbaca, set manual_review_required=true dan jangan memberi skor tinggi.",
    `Konteks mata kuliah: ${input.courseContext ?? ""}`,
    `Instruksi: ${input.instruction}`,
    `Submission: ${input.submissionText}`,
    `Teks PDF: ${input.extractedText ?? ""}`,
  ].join("\n\n");
}

export function buildDiscussionPrompt(input: {
  courseContext?: string | null;
  prompt: string;
  posts: string;
  interactionCount: number;
}) {
  return [
    "Anda adalah asisten dosen untuk menilai kualitas diskusi mahasiswa.",
    "AI hanya memberi rekomendasi, bukan nilai final.",
    "Buat draft review akademik dalam JSON valid tanpa markdown.",
    'Schema: {"summary":"string","recommended_score":0,"scores":{"argument_quality":0,"relevance":0,"analysis_depth":0,"interaction_quantity":0,"communication_ethics":0},"interaction_count":0,"feedback":"string","manual_review_required":false,"manual_review_reason":null}',
    "Rubrik: Kualitas Argumen 25, Relevansi 25, Kedalaman Analisis 20, Jumlah Interaksi 20, Etika Komunikasi 10.",
    `Konteks mata kuliah: ${input.courseContext ?? ""}`,
    `Prompt: ${input.prompt}`,
    `Komentar: ${input.posts}`,
    `Jumlah interaksi: ${input.interactionCount}`,
  ].join("\n\n");
}
