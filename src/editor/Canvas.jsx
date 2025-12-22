/**
 * @fileoverview Canvas component for the DeepScroll editor.
 * Handles image stitching, rendering, and all drawing tool interactions.
 * @module Canvas
 */

import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { CONSTANTS } from './constants.js';
import {
    getInternalCoords,
    getRectBounds,
    drawArrow,
    drawRect,
    drawPenLine,
    applyRedaction,
    applyPixelation,
    drawText
} from './tools.js';

/**
 * Canvas component for editing and annotating stitched screenshots.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.slices - Array of image slice objects with dataUrl and y position
 * @param {Object} props.metadata - Capture metadata (url, title, capturedAt, devicePixelRatio)
 * @param {Function} props.onStitchComplete - Callback when stitching completes
 * @param {string} props.activeTool - Currently selected tool ('select', 'blur', 'redact', etc.)
 * @param {boolean} props.hasFooter - Whether to display the metadata footer
 * @param {boolean} props.isBeautified - Whether beautify mode (padding/shadow) is enabled
 * @param {Function} props.onHistoryChange - Callback when history state changes
 * @returns {JSX.Element} The Canvas component
 */
export default function Canvas({ slices, metadata, onStitchComplete, activeTool, hasFooter, isBeautified, onHistoryChange }) {
    const canvasRef = useRef(null);
    const [stitching, setStitching] = useState(false);
    const [finalImage, setFinalImage] = useState(null);

    // Interaction State
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState(null);
    const [currentPos, setCurrentPos] = useState(null);
    const editCanvasRef = useRef(null);

    // History State
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Listen for Export/Undo/Redo events
    useEffect(() => {
        const handleExport = (e) => {
            const { format, toClipboard } = e.detail;
            exportImage(toClipboard);
        };
        const handleUndo = () => undo();
        const handleRedo = () => redo();

        window.addEventListener('DEEPSCROLL_EXPORT', handleExport);
        window.addEventListener('DEEPSCROLL_UNDO', handleUndo);
        window.addEventListener('DEEPSCROLL_REDO', handleRedo);

        return () => {
            window.removeEventListener('DEEPSCROLL_EXPORT', handleExport);
            window.removeEventListener('DEEPSCROLL_UNDO', handleUndo);
            window.removeEventListener('DEEPSCROLL_REDO', handleRedo);
        };
    }, [finalImage, hasFooter, isBeautified, history, historyIndex]); // Dependencies

    // Report History State
    useEffect(() => {
        if (onHistoryChange) {
            onHistoryChange({
                canUndo: historyIndex > 0,
                canRedo: historyIndex < history.length - 1
            });
        }
    }, [history, historyIndex, onHistoryChange]);

    function saveState() {
        if (!editCanvasRef.current) return;
        const ctx = editCanvasRef.current.getContext('2d', { willReadFrequently: true });
        const w = editCanvasRef.current.width;
        const h = editCanvasRef.current.height;
        // Optimization: Use toDataURL for lighter memory? 
        // Or ImageData. ImageData is large but fast. 10MB per screen. 
        // 10 screens = 100MB. Fine for desktop.
        // Limit history?
        if (history.length > 20) {
            // Future: shift logic. For now simple.
        }

        const data = ctx.getImageData(0, 0, w, h);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(data);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }

    function undo() {
        if (historyIndex <= 0) return;
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        restoreState(history[newIndex]);
    }

    function redo() {
        if (historyIndex >= history.length - 1) return;
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        restoreState(history[newIndex]);
    }

    function restoreState(imageData) {
        if (!editCanvasRef.current) return;
        editCanvasRef.current.width = imageData.width;
        editCanvasRef.current.height = imageData.height;
        const ctx = editCanvasRef.current.getContext('2d', { willReadFrequently: true });
        ctx.putImageData(imageData, 0, 0);
        renderCanvas();
    }

    useEffect(() => {
        if (!slices || slices.length === 0) return;
        stitchImages();
    }, [slices]);

    // Re-draw when footer/beautify toggles change? 
    // No, stitchImages creates the base. We should composite on top for the display?
    // Actually, for performance, we stitch ONCE.
    // Then we render that stitched image to the canvas, potentially adding footer/padding.

    useEffect(() => {
        if (finalImage || editCanvasRef.current) {
            renderCanvas();
        }
    }, [finalImage, hasFooter, isBeautified, isDrawing, currentPos]);

    async function stitchImages() {
        try {
            setStitching(true);
            const images = await Promise.all(
                slices.map((slice) => loadImage(slice.dataUrl))
            );

            if (images.length === 0) {
                setStitching(false);
                return;
            }

            const width = images[0].width;
            const dpr = metadata?.devicePixelRatio || 1;

            // Calculate total height and overlaps
            let totalHeight = images[0].height;
            const overlaps = [0];

            for (let i = 1; i < images.length; i++) {
                const prevSliceY_px = (slices[i - 1]?.y || 0) * dpr;
                const currSliceY_px = (slices[i]?.y || 0) * dpr;

                const prevImageBottom_px = prevSliceY_px + images[i - 1].height;
                const calculatedOverlap = prevImageBottom_px - currSliceY_px;

                // Clamp overlap
                const actualOverlap = Math.max(0, calculatedOverlap);
                overlaps.push(actualOverlap);

                totalHeight += (images[i].height - actualOverlap);
            }

            // Create offscreen canvas
            const offCanvas = document.createElement('canvas');
            offCanvas.width = width;
            offCanvas.height = totalHeight;
            const ctx = offCanvas.getContext('2d', { willReadFrequently: true });

            let currentY = 0;

            // Draw first image
            ctx.drawImage(images[0], 0, 0);
            currentY += images[0].height;

            // Draw subsequent images
            for (let i = 1; i < images.length; i++) {
                const img = images[i];
                const overlap = overlaps[i];
                const sourceH = img.height - overlap;

                // Draw non-overlapping part
                ctx.drawImage(
                    img,
                    0, overlap, width, sourceH,
                    0, currentY, width, sourceH
                );

                currentY += sourceH;
            }

            const stitched = new Image();
            stitched.src = offCanvas.toDataURL();
            stitched.onload = () => {
                setFinalImage(stitched);
                setStitching(false);
            };
            stitched.onerror = (e) => {
                console.error("Stitched image load failed", e);
                setStitching(false);
            };

        } catch (err) {
            console.error("Stitching process failed:", err);
            setStitching(false);
        }
    }

    // Ref to hold the mutable edited state
    /* Moved to top */

    useEffect(() => {
        if (finalImage) {
            // Reset or Init edit buffer
            // We do this if it's the first load. 
            // If we already have history, we might want to keep it? 
            // No, new finalImage = new base.

            if (!editCanvasRef.current || history.length === 0) {
                const c = document.createElement('canvas');
                c.width = finalImage.width;
                c.height = finalImage.height;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(finalImage, 0, 0);
                editCanvasRef.current = c;

                // Init History
                const data = ctx.getImageData(0, 0, c.width, c.height);
                setHistory([data]);
                setHistoryIndex(0);
            }
        }
    }, [finalImage]);

    function renderCanvas() {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        // Source is the Edited Buffer if exists, else Raw Stitched
        const source = editCanvasRef.current || finalImage;
        if (!source) return;

        let w = source.width;
        let h = source.height;
        let padding = isBeautified ? 60 : 0;
        let footerH = hasFooter ? 40 : 0;

        // Resize canvas
        canvas.width = w + (padding * 2);
        canvas.height = h + (padding * 2) + footerH;

        // Background
        if (isBeautified) {
            // Modern dark gradient background
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, '#1a1a2e');
            grad.addColorStop(0.5, '#16213e');
            grad.addColorStop(1, '#0f3460');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Rounded corner clipping for the image
            const cornerRadius = 12;
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(padding, padding, w, h, cornerRadius);
            ctx.clip();

            // Draw image first (inside clip)
            ctx.drawImage(source, padding, padding);
            ctx.restore();

            // Draw border around image
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(padding, padding, w, h, cornerRadius);
            ctx.stroke();

            // Subtle glow effect
            ctx.shadowColor = 'rgba(79, 172, 254, 0.3)';
            ctx.shadowBlur = 40;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        } else {
            ctx.fillStyle = '#1e1e1e00';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.shadowColor = 'transparent';
            // Draw Main Image (non-beautified)
            ctx.drawImage(source, padding, padding);
        }

        // Draw Main Image (only if not already drawn in beautify block)
        if (!isBeautified) {
            // Already drawn above
        }

        // Draw Footer
        if (hasFooter) {
            ctx.shadowColor = 'transparent';
            const footerY = padding + h;
            ctx.fillStyle = '#000000';
            ctx.fillRect(padding, footerY, w, footerH);

            ctx.fillStyle = '#ffffff';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const dateStr = metadata?.capturedAt
                ? new Date(metadata.capturedAt).toLocaleDateString() + ' ' + new Date(metadata.capturedAt).toLocaleTimeString()
                : new Date().toLocaleDateString();

            const source = metadata?.url ? new URL(metadata.url).hostname : 'DeepScroll Capture';

            ctx.fillText(`${source} • ${dateStr}`, canvas.width / 2, footerY + (footerH / 2));
        }

        // Draw Selection Overlay (Only for box-based tools)
        if (isDrawing && startPos && currentPos && ['crop', 'blur', 'redact'].includes(activeTool)) {
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = 'rgba(255, 230, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(255, 230, 0, 0.2)';

            const x = Math.min(startPos.x, currentPos.x);
            const y = Math.min(startPos.y, currentPos.y);
            const rw = Math.abs(currentPos.x - startPos.x);
            const rh = Math.abs(currentPos.y - startPos.y);

            ctx.fillRect(x, y, rw, rh);
            ctx.strokeRect(x, y, rw, rh);
        }

        // Draw Rect Preview (Ghost)
        if (isDrawing && startPos && currentPos && activeTool === 'rect') {
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = CONSTANTS.ANNOTATION_COLOR;
            ctx.lineWidth = CONSTANTS.RECT_LINE_WIDTH;

            const x = Math.min(startPos.x, currentPos.x);
            const y = Math.min(startPos.y, currentPos.y);
            const rw = Math.abs(currentPos.x - startPos.x);
            const rh = Math.abs(currentPos.y - startPos.y);

            ctx.strokeRect(x, y, rw, rh);
        }


        // Draw Arrow Preview (Ghost)
        if (isDrawing && startPos && currentPos && activeTool === 'arrow') {
            const head = startPos; // Head fixed at Start
            const tail = currentPos; // Tail follows Drag

            const dx = head.x - tail.x;
            const dy = head.y - tail.y;
            const len = Math.sqrt(dx * dx + dy * dy);

            if (len < 10) return; // Prevent glitchy tiny arrows

            const angle = Math.atan2(dy, dx);
            const headlen = CONSTANTS.ARROW_HEAD_SIZE;

            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = CONSTANTS.ANNOTATION_COLOR;
            ctx.fillStyle = CONSTANTS.ANNOTATION_COLOR;
            ctx.lineWidth = CONSTANTS.LINE_WIDTH;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Shaft
            ctx.beginPath();
            ctx.moveTo(tail.x, tail.y);
            ctx.lineTo(head.x, head.y);
            ctx.stroke();

            // Head
            ctx.beginPath();
            ctx.moveTo(head.x, head.y);
            ctx.lineTo(head.x - headlen * Math.cos(angle - Math.PI / 6), head.y - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(head.x - headlen * Math.cos(angle + Math.PI / 6), head.y - headlen * Math.sin(angle + Math.PI / 6));
            ctx.lineTo(head.x, head.y);
            ctx.fill();
            ctx.stroke();
        }
    }

    function exportImage(toClipboard) {
        if (!canvasRef.current) return;

        if (toClipboard) {
            canvasRef.current.toBlob(async (blob) => {
                try {
                    const item = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([item]);
                    window.dispatchEvent(new CustomEvent('DEEPSCROLL_TOAST', {
                        detail: { message: 'Image copied to clipboard!' }
                    }));
                } catch (err) {
                    console.error("Clipboard failed", err);
                    window.dispatchEvent(new CustomEvent('DEEPSCROLL_TOAST', {
                        detail: { message: 'Failed to copy image', type: 'error' }
                    }));
                }
            }, 'image/png');
        } else {
            const url = canvasRef.current.toDataURL('image/png');
            chrome.downloads.download({
                url: url,
                filename: `deepscroll-${Date.now()}.png`,
                saveAs: true
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error("Download failed:", chrome.runtime.lastError);
                    window.dispatchEvent(new CustomEvent('DEEPSCROLL_TOAST', {
                        detail: { message: 'Download failed', type: 'error' }
                    }));
                }
            });
        }
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    // Interaction State
    /* Moved to top */

    // Mouse Handlers
    const getMousePos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const handleMouseDown = (e) => {
        const TOOLS = ['blur', 'redact', 'draw', 'arrow', 'rect', 'text', 'crop'];
        if (!TOOLS.includes(activeTool)) return;

        // Prevent default drag behavior if we are drawing
        // But draggable={false} on container handles most.

        setIsDrawing(true);
        const pos = getMousePos(e);
        setStartPos(pos);
        setCurrentPos(pos);

        // Pen Start
        if (activeTool === 'draw') {
            // We need to commit the initial dot?
            const ctx = editCanvasRef.current.getContext('2d', { willReadFrequently: true });
            // Map to internal coords
            const padding = isBeautified ? 60 : 0;
            const ix = pos.x - padding;
            const iy = pos.y - padding;

            ctx.beginPath();
            ctx.moveTo(ix, iy);
            // Store path start?
        }
    };

    const handleMouseMove = (e) => {
        if (!isDrawing) return;
        const newPos = getMousePos(e);

        if (activeTool === 'draw') {
            // Continuous Paint
            drawPenStroke(currentPos, newPos);
            setCurrentPos(newPos); // Update for next segment
        } else {
            // Dragging shape
            setCurrentPos(newPos);
        }
    };

    const handleMouseUp = () => {
        if (!isDrawing) return;
        setIsDrawing(false);

        // Commit Shapes
        let edited = false;
        if (activeTool === 'blur') { applyBlur(startPos, currentPos); edited = true; }
        if (activeTool === 'redact') { applyRedact(startPos, currentPos); edited = true; }
        if (activeTool === 'arrow') { applyArrow(startPos, currentPos); edited = true; }
        if (activeTool === 'rect') { applyRect(startPos, currentPos); edited = true; }
        if (activeTool === 'text') { applyText(currentPos); }
        if (activeTool === 'crop') { applyCrop(startPos, currentPos); edited = true; }
        if (activeTool === 'draw') edited = true;

        if (edited) saveState();

        setStartPos(null);
        setCurrentPos(null);
    };

    // --- Tool Helpers ---

    function getInternalCoords(pos) {
        if (!pos) return { x: 0, y: 0 };
        const padding = isBeautified ? 60 : 0;
        return {
            x: pos.x - padding,
            y: pos.y - padding
        };
    }

    function applyCrop(start, end) {
        if (!editCanvasRef.current) return;

        const p1 = getInternalCoords(start);
        const p2 = getInternalCoords(end);

        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);

        if (w < 10 || h < 10) return;

        // Create new canvas
        const newC = document.createElement('canvas');
        newC.width = w;
        newC.height = h;
        const nCtx = newC.getContext('2d', { willReadFrequently: true });

        nCtx.drawImage(editCanvasRef.current, x, y, w, h, 0, 0, w, h);

        // Update Ref
        editCanvasRef.current = newC;

        // Render
        renderCanvas();
    }

    function drawPenStroke(prev, curr) {
        if (!editCanvasRef.current) return;
        const ctx = editCanvasRef.current.getContext('2d', { willReadFrequently: true });
        const p1 = getInternalCoords(prev);
        const p2 = getInternalCoords(curr);

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = CONSTANTS.ANNOTATION_COLOR; // Red pen default
        ctx.lineWidth = CONSTANTS.LINE_WIDTH;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        renderCanvas();
    }

    function applyArrow(start, end) {
        if (!editCanvasRef.current) return;
        const ctx = editCanvasRef.current.getContext('2d', { willReadFrequently: true });

        // Logic: Head at Start (p1), Tail at End (p2)
        const head = getInternalCoords(start);
        const tail = getInternalCoords(end);

        const dx = head.x - tail.x;
        const dy = head.y - tail.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len < 10) return;

        const angle = Math.atan2(dy, dx);
        const headlen = CONSTANTS.ARROW_HEAD_SIZE;

        ctx.strokeStyle = CONSTANTS.ANNOTATION_COLOR;
        ctx.fillStyle = CONSTANTS.ANNOTATION_COLOR;
        ctx.lineWidth = CONSTANTS.LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Shaft
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(head.x, head.y);
        ctx.stroke();

        // Head
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(head.x - headlen * Math.cos(angle - Math.PI / 6), head.y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(head.x - headlen * Math.cos(angle + Math.PI / 6), head.y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.lineTo(head.x, head.y);
        ctx.fill();
        ctx.stroke();

        renderCanvas();
    }

    function applyRect(start, end) {
        if (!editCanvasRef.current) return;
        const ctx = editCanvasRef.current.getContext('2d', { willReadFrequently: true });
        const p1 = getInternalCoords(start);
        const p2 = getInternalCoords(end);

        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);

        ctx.strokeStyle = CONSTANTS.ANNOTATION_COLOR;
        ctx.lineWidth = CONSTANTS.RECT_LINE_WIDTH;
        ctx.strokeRect(x, y, w, h);
        renderCanvas();
    }

    function applyText(pos) {
        // Simplified text: Prompt user (Async to prevent event conflict)
        setTimeout(() => {
            const text = prompt("Enter text annotation:");
            if (!text) return;

            if (!editCanvasRef.current) return;
            const ctx = editCanvasRef.current.getContext('2d', { willReadFrequently: true });
            const p = getInternalCoords(pos);

            ctx.font = 'bold 24px sans-serif';
            ctx.fillStyle = CONSTANTS.ANNOTATION_COLOR;
            ctx.fillText(text, p.x, p.y);

            renderCanvas();
            saveState();
        }, 10);
    }

    function applyRedact(start, end) {
        if (!editCanvasRef.current) return;

        const ctx = editCanvasRef.current.getContext('2d', { willReadFrequently: true });
        const p1 = getInternalCoords(start);
        const p2 = getInternalCoords(end);

        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);

        if (w < 2 || h < 2) return;

        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, w, h);

        renderCanvas();
    }

    function applyBlur(start, end) {
        const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);

        if (w < 2 || h < 2) return; // Too small

        // Pixelate
        // 1. Get Data
        const factor = 0.1; // Downscale 10x
        const sw = Math.floor(w * factor) || 1;
        const sh = Math.floor(h * factor) || 1;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = sw;
        offCanvas.height = sh;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(canvasRef.current, x, y, w, h, 0, 0, sw, sh);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offCanvas, 0, 0, sw, sh, x, y, w, h);
        ctx.imageSmoothingEnabled = true;

        // Persist blur to edit buffer
        updateEditedImage(x, y, w, h);
    }

    function updateEditedImage(x, y, w, h) {
        if (!editCanvasRef.current) return;
        const ctx = editCanvasRef.current.getContext('2d', { willReadFrequently: true });
        const padding = isBeautified ? 60 : 0;

        const ix = x - padding;
        const iy = y - padding;

        const factor = 0.1;
        const sw = Math.floor(w * factor) || 1;
        const sh = Math.floor(h * factor) || 1;

        const off = document.createElement('canvas');
        off.width = sw;
        off.height = sh;
        const offCtx = off.getContext('2d', { willReadFrequently: true });
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(editCanvasRef.current, ix, iy, w, h, 0, 0, sw, sh);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, 0, 0, sw, sh, ix, iy, w, h);

        renderCanvas();
    }

    // Handle Drag Start
    const handleDragStart = (e) => {
        e.dataTransfer.setData('DownloadURL', `image/png:deepscroll.png:${canvasRef.current.toDataURL()}`);
    };

    return (
        <div className="flex flex-col items-center justify-center">
            <div
                className="bg-transparent"
                draggable={activeTool === 'select'}
                onDragStart={handleDragStart}
            >
                <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto block cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                />
            </div>
            {stitching && <p className="text-white mt-4 animate-pulse">Stitching...</p>}
        </div>
    );
}

// PropTypes for type checking and documentation
Canvas.propTypes = {
    /** Array of image slices to stitch together */
    slices: PropTypes.arrayOf(PropTypes.shape({
        dataUrl: PropTypes.string.isRequired,
        y: PropTypes.number.isRequired,
    })).isRequired,

    /** Metadata about the captured page */
    metadata: PropTypes.shape({
        url: PropTypes.string,
        title: PropTypes.string,
        capturedAt: PropTypes.number,
        devicePixelRatio: PropTypes.number,
    }),

    /** Callback when image stitching is complete */
    onStitchComplete: PropTypes.func,

    /** Currently active drawing tool */
    activeTool: PropTypes.oneOf([
        'select', 'blur', 'redact', 'draw', 'arrow', 'rect', 'text', 'crop'
    ]).isRequired,

    /** Whether to show the metadata footer */
    hasFooter: PropTypes.bool,

    /** Whether beautify mode (padding/shadow) is enabled */
    isBeautified: PropTypes.bool,

    /** Callback when history state changes (for undo/redo button states) */
    onHistoryChange: PropTypes.func,
};

Canvas.defaultProps = {
    metadata: null,
    onStitchComplete: null,
    hasFooter: false,
    isBeautified: false,
    onHistoryChange: null,
};
