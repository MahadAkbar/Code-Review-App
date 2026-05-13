import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

loadDotEnv(path.join(rootDir, ".env"));

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

export const config = {
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  githubClientId: process.env.GITHUB_CLIENT_ID || "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  llmProvider: (process.env.LLM_PROVIDER || "groq").toLowerCase(),
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-5.2",
  groqApiKey: process.env.GROQ_API_KEY || process.env.GROK_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || process.env.GROK_MODEL || "llama-3.3-70b-versatile",
  port: Number(process.env.PORT || 3000),
  rootDir
};
