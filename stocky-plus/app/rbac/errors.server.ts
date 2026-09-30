/**
 * PR7 checkpoint A — actor / owner-proof boundary errors.
 *
 * Messages must never include ID tokens, access tokens, or secrets.
 */

export class ActorBoundaryError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 401) {
    super(message);
    this.name = "ActorBoundaryError";
    this.code = code;
    this.httpStatus = httpStatus;
  }

  toResponse(): Response {
    return new Response(JSON.stringify({ code: this.code }), {
      status: this.httpStatus,
      headers: { "content-type": "application/json" },
    });
  }
}

export function throwActorBoundary(
  code: string,
  message: string,
  httpStatus = 401,
): never {
  throw new ActorBoundaryError(code, message, httpStatus);
}
