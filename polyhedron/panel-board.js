/**
 * File Purpose: Pure finite Minesweeper rules for one dodecahedron panel.
 * Primary Functions/Classes: createBoard, reveal, toggleFlag, serialize.
 * Inputs: a local adjacency graph and mine target. Outputs: deterministic,
 * first-click-safe panel state with flood reveal and one-level snapshots.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  function freshCell() {
    return {
      isMine: false,
      revealed: false,
      flagged: false,
      neighborMines: 0,
      detonated: false,
    };
  }

  function createBoard(neighborLists, mineCount, seed) {
    return {
      neighborLists: neighborLists.map((list) => list.slice()),
      cells: neighborLists.map(freshCell),
      mineCount: Math.max(1, Math.min(neighborLists.length - 1, mineCount | 0)),
      seed: (seed >>> 0) || 1,
      started: false,
      failed: false,
      completed: false,
    };
  }

  function randomFactory(seed) {
    let value = seed >>> 0;
    return function random() {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return (value >>> 0) / 4294967296;
    };
  }

  function shuffled(values, random) {
    const out = values.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function computeCounts(board) {
    for (let i = 0; i < board.cells.length; i++) {
      let count = 0;
      for (const neighbor of board.neighborLists[i]) {
        if (board.cells[neighbor].isMine) count++;
      }
      board.cells[i].neighborMines = count;
    }
  }

  function deal(board, safeIndex) {
    if (board.started) return;
    const random = randomFactory(board.seed ^ Math.imul(safeIndex + 1, 0x9e3779b1));
    const candidates = [];
    for (let i = 0; i < board.cells.length; i++) {
      if (i !== safeIndex) candidates.push(i);
    }

    // A guaranteed touching mine makes the tiny 19-cell opening readable and
    // prevents a two-mine panel from collapsing into a near-automatic flood.
    const touching = shuffled(board.neighborLists[safeIndex] || [], random);
    const selected = [];
    if (touching.length && board.mineCount > 0) selected.push(touching[0]);
    for (const index of shuffled(candidates, random)) {
      if (selected.length >= board.mineCount) break;
      if (!selected.includes(index)) selected.push(index);
    }
    for (const index of selected) board.cells[index].isMine = true;
    board.started = true;
    computeCounts(board);
  }

  function flood(board, startIndex) {
    const opened = [];
    const queue = [startIndex];
    const visited = new Set([startIndex]);
    while (queue.length) {
      const index = queue.shift();
      for (const neighbor of board.neighborLists[index]) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        const cell = board.cells[neighbor];
        if (cell.isMine || cell.flagged || cell.revealed) continue;
        cell.revealed = true;
        opened.push(neighbor);
        if (cell.neighborMines === 0) queue.push(neighbor);
      }
    }
    return opened;
  }

  function isComplete(board) {
    return board.cells.every((cell) => cell.isMine || cell.revealed);
  }

  function reveal(board, index) {
    const cell = board.cells[index];
    if (!cell || cell.revealed || cell.flagged || board.failed || board.completed) {
      return { changed: false, opened: [], hitMine: false, completed: board.completed };
    }
    if (!board.started) deal(board, index);
    cell.revealed = true;
    const opened = [index];
    if (cell.isMine) {
      cell.detonated = true;
      board.failed = true;
      return { changed: true, opened, hitMine: true, completed: false };
    }
    if (cell.neighborMines === 0) opened.push(...flood(board, index));
    board.completed = isComplete(board);
    return {
      changed: true,
      opened,
      hitMine: false,
      completed: board.completed,
    };
  }

  function toggleFlag(board, index) {
    const cell = board.cells[index];
    if (!cell || cell.revealed || board.failed || board.completed) return false;
    cell.flagged = !cell.flagged;
    return true;
  }

  function flagsPlaced(board) {
    return board.cells.reduce((count, cell) => count + (cell.flagged ? 1 : 0), 0);
  }

  function safeProgress(board) {
    const safeTotal = board.cells.length - board.mineCount;
    const safeRevealed = board.cells.reduce(
      (count, cell) => count + (cell.revealed && !cell.isMine ? 1 : 0),
      0
    );
    return { safeRevealed, safeTotal };
  }

  function serialize(board) {
    const mines = [];
    const revealed = [];
    const flagged = [];
    for (let i = 0; i < board.cells.length; i++) {
      const cell = board.cells[i];
      if (cell.isMine) mines.push(i);
      if (cell.revealed) revealed.push(i);
      if (cell.flagged) flagged.push(i);
    }
    return {
      mineCount: board.mineCount,
      seed: board.seed,
      started: board.started,
      failed: board.failed,
      completed: board.completed,
      mines,
      revealed,
      flagged,
    };
  }

  function restore(neighborLists, payload) {
    if (!payload || !Array.isArray(payload.mines)) return null;
    const board = createBoard(neighborLists, payload.mineCount, payload.seed);
    const count = board.cells.length;
    const valid = (index) => Number.isInteger(index) && index >= 0 && index < count;
    if (![payload.mines, payload.revealed, payload.flagged].every((list) => Array.isArray(list))) {
      return null;
    }
    if (![payload.mines, payload.revealed, payload.flagged].every((list) => list.every(valid))) {
      return null;
    }
    for (const index of payload.mines) board.cells[index].isMine = true;
    for (const index of payload.revealed) board.cells[index].revealed = true;
    for (const index of payload.flagged) board.cells[index].flagged = true;
    board.started = !!payload.started;
    board.failed = !!payload.failed;
    board.completed = !!payload.completed;
    const detonated = payload.revealed.find((index) => board.cells[index].isMine);
    if (detonated != null) board.cells[detonated].detonated = true;
    computeCounts(board);
    return board;
  }

  const api = {
    createBoard,
    deal,
    reveal,
    toggleFlag,
    isComplete,
    flagsPlaced,
    safeProgress,
    serialize,
    restore,
    randomFactory,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.PanelBoard = api;
})(typeof globalThis !== "undefined" ? globalThis : self);
