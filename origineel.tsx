import React, { useEffect, useMemo, useRef, useState } from "react";
 
export default function PingpongScorekeeper() {
  type PlayerKey = "A" | "B";
 
  type MatchState = {
    players: { A: string; B: string };
    bestOf: number;
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
    A: "Speler A",
    B: "Speler B",
  });
 
  const [bestOf, setBestOf] = useState<3 | 5 | 7 | 9>(3);
  const [winMode, setWinMode] =
    useState<"bestOf" | "firstTo">("bestOf");
  const [firstTo, setFirstTo] = useState<number>(3);
 
  // Match
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<MatchState | null>(null);
  const [history, setHistory] = useState<MatchState[]>([]);
 
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
      Math.max(1, Math.min(15, current + delta))
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
      (pointsA >= 11 || pointsB >= 11) &&
      Math.abs(pointsA - pointsB) >= 2
    ) {
      return pointsA > pointsB ? "A" : "B";
    }
 
    return undefined;
  }
 
  function currentServer(match: MatchState): PlayerKey {
    const set = match.setScores[match.currentSet - 1];
 
    const totalPoints = set.A + set.B;
    const deuce = set.A >= 10 && set.B >= 10;
 
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
    }>(
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null
    );
 
    if (!saved) return;
 
    if (saved.players) {
      setPlayers(saved.players);
    }
 
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
      setState(saved.state);
    }
 
    if (Array.isArray(saved.history)) {
      setHistory(saved.history);
    }
  }, []);
 
  useEffect(() => {
    if (typeof window === "undefined") return;
 
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state,
        history,
        players,
        bestOf,
        winMode,
        firstTo,
        started,
      })
    );
  }, [
    state,
    history,
    players,
    bestOf,
    winMode,
    firstTo,
    started,
  ]);
 
  function startMatch(randomize = true) {
    const initialServer = randomize
      ? randomServer()
      : "A";
 
    const newMatch: MatchState = {
      players: { ...players },
      bestOf: effectiveBestOf,
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
  }
 
  function resetAll() {
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
 
    setState(previous);
  }
 
  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
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
 
  return (
<div className="min-h-screen bg-gray-50 text-gray-900 p-6">
<div className="max-w-3xl mx-auto grid gap-6">
<header className="flex items-start md:items-center justify-between gap-3">
<div>
<h1 className="text-2xl font-bold">
              Pingpong Scoreboard
</h1>
 
            <div className="text-xs text-gray-600 mt-1">
              Best of / First to • 11
              punten • win by 2 • service:
              2 punten (deuce: 1)
</div>
</div>
 
          <div className="text-right text-xs text-gray-600">
<div className="font-medium">
              Shortcuts
</div>
 
            <div>
              A = punt A • L = punt B •
              U = undo • R = reset
</div>
</div>
</header>
 
        {!started && (
<section className="bg-white p-4 rounded-2xl shadow">
<h2 className="font-semibold mb-4">
              Instellingen
</h2>
 
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<label>
<span className="text-sm text-gray-600">
                  Naam speler A
</span>
 
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={players.A}
                  onChange={(e) =>
                    setPlayers((current) => ({
                      ...current,
                      A: e.target.value,
                    }))
                  }
                />
</label>
 
              <label>
<span className="text-sm text-gray-600">
                  Naam speler B
</span>
 
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={players.B}
                  onChange={(e) =>
                    setPlayers((current) => ({
                      ...current,
                      B: e.target.value,
                    }))
                  }
                />
</label>
 
              <label>
<span className="text-sm text-gray-600">
                  Speltype
</span>
 
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={winMode}
                  onChange={(e) =>
                    setWinMode(
                      e.target.value as
                        | "bestOf"
                        | "firstTo"
                    )
                  }
>
<option value="bestOf">
                    Best of
</option>
 
                  <option value="firstTo">
                    First to (sets)
</option>
</select>
</label>
 
              {winMode === "bestOf" ? (
<label>
<span className="text-sm text-gray-600">
                    Best of
</span>
 
                  <select
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={bestOf}
                    onChange={(e) =>
                      setBestOf(
                        Number(
                          e.target.value
                        ) as
                          | 3
                          | 5
                          | 7
                          | 9
                      )
                    }
>
<option value={3}>
                      3
</option>
 
                    <option value={5}>
                      5
</option>
 
                    <option value={7}>
                      7
</option>
 
                    <option value={9}>
                      9
</option>
</select>
</label>
              ) : (
<div>
<span className="text-sm text-gray-600">
                    First to (sets)
</span>
 
                  <div className="mt-1 flex items-center gap-3">
<button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        startHold(-1);
                      }}
                      onPointerUp={clearHold}
                      onPointerLeave={
                        clearHold
                      }
                      onPointerCancel={
                        clearHold
                      }
                      className="w-12 h-12 rounded-xl border text-2xl font-bold hover:bg-gray-50 active:scale-[0.98]"
>
                      −
</button>
 
                    <div className="min-w-[3rem] text-center font-semibold text-xl">
                      {firstTo}
</div>
 
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        startHold(1);
                      }}
                      onPointerUp={clearHold}
                      onPointerLeave={
                        clearHold
                      }
                      onPointerCancel={
                        clearHold
                      }
                      className="w-12 h-12 rounded-xl border text-2xl font-bold hover:bg-gray-50 active:scale-[0.98]"
>
                      +
</button>
</div>
 
                  <div className="text-xs text-gray-500 mt-1">
                    Ingedrukt houden =
                    sneller tellen
</div>
</div>
              )}
</div>
 
            <div className="flex flex-wrap gap-3 mt-4">
<button
                onClick={() =>
                  startMatch(true)
                }
                className="rounded-xl bg-[#009b3e] text-white px-4 py-2 hover:opacity-90"
>
                Start (random serveerder)
</button>
 
              <button
                onClick={() =>
                  startMatch(false)
                }
                className="rounded-xl border px-4 py-2 hover:bg-gray-50"
>
                Start (Speler A serveert)
</button>
</div>
</section>
        )}
 
        {started &&
          state &&
          currentSet && (
<section className="bg-white p-4 rounded-2xl shadow grid gap-4">
<div className="flex items-center justify-between gap-3 flex-wrap">
<div className="text-sm">
                  {matchStatus} • Te
                  winnen sets:{" "}
                  {state.setsToWin}
</div>
 
                <div className="flex items-center gap-2 text-sm">
<span className="px-2 py-1 rounded-full border">
                    Serveert:{" "}
<b>
                      {
                        state.players[
                          liveServer as PlayerKey
                        ]
                      }
</b>
</span>
 
                  <button
                    onClick={undo}
                    disabled={
                      !history.length
                    }
                    className="rounded-xl border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
>
                    Undo
</button>
 
                  <button
                    onClick={resetAll}
                    className="rounded-xl border px-3 py-1.5 hover:bg-gray-50"
>
                    Reset
</button>
</div>
</div>
 
              <div className="md:hidden flex items-center justify-center">
<span className="text-4xl font-bold">
                  {currentSet.A} :{" "}
                  {currentSet.B}
</span>
</div>
 
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-stretch">
<SetCard
                  title={state.players.A}
                  points={currentSet.A}
                  setsWon={
                    state.matchWins.A
                  }
                  isServing={
                    liveServer === "A"
                  }
                  onScore={() =>
                    scorePoint("A")
                  }
                  disabled={
                    !!state.matchWinner
                  }
                  color="#009b3e"
                />
 
                <div className="hidden md:flex items-center justify-center">
<span className="text-5xl font-bold">
                    {currentSet.A} :{" "}
                    {currentSet.B}
</span>
</div>
 
                <SetCard
                  title={state.players.B}
                  points={currentSet.B}
                  setsWon={
                    state.matchWins.B
                  }
                  isServing={
                    liveServer === "B"
                  }
                  onScore={() =>
                    scorePoint("B")
                  }
                  disabled={
                    !!state.matchWinner
                  }
                  color="#20355c"
                />
</div>
 
              <div className="border-t pt-3">
<h3 className="font-semibold mb-2">
                  Set-uitslagen
</h3>
 
                <div className="flex flex-wrap gap-2">
                  {state.setScores.map(
                    (set, index) => (
<span
                        key={index}
                        className="text-sm px-2 py-1 rounded-full border bg-gray-100"
>
                        Set {index + 1}:{" "}
                        {set.A}-{set.B}
                        {set.winner
                          ? ` • Winnaar: ${
                              state
                                .players[
                                set
                                  .winner
                              ]
                            }`
                          : ""}
</span>
                    )
                  )}
</div>
</div>
 
              {state.matchWinner && (
<div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
<b>Match klaar.</b>{" "}
                  Winnaar:{" "}
                  {
                    state.players[
                      state.matchWinner
                    ]
                  }
</div>
              )}
</section>
          )}
 
        <RulesBlock />
</div>
</div>
  );
}
 
function SetCard({
  title,
  points,
  setsWon,
  isServing,
  onScore,
  disabled,
  color,
}: {
  title: string;
  points: number;
  setsWon: number;
  isServing: boolean;
  onScore: () => void;
  disabled: boolean;
  color: string;
}) {
  return (
<div
      className="rounded-2xl border p-4 flex flex-col gap-3"
      style={{ borderColor: color }}
>
<div className="flex items-center justify-between">
<div>
<div
            className="font-semibold text-lg"
            style={{ color }}
>
            {title}
</div>
 
          <div className="text-sm text-gray-600">
            Gewonnen sets: {setsWon}
</div>
</div>
 
        {isServing && (
<span
            className="text-xs px-2 py-1 rounded-full text-white"
            style={{
              background: color,
            }}
>
            Serveert
</span>
        )}
</div>
 
      <button
        onClick={onScore}
        disabled={disabled}
        className="
          rounded-2xl
          py-6
          text-2xl
          font-bold
          hover:opacity-90
          disabled:opacity-40
          active:scale-[0.98]
          md:py-5
          md:text-xl
        "
        style={{
          background: color,
          color: "#fff",
        }}
>
        +1 punt
</button>
 
      <div className="text-xs text-gray-500">
        Score: <b>{points}</b>
</div>
</div>
  );
}
 
function RulesBlock() {
  return (
<section className="bg-white p-4 rounded-2xl shadow grid gap-2">
<h2 className="font-semibold">
        Samenvatting regels
        (singles)
</h2>
 
      <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
<li>
          Een set gaat tot 11 punten
          en moet met 2 punten
          verschil gewonnen worden.
</li>
 
        <li>
          Service wisselt elke 2
          punten; bij 10–10 wisselt
          de service elk punt.
</li>
 
        <li>
          In een nieuwe set serveert
          de speler die de vorige set
          niet begon.
</li>
 
        <li>
          Kies Best of of First to
          voor het aantal sets.
</li>
</ul>
 
      <p className="text-xs text-gray-500">
        Tip: gebruik <b>Undo</b> als
        je per ongeluk een punt
        toevoegt.
</p>
</section>
  );
}
