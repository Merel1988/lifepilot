import { requireAuth } from "@/lib/auth-guard";

interface BonusProduct {
  title: string;
  discount: string;
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    // Fetch AH bonus page segments via their public API
    const res = await fetch("https://www.ah.nl/bonus", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return Response.json({ products: [], error: "Kon AH bonus niet ophalen" });
    }

    const html = await res.text();
    const products: BonusProduct[] = [];

    // Parse product cards from the HTML
    // AH uses data attributes and specific class patterns for bonus items
    // Look for product title + discount patterns in the HTML
    const productRegex = /<[^>]*data-testhook="product-title"[^>]*>([^<]+)<\/[^>]*>/g;
    const discountRegex = /<[^>]*data-testhook="product-discount"[^>]*>([^<]+)<\/[^>]*>/g;

    const titles: string[] = [];
    const discounts: string[] = [];

    let match;
    while ((match = productRegex.exec(html)) !== null) {
      titles.push(match[1].trim());
    }
    while ((match = discountRegex.exec(html)) !== null) {
      discounts.push(match[1].trim());
    }

    // If data-testhook approach doesn't work, try a broader pattern
    if (titles.length === 0) {
      // Try to find JSON-LD or __NEXT_DATA__ with product info
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const props = nextData?.props?.pageProps;

          // Navigate the AH data structure to find bonus products
          const segments = props?.bonusSegments || props?.segments || [];
          for (const segment of segments) {
            const items = segment?.products || segment?.items || [];
            for (const item of items) {
              const title = item?.title || item?.product?.title || item?.name;
              const discount = item?.discount?.description || item?.shield?.text || item?.discountLabel || "";
              if (title) {
                products.push({ title, discount });
              }
            }
          }

          // Also check for a flat products array
          if (products.length === 0 && props?.products) {
            for (const item of props.products) {
              if (item.title) {
                products.push({
                  title: item.title,
                  discount: item.discount?.description || item.shield?.text || "",
                });
              }
            }
          }
        } catch {
          // JSON parse failed, continue with regex fallback
        }
      }
    } else {
      for (let i = 0; i < titles.length; i++) {
        products.push({
          title: titles[i],
          discount: discounts[i] || "",
        });
      }
    }

    // Fallback: extract any visible bonus text patterns
    if (products.length === 0) {
      // Look for common AH bonus text patterns like "2 voor 3.00" or "1+1 gratis"
      const bonusTextRegex = /(?:title|alt|aria-label)="([^"]*(?:korting|gratis|bonus|voor|stuks)[^"]*)"/gi;
      while ((match = bonusTextRegex.exec(html)) !== null) {
        const text = match[1].trim();
        if (text.length > 5 && text.length < 200) {
          products.push({ title: text, discount: "" });
        }
      }
    }

    return Response.json({
      products: products.slice(0, 50), // Cap at 50 items
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return Response.json({ products: [], error: "Kon AH bonus niet ophalen" });
  }
}
