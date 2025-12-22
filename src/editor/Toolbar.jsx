import React from 'react';
import { Wand2, Download, Copy, Share2, Crop, Type, Eraser, Pen, MousePointer2, ArrowRight, Square, Layout, RotateCcw, RotateCw, EyeOff } from 'lucide-react';
// Note: We need to install lucide-react if we haven't? 
// Checked previous npm install command, it included 'lucide-react'.

export default function Toolbar({
    onToggleBeautify,
    onToggleFooter,
    onDownload,
    onCopy,
    onToolSelect,
    activeTool,
    isBeautified,
    hasFooter,
    canUndo,
    canRedo
}) {
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl z-50">

            {/* History Group */}
            <div className="flex items-center gap-1 pr-4 border-r border-white/10">
                <ToolButton
                    icon={<RotateCcw size={18} />}
                    label="Undo"
                    onClick={() => window.dispatchEvent(new CustomEvent('DEEPSCROLL_UNDO'))}
                />
                <ToolButton
                    icon={<RotateCw size={18} />}
                    label="Redo"
                    onClick={() => window.dispatchEvent(new CustomEvent('DEEPSCROLL_REDO'))}
                />
            </div>

            {/* Tools Group */}
            <div className="flex items-center gap-1 pr-4 border-r border-white/10">
                <ToolButton
                    icon={<MousePointer2 size={18} />}
                    label="Select"
                    isActive={activeTool === 'select'}
                    onClick={() => onToolSelect('select')}
                />
                <ToolButton
                    icon={<Eraser size={18} />}
                    label="Blur"
                    isActive={activeTool === 'blur'}
                    onClick={() => onToolSelect('blur')}
                />
                <ToolButton
                    icon={<EyeOff size={18} />}
                    label="Redact"
                    isActive={activeTool === 'redact'}
                    onClick={() => onToolSelect('redact')}
                />
                <ToolButton
                    icon={<Pen size={18} />}
                    label="Draw"
                    isActive={activeTool === 'draw'}
                    onClick={() => onToolSelect('draw')}
                />
                <ToolButton
                    icon={<ArrowRight size={18} />}
                    label="Arrow"
                    isActive={activeTool === 'arrow'}
                    onClick={() => onToolSelect('arrow')}
                />
                <ToolButton
                    icon={<Square size={18} />}
                    label="Rectangle"
                    isActive={activeTool === 'rect'}
                    onClick={() => onToolSelect('rect')}
                />
                <ToolButton
                    icon={<Type size={18} />}
                    label="Text"
                    isActive={activeTool === 'text'}
                    onClick={() => onToolSelect('text')}
                />
                <ToolButton
                    icon={<Crop size={18} />}
                    label="Crop"
                    isActive={activeTool === 'crop'}
                    onClick={() => onToolSelect('crop')}
                />
            </div>

            {/* Enhancements Group */}
            <div className="flex items-center gap-1 pr-4 border-r border-white/10 pl-2">
                <ToolButton
                    icon={<Wand2 size={18} />}
                    label="Beautify"
                    isActive={isBeautified}
                    onClick={onToggleBeautify}
                />
                <ToolButton
                    icon={<Layout size={18} />}
                    label="Footer"
                    isActive={hasFooter}
                    onClick={onToggleFooter}
                />
            </div>

            {/* Export Group */}
            <div className="flex items-center gap-1 pl-2">
                <ToolButton
                    icon={<Copy size={18} />}
                    label="Copy"
                    onClick={onCopy}
                />
                <ToolButton
                    icon={<Download size={18} />}
                    label="Save"
                    primary
                    onClick={onDownload}
                />
            </div>
        </div>
    );
}

function ToolButton({ icon, label, isActive, primary, disabled, onClick }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
        group relative p-2.5 rounded-full transition-all duration-200 flex items-center justify-center
        ${primary
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : isActive
                        ? 'bg-white text-black'
                        : disabled
                            ? 'text-neutral-400 opacity-20 cursor-not-allowed'
                            : 'text-neutral-400 hover:text-white hover:bg-white/10'
                }
      `}
        >
            {icon}

            {/* Custom Premium Tooltip */}
            <span className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2 py-1 
                           bg-neutral-800 border border-white/10 text-white text-xs font-medium 
                           rounded shadow-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 
                           transition-all duration-200 pointer-events-none whitespace-nowrap z-[60]">
                {label}
            </span>
        </button>
    );
}
