const sessionStatus = document.querySelector("#sessionStatus");
const signInLink = document.querySelector("#signInLink");
const logoutButton = document.querySelector("#logoutButton");
const reviewForm = document.querySelector("#reviewForm");
const reviewButton = document.querySelector("#reviewButton");
const formMessage = document.querySelector("#formMessage");
const report = document.querySelector("#report");
const reportTitle = document.querySelector("#reportTitle");
const reviewMeta = document.querySelector("#reviewMeta");

let authenticated = false;

await loadSession();

logoutButton.addEventListener("click", async () => {
  await fetch("/auth/logout", { method: "POST" });
  await loadSession();
});

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!authenticated) {
    setMessage("Sign in with GitHub before running a review.", true);
    return;
  }

  setLoading(true);
  setMessage("Fetching PR changes and asking the reviewer...");
  report.className = "report loading";
  report.textContent = "Review in progress...";

  const payload = Object.fromEntries(new FormData(reviewForm).entries());

  try {
    const response = await fetch("/api/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Review failed.");

    reportTitle.textContent = body.pullRequest.title;
    reviewMeta.textContent = `${body.pullRequest.repository} #${body.pullRequest.pullNumber}`;
    report.className = "report";
    report.innerHTML = markdownToHtml(body.report);
    setMessage("Review complete.");
  } catch (error) {
    report.className = "report empty";
    report.textContent = "No report generated.";
    setMessage(error.message, true);
  } finally {
    setLoading(false);
  }
});

async function loadSession() {
  const response = await fetch("/api/session");
  const session = await response.json();
  authenticated = session.authenticated;

  if (!session.githubConfigured) {
    sessionStatus.textContent = "GitHub OAuth is not configured";
    signInLink.hidden = true;
    logoutButton.hidden = true;
    return;
  }

  if (authenticated) {
    sessionStatus.textContent = `Signed in as ${session.profile.login}`;
    signInLink.hidden = true;
    logoutButton.hidden = false;
  } else {
    sessionStatus.textContent = "Not signed in";
    signInLink.hidden = false;
    logoutButton.hidden = true;
  }

  if (!session.llmConfigured) {
    setMessage(`${session.llmProvider.toUpperCase()} is not configured, so reviews cannot run yet.`, true);
  }
}

function setLoading(isLoading) {
  reviewButton.disabled = isLoading;
  reviewButton.textContent = isLoading ? "Reviewing..." : "Run review";
}

function setMessage(message, isError = false) {
  formMessage.textContent = message || "";
  formMessage.classList.toggle("error", isError);
}

function markdownToHtml(markdown) {
  const escaped = escapeHtml(markdown);
  return escaped
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
    .replace(/<p><h/g, "<h")
    .replace(/<\/h([23])><\/p>/g, "</h$1>")
    .replace(/<p><ul>/g, "<ul>")
    .replace(/<\/ul><\/p>/g, "</ul>");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
