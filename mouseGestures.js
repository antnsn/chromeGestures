// ==UserScript==
// @name        My Mouse Gestures with Path Drawing and Continuous Fading
// @description A simple mouse gesture script with path drawing and continuous fade out
// @version     0.3.1
// @match       *://*/*
// @run-at      document-start
// ==/UserScript==

// --- Settings ---
const SENSITIVITY = 3; // 1 ~ 5
const TOLERANCE = 3; // 1 ~ 5

const funcs = {
    'L': () => window.history.back(),
    'R': () => window.history.forward(),
    'U': () => location.reload()
};
// ----------------

const s = 1 << ((7 - SENSITIVITY) << 1);
const t1 = Math.tan(0.15708 * TOLERANCE);
const t2 = 1 / t1;
const abs = Math.abs;

let x, y, path, lastGesture;
let fadeActive = false;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Create a canvas for drawing the path
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.pointerEvents = 'none'; // Prevents interaction with the page
    canvas.style.zIndex = 10000; // Ensure canvas is on top
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    // 2. Adjust canvas size based on window size
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 3. Function to clear the canvas progressively during movement
    const fadeCanvas = () => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; // Apply a slightly transparent overlay
        ctx.fillRect(0, 0, canvas.width, canvas.height); // Gradually fade the older path
    };

    // 4. Function to draw lines on the canvas
    const drawLine = (startX, startY, endX, endY) => {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = 'rgba(255, 0, 0, 1)';
        ctx.lineWidth = 3;
        ctx.stroke();
    };

    // 5. Gesture tracking function
    const tracer = (e) => {
        const { clientX: cx, clientY: cy } = e;
        const dx = cx - x;
        const dy = cy - y;
        const distance = dx ** 2 + dy ** 2;

        if (distance > s) {
            const slope = abs(dy / dx);
            let direction = '';

            if (slope > t1) {
                direction = dy > 0 ? 'D' : 'U';
            } else if (slope <= t2) {
                direction = dx > 0 ? 'R' : 'L';
            }

            if (lastGesture !== direction) {
                lastGesture = direction;
                path += direction;
            }

            // 6. Draw the path and apply fade during movement
            fadeCanvas(); // Apply fading effect as we move
            drawLine(x, y, cx, cy); // Draw the current line
            x = cx;
            y = cy;
        }
    };

    // 7. Start tracking gestures on right-click
    window.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            console.log('Starting gesture tracking');
            x = e.clientX;
            y = e.clientY;
            path = "";
            lastGesture = "";
            fadeActive = false;
            clearCanvas(); // Clear previous path on new gesture
            window.addEventListener('mousemove', tracer, false); // Start tracking mouse movements
        }
    }, false);

    // 8. Execute gesture action and stop tracking when right-click is released (contextmenu)
    window.addEventListener('contextmenu', (e) => {
        console.log('Completing gesture:', path);
        window.removeEventListener('mousemove', tracer, false); // Stop tracking
        if (path !== "") {
            e.preventDefault();
            if (funcs.hasOwnProperty(path)) {
                funcs[path](); // Execute associated gesture function
            }
        }
    }, false);

    // 9. Clear canvas when mouse is released
    const clearCanvas = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // 10. Cancel gesture and clear canvas when mouse is released without completing
    window.addEventListener('mouseup', (e) => {
        console.log('Canceling gesture');
        window.removeEventListener('mousemove', tracer, false);
        clearCanvas(); // Clear the path when the gesture is incomplete
    }, false);
});
