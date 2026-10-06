import React, { useEffect, useMemo, useRef, useState } from "react";
 
export default function PingpongScorekeeper() {
  type PlayerKey = "A" | "B";
 
  type MatchState = {
    players: { A: string; B: string };
    bestOf: number;
    pointsToWin?: number;
    setsToWin: number;
    currentSet: number;
    setScores: Array<{
      A: number;
      B: number;
      winner?: PlayerKey;
    }>;
    matchWins: { A: number; B: number };
    matchWinner?: PlayerKey;
    initialServerThisSet: PlayerKey;
    started: boolean;
    createdAt: number;
    lastPointAt?: number;
  };
 
  const STORAGE_KEY = "pp_scorekeeper_v1";
 
  // Instellingen
  const [players, setPlayers] = useState({
    A: "Kevin",
    B: "Wesley",
  });
 
  const [bestOf, setBestOf] = useState<3 | 5 | 7 | 9>(3);
  const [winMode, setWinMode] =
    useState<"bestOf" | "firstTo">("bestOf");
  const [firstTo, setFirstTo] = useState<number>(3);
 
  const [pointsToWin, setPointsToWin] = useState(11);
  const [roster, setRoster] = useState<string[]>(["Kevin", "Wesley"]);
  const [newPlayer, setNewPlayer] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  type SavedMatch = MatchState & { endedAt: number; result: "completed" | "stopped" };
  const [matches, setMatches] = useState<SavedMatch[]>([]);
  const [matchesOpen, setMatchesOpen] = useState(false);
  const [landscapeView, setLandscapeView] = useState(true);
  const [view, setView] = useState({width: window.innerWidth, height: window.innerHeight});
  useEffect(() => { const update = () => setView({width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight}); update(); window.addEventListener("resize",update); window.visualViewport?.addEventListener("resize",update); return () => {window.removeEventListener("resize",update);window.visualViewport?.removeEventListener("resize",update);}; }, []);
  const rotated = landscapeView && view.height > view.width;
  function rememberMatch(match: MatchState, result: "completed" | "stopped") { if (!match.setScores.some(s => s.A || s.B)) return; setMatches(current => [{...takeSnapshot(match), endedAt: match.lastPointAt ?? Date.now(), result}, ...current.filter(m => m.createdAt !== match.createdAt)]); }

  function addPlayer() { const name = newPlayer.trim(); if (!name) return; setRoster(r => r.includes(name) ? r : [...r, name]); setNewPlayer(""); }

  // Match
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<MatchState | null>(null);
  const [history, setHistory] = useState<MatchState[]>([]);
 
  useEffect(() => { if (loaded && state?.matchWinner) rememberMatch(state,"completed"); }, [loaded, state]);
  // Press-and-hold
  const holdTimeoutRef = useRef<number | null>(null);
  const holdStartRef = useRef<number>(0);
  const holdDeltaRef = useRef<number>(0);
  const holdActiveRef = useRef(false);
 
  function clearHold() {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
 
    holdActiveRef.current = false;
    holdDeltaRef.current = 0;
  }
 
  function stepFirstTo(delta: number) {
    setFirstTo((current) =>
      Math.max(1, Math.min(20, current + delta))
    );
  }
 
  function getHoldDelay(elapsed: number) {
    if (elapsed > 1500) return 60;
    if (elapsed > 700) return 110;
    return 220;
  }
 
  function scheduleHoldTick() {
    if (!holdActiveRef.current) return;
 
    const elapsed = Date.now() - holdStartRef.current;
    const delay = getHoldDelay(elapsed);
 
    holdTimeoutRef.current = window.setTimeout(() => {
      if (!holdActiveRef.current) return;
 
      stepFirstTo(holdDeltaRef.current);
      scheduleHoldTick();
    }, delay);
  }
 
  function startHold(delta: number) {
    clearHold();
 
    // Direct 1 stap bij indrukken
    stepFirstTo(delta);
 
    holdActiveRef.current = true;
    holdStartRef.current = Date.now();
    holdDeltaRef.current = delta;
 
    // Daarna automatisch tellen
    holdTimeoutRef.current = window.setTimeout(() => {
      scheduleHoldTick();
    }, 260);
  }
 
  useEffect(() => {
    return () => clearHold();
  }, []);
 
  // Hoeveel sets zijn nodig?
  const setsToWin = useMemo(() => {
    if (winMode === "firstTo") {
      return firstTo;
    }
 
    return Math.ceil(bestOf / 2);
  }, [bestOf, winMode, firstTo]);
 
  // Maximaal aantal sets
  const effectiveBestOf = useMemo(() => {
    if (winMode === "firstTo") {
      return firstTo * 2 - 1;
    }
 
    return bestOf;
  }, [bestOf, winMode, firstTo]);
 
  function newEmptySet() {
    return {
      A: 0,
      B: 0,
    };
  }
 
  function randomServer(): PlayerKey {
    return Math.random() < 0.5 ? "A" : "B";
  }
 
  function other(player: PlayerKey): PlayerKey {
    return player === "A" ? "B" : "A";
  }
 
  function takeSnapshot(match: MatchState): MatchState {
    return JSON.parse(JSON.stringify(match));
  }
 
  function getSetWinner(
    pointsA: number,
    pointsB: number
  ): PlayerKey | undefined {
    if (
      (pointsA >= (state?.pointsToWin ?? 11) || pointsB >= (state?.pointsToWin ?? 11)) &&
      Math.abs(pointsA - pointsB) >= 2
    ) {
      return pointsA > pointsB ? "A" : "B";
    }
 
    return undefined;
  }
 
  function currentServer(match: MatchState): PlayerKey {
    const set = match.setScores[match.currentSet - 1];
 
    const totalPoints = set.A + set.B;
    const target = (match.pointsToWin ?? 11) - 1;
    const deuce = set.A >= target && set.B >= target;
 
    // Vanaf 10-10 wisselt service ieder punt
    if (deuce) {
      return totalPoints % 2 === 0
        ? match.initialServerThisSet
        : other(match.initialServerThisSet);
    }
 
    // Normaal iedere 2 punten
    const blocks = Math.floor(totalPoints / 2);
 
    return blocks % 2 === 0
      ? match.initialServerThisSet
      : other(match.initialServerThisSet);
  }
 
  // LocalStorage
 
  function safeParse<T>(value: string | null): T | null {
    if (!value) return null;
 
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
 
  useEffect(() => {
    const saved = safeParse<{
      state: MatchState | null;
      history: MatchState[];
      players: { A: string; B: string };
      bestOf: 3 | 5 | 7 | 9;
      winMode?: "bestOf" | "firstTo";
      firstTo?: number;
      started: boolean;
      pointsToWin?: number;
      roster?: string[];
      matches?: SavedMatch[];
      landscapeView?: boolean;
    }>(
      typeof window !== "undefined"
        ? (() => { try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; } })()
        : null
    );
 
    setLoaded(true);
    if (!saved) return;
 
    if (Array.isArray(saved.matches)) setMatches(saved.matches);
    if (typeof saved.landscapeView === "boolean") setLandscapeView(saved.landscapeView);
    if (saved.players) {
      setPlayers({ A: saved.players.A === "Speler A" ? "Kevin" : saved.players.A, B: saved.players.B === "Speler B" ? "Wesley" : saved.players.B });
    }
 
    if (saved.pointsToWin === 11 || saved.pointsToWin === 20) setPointsToWin(saved.pointsToWin);
    if (Array.isArray(saved.roster)) setRoster(Array.from(new Set(["Kevin", "Wesley", ...saved.roster])));
    if (saved.bestOf) {
      setBestOf(saved.bestOf);
    }
 
    if (saved.winMode) {
      setWinMode(saved.winMode);
    }
 
    if (typeof saved.firstTo === "number") {
      setFirstTo(saved.firstTo);
    }
 
    if (typeof saved.started === "boolean") {
      setStarted(saved.started);
    }
 
    if (saved.state) {
      setState({ ...saved.state, players: { A: saved.state.players.A === "Speler A" ? "Kevin" : saved.state.players.A, B: saved.state.players.B === "Speler B" ? "Wesley" : saved.state.players.B } });
    }
 
    if (Array.isArray(saved.history)) {
      setHistory(saved.history.map(m => ({ ...m, players: { A: m.players.A === "Speler A" ? "Kevin" : m.players.A, B: m.players.B === "Speler B" ? "Wesley" : m.players.B } })));
    }
  }, []);
 
  useEffect(() => {
    if (typeof window === "undefined" || !loaded) return;
 
    try { window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state,
        history,
        players,
        bestOf,
        winMode,
        firstTo,
        started,
        pointsToWin,
        roster,
        matches,
        landscapeView,
      })
    );
    } catch { setStorageError(true); }
  }, [
    loaded,
    matches,
    landscapeView,
    pointsToWin,
    roster,
    state,
    history,
    players,
    bestOf,
    winMode,
    firstTo,
    started,
  ]);
 
  function startMatch(randomize = true) {
    if (state) rememberMatch(state, state.matchWinner ? "completed" : "stopped");
    const initialServer = randomize
      ? randomServer()
      : "A";
 
    const newMatch: MatchState = {
      players: { ...players },
      bestOf: effectiveBestOf,
      pointsToWin,
      setsToWin,
      currentSet: 1,
      setScores: [newEmptySet()],
      matchWins: {
        A: 0,
        B: 0,
      },
      initialServerThisSet: initialServer,
      started: true,
      createdAt: Date.now(),
    };
 
    setHistory([]);
    setState(newMatch);
    setStarted(true);
    setSettingsOpen(false);
  }
 
  function resetAll() {
    if (state) rememberMatch(state, state.matchWinner ? "completed" : "stopped");
    clearHold();
    setHistory([]);
    setState(null);
    setStarted(false);
  }
 
  function scorePoint(player: PlayerKey) {
    if (!state || state.matchWinner) return;
 
    const previousState = takeSnapshot(state);
    const newState = takeSnapshot(state);
 
    const currentSetIndex =
      newState.currentSet - 1;
 
    const currentSet =
      newState.setScores[currentSetIndex];
 
    currentSet[player] += 1;
 
    const winner = getSetWinner(
      currentSet.A,
      currentSet.B
    );
 
    if (winner) {
      currentSet.winner = winner;
 
      newState.matchWins[winner] += 1;
 
      if (
        newState.matchWins[winner] >=
        newState.setsToWin
      ) {
        newState.matchWinner = winner;
      } else {
        newState.currentSet += 1;
 
        newState.setScores.push(
          newEmptySet()
        );
 
        newState.initialServerThisSet =
          other(
            newState.initialServerThisSet
          );
      }
    }
 
    newState.lastPointAt = Date.now();
 
    setHistory((current) => [
      ...current,
      previousState,
    ]);
 
    setState(newState);
  }
 
  function undo() {
    if (!history.length) return;
 
    const previous =
      history[history.length - 1];
 
    setHistory((current) =>
      current.slice(0, -1)
    );
 
    if (state?.matchWinner) setMatches(current => current.filter(m => m.createdAt !== state.createdAt));
    setState(previous);
  }
 
  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(event.target.tagName)))) return;
      const key =
        event.key.toLowerCase();
 
      if (key === "a") {
        event.preventDefault();
        scorePoint("A");
      }
 
      if (key === "l") {
        event.preventDefault();
        scorePoint("B");
      }
 
      if (key === "u") {
        event.preventDefault();
        undo();
      }
 
      if (key === "r") {
        event.preventDefault();
        resetAll();
      }
    }
 
    window.addEventListener(
      "keydown",
      handleKeyDown
    );
 
    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [state, history.length]);
 
  const liveServer = state
    ? currentServer(state)
    : undefined;
 
  const currentSet = state
    ? state.setScores[
        state.currentSet - 1
      ]
    : null;
 
  const matchStatus =
    state?.matchWinner
      ? `Winnaar: ${
          state.players[
            state.matchWinner
          ]
        }`
      : state
      ? `Set ${state.currentSet} / ${state.bestOf}`
      : "";
 
  const shownPlayers = state?.players ?? players;
  const shownScore = currentSet ?? { A: 0, B: 0 };
  const names = Array.from(new Set([...roster, players.A, players.B]));
  return <div className={rotated ? "app-shell turned" : "app-shell"} style={{"--view-w": view.width + "px", "--view-h": view.height + "px"} as React.CSSProperties}><main className={rotated ? "app rotated" : "app"}>
    <header className="topbar"><div className="brand"><span className="ball"/> PING<span>PONG</span><small>KEVIN × WESLEY</small></div><div className="toolbar"><button aria-pressed={landscapeView} onClick={() => setLandscapeView(v => !v)}>{landscapeView ? "↕ Staand" : "↔ Liggend"}</button><button onClick={() => setMatchesOpen(v => !v)}>Geschiedenis ({matches.length})</button><button onClick={() => setSettingsOpen(v => !v)}>⚙ Instellen</button><button onClick={undo} disabled={!history.length}>↶ Undo</button><button onClick={() => { if (!state || window.confirm("Huidige wedstrijd stoppen en een nieuwe beginnen?")) resetAll(); }}>Nieuwe match</button></div></header>

    {(!started || settingsOpen) && <section className="setup"><div className="section-title"><span>MATCH INSTELLEN</span><small>{started ? "Voor je volgende match" : "Kies je spelers. Klaar voor de eerste service?"}</small></div><div className="setup-grid">
      {(["A", "B"] as PlayerKey[]).map(p => <label key={p}>Speler {p}<select value={players[p]} onChange={e => setPlayers(v => ({ ...v, [p]: e.target.value }))}>{names.map(n => <option key={n}>{n}</option>)}</select></label>)}
      <label>Speltype<select value={winMode} onChange={e => setWinMode(e.target.value as any)}><option value="bestOf">Best of</option><option value="firstTo">First to (sets)</option></select></label>
      {winMode === "bestOf" ? <label>Maximaal aantal sets<select value={bestOf} onChange={e => setBestOf(Number(e.target.value) as any)}>{[3,5,7,9].map(n => <option key={n}>{n}</option>)}</select></label> : <label>Te winnen sets<div className="stepper"><button aria-label="Minder sets" onClick={() => stepFirstTo(-1)}>−</button><strong>{firstTo}</strong><button aria-label="Meer sets" onClick={() => stepFirstTo(1)}>+</button><select aria-label="Aantal te winnen sets" value={firstTo} onChange={e => setFirstTo(Number(e.target.value))}>{Array.from({length:20},(_,i) => <option key={i+1}>{i+1}</option>)}</select></div></label>}
      <label>Punten per set<select value={pointsToWin} onChange={e => setPointsToWin(Number(e.target.value))}><option value={11}>11 punten</option><option value={20}>20 punten</option></select></label>
    </div><div className="setup-actions"><div className="add-player"><input aria-label="Nieuwe speler" placeholder="Nieuwe speler…" value={newPlayer} onChange={e => setNewPlayer(e.target.value)} onKeyDown={e => {if(e.key === "Enter") addPlayer();}}/><button onClick={addPlayer} disabled={!newPlayer.trim()}>+ Toevoegen</button></div><button className="start" onClick={() => startMatch(true)}>▶ Start match</button><button onClick={() => startMatch(false)}>Start · {players.A} serveert</button></div></section>}
    <section className="scoreboard" aria-label="Pingpong scorebord"><div className="board-top"><span className="live-dot"/><span>{state?.matchWinner ? "MATCH AFGELOPEN" : started ? "MATCH LIVE" : "READY TO PLAY"}</span><span className="board-meta">SET {state?.currentSet ?? 1} <i>/</i> {state?.bestOf ?? effectiveBestOf} · FIRST TO {state?.setsToWin ?? setsToWin} SETS</span></div>
      <div className="court"><div className="center-sets" aria-label="Setstand"><small>SETS</small><div><strong>{state?.matchWins.A ?? 0}</strong><strong>{state?.matchWins.B ?? 0}</strong></div><span>FIRST TO {state?.setsToWin ?? setsToWin}</span></div>{(["A", "B"] as PlayerKey[]).map(p => <div className={"player-panel player-" + p} key={p}><div className="player-heading"><h1>{shownPlayers[p]}</h1>{started && !state?.matchWinner && liveServer === p && <span className="serve"><span/> SERVICE</span>}</div><button className="score-button" aria-label={"Punt voor " + shownPlayers[p]} onClick={() => scorePoint(p)} disabled={!started || !!state?.matchWinner}><span className="flip-score" key={shownScore[p]}>{String(shownScore[p]).padStart(2,"0")}</span><span className="point-action"><b>+</b> PUNT</span></button><div className="sets-won"><span>SETS GEWONNEN</span><strong>{state?.matchWins[p] ?? 0}</strong><div className="set-dots">{Array.from({length:state?.setsToWin ?? setsToWin},(_,i) => <span key={i} className={i < (state?.matchWins[p] ?? 0) ? "won" : ""}/>)}</div></div></div>)}</div>
      <div className="board-bottom"><span>{state?.matchWinner ? "🏆 " + state.players[state.matchWinner] + " wint de match" : started ? "Service · " + state!.players[liveServer!] : "Start een match om te tellen"}</span><small>{state?.pointsToWin ?? pointsToWin} PUNTEN · 2 VERSCHIL</small></div>
    </section>
    <section className="set-history"><div className="section-title"><span>SET VOOR SET</span><small>{state ? state.matchWins.A + " — " + state.matchWins.B : "0 — 0"}</small></div><div className="set-strip">{(state?.setScores ?? [{A:0,B:0}]).map((set,i) => <div className={"set-tile " + (set.winner ? "finished" : "current")} key={i}><small>SET {i+1}{!set.winner && " · LIVE"}</small><div><span className={set.winner === "A" ? "winning" : ""}>{set.A}</span><i>:</i><span className={set.winner === "B" ? "winning" : ""}>{set.B}</span></div><footer>{set.winner ? state!.players[set.winner] : "In het spel"}</footer></div>)}</div></section>
    {matchesOpen && <section className="match-archive"><div className="section-title"><span>WEDSTRIJDGESCHIEDENIS</span><small>{matches.length} wedstrijden · op deze telefoon</small></div>{!matches.length && <p>Nog geen wedstrijden opgeslagen. Een afgeronde match wordt automatisch bewaard.</p>}{matches.map(m => <details className="archive-item" key={m.createdAt}><summary><span><small>{new Date(m.endedAt).toLocaleString("nl-NL", {dateStyle:"short", timeStyle:"short"})} · {m.result === "completed" ? "Afgerond" : "Gestopt"}</small><b>{m.players.A} <i>vs</i> {m.players.B}</b></span><strong>{m.matchWins.A} : {m.matchWins.B}</strong></summary><p>{m.matchWinner ? "Winnaar: " + m.players[m.matchWinner] : "Wedstrijd niet afgemaakt"} · {m.pointsToWin ?? 11} punten per set</p><div className="set-strip">{m.setScores.map((set,i) => <div className="set-tile" key={i}><small>SET {i+1}{!set.winner ? " · ONVOLTOOID" : ""}</small><div>{set.A}<i>:</i>{set.B}</div><footer>{set.winner ? m.players[set.winner] : "Geen winnaar"}</footer></div>)}</div></details>)}</section>}
    {storageError && <p role="status">Opslaan lukt niet. Houd deze pagina open om je score te bewaren.</p>}
    <details className="rules"><summary>Spelregels & bediening <span>+</span></summary><p>Een set gaat tot {state?.pointsToWin ?? pointsToWin} punten, met minimaal 2 punten verschil. Service wisselt elke 2 punten; vanaf {(state?.pointsToWin ?? pointsToWin)-1}–{(state?.pointsToWin ?? pointsToWin)-1} elke punt. De eerste serveerder wisselt bij iedere nieuwe set. De 20-puntenoptie is jullie eigen spelvariant.</p><p>Tik op het grote scorevlak voor een punt. Undo maakt het laatste punt ongedaan. Toetsen: A / L = punt, U = undo, R = reset. Scores blijven in deze browser bewaard.</p></details>
  </main></div>;
}