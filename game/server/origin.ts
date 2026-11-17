/**
 * True when a page at `origin` may use the game server.
 * `allowed` is a comma-separated list of origins, such as "https://www.example.com".
 * A star in an entry stands for one part of a host name: letters, digits, and hyphens, but no dot.
 * A page on the developer's own computer (localhost or 127.0.0.1, any port) is always allowed.
 */
export function originAllowed(origin: string | null, allowed: string): origin is string {
  if (!origin) return false;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return allowed.split(",").some((entry) => {
    const pattern = entry.trim().split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[a-z0-9-]*");
    return pattern !== "" && new RegExp(`^${pattern}$`).test(origin);
  });
}
