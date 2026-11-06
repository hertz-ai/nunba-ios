/**
 * Read a fetch Response body as JSON when it may not be JSON.
 *
 * A server answers some calls with something other than JSON: an HTML 404
 * page for a route it does not serve, an empty 204, a proxy's error page.
 * `response.json()` throws a SyntaxError on those, and a caller that only
 * wanted "the body, or nothing" had to carry its own try/catch.  socialApi
 * carried one as a private `_safeJson`; deviceApi needed the same guard
 * (2026-10-14), so the one copy lives here.
 *
 * @param {Response} response
 * @returns {Promise<any|null>} the parsed body, or null when it is not JSON
 */
export const safeJson = async (response) => {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
};

export default { safeJson };
