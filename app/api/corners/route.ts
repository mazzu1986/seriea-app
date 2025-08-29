/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";

const HOST = process.env.RAPIDAPI_HOST || "api-football-v1.p.rapidapi.com";
const KEY = process.env.RAPIDAPI_KEY!;
const SEASON = process.env.SEASON || "2025";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// mappa codici Football-Data -> leagueId API-Football
const LEAGUE_MAP: Record<string, number> = {
  SA: 135,   // Serie A
  PL: 39,    // Premier League
  ELC: 40,   // Championship
  FL1: 61,   // Ligue 1
  PD: 140,   // La Liga
  SD: 141,   // La Liga 2
  BL1: 78,   // Bundesliga
  DED: 88,   // Eredivisie
  BJL: 144,  // Belgium Pro League
  PPL: 94,   // Portugal Primeira
  TSL: 203,  // Turkey Super Lig
};

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function looksLike(a: string, b: string) {
  const A = norm(a), B = norm(b);
  return A === B || A.includes(B) || B.includes(A);
}

export async function GET(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: "Missing RAPIDAPI_KEY" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const code = String(searchParams.get("code") || "SA").toUpperCase();
  const dateISO = String(searchParams.get("date") || "").slice(0, 10); // YYYY-MM-DD
  const home = String(searchParams.get("home") || "");
  const away = String(searchParams.get("away") || "");

  const leagueId = LEAGUE_MAP[code];
  if (!leagueId) return NextResponse.json({ error: "Unsupported league code" }, { status: 400 });
  if (!dateISO || !home || !away) return NextResponse.json({ error: "Missing params: date, home, away" }, { status: 400 });

  // 1) trova fixture del giorno in quella lega
  const fxRes = await fetch(`https://${HOST}/v3/fixtures?league=${leagueId}&season=${SEASON}&date=${dateISO}`, {
    headers: {
      "X-RapidAPI-Key": KEY,
      "X-RapidAPI-Host": HOST,
    },
    cache: "no-store",
  });
  if (!fxRes.ok) {
    const txt = await fxRes.text();
    return new NextResponse(txt, { status: fxRes.status });
  }
  const fxJson: any = await fxRes.json();
  const fixtures: any[] = fxJson.response || [];

  // 2) match by team names (fuzzy)
  const cand = fixtures.find(f =>
    looksLike(f.teams?.home?.name || "", home) &&
    looksLike(f.teams?.away?.name || "", away)
  ) || fixtures.find(f =>
    looksLike(f.teams?.home?.name || "", home) ||
    looksLike(f.teams?.away?.name || "", away)
  );

  if (!cand) {
    return NextResponse.json({ found: false, corners: null, note: "fixture not found" }, { status: 200 });
  }

  const fixtureId = cand.fixture?.id;
  if (!fixtureId) {
    return NextResponse.json({ found: false, corners: null, note: "no fixture id" }, { status: 200 });
  }

  // 3) statistics (contiene 'Corner Kicks')
  const stRes = await fetch(`https://${HOST}/v3/fixtures/statistics?fixture=${fixtureId}`, {
    headers: {
      "X-RapidAPI-Key": KEY,
      "X-RapidAPI-Host": HOST,
    },
    cache: "no-store",
  });
  if (!stRes.ok) {
    const txt = await stRes.text();
    return new NextResponse(txt, { status: stRes.status });
  }
  const stJson: any = await stRes.json();
  const stats: any[] = stJson.response || [];

  // API ritorna 2 blocchi: [0]=home, [1]=away
  function getCorners(block: any): number | null {
    const arr = block?.statistics || [];
    const row = arr.find((x: any) => norm(x?.type || "") === "corner kicks");
    return typeof row?.value === "number" ? row.value : null;
  }

  const homeBlock = stats.find(s => s.team?.id === cand.teams?.home?.id) || stats[0];
  const awayBlock = stats.find(s => s.team?.id === cand.teams?.away?.id) || stats[1];

  const homeCorners = homeBlock ? getCorners(homeBlock) : null;
  const awayCorners = awayBlock ? getCorners(awayBlock) : null;

  return NextResponse.json({
    found: true,
    fixtureId,
    match: {
      date: cand.fixture?.date,
      home: cand.teams?.home?.name,
      away: cand.teams?.away?.name,
      status: cand.fixture?.status?.short,
    },
    corners: { home: homeCorners, away: awayCorners },
  });
}
