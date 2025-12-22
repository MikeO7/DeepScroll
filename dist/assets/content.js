let isCapturing = false;
let originalFixedElements = [];
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
  const allElements = document.querySelectorAll("*");
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
function hideFixedElements() {
  originalFixedElements = [];
  const allElements = document.querySelectorAll("*");
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
    if (isWindow) window.scrollTo(0, y);
    else targetNode.scrollTop = y;
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
  const setScrollTop = (y) => isWindow ? window.scrollTo(0, y) : targetNode.scrollTop = y;
  const getScrollTop = () => isWindow ? window.scrollY : targetNode.scrollTop;
  let currentY = 0;
  const totalHeight = getScrollHeight();
  const viewportHeight = getClientHeight();
  const STEP = viewportHeight - 100;
  while (currentY < totalHeight) {
    setScrollTop(currentY);
    await wait(1e3);
    const actualY = getScrollTop();
    const response = await sendMessagePromise({ type: "CAPTURE_VISIBLE_TAB", y: actualY });
    if (response && response.success) {
      slices.push({
        y: actualY,
        sliceId: response.sliceId
        // Store ID
      });
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
