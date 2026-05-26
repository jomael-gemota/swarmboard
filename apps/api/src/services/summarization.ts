import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

/**
 * Summarize a list of raw agent activity log entries into a concise PM-friendly summary.
 * Falls back to a simple truncation if OpenAI is not configured.
 */
export async function summarizeActivityLogs(
  logs: Array<{ source: string; content: string; createdAt: Date }>
): Promise<string> {
  const client = getOpenAI();

  const raw = logs
    .map((l) => `[${l.source.toUpperCase()}] ${l.content}`)
    .join("\n");

  if (!client) {
    // Simple fallback: return last 3 meaningful lines
    const meaningful = logs
      .filter((l) => l.content.length > 10)
      .slice(-3)
      .map((l) => l.content)
      .join(" → ");
    return meaningful || "No recent activity";
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a project management assistant. Summarize the following AI agent activity log into 1-2 concise sentences suitable for a project manager. Focus on what was accomplished, what is in progress, and any blockers. Be factual and brief.",
        },
        {
          role: "user",
          content: `Activity log:\n${raw}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() ?? "No summary available";
  } catch (err) {
    console.error("Summarization error:", err);
    return "Summary unavailable";
  }
}
