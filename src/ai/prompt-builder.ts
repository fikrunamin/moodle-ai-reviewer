export function buildAssignmentPrompt(input: {
  instruction: string;
  submissionText: string;
  extractedText?: string | null;
}) {
  return [
    "Anda adalah asisten dosen untuk mata kuliah Produksi Media Sederhana Tiga Dimensi.",
    "Buat draft review akademik dalam JSON sesuai rubrik assignment.",
    `Instruksi: ${input.instruction}`,
    `Submission: ${input.submissionText}`,
    `Teks PDF: ${input.extractedText ?? ""}`,
  ].join("\n\n");
}

export function buildDiscussionPrompt(input: {
  prompt: string;
  posts: string;
  interactionCount: number;
}) {
  return [
    "Anda adalah asisten dosen untuk menilai kualitas diskusi mahasiswa.",
    "Buat draft review akademik dalam JSON sesuai rubrik discussion.",
    `Prompt: ${input.prompt}`,
    `Komentar: ${input.posts}`,
    `Jumlah interaksi: ${input.interactionCount}`,
  ].join("\n\n");
}
