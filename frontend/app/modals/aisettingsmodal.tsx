// Copyright 2025, Groq, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Modal } from "@/app/modals/modal";
import { modalsModel } from "@/store/modalmodel";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { fireAndForget } from "@/util/util";
import { useState, useEffect } from "react";
import { useSettingsKeyAtom } from "@/store/global";
import { makeIconClass } from "@/util/util";
import "./aisettingsmodal.scss";

const AiSettingsModal = () => {
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const savedApiKey = useSettingsKeyAtom("ai:apitoken");

    useEffect(() => {
        if (savedApiKey) {
            setApiKey(savedApiKey);
        }
    }, [savedApiKey]);

    const handleSave = () => {
        fireAndForget(() =>
            RpcApi.SetConfigCommand(TabRpcClient, {
                "ai:apitoken": apiKey,
            })
        );
        modalsModel.popModal();
    };

    const toggleShowKey = () => {
        setShowKey(!showKey);
    };

    return (
        <Modal 
            className="ai-settings-modal" 
            onOk={handleSave} 
            onClose={() => modalsModel.popModal()}
            okLabel="Save"
            cancelLabel="Cancel"
        >
            <div className="modal-content">
                <h2>AI Settings</h2>
                <div className="settings-form">
                    <div className="form-group">
                        <label htmlFor="apiKey">Groq API Key</label>
                        <div className="input-with-button">
                            <input
                                type={showKey ? "text" : "password"}
                                id="apiKey"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your Groq API key"
                            />
                            <button className="view-button" onClick={toggleShowKey} type="button" title={showKey ? "Hide API Key" : "Show API Key"}>
                                <i className={makeIconClass(showKey ? "eye-slash" : "eye", false)} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

AiSettingsModal.displayName = "AiSettingsModal";

export { AiSettingsModal }; 