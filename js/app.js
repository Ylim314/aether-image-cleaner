/**
 * app.js
 * 负责页面交互、文件校验、历史记录和处理状态管理
 */

const LIMITS = {
    maxFileSizeBytes: 20 * 1024 * 1024,
    maxDimension: 8192,
    maxPixels: 40_000_000,
    memoryWarningBytes: 160 * 1024 * 1024,
    historySoftLimitBytes: 240 * 1024 * 1024,
    defaultHistorySteps: 10,
    reducedHistorySteps: 5,
    reducedHistoryPixels: 12_000_000,
    minSelectionSize: 8
};

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
]);

const els = {
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    workspace: document.getElementById('workspace'),
    canvas: document.getElementById('main-canvas'),
    selectionBox: document.getElementById('selection-box'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    uploadWarning: document.getElementById('upload-warning'),
    uploadError: document.getElementById('upload-error'),
    fileMeta: document.getElementById('file-meta'),
    processStatus: document.getElementById('process-status'),
    cropSlider: document.getElementById('crop-slider'),
    cropVal: document.getElementById('crop-val'),
    radiusSlider: document.getElementById('radius-slider'),
    radiusVal: document.getElementById('radius-val'),
    sharpSlider: document.getElementById('sharp-slider'),
    sharpVal: document.getElementById('sharp-val'),
    exportFormat: document.getElementById('export-format'),
    exportQuality: document.getElementById('export-quality'),
    exportQualityVal: document.getElementById('export-quality-val'),
    btnApplyCrop: document.getElementById('btn-apply-crop'),
    btnApplyInpaint: document.getElementById('btn-apply-inpaint'),
    btnApplyEnhance: document.getElementById('btn-apply-enhance'),
    btnCompareToggle: document.getElementById('btn-compare-toggle'),
    btnCompareHold: document.getElementById('btn-compare-hold'),
    btnUndo: document.getElementById('btn-undo'),
    btnRedo: document.getElementById('btn-redo'),
    btnReset: document.getElementById('btn-reset'),
    btnDownload: document.getElementById('btn-download')
};

let state = {
    originalSnapshot: null,
    isSelecting: false,
    activePointerId: null,
    startX: 0,
    startY: 0,
    selectionRect: null,
    isProcessing: false,
    statusTimer: null,
    history: [],
    historyBytes: 0,
    redo: [],
    redoBytes: 0,
    compareSource: null, // 'toggle' | 'hold' | null
    compareSnapshot: null
};

function init() {
    if (typeof window.cvReady === 'undefined') {
        window.cvReady = false;
    }

    els.dropZone.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', handleFileSelect);
    els.dropZone.addEventListener('dragover', handleDragOver);
    els.dropZone.addEventListener('dragleave', handleDragLeave);
    els.dropZone.addEventListener('drop', handleDrop);

    els.tabBtns.forEach((btn) => btn.addEventListener('click', switchTab));

    els.cropSlider.oninput = (e) => {
        els.cropVal.textContent = `${e.target.value}px`;
    };
    els.radiusSlider.oninput = (e) => {
        els.radiusVal.textContent = `${e.target.value}px`;
    };
    els.sharpSlider.oninput = (e) => {
        els.sharpVal.textContent = (Number.parseInt(e.target.value, 10) / 10).toFixed(1);
    };
    els.exportQuality.oninput = (e) => {
        els.exportQualityVal.textContent = `${e.target.value}%`;
    };
    els.exportFormat.addEventListener('change', handleExportFormatChange);

    setupCanvasInteraction();

    els.btnApplyCrop.addEventListener('click', onApplyCrop);
    els.btnApplyInpaint.addEventListener('click', onApplyInpaint);
    els.btnApplyEnhance.addEventListener('click', onApplyEnhance);
    els.btnCompareToggle.addEventListener('click', onCompareToggle);
    setupCompareHoldEvents();
    els.btnUndo.addEventListener('click', undo);
    els.btnRedo.addEventListener('click', redo);
    els.btnReset.addEventListener('click', resetToOriginal);
    els.btnDownload.addEventListener('click', downloadImage);
    window.addEventListener('keydown', handleGlobalShortcuts);

    handleExportFormatChange();
    updateActionButtons();
}

function handleFileSelect(e) {
    if (e.target.files.length) {
        void loadImage(e.target.files[0]);
    }
    e.target.value = '';
}

function handleDragOver(e) {
    e.preventDefault();
    els.dropZone.style.borderColor = '#0071e3';
}

function handleDragLeave() {
    els.dropZone.style.borderColor = '#d2d2d7';
}

function handleDrop(e) {
    e.preventDefault();
    els.dropZone.style.borderColor = '#d2d2d7';
    if (e.dataTransfer.files.length) {
        void loadImage(e.dataTransfer.files[0]);
    }
}

async function loadImage(file) {
    if (state.isProcessing) return;

    deactivateCompare(true);
    clearUploadMessages();
    clearProcessStatus();

    const validationError = validateFile(file);
    if (validationError) {
        showUploadError(validationError);
        return;
    }

    showProcessStatus('正在读取图片...', 'info');

    let decoded = null;
    try {
        decoded = await decodeImage(file);
    } catch (err) {
        console.error('Image decode error:', err);
        showUploadError('图片读取失败，请确认文件未损坏。');
        showProcessStatus('图片读取失败', 'error', 1800);
        return;
    }

    const { img, url, width, height } = decoded;
    const pixels = width * height;
    const estimatedBytes = pixels * 4;

    if (width > LIMITS.maxDimension || height > LIMITS.maxDimension) {
        URL.revokeObjectURL(url);
        showUploadError(`图片尺寸过大，最长边不能超过 ${LIMITS.maxDimension}px。`);
        clearProcessStatus();
        return;
    }

    if (pixels > LIMITS.maxPixels) {
        URL.revokeObjectURL(url);
        showUploadError(`图片像素过大，不能超过 ${Math.round(LIMITS.maxPixels / 1_000_000)}MP。`);
        clearProcessStatus();
        return;
    }

    if (estimatedBytes > LIMITS.memoryWarningBytes) {
        showUploadWarning(`该图片较大，预计占用 ${formatBytes(estimatedBytes)} 内存，处理可能变慢。`);
    }

    renderImageElement(img);
    URL.revokeObjectURL(url);

    state.originalSnapshot = createSnapshotFromCanvas();
    clearHistoryStacks();
    resetSelection();

    els.dropZone.style.display = 'none';
    els.workspace.style.display = 'grid';
    els.fileMeta.style.display = 'block';
    els.fileMeta.textContent = `${file.name} | ${width}x${height} | ${formatBytes(file.size)} | 预计内存 ${formatBytes(estimatedBytes)}`;

    showProcessStatus('图片加载完成', 'success', 1200);
    updateActionButtons();
}

function validateFile(file) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return '文件格式不支持，仅支持 JPG / PNG / WebP。';
    }
    if (file.size > LIMITS.maxFileSizeBytes) {
        return `文件过大，最大支持 ${Math.round(LIMITS.maxFileSizeBytes / 1024 / 1024)}MB。`;
    }
    return null;
}

function decodeImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            resolve({
                img,
                url,
                width: img.naturalWidth,
                height: img.naturalHeight
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to decode image'));
        };
        img.src = url;
    });
}

function renderImageElement(img) {
    els.canvas.width = img.naturalWidth || img.width;
    els.canvas.height = img.naturalHeight || img.height;
    const ctx = els.canvas.getContext('2d');
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    ctx.drawImage(img, 0, 0);
}

function switchTab(e) {
    deactivateCompare(true);
    const target = e.target.dataset.tab;
    setActiveTab(target);
}

function setActiveTab(target) {
    if (!target) return;
    const targetButton = Array.from(els.tabBtns).find((btn) => btn.dataset.tab === target);
    if (!targetButton) return;

    els.tabBtns.forEach((btn) => btn.classList.remove('active'));
    els.tabPanels.forEach((panel) => panel.classList.remove('active'));
    targetButton.classList.add('active');
    document.getElementById(`tab-${target}`).classList.add('active');
    resetSelection();
}

function handleExportFormatChange() {
    const isLossless = els.exportFormat.value === 'png';
    els.exportQuality.disabled = isLossless;
    els.exportQualityVal.textContent = isLossless
        ? '无损'
        : `${els.exportQuality.value}%`;
    updateActionButtons();
}

function handleGlobalShortcuts(e) {
    if (isTextInputFocused()) return;

    const key = e.key.toLowerCase();
    const hasCommand = e.ctrlKey || e.metaKey;

    if (hasCommand && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
            redo();
        } else {
            undo();
        }
        return;
    }

    if (hasCommand && key === 'y') {
        e.preventDefault();
        redo();
        return;
    }

    if (hasCommand && key === 's') {
        e.preventDefault();
        downloadImage();
        return;
    }

    if (!hasCommand && !e.altKey) {
        if (key === '1') {
            setActiveTab('crop');
        } else if (key === '2') {
            setActiveTab('inpaint');
        } else if (key === '3') {
            setActiveTab('enhance');
        }
    }
}

function isTextInputFocused() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function setupCanvasInteraction() {
    const wrapper = els.canvas.parentElement;

    wrapper.addEventListener('pointerdown', (e) => {
        if (state.isProcessing || isComparing()) return;
        if (!document.getElementById('tab-inpaint').classList.contains('active')) return;
        if (e.target !== els.canvas && e.target !== els.selectionBox) return;

        state.activePointerId = e.pointerId;
        state.isSelecting = true;

        const rect = els.canvas.getBoundingClientRect();
        state.startX = clamp(e.clientX - rect.left, 0, rect.width);
        state.startY = clamp(e.clientY - rect.top, 0, rect.height);

        els.selectionBox.style.display = 'block';
        updateBox(state.startX, state.startY, 0, 0);
        state.selectionRect = null;
        updateActionButtons();

        if (wrapper.setPointerCapture) {
            wrapper.setPointerCapture(e.pointerId);
        }

        e.preventDefault();
    });

    window.addEventListener('pointermove', (e) => {
        if (!state.isSelecting) return;
        if (e.pointerId !== state.activePointerId) return;

        const rect = els.canvas.getBoundingClientRect();
        const currentX = clamp(e.clientX - rect.left, 0, rect.width);
        const currentY = clamp(e.clientY - rect.top, 0, rect.height);

        updateBox(state.startX, state.startY, currentX - state.startX, currentY - state.startY);
    });

    const onSelectionEnd = (e) => {
        if (!state.isSelecting) return;
        if (typeof e.pointerId !== 'undefined' && e.pointerId !== state.activePointerId) return;

        state.isSelecting = false;
        state.activePointerId = null;

        const rect = els.canvas.getBoundingClientRect();
        const scaleX = els.canvas.width / rect.width;
        const scaleY = els.canvas.height / rect.height;
        const boxStyle = window.getComputedStyle(els.selectionBox);

        const displayX = Number.parseFloat(boxStyle.left) || 0;
        const displayY = Number.parseFloat(boxStyle.top) || 0;
        const displayW = Number.parseFloat(boxStyle.width) || 0;
        const displayH = Number.parseFloat(boxStyle.height) || 0;

        if (displayW >= LIMITS.minSelectionSize && displayH >= LIMITS.minSelectionSize) {
            state.selectionRect = {
                x: displayX * scaleX,
                y: displayY * scaleY,
                w: displayW * scaleX,
                h: displayH * scaleY
            };
        } else {
            resetSelection();
        }

        updateActionButtons();
    };

    window.addEventListener('pointerup', onSelectionEnd);
    window.addEventListener('pointercancel', onSelectionEnd);
}

function updateBox(x, y, w, h) {
    const left = w < 0 ? x + w : x;
    const top = h < 0 ? y + h : y;
    const width = Math.abs(w);
    const height = Math.abs(h);

    els.selectionBox.style.left = `${left}px`;
    els.selectionBox.style.top = `${top}px`;
    els.selectionBox.style.width = `${width}px`;
    els.selectionBox.style.height = `${height}px`;
}

function resetSelection() {
    state.selectionRect = null;
    state.isSelecting = false;
    state.activePointerId = null;
    els.selectionBox.style.display = 'none';
    updateActionButtons();
}

function onApplyCrop() {
    if (!state.originalSnapshot || state.isProcessing || isComparing()) return;

    const pixels = Number.parseInt(els.cropSlider.value, 10);
    if (!Number.isFinite(pixels) || pixels <= 0) return;
    if (pixels >= els.canvas.height) {
        showUploadError('裁剪高度不能大于图片高度。');
        return;
    }

    clearUploadMessages();
    const historyAdded = recordHistoryBeforeChange();
    runProcessing(
        '正在应用裁剪...',
        '裁剪完成',
        () => Processor.cropBottom(els.canvas, pixels),
        historyAdded
    );
}

function onApplyInpaint() {
    if (!state.selectionRect || state.isProcessing || isComparing()) return;
    if (!Processor.checkReady()) {
        showProcessStatus('AI 引擎尚未就绪，请稍后重试。', 'error', 1800);
        return;
    }

    const radius = Number.parseInt(els.radiusSlider.value, 10);
    clearUploadMessages();
    const historyAdded = recordHistoryBeforeChange();
    runProcessing(
        '正在智能修复...',
        '修复完成',
        () => Processor.smartInpaint(els.canvas, state.selectionRect, radius),
        historyAdded
    );
}

function onApplyEnhance() {
    if (!state.originalSnapshot || state.isProcessing || isComparing()) return;
    if (!Processor.checkReady()) {
        showProcessStatus('AI 引擎尚未就绪，请稍后重试。', 'error', 1800);
        return;
    }

    const amount = Number.parseInt(els.sharpSlider.value, 10) / 10;
    clearUploadMessages();
    const historyAdded = recordHistoryBeforeChange();
    runProcessing(
        '正在增强画质...',
        '增强完成',
        () => Processor.usmSharpen(els.canvas, amount),
        historyAdded
    );
}

function runProcessing(loadingText, successText, executor, historyAdded) {
    deactivateCompare(true);
    state.isProcessing = true;
    updateActionButtons();
    showProcessStatus(loadingText, 'info');

    window.setTimeout(() => {
        let success = false;
        try {
            success = executor();
        } catch (err) {
            console.error('Processing error:', err);
        }

        state.isProcessing = false;

        if (!success) {
            if (historyAdded) {
                discardLatestHistorySnapshot();
            }
            updateActionButtons();
            showProcessStatus('处理失败，请重试。', 'error', 2200);
            return;
        }

        resetSelection();
        updateActionButtons();
        showProcessStatus(successText, 'success', 1200);
    }, 0);
}

function setupCompareHoldEvents() {
    const startHold = (e) => {
        e.preventDefault();
        if (state.compareSource === 'toggle') return;
        if (activateCompare('hold')) {
            els.btnCompareHold.classList.add('active');
        }
    };

    const stopHold = () => {
        if (state.compareSource !== 'hold') return;
        deactivateCompare(true);
        els.btnCompareHold.classList.remove('active');
    };

    els.btnCompareHold.addEventListener('pointerdown', startHold);
    els.btnCompareHold.addEventListener('pointerup', stopHold);
    els.btnCompareHold.addEventListener('pointercancel', stopHold);
    els.btnCompareHold.addEventListener('pointerleave', stopHold);
}

function onCompareToggle() {
    if (state.isProcessing || !state.originalSnapshot) return;

    if (state.compareSource === 'toggle') {
        deactivateCompare(true);
        showProcessStatus('已退出对比', 'success', 900);
        return;
    }

    if (activateCompare('toggle')) {
        showProcessStatus('对比模式已开启', 'success', 900);
    }
}

function activateCompare(source) {
    if (!state.originalSnapshot || state.isProcessing) return false;
    if (state.compareSource === source) return true;

    if (isComparing()) {
        deactivateCompare(true);
    }

    const current = createSnapshotFromCanvas();
    if (!current) return false;

    state.compareSnapshot = current;
    restoreSnapshot(state.originalSnapshot);
    state.compareSource = source;
    updateActionButtons();
    return true;
}

function deactivateCompare(silent) {
    if (!isComparing()) return;

    if (state.compareSnapshot) {
        restoreSnapshot(state.compareSnapshot);
    }

    state.compareSnapshot = null;
    state.compareSource = null;
    updateActionButtons();

    if (!silent) {
        showProcessStatus('已退出对比', 'success', 900);
    }
}

function isComparing() {
    return state.compareSource !== null;
}

function createSnapshotFromCanvas() {
    if (!els.canvas.width || !els.canvas.height) return null;
    const ctx = els.canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, els.canvas.width, els.canvas.height);
    return {
        imageData,
        bytes: imageData.data.byteLength
    };
}

function restoreSnapshot(snapshot) {
    els.canvas.width = snapshot.imageData.width;
    els.canvas.height = snapshot.imageData.height;
    els.canvas.getContext('2d').putImageData(snapshot.imageData, 0, 0);
}

function getHistoryStepLimit() {
    const pixels = els.canvas.width * els.canvas.height;
    return pixels > LIMITS.reducedHistoryPixels
        ? LIMITS.reducedHistorySteps
        : LIMITS.defaultHistorySteps;
}

function trimStack(stackName, bytesName, stepLimit) {
    while (
        state[stackName].length > stepLimit ||
        state[bytesName] > LIMITS.historySoftLimitBytes
    ) {
        const removed = state[stackName].shift();
        if (!removed) break;
        state[bytesName] -= removed.bytes;
    }
}

function pushToHistory(snapshot, clearRedo) {
    state.history.push(snapshot);
    state.historyBytes += snapshot.bytes;
    trimStack('history', 'historyBytes', getHistoryStepLimit());
    if (clearRedo) {
        clearRedoStack();
    }
}

function pushToRedo(snapshot) {
    state.redo.push(snapshot);
    state.redoBytes += snapshot.bytes;
    trimStack('redo', 'redoBytes', getHistoryStepLimit());
}

function clearRedoStack() {
    state.redo = [];
    state.redoBytes = 0;
}

function clearHistoryStacks() {
    state.history = [];
    state.historyBytes = 0;
    clearRedoStack();
}

function recordHistoryBeforeChange() {
    const snapshot = createSnapshotFromCanvas();
    if (!snapshot) return false;
    pushToHistory(snapshot, true);
    updateActionButtons();
    return true;
}

function discardLatestHistorySnapshot() {
    const last = state.history.pop();
    if (last) {
        state.historyBytes -= last.bytes;
    }
}

function undo() {
    if (state.isProcessing || isComparing() || !state.history.length) return;

    const current = createSnapshotFromCanvas();
    if (current) {
        pushToRedo(current);
    }

    const previous = state.history.pop();
    state.historyBytes -= previous.bytes;
    restoreSnapshot(previous);
    resetSelection();
    updateActionButtons();
    showProcessStatus('已撤销一步', 'success', 1000);
}

function redo() {
    if (state.isProcessing || isComparing() || !state.redo.length) return;

    const current = createSnapshotFromCanvas();
    if (current) {
        pushToHistory(current, false);
    }

    const next = state.redo.pop();
    state.redoBytes -= next.bytes;
    restoreSnapshot(next);
    resetSelection();
    updateActionButtons();
    showProcessStatus('已重做一步', 'success', 1000);
}

function resetToOriginal() {
    if (!state.originalSnapshot || state.isProcessing) return;

    deactivateCompare(true);
    restoreSnapshot(state.originalSnapshot);
    clearHistoryStacks();
    resetSelection();
    updateActionButtons();
    showProcessStatus('已重置到原图', 'success', 1200);
}

function downloadImage() {
    if (!state.originalSnapshot || state.isProcessing || isComparing()) return;
    try {
        const exportConfig = getExportConfig();
        const link = document.createElement('a');
        link.download = `aether-cleaned-${Date.now()}.${exportConfig.extension}`;
        link.href = els.canvas.toDataURL(exportConfig.mimeType, exportConfig.quality);
        if (!link.href.startsWith(`data:${exportConfig.mimeType}`)) {
            link.download = `aether-cleaned-${Date.now()}.png`;
            link.href = els.canvas.toDataURL('image/png');
            showProcessStatus('当前浏览器不支持所选格式，已回退为 PNG。', 'error', 1800);
        }
        link.click();
        showProcessStatus('导出完成', 'success', 1000);
    } catch (err) {
        console.error('Export error:', err);
        showProcessStatus('导出失败，请重试。', 'error', 2000);
    }
}

function getExportConfig() {
    const format = els.exportFormat.value;
    const quality = Number.parseInt(els.exportQuality.value, 10) / 100;

    if (format === 'jpeg') {
        return {
            mimeType: 'image/jpeg',
            extension: 'jpg',
            quality
        };
    }

    if (format === 'webp') {
        return {
            mimeType: 'image/webp',
            extension: 'webp',
            quality
        };
    }

    return {
        mimeType: 'image/png',
        extension: 'png',
        quality: 1
    };
}

function updateActionButtons() {
    const hasImage = !!state.originalSnapshot;
    const comparing = isComparing();
    const lockEditing = state.isProcessing || comparing;

    els.btnApplyCrop.disabled = lockEditing || !hasImage;
    els.btnApplyEnhance.disabled = lockEditing || !hasImage;
    els.btnApplyInpaint.disabled = lockEditing || !hasImage || !state.selectionRect;
    els.btnUndo.disabled = lockEditing || state.history.length === 0;
    els.btnRedo.disabled = lockEditing || state.redo.length === 0;
    els.btnReset.disabled = lockEditing || !hasImage;
    els.btnDownload.disabled = lockEditing || !hasImage;

    els.btnCompareToggle.disabled = state.isProcessing || !hasImage;
    els.btnCompareToggle.textContent = state.compareSource === 'toggle'
        ? '🧿 关闭对比'
        : '👁 对比开关';
    els.btnCompareToggle.classList.toggle('active', state.compareSource === 'toggle');

    els.btnCompareHold.disabled = state.isProcessing || !hasImage || state.compareSource === 'toggle';
    els.exportFormat.disabled = state.isProcessing || !hasImage;
    els.exportQuality.disabled = state.isProcessing || !hasImage || els.exportFormat.value === 'png';
}

function showUploadWarning(message) {
    els.uploadWarning.textContent = message;
    els.uploadWarning.style.display = 'block';
}

function showUploadError(message) {
    els.uploadError.textContent = message;
    els.uploadError.style.display = 'block';
}

function clearUploadMessages() {
    els.uploadWarning.textContent = '';
    els.uploadWarning.style.display = 'none';
    els.uploadError.textContent = '';
    els.uploadError.style.display = 'none';
}

function showProcessStatus(message, type, autoHideMs) {
    if (state.statusTimer) {
        clearTimeout(state.statusTimer);
        state.statusTimer = null;
    }

    els.processStatus.className = 'status-inline';
    if (type === 'success' || type === 'error') {
        els.processStatus.classList.add(type);
    }

    els.processStatus.textContent = message;
    els.processStatus.style.display = 'block';

    if (autoHideMs) {
        state.statusTimer = window.setTimeout(() => {
            clearProcessStatus();
        }, autoHideMs);
    }
}

function clearProcessStatus() {
    if (state.statusTimer) {
        clearTimeout(state.statusTimer);
        state.statusTimer = null;
    }
    els.processStatus.textContent = '';
    els.processStatus.style.display = 'none';
    els.processStatus.className = 'status-inline';
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

init();
