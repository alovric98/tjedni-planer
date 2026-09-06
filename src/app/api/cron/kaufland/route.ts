import { NextRequest, NextResponse } from "next/server";
import { fetchKauflandProducts } from "@/lib/price-fetch/kaufland";
import { replaceStoreProducts, logFetch } from "@/lib/price-fetch/db";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const products = await fetchKauflandProducts();
    await replaceStoreProducts("kaufland", products);
    await logFetch("kaufland", "success", products.length);
    return NextResponse.json({ ok: true, count: products.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepoznata greška";
    await logFetch("kaufland", "error", null, message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
