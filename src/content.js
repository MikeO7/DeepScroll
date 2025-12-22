// DeepScroll Content Script
// The "Driver" - Handles DOM traversal, scrolling, and capture coordination.

let isCapturing = false;
let originalFixedElements = [];

// Receiver for Background Trigger
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "START_DEEPSCROLL") {
        if (isCapturing) return;
        initDeepScroll();
    }
});

// Main Orchestrator
async function initDeepScroll() {
    isCapturing = true;
    console.log("DeepScroll: Starting...");

    try {
        // 1. Target Detection
        const target = detectScrollTarget();
        console.log("DeepScroll: Target Detected", target);

        // 2. Pre-Roll (Hide Fixed)
        hideFixedElements();
        await performPreRoll(target);

        // 3. Capture Loop
        const slices = await captureLoop(target);
        console.log("DeepScroll: Capture Complete", slices);

        // 4. Restore
        restoreFixedElements();

        // 5. Open Editor
        if (slices.length > 0) {
            const sliceIds = slices.map(s => s.sliceId);
            chrome.runtime.sendMessage({
                type: "OPEN_EDITOR",
                sliceIds,
                pixelRatio: window.devicePixelRatio
            });
        } else {
            console.warn("DeepScroll: No slices captured.");
        }

    } catch (err) {
        console.error("DeepScroll Core Error:", err);
        restoreFixedElements(); // Safety net
    } finally {
        isCapturing = false;
    }
}

// --- A. Target Detection ---
function detectScrollTarget() {
    const doc = document.documentElement;
    // If body scrolls, window.innerHeight < doc.scrollHeight
    if (doc.scrollHeight > window.innerHeight) {
        return window;
    }

    // Else, "Fixed App". Find largest scrollable element.
    const allElements = document.querySelectorAll('*');
    let maxScrollHeight = 0;
    let bestCandidate = window; // Fallback

    for (const el of allElements) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if (overflowY === 'scroll' || overflowY === 'auto') {
            if (el.scrollHeight > el.clientHeight && el.scrollHeight > maxScrollHeight) {
                maxScrollHeight = el.scrollHeight;
                bestCandidate = el;
            }
        }
    }

    return bestCandidate;
}

// --- B. The "Clean" Pre-Roll ---
function hideFixedElements() {
    originalFixedElements = [];
    const allElements = document.querySelectorAll('*');

    for (const el of allElements) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
            // Store state
            originalFixedElements.push({
                element: el,
                originalVisibility: el.style.visibility
            });
            // Hide
            el.style.visibility = 'hidden';
        }
    }
}

function restoreFixedElements() {
    for (const record of originalFixedElements) {
        record.element.style.visibility = record.originalVisibility;
    }
    originalFixedElements = [];
}

async function performPreRoll(targetNode) {
    // Rapid scroll to bottom and back to trigger lazy loads
    // If target is window
    const isWindow = (targetNode === window);
    const scrollHeight = isWindow ? document.documentElement.scrollHeight : targetNode.scrollHeight;

    const scrollTo = (y) => {
        if (isWindow) window.scrollTo(0, y);
        else targetNode.scrollTop = y;
    };

    // Down
    scrollTo(scrollHeight);
    await wait(500); // Wait for network requests

    // Up
    scrollTo(0);
    await wait(500); // 500ms wait as per spec
}

// --- C. The Capture Loop ---
async function captureLoop(targetNode) {
    const isWindow = (targetNode === window);
    const slices = [];

    const getScrollHeight = () => isWindow ? document.documentElement.scrollHeight : targetNode.scrollHeight;
    const getClientHeight = () => isWindow ? window.innerHeight : targetNode.clientHeight;
    const setScrollTop = (y) => isWindow ? window.scrollTo(0, y) : (targetNode.scrollTop = y);
    const getScrollTop = () => isWindow ? window.scrollY : targetNode.scrollTop;

    let currentY = 0;
    const totalHeight = getScrollHeight();
    const viewportHeight = getClientHeight();
    const STEP = viewportHeight - 100; // Overlap mandatory

    while (currentY < totalHeight) {
        // 1. Scroll
        setScrollTop(currentY);

        // 2. Wait Render Buffer
        await wait(1000);

        const actualY = getScrollTop();

        // Handle end of page logic (don't capture overlap wrapper if at very bottom? 
        // Spec says "Smart Step: Scroll down by ClientHeight - 100px". 
        // We'll just capture what is visible. 
        // If we are at the very bottom, capture it.

        // 3. Message Background
        const response = await sendMessagePromise({ type: "CAPTURE_VISIBLE_TAB", y: actualY });

        if (response && response.success) {
            slices.push({
                y: actualY,
                sliceId: response.sliceId // Store ID
            });
        } else {
            console.error("Capture buffer failed", response);
        }

        // Break if we are at the bottom
        // Check if we can scroll more?
        // Actually, simple check: if currentY + viewportHeight >= totalHeight, we are done AFTER this capture.
        if (currentY + viewportHeight >= totalHeight) {
            break;
        }

        // 4. Smart Step
        currentY += STEP;

        // Clamp to ensure we don't overshoot (though scrollTo handles this, good to be precise)
        // Actually, if we set scrollTop to X, and max is Y, browser clamps. 
        // But we want to capture the very bottom.
        // If next step overshoots, set to max scrollable position?
        // If (currentY + viewportHeight > totalHeight), capture the specific bottom segment?
        // The "Canvas Stitching" logic needs to handle overlaps. 
        // If we just naively scroll by STEP, the last capture might define the end.
        // Let's stick to the spec: "Scroll down by ClientHeight - 100px."
    }

    return slices;
}

// --- Utils ---
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sendMessagePromise(msg) {
    return new Promise(resolve => {
        chrome.runtime.sendMessage(msg, response => {
            resolve(response);
        });
    });
}

