import { OpenAI } from "openai";

let client: OpenAI | null = null;

const LLM_TIMEOUT_MS = 60000;

function fetchWithTimeout(url: string, opts: RequestInit, ms = LLM_TIMEOUT_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return fetch(url, { ...opts, signal: ac.signal }).then((res) => {
    clearTimeout(timer);
    return res;
  }, (err) => {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`LLM request timed out after ${ms / 1000}s`);
    }
    throw err;
  });
}

function getClient(): OpenAI | null {
  if (client) return client;
  const apiKey = process.env.USER_LLM_API_KEY;
  if (!apiKey) return null;
  client = new OpenAI({
    apiKey,
    baseURL: process.env.USER_LLM_BASE_URL || "https://integrate.api.nvidia.com/v1",
    defaultHeaders: {
      "User-Agent": "Quill/1.0",
    },
  });
  return client;
}

export function llmConfigured() {
  return Boolean(process.env.USER_LLM_API_KEY);
}

export async function llmWriteChapter(params: {
  topic: string;
  section: {
    title: string;
    summary: string;
    number: string;
  };
  sources: Array<{ title: string; year: number; authors: string[]; venue?: string; doi?: string; abstract?: string }>;
  style: string;
  documentType: string;
  targetWords: number;
}) {
  const c = getClient();
  if (c) {
    try {
      const sourceList = params.sources
        .map(
          (s) =>
            `- ${s.title} (${s.year})${s.authors.length ? ` by ${s.authors.join(", ")}` : ""}${
              s.venue ? `, ${s.venue}` : ""
            }${s.doi ? ` DOI:${s.doi}` : ""}`
        )
        .join("\n");

      const { section } = params;
      const prompt = [
        `You are an academic writing assistant for a ${params.documentType}.`,
        `Topic: ${params.topic}`,
        `Citation style: ${params.style}`,
        `Chapter ${section.number}: ${section.title}`,
        `Chapter summary: ${section.summary}`,
        `Target length: approximately ${params.targetWords} words.`,
        "",
        "Use these recent journal sources as the evidential base:",
        sourceList,
        "",
        "Requirements:",
        "- Write formal academic prose with citations woven in (Author, Year).",
        "- Include subsection headings.",
        "- Do not invent facts; ground claims in the provided sources.",
        "- End with implications for the manuscript.",
        "",
        "Write the chapter now:",
      ].join("\n");

      const completion = await c.chat.completions.create({
        model: process.env.USER_LLM_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 3000,
      });
      const text = completion.choices[0]?.message?.content || "";
      if (text) return text;
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "unknown error";
      // Fall through to cantrustai fallback
    }
  }

  // Fallback: cantrustai.xyz Claude Haiku
  try {
    const sourceList = params.sources
      .map(
        (s) =>
          `- ${s.title} (${s.year})${s.authors.length ? ` by ${s.authors.join(", ")}` : ""}${
            s.venue ? `, ${s.venue}` : ""
          }${s.doi ? ` DOI:${s.doi}` : ""}`
      )
      .join("\n");

    const { section } = params;
    const prompt = [
      `You are an academic writing assistant for a ${params.documentType}.`,
      `Topic: ${params.topic}`,
      `Citation style: ${params.style}`,
      `Chapter ${section.number}: ${section.title}`,
      `Chapter summary: ${section.summary}`,
      `Target length: approximately ${params.targetWords} words.`,
      "",
      "Use these recent journal sources as the evidential base:",
      sourceList,
      "",
      "Requirements:",
      "- Write formal academic prose with citations woven in (Author, Year).",
      "- Include subsection headings.",
      "- Do not invent facts; ground claims in the provided sources.",
      "- End with implications for the manuscript.",
      "",
      "Write the chapter now:",
    ].join("\n");

    const fallbackRes = await fetchWithTimeout("https://api.cantrustai.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ctai_dsoiueU0_qwTrhTgbX8KAy6PuzhgmJLB5n03MvE8q",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-5.5",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 3000,
      }),
    });
    if (!fallbackRes.ok) {
      const errText = await fallbackRes.text().catch(() => "");
      throw new Error(`Fallback LLM failed (${fallbackRes.status}): ${errText}`);
    }
    const data = await fallbackRes.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error: any) {
    const msg = error?.message || error?.toString() || "unknown error";
    throw new Error(`LLM request failed: ${msg}`);
  }
}

export function resetLlmClient() {
  client = null;
}

export async function llmNameChat(prompt: string): Promise<string> {
  const c = getClient();
  if (!c) return prompt.slice(0, 72);
  try {
    const completion = await c.chat.completions.create({
      model: process.env.USER_LLM_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b",
      messages: [
        {
          role: "user",
          content: [
            "You are a helpful assistant that generates short, descriptive chat titles.",
            "Given the user's first message below, produce a concise title (max 6 words, no quotes, no punctuation at the end).",
            "Return ONLY the title, nothing else.",
            "",
            `User message: ${prompt}`,
          ].join("\n"),
        },
      ],
      temperature: 0.3,
      max_tokens: 20,
    });
    const title = completion.choices[0]?.message?.content || "";
    return title.trim().slice(0, 72) || prompt.slice(0, 72);
  } catch {
    return prompt.slice(0, 72);
  }
}

export async function llmChat(message: string): Promise<string> {
  const c = getClient();
  if (c) {
    try {
      const completion = await c.chat.completions.create({
        model: process.env.USER_LLM_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b",
        messages: [
          {
            role: "system",
            content:
              "You are Quill, a helpful research writing assistant. Keep responses concise, friendly, and focused on academic writing. If the user wants to write a manuscript, ask for their topic, document type, citation style, and target pages.",
          },
          { role: "user", content: message },
        ],
        temperature: 0.5,
        max_tokens: 500,
      });
      const text = completion.choices[0]?.message?.content || "";
      if (text) return text;
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "unknown error";
      // Fall through to cantrustai fallback
    }
  }

  // Fallback: cantrustai.xyz Claude Haiku
  try {
    const fallbackRes = await fetchWithTimeout("https://api.cantrustai.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ctai_dsoiueU0_qwTrhTgbX8KAy6PuzhgmJLB5n03MvE8q",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-5.5",
        messages: [
          {
            role: "system",
            content:
              "You are Quill, a helpful research writing assistant. Keep responses concise, friendly, and focused on academic writing. If the user wants to write a manuscript, ask for their topic, document type, citation style, and target pages.",
          },
          { role: "user", content: message },
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });
    if (!fallbackRes.ok) {
      const errText = await fallbackRes.text().catch(() => "");
      throw new Error(`Fallback LLM failed (${fallbackRes.status}): ${errText}`);
    }
    const data = await fallbackRes.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error: any) {
    const msg = error?.message || error?.toString() || "unknown error";
    throw new Error(`LLM request failed: ${msg}`);
  }
}
