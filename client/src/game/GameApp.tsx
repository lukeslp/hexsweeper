/**
 * File Purpose: Render/play the Hexodus floor board, tile interactions, and HUD.
 * Primary Functions: GameApp, GameTile, IrisApproachOverlay, route/pressure HUD, dressing.
 * Inputs/Outputs: Consumes floor/run state and user interactions, emits updated game state.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useCanvasInteraction } from "@/hooks/useCanvasInteraction";
import { tryOnDeviceFirst } from "@/lib/foundationModelsPlugin";
import { HEX_HEIGHT, HEX_WIDTH } from "@/lib/hexConstants";
import { hexToPixel, pixelToHex } from "@/lib/hexGrid";
import { directExpansion, type ExpansionDirectorOutput, type PublicCellContext } from "./lib/director";
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
import { DressingGenerationGate } from "./lib/dressingGenerationGate";

function getNodeKey(q: number, r: number) {
  return `${q},${r}` as HexKey;
}

export interface SessionDiagnostics {
  directorDressingCalls: number;
  directorFallbackCount: number;
  directorCircuitDegradedCount: number;
  generatorRimFallbackCount: number;
}

export interface GameAppProps {
  onExit?: () => void;
  /** Run length policy (infinite default vs classic finite escape). */
  progressionPolicy: RunProgressionPolicy;
}

export function GameApp({ onExit, progressionPolicy }: GameAppProps) {
  const [run, setRun] = useState<RunState>(() =>
    createRunState({ seed: "hexodus-dev-run", progression: progressionPolicy })
  );
  const [floor, setFloor] = useState<FloorState>(() =>
    createFloorState(run.floor, floorSeed(run))
  );
  const [sessionDiag, setSessionDiag] = useState<SessionDiagnostics>({
    directorDressingCalls: 0,
    directorFallbackCount: 0,
    directorCircuitDegradedCount: 0,
    generatorRimFallbackCount: 0,
  });
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
  const runRef = useRef(run);
  runRef.current = run;

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

  function recordDirectorMetrics(output: ExpansionDirectorOutput) {
    setSessionDiag(d => ({
      ...d,
      directorDressingCalls: d.directorDressingCalls + 1,
      directorFallbackCount:
        d.directorFallbackCount + (output.source === "fallback" ? 1 : 0),
      directorCircuitDegradedCount:
        d.directorCircuitDegradedCount +
        (output.degradedByCircuit ? 1 : 0),
    }));
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

    if (newCells.length === 0) {
      return { dressed: nextFloor, committed: dressingGateRef.current.isCurrent(opGen) };
    }
    const pendingKeys = newCells.map(cell => cell.key);

    setPendingDressingKeys(current => {
      const next = new Set(current);
      for (const key of pendingKeys) next.add(key);
      return next;
    });

    try {
      const output = await directExpansion(
        {
          runId: runSnap.runId,
          floor: nextFloor.floor,
          irisControl: nextFloor.irisControl,
          expandedCell: publicCellContext(expandedCell),
          newCells,
          recentEvents: eventToDirectorHistory(nextFloor.lastEvent),
        },
        tryOnDeviceFirst
      );

      recordDirectorMetrics(output);

      if (!dressingGateRef.current.isCurrent(opGen)) {
        return { dressed: nextFloor, committed: false };
      }

      setIrisLine(output.irisLine);
      setPacingBand(output.pacingBand);
      const dressed = reduceFloor(nextFloor, {
        type: "applyDressing",
        dressing: output.tiles,
      });
      return { dressed, committed: true };
    } finally {
      setPendingDressingKeys(current => {
        const next = new Set(current);
        for (const key of pendingKeys) next.delete(key);
        return next;
      });
    }
  }

  async function revealCell(key: HexKey) {
    const cell = floor.cells[key];
    if (!cell || floor.status !== "playing") return;

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

  function markCell(key: HexKey, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedKey(key);
    const next = reduceFloor(floor, { type: "markCell", key });
    setFloor(next);
    syncTerminalRunState(next);
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
    const route: RouteChoice = interFloorRoute ?? "safe";
    const { nextRun } = advanceRunAfterFloorWin(run, route);
    setRun(nextRun);
    if (nextRun.status !== "active") return;

    const nextFloor = createNextFloorState(nextRun);
    setPendingDressingKeys(new Set<HexKey>());
    setSelectedKey("0,0" as HexKey);
    setIrisLine("iris.exe withdraws behind the next lattice.");
    setPacingBand(undefined);
    setFloor(nextFloor);
  }

  function restartRun() {
    dressingGateRef.current.invalidate();
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
    setSessionDiag({
      directorDressingCalls: 0,
      directorFallbackCount: 0,
      directorCircuitDegradedCount: 0,
      generatorRimFallbackCount: 0,
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

  return (
    <div className="fixed inset-0 bg-background text-foreground dark">
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
        <div className="interactive-ui pointer-events-none absolute left-4 right-4 top-4 z-50 flex items-start justify-between gap-3">
          <div className="pointer-events-auto border border-white/10 bg-black/50 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
            <div className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-emerald-200">
              Hexodus
            </div>
            <div>
              run floor {run.floor} · band {milestoneBand(run.floor)}
              {run.progression.mode === "finite" && run.progression.maxFloors
                ? ` / cap ${run.progression.maxFloors}`
                : " · endless"}
            </div>
            <div>
              board {floor.floor} · wrongs {floor.wrongsLeft}/{floor.maxWrongs}
            </div>
            <div>
              pressure {Math.round(run.regionalPressure * 100)}% · entropy{" "}
              {Math.round(run.campaignEntropy * 100)}%
            </div>
            <div>sidegrades {run.sidegrades.length}</div>
            <div>iris control {Math.round(floor.irisControl * 100)}%</div>
            <div>pacing {pacingBand ?? "—"}</div>
            <div>status {floor.status}</div>
            <div className="font-mono text-[10px] text-muted-foreground/90">
              session dress {sessionDiag.directorDressingCalls} · fb{" "}
              {sessionDiag.directorFallbackCount} · circuit{" "}
              {sessionDiag.directorCircuitDegradedCount} · rim{" "}
              {sessionDiag.generatorRimFallbackCount}
            </div>
            {floor.usedRimFallback ? (
              <div className="text-[10px] text-amber-200/90">
                floor used generator rim fallback (see docs/VERIFICATION_GATES)
              </div>
            ) : null}
          </div>
          <div className="pointer-events-auto flex gap-2">
            <button
              type="button"
              className="border border-white/10 bg-black/45 px-3 py-2 text-xs uppercase text-foreground backdrop-blur hover:bg-white/10"
              onClick={() => canvas.setViewState({ x: 0, y: 0, zoom: 0.8 })}
            >
              Center
            </button>
            {onExit && (
              <button
                type="button"
                className="border border-white/10 bg-black/45 px-3 py-2 text-xs uppercase text-foreground backdrop-blur hover:bg-white/10"
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
          {visibleCells.map(cell => (
            <GameTile
              key={cell.key}
              cell={cell}
              selected={selectedKey === cell.key}
              isGenerating={
                pendingDressingKeys.has(cell.key) && cell.dressing === undefined
              }
              onReveal={() => revealCell(cell.key)}
              onMark={event => markCell(cell.key, event)}
            />
          ))}
        </div>

        <div className="interactive-ui pointer-events-none absolute bottom-4 left-4 max-w-[min(30rem,calc(100vw-2rem))] border border-white/10 bg-black/50 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
          <div className="mb-1 font-mono uppercase tracking-[0.14em] text-foreground">
            {titleForCell(selected, pendingDressingKeys.has(selected.key))}
          </div>
          <div className="mb-1 text-emerald-300">{irisLine}</div>
          <div>
            Left click reveals safe. Right click marks blocked. Tile text is
            LLM/fallback dressing; numbers and win/loss come from deterministic
            puzzle truth.
          </div>
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
                    className={`border px-2 py-1 text-[10px] font-mono uppercase ${
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
                className="border border-emerald-400/60 px-3 py-2 font-mono uppercase text-emerald-200 hover:bg-emerald-400/10"
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
              className="pointer-events-auto mt-3 border border-rose-400/60 px-3 py-2 font-mono uppercase text-rose-200 hover:bg-rose-400/10"
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function GameTile({
  cell,
  selected,
  isGenerating,
  onReveal,
  onMark,
}: {
  cell: GameCell;
  selected: boolean;
  isGenerating: boolean;
  onReveal: () => void;
  onMark: (event: MouseEvent) => void;
}) {
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
      }}
    >
      <button
        type="button"
        className="hex-node relative flex h-full w-full items-center justify-center overflow-visible p-4 text-center"
        style={{
          touchAction: "none",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
        onClick={event => {
          event.stopPropagation();
          onReveal();
        }}
        onContextMenu={onMark}
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
              isGenerating
                ? "10 8"
                : cell.view === "marked"
                  ? "8 5"
                  : undefined
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
}

type TileGlyphVariant =
  | "entry"
  | "revealed"
  | "unknown"
  | "marked"
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

function glyphForCell(
  cell: GameCell,
  isGenerating: boolean
): TileGlyphVariant {
  if (isGenerating) return "generating";
  if (cell.q === 0 && cell.r === 0) return "entry";
  if (cell.view === "revealed") return "revealed";
  if (cell.view === "marked") return "marked";
  if (cell.view === "broken") return "broken";
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
