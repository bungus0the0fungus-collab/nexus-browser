"use strict";

/**
 * Resolve an address or search query using the configured search template.
 * Bare domain names default to HTTPS; search terms go to Google by default.
 *
 * @param {string} input
 * @param {string} template
 * @returns {string}
 */
function search(input, template) {
  const value = String(input || "").trim();
  if (!value) return "";

  // Already a fully qualified URL.
  try {
    return new URL(value).toString();
  } catch {
    // Continue and check whether this is a bare hostname.
  }

  // Treat localhost as HTTP for local development.
  if (/^localhost(?::\d+)?(?:[/?#].*)?$/i.test(value)) {
    return new URL("http://" + value).toString();
  }

  // Bare hostnames and IP addresses use HTTPS by default.
  try {
    const url = new URL("https://" + value);
    if (url.hostname.includes(".") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)) {
      return url.toString();
    }
  } catch {
    // Not a hostname; treat this as a search.
  }

  return template.replace("%s", encodeURIComponent(value));
}
