/**
 * USECLOUD - Document & Media Previewer (Lightbox)
 * Previews images, videos, audio, PDF, text/code, and fallback details.
 */

class UseCloudPreviewer {
    constructor() {
        this.currentFileList = [];
        this.currentIndex = 0;
        this.zoomLevel = 1;
        this.rotationAngle = 0;
        this.modalEl = null;
    }

    init() {
        this.modalEl = document.getElementById('previewModal');
        this.setupKeyboardListeners();
    }

    open(fileObj, fileList = []) {
        if (!fileObj) return;

        this.currentFileList = fileList.length > 0 ? fileList : [fileObj];
        this.currentIndex = this.currentFileList.findIndex(f => f.id === fileObj.id);
        if (this.currentIndex === -1) this.currentIndex = 0;

        this.zoomLevel = 1;
        this.rotationAngle = 0;

        if (!this.modalEl) {
            this.modalEl = document.getElementById('previewModal');
        }

        this.renderCurrentItem();
        this.modalEl.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    close() {
        if (!this.modalEl) return;
        this.modalEl.classList.remove('open');
        document.body.style.overflow = '';

        // Stop any playing video/audio
        const media = this.modalEl.querySelector('video, audio');
        if (media) {
            media.pause();
            media.src = '';
        }
    }

    next() {
        if (this.currentFileList.length <= 1) return;
        this.currentIndex = (this.currentIndex + 1) % this.currentFileList.length;
        this.zoomLevel = 1;
        this.rotationAngle = 0;
        this.renderCurrentItem();
    }

    prev() {
        if (this.currentFileList.length <= 1) return;
        this.currentIndex = (this.currentIndex - 1 + this.currentFileList.length) % this.currentFileList.length;
        this.zoomLevel = 1;
        this.rotationAngle = 0;
        this.renderCurrentItem();
    }

    renderCurrentItem() {
        const file = this.currentFileList[this.currentIndex];
        if (!file) return;

        const titleEl = document.getElementById('previewTitle');
        const counterEl = document.getElementById('previewCounter');
        const bodyEl = document.getElementById('previewBody');
        const downloadBtn = document.getElementById('previewDownloadBtn');

        if (titleEl) titleEl.textContent = file.name;
        if (counterEl) counterEl.textContent = `${this.currentIndex + 1} / ${this.currentFileList.length}`;
        if (downloadBtn) {
            downloadBtn.onclick = () => window.useCloudStorage.downloadFile(file);
        }

        bodyEl.innerHTML = '';
        const cat = file.category || window.useCloudStorage.getFileCategory(file.type, file.name);

        switch (cat) {
            case 'image':
                const img = document.createElement('img');
                img.src = file.data;
                img.alt = file.name;
                img.id = 'previewActiveImg';
                img.style.transform = `scale(${this.zoomLevel}) rotate(${this.rotationAngle}deg)`;
                bodyEl.appendChild(img);
                break;

            case 'video':
                const video = document.createElement('video');
                video.src = file.data;
                video.controls = true;
                video.autoplay = true;
                video.className = 'max-w-4xl max-h-[80vh] rounded-xl shadow-2xl';
                bodyEl.appendChild(video);
                break;

            case 'audio':
                const audioCard = document.createElement('div');
                audioCard.className = 'bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-lg w-full text-center flex flex-col items-center gap-6 shadow-2xl';
                audioCard.innerHTML = `
                    <div class="w-24 h-24 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                        <i data-lucide="music" class="w-12 h-12"></i>
                    </div>
                    <div>
                        <h4 class="text-lg font-semibold text-white">${file.name}</h4>
                        <p class="text-sm text-slate-400 mt-1">${window.useCloudStorage.formatBytes(file.size)}</p>
                    </div>
                    <audio src="${file.data}" controls autoplay class="w-full mt-2"></audio>
                `;
                bodyEl.appendChild(audioCard);
                if (window.lucide) window.lucide.createIcons();
                break;

            case 'code':
            case 'document':
                let textContent = '';
                try {
                    // Try decoding Base64 if data is data URL
                    if (file.data.includes(',')) {
                        const base64 = file.data.split(',')[1];
                        textContent = decodeURIComponent(escape(atob(base64)));
                    } else {
                        textContent = file.data;
                    }
                } catch (e) {
                    textContent = 'Konten tidak dapat didekode sebagai teks.';
                }

                const codeBox = document.createElement('pre');
                codeBox.className = 'code-preview-container';
                codeBox.textContent = textContent;
                bodyEl.appendChild(codeBox);
                break;

            case 'pdf':
                const iframe = document.createElement('iframe');
                iframe.src = file.data;
                iframe.className = 'w-full max-w-5xl h-[85vh] rounded-xl border border-slate-800 shadow-2xl';
                bodyEl.appendChild(iframe);
                break;

            default:
                const fallbackCard = document.createElement('div');
                fallbackCard.className = 'bg-slate-900/90 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center flex flex-col items-center gap-5 shadow-2xl';
                fallbackCard.innerHTML = `
                    <div class="w-20 h-20 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                        <i data-lucide="file" class="w-10 h-10"></i>
                    </div>
                    <div>
                        <h4 class="text-lg font-semibold text-white break-all">${file.name}</h4>
                        <p class="text-sm text-slate-400 mt-1">${window.useCloudStorage.formatBytes(file.size)} &bull; ${file.type || 'Berkas'}</p>
                    </div>
                    <p class="text-xs text-slate-500">Pratinjau langsung tidak tersedia untuk format berkas ini.</p>
                    <button class="btn-new-item mt-2 text-sm" onclick="window.useCloudStorage.downloadFile(window.useCloudPreviewer.currentFileList[window.useCloudPreviewer.currentIndex])">
                        <i data-lucide="download" class="w-4 h-4"></i> Unduh Berkas
                    </button>
                `;
                bodyEl.appendChild(fallbackCard);
                if (window.lucide) window.lucide.createIcons();
                break;
        }

        // Re-init lucide icons if rendered
        if (window.lucide) window.lucide.createIcons();
    }

    zoomIn() {
        this.zoomLevel = Math.min(3, this.zoomLevel + 0.25);
        this.updateTransform();
    }

    zoomOut() {
        this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.25);
        this.updateTransform();
    }

    rotate() {
        this.rotationAngle = (this.rotationAngle + 90) % 360;
        this.updateTransform();
    }

    updateTransform() {
        const img = document.getElementById('previewActiveImg');
        if (img) {
            img.style.transform = `scale(${this.zoomLevel}) rotate(${this.rotationAngle}deg)`;
        }
    }

    setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            if (!this.modalEl || !this.modalEl.classList.contains('open')) return;

            if (e.key === 'Escape') {
                this.close();
            } else if (e.key === 'ArrowRight') {
                this.next();
            } else if (e.key === 'ArrowLeft') {
                this.prev();
            }
        });
    }
}

// Global instance
window.useCloudPreviewer = new UseCloudPreviewer();
