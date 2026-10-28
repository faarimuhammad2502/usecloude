/**
 * USECLOUD - Database Layer (IndexedDB & LocalStorage)
 * Manages folders, files, trashed items, starred items, activity logs, folder colors, and PIN locks.
 */

class UseCloudDB {
    constructor() {
        this.dbName = 'UseCloud_DB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Files store
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'id' });
                    fileStore.createIndex('folderId', 'folderId', { unique: false });
                    fileStore.createIndex('isTrash', 'isTrash', { unique: false });
                    fileStore.createIndex('isStarred', 'isStarred', { unique: false });
                    fileStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Folders store
                if (!db.objectStoreNames.contains('folders')) {
                    const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
                    folderStore.createIndex('parentId', 'parentId', { unique: false });
                    folderStore.createIndex('isTrash', 'isTrash', { unique: false });
                }

                // Activity Log store
                if (!db.objectStoreNames.contains('activities')) {
                    const activityStore = db.createObjectStore('activities', { keyPath: 'id', autoIncrement: true });
                    activityStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this.seedDefaults();
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async seedDefaults() {
        const folders = await this.getAllFolders();
        if (folders.length === 0) {
            const defaultFolders = [
                { id: 'f_docs', name: 'Dokumen Penting', parentId: null, color: '#6366f1', isLocked: false, isTrash: false, createdAt: Date.now() },
                { id: 'f_photos', name: 'Foto & Kenangan', parentId: null, color: '#06b6d4', isLocked: false, isTrash: false, createdAt: Date.now() },
                { id: 'f_work', name: 'Project Kerja', parentId: null, color: '#8b5cf6', isLocked: false, isTrash: false, createdAt: Date.now() }
            ];
            for (const f of defaultFolders) {
                await this.saveFolder(f);
            }
            await this.logActivity('Inisialisasi', 'Folder dasar berhasil disiapkan', 'sparkles');
        }
    }

    // ================= FOLDER OPERATIONS =================
    async getAllFolders() {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['folders'], 'readonly');
            const store = tx.objectStore('folders');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async getFolder(id) {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['folders'], 'readonly');
            const store = tx.objectStore('folders');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }

    async saveFolder(folder) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['folders'], 'readwrite');
            const store = tx.objectStore('folders');
            const req = store.put(folder);
            req.onsuccess = () => resolve(folder);
            req.onerror = (e) => reject(e);
        });
    }

    async updateFolderColor(id, color) {
        const folder = await this.getFolder(id);
        if (folder) {
            folder.color = color;
            await this.saveFolder(folder);
            return true;
        }
        return false;
    }

    async setFolderPin(id, pin) {
        const folder = await this.getFolder(id);
        if (folder) {
            folder.isLocked = !!pin;
            folder.pin = pin || null;
            await this.saveFolder(folder);
            return true;
        }
        return false;
    }

    async deleteFolder(id, permanent = false) {
        if (permanent) {
            return new Promise((resolve) => {
                const tx = this.db.transaction(['folders'], 'readwrite');
                const store = tx.objectStore('folders');
                store.delete(id);
                tx.oncomplete = () => resolve(true);
            });
        } else {
            const folder = await this.getFolder(id);
            if (folder) {
                folder.isTrash = true;
                folder.trashedAt = Date.now();
                await this.saveFolder(folder);
            }
        }
    }

    // ================= FILE OPERATIONS =================
    async getAllFiles() {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['files'], 'readonly');
            const store = tx.objectStore('files');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async getFile(id) {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['files'], 'readonly');
            const store = tx.objectStore('files');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }

    async saveFile(fileObj) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['files'], 'readwrite');
            const store = tx.objectStore('files');
            const req = store.put(fileObj);
            req.onsuccess = () => resolve(fileObj);
            req.onerror = (e) => reject(e);
        });
    }

    async deleteFile(id, permanent = false) {
        if (permanent) {
            return new Promise((resolve) => {
                const tx = this.db.transaction(['files'], 'readwrite');
                const store = tx.objectStore('files');
                store.delete(id);
                tx.oncomplete = () => resolve(true);
            });
        } else {
            const file = await this.getFile(id);
            if (file) {
                file.isTrash = true;
                file.trashedAt = Date.now();
                await this.saveFile(file);
            }
        }
    }

    async restoreItem(id, type = 'file') {
        if (type === 'file') {
            const file = await this.getFile(id);
            if (file) {
                file.isTrash = false;
                delete file.trashedAt;
                await this.saveFile(file);
            }
        } else {
            const folder = await this.getFolder(id);
            if (folder) {
                folder.isTrash = false;
                delete folder.trashedAt;
                await this.saveFolder(folder);
            }
        }
    }

    async toggleStar(id) {
        const file = await this.getFile(id);
        if (file) {
            file.isStarred = !file.isStarred;
            await this.saveFile(file);
            return file.isStarred;
        }
        return false;
    }

    // ================= ACTIVITY LOGS =================
    async logActivity(action, description, icon = 'file') {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['activities'], 'readwrite');
            const store = tx.objectStore('activities');
            const activity = {
                action,
                description,
                icon,
                timestamp: Date.now()
            };
            store.add(activity);
            tx.oncomplete = () => resolve(true);
        });
    }

    async getRecentActivities(limit = 15) {
        return new Promise((resolve) => {
            const tx = this.db.transaction(['activities'], 'readonly');
            const store = tx.objectStore('activities');
            const req = store.getAll();
            req.onsuccess = () => {
                const results = req.result || [];
                results.sort((a, b) => b.timestamp - a.timestamp);
                resolve(results.slice(0, limit));
            };
            req.onerror = () => resolve([]);
        });
    }

    // ================= REAL STORAGE ESTIMATION =================
    async calculateStorage() {
        const files = await this.getAllFiles();
        let totalBytes = 0;
        let countByType = {
            images: 0,
            videos: 0,
            documents: 0,
            audio: 0,
            others: 0
        };

        files.forEach(f => {
            const size = f.size || 0;
            totalBytes += size;

            const mime = f.type || '';
            if (mime.startsWith('image/')) countByType.images += size;
            else if (mime.startsWith('video/')) countByType.videos += size;
            else if (mime.startsWith('audio/')) countByType.audio += size;
            else if (mime.includes('pdf') || mime.includes('word') || mime.includes('text') || mime.includes('document')) countByType.documents += size;
            else countByType.others += size;
        });

        // Query actual disk storage capability from browser
        let allocatedQuota = 15 * 1024 * 1024 * 1024; // Default simulated 15 GB
        let isRealBrowserQuota = false;
        let isPersisted = false;

        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                if (estimate.quota && estimate.quota > 0) {
                    allocatedQuota = estimate.quota;
                    isRealBrowserQuota = true;
                }
            } catch (err) {
                console.warn('Storage estimate unavailable:', err);
            }
        }

        if (navigator.storage && navigator.storage.persisted) {
            try {
                isPersisted = await navigator.storage.persisted();
            } catch (err) {
                isPersisted = false;
            }
        }

        return {
            usedBytes: totalBytes,
            quotaBytes: allocatedQuota,
            isRealBrowserQuota: isRealBrowserQuota,
            isPersisted: isPersisted,
            percentage: Math.min(100, ((totalBytes / allocatedQuota) * 100).toFixed(2)),
            countByType
        };
    }

    async requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            return await navigator.storage.persist();
        }
        return false;
    }
}

// Global instance
window.useCloudDB = new UseCloudDB();
