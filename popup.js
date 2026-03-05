const actionButton = document.getElementById("openOverlayButton");
const startButton = document.getElementById("startOverlayButton");
const statusElement = document.getElementById("status");

actionButton.addEventListener("click", async () => {
  await openOverlayInActiveTab(false);
});

startButton.addEventListener("click", async () => {
  await openOverlayInActiveTab(true);
});

async function openOverlayInActiveTab(startImmediately) {
  setStatus("Connecting to Google Maps tab...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error("No active tab was found.");
    }

    if (!tab.url || !tab.url.includes("google.com/maps")) {
      throw new Error("Open https://www.google.com/maps first.");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (shouldStart) => {
        if (!window.__gmapsExtractorOverlayApi) {
          throw new Error("Overlay API was not initialized on this page.");
        }

        window.__gmapsExtractorOverlayApi.show();
        if (shouldStart) {
          window.__gmapsExtractorOverlayApi.start();
        }
      },
      args: [startImmediately]
    });

    setStatus(
      startImmediately ? "Overlay opened and scraping started." : "Overlay opened on Google Maps."
    );
  } catch (error) {
    console.error("[Popup] Action failed:", error);
    setStatus(error.message || "Action failed.");
  }
}

function setStatus(message) {
  statusElement.textContent = message;
}
