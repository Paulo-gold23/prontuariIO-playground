/**
 * Prontuar.io — Assinatura Digital
 * Canvas com suavização Bezier, metadados jurídicos e modal fullscreen para mobile.
 */

class CanvasSignature {
    constructor(canvasId, wrapperId, clearButtonId, metadataTimeId, metadataIPId, placeholderText = "") {
        this.canvas = document.getElementById(canvasId);
        this.wrapper = document.getElementById(wrapperId) || this.canvas?.parentElement;
        this.clearButton = document.getElementById(clearButtonId);
        this.metadataTime = document.getElementById(metadataTimeId);
        this.metadataIP = document.getElementById(metadataIPId);

        if (!this.canvas) { console.error(`Canvas ${canvasId} não encontrado.`); return; }

        this.ctx = this.canvas.getContext('2d');
        this.strokes = [];
        this.currentStroke = [];
        this.isDrawing = false;
        this.hasDrawn = false;
        this.placeholderText = placeholderText;
        this._lastPoint = null;
        this._signatureDataUrl = null;
        this._modalOpen = false;

        this.auditMetadata = {
            ip: "Carregando...",
            userAgent: navigator.userAgent,
            resolution: `${window.screen.width}x${window.screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: null
        };

        this.init();
    }

    /* ═══════════════════════════════════════════
       Detecção mobile
       ═══════════════════════════════════════════ */

    get _isMobile() {
        // Usa modal fullscreen em mobile E tablet (até 1200px de largura)
        return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth < 1200;
    }

    /* ═══════════════════════════════════════════
       Inicialização
       ═══════════════════════════════════════════ */

    init() {
        const s = this.canvas.style;
        s.touchAction = 'none';
        s.userSelect = s.webkitUserSelect = 'none';
        s.webkitTapHighlightColor = 'transparent';

        this.resizeCanvas();

        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => this.resizeCanvas(), 150); });

        if (this._isMobile) {
            // Mobile → toque abre modal fullscreen
            const open = (e) => { e.preventDefault(); e.stopPropagation(); if (!this._modalOpen) this._openFullscreenModal(); };
            this.canvas.addEventListener('pointerdown', open, { passive: false });
            this.canvas.addEventListener('touchstart', open, { passive: false });
        } else {
            this._setupInlineDrawing();
        }

        if (this.clearButton) this.clearButton.addEventListener('click', () => this.clear());
        this.fetchClientIP();
    }

    /* ═══════════════════════════════════════════
       Desenho inline (desktop / stylus)
       ═══════════════════════════════════════════ */

    _setupInlineDrawing() {
        if (window.PointerEvent) {
            this.canvas.addEventListener('pointerdown',   (e) => this.startDrawing(e), { passive: false });
            this.canvas.addEventListener('pointermove',   (e) => this.draw(e),          { passive: false });
            this.canvas.addEventListener('pointerup',     (e) => this.stopDrawing(e));
            this.canvas.addEventListener('pointercancel', (e) => this.stopDrawing(e));
        } else {
            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup',   (e) => this.stopDrawing(e));
            this.canvas.addEventListener('mouseout',  (e) => this.stopDrawing(e));
        }
    }

    _getLineWidth() {
        const h = this.canvas.getBoundingClientRect().height;
        if (h < 100) return 1.2;
        if (h < 160) return 1.6;
        return 2.0;
    }

    setupContextStyles() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = this._getLineWidth();
        this.ctx.strokeStyle = '#1a1a2e';
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width || 300, h = rect.height || 150;
        const r = window.devicePixelRatio || 1;
        this.canvas.width = w * r;
        this.canvas.height = h * r;
        this.ctx.scale(r, r);
        this.setupContextStyles();

        if (this._signatureDataUrl) this._renderPreview();
        else if (this.hasDrawn && this.strokes.length) this._redrawAllSmooth();
    }

    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        let cx, cy;
        if (e instanceof PointerEvent) { cx = e.clientX; cy = e.clientY; }
        else if (e.touches?.length) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
        else { cx = e.clientX; cy = e.clientY; }
        return { x: cx - rect.left, y: cy - rect.top };
    }

    startDrawing(e) {
        e.preventDefault(); e.stopPropagation();
        if (e.pointerId != null && this.canvas.setPointerCapture)
            try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}

        if (!this.hasDrawn) this.resizeCanvas();
        this.setupContextStyles();
        this.isDrawing = true;
        this.wrapper?.classList.add('active');

        const c = this.getCoordinates(e);
        this.currentStroke = [c];
        this.strokes.push(this.currentStroke);
        this._lastPoint = c;

        if (!this.hasDrawn) { this.hasDrawn = true; this.wrapper?.classList.add('has-signature'); this.updateTimestamp(); }
        this.ctx.beginPath();
        this.ctx.arc(c.x, c.y, this.ctx.lineWidth / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.fill();
    }

    draw(e) {
        if (!this.isDrawing) return;
        e.preventDefault(); e.stopPropagation();
        const c = this.getCoordinates(e);
        this.currentStroke.push(c);
        const n = this.currentStroke.length;
        this.ctx.beginPath();
        if (n >= 3) {
            const p0 = this.currentStroke[n - 3], p1 = this.currentStroke[n - 2];
            this.ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
            this.ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + c.x) / 2, (p1.y + c.y) / 2);
        } else {
            this.ctx.moveTo(this._lastPoint.x, this._lastPoint.y);
            this.ctx.lineTo(c.x, c.y);
        }
        this.ctx.stroke();
        this._lastPoint = c;
    }

    stopDrawing(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this._lastPoint = null;
        this.wrapper?.classList.remove('active');
        if (e?.pointerId != null && this.canvas.releasePointerCapture)
            try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        this._redrawAllSmooth();
    }

    _redrawAllSmooth() {
        const r = window.devicePixelRatio || 1;
        const w = this.canvas.width / r, h = this.canvas.height / r;
        this.ctx.clearRect(0, 0, w, h);
        this.setupContextStyles();
        for (const s of this.strokes) {
            if (!s.length) continue;
            this.ctx.beginPath();
            if (s.length === 1) { this.ctx.arc(s[0].x, s[0].y, this.ctx.lineWidth / 2, 0, Math.PI * 2); this.ctx.fillStyle = this.ctx.strokeStyle; this.ctx.fill(); continue; }
            if (s.length === 2) { this.ctx.moveTo(s[0].x, s[0].y); this.ctx.lineTo(s[1].x, s[1].y); this.ctx.stroke(); continue; }
            this.ctx.moveTo(s[0].x, s[0].y);
            for (let i = 1; i < s.length - 1; i++) { this.ctx.quadraticCurveTo(s[i].x, s[i].y, (s[i].x + s[i+1].x) / 2, (s[i].y + s[i+1].y) / 2); }
            this.ctx.lineTo(s[s.length - 1].x, s[s.length - 1].y);
            this.ctx.stroke();
        }
    }

    /* ═══════════════════════════════════════════
       MODAL FULLSCREEN (mobile)
       ═══════════════════════════════════════════ */

    _openFullscreenModal() {
        this._modalOpen = true;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        let modalStrokes = [];
        let curStroke = [];
        let drawing = false;
        let last = null;

        // ── DOM ──
        const overlay = document.createElement('div');
        overlay.id = 'sig-modal';
        overlay.innerHTML = `
        <style>
            #sig-modal { position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;
                background:rgba(15,23,42,0.96);animation:smIn .25s ease-out; }
            @keyframes smIn { from{opacity:0} to{opacity:1} }
            #sig-modal [data-wrap] { flex:1;margin:0 14px;min-height:0;display:flex;
                animation:smUp .3s ease-out .08s both; }
            @keyframes smUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
            #sig-modal canvas { position:absolute;top:0;left:0;width:100%;height:100%;
                touch-action:none;user-select:none;-webkit-user-select:none;cursor:crosshair; }
            #sig-modal .sm-btn { border:none;cursor:pointer;-webkit-tap-highlight-color:transparent; }
        </style>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;flex-shrink:0;">
            <button class="sm-btn" data-action="cancel" style="width:44px;height:44px;display:flex;align-items:center;
                justify-content:center;background:rgba(255,255,255,0.1);border-radius:12px;color:#fff;font-size:22px;">✕</button>
            <span style="color:rgba(255,255,255,0.88);font-size:14px;font-weight:600;letter-spacing:.4px;">Assinatura Digital</span>
            <button class="sm-btn" data-action="clear" style="padding:8px 18px;background:rgba(255,255,255,0.08);
                border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:rgba(255,255,255,0.85);font-size:13px;font-weight:500;">Limpar</button>
        </div>
        <div data-wrap>
            <div style="flex:1;background:#fff;border-radius:20px;position:relative;overflow:hidden;
                box-shadow:0 20px 50px rgba(0,0,0,0.35);">
                <canvas data-c></canvas>
                <div style="position:absolute;bottom:26%;left:8%;right:8%;border-bottom:1.5px dashed rgba(0,0,0,0.07);pointer-events:none;"></div>
                <div style="position:absolute;bottom:20%;right:8%;color:rgba(0,0,0,0.1);font-size:10px;font-weight:500;
                    pointer-events:none;font-family:Inter,system-ui,sans-serif;">assine acima da linha</div>
            </div>
        </div>
        <div style="padding:14px 18px 28px;flex-shrink:0;">
            <button class="sm-btn" data-action="confirm" style="width:100%;padding:18px;
                background:linear-gradient(135deg,#10b981,#059669);border-radius:16px;color:#fff;
                font-size:17px;font-weight:700;box-shadow:0 8px 24px rgba(16,185,129,0.4);letter-spacing:.3px;">
                Confirmar Assinatura</button>
        </div>`;
        document.body.appendChild(overlay);

        const mc = overlay.querySelector('[data-c]');
        const mCtx = mc.getContext('2d');

        // ── Sizing ──
        const sizeModal = () => {
            const p = mc.parentElement.getBoundingClientRect();
            const ratio = window.devicePixelRatio || 1;
            mc.width = p.width * ratio;
            mc.height = p.height * ratio;
            mCtx.scale(ratio, ratio);
            redraw();
        };

        const LW = 1.5;
        const setStyles = () => { mCtx.lineCap = 'round'; mCtx.lineJoin = 'round'; mCtx.lineWidth = LW; mCtx.strokeStyle = '#1a1a2e'; };

        const getC = (e) => {
            const r = mc.getBoundingClientRect();
            let cx, cy;
            if (e instanceof PointerEvent) { cx = e.clientX; cy = e.clientY; }
            else if (e.touches?.length) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
            else { cx = e.clientX; cy = e.clientY; }
            return { x: cx - r.left, y: cy - r.top };
        };

        // ── Redraw Bezier ──
        const redraw = () => {
            const ratio = window.devicePixelRatio || 1;
            const w = mc.width / ratio, h = mc.height / ratio;
            mCtx.clearRect(0, 0, w, h);

            // Guide line
            mCtx.save();
            mCtx.setLineDash([4, 4]);
            mCtx.strokeStyle = 'rgba(0,0,0,0.06)';
            mCtx.lineWidth = 0.5;
            mCtx.beginPath();
            mCtx.moveTo(w * 0.08, h * 0.74);
            mCtx.lineTo(w * 0.92, h * 0.74);
            mCtx.stroke();
            mCtx.restore();

            setStyles();
            for (const s of modalStrokes) {
                if (!s.length) continue;
                mCtx.beginPath();
                if (s.length === 1) { mCtx.arc(s[0].x, s[0].y, LW / 2, 0, Math.PI * 2); mCtx.fillStyle = mCtx.strokeStyle; mCtx.fill(); continue; }
                if (s.length === 2) { mCtx.moveTo(s[0].x, s[0].y); mCtx.lineTo(s[1].x, s[1].y); mCtx.stroke(); continue; }
                mCtx.moveTo(s[0].x, s[0].y);
                for (let i = 1; i < s.length - 1; i++) mCtx.quadraticCurveTo(s[i].x, s[i].y, (s[i].x + s[i+1].x) / 2, (s[i].y + s[i+1].y) / 2);
                mCtx.lineTo(s[s.length - 1].x, s[s.length - 1].y);
                mCtx.stroke();
            }
        };

        // ── Pointer events ──
        mc.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (e.pointerId != null) try { mc.setPointerCapture(e.pointerId); } catch (_) {}
            drawing = true;
            const c = getC(e);
            curStroke = [c];
            last = c;
            setStyles();
            mCtx.beginPath();
            mCtx.arc(c.x, c.y, LW / 2, 0, Math.PI * 2);
            mCtx.fillStyle = mCtx.strokeStyle;
            mCtx.fill();
        }, { passive: false });

        mc.addEventListener('pointermove', (e) => {
            if (!drawing) return;
            e.preventDefault(); e.stopPropagation();
            const c = getC(e);
            curStroke.push(c);
            const n = curStroke.length;
            setStyles();
            mCtx.beginPath();
            if (n >= 3) {
                const p0 = curStroke[n - 3], p1 = curStroke[n - 2];
                mCtx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
                mCtx.quadraticCurveTo(p1.x, p1.y, (p1.x + c.x) / 2, (p1.y + c.y) / 2);
            } else {
                mCtx.moveTo(last.x, last.y);
                mCtx.lineTo(c.x, c.y);
            }
            mCtx.stroke();
            last = c;
        }, { passive: false });

        const endStroke = (e) => {
            if (!drawing) return;
            drawing = false;
            if (e?.pointerId != null) try { mc.releasePointerCapture(e.pointerId); } catch (_) {}
            if (curStroke.length) { modalStrokes.push([...curStroke]); curStroke = []; }
            last = null;
            redraw();
        };
        mc.addEventListener('pointerup', endStroke);
        mc.addEventListener('pointercancel', endStroke);

        // ── Buttons ──
        const close = (save) => {
            if (save && modalStrokes.length > 0) {
                this._signatureDataUrl = mc.toDataURL('image/png');
                this.strokes = modalStrokes;
                this.hasDrawn = true;
                this.wrapper?.classList.add('has-signature');
                this.updateTimestamp();
                this._renderPreview();

                // Dispara callbacks de sincronização globais (recepcao.html)
                // para que checkCanEfetivar() habilite o botão de efetivar
                setTimeout(() => {
                    if (typeof window.checkCanEfetivar === 'function') {
                        window.checkCanEfetivar();
                    }
                    // Atualiza preview de imagem da assinatura se existir
                    const imgPreview = document.getElementById('assinatura-paciente-img');
                    if (imgPreview) {
                        imgPreview.src = this._signatureDataUrl;
                        imgPreview.style.display = 'block';
                    }
                }, 80);
            }
            this._modalOpen = false;
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('resize', onResize);
            overlay.remove();
        };

        overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
        overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
        overlay.querySelector('[data-action="clear"]').addEventListener('click', () => { modalStrokes = []; curStroke = []; redraw(); });

        // ── Resize ──
        const onResize = () => sizeModal();
        window.addEventListener('resize', onResize);

        requestAnimationFrame(() => sizeModal());
    }

    /* ═══════════════════════════════════════════
       Preview (modal → inline canvas)
       ═══════════════════════════════════════════ */

    _renderPreview() {
        if (!this._signatureDataUrl) return;
        const img = new Image();
        img.onload = () => {
            const r = window.devicePixelRatio || 1;
            const cw = this.canvas.width / r, ch = this.canvas.height / r;
            this.ctx.clearRect(0, 0, cw, ch);
            // Fit mantendo proporção
            const ia = img.width / img.height, ca = cw / ch;
            let dw, dh;
            if (ia > ca) { dw = cw * 0.92; dh = dw / ia; }
            else { dh = ch * 0.92; dw = dh * ia; }
            this.ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
        };
        img.src = this._signatureDataUrl;
    }

    /* ═══════════════════════════════════════════
       Utilitários
       ═══════════════════════════════════════════ */

    clear() {
        const r = window.devicePixelRatio || 1;
        this.ctx.clearRect(0, 0, this.canvas.width / r, this.canvas.height / r);
        this.strokes = [];
        this.currentStroke = [];
        this._lastPoint = null;
        this._signatureDataUrl = null;
        this.hasDrawn = false;
        this.wrapper?.classList.remove('has-signature', 'active');
        if (this.metadataTime) this.metadataTime.textContent = "Aguardando assinatura...";
        this.auditMetadata.timestamp = null;
    }

    isEmpty() { return !this.hasDrawn; }

    toPNG() {
        if (this.isEmpty()) return null;
        return this._signatureDataUrl || this.canvas.toDataURL('image/png');
    }

    updateTimestamp() {
        const now = new Date();
        this.auditMetadata.timestamp = now.toISOString();
        if (this.metadataTime) {
            this.metadataTime.textContent = `Assinado em: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(now)}`;
        }
    }

    async fetchClientIP() {
        const fb = "Indisponível (Offline/AdBlock)";
        try {
            const res = await fetch('https://api.ipify.org?format=json', { method: 'GET', signal: AbortSignal.timeout(3000) });
            if (res.ok) { const d = await res.json(); this.auditMetadata.ip = d.ip || fb; }
            else this.auditMetadata.ip = fb;
        } catch (_) { this.auditMetadata.ip = fb; }
        if (this.metadataIP) this.metadataIP.textContent = `IP: ${this.auditMetadata.ip}`;
    }

    getMetadata() {
        return { ...this.auditMetadata, timestamp: this.auditMetadata.timestamp || new Date().toISOString() };
    }
}

window.CanvasSignature = CanvasSignature;
