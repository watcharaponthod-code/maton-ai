const GW    = "https://gateway.maton.ai/telegram"
const MATON = () => process.env.MATON_API_KEY!
const CHAT  = () => process.env.TELEGRAM_CHAT_ID!

export async function send(text: string): Promise<void> {
  if (!CHAT()) return
  try {
    await fetch(`${GW}/bot/sendMessage`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${MATON()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT(), text, parse_mode: "Markdown" }),
    })
  } catch (e) { console.error("[Telegram]", e) }
}
