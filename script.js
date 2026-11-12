const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const canvasArea = document.getElementById("canvasArea");
const brushCursor = document.getElementById("brushCursor");

const fileInput = document.getElementById("fileInput");
const loadButton = document.getElementById("loadButton");
const loadImage1 = document.getElementById("loadImage1");
const loadImage2 = document.getElementById("loadImage2");

const placeholder = document.getElementById("placeholder");
const resetButton = document.getElementById("resetButton");
const status = document.getElementById("status");

const zoomPanel = document.getElementById("zoomPanel");
const zoomSlider = document.getElementById("zoomSlider");
const zoomValue = document.getElementById("zoomValue");
const confirmButton = document.getElementById("confirmButton");

const brushPanel = document.getElementById("brushPanel");
const brushSlider = document.getElementById("brushSlider");
const brushValue = document.getElementById("brushValue");

const historyPanel = document.getElementById("historyPanel");
const undoButton = document.getElementById("undoButton");

let image = new Image();

let points = [];
let originalPoints = [];

let cols = 0;
let rows = 0;
let step = 48;

let history = [];
let historyIndex = -1;

let pointer = null;
let animationId = null;
let isAnimating = false;

let brushRadius = Number(brushSlider.value);
let lastPointerPosition = null;

const HOLD_DELAY = 300;
const BOUNCE_RADIUS = 180;


// 画像を読み込むボタン
loadButton.addEventListener("click", () => {
  fileInput.click();
});


// ファイル選択
fileInput.addEventListener("change", event => {
  const file = event.target.files[0];

  if (!file) return;

  const url = URL.createObjectURL(file);
  loadImageSource(url, true);

  fileInput.value = "";
});


// 登録画像1
loadImage1.addEventListener("click", () => {
  loadImageSource("image/sleepy.png");
});


// 登録画像2
loadImage2.addEventListener("click", () => {
  loadImageSource("image/jelly.png");
});


// 共通画像読み込み処理
function loadImageSource(source, isObjectUrl = false) {
  const nextImage = new Image();

  nextImage.onload = () => {
    image = nextImage;
    setupLoadedImage();

    if (isObjectUrl) {
      URL.revokeObjectURL(source);
    }
  };

  nextImage.onerror = () => {
    status.textContent = "画像を読み込めませんでした";

    if (isObjectUrl) {
      URL.revokeObjectURL(source);
    }
  };

  nextImage.src = source;
}


// 読み込んだ画像の準備
function setupLoadedImage() {
  const maxSide = 2000;

  const fit = Math.min(
    1,
    maxSide / Math.max(image.width, image.height)
  );

  canvas.width = Math.round(image.width * fit);
  canvas.height = Math.round(image.height * fit);

  createMesh();
  draw();

  placeholder.style.display = "none";
  canvas.style.display = "block";

  canvas.style.width = "100%";

  canvasArea.scrollLeft = 0;
  canvasArea.scrollTop = 0;

  zoomPanel.hidden = false;
  brushPanel.hidden = true;
  historyPanel.hidden = true;

  zoomSlider.value = 100;
  zoomValue.textContent = "100%";

  brushSlider.value = 120;
  brushRadius = 120;
  brushValue.textContent = "120px";

  brushCursor.style.display = "none";
  lastPointerPosition = null;

  resetButton.disabled = true;

  history = [];
  historyIndex = -1;

  pointer = null;
  isAnimating = false;

  status.textContent = "画像の大きさを調整してください";
}


// メッシュ作成
function createMesh() {
  cols = Math.ceil(canvas.width / step);
  rows = Math.ceil(canvas.height / step);

  points = [];

  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      const px = Math.min(x * step, canvas.width);
      const py = Math.min(y * step, canvas.height);

      points.push({
        x: px,
        y: py,
        ox: px,
        oy: py
      });
    }
  }

  originalPoints = points.map(p => ({ ...p }));
}


// メッシュの位置番号
function pointIndex(x, y) {
  return y * (cols + 1) + x;
}


// 画像描画
function draw() {
  if (!image.complete || !image.src) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const p1 = points[pointIndex(x, y)];
      const p2 = points[pointIndex(x + 1, y)];
      const p3 = points[pointIndex(x, y + 1)];
      const p4 = points[pointIndex(x + 1, y + 1)];

      drawTriangle(
        p1, p2, p3,
        p1.ox, p1.oy,
        p2.ox, p2.oy,
        p3.ox, p3.oy
      );

      drawTriangle(
        p2, p4, p3,
        p2.ox, p2.oy,
        p4.ox, p4.oy,
        p3.ox, p3.oy
      );
    }
  }
}


// 三角形ごとの画像変形
function drawTriangle(a, b, c, ax, ay, bx, by, cx, cy) {
  ctx.save();

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.closePath();

  ctx.lineJoin = "round";
  ctx.lineWidth = 1.2;
  ctx.clip();

  const denom =
    ax * (by - cy) +
    bx * (cy - ay) +
    cx * (ay - by);

  if (Math.abs(denom) < 0.001) {
    ctx.restore();
    return;
  }

  const m11 = (
    a.x * (by - cy) +
    b.x * (cy - ay) +
    c.x * (ay - by)
  ) / denom;

  const m12 = (
    a.y * (by - cy) +
    b.y * (cy - ay) +
    c.y * (ay - by)
  ) / denom;

  const m21 = (
    a.x * (cx - bx) +
    b.x * (ax - cx) +
    c.x * (bx - ax)
  ) / denom;

  const m22 = (
    a.y * (cx - bx) +
    b.y * (ax - cx) +
    c.y * (bx - ax)
  ) / denom;

  const dx = (
    a.x * (bx * cy - cx * by) +
    b.x * (cx * ay - ax * cy) +
    c.x * (ax * by - bx * ay)
  ) / denom;

  const dy = (
    a.y * (bx * cy - cx * by) +
    b.y * (cx * ay - ax * cy) +
    c.y * (ax * by - bx * ay)
  ) / denom;

  ctx.transform(m11, m12, m21, m22, dx, dy);

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  ctx.restore();
}


// 画像サイズ調整
zoomSlider.addEventListener("input", () => {
  const zoom = Number(zoomSlider.value);

  canvas.style.width = zoom + "%";
  zoomValue.textContent = zoom + "%";
});


// 画像を決定
confirmButton.addEventListener("click", () => {
  zoomPanel.hidden = true;
  brushPanel.hidden = false;
  historyPanel.hidden = false;

  canvas.style.width = zoomSlider.value + "%";

  history = [];
  historyIndex = -1;

  saveHistory();

  resetButton.disabled = false;

  status.textContent = "画像を編集できます";
});


// 履歴保存
function saveHistory() {
  const snapshot = points.map(p => ({ ...p }));

  history = history.slice(0, historyIndex + 1);
  history.push(snapshot);

  if (history.length > 30) {
    history.shift();
  }

  historyIndex = history.length - 1;

  updateHistoryButtons();
}


// 履歴復元
function restoreHistory(index) {
  if (index < 0 || index >= history.length) return;

  points = history[index].map(p => ({ ...p }));

  historyIndex = index;

  draw();
  updateHistoryButtons();
}


// 戻るボタンの状態
function updateHistoryButtons() {
  undoButton.disabled = historyIndex <= 0;
}


// 一つ戻る
undoButton.addEventListener("click", () => {
  restoreHistory(historyIndex - 1);
});


// 座標取得
function getPosition(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}


// 円形カーソルの位置と大きさ
function updateBrushCursor(clientX, clientY) {
  if (zoomPanel.hidden === false || canvas.width === 0) {
    brushCursor.style.display = "none";
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();

  if (!canvasRect.width || !canvasRect.height) return;

  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;

  const x =
    canvas.offsetLeft +
    clientX - canvasRect.left +
    canvasArea.scrollLeft;

  const y =
    canvas.offsetTop +
    clientY - canvasRect.top +
    canvasArea.scrollTop;

  brushCursor.style.width = `${brushRadius * 2 * scaleX}px`;
  brushCursor.style.height = `${brushRadius * 2 * scaleY}px`;

  brushCursor.style.left = `${x}px`;
  brushCursor.style.top = `${y}px`;

  brushCursor.style.display = "block";

  lastPointerPosition = {
    clientX,
    clientY
  };
}


// カーソルを画像に入れたとき
canvas.addEventListener("pointerenter", event => {
  updateBrushCursor(event.clientX, event.clientY);
});


// カーソルを画像上で動かしたとき
canvas.addEventListener("pointermove", event => {
  updateBrushCursor(event.clientX, event.clientY);

  if (!pointer || pointer.id !== event.pointerId) return;

  const pos = getPosition(event);

  const dx = pos.x - pointer.x;
  const dy = pos.y - pointer.y;

  if (
    Math.hypot(
      pos.x - pointer.startX,
      pos.y - pointer.startY
    ) > 4
  ) {
    pointer.moved = true;
    clearTimeout(pointer.holdTimer);
  }

  if (pointer.moved) {
    deform(pos.x, pos.y, dx, dy, brushRadius);
    draw();
  }

  pointer.x = pos.x;
  pointer.y = pos.y;
});


// 画像の外に出たとき
canvas.addEventListener("pointerleave", () => {
  if (!pointer) {
    brushCursor.style.display = "none";
    lastPointerPosition = null;
  }
});


// スクロール時もカーソル位置を更新
canvasArea.addEventListener("scroll", () => {
  if (lastPointerPosition) {
    updateBrushCursor(
      lastPointerPosition.clientX,
      lastPointerPosition.clientY
    );
  }
});


// ブラシサイズ変更
brushSlider.addEventListener("input", () => {
  brushRadius = Number(brushSlider.value);
  brushValue.textContent = `${brushRadius}px`;

  if (lastPointerPosition) {
    updateBrushCursor(
      lastPointerPosition.clientX,
      lastPointerPosition.clientY
    );
  }
});


// ドラッグ変形
function deform(x, y, dx, dy, radius) {
  for (const p of points) {
    const distance = Math.hypot(p.x - x, p.y - y);

    if (distance < radius) {
      const power = 1 - distance / radius;

      p.x += dx * power;
      p.y += dy * power;
    }
  }
}


// 長押しで膨らませる
function inflate(x, y, amount) {
  for (const p of points) {
    const dx = p.x - x;
    const dy = p.y - y;

    const distance = Math.hypot(dx, dy);

    if (distance < brushRadius && distance > 0) {
      const power = 1 - distance / brushRadius;

      p.x += dx / distance * amount * power;
      p.y += dy / distance * amount * power;
    }
  }
}


// クリックでぷるぷる揺らす
// ブラシサイズとは独立した固定範囲
function bounce(x, y) {
  if (isAnimating) return;

  isAnimating = true;

  const base = points.map(p => ({ ...p }));
  const affected = [];

  for (const p of base) {
    const distance = Math.hypot(p.x - x, p.y - y);

    affected.push(
      distance < BOUNCE_RADIUS
        ? Math.pow(1 - distance / BOUNCE_RADIUS, 2)
        : 0
    );
  }

  const start = performance.now();
  const duration = 850;

  function animate(now) {
    const t = Math.min((now - start) / duration, 1);

    const wave =
      Math.sin(t * Math.PI * 6) *
      Math.pow(1 - t, 1.5) *
      0.55;

    points = base.map((p, i) => ({
      ...p,
      x: p.x + (p.x - x) * wave * affected[i],
      y: p.y + (p.y - y) * wave * affected[i]
    }));

    draw();

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      points = base.map(p => ({ ...p }));
      draw();

      isAnimating = false;
    }
  }

  requestAnimationFrame(animate);
}


// マウス・タッチ操作開始
canvas.addEventListener("pointerdown", event => {
  if (!image.src || !zoomPanel.hidden || isAnimating) return;

  event.preventDefault();

  canvas.setPointerCapture(event.pointerId);

  updateBrushCursor(event.clientX, event.clientY);

  const pos = getPosition(event);

  pointer = {
    id: event.pointerId,
    x: pos.x,
    y: pos.y,
    startX: pos.x,
    startY: pos.y,
    moved: false,
    holding: false,
    holdTimer: null
  };

  pointer.holdTimer = setTimeout(() => {
    if (!pointer || pointer.moved) return;

    pointer.holding = true;
    inflateLoop();
  }, HOLD_DELAY);
});


// 長押し中の連続膨張
function inflateLoop() {
  if (!pointer || !pointer.holding) return;

  inflate(pointer.x, pointer.y, 1.5);
  draw();

  animationId = requestAnimationFrame(inflateLoop);
}


// マウス・タッチ操作終了
function endPointer(event) {
  if (!pointer || pointer.id !== event.pointerId) return;

  clearTimeout(pointer.holdTimer);

  const wasMoved = pointer.moved;
  const wasHolding = pointer.holding;

  const x = pointer.startX;
  const y = pointer.startY;

  pointer.holding = false;
  pointer = null;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (!wasMoved && !wasHolding) {
    bounce(x, y);
  } else {
    saveHistory();
  }
}

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);


// 全体を元に戻す
resetButton.addEventListener("click", () => {
  if (!points.length || isAnimating) return;

  const start = points.map(p => ({ ...p }));
  const end = originalPoints.map(p => ({ ...p }));

  const began = performance.now();
  const duration = 900;

  isAnimating = true;

  function resetAnimation(now) {
    const t = Math.min((now - began) / duration, 1);

    const ease = 1 - Math.pow(1 - t, 3);
    const wave = Math.sin(t * Math.PI * 6) * (1 - t) * 0.5;

    points = start.map((p, i) => ({
      ...end[i],
      x: p.x + (end[i].x - p.x) * ease +
        (end[i].x - p.x) * wave,
      y: p.y + (end[i].y - p.y) * ease +
        (end[i].y - p.y) * wave
    }));

    draw();

    if (t < 1) {
      requestAnimationFrame(resetAnimation);
    } else {
      points = end.map(p => ({ ...p }));
      draw();

      isAnimating = false;
      saveHistory();
    }
  }

  requestAnimationFrame(resetAnimation);
});