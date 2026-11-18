/**
 * client.js - the single place that talks to the backend.
 * Every service file (auth.js, transactions.js ...) calls request() here,
 * so the token, JSON handling and error handling are written once.
 */
import { API_BASE_URL, USE_MOCK, MOCK_DELAY_MS } from "../config.js";
import { session } from "../core/session.js";
import { ApiError } from "./errors.js";

let mockServer = null;
async function mock() {
  // Loaded only in mock mode, so the real build never ships mock code paths it does not use.
  if (!mockServer) mockServer = await import("./mock/mock-server.js");
  return mockServer;
}

function buildHeaders(hasBody) {
  const headers = { Accept: "application/json" };
  if (hasBody) headers["Content-Type"] = "application/json";
  const token = session.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function handleUnauthorized(path) {
  // A 401 on /auth/login just means wrong password; anywhere else the session expired.
  if (path.startsWith("/auth/")) return;
  session.clear();
  location.replace("login.html");
}

/**
 * request("GET", "/transactions?type=EXPENSE")
 * request("POST", "/transactions", { amount: 500, ... })
 * Resolves with the parsed JSON body, or throws ApiError.
 */
export async function request(method, path, body) {
  if (USE_MOCK) {
    const { mockRequest } = await mock();
    await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));
    try {
      return await mockRequest(method, path, body, session.getToken());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) handleUnauthorized(path);
      throw err;
    }
  }

  let res;
  try {
    res = await fetch(API_BASE_URL + path, {
      method,
      headers: buildHeaders(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check that the backend is running.");
  }

  if (res.status === 401) handleUnauthorized(path);

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.message || `Request failed (${res.status})`, data?.fields || {});
  }
  return data;
}

/** Download a file (used by Export report). Returns { blob, filename }. */
export async function requestFile(path) {
  if (USE_MOCK) {
    const { mockRequest } = await mock();
    return mockRequest("GET", path, undefined, session.getToken());
  }
  let res;
  try {
    res = await fetch(API_BASE_URL + path, { headers: buildHeaders(false) });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check that the backend is running.");
  }
  if (res.status === 401) handleUnauthorized(path);
  if (!res.ok) throw new ApiError(res.status, `Export failed (${res.status})`);
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return { blob: await res.blob(), filename: match ? match[1] : "report.csv" };
}

/** Build "?a=1&b=2" from an object, skipping empty values. */
export function query(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

export const http = {
  get: (path) => request("GET", path),
  post: (path, body = {}) => request("POST", path, body),
  put: (path, body = {}) => request("PUT", path, body),
  del: (path) => request("DELETE", path),
};
