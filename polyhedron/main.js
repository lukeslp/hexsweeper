/**
 * File Purpose: Orchestrate the dodecahedron campaign, renderer, persistence,
 * help, banner, and the compatibility API consumed by hex-bloom.
 * Primary Functions/Classes: SphereSweeper.boot (route-local compatibility).
 * Author: Luke Steuber <luke@lukesteuber.com>
 */
(function (global) {
  "use strict";

  const SIZE_RADIUS = { pocket: 2, standard: 3, deep: 4 };
  const SIZE_LABEL = { pocket: "P19", standard: "P37", deep: "P61" };
  const SIZE_ORDER = ["pocket", "standard", "deep"];
  const RUN_KEY = "hexsweeper-dodeca-campaign-v1";
  const SIZE_KEY = "hexsweeper-dodeca-size-v1";
  const SETTINGS_KEY = "hexsweeper-dodeca-settings-v1";

  const THEMES = [
    {
      id: "light",
      name: "Light",
      bg: "#ffffff",
      covered: "#fbfbfa",
      coveredEdge: "#000000",
      label: "#000000",
      flagFill: "#f12626",
      chrome: "light",
    },
    {
      id: "dark",
      name: "Dark",
      bg: "#050505",
      covered: "#111111",
      coveredEdge: "#ffffff",
      label: "#ffffff",
      flagFill: "#f12626",
      chrome: "dark",
    },
  ];

  function safeJson(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function boot(options) {
    options = options || {};
    const canvas = document.getElementById(options.canvasId || "gameCanvas");
    if (!canvas) throw new Error("Dodecahedron: canvas not found");
    if (!global.DodecaLayout || !global.DodecaCampaign || !global.PolyhedronRenderer) {
      throw new Error("Dodecahedron: modules not loaded");
    }

    let storedSize = "pocket";
    try {
      const candidate = localStorage.getItem(SIZE_KEY);
      if (SIZE_ORDER.includes(candidate)) storedSize = candidate;
    } catch (_) {}
    const storedSettings = safeJson(
      (() => {
        try {
          return localStorage.getItem(SETTINGS_KEY);
        } catch (_) {
          return null;
        }
      })(),
      {}
    );

    const state = {
      difficulty: storedSize,
      flagMode: false,
      countStyle: storedSettings.countStyle || "numerals",
      relief: storedSettings.relief || "extruded",
      seams: storedSettings.seams !== false,
      appearancePack: "classic",
      appearanceAxes: storedSettings.appearanceAxes || {
        field: "light",
        shell: "light",
        well: "dark",
      },
      invertDragX: !!storedSettings.invertDragX,
      invertDragY: !!storedSettings.invertDragY,
      effectsMode: storedSettings.effectsMode || "auto",
      mineCount: 0,
      flagsPlaced: 0,
      isFirstClick: true,
      isGameOver: false,
      won: false,
      timeElapsed: 0,
    };

    let layout = global.DodecaLayout.generatePanelSolid(SIZE_RADIUS[state.difficulty]);
    let campaign = null;
    try {
      const saved = safeJson(localStorage.getItem(RUN_KEY), null);
      campaign = global.DodecaCampaign.restore(layout, saved);
    } catch (_) {}
    if (!campaign) campaign = global.DodecaCampaign.createCampaign(layout);

    const banner = document.getElementById("sphere-banner");
    const bannerMsg = document.getElementById("banner-msg");
    const bannerMeta = document.getElementById("banner-meta");
    const bannerActions = document.getElementById("banner-actions");
    const shareButton = document.getElementById("share-win-btn");
    const undoButton = document.getElementById("banner-undo-btn");
    const againButton = document.getElementById("banner-again-btn");
    const returnButton = document.getElementById("banner-return-btn");
    const statsMines = document.getElementById("stats-mines");
    const statsTime = document.getElementById("stats-time");
    const live = document.getElementById("campaign-live");
    const toast = document.getElementById("count-style-toast");
    const helpOverlay = document.getElementById("help-overlay");
    const helpPanel = document.getElementById("help-panel");
    const helpButton = document.getElementById("help-btn");
    const helpClose = document.getElementById("help-close-btn");
    const helpDone = document.getElementById("help-done-btn");
    const panelBackButton = document.getElementById("panel-back-btn");
    let helpReturn = null;
    let toastTimer = null;
    let timer = null;
    let paused = false;
    let completionTimer = null;

    const renderer = new global.PolyhedronRenderer(canvas, layout, campaign, {
      getState: () => state,
      getInvert: () => ({ x: state.invertDragX, y: state.invertDragY }),
      onPanelSelect: selectPanel,
      onCellAction: activateCell,
      onBack: returnToOverview,
    });

    function activeBoard() {
      if (campaign.activePanel < 0) return null;
      return campaign.panels[campaign.activePanel].board;
    }

    function syncDerivedState() {
      const board = activeBoard();
      state.mineCount = board
        ? board.mineCount
        : campaign.panels[campaign.startPanel].mineCount;
      state.flagsPlaced = board ? global.PanelBoard.flagsPlaced(board) : 0;
      state.isFirstClick = board ? !board.started : !campaign.panels.some((panel) => panel.board.started);
      state.isGameOver = campaign.completed;
      state.won = campaign.completed;
      state.timeElapsed = campaign.elapsed;
    }

    function saveSettings() {
      try {
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({
            countStyle: state.countStyle,
            relief: state.relief,
            seams: state.seams,
            appearanceAxes: state.appearanceAxes,
            invertDragX: state.invertDragX,
            invertDragY: state.invertDragY,
            effectsMode: state.effectsMode,
          })
        );
      } catch (_) {}
    }

    function persist() {
      syncDerivedState();
      try {
        localStorage.setItem(RUN_KEY, JSON.stringify(global.DodecaCampaign.serialize(campaign)));
      } catch (_) {}
      saveSettings();
    }

    function clearRun() {
      try {
        localStorage.removeItem(RUN_KEY);
      } catch (_) {}
    }

    function startTimer() {
      if (timer || paused || campaign.completed) return;
      if (!campaign.panels.some((panel) => panel.board.started)) return;
      timer = setInterval(() => {
        campaign.elapsed++;
        updateUI(false);
        if (campaign.elapsed % 5 === 0) persist();
      }, 1000);
    }

    function stopTimer() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    function announce(message) {
      if (!live) return;
      live.textContent = "";
      requestAnimationFrame(() => {
        live.textContent = message;
      });
    }

    function showToast(message) {
      if (!toast) return;
      clearTimeout(toastTimer);
      toast.textContent = message;
      toast.classList.add("visible");
      toastTimer = setTimeout(() => toast.classList.remove("visible"), 1700);
    }

    function updateUI(shouldPersist) {
      syncDerivedState();
      const board = activeBoard();
      const remaining = Math.max(0, state.mineCount - state.flagsPlaced);
      if (statsMines) statsMines.textContent = String(remaining).padStart(2, "0");
      if (statsTime) statsTime.textContent = String(state.timeElapsed).padStart(3, "0") + "s";

      const progress = global.DodecaCampaign.progress(campaign);
      if (board && campaign.activePanel >= 0) {
        const local = progress.panelProgress;
        canvas.setAttribute(
          "aria-label",
          `Panel ${campaign.activePanel + 1} of 12. ${local.safeRevealed} of ${local.safeTotal} safe cells cleared.`
        );
      } else {
        canvas.setAttribute(
          "aria-label",
          `Dodecahedron campaign. ${progress.completedPanels} of 12 panels cleared. Select an unlocked panel.`
        );
      }
      if (panelBackButton) panelBackButton.hidden = campaign.activePanel < 0;
      applyAppearance();
      if (shouldPersist !== false) persist();
    }

    function applyAppearance() {
      const dark = state.appearanceAxes.field === "dark";
      document.body.dataset.sphereTheme = dark ? "dark" : "light";
      document.body.dataset.sphereChrome = dark ? "dark" : "light";
    }

    function selectPanel(panelIndex) {
      if (!global.DodecaCampaign.selectPanel(campaign, panelIndex)) return;
      renderer.focus(panelIndex);
      hideBanner();
      const panel = campaign.panels[panelIndex];
      const progress = global.PanelBoard.safeProgress(panel.board);
      announce(
        `Panel ${panelIndex + 1} of 12. ${progress.safeRevealed} of ${progress.safeTotal} safe cells cleared.`
      );
      if (panel.status === "failed") showFailure();
      updateUI();
      canvas.focus({ preventScroll: true });
    }

    function activateCell(localIndex, forceFlag) {
      const board = activeBoard();
      if (!board || campaign.completed) return;
      if (forceFlag || state.flagMode) {
        if (global.DodecaCampaign.toggleFlag(campaign, localIndex)) {
          announce(board.cells[localIndex].flagged ? "Cell flagged" : "Flag removed");
          updateUI();
        }
        return;
      }
      const wasStarted = board.started;
      const result = global.DodecaCampaign.reveal(campaign, localIndex);
      if (!result.changed) return;
      if (!wasStarted) startTimer();
      if (result.hitMine) {
        showFailure();
        announce(`Mine detonated on panel ${campaign.activePanel + 1}. Undo, retry, or return.`);
      } else if (result.completed) {
        if (result.campaignCompleted) {
          stopTimer();
          showWin();
          announce(`Campaign cleared in ${campaign.elapsed} seconds.`);
        } else {
          const opened = layout.panels[result.panelIndex].neighborIndices.filter(
            (index) => campaign.panels[index].status === "unlocked"
          ).length;
          showToast(`Panel cleared · ${opened} routes open`);
          announce(`Panel ${result.panelIndex + 1} cleared. ${opened} adjacent panels available.`);
          clearTimeout(completionTimer);
          completionTimer = setTimeout(() => {
            if (campaign.activePanel === result.panelIndex) returnToOverview();
          }, renderer.reducedMotion ? 120 : 760);
        }
      }
      updateUI();
    }

    function returnToOverview() {
      clearTimeout(completionTimer);
      if (campaign.activePanel < 0) return;
      global.DodecaCampaign.leavePanel(campaign);
      renderer.overview();
      hideBanner();
      const progress = global.DodecaCampaign.progress(campaign);
      announce(`${progress.completedPanels} of 12 panels cleared. Choose an unlocked panel.`);
      updateUI();
      canvas.focus({ preventScroll: true });
    }

    function reset() {
      hideBanner();
      if (campaign.activePanel >= 0) {
        const index = campaign.activePanel;
        const panel = campaign.panels[index];
        if (panel.status === "completed") {
          returnToOverview();
          return;
        }
        if (panel.status !== "failed") panel.status = "unlocked";
        global.DodecaCampaign.retryPanel(campaign, index);
        renderer.focus(index);
        showToast("Panel restarted");
        announce(`Panel ${index + 1} restarted.`);
      } else {
        global.DodecaCampaign.resetCampaign(campaign);
        renderer.setCampaign(campaign);
        renderer.setLayout(layout, campaign);
        stopTimer();
        showToast("Campaign reset");
        announce("Campaign reset. Panel 1 unlocked.");
      }
      updateUI();
    }

    function undo() {
      if (!global.DodecaCampaign.undo(campaign)) return false;
      renderer.setCampaign(campaign);
      hideBanner();
      startTimer();
      updateUI();
      announce("Move undone.");
      return true;
    }

    function retry() {
      const index = campaign.activePanel;
      if (index < 0) return;
      if (campaign.panels[index].status !== "failed") {
        reset();
        return;
      }
      global.DodecaCampaign.retryPanel(campaign, index);
      hideBanner();
      renderer.focus(index);
      announce(`Panel ${index + 1} redealt.`);
      updateUI();
    }

    function showFailure() {
      if (!banner) return;
      banner.hidden = false;
      banner.classList.add("visible");
      if (bannerMsg) bannerMsg.textContent = "Panel breached.";
      if (bannerMeta) {
        bannerMeta.hidden = false;
        bannerMeta.textContent = `Panel ${campaign.activePanel + 1} of 12 · campaign progress intact`;
      }
      if (bannerActions) bannerActions.hidden = false;
      if (shareButton) shareButton.hidden = true;
      if (undoButton) undoButton.hidden = !campaign.undoSnapshot;
      if (againButton) {
        againButton.hidden = false;
        againButton.setAttribute("aria-label", "Retry panel");
        againButton.title = "Retry panel";
      }
      if (returnButton) returnButton.hidden = false;
    }

    function showWin() {
      if (!banner) return;
      banner.hidden = false;
      banner.classList.add("visible");
      if (bannerMsg) bannerMsg.textContent = "Dodecahedron cleared.";
      if (bannerMeta) {
        bannerMeta.hidden = false;
        bannerMeta.textContent = `${campaign.elapsed}s · 12 panels · ${layout.tiles.length} cells`;
      }
      if (bannerActions) bannerActions.hidden = false;
      if (shareButton) shareButton.hidden = true;
      if (undoButton) undoButton.hidden = true;
      if (againButton) {
        againButton.hidden = false;
        againButton.setAttribute("aria-label", "New campaign");
        againButton.title = "New campaign";
      }
      if (returnButton) returnButton.hidden = true;
    }

    function hideBanner() {
      if (!banner) return;
      banner.classList.remove("visible");
      setTimeout(() => {
        if (!banner.classList.contains("visible")) banner.hidden = true;
      }, 180);
    }

    function setSize(id) {
      if (!SIZE_ORDER.includes(id) || id === state.difficulty) return;
      state.difficulty = id;
      try {
        localStorage.setItem(SIZE_KEY, id);
      } catch (_) {}
      clearRun();
      stopTimer();
      layout = global.DodecaLayout.generatePanelSolid(SIZE_RADIUS[id]);
      campaign = global.DodecaCampaign.createCampaign(layout);
      renderer.setLayout(layout, campaign);
      syncSizeButton();
      showToast(`${SIZE_LABEL[id]} · new campaign`);
      announce(`${SIZE_LABEL[id]}, ${layout.cellsPerPanel} cells per panel. New campaign.`);
      updateUI();
    }

    function syncSizeButton() {
      const button = document.getElementById("size-btn");
      if (!button) return;
      const label = SIZE_LABEL[state.difficulty];
      button.setAttribute(
        "aria-label",
        `Panel density ${label}, ${layout.cellsPerPanel} cells per panel. Activate to cycle P19, P37, P61.`
      );
    }

    function setCountStyle(id) {
      if (!["numerals", "rings", "yellow"].includes(id)) return;
      state.countStyle = id;
      saveSettings();
    }

    function setRelief(mode) {
      state.relief = mode === "flush" ? "flush" : "extruded";
      saveSettings();
    }

    function setSeams(on) {
      state.seams = !!on;
      saveSettings();
    }

    function setAppearanceAxes(axes) {
      state.appearanceAxes = Object.assign({}, state.appearanceAxes, axes || {});
      applyAppearance();
      saveSettings();
    }

    function cycleTheme() {
      const dark = state.appearanceAxes.field !== "dark";
      setAppearanceAxes(
        dark
          ? { field: "dark", shell: "dark", well: "light" }
          : { field: "light", shell: "light", well: "dark" }
      );
    }

    function openHelp() {
      if (!helpOverlay) return;
      helpReturn = document.activeElement;
      helpOverlay.hidden = false;
      requestAnimationFrame(() => helpOverlay.classList.add("open"));
      helpPanel && helpPanel.focus({ preventScroll: true });
    }

    function closeHelp() {
      if (!helpOverlay) return;
      helpOverlay.classList.remove("open");
      setTimeout(() => {
        if (!helpOverlay.classList.contains("open")) helpOverlay.hidden = true;
      }, 180);
      if (helpReturn && helpReturn.focus) helpReturn.focus({ preventScroll: true });
    }

    function bindControls() {
      document.getElementById("reset-btn")?.addEventListener("click", reset);
      panelBackButton?.addEventListener("click", returnToOverview);
      undoButton?.addEventListener("click", undo);
      againButton?.addEventListener("click", () => {
        if (campaign.completed) {
          global.DodecaCampaign.resetCampaign(campaign);
          renderer.setLayout(layout, campaign);
          stopTimer();
          hideBanner();
          updateUI();
        } else retry();
      });
      returnButton?.addEventListener("click", returnToOverview);
      helpButton?.addEventListener("click", openHelp);
      helpClose?.addEventListener("click", closeHelp);
      helpDone?.addEventListener("click", closeHelp);
      helpOverlay?.addEventListener("click", (event) => {
        if (event.target === helpOverlay) closeHelp();
      });
      helpPanel?.addEventListener("click", (event) => event.stopPropagation());
      document.getElementById("size-btn")?.addEventListener("click", () => {
        const index = SIZE_ORDER.indexOf(state.difficulty);
        setSize(SIZE_ORDER[(index + 1) % SIZE_ORDER.length]);
      });
      document.getElementById("theme-btn")?.addEventListener("click", cycleTheme);
      document.getElementById("nest-btn")?.addEventListener("click", () => {
        const styles = ["numerals", "rings", "yellow"];
        setCountStyle(styles[(styles.indexOf(state.countStyle) + 1) % styles.length]);
      });
      document.getElementById("flag-toggle")?.addEventListener("click", () => {
        setFlagMode(!state.flagMode);
      });

      const invert = document.querySelector('#help-controls [data-ctl="invert"]');
      invert?.addEventListener("click", () => {
        const next = state.invertDragX
          ? state.invertDragY
            ? 0
            : 2
          : state.invertDragY
            ? 3
            : 1;
        state.invertDragX = next === 1 || next === 3;
        state.invertDragY = next === 2 || next === 3;
        invert.textContent =
          next === 0 ? "Invert off" : next === 1 ? "Invert X" : next === 2 ? "Invert Y" : "Invert X + Y";
        saveSettings();
      });
      const effects = document.querySelector('#help-controls [data-ctl="effects"]');
      effects?.addEventListener("click", () => {
        const modes = ["auto", "full", "reduced"];
        state.effectsMode = modes[(modes.indexOf(state.effectsMode) + 1) % modes.length];
        effects.textContent = `Effects ${state.effectsMode}`;
        saveSettings();
      });

      document.addEventListener("keydown", (event) => {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) return;
        if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
          event.preventDefault();
          if (helpOverlay?.classList.contains("open")) closeHelp();
          else openHelp();
        } else if (event.key === "Escape" && helpOverlay?.classList.contains("open")) {
          event.preventDefault();
          closeHelp();
        } else if (event.key.toLowerCase() === "f") {
          setFlagMode(!state.flagMode);
        } else if (event.key.toLowerCase() === "r") {
          reset();
        } else if (event.key.toLowerCase() === "t") {
          cycleTheme();
        } else if (event.key.toLowerCase() === "n") {
          const styles = ["numerals", "rings", "yellow"];
          setCountStyle(styles[(styles.indexOf(state.countStyle) + 1) % styles.length]);
        } else if (/^[123]$/.test(event.key)) {
          setSize(SIZE_ORDER[Number(event.key) - 1]);
        }
      });
      global.addEventListener("pagehide", persist);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") persist();
      });
    }

    function setFlagMode(on) {
      state.flagMode = !!on;
      const button = document.getElementById("flag-toggle");
      if (button) {
        button.setAttribute("aria-pressed", state.flagMode ? "true" : "false");
        button.classList.toggle("active", state.flagMode);
      }
    }

    bindControls();
    syncSizeButton();
    syncDerivedState();
    applyAppearance();
    updateUI(false);
    if (campaign.panels.some((panel) => panel.board.started)) startTimer();

    if (campaign.activePanel >= 0) renderer.focus(campaign.activePanel);
    try {
      const skipWelcome = new URLSearchParams(location.search).get("welcome") === "0";
      if (!skipWelcome && !localStorage.getItem("hexsweeper-dodeca-welcome-v1")) {
        openHelp();
        localStorage.setItem("hexsweeper-dodeca-welcome-v1", "1");
      }
    } catch (_) {}

    const api = {
      reset,
      undo,
      canUndo: () => !!campaign.undoSnapshot,
      getState: () => {
        syncDerivedState();
        return state;
      },
      setSize,
      setCountStyle,
      setRelief,
      setSeams,
      setAppearanceAxes,
      setAppearancePack: () => {},
      getAppearance: () => ({
        pack: state.appearancePack,
        axes: Object.assign({}, state.appearanceAxes),
        relief: state.relief,
        seams: state.seams,
      }),
      setFlagMode,
      getThemeIndex: () => (state.appearanceAxes.field === "dark" ? 1 : 0),
      setThemeIndex: (index) => {
        const dark = Number(index) % 2 === 1;
        setAppearanceAxes(
          dark
            ? { field: "dark", shell: "dark", well: "light" }
            : { field: "light", shell: "light", well: "dark" }
        );
      },
      pauseTimer: () => {
        paused = true;
        stopTimer();
      },
      resumeTimer: () => {
        paused = false;
        startTimer();
      },
      getSphereScreen: () => renderer.getScreen(),
      setChromeProjection: () => {},
      setChromeShell: () => {},
      getInvertDrag: () => ({ x: state.invertDragX, y: state.invertDragY }),
      setInvertDragX: (on) => {
        state.invertDragX = !!on;
        saveSettings();
      },
      setInvertDragY: (on) => {
        state.invertDragY = !!on;
        saveSettings();
      },
      getCampaign: () => campaign,
      getLayout: () => layout,
      renderer,
    };
    global.DodecaGame = api;
    return api;
  }

  global.SphereSweeper = {
    boot,
    THEMES,
    CONFIG: {
      pocket: { cellRadius: 2 },
      standard: { cellRadius: 3 },
      deep: { cellRadius: 4 },
    },
    DEFAULT_THEME: THEMES[0],
  };
})(window);
