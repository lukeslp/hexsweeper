/**
 * File Purpose: Render/play the Hexodus floor board, tile interactions, and HUD.
 * Primary Functions: GameApp, GameTile, IrisApproachOverlay, compact HUD (full
 *   run metrics behind ?diag=1), dressing.
 * Inputs/Outputs: Consumes floor/run state and user interactions, emits updated game state.
 */
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useCanvasInteraction } from "@/hooks/useCanvasInteraction";
import {
  appendSessionDiagSnapshot,
  loadSessionDiagSnapshots,
} from "@/lib/sessionDiagLog";
import {
  tryOnDeviceIrisLineFirst,
  tryOnDeviceTerminalTakeoverFirst,
} from "@/lib/foundationModelsPlugin";
import { getValueCaptureStubGranted } from "@/lib/valueCaptureStub";
import { HEX_HEIGHT, HEX_WIDTH } from "@/lib/hexConstants";
import { hexToPixel, pixelToHex } from "@/lib/hexGrid";
import { DiagnosticsPanel, readDiagQueryEnabled } from "./DiagnosticsPanel";
import {
  isDirectorCircuitOpen,
  type ExpansionDirectorInput,
  type PublicCellContext,
} from "./lib/director";
import {
  createTakeoverSchedulerState,
  fallbackTakeoverLine,
  stepTakeoverScheduler,
} from "./lib/terminalTakeoverScheduler";
import {
  floorEventToTerminalLines,
  type TerminalLogAction,
} from "./lib/terminalLog";
import {
  completeDeferredDressingIris,
  tryDressFloor,
} from "./lib/dressingOrchestrator";
import { createFloorState, reduceFloor } from "./lib/gameState";
import {
  advanceRunAfterFloorWin,
  createNextFloorState,
} from "./lib/cycleOrchestrator";
import {
  createRunState,
  floorSeed,
  milestoneBand,
  reduceRun,
  type RouteChoice,
  type RunProgressionPolicy,
  type RunState,
} from "./lib/runState";
import type { FloorState, GameCell, HexKey } from "./lib/types";
import { HEX_DIRECTIONS, hexKey } from "./lib/types";
import { DressingGenerationGate } from "./lib/dressingGenerationGate";
import {
  useSessionDiagnostics,
  type DressingCoherenceSample,
} from "./hooks/useSessionDiagnostics";

export type { SessionDiagnostics } from "./hooks/useSessionDiagnostics";

function getNodeKey(q: number, r: number) {
  return `${q},${r}` as HexKey;
}

export interface GameAppProps {
  onExit?: () => void;
  /** Run length policy (infinite default vs classic finite escape). */
  progressionPolicy: RunProgressionPolicy;
  dispatchTerminal: (action: TerminalLogAction) => void;
}

export function GameApp({
  onExit,
  progressionPolicy,
  dispatchTerminal,
}: GameAppProps) {
  const [run, setRun] = useState<RunState>(() =>
    createRunState({ seed: "hexodus-dev-run", progression: progressionPolicy })
  );
  const [floor, setFloor] = useState<FloorState>(() =>
    createFloorState(run.floor, floorSeed(run))
  );
  const {
    sessionDiag,
    setSessionDiag,
    recordDirectorMetrics,
    appendCoherenceSamples,
    resetSessionDiag,
  } = useSessionDiagnostics();
  const commerceStubGranted = useMemo(() => getValueCaptureStubGranted(), []);
  const [selectedKey, setSelectedKey] = useState<HexKey>("0,0");
  const [irisLine, setIrisLine] = useState("iris.exe is offscreen.");
  const [pacingBand, setPacingBand] = useState<string | undefined>(undefined);
  const [interFloorRoute, setInterFloorRoute] = useState<RouteChoice | null>(
    null
  );
  const [pendingDressingKeys, setPendingDressingKeys] = useState<Set<HexKey>>(
    () => new Set()
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const prevFloorStatus = useRef(floor.status);
  const justDropped = useRef(false);
  const dressingGateRef = useRef(new DressingGenerationGate());
  const rimCountedKeysRef = useRef(new Set<string>());
  const diagDirectorNullsRef = useRef(0);
  const runRef = useRef(run);
  runRef.current = run;
  const [diagMode, setDiagMode] = useState(false);
  const [diagSimRim, setDiagSimRim] = useState(false);
  const lastActionKeyRef = useRef<HexKey | undefined>(undefined);
  const takeoverSchedRef = useRef(createTakeoverSchedulerState());
  const terminalSigRef = useRef("");

  useEffect(() => {
    setDiagMode(readDiagQueryEnabled());
  }, []);

  useEffect(() => {
    const ev = floor.lastEvent;
    if (!ev) return;
    const revealedCount = Object.values(floor.cells).filter(
      c => c.view === "revealed"
    ).length;
    const sig = `${run.runId}|${floor.floor}|${ev}|${floor.wrongsLeft}|${floor.irisControl}|${floor.status}|${revealedCount}|${lastActionKeyRef.current ?? ""}`;
    if (sig === terminalSigRef.current) return;
    terminalSigRef.current = sig;

    const ctx = {
      floor: floor.floor,
      key: lastActionKeyRef.current,
      cascadeCellCount: floor.lastCascade?.flat().length ?? 0,
      cascadeRingCount: floor.lastCascade?.length ?? 0,
      irisControl: floor.irisControl,
      wrongsLeft: floor.wrongsLeft,
      maxWrongs: floor.maxWrongs,
      status: floor.status,
    };
    const base = floorEventToTerminalLines(ev, ctx);
    const extra =
      floor.lastCascade?.length &&
      (ev === "correct-reveal" || ev === "correct-mark")
        ? floorEventToTerminalLines("cascade-reveal", ctx)
        : [];
    const entries = [...base, ...extra];
    if (entries.length) {
      dispatchTerminal({ type: "appendMany", entries });
    }

    const step = stepTakeoverScheduler(takeoverSchedRef.current, {
      floor: floor.floor,
      floorEvent: ev,
      irisControl: floor.irisControl,
    });
    takeoverSchedRef.current = step.next;
    if (step.kind && step.fmPrompt) {
      const fb = fallbackTakeoverLine(step.kind, step.next.eventCount);
      if (isDirectorCircuitOpen(run.runId)) {
        dispatchTerminal({ type: "append", channel: "iris", text: fb });
      } else {
        void tryOnDeviceTerminalTakeoverFirst({
          prompt: step.fmPrompt.prompt,
          systemPrompt: step.fmPrompt.systemPrompt,
          temperature: 0.88,
          maxTokens: 96,
          timeoutMs: 14000,
          silentDiagnostics: true,
        }).then(res => {
          dispatchTerminal({
            type: "append",
            channel: "iris",
            text: res?.line ?? fb,
          });
        });
      }
    }
  }, [floor, run.runId, dispatchTerminal]);

  useEffect(() => {
    if (!floor.lastCascade?.length) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setFloor(f => reduceFloor(f, { type: "clearCascade" }));
      return;
    }
    const rings = floor.lastCascade.length;
    const ms = rings * 80 + 100;
    const id = window.setTimeout(() => {
      setFloor(f => reduceFloor(f, { type: "clearCascade" }));
    }, ms);
    return () => window.clearTimeout(id);
  }, [floor.lastCascade, floor.floor, floor.seed]);

  const canvas = useCanvasInteraction({
    containerRef,
    pixelToHex,
    getNodeKey,
    nodes: floor.cells,
    justDropped,
  });

  const visibleCells = useMemo(() => {
    const keys = new Set<HexKey>(["0,0"]);
    for (const cell of Object.values(floor.cells)) {
      if (cell.view !== "unknown" || floor.frontier.includes(cell.key)) {
        keys.add(cell.key);
      }
    }
    return Object.values(floor.cells).filter(cell => keys.has(cell.key));
  }, [floor]);

  const cascadeRingByKey = useMemo(() => {
    const rings = floor.lastCascade;
    if (!rings?.length) return null;
    const m = new Map<HexKey, number>();
    rings.forEach((ring, idx) => {
      for (const k of ring) m.set(k, idx);
    });
    return m;
  }, [floor.lastCascade]);

  function exportSessionDiagBundle() {
    appendSessionDiagSnapshot({
      at: Date.now(),
      reason: "manualExport",
      runId: run.runId,
      runFloor: run.floor,
      directorDressingCalls: sessionDiag.directorDressingCalls,
      directorFallbackCount: sessionDiag.directorFallbackCount,
      directorCircuitDegradedCount: sessionDiag.directorCircuitDegradedCount,
      directorPlatformFallbackCount: sessionDiag.directorPlatformFallbackCount,
      generatorRimFallbackCount: sessionDiag.generatorRimFallbackCount,
    });
    const payload = {
      exportedAt: Date.now(),
      stored: loadSessionDiagSnapshots(),
      currentRunId: run.runId,
      currentRunFloor: run.floor,
      current: sessionDiag,
      coherenceSamples: sessionDiag.coherenceSamples,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hexodus-session-diag-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function requestDressing(
    runSnap: RunState,
    nextFloor: FloorState,
    expandedCell: GameCell,
    opGen: number
  ): Promise<{ dressed: FloorState; committed: boolean }> {
    const frontierCells = nextFloor.frontier
      .map(key => nextFloor.cells[key])
      .filter(cell => cell && !cell.dressing)
      .map(publicCellContext);
    const revealedUndressedCells = Object.values(nextFloor.cells)
      .filter(cell => cell.view === "revealed" && !cell.dressing)
      .map(publicCellContext);
    const newCells = dedupeCellContexts([
      ...revealedUndressedCells,
      ...frontierCells,
    ]);

    const streamKey = `dress:${runSnap.runId}:${nextFloor.floor}:${opGen}`;
    const pendingKeys = newCells.map(cell => cell.key);

    if (pendingKeys.length > 0) {
      setPendingDressingKeys(current => {
        const next = new Set(current);
        for (const key of pendingKeys) next.add(key);
        return next;
      });
    }

    async function generateIrisLine(
      genOpts: Parameters<typeof tryOnDeviceIrisLineFirst>[0]
    ) {
      if (diagDirectorNullsRef.current > 0) {
        diagDirectorNullsRef.current -= 1;
        return null;
      }
      return tryOnDeviceIrisLineFirst(genOpts);
    }

    try {
      if (newCells.length === 0) {
        const result = await tryDressFloor({
          gate: dressingGateRef.current,
          opGen,
          nextFloor,
          input: {
            runId: runSnap.runId,
            floor: nextFloor.floor,
            floorSeed: nextFloor.seed,
            irisControl: nextFloor.irisControl,
            expandedCell: publicCellContext(expandedCell),
            newCells: [],
            recentEvents: eventToDirectorHistory(nextFloor.lastEvent),
          },
          generateIrisLine,
        });
        if (result.kind === "no-new-cells") {
          return { dressed: nextFloor, committed: result.shouldCommit };
        }
        return { dressed: nextFloor, committed: false };
      }

      dispatchTerminal({
        type: "setStreamLine",
        key: streamKey,
        text: `[map] mapping ${newCells.length} cell(s)`,
      });

      const input: ExpansionDirectorInput = {
        runId: runSnap.runId,
        floor: nextFloor.floor,
        floorSeed: nextFloor.seed,
        irisControl: nextFloor.irisControl,
        expandedCell: publicCellContext(expandedCell),
        newCells,
        recentEvents: eventToDirectorHistory(nextFloor.lastEvent),
      };

      const result = await tryDressFloor({
        gate: dressingGateRef.current,
        opGen,
        nextFloor,
        input,
        generateIrisLine,
        deferIris: true,
      });

      if (result.kind === "no-new-cells") {
        return { dressed: nextFloor, committed: false };
      }

      if (result.kind === "discarded") {
        dispatchTerminal({
          type: "setStreamLine",
          key: streamKey,
          text: `[map] discarded (stale generation)`,
        });
        return { dressed: nextFloor, committed: false };
      }

      setPacingBand(result.output.pacingBand);

      dispatchTerminal({
        type: "setStreamLine",
        key: streamKey,
        text: `[map] mapped ${newCells.length} cell(s) (procedural)`,
      });

      if (diagMode) {
        appendCoherenceSamples(
          coherenceSamplesForChunk(
            result.floor,
            newCells.map(c => c.key),
            "fallback"
          )
        );
      }

      const committedFloor = result.floor;

      if (result.irisPending) {
        void completeDeferredDressingIris({
          input,
          procedural: result.output,
          generateIrisLine,
        }).then(output => {
          if (!dressingGateRef.current.isCurrent(opGen)) return;
          recordDirectorMetrics(output);
          setIrisLine(output.irisLine);
          dispatchTerminal({
            type: "setStreamLine",
            key: streamKey,
            text: `[map] iris line (${output.source})`,
          });
        });
      } else {
        recordDirectorMetrics(result.output);
        setIrisLine(result.output.irisLine);
      }

      return { dressed: committedFloor, committed: true };
    } finally {
      if (pendingKeys.length > 0) {
        setPendingDressingKeys(current => {
          const next = new Set(current);
          for (const key of pendingKeys) next.delete(key);
          return next;
        });
      }
    }
  }

  async function revealCell(key: HexKey) {
    const cell = floor.cells[key];
    if (!cell || floor.status !== "playing") return;
    if (floor.lastCascade?.length) return;

    lastActionKeyRef.current = key;
    const opGen = dressingGateRef.current.begin();
    setSelectedKey(key);
    const next = reduceFloor(floor, { type: "revealCell", key });
    setFloor(next);
    syncTerminalRunState(next);
    if (next.status !== "playing") return;

    const { dressed, committed } = await requestDressing(
      runRef.current,
      next,
      cell,
      opGen
    );
    if (committed) {
      setFloor(dressed);
    }
  }

  function applyMarkAtKey(key: HexKey) {
    if (floor.lastCascade?.length) return;
    lastActionKeyRef.current = key;
    setSelectedKey(key);
    const next = reduceFloor(floor, { type: "markCell", key });
    setFloor(next);
    syncTerminalRunState(next);
  }

  function markCellFromContextMenu(key: HexKey, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    applyMarkAtKey(key);
  }

  const selected = floor.cells[selectedKey] ?? floor.cells["0,0"];

  useEffect(() => {
    if (prevFloorStatus.current !== "won" && floor.status === "won") {
      setInterFloorRoute(null);
    }
    prevFloorStatus.current = floor.status;
  }, [floor.status]);

  useEffect(() => {
    if (!floor.usedRimFallback) return;
    const key = `${floor.floor}|${floor.seed}`;
    if (rimCountedKeysRef.current.has(key)) return;
    rimCountedKeysRef.current.add(key);
    setSessionDiag(d => ({
      ...d,
      generatorRimFallbackCount: d.generatorRimFallbackCount + 1,
    }));
  }, [floor.floor, floor.seed, floor.usedRimFallback]);

  useEffect(() => {
    const entry = floor.cells["0,0" as HexKey];
    if (!entry) return;
    const opGen = dressingGateRef.current.begin();
    void requestDressing(runRef.current, floor, entry, opGen).then(
      ({ dressed, committed }) => {
        if (committed) {
          setFloor(dressed);
        }
      }
    );
  }, [floor.floor, floor.seed, run.runId]);

  function continueRun() {
    dressingGateRef.current.invalidate();
    setDiagSimRim(false);
    const route: RouteChoice = interFloorRoute ?? "safe";
    const { nextRun } = advanceRunAfterFloorWin(run, route);
    setRun(nextRun);
    if (nextRun.status !== "active") return;

    const nextFloor = createNextFloorState(nextRun);
    setPendingDressingKeys(new Set<HexKey>());
    setSelectedKey("0,0" as HexKey);
    setIrisLine("iris.exe withdraws behind the next lattice.");
    setPacingBand(undefined);
    dispatchTerminal({
      type: "append",
      channel: "event",
      text: `[evt] RUN advance floor=${nextRun.floor}`,
    });
    setFloor(nextFloor);
  }

  function restartRun() {
    dressingGateRef.current.invalidate();
    setDiagSimRim(false);
    appendSessionDiagSnapshot({
      at: Date.now(),
      reason: "restartRun",
      runId: run.runId,
      runFloor: run.floor,
      directorDressingCalls: sessionDiag.directorDressingCalls,
      directorFallbackCount: sessionDiag.directorFallbackCount,
      directorCircuitDegradedCount: sessionDiag.directorCircuitDegradedCount,
      directorPlatformFallbackCount: sessionDiag.directorPlatformFallbackCount,
      generatorRimFallbackCount: sessionDiag.generatorRimFallbackCount,
    });
    const seed = `hexodus-${Date.now().toString(36)}`;
    const nextRun = createRunState({ seed, progression: progressionPolicy });
    const nextFloor = createFloorState(nextRun.floor, floorSeed(nextRun));
    rimCountedKeysRef.current = new Set();
    setPendingDressingKeys(new Set<HexKey>());
    setRun(nextRun);
    setSelectedKey("0,0" as HexKey);
    setIrisLine("iris.exe is offscreen.");
    setPacingBand(undefined);
    setInterFloorRoute(null);
    resetSessionDiag();
    takeoverSchedRef.current = createTakeoverSchedulerState();
    dispatchTerminal({
      type: "append",
      channel: "event",
      text: "[evt] RUN restart",
    });
    setFloor(nextFloor);
  }

  function syncTerminalRunState(nextFloor: FloorState) {
    if (nextFloor.status === "lost") {
      setRun(current =>
        reduceRun(current, {
          type: "failRun",
          wrongsOnFloor: nextFloor.maxWrongs - nextFloor.wrongsLeft,
        })
      );
    }
  }

  function burstRevealDiagnostics() {
    const keys = [...floor.frontier]
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 3);
    for (const key of keys) {
      void revealCell(key);
    }
  }

  return (
    <div className="absolute inset-0 bg-background text-foreground dark">
      <div
        ref={containerRef}
        className={`relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.08),transparent_34%),linear-gradient(180deg,#070707,#101012)] ${
          canvas.isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={canvas.handlers.handleMouseDown}
        onMouseMove={canvas.handlers.handleMouseMove}
        onMouseUp={canvas.handlers.handleMouseUp}
        onMouseLeave={canvas.handlers.handleMouseLeave}
        onClick={canvas.handlers.handleCanvasClick}
        onTouchStart={canvas.handlers.handleTouchStart}
        onTouchMove={canvas.handlers.handleTouchMove}
        onTouchEnd={canvas.handlers.handleTouchEnd}
      >
        <IrisApproachOverlay pressure={floor.irisControl} />
        <div className="interactive-ui pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-start justify-between gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto max-h-[calc(100vh-8rem)] max-w-[min(16rem,calc(100vw-5rem))] overflow-y-auto border border-white/10 bg-black/50 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground backdrop-blur">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200">
              <span>Hexodus</span>
              {commerceStubGranted ? (
                <span className="rounded border border-indigo-400/50 px-1 py-px text-[8px] font-mono normal-case tracking-normal text-indigo-200">
                  stub
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-[11px] text-foreground/90">
              Floor {run.floor}
              {run.progression.mode === "finite" && run.progression.maxFloors
                ? `/${run.progression.maxFloors}`
                : ""}
              <span className="text-muted-foreground"> · </span>
              wrongs {floor.wrongsLeft}/{floor.maxWrongs}
              <span className="text-muted-foreground"> · </span>
              iris {Math.round(floor.irisControl * 100)}%
            </div>
            {diagMode ? (
              <div className="mt-1.5 space-y-0.5 border-t border-white/10 pt-1.5 text-[10px]">
                <div>band {milestoneBand(run.floor)}</div>
                <div>
                  board {floor.floor} · status {floor.status}
                </div>
                <div>
                  pressure {Math.round(run.regionalPressure * 100)}% · entropy{" "}
                  {Math.round(run.campaignEntropy * 100)}%
                </div>
                <div>sidegrades {run.sidegrades.length}</div>
                <div>pacing {pacingBand ?? "—"}</div>
                <div className="font-mono text-[9px] text-muted-foreground/90">
                  dress {sessionDiag.directorDressingCalls} · fb{" "}
                  {sessionDiag.directorFallbackCount} · plat{" "}
                  {sessionDiag.directorPlatformFallbackCount} · circuit{" "}
                  {sessionDiag.directorCircuitDegradedCount} · rim{" "}
                  {sessionDiag.generatorRimFallbackCount}
                </div>
              </div>
            ) : null}
            {floor.usedRimFallback || diagSimRim ? (
              <div className="mt-1 text-[9px] text-amber-200">
                rim fallback — see VERIFICATION_GATES
              </div>
            ) : null}
            <DiagnosticsPanel
              enabled={diagMode}
              onBurstReveal={burstRevealDiagnostics}
              onForceDirectorNulls={() => {
                diagDirectorNullsRef.current = 3;
              }}
              onSimulateRimBanner={() => setDiagSimRim(true)}
              onExportDiagLog={exportSessionDiagBundle}
            />
          </div>
          <div className="pointer-events-auto flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-label="Recenter board view"
              title="Recenter board view"
              className="flex h-10 w-10 items-center justify-center border border-white/10 bg-black/45 text-foreground backdrop-blur hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              onClick={() => canvas.setViewState({ x: 0, y: 0, zoom: 0.8 })}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
            {onExit && (
              <button
                type="button"
                className="min-h-11 min-w-11 border border-white/10 bg-black/45 px-3 py-2 text-xs uppercase text-foreground backdrop-blur hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                onClick={onExit}
              >
                Exit
              </button>
            )}
          </div>
        </div>

        <div
          className="absolute left-1/2 top-1/2 z-20"
          style={{
            transform: `translate(${canvas.viewState.x}px, ${canvas.viewState.y}px) scale(${canvas.viewState.zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <MineVirusThreads cells={floor.cells} />
          {visibleCells.map(cell => (
            <GameTile
              key={cell.key}
              cell={cell}
              cascadeRing={cascadeRingByKey?.get(cell.key)}
              selected={selectedKey === cell.key}
              isGenerating={
                pendingDressingKeys.has(cell.key) && cell.dressing === undefined
              }
              onReveal={() => revealCell(cell.key)}
              onContextMenuMark={event =>
                markCellFromContextMenu(cell.key, event)
              }
              onLongPressMark={() => applyMarkAtKey(cell.key)}
            />
          ))}
        </div>

        <div className="interactive-ui pointer-events-none absolute bottom-0 left-0 z-20 max-w-[min(30rem,calc(100vw-2rem))] border border-white/10 bg-black/50 px-3 py-2 text-xs text-muted-foreground backdrop-blur pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(8.5rem,env(safe-area-inset-bottom))]">
          <div className="mb-1 font-mono uppercase tracking-[0.14em] text-foreground">
            {titleForCell(selected, pendingDressingKeys.has(selected.key))}
          </div>
          <div className="mb-1 text-emerald-300">{irisLine}</div>
          <div className="text-[10px] leading-snug text-muted-foreground">
            Tap to reveal · long-press (touch) or right-click (desktop) to mark
            blocked.
          </div>
          <details className="pointer-events-auto mt-1.5 text-[10px] text-muted-foreground">
            <summary className="cursor-pointer select-none text-muted-foreground/80 hover:text-muted-foreground">
              More about this run
            </summary>
            <p className="mt-1.5 border-l border-white/15 pl-2 leading-snug">
              Tile titles and flavor text may come from on-device generation or
              static fallback; adjacency numbers and win/loss always follow the
              deterministic puzzle. Add{" "}
              <span className="font-mono text-foreground/80">?diag=1</span> to
              the URL for developer diagnostics on web builds.
            </p>
          </details>
          {floor.status === "won" && run.status === "active" && (
            <div className="pointer-events-auto mt-3 space-y-2">
              <div className="font-mono text-[10px] uppercase text-muted-foreground">
                Next branch
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["safe", "Safe lane"],
                    ["loot", "Loot lane"],
                    ["risk", "Risk lane"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`min-h-11 min-w-11 border px-2 py-1 text-[10px] font-mono uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                      interFloorRoute === id
                        ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-100"
                        : "border-white/15 bg-black/40 text-foreground hover:bg-white/10"
                    }`}
                    onClick={() => setInterFloorRoute(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="min-h-11 border border-emerald-400/60 px-3 py-2 font-mono uppercase text-emerald-200 hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                onClick={continueRun}
              >
                Continue
              </button>
            </div>
          )}
          {run.status === "escaped" && (
            <div className="mt-3 font-mono uppercase text-emerald-200">
              run complete · best depth {run.bestFloor}
            </div>
          )}
          {(floor.status === "lost" || run.status === "caught") && (
            <button
              type="button"
              className="pointer-events-auto mt-3 min-h-11 border border-rose-400/60 px-3 py-2 font-mono uppercase text-rose-200 hover:bg-rose-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              onClick={restartRun}
            >
              New Run
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Decorative full-screen iris “pressure” field. North star: couple the same
 *  field to real tile transforms — see
 *  docs/superpowers/specs/2026-05-16-iris-physical-tile-distortion.md */
function IrisApproachOverlay({ pressure }: { pressure: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    const context = canvasNode?.getContext("2d");
    if (!canvasNode || !context) return;
    const canvas = canvasNode;
    const pen = context;

    let raf = 0;
    const hexR = 30;
    const hexW = 2 * hexR;
    const hexH = 2 * hexR * Math.sin(Math.PI / 3);
    const intensity = clamp((pressure - 0.28) / 0.72, 0, 1);

    function resize() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      pen.clearRect(0, 0, width, height);

      if (intensity > 0.01) {
        const t = performance.now() / 1000;
        const ox = width * (1.16 - intensity * 0.62);
        const oy = height * (-0.18 + intensity * 0.62);
        const largeRadius = hexR * (7 + intensity * 4);
        const closeRadius = hexR * (2.6 + intensity * 1.5);
        const col = Math.ceil(width / (1.5 * hexW)) + 2;
        const row = Math.ceil(height / (0.5 * hexH)) + 2;

        pen.globalAlpha = 0.1 + intensity * 0.42;
        for (let i = -1; i < col; i++) {
          for (let j = -1; j < row; j++) {
            const hOffset = j % 2 === 0 ? 0 : 0.75 * hexW;
            const x = i * 1.5 * hexW + hOffset;
            const y = (j * hexH) / 2;
            const dist = Math.hypot(x - ox, y - oy);
            let radius = (dist - closeRadius) / (largeRadius - closeRadius);
            radius = clamp(radius, 0, 1);
            const seed = Math.sin(i * 97.13 + j * 31.7) * 0.5 + 0.5;
            const maxWidth = 2 * hexR * 0.87;
            const tear =
              Math.cos(t * (1.2 + seed * 2) + seed * 10) *
              Number(seed > 0.78) *
              24 *
              intensity;
            const lineWidth = clamp(maxWidth * radius + tear, 1, maxWidth);

            pen.beginPath();
            for (let p = 0; p < 6; p++) {
              const px = x + hexR * Math.cos((p * Math.PI) / 3);
              const py = y + hexR * Math.sin((p * Math.PI) / 3);
              if (p === 0) pen.moveTo(px, py);
              else pen.lineTo(px, py);
            }
            pen.closePath();
            pen.lineWidth = lineWidth;
            pen.strokeStyle =
              radius < 0.15 ? "rgba(0,0,0,0.95)" : "rgba(236,253,245,0.6)";
            pen.stroke();
          }
        }

        if (pressure > 0.72) {
          pen.globalAlpha = clamp((pressure - 0.72) / 0.28, 0, 1);
          pen.beginPath();
          const irisR = hexR * 1.5;
          for (let p = 0; p < 6; p++) {
            const px = ox + irisR * Math.cos((p * Math.PI) / 3);
            const py = oy + irisR * Math.sin((p * Math.PI) / 3);
            if (p === 0) pen.moveTo(px, py);
            else pen.lineTo(px, py);
          }
          pen.closePath();
          const irisGrad = pen.createRadialGradient(ox, oy, 0, ox, oy, irisR);
          irisGrad.addColorStop(0, "hsla(120,80%,20%,0.9)");
          irisGrad.addColorStop(1, "rgba(0,0,0,0)");
          pen.fillStyle = irisGrad;
          pen.filter = "blur(5px)";
          pen.fill();
          pen.filter = "none";
        }
        pen.globalAlpha = 1;
      }

      raf = window.requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(raf);
    };
  }, [pressure]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10"
      aria-hidden="true"
    />
  );
}

function MineVirusThreads({ cells }: { cells: Record<HexKey, GameCell> }) {
  const { segs, box } = useMemo(() => {
    const mines = Object.values(cells).filter(
      c => c.view === "marked" || c.view === "broken"
    );
    const keySet = new Set(mines.map(m => m.key));
    const seen = new Set<string>();
    const out: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      w: number;
      o: number;
      k: string;
    }> = [];
    for (const c of mines) {
      for (const dir of HEX_DIRECTIONS) {
        const nk = hexKey(c.q + dir.q, c.r + dir.r);
        if (!keySet.has(nk)) continue;
        const edge = c.key < nk ? `${c.key}|${nk}` : `${nk}|${c.key}`;
        if (seen.has(edge)) continue;
        seen.add(edge);
        const nb = cells[nk];
        if (!nb) continue;
        const p1 = hexToPixel(c.q, c.r);
        const p2 = hexToPixel(nb.q, nb.r);
        const tier = Math.max(c.cellVariant ?? 0, nb.cellVariant ?? 0);
        out.push({
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          w: 1 + tier * 0.9,
          o: 0.22 + tier * 0.12,
          k: edge,
        });
      }
    }
    if (out.length === 0) {
      return {
        segs: out,
        box: null as null | {
          minX: number;
          minY: number;
          w: number;
          h: number;
        },
      };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of out) {
      minX = Math.min(minX, s.x1, s.x2);
      minY = Math.min(minY, s.y1, s.y2);
      maxX = Math.max(maxX, s.x1, s.x2);
      maxY = Math.max(maxY, s.y1, s.y2);
    }
    const pad = 24;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    return { segs: out, box: { minX, minY, w: bw, h: bh } };
  }, [cells]);

  if (segs.length === 0 || box === null) return null;

  const { minX, minY, w, h } = box;

  return (
    <svg
      className="pointer-events-none absolute z-[5] overflow-visible"
      style={{ left: minX, top: minY, width: w, height: h }}
      viewBox={`${minX} ${minY} ${w} ${h}`}
      aria-hidden="true"
    >
      {segs.map(s => (
        <line
          key={s.k}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={`rgba(251, 113, 133, ${s.o})`}
          strokeWidth={s.w}
        />
      ))}
    </svg>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const LONG_PRESS_MARK_MS = 380;
const LONG_PRESS_CANCEL_PX = 12;

function ariaLabelForTile(cell: GameCell): string {
  const view =
    cell.view === "unknown"
      ? "unknown"
      : cell.view === "revealed"
        ? cell.clueVisible
          ? `revealed, clue ${cell.adjacentBlocked}`
          : "revealed"
        : cell.view;
  return `Hex tile at axial ${cell.q},${cell.r}, ${view}. Tap to reveal. Long press to mark blocked.`;
}

const GameTile = memo(function GameTile({
  cell,
  cascadeRing,
  selected,
  isGenerating,
  onReveal,
  onContextMenuMark,
  onLongPressMark,
}: {
  cell: GameCell;
  cascadeRing?: number;
  selected: boolean;
  isGenerating: boolean;
  onReveal: () => void;
  onContextMenuMark: (event: MouseEvent) => void;
  onLongPressMark: () => void;
}) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressConsumedClickRef = useRef(false);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }

  const { x, y } = hexToPixel(cell.q, cell.r);
  const color = colorForCell(cell);
  const glyphVariant = glyphForCell(cell, isGenerating);

  return (
    <div
      className="absolute transition-transform duration-200"
      style={{
        left: x,
        top: y,
        width: HEX_WIDTH,
        height: HEX_HEIGHT,
        transform: `translate(-50%, -50%) scale(${selected ? 1.08 : 0.94})`,
        zIndex: selected ? 20 : 10,
        ...(cascadeRing !== undefined
          ? {
              opacity: 0,
              animation: "cascadeTileReveal 90ms ease-out forwards",
              animationDelay: `${cascadeRing * 80}ms`,
            }
          : {}),
      }}
    >
      <button
        type="button"
        aria-label={ariaLabelForTile(cell)}
        className="hex-node relative flex h-full w-full min-h-11 min-w-11 items-center justify-center overflow-visible p-4 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        style={{
          touchAction: "none",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
        onPointerDown={event => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.stopPropagation();
          longPressConsumedClickRef.current = false;
          longPressStartRef.current = { x: event.clientX, y: event.clientY };
          clearLongPressTimer();
          longPressTimerRef.current = setTimeout(() => {
            longPressConsumedClickRef.current = true;
            longPressTimerRef.current = null;
            longPressStartRef.current = null;
            onLongPressMark();
          }, LONG_PRESS_MARK_MS);
        }}
        onPointerMove={event => {
          if (
            !longPressStartRef.current ||
            longPressTimerRef.current === null
          ) {
            return;
          }
          const dx = event.clientX - longPressStartRef.current.x;
          const dy = event.clientY - longPressStartRef.current.y;
          if (Math.hypot(dx, dy) > LONG_PRESS_CANCEL_PX) {
            clearLongPressTimer();
          }
        }}
        onPointerUp={clearLongPressTimer}
        onPointerCancel={clearLongPressTimer}
        onPointerLeave={clearLongPressTimer}
        onClick={event => {
          event.stopPropagation();
          if (longPressConsumedClickRef.current) {
            longPressConsumedClickRef.current = false;
            return;
          }
          onReveal();
        }}
        onContextMenu={event => {
          clearLongPressTimer();
          onContextMenuMark(event);
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="-4 -4 181.2 208"
          overflow="visible"
          aria-hidden="true"
        >
          <path
            d="M86.6 0L173.2 50V150L86.6 200L0 150V50L86.6 0Z"
            className={`${color.fill} ${
              isGenerating
                ? "stroke-emerald-300/80"
                : selected
                  ? color.stroke
                  : "stroke-border/70"
            }`}
            style={{
              strokeWidth: isGenerating ? 4 : selected ? 5 : 2,
              paintOrder: "stroke fill",
            }}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={
              isGenerating ? "10 8" : cell.view === "marked" ? "8 5" : undefined
            }
          />
        </svg>
        <div className="pointer-events-none relative z-10 flex max-w-[150px] flex-col items-center gap-1 px-2.5">
          {isGenerating && (
            <div className="absolute inset-x-0 top-1/2 -z-10 h-8 -translate-y-1/2 overflow-hidden rounded-full">
              <div className="h-full w-1/2 animate-[ping_1.2s_ease-in-out_infinite] bg-emerald-300/20 blur-sm" />
            </div>
          )}
          <TileGlyph
            variant={glyphVariant}
            className={`h-6 w-6 ${color.text} ${
              isGenerating ? "animate-pulse" : ""
            }`}
          />
          <span className="text-hex-node line-clamp-3 text-center font-bold uppercase text-foreground">
            {titleForCell(cell, isGenerating)}
          </span>
          {cell.view === "revealed" && cell.clueVisible && (
            <span className="font-mono text-lg font-bold text-foreground">
              {cell.adjacentBlocked}
            </span>
          )}
        </div>
      </button>
    </div>
  );
});

type TileGlyphVariant =
  | "entry"
  | "revealed"
  | "unknown"
  | "marked"
  | "mine1"
  | "mine2"
  | "mine3"
  | "broken"
  | "generating";

function TileGlyph({
  variant,
  className,
}: {
  variant: TileGlyphVariant;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {variant === "entry" && (
        <>
          <path d="M12 2.4 18.2 6v12L12 21.6 5.8 18V6L12 2.4Z" />
          <path d="M13.4 7.2 10 12h2.8l-2.2 4.8 4-5.4h-2.6l1.4-4.2Z" />
        </>
      )}
      {variant === "revealed" && (
        <>
          <path d="M12 2.6 18 5.2v5.2c0 4.1-2.6 7.9-6 9.4-3.4-1.5-6-5.3-6-9.4V5.2L12 2.6Z" />
          <path d="m8.6 12.3 2.2 2.2 4.6-4.6" />
        </>
      )}
      {variant === "unknown" && (
        <>
          <path d="M12 18.2v.2" />
          <path d="M9.5 9.4a2.5 2.5 0 1 1 4 2l-.8.7c-.5.4-.7.8-.7 1.3v.4" />
          <path d="M4.7 12a7.3 7.3 0 1 0 14.6 0 7.3 7.3 0 1 0-14.6 0Z" />
        </>
      )}
      {variant === "marked" && (
        <>
          <path d="m12 4.2 8 14H4l8-14Z" />
          <path d="M12 9.2v5.2" />
          <path d="M12 17.1v.1" />
        </>
      )}
      {variant === "mine1" && (
        <>
          <path d="m12 4.2 8 14H4l8-14Z" />
          <circle cx="12" cy="13" r="1.6" fill="currentColor" />
        </>
      )}
      {variant === "mine2" && (
        <>
          <path d="m12 4.2 8 14H4l8-14Z" />
          <circle cx="10" cy="13" r="1.2" fill="currentColor" />
          <circle cx="14" cy="13" r="1.2" fill="currentColor" />
        </>
      )}
      {variant === "mine3" && (
        <>
          <path d="m12 4.2 8 14H4l8-14Z" />
          <path d="M8.5 13h7" strokeWidth="2" />
          <path d="M12 9.5v7" strokeWidth="2" />
        </>
      )}
      {variant === "broken" && (
        <>
          <path d="M12 2.4 18.2 6v12L12 21.6 5.8 18V6L12 2.4Z" />
          <path d="m8.2 7.5 2.4 3.2-2 2.3 3.3 3.7-1.7 2.4" />
          <path d="m13.8 8.1 2 2.4-1.6 2.2 1.8 2.1" />
        </>
      )}
      {variant === "generating" && (
        <>
          <path d="M12 4.4a7.6 7.6 0 0 1 7.6 7.6" />
          <path d="M4.4 12A7.6 7.6 0 0 1 12 4.4" />
          <path d="M12 19.6A7.6 7.6 0 0 1 4.4 12" />
          <path d="M19.6 12a7.6 7.6 0 0 1-7.6 7.6" />
          <path d="m12 8.7 2.1 3.3h-4.2L12 8.7Z" />
        </>
      )}
    </svg>
  );
}

function publicCellContext(cell: GameCell): PublicCellContext {
  return {
    key: cell.key,
    q: cell.q,
    r: cell.r,
    view: cell.view,
    adjacentBlocked:
      cell.view === "revealed" && cell.clueVisible
        ? cell.adjacentBlocked
        : undefined,
    clueVisible: cell.view === "revealed" && cell.clueVisible,
    title: cell.dressing?.title,
  };
}

function titleForCell(cell: GameCell, isGenerating = false): string {
  if (cell.view === "revealed" && cell.q === 0 && cell.r === 0)
    return "Entry Node";
  if (isGenerating && !cell.dressing) return "Mapping";
  if (cell.view === "revealed" && !cell.dressing) return "Unmapped Route";
  if (cell.view === "revealed" && cell.clueVisible) {
    return cell.dressing?.title ?? "Revealed Route";
  }
  if (cell.view === "marked") return cell.dressing?.title ?? "Marked Block";
  if (cell.view === "broken") return "Broken Tile";
  return cell.dressing?.title ?? "Unmapped";
}

function glyphForCell(cell: GameCell, isGenerating: boolean): TileGlyphVariant {
  if (isGenerating) return "generating";
  if (cell.q === 0 && cell.r === 0) return "entry";
  if (cell.view === "revealed") return "revealed";
  if (cell.view === "marked") {
    const v = cell.cellVariant ?? 0;
    if (v >= 3) return "mine3";
    if (v === 2) return "mine2";
    if (v === 1) return "mine1";
    return "marked";
  }
  if (cell.view === "broken") {
    const v = cell.cellVariant ?? 0;
    if (v >= 3) return "mine3";
    if (v === 2) return "mine2";
    if (v === 1) return "mine1";
    return "broken";
  }
  return "unknown";
}

function colorForCell(cell: GameCell) {
  if (cell.view === "revealed") {
    return {
      fill: "fill-emerald-500/20",
      stroke: "stroke-emerald-400",
      text: "text-emerald-300",
    };
  }
  if (cell.view === "marked" || cell.view === "broken") {
    return {
      fill: "fill-rose-500/20",
      stroke: "stroke-rose-400",
      text: "text-rose-300",
    };
  }
  return {
    fill: "fill-slate-500/15",
    stroke: "stroke-slate-300",
    text: "text-slate-200",
  };
}

function eventToDirectorHistory(
  event: FloorState["lastEvent"]
): Array<
  "correct" | "wrong" | "marked-hazard" | "marked-safe" | "tile-broken"
> {
  if (event === "correct-reveal") return ["correct"];
  if (event === "wrong-reveal") return ["wrong"];
  if (event === "correct-mark") return ["marked-hazard"];
  if (event === "wrong-mark") return ["marked-safe"];
  if (event === "tile-broken") return ["tile-broken"];
  return [];
}

function dedupeCellContexts(cells: PublicCellContext[]): PublicCellContext[] {
  const byKey = new Map<HexKey, PublicCellContext>();
  for (const cell of cells) {
    byKey.set(cell.key, cell);
  }
  return Array.from(byKey.values());
}

function coherenceSamplesForChunk(
  floor: FloorState,
  keys: HexKey[],
  source: "on-device" | "fallback"
): DressingCoherenceSample[] {
  return keys.map(key => {
    const cell = floor.cells[key];
    const dressing = cell?.dressing;
    return {
      key,
      adjacentBlocked:
        cell?.view === "revealed" && cell.clueVisible
          ? cell.adjacentBlocked
          : null,
      threatTone: dressing?.threatTone ?? "quiet",
      flavor: dressing?.flavor ?? "",
      source: dressing?.source ?? source,
    };
  });
}
