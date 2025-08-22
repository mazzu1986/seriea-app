"use client";
import { useEffect, useState } from "react";

/** --- TENDINA CAMPIONATI --- */
const LEAGUES = [
  { code: "SA",  name: "Serie A" },
  { code: "PL",  name: "Premier League" },
  { code: "ELC", name: "Championship" },
  { code: "FL1", name: "Ligue 1" },
  { code: "PD",  name: "La Liga" },
  { code: "SD",  name: "La Liga 2" },
  { code: "BL1", name: "Bundesliga" },
  { code: "DED", name: "Eredivisie (Olanda 1)" },
  { code: "PPL", name: "Primeira Liga (Portogallo 1)" },
];

type Resp = {
  date: string;
  games: Array<{
    id: number;
    date: string;
    home: string;
    away: string;
    perc: {
      homeWin: number; draw: number; awayWin: number;
      ou05: number; ou15: number; ou25: number; ou35: number;
      ou05_ht: number;
      bttsYes: number; bttsNo: number;
      mg1_4: number; mg2_4: number; mg2_5: number;
    };
    pick: string;
    bestScore: { h: number; a: number; p: number };
    last5: { home: number[]; away: number[] };
  }>;
};

function pc(x:number){ return Math.round((x || 0) * 100); }

function Bar({ v }: { v: number }) {
  const w = Math.max(0, Math.min(100, pc(v)));
  return <div className="bar"><i style={{ width: `${w}%` }} /></div>;
}

function colorClass(v:number){
  const p = pc(v);
  if (p >= 70) return "val green";
  if (p >= 40) return "val yellow";
  return "val red";
}

export default function Page() {
  const [league, setLeague] = useState<string>("SA");
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    setData(null);
    fetch(`/api/predict/${league}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [league]);

  return (
    <main className="main">
      <h1 className="h1">Predizioni</h1>

      {/* Selettore lega */}
      <div style={{margin:"0 0 12px 0"}}>
        <label style={{fontSize:12,opacity:.7,marginRight:8}}>Campionato</label>
        <select
          value={league}
          onChange={e=>setLeague(e.target.value)}
          style={{padding:"6px 10px", borderRadius:8, border:"1px solid #e7e8ef"}}
        >
          {LEAGUES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </div>

      {loading && <div>Carico…</div>}
      {err && <div className="sub" style={{color:"#dc2626"}}>Errore: {err}</div>}
      {!loading && !err && (!data || data.games.length === 0) && <div>Nessuna partita trovata.</div>}

      {!loading && !err && data && (
        <div className="grid">
          {data.games.map(g => (
            <div key={g.id} className="card">
              <div className="row">
                <div className="title">{g.home} — {g.away}</div>
                <div className="time">{new Date(g.date).toLocaleString()}</div>
              </div>

              <div className="section" style={{gridTemplateColumns:"repeat(2,1fr)"}}>
                {/* COLONNA 1 — 1X2 + 1° TEMPO */}
                <div className="box">
                  <div className="k">1X2</div>
                  <div className="kv"><span>1</span><span className={colorClass(g.perc.homeWin)}>{pc(g.perc.homeWin)}%</span></div>
                  <Bar v={g.perc.homeWin}/>
                  <div className="kv"><span>X</span><span className={colorClass(g.perc.draw)}>{pc(g.perc.draw)}%</span></div>
                  <Bar v={g.perc.draw}/>
                  <div className="kv"><span>2</span><span className={colorClass(g.perc.awayWin)}>{pc(g.perc.awayWin)}%</span></div>
                  <Bar v={g.perc.awayWin}/>

                  <div className="k" style={{marginTop:10}}>1° Tempo</div>
                  <div className="kv"><span>Over 0.5</span><span className={colorClass(g.perc.ou05_ht)}>{pc(g.perc.ou05_ht)}%</span></div>
                  <Bar v={g.perc.ou05_ht}/>
                </div>

                {/* COLONNA 2 — U/O + GOL/NOGOL */}
                <div className="box">
                  <div className="k">Under/Over</div>

                  {/* U/O 1.5 */}
                  <div className="kv"><span>Over 1.5</span><span className={colorClass(g.perc.ou15)}>{pc(g.perc.ou15)}%</span></div>
                  <Bar v={g.perc.ou15}/>
                  <div className="kv"><span>Under 1.5</span><span className={colorClass(1 - g.perc.ou15)}>{pc(1 - g.perc.ou15)}%</span></div>
                  <Bar v={1 - g.perc.ou15}/>

                  {/* U/O 2.5 */}
                  <div className="kv" style={{marginTop:8}}><span>Over 2.5</span><span className={colorClass(g.perc.ou25)}>{pc(g.perc.ou25)}%</span></div>
                  <Bar v={g.perc.ou25}/>
                  <div className="kv"><span>Under 2.5</span><span className={colorClass(1 - g.perc.ou25)}>{pc(1 - g.perc.ou25)}%</span></div>
                  <Bar v={1 - g.perc.ou25}/>

                  {/* U/O 3.5 */}
                  <div className="kv" style={{marginTop:8}}><span>Over 3.5</span><span className={colorClass(g.perc.ou35)}>{pc(g.perc.ou35)}%</span></div>
                  <Bar v={g.perc.ou35}/>
                  <div className="kv"><span>Under 3.5</span><span className={colorClass(1 - g.perc.ou35)}>{pc(1 - g.perc.ou35)}%</span></div>
                  <Bar v={1 - g.perc.ou35}/>

                  {/* GOL / NOGOL */}
                  <div className="k" style={{marginTop:10}}>GOL / NOGOL</div>
                  <div className="kv"><span>GOL</span><span className={colorClass(g.perc.bttsYes)}>{pc(g.perc.bttsYes)}%</span></div>
                  <Bar v={g.perc.bttsYes}/>
                  <div className="kv"><span>NOGOL</span><span className={colorClass(g.perc.bttsNo)}>{pc(g.perc.bttsNo)}%</span></div>
                  <Bar v={g.perc.bttsNo}/>
                </div>
              </div>

              <div className="pill">Suggerimento: {g.pick}</div>

              <div className="sub">
                Risultato esatto più probabile: <b>{g.bestScore.h}–{g.bestScore.a}</b> ({pc(g.bestScore.p)}%)
              </div>

              <div className="sub" style={{marginTop:6}}>
                Ultime 5 (tot gol): casa [
                {g.last5.home?.length ? g.last5.home.join(", ") : "—"}
                ]{" · "}trasferta [
                {g.last5.away?.length ? g.last5.away.join(", ") : "—"}
                ]
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

