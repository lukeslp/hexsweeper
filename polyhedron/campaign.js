/**
 * File Purpose: Twelve-panel dodecahedron campaign state and progression.
 * Primary Functions/Classes: createCampaign, selectPanel, reveal, undo,
 * serialize, restore.
 * Inputs: DodecaLayout solid. Outputs: unlocked/completed macro topology and
 * independent panel boards whose failures never erase campaign progress.
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  function graphDistances(panels, startIndex) {
    const distances = panels.map(() => Infinity);
    distances[startIndex] = 0;
    const queue = [startIndex];
    while (queue.length) {
      const index = queue.shift();
      for (const neighbor of panels[index].neighborIndices) {
        if (distances[neighbor] !== Infinity) continue;
        distances[neighbor] = distances[index] + 1;
        queue.push(neighbor);
      }
    }
    return distances;
  }

  function panelMineCount(distance, cellsPerPanel) {
    const base = distance <= 0 ? 2 : distance === 1 ? 3 : 4;
    const densityScale = cellsPerPanel / 19;
    return Math.max(2, Math.round(base * densityScale));
  }

  function panelSeed(campaignSeed, panelIndex, revision) {
    let value = (campaignSeed ^ Math.imul(panelIndex + 1, 0x9e3779b1)) >>> 0;
    value = (value ^ Math.imul((revision || 0) + 1, 0x85ebca6b)) >>> 0;
    return value || 1;
  }

  function boardFor(campaign, panelIndex, revision) {
    const panel = campaign.layout.panels[panelIndex];
    const neighborLists = panel.cells.map((cell) => cell.localNeighborIndices);
    return global.PanelBoard.createBoard(
      neighborLists,
      campaign.panels[panelIndex].mineCount,
      panelSeed(campaign.seed, panelIndex, revision)
    );
  }

  function createCampaign(layout, options) {
    options = options || {};
    if (!global.PanelBoard) throw new Error("DodecaCampaign: PanelBoard is required");
    const startPanel = Number.isInteger(options.startPanel) ? options.startPanel : 0;
    const seed = (options.seed >>> 0) || ((Date.now() ^ 0x51f15e5d) >>> 0);
    const distances = graphDistances(layout.panels, startPanel);
    const campaign = {
      version: 1,
      layout,
      seed,
      startPanel,
      activePanel: -1,
      panels: layout.panels.map((panel, index) => ({
        index,
        status: index === startPanel ? "unlocked" : "locked",
        distance: distances[index],
        mineCount: panelMineCount(distances[index], layout.cellsPerPanel),
        revision: 0,
        board: null,
      })),
      undoSnapshot: null,
      startedAt: 0,
      elapsed: 0,
      completed: false,
    };
    for (let i = 0; i < campaign.panels.length; i++) {
      campaign.panels[i].board = boardFor(campaign, i, 0);
    }
    return campaign;
  }

  function snapshot(campaign) {
    return {
      activePanel: campaign.activePanel,
      completed: campaign.completed,
      elapsed: campaign.elapsed,
      panels: campaign.panels.map((panel) => ({
        status: panel.status,
        revision: panel.revision,
        board: global.PanelBoard.serialize(panel.board),
      })),
    };
  }

  function applySnapshot(campaign, payload) {
    if (!payload || !Array.isArray(payload.panels) || payload.panels.length !== 12) {
      return false;
    }
    const restored = [];
    for (let i = 0; i < payload.panels.length; i++) {
      const saved = payload.panels[i];
      const neighborLists = campaign.layout.panels[i].cells.map(
        (cell) => cell.localNeighborIndices
      );
      const board = global.PanelBoard.restore(neighborLists, saved.board);
      if (!board) return false;
      restored.push({
        status: saved.status,
        revision: saved.revision | 0,
        board,
      });
    }
    for (let i = 0; i < restored.length; i++) {
      campaign.panels[i].status = restored[i].status;
      campaign.panels[i].revision = restored[i].revision;
      campaign.panels[i].board = restored[i].board;
    }
    campaign.activePanel = Number.isInteger(payload.activePanel)
      ? payload.activePanel
      : -1;
    campaign.completed = !!payload.completed;
    campaign.elapsed = Math.max(0, payload.elapsed | 0);
    return true;
  }

  function selectPanel(campaign, panelIndex) {
    const panel = campaign.panels[panelIndex];
    if (!panel || campaign.activePanel >= 0) return false;
    if (panel.status !== "unlocked" && panel.status !== "failed") return false;
    campaign.activePanel = panelIndex;
    if (!campaign.startedAt) campaign.startedAt = Date.now();
    return true;
  }

  function leavePanel(campaign) {
    if (campaign.activePanel < 0) return false;
    campaign.activePanel = -1;
    campaign.undoSnapshot = null;
    return true;
  }

  function reveal(campaign, localIndex) {
    if (campaign.activePanel < 0) return { changed: false };
    const panel = campaign.panels[campaign.activePanel];
    if (panel.status === "failed" || panel.status === "completed") {
      return { changed: false, failed: panel.status === "failed" };
    }
    campaign.undoSnapshot = snapshot(campaign);
    const result = global.PanelBoard.reveal(panel.board, localIndex);
    if (!result.changed) {
      campaign.undoSnapshot = null;
      return result;
    }
    if (result.hitMine) panel.status = "failed";
    if (result.completed) {
      panel.status = "completed";
      for (const neighbor of campaign.layout.panels[panel.index].neighborIndices) {
        if (campaign.panels[neighbor].status === "locked") {
          campaign.panels[neighbor].status = "unlocked";
        }
      }
      campaign.completed = campaign.panels.every((candidate) => candidate.status === "completed");
    }
    return {
      ...result,
      panelIndex: panel.index,
      campaignCompleted: campaign.completed,
    };
  }

  function toggleFlag(campaign, localIndex) {
    if (campaign.activePanel < 0) return false;
    const panel = campaign.panels[campaign.activePanel];
    if (panel.status === "failed" || panel.status === "completed") return false;
    campaign.undoSnapshot = snapshot(campaign);
    if (global.PanelBoard.toggleFlag(panel.board, localIndex)) return true;
    campaign.undoSnapshot = null;
    return false;
  }

  function undo(campaign) {
    if (!campaign.undoSnapshot) return false;
    const saved = campaign.undoSnapshot;
    campaign.undoSnapshot = null;
    return applySnapshot(campaign, saved);
  }

  function retryPanel(campaign, panelIndex) {
    const index = Number.isInteger(panelIndex) ? panelIndex : campaign.activePanel;
    const panel = campaign.panels[index];
    if (!panel || (panel.status !== "failed" && panel.status !== "unlocked")) return false;
    panel.revision++;
    panel.board = boardFor(campaign, index, panel.revision);
    panel.status = "unlocked";
    campaign.activePanel = index;
    campaign.undoSnapshot = null;
    return true;
  }

  function resetCampaign(campaign) {
    const replacement = createCampaign(campaign.layout, {
      startPanel: campaign.startPanel,
      seed: (campaign.seed + 0x9e3779b9) >>> 0,
    });
    Object.assign(campaign, replacement);
    return campaign;
  }

  function progress(campaign) {
    const completedPanels = campaign.panels.reduce(
      (count, panel) => count + (panel.status === "completed" ? 1 : 0),
      0
    );
    let panelProgress = null;
    if (campaign.activePanel >= 0) {
      panelProgress = global.PanelBoard.safeProgress(
        campaign.panels[campaign.activePanel].board
      );
    }
    return { completedPanels, totalPanels: campaign.panels.length, panelProgress };
  }

  function serialize(campaign) {
    return {
      v: 1,
      kind: "dodeca-campaign",
      cellRadius: campaign.layout.cellRadius,
      seed: campaign.seed,
      startPanel: campaign.startPanel,
      activePanel: campaign.activePanel,
      elapsed: campaign.elapsed,
      completed: campaign.completed,
      panels: campaign.panels.map((panel) => ({
        status: panel.status,
        distance: panel.distance,
        mineCount: panel.mineCount,
        revision: panel.revision,
        board: global.PanelBoard.serialize(panel.board),
      })),
      savedAt: Date.now(),
    };
  }

  function restore(layout, payload) {
    if (
      !payload ||
      payload.v !== 1 ||
      payload.kind !== "dodeca-campaign" ||
      payload.cellRadius !== layout.cellRadius ||
      !Array.isArray(payload.panels) ||
      payload.panels.length !== layout.panels.length
    ) {
      return null;
    }
    const campaign = createCampaign(layout, {
      startPanel: payload.startPanel,
      seed: payload.seed,
    });
    const state = {
      activePanel: Number.isInteger(payload.activePanel) ? payload.activePanel : -1,
      elapsed: payload.elapsed,
      completed: payload.completed,
      panels: payload.panels,
    };
    if (!applySnapshot(campaign, state)) return null;
    return campaign;
  }

  const api = {
    createCampaign,
    selectPanel,
    leavePanel,
    reveal,
    toggleFlag,
    undo,
    retryPanel,
    resetCampaign,
    progress,
    serialize,
    restore,
    graphDistances,
    panelMineCount,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.DodecaCampaign = api;
})(typeof globalThis !== "undefined" ? globalThis : self);
