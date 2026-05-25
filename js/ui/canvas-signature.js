/**
 * Prontuar.io - Assinatura Digital Stylus / Mouse
 * Gerenciador de Canvas com suporte a múltiplos traços, suavização Bezier e captura de metadados
 */

class CanvasSignature {
    constructor(canvasId, wrapperId, clearButtonId, metadataTimeId, metadataIPId, placeholderText = "") {
        this.canvas = document.getElementById(canvasId);
        this.wrapper = document.getElementById(wrapperId) || this.canvas?.parentElement;
        this.clearButton = document.getElementById(clearButtonId);
        this.metadataTime = document.getElementById(metadataTimeId);
        this.metadataIP = document.getElementById(metadataIPId);
        
        if (!this.canvas) {
            console.error(`Canvas com ID ${canvasId} não encontrado.`);
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.strokes = [];
        this.currentStroke = [];
        this.isDrawing = false;
        this.hasDrawn = false;
        this.placeholderText = placeholderText;
        this._lastPoint = null;
        this._canvasReady = false;

        // Metadados Jurídicos
        this.auditMetadata = {
            ip: "Carregando...",
            userAgent: navigator.userAgent,
            resolution: `${window.screen.width}x${window.screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: null
        };

        this.init();
    }

    init() {
        // Bloqueia scroll/zoom/tap-highlight do browser no canvas (crítico para mobile)
        const s = this.canvas.style;
        s.touchAction = 'none';
        s.userSelect = 'none';
        s.webkitUserSelect = 'none';
        s.webkitTapHighlightColor = 'transparent';
        s.msTouchAction = 'none';

        // Ajustar tamanho inicial
        this.resizeCanvas();
        
        // Redimensionamento com debounce
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resizeCanvas(), 150);
        });

        // Orientação mobile
        if ('onorientationchange' in window) {
            window.addEventListener('orientationchange', () => {
                setTimeout(() => this.resizeCanvas(), 300);
            });
        }

        if (window.PointerEvent) {
            // PointerEvent: unifica mouse, stylus, touch
            // passive:false é OBRIGATÓRIO para que preventDefault() funcione no Chrome mobile
            this.canvas.addEventListener('pointerdown',   (e) => this.startDrawing(e), { passive: false });
            this.canvas.addEventListener('pointermove',   (e) => this.draw(e),          { passive: false });
            this.canvas.addEventListener('pointerup',     (e) => this.stopDrawing(e));
            this.canvas.addEventListener('pointercancel', (e) => this.stopDrawing(e));
            // NÃO registrar pointerout — mata o traço quando o dedo sai da borda
        } else {
            // Fallback: TouchEvent para dispositivos antigos
            this.canvas.addEventListener('touchstart',  (e) => this.startDrawing(e), { passive: false });
            this.canvas.addEventListener('touchmove',   (e) => this.draw(e),          { passive: false });
            this.canvas.addEventListener('touchend',    (e) => this.stopDrawing(e),  { passive: false });
            this.canvas.addEventListener('touchcancel', (e) => this.stopDrawing(e),  { passive: false });

            // Fallback mouse desktop
            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup',   (e) => this.stopDrawing(e));
            this.canvas.addEventListener('mouseout',  (e) => this.stopDrawing(e));
        }

        // Botão Limpar
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clear());
        }

        // IP
        this.fetchClientIP();
    }

    // ──────────────────────────────────────────────
    //  Estilos do contexto — lineWidth responsivo
    // ──────────────────────────────────────────────

    _getLineWidth() {
        const rect = this.canvas.getBoundingClientRect();
        const shorter = Math.min(rect.width, rect.height);
        // Em telas pequenas (canvas < 120px de altura) traço fino
        // Em telas grandes (canvas > 200px) traço mais visível
        if (shorter < 100) return 1.2;
        if (shorter < 160) return 1.6;
        return 2.2;
    }

    setupContextStyles() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = this._getLineWidth();
        this.ctx.strokeStyle = '#000000';
    }

    // ──────────────────────────────────────────────
    //  Resize — preserva strokes via dados, não pixels
    // ──────────────────────────────────────────────

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || 300;
        const height = rect.height || 150;
        
        const ratio = window.devicePixelRatio || 1;
        this.canvas.width = width * ratio;
        this.canvas.height = height * ratio;
        this.ctx.scale(ratio, ratio);
        
        this.setupContextStyles();
        this._canvasReady = true;

        // Redesenha a partir dos dados vetoriais (não perde qualidade)
        if (this.hasDrawn && this.strokes.length > 0) {
            this._redrawAllSmooth();
        }
    }

    // ──────────────────────────────────────────────
    //  Coordenadas — trata PointerEvent vs Touch vs Mouse
    // ──────────────────────────────────────────────

    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        let cx, cy;

        if (e instanceof PointerEvent) {
            cx = e.clientX;
            cy = e.clientY;
        } else if (e.touches && e.touches.length > 0) {
            cx = e.touches[0].clientX;
            cy = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            cx = e.changedTouches[0].clientX;
            cy = e.changedTouches[0].clientY;
        } else {
            cx = e.clientX;
            cy = e.clientY;
        }

        return {
            x: cx - rect.left,
            y: cy - rect.top
        };
    }

    // ──────────────────────────────────────────────
    //  startDrawing
    // ──────────────────────────────────────────────

    startDrawing(e) {
        e.preventDefault();
        e.stopPropagation();

        // setPointerCapture: prende TODOS os eventos futuros neste elemento
        // mesmo que o dedo saia dos limites do canvas. Sem isso o browser
        // redireciona os pointermove para o documento e o traço morre.
        if (e.pointerId != null && this.canvas.setPointerCapture) {
            try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        }

        // Garante dimensões corretas no primeiro toque
        if (!this._canvasReady || !this.hasDrawn) {
            this.resizeCanvas();
        }

        this.setupContextStyles();
        this.isDrawing = true;
        this.wrapper?.classList.add('active');
        
        const coords = this.getCoordinates(e);
        this.currentStroke = [coords];
        this.strokes.push(this.currentStroke);
        this._lastPoint = coords;
        
        // Placeholder
        if (!this.hasDrawn) {
            this.hasDrawn = true;
            this.wrapper?.classList.add('has-signature');
            this.updateTimestamp();
        }

        // Ponto inicial visível (para taps sem arrastar)
        this.ctx.beginPath();
        this.ctx.arc(coords.x, coords.y, this.ctx.lineWidth / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.fill();
    }

    // ──────────────────────────────────────────────
    //  draw — INCREMENTAL (não limpa o canvas a cada frame)
    //  Desenha apenas o novo segmento. Muito mais rápido em mobile.
    // ──────────────────────────────────────────────

    draw(e) {
        if (!this.isDrawing) return;
        e.preventDefault();
        e.stopPropagation();

        const coords = this.getCoordinates(e);
        this.currentStroke.push(coords);

        const prev = this._lastPoint;
        if (!prev) return;

        // Desenha segmento incremental com suavização via ponto médio
        const n = this.currentStroke.length;
        this.ctx.beginPath();

        if (n >= 3) {
            // Suavização quadrática: usa o ponto anterior como controle
            const p0 = this.currentStroke[n - 3];
            const p1 = this.currentStroke[n - 2];
            const mid0x = (p0.x + p1.x) / 2;
            const mid0y = (p0.y + p1.y) / 2;
            const mid1x = (p1.x + coords.x) / 2;
            const mid1y = (p1.y + coords.y) / 2;

            this.ctx.moveTo(mid0x, mid0y);
            this.ctx.quadraticCurveTo(p1.x, p1.y, mid1x, mid1y);
        } else {
            // Primeiro segmento: linha reta
            this.ctx.moveTo(prev.x, prev.y);
            this.ctx.lineTo(coords.x, coords.y);
        }

        this.ctx.stroke();
        this._lastPoint = coords;
    }

    // ──────────────────────────────────────────────
    //  stopDrawing — finaliza e faz redraw suavizado completo
    // ──────────────────────────────────────────────

    stopDrawing(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this._lastPoint = null;
        this.wrapper?.classList.remove('active');

        // Libera pointer capture
        if (e && e.pointerId != null && this.canvas.releasePointerCapture) {
            try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        }

        // Redraw final com suavização Bezier completa em todos os traços
        this._redrawAllSmooth();
    }

    // ──────────────────────────────────────────────
    //  Redraw completo com suavização Bezier
    // ──────────────────────────────────────────────

    _redrawAllSmooth() {
        const ratio = window.devicePixelRatio || 1;
        const w = this.canvas.width / ratio;
        const h = this.canvas.height / ratio;
        this.ctx.clearRect(0, 0, w, h);
        this.setupContextStyles();

        for (const stroke of this.strokes) {
            if (stroke.length === 0) continue;

            this.ctx.beginPath();

            if (stroke.length === 1) {
                this.ctx.arc(stroke[0].x, stroke[0].y, this.ctx.lineWidth / 2, 0, Math.PI * 2);
                this.ctx.fillStyle = this.ctx.strokeStyle;
                this.ctx.fill();
                continue;
            }

            if (stroke.length === 2) {
                this.ctx.moveTo(stroke[0].x, stroke[0].y);
                this.ctx.lineTo(stroke[1].x, stroke[1].y);
                this.ctx.stroke();
                continue;
            }

            // 3+ pontos: suavização com curvas quadráticas
            this.ctx.moveTo(stroke[0].x, stroke[0].y);

            for (let i = 1; i < stroke.length - 1; i++) {
                const xc = (stroke[i].x + stroke[i + 1].x) / 2;
                const yc = (stroke[i].y + stroke[i + 1].y) / 2;
                this.ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, xc, yc);
            }

            // Último ponto
            const last = stroke[stroke.length - 1];
            this.ctx.lineTo(last.x, last.y);
            this.ctx.stroke();
        }
    }

    // ──────────────────────────────────────────────
    //  Utilitários
    // ──────────────────────────────────────────────

    clear() {
        const ratio = window.devicePixelRatio || 1;
        this.ctx.clearRect(0, 0, this.canvas.width / ratio, this.canvas.height / ratio);
        this.strokes = [];
        this.currentStroke = [];
        this._lastPoint = null;
        this.hasDrawn = false;
        this.wrapper?.classList.remove('has-signature');
        this.wrapper?.classList.remove('active');
        
        if (this.metadataTime) {
            this.metadataTime.textContent = "Aguardando assinatura...";
        }
        this.auditMetadata.timestamp = null;
    }

    isEmpty() {
        return !this.hasDrawn;
    }

    toPNG() {
        if (this.isEmpty()) return null;
        return this.canvas.toDataURL('image/png');
    }

    updateTimestamp() {
        const now = new Date();
        this.auditMetadata.timestamp = now.toISOString();
        
        if (this.metadataTime) {
            const formatador = new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'medium'
            });
            this.metadataTime.textContent = `Assinado em: ${formatador.format(now)}`;
        }
    }

    async fetchClientIP() {
        const fallbackIP = "Indisponível (Offline/AdBlock)";
        try {
            const response = await fetch('https://api.ipify.org?format=json', { 
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            if (response.ok) {
                const data = await response.json();
                this.auditMetadata.ip = data.ip || fallbackIP;
            } else {
                this.auditMetadata.ip = fallbackIP;
            }
        } catch (e) {
            this.auditMetadata.ip = fallbackIP;
        }

        if (this.metadataIP) {
            this.metadataIP.textContent = `IP: ${this.auditMetadata.ip}`;
        }
    }

    getMetadata() {
        return {
            ...this.auditMetadata,
            timestamp: this.auditMetadata.timestamp || new Date().toISOString()
        };
    }
}

// Expõe globalmente para inicialização no app.js
window.CanvasSignature = CanvasSignature;
