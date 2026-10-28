/**
 * USECLOUD - Main Application Controller
 * Coordinates DB, UI, Storage, Previewer, Event Handlers, and Global Shortcuts.
 */

class UseCloudApp {
    constructor() {
        this.currentView = 'my-cloud'; // 'my-cloud', 'shared', 'recent', 'starred', 'trash'
        this.currentFolderId = null;
        this.folderHistory = [];
        this.selectedFileIds = new Set();
        this.activeContextItem = null;
        this.activeContextType = null;
        this.viewMode = localStorage.getItem('usecloud_view_mode') || 'grid';
        this.activeFilter = 'all';
        this.searchQuery = '';
        this.detailsPanelOpen = localStorage.getItem('usecloud_details_open') !== 'false';
    }

    async init() {
        // Init DB
        await window.useCloudDB.init();
        window.useCloudPreviewer.init();

        // Restore Theme
        this.initTheme();

        // Bind DOM Events
        this.bindEvents();

        // Load Initial View
        await this.loadCurrentView();
        await this.updateStorageMeter();

        // Initialize Lucide Icons
        if (window.lucide) window.lucide.createIcons();
    }

    // ================= THEME & CUSTOMIZATION =================
    initTheme() {
        const isLight = localStorage.getItem('usecloud_theme_mode') === 'light';
        const colorPreset = localStorage.getItem('usecloud_color_preset') || 'emerald';

        if (isLight) document.body.classList.add('light-theme');
        document.body.setAttribute('data-color-preset', colorPreset);

        // Update Theme Icons / UI
        const themeIcon = document.getElementById('themeToggleBtn');
        if (themeIcon) {
            themeIcon.innerHTML = isLight ? '<i data-lucide="moon" class="w-5 h-5"></i>' : '<i data-lucide="sun" class="w-5 h-5"></i>';
        }
    }

    toggleTheme() {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('usecloud_theme_mode', isLight ? 'light' : 'dark');
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.innerHTML = isLight ? '<i data-lucide="moon" class="w-5 h-5"></i>' : '<i data-lucide="sun" class="w-5 h-5"></i>';
            if (window.lucide) window.lucide.createIcons();
        }
    }

    setColorPreset(preset) {
        document.body.setAttribute('data-color-preset', preset);
        localStorage.setItem('usecloud_color_preset', preset);
        window.useCloudUI.showToast(`Tema warna diubah ke ${preset}`, 'info');
    }

    // ================= DATA LOADING & ROUTING =================
    async loadCurrentView() {
        this.selectedFileIds.clear();
        this.updateFloatingActionBar();

        let allFiles = await window.useCloudDB.getAllFiles();
        let allFolders = await window.useCloudDB.getAllFolders();

        // Filter files based on view
        let filteredFiles = [];
        let filteredFolders = [];

        if (this.currentView === 'my-cloud') {
            filteredFolders = allFolders.filter(f => !f.isTrash && f.parentId === this.currentFolderId);
            filteredFiles = allFiles.filter(f => !f.isTrash && f.folderId === this.currentFolderId);
        } else if (this.currentView === 'starred') {
            filteredFolders = [];
            filteredFiles = allFiles.filter(f => !f.isTrash && f.isStarred);
        } else if (this.currentView === 'recent') {
            filteredFolders = [];
            filteredFiles = allFiles.filter(f => !f.isTrash).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        } else if (this.currentView === 'trash') {
            filteredFolders = allFolders.filter(f => f.isTrash);
            filteredFiles = allFiles.filter(f => f.isTrash);
        } else if (this.currentView === 'shared') {
            filteredFolders = [];
            filteredFiles = allFiles.filter(f => !f.isTrash && f.shared);
        }

        // Apply Search
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            filteredFiles = filteredFiles.filter(f => f.name.toLowerCase().includes(q));
            filteredFolders = filteredFolders.filter(f => f.name.toLowerCase().includes(q));
        }

        // Apply Category Filter
        if (this.activeFilter !== 'all') {
            filteredFiles = filteredFiles.filter(f => f.category === this.activeFilter);
        }

        // Render Breadcrumbs
        let currentFolder = null;
        if (this.currentFolderId) {
            currentFolder = await window.useCloudDB.getFolder(this.currentFolderId);
        }
        window.useCloudUI.renderBreadcrumbs(currentFolder, this.folderHistory, (folderId) => this.navigateToFolder(folderId));

        // Render Quick Access (Suggested)
        if (this.currentView === 'my-cloud' && !this.currentFolderId && !this.searchQuery) {
            window.useCloudUI.renderQuickAccess(allFiles.filter(f => !f.isTrash), (file, list) => window.useCloudPreviewer.open(file, list));
        } else {
            const qaSection = document.getElementById('quickAccessSection');
            if (qaSection) qaSection.style.display = 'none';
        }

        // Render Folders
        window.useCloudUI.renderFolders(
            filteredFolders,
            (folderId) => this.openFolder(folderId),
            (e, folder, type) => this.openContextMenu(e, folder, type)
        );

        // Render Files based on View Mode (Grid / List)
        const onSelect = (file, isMulti) => this.handleFileSelection(file, isMulti);
        const onPreview = (file, list) => window.useCloudPreviewer.open(file, list);
        const onContextMenu = (e, file, type) => this.openContextMenu(e, file, type);

        if (this.viewMode === 'list') {
            window.useCloudUI.renderFilesList(filteredFiles, this.selectedFileIds, onSelect, onPreview, onContextMenu);
        } else {
            window.useCloudUI.renderFilesGrid(filteredFiles, this.selectedFileIds, onSelect, onPreview, onContextMenu);
        }

        // Update Nav UI
        this.updateNavUI();
    }

    async updateStorageMeter() {
        const stats = await window.useCloudDB.calculateStorage();
        window.useCloudUI.renderStorageMeter(stats);
    }

    updateNavUI() {
        document.querySelectorAll('.sidebar-link').forEach(link => {
            const view = link.getAttribute('data-view');
            link.classList.toggle('active', view === this.currentView);
        });

        // Toggle Trash Bar
        const trashBar = document.getElementById('trashActionBar');
        if (trashBar) {
            trashBar.style.display = this.currentView === 'trash' ? 'flex' : 'none';
        }
    }

    // ================= FOLDER NAVIGATION =================
    async openFolder(folderId) {
        if (!folderId) return;
        const folder = await window.useCloudDB.getFolder(folderId);
        if (folder) {
            if (this.currentFolderId) {
                const prevFolder = await window.useCloudDB.getFolder(this.currentFolderId);
                if (prevFolder && !this.folderHistory.some(f => f.id === prevFolder.id)) {
                    this.folderHistory.push(prevFolder);
                }
            }
            this.currentFolderId = folderId;
            await this.loadCurrentView();
        }
    }

    async navigateToFolder(folderId) {
        if (folderId === null) {
            this.currentFolderId = null;
            this.folderHistory = [];
        } else {
            const idx = this.folderHistory.findIndex(f => f.id === folderId);
            if (idx !== -1) {
                this.folderHistory = this.folderHistory.slice(0, idx);
            }
            this.currentFolderId = folderId;
        }
        await this.loadCurrentView();
    }

    // ================= FILE SELECTION =================
    handleFileSelection(file, isMulti = false) {
        if (isMulti) {
            if (this.selectedFileIds.has(file.id)) {
                this.selectedFileIds.delete(file.id);
            } else {
                this.selectedFileIds.add(file.id);
            }
        } else {
            this.selectedFileIds.clear();
            this.selectedFileIds.add(file.id);
        }

        // Re-render UI highlight
        document.querySelectorAll('.file-card, .file-row').forEach(el => {
            const id = el.getAttribute('data-id');
            el.classList.toggle('selected', this.selectedFileIds.has(id));
        });

        this.updateFloatingActionBar();

        // Update Details Panel
        window.useCloudUI.renderDetailsPanel(file, 'file');
    }

    updateFloatingActionBar() {
        const bar = document.getElementById('floatingActionBar');
        const countEl = document.getElementById('selectedItemsCount');
        if (!bar || !countEl) return;

        const count = this.selectedFileIds.size;
        countEl.textContent = `${count} item dipilih`;

        if (count > 0) {
            bar.classList.add('visible');
        } else {
            bar.classList.remove('visible');
        }
    }

    // ================= CONTEXT MENU =================
    openContextMenu(e, item, type = 'file') {
        this.activeContextItem = item;
        this.activeContextType = type;

        const menu = document.getElementById('contextMenu');
        if (!menu) return;

        // Populate context menu item states
        const starText = menu.querySelector('#cmStarText');
        if (starText) {
            starText.textContent = item.isStarred ? 'Hapus Bintang' : 'Beri Bintang';
        }

        // Show/hide restore if trash
        const restoreItem = menu.querySelector('#cmRestore');
        const deleteItem = menu.querySelector('#cmDelete');
        if (restoreItem && deleteItem) {
            restoreItem.style.display = item.isTrash ? 'flex' : 'none';
            deleteItem.querySelector('span').textContent = item.isTrash ? 'Hapus Permanen' : 'Pindahkan ke Sampah';
        }

        // Position menu inside viewport
        menu.style.display = 'flex';
        const menuWidth = 230;
        const menuHeight = 320;
        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
    }

    closeContextMenu() {
        const menu = document.getElementById('contextMenu');
        if (menu) menu.style.display = 'none';
    }

    // ================= ACTIONS =================
    async createNewFolder(name) {
        if (!name || !name.trim()) return;
        const newFolder = {
            id: 'f_' + Date.now(),
            name: name.trim(),
            parentId: this.currentFolderId,
            color: '#0d9488',
            isTrash: false,
            createdAt: Date.now()
        };
        await window.useCloudDB.saveFolder(newFolder);
        await window.useCloudDB.logActivity('Buat Folder', `Folder "${name}" dibuat`, 'folder-plus');
        window.useCloudUI.showToast(`Folder "${name}" berhasil dibuat`, 'success');
        await this.loadCurrentView();
    }

    async uploadFiles(fileList) {
        if (!fileList || fileList.length === 0) return;

        window.useCloudUI.showToast(`Mengunggah ${fileList.length} berkas...`, 'info');
        let successCount = 0;

        for (const file of fileList) {
            try {
                const fileObj = await window.useCloudStorage.processUploadedFile(file, this.currentFolderId);
                await window.useCloudDB.saveFile(fileObj);
                await window.useCloudDB.logActivity('Unggah Berkas', `Berkas "${file.name}" diunggah`, 'upload-cloud');
                successCount++;
            } catch (err) {
                console.error('Upload failed:', err);
            }
        }

        window.useCloudUI.showToast(`${successCount} berkas berhasil disimpan ke UseCloud!`, 'success');
        await this.loadCurrentView();
        await this.updateStorageMeter();
    }

    async deleteActiveItem() {
        if (!this.activeContextItem) return;

        const item = this.activeContextItem;
        const isTrash = item.isTrash;

        if (this.activeContextType === 'file') {
            await window.useCloudDB.deleteFile(item.id, isTrash);
            await window.useCloudDB.logActivity(isTrash ? 'Hapus Permanen' : 'Ke Sampah', `Berkas "${item.name}" dihapus`, 'trash-2');
        } else {
            await window.useCloudDB.deleteFolder(item.id, isTrash);
            await window.useCloudDB.logActivity(isTrash ? 'Hapus Permanen' : 'Ke Sampah', `Folder "${item.name}" dihapus`, 'trash-2');
        }

        window.useCloudUI.showToast(isTrash ? 'Item dihapus permanen' : 'Item dipindahkan ke sampah', 'info');
        this.closeContextMenu();
        await this.loadCurrentView();
        await this.updateStorageMeter();
    }

    async restoreActiveItem() {
        if (!this.activeContextItem) return;
        const item = this.activeContextItem;

        await window.useCloudDB.restoreItem(item.id, this.activeContextType);
        await window.useCloudDB.logActivity('Pulihkan', `Item "${item.name}" dipulihkan`, 'rotate-ccw');
        window.useCloudUI.showToast(`Item "${item.name}" dipulihkan`, 'success');
        this.closeContextMenu();
        await this.loadCurrentView();
    }

    async toggleStarActiveItem() {
        if (!this.activeContextItem || this.activeContextType !== 'file') return;
        const isStarred = await window.useCloudDB.toggleStar(this.activeContextItem.id);
        window.useCloudUI.showToast(isStarred ? 'Ditambahkan ke berbintang' : 'Dihapus dari berbintang', 'info');
        this.closeContextMenu();
        await this.loadCurrentView();
    }

    async emptyTrash() {
        if (!confirm('Apakah Faari yakin ingin mengosongkan seluruh sampah secara permanen?')) return;

        const files = await window.useCloudDB.getAllFiles();
        const folders = await window.useCloudDB.getAllFolders();

        for (const f of files.filter(f => f.isTrash)) {
            await window.useCloudDB.deleteFile(f.id, true);
        }
        for (const fold of folders.filter(f => f.isTrash)) {
            await window.useCloudDB.deleteFolder(fold.id, true);
        }

        await window.useCloudDB.logActivity('Kosongkan Sampah', 'Seluruh isi sampah dibersihkan', 'trash');
        window.useCloudUI.showToast('Sampah berhasil dikosongkan', 'success');
        await this.loadCurrentView();
        await this.updateStorageMeter();
    }

    // ================= EVENT BINDINGS =================
    bindEvents() {
        // "+ Baru" Dropdown Toggle
        const btnNew = document.getElementById('btnNewItem');
        const dropdownNew = document.getElementById('dropdownNewItem');
        if (btnNew && dropdownNew) {
            btnNew.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownNew.classList.toggle('open');
            });
        }

        // Global click to close dropdowns and context menus
        window.addEventListener('click', () => {
            if (dropdownNew) dropdownNew.classList.remove('open');
            this.closeContextMenu();
            const profileDrop = document.getElementById('profileDropdown');
            if (profileDrop) profileDrop.classList.remove('open');
            const themeDrop = document.getElementById('themeDropdown');
            if (themeDrop) themeDrop.classList.remove('open');
        });

        // New Folder Modal
        document.getElementById('actionNewFolder')?.addEventListener('click', () => {
            this.openModal('newFolderModal');
            document.getElementById('newFolderNameInput')?.focus();
        });

        document.getElementById('submitNewFolderBtn')?.addEventListener('click', () => {
            const input = document.getElementById('newFolderNameInput');
            if (input && input.value.trim()) {
                this.createNewFolder(input.value.trim());
                input.value = '';
                this.closeModal('newFolderModal');
            }
        });

        // File Upload Trigger
        const fileInput = document.getElementById('fileUploadInput');
        document.getElementById('actionUploadFile')?.addEventListener('click', () => {
            fileInput?.click();
        });

        fileInput?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.uploadFiles(Array.from(e.target.files));
                e.target.value = '';
            }
        });

        // Backup Export / Import
        document.getElementById('actionExportBackup')?.addEventListener('click', () => {
            window.useCloudStorage.exportBackupJSON();
            window.useCloudUI.showToast('Cadangan berhasil diekspor!', 'success');
        });

        const backupInput = document.getElementById('backupFileInput');
        document.getElementById('actionImportBackup')?.addEventListener('click', () => {
            backupInput?.click();
        });

        backupInput?.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                try {
                    const res = await window.useCloudStorage.importBackupJSON(e.target.files[0]);
                    window.useCloudUI.showToast(`Berhasil memulihkan ${res.foldersCount} folder & ${res.filesCount} berkas!`, 'success');
                    await this.loadCurrentView();
                    await this.updateStorageMeter();
                } catch (err) {
                    window.useCloudUI.showToast('Gagal memuat file cadangan.', 'error');
                }
                e.target.value = '';
            }
        });

        // Sidebar Navigation
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                if (view) {
                    this.currentView = view;
                    this.currentFolderId = null;
                    this.folderHistory = [];
                    await this.loadCurrentView();
                }
            });
        });

        // Omnibox Search
        const searchInput = document.getElementById('omniboxSearchInput');
        searchInput?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.loadCurrentView();
        });

        // Filter Chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.activeFilter = chip.getAttribute('data-filter') || 'all';
                this.loadCurrentView();
            });
        });

        // View Mode Toggle (Grid / List)
        document.getElementById('toggleViewModeBtn')?.addEventListener('click', () => {
            this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
            localStorage.setItem('usecloud_view_mode', this.viewMode);
            this.loadCurrentView();
            const btn = document.getElementById('toggleViewModeBtn');
            if (btn) {
                btn.innerHTML = this.viewMode === 'grid' ? '<i data-lucide="list" class="w-5 h-5"></i>' : '<i data-lucide="layout-grid" class="w-5 h-5"></i>';
                if (window.lucide) window.lucide.createIcons();
            }
        });

        // Details Panel Toggle
        document.getElementById('toggleDetailsBtn')?.addEventListener('click', () => {
            const panel = document.getElementById('detailsPanel');
            if (panel) {
                this.detailsPanelOpen = !this.detailsPanelOpen;
                panel.classList.toggle('hidden', !this.detailsPanelOpen);
                localStorage.setItem('usecloud_details_open', this.detailsPanelOpen);
            }
        });

        // Theme Toggle Button
        document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
            this.toggleTheme();
        });

        // Details Panel Tabs (Rincian vs Aktivitas)
        document.querySelectorAll('.details-tab-btn').forEach(tab => {
            tab.addEventListener('click', async () => {
                document.querySelectorAll('.details-tab-btn').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.getAttribute('data-tab');

                const rincianContent = document.getElementById('detailsTabRincian');
                const activityContent = document.getElementById('detailsTabActivity');

                if (target === 'activity') {
                    if (rincianContent) rincianContent.style.display = 'none';
                    if (activityContent) activityContent.style.display = 'block';
                    const acts = await window.useCloudDB.getRecentActivities();
                    window.useCloudUI.renderActivities(acts);
                } else {
                    if (rincianContent) rincianContent.style.display = 'block';
                    if (activityContent) activityContent.style.display = 'none';
                }
            });
        });

        // Empty Trash Button
        document.getElementById('btnEmptyTrash')?.addEventListener('click', () => this.emptyTrash());

        // Context Menu Action Items
        document.getElementById('cmPreview')?.addEventListener('click', () => {
            if (this.activeContextItem && this.activeContextType === 'file') {
                window.useCloudPreviewer.open(this.activeContextItem);
            }
            this.closeContextMenu();
        });

        document.getElementById('cmDownload')?.addEventListener('click', () => {
            if (this.activeContextItem && this.activeContextType === 'file') {
                window.useCloudStorage.downloadFile(this.activeContextItem);
            }
            this.closeContextMenu();
        });

        document.getElementById('cmStar')?.addEventListener('click', () => this.toggleStarActiveItem());
        document.getElementById('cmDelete')?.addEventListener('click', () => this.deleteActiveItem());
        document.getElementById('cmRestore')?.addEventListener('click', () => this.restoreActiveItem());

        document.getElementById('cmShare')?.addEventListener('click', () => {
            if (this.activeContextItem) {
                const link = window.useCloudStorage.generateShareLink(this.activeContextItem);
                navigator.clipboard?.writeText(link);
                window.useCloudUI.showToast('Tautan berbagi disalin ke clipboard!', 'success');
            }
            this.closeContextMenu();
        });

        document.getElementById('cmDetails')?.addEventListener('click', () => {
            if (this.activeContextItem) {
                const panel = document.getElementById('detailsPanel');
                if (panel) panel.classList.remove('hidden');
                window.useCloudUI.renderDetailsPanel(this.activeContextItem, this.activeContextType);
            }
            this.closeContextMenu();
        });

        // Drag and Drop Zone
        const dropOverlay = document.getElementById('dropzoneOverlay');
        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (dropOverlay) dropOverlay.classList.add('active');
        });

        window.addEventListener('dragover', (e) => e.preventDefault());

        window.addEventListener('dragleave', (e) => {
            if (e.clientX <= 0 || e.clientY <= 0) {
                if (dropOverlay) dropOverlay.classList.remove('active');
            }
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dropOverlay) dropOverlay.classList.remove('active');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.uploadFiles(Array.from(e.dataTransfer.files));
            }
        });

        // Floating Action Bar Events
        document.getElementById('btnFabDownloadAll')?.addEventListener('click', async () => {
            const files = await window.useCloudDB.getAllFiles();
            for (const id of this.selectedFileIds) {
                const f = files.find(item => item.id === id);
                if (f) window.useCloudStorage.downloadFile(f);
            }
        });

        document.getElementById('btnFabDeleteAll')?.addEventListener('click', async () => {
            for (const id of this.selectedFileIds) {
                await window.useCloudDB.deleteFile(id, this.currentView === 'trash');
            }
            window.useCloudUI.showToast(`${this.selectedFileIds.size} berkas dihapus`, 'info');
            this.selectedFileIds.clear();
            await this.loadCurrentView();
            await this.updateStorageMeter();
        });

        document.getElementById('btnFabClearSelection')?.addEventListener('click', () => {
            this.selectedFileIds.clear();
            this.updateFloatingActionBar();
            document.querySelectorAll('.file-card, .file-row').forEach(el => el.classList.remove('selected'));
        });

        // Global Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'Escape') {
                this.closeAllModals();
                this.closeContextMenu();
            } else if (e.key === 'Delete') {
                if (this.selectedFileIds.size > 0) {
                    document.getElementById('btnFabDeleteAll')?.click();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                document.querySelectorAll('.file-card, .file-row').forEach(el => {
                    const id = el.getAttribute('data-id');
                    if (id) this.selectedFileIds.add(id);
                    el.classList.add('selected');
                });
                this.updateFloatingActionBar();
            }
        });
    }

    openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('open');
    }

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('open');
    }

    closeAllModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    }
}

// Instantiate and start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.useCloudApp = new UseCloudApp();
    window.useCloudApp.init();
});
