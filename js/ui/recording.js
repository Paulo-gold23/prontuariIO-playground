/**
 * js/ui/recording.js
 * ─────────────────────────────────────────────────────────────
 * Módulo de gravação de áudio: MediaRecorder, Timer e Waveform.
 * Expõe apenas a API pública via window.Recording.
 * Não manipula lógica de negócio — apenas captura áudio e UI de estado.
 */

(function () {
    'use strict';

    // ── Estado privado ──────────────────────────────────────────
    var mediaRecorder  = null;
    var audioChunks    = [];
    var segundos       = 0;
    var timerInterval  = null;
    var currentStream  = null;
    var isRecording    = false;
    var isPaused       = false;

    // ── Seletores (cacheados uma vez) ───────────────────────────
    var elTimer         = document.getElementById('timer');
    var elStatusText    = document.getElementById('statusText');
    var elStatusDot     = document.getElementById('statusDot');
    var elHintText      = document.getElementById('hintText');
    var elBtnGravar     = document.getElementById('btnGravar');
    var elBtnPausar     = document.getElementById('btnPausar');
    var elSpacerPausar  = document.getElementById('spacerPausar');
    var elControlPrinc  = document.getElementById('controlPrincipal');
    var elAcoesPosGrava = document.getElementById('acoesPosGrava');
    var elPlayerAudio   = document.getElementById('playerAudio');
    var elWaveformCanvas= document.getElementById('waveformCanvas');

    // ── Helpers privados ────────────────────────────────────────

    function getSupportedMimeType() {
        var types = [
            'audio/webm',
            'audio/webm;codecs=opus',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/mpeg',
        ];
        for (var i = 0; i < types.length; i++) {
            if (MediaRecorder.isTypeSupported(types[i])) return types[i];
        }
        return '';
    }

    function liberarStream() {
        if (currentStream) {
            currentStream.getTracks().forEach(function (t) { t.stop(); });
            currentStream = null;
        }
    }

    // ── Timer ───────────────────────────────────────────────────

    function iniciarTimer() {
        segundos = 0;
        if (elTimer) elTimer.textContent = '00:00';
        continuarTimer();
    }

    function continuarTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(function () {
            segundos++;
            var mins = String(Math.floor(segundos / 60)).padStart(2, '0');
            var secs = String(segundos % 60).padStart(2, '0');
            if (elTimer) elTimer.textContent = mins + ':' + secs;
        }, 1000);
    }

    function pararTimer() {
        clearInterval(timerInterval);
    }

    // ── Waveform ────────────────────────────────────────────────

    function desenharOnda(stream) {
        if (!elWaveformCanvas) return;
        var audioContext = new (window.AudioContext || window.webkitAudioContext)();
        var analyser = audioContext.createAnalyser();
        var source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyser.fftSize = 64;
        var bufferLength = analyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength);

        var ctx = elWaveformCanvas.getContext('2d');
        var width = elWaveformCanvas.width;
        var height = elWaveformCanvas.height;

        // Gradiente criado uma única vez — sem alocação por frame
        var gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(79, 70, 229, 0.2)');
        gradient.addColorStop(1, 'rgba(79, 70, 229, 1)');

        function render() {
            if (!isRecording || isPaused) {
                if (!isRecording) ctx.clearRect(0, 0, width, height);
                if (isRecording && isPaused) requestAnimationFrame(render);
                return;
            }
            requestAnimationFrame(render);
            analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, width, height);
            var barWidth = (width / bufferLength) * 2.5;
            ctx.fillStyle = gradient;
            var x = 0;
            for (var i = 0; i < bufferLength; i++) {
                var barHeight = (dataArray[i] / 255) * height;
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                x += barWidth + 2;
            }
        }
        render();
    }

    // ── Status UI ───────────────────────────────────────────────

    function setStatus(state) {
        switch (state) {
            case 'ready':
                if (elStatusText) elStatusText.textContent = 'Pronto para iniciar atendimento';
                if (elStatusDot) { elStatusDot.className = 'w-2 h-2 rounded-full bg-slate-400'; elStatusDot.innerHTML = ''; }
                if (elHintText) { elHintText.textContent = 'Clique para começar'; elHintText.style.display = ''; }
                if (elControlPrinc) elControlPrinc.style.display = 'flex';
                if (elAcoesPosGrava) elAcoesPosGrava.classList.add('hidden');
                if (elBtnPausar) elBtnPausar.classList.add('hidden');
                if (elSpacerPausar) elSpacerPausar.classList.add('hidden');
                break;
            case 'recording':
                if (elStatusText) elStatusText.textContent = 'Gravando consulta...';
                if (elStatusDot) { elStatusDot.className = 'w-2 h-2 rounded-full bg-rose-500 animate-pulse'; elStatusDot.innerHTML = ''; }
                if (elHintText) elHintText.textContent = 'Clique para parar';
                if (elBtnPausar) elBtnPausar.classList.remove('hidden');
                if (elSpacerPausar) elSpacerPausar.classList.remove('hidden');
                break;
            case 'paused':
                if (elStatusText) elStatusText.textContent = 'Gravação pausada';
                if (elStatusDot) { elStatusDot.className = 'w-2 h-2 rounded-full bg-amber-500'; elStatusDot.innerHTML = ''; }
                if (elHintText) elHintText.textContent = 'Clique para retomar';
                break;
            case 'finished':
                if (elStatusText) elStatusText.textContent = 'Áudio capturado';
                if (elStatusDot) { elStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-500'; elStatusDot.innerHTML = ''; }
                if (elHintText) elHintText.style.display = 'none';
                if (elControlPrinc) elControlPrinc.style.display = 'none';
                if (elAcoesPosGrava) elAcoesPosGrava.classList.remove('hidden');
                break;
            case 'processing':
                if (elStatusText) elStatusText.textContent = 'IA analisando áudio...';
                if (elStatusDot) { elStatusDot.className = 'loader-7'; elStatusDot.innerHTML = '<div class="square"></div>'; }
                if (elAcoesPosGrava) elAcoesPosGrava.classList.add('opacity-50', 'pointer-events-none');
                break;
        }
    }

    // ── API pública ─────────────────────────────────────────────

    async function iniciar() {
        try {
            var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            currentStream = stream;

            var mimeType = getSupportedMimeType();
            mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
            audioChunks = [];

            mediaRecorder.ondataavailable = function (event) {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = function () {
                var blob = new Blob(audioChunks, { type: mimeType });
                var url = URL.createObjectURL(blob);
                if (elPlayerAudio) elPlayerAudio.src = url;
                setStatus('finished');
                // Notifica o orquestrador sobre o áudio pronto
                document.dispatchEvent(new CustomEvent('recording:done', { detail: { blob: blob } }));
            };

            mediaRecorder.start();
            isRecording = true;
            isPaused = false;
            iniciarTimer();

            if (elBtnGravar) {
                elBtnGravar.innerHTML = '<i class="ph-fill ph-stop text-5xl"></i>';
                elBtnGravar.classList.replace('from-emerald-600', 'from-rose-500');
                elBtnGravar.classList.replace('to-emerald-700', 'to-rose-600');
            }
            setStatus('recording');
            if (elWaveformCanvas) desenharOnda(stream);

        } catch (err) {
            console.error('[Recording] Erro ao acessar microfone:', err);
            window.showToast('Não foi possível acessar o microfone.', 'error');
        }
    }

    function parar() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            isRecording = false;
            isPaused = false;
            pararTimer();
            liberarStream();

            if (elBtnGravar) {
                elBtnGravar.innerHTML = '<i class="ph-fill ph-microphone text-5xl"></i>';
                elBtnGravar.classList.replace('from-rose-500', 'from-emerald-600');
                elBtnGravar.classList.replace('to-rose-600', 'to-emerald-700');
            }
        }
    }

    function togglePause() {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
        var iconPausar = document.getElementById('iconPausar');

        if (!isPaused) {
            mediaRecorder.pause();
            isPaused = true;
            pararTimer();
            setStatus('paused');
            if (iconPausar) iconPausar.className = 'ph-fill ph-play text-3xl';
            if (elBtnPausar) elBtnPausar.classList.replace('text-slate-400', 'text-amber-500');
        } else {
            mediaRecorder.resume();
            isPaused = false;
            continuarTimer();
            setStatus('recording');
            if (iconPausar) iconPausar.className = 'ph-fill ph-pause text-3xl';
            if (elBtnPausar) elBtnPausar.classList.replace('text-amber-500', 'text-slate-400');
        }
    }

    function resetar() {
        if (elPlayerAudio) elPlayerAudio.src = '';
        if (elTimer) elTimer.textContent = '00:00';
        setStatus('ready');
    }

    window.Recording = {
        iniciar:      iniciar,
        parar:        parar,
        togglePause:  togglePause,
        resetar:      resetar,
        setStatus:    setStatus,
    };

})();
