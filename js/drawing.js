// Drawing engine for the video player overlay.
// Owns canvas + stroke state + mouse/touch handling. The host page wires
// DOM hooks via opts and persists strokes via the onAfterStroke callback.
// Stays framework-free so it loads without a build step.

export class DrawingEngine {
  constructor(opts) {
    this._getVideo = opts.getVideo;
    this._getContainer = opts.getContainer;
    this._getSize = opts.getSize || (() => 4);
    this._onAfterStroke = opts.onAfterStroke || (() => {});
    this._onBeforeDraw = opts.onBeforeDraw || (() => {});
    this.color = "#f85149";
    this.tool = "pen";
    this.mode = false;
    this.strokes = [];
    this._canvas = null;
    this._ctx = null;
    this._drawing = false;
    this._currentStroke = null;
    // Bind handlers so removeEventListener / passive options work cleanly.
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
  }

  attach() {
    const wrap = this._getContainer();
    const vid = this._getVideo();
    if (!wrap || !vid) return;
    const old = wrap.querySelector("#drawCanvas");
    if (old) old.remove();
    const cv = document.createElement("canvas");
    cv.id = "drawCanvas";
    cv.width = vid.videoWidth || vid.offsetWidth;
    cv.height = vid.videoHeight || vid.offsetHeight;
    this._applyLayout(cv, vid);
    wrap.appendChild(cv);
    this._canvas = cv;
    this._ctx = cv.getContext("2d");
    cv.addEventListener("mousedown", this._onDown);
    cv.addEventListener("mousemove", this._onMove);
    cv.addEventListener("mouseup", this._onUp);
    cv.addEventListener("mouseleave", this._onUp);
    cv.addEventListener("touchstart", this._onTouchStart, { passive: false });
    cv.addEventListener("touchmove", this._onTouchMove, { passive: false });
    cv.addEventListener("touchend", this._onUp);
    if (this.mode) cv.classList.add("active");
    this.redraw();
  }

  reset() {
    this._canvas = null;
    this._ctx = null;
    this.strokes = [];
    this._drawing = false;
    this._currentStroke = null;
    this.mode = false;
    this.tool = "pen";
  }

  setMode(on) {
    this.mode = !!on;
    if (this._canvas) this._canvas.classList.toggle("active", this.mode);
  }

  toggle() { this.setMode(!this.mode); }

  setTool(t) { this.tool = t; }

  setColor(c) { this.color = c; }

  setStrokes(arr) {
    this.strokes = Array.isArray(arr) ? arr : [];
    this.redraw();
  }

  getStrokes() { return this.strokes; }

  undo() {
    if (!this.strokes.length) return;
    this.strokes.pop();
    this.redraw();
    this._onAfterStroke(null);
  }

  clear() {
    if (!this.strokes.length) return;
    this.strokes = [];
    this.redraw();
    this._onAfterStroke(null);
  }

  redraw() {
    if (!this._ctx || !this._canvas) return;
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    for (const s of this.strokes) {
      if (s.tool && s.tool !== "pen") { this._drawShape(s); continue; }
      if (!s.points || s.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    }
  }

  relayout() {
    if (!this._canvas) return;
    const vid = this._getVideo();
    if (vid) this._applyLayout(this._canvas, vid);
  }

  _applyLayout(cv, vid) {
    const rect = this._videoRect(vid);
    if (rect) {
      cv.style.position = "absolute";
      cv.style.left = rect.left + "px";
      cv.style.top = rect.top + "px";
      cv.style.width = rect.width + "px";
      cv.style.height = rect.height + "px";
    } else {
      const r = vid.getBoundingClientRect();
      cv.style.width = r.width + "px";
      cv.style.height = r.height + "px";
    }
  }

  _videoRect(vid) {
    if (!vid || !vid.videoWidth || !vid.videoHeight) return null;
    const cw = vid.offsetWidth, ch = vid.offsetHeight;
    const vw = vid.videoWidth, vh = vid.videoHeight;
    const scale = Math.min(cw / vw, ch / vh);
    const rw = vw * scale, rh = vh * scale;
    return { left: (cw - rw) / 2, top: (ch - rh) / 2, width: rw, height: rh };
  }

  _getPos(e) {
    if (!this._canvas) return { x: 0, y: 0 };
    const rect = this._canvas.getBoundingClientRect();
    const sx = this._canvas.width / rect.width;
    const sy = this._canvas.height / rect.height;
    return { x: (e.offsetX || e.clientX - rect.left) * sx, y: (e.offsetY || e.clientY - rect.top) * sy };
  }

  _onDown(e) {
    if (!this.mode) return;
    if (e.stopPropagation) e.stopPropagation();
    this._onBeforeDraw();
    this._drawing = true;
    const pos = this._getPos(e);
    const size = this._getSize();
    if (this.tool === "pen") {
      this._currentStroke = { tool: "pen", color: this.color, width: size, points: [pos] };
      this._ctx.beginPath();
      this._ctx.strokeStyle = this.color;
      this._ctx.lineWidth = size;
      this._ctx.lineCap = "round";
      this._ctx.lineJoin = "round";
      this._ctx.moveTo(pos.x, pos.y);
    } else {
      this._currentStroke = { tool: this.tool, color: this.color, width: size, start: pos, end: pos };
    }
  }

  _onMove(e) {
    if (!this._drawing || !this._currentStroke) return;
    const pos = this._getPos(e);
    if (this.tool === "pen") {
      this._currentStroke.points.push(pos);
      this._ctx.lineTo(pos.x, pos.y);
      this._ctx.stroke();
      this._ctx.beginPath();
      this._ctx.moveTo(pos.x, pos.y);
    } else {
      this._currentStroke.end = pos;
      this.redraw();
      this._drawShape(this._currentStroke);
    }
  }

  _onUp() {
    if (!this._drawing) return;
    this._drawing = false;
    const s = this._currentStroke;
    if (s) {
      if (s.tool === "pen" && s.points && s.points.length > 1) {
        this.strokes.push(s);
        this._onAfterStroke(s);
      } else if (s.tool !== "pen" && s.start && s.end) {
        const dx = s.end.x - s.start.x, dy = s.end.y - s.start.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) {
          this.strokes.push(s);
          this._onAfterStroke(s);
        } else {
          this.redraw();
        }
      }
    }
    this._currentStroke = null;
  }

  _onTouchStart(e) {
    e.preventDefault();
    this._onDown(this._touchToMouse(e));
  }

  _onTouchMove(e) {
    e.preventDefault();
    this._onMove(this._touchToMouse(e));
  }

  _touchToMouse(e) {
    const t = e.touches[0];
    const r = e.target.getBoundingClientRect();
    return { offsetX: t.clientX - r.left, offsetY: t.clientY - r.top };
  }

  _drawShape(s) {
    const ctx = this._ctx;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const x1 = s.start.x, y1 = s.start.y, x2 = s.end.x, y2 = s.end.y;
    ctx.beginPath();
    if (s.tool === "triangle") {
      const cx = (x1 + x2) / 2;
      ctx.moveTo(cx, Math.min(y1, y2));
      ctx.lineTo(Math.min(x1, x2), Math.max(y1, y2));
      ctx.lineTo(Math.max(x1, x2), Math.max(y1, y2));
      ctx.closePath();
    } else if (s.tool === "rect") {
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (s.tool === "circle") {
      const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      const cx = Math.min(x1, x2) + rx, cy = Math.min(y1, y2) + ry;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else if (s.tool === "arrow") {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const hl = Math.max(s.width * 6, 24);
      ctx.beginPath();
      ctx.moveTo(x2 - hl * Math.cos(angle - 0.4), y2 - hl * Math.sin(angle - 0.4));
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - hl * Math.cos(angle + 0.4), y2 - hl * Math.sin(angle + 0.4));
    }
    ctx.stroke();
  }
}
