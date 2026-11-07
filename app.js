/**
 * CiritTerm - Tıbbi Terminoloji Sınav Hazırlık Platformu
 * Geliştirici & Hazırlayan: Süleyman Cirit
 * Vercel Uyumlu, Çok Kullanıcılı (Her öğrenci için bağımsız yıldızlılar),
 * 100 & 200 soruluk sınav modlu, bakarak yazma pratikli modern web uygulaması.
 */

(function () {
  'use strict';

  // --- Veri Kaynağı ---
  const allTerms = window.NORMALIZED_TERMS || [];

  // --- Kullanıcı / Profil & LocalStorage Sistemi ---
  const STORAGE_KEY_PROFILES = 'ciritterm_profiles_v1';
  const STORAGE_KEY_ACTIVE_USER = 'ciritterm_active_user_v1';

  let activeUser = localStorage.getItem(STORAGE_KEY_ACTIVE_USER) || 'Süleyman';
  let profileList = getSavedProfiles();

  function getSavedProfiles() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROFILES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Profil okuma hatası:', e);
    }
    return ['Süleyman', 'Arkadaş 1'];
  }

  function saveProfiles(profiles) {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
    } catch (e) {
      console.warn('Profil kayıt hatası:', e);
    }
  }

  function setActiveUser(name) {
    if (!name) return;
    activeUser = name.trim();
    localStorage.setItem(STORAGE_KEY_ACTIVE_USER, activeUser);
    if (!profileList.includes(activeUser)) {
      profileList.push(activeUser);
      saveProfiles(profileList);
    }
    updateProfileUI();
    updateFilterCounts();
    renderCurrentTab();
    showToast(`Aktif öğrenci profili: ${activeUser}`, 'info');
  }

  function getUserFavStorageKey() {
    return `ciritterm_favs_${activeUser.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }

  function getUserFavorites() {
    try {
      const saved = localStorage.getItem(getUserFavStorageKey());
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Favori okuma hatası:', e);
    }
    return [];
  }

  function saveUserFavorites(favs) {
    try {
      localStorage.setItem(getUserFavStorageKey(), JSON.stringify(favs));
    } catch (e) {
      console.warn('Favori kayıt hatası:', e);
    }
    updateFilterCounts();
  }

  function toggleFavorite(termId) {
    let favs = getUserFavorites();
    const index = favs.indexOf(termId);
    let isNowFav = false;
    if (index > -1) {
      favs.splice(index, 1);
    } else {
      favs.push(termId);
      isNowFav = true;
    }
    saveUserFavorites(favs);
    return isNowFav;
  }

  function isFavorite(termId) {
    return getUserFavorites().includes(termId);
  }

  // --- UI Yardımcıları (Toast) ---
  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast-notification show ${type}`;
    setTimeout(() => {
      toast.className = 'toast-notification';
    }, 2400);
  }

  // --- Genel Durum (State) ---
  let activeTab = 'flashcards';
  let activeFilter = 'all';

  // Bilgi Kartları Durumu
  let fcIndex = 0;
  let fcIsFlipped = false;
  let fcAutoplayInterval = null;
  let fcVisibleTerms = [];

  // Quiz Durumu
  let quizQuestions = [];
  let quizCurrentIndex = 0;
  let quizScore = 0;
  let quizMistakes = [];
  let quizTimerInterval = null;
  let quizTimeRemaining = 0;
  let quizTimeLimitPerQ = 0;
  let quizAnswerLocked = false;

  // Eşleştirme Oyunu Durumu
  let matchMode = 'duo'; // 'duo' veya 'grid'
  let matchTimerInterval = null;
  let matchSeconds = 0;
  let matchScore = 0;
  let matchCombo = 1;
  let duoSelectedLeftId = null;
  let duoSelectedRightId = null;
  let duoRemainingPool = [];
  let duoCurrentLeft = [];
  let duoCurrentRight = [];
  let gridCards = [];
  let gridFirstCard = null;
  let gridSecondCard = null;

  // Yazma Pratiği Durumu
  let spellIndex = 0;
  let spellTerms = [];

  // Sözlük Durumu
  let dictFilterCategory = 'all';
  let dictSearchQuery = '';
  let dictActiveLetter = '';

  // ==================== BAŞLATICI (INIT) ====================
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initProfileModal();
    initHelpModal();
    initTermDetailModal();
    initFlashcards();
    initQuiz();
    initMatch();
    initSpelling();
    initDictionary();
    initKeyboardShortcuts();

    updateProfileUI();
    updateFilterCounts();

    // URL parametresi veya hash ile doğrudan sekme açma desteği (örn: ?tab=lessons veya #lessons)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const initialTab = urlParams.get('tab') || window.location.hash.replace('#', '');
      if (initialTab && document.getElementById(`tab-content-${initialTab}`)) {
        switchTab(initialTab);
      }
    } catch (_) {}

    console.log(`CiritTerm Başlatıldı. Toplam ${allTerms.length} tıbbi terim yüklendi. Aktif Öğrenci: ${activeUser}`);
  });

  // ==================== NAVİGASYON (TABS) ====================
  function initNavigation() {
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });
  }

  function switchTab(tabId) {
    if (activeTab === tabId) return;

    // Autoplay durdur
    stopFlashcardAutoplay();

    activeTab = tabId;

    document.querySelectorAll('.nav-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('active', c.id === `tab-content-${tabId}`);
    });

    renderCurrentTab();
  }

  function renderCurrentTab() {
    if (activeTab === 'flashcards') {
      loadFlashcard(fcIndex);
    } else if (activeTab === 'spelling') {
      loadSpellingItem(spellIndex);
    } else if (activeTab === 'dictionary') {
      renderDictionaryGrid();
    } else if (activeTab === 'match') {
      initMatchGame();
    }
  }

  // ==================== FİLTRELEME & SAYAÇLAR ====================
  function getFilteredTerms(scope = activeFilter) {
    if (scope === 'all') return allTerms;
    if (scope === 'terim') return allTerms.filter(t => t.type === 'terim');
    if (scope === 'onek') return allTerms.filter(t => t.type === 'onek');
    if (scope === 'sonek') return allTerms.filter(t => t.type === 'sonek');
    if (scope === 'favorites') {
      const favIds = getUserFavorites();
      return allTerms.filter(t => favIds.includes(t.id));
    }
    return allTerms;
  }

  function updateFilterCounts() {
    const countAll = allTerms.length;
    const countTerim = allTerms.filter(t => t.type === 'terim').length;
    const countOnek = allTerms.filter(t => t.type === 'onek').length;
    const countSonek = allTerms.filter(t => t.type === 'sonek').length;
    const countFav = getUserFavorites().length;

    const elBadgeTotal = document.getElementById('badge-total-terms');
    if (elBadgeTotal) elBadgeTotal.textContent = countAll;

    const elAll = document.getElementById('count-all');
    if (elAll) elAll.textContent = countAll;

    const elTerim = document.getElementById('count-terim');
    if (elTerim) elTerim.textContent = countTerim;

    const elOnek = document.getElementById('count-onek');
    if (elOnek) elOnek.textContent = countOnek;

    const elSonek = document.getElementById('count-sonek');
    if (elSonek) elSonek.textContent = countSonek;

    const elFav = document.getElementById('count-favorites');
    if (elFav) elFav.textContent = countFav;

    const elUserFavLabel = document.getElementById('user-fav-label');
    if (elUserFavLabel) elUserFavLabel.textContent = activeUser;
  }

  // ==================== PROFİL & KULLANICI SEÇİCİ ====================
  function initProfileModal() {
    const btnOpen = document.getElementById('btn-open-profile-modal');
    const modal = document.getElementById('modal-profile');
    const btnClose = document.getElementById('btn-close-profile-modal');
    const btnAdd = document.getElementById('btn-add-profile');
    const inputName = document.getElementById('new-profile-name-input');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        renderProfileModalList();
        modal.style.display = 'flex';
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    if (btnAdd && inputName) {
      const handleAdd = () => {
        const val = inputName.value.trim();
        if (val) {
          if (!profileList.includes(val)) {
            profileList.push(val);
            saveProfiles(profileList);
          }
          inputName.value = '';
          setActiveUser(val);
          renderProfileModalList();
        }
      };

      btnAdd.addEventListener('click', handleAdd);
      inputName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAdd();
      });
    }
  }

  function updateProfileUI() {
    const elAvatar = document.getElementById('header-profile-avatar');
    const elName = document.getElementById('header-profile-name');
    const elModalCurName = document.getElementById('modal-current-user-name');

    const firstChar = activeUser.charAt(0).toUpperCase() || 'Ö';
    if (elAvatar) elAvatar.textContent = firstChar;
    if (elName) elName.textContent = activeUser;
    if (elModalCurName) elModalCurName.textContent = activeUser;
  }

  function renderProfileModalList() {
    const container = document.getElementById('profile-items-container');
    if (!container) return;
    container.innerHTML = '';

    profileList.forEach(name => {
      const row = document.createElement('div');
      row.className = `profile-item-row ${name === activeUser ? 'active' : ''}`;

      const favCount = (JSON.parse(localStorage.getItem(`ciritterm_favs_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`) || '[]')).length;

      row.innerHTML = `
        <div class="profile-item-left">
          <div class="profile-avatar" style="width:24px;height:24px;font-size:0.7rem;">${name.charAt(0).toUpperCase()}</div>
          <span style="font-weight:700;font-size:0.9rem;">${escapeHTML(name)}</span>
        </div>
        <span class="profile-item-badge">⭐ ${favCount} Yıldızlı</span>
      `;

      row.addEventListener('click', () => {
        setActiveUser(name);
        document.getElementById('modal-profile').style.display = 'none';
      });

      container.appendChild(row);
    });
  }

  // ==================== YARDIM & REHBER MODAL ====================
  function initHelpModal() {
    const btnOpen = document.getElementById('btn-open-help-modal');
    const modal = document.getElementById('modal-help');
    const btnClose = document.getElementById('btn-close-help-modal');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => modal.style.display = 'flex');
    }
    if (btnClose) {
      btnClose.addEventListener('click', () => modal.style.display = 'none');
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }
  }

  // ==================== TERİM DETAY MODAL ====================
  let activeModalItem = null;

  function initTermDetailModal() {
    const modal = document.getElementById('modal-term-detail');
    const btnClose = document.getElementById('btn-close-detail-modal');
    const btnStar = document.getElementById('modal-dt-star');

    if (btnClose) {
      btnClose.addEventListener('click', () => modal.style.display = 'none');
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }
    if (btnStar) {
      btnStar.addEventListener('click', () => {
        if (!activeModalItem) return;
        const isNow = toggleFavorite(activeModalItem.id);
        btnStar.classList.toggle('starred', isNow);
        updateCardStarStatus();
        renderDictionaryGrid();
        showToast(isNow ? 'Yıldızlılara eklendi!' : 'Yıldızlılardan çıkarıldı.', 'info');
      });
    }
  }

  function openTermDetailModal(item) {
    activeModalItem = item;
    const modal = document.getElementById('modal-term-detail');
    if (!modal) return;

    document.getElementById('modal-dt-type').textContent = item.category || 'Tıbbi Terim';
    document.getElementById('modal-dt-term').textContent = item.term;
    document.getElementById('modal-dt-okunus').textContent = item.okunus || item.term;
    document.getElementById('modal-dt-meaning').textContent = item.meaning;
    document.getElementById('modal-dt-category').textContent = `${item.category} • ${item.subCategory || 'Genel'}`;

    const btnStar = document.getElementById('modal-dt-star');
    if (btnStar) {
      btnStar.classList.toggle('starred', isFavorite(item.id));
    }

    modal.style.display = 'flex';
  }

  // ==================== TAB 1: BİLGİ KARTLARI ====================
  function initFlashcards() {
    // Filtre çipleri
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.getAttribute('data-filter');
        fcIndex = 0;
        loadFlashcard(fcIndex);
      });
    });

    // Kart çevirme (Tıkla)
    const cardEl = document.getElementById('main-flashcard');
    if (cardEl) {
      cardEl.addEventListener('click', (e) => {
        // Yıldız butonuna tıklandıysa çevirme
        if (e.target.closest('#btn-fc-star')) return;
        flipFlashcard();
      });
    }

    // Çevir butonu
    const btnFlip = document.getElementById('btn-fc-flip');
    if (btnFlip) {
      btnFlip.addEventListener('click', flipFlashcard);
    }

    // Önceki / Sonraki
    const btnPrev = document.getElementById('btn-fc-prev');
    const btnNext = document.getElementById('btn-fc-next');
    if (btnPrev) btnPrev.addEventListener('click', prevFlashcard);
    if (btnNext) btnNext.addEventListener('click', nextFlashcard);

    // Yıldızlama
    const btnStar = document.getElementById('btn-fc-star');
    if (btnStar) {
      btnStar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (fcVisibleTerms.length === 0) return;
        const currentItem = fcVisibleTerms[fcIndex];
        const isNow = toggleFavorite(currentItem.id);
        btnStar.classList.toggle('starred', isNow);
        showToast(isNow ? `"${currentItem.term}" yıldızlandı!` : `"${currentItem.term}" yıldızlılardan çıkarıldı.`, 'info');
        if (activeFilter === 'favorites' && !isNow) {
          loadFlashcard(fcIndex);
        }
      });
    }

    // Karıştır (Shuffle)
    const btnShuffle = document.getElementById('btn-fc-shuffle');
    if (btnShuffle) {
      btnShuffle.addEventListener('click', () => {
        shuffleArray(fcVisibleTerms);
        fcIndex = 0;
        loadFlashcard(fcIndex);
        showToast('Kartlar karıştırıldı!', 'info');
      });
    }

    // Otomatik Slayt (Autoplay)
    const btnAutoplay = document.getElementById('btn-fc-autoplay');
    if (btnAutoplay) {
      btnAutoplay.addEventListener('click', toggleFlashcardAutoplay);
    }

    // İlk yükleme
    loadFlashcard(0);
  }

  function loadFlashcard(index) {
    fcVisibleTerms = getFilteredTerms(activeFilter);
    const cardEl = document.getElementById('main-flashcard');
    const totalCount = fcVisibleTerms.length;

    // Kart çevrilmiş durumdaysa geri çevir
    if (cardEl && cardEl.classList.contains('flipped')) {
      cardEl.classList.remove('flipped');
      fcIsFlipped = false;
    }

    if (totalCount === 0) {
      document.getElementById('fc-term').textContent = 'Kayıt Yok';
      document.getElementById('fc-okunus').textContent = '-';
      document.getElementById('fc-meaning').textContent = activeFilter === 'favorites' ? 'Henüz yıldızlı terim eklemediniz.' : 'Filtreye uygun terim bulunamadı.';
      document.getElementById('fc-current-index').textContent = '0';
      document.getElementById('fc-total-count').textContent = '0';
      document.getElementById('fc-progress-bar').style.width = '0%';
      return;
    }

    if (index >= totalCount) index = 0;
    if (index < 0) index = totalCount - 1;
    fcIndex = index;

    const item = fcVisibleTerms[fcIndex];

    document.getElementById('fc-term').textContent = item.term;
    document.getElementById('fc-okunus').textContent = item.okunus || item.term;
    document.getElementById('fc-badge-type').textContent = item.category || 'Tıbbi Terim';

    document.getElementById('fc-back-term').textContent = item.term;
    document.getElementById('fc-meaning').textContent = item.meaning;

    // Yıldızlı durumu
    updateCardStarStatus();

    // Sayaç & Progress
    document.getElementById('fc-current-index').textContent = fcIndex + 1;
    document.getElementById('fc-total-count').textContent = totalCount;
    const pct = ((fcIndex + 1) / totalCount) * 100;
    document.getElementById('fc-progress-bar').style.width = `${pct}%`;
  }

  function flipFlashcard() {
    const cardEl = document.getElementById('main-flashcard');
    if (!cardEl || fcVisibleTerms.length === 0) return;
    fcIsFlipped = !fcIsFlipped;
    cardEl.classList.toggle('flipped', fcIsFlipped);
  }

  function nextFlashcard() {
    if (fcVisibleTerms.length === 0) return;
    loadFlashcard(fcIndex + 1);
  }

  function prevFlashcard() {
    if (fcVisibleTerms.length === 0) return;
    loadFlashcard(fcIndex - 1);
  }

  function updateCardStarStatus() {
    const btnStar = document.getElementById('btn-fc-star');
    if (!btnStar || fcVisibleTerms.length === 0) return;
    const item = fcVisibleTerms[fcIndex];
    if (item) {
      btnStar.classList.toggle('starred', isFavorite(item.id));
    }
  }

  function toggleFlashcardAutoplay() {
    if (fcAutoplayInterval) {
      stopFlashcardAutoplay();
    } else {
      startFlashcardAutoplay();
    }
  }

  function startFlashcardAutoplay() {
    const btn = document.getElementById('btn-fc-autoplay');
    const iconPlay = document.getElementById('icon-autoplay-play');
    const iconPause = document.getElementById('icon-autoplay-pause');
    const textEl = document.getElementById('text-fc-autoplay');

    if (btn) btn.classList.add('active');
    if (iconPlay) iconPlay.style.display = 'none';
    if (iconPause) iconPause.style.display = 'inline-block';
    if (textEl) textEl.textContent = 'Durdur';

    fcAutoplayInterval = setInterval(() => {
      if (!fcIsFlipped) {
        flipFlashcard();
      } else {
        nextFlashcard();
      }
    }, 2800);
  }

  function stopFlashcardAutoplay() {
    if (fcAutoplayInterval) {
      clearInterval(fcAutoplayInterval);
      fcAutoplayInterval = null;
    }
    const btn = document.getElementById('btn-fc-autoplay');
    const iconPlay = document.getElementById('icon-autoplay-play');
    const iconPause = document.getElementById('icon-autoplay-pause');
    const textEl = document.getElementById('text-fc-autoplay');

    if (btn) btn.classList.remove('active');
    if (iconPlay) iconPlay.style.display = 'inline-block';
    if (iconPause) iconPause.style.display = 'none';
    if (textEl) textEl.textContent = 'Otomatik Slayt';
  }

  // ==================== TAB 2: TEST & SINAV (10, 25, 50, 100, 200) ====================
  function initQuiz() {
    const btnStart = document.getElementById('btn-start-quiz');
    const btnQuit = document.getElementById('btn-quit-quiz');
    const btnNext = document.getElementById('btn-next-question');
    const btnRestart = document.getElementById('btn-restart-quiz');
    const btnGoFlash = document.getElementById('btn-go-flashcards');

    if (btnStart) btnStart.addEventListener('click', startQuiz);
    if (btnQuit) btnQuit.addEventListener('click', finishQuiz);
    if (btnNext) btnNext.addEventListener('click', advanceQuizQuestion);
    if (btnRestart) btnRestart.addEventListener('click', () => {
      document.getElementById('quiz-results-view').style.display = 'none';
      document.getElementById('quiz-setup-view').style.display = 'block';
    });
    if (btnGoFlash) btnGoFlash.addEventListener('click', () => switchTab('flashcards'));
  }

  function startQuiz() {
    const scope = document.getElementById('quiz-scope').value;
    const count = parseInt(document.getElementById('quiz-count').value, 10) || 25;
    const type = document.getElementById('quiz-type').value;
    quizTimeLimitPerQ = parseInt(document.getElementById('quiz-timer').value, 10) || 0;

    const pool = getFilteredTerms(scope);
    if (pool.length < 4) {
      showToast('Seçilen kapsamda en az 4 terim bulunmalıdır!', 'info');
      return;
    }

    // Rastgele soru havuzu oluştur (count kadar veya havuz boyutunda)
    const shuffled = [...pool];
    shuffleArray(shuffled);
    const selectedTerms = shuffled.slice(0, Math.min(count, pool.length));

    quizQuestions = selectedTerms.map(termObj => {
      let qType = type;
      if (qType === 'both') {
        qType = Math.random() > 0.5 ? 'term_to_meaning' : 'meaning_to_term';
      }

      // Yanıltıcı seçenekler (distractors)
      const distractors = allTerms
        .filter(t => t.id !== termObj.id && t.term && t.meaning)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      const options = [termObj, ...distractors].sort(() => 0.5 - Math.random());

      return {
        item: termObj,
        qType: qType,
        options: options,
        correctId: termObj.id
      };
    });

    quizCurrentIndex = 0;
    quizScore = 0;
    quizMistakes = [];

    document.getElementById('quiz-setup-view').style.display = 'none';
    document.getElementById('quiz-results-view').style.display = 'none';
    document.getElementById('quiz-active-view').style.display = 'block';

    document.getElementById('quiz-q-total').textContent = quizQuestions.length;
    document.getElementById('quiz-score-val').textContent = '0';

    renderQuizQuestion(quizCurrentIndex);
  }

  function renderQuizQuestion(index) {
    if (index >= quizQuestions.length) {
      finishQuiz();
      return;
    }

    quizAnswerLocked = false;
    const q = quizQuestions[index];

    // Sayaç & Progress
    document.getElementById('quiz-q-current').textContent = index + 1;
    const pct = ((index) / quizQuestions.length) * 100;
    document.getElementById('quiz-progress-fill').style.width = `${pct}%`;

    // Soru Metni
    const badgeEl = document.getElementById('quiz-prompt-badge');
    const textEl = document.getElementById('quiz-question-text');
    const subEl = document.getElementById('quiz-question-pronounce');

    if (q.qType === 'term_to_meaning') {
      badgeEl.textContent = 'Bu Tıbbi Terimin Anlamı Nedir?';
      textEl.textContent = q.item.term;
      subEl.textContent = q.item.okunus ? `Okunuş: ${q.item.okunus}` : '';
    } else {
      badgeEl.textContent = 'Bu Anlama Gelen Tıbbi Terim Hangisidir?';
      textEl.textContent = q.item.meaning;
      subEl.textContent = `Kategori: ${q.item.category}`;
    }

    // Seçenekler
    const optContainer = document.getElementById('quiz-options-container');
    optContainer.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt-btn';
      btn.setAttribute('data-id', opt.id);

      const optText = q.qType === 'term_to_meaning' ? opt.meaning : opt.term;

      btn.innerHTML = `
        <span class="quiz-opt-letter">${letters[idx]}</span>
        <span class="quiz-opt-text">${escapeHTML(optText)}</span>
      `;

      btn.addEventListener('click', () => handleQuizAnswer(opt.id, btn));
      optContainer.appendChild(btn);
    });

    // Alt Durum Çubuğunu Gizle
    const footerStatus = document.getElementById('quiz-footer-status');
    footerStatus.style.display = 'none';

    // Süre
    if (quizTimeLimitPerQ > 0) {
      startQuizTimer();
    } else {
      document.getElementById('quiz-timer-display').style.display = 'none';
    }
  }

  function handleQuizAnswer(selectedId, selectedBtn) {
    if (quizAnswerLocked) return;
    quizAnswerLocked = true;

    if (quizTimerInterval) clearInterval(quizTimerInterval);

    const q = quizQuestions[quizCurrentIndex];
    const isCorrect = selectedId === q.correctId;

    const optButtons = document.querySelectorAll('.quiz-opt-btn');
    optButtons.forEach(btn => {
      btn.disabled = true;
      if (btn.getAttribute('data-id') === q.correctId) {
        btn.classList.add('correct');
      }
    });

    if (isCorrect) {
      quizScore++;
      document.getElementById('quiz-score-val').textContent = quizScore;
    } else {
      if (selectedBtn) selectedBtn.classList.add('wrong');
      quizMistakes.push({
        question: q.qType === 'term_to_meaning' ? q.item.term : q.item.meaning,
        correct: q.qType === 'term_to_meaning' ? q.item.meaning : q.item.term,
        item: q.item
      });
    }

    // Geri Bildirim
    const footerStatus = document.getElementById('quiz-footer-status');
    const feedbackText = document.getElementById('quiz-feedback-text');
    footerStatus.style.display = 'flex';

    if (isCorrect) {
      feedbackText.textContent = '✓ Doğru Cevap!';
      feedbackText.className = 'quiz-status-feedback correct';
    } else {
      feedbackText.textContent = `✗ Yanlış! Doğru cevap: ${q.qType === 'term_to_meaning' ? q.item.meaning : q.item.term}`;
      feedbackText.className = 'quiz-status-feedback wrong';
    }

    // Otomatik veya Butonla Geçiş
    const btnNext = document.getElementById('btn-next-question');
    btnNext.focus();
  }

  function advanceQuizQuestion() {
    quizCurrentIndex++;
    renderQuizQuestion(quizCurrentIndex);
  }

  function startQuizTimer() {
    const timerDisplay = document.getElementById('quiz-timer-display');
    const timerSecs = document.getElementById('quiz-timer-seconds');
    timerDisplay.style.display = 'flex';

    if (quizTimerInterval) clearInterval(quizTimerInterval);
    quizTimeRemaining = quizTimeLimitPerQ;
    timerSecs.textContent = quizTimeRemaining;

    quizTimerInterval = setInterval(() => {
      quizTimeRemaining--;
      timerSecs.textContent = quizTimeRemaining;
      if (quizTimeRemaining <= 0) {
        clearInterval(quizTimerInterval);
        handleQuizAnswer(null, null); // Süre bitti
      }
    }, 1000);
  }

  function finishQuiz() {
    if (quizTimerInterval) clearInterval(quizTimerInterval);

    document.getElementById('quiz-active-view').style.display = 'none';
    document.getElementById('quiz-results-view').style.display = 'block';

    const total = quizQuestions.length;
    const correct = quizScore;
    const wrong = total - correct;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    document.getElementById('res-percentage').textContent = `%${pct}`;
    document.getElementById('res-correct').textContent = correct;
    document.getElementById('res-wrong').textContent = wrong;

    const iconEl = document.getElementById('results-icon');
    if (pct >= 85) iconEl.textContent = '🏆';
    else if (pct >= 60) iconEl.textContent = '👏';
    else iconEl.textContent = '📚';

    // Yanlışlar Listesi
    const mistakesContainer = document.getElementById('results-mistakes-container');
    const mistakesList = document.getElementById('results-mistakes-list');
    mistakesList.innerHTML = '';

    if (quizMistakes.length > 0) {
      mistakesContainer.style.display = 'block';
      quizMistakes.forEach(m => {
        const itemEl = document.createElement('div');
        itemEl.className = 'mistake-item';
        itemEl.innerHTML = `
          <div class="mistake-term">${escapeHTML(m.question)}</div>
          <div class="mistake-answer">Doğru Cevap: ${escapeHTML(m.correct)}</div>
        `;
        mistakesList.appendChild(itemEl);
      });
    } else {
      mistakesContainer.style.display = 'none';
    }
  }

  // ==================== TAB 3: EŞLEŞTİRME OYUNU ====================
  function initMatch() {
    const btnDuo = document.getElementById('btn-mode-duo');
    const btnGrid = document.getElementById('btn-mode-grid');
    const btnRestart = document.getElementById('btn-restart-match');

    if (btnDuo) {
      btnDuo.addEventListener('click', () => {
        matchMode = 'duo';
        btnDuo.classList.add('active');
        btnGrid.classList.remove('active');
        document.getElementById('match-duo-view').style.display = 'grid';
        document.getElementById('match-grid-view').style.display = 'none';
        initMatchGame();
      });
    }

    if (btnGrid) {
      btnGrid.addEventListener('click', () => {
        matchMode = 'grid';
        btnGrid.classList.add('active');
        btnDuo.classList.remove('active');
        document.getElementById('match-duo-view').style.display = 'none';
        document.getElementById('match-grid-view').style.display = 'grid';
        initMatchGame();
      });
    }

    if (btnRestart) btnRestart.addEventListener('click', initMatchGame);
  }

  function initMatchGame() {
    if (matchTimerInterval) clearInterval(matchTimerInterval);
    matchSeconds = 0;
    matchScore = 0;
    matchCombo = 1;
    document.getElementById('match-timer').textContent = '00:00';
    document.getElementById('match-score').textContent = '0';
    document.getElementById('match-combo').textContent = '1x';

    startMatchTimer();

    const pool = getFilteredTerms('all').filter(t => t.term && t.meaning && t.term.length <= 30 && t.meaning.length <= 50);
    const shuffled = [...pool].sort(() => 0.5 - Math.random());

    if (matchMode === 'duo') {
      initDuoMode(shuffled);
    } else {
      initGridMode(shuffled);
    }
  }

  function startMatchTimer() {
    matchTimerInterval = setInterval(() => {
      matchSeconds++;
      const mins = String(Math.floor(matchSeconds / 60)).padStart(2, '0');
      const secs = String(matchSeconds % 60).padStart(2, '0');
      document.getElementById('match-timer').textContent = `${mins}:${secs}`;
    }, 1000);
  }

  // Duolingo Akışı - Gelişmiş Versiyon (sütun karıştırma + animasyon)
  let duoIsBusy = false; // Animasyon sırasında tıklamaları engeller

  function initDuoMode(pool) {
    duoSelectedLeftId = null;
    duoSelectedRightId = null;
    duoIsBusy = false;
    duoRemainingPool = [...pool];

    duoCurrentLeft = duoRemainingPool.splice(0, 5);
    // Sağ sütun karıştırılmış olarak başlasın
    duoCurrentRight = [...duoCurrentLeft].sort(() => 0.5 - Math.random());
    // Karşı karşıya aynı satıra denk gelmesin
    _ensureRightSideNotAligned();

    renderDuoColumns(true);
  }

  // Sağ sütundaki anlamların sol sütunla aynı index'te aynı ID'ye sahip olmamasını garanti eder
  function _ensureRightSideNotAligned() {
    if (duoCurrentLeft.length <= 1) return;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < duoCurrentLeft.length; i++) {
        if (duoCurrentLeft[i] && duoCurrentRight[i] && duoCurrentLeft[i].id === duoCurrentRight[i].id) {
          const swapWith = (i + 1) % duoCurrentRight.length;
          const temp = duoCurrentRight[i];
          duoCurrentRight[i] = duoCurrentRight[swapWith];
          duoCurrentRight[swapWith] = temp;
        }
      }
    }
  }

  function renderDuoColumns(animatePop = false) {
    const colLeft = document.getElementById('duo-col-left');
    const colRight = document.getElementById('duo-col-right');
    if (!colLeft || !colRight) return;
    colLeft.innerHTML = '';
    colRight.innerHTML = '';

    // Sol sütun: tıbbi terimler (okunuş varsa ℹ️ ikonuyla)
    duoCurrentLeft.forEach(item => {
      const tile = document.createElement('div');
      tile.className = 'match-tile duo-tile-left';
      if (animatePop) tile.classList.add('pop-in');
      tile.setAttribute('data-id', item.id);

      // Uzun metin uyarısı
      if (item.term.length > 20) tile.classList.add('long-text');

      let hasOkunus = false;
      let cleanOkunus = '';
      if (item.okunus && typeof item.okunus === 'string' && item.okunus.trim()) {
        cleanOkunus = item.okunus.replace(/^[(\[]|[)\]]$/g, '').trim();
        if (cleanOkunus) hasOkunus = true;
      }

      const infoBtn = hasOkunus
        ? `<button class="tile-info-btn" title="Okunuşu göster" tabindex="-1">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
               <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/>
             </svg>
           </button>
           <span class="tile-pronounce-tooltip" aria-hidden="true">${escapeHTML(cleanOkunus)}</span>`
        : '';

      tile.innerHTML = `
        ${infoBtn}
        <span class="tile-term-main">${escapeHTML(item.term)}</span>
      `;

      // ℹ️ butonuna tıklamada tooltip aç/kapat (kart seçimini tetikleme)
      if (hasOkunus) {
        const btn = tile.querySelector('.tile-info-btn');
        const tooltip = tile.querySelector('.tile-pronounce-tooltip');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = tooltip.classList.toggle('visible');
          btn.classList.toggle('active', isOpen);
          // 2.5 saniye sonra otomatik kapat
          if (isOpen) {
            clearTimeout(btn._tooltipTimer);
            btn._tooltipTimer = setTimeout(() => {
              tooltip.classList.remove('visible');
              btn.classList.remove('active');
            }, 2500);
          }
        });
      }

      tile.addEventListener('click', () => handleDuoSelect('left', item.id, tile));
      colLeft.appendChild(tile);
    });

    // Sağ sütun: Türkçe anlamlar
    duoCurrentRight.forEach(item => {
      const tile = document.createElement('div');
      tile.className = 'match-tile duo-tile-right';
      if (animatePop) tile.classList.add('pop-in');
      tile.setAttribute('data-id', item.id);
      
      if (item.meaning.length > 25) tile.classList.add('long-text');

      tile.innerHTML = `<span class="tile-meaning-main">${escapeHTML(item.meaning)}</span>`;
      tile.addEventListener('click', () => handleDuoSelect('right', item.id, tile));
      colRight.appendChild(tile);
    });
  }

  function handleDuoSelect(side, id, tileEl) {
    // Meşgul veya eşleşmiş karta tıklandıysa yoksay
    if (duoIsBusy || tileEl.classList.contains('matched')) return;

    if (side === 'left') {
      if (duoSelectedLeftId === id) {
        // Zaten seçili ise seçimi kaldır
        tileEl.classList.remove('selected');
        duoSelectedLeftId = null;
        return;
      }
      // Önceki sol seçimi kaldır
      const prevLeft = document.querySelector('#duo-col-left .match-tile.selected');
      if (prevLeft) prevLeft.classList.remove('selected');

      duoSelectedLeftId = id;
      tileEl.classList.add('selected');
    } else {
      if (duoSelectedRightId === id) {
        tileEl.classList.remove('selected');
        duoSelectedRightId = null;
        return;
      }
      const prevRight = document.querySelector('#duo-col-right .match-tile.selected');
      if (prevRight) prevRight.classList.remove('selected');

      duoSelectedRightId = id;
      tileEl.classList.add('selected');
    }

    // İki taraf da seçildiyse kontrol et
    if (duoSelectedLeftId !== null && duoSelectedRightId !== null) {
      checkDuoMatch();
    }
  }

  function checkDuoMatch() {
    const leftEl = document.querySelector(`#duo-col-left .match-tile[data-id="${duoSelectedLeftId}"]`);
    const rightEl = document.querySelector(`#duo-col-right .match-tile[data-id="${duoSelectedRightId}"]`);

    if (!leftEl || !rightEl) return;

    if (duoSelectedLeftId === duoSelectedRightId) {
      // === DOĞRU EŞLEŞME ===
      const matchedId = duoSelectedLeftId;
      matchScore++;
      matchCombo++;
      document.getElementById('match-score').textContent = matchScore;
      document.getElementById('match-combo').textContent = `${matchCombo}x`;

      leftEl.classList.remove('selected');
      rightEl.classList.remove('selected');
      leftEl.classList.add('matched');
      rightEl.classList.add('matched');

      duoSelectedLeftId = null;
      duoSelectedRightId = null;
      duoIsBusy = true;

      setTimeout(() => {
        // Kuyruktan yeni terim doldur
        if (duoRemainingPool.length > 0) {
          const nextItem = duoRemainingPool.shift();
          duoCurrentLeft = duoCurrentLeft.map(x => x.id === matchedId ? nextItem : x);
          // Sağ sütundaki eşleşen öğeyi de değiştir ve yeniden karıştır
          duoCurrentRight = duoCurrentRight.map(x => x.id === matchedId ? nextItem : x);
          // Sağ sütunu yeniden karıştır (Duolingo tarzı)
          duoCurrentRight = [...duoCurrentRight].sort(() => 0.5 - Math.random());
          _ensureRightSideNotAligned();
        } else {
          duoCurrentLeft = duoCurrentLeft.filter(x => x.id !== matchedId);
          duoCurrentRight = duoCurrentRight.filter(x => x.id !== matchedId);
        }

        // Oyun bitti mi?
        if (duoCurrentLeft.length === 0) {
          clearInterval(matchTimerInterval);
          showToast(`🏆 Tebrikler! ${matchScore} eşleşmeyi ${document.getElementById('match-timer').textContent} sürede tamamladınız!`, 'success');
          duoIsBusy = false;
          return;
        }

        // Yeni kartları animasyonla çiz
        renderDuoColumns(true);
        duoIsBusy = false;
      }, 280);

    } else {
      // === YANLIŞ EŞLEŞME ===
      matchCombo = 1;
      document.getElementById('match-combo').textContent = '1x';

      duoIsBusy = true;
      leftEl.classList.remove('selected');
      rightEl.classList.remove('selected');
      leftEl.classList.add('wrong-pair');
      rightEl.classList.add('wrong-pair');

      setTimeout(() => {
        if (leftEl) leftEl.classList.remove('wrong-pair');
        if (rightEl) rightEl.classList.remove('wrong-pair');
        duoSelectedLeftId = null;
        duoSelectedRightId = null;
        duoIsBusy = false;
      }, 420);
    }
  }

  // 12'li Izgara Modu
  function initGridMode(pool) {
    const gridContainer = document.getElementById('match-grid-view');
    gridContainer.innerHTML = '';
    gridFirstCard = null;
    gridSecondCard = null;

    const selectedItems = pool.slice(0, 6);
    gridCards = [];

    selectedItems.forEach(item => {
      gridCards.push({ id: item.id, text: item.term, kind: 'term' });
      gridCards.push({ id: item.id, text: item.meaning, kind: 'meaning' });
    });

    shuffleArray(gridCards);

    gridCards.forEach(c => {
      const tile = document.createElement('div');
      tile.className = 'match-tile';
      tile.setAttribute('data-id', c.id);
      tile.textContent = c.text;

      tile.addEventListener('click', () => handleGridSelect(c, tile));
      gridContainer.appendChild(tile);
    });
  }

  function handleGridSelect(cardObj, tileEl) {
    if (tileEl.classList.contains('matched') || tileEl.classList.contains('selected')) return;

    if (!gridFirstCard) {
      gridFirstCard = { obj: cardObj, el: tileEl };
      tileEl.classList.add('selected');
    } else if (!gridSecondCard) {
      gridSecondCard = { obj: cardObj, el: tileEl };
      tileEl.classList.add('selected');

      if (gridFirstCard.obj.id === gridSecondCard.obj.id && gridFirstCard.obj.kind !== gridSecondCard.obj.kind) {
        // Eşleşti
        matchScore++;
        matchCombo++;
        document.getElementById('match-score').textContent = matchScore;
        document.getElementById('match-combo').textContent = `${matchCombo}x`;

        gridFirstCard.el.classList.add('matched');
        gridSecondCard.el.classList.add('matched');
        gridFirstCard = null;
        gridSecondCard = null;

        if (document.querySelectorAll('#match-grid-view .match-tile.matched').length === 12) {
          clearInterval(matchTimerInterval);
          showToast(`Tebrikler! Izgara eşleştirmesi tamamlandı!`, 'success');
        }
      } else {
        // Hatalı
        matchCombo = 1;
        document.getElementById('match-combo').textContent = '1x';
        gridFirstCard.el.classList.add('wrong-shake');
        gridSecondCard.el.classList.add('wrong-shake');

        setTimeout(() => {
          if (gridFirstCard) {
            gridFirstCard.el.classList.remove('selected', 'wrong-shake');
          }
          if (gridSecondCard) {
            gridSecondCard.el.classList.remove('selected', 'wrong-shake');
          }
          gridFirstCard = null;
          gridSecondCard = null;
        }, 350);
      }
    }
  }

  // ==================== TAB 4: YAZMA PRATİĞİ (BAKA BAKA YAZMA) ====================
  function initSpelling() {
    spellTerms = getFilteredTerms('all').filter(t => t.term && !t.term.includes(' / '));

    const inputField = document.getElementById('spell-user-input');
    const btnNext = document.getElementById('btn-spell-skip');
    const btnPrev = document.getElementById('btn-spell-prev');
    const btnShuffle = document.getElementById('btn-spell-shuffle');

    if (inputField) {
      inputField.addEventListener('input', handleSpellingInput);
      inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          advanceSpelling(1);
        }
      });
    }

    if (btnNext) btnNext.addEventListener('click', () => advanceSpelling(1));
    if (btnPrev) btnPrev.addEventListener('click', () => advanceSpelling(-1));
    if (btnShuffle) {
      btnShuffle.addEventListener('click', () => {
        shuffleArray(spellTerms);
        spellIndex = 0;
        loadSpellingItem(spellIndex);
        showToast('Yazma terimleri karıştırıldı!', 'info');
      });
    }

    loadSpellingItem(0);
  }

  function loadSpellingItem(index) {
    if (spellTerms.length === 0) return;
    if (index >= spellTerms.length) index = 0;
    if (index < 0) index = spellTerms.length - 1;
    spellIndex = index;

    const item = spellTerms[spellIndex];

    document.getElementById('spell-current-idx').textContent = spellIndex + 1;
    document.getElementById('spell-total-count').textContent = spellTerms.length;
    document.getElementById('spell-type-badge').textContent = item.category || 'Tıbbi Terim';

    // TERİMİ DOĞRUDAN VE BÜYÜK GÖSTER
    document.getElementById('spell-target-term').textContent = item.term;
    document.getElementById('spell-target-okunus').textContent = item.okunus || item.term;
    document.getElementById('spell-target-meaning').textContent = item.meaning;

    const inputField = document.getElementById('spell-user-input');
    if (inputField) {
      inputField.value = '';
      inputField.className = 'spelling-input-field';
      inputField.focus();
    }

    const msgEl = document.getElementById('spell-feedback-msg');
    if (msgEl) {
      msgEl.textContent = 'Yukarıdaki terime bakarak aynısını yazın...';
      msgEl.style.color = 'var(--text-muted)';
    }
  }

  function handleSpellingInput() {
    const inputField = document.getElementById('spell-user-input');
    const msgEl = document.getElementById('spell-feedback-msg');
    if (!inputField || spellTerms.length === 0) return;

    const targetTerm = spellTerms[spellIndex].term.trim();
    const typed = inputField.value;

    const cleanTarget = targetTerm.toLowerCase();
    const cleanTyped = typed.toLowerCase();

    if (cleanTyped === '') {
      inputField.className = 'spelling-input-field';
      msgEl.textContent = 'Yazmaya başlayın...';
      msgEl.style.color = 'var(--text-muted)';
      return;
    }

    if (cleanTarget.startsWith(cleanTyped)) {
      // Doğru yolda
      if (cleanTyped === cleanTarget) {
        // Tamamlandı!
        inputField.className = 'spelling-input-field input-correct';
        msgEl.textContent = '✓ Harika! Terim doğru yazıldı. (Enter ile sonrakine geçin)';
        msgEl.style.color = 'var(--emerald)';
      } else {
        inputField.className = 'spelling-input-field';
        msgEl.textContent = `${cleanTyped.length} / ${cleanTarget.length} harf doğru...`;
        msgEl.style.color = 'var(--primary)';
      }
    } else {
      // Hatalı harf
      inputField.className = 'spelling-input-field input-wrong';
      msgEl.textContent = '⚠️ Hatalı harf girdiniz, terime dikkatlice bakın!';
      msgEl.style.color = 'var(--rose)';
    }
  }

  function advanceSpelling(delta) {
    loadSpellingItem(spellIndex + delta);
  }

  // ==================== TAB 5: SÖZLÜK & ATLAS ====================
  function initDictionary() {
    const searchInput = document.getElementById('dict-search-input');
    const btnClear = document.getElementById('btn-dict-clear');
    const categorySelect = document.getElementById('dict-category-filter');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        dictSearchQuery = searchInput.value.trim().toLowerCase();
        if (btnClear) btnClear.style.display = dictSearchQuery ? 'block' : 'none';
        renderDictionaryGrid();
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        searchInput.value = '';
        dictSearchQuery = '';
        btnClear.style.display = 'none';
        renderDictionaryGrid();
      });
    }

    if (categorySelect) {
      categorySelect.addEventListener('change', () => {
        dictFilterCategory = categorySelect.value;
        renderDictionaryGrid();
      });
    }

    initAlphabetBar();
    renderDictionaryGrid();
  }

  function initAlphabetBar() {
    const bar = document.getElementById('dict-alphabet-bar');
    if (!bar) return;
    bar.innerHTML = '';

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    // "Tümü" butonu
    const btnAll = document.createElement('button');
    btnAll.className = 'alpha-btn active';
    btnAll.textContent = 'Tümü';
    btnAll.addEventListener('click', () => {
      dictActiveLetter = '';
      document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
      btnAll.classList.add('active');
      renderDictionaryGrid();
    });
    bar.appendChild(btnAll);

    alphabet.forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'alpha-btn';
      btn.textContent = letter;
      btn.addEventListener('click', () => {
        dictActiveLetter = letter;
        document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderDictionaryGrid();
      });
      bar.appendChild(btn);
    });
  }

  function renderDictionaryGrid() {
    const grid = document.getElementById('dict-cards-grid');
    const infoCount = document.getElementById('dict-result-count');
    if (!grid) return;

    let list = getFilteredTerms(dictFilterCategory);

    // Arama filtresi
    if (dictSearchQuery) {
      list = list.filter(t => 
        t.term.toLowerCase().includes(dictSearchQuery) ||
        (t.meaning && t.meaning.toLowerCase().includes(dictSearchQuery)) ||
        (t.okunus && t.okunus.toLowerCase().includes(dictSearchQuery))
      );
    }

    // Harf filtresi
    if (dictActiveLetter) {
      list = list.filter(t => t.term.toUpperCase().startsWith(dictActiveLetter));
    }

    if (infoCount) {
      infoCount.textContent = `${list.length} terim listeleniyor`;
    }

    grid.innerHTML = '';

    if (list.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: var(--text-dim);">
          Arama kriterine uygun tıbbi terim bulunamadı.
        </div>
      `;
      return;
    }

    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'dict-card';
      const isFav = isFavorite(item.id);

      card.innerHTML = `
        <div class="dict-card-top">
          <span class="dict-card-term">${escapeHTML(item.term)}</span>
          <button class="card-btn-star ${isFav ? 'starred' : ''}" data-id="${item.id}" title="Yıldızla">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        </div>
        <div class="dict-card-pronounce">${escapeHTML(item.okunus || item.term)}</div>
        <div class="dict-card-meaning">${escapeHTML(item.meaning)}</div>
        <div class="dict-card-footer">
          <span class="dict-type-badge">${escapeHTML(item.category || 'Tıbbi Terim')}</span>
          <span style="font-size:0.75rem; color:var(--primary); font-weight:600;">Detay →</span>
        </div>
      `;

      // Yıldız butonuna tıklama
      const starBtn = card.querySelector('.card-btn-star');
      starBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isNow = toggleFavorite(item.id);
        starBtn.classList.toggle('starred', isNow);
        updateCardStarStatus();
        showToast(isNow ? 'Yıldızlılara eklendi!' : 'Yıldızlılardan çıkarıldı.', 'info');
      });

      // Karta tıklayınca modal aç
      card.addEventListener('click', () => openTermDetailModal(item));

      grid.appendChild(card);
    });
  }

  // ==================== KLAVYE KISAYOLLARI ====================
  function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Eğer bir input içerisindeyse kısayolları ezme
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (activeTab === 'flashcards') {
        if (e.code === 'Space') {
          e.preventDefault();
          flipFlashcard();
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          nextFlashcard();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          prevFlashcard();
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          const btnStar = document.getElementById('btn-fc-star');
          if (btnStar) btnStar.click();
        }
      } else if (activeTab === 'quiz') {
        const key = e.key;
        if (['1', '2', '3', '4'].includes(key)) {
          const idx = parseInt(key, 10) - 1;
          const options = document.querySelectorAll('.quiz-opt-btn');
          if (options[idx] && !options[idx].disabled) {
            options[idx].click();
          }
        } else if (e.key === 'Enter') {
          const btnNext = document.getElementById('btn-next-question');
          if (btnNext && btnNext.offsetParent !== null) {
            btnNext.click();
          }
        }
      }

      // Modalları ESC ile kapat
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
      }
    });
  }

  // --- Yardımcı Araçlar ---
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();

