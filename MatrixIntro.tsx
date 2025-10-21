import React, { useEffect, useRef, useState } from "react";

// MatrixIntro.tsx — Cinematic Matrix-style intro with Asian characters

const CELL = 16; // smaller cell size for higher density
const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace, "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", "Noto Sans TC"';
const RAIN_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン漢字学习力量中心韓国한국한글한자0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOGO_TEXT = "RATIONAL X";
// Speed adjustments (20x faster)
const START_FREEZE_AT = 40;
const FULL_LOCK_BY = 100;
const TRAIL_DECAY = 0.5;
const HEAD_OPACITY = 0.9;
const MAX_SPEED = 9.0;
const MIN_SPEED = 3.5;

interface CellMeta { locked: boolean; char: string; el: HTMLSpanElement; target?: string; isX?: boolean; opacity: number; row: number; col: number; }
interface ColumnState { head: number; speed: number; }

const randChar = () => RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function MatrixIntro() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>();

  const colsRef = useRef<number>(0);
  const rowsRef = useRef<number>(0);
  const cellsRef = useRef<CellMeta[][]>([]);
  const columnsRef = useRef<ColumnState[]>([]);

  const maskRef = useRef<{ active: boolean[][]; bbox: { left: number; right: number } } | null>(null);

  useEffect(() => {
    const handle = () => {
      if (!stageRef.current) return;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // High density grid
      const cols = Math.max(80, Math.floor((w / CELL) * 1.6));
      const rows = Math.max(40, Math.floor((h / CELL) * 1.6));
      colsRef.current = cols;
      rowsRef.current = rows;

      if (gridRef.current) gridRef.current.innerHTML = "";
      const g = document.createElement("div");
      g.className = "mx-grid";
      g.style.display = "grid";
      g.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
      g.style.gridTemplateRows = `repeat(${rows}, ${CELL}px)`;
      g.style.width = `${cols * CELL}px`;
      g.style.height = `${rows * CELL}px`;

      const cells: CellMeta[][] = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const span = document.createElement("span");
          span.className = "mx-cell";
          span.textContent = randChar();
          span.style.color = "rgba(156,163,175,0.6)"; // gray background text
          g.appendChild(span);
          return { locked: false, char: span.textContent, el: span, opacity: 0, row: r, col: c };
        })
      );

      if (gridRef.current) gridRef.current.appendChild(g);
      cellsRef.current = cells;

      columnsRef.current = Array.from({ length: cols }, () => ({
        head: Math.floor(Math.random() * rows) * -1,
        speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED),
      }));

      maskRef.current = buildLogoMask(cols, rows);
    };

    handle();
    setReady(true);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => {
    if (!ready) return;
    startRef.current = performance.now();

    const tick = (t: number) => {
      const elapsed = t - startRef.current;
      const cells = cellsRef.current;
      const cols = colsRef.current;
      const rows = rowsRef.current;
      const mask = maskRef.current;
      if (!cells || !mask) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const freezeWindow = Math.max(1, FULL_LOCK_BY - START_FREEZE_AT);
      const wave = clamp((elapsed - START_FREEZE_AT) / freezeWindow, 0, 1);
      const center = (cols - 1) / 2;
      const dimOthers = elapsed >= FULL_LOCK_BY ? 1 : 0;

      columnsRef.current.forEach((colState, c) => {
        const dist = Math.abs(c - center);
        const maxDist = Math.max(center, cols - 1 - center);
        const waveReach = wave * maxDist;
        colState.head += colState.speed;

        if (colState.head >= rows + 5) {
          colState.head = -Math.random() * rows * 0.5;
          colState.speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
        }

        for (let r = 0; r < rows; r++) {
          const cell = cells[r][c];
          if (cell.locked) continue;
          cell.opacity = Math.max(0, cell.opacity - TRAIL_DECAY);
          if (cell.opacity > 0) applyStyle(cell, cell.char!, cell.opacity, dimOthers);
        }

        const hRow = Math.floor(colState.head);
        if (hRow >= 0 && hRow < rows) {
          const cell = cells[hRow][c];
          if (!cell.locked) {
            const nextChar = randChar();
            cell.char = nextChar;
            const canFreeze = dist <= waveReach && mask.active[hRow][c];
            if (canFreeze) {
              cell.locked = true;
              cell.char = nextChar; // keep any char, just lock position to shape
              cell.opacity = 1;
              applyStyle(cell, nextChar, 1, 0, false);
            } else {
              cell.opacity = HEAD_OPACITY;
              applyStyle(cell, nextChar, cell.opacity, dimOthers);
            }
          }
        }
      });

      if (dimOthers) {
        const cells = cellsRef.current;
        for (let r = 0; r < rowsRef.current; r++) {
          for (let c = 0; c < colsRef.current; c++) {
            const cell = cells[r][c];
            if (!cell.locked) applyStyle(cell, cell.char!, cell.opacity * 0.7, 1);
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ready]);

  return (
    <div ref={stageRef} className="mx-stage">
      <div ref={gridRef} className="mx-grid-wrap" />
      <div className="mx-grain" />
      <style>{`
        .mx-stage { position: fixed; inset: 0; width: 100vw; height: 100vh; background: #000; overflow: hidden; }
        .mx-grid-wrap { position: absolute; inset: 0; display: grid; place-items: center; }
        .mx-grid { user-select: none; }
        .mx-cell { display: inline-flex; align-items: center; justify-content: center; width: ${CELL}px; height: ${CELL}px; font-size: ${Math.floor(CELL*0.9)}px; color: rgba(156,163,175,0.6); transition: color 80ms ease, text-shadow 80ms ease, transform 80ms ease; font-family: ${FONT_FAMILY}; will-change: color, text-shadow, transform; }
        @keyframes x-pop { 0% { transform: scale(1); text-shadow: 0 0 0px rgba(255,255,255,0); } 40% { transform: scale(1.25); text-shadow: 0 0 18px rgba(255,255,255,0.85); } 70% { transform: scale(0.98); text-shadow: 0 0 6px rgba(255,255,255,0.35); } 100% { transform: scale(1); text-shadow: 0 0 10px rgba(255,255,255,0.45); } }
        .mx-xpop { animation: x-pop 340ms cubic-bezier(.2,.7,.15,1) both; }
        .mx-grain { pointer-events: none; position: absolute; inset: 0; mix-blend-mode: overlay; opacity: .12; background-image: repeating-conic-gradient(from 0deg, rgba(255,255,255,.015) 0deg 15deg, rgba(0,0,0,.015) 15deg 30deg); animation: grainShift 0.08s steps(4) infinite; filter: contrast(140%); }
        @keyframes grainShift { 0% { transform: translate(0,0); } 25% { transform: translate(-1px,1px); } 50% { transform: translate(1px,-1px); } 75% { transform: translate(1px,1px); } 100% { transform: translate(0,0); } }
      `}</style>
    </div>
  );

  function applyStyle(cell: CellMeta, glyph: string, strength: number, dim: number, popX?: boolean) {
    const c = cell.el;
    const a = clamp(strength, 0, 1);
    if (dim >= 1 && !cell.locked) {
      c.style.color = `rgba(156,163,175,${0.5 + 0.4 * a})`;
      c.style.textShadow = "none";
    } else {
      c.style.color = `rgba(255,255,255,${a})`;
      c.style.textShadow = a > 0.6 ? "0 0 8px rgba(255,255,255,0.35)" : "none";
    }
    if (c.textContent !== glyph) c.textContent = glyph;
    if (popX) c.classList.add("mx-xpop");
  }

  function buildLogoMask(cols: number, rows: number) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const w = cols * CELL;
    const h = rows * CELL;
    canvas.width = w;
    canvas.height = h;

    const targetWidth = w * 0.78;
    let fontPx = Math.floor(h * 0.2);
    ctx.font = `${fontPx}px ${FONT_FAMILY}`;
    let metrics = ctx.measureText(LOGO_TEXT);
    if (metrics.width > 0) {
      fontPx = Math.floor(fontPx * (targetWidth / metrics.width));
      ctx.font = `${fontPx}px ${FONT_FAMILY}`;
      metrics = ctx.measureText(LOGO_TEXT);
    }

    const textW = metrics.width;
    const textH = fontPx;
    const x = (w - textW) / 2;
    const y = (h + textH * 0.65) / 2;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(LOGO_TEXT, x, y);

    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const active: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const threshold = 28;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = c * CELL;
        const y0 = r * CELL;
        let count = 0;
        for (let yy = 0; yy < CELL; yy += 2) {
          for (let xx = 0; xx < CELL; xx += 2) {
            const px = ((y0 + yy) * w + (x0 + xx)) * 4 + 3;
            if (data[px] > 8) count++;
          }
        }
        active[r][c] = count >= threshold;
      }
    }

    return { active, bbox: { left: Math.floor(x / CELL), right: Math.ceil((x + textW) / CELL) } };
  }
}
