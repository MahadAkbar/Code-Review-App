import { fetchPullRequestPackage } from "./github.js";
import { reviewPullRequest } from "./llm/client.js";

const MAX_PATCH_CHARS = 90000;

export async function createReview({ prUrl, ticketDetails, customInstructions, accessToken }) {
  if (!prUrl?.trim()) {
    throw httpError(400, "Pull request URL is required.");
  }

  const pullRequest = await fetchPullRequestPackage(prUrl.trim(), accessToken);
  const reviewInput = {
    ticketDetails: ticketDetails?.trim() || null,
    customInstructions: customInstructions?.trim() || null,
    pullRequest: trimPullRequestPackage(pullRequest)
  };

  const report = await reviewPullRequest(reviewInput);
  return {
    report,
    pullRequest: {
      repository: pullRequest.repository,
      pullNumber: pullRequest.pullNumber,
      title: pullRequest.title,
      url: pullRequest.url,
      changedFiles: pullRequest.changedFiles,
      additions: pullRequest.additions,
      deletions: pullRequest.deletions
    }
  };
}

function trimPullRequestPackage(pullRequest) {
  let remaining = MAX_PATCH_CHARS;
  return {
    ...pullRequest,
    files: pullRequest.files.map((file) => {
      const patch = file.patch.slice(0, Math.max(0, remaining));
      remaining -= patch.length;
      return {
        ...file,
        patch: patch || "[Patch omitted because review input exceeded size limit]"
      };
    })
  };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
