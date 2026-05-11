/**
 * MiniBoard — minimum-playable Hexodus floor.
 *
 * Single Canvas2D, single rAF, painter's-sort 3D-hex render. Hand-coded
 * 7-cell board (1 center + 6 ring) so you can play the game shape end-
 * to-end before the procedural generator + solver land in Phase 1.
 *
 * Mechanic (Hexcells lineage, simplified for the slice):
 *   - Each cell is secretly SAFE or BLOCKED
 *   - Numbered cells (always SAFE) show count of adjacent BLOCKED
 *   - Tap an UNKNOWN cell = "I think this is SAFE; reveal it"
 *     - If the cell was actually SAFE → reveals (green, shows number)
 *     - If the cell was actually BLOCKED → wrong; iris.exe breaks the
 *       cell (cracked), wrongsLeft -= 1
 *   - Long-press an UNKNOWN cell = "I'm marking this as BLOCKED"
 *     - If correct → marks (red), counts toward win
 *     - If wrong (was SAFE) → wrong; cell stays UNKNOWN, wrongsLeft -= 1
 *   - Win: every SAFE cell revealed AND every BLOCKED cell marked
 *   - Loss: wrongsLeft hits 0
 *
 * Visual: black bg, hex stroke = green for SAFE-revealed, red for
 * BLOCKED-marked, amber for UNKNOWN, broken-X overlay for iris-broken.
 * Hover-lift + tap-ripple cribbed from the user's reference Canvas2D
 * demo; full painter's-sort + animation polish lands in Phase 3.
 */

import { useEffect, useRef, useState } from "react";
import { tryOnDeviceIrisLineFirst, isFoundationModelsAvailable } from "@/lib/foundationModelsPlugin";

// ── Board layout (axial hex coords, flat-top) ──────────────────────
type Axial = { q: number; r: number };
type CellKind = "safe" | "blocked";
type CellState = "unknown" | "revealed-safe" | "marked-blocked" | "broken";

interface Cell {
    coord: Axial;
    kind: CellKind;
    state: CellState;
    /** Adjacent-blocked count, computed once at board build (only meaningful for SAFE cells). */
    number: number;
}

const RING: Axial[] = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

function buildBoard(): Cell[] {
    // Hand-coded floor 1: center + 6-ring. Center is BLOCKED. 3 of the
    // ring are BLOCKED (alternating), 3 are SAFE. Each SAFE cell's number
    // = count of adjacent BLOCKED cells (center always counts as 1; +1
    // for each adjacent BLOCKED ring cell).
    const cells: Cell[] = [
        { coord: { q: 0, r: 0 }, kind: "blocked", state: "unknown", number: 0 },
        ...RING.map((coord, i) => ({
            coord,
            kind: (i % 2 === 0 ? "blocked" : "safe") as CellKind,
            state: "unknown" as CellState,
            number: 0,
        })),
    ];
    // Compute numbers for SAFE cells.
    for (const c of cells) {
        if (c.kind !== "safe") continue;
        let n = 0;
        for (const other of cells) {
            if (other === c) continue;
            const dq = other.coord.q - c.coord.q;
            const dr = other.coord.r - c.coord.r;
            const adjacent = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) === 2;
            if (adjacent && other.kind === "blocked") n += 1;
        }
        c.number = n;
    }
    return cells;
}

// ── Hex geometry (flat-top) ────────────────────────────────────────
const HEX_SIZE = 56;          // outer radius (px)
const HEX_GAP = 4;
const SQRT3 = Math.sqrt(3);

function hexToPixel(coord: Axial, cx: number, cy: number) {
    const x = cx + (HEX_SIZE + HEX_GAP) * 1.5 * coord.q;
    const y = cy + (HEX_SIZE + HEX_GAP) * SQRT3 * (coord.r + coord.q / 2);
    return { x, y };
}

function hexVertices(x: number, y: number, r: number) {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    }
    return pts;
}

function pixelToCell(
    px: number, py: number, cells: Cell[], cx: number, cy: number,
): Cell | null {
    let best: { cell: Cell; dist: number } | null = null;
    for (const c of cells) {
        const { x, y } = hexToPixel(c.coord, cx, cy);
        const d = Math.hypot(px - x, py - y);
        if (d <= HEX_SIZE && (best === null || d < best.dist)) {
            best = { cell: c, dist: d };
        }
    }
    return best?.cell ?? null;
}

// ── Component ──────────────────────────────────────────────────────

type Status = "playing" | "won" | "lost";

const MAX_WRONGS = 3;
const LONG_PRESS_MS = 380;

export function MiniBoard({ onExit }: { onExit?: () => void }) {
    const [cells, setCells] = useState<Cell[]>(buildBoard);
    const [wrongsLeft, setWrongsLeft] = useState(MAX_WRONGS);
    const [status, setStatus] = useState<Status>("playing");
    const [tauntLine, setTauntLine] = useState<string | null>(null);
    const [tauntFresh, setTauntFresh] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressedRef = useRef(false);

    // ── Render loop ────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let raf = 0;
        const render = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
                canvas.width = w * dpr;
                canvas.height = h * dpr;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Clear
            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(0, 0, w, h);

            const cx = w / 2;
            const cy = h / 2;

            for (const c of cells) {
                const { x, y } = hexToPixel(c.coord, cx, cy);
                const verts = hexVertices(x, y, HEX_SIZE);
                ctx.beginPath();
                verts.forEach(([vx, vy], i) => i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy));
                ctx.closePath();

                // Fill by state
                let fill = "#0f0f0f";
                let stroke = "#fbbf24";    // amber unknown
                let strokeWidth = 2;
                if (c.state === "revealed-safe") {
                    fill = "#10b9810f";
                    stroke = "#10b981";
                    strokeWidth = 2;
                } else if (c.state === "marked-blocked") {
                    fill = "#fb71850f";
                    stroke = "#fb7185";
                    strokeWidth = 2;
                } else if (c.state === "broken") {
                    fill = "#fb71851f";
                    stroke = "#fb7185";
                    strokeWidth = 1;
                }
                ctx.fillStyle = fill;
                ctx.fill();
                ctx.strokeStyle = stroke;
                ctx.lineWidth = strokeWidth;
                ctx.stroke();

                // Number on revealed-safe cells (and on broken just for "X")
                if (c.state === "revealed-safe") {
                    ctx.fillStyle = "#34d399";
                    ctx.font = "bold 22px ui-monospace, Menlo, monospace";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(String(c.number), x, y);
                } else if (c.state === "broken") {
                    ctx.strokeStyle = "#fb7185";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x - HEX_SIZE * 0.4, y - HEX_SIZE * 0.4);
                    ctx.lineTo(x + HEX_SIZE * 0.4, y + HEX_SIZE * 0.4);
                    ctx.moveTo(x + HEX_SIZE * 0.4, y - HEX_SIZE * 0.4);
                    ctx.lineTo(x - HEX_SIZE * 0.4, y + HEX_SIZE * 0.4);
                    ctx.stroke();
                } else if (c.state === "marked-blocked") {
                    ctx.fillStyle = "#fb7185";
                    ctx.beginPath();
                    ctx.arc(x, y, 8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            raf = requestAnimationFrame(render);
        };
        raf = requestAnimationFrame(render);
        return () => cancelAnimationFrame(raf);
    }, [cells]);

    // ── Win/loss check ─────────────────────────────────────────────
    useEffect(() => {
        if (status !== "playing") return;
        const safeRevealed = cells.every(c => c.kind !== "safe" || c.state === "revealed-safe");
        const blockedMarked = cells.every(c => c.kind !== "blocked" || c.state === "marked-blocked" || c.state === "broken");
        if (safeRevealed && blockedMarked) {
            setStatus("won");
            void fireTaunt("escape");
        } else if (wrongsLeft <= 0) {
            setStatus("lost");
            void fireTaunt("death");
        }
    }, [cells, wrongsLeft, status]);

    // ── iris.exe taunt (on wrong, on win, on loss) ─────────────────
    async function fireTaunt(event: "wrong" | "escape" | "death") {
        if (!await isFoundationModelsAvailable()) {
            setTauntLine(staticTaunt(event));
            setTauntFresh(true);
            return;
        }
        const prompt = {
            wrong: "The player just made a wrong guess. One short, contemptuous taunt.",
            escape: "The player just escaped this floor. One short taunt acknowledging it through clenched teeth.",
            death: "The player just lost. One short, gloating taunt.",
        }[event];
        const result = await tryOnDeviceIrisLineFirst({
            systemPrompt: "You are iris.exe, a hostile rogue AI. Voice: terse, contemptuous, glitchy. Stay in character.",
            prompt,
            temperature: 0.95,
            maxTokens: 80,
            timeoutMs: 8000,
            silentDiagnostics: true,
        });
        setTauntLine(result?.line ?? staticTaunt(event));
        setTauntFresh(true);
    }

    function staticTaunt(event: "wrong" | "escape" | "death") {
        const pool = {
            wrong: ["careless.", "wrong cell. predictable.", "i felt that one. did you?", "noted. you tend to overthink the edges."],
            escape: ["one floor. statistical anomaly.", "fine. the next is harder.", "you escaped this lattice. there are eleven more."],
            death: ["caught. as expected.", "dissolution complete.", "you held longer than the last."],
        }[event];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // ── Pointer handling ───────────────────────────────────────────
    function pointerCoords(e: React.PointerEvent<HTMLCanvasElement>) {
        const rect = e.currentTarget.getBoundingClientRect();
        return { px: e.clientX - rect.left, py: e.clientY - rect.top };
    }

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
        if (status !== "playing") return;
        const { px, py } = pointerCoords(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const cell = pixelToCell(px, py, cells, canvas.clientWidth / 2, canvas.clientHeight / 2);
        if (!cell || cell.state !== "unknown") return;
        longPressedRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            longPressedRef.current = true;
            commit(cell, "mark");
        }, LONG_PRESS_MS);
    }

    function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
        if (status !== "playing") return;
        if (longPressTimerRef.current !== null) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        if (longPressedRef.current) return;
        const { px, py } = pointerCoords(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const cell = pixelToCell(px, py, cells, canvas.clientWidth / 2, canvas.clientHeight / 2);
        if (!cell || cell.state !== "unknown") return;
        commit(cell, "reveal");
    }

    function onPointerCancel() {
        if (longPressTimerRef.current !== null) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        longPressedRef.current = false;
    }

    function commit(cell: Cell, action: "reveal" | "mark") {
        const correct = action === "reveal" ? cell.kind === "safe" : cell.kind === "blocked";
        setCells(prev => prev.map(c => {
            if (c !== cell) return c;
            if (correct) {
                return { ...c, state: action === "reveal" ? "revealed-safe" : "marked-blocked" };
            }
            // Wrong: if they tried to reveal a BLOCKED, the cell breaks visibly
            if (action === "reveal" && cell.kind === "blocked") {
                return { ...c, state: "broken" };
            }
            return c;
        }));
        if (!correct) {
            setWrongsLeft(w => w - 1);
            void fireTaunt("wrong");
        }
    }

    // ── UI chrome ──────────────────────────────────────────────────
    return (
        <div style={{
            position: "fixed", inset: 0, background: "#0a0a0a", color: "#10b981",
            font: "13px ui-monospace, Menlo, monospace", display: "flex", flexDirection: "column",
            paddingTop: "max(env(safe-area-inset-top, 16px), 16px)",
            paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
            paddingLeft: "max(env(safe-area-inset-left, 12px), 12px)",
            paddingRight: "max(env(safe-area-inset-right, 12px), 12px)",
        }}>
            {/* HUD */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ color: "#34d399", fontSize: "16px" }}>HEXODUS &nbsp;·&nbsp; floor 1/12</div>
                <div style={{ color: wrongsLeft <= 1 ? "#fb7185" : "#fbbf24" }}>
                    wrongs: {wrongsLeft}/{MAX_WRONGS}
                </div>
            </div>

            {/* Board */}
            <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
                <canvas
                    ref={canvasRef}
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onPointerLeave={onPointerCancel}
                    style={{
                        width: "100%", height: "100%", display: "block",
                        touchAction: "none", cursor: status === "playing" ? "pointer" : "default",
                    }}
                />
                {/* Endgame overlay */}
                {status !== "playing" && (
                    <div style={{
                        position: "absolute", inset: 0, display: "flex", alignItems: "center",
                        justifyContent: "center", background: "#0a0a0acc", flexDirection: "column", gap: "16px",
                    }}>
                        <div style={{
                            fontSize: "24px",
                            color: status === "won" ? "#34d399" : "#fb7185",
                        }}>
                            {status === "won" ? "FLOOR CLEARED" : "CAUGHT"}
                        </div>
                        <button
                            onClick={() => {
                                setCells(buildBoard());
                                setWrongsLeft(MAX_WRONGS);
                                setStatus("playing");
                                setTauntLine(null);
                                setTauntFresh(false);
                            }}
                            style={btnStyle}
                        >
                            run again &gt;_
                        </button>
                        {onExit && (
                            <button onClick={onExit} style={{ ...btnStyle, color: "#fbbf24", borderColor: "#fbbf2466" }}>
                                exit to menu
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* iris.exe taunt feed */}
            {tauntLine && (
                <div style={{
                    marginTop: "12px", padding: "10px 14px",
                    border: "1px solid #fb718566",
                    background: "#fb71850a",
                    color: "#fb7185",
                    fontSize: "12px",
                    lineHeight: 1.5,
                    opacity: tauntFresh ? 1 : 0.5,
                    transition: "opacity 1.2s ease-out",
                }}
                onAnimationEnd={() => setTauntFresh(false)}
                >
                    <span style={{ opacity: 0.6 }}>iris.exe says: </span>{tauntLine}
                </div>
            )}

            {/* Tap hint */}
            {status === "playing" && (
                <div style={{ marginTop: "8px", fontSize: "11px", opacity: 0.5 }}>
                    tap = reveal SAFE &nbsp;·&nbsp; long-press = mark BLOCKED
                </div>
            )}
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    background: "transparent",
    color: "#34d399",
    border: "1px solid #10b98166",
    padding: "10px 18px",
    font: "14px ui-monospace, Menlo, monospace",
    cursor: "pointer",
    minHeight: "44px",
    minWidth: "120px",
};
