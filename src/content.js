// DeepScroll Content Script
// The "Driver" - Handles DOM traversal, scrolling, and capture coordination.

let isCapturing = false;
let originalFixedElements = [];

// Safety limits for infinite scroll
const MAX_SLICES = 50; // ~50,000 pixels max (at ~1000px viewport)
const MAX_HEIGHT_GROWTH = 3; // Allow page to grow max 3x during capture

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
        // Warn about virtualized content
        if (detectVirtualization()) {
            console.warn("⚠️ DeepScroll: Virtualized content detected. Some content may not be captured.");
        }

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
    const allElements = getAllElements();
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

// Get all elements including those in shadow DOM
function getAllElements(root = document) {
    const elements = [];

    function traverse(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            elements.push(node);

            // Traverse shadow DOM
            if (node.shadowRoot) {
                const shadowChildren = node.shadowRoot.querySelectorAll('*');
                for (const child of shadowChildren) {
                    traverse(child);
                }
            }
        }

        // Traverse regular children
        for (const child of node.children || []) {
            traverse(child);
        }
    }

    traverse(root.documentElement || root.body || root);
    return elements;
}

// --- B. The "Clean" Pre-Roll ---
function hideFixedElements() {
    originalFixedElements = [];
    const allElements = getAllElements(); // Now includes shadow DOM

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

// Detect virtualized content that may cause issues
function detectVirtualization() {
    const indicators = [
        document.querySelector('[data-virtualized]'),
        document.querySelector('.ReactVirtualized__Grid'),
        document.querySelector('[class*="virtual"]'),
        document.querySelector('[aria-rowcount]')
    ];
    return indicators.some(el => el !== null);
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
        if (isWindow) {
            window.scrollTo(0, y);
            // Dispatch scroll event for event-driven content
            window.dispatchEvent(new Event('scroll', { bubbles: true }));
        } else {
            targetNode.scrollTop = y;
            targetNode.dispatchEvent(new Event('scroll', { bubbles: true }));
        }
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
    const setScrollTop = (y) => {
        if (isWindow) {
            window.scrollTo(0, y);
            // Dispatch scroll event for scroll-event-driven content
            window.dispatchEvent(new Event('scroll', { bubbles: true }));
        } else {
            targetNode.scrollTop = y;
            targetNode.dispatchEvent(new Event('scroll', { bubbles: true }));
        }
    };
    const getScrollTop = () => isWindow ? window.scrollY : targetNode.scrollTop;

    let currentY = 0;
    let totalHeight = getScrollHeight();
    const initialHeight = totalHeight; // Track for infinite scroll detection
    const viewportHeight = getClientHeight();
    const STEP = viewportHeight - 100; // Overlap mandatory

    while (currentY < totalHeight) {
        // Safety check: prevent infinite capture
        if (slices.length >= MAX_SLICES) {
            console.warn(`DeepScroll: Reached max slices (${MAX_SLICES}). Stopping to prevent infinite capture.`);
            break;
        }

        // Safety check: prevent runaway page growth
        if (totalHeight > initialHeight * MAX_HEIGHT_GROWTH) {
            console.warn(`DeepScroll: Page grew ${Math.round(totalHeight / initialHeight)}x. Stopping infinite scroll.`);
            break;
        }

        // 1. Scroll
        setScrollTop(currentY);

        // 2. Wait Render Buffer
        await wait(1000);

        const actualY = getScrollTop();

        // Re-check scrollHeight for dynamic content (infinite scroll)
        const newHeight = getScrollHeight();
        if (newHeight > totalHeight) {
            console.log(`DeepScroll: Page grew from ${totalHeight}px to ${newHeight}px`);
            totalHeight = newHeight;
        }

        // 3. Message Background
        const response = await sendMessagePromise({ type: "CAPTURE_VISIBLE_TAB", y: actualY });

        if (response && response.success) {
            slices.push({
                y: actualY,
                sliceId: response.sliceId
            });
            console.log(`DeepScroll: Captured slice ${slices.length} at y=${actualY}`);
        } else {
            console.error("Capture buffer failed", response);
        }

        // Break if we are at the bottom
        if (currentY + viewportHeight >= totalHeight) {
            break;
        }

        // 4. Smart Step
        currentY += STEP;
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

