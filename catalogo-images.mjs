export function productImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "cdn.sanity.io" || !url.pathname.startsWith("/images/") || !/\.(png|jpe?g|webp|avif|tiff?|pjpg)$/i.test(url.pathname)) return value;
    // Up to 2x the 240px photo area; fit=max preserves the entire image and avoids upscaling.
    url.searchParams.set("w", "1200");
    url.searchParams.set("h", "480");
    url.searchParams.set("fit", "max");
    url.searchParams.set("auto", "format");
    url.searchParams.set("q", "85");
    return url.href;
  } catch { return value; }
}
