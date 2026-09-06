import { NextRequest, NextResponse } from "next/server";
import { fetchLidlProducts } from "@/lib/price-fetch/lidl";
import { replaceStoreProducts, logFetch } from "@/lib/price-fetch/db";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const products = await fetchLidlProducts();
    await replaceStoreProducts("lidl", products);
    await logFetch("lidl", "success", products.length);
    return NextResponse.json({ ok: true, count: products.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nepoznata greška";
    await logFetch("lidl", "error", null, message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
