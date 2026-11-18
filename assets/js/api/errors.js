/**
 * ApiError - thrown by the API layer for any failed request.
 * status 0 means the server could not be reached at all.
 * `fields` holds per-field validation messages, e.g. { email: "Already registered" }.
 */
export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}
