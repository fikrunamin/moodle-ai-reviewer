const maxMessageLength = 3800;

function formatMeta(meta: unknown) {
  if (!meta) return "";
  if (meta instanceof Error) return `${meta.name}: ${meta.message}\n${meta.stack ?? ""}`.trim();
  if (typeof meta === "string") return meta;

  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

function truncateMessage(message: string) {
  if (message.length <= maxMessageLength) return message;
  return `${message.slice(0, maxMessageLength)}\n...truncated`;
}

export async function sendTelegramError(message: string, meta?: unknown) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = (process.env.TELEGRAM_ACCOUNT_ID ?? process.env.TELEGRAM_CHAT_ID)?.trim();
  if (!token || !chatId) return;

  const appName = process.env.TELEGRAM_APP_NAME ?? "Moodle AI Review Assistant";
  const metaText = formatMeta(meta);
  const text = truncateMessage(
    [`[${appName}] Error`, message, metaText ? `\n${metaText}` : ""].filter(Boolean).join("\n"),
  );

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      signal: AbortSignal.timeout(Number(process.env.TELEGRAM_TIMEOUT_MS ?? 10_000)),
    });
  } catch (error) {
    console.warn("[warn] Telegram error notification failed", error);
  }
}
