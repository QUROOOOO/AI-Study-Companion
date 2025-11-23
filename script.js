// ==================== STATE MANAGEMENT ====================
let notes = JSON.parse(localStorage.getItem('uncognito_notes') || '[]');
let flashcards = JSON.parse(localStorage.getItem('uncognito_flashcards') || '[]');
let stats = JSON.parse(localStorage.getItem('uncognito_stats') || '{"summaries": 0, "uploads": 0, "quizzes": 0}');
let currentNoteId = null;
let quizLibrarySelection = null;

// ==================== THEME MANAGEMENT ====================
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('uncognito_theme') || 'light';
if (savedTheme === 'dark') {
  document.body.classList.add('dark');
}
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
  localStorage.setItem('uncognito_theme', theme);
  showNotification(`${theme === 'dark' ? '🌙' : '☀️'} ${theme.charAt(0).toUpperCase() + theme.slice(1)} mode activated`, 'info');
});

// ==================== ANIMATION INITIALIZATION ====================
function animateLogoOnSidebarHover() {
  const sidebar = document.getElementById('sidebar');
  const logo = document.querySelector('.logo-round-orange');
  sidebar.addEventListener('mouseenter', () => logo.classList.add('animated-logo'));
  sidebar.addEventListener('mouseleave', () => logo.classList.remove('animated-logo'));
}
animateLogoOnSidebarHover();

// ==================== NAVIGATION HANDLING ====================
const menuItems = document.querySelectorAll('.menu-item');
const views = document.querySelectorAll('.view');
menuItems.forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});
function switchView(viewName) {
  menuItems.forEach(mi => mi.classList.remove('active'));
  const activeItem = document.querySelector(`[data-view="${viewName}"]`);
  if (activeItem) activeItem.classList.add('active');
  views.forEach(view => view.classList.remove('active'));
  const targetView = document.getElementById(`${viewName}-view`);
  if (targetView) targetView.classList.add('active');
  if (viewName === 'library') { renderNotes(); updateSummarizeSelect(); }
  if (viewName === 'chat') { scrollToBottom(); }
  if (viewName === 'stats') { updateStatsView(); }
}

// ==================== CHAT FUNCTIONALITY ====================
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const chatFileInput = document.getElementById('chatFileInput');
const typingIndicator = document.getElementById('typingIndicator');
const filePreviewContainer = document.getElementById('filePreviewContainer');
const filePreviewList = document.getElementById('filePreviewList');
let attachedFiles = [];
let chatHistory = [];

chatInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 140) + 'px';
});
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
sendBtn.addEventListener('click', sendMessage);
attachBtn.addEventListener('click', () => chatFileInput.click());
chatFileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    attachedFiles.push(file);
    addFilePreview(file);
  });
  filePreviewContainer.style.display = attachedFiles.length > 0 ? 'block' : 'none';
  chatFileInput.value = '';
});
function addFilePreview(file) {
  const preview = document.createElement('div');
  preview.className = 'file-preview-item';
  preview.innerHTML = `
    <span>📎 ${file.name}</span>
    <button onclick="removeFilePreview('${file.name.replace(/'/g, "\\'")}')">×</button>
  `;
  filePreviewList.appendChild(preview);
}
window.removeFilePreview = function(fileName) {
  attachedFiles = attachedFiles.filter(f => f.name !== fileName);
  filePreviewList.innerHTML = '';
  attachedFiles.forEach(addFilePreview);
  filePreviewContainer.style.display = attachedFiles.length > 0 ? 'block' : 'none';
};

async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message && attachedFiles.length === 0) return;
  if (message) { addMessage(message, 'user'); }
  if (attachedFiles.length > 0) {
    for (let file of attachedFiles) { await handleChatFile(file); }
    attachedFiles = [];
    filePreviewList.innerHTML = '';
    filePreviewContainer.style.display = 'none';
  }
  chatInput.value = '';
  chatInput.style.height = 'auto';
  if (message) {
    typingIndicator.style.display = 'flex';
    scrollToBottom();
    const response = await generateAIResponse(message);
    typingIndicator.style.display = 'none';
    addMessage(response, 'bot');
    scrollToBottom();
  }
}
function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;
  const avatar = document.createElement('div');
  avatar.className = `message-avatar ${sender}-avatar`;
  avatar.textContent = sender === 'bot' ? 'U' : '👤';
  const content = document.createElement('div');
  content.className = 'message-content';
  const messageText = document.createElement('div');
  messageText.className = 'message-text';
  messageText.innerHTML = formatMessage(text);
  content.appendChild(messageText);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}
function formatMessage(text) {
  // Show headings, bullets, weighting, highlight, limit answer length unless requested
  let isBrief = !text.match(/^[ ]*(define|what is|explain|describe)[ ]/i);
  if (isBrief && text.length > 340) text = text.slice(0, 320) + " ...";
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/\n/g, '<br>');
  text = text.replace(/(1\.\s.+?2\.\s)/, '<h3>$1</h3>'); // highlight lists
  return text;
}
async function handleChatFile(file) {
  const fileExt = file.name.split('.').pop().toLowerCase();
  addMessage(`📎 Uploaded: ${file.name}`, 'user');
  typingIndicator.style.display = 'flex';
  scrollToBottom();
  if (['txt', 'md'].includes(fileExt)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const note = {
        id: Date.now() + Math.random(),
        title: file.name,
        content: e.target.result,
        tag: fileExt,
        date: new Date().toISOString(),
        fileName: file.name,
        fileSize: formatFileSize(file.size)
      };
      notes.push(note); saveNotes();
      setTimeout(() => {
        typingIndicator.style.display = 'none';
        addMessage(`✅ File processed! "${file.name}" added to your library.`, 'bot');
        scrollToBottom();
      }, 800);
    };
    reader.readAsText(file);
  } else {
    const note = {
      id: Date.now() + Math.random(),
      title: file.name,
      content: `File uploaded: ${file.name}\n\nFor full text analysis, please copy-paste content or convert to .txt.`,
      tag: fileExt,
      date: new Date().toISOString(),
      fileName: file.name,
      fileSize: formatFileSize(file.size)
    };
    notes.push(note); saveNotes();
    setTimeout(() => {
      typingIndicator.style.display = 'none';
      addMessage(`✅ File added to your library!`, 'bot');
      scrollToBottom();
    }, 800);
  }
}
async function generateAIResponse(message) {
  let briefPrompt = "You are Uncognito, an AI study assistant. If the user asks for definitions/explanations, keep answers brief and high-yield. Organize replies using headings, highlighted terms, and well-formatted lists. Use a friendly, professional tone.";
  let messages = [
    {role: 'system', content: briefPrompt},
    {role: 'user', content: message}
  ];
  // Simulate actual AI response (replace with your API in production)
  await new Promise(res => setTimeout(res, 900));
  let mockAnswer = 'This is a concise, organized answer. <h2>Key Points</h2><ul><li>Topic Highlighted</li><li>Another Fact</li></ul>';
  return mockAnswer;
}
function scrollToBottom() {
  setTimeout(() => chatMessages.scrollTop = chatMessages.scrollHeight, 120);
}
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==================== NOTES/LIBRARY MANAGEMENT ====================
function saveNotes() {
  localStorage.setItem('uncognito_notes', JSON.stringify(notes));
  renderNotes();
  updateStats();
}
function renderNotes() {
  const notesGrid = document.getElementById('notesGrid');
  if (!notesGrid) return;
  notesGrid.innerHTML = '';
  if (notes.length === 0) {
    notesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 70px 20px; color: var(--color-on-surface2);">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; margin: 0 auto 20px; opacity: 0.3;">
        <rect x="2" y="7" width="20" height="15" rx="2"/>
        <path d="M16 3h2v4M8 3H6v4"/>
      </svg>
      <p style="font-weight: 700; font-size: 18px; color:var(--color-accent)">No notes yet.<br>Upload files via Chat!</p>
    </div>`;
    return;
  }
  notes.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    // Show topic by extracting from file name or start of content
    let topicName = extractTopic(note);
    let previewText = extractPreview(note.content);
    card.innerHTML = `
      <div class="note-tag">${note.tag.toUpperCase()} • ${note.fileSize}</div>
      <div class="note-title">${topicName}</div>
      <div class="note-preview">${previewText}</div>
      <div class="note-actions">
        <button class="note-action-btn" onclick="viewNote(${note.id})" title="View">👁️</button>
        <button class="note-action-btn delete-btn" onclick="confirmDeleteNote(${note.id})" title="Delete">🗑️</button>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('note-action-btn')) viewNote(note.id);
    });
    notesGrid.appendChild(card);
  });
}
function extractTopic(note) {
  // Try to extract main topic from file name or first heading/sentence
  let raw = note.title || '';
  let topic = raw.split(/[_.-]/)[0].replace(/(docx?|pdf|txt|md|xlsx?)$/i, '').trim();
  if (!topic) topic = note.content.slice(0,50).replace(/[\r\n]+/g,' ');
  return topic.length ? topic : 'Untitled Note';
}
function extractPreview(content) {
  // Return a short preview/jist
  let preview = content.split(".")[0];
  return preview.slice(0,90) + (preview.length > 90 ? "..." : "");
}

// ==================== MODALS: NOTE VIEW & DELETE ====================
window.viewNote = function(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;
  currentNoteId = id;
  document.getElementById('modalTitle').textContent = extractTopic(note);
  document.getElementById('modalTag').textContent = note.tag.toUpperCase();
  document.getElementById('modalDate').textContent = new Date(note.date).toLocaleDateString();
  document.getElementById('modalContent').textContent = note.content;
  document.getElementById('originalFileName').textContent = note.fileName || note.title;
  document.getElementById('originalFileType').textContent = note.tag.toUpperCase();
  document.getElementById('originalFileSize').textContent = note.fileSize || 'Unknown size';
  document.getElementById('noteModal').classList.add('active');
};
window.closeNoteModal = function() {
  document.getElementById('noteModal').classList.remove('active');
  currentNoteId = null;
};
window.copyNoteContent = function() {
  const content = document.getElementById('modalContent').textContent;
  navigator.clipboard.writeText(content);
  showNotification('📋 Content copied to clipboard!');
};
window.summarizeCurrentNote = function() {
  closeNoteModal();
  document.getElementById('library-view').scrollIntoView({ behavior:"smooth" });
  setTimeout(() => {
    document.getElementById('summarizeSelect').value = currentNoteId;
    document.getElementById('summarizeBtn').click();
  }, 300);
};

// ==================== DELETE CONFIRMATION ====================
window.confirmDeleteNote = function(noteId) {
  const modal = document.getElementById('deleteConfirmModal');
  const details = document.getElementById('deleteConfirmDetails');
  const note = notes.find(n => n.id === noteId);
  details.innerHTML = `Are you sure you want to delete <b>${note.fileName || note.title}</b>?<br>This will remove the file from your library.`;
  modal.classList.add('active');
  document.getElementById('deleteConfirmBtn').onclick = function() {
    notes = notes.filter(n => n.id !== noteId);
    modal.classList.remove('active');
    saveNotes();
    showNotification(`🗑️ Deleted "${note.fileName || note.title}"`, 'error');
  };
};
window.closeDeleteConfirmModal = function() {
  document.getElementById('deleteConfirmModal').classList.remove('active');
};

// ==================== SEARCH FUNCTIONALITY ====================
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.note-card');
    let foundCount = 0;
    cards.forEach(card => {
      // Smart search: match in topic/title OR preview/content
      const text = card.textContent.toLowerCase();
      let matches = text.includes(query);
      card.style.display = matches ? 'block' : 'none';
      if (matches) foundCount++;
    });
    // Show center-message when nothing found, remove side popups
    let grid = document.getElementById('notesGrid');
    if (foundCount === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 70px 20px; color: var(--color-on-surface2);">
        <span style="font-size:2.2em;color:var(--color-accent);font-weight:800;">Nothing found</span>
        <div style="font-size:1.2em;">Try searching with another keyword or topic.</div>
      </div>`;
    } else { renderNotes(); }
  });
}

// ==================== SUMMARY / KNOWLEDGE MAP ====================
function updateSummarizeSelect() {
  const select = document.getElementById('summarizeSelect');
  if (!select) return;
  select.innerHTML = '<option value="">Select a note...</option>';
  notes.forEach(note => {
    const option = document.createElement('option');
    option.value = note.id;
    option.textContent = extractTopic(note);
    select.appendChild(option);
  });
}
document.getElementById('summarizeBtn').addEventListener('click', async () => {
  const selectEl = document.getElementById('summarizeSelect');
  const noteId = parseFloat(selectEl.value);
  const note = notes.find(n => n.id === noteId);
  if (!note) return showNotification('⚠️ Please select a note', 'error');
  const output = document.getElementById('summaryOutput');
  output.innerHTML = `<div style="text-align: center; padding: 60px 20px;">
      <div class="typing-dots" style="display: inline-flex; margin: 0 auto;">
        <span></span><span></span><span></span>
      </div>
      <p style="margin-top: 22px; color: var(--color-on-surface2); font-weight: 600;">Generating AI summary...</p>
    </div>`;
  await new Promise(res => setTimeout(res, 1100));
  let summary = generateSummary(note.content);
  output.innerHTML = `<div style="line-height: 1.85; font-weight: 500;">${summary}</div>`;
  document.getElementById('libraryFlowchart').innerHTML = createFlowchartHTML(note.content);
  stats.summaries++;
  localStorage.setItem('uncognito_stats', JSON.stringify(stats));
  updateStats();
});
function generateSummary(text) {
  // Extractive summary: get 3-5 key facts or sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
  let keyPoints = sentences.slice(0, Math.min(5, sentences.length));
  return `
    <h3 style="color:var(--color-accent);font-weight:700;">Key Points</h3>
    ${keyPoints.map(s => `<div style="margin-bottom:12px;">• ${s.trim()}</div>`).join('')}
  `;
}
function createFlowchartHTML(content) {
  // Extract concepts, build knowledge map as Material style nodes
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 12);
  const concepts = sentences.slice(0, 8).map((s, i) => {
    const words = s.trim().split(' ').slice(0, 7).join(' ');
    return {
      id: i,
      text: words + (s.split(' ').length > 7 ? '...' : ''),
      level: Math.floor(i/2)
    };
  });
  let html = '<div style="padding: 20px; overflow-x: auto;">';
  html += '<div style="display: flex; flex-direction: column; gap: 24px; min-width: 600px;">';
  html += `
    <div style="text-align: center;">
      <div style="background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hi) 100%);
                  color: white;
                  padding: 18px 28px;
                  border-radius: 16px;
                  font-weight: 700;
                  font-size: 17px;
                  box-shadow: 0 4px 16px rgba(255, 140, 90, 0.3);">
        📌 Main Topic
      </div>
    </div>
  `;
  let currentLevel = -1;
  concepts.forEach((concept, i) => {
    if (concept.level !== currentLevel) {
      if (currentLevel !== -1) html += '</div>';
      html += '<div style="display: flex; gap: 17px; justify-content: center; flex-wrap: wrap;">';
      currentLevel = concept.level;
    }
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    ];
    html += `
      <div style="background: ${colors[i % 4]};
                  color: white;
                  padding: 14px 22px;
                  border-radius: 13px;
                  font-weight: 600;
                  font-size: 15px;
                  max-width: 200px;
                  box-shadow: 0 4px 12px rgba(0,0,0, 0.11);
                  transition: transform 0.22s;
                  cursor: pointer;"
                   onmouseover="this.style.transform='scale(1.07)'"
                   onmouseout="this.style.transform='scale(1)'">
        ${concept.text}
      </div>
    `;
  });
  html += '</div>';
  html += `<div style="text-align: center; padding-top: 20px; border-top: 2px solid var(--color-outline); margin-top: 20px;">
      <p style="color: var(--color-on-surface2); font-size: 14px; font-weight: 600;">💡 Knowledge map: core concepts from your note</p>
    </div>
  `;
  html += '</div></div>';
  return html;
}

// ==================== QUIZ SECTION ====================
document.getElementById('uploadQuizFileBtn').addEventListener('click', () => chatFileInput.click());
document.getElementById('chooseLibraryForQuizBtn').addEventListener('click', () => openLibrarySelectModal());
function openLibrarySelectModal() {
  document.getElementById('librarySelectModal').classList.add('active');
  // Show notes in modal
  const modalGrid = document.getElementById('modalNotesGrid');
  modalGrid.innerHTML = '';
  notes.forEach(note => {
    let topic = extractTopic(note);
    let preview = extractPreview(note.content);
    let btn = document.createElement('button');
    btn.className = 'note-card';
    btn.innerHTML = `<div class="note-title">${topic}</div>
      <div style="font-size:1em;color:#575957;">${preview}</div>
      <div style="font-size:.92em;color:#ff914d;">${note.tag.toUpperCase()} • ${note.fileSize}</div>`;
    btn.onclick = function() {
      quizLibrarySelection = note;
      document.getElementById('librarySelectModal').classList.remove('active');
    };
    modalGrid.appendChild(btn);
  });
}
window.closeLibrarySelectModal = function() {
  document.getElementById('librarySelectModal').classList.remove('active');
};
document.getElementById('startQuizBtn').addEventListener('click', () => startQuiz());
function startQuiz() {
  let difficulty = document.getElementById('quizDifficultySelect').value;
  let topic = document.getElementById('quizTopicInput').value;
  let numQuestions = parseInt(document.getElementById('quizNumQuestions').value) || 5;
  let baseText = quizLibrarySelection ? quizLibrarySelection.content : (notes.length > 0 ? notes[0].content : '');
  document.getElementById('quizContainer').innerHTML = `<div class="typing-dots" style="margin-top:2em;"><span></span><span></span><span></span></div>`;
  setTimeout(() => {
    document.getElementById('quizContainer').innerHTML = renderQuizQuestions(numQuestions, topic, difficulty, baseText);
    stats.quizzes++;
    localStorage.setItem('uncognito_stats', JSON.stringify(stats));
    updateStats();
  }, 950);
}
function renderQuizQuestions(num, topic, difficulty, text) {
  // For now, mock-up questions extraction
  let mockQuestions = [];
  for (let i = 1; i <= num; i++) {
    mockQuestions.push({
      question: `Q${i}. (${topic || "General"}) at level ${difficulty}.`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      answer: "Option B"
    });
  }
  return mockQuestions.map(q =>
    `<div class="quiz-qbox"><h3>${q.question}</h3>
      <div class="quiz-options">${q.options.map(opt =>
        `<button class="quiz-option-btn">${opt}</button>`).join("")}
      </div>
    </div>`
  ).join("");
}

// ==================== STATS VIEW ====================
function updateStatsView() {
  // Radar graph can be animated using a library, here we'll mock it
  let statsSummary = document.getElementById('statsSummary');
  statsSummary.innerHTML = `
    <h2>Usage Summary</h2>
    <div>Total Notes: <span id="totalNotes">${notes.length}</span></div>
    <div>Quizzes Completed: <span id="totalQuizzes">${stats.quizzes || 0}</span></div>
    <div>Summaries Generated: <span id="totalSummaries">${stats.summaries || 0}</span></div>
    <h3>Productivity Progress</h3>
    <div>Your learning stats will visualize here.</div>
  `;
  let advice = document.getElementById('actionableAdvice');
  advice.innerHTML = `🚀 Optimize your study! Try generating summaries and quizzes from the most recent uploaded notes.`;
}

function updateStats() {
  document.getElementById('totalNotes').textContent = notes.length;
  document.getElementById('totalSummaries').textContent = stats.summaries || 0;
  document.getElementById('totalQuizzes').textContent = stats.quizzes || 0;
}

// ==================== EXPRESSIVE MATERIAL NOTIFICATION SYSTEM ====================
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  const colors = {
    success: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hi) 100%)',
    error: 'linear-gradient(135deg, #eb084e 0%, #e54b4b 100%)',
    info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
  };
  notification.style.cssText = `
    position: fixed;
    top: 32px;
    right: 32px;
    padding: 18px 32px;
    background: ${colors[type] || colors.success};
    color: white;
    border-radius: 16px;
    font-size: 17px;
    font-weight: 700;
    box-shadow: 0 11px 38px rgba(0,0,0,.22);
    z-index: 10001;
    animation: slideIn .4s cubic-bezier(0.4,0,0.2,1);
    max-width: 420px;
    letter-spacing: -.01em;
    pointer-events:all;
  `;
  notification.innerHTML = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOut .3s cubic-bezier(0.4,0,0.2,1)';
    setTimeout(() => notification.remove(), 320);
  }, 2800);
}
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn { from{transform:translateX(500px);opacity:0;} to{transform:translateX(0);opacity:1;} }
  @keyframes slideOut {from{transform:translateX(0) scale(1);opacity:1;} to{transform:translateX(500px) scale(0.9);opacity:0;} }
`;
document.head.appendChild(style);

// ==================== INITIALIZE APP ====================
function initApp() {
  renderNotes();
  updateStats();
  updateSummarizeSelect();
  updateStatsView();
  scrollToBottom();
  console.log('%c🎉 Uncognito Initialized!', 'color: #ff914d; font-size: 16px; font-weight: bold;');
}
initApp();

// Auto-save on page unload
window.addEventListener('beforeunload', () => {
  localStorage.setItem('uncognito_notes', JSON.stringify(notes));
  localStorage.setItem('uncognito_flashcards', JSON.stringify(flashcards));
  localStorage.setItem('uncognito_stats', JSON.stringify(stats));
});

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K: Focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    switchView('library');
    setTimeout(() => {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.focus();
    }, 140);
  }
  // Ctrl/Cmd + /: Go to chat
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    switchView('chat');
    setTimeout(() => chatInput.focus(), 140);
  }
  // ESC: Close any modal
  if (e.key === 'Escape') {
    const modal = document.getElementById('noteModal');
    const delModal = document.getElementById('deleteConfirmModal');
    const libModal = document.getElementById('librarySelectModal');
    [modal, delModal, libModal].forEach(m => m && m.classList.contains('active') && (m.classList.remove('active')));
  }
});
