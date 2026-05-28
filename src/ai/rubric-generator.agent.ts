import { AiProviderService } from "./ai-provider.service";

export class RubricGeneratorAgent {
  constructor(private readonly provider = new AiProviderService()) {}

  async generate(input: { activityType: string; rubricText: string; timeoutMs?: number }) {
    return this.provider.getClient().completeJson(
      [
        "Anda membantu dosen mengubah dokumen rubrik menjadi panduan penilaian terstruktur.",
        "Buat JSON valid tanpa markdown.",
        'Schema: {"rubric_summary":"string","grading_instruction":"string","feedback_format":"string","criteria":[{"name":"string","max_score":0,"description":"string"}]}',
        "Pertahankan bahasa dan konteks rubrik dari dokumen. Jangan membuat keputusan nilai final.",
        `Jenis activity: ${input.activityType}`,
        `Isi dokumen rubrik:\n${input.rubricText.slice(0, Number(process.env.RUBRIC_AI_MAX_CHARS ?? 8000))}`,
      ].join("\n\n"),
      { timeoutMs: input.timeoutMs },
    );
  }
}
