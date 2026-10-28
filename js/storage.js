/**
 * USECLOUD - Storage & File Processor
 * Handles upload reading, conversions, export/import backups, downloads, ZIP archiving, and folder uploads.
 */

class UseCloudStorage {
    constructor() {
        this.uploadProgressCallback = null;
    }

    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    formatDate(timestamp) {
        if (!timestamp) return '-';
        const d = new Date(timestamp);
        return d.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    getFileCategory(mimeType, fileName = '') {
        const ext = fileName.split('.').pop().toLowerCase();
        if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            return 'image';
        }
        if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov'].includes(ext)) {
            return 'video';
        }
        if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
            return 'audio';
        }
        if (mimeType.includes('pdf') || ext === 'pdf') {
            return 'pdf';
        }
        if (['doc', 'docx', 'txt', 'rtf', 'odt', 'md'].includes(ext)) {
            return 'document';
        }
        if (['xls', 'xlsx', 'csv'].includes(ext)) {
            return 'spreadsheet';
        }
        if (['ppt', 'pptx'].includes(ext)) {
            return 'presentation';
        }
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            return 'archive';
        }
        if (['js', 'html', 'css', 'json', 'py', 'java', 'cpp', 'ts'].includes(ext)) {
            return 'code';
        }
        return 'other';
    }

    async processUploadedFile(file, folderId = null) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const dataUrl = e.target.result;
                const fileObj = {
                    id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    category: this.getFileCategory(file.type, file.name),
                    folderId: folderId,
                    data: dataUrl,
                    isTrash: false,
                    isStarred: false,
                    shared: false,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                resolve(fileObj);
            };

            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    downloadFile(fileObj) {
        if (!fileObj || !fileObj.data) return;
        const link = document.createElement('a');
        link.href = fileObj.data;
        link.download = fileObj.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ================= ZIP ARCHIVING =================
    async createZipArchive(files, zipFilename = 'usecloud-download.zip') {
        if (typeof JSZip === 'undefined') {
            window.useCloudUI.showToast('Pustaka kompresi ZIP belum siap.', 'error');
            return;
        }

        const zip = new JSZip();
        window.useCloudUI.showToast(`Menyiapkan ${files.length} berkas ke dalam ZIP...`, 'info');

        for (const f of files) {
            if (f.data) {
                // Split Base64 header if present
                const parts = f.data.split(',');
                if (parts.length === 2) {
                    zip.file(f.name, parts[1], { base64: true });
                } else {
                    zip.file(f.name, f.data);
                }
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.useCloudUI.showToast('ZIP berhasil diunduh!', 'success');
    }

    async downloadFolderAsZip(folderId) {
        const folder = await window.useCloudDB.getFolder(folderId);
        if (!folder) return;

        const allFiles = await window.useCloudDB.getAllFiles();
        const folderFiles = allFiles.filter(f => f.folderId === folderId && !f.isTrash);

        if (folderFiles.length === 0) {
            window.useCloudUI.showToast('Folder ini kosong, tidak ada berkas untuk di-ZIP.', 'info');
            return;
        }

        const zipName = `${folder.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
        await this.createZipArchive(folderFiles, zipName);
    }

    // ================= FOLDER UPLOAD (webkitRelativePath) =================
    async processFolderUpload(fileList, parentFolderId = null, onQueueProgress) {
        const folderMap = new Map(); // path -> folderId

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const relativePath = file.webkitRelativePath || file.name;
            const segments = relativePath.split('/');

            let currentParent = parentFolderId;

            // Create folders for path segments except the last (the file itself)
            let accumulatedPath = '';
            for (let s = 0; s < segments.length - 1; s++) {
                const folderName = segments[s];
                accumulatedPath += (s > 0 ? '/' : '') + folderName;

                if (!folderMap.has(accumulatedPath)) {
                    const newFolder = {
                        id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        name: folderName,
                        parentId: currentParent,
                        color: 'var(--primary)',
                        isTrash: false,
                        createdAt: Date.now()
                    };
                    await window.useCloudDB.saveFolder(newFolder);
                    folderMap.set(accumulatedPath, newFolder.id);
                    currentParent = newFolder.id;
                } else {
                    currentParent = folderMap.get(accumulatedPath);
                }
            }

            // Upload the file into currentParent
            const fileObj = await this.processUploadedFile(file, currentParent);
            await window.useCloudDB.saveFile(fileObj);

            if (onQueueProgress) {
                onQueueProgress(file.name, i + 1, fileList.length);
            }
        }
    }

    async exportBackupJSON() {
        const files = await window.useCloudDB.getAllFiles();
        const folders = await window.useCloudDB.getAllFolders();
        const backupData = {
            appName: 'USECLOUD',
            version: '2.5',
            exportedAt: new Date().toISOString(),
            folders: folders,
            files: files
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usecloud-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importBackupJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    if (json.folders && Array.isArray(json.folders)) {
                        for (const f of json.folders) {
                            await window.useCloudDB.saveFolder(f);
                        }
                    }
                    if (json.files && Array.isArray(json.files)) {
                        for (const file of json.files) {
                            await window.useCloudDB.saveFile(file);
                        }
                    }
                    resolve({ foldersCount: json.folders?.length || 0, filesCount: json.files?.length || 0 });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
        });
    }

    generateShareLink(item) {
        const mockDomain = window.location.origin || 'https://usecloud.app';
        return `${mockDomain}/share/${item.id}?token=${Math.random().toString(36).substring(2, 10)}`;
    }
}

// Global instance
window.useCloudStorage = new UseCloudStorage();
