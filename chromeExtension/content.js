const DEBUG = false;

class Settings {
  static DEFAULT_SETTINGS = {
    activationButton: 2, // 2: Right, 1: Middle, 3: Button4, 4: Button5
    sensitivity: 3,
    tolerance: 3,
  };

  static isValidButton(button) {
    return [1, 2, 3, 4].includes(button);
  }

  static async load() {
    try {
      if (DEBUG) console.log("[Debug] Loading settings from storage");
      const result = await chrome.storage.sync.get("gestureSettings");
      if (DEBUG) console.log("[Debug] Loaded settings:", result);

      if (
        !result.gestureSettings ||
        !this.isValidButton(result.gestureSettings.activationButton)
      ) {
        if (DEBUG)
          console.log(
            "[Debug] No settings found or invalid button, saving defaults"
          );
        await this.save(this.DEFAULT_SETTINGS);
        return this.DEFAULT_SETTINGS;
      }

      return result.gestureSettings;
    } catch (error) {
      console.error("Error loading settings:", error);
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
        ...settings,
      };
      if (DEBUG) console.log("[Debug] Saving settings:", mergedSettings);
      await chrome.storage.sync.set({ gestureSettings: mergedSettings });
      return mergedSettings;
    } catch (error) {
      console.error("Error saving settings:", error);
      return this.DEFAULT_SETTINGS;
    }
  }
}

class MouseGestureRecognizer {
  static GESTURES = {
    L: () => window.history.back(),
    R: () => window.history.forward(),
    DR: async () => {
      try {
        await chrome.runtime.sendMessage({ command: "close_tab" });
      } catch (error) {
        console.error("Failed to execute close_tab gesture:", error);
      }
    },
    UR: async () => {
      try {
        await chrome.runtime.sendMessage({ command: "reopen_tab" });
      } catch (error) {
        console.error("Failed to execute reopen_tab gesture:", error);
      }
    },
  };

  handleMouseMove(e) {
    if (!this.isDrawing) return;

    const currentPoint = { x: e.clientX, y: e.clientY };
    const lastPoint = this.pathPoints[this.pathPoints.length - 1];

    if (lastPoint) {
      const dx = currentPoint.x - lastPoint.x;
      const dy = currentPoint.y - lastPoint.y;
      const distanceSquared = dx * dx + dy * dy;

      // Gesture intent threshold: if the mouse has moved more than a few pixels
      // from the initial press point, we consider this a gesture in progress.
      // This is separate from the main gesture recognition thresholds and helps
      // us decide when to suppress the context menu for right-click drags.
      if (!this.inGesture && this.pathPoints.length > 0) {
        const start = this.pathPoints[0];
        const intentDx = currentPoint.x - start.x;
        const intentDy = currentPoint.y - start.y;
        const intentDistanceSquared = intentDx * intentDx + intentDy * intentDy;
        const intentThresholdSquared =
          this.intentThreshold * this.intentThreshold;
        if (intentDistanceSquared > intentThresholdSquared) {
          this.inGesture = true;
        }
      }

      // Segment movement threshold in pixels, derived from sensitivity (1-5).
      // Higher sensitivity => smaller required movement between points.
      const segmentThreshold = 6 + (5 - this.sensitivity) * 3; // pixels
      const segmentThresholdSquared = segmentThreshold * segmentThreshold;

      if (distanceSquared > segmentThresholdSquared) {
        this.pathPoints.push(currentPoint);
        // Limit the number of points to create trailing effect
        if (this.pathPoints.length > 20) {
          this.pathPoints.shift();
        }
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
    if (DEBUG)
      console.log("[Debug] Mouse down event:", {
        button: e.button,
        settingsButton: this.settings.activationButton,
      });
    if (e.button === this.settings.activationButton) {
      // For non-right activation buttons, prevent default immediately.
      // For right-click (button 2), allow default behavior until a gesture is actually recognized.
      if (this.settings.activationButton !== 2) {
        e.preventDefault();
      }
      this.isDrawing = true;
      this.path = "";
      this.lastGesture = "";
      this.pathPoints = [{ x: e.clientX, y: e.clientY }];
      this.clearCanvas();
      window.addEventListener("mousemove", this.handleMouseMove, {
        passive: true,
      });
    }
  }

  handleMouseUp(e) {
    if (DEBUG)
      console.log("[Debug] Mouse up event:", {
        button: e.button,
        path: this.path,
        isDrawing: this.isDrawing,
        hasGesture: MouseGestureRecognizer.GESTURES.hasOwnProperty(this.path),
      });

    if (this.isDrawing) {
      // Only prevent default automatically for non-right activation buttons.
      // For right-click gestures, the context menu is controlled via handleContextMenu
      // and only blocked when a valid gesture path exists.
      if (this.settings.activationButton !== 2) {
        e.preventDefault();
      }
      if (this.path !== "" && this.path !== "ABORTED") {
        if (DEBUG) console.log("[Debug] Executing gesture:", this.path);
        const gesture = MouseGestureRecognizer.GESTURES[this.path];
        if (gesture) {
          try {
            gesture();
          } catch (error) {
            console.error("Error executing gesture:", error);
          }
        }
      } else if (this.path === "ABORTED") {
        if (DEBUG) console.log("[Debug] Gesture was aborted, not executing");
      }
      this.cleanup();
    }
  }

  handleContextMenu(e) {
    if (DEBUG)
      console.log("[Debug] Context menu event:", {
        path: this.path,
        isDrawing: this.isDrawing,
        hasGesture: MouseGestureRecognizer.GESTURES.hasOwnProperty(this.path),
      });

    // Prevent context menu only if we have a recognized gesture path.
    // This makes it easier for the native context menu to appear when
    // movement was small or did not form a valid gesture.
    if (this.path !== "") {
      e.preventDefault();
      if (this.settings.activationButton === 2 && this.isDrawing) {
        if (MouseGestureRecognizer.GESTURES.hasOwnProperty(this.path)) {
          if (DEBUG)
            console.log(
              "[Debug] Executing gesture from context menu:",
              this.path
            );
          const gesture = MouseGestureRecognizer.GESTURES[this.path];
          if (gesture) {
            try {
              gesture();
            } catch (error) {
              console.error("Error executing gesture:", error);
            }
          }
        }
      }
      this.cleanup();
      // Add a small delay before allowing the next context menu
      setTimeout(() => {
        this.path = "";
      }, 100);
      return;
    }
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  handleMessage(message, sender, sendResponse) {
    if (DEBUG) console.log("[Debug] Received message:", message);
    if (message.type === "settingsUpdated") {
      if (DEBUG) console.log("[Debug] Updating settings to:", message.settings);
      this.settings = message.settings;
      // Re-attach event listeners with new settings
      this.detachEventListeners();
      this.attachEventListeners();
    }
  }

  handleSettingsChange(changes) {
    if (changes.gestureSettings?.newValue) {
      if (DEBUG)
        console.log(
          "[Debug] Settings changed:",
          changes.gestureSettings.newValue
        );
      this.settings = changes.gestureSettings.newValue;
    }
  }

  constructor() {
    this.isDrawing = false;
    this.pathPoints = [];
    this.path = "";
    this.lastGesture = "";
    this.inGesture = false;
    this.animationFrameId = null;
    this.canvas = this.createCanvas();
    this.ctx = this.canvas.getContext("2d", { alpha: true });
    this.settings = Settings.DEFAULT_SETTINGS;

    // Bind methods to maintain context
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleSettingsChange = this.handleSettingsChange.bind(this);
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
      if (DEBUG) console.log("[Debug] MouseGestureRecognizer loading settings");
      this.settings = await Settings.load();
      if (DEBUG)
        console.log(
          "[Debug] MouseGestureRecognizer loaded settings:",
          this.settings
        );
    } catch (error) {
      console.error("Error loading settings:", error);
      this.settings = Settings.DEFAULT_SETTINGS;
    }
  }

  createCanvas() {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "10000";
    document.body.appendChild(canvas);
    return canvas;
  }

  setupCanvas() {
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.shadowBlur = 2;
    this.ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
    this.handleResize();
  }

  attachEventListeners() {
    if (DEBUG)
      console.log(
        "[Debug] Attaching event listeners with button:",
        this.settings.activationButton
      );
    window.addEventListener("mousedown", this.handleMouseDown, {
      passive: false,
    });
    window.addEventListener("mouseup", this.handleMouseUp, { passive: false });
    window.addEventListener("resize", this.handleResize, { passive: true });

    // Only attach contextmenu listener if using right mouse button
    if (this.settings.activationButton === 2) {
      window.addEventListener("contextmenu", this.handleContextMenu, {
        passive: false,
      });
    }

    chrome.storage.onChanged.addListener(this.handleSettingsChange);
  }

  detachEventListeners() {
    if (DEBUG) console.log("[Debug] Detaching event listeners");
    window.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("contextmenu", this.handleContextMenu);
    window.removeEventListener("resize", this.handleResize);
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawPath() {
    if (this.pathPoints.length < 2) return;

    this.clearCanvas();

    // Create gradient based on path direction
    const startPoint = this.pathPoints[0];
    const endPoint = this.pathPoints[this.pathPoints.length - 1];
    const gradient = this.ctx.createLinearGradient(
      startPoint.x,
      startPoint.y,
      endPoint.x,
      endPoint.y
    );

    // Set gradient colors based on gesture
    if (this.path === "ABORTED") {
      gradient.addColorStop(0, "rgba(189, 195, 199, 0.4)"); // Gray when aborted
      gradient.addColorStop(1, "rgba(127, 140, 141, 0.8)");
    } else if (this.path.includes("U")) {
      gradient.addColorStop(0, "rgba(52, 152, 219, 0.4)");
      gradient.addColorStop(1, "rgba(41, 128, 185, 0.8)");
    } else if (this.path.includes("D")) {
      gradient.addColorStop(0, "rgba(231, 76, 60, 0.4)");
      gradient.addColorStop(1, "rgba(192, 57, 43, 0.8)");
    } else if (this.path === "R") {
      gradient.addColorStop(0, "rgba(46, 204, 113, 0.4)");
      gradient.addColorStop(1, "rgba(39, 174, 96, 0.8)");
    } else if (this.path === "L") {
      gradient.addColorStop(0, "rgba(155, 89, 182, 0.4)");
      gradient.addColorStop(1, "rgba(142, 68, 173, 0.8)");
    } else {
      gradient.addColorStop(0, "rgba(52, 152, 219, 0.4)");
      gradient.addColorStop(1, "rgba(41, 128, 185, 0.8)");
    }

    // Draw the main path with gradient and a smooth, continuous stroke.
    // We keep a subtle flare towards the tip by adjusting lineWidth once
    // based on the number of points, avoiding per-segment stroking which
    // can look dotted.
    this.ctx.beginPath();
    this.ctx.strokeStyle = gradient;

    // Base width and a small flare factor based on path length.
    const baseWidth = 3;
    const flare = Math.min(3, this.pathPoints.length * 0.1);
    this.ctx.lineWidth = baseWidth + flare;

    // Use quadratic curves for a smooth continuous path
    this.ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    for (let i = 1; i < this.pathPoints.length - 1; i++) {
      const xc = (this.pathPoints[i].x + this.pathPoints[i + 1].x) / 2;
      const yc = (this.pathPoints[i].y + this.pathPoints[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(
        this.pathPoints[i].x,
        this.pathPoints[i].y,
        xc,
        yc
      );
    }

    // For the last point
    if (this.pathPoints.length > 1) {
      const last = this.pathPoints[this.pathPoints.length - 1];
      this.ctx.lineTo(last.x, last.y);
    }

    this.ctx.stroke();
  }

  processGesture(startPoint, endPoint) {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const slope = Math.abs(dy / dx);
    let direction = "";

    // Minimum movement threshold to avoid tiny movements.
    // This is derived from tolerance (1-5): higher tolerance => needs more movement.
    // Slightly lower base threshold so gestures start a bit earlier.
    const minMovement = 8 + (this.tolerance - 3) * 2.5; // pixels

    if (Math.abs(dx) < minMovement && Math.abs(dy) < minMovement) {
      return; // Ignore very small movements
    }

    // Determine the primary direction based on the larger movement
    if (Math.abs(dy) > Math.abs(dx)) {
      direction = dy > 0 ? "D" : "U";
    } else {
      direction = dx > 0 ? "R" : "L";
    }

    if (this.lastGesture !== direction && direction) {
      if (DEBUG)
        console.log("[Debug] New gesture detected:", direction, {
          dx,
          dy,
          slope,
          lastGesture: this.lastGesture,
          currentPath: this.path,
        });

      // If we have a valid gesture and continue drawing, abort it
      if (MouseGestureRecognizer.GESTURES.hasOwnProperty(this.path)) {
        if (DEBUG)
          console.log(
            "[Debug] Gesture aborted: continued drawing after valid gesture"
          );
        this.path = "ABORTED";
        this.pathPoints = this.pathPoints.slice(-10);
        return;
      }

      // Prevent oscillating movements (U->D, D->U)
      if (
        (direction === "U" && this.lastGesture === "D") ||
        (direction === "D" && this.lastGesture === "U")
      ) {
        if (DEBUG)
          console.log("[Debug] Gesture aborted: oscillating up/down movement");
        this.path = "ABORTED";
        this.pathPoints = this.pathPoints.slice(-10);
        return;
      }

      // If we already have a direction and it's different, check for valid combined gestures
      if (this.path && this.path !== direction) {
        const combinedGesture = this.path + direction;
        // Only allow specific combinations (DR, UR)
        if (combinedGesture === "DR" || combinedGesture === "UR") {
          this.path = combinedGesture;
          if (DEBUG)
            console.log("[Debug] Combined gesture detected:", this.path);
        } else {
          if (DEBUG) console.log("[Debug] Invalid combination, aborting");
          this.path = "ABORTED";
          this.pathPoints = this.pathPoints.slice(-10);
        }
      } else if (!this.path || this.path === direction) {
        // Only set the path if it's empty or the same direction
        this.path = direction;
      } else {
        // Any other case should abort
        if (DEBUG) console.log("[Debug] Invalid movement pattern, aborting");
        this.path = "ABORTED";
        this.pathPoints = this.pathPoints.slice(-10);
      }
      this.lastGesture = direction;
    }
  }

  cleanup() {
    if (DEBUG) console.log("[Debug] Cleanup");
    this.isDrawing = false;
    this.inGesture = false;
    window.removeEventListener("mousemove", this.handleMouseMove);
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

  get sensitivity() {
    const raw = this.settings?.sensitivity ?? 3;
    return Math.max(1, Math.min(5, raw));
  }

  get tolerance() {
    const raw = this.settings?.tolerance ?? 3;
    return Math.max(1, Math.min(5, raw));
  }

  get intentThreshold() {
    // Lower intent threshold so right-drag is detected slightly sooner.
    return 5; // pixels
  }
}

// Initialize the gesture recognizer
const gestureRecognizer = new MouseGestureRecognizer();
