const SENSITIVITY = 3; // 1 ~ 5
const TOLERANCE = 3; // 1 ~ 5

const funcs = {
    'L': () => window.history.back(),
    'R': () => window.history.forward(),
    'DR': () => chrome.runtime.sendMessage('close_tab')
};

// --- All the gesture detection, canvas creation, and drawing code ---
let x, y, path, lastGesture;
let fadeActive = false;

const canvas = document.createElement('canvas');
canvas.style.position = 'fixed';
canvas.style.top = 0;
canvas.style.left = 0;
canvas.style.pointerEvents = 'none'; 
canvas.style.zIndex = 10000;
document.body.appendChild(canvas);

const ctx = canvas.getContext('2d');

const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const fadeCanvas = () => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const drawLine = (startX, startY, endX, endY) => {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(255, 0, 0, 1)';
    ctx.lineWidth = 3;
    ctx.stroke();
};

const tracer = (e) => {
    const { clientX: cx, clientY: cy } = e;
    const dx = cx - x;
    const dy = cy - y;
    const distance = dx ** 2 + dy ** 2;

    if (distance > (1 << ((7 - SENSITIVITY) << 1))) {
        const slope = Math.abs(dy / dx);
        let direction = '';

        if (slope > Math.tan(0.15708 * TOLERANCE)) {
            direction = dy > 0 ? 'D' : 'U';
        } else if (slope <= 1 / Math.tan(0.15708 * TOLERANCE)) {
            direction = dx > 0 ? 'R' : 'L';
        }

        if (lastGesture !== direction) {
            lastGesture = direction;
            path += direction;
        }

        fadeCanvas();
        drawLine(x, y, cx, cy);
        x = cx;
        y = cy;
    }
};

window.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
        x = e.clientX;
        y = e.clientY;
        path = "";
        lastGesture = "";
        window.addEventListener('mousemove', tracer, false);
    }
}, false);

window.addEventListener('contextmenu', (e) => {
    window.removeEventListener('mousemove', tracer, false);
    if (path !== "") {
        e.preventDefault();
        if (funcs.hasOwnProperty(path)) {
            funcs[path]();
        }
    }
}, false);

window.addEventListener('mouseup', () => {
    window.removeEventListener('mousemove', tracer, false);
}, false);
