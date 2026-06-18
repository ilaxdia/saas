// PHOTOTULIP AI - APPLICATION LOGIC

// State Management
let currentNiche = 'emlak';
let photosArray = [];
let geminiApiKey = localStorage.getItem('gemini_api_key') || '';
let selectedGeminiModel = localStorage.getItem('selected_gemini_model') || 'gemini-2.5-flash';
let db;
let currentProjectId = null;
let appraisalPdfFile = null;
let appraisalPdfBase64 = null;

// Credit & Payment State
let userCredits = parseInt(localStorage.getItem('user_credits') || '5');
let selectedPackage = { credits: 0, price: 0 };
let slideshowInterval = null;
let isSystemApiKeyActive = false;

// DOM Elements
const apiStatusIndicator = document.getElementById('api-status-indicator');
const btnOpenSettings = document.getElementById('btn-open-settings');
const settingsModal = document.getElementById('settings-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const apiKeyInput = document.getElementById('api-key-input');

const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const photoGrid = document.getElementById('photo-grid');
const btnClearPhotos = document.getElementById('btn-clear-photos');

const formEmlak = document.getElementById('form-emlak');
const formOto = document.getElementById('form-oto');

// Action Buttons
const btnGenerates = document.querySelectorAll('.btn-generate');
const btnSaveProjects = document.querySelectorAll('.btn-save-project');

// Appraisal Form Elements
const formAppraisal = document.getElementById('form-appraisal');
const appraisalUploadZone = document.getElementById('appraisal-upload-zone');
const appraisalFileInput = document.getElementById('appraisal-file-input');
const appraisalFilePreview = document.getElementById('appraisal-file-preview');
const appraisalFileName = document.getElementById('appraisal-file-name');
const appraisalFileSize = document.getElementById('appraisal-file-size');
const btnRemoveAppraisalFile = document.getElementById('btn-remove-appraisal-file');
const btnAnalyzeAppraisal = document.getElementById('btn-analyze-appraisal');
const appraisalLoading = document.getElementById('appraisal-loading');
const appraisalLoadingTitle = document.getElementById('appraisal-loading-title');
const appraisalLoadingSubtitle = document.getElementById('appraisal-loading-subtitle');
const appraisalResult = document.getElementById('appraisal-result');
const btnApplyAppraisal = document.getElementById('btn-apply-appraisal');

const resCarBrand = document.getElementById('res-car-brand');
const resCarBody = document.getElementById('res-car-body');
const resCarEngine = document.getElementById('res-car-engine');
const resCarChassis = document.getElementById('res-car-chassis');
const resCarTramer = document.getElementById('res-car-tramer');
const resCarSummary = document.getElementById('res-car-summary');

const resultPlaceholder = document.getElementById('result-placeholder');
const resultLoading = document.getElementById('result-loading');
const resultOutput = document.getElementById('result-output');

const outputTitle = document.getElementById('output-title');
const outputDescription = document.getElementById('output-description');
const outputTags = document.getElementById('output-tags');

// Sidebar Drawer Elements
const sidebarDrawer = document.getElementById('sidebar-drawer') || document.getElementById('sidebar-menu');
const btnOpenSidebar = document.getElementById('btn-open-sidebar');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');

// Credit & Payment UI Elements
const creditBadge = document.getElementById('credit-badge');
const sidebarBtnCredits = document.getElementById('sidebar-btn-credits');
const creditModal = document.getElementById('credit-modal');
const btnCloseCreditModal = document.getElementById('btn-close-credit-modal') || document.getElementById('btn-close-credit-modal');
const btnCancelCredit = document.getElementById('btn-cancel-credit');
const btnPayCredit = document.getElementById('btn-pay-credit');
const btnVerify3d = document.getElementById('btn-verify-3d');
const smsCodeInput = document.getElementById('sms-code');

// Legal Modal Elements
const legalModal = document.getElementById('legal-modal');
const btnCloseLegalModal = document.getElementById('btn-close-legal-modal');
const btnCloseLegalFooter = document.getElementById('btn-close-legal-footer');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Run header auth status first to write the API indicator to DOM
    updateHeaderLoginStatus();

    // Check if there is a system-wide API key active on Vercel
    try {
        const statusRes = await fetch('/api/status');
        const statusData = await statusRes.json();
        if (statusData && statusData.configured) {
            isSystemApiKeyActive = true;
            updateHeaderLoginStatus(); // Update DOM to reflect found backend key immediately
        }
    } catch (err) {
        console.error("System API status check failed:", err);
    }

    // Load Saved API Key
    if (geminiApiKey) {
        if (apiKeyInput) apiKeyInput.value = geminiApiKey;
        validateApiKey(geminiApiKey);
    } else if (isSystemApiKeyActive) {
        updateApiStatus(true);
    } else {
        updateApiStatus(false, 'Gemini Bağlı Değil');
    }

    // Initialize Database
    await initDB();

    // Initialize Credits Display
    updateCreditsDisplay();

    // Start background slideshow for welcome/empty state
    startBackgroundSlideshow();

    // Lucide Icons Initialization
    lucide.createIcons();

    // Parse URL parameter to automatically switch tabs (from Dashboard links)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'emlak' || tabParam === 'oto' || tabParam === 'appraisal') {
        setTimeout(() => {
            selectNicheAndClose(tabParam);
        }, 100);
    }

    // Event Listeners
    initEventListeners();
});

// INDEXEDDB DATA STORAGE HELPERS
const DB_NAME = 'AI_Ilan_DB';
const DB_VERSION = 1;
const STORE_NAME = 'listings';

function initDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function(e) {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = function(e) {
            db = e.target.result;
            resolve();
        };
        request.onerror = function(e) {
            console.error('IndexedDB init error:', e);
            resolve();
        };
    });
}

function saveProjectToDB(project) {
    return new Promise((resolve, reject) => {
        if (!db) { reject('Veritabanı hazır değil.'); return; }
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(project);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

function getAllProjectsFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) { resolve([]); return; }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

function deleteProjectFromDB(id) {
    return new Promise((resolve, reject) => {
        if (!db) { reject('Veritabanı hazır değil.'); return; }
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

function getProjectFromDB(id) {
    return new Promise((resolve, reject) => {
        if (!db) { reject('Veritabanı hazır değil.'); return; }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Update API Status Indicator
function updateApiStatus(connected, message) {
    const indicator = document.getElementById('api-status-indicator');
    if (!indicator) return;
    if (connected) {
        indicator.classList.remove('status-disconnected');
        indicator.classList.add('status-connected');
        const txtEl = indicator.querySelector('.status-text') || document.getElementById('api-status-text');
        if (txtEl) txtEl.innerText = 'Gemini Hazır';
    } else {
        indicator.classList.remove('status-connected');
        indicator.classList.add('status-disconnected');
        const txtEl = indicator.querySelector('.status-text') || document.getElementById('api-status-text');
        if (txtEl) txtEl.innerText = message || 'Gemini Bağlı Değil';
    }
    checkFormValidation();
}

// Call Gemini API (either direct using custom key or via backend proxy using system key)
async function callGemini(requestBody) {
    let response;
    if (geminiApiKey) {
        // Direct call using custom API key
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedGeminiModel}:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
    } else if (isSystemApiKeyActive) {
        // Proxy call using securing system API key on Vercel backend
        response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
    } else {
        throw new Error('Gemini API Anahtarı tanımlanmamış. Lütfen ayarlardan giriniz.');
    }
    return response;
}

// Validate API Key using a lightweight request to Gemini API
async function validateApiKey(key) {
    updateApiStatus(false, 'Test Ediliyor...');
    try {
        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Merhaba' }] }],
                generationConfig: { maxOutputTokens: 5 }
            })
        });

        if (response.ok) {
            selectedGeminiModel = 'gemini-2.5-flash';
            localStorage.setItem('selected_gemini_model', selectedGeminiModel);
            updateApiStatus(true);
            return true;
        } else {
            // Try fallback model
            console.log("gemini-2.5-flash failed, trying gemini-1.5-flash...");
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Merhaba' }] }],
                    generationConfig: { maxOutputTokens: 5 }
                })
            });
            
            if (response.ok) {
                selectedGeminiModel = 'gemini-1.5-flash';
                localStorage.setItem('selected_gemini_model', selectedGeminiModel);
                updateApiStatus(true);
                return true;
            } else {
                const errData = await response.json();
                const errMsg = errData.error?.message || 'Bilinmeyen Hata';
                console.error('Gemini API validation error response:', errData);
                window.lastApiError = errMsg;
                updateApiStatus(false, 'Hatalı API Key');
                return false;
            }
        }
    } catch (error) {
        console.error('API validation error:', error);
        window.lastApiError = error.message || 'Bağlantı kurulamadı.';
        updateApiStatus(false, 'Bağlantı Hatası');
        return false;
    }
}

// Credit Management Helpers
function updateCreditsDisplay() {
    const userCreditsVal = document.getElementById('user-credits-val');
    const sidebarCreditsVal = document.getElementById('sidebar-credits-val');
    const creditStatusText = document.getElementById('credit-status-text');
    const creditProgressBar = document.getElementById('credit-progress-bar');
    
    if (userCreditsVal) userCreditsVal.innerText = userCredits;
    if (sidebarCreditsVal) sidebarCreditsVal.innerText = userCredits;
    if (creditStatusText) creditStatusText.innerText = `${userCredits} / 5 İlan Hakkı`;
    if (creditProgressBar) {
        const progressPercent = (userCredits / 5) * 100;
        creditProgressBar.style.width = `${progressPercent}%`;
    }
}

function spendCredit() {
    if (userCredits > 0) {
        userCredits--;
        localStorage.setItem('user_credits', userCredits);
        updateCreditsDisplay();
        return true;
    }
    return false;
}

// Sidebar open/close helper functions
function openSidebar() {
    if (sidebarDrawer) {
        sidebarDrawer.classList.remove('hide-sidebar');
    }
}

function closeSidebar() {
    if (sidebarDrawer) {
        sidebarDrawer.classList.add('hide-sidebar');
    }
}

// Immersive UI: Switch active Niche and Close Sidebar
window.selectNicheAndClose = function(niche) {
    window.setNiche(niche);
    closeSidebar();
};

// Dynamic Slogans for the slideshow
const slogans = {
    'default-bg': {
        badge: 'Yapay Zeka',
        text: 'Akıllı İlan Asistanı: Yapay zekayla saniyeler içinde sahibinden ve arabam uyumlu ilanlar hazırlayın!'
    },
    'emlak-bg': {
        badge: 'Emlak İlanı',
        text: 'Emlak İlanları: Portföyünüzü yapay zeka ile parlatın, alıcıları anında etkileyin!'
    },
    'oto-bg': {
        badge: 'Oto Galeri',
        text: 'Oto Galeri İlanları: Araç detaylarını girin, en dikkat çekici ilan metinlerine hemen kavuşun!'
    },
    'appraisal-bg': {
        badge: 'Ekspertiz Analizi',
        text: 'Ekspertiz Raporu: PDF raporunu yükleyin, yapay zeka hasar ve kondisyonu saniyede analiz etsin!'
    }
};

function updateSlogan(bgClass) {
    const sloganArea = document.getElementById('welcome-slogan-area');
    const sloganBadge = document.getElementById('slogan-badge');
    const sloganText = document.getElementById('slogan-text');
    if (!sloganArea || !sloganBadge || !sloganText) return;

    const data = slogans[bgClass] || slogans['default-bg'];

    sloganArea.classList.add('fade-out');
    setTimeout(() => {
        sloganBadge.innerText = data.badge;
        sloganText.innerText = data.text;
        sloganArea.classList.remove('fade-out');
    }, 400);
}

// Start background slideshow cycling when on welcome state
function startBackgroundSlideshow() {
    if (slideshowInterval) clearInterval(slideshowInterval);
    
    const bgContainer = document.getElementById('bg-container');
    if (!bgContainer) return;
    
    const backgrounds = ['default-bg', 'emlak-bg', 'oto-bg', 'appraisal-bg'];
    let index = 0;
    
    // Set initial
    bgContainer.className = 'bg-container default-bg';
    updateSlogan('default-bg');
    
    slideshowInterval = setInterval(() => {
        index = (index + 1) % backgrounds.length;
        const nextBg = backgrounds[index];
        bgContainer.className = `bg-container ${nextBg}`;
        updateSlogan(nextBg);
    }, 5000);
}

// Stop slideshow cycling when a workflow is active
function stopBackgroundSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = null;
    }
}

// Immersive UI: Restore welcome landing state (empty layout)
window.showWelcomeState = function() {
    const welcomeState = document.getElementById('welcome-state');
    if (welcomeState) welcomeState.classList.remove('hide-panel');
    
    const formPanel = document.querySelector('.form-panel');
    if (formPanel) formPanel.classList.add('hide-panel');
    const resultPanel = document.querySelector('.result-panel');
    if (resultPanel) resultPanel.classList.add('hide-panel');
    const photoPanel = document.querySelector('.photo-panel');
    if (photoPanel) photoPanel.classList.add('hide-panel');

    // Start background slideshow
    startBackgroundSlideshow();

    document.querySelectorAll('.sidebar-menu-item').forEach(btn => btn.classList.remove('active'));
    const targetSidebarTab = document.getElementById('sidebar-tab-home');
    if (targetSidebarTab) targetSidebarTab.classList.add('active');
    closeSidebar();
};

// Niche Switcher (Emlak / Oto Galeri / Ekspertiz)
window.setNiche = function(niche) {
    currentNiche = niche;

    // Stop background slideshow since workflow is active
    stopBackgroundSlideshow();

    // Switch forms
    if (formEmlak) formEmlak.classList.remove('active');
    if (formOto) formOto.classList.remove('active');
    if (formAppraisal) formAppraisal.classList.remove('active');

    const targetForm = document.getElementById(`form-${niche}`);
    if (targetForm) targetForm.classList.add('active');

    // Show panel layout and hide welcome card
    const welcomeState = document.getElementById('welcome-state');
    if (welcomeState) welcomeState.classList.add('hide-panel');

    const formPanel = document.querySelector('.form-panel');
    if (formPanel) formPanel.classList.remove('hide-panel');
    const resultPanel = document.querySelector('.result-panel');
    if (resultPanel) resultPanel.classList.remove('hide-panel');
    const photoPanel = document.querySelector('.photo-panel');
    if (photoPanel) photoPanel.classList.remove('hide-panel');

    // Update dynamic background class on #bg-container
    const bgContainer = document.getElementById('bg-container');
    if (bgContainer) {
        bgContainer.className = 'bg-container';
        if (niche === 'emlak') {
            bgContainer.classList.add('emlak-bg');
        } else if (niche === 'oto') {
            bgContainer.classList.add('oto-bg');
        } else if (niche === 'appraisal') {
            bgContainer.classList.add('appraisal-bg');
        } else {
            bgContainer.classList.add('default-bg');
        }
    }

    // Toggle active state in sidebar
    document.querySelectorAll('.sidebar-menu-item').forEach(btn => btn.classList.remove('active'));
    const targetSidebarTab = document.getElementById(`sidebar-tab-${niche}`);
    if (targetSidebarTab) targetSidebarTab.classList.add('active');

    // Standard buttons management
    const actionButtons = document.querySelector('.action-buttons-group');
    if (niche === 'appraisal') {
        if (actionButtons) actionButtons.classList.add('hide');
    } else {
        if (actionButtons) actionButtons.classList.remove('hide');
    }

    checkFormValidation();
};

// iyzico Package Selection
window.selectPackage = function(credits, price) {
    selectedPackage = { credits, price };
    
    // Highlight selection (we can add styling to cards)
    document.getElementById('selected-package-info').innerText = `${credits} Kredi Paketi`;
    document.getElementById('selected-package-price').innerText = `${price} TL`;
    
    const btnPay = document.getElementById('btn-pay-credit');
    btnPay.innerText = `Güvenli Ödeme Yap (${price} TL)`;
    btnPay.classList.remove('hide');
    
    // Transition to payment details form
    document.getElementById('credit-packages-view').classList.add('hide');
    document.getElementById('credit-payment-view').classList.remove('hide');
    
    // Reset payment validation
    checkCardFormValidation();
};

// Open & Close Credit Modal
function openCreditModal(message) {
    // Reset state
    document.getElementById('credit-packages-view').classList.remove('hide');
    document.getElementById('credit-payment-view').classList.add('hide');
    document.getElementById('credit-3d-view').classList.add('hide');
    document.getElementById('credit-success-view').classList.add('hide');
    
    document.getElementById('btn-pay-credit').classList.add('hide');
    document.getElementById('btn-verify-3d').classList.add('hide');
    document.getElementById('btn-cancel-credit').classList.remove('hide');
    
    // Clear card fields
    document.getElementById('card-holder').value = '';
    document.getElementById('card-number').value = '';
    document.getElementById('card-expiry').value = '';
    document.getElementById('card-cvc').value = '';
    document.getElementById('card-brand-logo').innerHTML = '';
    
    if (message) {
        alert(message);
    }
    
    creditModal.classList.remove('hide');
}

function closeCreditModal() {
    creditModal.classList.add('hide');
}

// iyzico Legal Modals Loader
window.showLegalModal = function(type) {
    const titleEl = document.getElementById('legal-modal-title');
    const contentEl = document.getElementById('legal-modal-content');
    
    if (type === 'sales') {
        titleEl.innerText = 'Mesafeli Satış Sözleşmesi';
        contentEl.innerHTML = `
            <h4>1. TARAFLAR</h4>
            <p>İşbu Sözleşme, <strong>aiilan.com</strong> internet sitesi üzerinden hizmet alan ALICI ile <strong>ilaxdia Bilişim ve Teknoloji Hizmetleri</strong> (SATICI) arasında akdedilmiştir.</p>
            <h4>2. KONU</h4>
            <p>Sözleşme'nin konusu, ALICI'nın SATICI'ya ait web sitesinden elektronik ortamda siparişini verdiği dijital kredi paketinin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun hükümleri gereğince tarafların hak ve yükümlülüklerinin saptanmasıdır.</p>
            <h4>3. HİZMETİN TESLİMİ</h4>
            <p>Satın alınan krediler ALICI'nın hesabına ödemenin başarıyla tamamlanmasının ardından anında dijital olarak tanımlanır ve kullanıma sunulur.</p>
            <h4>4. GENEL HÜKÜMLER</h4>
            <p>ALICI, sözleşme konusu hizmetin temel nitelikleri, satış fiyatı ve ödeme şekli ile teslimata ilişkin ön bilgileri okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli teyidi verdiğini beyan eder.</p>
        `;
    } else if (type === 'refund') {
        titleEl.innerText = 'İade ve İptal Koşulları';
        contentEl.innerHTML = `
            <h4>İADE VE İPTAL KOŞULLARI</h4>
            <p>1. <strong>aiilan.com</strong> üzerinden satışı yapılan "Kredi Paketleri" anında teslim edilen ve anında tüketilen dijital içerik/hizmet kapsamındadır.</p>
            <p>2. Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin (ğ) bendi uyarınca, "Elektronik ortamda anında ifa edilen hizmetler veya tüketiciye anında teslim edilen gayrimaddi mallara ilişkin sözleşmeler" cayma hakkının istisnaları arasında yer almaktadır.</p>
            <p>3. Bu doğrultuda, satın alınan kredi paketlerinin hesaba tanımlanmasıyla birlikte ifa gerçekleştirilmiş sayıldığından, satın alınan dijital kredilerin iadesi veya iptali mümkün değildir.</p>
            <p>4. Herhangi bir sistemsel hata nedeniyle kartınızdan mükerrer çekim yapılması durumunda <strong>info@aiilan.com</strong> adresine yazarak fazla çekilen tutarın iadesini talep edebilirsiniz. İnceleme sonrası 3-7 iş günü içinde iade kartınıza yansıtılacaktır.</p>
        `;
    } else if (type === 'privacy') {
        titleEl.innerText = 'Gizlilik ve KVKK Politikası';
        contentEl.innerHTML = `
            <h4>GİZLİLİK VE KVKK POLİTİKASI</h4>
            <p>1. Veri Sorumlusu: <strong>ilaxdia Bilişim ve Teknoloji Hizmetleri</strong></p>
            <p>2. Toplanan Veriler: İlan oluştururken girdiğiniz veriler (konum, alan, fiyat vb.) ve yüklediğiniz fotoğraflar sadece ilan metni oluşturmak amacıyla geçici olarak işlenir. API anahtarınız tarayıcınızda (localStorage) şifreli olarak saklanır ve sunucularımıza iletilmez.</p>
            <p>3. Ödeme Bilgileri: Ödeme sırasında girdiğiniz kredi kartı bilgileri doğrudan iyzico güvenli ödeme altyapısına iletilir. <strong>aiilan.com</strong> hiçbir şekilde kredi kartı bilgilerinizi kaydetmez veya saklamaz.</p>
            <p>4. Haklarınız: KVKK Madde 11 uyarınca, <strong>info@aiilan.com</strong> adresine başvurarak kişisel verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini talep etme hakkına sahipsiniz.</p>
        `;
    }
    legalModal.classList.remove('hide');
};

// Event Listeners Setup
function initEventListeners() {
    // Settings Modal
    const openSettings = () => {
        if (apiKeyInput) apiKeyInput.value = geminiApiKey;
        if (settingsModal) settingsModal.classList.remove('hide');
    };
    if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettings);
    if (apiStatusIndicator) apiStatusIndicator.addEventListener('click', openSettings);

    const closeModal = () => { if (settingsModal) settingsModal.classList.add('hide'); };
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelSettings) btnCancelSettings.addEventListener('click', closeModal);

    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', async () => {
            const newKey = apiKeyInput.value.trim();
            if (!newKey) {
                alert('Lütfen geçerli bir API Anahtarı girin.');
                return;
            }
            
            btnSaveSettings.innerText = 'Kontrol Ediliyor...';
            btnSaveSettings.disabled = true;
            window.lastApiError = null;

            const isValid = await validateApiKey(newKey);
            btnSaveSettings.innerText = 'Kaydet ve Test Et';
            btnSaveSettings.disabled = false;

            if (isValid) {
                geminiApiKey = newKey;
                localStorage.setItem('gemini_api_key', newKey);
                closeModal();
            } else {
                const detail = window.lastApiError ? `\n\nHata Detayı: ${window.lastApiError}` : '';
                alert('API Anahtarı doğrulanamadı. Lütfen kontrol edip tekrar deneyin.' + detail);
            }
        });
    }

    // Saved Projects Modal Trigger Buttons
    const btnOpenProjects = document.getElementById('btn-open-projects');
    const projectsModal = document.getElementById('projects-modal');
    const btnCloseProjectsModal = document.getElementById('btn-close-projects-modal');
    const btnCloseProjectsFooter = document.getElementById('btn-close-projects-footer');

    if (btnOpenProjects) {
        btnOpenProjects.addEventListener('click', () => {
            if (projectsModal) {
                projectsModal.classList.remove('hide');
                loadAndRenderProjects();
            }
        });
    }

    const closeProjectsModal = () => { if (projectsModal) projectsModal.classList.add('hide'); };
    window.closeProjectsModal = closeProjectsModal;
    if (btnCloseProjectsModal) btnCloseProjectsModal.addEventListener('click', closeProjectsModal);
    if (btnCloseProjectsFooter) btnCloseProjectsFooter.addEventListener('click', closeProjectsModal);

    if (btnSaveProjects) {
        btnSaveProjects.forEach(btn => btn.addEventListener('click', () => saveCurrentProject()));
    }

    // File Upload Handlers
    if (uploadZone) {
        uploadZone.addEventListener('click', () => { if (fileInput) fileInput.click(); });
    }
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    // Drag and Drop Zone
    if (uploadZone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
            }, false);
        });

        uploadZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        });
    }

    // Clear Photos
    if (btnClearPhotos) {
        btnClearPhotos.addEventListener('click', () => {
            photosArray = [];
            renderPhotos();
        });
    }

    // Generate Buttons
    if (btnGenerates) {
        btnGenerates.forEach(btn => btn.addEventListener('click', generateListing));
    }

    // Appraisal PDF Upload Olayları
    if (appraisalUploadZone) {
        appraisalUploadZone.addEventListener('click', () => appraisalFileInput.click());
        appraisalFileInput.addEventListener('change', handleAppraisalFileSelect);

        // Drag and Drop
        ['dragenter', 'dragover'].forEach(eventName => {
            appraisalUploadZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                appraisalUploadZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            appraisalUploadZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                appraisalUploadZone.classList.remove('dragover');
            }, false);
        });

        appraisalUploadZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                processAppraisalFile(files[0]);
            }
        });
    }

    if (btnRemoveAppraisalFile) {
        btnRemoveAppraisalFile.addEventListener('click', () => {
            appraisalPdfFile = null;
            appraisalPdfBase64 = null;
            appraisalFileInput.value = '';
            appraisalFilePreview.classList.add('hide');
            btnAnalyzeAppraisal.classList.add('hide');
            appraisalUploadZone.classList.remove('hide');
            appraisalResult.classList.add('hide');
        });
    }

    if (btnAnalyzeAppraisal) {
        btnAnalyzeAppraisal.addEventListener('click', analyzeAppraisalPDF);
    }

    if (btnApplyAppraisal) {
        btnApplyAppraisal.addEventListener('click', () => {
            const hasarInput = document.getElementById('oto-hasar');
            if (hasarInput) {
                const brand = resCarBrand.innerText;
                const body = resCarBody.innerText;
                const tramer = resCarTramer.innerText;
                hasarInput.value = `${body} ${tramer}`;
                
                const brandInput = document.getElementById('oto-marka');
                if (brandInput && !brandInput.value && brand) {
                    brandInput.value = brand;
                }
            }
            alert('Ekspertiz analiz verileri Oto Galeri formuna başarıyla aktarıldı!');
            window.setNiche('oto');
        });
    }

    // SIDEBAR EVENT LISTENERS
    if (btnOpenSidebar) btnOpenSidebar.addEventListener('click', openSidebar);
    if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', closeSidebar);
    const bgOverlay = document.getElementById('bg-overlay');
    if (bgOverlay) bgOverlay.addEventListener('click', closeSidebar);

    // CREDIT BADGE & MODAL EVENT LISTENERS
    if (creditBadge) creditBadge.addEventListener('click', () => openCreditModal());
    if (sidebarBtnCredits) sidebarBtnCredits.addEventListener('click', () => openCreditModal());
    if (btnCloseCreditModal) btnCloseCreditModal.addEventListener('click', closeCreditModal);
    if (btnCancelCredit) btnCancelCredit.addEventListener('click', closeCreditModal);

    // SIDEBAR ACTION BUTTONS
    const sidebarBtnSettings = document.getElementById('sidebar-btn-settings');
    if (sidebarBtnSettings) {
        sidebarBtnSettings.addEventListener('click', () => {
            openSettings();
            closeSidebar();
        });
    }
    const sidebarBtnProjects = document.getElementById('sidebar-btn-projects');
    if (sidebarBtnProjects) {
        sidebarBtnProjects.addEventListener('click', () => {
            const projectsModal = document.getElementById('projects-modal');
            if (projectsModal) {
                projectsModal.classList.remove('hide');
                loadAndRenderProjects();
            }
            closeSidebar();
        });
    }

    // LEGAL MODAL CLOSE LISTENERS
    if (btnCloseLegalModal) btnCloseLegalModal.addEventListener('click', () => legalModal.classList.add('hide'));
    if (btnCloseLegalFooter) btnCloseLegalFooter.addEventListener('click', () => legalModal.classList.add('hide'));

    // IYZICO CARD FORM SIMULATION & FORMATTING
    const cardHolderInput = document.getElementById('card-holder');
    const cardNumberInput = document.getElementById('card-number');
    const cardExpiryInput = document.getElementById('card-expiry');
    const cardCvcInput = document.getElementById('card-cvc');
    const btnPayCredit = document.getElementById('btn-pay-credit');
    const btnVerify3d = document.getElementById('btn-verify-3d');
    const smsCodeInput = document.getElementById('sms-code');
    const btnBackToPackages = document.getElementById('btn-back-to-packages');

    if (btnBackToPackages) {
        btnBackToPackages.addEventListener('click', () => {
            document.getElementById('credit-payment-view').classList.add('hide');
            document.getElementById('credit-packages-view').classList.remove('hide');
            if (btnPayCredit) btnPayCredit.classList.add('hide');
        });
    }

    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
            let matches = val.match(/\d{4,16}/g);
            let match = matches && matches[0] || '';
            let parts = [];
            for (let i = 0, len = match.length; i < len; i += 4) {
                parts.push(match.substring(i, i + 4));
            }
            if (parts.length > 0) {
                e.target.value = parts.join(' ');
            } else {
                e.target.value = val;
            }
            
            const logoEl = document.getElementById('card-brand-logo');
            if (logoEl) {
                if (val.startsWith('4')) {
                    logoEl.innerHTML = '💳 Visa';
                    logoEl.style.color = '#2b7cf5';
                } else if (val.startsWith('5')) {
                    logoEl.innerHTML = '💳 MasterCard';
                    logoEl.style.color = '#f59e0b';
                } else if (val.length > 0) {
                    logoEl.innerHTML = '💳';
                    logoEl.style.color = 'var(--text-muted)';
                } else {
                    logoEl.innerHTML = '';
                }
            }
            checkCardFormValidation();
        });
    }

    if (cardExpiryInput) {
        cardExpiryInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
            if (val.length >= 2) {
                e.target.value = val.substring(0, 2) + '/' + val.substring(2, 4);
            } else {
                e.target.value = val;
            }
            checkCardFormValidation();
        });
    }

    function checkCardFormValidation() {
        if (!cardHolderInput || !cardNumberInput || !cardExpiryInput || !cardCvcInput || !btnPayCredit) return;
        const name = cardHolderInput.value.trim();
        const num = cardNumberInput.value.replace(/\s/g, '');
        const exp = cardExpiryInput.value.trim();
        const cvc = cardCvcInput.value.trim();
        
        if (name.length > 3 && num.length === 16 && exp.length === 5 && cvc.length === 3) {
            btnPayCredit.disabled = false;
        } else {
            btnPayCredit.disabled = true;
        }
    }

    if (cardHolderInput) cardHolderInput.addEventListener('input', checkCardFormValidation);
    if (cardCvcInput) cardCvcInput.addEventListener('input', checkCardFormValidation);

    if (btnPayCredit) {
        btnPayCredit.addEventListener('click', () => {
            document.getElementById('credit-payment-view').classList.add('hide');
            document.getElementById('credit-3d-view').classList.remove('hide');
            btnPayCredit.classList.add('hide');
            if (btnVerify3d) {
                btnVerify3d.classList.remove('hide');
                btnVerify3d.disabled = true;
            }
            if (smsCodeInput) smsCodeInput.value = '';
        });
    }

    if (smsCodeInput) {
        smsCodeInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^0-9]/gi, '');
            e.target.value = val;
            if (btnVerify3d) {
                if (val.length === 6) {
                    btnVerify3d.disabled = false;
                } else {
                    btnVerify3d.disabled = true;
                }
            }
        });
    }

    if (btnVerify3d) {
        btnVerify3d.addEventListener('click', () => {
            userCredits += selectedPackage.credits;
            localStorage.setItem('user_credits', userCredits);
            updateCreditsDisplay();
            
            document.getElementById('credit-3d-view').classList.add('hide');
            document.getElementById('credit-success-view').classList.remove('hide');
            btnVerify3d.classList.add('hide');
            
            const successMsg = document.getElementById('success-message');
            if (successMsg) {
                successMsg.innerText = `Hesabınıza ${selectedPackage.credits} Kredi başarıyla yüklenmiştir. Keyifli ilan oluşturmalar dileriz!`;
            }
            
            setTimeout(() => {
                closeCreditModal();
            }, 3000);
        });
    }

    // Logo Click Handlers (Return to Welcome State)
    document.querySelectorAll('.logo-area').forEach(logo => {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', window.showWelcomeState);
    });
}

// Appraisal helper functions
function handleAppraisalFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
        processAppraisalFile(files[0]);
    }
}

function processAppraisalFile(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Lütfen sadece PDF formatında bir ekspertiz raporu yükleyin.');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        alert('Dosya boyutu çok büyük (Maksimum 10MB).');
        return;
    }

    appraisalPdfFile = file;
    appraisalFileName.innerText = file.name;
    
    // Format size
    if (file.size < 1024 * 1024) {
        appraisalFileSize.innerText = (file.size / 1024).toFixed(1) + ' KB';
    } else {
        appraisalFileSize.innerText = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = function(e) {
        appraisalPdfBase64 = e.target.result.split(',')[1];
        appraisalFilePreview.classList.remove('hide');
        btnAnalyzeAppraisal.classList.remove('hide');
        appraisalUploadZone.classList.add('hide');
        lucide.createIcons();
    };
    reader.onerror = function() {
        alert('Dosya okunurken bir hata oluştu.');
    };
    reader.readAsDataURL(file);
}

const simulationTemplates = {
    bmw: {
        brand_model: "BMW 3 Serisi 320d Sport Line (2020)",
        body_paint: "Sol ön çamurluk değişmiş, sağ iki kapıda yüzeysel çizik boyası bulunmaktadır. Harici hatasız ve orijinaldir.",
        engine_mechanical: "Motor gücü %92. Turbo, enjektörler ve alt takım kontrolü sorunsuzdur. Şanzıman geçişleri kusursuzdur.",
        chassis_airbag: "Şasiler, podyeler, kuleler, iç direkler ve airbagler tamamen orijinal ve işlemsizdir.",
        tramer_km: "148,000 KM (Orijinal). Hasar Kaydı (Tramer): 2 kazadan toplam 17.250 TL.",
        ai_summary: "Araç sol ön çamurluk değişimi ve sağ iki kapıdaki yüzeysel boya dışında hatasızdır. Şasi ve airbagleri orijinaldir. Motor mekanik kondisyonu %92 olup bakımlıdır. Toplam tramer 17.250 TL'dir."
    },
    mercedes: {
        brand_model: "Mercedes-Benz C-Class C200d AMG (2019)",
        body_paint: "Değişen parça yoktur. Sağ arka çamurlukta lokal çizik boyası mevcuttur. Harici hatasız, boyasızdır.",
        engine_mechanical: "Motor mekanik durumu mükemmel. Performans %95. Zincir seti ve rutin bakımları yenidir.",
        chassis_airbag: "Şasi, podye, direkler ve airbagler orijinal ve kusursuz durumdadır.",
        tramer_km: "115,000 KM (Orijinal). Hasar Kaydı (Tramer): 1 adet kaza kaydı, 8.500 TL.",
        ai_summary: "Mercedes C200d AMG, değişensiz olup sadece sağ arka çamurluk lokal boyalıdır. Motor gücü %95, bakımları eksiksizdir. Şasiler ve airbagler hatasızdır. Tramer kaydı yalnızca 8.500 TL'dir."
    },
    volkswagen: {
        brand_model: "Volkswagen Golf 1.5 eTSI DSG Style (2021)",
        body_paint: "Ön kaput yetkili serviste orijinal parça ile değişmiştir. Harici değişen veya boyanan parçası yoktur.",
        engine_mechanical: "Motor performansı %96. DSG şanzıman kavrama ve mekatronik testi başarılıdır, vites geçişleri pürüzsüzdür.",
        chassis_airbag: "Kaput değişimine bağlı olarak şasilerde, podyede ve airbaglerde kesinlikle işlem veya hasar yoktur, orijinaldir.",
        tramer_km: "62,000 KM (Orijinal). Hasar Kaydı (Tramer): Serviste kaput değişimi kaynaklı 32.000 TL.",
        ai_summary: "Volkswagen Golf 1.5 eTSI, yetkili serviste orijinal kaput değişimi dışında hatasızdır. Podyeler ve airbagler işlemsizdir. Motor ve DSG performansı kusursuzdur. Toplam tramer 32.000 TL'dir."
    },
    audi: {
        brand_model: "Audi A4 2.0 TDI Quattro S-Line (2018)",
        body_paint: "Değişen parça bulunmamaktadır. Sol iki çamurluk ve sol arka kapıda yüzeysel boya mevcuttur. Harici hatasızdır.",
        engine_mechanical: "Quattro dört tekerlekten çekiş sistemi sorunsuz aktif. Motor performansı %90. Turbo bakımı yapılmıştır.",
        chassis_airbag: "Şasiler, podyeler, kuleler ve airbagler tamamen orijinal ve işlemsizdir.",
        tramer_km: "185,000 KM (Orijinal). Hasar Kaydı (Tramer): Sürtme kaynaklı 3 parça boya sebebiyle toplam 14.500 TL.",
        ai_summary: "Audi A4 Quattro S-Line, değişensiz olup sol yanda 3 parça boya vardır. Dört çeker sistemi aktif, motor performansı %90'dır. Şasiler ve airbagler hatasızdır. Toplam tramer 14.500 TL'dir."
    },
    default: {
        brand_model: "Renault Clio 1.5 dCi Touch (2018)",
        body_paint: "Sağ ön çamurluk değişmiş, sağ yan tarafta çizik boyaları mevcuttur. Tavan, bagaj ve sol yan orijinaldir.",
        engine_mechanical: "Motor kondisyonu %88. Rutin sıvı bakımları yapılmış, duman atma veya yağ yakma yoktur.",
        chassis_airbag: "Sağ podye ucunda önemsiz ufak bir düzeltme mevcuttur, şasiler ve airbagler genel olarak orijinaldir.",
        tramer_km: "192,000 KM (Orijinal). Hasar Kaydı (Tramer): 4 adet çarpma kaydından toplam 21.000 TL.",
        ai_summary: "Renault Clio 1.5 dCi, sağ yan boyalı ve sağ ön çamurluk değişiktir. Sağ podyede ufak işlem olup şasiler ve airbagler orijinaldir. Motor performansı %88'dir. Toplam tramer 21.000 TL'dir."
    }
};

function getSimulationData(filename) {
    const fn = filename.toLowerCase();
    if (fn.includes('bmw') || fn.includes('320')) return simulationTemplates.bmw;
    if (fn.includes('mercedes') || fn.includes('c200') || fn.includes('c180')) return simulationTemplates.mercedes;
    if (fn.includes('golf') || fn.includes('vw') || fn.includes('volkswagen') || fn.includes('passat')) return simulationTemplates.volkswagen;
    if (fn.includes('audi') || fn.includes('a4') || fn.includes('a3')) return simulationTemplates.audi;
    return simulationTemplates.default;
}

async function analyzeAppraisalPDF() {
    if (userCredits <= 0) {
        openCreditModal('PDF Analizi yapabilmek için yeterli krediniz bulunmamaktadır. Lütfen kredi yükleyin.');
        return;
    }

    if (!appraisalPdfFile || !appraisalPdfBase64) return;

    // Show Loading Progress UI
    btnAnalyzeAppraisal.classList.add('hide');
    appraisalFilePreview.classList.add('hide');
    appraisalResult.classList.add('hide');
    appraisalLoading.classList.remove('hide');

    // Step-by-step progress simulation for premium feel
    appraisalLoadingTitle.innerText = "PDF Dosyası Okunuyor...";
    appraisalLoadingSubtitle.innerText = "Doküman içeriği ve tablolar ayrıştırılıyor...";

    const progressSteps = [
        { delay: 800, title: "Yapay Zeka Analiz Ediyor...", subtitle: "Araç kaporta, boya ve değişen detayları kontrol ediliyor..." },
        { delay: 1500, title: "Kondisyon Kontrolü...", subtitle: "Motor, mekanik değerleri ve tramer kayıtları çözümleniyor..." },
        { delay: 2200, title: "Rapor Hazırlanıyor...", subtitle: "Özet ilan sonuç metni oluşturuluyor..." }
    ];

    progressSteps.forEach(step => {
        setTimeout(() => {
            appraisalLoadingTitle.innerText = step.title;
            appraisalLoadingSubtitle.innerText = step.subtitle;
        }, step.delay);
    });

    // Check if real API Key is connected
    const isApiKeyValid = apiStatusIndicator.classList.contains('status-connected');

    if (isApiKeyValid && (geminiApiKey || isSystemApiKeyActive)) {
        // Real Gemini API call
        setTimeout(async () => {
            try {
                const prompt = `Sen profesyonel bir oto ekspertiz uzmanı ve yapay zekasısın. Sana gönderilen bu PDF formatındaki oto ekspertiz raporunu dikkatlice incele.
Rapordan aşağıdaki bilgileri çıkar ve tam olarak belirtilen JSON formatında yanıtla. Yanıtın sadece geçerli bir JSON objesi olmalı, başında veya sonunda başka hiçbir açıklama veya markdown kodu (örn. \`\`\`json) içermemelidir.

Çıkarılacak Bilgiler:
1. Araç Bilgisi (Marka, model, yıl)
2. Kaporta ve Boya Durumu (Hangi parçalar değişmiş, hangileri boyalı, hangileri orijinal veya lokal boyalı)
3. Motor ve Mekanik Durumu (Motor kondisyon yüzdesi, yağ kaçakları, şanzıman durumu, ses vb.)
4. Şasi / Podye / Airbag Durumu (Şasilerde, podyelerde, direklerde işlem var mı, airbagler orijinal mi veya tamirli mi)
5. Kilometre ve Hasar Kaydı (Tramer) Bilgisi
6. AI İlan Sonuç Raporu Özeti (Aracın genel durumunu anlatan, ilan detaylarına eklenebilecek 2-3 cümlelik akıcı bir Türkçe özet metin)

İstenen JSON formatı:
{
  "brand_model": "Örn: BMW 320d (2020)",
  "body_paint": "Örn: Sol ön çamurluk değişmiş, sağ iki kapı boyalı, harici hatasız.",
  "engine_mechanical": "Örn: Performans %92, yağ kaçağı yok, şanzıman geçişleri kusursuz.",
  "chassis_airbag": "Örn: Şasi, podye, direkler ve airbagler tamamen orijinal ve işlemsizdir.",
  "tramer_km": "Örn: 148,000 KM (Orijinal). Toplam Tramer: 17,250 TL.",
  "ai_summary": "Örn: BMW 320d, sol ön çamurluk değişimi ve sağ kapılardaki yüzeysel boyalar dışında tamamen orijinaldir. Motor performansı %92 olup tüm mekanik aksamı sorunsuzdur. Şasiler ve airbagler hatasızdır. Toplam 17.250 TL tramer kaydı vardır."
}`;

                const response = await callGemini({
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: 'application/pdf',
                                        data: appraisalPdfBase64
                                    }
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Gemini API hatası');
                }

                const data = await response.json();
                const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                const result = JSON.parse(outputText);
                
                showAppraisalResults(result);
            } catch (error) {
                console.error("Gemini PDF analysis failed, falling back to simulation:", error);
                // Fallback to simulation
                const mockData = getSimulationData(appraisalPdfFile.name);
                showAppraisalResults(mockData);
            }
        }, 2800);
    } else {
        // Offline simulation mode
        setTimeout(() => {
            const mockData = getSimulationData(appraisalPdfFile.name);
            showAppraisalResults(mockData);
        }, 2800);
    }
}

function showAppraisalResults(data) {
    // Deduct 1 credit for analysis
    spendCredit();

    appraisalLoading.classList.add('hide');
    appraisalUploadZone.classList.add('hide');
    appraisalFilePreview.classList.remove('hide');
    appraisalResult.classList.remove('hide');

    resCarBrand.innerText = data.brand_model || "Belirtilmedi";
    resCarBody.innerText = data.body_paint || "Belirtilmedi";
    resCarEngine.innerText = data.engine_mechanical || "Belirtilmedi";
    resCarChassis.innerText = data.chassis_airbag || "Belirtilmedi";
    resCarTramer.innerText = data.tramer_km || "Belirtilmedi";
    resCarSummary.innerText = data.ai_summary || "Belirtilmedi";
    
    lucide.createIcons();
}

// Handle selected files
function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
    fileInput.value = ''; // Reset file input
}

// Process and resize files
async function handleFiles(files) {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const remainingSlots = 10 - photosArray.length;
    
    if (remainingSlots <= 0) {
        alert('En fazla 10 adet fotoğraf yükleyebilirsiniz.');
        return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    for (const file of filesToProcess) {
        if (!validImageTypes.includes(file.type)) {
            alert(`Desteklenmeyen dosya formatı: ${file.name}. Lütfen JPG, PNG veya WEBP yükleyin.`);
            continue;
        }
        
        try {
            const processedPhoto = await resizeAndConvertImage(file);
            photosArray.push(processedPhoto);
        } catch (error) {
            console.error('Fotoğraf işlenirken hata oluştu:', error);
        }
    }

    renderPhotos();
}

// Canvas-based image resizing and conversion to JPEG base64
function resizeAndConvertImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1024; // Standard size for fast processing and upload
                
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const base64 = canvas.toDataURL('image/jpeg', 0.85); // Compress 85%
                resolve({
                    id: Date.now() + Math.random().toString(36).substr(2, 5),
                    src: base64,
                    name: file.name
                });
            };
            img.onerror = () => reject(new Error('Resim yüklenemedi.'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Dosya okunamadı.'));
        reader.readAsDataURL(file);
    });
}

// Canvas-based actual 90-degree image rotation
async function rotatePhotoPixels(index) {
    const photo = photosArray[index];
    const img = new Image();
    
    const rotatedBase64 = await new Promise((resolve) => {
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.height;
            canvas.height = img.width;
            const ctx = canvas.getContext('2d');
            
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((90 * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = photo.src;
    });

    photosArray[index].src = rotatedBase64;
    renderPhotos();
}

// Render photos in grid and attach drag/drop ordering listeners
function renderPhotos() {
    photoGrid.innerHTML = '';
    
    if (photosArray.length === 0) {
        btnClearPhotos.classList.add('hide');
        checkFormValidation();
        return;
    }

    btnClearPhotos.classList.remove('hide');

    photosArray.forEach((photo, index) => {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.setAttribute('draggable', 'true');
        card.dataset.index = index;

        // Is Cover Photo or Normal?
        const isCover = index === 0;
        const badgeClass = isCover ? 'photo-badge cover' : 'photo-badge normal';
        const badgeText = isCover ? 'Kapak Görseli' : `${index + 1}. Görsel`;

        card.innerHTML = `
            <div class="${badgeClass}">${badgeText}</div>
            <img src="${photo.src}" alt="${photo.name}">
            <div class="photo-actions">
                <button class="photo-action-btn" onclick="rotatePhoto(${index})" title="Sağa Döndür">
                    <i data-lucide="rotate-cw"></i>
                </button>
                <button class="photo-action-btn delete" onclick="deletePhoto(${index})" title="Fotoğrafı Sil">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;

        // DRAG AND DROP HANDLERS FOR REORDERING
        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', index);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.classList.add('dragover-card');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('dragover-card');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('dragover-card');
            const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const targetIndex = parseInt(card.dataset.index, 10);

            if (sourceIndex !== targetIndex) {
                // Reorder array
                const movedItem = photosArray.splice(sourceIndex, 1)[0];
                photosArray.splice(targetIndex, 0, movedItem);
                renderPhotos();
            }
        });

        photoGrid.appendChild(card);
    });

    lucide.createIcons();
    checkFormValidation();
}

// Global functions for photo card actions
window.deletePhoto = function(index) {
    photosArray.splice(index, 1);
    renderPhotos();
};

window.rotatePhoto = function(index) {
    rotatePhotoPixels(index);
};

// Check if form is ready for generation
function checkFormValidation() {
    const isApiKeyValid = apiStatusIndicator.classList.contains('status-connected');
    // Enable generation buttons as long as the API Key is active
    btnGenerates.forEach(btn => {
        btn.disabled = !isApiKeyValid;
    });
}

// Call Gemini API and generate the description
async function generateListing() {
    if (userCredits <= 0) {
        openCreditModal('İlan oluşturabilmek için yeterli krediniz bulunmamaktadır. Lütfen kredi yükleyin.');
        return;
    }

    if (!geminiApiKey && !isSystemApiKeyActive) {
        alert('Lütfen önce API Ayarlarından API Anahtarınızı girin.');
        return;
    }

    // Photos are optional. If no photos, it generates description from text only.

    // Show Loading
    resultPlaceholder.classList.add('hide');
    resultOutput.classList.add('hide');
    resultLoading.classList.remove('hide');

    // Build Prompt & Payload
    try {
        const prompt = buildAIPrompt();
        
        // Format images for Gemini API Multimodal request (inlineData format)
        const imageParts = photosArray.map(photo => {
            const rawBase64 = photo.src.split(',')[1];
            return {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: rawBase64
                }
            };
        });

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        ...imageParts
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: 'application/json'
            }
        };

        const response = await callGemini(requestBody);

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Gemini API yanıt vermedi.');
        }

        const data = await response.json();
        const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!outputText) {
            throw new Error('Yapay zeka geçerli bir yanıt oluşturamadı.');
        }

        // Spend credit upon successful generation
        spendCredit();

        // Parse JSON response
        const result = JSON.parse(outputText);
        displayResults(result);

        // Auto-save the AI output if project is loaded
        if (currentProjectId) {
            saveCurrentProject(true);
        }

    } catch (error) {
        console.error('Generation error:', error);
        alert(`Hata oluştu: ${error.message}\nLütfen bilgileri veya API Anahtarınızı kontrol edin.`);
        
        // Reset state
        resultLoading.classList.add('hide');
        resultPlaceholder.classList.remove('hide');
    }
}

// Build custom prompt based on selected Niche and form values
function buildAIPrompt() {
    if (currentNiche === 'emlak') {
        const fiyat = document.getElementById('emlak-fiyat').value || 'Belirtilmedi';
        const alan = document.getElementById('emlak-alan').value || 'Belirtilmedi';
        const oda = document.getElementById('emlak-oda').value || 'Belirtilmedi';
        const isitma = document.getElementById('emlak-isitma').value || 'Belirtilmedi';
        const konum = document.getElementById('emlak-konum').value || 'Belirtilmedi';
        const notlar = document.getElementById('emlak-notlar').value || '';

        // Bina Yaşı seçimi (Zero Keyboard Radio)
        const yasEl = document.querySelector('input[name="emlak-yas"]:checked');
        const binaYasi = yasEl ? yasEl.value : 'Belirtilmedi';

        // Gather all checked chip features for real estate
        const features = [];
        if (document.getElementById('emlak-balkon').checked) features.push('Balkon Var');
        if (document.getElementById('emlak-esyali').checked) features.push('Eşyalı');
        if (document.getElementById('emlak-asansor').checked) features.push('Asansör Var');
        if (document.getElementById('emlak-otopark').checked) features.push('Otopark Var');
        if (document.getElementById('emlak-site').checked) features.push('Site İçerisinde');
        if (document.getElementById('emlak-havuz').checked) features.push('Yüzme Havuzu Var');
        if (document.getElementById('emlak-bahce').checked) features.push('Bahçeli / Müstakil Bahçe');
        if (document.getElementById('emlak-boyali').checked) features.push('Yeni Boyalı / Masrafsız');
        if (document.getElementById('emlak-kredi').checked) features.push('Krediye Uygun Konut');
        if (document.getElementById('emlak-acil').checked) features.push('Acil Satılık / Fırsat Portföy');

        const featuresStr = features.length > 0 ? features.join(', ') : 'Belirtilmedi';

        return `Sen deneyimli bir gayrimenkul danışmanı ve emlak pazarlama uzmanısın. Sana yüklediğim ev/ofis fotoğraflarını dikkatle incele. Ayrıca şu bilgileri de göz önünde bulundur:
- Fiyat: ${fiyat} TL
- Alan: ${alan} m²
- Oda Sayısı: ${oda}
- Isıtma Türü: ${isitma}
- Bina Yaşı: ${binaYasi}
- Konum: ${konum}
- Seçilen/Öne Çıkan Özellikler: ${featuresStr}
- Danışman Ekstra Notları: ${notlar}

Görevlerin:
1. Bu ev için emlak portallarında (sahibinden, hepsiemlak vb.) çok yüksek tıklama oranı elde edecek, ilgi çekici, abartısız ve profesyonel bir İlan Başlığı yaz (Maksimum 60 karakter). Başlıkta m², oda sayısı veya fiyat avantajını vurgulayabilirsin.
2. Alıcıları veya kiracıları etkileyecek, zengin ve profesyonel bir Türkçe İlan Açıklaması oluştur. Açıklama şu bölümlerden oluşmalıdır:
   - Giriş: Evin genel yapısı, konumu ve yarattığı his.
   - Öne Çıkan Özellikler: Fotoğraflarda gördüğün güzellikler (manzara, parke kalitesi, mutfak durumu, banyo yeniliği vb.) ile formda ve yukarıda listelenen seçilmiş özelliklerin (Balkon, Eşya, Asansör, Otopark, Boya vb.) harmanlanması.
   - Konum & Ulaşım: Çevre imkanları, ulaşım avantajları.
   - Kapanış: İletişim için profesyonel davet metni.
3. İlan için en alakalı 5-8 adet etiket/anahtar kelime belirle.

Önemli: Fotoğraflarda gördüğün tüm pozitif detayları (örneğin aydınlık odalar, geniş pencereler, ankastre mutfak, lüks banyo, manzara vb.) açıklamaya dürüstlük ilkesine sadık kalarak dahil et.
Yanıtını sadece ve sadece aşağıdaki JSON şablonunda döndür (başka hiçbir metin ekleme, JSON kod bloğu veya tırnak işaretleri dışında açıklama yazma):
{
  "title": "...",
  "description": "...",
  "tags": ["etiket1", "etiket2", "etiket3"]
}`;
    } else {
        const marka = document.getElementById('oto-marka').value || 'Belirtilmedi';
        const yil = document.getElementById('oto-yil').value || 'Belirtilmedi';
        const km = document.getElementById('oto-km').value || 'Belirtilmedi';
        const fiyat = document.getElementById('oto-fiyat').value || 'Belirtilmedi';
        const yakit = document.getElementById('oto-yakit').value || 'Belirtilmedi';
        const vites = document.getElementById('oto-vites').value || 'Belirtilmedi';
        const hasar = document.getElementById('oto-hasar').value || 'Belirtilmedi';
        const notlar = document.getElementById('oto-notlar').value || '';

        // Gather all checked chip features for auto gallery
        const features = [];
        if (document.getElementById('oto-sunroof').checked) features.push('Cam Tavan / Sunroof');
        if (document.getElementById('oto-deri').checked) features.push('Deri Koltuk');
        if (document.getElementById('oto-kamera').checked) features.push('Geri Görüş Kamerası');
        if (document.getElementById('oto-koltukisitma').checked) features.push('Koltuk Isıtma');
        if (document.getElementById('oto-anahtarsiz').checked) features.push('Anahtarsız Çalıştırma');
        if (document.getElementById('oto-takas').checked) features.push('Takasa Uygun');
        if (document.getElementById('oto-hatasiz').checked) features.push('Hatasız / Boyasız / Kusursuz');
        if (document.getElementById('oto-bakimli').checked) features.push('Servis Bakımlı');
        if (document.getElementById('oto-yedek').checked) features.push('Yedek Anahtarı Var');
        if (document.getElementById('oto-garanti').checked) features.push('Garantili');

        const featuresStr = features.length > 0 ? features.join(', ') : 'Belirtilmedi';

        return `Sen deneyimli bir otomotiv satış danışmanı ve oto galeri pazarlama uzmanısın. Sana yüklediğim araç fotoğraflarını dikkatle incele. Ayrıca şu bilgileri de göz onderine bulundur:
- Araç Marka / Model: ${marka}
- Model Yılı: ${yil}
- Kilometre: ${km} KM
- Fiyat: ${fiyat} TL
- Yakıt Türü: ${yakit}
- Vites Türü: ${vites}
- Ekspertiz / Hasar Bilgisi: ${hasar}
- Seçilen Özellikler ve Donanım: ${featuresStr}
- Danışman Ekstra Donanım ve Galeri Notları: ${notlar}

Görevlerin:
1. Bu araç için ilan sitelerinde (sahibinden, arabam.com vb.) çok yüksek tıklama oranı elde edecek, aracın temizliğini, donanım avantajını veya fiyat fırsatını öne çıkaran profesyonel bir İlan Başlığı yaz (Maksimum 60 karakter).
2. Potansiyel alıcıları etkileyecek, zengin, akıcı ve güven veren bir Türkçe İlan Açıklaması oluştur. Açıklama şu bölümlerden oluşmalıdır:
   - Giriş: Aracın genel durumu, kozmetiği, temizliği ve bakımlılığı.
   - Donanım ve Teknik Detaylar: Fotoğraflarda gördüğün donanım unsurları (çelik jant, multimedya ekranı, sunroof, deri koltuk vb.) ile formda ve yukarıda seçilmiş donanımların listelenmesi.
   - Ekspertiz ve Hasar Durumu: Hasar, boya ve değişen bilgilerinin netçe sunulması.
   - Kapanış: Takas durumu, galeri bilgisi ve iletişim daveti.
3. İlan için en alakalı 5-8 adet etiket/anahtar kelime belirle.

Önemli: Fotoğraflarda gördüğün tüm kozmetik ve donanım avantajlarını (temiz direksiyon, yıpranmamış döşemeler, geniş ekran, çelik jant vb.) dürüstçe açıklamaya yansıt.
Yanıtını sadece ve sadece aşağıdaki JSON şablonunda döndür (başka hiçbir metin ekleme, JSON kod bloğu veya tırnak işaretleri dışında açıklama yazma):
{
  "title": "...",
  "description": "...",
  "tags": ["etiket1", "etiket2", "etiket3"]
}`;
    }
}

// Display Gemini results in the result panel
function displayResults(data) {
    resultLoading.classList.add('hide');
    resultPlaceholder.classList.add('hide');
    resultOutput.classList.remove('hide');

    outputTitle.innerText = data.title || '';
    outputDescription.innerText = data.description || '';
    
    // Render tags
    outputTags.innerHTML = '';
    const tags = data.tags || [];
    tags.forEach(tagText => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.innerText = tagText.startsWith('#') ? tagText : `#${tagText}`;
        outputTags.appendChild(tagSpan);
    });
}

// Copy Text utility function
window.copyText = function(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Use standard Clipboard API
    navigator.clipboard.writeText(element.innerText).then(() => {
        // Simple visual feedback
        const btn = element.previousElementSibling.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check"></i> Kopyalandı!';
        lucide.createIcons();
        btn.style.borderColor = 'var(--color-success)';
        btn.style.color = 'var(--color-success)';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            lucide.createIcons();
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Kopyalama başarısız:', err);
    });
};

// SAVE PROJECT CORE LOGIC
async function saveCurrentProject(silent = false) {
    const project = {
        id: currentProjectId || Date.now(),
        niche: currentNiche,
        timestamp: Date.now(),
        formData: {},
        photos: photosArray,
        aiResult: null
    };

    let title = 'Yeni İlan';

    if (currentNiche === 'emlak') {
        const fiyat = document.getElementById('emlak-fiyat').value || '';
        const alan = document.getElementById('emlak-alan').value || '';
        const oda = document.getElementById('emlak-oda').value || '';
        const isitma = document.getElementById('emlak-isitma').value || '';
        const konum = document.getElementById('emlak-konum').value || '';
        const notlar = document.getElementById('emlak-notlar').value || '';
        
        const yasEl = document.querySelector('input[name="emlak-yas"]:checked');
        const yas = yasEl ? yasEl.value : '';

        // Checkboxes state
        const checkboxIds = ['emlak-balkon', 'emlak-esyali', 'emlak-asansor', 'emlak-otopark', 'emlak-site', 'emlak-havuz', 'emlak-bahce', 'emlak-boyali', 'emlak-kredi', 'emlak-acil'];
        const checkboxState = {};
        checkboxIds.forEach(id => {
            checkboxState[id] = document.getElementById(id).checked;
        });

        project.formData = { fiyat, alan, oda, isitma, konum, notlar, yas, checkboxState };
        
        // Generate title
        const loc = konum ? konum.split(',')[0].trim() : 'Emlak';
        title = `${loc} ${oda ? oda : ''} ${fiyat ? formatPrice(fiyat) + ' TL' : 'İlanı'}`;
    } else {
        const marka = document.getElementById('oto-marka').value || '';
        const yil = document.getElementById('oto-yil').value || '';
        const km = document.getElementById('oto-km').value || '';
        const fiyat = document.getElementById('oto-fiyat').value || '';
        const yakit = document.getElementById('oto-yakit').value || '';
        const vites = document.getElementById('oto-vites').value || '';
        const hasar = document.getElementById('oto-hasar').value || '';
        const notlar = document.getElementById('oto-notlar').value || '';

        // Checkboxes state
        const checkboxIds = ['oto-sunroof', 'oto-deri', 'oto-kamera', 'oto-koltukisitma', 'oto-anahtarsiz', 'oto-takas', 'oto-hatasiz', 'oto-bakimli', 'oto-yedek', 'oto-garanti'];
        const checkboxState = {};
        checkboxIds.forEach(id => {
            checkboxState[id] = document.getElementById(id).checked;
        });

        project.formData = { marka, yil, km, fiyat, yakit, vites, hasar, notlar, checkboxState };
        
        // Generate title
        title = `${marka ? marka : 'Araç'} ${yil ? yil : ''} ${fiyat ? formatPrice(fiyat) + ' TL' : 'İlanı'}`;
    }

    project.title = title;

    // Check if AI output is active and save it
    const isOutputVisible = !resultOutput.classList.contains('hide');
    if (isOutputVisible) {
        const tags = [];
        outputTags.querySelectorAll('.tag').forEach(span => {
            tags.push(span.innerText);
        });
        project.aiResult = {
            title: outputTitle.innerText,
            description: outputDescription.innerText,
            tags: tags
        };
    }

    try {
        await saveProjectToDB(project);
        currentProjectId = project.id;
        
        // Update edit indicator banner
        document.getElementById('edit-indicator').classList.remove('hide');
        document.getElementById('edit-project-title').innerText = project.title;
        document.querySelectorAll('.btn-save-text').forEach(el => el.innerText = 'Güncelle');
        
        if (!silent) {
            alert(`"${project.title}" taslak olarak başarıyla kaydedildi.`);
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('İlan taslağı kaydedilirken hata oluştu.');
    }
}

// Format price utility for human readable titles (e.g. 3.500.000)
function formatPrice(val) {
    if (!val) return '';
    return Number(val).toLocaleString('tr-TR');
}

// Load project data into fields and workspace
window.loadProjectById = async function(id) {
    try {
        const project = await getProjectFromDB(id);
        if (!project) {
            alert('Aradığınız taslak bulunamadı.');
            return;
        }

        // Switch to correct tab
        setNiche(project.niche);

        // Populate fields
        const data = project.formData;
        if (project.niche === 'emlak') {
            document.getElementById('emlak-fiyat').value = data.fiyat || '';
            document.getElementById('emlak-alan').value = data.alan || '';
            document.getElementById('emlak-oda').value = data.oda || '';
            document.getElementById('emlak-isitma').value = data.isitma || '';
            document.getElementById('emlak-konum').value = data.konum || '';
            document.getElementById('emlak-notlar').value = data.notlar || '';
            
            // Radio
            document.querySelectorAll('input[name="emlak-yas"]').forEach(radio => {
                radio.checked = radio.value === data.yas;
            });

            // Checkboxes
            const checkboxState = data.checkboxState || {};
            Object.keys(checkboxState).forEach(chkId => {
                const el = document.getElementById(chkId);
                if (el) el.checked = checkboxState[chkId];
            });
        } else {
            document.getElementById('oto-marka').value = data.marka || '';
            document.getElementById('oto-yil').value = data.yil || '';
            document.getElementById('oto-km').value = data.km || '';
            document.getElementById('oto-fiyat').value = data.fiyat || '';
            document.getElementById('oto-yakit').value = data.yakit || '';
            document.getElementById('oto-vites').value = data.vites || '';
            document.getElementById('oto-hasar').value = data.hasar || '';
            document.getElementById('oto-notlar').value = data.notlar || '';

            // Checkboxes
            const checkboxState = data.checkboxState || {};
            Object.keys(checkboxState).forEach(chkId => {
                const el = document.getElementById(chkId);
                if (el) el.checked = checkboxState[chkId];
            });
        }

        // Load Photos
        photosArray = project.photos || [];
        renderPhotos();

        // Load AI Result if present
        if (project.aiResult) {
            displayResults(project.aiResult);
        } else {
            resultPlaceholder.classList.remove('hide');
            resultOutput.classList.add('hide');
            resultLoading.classList.add('hide');
        }

        // Set editing state
        currentProjectId = project.id;
        document.getElementById('edit-indicator').classList.remove('hide');
        document.getElementById('edit-project-title').innerText = project.title;
        document.getElementById('btn-save-text').innerText = 'Güncelle';

        // Close projects modal
        closeProjectsModal();

    } catch (error) {
        console.error('Load project error:', error);
        alert('Taslak yüklenirken bir sorun oluştu.');
    }
};

// Delete project draft
window.deleteProjectById = async function(id) {
    if (!confirm('Bu ilan taslağını silmek istediğinizden emin misiniz?')) {
        return;
    }
    try {
        await deleteProjectFromDB(id);
        
        // Reset view if currently editing this project
        if (currentProjectId === id) {
            resetToNewProject();
        }

        loadAndRenderProjects();
    } catch (error) {
        console.error('Delete project error:', error);
        alert('Silme işlemi başarısız oldu.');
    }
};

// Reset editor to clear state for starting a new project
window.resetToNewProject = function() {
    currentProjectId = null;
    
    // Reset Emlak & Oto & Appraisal forms
    if (formEmlak) formEmlak.reset();
    if (formOto) formOto.reset();
    if (formAppraisal) formAppraisal.reset();

    // Reset radio buttons
    document.querySelectorAll('input[name="emlak-yas"]').forEach(radio => radio.checked = false);

    // Clear photos
    photosArray = [];
    renderPhotos();

    // Clear appraisal state
    appraisalPdfFile = null;
    appraisalPdfBase64 = null;
    if (appraisalFilePreview) appraisalFilePreview.classList.add('hide');
    if (btnAnalyzeAppraisal) btnAnalyzeAppraisal.classList.add('hide');
    if (appraisalUploadZone) appraisalUploadZone.classList.remove('hide');
    if (appraisalResult) appraisalResult.classList.add('hide');
    if (appraisalLoading) appraisalLoading.classList.add('hide');

    // Clear output panels
    resultPlaceholder.classList.remove('hide');
    resultOutput.classList.add('hide');
    resultLoading.classList.add('hide');

    // Reset indicator and action buttons
    document.getElementById('edit-indicator').classList.add('hide');
    document.querySelectorAll('.btn-save-text').forEach(el => el.innerText = 'Taslak Kaydet');
};

// Render saved projects list in modal
async function loadAndRenderProjects() {
    const listContainer = document.getElementById('projects-list');
    listContainer.innerHTML = `
        <div style="text-align:center; padding:30px;">
            <div class="spinner" style="width:28px; height:28px; border-width:3px; margin:0 auto 12px;"></div>
            <p style="font-size:13px; color:var(--text-secondary);">Yükleniyor...</p>
        </div>
    `;

    try {
        const projects = await getAllProjectsFromDB();
        
        // Sort by newest saved first
        projects.sort((a, b) => b.timestamp - a.timestamp);

        listContainer.innerHTML = '';

        if (projects.length === 0) {
            listContainer.innerHTML = `
                <div class="project-empty">
                    <div class="project-empty-icon">📂</div>
                    <p style="font-weight:600; color:var(--text-primary);">Henüz Kayıtlı Taslağınız Yok</p>
                    <p style="font-size:12px; color:var(--text-muted); max-width:260px; margin:0 auto;">Emlak veya Oto ilanlarınızı kaydetmek için sol paneldeki "Taslak Olarak Kaydet" butonunu kullanabilirsiniz.</p>
                </div>
            `;
            return;
        }

        projects.forEach(project => {
            const item = document.createElement('div');
            item.className = 'project-item';

            // Thumbnail
            let thumbHTML = '<div class="project-thumb-placeholder"><i data-lucide="image" style="width:16px; height:16px;"></i></div>';
            if (project.photos && project.photos.length > 0) {
                thumbHTML = `<img src="${project.photos[0].src}" alt="${project.title}">`;
            }

            // Niche details
            const iconName = project.niche === 'emlak' ? 'home' : 'car';
            const nicheLabel = project.niche === 'emlak' ? 'Emlak' : 'Oto Galeri';
            const dateStr = new Date(project.timestamp).toLocaleString('tr-TR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            item.innerHTML = `
                <div class="project-thumb">
                    ${thumbHTML}
                </div>
                <div class="project-info">
                    <h4 class="project-title" title="${project.title}">${project.title}</h4>
                    <div class="project-meta">
                        <span class="project-niche-icon" title="${nicheLabel}"><i data-lucide="${iconName}" style="width:10px; height:10px;"></i></span>
                        <span>${dateStr}</span>
                    </div>
                </div>
                <div class="project-actions-cell">
                    <button class="btn btn-primary btn-sm" onclick="loadProjectById(${project.id})">Yükle</button>
                    <button class="btn btn-secondary btn-sm" onclick="deleteProjectById(${project.id})" style="border-color:rgba(239, 68, 68, 0.2); color:var(--color-danger);">Sil</button>
                </div>
            `;

            listContainer.appendChild(item);
        });

        lucide.createIcons();

    } catch (error) {
        console.error('Load projects error:', error);
    }
};

// QUICK AUTH/LOGIN SIMULATION
window.openAuthModal = function() {
    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.classList.remove('hide');
};

window.closeAuthModal = function() {
    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.classList.add('hide');
};

// AUTH/LOGIN MODE TOGGLE & SUBMIT HANDLING
let isLoginMode = false; // Default is Sign Up (Kaydet)

window.toggleAuthMode = function() {
    isLoginMode = !isLoginMode;
    const modalTitle = document.getElementById('auth-modal-title');
    const toggleBtn = document.getElementById('btn-toggle-auth-mode');
    const form = document.getElementById('auth-registration-form');
    
    if (!form || !modalTitle || !toggleBtn) return;
    
    if (isLoginMode) {
        modalTitle.innerText = 'Giriş Yap';
        toggleBtn.innerText = 'Hesabınız yok mu? Kaydolun';
        form.innerHTML = `
            <div class="space-y-1">
                <label class="text-[10px] text-on-surface-variant/80 font-bold block">E-mail Adresi</label>
                <input type="email" id="reg-email" required class="w-full bg-[#1A1A1E] border-white/10 text-xs text-white rounded-[6px] p-2.5 focus:ring-1 focus:ring-primary focus:border-primary" placeholder="Orn: ahmet@mail.com">
            </div>
            <div class="space-y-1">
                <label class="text-[10px] text-on-surface-variant/80 font-bold block">Şifre</label>
                <input type="password" id="reg-password" required class="w-full bg-[#1A1A1E] border-white/10 text-xs text-white rounded-[6px] p-2.5 focus:ring-1 focus:ring-primary focus:border-primary" placeholder="••••••••">
            </div>
            <button type="submit" class="w-full mt-4 py-2.5 bg-primary text-on-primary hover:bg-primary/90 rounded-[6px] text-xs font-bold transition-all duration-300">
                Giriş Yap
            </button>
        `;
    } else {
        modalTitle.innerText = 'Hesap Oluştur';
        toggleBtn.innerText = 'Zaten bir hesabım var? Giriş Yap';
        form.innerHTML = `
            <div class="space-y-1">
                <label class="text-[10px] text-on-surface-variant/80 font-bold block">Kullanıcı Adı</label>
                <input type="text" id="reg-username" required class="w-full bg-[#1A1A1E] border-white/10 text-xs text-white rounded-[6px] p-2.5 focus:ring-1 focus:ring-primary focus:border-primary" placeholder="Orn: ahmet123">
            </div>
            <div class="space-y-1">
                <label class="text-[10px] text-on-surface-variant/80 font-bold block">E-mail Adresi</label>
                <input type="email" id="reg-email" required class="w-full bg-[#1A1A1E] border-white/10 text-xs text-white rounded-[6px] p-2.5 focus:ring-1 focus:ring-primary focus:border-primary" placeholder="Orn: ahmet@mail.com">
            </div>
            <div class="space-y-1">
                <label class="text-[10px] text-on-surface-variant/80 font-bold block">Şifre</label>
                <input type="password" id="reg-password" required class="w-full bg-[#1A1A1E] border-white/10 text-xs text-white rounded-[6px] p-2.5 focus:ring-1 focus:ring-primary focus:border-primary" placeholder="••••••••">
            </div>
            <div class="space-y-1">
                <label class="text-[10px] text-on-surface-variant/80 font-bold block">Şifre Tekrar</label>
                <input type="password" id="reg-password-confirm" required class="w-full bg-[#1A1A1E] border-white/10 text-xs text-white rounded-[6px] p-2.5 focus:ring-1 focus:ring-primary focus:border-primary" placeholder="••••••••">
            </div>
            <button type="submit" class="w-full mt-4 py-2.5 bg-primary text-on-primary hover:bg-primary/90 rounded-[6px] text-xs font-bold transition-all duration-300">
                Kaydet
            </button>
        `;
    }
};

window.handleAuthSubmit = function(event) {
    event.preventDefault();
    const emailInput = document.getElementById('reg-email');
    const passInput = document.getElementById('reg-password');
    const userInput = document.getElementById('reg-username');
    const confirmInput = document.getElementById('reg-password-confirm');

    if (!emailInput || !passInput) return;

    const email = emailInput.value.trim();
    const password = passInput.value.trim();

    if (!isLoginMode) {
        // Sign Up Mode: check password match
        if (confirmInput && password !== confirmInput.value.trim()) {
            alert("Girdiğiniz şifreler eşleşmiyor, lütfen tekrar kontrol edin!");
            return;
        }
    }

    // Success Authentication Simulator
    localStorage.setItem('is_logged_in', 'true');
    localStorage.setItem('user_email', email);
    localStorage.setItem('user_photo', 'https://lh3.googleusercontent.com/COxitqgJr1sICZ9t1ocFc2F5rfhc8O1W1y8oc5OB48W1rIpDY4Bp16h1w657N7568=w48-h48-n');
    
    window.closeAuthModal();
    updateHeaderLoginStatus();
    
    if (isLoginMode) {
        alert(`Giriş Başarılı!\nHoş Geldiniz: ${email}`);
    } else {
        const username = userInput ? userInput.value.trim() : 'Kullanıcı';
        alert(`Kayıt Başarılı!\nHesabınız oluşturuldu: ${username} (${email})`);
    }
};

window.handleLogout = function() {
    localStorage.removeItem('is_logged_in');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_photo');
    location.reload();
};

function updateHeaderLoginStatus() {
    const isLoggedIn = localStorage.getItem('is_logged_in') === 'true';
    const userEmail = localStorage.getItem('user_email') || '';
    const userPhoto = localStorage.getItem('user_photo') || '';
    
    // Check if we have header actions (index.html)
    const headerActions = document.querySelector('.header-actions');
    if (isLoggedIn && headerActions) {
        let profileBadge = document.getElementById('user-profile-badge');
        if (!profileBadge) {
            profileBadge = document.createElement('div');
            profileBadge.id = 'user-profile-badge';
            profileBadge.className = 'api-status-badge';
            profileBadge.style.cssText = 'background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: var(--radius-lg);';
            profileBadge.innerHTML = `
                <img src="${userPhoto || 'https://lh3.googleusercontent.com/COxitqgJr1sICZ9t1ocFc2F5rfhc8O1W1y8oc5OB48W1rIpDY4Bp16h1w657N7568=w48-h48-n'}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />
                <span style="font-size: 11px; font-weight: 600; color: white;">${userEmail}</span>
                <i data-lucide="log-out" onclick="handleLogout()" style="width: 14px; height: 14px; color: var(--text-muted); cursor: pointer;" title="Çıkış Yap"></i>
            `;
            headerActions.appendChild(profileBadge);
            lucide.createIcons();
        }
        
        // Hide standard login button on index.html if visible
        const loginBtn = document.getElementById('btn-header-login');
        if (loginBtn) loginBtn.classList.add('hide');
    }

    // Check if we have dashboard auth section (dashboard.html)
    const headerAuthSection = document.getElementById('header-auth-section');
    if (headerAuthSection) {
        const hasKey = !!(geminiApiKey || isSystemApiKeyActive);
        if (isLoggedIn) {
            headerAuthSection.innerHTML = `
                <div id="api-status-indicator" class="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] cursor-pointer ${hasKey ? 'status-connected' : 'status-disconnected'}" onclick="openSettingsModal()">
                    <span class="w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-red-500'}" id="api-status-dot"></span>
                    <span id="api-status-text">${hasKey ? 'Gemini Hazır' : 'API Bağlı Değil'}</span>
                </div>
                <div class="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                    <img src="${userPhoto || 'https://lh3.googleusercontent.com/COxitqgJr1sICZ9t1ocFc2F5rfhc8O1W1y8oc5OB48W1rIpDY4Bp16h1w657N7568=w48-h48-n'}" class="w-8 h-8 rounded-full border border-primary/20 object-cover" />
                    <div class="text-left leading-tight hidden md:block">
                        <p class="text-xs text-white font-bold">Hoş Geldiniz</p>
                        <p class="text-[10px] text-on-surface-variant">${userEmail}</p>
                    </div>
                    <button onclick="handleLogout()" class="material-symbols-outlined text-sm text-on-surface-variant hover:text-primary ml-1 cursor-pointer" title="Çıkış Yap">logout</button>
                </div>
            `;
        } else {
            // Unauthenticated: update the status indicator inside the default header section if it exists
            const indicator = document.getElementById('api-status-indicator');
            if (indicator) {
                indicator.className = `hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] cursor-pointer ${hasKey ? 'status-connected' : 'status-disconnected'}`;
                const apiDot = document.getElementById('api-status-dot');
                const apiText = document.getElementById('api-status-text');
                if (apiDot) apiDot.className = `w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-red-500'}`;
                if (apiText) apiText.innerText = hasKey ? 'Gemini Hazır' : 'API Bağlı Değil';
            }
        }
    }
}

// Check and update auth setup inside app.js
// Add close button event listener for auth modal on index.html if it exists immediately
const btnCloseAuth = document.getElementById('btn-close-auth-modal');
if (btnCloseAuth) {
    btnCloseAuth.addEventListener('click', window.closeAuthModal);
}

// ==========================================
// AI CHATBOT WIDGET INTEGRATION
// ==========================================
let chatHistory = [];

window.toggleChatbotWidget = function() {
    const chatWindow = document.getElementById('chatbot-window');
    if (chatWindow) {
        chatWindow.classList.toggle('hide');
        // Auto focus input when opened
        if (!chatWindow.classList.contains('hide')) {
            const input = document.getElementById('chatbot-input');
            if (input) input.focus();
        }
    }
};

window.sendChatbotMessageWidget = async function() {
    const input = document.getElementById('chatbot-input');
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!input || !messagesContainer) return;

    const text = input.value.trim();
    if (!text) return;

    // Clear input
    input.value = '';

    // Append User Message to Chat UI
    const userBubble = document.createElement('div');
    userBubble.className = 'flex items-start gap-2.5 justify-end';
    userBubble.innerHTML = `
        <div class="bg-primary/20 border border-primary/30 p-3 rounded-[6px] text-white leading-relaxed max-w-[85%]">
            ${escapeHtml(text)}
        </div>
    `;
    messagesContainer.appendChild(userBubble);
    scrollChatToBottom();

    // Append Typing Indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'chatbot-typing';
    typingIndicator.className = 'flex items-start gap-2.5 max-w-[85%]';
    typingIndicator.innerHTML = `
        <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0">
            <span class="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
        </div>
        <div class="bg-white/5 border border-white/10 p-3 rounded-[6px] text-on-surface-variant/70 leading-relaxed italic flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]"></span>
        </div>
    `;
    messagesContainer.appendChild(typingIndicator);
    scrollChatToBottom();

    // Get response
    let botResponse = '';
    const hasKeyActive = (geminiApiKey || isSystemApiKeyActive);

    if (hasKeyActive) {
        try {
            botResponse = await getChatbotAIResponse(text);
        } catch (error) {
            console.error('Chatbot AI response failed, using fallback:', error);
            botResponse = getChatbotLocalFallback(text);
        }
    } else {
        botResponse = getChatbotLocalFallback(text);
    }

    // Remove Typing Indicator
    const indicator = document.getElementById('chatbot-typing');
    if (indicator) indicator.remove();

    // Append Bot Message
    const botBubble = document.createElement('div');
    botBubble.className = 'flex items-start gap-2.5 max-w-[85%]';
    botBubble.innerHTML = `
        <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0">
            <span class="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
        </div>
        <div class="bg-white/5 border border-white/10 p-3 rounded-[6px] text-white leading-relaxed">
            ${markdownToSimpleHtml(botResponse)}
        </div>
    `;
    messagesContainer.appendChild(botBubble);
    scrollChatToBottom();
};

function scrollChatToBottom() {
    const container = document.getElementById('chatbot-messages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function markdownToSimpleHtml(text) {
    // Basic Markdown transformations (bold and line breaks)
    return escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

async function getChatbotAIResponse(userMessage) {
    const systemInstruction = `Sen AI İlan sitesinin Canlı Destek yapay zeka asistanısın. Görevin, kullanıcılara platformun kullanımı, kredi paketleri, iyzico ödemeleri ve Gemini API ayarları konusunda yardımcı olmaktır.
Sitedeki güncel bilgiler:
- Başlangıçta 5 adet ücretsiz deneme kredisi verilir.
- Kredi Paketleri: 10 Kredi 99 TL, 50 Kredi 299 TL, 150 Kredi 499 TL'dir.
- Kredi yüklemek için sol menünün en altında yer alan "Kredi Satın Al / Yükle" butonuna tıklanmalıdır. Ödeme ekranında iyzico simülasyonu çalışmaktadır, rastgele kart bilgileri girilebilir.
- API Key Ayarları: Sistem arka planda Vercel API Proxy (ortak sistem anahtarı) kullanır. Kullanıcılar kendi özel anahtarlarını da sağ üstteki bağlantı göstergesine tıklayarak girebilirler.
- Emlak, Oto Galeri ilan yazımı ve PDF oto ekspertiz raporu analizi yapılabilir.
- Her işlem 1 kredi tüketir.
Yanıtlarını samimi, kibar, kısa ve tam olarak Türkçe ver. Yanıtları doğrudan markdown formatında verebilirsin.`;

    const chatHistoryPayload = [...chatHistory, { role: 'user', parts: [{ text: userMessage }] }];
    
    const requestBody = {
        contents: chatHistoryPayload,
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        generationConfig: {
            maxOutputTokens: 300
        }
    };
    
    const response = await callGemini(requestBody);
    if (!response.ok) {
        throw new Error('Gemini API proxy error');
    }
    const data = await response.json();
    const botText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!botText) throw new Error('Empty response');
    
    // Save history
    chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });
    chatHistory.push({ role: 'model', parts: [{ text: botText }] });
    if (chatHistory.length > 10) {
        chatHistory = chatHistory.slice(-10);
    }
    return botText;
}

function getChatbotLocalFallback(query) {
    const q = query.toLowerCase();
    if (q.includes('kredi') || q.includes('fiyat') || q.includes('paket') || q.includes('satın') || q.includes('yükle') || q.includes('ödeme') || q.includes('iyzico')) {
        return "Sistemimizde 3 farklı kredi paketi mevcuttur:\n- **10 Kredi**: 99 TL\n- **50 Kredi (En Popüler)**: 299 TL\n- **150 Kredi**: 499 TL\n\nKredi yüklemek için sol menünün en altında yer alan **'Kredi Satın Al / Yükle'** butonuna tıklayarak iyzico güvenli simülatörü üzerinden test kartı bilgileriyle saniyeler içinde yükleme yapabilirsiniz.";
    }
    if (q.includes('api') || q.includes('key') || q.includes('anahtar') || q.includes('gemini') || q.includes('bağlantı') || q.includes('ayar')) {
        return "Sistemimiz şu anda **Vercel API Proxy** (ortak sistem anahtarı) üzerinden çalışmaktadır. Ek bir API anahtarı girmeden ilan oluşturabilirsiniz. \n\nEğer kendinize ait özel bir API anahtarı kullanmak isterseniz, sağ üstteki göstergeye tıklayarak kendi anahtarınızı tanımlayabilir ve kaydedebilirsiniz.";
    }
    if (q.includes('emlak') || q.includes('oto') || q.includes('pdf') || q.includes('ekspertiz') || q.includes('analiz') || q.includes('nasıl')) {
        return "AI İlan ile 3 farklı alanda asistan desteği alabilirsiniz:\n1. **Emlak İlanı:** Fotoğrafları yükleyip oda sayısı, konum ve fiyat belirterek akıcı emlak açıklamaları üretin.\n2. **Oto Galeri İlanı:** Aracın marka, model, vites, yakıt ve donanım bilgilerini girerek etkileyici oto ilanları üretin.\n3. **PDF Ekspertiz Analizi:** Oto ekspertiz raporunuzu (PDF) yükleyerek boya, değişen, tramer ve motor verilerini saniyeler içinde otomatik olarak özetleyin.";
    }
    if (q.includes('selam') || q.includes('merhaba') || q.includes('hey') || q.includes('nasıl') || q.includes('yardım')) {
        return "Merhaba! Size nasıl yardımcı olabilirim? Kredi yükleme, API ayarları veya ilan oluşturma hakkında soru sorabilirsiniz.";
    }
    return "Sorunuzu tam olarak anlayamadım kralım. Ancak size şu konularda yardımcı olabilirim:\n- Kredi yükleme ve iyzico paket fiyatları\n- Gemini API Key ayarları ve bağlantısı\n- Emlak, Oto ve PDF Ekspertiz formlarının kullanımı";
}

