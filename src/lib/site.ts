export const SITE_URL = (
  process.env.NEXTAUTH_URL?.startsWith("https://")
    ? process.env.NEXTAUTH_URL
    : "https://riaya.ca"
).replace(/\/$/, "");

export const SITE_NAME = "Ri'aya Babysitters";
export const SITE_TAGLINE = "Vetted babysitters, booked with peace of mind";
export const SITE_DESCRIPTION =
  "Every Ri'aya babysitter is interviewed by our team and holds a current vulnerable-sector check. See real availability and book directly.";
export const OG_IMAGE_PATH = "/brand/og-image.png";

// Public, indexable routes. Everything under /admin, /parent, /sitter,
// /bookings and /api is account-specific and stays out of search.
export const PUBLIC_PATHS = ["/", "/team", "/policies", "/signup", "/login", "/newsletter"];
