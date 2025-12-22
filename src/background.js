// DeepScroll Service Worker
import { openDB } from 'idb';

const DB_NAME = 'deepscroll-db';
const STORE_NAME = 'slices';

async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

async function saveSlice(dataUrl, y) {
  const db = await initDB();
  const id = await db.put(STORE_NAME, { dataUrl, y, createdAt: Date.now() });
  return id;
}


let lastCaptureTime = 0;
const MIN_CAPTURE_INTERVAL = 800; // Slower to avoid quota (MAX 2/sec) -> 800ms is ~1.2/sec

// Throttled Capture Function
async function throttledCapture(windowId, y) {
  const now = Date.now();
  if (now - lastCaptureTime < MIN_CAPTURE_INTERVAL) {
    const delay = MIN_CAPTURE_INTERVAL - (now - lastCaptureTime);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    lastCaptureTime = Date.now();

    // Save to IDB immediately
    const id = await saveSlice(dataUrl, y);

    return { success: true, sliceId: id }; // Return ID instead of dataUrl
  } catch (err) {
    console.error("Capture failed:", err);
    return { success: false, error: err.message };
  }
}

// Message Listener from Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CAPTURE_VISIBLE_TAB") {
    throttledCapture(sender.tab.windowId, request.y).then((result) => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }

  if (request.type === "OPEN_EDITOR") {
    // Pass slice IDs via URL parameter or just rely on DB if it's a single session?
    const metadata = {
      url: sender.tab.url,
      title: sender.tab.title,
      capturedAt: Date.now(),
      devicePixelRatio: request.pixelRatio || 1
    };
    const payload = {
      ids: request.sliceIds,
      meta: metadata
    };
    const url = chrome.runtime.getURL("src/editor/index.html") + "#" + JSON.stringify(payload);
    chrome.tabs.create({ url });
  }

  if (request.type === "TRIGGER_CAPTURE_FLOW") {
    startCaptureFlow({ id: request.tabId });
    if (sendResponse) sendResponse({ success: true });
  }
});

// Action Click / Command Listener (Triggers the Capture Flow)
chrome.action.onClicked.addListener((tab) => {
  startCaptureFlow(tab);
});

/* 
// Note: _execute_action command triggers onAllClicked automatically if defined in manifest
// If we wanted a separate command listener:
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture_page") { // If we named it specifically
     // ...
  }
});
But since we mapped _execute_action, it fires the action.onClicked.
*/

async function startCaptureFlow(tab) {
  if (!tab.id) return;

  function sendMessage() {
    return chrome.tabs.sendMessage(tab.id, { type: "START_DEEPSCROLL" });
  }

  try {
    await sendMessage();
    console.log("DeepScroll: Start command sent.");
  } catch (err) {
    console.log("DeepScroll: Content script not ready. Injecting...", err);
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['assets/content.js']
      });
      console.log("DeepScroll: Injection successful. Retrying start...");
      // Give it a moment to initialize listener
      setTimeout(() => {
        sendMessage().catch(e => console.error("DeepScroll: Second attempt failed", e));
      }, 100);
    } catch (injectErr) {
      console.error("DeepScroll: Injection failed (likely restricted page)", injectErr);
    }
  }
}
