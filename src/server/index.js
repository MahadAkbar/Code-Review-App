import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { createReview } from "./review.js";
import { isLlmConfigured, llmClient } from "./llm/client.js";
import {
  clearSessionCookie,
  consumeOAuthState,
  createOAuthState,
  createSession,
  destroySession,
  getSession,
  parseCookies,
  sessionCookie
} from "./session.js";
import { exchangeCodeForToken, fetchGitHubProfile, githubAuthUrl } from "./github.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../public");

const server = http.createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    sendJson(response, error.status || 500, {
      error: error.message || "Something went wrong."
    });
  }
});

server.listen(config.port, "127.0.0.1", () => {
  console.log(`Code Review App running at http://localhost:${config.port}`);
});

async function route(request, response) {
  const url = new URL(request.url, config.appBaseUrl);
  const cookies = parseCookies(request.headers.cookie || "");

  if (request.method === "GET" && url.pathname === "/auth/github") {
    ensureGitHubConfig();
    const state = createOAuthState();
    response.writeHead(302, { location: githubAuthUrl(state) });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/auth/github/callback") {
    ensureGitHubConfig();
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state || !consumeOAuthState(state)) {
      throw httpError(401, "Invalid GitHub sign-in callback.");
    }

    const accessToken = await exchangeCodeForToken(code);
    const profile = await fetchGitHubProfile(accessToken);
    const sessionId = createSession(accessToken, {
      login: profile.login,
      avatarUrl: profile.avatar_url,
      profileUrl: profile.html_url
    });

    response.writeHead(302, {
      location: "/",
      "set-cookie": sessionCookie(sessionId)
    });
    response.end();
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/logout") {
    destroySession(cookies);
    sendJson(response, 200, { ok: true }, { "set-cookie": clearSessionCookie() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/session") {
    const session = getSession(cookies);
    sendJson(response, 200, {
      authenticated: Boolean(session),
      profile: session?.profile || null,
      githubConfigured: Boolean(config.githubClientId && config.githubClientSecret),
      llmProvider: llmClient.name,
      llmConfigured: isLlmConfigured()
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/review") {
    const session = getSession(cookies);
    if (!session) throw httpError(401, "Sign in with GitHub before reviewing a PR.");

    const body = await readJson(request);
    const result = await createReview({
      ...body,
      accessToken: session.accessToken
    });
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "GET") {
    await sendStatic(url.pathname, response);
    return;
  }

  throw httpError(404, "Not found.");
}

async function sendStatic(pathname, response) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    throw httpError(403, "Forbidden.");
  }

  const content = await fs.readFile(filePath);
  response.writeHead(200, { "content-type": contentType(filePath) });
  response.end(content);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json",
    ...headers
  });
  response.end(JSON.stringify(body));
}

function ensureGitHubConfig() {
  if (!config.githubClientId || !config.githubClientSecret) {
    console.log(config);
    
    throw httpError(500, "GitHub OAuth is not configured.");
  }
}

function contentType(filePath) {
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "text/html; charset=utf-8";
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
