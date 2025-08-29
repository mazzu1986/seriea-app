/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";

const HOST = process.env.RAPIDAPI_HOST || "api-football-v1.p.rapidapi.com";
const KEY = process.env.RAPIDAPI_KEY!;
const SEASON = process.env.SEASON || "2025";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Football-Data code -> API-Football league id
const LEAGUE_MAP: Record<string, number> = {
  SA: 135,  // Serie A
  PL: 39,   // Premier League
  ELC: 40,  // Championship
  FL1: 61,  // Ligue 1
  PD: 140,  // La Liga
  SD: 141,  // La Liga 2
  BL1: 78,  // Bundesliga
  DED: 88,  // Eredivisie
  BJL: 144, // Belgium Pro League
  PPL: 94,  // Portugal Primeira
  TSL: 203, // Turkey Super Lig
};

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function looksLike(a: string, b: string) {
  const A = norm(a), B = norm(b);
  return A === B || A.includes(B) || B.includes(A);
}

async function api(path: string) {
  const url = `https://${HOST}${path}`;
  const res = await fetch(url, {
    headers: { "X-RapidAPI-Key": KEY, "X-RapidAPI-Host": HOST },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
  return res.json();
}

async function findTeamId(leagueId: number, name: string) {
  const j = await api(`/v3/teams?league=${leagueId}&season=${SEASON}&search=${encodeURIComponent(name)}`);
  const list: any[] = j?.response || [];
  // miglior match
  let best = list.find(t => looksLike(t.team?.name || "", name));
  if (!best && list.length) best = list[0];
  return best?.team?.id as number | undefined;
}

async function avgCornersForTeam(
  leagueId: number,
  teamId: number,
  side: "home" | "away",
  takeLast = 8
) {
  // ultimi match del team in quella lega/stagione
  const fixturesJ = await api(`/v3/fixtures?league=${leagueId}&season=${SEASON}&team=${teamId}&last=${Math.max(takeLast, 10)}`);
  const fixtures: any[] = fixturesJ?.response || [];

  // filtra solo home/away
  const filtered = fixtures.filter(f => {
    const isHome = f.teams?.home?.id === teamId;
    const isAway = f.teams?.away?.id === teamId;
    return side === "home" ? isHome : isAway;
  }).slice(0, takeLast);

  let sum = 0;
  let n = 0;

  for (const f of filtered) {
    const fixtureId = f.fixture?.id;
    if (!fixtureId) continue;

    try {
      const statsJ = await api(`/v3/fixtures/statistics?fixture=${fixtureId}`);
      const stats: any[] = statsJ?.response || [];
      const block = stats.find(s => s.team?.id === teamId) || null;
      const arr = block?.statistics || [];
      const row = arr.find((x: any) => norm(x?.type || "") === "corner kicks");
      const val = typeof row?.value === "number" ? row.value : null;
      if (val !== null) { sum += val; n++; }
    } catch {
      // salta eventuali errori singoli
    }
  }

  const avg = n > 0 ? Number((sum / n).toFixed(2)) : null;
  return { avg, n };
}

type Ctx = { params?: Record<string, string> };

export async function GET(req: NextRequest, _ctx: Ctx) {
  try {
    if (!KEY) return NextResponse.json({ error: "Missing RAPIDAPI_KEY" }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") || "SA").toUpperCase();
    const home = String(searchParams.get("home") || "");
    const away = String(searchParams.get("away") || "");
    const takeLast = Number(searchParams.get("takeLast") || 8);

    const leagueId = LEAGUE_MAP[code];
    if (!leagueId) return NextResponse.json({ error: "Unsupported league code" }, { status: 400 });
    if (!home || !away) return NextResponse.json({ error: "Missing params: home, away" }, { status: 400 });

    const homeId = await findTeamId(leagueId, home);
    const awayId = await findTeamId(leagueId, away);
    if (!homeId || !awayId) {
      return NextResponse.json({ found: false, note: "team id not found", data: null });
    }

    const [homeRes, awayRes] = await Promise.all([
      avgCornersForTeam(leagueId, homeId, "home", takeLast),
      avgCornersForTeam(leagueId, awayId, "away", takeLast),
    ]);

    return NextResponse.json({
      found: true,
      leagueId,
      season: SEASON,
      teams: { home: { id: homeId }, away: { id: awayId } },
      averages: {
        homeCornersHomeAvg: homeRes.avg,
        homeSamples: homeRes.n,
        awayCornersAwayAvg: awayRes.avg,
        awaySamples: awayRes.n,
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
