/**
 * config.js - the only file you change when switching between
 * mock data and the real Java backend.
 *
 * USE_MOCK = true   -> every API call is answered in the browser by
 *                      assets/js/api/mock/mock-server.js (no backend needed).
 * USE_MOCK = false  -> calls go to API_BASE_URL over HTTP.
 */
export const API_BASE_URL = "http://localhost:8080/api";

export const USE_MOCK = true;

/** Simulated network delay for mock mode, in milliseconds. */
export const MOCK_DELAY_MS = 250;

export const APP_NAME = "PesaPlan";
