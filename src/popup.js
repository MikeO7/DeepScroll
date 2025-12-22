document.getElementById('captureBtn').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            // Trigger background capture
            // Better: runtime.sendMessage to background to start flow
            // But background listener 'action.onClicked' doesn't fire if popup is set.
            // So we must manually trigger flow.

            chrome.runtime.sendMessage({ type: "TRIGGER_CAPTURE_FLOW", tabId: tab.id }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Popup Send Error:", chrome.runtime.lastError);
                } else {
                    console.log("Trigger Sent", response);
                }
                // Close popup after message is sent and processed (or error)
                // Slight delay to ensure message fully propagates or for user to see logs
                setTimeout(() => window.close(), 100);
            });
        } else {
            console.error("No active tab found");
        }
    } catch (e) {
        console.error("Popup Error:", e);
    }
});


