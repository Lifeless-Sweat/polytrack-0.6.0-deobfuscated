(function createAdvancedTasUI() {
    // 1. Panel Layout Styling with Savestate Additions
    const style = document.createElement('style');
    style.innerHTML = `
        #tas-hud-panel {
            position: absolute; top: 15px; right: 15px; width: 380px;
            background: rgba(20, 20, 25, 0.98); border: 2px solid #ebcb8b;
            color: #fff; font-family: 'Courier New', monospace; border-radius: 8px;
            z-index: 999999; box-shadow: 0 4px 15px rgba(0,0,0,0.5); padding: 14px;
        }
        .tas-header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 8px; }
        .tas-title { font-weight: bold; font-size: 13px; color: #ebcb8b; }
        .tas-row { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; font-size: 12px; }
        .tas-btn-group { display: flex; gap: 6px; margin-bottom: 8px; }
        .tas-btn { background: #3b4252; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; flex: 1; text-align: center; }
        .tas-btn:hover { background: #4c566a; }
        .btn-save { background: #5e81ac; }
        .btn-load { background: #a3be8c; color: #2e3440; }
        .btn-step { background: #b48ead; }
        #tas-json-input { width: 100%; height: 120px; background: #1a1c23; color: #ebcb8b; border: 1px solid #4c566a; border-radius: 4px; font-family: monospace; font-size: 11px; padding: 6px; resize: vertical; box-sizing: border-box; }
        #tas-status-log { font-size: 11px; color: #a3be8c; margin-top: 5px; text-align: center; word-break: break-all; }
    `;
    document.head.appendChild(style);

    // 2. DOM Layout Structure
    const hud = document.createElement('div');
    hud.id = 'tas-hud-panel';
    hud.innerHTML = `
        <div class="tas-header-row">
            <div class="tas-title">🛠️ ADVANCED CWC-STYLE TAS ENGINE v4.0</div>
        </div>
        <div class="tas-row">
            <span>Timeline Frame:</span>
            <span id="tas-frame-counter" style="color: #a3be8c; font-weight: bold;">0</span>
        </div>
        
        <!-- Savestate & Stepping Core Blocks -->
        <div class="tas-btn-group">
            <button class="tas-btn btn-save" id="btn-save-state">💾 Save State (F5)</button>
            <button class="tas-btn btn-load" id="btn-load-state">⏳ Load State (F6)</button>
        </div>
        <div class="tas-btn-group">
            <button class="tas-btn btn-step" id="btn-frame-step">⏭️ Frame Advance (F7)</button>
        </div>

        <div style="margin-bottom: 10px;">
            <textarea id="tas-json-input" placeholder="Paste your instructions_v2 JSON string layout here..."></textarea>
        </div>
        <button class="tas-btn" id="btn-load-json" style="width:100%;">⚡ Compile JSON Macro Map</button>
        <div id="tas-status-log">Hold 'W' to run, F5/F6 to manage memory states.</div>
    `;
    document.body.appendChild(hud);

    // 3. Engine Global Storage
    window.tasCurrentFrame = 0;
    let timelineInputs = {}; 
    let maxTimelineLength = 0;
    let isHoldingDriveKey = false;
    let manualStepRequested = false;

    // Memory Channel allocation to hold Physics states
    let savedPhysicsState = null;
    let lastKnownCarPhysicsData = null;

    const frameCounterEl = document.getElementById('tas-frame-counter');
    const statusLogEl = document.getElementById('tas-status-log');
    const jsonInputEl = document.getElementById('tas-json-input');

    // Hotkey Controls Manager
    window.addEventListener('keydown', (e) => {
        if (document.activeElement === jsonInputEl) return;
        
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
            isHoldingDriveKey = true;
        }
        if (e.code === 'F5') { // Save State
            e.preventDefault();
            triggerSaveAction();
        }
        if (e.code === 'F6') { // Load State
            e.preventDefault();
            triggerLoadAction();
        }
        if (e.code === 'F7') { // Frame Step
            e.preventDefault();
            manualStepRequested = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
            isHoldingDriveKey = false;
            clearMainThreadInputs();
        }
    });

    document.getElementById('btn-save-state').addEventListener('click', triggerSaveAction);
    document.getElementById('btn-load-state').addEventListener('click', triggerLoadAction);
    document.getElementById('btn-frame-step').addEventListener('click', () => { manualStepRequested = true; });

    function triggerSaveAction() {
        if (lastKnownCarPhysicsData) {
            // Clone snapshot of the current worker state memory stack
            savedPhysicsState = {
                frame: window.tasCurrentFrame,
                physics: JSON.parse(JSON.stringify(lastKnownCarPhysicsData))
            };
            statusLogEl.innerText = `State Saved at frame: ${savedPhysicsState.frame}`;
        } else {
            statusLogEl.innerText = "Error: Driving must begin before state capture is valid.";
        }
    }

    function triggerLoadAction() {
        if (savedPhysicsState) {
            window.tasCurrentFrame = savedPhysicsState.frame;
            frameCounterEl.innerText = window.tasCurrentFrame;
            statusLogEl.innerText = `Loaded state back to frame: ${window.tasCurrentFrame}`;
            // Handled next loop iteration inside worker hook
        } else {
            statusLogEl.innerText = "Error: No saved state exists in memory buffer.";
        }
    }

    function clearMainThreadInputs() {
        ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyR'].forEach(k => {
            window.dispatchEvent(new KeyboardEvent('keyup', { code: k, key: k, bubbles: true }));
        });
    }

    function initFrame(f) {
        if (!timelineInputs[f]) {
            timelineInputs[f] = { up: false, down: false, left: false, right: false, reset: false };
        }
    }

    function applyInputSpan(startFrame, duration, keyField) {
        for (let i = 0; i < duration; i++) {
            let f = startFrame + i;
            initFrame(f);
            timelineInputs[f][keyField] = true;
            if (f > maxTimelineLength) maxTimelineLength = f;
        }
    }

    // JSON Parser
    document.getElementById('btn-load-json').addEventListener('click', () => {
        try {
            const rawData = JSON.parse(jsonInputEl.value);
            const data = rawData.instructions_v2 || rawData;
            timelineInputs = {}; window.tasCurrentFrame = 0; maxTimelineLength = 0;
            frameCounterEl.innerText = "0"; clearMainThreadInputs();

            const keyMappings = { w: 'up', s: 'down', a: 'left', d: 'right', r: 'reset' };
            Object.keys(keyMappings).forEach(keyChar => {
                const instructionsArray = data[keyChar] || [];
                const targetField = keyMappings[keyChar];

                instructionsArray.forEach(instr => {
                    if (instr === "0") { applyInputSpan(0, 60000, targetField); return; }
                    if (typeof instr === 'string' && instr.startsWith('!')) {
                        const parts = instr.substring(1).split('-').map(Number);
                        if (parts.length === 4) {
                            let currentAnchor = parts[0]; const holdDuration = parts[1]; const releaseDuration = parts[2]; const loopCount = parts[3];
                            for (let l = 0; l < loopCount; l++) { applyInputSpan(currentAnchor, holdDuration, targetField); currentAnchor += holdDuration + releaseDuration; }
                        }
                    } else if (typeof instr === 'string' && instr.includes('-')) {
                        const parts = instr.split('-').map(Number);
                        if (parts.length === 2) { applyInputSpan(parts[0], parts[1], targetField); }
                    }
                });
            });
            statusLogEl.innerHTML = `Parsed ${maxTimelineLength} frames. Ready.`;
        } catch (err) { statusLogEl.innerHTML = `Compiler Error: ${err.message}`; }
    });

    // 4. Isolated Worker Pipeline with State Restoration Injection Core
    const OriginalWorker = window.Worker;
    window.Worker = function(scriptURL, options) {
        const workerInstance = new OriginalWorker(scriptURL, options);

        if (typeof scriptURL === 'string' && scriptURL.includes('simulation_worker')) {
            const originalPostMessage = workerInstance.postMessage;

            workerInstance.postMessage = function(message, transfer) {
                if (message && (message.messageType === 6 || (message.up !== undefined && message.left !== undefined))) {
                    
                    // Track position transformations natively for state allocation queries
                    if (message.linearVelocity || message.position) {
                        lastKnownCarPhysicsData = message;
                    }

                    // Memory Teleport Injection: Overwrite current position data structures inside simulation thread
                    if (savedPhysicsState && window.tasCurrentFrame === savedPhysicsState.frame) {
                        if (savedPhysicsState.physics.position) message.position = savedPhysicsState.physics.position;
                        if (savedPhysicsState.physics.linearVelocity) message.linearVelocity = savedPhysicsState.physics.linearVelocity;
                        if (savedPhysicsState.physics.rotation) message.rotation = savedPhysicsState.physics.rotation;
                    }

                    // Stepping Gate Block
                    const shouldAdvanceFrame = isHoldingDriveKey || manualStepRequested;
                    
