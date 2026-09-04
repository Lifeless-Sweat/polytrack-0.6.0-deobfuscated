(function createJsonTasUI() {
    // 1. Panel Layout Styling with Collapsible States
    const style = document.createElement('style');
    style.innerHTML = `
        #tas-hud-panel {
            position: absolute; top: 15px; right: 15px; width: 360px;
            background: rgba(20, 20, 25, 0.98); border: 2px solid #ebcb8b;
            color: #fff; font-family: 'Courier New', monospace; border-radius: 8px;
            z-index: 999999; box-shadow: 0 4px 15px rgba(0,0,0,0.5); padding: 14px;
            transition: all 0.2s ease-in-out;
        }
        #tas-hud-panel.collapsed {
            width: 220px; padding: 8px 12px;
        }
        .tas-header-row {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 8px;
        }
        .tas-title { font-weight: bold; font-size: 13px; color: #ebcb8b; }
        #tas-minimize-btn {
            background: none; border: none; color: #ebcb8b; cursor: pointer;
            font-family: monospace; font-size: 14px; font-weight: bold; padding: 0 4px;
        }
        #tas-minimize-btn:hover { color: #fff; }
        .tas-content-wrapper { display: block; }
        #tas-hud-panel.collapsed .tas-content-wrapper { display: none; }
        
        .tas-row { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; font-size: 12px; }
        .tas-btn { background: #3b4252; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; width: 100%; }
        .tas-btn:hover { background: #4c566a; }
        #tas-json-input { width: 100%; height: 160px; background: #1a1c23; color: #ebcb8b; border: 1px solid #4c566a; border-radius: 4px; font-family: monospace; font-size: 11px; padding: 6px; resize: vertical; box-sizing: border-box; }
        #tas-status-log { font-size: 11px; color: #a3be8c; margin-top: 5px; text-align: center; word-break: break-all; }
    `;
    document.head.appendChild(style);

    // 2. DOM Layout Structure with Minimize Toggle
    const hud = document.createElement('div');
    hud.id = 'tas-hud-panel';
    hud.innerHTML = `
        <div class="tas-header-row">
            <div class="tas-title">🧩 1MS AUTO-PLAY TAS v2.2</div>
            <button id="tas-minimize-btn">[-]</button>
        </div>
        <div class="tas-content-wrapper">
            <div class="tas-row">
                <span>Timeline Frame:</span>
                <span id="tas-frame-counter" style="color: #a3be8c; font-weight: bold;">0</span>
            </div>
            <div style="margin-bottom: 10px;">
                <textarea id="tas-json-input" placeholder="Paste your instructions_v2 JSON string layout here..."></textarea>
            </div>
            <button class="tas-btn" id="btn-load-json">⚡ Parse & Compile JSON Map</button>
            <div id="tas-status-log">Hold 'W' or 'ArrowUp' to Auto-Play (1 frame / 1ms)</div>
        </div>
    `;
    document.body.appendChild(hud);

    // Minimize Button Handler
    const minBtn = document.getElementById('tas-minimize-btn');
    minBtn.addEventListener('click', () => {
        hud.classList.toggle('collapsed');
        minBtn.innerText = hud.classList.contains('collapsed') ? '[+]' : '[-]';
    });

    // 3. Timeline Global Storage & Key Interceptors
    window.tasCurrentFrame = 0;
    let timelineInputs = {}; 
    let maxTimelineLength = 0;
    let isHoldingDriveKey = false;
    let queuedWorkerMessages = [];

    const frameCounterEl = document.getElementById('tas-frame-counter');
    const statusLogEl = document.getElementById('tas-status-log');
    const jsonInputEl = document.getElementById('tas-json-input');

    // Monitor when the player holds 'W' or 'ArrowUp' to drive the frame scheduler
    window.addEventListener('keydown', (e) => {
        if (document.activeElement === jsonInputEl) return; // Ignore if typing inside JSON box
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
            isHoldingDriveKey = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
            isHoldingDriveKey = false;
            clearMainThreadInputs();
        }
    });

    // Helper to clear keyboard state on the main window thread
    function clearMainThreadInputs() {
        const browserKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyR'];
        browserKeys.forEach(k => {
            window.dispatchEvent(new KeyboardEvent('keyup', { code: k, key: k, bubbles: true }));
        });
    }

    // Helper to ensure a frame object exists in our map
    function initFrame(f) {
        if (!timelineInputs[f]) {
            timelineInputs[f] = { up: false, down: false, left: false, right: false, reset: false };
        }
    }

    // Helper to apply keypresses continuously over a specified frame span
    function applyInputSpan(startFrame, duration, keyField) {
        for (let i = 0; i < duration; i++) {
            let f = startFrame + i;
            initFrame(f);
            timelineInputs[f][keyField] = true;
            if (f > maxTimelineLength) maxTimelineLength = f;
        }
    }

    // 4. JSON String Map Compiler Pipeline
    document.getElementById('btn-load-json').addEventListener('click', () => {
        try {
            const rawData = JSON.parse(jsonInputEl.value);
            const data = rawData.instructions_v2 || rawData;

            timelineInputs = {};
            window.tasCurrentFrame = 0;
            maxTimelineLength = 0;
            queuedWorkerMessages = [];
            frameCounterEl.innerText = "0";
            clearMainThreadInputs();

            const keyMappings = { w: 'up', s: 'down', a: 'left', d: 'right', r: 'reset' };

            Object.keys(keyMappings).forEach(keyChar => {
                const instructionsArray = data[keyChar] || [];
                const targetField = keyMappings[keyChar];

                instructionsArray.forEach(instr => {
                    if (instr === "0") {
                        applyInputSpan(0, 50000, targetField);
                        return;
                    }
                    if (instr.startsWith('!')) {
                        const parts = instr.substring(1).split('-').map(Number);
                        if (parts.length === 4) {
                            let currentAnchor = parts[0];
                            const holdDuration = parts[1];
                            const releaseDuration = parts[2];
                            const loopCount = parts[3];

                            for (let l = 0; l < loopCount; l++) {
                                applyInputSpan(currentAnchor, holdDuration, targetField);
                                currentAnchor += holdDuration + releaseDuration;
                            }
                        }
                    } 
                    else if (instr.includes('-')) {
                        const parts = instr.split('-').map(Number);
                        if (parts.length === 2) {
                            applyInputSpan(parts[0], parts[1], targetField);
                        }
                    }
                });
            });

            statusLogEl.innerHTML = `<span style="color: #a3be8c;">Mapped ${maxTimelineLength} frames. HOLD 'W' to start auto-play!</span>`;
        } catch (err) {
            statusLogEl.innerHTML = `<span style="color: #bf616a;">JSON Parse Error: ${err.message}</span>`;
        }
    });

    // 5. High-Speed 1ms Micro-Tick Processing Loop
    setInterval(() => {
        // Only pump a game frame forward if a message is waiting and the user is holding down W
        if (isHoldingDriveKey && queuedWorkerMessages.length > 0) {
            const job = queuedWorkerMessages.shift();
            let frameState = timelineInputs[window.tasCurrentFrame];

            if (frameState) {
                job.message.up = frameState.up;
                job.message.down = frameState.down;
                job.message.left = frameState.left;
                job.message.right = frameState.right;
                job.message.reset = frameState.reset;
            } else {
                job.message.up = false;
                job.message.down = false;
                job.message.left = false;
                job.message.right = false;
                job.message.reset = false;

                if (window.tasCurrentFrame === maxTimelineLength + 1) {
                    clearMainThreadInputs();
                }
            }

            window.tasCurrentFrame++;
            frameCounterEl.innerText = window.tasCurrentFrame;

            if (window.tasCurrentFrame % 60 === 0 && window.tasCurrentFrame <= maxTimelineLength) {
                statusLogEl.innerText = `Auto-Playing: Frame ${window.tasCurrentFrame}/${maxTimelineLength}`;
            }

            // Release the frame processing execution back to PolyTrack's physics worker thread
            originalWorkerPostMessage.call(job.worker, job.message, job.transfer);
        }
    }, 1); // 1ms high-frequency check intervals

    // 6. Worker Hook Channel Gatekeeper
    const originalWorkerPostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message, transfer) {
        // Check if message is a ControlCar physics update request frame
        if (message && message.messageType === 6) {
            // Intercept message and queue it instead of firing immediately
            queuedWorkerMessages.push({
                worker: this,
                message: message,
                transfer: transfer
            });
            return;
        }
        // Let non-physics engine messages (menus, assets loading) flow instantly
        return originalWorkerPostMessage.apply(this, arguments);
    };
})();
