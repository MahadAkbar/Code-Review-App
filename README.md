# Code Review App

## What it does

- Signs in with GitHub OAuth.
- Accepts a GitHub pull request URL.
- Reviews public pull requests without requiring GitHub sign-in.
- Optionally accepts ticket details and custom review instructions.
- Fetches PR metadata, file patches, and changed-file context from GitHub.
- Sends the review package to an LLM through a single provider boundary.
- Returns an analysis report with the issue being solved, requirement fit, risks, security concerns, suggestions, and recommended changes.

## Setup

1. Optional: create a GitHub OAuth app for private repos and higher GitHub API limits:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/github/callback`
2. Copy `.env.example` to `.env`.
3. Fill in the API key for your chosen LLM provider. Fill in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` only if you want sign-in.
   - `LLM_PROVIDER=openai` uses `OPENAI_API_KEY` and `OPENAI_MODEL`.
   - `LLM_PROVIDER=groq` uses `GROQ_API_KEY` and `GROQ_MODEL`.
   - `OPENAI_MODEL` defaults to `gpt-5.2`.
   - `GROQ_MODEL` defaults to `llama-3.3-70b-versatile`.
4. Run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## LLM client boundary

The global LLM entry point is:

`src/server/llm/client.js`

The rest of the app calls `reviewPullRequest(input)` from that file. To switch providers now, change `LLM_PROVIDER` in `.env`. To add or replace providers later, keep the `reviewPullRequest(input)` contract and update only `src/server/llm/client.js`.
