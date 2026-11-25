/**
 * Refuses a NUL character (U+0000) in the text of a signed-in request.
 *
 * PostgreSQL text cannot hold one and rejects the whole statement, so a NUL in
 * any value that reaches a query used to surface as a 500. No field in this
 * app has a use for one, so the request is answered 400 before route code runs.
 *
 * Covered here: the path (route ids), the query, and the fields and file names
 * of form posts. Not covered: the content of an uploaded file, which its
 * importer checks, and JSON bodies, which each JSON endpoint validates.
 */

const NUL = "\u0000";
/** A NUL can only arrive in a URL percent-encoded; `%2500` is a literal "%00". */
const ENCODED_NUL = "%00";

function badRequest(): Response {
  return new Response("Bad Request: the request contains a NUL character", {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function isFormPost(request: Request): boolean {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  return (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
}

async function formHasNul(request: Request): Promise<boolean> {
  let form: FormData;
  try {
    form = await request.clone().formData();
  } catch {
    // Not a readable form: the route's own read reports that.
    return false;
  }
  for (const [name, value] of form.entries()) {
    if (name.includes(NUL)) return true;
    if ((typeof value === "string" ? value : value.name).includes(NUL)) return true;
  }
  return false;
}

/**
 * Throws a 400 Response when the request's path, query or form carries a NUL.
 * The form is read from a clone, so the route can still read the request.
 *
 * Call it after the body size has been bounded (`denyConflictingClientShop`
 * does that for tenant requests): parsing the form reads the whole body.
 */
export async function rejectNulInput(request: Request): Promise<void> {
  const url = new URL(request.url);
  if (url.pathname.includes(ENCODED_NUL) || url.search.includes(ENCODED_NUL)) {
    throw badRequest();
  }
  if (isFormPost(request) && (await formHasNul(request))) {
    throw badRequest();
  }
}
