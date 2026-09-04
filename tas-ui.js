(function createTasUI() {
    const style = document.createElement('style');
    style.innerHTML = `
        #tas-hud-panel {
            position: absolute; top: 15px; right: 15px; width: 320px;
            background: rgba(20, 20, 25, 0.95); border: 2px solid #4a90e2;
            color: #fff; font-family: 'Courier New', monospace; border-radius: 8px;
            z-index: 999999; box-shadow: 0 4px 15px rgba(0,0,0,0.5); padding: 12px;
            pointer-events: auto !important;
        }
        .tas-title { font-weight: bold; font-size: 14px; text-align: center; color: #4a90e2; margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px; }
        .tas-row { display: flex; justify-content: space-between; margin-bottom: 6px; align-items: center; }
        .tas-btn { background: #3b4252; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; }
        .tas-btn:hover { background: #4c566a; }
        .tas-btn.active { background: #a3be8c; color: #2e3440; }
        .direction-matrix { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; width: 140px; margin: 10px auto; }
        .matrix-btn { background: #2e3440; border: 1px solid #4c566a; color: #888; font-weight: bold; text-align: center; padding: 8px 0; border-radius: 4px; cursor: pointer; user-select: none; }
        .matrix-btn.selected { background: #4a90e2; color: white; border-color: #5e81ac; box-shadow: 0 0 8px rgba(74,144,226,0.6); }
        #tas-log { height: 120px; overflow-y: auto; background: #1a1c23; font-size: 11px; padding: 4px; border-radius: 4px; margin-top: 8px; border: 1px solid #2e3440; }
    `;
    document.head.appendChild(style);

    const hud = document.createElement('div');
    hud.id = 'tas-hud-panel';
    hud.innerHTML = `
        <div class="tas-title">🎮 POLYTRACK TAS ENGINE v0.6</div>
        <div class="tas-row">
            <span>Current Frame:</span>
            <span id="tas-frame-counter" style="color: #ebcb8b; font-weight: bold;">0</span>
        </div>
        <div class="tas-row" style="margin-bottom: 12px;">
            <button class="tas-btn" id="btn-pause-step" style="width: 48%;">⏸ Pause Engine</button>
            <button class="tas-btn" id="btn-next-frame" style="width: 48%; background: #5e81ac;">➡️ Next Frame</button>
        </div>
        <div style="border-top: 1px solid #333; padding-top: 6px;">
            <div style="font-size: 11px; text-align: center; color: #888;">TAP DIRECTIONS FOR NEXT FRAME</div>
            <div class="direction-matrix">
                <div></div> <div class="matrix-btn" id="m-w">W</div> <div></div>
                <div class="matrix-btn" id="m-a">A</div> <div class="matrix-btn" id="m-s">S</div> <div class="matrix-btn" id="m-d">D</div>
            </div>
        </div>
        <div id="tas-log">-- System Active --</div>
    `;
    document.body.appendChild(hud);

    window.tasIsPaused = false;
    window.tasCurrentFrame = 0;
    window.tasNextFrameRequested = false;
    let currentInputSelection = { w: false, a: false, s: false, d: false };

    const logEl = document.getElementById('tas-log');
    const frameCounterEl = document.getElementById('tas-frame-counter');

    function logMessage(text) {
        logEl.innerHTML += `<div>${text}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    }

    ['w', 'a', 's', 'd'].forEach(key => {
        const btn = document.getElementById(`m-${key}`);
        btn.addEventListener('click', () => {
            currentInputSelection[key] = !currentInputSelection[key];
            btn.classList.toggle('selected', currentInputSelection[key]);
        });
    });

    document.getElementById('btn-pause-step').addEventListener('click', (e) => {
        window.tasIsPaused = !window.tasIsPaused;
        e.target.innerText = window.tasIsPaused ? "▶️ Resume Engine" : "⏸ Pause Engine";
        e.target.classList.toggle('active', window.tasIsPaused);
        logMessage(window.tasIsPaused ? "<b>[Engine Paused]</b>" : "<b>[Engine Playing]</b>");
    });

    document.getElementById('btn-next-frame').addEventListener('click', () => {
        if (!window.tasIsPaused) return;
        window.tasNextFrameRequested = true;
    });

    const originalWorkerPostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message, transfer) {
        if (message && message.messageType === 6) {
            if (window.tasIsPaused) {
                if (!window.tasNextFrameRequested) return; 
                
                message.up = currentInputSelection.w;
                message.down = currentInputSelection.s;
                message.left = currentInputSelection.a;
                message.right = currentInputSelection.d;

                window.tasNextFrameRequested = false;
                window.tasCurrentFrame++;
                frameCounterEl.innerText = window.tasCurrentFrame;

                let activeKeys = Object.keys(currentInputSelection).filter(k => currentInputSelection[k]).map(k => k.toUpperCase());
                logMessage(`F-${window.tasCurrentFrame}: [${activeKeys.length ? activeKeys.join(',') : 'NONE'}]`);
            }
        }
        return originalWorkerPostMessage.apply(this, arguments);
    };
})();
