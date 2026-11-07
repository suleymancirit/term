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
    // Ders Seçim Kartlarındaki Butonlar
    document.querySelectorAll('.btn-launch-lesson').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const lesson = btn.getAttribute('data-lesson');
        const mode = btn.getAttribute('data-mode'); // 'test' veya 'study'
        await startLessonSession(lesson, mode);
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
    document.getElementById('lessons-hub-view').style.display = 'block';
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

