/**
 * A 303 See Other carrying a **relative** Location.
 *
 * ## Why this exists rather than `NextResponse.redirect(new URL(p, request.url))`
 *
 * That idiom is what the Next docs show, and it is wrong in this container.
 * The standalone server is started with `HOSTNAME=0.0.0.0` — it has to be, or
 * it would bind to loopback inside the container and nginx could never reach
 * it — and Next builds `request.url` from the address it bound to, **not** from
 * the incoming `Host` header. So `new URL("/app", request.url)` resolves to
 * `http://0.0.0.0:3000/app`, and that absolute URL is what gets sent to the
 * browser. The visitor's next hop goes nowhere.
 *
 * It is invisible in `next dev`, where the bind address really is the host you
 * typed. It only appears in the container, which is why it survived until the
 * seed made these routes reachable at all.
 *
 * A relative Location sidesteps the question entirely: the browser resolves it
 * against the URL it actually requested, so the scheme, host and port are
 * correct by construction — in dev, in staging behind basic auth, and in
 * production behind TLS. RFC 7231 §7.1.2 permits relative references, and has
 * since 2014; every browser has handled them for far longer.
 *
 * `NextResponse.redirect()` cannot be used, because it parses its argument as
 * an absolute URL and throws on a bare path. Setting the header directly is the
 * whole of the workaround.
 *
 * 303 rather than 302: after a POST, 303 tells the browser to follow with GET.
 * 302's behaviour here is historically ambiguous and some clients re-POST.
 */
export function seeOther(path: `/${string}`): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}
