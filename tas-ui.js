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
            <div class="tas-title">🧩 LAG-FREE TAS ENGINE v2.8</div>
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
            <button class="tas-btn" id="btn-load-json">⚡ Compile JSON Macro Map</button>
            <div id="tas-status-log">Awaiting JSON macro input injection...</div>
        </div>
    `;
    document.body.appendChild(hud);

    // Minimize Button Handler
    const minBtn = document.getElementById('tas-minimize-btn');
    minBtn.addEventListener('click', () => {
        hud.classList.toggle('collapsed');
        minBtn.innerText = hud.classList.contains('collapsed') ? '[+]' : '[-]';
    });

    // 3. Timeline Global Storage
    window.tasCurrentFrame = 0;
    let timelineInputs = {}; 
    let maxTimelineLength = 0;
    let isHoldingDriveKey = false;

    const frameCounterEl = document.getElementById('tas-frame-counter');
    const statusLogEl = document.getElementById('tas-status-log');
    const jsonInputEl = document.getElementById('tas-json-input');

    // Smooth keyboard listener blocks repeated OS keydown commands to remove lag
    window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        if (document.activeElement === jsonInputEl) return;
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

    function clearMainThreadInputs() {
        const browserKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyR'];
        browserKeys.forEach(k => {
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

    // 4. Fixed JSON Compiler Pipeline (Restored working explicit index numbers)
    document.getElementById('btn-load-json').addEventListener('click', () => {
        try {
            const rawData = JSON.parse(jsonInputEl.value);
            const data = rawData.instructions_v2 || rawData;

            timelineInputs = {};
            window.tasCurrentFrame = 0;
            maxTimelineLength = 0;
            frameCounterEl.innerText = "0";
            clearMainThreadInputs();

            const keyMappings = { w: 'up', s: 'down', a: 'left', d: 'right', r: 'reset' };

            Object.keys(keyMappings).forEach(keyChar => {
                const instructionsArray = data[keyChar] || [];
                const targetField = keyMappings[keyChar];

                instructionsArray.forEach(instr => {
                    // Scenario A: Infinite hold string ("0")
                    if (instr === "0") {
                        applyInputSpan(0, 60000, targetField);
                        return;
                    }

                    // Scenario B: Repeating loop clusters starting with an exclamation mark ("!6852-45-80-10")
                    if (typeof instr === 'string' && instr.startsWith('!')) {
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
                    // Scenario C: Isolated fixed frame duration windows ("45-31")
                    else if (typeof instr === 'string' && instr.includes('-')) {
                        const parts = instr.split('-').map(Number);
                        if (parts.length === 2) {
                            const startFrame = parts[0];
                            const duration = parts[1];
                            applyInputSpan(startFrame, duration, targetField);
                        }
                    }
                });
            });

            statusLogEl.innerHTML = `<span style="color: #a3be8c;">Successfully parsed ${maxTimelineLength} frames! Hold 'W' to drive.</span>`;
        } catch (err) {
            statusLogEl.innerHTML = `<span style="color: #bf616a;">Compiler Error: ${err.message}</span>`;
        }
    });

    // 5. High-Speed Physics Worker Hook Bridge 
    const originalWorkerPostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message, transfer) {
        // Universal detection channel for game physics update frames
        if (message && (message.messageType === 6 || (message.up !== undefined && message.left !== undefined))) { 

            // Freeze loop checkpoint gate: If you aren't holding W, pause car state and don't increment frames
            if (maxTimelineLength > 0 && !isHoldingDriveKey) {
                message.up = false;
                message.down = false;
                message.left = false;
                message.right = false;
                message.reset = false;
                return originalWorkerPostMessage.apply(this, arguments);
            }

            let frameState = timelineInputs[window.tasCurrentFrame];

            if (frameState) {
                message.up = frameState.up;
                message.down = frameState.down;
                message.left = frameState.left;
                message.right = frameState.right;
                message.reset = frameState.reset;
            } else {
                message.up = false;
                message.down = false;
                message.left = false;
                message.right = false;
                message.reset = false;

                if (window.tasCurrentFrame === maxTimelineLength + 1) {
                    clearMainThreadInputs();
                }
            }

            window.tasCurrentFrame++;
            
            // Lightweight UI layout update interval saves heavy CPU lag
            if (window.tasCurrentFrame % 60 === 0) {
                frameCounterEl.innerText = window.tasCurrentFrame;
                if (window.tasCurrentFrame <= maxTimelineLength) {
                    statusLogEl.innerText = `Auto-Playing: Frame ${window.tasCurrentFrame}/${maxTimelineLength}`;
                }
            }
        }
        return originalWorkerPostMessage.apply(this, arguments);
    };
})();
