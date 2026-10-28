/**
 * USECLOUD - User Interface Renderer
 * Handles rendering of folders, files (grid/list), breadcrumbs, details panel, storage meter, and toasts.
 * Optimized for seamless Light Mode and Dark Mode rendering.
 */

class UseCloudUI {
    constructor() {
        this.selectedItem = null;
    }

    renderBreadcrumbs(currentFolder, folderHistory, onNavigate) {
        const container = document.getElementById('breadcrumbContainer');
        if (!container) return;

        let html = `
            <div class="breadcrumb-item cursor-pointer" id="bcRoot">
                <span>Cloud Saya</span>
            </div>
        `;

        folderHistory.forEach((folder) => {
            html += `
                <i data-lucide="chevron-right" class="w-4 h-4 app-text-muted"></i>
                <div class="breadcrumb-item cursor-pointer" data-folder-id="${folder.id}">
                    <span>${folder.name}</span>
                </div>
            `;
        });

        if (currentFolder) {
            html += `
                <i data-lucide="chevron-right" class="w-4 h-4 app-text-muted"></i>
                <div class="breadcrumb-item active">
                    <span>${currentFolder.name}</span>
                </div>
            `;
        }

        container.innerHTML = html;

        // Bind navigation events
        document.getElementById('bcRoot')?.addEventListener('click', () => onNavigate(null));
        container.querySelectorAll('[data-folder-id]').forEach(el => {
            el.addEventListener('click', () => onNavigate(el.getAttribute('data-folder-id')));
        });

        if (window.lucide) window.lucide.createIcons();
    }

    renderFolders(folders, onOpenFolder, onContextMenu) {
        const container = document.getElementById('foldersGrid');
        const section = document.getElementById('foldersSection');
        if (!container || !section) return;

        if (folders.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = '';

        folders.forEach(folder => {
            const card = document.createElement('div');
            card.className = 'folder-card group';
            card.setAttribute('data-id', folder.id);

            const folderColor = folder.color || 'var(--primary)';

            card.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background-color: var(--primary-light); color: var(--primary);">
                        <i data-lucide="folder" class="w-5 h-5 fill-current"></i>
                    </div>
                    <span class="font-medium text-sm app-text-main truncate group-hover:text-primary transition-colors">${folder.name}</span>
                </div>
                <button class="p-1.5 rounded-lg app-text-muted hover:text-primary hover:bg-slate-500/10 folder-menu-btn" title="Opsi Folder">
                    <i data-lucide="more-vertical" class="w-4 h-4"></i>
                </button>
            `;

            // Open on single click
            card.addEventListener('click', (e) => {
                if (e.target.closest('.folder-menu-btn')) return;
                onOpenFolder(folder.id);
            });

            // Context menu on right click
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                onContextMenu(e, folder, 'folder');
            });

            // Context menu on button click
            const menuBtn = card.querySelector('.folder-menu-btn');
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onContextMenu(e, folder, 'folder');
            });

            container.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    renderQuickAccess(files, onPreviewFile) {
        const container = document.getElementById('quickAccessList');
        const section = document.getElementById('quickAccessSection');
        if (!container || !section) return;

        const recentFiles = files.slice(0, 6);
        if (recentFiles.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = '';

        recentFiles.forEach(file => {
            const card = document.createElement('div');
            card.className = 'app-card min-w-[200px] max-w-[220px] p-3 flex flex-col gap-2 hover:border-indigo-500/40 cursor-pointer shadow-sm';
            
            let iconHtml = '<i data-lucide="file" class="w-4 h-4 text-indigo-500"></i>';
            if (file.category === 'image') iconHtml = '<i data-lucide="image" class="w-4 h-4 text-emerald-500"></i>';
            else if (file.category === 'video') iconHtml = '<i data-lucide="film" class="w-4 h-4 text-purple-500"></i>';
            else if (file.category === 'pdf') iconHtml = '<i data-lucide="file-text" class="w-4 h-4 text-rose-500"></i>';

            let thumbHtml = '';
            if (file.category === 'image' && file.data) {
                thumbHtml = `<div class="h-24 w-full rounded-lg overflow-hidden bg-slate-500/10 flex items-center justify-center">
                    <img src="${file.data}" alt="${file.name}" class="w-full h-full object-cover">
                </div>`;
            } else {
                thumbHtml = `<div class="h-24 w-full rounded-lg bg-slate-500/10 flex items-center justify-center app-text-muted">
                    <i data-lucide="file-check" class="w-8 h-8 opacity-40"></i>
                </div>`;
            }

            card.innerHTML = `
                <div class="flex items-center gap-2">
                    ${iconHtml}
                    <span class="text-xs font-medium app-text-main truncate">${file.name}</span>
                </div>
                ${thumbHtml}
            `;

            card.addEventListener('click', () => onPreviewFile(file, recentFiles));
            container.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    renderFilesGrid(files, selectedIds, onSelect, onPreview, onContextMenu) {
        const container = document.getElementById('filesContainer');
        if (!container) return;

        container.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';
        container.innerHTML = '';

        if (files.length === 0) {
            container.className = 'w-full py-20 flex flex-col items-center justify-center text-center';
            container.innerHTML = `
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style="background-color: var(--primary-light); color: var(--primary);">
                    <i data-lucide="folder-open" class="w-8 h-8"></i>
                </div>
                <h4 class="text-base font-semibold app-text-main">Folder ini masih kosong</h4>
                <p class="text-sm app-text-muted mt-1 max-w-sm">Tarik dan jatuhkan berkas ke sini, atau klik tombol "+ Baru" untuk mengunggah.</p>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        files.forEach(file => {
            const isSelected = selectedIds.has(file.id);
            const card = document.createElement('div');
            card.className = `file-card ${isSelected ? 'selected' : ''}`;
            card.setAttribute('data-id', file.id);

            let thumbContent = '';
            if (file.category === 'image' && file.data) {
                thumbContent = `<img src="${file.data}" alt="${file.name}">`;
            } else {
                let iconName = 'file';
                let iconColor = 'text-indigo-500';
                if (file.category === 'video') { iconName = 'film'; iconColor = 'text-purple-500'; }
                else if (file.category === 'audio') { iconName = 'music'; iconColor = 'text-pink-500'; }
                else if (file.category === 'pdf') { iconName = 'file-text'; iconColor = 'text-rose-500'; }
                else if (file.category === 'code') { iconName = 'code'; iconColor = 'text-amber-500'; }
                else if (file.category === 'spreadsheet') { iconName = 'table'; iconColor = 'text-emerald-500'; }

                thumbContent = `<div class="${iconColor} flex items-center justify-center w-full h-full"><i data-lucide="${iconName}" class="w-12 h-12"></i></div>`;
            }

            card.innerHTML = `
                <div class="file-thumbnail-container">
                    ${thumbContent}
                    ${file.isStarred ? '<div class="absolute top-2 left-2 text-amber-400 drop-shadow"><i data-lucide="star" class="w-4 h-4 fill-current"></i></div>' : ''}
                </div>
                <div class="p-3 flex items-center justify-between gap-2 border-t app-border">
                    <div class="overflow-hidden">
                        <p class="text-sm font-medium app-text-main truncate" title="${file.name}">${file.name}</p>
                        <p class="text-xs app-text-muted mt-0.5">${window.useCloudStorage.formatBytes(file.size)}</p>
                    </div>
                    <button class="p-1 rounded-md app-text-muted hover:text-primary hover:bg-slate-500/10 file-menu-btn" title="Opsi">
                        <i data-lucide="more-vertical" class="w-4 h-4"></i>
                    </button>
                </div>
            `;

            // Selection
            card.addEventListener('click', (e) => {
                if (e.target.closest('.file-menu-btn')) return;
                onSelect(file, e.ctrlKey || e.metaKey || e.shiftKey);
            });

            // Double click to preview
            card.addEventListener('dblclick', () => {
                onPreview(file, files);
            });

            // Context menu
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                onContextMenu(e, file, 'file');
            });

            const menuBtn = card.querySelector('.file-menu-btn');
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onContextMenu(e, file, 'file');
            });

            container.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    renderFilesList(files, selectedIds, onSelect, onPreview, onContextMenu) {
        const container = document.getElementById('filesContainer');
        if (!container) return;

        container.className = 'w-full overflow-x-auto';
        container.innerHTML = '';

        if (files.length === 0) {
            container.className = 'w-full py-20 flex flex-col items-center justify-center text-center';
            container.innerHTML = `
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style="background-color: var(--primary-light); color: var(--primary);">
                    <i data-lucide="folder-open" class="w-8 h-8"></i>
                </div>
                <h4 class="text-base font-semibold app-text-main">Folder ini masih kosong</h4>
                <p class="text-sm app-text-muted mt-1 max-w-sm">Tarik dan jatuhkan berkas ke sini, atau klik tombol "+ Baru" untuk mengunggah.</p>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const table = document.createElement('table');
        table.className = 'file-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th style="width: 45%;">Nama</th>
                    <th style="width: 20%;">Pemilik</th>
                    <th style="width: 20%;">Terakhir Diubah</th>
                    <th style="width: 10%;">Ukuran</th>
                    <th style="width: 5%;"></th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        files.forEach(file => {
            const isSelected = selectedIds.has(file.id);
            const tr = document.createElement('tr');
            tr.className = `file-row ${isSelected ? 'selected' : ''}`;
            tr.setAttribute('data-id', file.id);

            let iconName = 'file';
            let iconColor = 'text-indigo-500';
            if (file.category === 'image') { iconName = 'image'; iconColor = 'text-emerald-500'; }
            else if (file.category === 'video') { iconName = 'film'; iconColor = 'text-purple-500'; }
            else if (file.category === 'audio') { iconName = 'music'; iconColor = 'text-pink-500'; }
            else if (file.category === 'pdf') { iconName = 'file-text'; iconColor = 'text-rose-500'; }

            tr.innerHTML = `
                <td>
                    <div class="flex items-center gap-3">
                        <div class="${iconColor}">
                            <i data-lucide="${iconName}" class="w-4 h-4"></i>
                        </div>
                        <span class="font-medium app-text-main truncate max-w-xs">${file.name}</span>
                        ${file.isStarred ? '<i data-lucide="star" class="w-3.5 h-3.5 text-amber-400 fill-current"></i>' : ''}
                    </div>
                </td>
                <td class="app-text-sub">Saya</td>
                <td class="app-text-sub">${window.useCloudStorage.formatDate(file.updatedAt || file.createdAt)}</td>
                <td class="app-text-sub">${window.useCloudStorage.formatBytes(file.size)}</td>
                <td class="text-right">
                    <button class="p-1 rounded app-text-muted hover:text-primary hover:bg-slate-500/10 file-menu-btn" title="Opsi">
                        <i data-lucide="more-vertical" class="w-4 h-4"></i>
                    </button>
                </td>
            `;

            tr.addEventListener('click', (e) => {
                if (e.target.closest('.file-menu-btn')) return;
                onSelect(file, e.ctrlKey || e.metaKey || e.shiftKey);
            });

            tr.addEventListener('dblclick', () => {
                onPreview(file, files);
            });

            tr.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                onContextMenu(e, file, 'file');
            });

            const menuBtn = tr.querySelector('.file-menu-btn');
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onContextMenu(e, file, 'file');
            });

            tbody.appendChild(tr);
        });

        container.appendChild(table);
        if (window.lucide) window.lucide.createIcons();
    }

    renderStorageMeter(stats) {
        const textEl = document.getElementById('storageUsageText');
        const fillEl = document.getElementById('storageProgressBar');
        if (textEl) {
            const usedStr = window.useCloudStorage.formatBytes(stats.usedBytes);
            const totalStr = window.useCloudStorage.formatBytes(stats.quotaBytes);
            textEl.textContent = `${usedStr} dari ${totalStr} digunakan`;
        }
        if (fillEl) {
            fillEl.style.width = `${Math.max(1, stats.percentage)}%`;
        }
    }

    renderDetailsPanel(item, type = 'file') {
        const titleEl = document.getElementById('detailsTitle');
        const previewContainer = document.getElementById('detailsPreviewArea');
        const metaContainer = document.getElementById('detailsMetadata');

        if (!item) {
            if (titleEl) titleEl.textContent = 'Rincian Berkas';
            if (previewContainer) previewContainer.innerHTML = '<div class="app-text-muted text-xs py-8 text-center">Pilih berkas atau folder untuk melihat informasi lengkap.</div>';
            if (metaContainer) metaContainer.innerHTML = '';
            return;
        }

        if (titleEl) titleEl.textContent = item.name;

        if (type === 'file') {
            if (previewContainer) {
                if (item.category === 'image' && item.data) {
                    previewContainer.innerHTML = `<img src="${item.data}" alt="${item.name}" class="w-full h-40 object-cover rounded-xl border app-border">`;
                } else {
                    previewContainer.innerHTML = `
                        <div class="w-full h-36 rounded-xl bg-slate-500/10 border app-border flex items-center justify-center text-indigo-500">
                            <i data-lucide="file" class="w-14 h-14"></i>
                        </div>
                    `;
                }
            }

            if (metaContainer) {
                metaContainer.innerHTML = `
                    <div class="space-y-3 text-xs">
                        <div class="flex justify-between py-2 border-b app-border">
                            <span class="app-text-muted">Tipe Berkas</span>
                            <span class="font-medium app-text-main uppercase">${item.type.split('/')[1] || item.category}</span>
                        </div>
                        <div class="flex justify-between py-2 border-b app-border">
                            <span class="app-text-muted">Ukuran</span>
                            <span class="font-medium app-text-main">${window.useCloudStorage.formatBytes(item.size)}</span>
                        </div>
                        <div class="flex justify-between py-2 border-b app-border">
                            <span class="app-text-muted">Dibuat</span>
                            <span class="font-medium app-text-main">${window.useCloudStorage.formatDate(item.createdAt)}</span>
                        </div>
                        <div class="flex justify-between py-2 border-b app-border">
                            <span class="app-text-muted">Berbintang</span>
                            <span class="font-medium text-amber-500">${item.isStarred ? 'Ya' : 'Tidak'}</span>
                        </div>
                    </div>
                `;
            }
        } else {
            // Folder
            if (previewContainer) {
                previewContainer.innerHTML = `
                    <div class="w-full h-36 rounded-xl flex items-center justify-center" style="background-color: var(--primary-light); color: var(--primary);">
                        <i data-lucide="folder" class="w-14 h-14 fill-current"></i>
                    </div>
                `;
            }
            if (metaContainer) {
                metaContainer.innerHTML = `
                    <div class="space-y-3 text-xs">
                        <div class="flex justify-between py-2 border-b app-border">
                            <span class="app-text-muted">Tipe</span>
                            <span class="font-medium app-text-main">Folder Direktori</span>
                        </div>
                        <div class="flex justify-between py-2 border-b app-border">
                            <span class="app-text-muted">Dibuat</span>
                            <span class="font-medium app-text-main">${window.useCloudStorage.formatDate(item.createdAt)}</span>
                        </div>
                    </div>
                `;
            }
        }

        if (window.lucide) window.lucide.createIcons();
    }

    renderActivities(activities) {
        const container = document.getElementById('detailsActivityList');
        if (!container) return;

        if (activities.length === 0) {
            container.innerHTML = '<div class="app-text-muted text-xs py-8 text-center">Belum ada riwayat aktivitas.</div>';
            return;
        }

        container.innerHTML = '';
        activities.forEach(act => {
            const item = document.createElement('div');
            item.className = 'flex items-start gap-3 py-2.5 border-b app-border text-xs';
            item.innerHTML = `
                <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style="background-color: var(--primary-light); color: var(--primary);">
                    <i data-lucide="activity" class="w-3.5 h-3.5"></i>
                </div>
                <div class="flex-1 overflow-hidden">
                    <p class="font-medium app-text-main">${act.action}</p>
                    <p class="app-text-muted mt-0.5 truncate">${act.description}</p>
                    <span class="text-[10px] app-text-muted mt-1 block">${window.useCloudStorage.formatDate(act.timestamp)}</span>
                </div>
            `;
            container.appendChild(item);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    showToast(message, type = 'info', duration = 3000) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;

        let icon = '<i data-lucide="info" class="w-5 h-5 text-indigo-500"></i>';
        if (type === 'success') icon = '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-500"></i>';
        else if (type === 'error') icon = '<i data-lucide="alert-circle" class="w-5 h-5 text-rose-500"></i>';

        toast.innerHTML = `
            ${icon}
            <span class="flex-1 font-medium app-text-main">${message}</span>
        `;

        container.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// Global instance
window.useCloudUI = new UseCloudUI();
