const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_WORKING_PIXELS = 12_000_000;
const MAX_WORKING_DIMENSION = 4096;
const HISTORY_LIMIT = 6;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const els = {
    dropZone: document.getElementById("drop-zone"),
    fileInput: document.getElementById("file-input"),
    workspace: document.getElementById("workspace"),
    canvas: document.getElementById("main-canvas"),
    canvasShell: document.getElementById("canvas-shell"),
    selectionBox: document.getElementById("selection-box"),
    engineStatus: document.getElementById("engine-status"),
    engineStatusText: document.getElementById("engine-status-text"),
    busyOverlay: document.getElementById("busy-overlay"),
    busyLabel: document.getElementById("busy-label"),
    inlineMessage: document.getElementById("inline-message"),
    imageMeta: document.getElementById("image-meta"),
    historyMeta: document.getElementById("history-meta"),
    tabBtns: Array.from(document.querySelectorAll(".tab-btn")),
    tabPanels: Array.from(document.querySelectorAll(".tab-panel")),
    cropSlider: document.getElementById("crop-slider"),
    cropVal: document.getElementById("crop-val"),
    radiusSlider: document.getElementById("radius-slider"),
    radiusVal: document.getElementById("radius-val"),
    sharpSlider: document.getElementById("sharp-slider"),
    sharpVal: document.getElementById("sharp-val"),
    btnApplyCrop: document.getElementById("btn-apply-crop"),
    btnApplyInpaint: document.getElementById("btn-apply-inpaint"),
    btnApplyEnhance: document.getElementById("btn-apply-enhance"),
    btnReset: document.getElementById("btn-reset"),
    btnDownload: document.getElementById("btn-download"),
    btnUndo: document.getElementById("btn-undo"),
    btnRedo: document.getElementById("btn-redo"),
    btnCompare: document.getElementById("btn-compare")
};

const state = {
    busy: false,
    compareVisible: false,
    isSelecting: false,
    activePointerId: null,
    startX: 0,
    startY: 0,
    selectionRect: null,
    fileInfo: null,
    history: {
        undo: [],
        redo: []
    },
    currentSnapshot: null,
    originalSnapshot: null
};

function init() {
    bindUploadEvents();
    bindTabEvents();
    bindSliderEvents();
    bindSelectionEvents();
    bindActionEvents();
    updateHistoryUi();
}

function bindUploadEvents() {
    els.dropZone.addEventListener("click", () => els.fileInput.click());
    els.dropZone.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            els.fileInput.click();
        }
    });

    els.fileInput.addEventListener("change", (event) => {
        const [file] = event.target.files;
        if (file) {
            void loadImageFile(file);
        }
        event.target.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
        els.dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            els.dropZone.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        els.dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            els.dropZone.classList.remove("dragover");
        });
    });

    els.dropZone.addEventListener("drop", (event) => {
        const [file] = event.dataTransfer.files;
        if (file) {
            void loadImageFile(file);
        }
    });
}

function bindTabEvents() {
    els.tabBtns.forEach((button) => {
        button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
}

function bindSliderEvents() {
    els.cropSlider.addEventListener("input", (event) => {
        els.cropVal.textContent = `${event.target.value} px`;
    });

    els.radiusSlider.addEventListener("input", (event) => {
        els.radiusVal.textContent = `${event.target.value} px`;
    });

    els.sharpSlider.addEventListener("input", (event) => {
        els.sharpVal.textContent = (Number(event.target.value) / 10).toFixed(1);
    });
}

function bindSelectionEvents() {
    els.canvasShell.addEventListener("pointerdown", (event) => {
        if (!isInpaintTabActive() || state.busy || state.compareVisible) return;
        if (event.target !== els.canvas) return;

        event.preventDefault();
        els.canvas.setPointerCapture(event.pointerId);
        state.activePointerId = event.pointerId;
        state.isSelecting = true;

        const point = getCanvasDisplayPoint(event);
        state.startX = point.x;
        state.startY = point.y;

        updateSelectionBox(point.x, point.y, 0, 0);
        els.selectionBox.style.display = "block";
        els.btnApplyInpaint.disabled = true;
    });

    els.canvasShell.addEventListener("pointermove", (event) => {
        if (!state.isSelecting || event.pointerId !== state.activePointerId) return;
        const point = getCanvasDisplayPoint(event);
        updateSelectionBox(state.startX, state.startY, point.x - state.startX, point.y - state.startY);
    });

    const stopSelection = (event) => {
        if (!state.isSelecting || event.pointerId !== state.activePointerId) return;
        state.isSelecting = false;
        state.activePointerId = null;
        finalizeSelection();
    };

    els.canvasShell.addEventListener("pointerup", stopSelection);
    els.canvasShell.addEventListener("pointercancel", stopSelection);
}

function bindActionEvents() {
    els.btnApplyCrop.addEventListener("click", async () => {
        await runOperation("Applying bottom crop...", () => {
            Processor.cropBottom(els.canvas, Number(els.cropSlider.value));
        }, "Crop applied.");
    });

    els.btnApplyInpaint.addEventListener("click", async () => {
        if (!state.selectionRect) {
            setInlineMessage("Select a region before applying inpaint.", true);
            return;
        }

        await runOperation("Running local inpaint...", () => {
            Processor.smartInpaint(els.canvas, state.selectionRect, Number(els.radiusSlider.value));
        }, "Inpaint applied.");
    });

    els.btnApplyEnhance.addEventListener("click", async () => {
        await runOperation("Applying sharpen pass...", () => {
            Processor.usmSharpen(els.canvas, Number(els.sharpSlider.value) / 10);
        }, "Sharpen applied.");
    });

    els.btnReset.addEventListener("click", async () => {
        if (!state.originalSnapshot) return;
        await restoreToOriginal();
    });

    els.btnDownload.addEventListener("click", async () => {
        if (!state.currentSnapshot || state.busy) return;
        const link = document.createElement("a");
        link.download = `aether-clean-${Date.now()}.png`;
        link.href = URL.createObjectURL(state.currentSnapshot);
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });

    els.btnUndo.addEventListener("click", async () => {
        await undo();
    });

    els.btnRedo.addEventListener("click", async () => {
        await redo();
    });

    ["pointerdown", "pointerenter"].forEach((eventName) => {
        els.btnCompare.addEventListener(eventName, async (event) => {
            if (eventName === "pointerenter" && event.buttons !== 1) return;
            await showCompare();
        });
    });

    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
        els.btnCompare.addEventListener(eventName, async () => {
            await hideCompare();
        });
    });
}

async function loadImageFile(file) {
    try {
        validateFile(file);
        setBusy(true, "Preparing image...");

        const bitmap = await createImageBitmap(file);
        const normalized = normalizeDimensions(bitmap.width, bitmap.height);
        drawBitmapToCanvas(bitmap, normalized.width, normalized.height);
        bitmap.close();

        state.fileInfo = {
            name: file.name,
            size: file.size,
            originalWidth: normalized.originalWidth,
            originalHeight: normalized.originalHeight,
            workingWidth: normalized.width,
            workingHeight: normalized.height,
            scaled: normalized.scaled
        };

        const snapshot = await canvasToBlob(els.canvas);
        state.originalSnapshot = snapshot;
        state.currentSnapshot = snapshot;
        state.history.undo = [];
        state.history.redo = [];
        resetSelection();

        els.workspace.classList.remove("hidden");
        updateMetaUi();
        updateHistoryUi();
        updateActionAvailability();

        const note = normalized.scaled
            ? `Loaded ${file.name}. Working copy scaled from ${normalized.originalWidth}x${normalized.originalHeight} to ${normalized.width}x${normalized.height}.`
            : `Loaded ${file.name}.`;
        setInlineMessage(note, false);
    } catch (error) {
        setInlineMessage(error.message, true);
    } finally {
        setBusy(false);
    }
}

function validateFile(file) {
    if (!ACCEPTED_TYPES.has(file.type)) {
        throw new Error("Only PNG, JPG, and WebP files are supported.");
    }

    if (file.size > MAX_FILE_BYTES) {
        throw new Error("File is larger than 12 MB. Use a smaller file or export a compressed version first.");
    }
}

function normalizeDimensions(width, height) {
    let scale = 1;
    const maxSide = Math.max(width, height);
    const totalPixels = width * height;

    if (maxSide > MAX_WORKING_DIMENSION) {
        scale = Math.min(scale, MAX_WORKING_DIMENSION / maxSide);
    }

    if (totalPixels > MAX_WORKING_PIXELS) {
        scale = Math.min(scale, Math.sqrt(MAX_WORKING_PIXELS / totalPixels));
    }

    return {
        originalWidth: width,
        originalHeight: height,
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        scaled: scale < 1
    };
}

function drawBitmapToCanvas(bitmap, width, height) {
    els.canvas.width = width;
    els.canvas.height = height;
    const ctx = els.canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
}

async function runOperation(label, operation, successMessage) {
    if (!state.currentSnapshot || state.busy || state.compareVisible) return;

    try {
        setBusy(true, label);
        resetSelection();

        const beforeSnapshot = state.currentSnapshot;
        await nextFrame();
        operation();

        state.history.undo.push(beforeSnapshot);
        if (state.history.undo.length > HISTORY_LIMIT) {
            state.history.undo.shift();
        }
        state.history.redo = [];
        state.currentSnapshot = await canvasToBlob(els.canvas);

        updateHistoryUi();
        updateActionAvailability();
        updateMetaUi();
        setInlineMessage(successMessage, false);
    } catch (error) {
        setInlineMessage(error.message, true);
    } finally {
        setBusy(false);
    }
}

async function restoreToOriginal() {
    if (!state.originalSnapshot) return;

    try {
        setBusy(true, "Restoring original...");
        state.history.undo = [];
        state.history.redo = [];
        state.currentSnapshot = state.originalSnapshot;
        await drawBlobToCanvas(state.originalSnapshot);
        resetSelection();
        updateHistoryUi();
        updateActionAvailability();
        updateMetaUi();
        setInlineMessage("Restored original working copy.", false);
    } catch (error) {
        setInlineMessage(error.message, true);
    } finally {
        setBusy(false);
    }
}

async function undo() {
    if (!state.history.undo.length || state.busy) return;

    try {
        setBusy(true, "Undoing...");
        state.history.redo.push(state.currentSnapshot);
        state.currentSnapshot = state.history.undo.pop();
        await drawBlobToCanvas(state.currentSnapshot);
        resetSelection();
        updateHistoryUi();
        updateActionAvailability();
        setInlineMessage("Undo applied.", false);
    } catch (error) {
        setInlineMessage(error.message, true);
    } finally {
        setBusy(false);
    }
}

async function redo() {
    if (!state.history.redo.length || state.busy) return;

    try {
        setBusy(true, "Redoing...");
        state.history.undo.push(state.currentSnapshot);
        if (state.history.undo.length > HISTORY_LIMIT) {
            state.history.undo.shift();
        }
        state.currentSnapshot = state.history.redo.pop();
        await drawBlobToCanvas(state.currentSnapshot);
        resetSelection();
        updateHistoryUi();
        updateActionAvailability();
        setInlineMessage("Redo applied.", false);
    } catch (error) {
        setInlineMessage(error.message, true);
    } finally {
        setBusy(false);
    }
}

async function showCompare() {
    if (!state.originalSnapshot || state.busy || state.compareVisible) return;
    state.compareVisible = true;
    await drawBlobToCanvas(state.originalSnapshot);
    setInlineMessage("Showing original working copy. Release to return to the edited image.", false);
}

async function hideCompare() {
    if (!state.compareVisible || !state.currentSnapshot) return;
    state.compareVisible = false;
    await drawBlobToCanvas(state.currentSnapshot);
    setInlineMessage("Returned to current edit.", false);
}

function switchTab(targetTab) {
    els.tabBtns.forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === targetTab);
    });

    els.tabPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === `tab-${targetTab}`);
    });

    resetSelection();
    setInlineMessage(
        targetTab === "inpaint"
            ? "Drag a rectangle directly on the image to define the inpaint area."
            : "Selection cleared.",
        false
    );
}

function isInpaintTabActive() {
    return document.getElementById("tab-inpaint").classList.contains("active");
}

function getCanvasDisplayPoint(event) {
    const rect = els.canvas.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    return { x, y };
}

function updateSelectionBox(x, y, width, height) {
    const left = width < 0 ? x + width : x;
    const top = height < 0 ? y + height : y;
    const safeWidth = Math.abs(width);
    const safeHeight = Math.abs(height);

    els.selectionBox.style.left = `${left + els.canvas.offsetLeft}px`;
    els.selectionBox.style.top = `${top + els.canvas.offsetTop}px`;
    els.selectionBox.style.width = `${safeWidth}px`;
    els.selectionBox.style.height = `${safeHeight}px`;
}

function finalizeSelection() {
    const canvasRect = els.canvas.getBoundingClientRect();
    const boxStyle = window.getComputedStyle(els.selectionBox);
    const left = parseFloat(boxStyle.left) - els.canvas.offsetLeft;
    const top = parseFloat(boxStyle.top) - els.canvas.offsetTop;
    const width = parseFloat(boxStyle.width);
    const height = parseFloat(boxStyle.height);

    if (width < 8 || height < 8) {
        resetSelection();
        setInlineMessage("Selection was too small. Drag a larger region.", true);
        return;
    }

    const scaleX = els.canvas.width / canvasRect.width;
    const scaleY = els.canvas.height / canvasRect.height;

    state.selectionRect = {
        x: left * scaleX,
        y: top * scaleY,
        w: width * scaleX,
        h: height * scaleY
    };

    els.btnApplyInpaint.disabled = false;
    setInlineMessage("Selection captured. You can now apply inpaint.", false);
}

function resetSelection() {
    state.selectionRect = null;
    state.isSelecting = false;
    state.activePointerId = null;
    els.selectionBox.style.display = "none";
    els.selectionBox.style.width = "0";
    els.selectionBox.style.height = "0";
    els.btnApplyInpaint.disabled = true;
}

function updateMetaUi() {
    if (!state.fileInfo) {
        els.imageMeta.textContent = "No image loaded";
        return;
    }

    state.fileInfo.workingWidth = els.canvas.width;
    state.fileInfo.workingHeight = els.canvas.height;

    const scaledText = state.fileInfo.scaled
        ? ` | working ${state.fileInfo.workingWidth}x${state.fileInfo.workingHeight} from ${state.fileInfo.originalWidth}x${state.fileInfo.originalHeight}`
        : ` | ${state.fileInfo.workingWidth}x${state.fileInfo.workingHeight}`;

    els.imageMeta.textContent = `${state.fileInfo.name} | ${formatBytes(state.fileInfo.size)}${scaledText}`;
}

function updateHistoryUi() {
    els.historyMeta.textContent = `Undo ${state.history.undo.length} / ${HISTORY_LIMIT}`;
}

function updateActionAvailability() {
    const hasImage = Boolean(state.currentSnapshot);
    els.btnReset.disabled = !hasImage || state.busy;
    els.btnDownload.disabled = !hasImage || state.busy;
    els.btnUndo.disabled = !state.history.undo.length || state.busy;
    els.btnRedo.disabled = !state.history.redo.length || state.busy;
    els.btnCompare.disabled = !state.originalSnapshot || state.busy;
    els.btnApplyCrop.disabled = !hasImage || state.busy;
    els.btnApplyEnhance.disabled = !hasImage || state.busy;
    els.btnApplyInpaint.disabled = !state.selectionRect || state.busy;
}

function setBusy(flag, label = "Processing...") {
    state.busy = flag;
    els.busyOverlay.classList.toggle("hidden", !flag);
    els.busyLabel.textContent = label;
    updateActionAvailability();
}

function setInlineMessage(message, isError) {
    els.inlineMessage.textContent = message;
    els.inlineMessage.classList.toggle("error", Boolean(isError));
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Failed to capture the current canvas state."));
                return;
            }
            resolve(blob);
        }, "image/png");
    });
}

async function drawBlobToCanvas(blob) {
    const bitmap = await createImageBitmap(blob);
    drawBitmapToCanvas(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
}

function setEngineStatus(kind, message) {
    els.engineStatus.className = `status-banner ${kind}`;
    els.engineStatusText.textContent = message;
}

window.onOpenCvReady = function onOpenCvReady() {
    if (typeof cv !== "undefined" && typeof cv.getBuildInformation === "function") {
        window.cvReady = true;
        setEngineStatus("ready", "Local OpenCV engine ready.");
        return;
    }

    window.setTimeout(window.onOpenCvReady, 120);
};

window.onOpenCvError = function onOpenCvError() {
    window.cvReady = false;
    setEngineStatus("error", "OpenCV failed to load from js/opencv.js. Refresh the page after restoring the file.");
};

init();
