const Processor = {
    ensureReady() {
        if (typeof cv === "undefined" || !window.cvReady) {
            throw new Error("OpenCV is still loading. Wait for the engine banner to turn ready.");
        }
    },

    cropBottom(canvas, pixels) {
        if (!Number.isFinite(pixels) || pixels <= 0) {
            throw new Error("Crop height must be greater than zero.");
        }

        const nextHeight = canvas.height - Math.round(pixels);
        if (nextHeight < 8) {
            throw new Error("Crop height is too large for the current image.");
        }

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = nextHeight;

        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.drawImage(canvas, 0, 0, canvas.width, nextHeight, 0, 0, canvas.width, nextHeight);

        canvas.width = tempCanvas.width;
        canvas.height = tempCanvas.height;
        canvas.getContext("2d").drawImage(tempCanvas, 0, 0);
    },

    smartInpaint(canvas, rect, radius) {
        this.ensureReady();

        if (!rect || rect.w < 2 || rect.h < 2) {
            throw new Error("Select a valid region before running inpaint.");
        }

        let src = null;
        let srcRgb = null;
        let mask = null;
        let dstRgb = null;
        let dstRgba = null;

        try {
            src = cv.imread(canvas);
            srcRgb = new cv.Mat();
            cv.cvtColor(src, srcRgb, cv.COLOR_RGBA2RGB, 0);

            mask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);

            const x1 = Math.max(0, Math.floor(rect.x));
            const y1 = Math.max(0, Math.floor(rect.y));
            const x2 = Math.min(src.cols, Math.ceil(rect.x + rect.w));
            const y2 = Math.min(src.rows, Math.ceil(rect.y + rect.h));

            cv.rectangle(mask, new cv.Point(x1, y1), new cv.Point(x2, y2), new cv.Scalar(255), -1);

            dstRgb = new cv.Mat();
            cv.inpaint(srcRgb, mask, dstRgb, radius, cv.INPAINT_TELEA);

            dstRgba = new cv.Mat();
            cv.cvtColor(dstRgb, dstRgba, cv.COLOR_RGB2RGBA, 0);
            cv.imshow(canvas, dstRgba);
        } finally {
            if (src) src.delete();
            if (srcRgb) srcRgb.delete();
            if (mask) mask.delete();
            if (dstRgb) dstRgb.delete();
            if (dstRgba) dstRgba.delete();
        }
    },

    usmSharpen(canvas, amount) {
        this.ensureReady();

        let src = null;
        let srcRgb = null;
        let blurred = null;
        let dstRgb = null;
        let dstRgba = null;

        try {
            src = cv.imread(canvas);
            srcRgb = new cv.Mat();
            cv.cvtColor(src, srcRgb, cv.COLOR_RGBA2RGB, 0);

            blurred = new cv.Mat();
            dstRgb = new cv.Mat();
            cv.GaussianBlur(srcRgb, blurred, new cv.Size(0, 0), 3, 3, cv.BORDER_DEFAULT);
            cv.addWeighted(srcRgb, 1 + amount, blurred, -amount, 0, dstRgb);

            dstRgba = new cv.Mat();
            cv.cvtColor(dstRgb, dstRgba, cv.COLOR_RGB2RGBA, 0);
            cv.imshow(canvas, dstRgba);
        } finally {
            if (src) src.delete();
            if (srcRgb) srcRgb.delete();
            if (blurred) blurred.delete();
            if (dstRgb) dstRgb.delete();
            if (dstRgba) dstRgba.delete();
        }
    }
};
