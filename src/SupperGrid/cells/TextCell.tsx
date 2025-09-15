import { useState, useEffect } from 'react';
import type { CellComponent, BaseCellConfig, CellCommand } from '../core/types';
import { cn } from '../core/utils';

interface TextCellConfig extends BaseCellConfig {
    placeholder?: string;
    maxLength?: number;
    readOnly?: boolean;
}

export const TextCell: CellComponent<string, TextCellConfig> = ({
    id,
    value,
    config,
    registerCommands
}) => {
    // Initialize state only once, ignore future prop changes
    const [internalValue, setInternalValue] = useState(() => value ?? '');
    const [isFocused, setIsFocused] = useState(false);
    const [isSelected, setIsSelected] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Register command handler when component mounts
    useEffect(() => {
        registerCommands((command: CellCommand) => {
            console.log(`Cell ${id} received command:`, command.name, command);
            switch (command.name) {
                case 'focus':
                    setIsFocused(true);
                    break;

                case 'blur':
                    setIsFocused(false);
                    break;

                case 'select':
                    setIsSelected(true);
                    break;

                case 'unselect':
                    setIsSelected(false);
                    break;

                case 'edit':
                    if (!config.readOnly) {
                        setIsEditing(true);
                    }
                    break;

                case 'exitEdit':
                    setIsEditing(false);
                    break;

                case 'updateValue':
                    if (command.payload?.value !== undefined) {
                        setInternalValue(command.payload.value ?? '');
                    }
                    break;

                case 'error':
                    setError(command.payload?.error || 'An error occurred');
                    break;

                default:
                    // Ignore unknown commands
                    break;
            }
        });
    }, [registerCommands, config.readOnly]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        if (!config.maxLength || newValue.length <= config.maxLength) {
            setInternalValue(newValue);
            setError(null);
        }
    };

    const handleBlur = () => {
        setIsEditing(false);
        // Value is maintained in cell state, no need to sync back to props
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            setIsEditing(false);
        } else if (e.key === 'Escape') {
            // Reset to current internal value (no props dependency)
            // Could reset to last saved value if we track that
            setIsEditing(false);
        }
    };


    return (
        <div
            className={cn(
                'p-2 transition-colors',
                config.readOnly && 'bg-gray-100 cursor-not-allowed',
                isSelected && isFocused
                    ? 'bg-blue-100 ring-blue-400 ring-[0.5px]' // hybrid state
                    : isSelected
                        ? 'bg-blue-50 ring-blue-400 ring-[0.5px]'
                        : isFocused
                            ? 'bg-neutral-100 ring-neutral-800 ring-[0.5px]'
                            : ''
            )}
            data-cell-id={id}
            style={{ width: config.width }}
        >
            {isEditing && !config.readOnly ? (
                <input
                    type="text"
                    value={internalValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={config.placeholder}
                    maxLength={config.maxLength}
                    autoFocus
                    className="text-cell-input"
                />
            ) : (
                <span className="text-cell-display">
                    {internalValue || config.placeholder || ''}
                </span>
            )}
            {error && (
                <div className="text-cell-error">
                    {error}
                </div>
            )}
        </div>
    );
};
