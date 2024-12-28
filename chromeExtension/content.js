class Settings {
    static DEFAULT_SETTINGS = {
        activationButton: 2, // 2: Right, 1: Middle, 3: Button4, 4: Button5
        sensitivity: 3,
        tolerance: 3
    };

    static isValidButton(button) {
        return [1, 2, 3, 4].includes(button);
    }

    static async load() {
        try {
            console.log('[Debug] Loading settings from storage');
            const result = await chrome.storage.sync.get('gestureSettings');
            console.log('[Debug] Loaded settings:', result);

            if (!result.gestureSettings || !this.isValidButton(result.gestureSettings.activationButton)) {
                console.log('[Debug] No settings found or invalid button, saving defaults');
                await this.save(this.DEFAULT_SETTINGS);
                return this.DEFAULT_SETTINGS;
            }

            return result.gestureSettings;
        } catch (error) {
            console.error('Error loading settings:', error);
            return this.DEFAULT_SETTINGS;
        }
    }

    static async save(settings) {
        try {
            // Ensure the activation button is valid
            if (!this.isValidButton(settings.activationButton)) {
                settings.activationButton = this.DEFAULT_SETTINGS.activationButton;
            }

            const mergedSettings = {
                ...this.DEFAULT_SETTINGS,
                ...settings
            };
            console.log('[Debug] Saving settings:', mergedSettings);
            await chrome.storage.sync.set({ gestureSettings: mergedSettings });
            return mergedSettings;
        } catch (error) {
            console.error('Error saving settings:', error);
            return this.DEFAULT_SETTINGS;
        }
    }
}

class MouseGestureRecognizer {
    static GESTURES = {
        'L': () => window.history.back(),
        'R': () => window.history.forward(),
        'DR': async () => {
            try {
                await chrome.runtime.sendMessage({ command: 'close_tab' });
            } catch (error) {
                console.error('Failed to execute close_tab gesture:', error);
            }
        },
        'UR': async () => {
            try {
                await chrome.runtime.sendMessage({ command: 'reopen_tab' });
            } catch (error) {
                console.error('Failed to execute reopen_tab gesture:', error);
            }
        }
    };

    handleMouseMove(e) {
        if (!this.isDrawing) return;

        const currentPoint = { x: e.clientX, y: e.clientY };
        const lastPoint = this.pathPoints[this.pathPoints.length - 1];
        
        if (lastPoint) {
            const distance = Math.pow(currentPoint.x - lastPoint.x, 2) + 
                           Math.pow(currentPoint.y - lastPoint.y, 2);
            if (distance > (1 << ((7 - this.settings.sensitivity) << 1))) {
                this.pathPoints.push(currentPoint);
                this.processGesture(lastPoint, currentPoint);
                
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                }
                this.animationFrameId = requestAnimationFrame(() => this.drawPath());
            }
        } else {
            this.pathPoints.push(currentPoint);
        }
    }

    handleMouseDown(e) {
        console.log('[Debug] Mouse down event:', { button: e.button, settingsButton: this.settings.activationButton });
        if (e.button === this.settings.activationButton) {
            e.preventDefault(); // Prevent default for all activation buttons
            this.isDrawing = true;
            this.path = '';
            this.lastGesture = '';
            this.pathPoints = [{ x: e.clientX, y: e.clientY }];
            this.clearCanvas();
            window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
            
            // Handle context menu only for right click
            if (this.settings.activationButton === 2) {
                window.addEventListener('contextmenu', this.preventDefault, { passive: false });
            }
        }
    }

    handleMouseUp(e) {
        console.log('[Debug] Mouse up event:', { 
            button: e.button, 
            path: this.path,
            isDrawing: this.isDrawing,
            hasGesture: MouseGestureRecognizer.GESTURES.hasOwnProperty(this.path)
        });
        
        if (this.isDrawing) {
            e.preventDefault(); // Prevent default when we're drawing
            if (this.path !== '') {
                console.log('[Debug] Executing gesture:', this.path);
                const gesture = MouseGestureRecognizer.GESTURES[this.path];
                if (gesture) {
                    try {
                        gesture();
                    } catch (error) {
                        console.error('Error executing gesture:', error);
                    }
                }
            }
            this.cleanup();
        }
    }

    handleContextMenu(e) {
        console.log('[Debug] Context menu event:', {
            path: this.path,
            isDrawing: this.isDrawing,
            hasGesture: MouseGestureRecognizer.GESTURES.hasOwnProperty(this.path)
        });
        
        if (this.settings.activationButton === 2 && this.isDrawing) {
            e.preventDefault();
            if (this.path !== '') {
                console.log('[Debug] Executing gesture from context menu:', this.path);
                const gesture = MouseGestureRecognizer.GESTURES[this.path];
                if (gesture) {
                    try {
                        gesture();
                    } catch (error) {
                        console.error('Error executing gesture:', error);
                    }
                }
            }
        }
        this.cleanup();
    }

    handleResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    handleMessage(message, sender, sendResponse) {
        console.log('[Debug] Received message:', message);
        if (message.type === 'settingsUpdated') {
            console.log('[Debug] Updating settings to:', message.settings);
            this.settings = message.settings;
            // Re-attach event listeners with new settings
            this.detachEventListeners();
            this.attachEventListeners();
        }
    }

    handleSettingsChange(changes) {
        if (changes.gestureSettings?.newValue) {
            console.log('[Debug] Settings changed:', changes.gestureSettings.newValue);
            this.settings = changes.gestureSettings.newValue;
        }
    }

    preventDefault(e) {
        e.preventDefault();
    }

    constructor() {
        this.isDrawing = false;
        this.pathPoints = [];
        this.path = '';
        this.lastGesture = '';
        this.animationFrameId = null;
        this.canvas = this.createCanvas();
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.settings = Settings.DEFAULT_SETTINGS;
        
        // Bind methods to maintain context
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleSettingsChange = this.handleSettingsChange.bind(this);
        this.preventDefault = this.preventDefault.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
        
        // Initialize
        this.setupCanvas();
        this.attachEventListeners();
        this.loadSettings();
        
        // Add message listener for settings updates
        chrome.runtime.onMessage.addListener(this.handleMessage);
    }

    async loadSettings() {
        try {
            console.log('[Debug] MouseGestureRecognizer loading settings');
            this.settings = await Settings.load();
            console.log('[Debug] MouseGestureRecognizer loaded settings:', this.settings);
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = Settings.DEFAULT_SETTINGS;
        }
    }

    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '10000';
        document.body.appendChild(canvas);
        return canvas;
    }

    setupCanvas() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.handleResize();
    }

    attachEventListeners() {
        console.log('[Debug] Attaching event listeners with button:', this.settings.activationButton);
        window.addEventListener('mousedown', this.handleMouseDown, { passive: false });
        window.addEventListener('mouseup', this.handleMouseUp, { passive: false });
        window.addEventListener('resize', this.handleResize, { passive: true });
        
        // Only attach contextmenu listener if using right mouse button
        if (this.settings.activationButton === 2) {
            window.addEventListener('contextmenu', this.handleContextMenu, { passive: false });
        }
        
        chrome.storage.onChanged.addListener(this.handleSettingsChange);
    }

    detachEventListeners() {
        console.log('[Debug] Detaching event listeners');
        window.removeEventListener('mousedown', this.handleMouseDown);
        window.removeEventListener('mouseup', this.handleMouseUp);
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('contextmenu', this.handleContextMenu);
        window.removeEventListener('contextmenu', this.preventDefault);
        window.removeEventListener('resize', this.handleResize);
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawPath() {
        if (this.pathPoints.length < 2) return;
        
        this.clearCanvas();
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        this.ctx.lineWidth = 3;
        
        this.ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
        for (let i = 1; i < this.pathPoints.length; i++) {
            this.ctx.lineTo(this.pathPoints[i].x, this.pathPoints[i].y);
        }
        this.ctx.stroke();
    }

    processGesture(startPoint, endPoint) {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const slope = Math.abs(dy / dx);
        let direction = '';

        // More lenient diagonal threshold (approximately 30-60 degrees)
        const diagonalMin = Math.tan(Math.PI / 6); // 30 degrees
        const diagonalMax = Math.tan(Math.PI / 3); // 60 degrees

        // Minimum movement threshold to avoid tiny movements
        const minMovement = 10;
        
        if (Math.abs(dx) < minMovement && Math.abs(dy) < minMovement) {
            return; // Ignore very small movements
        }

        // Determine the primary direction based on the larger movement
        if (Math.abs(dy) > Math.abs(dx)) {
            direction = dy > 0 ? 'D' : 'U';
        } else {
            direction = dx > 0 ? 'R' : 'L';
        }

        if (this.lastGesture !== direction && direction) {
            console.log('[Debug] New gesture detected:', direction, {
                dx, dy, slope,
                lastGesture: this.lastGesture,
                currentPath: this.path
            });

            // If we already have a direction and it's different, check for combined gestures
            if (this.path && this.path !== direction) {
                const combinedGesture = this.path + direction;
                // Only update if it's a valid gesture
                if (MouseGestureRecognizer.GESTURES.hasOwnProperty(combinedGesture)) {
                    this.path = combinedGesture;
                    console.log('[Debug] Combined gesture detected:', this.path);
                }
            } else {
                this.path = direction;
            }
            this.lastGesture = direction;
        }
    }

    cleanup() {
        console.log('[Debug] Cleanup');
        this.isDrawing = false;
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('contextmenu', this.preventDefault);
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        setTimeout(() => this.clearCanvas(), 100);
        this.pathPoints = [];
    }

    destroy() {
        this.detachEventListeners();
        chrome.storage.onChanged.removeListener(this.handleSettingsChange);
        this.canvas.remove();
    }
}

// Initialize the gesture recognizer
const gestureRecognizer = new MouseGestureRecognizer();
