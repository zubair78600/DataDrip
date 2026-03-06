(() => {
  if (window.__gmapsExtractorOverlayInjected && window.__gmapsExtractorOverlayApi) {
    window.__gmapsExtractorOverlayApi.show();
    return;
  }

  const CSV_COLUMNS = [
    { key: "name", label: "Name" },
    { key: "description", label: "Description" },
    { key: "fulladdress", label: "Fulladdress" },
    { key: "street", label: "Street" },
    { key: "municipality", label: "Municipality" },
    { key: "categories", label: "Categories" },
    { key: "time_zone", label: "Time Zone" },
    { key: "amenities", label: "Amenities" },
    { key: "phone", label: "Phone" },
    { key: "phones", label: "Phones" },
    { key: "claimed", label: "Claimed" },
    { key: "review_count", label: "Review Count" },
    { key: "average_rating", label: "Average Rating" },
    { key: "review_url", label: "Review URL" },
    { key: "google_maps_url", label: "Google Maps URL" },
    { key: "latitude", label: "Latitude" },
    { key: "longitude", label: "Longitude" },
    { key: "website", label: "Website" },
    { key: "domain", label: "Domain" },
    { key: "opening_hours", label: "Opening Hours" },
    { key: "featured_image", label: "Featured Image" },
    { key: "cid", label: "Cid" },
    { key: "fid", label: "Fid" },
    { key: "place_id", label: "Place Id" }
  ];

  const OVERLAY_ID = "gmaps-extractor-overlay";
  const HEARTBEAT_MS = 900;
  const DISCOVERY_SCROLL_WAIT_MS = 250;
  const FIND_SCROLL_WAIT_MS = 80;
  const DETAIL_WAIT_MS = 200;
  const RESULTS_WAIT_MS = 5000;
  const DETAIL_OPEN_TIMEOUT_MS = 3000;

  const state = {
    rowsMap: new Map(),
    queue: [],
    processingIndex: 0,
    isRunning: false,
    isPaused: false,
    pendingStart: false,
    runToken: 0,
    status: "Enter a Google Maps search to begin.",
    extractedTotal: 0,
    discoveredTotal: 0,
    limit: null,
    selectedColumns: new Set(CSV_COLUMNS.map(c => c.key)),
    lastUrl: window.location.href,
    searchQuery: getSearchQuery(window.location.href)
  };

  let overlay = null;

  injectStyles();
  overlay = createOverlay();
  document.documentElement.appendChild(overlay.root);
  render();
  startHeartbeat();

  window.__gmapsExtractorOverlayApi = {
    show: showOverlay,
    start: startScraping,
    pause: pauseScraping,
    resume: resumeScraping,
    download: downloadCsv
  };
  window.__gmapsExtractorOverlayInjected = true;

  function createOverlay() {
    const root = document.createElement("section");
    root.id = OVERLAY_ID;
    root.innerHTML = `
      <div class="gmx-header">
        <div class="gmx-logo-group">
          <div class="gmx-title">DataDrip</div>
          <div class="gmx-pulse"></div>
        </div>
        <div class="gmx-header-actions">
          <button type="button" class="gmx-icon-btn" data-action="settings" title="Settings">⚙</button>
          <button type="button" class="gmx-icon-btn" data-action="hide" title="Close">×</button>
        </div>
      </div>
      <div id="gmx-settings-panel" class="gmx-settings-panel">
        <div class="gmx-settings-view active" data-view="menu">
          <div class="gmx-settings-header">
            <span>Settings</span>
          </div>
          <div class="gmx-menu-list">
            <button type="button" class="gmx-menu-item" data-nav="csv">
              <span>CSV Format</span>
              <span class="gmx-chevron">›</span>
            </button>
            <button type="button" class="gmx-menu-item" data-nav="about">
              <span>About</span>
              <span class="gmx-chevron">›</span>
            </button>
          </div>
          <button type="button" class="gmx-settings-done" data-action="settings-done">Close</button>
        </div>

        <div class="gmx-settings-view" data-view="csv">
          <div class="gmx-settings-header">
            <button type="button" class="gmx-back-btn" data-nav="menu">‹ Back</button>
            <span>CSV Columns</span>
          </div>
          <div class="gmx-settings-bulk">
            <button type="button" data-action="select-all">All</button>
            <button type="button" data-action="select-none">None</button>
          </div>
          <div class="gmx-settings-list">
            ${CSV_COLUMNS.map(col => `
              <label class="gmx-col-toggle">
                <input type="checkbox" value="${col.key}" ${state.selectedColumns.has(col.key) ? 'checked' : ''}>
                <span>${col.label}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="gmx-settings-view" data-view="about">
          <div class="gmx-settings-header">
            <button type="button" class="gmx-back-btn" data-nav="menu">‹ Back</button>
            <span>About</span>
          </div>
          <div class="gmx-about-content">
            <div class="gmx-about-logo">DataDrip</div>
            <div class="gmx-about-version">Version 1.3.0</div>
            <div class="gmx-about-info">
              <p>Premium Google Maps data extraction utility.</p>
              <div class="gmx-credit">
                <strong>Build by Zubair</strong><br>
                <span>zubair78600@gmail.com</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="gmx-body">
        <div class="gmx-stats">
          <div class="gmx-stat" title="Current Status">
            <div class="gmx-stat-header-row">
              <span class="gmx-stat-label">Status</span>
              <div class="gmx-limit-inline" title="Extraction Limit">
                <span>Limit:</span>
                <input type="number" data-role="limit" placeholder="∞" min="1" step="1">
              </div>
            </div>
            <div class="gmx-stat-value" data-role="status">Ready</div>
          </div>
          <div class="gmx-stat-grid">
            <div class="gmx-stat" title="Extracted Places">
              <span class="gmx-stat-label">Extracted</span>
              <div class="gmx-stat-value" data-role="extracted">0</div>
            </div>
            <div class="gmx-stat" title="Total Discovered">
              <span class="gmx-stat-label">Discovered</span>
              <div class="gmx-stat-value" data-role="discovered">0</div>
            </div>
          </div>
        </div>
        <div class="gmx-actions">
          <button type="button" data-action="start" class="gmx-btn-primary">Start</button>
          <button type="button" data-action="download" class="gmx-btn-secondary">Download CSV</button>
          <div class="gmx-action-row">
            <button type="button" data-action="pause" class="gmx-btn-mini">Pause</button>
            <button type="button" data-action="resume" class="gmx-btn-mini">Resume</button>
            <button type="button" data-action="reset" class="gmx-btn-mini">Reset</button>
          </div>
        </div>
        <div class="gmx-note" data-role="note"></div>
      </div>
    `;

    const elements = {
      root,
      status: root.querySelector('[data-role="status"]'),
      extracted: root.querySelector('[data-role="extracted"]'),
      discovered: root.querySelector('[data-role="discovered"]'),
      note: root.querySelector('[data-role="note"]'),
      start: root.querySelector('[data-action="start"]'),
      pause: root.querySelector('[data-action="pause"]'),
      resume: root.querySelector('[data-action="resume"]'),
      download: root.querySelector('[data-action="download"]'),
      reset: root.querySelector('[data-action="reset"]'),
      settings: root.querySelector('[data-action="settings"]'),
      hide: root.querySelector('[data-action="hide"]'),
      limit: root.querySelector('[data-role="limit"]'),
      settingsPanel: root.querySelector('#gmx-settings-panel'),
      settingsDone: root.querySelector('[data-action="settings-done"]'),
      selectAll: root.querySelector('[data-action="select-all"]'),
      selectNone: root.querySelector('[data-action="select-none"]')
    };

    elements.limit.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      state.limit = (!isNaN(val) && val > 0) ? val : null;
    });

    elements.settings.addEventListener("click", () => {
      const isActive = elements.settingsPanel.classList.toggle("active");
      if (isActive) showSettingsView("menu");
    });

    elements.settingsDone.addEventListener("click", () => {
      elements.settingsPanel.classList.remove("active");
    });

    root.querySelectorAll("[data-nav]").forEach(btn => {
      btn.addEventListener("click", () => {
        showSettingsView(btn.getAttribute("data-nav"));
      });
    });

    function showSettingsView(viewName) {
      root.querySelectorAll(".gmx-settings-view").forEach(v => {
        v.classList.toggle("active", v.getAttribute("data-view") === viewName);
      });
    }

    elements.selectAll.addEventListener("click", () => {
      const checks = elements.settingsPanel.querySelectorAll('input[type="checkbox"]');
      checks.forEach(c => {
        c.checked = true;
        state.selectedColumns.add(c.value);
      });
    });

    elements.selectNone.addEventListener("click", () => {
      const checks = elements.settingsPanel.querySelectorAll('input[type="checkbox"]');
      checks.forEach(c => {
        c.checked = false;
        state.selectedColumns.delete(c.value);
      });
    });

    elements.settingsPanel.addEventListener("change", (e) => {
      if (e.target.tagName === "INPUT") {
        if (e.target.checked) state.selectedColumns.add(e.target.value);
        else state.selectedColumns.delete(e.target.value);
      }
    });

    elements.start.addEventListener("click", startScraping);
    elements.pause.addEventListener("click", pauseScraping);
    elements.resume.addEventListener("click", resumeScraping);
    elements.download.addEventListener("click", downloadCsv);
    elements.reset.addEventListener("click", resetScraper);
    elements.hide.addEventListener("click", () => {
      root.style.display = "none";
    });

    makeDraggable(root, root.querySelector(".gmx-header"));
    return elements;
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap');

      #${OVERLAY_ID} {
        position: fixed;
        top: 24px;
        right: 24px;
        width: 320px;
        z-index: 2147483647;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.85);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        font-family: 'Outfit', sans-serif;
        color: #1a1f36;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
        animation: gmx-slide-in 0.5s ease-out;
      }

      @keyframes gmx-slide-in {
        from { transform: translateX(120%) scale(0.9); opacity: 0; }
        to { transform: translateX(0) scale(1); opacity: 1; }
      }

      #${OVERLAY_ID}.gmx-dragging {
        transition: none !important;
        cursor: grabbing !important;
      }

      #${OVERLAY_ID}.gmx-minimized {
        width: 180px;
      }

      #${OVERLAY_ID}.gmx-minimized .gmx-body {
        max-height: 0;
        padding: 0;
        opacity: 0;
      }

      #${OVERLAY_ID} * {
        box-sizing: border-box;
      }

      #${OVERLAY_ID} .gmx-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        cursor: move;
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        color: #ffffff;
        user-select: none;
      }

      #${OVERLAY_ID} .gmx-logo-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      #${OVERLAY_ID} .gmx-title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      #${OVERLAY_ID} .gmx-pulse {
        width: 8px;
        height: 8px;
        background: #10b981;
        border-radius: 50%;
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        animation: gmx-pulse 2s infinite;
      }

      @keyframes gmx-pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      }

      #${OVERLAY_ID} .gmx-header-actions {
        display: flex;
        gap: 4px;
      }

      #${OVERLAY_ID} .gmx-icon-btn {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.15);
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-weight: bold;
        transition: background 0.2s;
      }

      #${OVERLAY_ID} .gmx-icon-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      #${OVERLAY_ID} .gmx-body {
        padding: 14px;
        transition: all 0.3s;
      }

      #${OVERLAY_ID} .gmx-stats {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 14px;
      }

      #${OVERLAY_ID} .gmx-stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      #${OVERLAY_ID} .gmx-stat {
        padding: 10px;
        border-radius: 12px;
        background: rgba(241, 245, 249, 0.6);
        border: 1px solid rgba(226, 232, 240, 0.8);
        transition: transform 0.2s;
      }

      #${OVERLAY_ID} .gmx-stat:hover {
        transform: translateY(-2px);
      }

      #${OVERLAY_ID} .gmx-stat-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2px;
      }

      #${OVERLAY_ID} .gmx-limit-inline {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: #4f46e5;
        font-weight: 700;
        background: rgba(99, 102, 241, 0.1);
        padding: 2px 6px;
        border-radius: 6px;
      }

      #${OVERLAY_ID} .gmx-limit-inline input {
        width: 32px;
        border: none;
        background: transparent;
        padding: 0;
        font: inherit;
        color: inherit;
        outline: none;
        text-align: center;
      }

      #${OVERLAY_ID} .gmx-limit-inline input::placeholder {
        color: rgba(79, 70, 229, 0.4);
      }

      #${OVERLAY_ID} .gmx-stat-value {
        font-size: 14px;
        font-weight: 700;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #${OVERLAY_ID} .gmx-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      #${OVERLAY_ID} .gmx-action-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }

      #${OVERLAY_ID} .gmx-btn-primary {
        background: #4f46e5;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
      }

      #${OVERLAY_ID} .gmx-btn-primary:hover {
        background: #4338ca;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
      }

      #${OVERLAY_ID} .gmx-btn-secondary {
        background: #ffffff;
        color: #4f46e5;
        border: 1.5px solid #e0e7ff;
        padding: 10px;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      #${OVERLAY_ID} .gmx-btn-secondary:hover:not(:disabled) {
        background: #f8faff;
        border-color: #6366f1;
      }

      #${OVERLAY_ID} .gmx-btn-mini {
        background: #f1f5f9;
        color: #475569;
        border: none;
        padding: 8px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      #${OVERLAY_ID} .gmx-btn-mini:hover:not(:disabled) {
        background: #e2e8f0;
        color: #1e293b;
      }

      #${OVERLAY_ID} .gmx-settings-panel {
        position: absolute;
        top: 48px; /* Below header */
        left: 0;
        width: 100%;
        height: calc(100% - 48px);
        background: rgba(255, 255, 255, 0.98);
        z-index: 100;
        transform: translateY(100%);
        transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
        display: flex;
        flex-direction: column;
        padding: 16px;
      }

      #${OVERLAY_ID} .gmx-settings-panel.active {
        transform: translateY(0);
      }

      #${OVERLAY_ID} button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        filter: grayscale(1);
      }

      #${OVERLAY_ID} .gmx-note {
        margin-top: 12px;
        padding: 8px 12px;
        border-radius: 10px;
        background: rgba(241, 245, 249, 0.4);
        color: #64748b;
        font-size: 11px;
        line-height: 1.4;
        border-left: 3px solid #6366f1;
      }

      #${OVERLAY_ID} .gmx-settings-view {
        display: none;
        flex-direction: column;
        height: 100%;
      }

      #${OVERLAY_ID} .gmx-settings-view.active {
        display: flex;
      }

      #${OVERLAY_ID} .gmx-settings-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        font-weight: 700;
        color: #1e293b;
        font-size: 15px;
      }

      #${OVERLAY_ID} .gmx-back-btn {
        background: #f1f5f9;
        border: none;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        cursor: pointer;
      }

      #${OVERLAY_ID} .gmx-menu-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
      }

      #${OVERLAY_ID} .gmx-menu-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        color: #1e293b;
        text-align: left;
      }

      #${OVERLAY_ID} .gmx-menu-item:hover {
        background: #f1f5f9;
        border-color: #6366f1;
      }

      #${OVERLAY_ID} .gmx-chevron {
        color: #6366f1;
        font-size: 16px;
      }

      #${OVERLAY_ID} .gmx-settings-bulk {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
      }

      #${OVERLAY_ID} .gmx-settings-bulk button {
        background: none;
        border: 1px solid #e2e8f0;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        cursor: pointer;
        color: #64748b;
      }

      #${OVERLAY_ID} .gmx-settings-list {
        flex: 1;
        overflow-y: auto;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-bottom: 12px;
        padding-right: 4px;
      }

      #${OVERLAY_ID} .gmx-col-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        background: #f8fafc;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 11px;
        font-weight: 600;
      }

      #${OVERLAY_ID} .gmx-col-toggle:hover {
        background: #f1f5f9;
      }

      #${OVERLAY_ID} .gmx-col-toggle input {
        width: 14px;
        height: 14px;
        accent-color: #6366f1;
        cursor: pointer;
      }

      #${OVERLAY_ID} .gmx-about-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 12px;
      }

      #${OVERLAY_ID} .gmx-about-logo {
        font-size: 24px;
        font-weight: 800;
        color: #4f46e5;
        letter-spacing: -0.04em;
      }

      #${OVERLAY_ID} .gmx-about-version {
        font-size: 11px;
        background: #e0e7ff;
        color: #4338ca;
        padding: 2px 8px;
        border-radius: 100px;
        font-weight: 700;
      }

      #${OVERLAY_ID} .gmx-about-info {
        font-size: 12px;
        color: #64748b;
        line-height: 1.5;
      }

      #${OVERLAY_ID} .gmx-credit {
        margin-top: 16px;
        padding: 12px;
        background: #f1f5f9;
        border-radius: 12px;
        width: 100%;
      }

      #${OVERLAY_ID} .gmx-credit strong {
        color: #1e293b;
        font-size: 13px;
      }

      #${OVERLAY_ID} .gmx-settings-done {
        background: #6366f1;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
        width: 100%;
      }
    `;

    document.documentElement.appendChild(style);
  }

  function makeDraggable(target, handle) {
    let dragState = null;

    handle.addEventListener("mousedown", (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button")) {
        return;
      }

      const rect = target.getBoundingClientRect();
      dragState = {
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };

      target.classList.add("gmx-dragging");
      target.style.right = "auto";
      event.preventDefault();
    });

    window.addEventListener("mousemove", (event) => {
      if (!dragState) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;

      const nextLeft = Math.max(8, dragState.left + deltaX);
      const nextTop = Math.max(8, dragState.top + deltaY);

      requestAnimationFrame(() => {
        if (!dragState) return;
        target.style.left = `${nextLeft}px`;
        target.style.top = `${nextTop}px`;
      });
    });

    window.addEventListener("mouseup", () => {
      if (dragState) {
        target.classList.remove("gmx-dragging");
        dragState = null;
      }
    });
  }

  function startHeartbeat() {
    window.setInterval(() => {
      const urlChanged = state.lastUrl !== window.location.href;
      if (urlChanged) {
        state.lastUrl = window.location.href;
        state.searchQuery = getSearchQuery(window.location.href);
        if (!state.isRunning && !state.isPaused && !state.pendingStart) {
          state.status = getIdleStatus();
        }
      }

      if (state.pendingStart && !state.isRunning && findResultsContainer()) {
        state.pendingStart = false;
        startScraping();
        return;
      }

      render();
    }, HEARTBEAT_MS);
  }

  function injectInterceptorIfNeeded() {
    if (window.__gmapsInterceptorInjected) return;
    window.__gmapsInterceptorInjected = true;
    const scriptUrl = chrome.runtime.getURL("injected.js");
    const scriptEl = document.createElement("script");
    scriptEl.src = scriptUrl;
    (document.head || document.documentElement).appendChild(scriptEl);

    window.addEventListener('gmaps-data-intercepted', handleInterceptedData);
  }

  // We call this right away to catch early requests
  injectInterceptorIfNeeded();

  async function startScraping() {
    if (state.isRunning) {
      if (state.isPaused) {
        resumeScraping();
      }
      return;
    }

    const resultsContainer = findResultsContainer();
    if (!resultsContainer) {
      state.pendingStart = true;
      state.status = "Waiting for Google Maps search results...";
      render();
      return;
    }

    state.pendingStart = false;
    state.isRunning = true;
    state.isPaused = false;
    state.runToken += 1;
    state.processingIndex = 0;
    state.queue = [];

    const runToken = state.runToken;
    console.log("[Overlay] Starting rapid extraction via card scraping...");
    state.status = "Starting rapid extraction...";
    render();

    try {
      await rapidScrollAndExtract(runToken);
    } catch (error) {
      state.isRunning = false;
      state.status = error.message || "Scrape failed.";
      render();
      console.error("[Overlay] Scrape failed:", error);
    }
  }

  async function rapidScrollAndExtract(runToken) {
    const container = findResultsContainer();
    if (!container) {
      throw new Error("Google Maps results panel not found.");
    }

    let stablePasses = 0;
    let lastHeight = 0;

    // Immediate first scrape before scrolling
    scrapeVisibleCards(container);
    state.status = "Rapid extracting... " + state.rowsMap.size + " places found";
    render();

    container.scrollTo({ top: 0, behavior: "auto" });
    await wait(100);

    while (state.runToken === runToken) {
      await waitWhilePaused(runToken);

      if (state.limit && state.rowsMap.size >= state.limit) {
        break;
      }

      const currentHeight = container.scrollHeight;
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 6;

      if (currentHeight === lastHeight && atBottom) {
        stablePasses += 1;
      } else {
        stablePasses = 0;
      }

      if (stablePasses >= 4) {
        break;
      }

      lastHeight = currentHeight;

      const nextTop = Math.min(
        container.scrollTop + Math.floor(container.clientHeight * 0.9),
        container.scrollHeight
      );
      container.scrollTo({ top: nextTop, behavior: "auto" });
      await wait(80);

      scrapeVisibleCards(container);
      state.status = "Rapid extracting... " + state.rowsMap.size + " places found";
      render();
    }

    // Quick final pass from top
    container.scrollTo({ top: 0, behavior: "auto" });
    await wait(100);
    scrapeVisibleCards(container);

    state.isRunning = false;
    state.isPaused = false;
    state.status = "Completed. " + state.rowsMap.size + " rows extracted.";
    render();
  }

  function scrapeVisibleCards(container) {
    const anchors = Array.from(container.querySelectorAll('a[href*="/maps/place/"]'));

    for (const anchor of anchors) {
      if (state.limit && state.rowsMap.size >= state.limit) break;

      const listingUrl = sanitizeUrl(anchor.href || "");
      if (!listingUrl) continue;

      const key = normalizeKey(listingUrl);
      if (state.rowsMap.has(key)) continue;

      const card = findListingCard(anchor, container);
      if (!card) continue;
      const name = extractName(card);
      if (!name) continue;

      const identifiers = parseIdentifiers([listingUrl]);

      const cardText = card.innerText || "";
      const ratingMatch = cardText.match(/(\d\.\d)\s*\((\d[\d,]*)\)/);
      const averageRating = ratingMatch ? ratingMatch[1] : "";
      const reviewCount = ratingMatch ? ratingMatch[2].replace(/,/g, "") : "";

      const phoneRegex = /(?:\+\d{1,3}\s?)?(?:\(?\d{3,5}\)?[\s.\-]?)?\d{3,5}[\s.\-]?\d{4,5}/g;
      const phoneMatches = cardText.match(phoneRegex);
      let phone = "";
      if (phoneMatches) {
        for (let i = 0; i < phoneMatches.length; i++) {
          if (phoneMatches[i].replace(/\D/g, "").length >= 10) {
            phone = phoneMatches[i];
            break;
          }
        }
        if (!phone) phone = phoneMatches[0] || "";
      }

      const lines = cardText.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      let address = "";
      let category = "";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === name) continue;
        if (/^\d\.\d/.test(line)) continue;
        if (/^Closed|^Open |^Delivery|^Dine-in|^Takeaway/i.test(line) && line.length < 60) continue;
        if (line.indexOf("\xb7") !== -1 && !category) {
          const parts = line.split("\xb7").map(function (p) { return p.trim(); });
          category = parts[0] || "";
          if (parts.length > 1) {
            address = parts.slice(1).join(", ").trim();
          }
          continue;
        }
        if (line.indexOf(",") !== -1 && !address && !/Directions|Website|Phone/i.test(line)) {
          address = line;
        }
      }

      let website = "";
      const allAnchors = card.querySelectorAll("a[href]");
      for (let i = 0; i < allAnchors.length; i++) {
        const href = allAnchors[i].href || "";
        if (href.indexOf("http") === 0 && !/google\./i.test(href) && href.indexOf("/maps/place/") === -1) {
          website = href;
          break;
        }
      }

      const img = card.querySelector("img[src*='googleusercontent.com'], img[src*='gstatic.com']");
      const featuredImage = sanitizeUrl(img ? img.src : "");

      const addressParts = splitAddress(address);

      let openingHours = "";
      for (const line of lines) {
        if (/^Open\s*(\xb7|24\s*hours)|Closed\s*\xb7/i.test(line)) {
          openingHours = line;
          break;
        }
      }

      state.rowsMap.set(key, {
        name: name,
        description: "",
        fulladdress: address,
        street: addressParts.street,
        municipality: addressParts.municipality,
        categories: category,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        amenities: "",
        phone: phone,
        phones: phone,
        claimed: "",
        review_count: reviewCount,
        average_rating: averageRating,
        review_url: identifiers.placeId ? "https://search.google.com/local/reviews?placeid=" + identifiers.placeId : "",
        google_maps_url: listingUrl,
        latitude: identifiers.latitude,
        longitude: identifiers.longitude,
        website: website,
        domain: safeUrlDomain(website),
        opening_hours: openingHours,
        featured_image: featuredImage,
        cid: identifiers.cid,
        fid: identifiers.fid,
        place_id: identifiers.placeId
      });
      state.extractedTotal = state.rowsMap.size;
      state.discoveredTotal = state.rowsMap.size;
    }

    render();
  }

  function safeUrlDomain(websiteUrl) {
    try {
      if (!websiteUrl) return "";
      return new URL(websiteUrl).hostname.replace("www.", "");
    } catch (e) {
      return "";
    }
  }

  function handleInterceptedData(event) {
    if (!state.isRunning) return;
    const { url, str } = event.detail;
    try {
      const jsonStr = str.replace(")]}'\\n", "").replace(")]}'\\n", "");
      const cleanStr = jsonStr.startsWith(")]}'") ? jsonStr.substring(4).trim() : jsonStr.trim();
      const data = JSON.parse(cleanStr);

      const beforeCount = state.rowsMap.size;
      findPlacesRecursively(data);
      if (state.rowsMap.size > beforeCount) {
        console.log(`[Overlay] Intercepted Map JSON. Added ${state.rowsMap.size - beforeCount} places! URL: ${url}`);
      }
    } catch (e) {
      console.warn("[Overlay] Failed to parse intercepted JSON", e);
    }
  }

  function findPlacesRecursively(node) {
    if (!Array.isArray(node)) return;

    if (node.length >= 15 && typeof node[11] === 'string' && Array.isArray(node[14])) {
      const title = node[11].trim();
      const detailsArray = node[14];
      const placeIdMatch = JSON.stringify(detailsArray).match(/(ChI[A-Za-z0-9_-]+)/);

      if (title && title.length > 0 && placeIdMatch) {
        parsePlaceNode(node, title, placeIdMatch[1]);
        return;
      }
    }

    for (const child of node) {
      if (Array.isArray(child)) {
        findPlacesRecursively(child);
      }
    }
  }

  function parsePlaceNode(node, title, placeId) {
    const nodeStr = JSON.stringify(node);

    const phoneMatch = nodeStr.match(/"((\+\d{1,3}\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4})"/);
    const phone = phoneMatch ? phoneMatch[1] : "";

    const websiteMatch = nodeStr.match(/"(https?:\/\/(?!www\.google|policies\.google\.com|schema\.org)[^"]+)"/);
    const website = websiteMatch ? websiteMatch[1].replace(/\\/g, "") : "";

    // Opening Hours Search in JSON
    let openingHours = "";
    const hoursMatch = nodeStr.match(/"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday): [^"]+"/g);
    if (hoursMatch) {
      openingHours = hoursMatch.map(h => h.replace(/"/g, "")).join(", ");
    } else {
      const openNowMatch = nodeStr.match(/"(Open [^"]+)"|"(Closed [^"]+)"/);
      if (openNowMatch) openingHours = openNowMatch[1] || openNowMatch[2];
    }

    const ratingMatch = nodeStr.match(/\[(\d\.\d),(\d+)\]/);
    const rating = ratingMatch ? ratingMatch[1] : "";
    const reviews = ratingMatch ? ratingMatch[2] : "";

    const coordsMatch = nodeStr.match(/\[(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})\]/);
    const lat = coordsMatch ? coordsMatch[1] : "";
    const lng = coordsMatch ? coordsMatch[2] : "";

    const key = placeId || title;
    if (!state.rowsMap.has(key)) {
      state.rowsMap.set(key, {
        name: title,
        description: "",
        fulladdress: "",
        street: "",
        municipality: "",
        categories: "",
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        amenities: "",
        phone: phone,
        phones: phone,
        claimed: "",
        review_count: reviews,
        average_rating: rating,
        review_url: placeId ? "https://search.google.com/local/reviews?placeid=" + placeId : "",
        google_maps_url: "https://www.google.com/maps/place/?q=place_id:" + placeId,
        latitude: lat,
        longitude: lng,
        website: website,
        domain: safeUrlDomain(website),
        opening_hours: openingHours,
        featured_image: "",
        cid: "",
        fid: "",
        place_id: placeId
      });
      state.extractedTotal = state.rowsMap.size;
      state.discoveredTotal = state.rowsMap.size;
      state.status = "Rapid Extracting: " + state.extractedTotal + " places...";
      render();
    }
  }

  function pauseScraping() {
    if (!state.isRunning) {
      return;
    }

    state.isPaused = true;
    state.pendingStart = false;
    state.status = "Paused. You can download the partial CSV.";
    render();
  }

  function resumeScraping() {
    if (!state.isRunning || !state.isPaused) {
      return;
    }

    state.isPaused = false;
    state.status = "Resuming...";
    render();
  }

  function resetScraper() {
    state.runToken += 1;
    state.rowsMap.clear();
    state.queue = [];
    state.processingIndex = 0;
    state.isRunning = false;
    state.isPaused = false;
    state.pendingStart = false;
    state.extractedTotal = 0;
    state.discoveredTotal = 0;
    if (overlay) {
      if (overlay.limit) overlay.limit.value = "";
      if (overlay.settingsPanel) {
        const checks = overlay.settingsPanel.querySelectorAll('input[type="checkbox"]');
        checks.forEach(c => {
          c.checked = true;
          state.selectedColumns.add(c.value);
        });
      }
      state.limit = null;
    }
    state.status = getIdleStatus();
    render();
  }

  async function discoverAllListings(runToken) {
    const container = findResultsContainer();
    if (!container) {
      throw new Error("Google Maps results panel not found.");
    }

    const map = new Map();
    let stablePasses = 0;
    let lastHeight = 0;
    let lastCount = 0;

    container.scrollTo({ top: 0, behavior: "auto" });
    await wait(400);

    while (state.runToken === runToken) {
      await waitWhilePaused(runToken);

      const summaries = collectListingSummaries(container);
      for (const summary of summaries) {
        map.set(summary.key, summary);
      }

      state.queue = Array.from(map.values());
      state.discoveredTotal = state.queue.length;
      state.status = `Collecting result list... ${state.discoveredTotal} found`;
      render();

      const currentHeight = container.scrollHeight;
      const currentCount = summaries.length;
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 6;

      if (currentHeight === lastHeight && currentCount === lastCount && atBottom) {
        stablePasses += 1;
      } else {
        stablePasses = 0;
      }

      if (stablePasses >= 3) {
        break;
      }

      lastHeight = currentHeight;
      lastCount = currentCount;

      const nextTop = Math.min(
        container.scrollTop + Math.floor(container.clientHeight * 0.9),
        container.scrollHeight
      );
      container.scrollTo({ top: nextTop, behavior: "auto" });
      console.log("[Overlay] Discover scroll:", nextTop, "found:", state.discoveredTotal);
      await wait(DISCOVERY_SCROLL_WAIT_MS);
    }

    container.scrollTo({ top: 0, behavior: "auto" });
    await wait(500);
  }

  async function processQueue(runToken) {
    for (; state.processingIndex < state.queue.length; state.processingIndex += 1) {
      if (state.runToken !== runToken) {
        return;
      }

      await waitWhilePaused(runToken);

      const summary = state.queue[state.processingIndex];
      state.status = `Extracting ${state.processingIndex + 1}/${state.queue.length}: ${summary.name}`;
      render();

      try {
        await ensureResultsView();
        const listingTarget = await findAndRevealListingTarget(summary, runToken);

        if (!listingTarget) {
          console.warn("[Overlay] Could not find clickable listing target:", summary);
          continue;
        }

        const opened = await openListingDetail(summary, listingTarget);
        if (!opened) {
          throw new Error(`Could not open detail panel for ${summary.name}.`);
        }

        await wait(DETAIL_WAIT_MS);

        // Validate we're actually on a detail page, not still on the results list
        const detailTitle = getPlaceTitle();
        if (!detailTitle || detailTitle === "Results" || !findBackButton()) {
          console.warn("[Overlay] Not on detail page after opening, skipping:", summary.name);
          continue;
        }

        const row = scrapePlaceDetail(summary);
        state.rowsMap.set(summary.key, row);
        state.extractedTotal = state.rowsMap.size;
        render();
      } catch (error) {
        console.warn("[Overlay] Failed to extract listing detail:", summary.name, error);
      } finally {
        try {
          await navigateBackToResults();
        } catch (navigationError) {
          console.warn("[Overlay] Failed to return to results:", navigationError);
        }
      }
    }

    state.isRunning = false;
    state.isPaused = false;
    state.status = `Completed. ${state.rowsMap.size} rows extracted.`;
    render();
  }

  async function findAndRevealListingTarget(summary, runToken) {
    const container = findResultsContainer();
    if (!container) {
      return null;
    }

    let attempts = 0;
    while (attempts < 40 && state.runToken === runToken) {
      await waitWhilePaused(runToken);

      const anchor = findListingAnchor(summary, container);
      if (anchor) {
        const card = findListingCard(anchor, container);
        anchor.scrollIntoView({ block: "center", behavior: "auto" });
        await wait(80);
        return { anchor, card };
      }

      const nextTop = Math.min(
        container.scrollTop + Math.floor(container.clientHeight * 0.9),
        container.scrollHeight
      );

      if (nextTop === container.scrollTop) {
        break;
      }

      container.scrollTo({ top: nextTop, behavior: "auto" });
      await wait(FIND_SCROLL_WAIT_MS);
      attempts += 1;
    }

    container.scrollTo({ top: 0, behavior: "auto" });
    await wait(180);

    attempts = 0;
    while (attempts < 40 && state.runToken === runToken) {
      await waitWhilePaused(runToken);

      const anchor = findListingAnchor(summary, container);
      if (anchor) {
        const card = findListingCard(anchor, container);
        anchor.scrollIntoView({ block: "center", behavior: "auto" });
        await wait(80);
        return { anchor, card };
      }

      const nextTop = Math.min(
        container.scrollTop + Math.floor(container.clientHeight * 0.9),
        container.scrollHeight
      );

      if (nextTop === container.scrollTop) {
        break;
      }

      container.scrollTo({ top: nextTop, behavior: "auto" });
      await wait(FIND_SCROLL_WAIT_MS);
      attempts += 1;
    }

    return null;
  }

  async function waitWhilePaused(runToken) {
    while (state.isPaused && state.runToken === runToken) {
      await wait(180);
    }

    if (state.runToken !== runToken) {
      throw new Error("Run cancelled.");
    }
  }

  function collectListingSummaries(container) {
    const cards = collectListingCards(container);
    const results = [];

    for (const card of cards) {
      const anchor = card.querySelector('a[href*="/maps/place/"]');
      const listingUrl = sanitizeUrl(anchor?.href || "");
      const name = extractName(card);
      if (!name || !listingUrl) {
        continue;
      }

      results.push({
        key: normalizeKey(listingUrl),
        name,
        listing_url: listingUrl
      });
    }

    return results;
  }

  function collectListingCards(container) {
    const anchors = Array.from(container.querySelectorAll('a[href*="/maps/place/"]'));
    const cards = new Set();

    for (const anchor of anchors) {
      const card = findListingCard(anchor, container);
      if (card) {
        cards.add(card);
      }
    }

    return Array.from(cards);
  }

  function findListingCard(anchor, container) {
    let current = anchor;

    while (current && current !== container) {
      if (current instanceof HTMLElement) {
        const textLength = normalizeWhitespace(current.innerText).length;
        const placeLinks = current.querySelectorAll('a[href*="/maps/place/"]').length;
        const hasHeading = Boolean(
          current.querySelector(".fontHeadlineSmall, div[role='heading'], h1, h2, h3")
        );

        if (hasHeading && placeLinks >= 1 && textLength > 20 && textLength < 1800) {
          return current;
        }
      }

      current = current.parentElement;
    }

    return anchor.parentElement;
  }

  function extractName(card) {
    const selectors = [".fontHeadlineSmall", "div[role='heading']", "h1", "h2", "h3"];

    for (const selector of selectors) {
      const value = normalizeWhitespace(card.querySelector(selector)?.textContent || "");
      if (value) {
        return value;
      }
    }

    return normalizeWhitespace(card.querySelector('a[href*="/maps/place/"]')?.textContent || "");
  }

  function findListingAnchor(summary, container) {
    const anchors = Array.from(container.querySelectorAll('a[href*="/maps/place/"]'));
    return (
      anchors.find((anchor) => normalizeKey(anchor.href) === summary.key) ||
      anchors.find((anchor) => normalizeKey(anchor.textContent) === normalizeKey(summary.name)) ||
      null
    );
  }

  async function ensureResultsView() {
    if (isResultsViewActive()) {
      return;
    }

    await navigateBackToResults();
    await waitFor(() => isResultsViewActive(), RESULTS_WAIT_MS, 250, "results view");
  }

  function isResultsViewActive() {
    return Boolean(findResultsContainer()) && !isPlaceDetailOpen();
  }

  function isPlaceDetailOpen() {
    const title = getPlaceTitle();
    if (!title || title === "Results" || !findBackButton()) {
      return false;
    }
    // Confirm it's a real place detail by checking for address or category elements
    return Boolean(
      document.querySelector('[data-item-id="address"]') ||
      document.querySelector('button[jsaction*="pane.rating.category"]') ||
      document.querySelector(".DkEaL") ||
      document.querySelector('a[data-item-id="authority"]')
    );
  }

  async function waitForPlaceDetailWithTimeout(summary, timeoutMs) {
    await waitFor(() => {
      const title = getPlaceTitle();
      if (!title || !findBackButton()) {
        return false;
      }

      // Only match by name or by the place URL containing the specific place name
      // Do NOT use a generic "/maps/place/" check as it can match stale URLs from previous listings
      if (namesRoughlyMatch(title, summary.name)) {
        return true;
      }

      // Check if URL changed to a new place (not the same as previous)
      return window.location.href.includes("/maps/place/") && title !== "Results" && title.length > 1;
    }, timeoutMs, 180, `detail panel for ${summary.name}`);
  }

  async function openListingDetail(summary, listingTarget) {
    // Try anchor first — it's the most reliable click target on Google Maps
    const candidates = uniqueElements([
      listingTarget.anchor,
      listingTarget.anchor?.parentElement,
      listingTarget.card?.querySelector('[role="button"]'),
      listingTarget.card?.querySelector("button"),
      listingTarget.card
    ]);

    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) {
        continue;
      }

      candidate.scrollIntoView({ block: "center", behavior: "auto" });
      await wait(100);
      activateElement(candidate);

      try {
        await waitForPlaceDetailWithTimeout(summary, DETAIL_OPEN_TIMEOUT_MS);
        return true;
      } catch (_error) {
        // Try the next clickable candidate.
      }
    }

    // Last resort: navigate directly via the listing URL
    if (summary.listing_url) {
      console.log("[Overlay] Trying direct navigation for:", summary.name);
      window.location.href = summary.listing_url;
      try {
        await waitForPlaceDetailWithTimeout(summary, DETAIL_OPEN_TIMEOUT_MS * 2);
        return true;
      } catch (_error) {
        // Navigation also failed.
      }
    }

    return false;
  }

  function scrapePlaceDetail(summary) {
    const currentUrl = sanitizeUrl(window.location.href);
    const textContent = normalizeWhitespace(document.body.innerText);
    const identifiers = parseIdentifiers([currentUrl, summary.listing_url]);
    const address = extractAddress();
    const addressParts = splitAddress(address);
    const phones = extractPhones();
    const category = extractCategory();
    const website = extractWebsite();
    const domain = safeDomain(website);
    const openingHours = extractOpeningHours();
    const featuredImage = extractFeaturedImage();
    const reviewData = extractReviewData();
    const reviewUrl = buildReviewUrl(identifiers.placeId);
    const claimed = /\bclaimed\b/i.test(textContent) ? "YES" : "";
    const timeZone = normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "");

    return {
      name: getPlaceTitle() || summary.name,
      description: "",
      fulladdress: address,
      street: addressParts.street,
      municipality: addressParts.municipality,
      categories: category,
      time_zone: timeZone,
      amenities: "",
      phone: phones[0] || "",
      phones: formatPhones(phones),
      claimed,
      review_count: reviewData.reviewCount,
      average_rating: reviewData.averageRating,
      review_url: reviewUrl,
      google_maps_url: buildGoogleMapsUrl(identifiers.cid),
      latitude: identifiers.latitude,
      longitude: identifiers.longitude,
      website,
      domain,
      opening_hours: openingHours,
      featured_image: featuredImage,
      cid: identifiers.cid,
      fid: identifiers.fid,
      place_id: identifiers.placeId
    };
  }

  function getPlaceTitle() {
    return firstText(document, [
      "h1.DUwDvf",
      "h1.fontHeadlineLarge",
      "div[role='main'] h1",
      "h1"
    ]);
  }

  function extractAddress() {
    const addressNode = document.querySelector('[data-item-id="address"]');
    if (addressNode) {
      return cleanLabeledText(addressNode);
    }

    const candidates = Array.from(document.querySelectorAll("[data-item-id], button, div, span"))
      .map(cleanLabeledText)
      .filter(Boolean);

    return (
      candidates.find((text) => /,/.test(text) && !/Directions|Website|Phone/i.test(text)) || ""
    );
  }

  function extractPhones() {
    const candidates = Array.from(
      document.querySelectorAll('button[data-item-id*="phone"], a[href^="tel:"], [data-item-id*="phone"]')
    );

    return unique(
      candidates
        .map((element) => {
          if (element instanceof HTMLAnchorElement && element.href.startsWith("tel:")) {
            return normalizeWhitespace(element.href.replace(/^tel:/i, ""));
          }

          return extractPhone(cleanLabeledText(element));
        })
        .filter(Boolean)
    );
  }

  function extractCategory() {
    return (
      firstText(document, [
        'button[jsaction*="pane.rating.category"]',
        ".DkEaL",
        ".skqShb"
      ]) || ""
    );
  }

  function extractWebsite() {
    const authority = document.querySelector('a[data-item-id="authority"]');
    if (authority?.href && !/google\./i.test(authority.href)) {
      return authority.href;
    }

    // Check aria-labels
    const websiteAria = document.querySelector('a[aria-label*="Website:"], a[aria-label="Website"], a[href*="website"]');
    if (websiteAria?.href && !/google\./i.test(websiteAria.href)) {
      return websiteAria.href;
    }

    const link = Array.from(document.querySelectorAll("a[href^='http']"))
      .filter(a => !/google\./i.test(a.href) && !/schema\.org/i.test(a.href))
      .find(a => a.innerText.length > 5 || a.href.length > 10);
    return link?.href || "";
  }

  function extractOpeningHours() {
    const rows = Array.from(document.querySelectorAll("table tr"))
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td, th"))
          .map((cell) => normalizeWhitespace(cell.innerText))
          .filter(Boolean);

        if (cells.length < 2) {
          return null;
        }

        return { day: cells[0], hours: cells[1] };
      })
      .filter(Boolean)
      .filter((row) => /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(row.day));

    if (!rows.length) {
      return "";
    }

    return formatOpeningHours(rows);
  }

  function extractFeaturedImage() {
    const selectors = [
      'button[jsaction*="heroHeaderImage"] img[src]',
      'button[jsaction*="pane.heroHeaderImage"] img[src]',
      'img[src*="googleusercontent.com"][src]',
      'img[src*="gstatic.com"][src]'
    ];

    for (const selector of selectors) {
      const image = document.querySelector(selector);
      const src = sanitizeUrl(image?.currentSrc || image?.src || "");
      if (src) {
        return src;
      }
    }

    return "";
  }

  function extractReviewData() {
    // Prefer aria-labels for accurate rating/review data
    const ariaLabels = Array.from(document.querySelectorAll("[aria-label]"))
      .map((element) => element.getAttribute("aria-label") || "");

    let averageRating = "";
    let reviewCount = "";

    // Look for rating in aria-labels first (most reliable)
    for (const label of ariaLabels) {
      // Match patterns like "4.7 stars" or "Rated 4.7 out of 5"
      const ratingFromLabel =
        label.match(/^([0-9]+(?:\.[0-9]+)?)\s+stars?/i) ||
        label.match(/Rated\s+([0-9]+(?:\.[0-9]+)?)\s+out of/i);
      if (ratingFromLabel && !averageRating) {
        averageRating = ratingFromLabel[1];
      }

      // Match patterns like "114 reviews" or "114 Google reviews"
      const reviewFromLabel =
        label.match(/([0-9][0-9,]*)\s+reviews?/i) ||
        label.match(/([0-9][0-9,]*)\s+Google reviews?/i);
      if (reviewFromLabel && !reviewCount) {
        reviewCount = reviewFromLabel[1];
      }
    }

    // Fallback: scan the detail panel's role="main" section (not full body to avoid list data)
    if (!averageRating || !reviewCount) {
      const mainPanel = document.querySelector('div[role="main"]');
      const panelText = mainPanel ? normalizeWhitespace(mainPanel.innerText) : "";

      if (!averageRating) {
        const ratingFallback = panelText.match(/\b([1-5](?:\.[0-9])?)\s+stars?\b/i);
        if (ratingFallback) {
          averageRating = ratingFallback[1];
        }
      }

      if (!reviewCount) {
        const reviewFallback = panelText.match(/([0-9][0-9,]*)\s+reviews?/i);
        if (reviewFallback) {
          reviewCount = reviewFallback[1];
        }
      }
    }

    return { averageRating, reviewCount };
  }

  async function navigateBackToResults() {
    if (isResultsViewActive()) {
      return;
    }

    const backButton = findBackButton();
    if (backButton) {
      activateElement(backButton);
    } else {
      window.history.back();
    }

    await wait(500);
    await waitFor(() => isResultsViewActive(), RESULTS_WAIT_MS, 200, "results view");
  }

  function findBackButton() {
    const selectors = [
      'button[jsaction*="pane.place.back"]',
      'button[aria-label="Back"]',
      'button[aria-label*="Back"]',
      'button[jsaction*="back"]'
    ];

    return selectors
      .map((selector) => document.querySelector(selector))
      .find((element) => element instanceof HTMLElement) || null;
  }

  function clickElement(element) {
    element.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      })
    );
  }

  function activateElement(element) {
    if (typeof element.click === "function") {
      element.click();
    }

    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    clickElement(element);
  }

  function findResultsContainer() {
    const feed = document.querySelector('div[role="feed"]');
    if (isScrollable(feed)) {
      return feed;
    }

    const candidates = Array.from(document.querySelectorAll("div"))
      .filter(isScrollable)
      .map((element) => ({
        element,
        score: element.querySelectorAll('a[href*="/maps/place/"]').length
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return candidates[0]?.element || null;
  }

  function isScrollable(element) {
    return Boolean(
      element &&
      element instanceof HTMLElement &&
      isVisible(element) &&
      element.scrollHeight > element.clientHeight + 80 &&
      getComputedStyle(element).overflowY !== "hidden"
    );
  }

  function isVisible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function parseIdentifiers(values) {
    const combined = values
      .filter(Boolean)
      .map((value) => {
        try {
          return decodeURIComponent(String(value));
        } catch (_error) {
          return String(value);
        }
      })
      .join(" ");

    const latLngMatch =
      combined.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/) ||
      combined.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    const fidMatch = combined.match(/(0x[0-9a-f]+:0x[0-9a-f]+)/i);
    const placeIdMatch =
      combined.match(/placeid=([A-Za-z0-9_-]+)/i) ||
      combined.match(/1s(ChI[A-Za-z0-9_-]+)/) ||
      combined.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i); // Sometimes FID is passed as 1s in some URLs

    let cid = "";
    if (fidMatch?.[1]) {
      const parts = fidMatch[1].split(":");
      if (parts[1]) {
        cid = hexToDecimal(parts[1]);
      }
    }

    return {
      latitude: latLngMatch?.[1] || "",
      longitude: latLngMatch?.[2] || "",
      fid: fidMatch?.[1] || "",
      cid,
      placeId: placeIdMatch?.[1] || ""
    };
  }

  function formatPhones(phones) {
    const intlPhones = phones.flatMap((phone) => {
      const digits = phone.replace(/[^\d]/g, "");
      if (digits.length === 10) {
        return [`+91 ${digits.slice(0, 5)} ${digits.slice(5)}`];
      }

      return [];
    });

    return unique([...phones, ...intlPhones]).join(", ");
  }

  function formatOpeningHours(rows) {
    const today = new Date();
    const dayOrder = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };

    return rows
      .map((row) => {
        const dayKey = row.day.toLowerCase();
        const targetDay = dayOrder[dayKey];
        if (typeof targetDay !== "number") {
          return null;
        }

        const offset = (targetDay - today.getDay() + 7) % 7;
        const date = new Date(today);
        date.setDate(today.getDate() + offset);
        const isoDate = date.toISOString().slice(0, 10);
        return `${row.day}(${isoDate}): [${row.hours}]`;
      })
      .filter(Boolean)
      .join(", ");
  }

  function buildReviewUrl(placeId) {
    if (!placeId) {
      return "";
    }

    const params = new URLSearchParams({ placeid: placeId });
    if (state.searchQuery) {
      params.set("q", state.searchQuery);
    }
    params.set("authuser", "0");
    params.set("hl", "en");
    params.set("gl", "IN");
    return `https://search.google.com/local/reviews?${params.toString()}`;
  }

  function buildFileName(rowCount) {
    const query = (state.searchQuery || "google_maps_results").replace(/[^\w\s,-]/g, "").replace(/\s+/g, "+");
    const date = new Date().toISOString().slice(0, 10);
    return `G-Maps-Extractor-${rowCount}-${query}-${date}.csv`;
  }

  function buildGoogleMapsUrl(cid) {
    return cid ? `https://www.google.com/maps?cid=${cid}` : sanitizeUrl(window.location.href);
  }

  function splitAddress(address) {
    const parts = normalizeWhitespace(address)
      .split(",")
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean);

    return {
      street: parts[0] || "",
      municipality: parts.slice(1, 4).join(", ")
    };
  }

  function cleanLabeledText(element) {
    const aria = normalizeWhitespace(element.getAttribute?.("aria-label") || "");
    const text = normalizeWhitespace(element.innerText || element.textContent || "");
    return normalizeWhitespace((aria || text).replace(/^(Address|Phone|Plus code|Website|Hours):\s*/i, ""));
  }

  function extractPhone(value) {
    const match = String(value || "").match(/(\+?\d[\d\s().-]{6,}\d)/);
    return match ? normalizeWhitespace(match[1]) : "";
  }

  function safeDomain(url) {
    if (!url) {
      return "";
    }

    try {
      return new URL(url).hostname.replace(/^www\./i, "");
    } catch (_error) {
      return "";
    }
  }

  function normalizeTimeZone(timeZone) {
    if (timeZone === "Asia/Kolkata") {
      return "Asia/Calcutta";
    }

    return timeZone;
  }

  function hexToDecimal(hexValue) {
    try {
      const normalized = hexValue.replace(/^0x/i, "");
      return BigInt(`0x${normalized}`).toString(10);
    } catch (_error) {
      return "";
    }
  }

  function firstText(root, selectors) {
    for (const selector of selectors) {
      const value = normalizeWhitespace(root.querySelector(selector)?.textContent || "");
      if (value) {
        return value;
      }
    }

    return "";
  }

  function waitFor(predicate, timeoutMs, intervalMs, description) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      const timer = window.setInterval(() => {
        try {
          if (predicate()) {
            window.clearInterval(timer);
            resolve();
            return;
          }
        } catch (_error) {
          // Ignore transient DOM errors while Maps re-renders.
        }

        if (Date.now() - startedAt >= timeoutMs) {
          window.clearInterval(timer);
          reject(new Error(`Timed out waiting for ${description}.`));
        }
      }, intervalMs);
    });
  }

  function downloadCsv() {
    const rows = Array.from(state.rowsMap.values());
    if (!rows.length) {
      state.status = "Nothing extracted yet.";
      render();
      return;
    }

    const csv = convertRowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = buildFileName(rows.length);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);

    state.status = `CSV downloaded with ${rows.length} rows.`;
    render();
  }

  function convertRowsToCsv(rows) {
    const selectedColumns = CSV_COLUMNS.filter((col) => state.selectedColumns.has(col.key));
    const headerRow = selectedColumns.map((column) => column.label).join(",");
    const dataRows = rows.map((row) =>
      selectedColumns.map((column) => escapeCsvValue(row[column.key] ?? "")).join(",")
    );

    return `\uFEFF${[headerRow, ...dataRows].join("\n")}`;
  }

  function escapeCsvValue(value) {
    const stringValue = String(value).replace(/"/g, "\"\"");
    return `"${stringValue}"`;
  }

  function showOverlay() {
    overlay.root.style.display = "block";
  }

  function render() {
    if (!overlay) {
      return;
    }

    overlay.status.textContent = state.status;
    overlay.extracted.textContent = String(state.rowsMap.size);
    overlay.discovered.textContent = String(state.discoveredTotal || state.queue.length);
    overlay.note.textContent = getNoteText();
    overlay.start.disabled = state.isRunning || state.pendingStart;
    overlay.pause.disabled = !state.isRunning || state.isPaused;
    overlay.resume.disabled = !state.isRunning || !state.isPaused;
    overlay.download.disabled = state.rowsMap.size === 0;
  }

  function getNoteText() {
    if (state.pendingStart) {
      return "Start is armed. As soon as a Google Maps results panel appears, extraction will begin automatically.";
    }

    if (state.isPaused) {
      return "Paused. You can download the partial CSV now, or resume to continue extracting.";
    }

    if (state.isRunning) {
      return "Rapidly scrolling and extracting data from all visible results.";
    }

    if (!findResultsContainer()) {
      return "Enter a Google Maps search so the results list appears, then press Start.";
    }

    return "";
  }

  function getIdleStatus() {
    return findResultsContainer()
      ? "Ready on search results."
      : "Enter a Google Maps search to begin.";
  }

  function getSearchQuery(url) {
    try {
      const parsed = new URL(url);
      const searchMatch = parsed.pathname.match(/\/maps\/search\/([^/]+)/i);
      if (searchMatch?.[1]) {
        return decodeURIComponent(searchMatch[1]).replace(/\+/g, " ");
      }

      return parsed.searchParams.get("q") || "";
    } catch (_error) {
      return "";
    }
  }

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function sanitizeUrl(url) {
    return String(url || "").trim();
  }

  function normalizeKey(value) {
    return normalizeWhitespace(value).toLowerCase();
  }

  function namesRoughlyMatch(left, right) {
    const normalizeName = (value) =>
      normalizeWhitespace(value)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();

    const leftName = normalizeName(left);
    const rightName = normalizeName(right);

    return Boolean(leftName && rightName) && (leftName === rightName || leftName.includes(rightName) || rightName.includes(leftName));
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function uniqueElements(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function wait(durationMs) {
    return new Promise((resolve) => window.setTimeout(resolve, durationMs));
  }
})();
