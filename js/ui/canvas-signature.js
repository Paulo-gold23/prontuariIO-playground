/**
 * Prontuar.io - Assinatura Digital Stylus / Mouse
 * Gerenciador de Canvas com suporte a múltiplos traços, suavização Bezier e captura de metadados
 */

class CanvasSignature {
    constructor(canvasId, wrapperId, clearButtonId, metadataTimeId, metadataIPId, placeholderText = "") {
        this.canvas = document.getElementById(canvasId);
        this.wrapper = document.getElementById(wrapperId) || this.canvas.parentElement;
        this.clearButton = document.getElementById(clearButtonId);
        this.metadataTime = document.getElementById(metadataTimeId);
        this.metadataIP = document.getElementById(metadataIPId);
        
        if (!this.canvas) {
            console.error(`Canvas com ID ${canvasId} não encontrado.`);
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.strokes = []; // Armazena todos os traços finalizados
        this.currentStroke = []; // Armazena os pontos do traço atual
        this.isDrawing = false;
        this.hasDrawn = false;
        this.placeholderText = placeholderText;

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
        // Bloqueia scroll/zoom do browser DIRETAMENTE no canvas (crítico para mobile)
        this.canvas.style.touchAction = 'none';
        this.canvas.style.userSelect  = 'none';
        this.canvas.style.webkitUserSelect = 'none';

        // Ajustar o tamanho inicial com base no dispositivo físico (Retina displays)
        this.resizeCanvas();
        
        // Registrar escuta de redimensionamento de tela de forma otimizada
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resizeCanvas(), 200);
        });

        if (window.PointerEvent) {
            // PointerEvent unifica mouse, stylus e touch em navegadores modernos.
            // { passive: false } + preventDefault() bloqueiam scroll/zoom do browser.
            this.canvas.addEventListener('pointerdown',   (e) => this.startDrawing(e), { passive: false });
            this.canvas.addEventListener('pointermove',   (e) => this.draw(e),          { passive: false });
            this.canvas.addEventListener('pointerup',     (e) => this.stopDrawing(e));
            this.canvas.addEventListener('pointercancel', (e) => this.stopDrawing(e));
        } else {
            // Fallback: TouchEvent para dispositivos que não suportam PointerEvent
            this.canvas.addEventListener('touchstart',  (e) => this.startDrawing(e), { passive: false });
            this.canvas.addEventListener('touchmove',   (e) => this.draw(e),          { passive: false });
            this.canvas.addEventListener('touchend',    (e) => this.stopDrawing(e),  { passive: false });
            this.canvas.addEventListener('touchcancel', (e) => this.stopDrawing(e),  { passive: false });

            // Fallback mouse para desktops
            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup',   (e) => this.stopDrawing(e));
            this.canvas.addEventListener('mouseout',  (e) => this.stopDrawing(e));
        }

        // Botão Limpar
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clear());
        }

        // Buscar IP do cliente
        this.fetchClientIP();
    }

    setupContextStyles() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = 3.0; // Espessura do traço otimizada para maior visibilidade
        
        // Cor fixa escura para garantir que a assinatura saia nítida no PDF final (fundo branco)
        this.ctx.strokeStyle = '#000000'; // Pure black
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || 300;
        const height = rect.height || 150;
        
        // Se já desenhou, salva temporariamente a imagem para não perder no redimensionamento
        let tempImage = null;
        if (this.hasDrawn) {
            tempImage = this.canvas.toDataURL();
        }
        
        const ratio = window.devicePixelRatio || 1;
        this.canvas.width = width * ratio;
        this.canvas.height = height * ratio;
        this.ctx.scale(ratio, ratio);
        
        // Reconfigura estilos após alterar largura/altura física do Canvas
        this.setupContextStyles();
        
        // Restaura o desenho
        if (tempImage) {
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0, width, height);
            };
            img.src = tempImage;
        }
    }

    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();

        // Ordem de prioridade:
        // 1. PointerEvent  → e.clientX / e.clientY  (mouse, stylus, touch via PointerEvent)
        // 2. TouchEvent    → e.touches[0]            (fallback para dispositivos antigos)
        // 3. MouseEvent    → e.clientX / e.clientY   (desktop)
        let clientX, clientY;
        if (window.PointerEvent && e instanceof PointerEvent) {
            clientX = e.clientX;
            clientY = e.clientY;
        } else if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            // touchend envia changedTouches, não touches
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Converte coordenadas de tela para coordenadas lógicas do canvas
        // (sem aplicar devicePixelRatio — o canvas já foi escalado no ctx.scale)
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    startDrawing(e) {
        e.preventDefault();
        e.stopPropagation();

        // setPointerCapture garante que todos os eventos posteriores
        // (pointermove, pointerup) cheguem a este elemento mesmo que o dedo
        // saia dos limites — essencial para não perder o traço em mobile.
        if (window.PointerEvent && e instanceof PointerEvent && e.pointerId != null) {
            try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        }
        
        // Ajusta as dimensões físicas do canvas para corresponder ao layout visível na tela
        // antes de capturar qualquer coordenada no primeiro toque.
        if (!this.hasDrawn) {
            this.resizeCanvas();
        }

        this.isDrawing = true;
        this.wrapper.classList.add('active');
        
        const coords = this.getCoordinates(e);
        this.currentStroke = [coords];
        this.strokes.push(this.currentStroke);
        
        // Remove placeholder no primeiro traço
        if (!this.hasDrawn) {
            this.hasDrawn = true;
            this.wrapper.classList.add('has-signature');
            this.updateTimestamp();
        }

        // Desenha um ponto inicial
        this.ctx.beginPath();
        this.ctx.arc(coords.x, coords.y, this.ctx.lineWidth / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.fill();
    }

    draw(e) {
        if (!this.isDrawing) return;
        e.preventDefault();
        e.stopPropagation();

        const coords = this.getCoordinates(e);
        this.currentStroke.push(coords);

        this.ctx.clearRect(0, 0, this.canvas.width / (window.devicePixelRatio || 1), this.canvas.height / (window.devicePixelRatio || 1));
        this.drawAllStrokes();
    }

    drawAllStrokes() {
        this.setupContextStyles();
        
        for (const stroke of this.strokes) {
            if (stroke.length === 0) continue;
            
            this.ctx.beginPath();
            
            if (stroke.length === 1) {
                // Ponto isolado (tap sem arrastar)
                this.ctx.arc(stroke[0].x, stroke[0].y, this.ctx.lineWidth / 2, 0, Math.PI * 2);
                this.ctx.fillStyle = this.ctx.strokeStyle;
                this.ctx.fill();
                continue;
            }

            if (stroke.length === 2) {
                // Linha reta simples entre 2 pontos
                this.ctx.moveTo(stroke[0].x, stroke[0].y);
                this.ctx.lineTo(stroke[1].x, stroke[1].y);
                this.ctx.stroke();
                continue;
            }

            // 3+ pontos: suavização Bezier quadrática
            this.ctx.moveTo(stroke[0].x, stroke[0].y);
            
            let i;
            for (i = 1; i < stroke.length - 2; i++) {
                const xc = (stroke[i].x + stroke[i + 1].x) / 2;
                const yc = (stroke[i].y + stroke[i + 1].y) / 2;
                this.ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, xc, yc);
            }
            // Último segmento até o ponto final
            this.ctx.quadraticCurveTo(
                stroke[i].x,
                stroke[i].y,
                stroke[i + 1].x,
                stroke[i + 1].y
            );
            this.ctx.stroke();
        }
    }

    stopDrawing(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.wrapper.classList.remove('active');

        // Libera o pointer capture para encerrar o contexto de captura limpo
        if (e && window.PointerEvent && e instanceof PointerEvent && e.pointerId != null) {
            try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width / (window.devicePixelRatio || 1), this.canvas.height / (window.devicePixelRatio || 1));
        this.strokes = [];
        this.currentStroke = [];
        this.hasDrawn = false;
        this.wrapper.classList.remove('has-signature');
        this.wrapper.classList.remove('active');
        
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
            // Consulta de IP pública rápida e segura
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
