/**
 * @fileoverview Drawing tool utilities for DeepScroll Canvas Editor.
 * Provides functions for applying various annotation tools to the canvas.
 */

import { CONSTANTS } from './constants.js';

/**
 * Converts screen coordinates to internal canvas buffer coordinates.
 * @param {Object} pos - The screen position {x, y}
 * @param {boolean} isBeautified - Whether beautify mode is active
 * @returns {Object} Internal coordinates {x, y}
 */
export function getInternalCoords(pos, isBeautified) {
    if (!pos) return { x: 0, y: 0 };
    const padding = isBeautified ? CONSTANTS.BEAUTIFY_PADDING : 0;
    return {
        x: pos.x - padding,
        y: pos.y - padding
    };
}

/**
 * Calculates rectangle bounds from two corner points.
 * @param {Object} p1 - First corner {x, y}
 * @param {Object} p2 - Second corner {x, y}
 * @returns {Object} Rectangle bounds {x, y, w, h}
 */
export function getRectBounds(p1, p2) {
    return {
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        w: Math.abs(p2.x - p1.x),
        h: Math.abs(p2.y - p1.y)
    };
}

/**
 * Draws an arrow on the canvas context.
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} head - Arrow head position {x, y}
 * @param {Object} tail - Arrow tail position {x, y}
 */
export function drawArrow(ctx, head, tail) {
    const dx = head.x - tail.x;
    const dy = head.y - tail.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < CONSTANTS.MIN_ARROW_LENGTH) return;

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
}

/**
 * Draws a rectangle outline on the canvas context.
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} bounds - Rectangle bounds {x, y, w, h}
 */
export function drawRect(ctx, bounds) {
    ctx.strokeStyle = CONSTANTS.ANNOTATION_COLOR;
    ctx.lineWidth = CONSTANTS.RECT_LINE_WIDTH;
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
}

/**
 * Draws a pen stroke between two points.
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} from - Start point {x, y}
 * @param {Object} to - End point {x, y}
 */
export function drawPenLine(ctx, from, to) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = CONSTANTS.ANNOTATION_COLOR;
    ctx.lineWidth = CONSTANTS.LINE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

/**
 * Applies a black redaction fill to an area.
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} bounds - Area bounds {x, y, w, h}
 */
export function applyRedaction(ctx, bounds) {
    if (bounds.w < CONSTANTS.MIN_SELECTION_SIZE || bounds.h < CONSTANTS.MIN_SELECTION_SIZE) return;
    ctx.fillStyle = CONSTANTS.REDACT_COLOR;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
}

/**
 * Applies a pixelation/blur effect to an area.
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {HTMLCanvasElement} sourceCanvas - The source canvas to read from
 * @param {Object} bounds - Area bounds {x, y, w, h}
 */
export function applyPixelation(ctx, sourceCanvas, bounds) {
    const { x, y, w, h } = bounds;
    if (w < CONSTANTS.MIN_SELECTION_SIZE || h < CONSTANTS.MIN_SELECTION_SIZE) return;

    const factor = CONSTANTS.BLUR_FACTOR;
    const sw = Math.floor(w * factor) || 1;
    const sh = Math.floor(h * factor) || 1;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = sw;
    offCanvas.height = sh;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    offCtx.imageSmoothingEnabled = false;
    offCtx.drawImage(sourceCanvas, x, y, w, h, 0, 0, sw, sh);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offCanvas, 0, 0, sw, sh, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
}

/**
 * Draws text annotation at position.
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {string} text - The text to draw
 * @param {Object} pos - Position {x, y}
 */
export function drawText(ctx, text, pos) {
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = CONSTANTS.ANNOTATION_COLOR;
    ctx.fillText(text, pos.x, pos.y);
}
