#!/usr/bin/env node
/**
 * File Purpose: Geometry, panel-board, and campaign contract tests.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
"use strict";

const path = require("path");
global.Hexasphere = require(path.join(__dirname, "hexasphere.js"));
global.PanelBoard = require(path.join(__dirname, "panel-board.js"));
const DodecaLayout = require(path.join(__dirname, "dodeca-layout.js"));
global.DodecaLayout = DodecaLayout;
const Campaign = require(path.join(__dirname, "campaign.js"));

let failed = 0;

function assert(condition, message) {
  if (condition) return;
  failed++;
  console.error("FAIL:", message);
}

function connected(cells) {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const index = queue.shift();
    for (const neighbor of cells[index].localNeighborIndices) {
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  return seen.size === cells.length;
}

function testGeometry(radius, expected) {
  const solid = DodecaLayout.generatePanelSolid(radius);
  assert(solid.panels.length === 12, `radius ${radius}: expected 12 panels`);
  assert(solid.cellsPerPanel === expected, `radius ${radius}: expected ${expected} cells`);
  assert(solid.tiles.length === expected * 12, `radius ${radius}: total cells`);
  for (const panel of solid.panels) {
    const panelArea = Math.abs(DodecaLayout.area2(panel.localBoundary));
    const cellsArea = panel.cells.reduce(
      (sum, cell) => sum + Math.abs(DodecaLayout.area2(cell.localBoundary)),
      0
    );
    assert(Math.abs(panelArea - cellsArea) < 1e-6, `panel ${panel.index}: full coverage`);
    assert(connected(panel.cells), `panel ${panel.index}: connected adjacency`);
    for (const cell of panel.cells) {
      assert(cell.boundary.length >= 3, `panel ${panel.index}: healthy polygon`);
      for (const neighbor of cell.localNeighborIndices) {
        assert(
          panel.cells[neighbor].localNeighborIndices.includes(cell.panelCellIndex),
          `panel ${panel.index}: symmetric adjacency ${cell.panelCellIndex}/${neighbor}`
        );
      }
      for (const point of cell.boundary) {
        const plane =
          point.x * panel.normal.x +
          point.y * panel.normal.y +
          point.z * panel.normal.z;
        const centerPlane =
          panel.centerPoint.x * panel.normal.x +
          panel.centerPoint.y * panel.normal.y +
          panel.centerPoint.z * panel.normal.z;
        assert(Math.abs(plane - centerPlane) < 1e-7, `panel ${panel.index}: coplanar cell`);
      }
    }
  }
  console.log(`  P${expected}: 12 fully covered planar panels — OK`);
  return solid;
}

function testCampaign(layout) {
  const campaign = Campaign.createCampaign(layout, { seed: 0x12345678 });
  const layers = new Map();
  for (const panel of campaign.panels) {
    layers.set(panel.distance, (layers.get(panel.distance) || 0) + 1);
  }
  assert(
    [layers.get(0), layers.get(1), layers.get(2), layers.get(3)].join(",") === "1,5,5,1",
    "dodecahedron distance rhythm is 1/5/5/1"
  );
  assert(
    campaign.panels.reduce((sum, panel) => sum + panel.mineCount, 0) === 41,
    "P19 campaign has 41 mines"
  );
  assert(Campaign.selectPanel(campaign, 0), "start panel selects");
  const opening = Campaign.reveal(campaign, 0);
  assert(opening.changed && !opening.hitMine, "first local click is safe");
  const startBoard = campaign.panels[0].board;
  assert(
    startBoard.neighborLists[0].some((index) => startBoard.cells[index].isMine),
    "opening has a touching mine"
  );
  for (let i = 0; i < startBoard.cells.length; i++) {
    if (!startBoard.cells[i].isMine && !startBoard.cells[i].revealed) {
      Campaign.reveal(campaign, i);
    }
  }
  assert(campaign.panels[0].status === "completed", "clearing a panel completes it");
  assert(
    campaign.panels.filter((panel) => panel.status === "unlocked").length === 5,
    "completion unlocks five macro-neighbors"
  );
  Campaign.leavePanel(campaign);
  const next = campaign.panels.find((panel) => panel.status === "unlocked");
  assert(Campaign.selectPanel(campaign, next.index), "unlocked neighbor selects");
  Campaign.reveal(campaign, 0);
  const nextBoard = next.board;
  const mine = nextBoard.cells.findIndex((cell) => cell.isMine);
  const detonation = Campaign.reveal(campaign, mine);
  assert(detonation.hitMine && next.status === "failed", "mine fails only active panel");
  assert(campaign.panels[0].status === "completed", "prior completion survives failure");
  assert(Campaign.undo(campaign), "detonation is undoable");
  assert(next.status === "unlocked", "undo restores failed panel");

  const saved = Campaign.serialize(campaign);
  const restored = Campaign.restore(layout, saved);
  assert(restored && restored.activePanel === campaign.activePanel, "campaign restores active panel");
  assert(restored.panels[0].status === "completed", "campaign restores completed panels");
  console.log("  Campaign: 1/5/5/1 unlock topology · local failure · persistence — OK");
}

console.log("Dodecahedron panel campaign tests…");
const p19 = testGeometry(2, 19);
testGeometry(3, 37);
testGeometry(4, 61);
testCampaign(p19);

if (failed) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll dodecahedron campaign tests passed.");
