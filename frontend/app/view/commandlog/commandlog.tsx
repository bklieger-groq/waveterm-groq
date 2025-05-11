// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { BlockNodeModel } from "@/app/block/blocktypes";
import { ViewModel, ViewComponent } from "@/types/custom";
import { WOS, globalStore } from "@/store/global";
import { Block } from "@/types/gotypes";
import * as jotai from "jotai";
import * as React from "react";
import "./commandlog.scss";

interface CommandLogEntry {
    id: string;
    command: string;
    timestamp: number;
    folder?: string;
}

interface CommandFolder {
    id: string;
    name: string;
    commands: CommandLogEntry[];
}

class CommandLogViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    viewIcon: jotai.Atom<string>;
    viewName: jotai.Atom<string>;
    noPadding: jotai.PrimitiveAtom<boolean>;
    commands: jotai.WritableAtom<CommandLogEntry[], [CommandLogEntry[]], void>;
    folders: jotai.WritableAtom<CommandFolder[], [CommandFolder[]], void>;
    searchTerm: jotai.Atom<string>;
    selectedFolder: jotai.Atom<string | null>;

    constructor(blockId: string, nodeModel: BlockNodeModel) {
        this.viewType = "commandlog";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.viewIcon = jotai.atom("list");
        this.viewName = jotai.atom("Command Log");
        this.noPadding = jotai.atom(false);
        this.commands = jotai.atom<CommandLogEntry[]>([]);
        this.folders = jotai.atom<CommandFolder[]>([]);
        this.searchTerm = jotai.atom("");
        this.selectedFolder = jotai.atom<string | null>(null);

        // Load saved data from localStorage
        this.loadSavedData();

        // Subscribe to terminal input events
        const handleTerminalInput = (event: CustomEvent) => {
            const command = event.detail;
            if (command && typeof command === "string") {
                // Clean up command by removing prompt prefix
                const cleanCommand = this.cleanCommand(command);
                if (cleanCommand) {
                    const newEntry: CommandLogEntry = {
                        id: Math.random().toString(36).substr(2, 9),
                        command: cleanCommand,
                        timestamp: Date.now()
                    };
                    const currentCommands = globalStore.get(this.commands) as CommandLogEntry[];
                    globalStore.set(this.commands, [newEntry, ...currentCommands]);
                    this.saveData();
                }
            }
        };

        window.addEventListener("terminalinput", handleTerminalInput as EventListener);

        // Cleanup subscription on dispose
        this.dispose = () => {
            window.removeEventListener("terminalinput", handleTerminalInput as EventListener);
        };
    }

    private cleanCommand(command: string): string {
        // Remove common shell prompt patterns
        return command
            .replace(/^[^%]*[%#]\s*/, '') // Remove prompt with % or #
            .replace(/^[^$]*\$\s*/, '')   // Remove prompt with $
            .replace(/^[^>]*>\s*/, '')    // Remove prompt with >
            .trim();
    }

    private loadSavedData() {
        try {
            const savedData = localStorage.getItem('commandlog-shared');
            if (savedData) {
                const { commands, folders } = JSON.parse(savedData);
                globalStore.set(this.commands, commands);
                globalStore.set(this.folders, folders);
            }
        } catch (error) {
            console.error('Error loading saved command log data:', error);
        }
    }

    private saveData() {
        try {
            const commands = globalStore.get(this.commands);
            const folders = globalStore.get(this.folders);
            localStorage.setItem('commandlog-shared', JSON.stringify({ commands, folders }));
        } catch (error) {
            console.error('Error saving command log data:', error);
        }
    }

    get viewComponent(): ViewComponent {
        return CommandLogView;
    }

    createFolder(name: string) {
        const currentFolders = globalStore.get(this.folders) as CommandFolder[];
        const newFolder: CommandFolder = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            commands: []
        };
        globalStore.set(this.folders, [...currentFolders, newFolder]);
        this.saveData();
    }

    deleteFolder(folderId: string) {
        const currentFolders = globalStore.get(this.folders) as CommandFolder[];
        const updatedFolders = currentFolders.filter(f => f.id !== folderId);
        globalStore.set(this.folders, updatedFolders);
        this.saveData();
    }

    moveCommandToFolder(commandId: string, folderId: string | null) {
        const currentCommands = globalStore.get(this.commands) as CommandLogEntry[];
        const currentFolders = globalStore.get(this.folders) as CommandFolder[];
        
        // Find the command
        const command = currentCommands.find(cmd => cmd.id === commandId);
        if (!command) return;

        // Remove from current folder if any
        if (command.folder) {
            const oldFolder = currentFolders.find(f => f.id === command.folder);
            if (oldFolder) {
                oldFolder.commands = oldFolder.commands.filter(cmd => cmd.id !== commandId);
            }
        }

        // Add to new folder
        if (folderId) {
            const newFolder = currentFolders.find(f => f.id === folderId);
            if (newFolder) {
                command.folder = folderId;
                newFolder.commands.push(command);
            }
        } else {
            command.folder = undefined;
        }

        globalStore.set(this.folders, currentFolders);
        this.saveData();
    }

    deleteCommand(id: string) {
        const currentCommands = globalStore.get(this.commands) as CommandLogEntry[];
        const currentFolders = globalStore.get(this.folders) as CommandFolder[];
        
        // Remove from commands
        const updatedCommands = currentCommands.filter(cmd => cmd.id !== id);
        globalStore.set(this.commands, updatedCommands);

        // Remove from any folder
        currentFolders.forEach(folder => {
            folder.commands = folder.commands.filter(cmd => cmd.id !== id);
        });
        globalStore.set(this.folders, currentFolders);
        
        this.saveData();
    }

    dispose() {
        // Cleanup handled in constructor
    }
}

const CommandLogView: ViewComponent<CommandLogViewModel> = ({ blockId, model }) => {
    const commands = jotai.useAtomValue(model.commands) as CommandLogEntry[];
    const folders = jotai.useAtomValue(model.folders) as CommandFolder[];
    const selectedFolder = jotai.useAtomValue(model.selectedFolder);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [newFolderName, setNewFolderName] = React.useState("");

    const filteredCommands = React.useMemo(() => {
        let cmds = commands;
        if (selectedFolder) {
            const folder = folders.find(f => f.id === selectedFolder);
            if (folder) {
                cmds = folder.commands;
            }
        }
        return cmds.filter(cmd => 
            cmd.command.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [commands, folders, selectedFolder, searchTerm]);

    const handleCreateFolder = () => {
        if (newFolderName.trim()) {
            model.createFolder(newFolderName.trim());
            setNewFolderName("");
        }
    };

    return (
        <div className="view-commandlog">
            <div className="commandlog-header">
                <div className="commandlog-search-container">
                    <input
                        type="text"
                        placeholder="Search commands..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="commandlog-search"
                    />
                </div>
                <div className="commandlog-folder-controls">
                    <input
                        type="text"
                        placeholder="New folder name..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="commandlog-folder-input"
                    />
                    <button onClick={handleCreateFolder} className="commandlog-folder-button">
                        Create Folder
                    </button>
                </div>
            </div>
            <div className="commandlog-content">
                <div className="commandlog-folders">
                    <div 
                        className={`commandlog-folder ${selectedFolder === null ? 'selected' : ''}`}
                        onClick={() => globalStore.set(model.selectedFolder, null)}
                    >
                        All Commands
                    </div>
                    {folders.map(folder => (
                        <div 
                            key={folder.id}
                            className={`commandlog-folder ${selectedFolder === folder.id ? 'selected' : ''}`}
                            onClick={() => globalStore.set(model.selectedFolder, folder.id)}
                        >
                            {folder.name}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    model.deleteFolder(folder.id);
                                }}
                                className="commandlog-folder-delete"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
                <div className="commandlog-table-container">
                    <div className="commandlog-table-scroll">
                        <div className="commandlog-table-header">
                            <table className="commandlog-table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Command</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCommands.map(cmd => (
                                        <tr key={cmd.id}>
                                            <td>
                                                <div>{new Date(cmd.timestamp).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}</div>
                                                <div>{new Date(cmd.timestamp).toLocaleTimeString(undefined, {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit'
                                                })}</div>
                                            </td>
                                            <td>{cmd.command}</td>
                                            <td>
                                                <select
                                                    value={cmd.folder || ""}
                                                    onChange={(e) => model.moveCommandToFolder(cmd.id, e.target.value || null)}
                                                    className="commandlog-folder-select"
                                                >
                                                    <option value="">No Folder</option>
                                                    {folders.map(folder => (
                                                        <option key={folder.id} value={folder.id}>
                                                            {folder.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => model.deleteCommand(cmd.id)}
                                                    className="commandlog-action-button"
                                                    title="Delete"
                                                >
                                                    <i className="fa-regular fa-trash-can" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export { CommandLogViewModel }; 