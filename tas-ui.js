(function createCwcTrueTasEngineV6() {
    // 1. Sleek Dashboard Node Layout Styling
    const style = document.createElement('style');
    style.innerHTML = `
        #cwc-tas-dashboard {
            position: absolute; top: 30px; right: 30px; width: 420px;
            background: rgba(16, 22, 39, 0.96); border: 2px solid #3c5478;
            color: #ffffff; font-family: 'Segoe UI', sans-serif; border-radius: 8px;
            z-index: 999999; box-shadow: 0 10px 30px rgba(0,0,0,0.7); display: block;
        }
        .dash-title-bar { background: #222d4a; padding: 12px; font-size: 14px; font-weight: bold; text-align: center; color: #79a6db; text-transform: uppercase; border-bottom: 2px solid #3c5478; border-radius: 6px 6px 0 0; }
        .dash-inner-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .dash-section-lbl { font-size: 11px; color: #4b668f; font-weight: bold; text-transform: uppercase; border-bottom: 1px dashed #222d4a; padding-bottom: 2px; }
        .dash-stat-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
        .dash-badge { color: #a3be8c; font-weight: bold; background: #0c0f1d; padding: 3px 8px; border-radius: 4px; font-family: monospace; border: 1px solid #222d4a; }
        .dash-btn-footer { display: flex; gap: 8px; margin-top: 10px; }
        .dash-action-btn { background: #2b385c; color: white; border: 1px solid #3c5478; padding: 9px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; flex: 1; text-align: center; }
        .dash-action-btn:hover { background: #384978; }
        .btn-green-apply { background: #1b4d22; border-color: #2e7d32; }
        .btn-green-apply:hover { background: #256b29; }
    `;
    document.head.appendChild(style);

    // 2. DOM Interface Attachment
    const dashboard = document.createElement('div');
    dashboard.id = 'cwc-tas-dashboard';
    dashboard.innerHTML = `
        <div class="dash-title-bar">Settings</div>
        <div class="dash-inner-body">
            <div class="dash-section-lbl">Live Telemetry</div>
            <div class="dash-stat-row"><span>Simulation State:</span><span id="txt-sim-state" class="dash-badge" style="color:#bf616a;">PAUSED</span></div>
            <div class="dash-stat-row"><span>Current Frame Node:</span><span id="txt-sim-frame" class="dash-badge">0</span></div>
            
            <div class="dash-section-lbl">Controls</div>
            <div class="dash-stat-row"><span>Toggle Menu UI Window</span><span class="dash-badge" style="color:#79a6db;">U</span></div>
            <div class="dash-stat-row"><span>Pause / Unpause Game</span><span class="dash-badge" style="color:#79a6db;">I / SPACE</span></div>
            
            <div class="dash-section-lbl">TAS Engine Mapping</div>
            <div class="dash-stat-row"><span>SaveState Checkpoint</span><span class="dash-badge" style="color:#79a6db;">L</span></div>
            <div class="dash-stat-row"><span>Fast-Forward Frame Skip</span><span class="dash-badge" style="color:#79a6db;">K</span></div>

            <div class="dash-section-lbl">Macro Pipelines</div>
            <div class="dash-btn-footer">
                <button class="dash-action-btn" id="act-load-macro">Load TAS</button>
                <button class="dash-action-btn" id="act-export-macro">Export TAS</button>
                <button class="dash-action-btn btn-green-apply" id="act-close-ui">Apply ✓</button>
            </div>
        </div>
    `;
    document.body.appendChild(dashboard);

    // 3. Variables & Core Memory Log Structures
    let recordedInputsTimeline = {}; 
    let activeSaveStateCheckpoint = null; 
    let lastPolledCarPhysicsData = null; 

    window.tasCurrentFrame = 0;
    let isGameSuspended = true; 
    let fastForwardFramesRemaining = 0; 
    
    const currentLiveKeyboardState = { up: false, down: false, left: false, right: false, reset: false };

    const txtSimState = document.getElementById('txt-sim-state');
    const txtSimFrame = document.getElementById('txt-sim-frame');

    // 4. Input Listener Configuration
    window.addEventListener('keydown', (e) => {
        // Prevent action triggers while actively writing text inside macro prompts
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        if (e.code === 'KeyU') {
            e.preventDefault();
            dashboard.style.display = (dashboard.style.display === 'none') ? 'block' : 'none';
            return;
        }

        if (e.code === 'KeyI' || e.code === 'Space') {
            e.preventDefault();
            isGameSuspended = !isGameSuspended;
            txtSimState.innerText = isGameSuspended ? "PAUSED" : "RUNNING";
            txtSimState.style.color = isGameSuspended ? "#bf616a" : "#a3be8c";
            return;
        }

        if (e.code === 'KeyL') { 
            e.preventDefault();
            if (lastPolledCarPhysicsData) {
                activeSaveStateCheckpoint = {
                    frame: window.tasCurrentFrame,
                    physicsSnapshot: JSON.parse(JSON.stringify(lastPolledCarPhysicsData)),
                    timelineBackup: JSON.parse(JSON.stringify(recordedInputsTimeline))
                };
                console.log(`Checkpoint baseline locked at frame: ${window.tasCurrentFrame}`);
            }
            return;
        }

        if (e.code === 'KeyK') { 
            e.preventDefault();
            if (activeSaveStateCheckpoint) {
                fastForwardFramesRemaining = 50; 
                isGameSuspended = false; 
                txtSimState.innerText = "FAST-FORWARDING";
                txtSimState.style.color = "#b48ead";
            }
            return;
        }

        if (e.code === 'KeyW' || e.code === 'ArrowUp')    currentLiveKeyboardState.up = true;
        if (e.code === 'KeyS' || e.code === 'ArrowDown')  currentLiveKeyboardState.down = true;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft')  currentLiveKeyboardState.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') currentLiveKeyboardState.right = true;
        if (e.code === 'KeyR')                             currentLiveKeyboardState.reset = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW' || e.code === 'ArrowUp')    currentLiveKeyboardState.up = false;
        if (e.code === 'KeyS' || e.code === 'ArrowDown')  currentLiveKeyboardState.down = false;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft')  currentLiveKeyboardState.left = false;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') currentLiveKeyboardState.right = false;
        if (e.code === 'KeyR')                             currentLiveKeyboardState.reset = false;
    });

    document.getElementById('act-close-ui').addEventListener('click', () => { dashboard.style.display = 'none'; });

    // 5. Save/Load Parsing Engine Logic Blocks
    document.getElementById('act-export-macro').addEventListener('click', () => {
        const exportFormat = { instructions_v2: { w: [], a: [], s: [], d: [], r: [] } };
        const keyCharMap = { up: 'w', left: 'a', down: 's', right: 'd', reset: 'r' };
        let activeTracks = { up: null, left: null, down: null, right: null, reset: null };

        for (let f = 0; f <= window.tasCurrentFrame; f++) {
            const inputs = recordedInputsTimeline[f] || { up: false, left: false, down: false, right: false, reset: false };
            Object.keys(activeTracks).forEach(key => {
                const char = keyCharMap[key];
                if (inputs[key]) {
                    if (activeTracks[key] === null) activeTracks[key] = { start: f, count: 1 };
                    else activeTracks[key].count++;
                } else {
                    if (activeTracks[key] !== null) {
                        exportFormat.instructions_v2[char].push(`${activeTracks[key].start}-${activeTracks[key].count}`);
                        activeTracks[key] = null;
                    }
                }
            });
        }
        Object.keys(activeTracks).forEach(key => {
            if (activeTracks[key] !== null) exportFormat.instructions_v2[keyCharMap[key]].push(`${activeTracks[key].start}-${activeTracks[key].count}`);
        });

        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(JSON.stringify(exportFormat, null, 2));
        const exportAnchor = document.createElement('a');
        exportAnchor.setAttribute('href', dataUri);
        exportAnchor.setAttribute('download', 'cwc_tas_run.json');
        exportAnchor.click();
    });

    document.getElementById('act-load-macro').addEventListener('click', () => {
        const rawJsonInput = prompt("Paste your instructions_v2 Macro JSON String:");
        if (!rawJsonInput) return;
        try {
            const parsed = JSON.parse(rawJsonInput);
            const data = parsed.instructions_v2 || parsed;
            recordedInputsTimeline = {}; window.tasCurrentFrame = 0;
            const compilerMap = { w: 'up', s: 'down', a: 'left', d: 'right', r: 'reset' };

            Object.keys(compilerMap).forEach(char => {
                const sequences = data[char] || [];
                const targetField = compilerMap[char];
                sequences.forEach(str => {
                    if (str === "0") return;
                    if (str.includes('-')) {
                        const parts = str.split('-').map(Number);
                        for(let i = 0; i < parts[1]; i++) {
                            let f = parts[0] + i;
                            if(!recordedInputsTimeline[f]) recordedInputsTimeline[f] = { up: false, down: false, left: false, right: false, reset: false };
                            recordedInputsTimeline[f][targetField] = true;
                        }
                    }
                });
            });
alert("Macro Timeline Loaded successfully!");} catch(e) { alert("Error parsing TAS file: " + e.message); }});// 6. Hooking the Web Worker Simulation Thread Channelconst OriginalWorker = window.Worker;window.Worker = function(scriptURL, options) {const workerInstance = new OriginalWorker(scriptURL, options);if (typeof scriptURL === 'string' && scriptURL.includes('simulation_worker')) {const originalPostMessage = workerInstance.postMessage;workerInstance.postMessage = function(message, transfer) {if (message && (message.messageType === 6 || message.up !== undefined)) {if (message.linearVelocity || message.position) lastPolledCarPhysicsData = message;// Fast-Forward Core Loop Gateif (fastForwardFramesRemaining > 0) {fastForwardFramesRemaining--;if (fastForwardFramesRemaining === 0) {isGameSuspended = true;txtSimState.innerText = "PAUSED";txtSimState.style.color = "#bf616a";}}if (isGameSuspended) {message.up = false; message.down = false; message.left = false; message.right = false; message.reset = false;return originalPostMessage.apply(this, arguments);}if (activeSaveStateCheckpoint && window.tasCurrentFrame === activeSaveStateCheckpoint.frame) {if (activeSaveStateCheckpoint.physicsSnapshot.position) message.position = activeSaveStateCheckpoint.physicsSnapshot.position;if (activeSaveStateCheckpoint.physicsSnapshot.linearVelocity) message.linearVelocity = activeSaveStateCheckpoint.physicsSnapshot.linearVelocity;if (activeSaveStateCheckpoint.physicsSnapshot.rotation) message.rotation = activeSaveStateCheckpoint.physicsSnapshot.rotation;}if (!recordedInputsTimeline[window.tasCurrentFrame]) {recordedInputsTimeline[window.tasCurrentFrame] = {up: currentLiveKeyboardState.up, down: currentLiveKeyboardState.down,left: currentLiveKeyboardState.left, right: currentLiveKeyboardState.right, reset: currentLiveKeyboardState.reset};}let frameState = recordedInputsTimeline[window.tasCurrentFrame];message.up = frameState.up; message.down = frameState.down;message.left = frameState.left; message.right = frameState.right; message.reset = frameState.reset;window.tasCurrentFrame++;if (window.tasCurrentFrame % 10 === 0) txtSimFrame.innerText = window.tasCurrentFrame;}return originalPostMessage.apply(this, arguments);};}return workerInstance;};window.Worker.prototype = OriginalWorker.prototype;})();
