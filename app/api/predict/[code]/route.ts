import { NextResponse, type NextRequest } from "next/server";
import { computePredictions, type FDResponse } from "../../../../lib/compute";

const BASE = process.env.FD_BASE ?? "https://api.football-data.org/v4";
const TOKEN = process.env.FD_TOKEN!;
const SEASON = process.env.SEASON ?? "2025";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: any) {
  const code = String(ctx?.params?.code || "SA").toUpperCase();
  if (!TOKEN) return NextResponse.json({ error: "Missing token" }, { status: 500 });

  const url = `${BASE}/competitions/${code}/matches?season=${SEASON}`;
  const res = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });
  const txt = await res.text();

  if (!res.ok) {
    return new NextResponse(txt, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  }

  const data = JSON.parse(txt) as FDResponse;
  const out = computePredictions(data, code);
  return NextResponse.json(out);
}
