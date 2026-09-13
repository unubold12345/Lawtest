// Fire-and-forget admin alerts (Telegram). No-op unless both env vars set:
//   TELEGRAM_BOT_TOKEN — from @BotFather
//   TELEGRAM_ADMIN_CHAT_ID — your Telegram user/chat id
// Never throws — notification must not break the request that triggers it.
export async function notifyAdmin(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {}
}
