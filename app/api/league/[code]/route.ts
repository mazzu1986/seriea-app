import { NextResponse, type NextRequest } from "next/server";

const BASE = process.env.FD_BASE ?? "https://api.football-data.org/v4";
const TOKEN = process.env.FD_TOKEN!;
const SEASON = process.env.SEASON ?? "2025";

export const revalidate = 60;
export const dynamic = "force-dynamic";

type Ctx = { params?: { code?: string } };

export async function GET(_req: NextRequest, ctx: unknown) {
  const { params } = (ctx as Ctx) || {};
  const code = String(params?.code ?? "SA").toUpperCase();

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

  return new NextResponse(txt, {
    headers: { "content-type": "application/json" },
  });
}

