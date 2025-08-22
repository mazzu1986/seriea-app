import { parseISO, isSameDay } from "date-fns";

/** ---- TIPI ---- */
export type Match = {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED, TIMED, FINISHED, POSTPONED...
  matchday: number | null;
  competition: { code: string };
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
    halfTime?: { home: number | null; away: number | null };
  };
};

export type FDResponse = { count: number; matches: Match[] };

export type Percentages = {
  homeWin: number; draw: number; awayWin: number;
  ou05: number; ou15: number; ou25: number; ou35: number;
  ou05_ht: number;               // Over 0.5 1° tempo
  bttsYes: number; bttsNo: number;
  mg1_4: number; mg2_4: number; mg2_5: number;
};

/** ---- UTILI ---- */
function goalsFT(m: Match) {
  const h = m.score.fullTime.home ?? 0;
  const a = m.score.fullTime.away ?? 0;
  return { h, a, t: h + a };
}
function goalsHT(m: Match) {
  const h = m.score.halfTime?.home ?? 0;
  const a = m.score.halfTime?.away ?? 0;
  return { h, a, t: h + a };
}

function lastN(
  matches: Match[],
  teamId: number,
  N: number,
  onlyHome = false,
  onlyAway = false,
  before?: Date
) {
  return matches
    .filter(m => {
      if (m.status !== "FINISHED") return false;
      if (before && parseISO(m.utcDate) >= before) return false;
      const isHome = m.homeTeam.id === teamId;
      const isAway = m.awayTeam.id === teamId;
      if (!isHome && !isAway) return false;
      if (onlyHome && !isHome) return false;
      if (onlyAway && !isAway) return false;
      return true;
    })
    .sort((a, b) => +new Date(b.utcDate) - +new Date(a.utcDate))
    .slice(0, N);
}

function pctFromLast5(homeLast5: Match[], awayLast5: Match[]): Percentages {
  const evts = [...homeLast5, ...awayLast5];
  const len = Math.max(1, evts.length);

  let homeWin = 0, draw = 0, awayWin = 0;
  let ou05 = 0, ou15 = 0, ou25 = 0, ou35 = 0, ou05_ht = 0;
  let btts = 0, mg1_4 = 0, mg2_4 = 0, mg2_5 = 0;

  for (const m of evts) {
    const { t, h, a } = goalsFT(m);
    const ht = goalsHT(m).t;

    if (m.score.winner === "HOME_TEAM") homeWin++;
    else if (m.score.winner === "AWAY_TEAM") awayWin++;
    else draw++;

    if (t > 0.5) ou05++;
    if (t > 1.5) ou15++;
    if (t > 2.5) ou25++;
    if (t > 3.5) ou35++;

    if (ht > 0.5) ou05_ht++;

    if (h > 0 && a > 0) btts++;

    if (t >= 1 && t <= 4) mg1_4++;
    if (t >= 2 && t <= 4) mg2_4++;
    if (t >= 2 && t <= 5) mg2_5++;
  }

  const p = (x: number) => Number(((x / len) || 0).toFixed(2));
  return {
    homeWin: p(homeWin),
    draw: p(draw),
    awayWin: p(awayWin),
    ou05: p(ou05),
    ou15: p(ou15),
    ou25: p(ou25),
    ou35: p(ou35),
    ou05_ht: p(ou05_ht),
    bttsYes: p(btts),
    bttsNo: p(len - btts),
    mg1_4: p(mg1_4),
    mg2_4: p(mg2_4),
    mg2_5: p(mg2_5),
  };
}

/** ---- Poisson per risultato esatto ---- */
function avg(arr: number[], fb: number) {
  const clean = arr.filter(n => Number.isFinite(n));
  if (clean.length === 0) return fb;
  return clean.reduce((s, n) => s + n, 0) / clean.length;
}
function poissonPmf(k: number, lambda: number) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return Math.exp(-lambda) * Math.pow(lambda, k) / fact;
}
function bestExactScore(homeLast5: Match[], awayLast5: Match[]) {
  // Dati scarsi → prior “neutro” basso (favorisce 0–0)
  if (homeLast5.length < 3 || awayLast5.length < 3) {
    const lambdaH = 0.8, lambdaA = 0.8;
    let best = { h: 0, a: 0, p: 0 };
    for (let h = 0; h <= 6; h++) {
      const ph = poissonPmf(h, lambdaH);
      for (let a = 0; a <= 6; a++) {
        const pa = poissonPmf(a, lambdaA);
        const p = ph * pa;
        if (p > best.p) best = { h, a, p };
      }
    }
    return best;
  }

  // Dati sufficienti → usa medie
  const h_scored = avg(homeLast5.map(m => m.score.fullTime.home ?? 0), 1.2);
  const h_conc   = avg(homeLast5.map(m => m.score.fullTime.away ?? 0), 1.0);
  const a_scored = avg(awayLast5.map(m => m.score.fullTime.away ?? 0), 1.0);
  const a_conc   = avg(awayLast5.map(m => m.score.fullTime.home ?? 0), 1.2);

  let lambdaH = 0.6 * h_scored + 0.4 * a_conc;
  let lambdaA = 0.6 * a_scored + 0.4 * h_conc;

  lambdaH = Math.max(0.2, Math.min(3.5, lambdaH));
  lambdaA = Math.max(0.2, Math.min(3.5, lambdaA));

  let best = { h: 0, a: 0, p: 0 };
  for (let h = 0; h <= 6; h++) {
    const ph = poissonPmf(h, lambdaH);
    for (let a = 0; a <= 6; a++) {
      const pa = poissonPmf(a, lambdaA);
      const p = ph * pa;
      if (p > best.p) best = { h, a, p };
    }
  }
  return best;
}

/** ---- OUTPUT PRINCIPALE ---- */
export function computePredictions(all: FDResponse, code: string = "SA") {
  const now = new Date();

  // filtra per campionato richiesto
  const matches = (all?.matches ?? []).filter(
    m => (m.competition?.code || "").toUpperCase() === code.toUpperCase()
  );

  // 1) partite di oggi
  const today = matches.filter(m => isSameDay(parseISO(m.utcDate), now));

  // 2) prossime partite (oggi/future)
  const upcoming = matches
    .filter(m =>
      (m.status === "SCHEDULED" || m.status === "TIMED" || m.status === "POSTPONED") &&
      parseISO(m.utcDate) >= new Date(now.getTime() - 5 * 60 * 1000)
    )
    .sort((a, b) => +new Date(a.utcDate) - +new Date(b.utcDate));

  // 3) unisci OGGI + PROSSIME fino a 10
  const seen = new Set<number>();
  const picked: Match[] = [];

  for (const m of today) {
    if (!seen.has(m.id)) { seen.add(m.id); picked.push(m); }
  }
  for (const m of upcoming) {
    if (picked.length >= 10) break;
    if (!seen.has(m.id)) { seen.add(m.id); picked.push(m); }
  }

  // 4) fallback se ancora vuoto
  if (picked.length === 0) {
    const sorted = [...matches]
      .sort((a, b) => +new Date(a.utcDate) - +new Date(b.utcDate))
      .slice(0, 10);
    for (const m of sorted) {
      if (!seen.has(m.id)) { seen.add(m.id); picked.push(m); }
    }
  }

  // 5) mappa in output
  return {
    date: now.toISOString(),
    games: picked.map(m => {
      const before = parseISO(m.utcDate);
      const homeLast5 = lastN(matches, m.homeTeam.id, 5, true,  false, before);
      const awayLast5 = lastN(matches, m.awayTeam.id, 5, false, true,  before);

      const perc = pctFromLast5(homeLast5, awayLast5);

      const triplet = [
        { key: "1", v: perc.homeWin },
        { key: "X", v: perc.draw },
        { key: "2", v: perc.awayWin },
      ].sort((a, b) => b.v - a.v);

      let pick = `Segno ${triplet[0].key}`;
      if (Math.max(perc.ou25, 1 - perc.ou25) > triplet[0].v) {
        pick = perc.ou25 >= 0.5 ? "Over 2.5" : "Under 2.5";
      }

      const best = bestExactScore(homeLast5, awayLast5);

      return {
        id: m.id,
        date: m.utcDate,
        home: m.homeTeam.name,
        away: m.awayTeam.name,
        perc,
        pick,
        bestScore: { h: best.h, a: best.a, p: Number(best.p.toFixed(3)) },
        last5: {
          home: homeLast5.map(x => (x.score.fullTime.home ?? 0) + (x.score.fullTime.away ?? 0)),
          away: awayLast5.map(x => (x.score.fullTime.home ?? 0) + (x.score.fullTime.away ?? 0)),
        },
      };
    }),
  };
}
