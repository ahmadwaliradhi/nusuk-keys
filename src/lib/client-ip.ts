/**
 * The client's address as set by the reverse proxy. Caddy overwrites X-Forwarded-For with
 * the real peer address, so the first entry is trustworthy. Switching to the Cloudflare
 * proxy later means reading `cf-connecting-ip` here instead.
 */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || "unknown";
}
