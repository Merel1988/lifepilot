import { requireAuth } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

interface AHProduct {
  title: string;
  bonusMechanism: string | null;
  currentPrice: number | null;
  priceBeforeBonus: number | null;
  promotionType: string | null;
  mainCategory: string | null;
}

interface AHSearchResponse {
  products: AHProduct[];
  page: { totalPages: number };
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    // Step 1: Get anonymous auth token
    const tokenRes = await fetch("https://api.ah.nl/mobile-auth/v1/auth/token/anonymous", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Appie/8.22.3",
      },
      body: JSON.stringify({ clientId: "appie" }),
    });

    if (!tokenRes.ok) {
      return Response.json({ products: [], error: "Kon niet inloggen bij AH API" });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return Response.json({ products: [], error: "Geen access token ontvangen" });
    }

    // Step 2: Fetch bonus products (page 0, up to 1000)
    const products: { title: string; discount: string; category: string }[] = [];

    // Fetch first 2 pages (up to 2000 products, usually enough for weekly national deals)
    for (let page = 0; page < 2; page++) {
      const searchRes = await fetch(
        `https://api.ah.nl/mobile-services/product/search/v2?filters=bonus%3Dtrue&size=1000&page=${page}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "User-Agent": "Appie/8.22.3",
            "x-application": "AHWEBSHOP",
          },
        }
      );

      if (!searchRes.ok) break;

      const data: AHSearchResponse = await searchRes.json();

      for (const product of data.products) {
        // Only include weekly national bonus deals, not permanent online deals
        if (product.promotionType !== "NATIONAL") continue;

        const discount = product.bonusMechanism || "";
        const priceInfo = product.currentPrice
          ? `€${product.currentPrice.toFixed(2)}`
          : "";
        const wasPrice = product.priceBeforeBonus
          ? ` (was €${product.priceBeforeBonus.toFixed(2)})`
          : "";

        products.push({
          title: product.title,
          discount: [discount, priceInfo, wasPrice].filter(Boolean).join(" ").trim(),
          category: product.mainCategory || "",
        });
      }

      // Stop if we've fetched all pages
      if (page >= data.page.totalPages - 1) break;
    }

    return Response.json({
      products,
      count: products.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return Response.json({ products: [], error: "Kon AH bonus niet ophalen" });
  }
}
