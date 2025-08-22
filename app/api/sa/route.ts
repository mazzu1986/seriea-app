import { NextResponse } from "next/server";

const BASE = process.env.FD_BASE ?? "https://api.football-data.org/v4";
const TOKEN = process.env.FD_TOKEN!;
const SEASON = process.env.SEASON ?? "2025";

export const revalidate = 60;

export async function GET() {
  if (!TOKEN) return NextResponse.json({ error: "Missing token" }, { status: 500 });
  const url = `${BASE}/competitions/SA/matches?season=${SEASON}`;
  const res = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });
  const text = await res.text();
  if (!res.ok) return new NextResponse(text, { status: res.status });
  return new NextResponse(text, { headers: { "content-type": "application/json" } });
}
