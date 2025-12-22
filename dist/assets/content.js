let isCapturing = false;
let originalFixedElements = [];
const MAX_SLICES = 50;
const MAX_HEIGHT_GROWTH = 3;
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "START_DEEPSCROLL") {
    if (isCapturing) return;
    initDeepScroll();
  }
});
async function initDeepScroll() {
  isCapturing = true;
  console.log("DeepScroll: Starting...");
  try {
    if (detectVirtualization()) {
      console.warn("⚠️ DeepScroll: Virtualized content detected. Some content may not be captured.");
    }
    const target = detectScrollTarget();
    console.log("DeepScroll: Target Detected", target);
    hideFixedElements();
    await performPreRoll(target);
    const slices = await captureLoop(target);
    console.log("DeepScroll: Capture Complete", slices);
    restoreFixedElements();
    if (slices.length > 0) {
      const sliceIds = slices.map((s) => s.sliceId);
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
    restoreFixedElements();
  } finally {
    isCapturing = false;
  }
}
function detectScrollTarget() {
  const doc = document.documentElement;
  if (doc.scrollHeight > window.innerHeight) {
    return window;
  }
  const allElements = getAllElements();
  let maxScrollHeight = 0;
  let bestCandidate = window;
  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if (overflowY === "scroll" || overflowY === "auto") {
      if (el.scrollHeight > el.clientHeight && el.scrollHeight > maxScrollHeight) {
        maxScrollHeight = el.scrollHeight;
        bestCandidate = el;
      }
    }
  }
  return bestCandidate;
}
function getAllElements(root = document) {
  const elements = [];
  function traverse(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      elements.push(node);
      if (node.shadowRoot) {
        const shadowChildren = node.shadowRoot.querySelectorAll("*");
        for (const child of shadowChildren) {
          traverse(child);
        }
      }
    }
    for (const child of node.children || []) {
      traverse(child);
    }
  }
  traverse(root.documentElement || root.body || root);
  return elements;
}
function hideFixedElements() {
  originalFixedElements = [];
  const allElements = getAllElements();
  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    if (style.position === "fixed" || style.position === "sticky") {
      originalFixedElements.push({
        element: el,
        originalVisibility: el.style.visibility
      });
      el.style.visibility = "hidden";
    }
  }
}
function detectVirtualization() {
  const indicators = [
    document.querySelector("[data-virtualized]"),
    document.querySelector(".ReactVirtualized__Grid"),
    document.querySelector('[class*="virtual"]'),
    document.querySelector("[aria-rowcount]")
  ];
  return indicators.some((el) => el !== null);
}
function restoreFixedElements() {
  for (const record of originalFixedElements) {
    record.element.style.visibility = record.originalVisibility;
  }
  originalFixedElements = [];
}
async function performPreRoll(targetNode) {
  const isWindow = targetNode === window;
  const scrollHeight = isWindow ? document.documentElement.scrollHeight : targetNode.scrollHeight;
  const scrollTo = (y) => {
    if (isWindow) {
      window.scrollTo(0, y);
      window.dispatchEvent(new Event("scroll", { bubbles: true }));
    } else {
      targetNode.scrollTop = y;
      targetNode.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
  };
  scrollTo(scrollHeight);
  await wait(500);
  scrollTo(0);
  await wait(500);
}
async function captureLoop(targetNode) {
  const isWindow = targetNode === window;
  const slices = [];
  const getScrollHeight = () => isWindow ? document.documentElement.scrollHeight : targetNode.scrollHeight;
  const getClientHeight = () => isWindow ? window.innerHeight : targetNode.clientHeight;
  const setScrollTop = (y) => {
    if (isWindow) {
      window.scrollTo(0, y);
      window.dispatchEvent(new Event("scroll", { bubbles: true }));
    } else {
      targetNode.scrollTop = y;
      targetNode.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
  };
  const getScrollTop = () => isWindow ? window.scrollY : targetNode.scrollTop;
  let currentY = 0;
  let totalHeight = getScrollHeight();
  const initialHeight = totalHeight;
  const viewportHeight = getClientHeight();
  const STEP = viewportHeight - 100;
  while (currentY < totalHeight) {
    if (slices.length >= MAX_SLICES) {
      console.warn(`DeepScroll: Reached max slices (${MAX_SLICES}). Stopping to prevent infinite capture.`);
      break;
    }
    if (totalHeight > initialHeight * MAX_HEIGHT_GROWTH) {
      console.warn(`DeepScroll: Page grew ${Math.round(totalHeight / initialHeight)}x. Stopping infinite scroll.`);
      break;
    }
    setScrollTop(currentY);
    await wait(1e3);
    const actualY = getScrollTop();
    const newHeight = getScrollHeight();
    if (newHeight > totalHeight) {
      console.log(`DeepScroll: Page grew from ${totalHeight}px to ${newHeight}px`);
      totalHeight = newHeight;
    }
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
    if (currentY + viewportHeight >= totalHeight) {
      break;
    }
    currentY += STEP;
  }
  return slices;
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function sendMessagePromise(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      resolve(response);
    });
  });
}
