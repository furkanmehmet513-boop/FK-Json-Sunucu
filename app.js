/**
 * FK Dosya Köprüsü - Uygulama Mantığı
 * Vanilla JS, async/await, fetch API
 */

(function() {
  'use strict';

  // ---------- DOM Elements ----------
  const uploadSection = document.getElementById('uploadSection');
  const downloadSection = document.getElementById('downloadSection');
  
  // Upload view elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileNameSpan = document.getElementById('fileName');
  const fileSizeSpan = document.getElementById('fileSize');
  const clearFileBtn = document.getElementById('clearFileBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  const resultArea = document.getElementById('resultArea');
  const fileCodeSpan = document.getElementById('fileCode');
  const downloadLinkInput = document.getElementById('downloadLinkInput');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const copyFeedback = document.getElementById('copyFeedback');
  
  // Download view elements
  const displayCodeSpan = document.getElementById('displayCode');
  const downloadFileBtn = document.getElementById('downloadFileBtn');
  const downloadStatus = document.getElementById('downloadStatus');
  const newUploadBtn = document.getElementById('newUploadBtn');
  
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  
  // ---------- State ----------
  let selectedFile = null;
  let currentCode = null;          // for download view
  const API_BASE = 'https://fk-bridge.vercel.app/api';
  
  // ---------- Utility Functions ----------
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle('error', isError);
    element.classList.toggle('success', !isError && message !== '');
  }
  
  function clearStatus(element) {
    element.textContent = '';
    element.classList.remove('error', 'success');
  }
  
  // Reset upload view to initial state (keep file if any)
  function resetUploadView(keepFile = false) {
    if (!keepFile) {
      selectedFile = null;
      fileInput.value = '';
      fileInfo.classList.add('hidden');
      uploadBtn.disabled = true;
    }
    resultArea.classList.add('hidden');
    clearStatus(uploadStatus);
    downloadLinkInput.value = '';
    copyFeedback.textContent = '';
  }
  
  // Update UI after file selection
  function handleFileSelect(file) {
    if (!file) return;
    selectedFile = file;
    fileNameSpan.textContent = file.name;
    fileSizeSpan.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
    uploadBtn.disabled = false;
    clearStatus(uploadStatus);
    resultArea.classList.add('hidden'); // hide previous result
  }
  
  // Clear selected file
  function clearSelectedFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    uploadBtn.disabled = true;
    clearStatus(uploadStatus);
  }
  
  // ---------- Upload Logic ----------
  async function uploadFile() {
    if (!selectedFile) return;
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    // UI: loading state
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
    clearStatus(uploadStatus);
    resultArea.classList.add('hidden');
    
    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sunucu hatası (${response.status}): ${errorText || 'Bilinmeyen hata'}`);
      }
      
      const data = await response.json();
      
      // Expected: { code: "ABC123", url: "https://..." }
      if (!data.code || !data.url) {
        throw new Error('Sunucudan geçersiz yanıt alındı.');
      }
      
      // Show success
      fileCodeSpan.textContent = data.code;
      downloadLinkInput.value = data.url;
      resultArea.classList.remove('hidden');
      showStatus(uploadStatus, '✅ Dosya başarıyla yüklendi!', false);
      
      // Update URL without reload (optional)
      const newUrl = `${window.location.pathname}?code=${data.code}`;
      window.history.replaceState(null, '', newUrl);
      currentCode = data.code; // in case user wants to download later
      
    } catch (error) {
      console.error('Upload error:', error);
      showStatus(uploadStatus, `❌ Yükleme başarısız: ${error.message}`, true);
    } finally {
      // Restore button
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Yükle';
    }
  }
  
  // ---------- Copy Link ----------
  async function copyDownloadLink() {
    const link = downloadLinkInput.value;
    if (!link) return;
    
    try {
      await navigator.clipboard.writeText(link);
      copyFeedback.textContent = 'Bağlantı kopyalandı!';
      setTimeout(() => { copyFeedback.textContent = ''; }, 2000);
    } catch (err) {
      copyFeedback.textContent = 'Kopyalanamadı, manuel seçin.';
      downloadLinkInput.select();
    }
  }
  
  // ---------- Download View Logic ----------
  function showDownloadView(code) {
    uploadSection.classList.add('hidden');
    downloadSection.classList.remove('hidden');
    displayCodeSpan.textContent = code;
    currentCode = code;
    clearStatus(downloadStatus);
  }
  
  function showUploadView() {
    uploadSection.classList.remove('hidden');
    downloadSection.classList.add('hidden');
    // Clear URL param
    window.history.replaceState(null, '', window.location.pathname);
    currentCode = null;
    resetUploadView(false);
  }
  
  async function downloadFile() {
    if (!currentCode) {
      showStatus(downloadStatus, 'Geçerli bir kod bulunamadı.', true);
      return;
    }
    
    const downloadUrl = `${API_BASE}/download/${currentCode}`;
    downloadFileBtn.disabled = true;
    downloadFileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İndiriliyor...';
    clearStatus(downloadStatus);
    
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Dosya bulunamadı veya süresi dolmuş olabilir.');
        }
        throw new Error(`İndirme hatası (${response.status})`);
      }
      
      // Get blob and trigger download
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `dosya_${currentCode}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '');
        }
      }
      
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      
      showStatus(downloadStatus, '✅ İndirme başladı.', false);
    } catch (error) {
      console.error('Download error:', error);
      showStatus(downloadStatus, `❌ ${error.message}`, true);
    } finally {
      downloadFileBtn.disabled = false;
      downloadFileBtn.innerHTML = '<i class="fas fa-download"></i> Dosyayı İndir';
    }
  }
  
  // ---------- Theme Toggle ----------
  function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.body.classList.add('dark-theme');
      themeToggle.innerHTML = '<i class="fas fa-sun"></i><span>Açık Tema</span>';
    } else {
      document.body.classList.remove('dark-theme');
      themeToggle.innerHTML = '<i class="fas fa-moon"></i><span>Koyu Tema</span>';
    }
  }
  
  function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    themeToggle.innerHTML = isDark 
      ? '<i class="fas fa-sun"></i><span>Açık Tema</span>' 
      : '<i class="fas fa-moon"></i><span>Koyu Tema</span>';
  }
  
  // ---------- Event Listeners ----------
  function initEventListeners() {
    // --- Upload view events ---
    // Click on drop zone triggers file input
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Keyboard accessibility
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFileSelect(file);
    });
    
    // Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    
    dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    
    dropZone.addEventListener('drop', (e) => {
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    });
    
    // Clear file button
    clearFileBtn.addEventListener('click', clearSelectedFile);
    
    // Upload button
    uploadBtn.addEventListener('click', uploadFile);
    
    // Copy link button
    copyLinkBtn.addEventListener('click', copyDownloadLink);
    
    // --- Download view events ---
    downloadFileBtn.addEventListener('click', downloadFile);
    
    newUploadBtn.addEventListener('click', () => {
      showUploadView();
    });
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // ---------- Initialization: Check URL for code ----------
  function checkUrlForCode() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && code.trim() !== '') {
      showDownloadView(code.trim());
    } else {
      showUploadView();
    }
  }
  
  // ---------- Bootstrap ----------
  function init() {
    initTheme();
    initEventListeners();
    checkUrlForCode();
  }
  
  init();
})();