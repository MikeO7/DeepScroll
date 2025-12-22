/**
 * @fileoverview Custom hook for managing undo/redo history state.
 * Provides a clean interface for history management with configurable limits.
 */

import { useState, useCallback } from 'react';
import { CONSTANTS } from './constants.js';

/**
 * Custom hook for managing canvas history state (undo/redo).
 * @param {number} [limit] - Maximum number of history states to keep
 * @returns {Object} History management interface
 */
export function useHistory(limit = CONSTANTS.HISTORY_LIMIT) {
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    /**
     * Saves a new state to history, pruning future states if in middle of history.
     * @param {ImageData} imageData - The canvas image data to save
     */
    const saveState = useCallback((imageData) => {
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(imageData);

            // Enforce history limit
            if (newHistory.length > limit) {
                newHistory.shift();
                return newHistory;
            }
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, limit - 1));
    }, [historyIndex, limit]);

    /**
     * Moves back one step in history.
     * @returns {ImageData|null} The previous state, or null if at beginning
     */
    const undo = useCallback(() => {
        if (historyIndex <= 0) return null;
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        return history[newIndex];
    }, [history, historyIndex]);

    /**
     * Moves forward one step in history.
     * @returns {ImageData|null} The next state, or null if at end
     */
    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return null;
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        return history[newIndex];
    }, [history, historyIndex]);

    /**
     * Initializes history with an initial state.
     * @param {ImageData} imageData - The initial canvas state
     */
    const initHistory = useCallback((imageData) => {
        setHistory([imageData]);
        setHistoryIndex(0);
    }, []);

    return {
        history,
        historyIndex,
        saveState,
        undo,
        redo,
        initHistory,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
    };
}
