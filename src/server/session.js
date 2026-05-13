import crypto from "node:crypto";

const sessions = new Map();
const states = new Map();

export function createOAuthState() {
  const state = crypto.randomBytes(24).toString("hex");
  states.set(state, Date.now() + 10 * 60 * 1000);
  return state;
}

export function consumeOAuthState(state) {
  const expiresAt = states.get(state);
  states.delete(state);
  return Boolean(expiresAt && expiresAt > Date.now());
}

export function createSession(accessToken, profile) {
  const id = crypto.randomBytes(32).toString("hex");
  sessions.set(id, {
    accessToken,
    profile,
    createdAt: Date.now()
  });
  return id;
}

export function getSession(cookies) {
  const sessionId = cookies.session;
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

export function destroySession(cookies) {
  if (cookies.session) sessions.delete(cookies.session);
}

export function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function sessionCookie(sessionId) {
  return `session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`;
}

export function clearSessionCookie() {
  return "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}
