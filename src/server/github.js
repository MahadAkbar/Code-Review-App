import { config } from "./config.js";

export function parsePullRequestUrl(prUrl) {
  let url;
  try {
    url = new URL(prUrl);
  } catch {
    throw httpError(400, "Enter a valid GitHub pull request URL.");
  }

  if (!["github.com", "www.github.com"].includes(url.hostname)) {
    throw httpError(400, "Only github.com pull request URLs are supported.");
  }

  const [, owner, repo, pullSegment, number] = url.pathname.split("/");
  if (!owner || !repo || pullSegment !== "pull" || !number || !/^\d+$/.test(number)) {
    throw httpError(400, "Use a URL like https://github.com/owner/repo/pull/123.");
  }

  return { owner, repo, pullNumber: Number(number) };
}

export function githubAuthUrl(state) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.githubClientId);
  url.searchParams.set("redirect_uri", `${config.appBaseUrl}/auth/github/callback`);
  url.searchParams.set("scope", "repo read:user");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(code) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: `${config.appBaseUrl}/auth/github/callback`
    })
  });

  const body = await response.json();
  if (!response.ok || body.error || !body.access_token) {
    throw httpError(401, body.error_description || "GitHub sign-in failed.");
  }

  return body.access_token;
}

export async function fetchGitHubProfile(accessToken) {
  return githubRequest("https://api.github.com/user", accessToken);
}

export async function fetchPullRequestPackage(prUrl, accessToken) {
  const { owner, repo, pullNumber } = parsePullRequestUrl(prUrl);
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

  const [pullRequest, files, commits] = await Promise.all([
    githubRequest(`${apiBase}/pulls/${pullNumber}`, accessToken),
    githubRequest(`${apiBase}/pulls/${pullNumber}/files?per_page=100`, accessToken),
    githubRequest(`${apiBase}/pulls/${pullNumber}/commits?per_page=100`, accessToken)
  ]);

  return {
    repository: `${owner}/${repo}`,
    pullNumber,
    url: prUrl,
    title: pullRequest.title,
    body: pullRequest.body || "",
    author: pullRequest.user?.login || "unknown",
    base: pullRequest.base?.ref || "",
    head: pullRequest.head?.ref || "",
    state: pullRequest.state,
    additions: pullRequest.additions,
    deletions: pullRequest.deletions,
    changedFiles: pullRequest.changed_files,
    commits: commits.map((commit) => ({
      sha: commit.sha,
      message: commit.commit?.message || ""
    })),
    files: files.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch || "[Patch unavailable from GitHub API]"
    }))
  };
}

async function githubRequest(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "code-review-app"
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, body.message || "GitHub API request failed.");
  }

  return body;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
