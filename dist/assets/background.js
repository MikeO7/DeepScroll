import { o as openDB } from "./index-DZwPtbYB.js";
const DB_NAME = "deepscroll-db";
const STORE_NAME = "slices";
async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    }
  });
}
async function saveSlice(dataUrl, y) {
  const db = await initDB();
  const id = await db.put(STORE_NAME, { dataUrl, y, createdAt: Date.now() });
  return id;
}
let lastCaptureTime = 0;
const MIN_CAPTURE_INTERVAL = 800;
async function throttledCapture(windowId, y) {
  const now = Date.now();
  if (now - lastCaptureTime < MIN_CAPTURE_INTERVAL) {
    const delay = MIN_CAPTURE_INTERVAL - (now - lastCaptureTime);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    lastCaptureTime = Date.now();
    const id = await saveSlice(dataUrl, y);
    return { success: true, sliceId: id };
  } catch (err) {
    console.error("Capture failed:", err);
    return { success: false, error: err.message };
  }
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CAPTURE_VISIBLE_TAB") {
    throttledCapture(sender.tab.windowId, request.y).then((result) => {
      sendResponse(result);
    });
    return true;
  }
  if (request.type === "OPEN_EDITOR") {
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
chrome.action.onClicked.addListener((tab) => {
  startCaptureFlow(tab);
});
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
        files: ["assets/content.js"]
      });
      console.log("DeepScroll: Injection successful. Retrying start...");
      setTimeout(() => {
        sendMessage().catch((e) => console.error("DeepScroll: Second attempt failed", e));
      }, 100);
    } catch (injectErr) {
      console.error("DeepScroll: Injection failed (likely restricted page)", injectErr);
    }
  }
}
