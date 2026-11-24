import { OpenAI } from "openai";

let client: OpenAI | null = null;

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
  if (!c) throw new Error("USER_LLM_API_KEY not configured");

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
    model: process.env.USER_LLM_MODEL || "nvidia/nemotron-4-340b-reward",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 3000,
  });

  const text = completion.choices[0]?.message?.content || "";
  return text;
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
