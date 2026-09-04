(function createTextTasUI() {
    // 1. Panel Layout Styling
    const style = document.createElement('style');
    style.innerHTML = `
        #tas-hud-panel {
            position: absolute; top: 15px; right: 15px; width: 340px;
            background: rgba(20, 20, 25, 0.98); border: 2px solid #a3be8c;
            color: #fff; font-family: 'Courier New', monospace; border-radius: 8px;
            z-index: 999999; box-shadow: 0 4px 15px rgba(0,0,0,0.5); padding: 14px;
        }
        .tas-title { font-weight: bold; font-size: 13px; text-align: center; color: #a3be8c; margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px; }
        .tas-row { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center; font-size: 12px; }
        .tas-btn { background: #3b4252; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; }
        .tas-btn:hover { background: #4c566a; }
        .tas-btn.active { background: #bf616a; color: #fff; }
        #tas-input-script { width: 100%; height: 140px; background: #1a1c23; color: #a3be8c; border: 1px solid #4c566a; border-radius: 4px; font-family: monospace; font-size: 12px; padding: 6px; resize: vertical; box-sizing: border-box; }
        #tas-status-log { font-size: 11px; color: #888; margin-top: 5px; text-align: center; }
    `;
    document.head.appendChild(style);

    // 2. DOM Layout Structure
    const hud = document.createElement('div');
    hud.id = 'tas-hud-panel';
    hud.innerHTML = `
        <div class="tas-title">📝 TEXT-SCRIPT TAS ENGINE v1.0</div>
        <div class="tas-row">
            <span>Simulated Frame:</span>
            <span id="tas-frame-counter" style="color: #ebcb8b; font-weight: bold;">0</span>
        </div>
        <div style="margin-bottom: 10px;">
            <textarea id="tas-input-script" placeholder="Examples:\n10W   (Hold W for 10 frames)\n5WD   (Hold W+D for 5 frames)\n20    (Idle for 20 frames)"></textarea>
        </div>
        <div class="tas-row">
            <button class="tas-btn" id="btn-compile-run" style="width: 100%; background: #4c566a;">⚙️ Compile & Inject Script</button>
        </div>
        <div id="tas-status-log">Ready. Write script and compile.</div>
    `;
    document.body.appendChild(hud);

    // 3. Engine Operations Memory Modules
    window.tasCurrentFrame = 0;
    let compiledPlaybackTimeline = []; // Array tracking exact keys per absolute frame index

    const frameCounterEl = document.getElementById('tas-frame-counter');
    const statusLogEl = document.getElementById('tas-status-log');
    const scriptInputEl = document.getElementById('tas-input-script');

    // 4. Script Text Compiler Engine Loop
    document.getElementById('btn-compile-run').addEventListener('click', () => {
        const scriptText = scriptInputEl.value;
        compiledPlaybackTimeline = []; // Flush old run sequences
        window.tasCurrentFrame = 0;    // Reset tracking counters
        frameCounterEl.innerText = "0";

        // Regex mapping to slice commands (e.g., "15WAD" -> dur: 15, actions: "WAD")
        const commandRegex = /(\d+)([a-zA-Z]*)/g;
        let match;
        let totalFramesCounted = 0;

        while ((match = commandRegex.exec(scriptText)) !== null) {
            let duration = parseInt(match[1], 10);
            let actionString = match[2].toLowerCase();

            let targetInputs = {
                w: actionString.includes('w'),
                a: actionString.includes('a'),
                s: actionString.includes('s'),
                d: actionString.includes('d')
            };

            // Expand shorthand instructions array linearly out into individual discrete hardware frames
            for (let f = 0; f < duration; f++) {
                compiledPlaybackTimeline.push({ ...targetInputs });
            }
            totalFramesCounted += duration;
        }

        if (totalFramesCounted > 0) {
            statusLogEl.innerHTML = `<span style="color: #a3be8c;">Compiled ${totalFramesCounted} frames successfully! Start driving to playback.</span>`;
        } else {
            statusLogEl.innerHTML = `<span style="color: #bf616a;">Error: No valid frame strings parsed.</span>`;
        }
    });

    // 5. Native Interception Hooks Bridge Layer
    const originalWorkerPostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message, transfer) {
        // messageType 6 = ControlCar packet array channel
        if (message && message.messageType === 6) {
            // Apply timeline manipulations if text blocks have been loaded into playback stack
            if (compiledPlaybackTimeline.length > 0) {
                
                if (window.tasCurrentFrame < compiledPlaybackTimeline.length) {
                    let activeFrameInputs = compiledPlaybackTimeline[window.tasCurrentFrame];

                    // Inject target parameters directly into the Web Worker data stream array layout
                    message.up = activeFrameInputs.w;
                    message.down = activeFrameInputs.s;
                    message.left = activeFrameInputs.a;
                    message.right = activeFrameInputs.d;

                    window.tasCurrentFrame++;
                    frameCounterEl.innerText = window.tasCurrentFrame;
                    statusLogEl.innerText = `Playing frame ${window.tasCurrentFrame} / ${compiledPlaybackTimeline.length}`;
                } else {
                    statusLogEl.innerHTML = `<span style="color: #ebcb8b;">Run Complete. Script sequence ended.</span>`;
                }
            }
        }
        return originalWorkerPostMessage.apply(this, arguments);
    };
})();
