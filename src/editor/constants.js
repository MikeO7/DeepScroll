/**
 * @fileoverview Centralized constants for the DeepScroll Canvas Editor.
 * Edit these values to customize the appearance and behavior of all tools.
 */

export const CONSTANTS = {
    /** Padding around the image when Beautify mode is enabled */
    BEAUTIFY_PADDING: 60,

    /** Height of the metadata footer */
    FOOTER_HEIGHT: 40,

    /** Size of arrow heads in pixels */
    ARROW_HEAD_SIZE: 25,

    /** Default line width for pen and arrow tools */
    LINE_WIDTH: 6,

    /** Line width for rectangle outlines */
    RECT_LINE_WIDTH: 8,

    /** Downscale factor for blur/pixelation effect (0.1 = 10x reduction) */
    BLUR_FACTOR: 0.1,

    /** Minimum length for an arrow to be drawn */
    MIN_ARROW_LENGTH: 10,

    /** Minimum size for blur/redact selections */
    MIN_SELECTION_SIZE: 2,

    /** Minimum size for crop selections */
    MIN_CROP_SIZE: 10,

    /** Primary annotation color (red) */
    ANNOTATION_COLOR: '#ef4444',

    /** Redaction fill color (black) */
    REDACT_COLOR: '#000000',

    /** Maximum number of undo/redo history states */
    HISTORY_LIMIT: 20,
};
