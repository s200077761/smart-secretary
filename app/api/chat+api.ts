import { ExpoRequest, ExpoResponse } from "expo-router/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

export async function POST(request: ExpoRequest): Promise<ExpoResponse> {
  if (!GEMINI_API_KEY) {
    return ExpoResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });
  }

  let body: { message?: string; systemPrompt?: string };
  try {
    body = await request.json();
  } catch {
    return ExpoResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, systemPrompt } = body;
  if (!message) {
    return ExpoResponse.json({ error: "message is required" }, { status: 400 });
  }

  const geminiBody: Record<string, unknown> = {
    contents: [{ parts: [{ text: message }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
  };
  if (systemPrompt) {
    geminiBody.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return ExpoResponse.json(
        { error: (err as any).error?.message || `Gemini error ${resp.status}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    const text = (data as any).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return ExpoResponse.json({ content: text });
  } catch (err) {
    return ExpoResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
