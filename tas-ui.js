(function createCwcTrueTasEngine() {
    // 1. Sleek Settings HUD Layout Styling (Matches the cwcinc theme colors)
    const style = document.createElement('style');
    style.innerHTML = `
        #tas-cwc-hud {
            position: absolute; top: 20px; right: 20px; width: 340px;
            background: rgba(26, 32, 53, 0.98); border: 2px solid #5275a1;
            color: #ffffff; font-family: 'Courier New', monospace; border-radius: 6px;
            z-index: 999999; box-shadow: 0 6px 20px rgba(0,0,0,0.6); padding: 14px;
        }
        .hud-header { font-weight: bold; font-size: 14px; text-align: center; color: #8cb4e6; border-bottom: 2px solid #3b4870; padding-bottom: 6px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .hud-section { font-size: 11px; color: #7388b1; margin-top: 8px; font-weight: bold; text-transform: uppercase; border-bottom: 1px dashed #3b4870; padding-bottom: 2px; }
        .hud-row { display: flex; justify-content: space-between; margin: 6px 0; align-items: center; font-size: 12px; }
        .hud-val { color: #a3be8c; font-weight: bold; background: #111424; padding: 2px 6px; border-radius: 4px; }
        .hud-btn-group { display: flex; gap: 6px; margin-top: 10px; }
        .hud-btn { background: #3b4870; color: white; border: 1px solid #5275a1; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; flex: 1; text-align: center; }
        .hud-btn:hover { background: #4d5e94; }
        .btn-apply { background: #2e6930; border-color: #449c47; }
        .btn-apply:hover { background: #3b873e; }
    `;
    document.head.appendChild(style);

    // 2. DOM Interface Attachment
    const hud = document.createElement('div');
    hud.id = 'tas-cwc-hud';
    hud.innerHTML = `
        <div class="hud-header">Settings</div>
        
        <div class="hud-section">Status</div>
        <div class="hud-row"><span>State:</span><span id="tas-pause-state" class="hud-val" style="color:#bf616a;">PAUSED</span></div>
        <div class="hud-row"><span>Current Frame:</span><span id="tas-frame-txt" class="hud-val">0</span></div>
        
        <div class="hud-section">TAS Controls (Hotkeys)</div>
        <div class="hud-row"><span>Pause / Unpause</span><span class="hud-val" style="color:#8cb4e6;">P / SPACE</span></div>
        <div class="hud-row"><span>SaveState Checkpoint</span><span class="hud-val" style="color:#8cb4e6;">L</span></div>
        <div class="hud-row"><span>Reset to Checkpoint</span><span class="hud-val" style="color:#8cb4e6;">P (when paused)</span></div>
        <div class="hud-row"><span>Auto Tapping Toggle</span><span class="hud-val" style="color:#8cb4e6;">O</span></div>

        <div class="hud-section">Data Pipelines</div>
        <div class="hud-btn-group">
            <button class="hud-btn" id="btn-load-tas">Load TAS</button>
            <button class="hud-btn btn-apply" id="btn-export-tas">Export TAS ✓</button>
        </div>
    `;
    document.body.appendChild(hud);

    // 3. Engine Memory Matrix Arrays
    let frameHistoryLog = []; 
    let recordedInputsTimeline = {}; 
    
    let activeSaveStateCheckpoint = null; 
    let lastPolledCarPhysicsData = null; 

    window.tasCurrentFrame = 0;
    let isGameSuspended = true; 
    let autoTappingActive = false;

    const currentLiveKeyboardState = { up: false, down: false, left: false, right: false, reset: false };

    const txtPauseState = document.getElementById('tas-pause-state');
    const txtFrameCounter = document.getElementById('tas-frame-txt');

    // 4. Live Keyboard Listener Arrays
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyP' || e.code === 'Space') {
            e.preventDefault();
            isGameSuspended = !isGameSuspended;
            txtPauseState.innerText = isGameSuspended ? "PAUSED" : "RUNNING";
            txtPauseState.style.color = isGameSuspended ? "#bf616a" : "#a3be8c";
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
                alert(`Checkpoint Saved Successfully at Frame: ${window.tasCurrentFrame}`);
            }
            return;
        }

        if (e.code === 'KeyO') { 
            e.preventDefault();
            autoTappingActive = !autoTappingActive;
            alert(`Auto Tapping set to: ${autoTappingActive ? 'ENABLED' : 'DISABLED'}`);
            return;
        }

        if (isGameSuspended && (e.code === 'KeyR' || e.code === 'KeyP')) {
            if (activeSaveStateCheckpoint) {
                window.tasCurrentFrame = activeSaveStateCheckpoint.frame;
                recordedInputsTimeline = JSON.parse(JSON.stringify(activeSaveStateCheckpoint.timelineBackup));
                frameHistoryLog = frameHistoryLog.slice(0, window.tasCurrentFrame);
                txtFrameCounter.innerText = window.tasCurrentFrame;
                return;
            }
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

    // 5. Native Load and Export Actions (Macro Pipeline Formatting Fixes)
    document.getElementById('btn-export-tas').addEventListener('click', () => {
        const exportFormat = { instructions_v2: { w: [], a: [], s: [], d: [], r: [] } };
        const keyCharMap = { up: 'w', left: 'a', down: 's', right: 'd', reset: 'r' };

        let activeTracks = { up: null, left: null, down: null, right: null, reset: null };

        for (let f = 0; f <= window.tasCurrentFrame; f++) {
            const inputs = recordedInputsTimeline[f] || { up: false, left: false, down: false, right: false, reset: false };
            
            Object.keys(activeTracks).forEach(key => {
                const char = keyCharMap[key];
                if (inputs[key]) {
                    if (activeTracks[key] === null) {
                        activeTracks[key] = { start: f, count: 1 };
                    } else {
                        activeTracks[key].count++;
                    }
                } else {
                    if (activeTracks[key] !== null) {
                        exportFormat.instructions_v2[char].push(`${activeTracks[key].start}-${activeTracks[key].count}`);
                        activeTracks[key] = null;
                    }
                }
            });
        }

        Object.keys(activeTracks).forEach(key => {
            if (activeTracks[key] !== null) {
                exportFormat.instructions_v2[keyCharMap[key]].push(`${activeTracks[key].start}-${activeTracks[key].count}`);
            }
        });

        const outputBlobString = JSON.stringify(exportFormat, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(outputBlobString);
        
        const exportAnchor = document.createElement('a');
        exportAnchor.setAttribute('href', dataUri);
        exportAnchor.setAttribute('download', 'polytrack_macro.json');
        exportAnchor.click();
    });

    document.getElementById('btn-load-tas').addEventListener('click', () => {
        const rawJsonInput = prompt("Paste your instructions_v2 Macro JSON String down below:");
        if (!rawJsonInput) return;
        try {
            const parsed = JSON.parse(rawJsonInput);
            const data = parsed.instructions_v2 || parsed;
            recordedInputsTimeline = {};
            window.tasCurrentFrame = 0;

            const compilerMap = { w: 'up', s: 'down', a: 'left', d: 'right', r: 'reset' };
            Object.keys(compilerMap).forEach(char => {
                const sequences = data[char] || [];
                const targetField = compilerMap[char];

                sequences.forEach(str => {
                    if (str === "0") {
                        for(let i=0; i<60000; i++) {
                            if(!recordedInputsTimeline[i]) recordedInputsTimeline[i] = { up: false, down: false, left: false, right: false, reset: false };
                            recordedInputsTimeline[i][targetField] = true;
                        }
                        return;
                    }
                    if (str.includes('-')) {
                        const parts = str.split('-').map(Number);
                        const startFrame = parts[0];
                        const duration = parts[1];
                        for(let i = 0; i < duration; i++) {
                            let f = startFrame + i;
                            if(!recordedInputsTimeline[f]) recordedInputsTimeline[f] = { up: false, down: false, left: false, right: false, reset: false };
                            recordedInputsTimeline[f][targetField] = true;
                        }
                    }
});});alert("Macro compiled successfully into live playback timeline!");} catch(e) {alert("Error parsing loaded TAS: " + e.message);}});// 6. Hooking the Core Game Simulation Web Worker Thread Channels Nativelyconst OriginalWorker = window.Worker;window.Worker = function(scriptURL, options) {const workerInstance = new OriginalWorker(scriptURL, options);if (typeof scriptURL === 'string' && scriptURL.includes('simulation_worker')) {const originalPostMessage = workerInstance.postMessage;workerInstance.postMessage = function(message, transfer) {if (message && (message.messageType === 6 || message.up !== undefined)) {if (message.linearVelocity || message.position) {lastPolledCarPhysicsData = message;}if (isGameSuspended) {message.up = false; message.down = false; message.left = false; message.right = false; message.reset = false;return originalPostMessage.apply(this, arguments);}if (activeSaveStateCheckpoint && window.tasCurrentFrame === activeSaveStateCheckpoint.frame) {if (activeSaveStateCheckpoint.physicsSnapshot.position) message.position = activeSaveStateCheckpoint.physicsSnapshot.position;if (activeSaveStateCheckpoint.physicsSnapshot.linearVelocity) message.linearVelocity = activeSaveStateCheckpoint.physicsSnapshot.linearVelocity;if (activeSaveStateCheckpoint.physicsSnapshot.rotation) message.rotation = activeSaveStateCheckpoint.physicsSnapshot.rotation;}if (!recordedInputsTimeline[window.tasCurrentFrame]) {recordedInputsTimeline[window.tasCurrentFrame] = {up: currentLiveKeyboardState.up,down: currentLiveKeyboardState.down,left: currentLiveKeyboardState.left,right: currentLiveKeyboardState.right,reset: currentLiveKeyboardState.reset};}let frameState = recordedInputsTimeline[window.tasCurrentFrame];message.up = frameState.up;message.down = frameState.down;message.left = frameState.left;message.right = frameState.right;message.reset = frameState.reset;if (autoTappingActive && window.tasCurrentFrame % 2 === 0) {message.up = false;}window.tasCurrentFrame++;if (window.tasCurrentFrame % 10 === 0) {txtFrameCounter.innerText = window.tasCurrentFrame;}}return originalPostMessage.apply(this, arguments);};}return workerInstance;};window.Worker.prototype = OriginalWorker.prototype;})();
