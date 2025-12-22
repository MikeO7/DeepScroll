import "./modulepreload-polyfill-COaX8i6R.js";
document.getElementById("captureBtn").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.runtime.sendMessage({ type: "TRIGGER_CAPTURE_FLOW", tabId: tab.id }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Popup Send Error:", chrome.runtime.lastError);
        } else {
          console.log("Trigger Sent", response);
        }
        setTimeout(() => window.close(), 100);
      });
    } else {
      console.error("No active tab found");
    }
  } catch (e) {
    console.error("Popup Error:", e);
  }
});
