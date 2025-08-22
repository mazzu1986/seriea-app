import { NextResponse } from "next/server";
import { computePredictions, FDResponse } from "../../../../lib/compute";

const BASE = process.env.FD_BASE ?? "https://api.football-data.org/v4";
const TOKEN = process.env.FD_TOKEN!;
const SEASON = process.env.SEASON ?? "2025";

export const revalidate = 60;

export async function GET(_req: Request, ctx: { params: { code: string } }) {
  const code = (ctx.params.code || "SA").toUpperCase();
  if (!TOKEN) return NextResponse.json({ error: "Missing token" }, { status: 500 });

  const url = `${BASE}/competitions/${code}/matches?season=${SEASON}`;
  const res = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });
  const txt = await res.text();
  if (!res.ok) return new NextResponse(txt, { status: res.status, headers: { "content-type": "application/json" } });

  const data = JSON.parse(txt) as FDResponse;
  // computePredictions già funziona per qualsiasi lega
  const out = computePredictions(data, code); // passiamo il code
  return NextResponse.json(out);
}
