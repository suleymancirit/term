/**
 * CiritTerm - Dersler ve Soru Havuzu Modülü
 * Anatomi, Fizyoloji ve Bilgi Teknolojileri Dersleri
 * - Soru Çözüm Modu (Test / Sınav)
 * - Soru Çalışma Modu (Vurgulu Doğru Cevap Kartları)
 */

(function () {
  'use strict';

  // Ders Tanımları ve Meta Bilgileri
  const LESSON_CONFIG = {
    anatomi: {
      id: 'anatomi',
      title: 'Anatomi',
      badge: 'Tıp & Morfoloji',
      icon: '🦴',
      color: '#0ea5e9',
      count: 70,
      jsonFile: 'anatomi.json'
    },
    fizyoloji: {
      id: 'fizyoloji',
      title: 'Fizyoloji',
      badge: 'Tıp & Yaşamsal İşlevler',
      icon: '🫀',
      color: '#10b981',
      count: 50,
      jsonFile: 'fizyoloji.json'
    },
    bilgi: {
      id: 'bilgi',
      title: 'Bilgi Teknolojileri',
      badge: 'Bilişim & Enformatik',
      icon: '💻',
      color: '#8b5cf6',
      count: 105,
      jsonFile: 'bilgi.json'
    }
  };

  // State
  let loadedQuestions = {
    anatomi: null,
    fizyoloji: null,
    bilgi: null
  };

  let currentLessonId = 'anatomi';
  let currentMode = 'test'; // 'test' (Soru Çözüm) veya 'study' (Soru Çalışma)
  let activeQuestions = [];
  let currentIndex = 0;

  // Test Modu State
  let testScore = 0;
  let testMistakes = [];
  let testAnswers = {}; // { [index]: { selected: '...', correct: '...', isCorrect: true/false } }
  let testAnswerLocked = false;

  // Soru Listesi (Toplu Liste & Gözlü Mod) State
  let currentListLessonId = 'anatomi';
  let isMasterEyeRevealed = false; // Göz: true => tüm doğru cevaplar açık, false => gizli
  let qlistSearchQuery = '';
  let singleRevealedIndices = new Set();
  let listUserAnswers = {}; // { [index]: { selected: '...', isCorrect: true/false } }

  // Harf etiketleri
  const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  // DOM Yüklendiğinde Başlat
  document.addEventListener('DOMContentLoaded', () => {
    initLessonTabsAndEvents();
  });

  // Dinamik Veri Yükleyici (Fetch + Preloaded Fallback)
  async function loadLessonData(lessonId) {
    if (loadedQuestions[lessonId] && loadedQuestions[lessonId].length > 0) {
      return loadedQuestions[lessonId];
    }

    const conf = LESSON_CONFIG[lessonId];
    if (!conf) return [];

    // 1. fetch denemesi (HTTP/HTTPS / Vercel / Live Server ortamlarında)
    try {
      const paths = [`data/${conf.jsonFile}`, conf.jsonFile];
      for (const p of paths) {
        try {
          const res = await fetch(p);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              loadedQuestions[lessonId] = data;
              return data;
            }
          }
        } catch (_) {
          // Bir sonraki yolu dene
        }
      }
    } catch (e) {
      console.warn(`Fetch hatası (${lessonId}), yedek havuza geçiliyor:`, e);
    }

    // 2. Preloaded Fallback (file:// protokolünde CORS engeline takılmadan çalışması için)
    if (window.PRELOADED_LESSONS && window.PRELOADED_LESSONS[lessonId]) {
      loadedQuestions[lessonId] = window.PRELOADED_LESSONS[lessonId].questions;
      return loadedQuestions[lessonId];
    }

    return [];
  }

  function initLessonTabsAndEvents() {
    // Üst Navigasyon Geçişi (Hub vs Soru Listesi)
    const btnSubnavHub = document.getElementById('btn-subnav-hub');
    const btnSubnavList = document.getElementById('btn-subnav-list');

    if (btnSubnavHub) {
      btnSubnavHub.addEventListener('click', () => {
        showLessonsHub();
      });
    }

    if (btnSubnavList) {
      btnSubnavList.addEventListener('click', () => {
        showQuestionListView(currentListLessonId);
      });
    }

    // Ders Seçim Kartlarındaki Butonlar
    document.querySelectorAll('.btn-launch-lesson').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const lesson = btn.getAttribute('data-lesson');
        const mode = btn.getAttribute('data-mode'); // 'test', 'study' veya 'list'
        if (mode === 'list') {
          await showQuestionListView(lesson);
        } else {
          await startLessonSession(lesson, mode);
        }
      });
    });

    // Oturum İçi Üst Bar Butonları
    const btnBackHub = document.getElementById('btn-lesson-back-hub');
    if (btnBackHub) {
      btnBackHub.addEventListener('click', showLessonsHub);
    }

    // Mod Geçiş Butonu (Test <-> Çalışma)
    const btnSwitchMode = document.getElementById('btn-lesson-switch-mode');
    if (btnSwitchMode) {
      btnSwitchMode.addEventListener('click', () => {
        const nextMode = currentMode === 'test' ? 'study' : 'test';
        switchSessionMode(nextMode);
      });
    }

    // Çalışma Modu Navigasyon Butonları
    const btnPrev = document.getElementById('btn-study-prev');
    const btnNext = document.getElementById('btn-study-next');
    const btnShuffle = document.getElementById('btn-study-shuffle');
    const selectJump = document.getElementById('select-study-jump');

    if (btnPrev) btnPrev.addEventListener('click', prevQuestion);
    if (btnNext) btnNext.addEventListener('click', nextQuestion);
    if (btnShuffle) {
      btnShuffle.addEventListener('click', () => {
        shuffleArray(activeQuestions);
        currentIndex = 0;
        renderQuestion();
        showLessonToast('Sorular karıştırıldı! 🔀');
      });
    }
    if (selectJump) {
      selectJump.addEventListener('change', (e) => {
        currentIndex = parseInt(e.target.value, 10) || 0;
        renderQuestion();
      });
    }

    // Test Modu Sonraki Soru Butonu
    const btnTestNext = document.getElementById('btn-test-next');
    if (btnTestNext) {
      btnTestNext.addEventListener('click', advanceTestQuestion);
    }

    // Sonuç Ekranı Butonları
    const btnTestRestart = document.getElementById('btn-test-restart');
    const btnTestReviewMistakes = document.getElementById('btn-test-review-mistakes');
    const btnTestBackToHub = document.getElementById('btn-test-back-hub');

    if (btnTestRestart) {
      btnTestRestart.addEventListener('click', () => {
        startLessonSession(currentLessonId, 'test');
      });
    }
    if (btnTestReviewMistakes) {
      btnTestReviewMistakes.addEventListener('click', reviewTestMistakes);
    }
    if (btnTestBackToHub) {
      btnTestBackToHub.addEventListener('click', showLessonsHub);
    }

    // Soru Listesi (Gözlü Mod) Buton ve Arama Olayları
    const btnQlistBack = document.getElementById('btn-qlist-back-hub');
    if (btnQlistBack) {
      btnQlistBack.addEventListener('click', showLessonsHub);
    }

    // Ders Seçim Çipleri
    document.querySelectorAll('#qlist-lesson-selector .qlist-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const lesson = chip.getAttribute('data-qlist-lesson');
        await switchQlistLesson(lesson);
      });
    });

    // ANA GÖZ BUTONU (Cevapları Göster / Gizle)
    const btnMasterEye = document.getElementById('btn-master-eye-toggle');
    if (btnMasterEye) {
      btnMasterEye.addEventListener('click', toggleMasterEye);
    }

    // Arama Kutusu
    const searchInput = document.getElementById('qlist-search-input');
    const btnClearSearch = document.getElementById('btn-qlist-clear-search');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        qlistSearchQuery = searchInput.value.trim().toLowerCase();
        if (btnClearSearch) {
          btnClearSearch.style.display = qlistSearchQuery ? 'block' : 'none';
        }
        renderQuestionList();
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        qlistSearchQuery = '';
        btnClearSearch.style.display = 'none';
        renderQuestionList();
      });
    }

    // Başa Dön Butonu
    const btnScrollTop = document.getElementById('btn-qlist-scroll-top');
    if (btnScrollTop) {
      btnScrollTop.addEventListener('click', () => {
        const target = document.getElementById('tab-content-lessons');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Klavye Kısayolları (Sol/Sağ Ok Tuşları, vb.)
    window.addEventListener('keydown', handleLessonKeydown);
  }

  // Ders Oturumunu Başlat
  async function startLessonSession(lessonId, mode) {
    currentLessonId = lessonId;
    currentMode = mode;
    currentIndex = 0;

    const conf = LESSON_CONFIG[lessonId];
    if (!conf) return;

    // Yükleniyor Göstergesi
    showLessonToast(`${conf.title} soruları yükleniyor...`);

    const questions = await loadLessonData(lessonId);
    if (!questions || questions.length === 0) {
      showLessonToast('Soru havuzu yüklenemedi!', 'error');
      return;
    }

    // Soruların kopyasını al
    activeQuestions = questions.map((q, idx) => ({
      ...q,
      originalIndex: idx + 1
    }));

    // Test Durumunu Sıfırla
    testScore = 0;
    testMistakes = [];
    testAnswers = {};
    testAnswerLocked = false;

    // Görünümleri Güncelle
    document.getElementById('lessons-hub-view').style.display = 'none';
    document.getElementById('lesson-results-view').style.display = 'none';
    document.getElementById('lesson-active-view').style.display = 'block';

    updateHeaderMeta();
    buildJumpDropdown();
    renderQuestion();

    // Sayfayı soru alanına pürüzsüz kaydır
    document.getElementById('tab-content-lessons').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Mod Değiştir (Test <-> Çalışma)
  function switchSessionMode(newMode) {
    currentMode = newMode;
    updateHeaderMeta();
    renderQuestion();
    showLessonToast(newMode === 'study' ? '📖 Soru Çalışma Moduna geçildi' : '🎯 Soru Çözüm Moduna geçildi');
  }

  function updateHeaderMeta() {
    const conf = LESSON_CONFIG[currentLessonId];
    const elTitle = document.getElementById('lesson-active-title');
    const elIcon = document.getElementById('lesson-active-icon');
    const elBadge = document.getElementById('lesson-active-badge');
    const btnSwitch = document.getElementById('btn-lesson-switch-mode');

    if (elTitle) elTitle.textContent = conf.title;
    if (elIcon) elIcon.textContent = conf.icon;

    if (elBadge) {
      if (currentMode === 'study') {
        elBadge.innerHTML = '📖 Çalışma Modu (Vurgulu)';
        elBadge.className = 'lesson-mode-pill mode-study';
      } else {
        elBadge.innerHTML = '🎯 Soru Çözüm Modu (Test)';
        elBadge.className = 'lesson-mode-pill mode-test';
      }
    }

    if (btnSwitch) {
      btnSwitch.innerHTML = currentMode === 'test'
        ? `<span>📖 Çalışma Modu</span>`
        : `<span>🎯 Test Modu</span>`;
    }
  }

  function buildJumpDropdown() {
    const sel = document.getElementById('select-study-jump');
    if (!sel) return;
    sel.innerHTML = '';
    activeQuestions.forEach((q, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `Soru ${idx + 1} / ${activeQuestions.length}`;
      sel.appendChild(opt);
    });
  }

  function renderQuestion() {
    if (activeQuestions.length === 0) return;
    if (currentIndex >= activeQuestions.length) {
      if (currentMode === 'test') {
        finishTestSession();
        return;
      } else {
        currentIndex = 0;
      }
    }
    if (currentIndex < 0) {
      currentIndex = activeQuestions.length - 1;
    }

    const q = activeQuestions[currentIndex];
    const total = activeQuestions.length;

    // Progress Bar ve Sayaç
    const pct = Math.round(((currentIndex + 1) / total) * 100);
    const bar = document.getElementById('lesson-progress-bar');
    const countEl = document.getElementById('lesson-question-counter');
    const sel = document.getElementById('select-study-jump');

    if (bar) bar.style.width = `${pct}%`;
    if (countEl) countEl.textContent = `${currentIndex + 1} / ${total}`;
    if (sel) sel.value = currentIndex;

    // Soru Numarası Rozeti ve Soru Metni
    const badgeNo = document.getElementById('lesson-q-num-badge');
    const textEl = document.getElementById('lesson-q-text');

    if (badgeNo) badgeNo.textContent = `Soru ${q.soru_no || (currentIndex + 1)}`;
    if (textEl) textEl.textContent = q.soru;

    // Seçenekler Konteyneri
    const optContainer = document.getElementById('lesson-options-container');
    optContainer.innerHTML = '';

    // Modlara göre buton/alt çubuk durumu
    const footerStatus = document.getElementById('lesson-test-footer');
    const studyFooter = document.getElementById('lesson-study-footer');

    if (currentMode === 'study') {
      // ===== MOD B: SORU ÇALIŞMA MODU (ÖĞRENME / EZBER KARTLARI) =====
      if (footerStatus) footerStatus.style.display = 'none';
      if (studyFooter) studyFooter.style.display = 'flex';

      q.secenekler.forEach((secenekText, idx) => {
        const isCorrect = isExactAnswer(secenekText, q.dogru_cevap);
        const card = document.createElement('div');
        card.className = `study-option-card ${isCorrect ? 'highlight-correct' : 'dimmed-option'}`;

        const letter = OPTION_LETTERS[idx] || (idx + 1);

        card.innerHTML = `
          <div class="opt-prefix">${letter}</div>
          <div class="opt-text">${escapeHTML(secenekText)}</div>
          ${isCorrect ? '<span class="correct-badge-pill">✓ Doğru Cevap</span>' : ''}
        `;
        optContainer.appendChild(card);
      });

    } else {
      // ===== MOD A: SORU ÇÖZÜM MODU (TEST / SINAV) =====
      if (studyFooter) studyFooter.style.display = 'none';
      if (footerStatus) footerStatus.style.display = 'none';

      testAnswerLocked = false;
      const prevAnswer = testAnswers[currentIndex];

      q.secenekler.forEach((secenekText, idx) => {
        const btn = document.createElement('button');
        btn.className = 'test-option-btn';
        btn.setAttribute('data-index', idx);
        btn.setAttribute('data-val', secenekText);

        const letter = OPTION_LETTERS[idx] || (idx + 1);

        btn.innerHTML = `
          <span class="test-opt-letter">${letter}</span>
          <span class="test-opt-text">${escapeHTML(secenekText)}</span>
          <span class="test-opt-icon"></span>
        `;

        // Daha önce cevaplanmışsa durumunu koru
        if (prevAnswer) {
          btn.disabled = true;
          const isCorrect = isExactAnswer(secenekText, q.dogru_cevap);
          if (isCorrect) btn.classList.add('is-correct');
          if (secenekText === prevAnswer.selected && !prevAnswer.isCorrect) {
            btn.classList.add('is-wrong');
          }
        } else {
          btn.addEventListener('click', () => handleTestOptionClick(secenekText, btn));
        }

        optContainer.appendChild(btn);
      });

      if (prevAnswer) {
        showTestAnswerFeedback(prevAnswer.isCorrect, q.dogru_cevap);
      }
    }
  }

  // Test Modu Şık Tıklaması
  function handleTestOptionClick(selectedText, btnElement) {
    if (testAnswerLocked) return;
    testAnswerLocked = true;

    const q = activeQuestions[currentIndex];
    const isCorrect = isExactAnswer(selectedText, q.dogru_cevap);

    // Bütün şıkları kilitle
    const allBtns = document.querySelectorAll('.test-option-btn');
    allBtns.forEach(btn => {
      btn.disabled = true;
      const val = btn.getAttribute('data-val');
      if (isExactAnswer(val, q.dogru_cevap)) {
        btn.classList.add('is-correct');
      }
    });

    if (isCorrect) {
      testScore++;
      btnElement.classList.add('is-correct');
    } else {
      btnElement.classList.add('is-wrong');
      testMistakes.push({
        questionNumber: currentIndex + 1,
        soru: q.soru,
        selected: selectedText,
        correct: q.dogru_cevap,
        secenekler: q.secenekler
      });
    }

    testAnswers[currentIndex] = {
      selected: selectedText,
      correct: q.dogru_cevap,
      isCorrect: isCorrect
    };

    showTestAnswerFeedback(isCorrect, q.dogru_cevap);
  }

  function showTestAnswerFeedback(isCorrect, correctText) {
    const footerStatus = document.getElementById('lesson-test-footer');
    const feedbackMsg = document.getElementById('lesson-test-feedback-msg');
    const btnNext = document.getElementById('btn-test-next');

    if (!footerStatus || !feedbackMsg) return;

    footerStatus.style.display = 'flex';
    if (isCorrect) {
      feedbackMsg.className = 'test-feedback-text success';
      feedbackMsg.innerHTML = `<span>✓</span> <strong>Tebrikler! Doğru cevap.</strong>`;
    } else {
      feedbackMsg.className = 'test-feedback-text danger';
      feedbackMsg.innerHTML = `<span>✗</span> <strong>Yanlış! Doğru cevap: ${escapeHTML(correctText)}</strong>`;
    }

    if (btnNext) {
      btnNext.textContent = (currentIndex + 1 >= activeQuestions.length) ? 'Testi Bitir 🏁' : 'Sonraki Soru →';
      btnNext.focus();
    }
  }

  function advanceTestQuestion() {
    currentIndex++;
    renderQuestion();
  }

  function prevQuestion() {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion();
    }
  }

  function nextQuestion() {
    if (currentIndex < activeQuestions.length - 1) {
      currentIndex++;
      renderQuestion();
    }
  }

  // Test Sınavını Tamamla ve Sonuçları Göster
  function finishTestSession() {
    document.getElementById('lesson-active-view').style.display = 'none';
    document.getElementById('lesson-results-view').style.display = 'block';

    const total = activeQuestions.length;
    const correct = testScore;
    const wrong = total - correct;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    const conf = LESSON_CONFIG[currentLessonId];

    document.getElementById('res-lesson-name').textContent = conf.title;
    document.getElementById('res-lesson-score-pct').textContent = `%${pct}`;
    document.getElementById('res-lesson-correct').textContent = correct;
    document.getElementById('res-lesson-wrong').textContent = wrong;
    document.getElementById('res-lesson-total').textContent = total;

    // Rozet ve Başlık
    const titleEl = document.getElementById('res-lesson-title');
    const iconEl = document.getElementById('res-lesson-icon');

    if (pct >= 85) {
      if (iconEl) iconEl.textContent = '🏆';
      if (titleEl) titleEl.textContent = 'Harika Başarı!';
    } else if (pct >= 60) {
      if (iconEl) iconEl.textContent = '👏';
      if (titleEl) titleEl.textContent = 'Tebrikler, İyi Sonuç!';
    } else {
      if (iconEl) iconEl.textContent = '📚';
      if (titleEl) titleEl.textContent = 'Geliştirilebilir, Tekrar Et!';
    }

    // Yanlış Yapılan Soruları İnceleme Butonu
    const btnReview = document.getElementById('btn-test-review-mistakes');
    const mistakesContainer = document.getElementById('lesson-mistakes-preview');
    if (btnReview) {
      btnReview.style.display = (testMistakes.length > 0) ? 'inline-flex' : 'none';
    }

    // Yanlışlar Listesi
    if (mistakesContainer) {
      if (testMistakes.length > 0) {
        mistakesContainer.style.display = 'block';
        mistakesContainer.innerHTML = `
          <h4 class="mistakes-heading">❌ Yanlış Yapılan Sorular (${testMistakes.length}):</h4>
          <div class="mistakes-list">
            ${testMistakes.map(m => `
              <div class="mistake-item-card">
                <div class="mistake-q-title"><strong>#${m.questionNumber}:</strong> ${escapeHTML(m.soru)}</div>
                <div class="mistake-given">Sizin Cevabınız: <span class="bad-ans">${escapeHTML(m.selected)}</span></div>
                <div class="mistake-right">Doğru Cevap: <span class="good-ans">${escapeHTML(m.correct)}</span></div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        mistakesContainer.style.display = 'none';
        mistakesContainer.innerHTML = '';
      }
    }
  }

  // Yalnızca Yanlış Yapılan Soruları Tekrar Çöz Modu
  function reviewTestMistakes() {
    if (testMistakes.length === 0) return;

    activeQuestions = testMistakes.map(m => ({
      soru_no: m.questionNumber,
      soru: m.soru,
      secenekler: m.secenekler,
      dogru_cevap: m.correct
    }));

    currentMode = 'test';
    currentIndex = 0;
    testScore = 0;
    testMistakes = [];
    testAnswers = {};
    testAnswerLocked = false;

    document.getElementById('lesson-results-view').style.display = 'none';
    document.getElementById('lesson-active-view').style.display = 'block';

    updateHeaderMeta();
    buildJumpDropdown();
    renderQuestion();

    showLessonToast('Yalnızca yanlış yapılan sorular yükleniyor...');
  }

  // Ders Seçim Menüsüne (Hub) Geri Dön
  function showLessonsHub() {
    document.getElementById('lesson-active-view').style.display = 'none';
    document.getElementById('lesson-results-view').style.display = 'none';
    const qlistView = document.getElementById('lesson-question-list-view');
    if (qlistView) qlistView.style.display = 'none';
    document.getElementById('lessons-hub-view').style.display = 'block';

    // Subnav butonlarını güncelle
    const btnSubnavHub = document.getElementById('btn-subnav-hub');
    const btnSubnavList = document.getElementById('btn-subnav-list');
    if (btnSubnavHub) btnSubnavHub.classList.add('active');
    if (btnSubnavList) btnSubnavList.classList.remove('active');
  }

  // ===================================================================
  // TÜM SORU LİSTESİ (TOPLU LİSTE & GÖZLÜ MOD) MOTORU
  // ===================================================================
  async function showQuestionListView(lessonId) {
    if (lessonId) currentListLessonId = lessonId;

    document.getElementById('lessons-hub-view').style.display = 'none';
    document.getElementById('lesson-active-view').style.display = 'none';
    document.getElementById('lesson-results-view').style.display = 'none';

    const qlistView = document.getElementById('lesson-question-list-view');
    if (qlistView) qlistView.style.display = 'block';

    // Subnav butonlarını güncelle
    const btnSubnavHub = document.getElementById('btn-subnav-hub');
    const btnSubnavList = document.getElementById('btn-subnav-list');
    if (btnSubnavHub) btnSubnavHub.classList.remove('active');
    if (btnSubnavList) btnSubnavList.classList.add('active');

    // Çipleri güncelle
    updateQlistChipsUI();

    // Soruları render et
    await renderQuestionList();

    // Sayfanın en üstüne kaydır
    document.getElementById('tab-content-lessons').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function switchQlistLesson(lessonId) {
    currentListLessonId = lessonId;
    updateQlistChipsUI();
    singleRevealedIndices.clear();
    listUserAnswers = {};
    await renderQuestionList();
  }

  function updateQlistChipsUI() {
    document.querySelectorAll('#qlist-lesson-selector .qlist-chip').forEach(chip => {
      const l = chip.getAttribute('data-qlist-lesson');
      chip.classList.toggle('active', l === currentListLessonId);
    });
  }

  // ANA GÖZ BUTONU: Bütün soruların cevaplarını aç veya kapat
  function toggleMasterEye() {
    isMasterEyeRevealed = !isMasterEyeRevealed;
    if (!isMasterEyeRevealed) {
      singleRevealedIndices.clear();
      listUserAnswers = {};
    }
    updateMasterEyeButtonUI();

    // Tüm kartların görünümünü anında güncelle
    applyEyeStateToCards();

    showLessonToast(
      isMasterEyeRevealed 
        ? '👁️ Bütün doğru cevaplar işaretlendi!' 
        : '🙈 Bütün cevaplar gizlendi.',
      isMasterEyeRevealed ? 'success' : 'info'
    );
  }

  function updateMasterEyeButtonUI() {
    const btn = document.getElementById('btn-master-eye-toggle');
    const icon = document.getElementById('master-eye-icon');
    const text = document.getElementById('master-eye-text');

    if (!btn) return;

    if (isMasterEyeRevealed) {
      btn.classList.add('active-revealed');
      if (icon) icon.textContent = '🙈';
      if (text) text.textContent = 'Cevapları Gizle';
    } else {
      btn.classList.remove('active-revealed');
      if (icon) icon.textContent = '👁️';
      if (text) text.textContent = 'Cevapları Göster';
    }
  }

  function applyEyeStateToCards() {
    const cards = document.querySelectorAll('.qlist-item-card');
    cards.forEach(card => {
      const qIndex = parseInt(card.getAttribute('data-q-index'), 10);
      const isCardRevealed = isMasterEyeRevealed || singleRevealedIndices.has(qIndex);

      card.classList.toggle('answers-revealed', isCardRevealed);

      // Kartın kendi küçük göz butonunu güncelle
      const eyeBtn = card.querySelector('.btn-item-eye-toggle');
      if (eyeBtn) {
        eyeBtn.classList.toggle('active', isCardRevealed);
        eyeBtn.innerHTML = isCardRevealed ? '🙈' : '👁️';
        eyeBtn.title = isCardRevealed ? 'Cevabı Gizle' : 'Cevabı Göster';
      }

      // Şıkları güncelle
      card.querySelectorAll('.qlist-option-row').forEach(opt => {
        const isCorrect = opt.getAttribute('data-is-correct') === 'true';
        if (isCardRevealed) {
          if (isCorrect) {
            opt.classList.add('highlight-correct');
            opt.classList.remove('dimmed', 'user-wrong');
          } else {
            opt.classList.remove('highlight-correct', 'user-wrong');
            opt.classList.add('dimmed');
          }
        } else {
          // Eğer kullanıcı kendisi tıklamadıysa nötr haline dön
          const userAnswer = listUserAnswers[qIndex];
          if (userAnswer) {
            const val = opt.getAttribute('data-val');
            if (isCorrect) opt.classList.add('highlight-correct');
            if (val === userAnswer.selected && !userAnswer.isCorrect) opt.classList.add('user-wrong');
            if (!isCorrect && val !== userAnswer.selected) opt.classList.add('dimmed');
          } else {
            opt.classList.remove('highlight-correct', 'user-wrong', 'dimmed');
          }
        }
      });
    });
  }

  async function renderQuestionList() {
    const container = document.getElementById('qlist-items-container');
    const countBadge = document.getElementById('qlist-status-badge');
    if (!container) return;

    container.innerHTML = '<div class="qlist-loading">Sorular yükleniyor...</div>';

    const questions = await loadLessonData(currentListLessonId);
    if (!questions || questions.length === 0) {
      container.innerHTML = '<div class="qlist-empty">Bu ders için soru bulunamadı.</div>';
      if (countBadge) countBadge.textContent = '0 Soru';
      return;
    }

    // Arama filtresi
    let filtered = questions.map((q, idx) => ({ ...q, originalIndex: idx }));
    if (qlistSearchQuery) {
      filtered = filtered.filter(q => {
        const query = qlistSearchQuery;
        const noMatch = String(q.soru_no || (q.originalIndex + 1)).includes(query);
        const textMatch = q.soru.toLowerCase().includes(query);
        const optMatch = q.secenekler.some(s => s.toLowerCase().includes(query));
        return noMatch || textMatch || optMatch;
      });
    }

    if (countBadge) {
      countBadge.textContent = `${filtered.length} / ${questions.length} Soru Listeleniyor`;
    }

    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="qlist-empty">
          <p>🔍 "<strong>${escapeHTML(qlistSearchQuery)}</strong>" aramasına uygun soru bulunamadı.</p>
        </div>
      `;
      return;
    }

    updateMasterEyeButtonUI();

    filtered.forEach((q) => {
      const qIndex = q.originalIndex;
      const isCardRevealed = isMasterEyeRevealed || singleRevealedIndices.has(qIndex);

      const card = document.createElement('div');
      card.className = `qlist-item-card ${isCardRevealed ? 'answers-revealed' : ''}`;
      card.setAttribute('data-q-index', qIndex);

      // Başlık & Soru metni
      let optionsHtml = '';
      q.secenekler.forEach((secenekText, sIdx) => {
        const isCorrect = isExactAnswer(secenekText, q.dogru_cevap);
        const letter = OPTION_LETTERS[sIdx] || (sIdx + 1);

        let extraClass = '';
        if (isCardRevealed) {
          extraClass = isCorrect ? 'highlight-correct' : 'dimmed';
        } else if (listUserAnswers[qIndex]) {
          const ans = listUserAnswers[qIndex];
          if (isCorrect) extraClass = 'highlight-correct';
          if (secenekText === ans.selected && !ans.isCorrect) extraClass = 'user-wrong';
          if (!isCorrect && secenekText !== ans.selected) extraClass = 'dimmed';
        }

        optionsHtml += `
          <div class="qlist-option-row ${extraClass}" data-val="${escapeHTML(secenekText)}" data-is-correct="${isCorrect}">
            <span class="qlist-opt-letter">${letter}</span>
            <span class="qlist-opt-text">${escapeHTML(secenekText)}</span>
            ${isCorrect ? '<span class="qlist-correct-pill">✓ Doğru</span>' : ''}
          </div>
        `;
      });

      card.innerHTML = `
        <div class="qlist-card-header">
          <div class="qlist-card-badge-wrap">
            <span class="qlist-num-badge">Soru #${q.soru_no || (qIndex + 1)}</span>
          </div>
          <button class="btn-item-eye-toggle ${isCardRevealed ? 'active' : ''}" data-idx="${qIndex}" title="${isCardRevealed ? 'Bu Sorunun Cevabını Gizle' : 'Bu Sorunun Cevabını Göster'}">
            ${isCardRevealed ? '🙈' : '👁️'}
          </button>
        </div>
        <h4 class="qlist-card-text">${escapeHTML(q.soru)}</h4>
        <div class="qlist-card-options">
          ${optionsHtml}
        </div>
      `;

      // Bireysel göz butonu tıklaması
      const itemEyeBtn = card.querySelector('.btn-item-eye-toggle');
      if (itemEyeBtn) {
        itemEyeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSingleCardEye(qIndex, card);
        });
      }

      // Şıklara tıklama (Cevaplar kapalıyken kullanıcının kendini sınayabilmesi için)
      card.querySelectorAll('.qlist-option-row').forEach(optRow => {
        optRow.addEventListener('click', () => {
          handleListOptionClick(q, optRow.getAttribute('data-val'), card, qIndex);
        });
      });

      container.appendChild(card);
    });
  }

  // Tekil soru göz butonu toggle
  function toggleSingleCardEye(qIndex, cardEl) {
    if (singleRevealedIndices.has(qIndex)) {
      singleRevealedIndices.delete(qIndex);
    } else {
      singleRevealedIndices.add(qIndex);
    }
    applyEyeStateToCards();
  }

  // Şık tıklaması (İnteraktif kendi kendini test etme)
  function handleListOptionClick(q, selectedVal, cardEl, qIndex) {
    const isCorrect = isExactAnswer(selectedVal, q.dogru_cevap);
    listUserAnswers[qIndex] = {
      selected: selectedVal,
      isCorrect: isCorrect
    };

    // Bu soruyu otomatik açık göster
    singleRevealedIndices.add(qIndex);
    applyEyeStateToCards();
  }

  // Klavye Kısayolları (Sol/Sağ Ok, Enter)
  function handleLessonKeydown(e) {
    const lessonsSection = document.getElementById('tab-content-lessons');
    if (!lessonsSection || !lessonsSection.classList.contains('active')) return;

    const activeView = document.getElementById('lesson-active-view');
    if (!activeView || activeView.style.display === 'none') return;

    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevQuestion();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (currentMode === 'study') {
        nextQuestion();
      } else if (testAnswerLocked) {
        advanceTestQuestion();
      }
    } else if (e.key === 'Enter') {
      if (currentMode === 'test' && testAnswerLocked) {
        e.preventDefault();
        advanceTestQuestion();
      }
    }
  }

  // Doğru Cevap Eşleştirme Yardımcısı (Büyük/Küçük harf ve boşluk toleranslı)
  function isExactAnswer(optionText, correctAnswer) {
    if (!optionText || !correctAnswer) return false;
    return optionText.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  }

  // Dizi Karıştırıcı (Fisher-Yates)
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

  // Toast Bildirimi
  function showLessonToast(message, type = 'info') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast-notification show ${type}`;
    setTimeout(() => {
      toast.className = 'toast-notification';
    }, 2200);
  }

})();

