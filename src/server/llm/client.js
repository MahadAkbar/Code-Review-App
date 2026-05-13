import Groq from "groq-sdk";
import { config } from "../config.js";

const providers = {
  openai: createOpenAiProvider,
  groq: createGroqProvider
};

export const llmClient = createLlmClient(config.llmProvider);

export async function reviewPullRequest(input) {
  return llmClient.reviewPullRequest(input);
}

export function isLlmConfigured() {
  return llmClient.isConfigured();
}

function createLlmClient(providerName) {
  const createProvider = providers[providerName];
  if (!createProvider) {
    return {
      name: providerName,
      isConfigured: () => false,
      reviewPullRequest: async () => {
        throw httpError(
          500,
          `Unsupported LLM_PROVIDER "${providerName}". Use one of: ${Object.keys(providers).join(", ")}.`
        );
      }
    };
  }

  return createProvider();
}

function createOpenAiProvider() {
  return {
    name: "openai",
    isConfigured: () => Boolean(config.openAiApiKey),
    async reviewPullRequest(input) {
      if (!config.openAiApiKey) {
        throw httpError(500, "OPENAI_API_KEY is not configured.");
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.openAiApiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: config.openAiModel,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: reviewSystemPrompt()
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: JSON.stringify(input, null, 2)
                }
              ]
            }
          ]
        })
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw httpError(response.status, body.error?.message || "OpenAI review request failed.");
      }

      return extractOpenAiText(body);
    }
  };
}

function createGroqProvider() {
  const groq = new Groq({ apiKey: config.groqApiKey });

  return {
    name: "groq",
    isConfigured: () => Boolean(config.groqApiKey),
    async reviewPullRequest(input) {
      if (!config.groqApiKey) {
        throw httpError(500, "GROQ_API_KEY is not configured.");
      }

      const completion = await groq.chat.completions.create({
        model: config.groqModel,
        messages: [
          {
            role: "system",
            content: reviewSystemPrompt()
          },
          {
            role: "user",
            content: JSON.stringify(input, null, 2)
          }
        ],
        temperature: 0.2
      });

      return completion.choices?.[0]?.message?.content?.trim() || "No review text was returned.";
    }
  };
}

function reviewSystemPrompt() {
  return `You are a senior code reviewer. Review the pull request using the supplied PR metadata, changed-file patches, optional ticket details, and optional custom user instructions.

Return a concise Markdown report with these sections:
1. Summary
2. Issue this PR solves
3. Requirement fit
4. High-risk findings
5. Security and privacy
6. Best-practice issues
7. Suggested changes
8. Test recommendations

Rules:
- If ticket details are present, explicitly assess whether the PR fulfills the ticket requirements.
- In "Issue this PR solves", infer the problem from the ticket details, PR title/body, commit messages, and patch. If it is unclear, say what can be inferred and what is missing.
- If ticket details are missing, focus on correctness, maintainability, security, reliability, and best practices.
- Cite filenames when making a finding.
- Separate confirmed issues from risks or questions.
- Do not invent line numbers if the patch does not provide enough context.`;
}

function extractOpenAiText(body) {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text;
  }

  const chunks = [];
  for (const item of body.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
    }
  }

  return chunks.join("\n").trim() || "No review text was returned.";
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
