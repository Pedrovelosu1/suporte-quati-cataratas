// Configurações Globais - Lê a chave salva no navegador ou fica pendente
let geminiApiKey = localStorage.getItem('cataratas_gemini_key') || '';
let userData = JSON.parse(localStorage.getItem('cataratas_user_data')) || null;
let isSpeaking = false;
let currentUtterance = null;

// Inicialização da Página
document.addEventListener('DOMContentLoaded', () => {
    updateApiStatusDot();
    
    if (!userData) {
        openOnboardingModal();
    } else {
        closeOnboardingModal();
        updateUIWithUserData();
        renderWelcomeMessage();
    }
});

// Atualiza o Indicador da API no Menu
function updateApiStatusDot() {
    const dot = document.getElementById('apiStatusDot');
    if (geminiApiKey) {
        dot.className = 'w-2 h-2 rounded-full bg-brand-green';
    } else {
        dot.className = 'w-2 h-2 rounded-full bg-red-500';
    }
}

// Salva e Gerencia o Onboarding
function saveOnboardingData(event) {
    event.preventDefault();
    const name = document.getElementById('onboardName').value.trim();
    const dept = document.getElementById('onboardDept').value.trim();
    const lang = document.getElementById('onboardLang').value;

    if (!name || !dept) return;

    userData = { name, dept, lang };
    localStorage.setItem('cataratas_user_data', JSON.stringify(userData));

    closeOnboardingModal();
    updateUIWithUserData();
    
    document.getElementById('chatContainer').innerHTML = '';
    renderWelcomeMessage();
}

function updateUIWithUserData() {
    if (!userData) return;
    document.getElementById('badgeUserName').innerText = userData.name;
    document.getElementById('badgeUserDept').innerText = userData.dept;

    const langNames = {
        'pt-BR': '🇧🇷 Português',
        'en-US': '🇺🇸 English',
        'es-ES': '🇪🇸 Español',
        'fr-FR': '🇫🇷 Français'
    };
    document.getElementById('headerLangBadge').innerText = langNames[userData.lang] || '🇧🇷 Português';
}

function openOnboardingModal() {
    if (userData) {
        document.getElementById('onboardName').value = userData.name;
        document.getElementById('onboardDept').value = userData.dept;
        document.getElementById('onboardLang').value = userData.lang;
    }
    document.getElementById('onboardingModal').classList.remove('hidden');
}

function closeOnboardingModal() {
    document.getElementById('onboardingModal').classList.add('hidden');
}

// Modais de Configuração de API
function openConfigModal() {
    document.getElementById('apiKeyInput').value = geminiApiKey;
    document.getElementById('configModal').classList.remove('hidden');
}

function closeConfigModal() {
    document.getElementById('configModal').classList.add('hidden');
}

function saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    geminiApiKey = key;
    localStorage.setItem('cataratas_gemini_key', key);
    updateApiStatusDot();
    closeConfigModal();
}

// Alternar Menu Lateral no Telemóvel
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

// Mensagem Inicial de Boas-Vindas
function renderWelcomeMessage() {
    const chatContainer = document.getElementById('chatContainer');
    const lang = userData ? userData.lang : 'pt-BR';

    const greetings = {
        'pt-BR': `Olá, **${userData.name}**! Sou o **Quati**, assistente virtual do Grupo Cataratas. Como posso ajudar o setor de **${userData.dept}** hoje?`,
        'en-US': `Hello, **${userData.name}**! I'm **Quati**, the virtual assistant for Grupo Cataratas. How can I assist the **${userData.dept}** department today?`,
        'es-ES': `¡Hola, **${userData.name}**! Soy **Quati**, el asistente virtual del Grupo Cataratas. ¿Cómo puedo ayudar al departamento de **${userData.dept}** hoy?`,
        'fr-FR': `Bonjour, **${userData.name}**! Je suis **Quati**, l'assistant virtuel du Groupe Cataratas. Comment puis-je aider le service **${userData.dept}** aujourd'hui?`
    };

    const text = greetings[lang] || greetings['pt-BR'];
    appendBotMessage(text);
}

// Submissão de Formulário e Dúvidas Rápidas
function sendQuickQuestion(questionText) {
    if (window.innerWidth < 768) {
        toggleSidebar();
    }
    document.getElementById('userInput').value = questionText;
    handleFormSubmit(new Event('submit'));
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('userInput');
    const query = input.value.trim();
    if (!query) return;

    appendUserMessage(query);
    input.value = '';

    const loadingId = appendLoadingMessage();

    try {
        const botResponse = await fetchGeminiResponse(query);
        removeMessage(loadingId);
        appendBotMessage(botResponse);
        speakText(botResponse);
    } catch (error) {
        removeMessage(loadingId);
        appendBotMessage("Desculpe, tive um problema de conexão com a IA. Por favor, verifique a chave no menu lateral em 'Configurar Chave API'.");
    }
}

// Chamada de API do Gemini
async function fetchGeminiResponse(userQuery) {
    let keyToUse = geminiApiKey || localStorage.getItem('cataratas_gemini_key');

    if (!keyToUse) {
        return "Por favor, configure sua chave de API abrindo o menu lateral e clicando em 'Configurar Chave API'.";
    }

    const lang = userData ? userData.lang : 'pt-BR';

    const systemPrompt = `Você é o Quati, o mascote e assistente virtual inteligente Nível 1 do Grupo Cataratas.
    Dados do Usuário Atual:
    - Nome: ${userData ? userData.name : 'Colaborador'}
    - Setor/Departamento: ${userData ? userData.dept : 'Geral'}
    - Idioma Escolhido: ${lang}

    Regras OBRIGATÓRIAS:
    1. Responda SEMPRE no idioma preferido do usuário (${lang}).
    2. Seja extremamente educado, claro, objetivo e corporativo.
    3. Se for uma dúvida técnica simples (VPN, senha, impressora, e-mail, contracheque), forneça o passo a passo direto.
    4. Se o problema for complexo ou exigir intervenção humana, ofereça o botão de direcionamento para o WhatsApp da equipe de TI.
    5. Formate a resposta usando Markdown limpo (listas com *, negrito com **).`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyToUse}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': keyToUse
        },
        body: JSON.stringify({
            contents: [
                { role: 'user', parts: [{ text: `${systemPrompt}\n\nPergunta do Colaborador:${userQuery}` }] }
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro na resposta da API Gemini:', errorData);
        throw new Error('Erro na API');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Renderização de Mensagens
function appendUserMessage(text) {
    const chatContainer = document.getElementById('chatContainer');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'flex justify-end mb-4 animate-fade-in';
    msgDiv.innerHTML = `
        <div class="bg-brand-forest text-white p-3.5 rounded-2xl rounded-tr-none max-w-[85%] sm:max-w-[70%] text-xs shadow-md">
            <p class="font-semibold text-[10px] text-brand-green mb-1">${userData ? userData.name : 'Você'}</p>
            <div class="leading-relaxed">${escapeHtml(text)}</div>
        </div>
    `;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendBotMessage(markdownText) {
    const chatContainer = document.getElementById('chatContainer');
    const msgDiv = document.createElement('div');
    const msgId = 'msg-' + Date.now();
    msgDiv.id = msgId;
    msgDiv.className = 'flex items-start gap-2.5 mb-4 animate-fade-in';

    const parsedHtml = marked.parse(markdownText);
    const whatsappLink = `https://wa.me/5521969499074?text=${encodeURIComponent(`Olá! Sou ${userData ? userData.name : 'Colaborador'} do setor ${userData ? userData.dept : 'Geral'}. Preciso de suporte especializado.`)}`;

    msgDiv.innerHTML = `
        <div class="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-md border border-brand-border bg-brand-dark flex items-center justify-center mt-1">
            <img src="quati.jpg" alt="Quati" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/616/616408.png';">
        </div>
        <div class="bg-brand-card border border-brand-border p-3.5 rounded-2xl rounded-tl-none max-w-[88%] sm:max-w-[75%] text-xs shadow-md space-y-2">
            <div class="flex items-center justify-between border-b border-brand-border/60 pb-1.5">
                <span class="font-bold text-brand-green text-[11px] flex items-center gap-1">
                    <i class="fa-solid fa-robot"></i> Assistente Quati
                </span>
                <button onclick="speakTextFromElement('${msgId}')" class="text-slate-400 hover:text-brand-green p-1 transition-colors" title="Ouvir resposta">
                    <i class="fa-solid fa-volume-high"></i>
                </button>
            </div>
            <div class="markdown-body text-slate-200 leading-relaxed">${parsedHtml}</div>
            
            <div class="pt-2 border-t border-brand-border/40 flex justify-end">
                <a href="${whatsappLink}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold hover:bg-emerald-600 hover:text-white transition-all">
                    <i class="fa-brands fa-whatsapp text-xs"></i> Falar com Suporte Humano
                </a>
            </div>
        </div>
    `;

    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendLoadingMessage() {
    const chatContainer = document.getElementById('chatContainer');
    const loadingId = 'loading-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.id = loadingId;
    msgDiv.className = 'flex items-start gap-2.5 mb-4';
    msgDiv.innerHTML = `
        <div class="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-md border border-brand-border bg-brand-dark flex items-center justify-center">
            <img src="quati.jpg" alt="Quati" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/616/616408.png';">
        </div>
        <div class="bg-brand-card border border-brand-border p-3 rounded-2xl rounded-tl-none text-xs text-slate-400 flex items-center gap-2">
            <i class="fa-solid fa-circle-notch animate-spin text-brand-green"></i> O Quati está digitando...
        </div>
    `;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loadingId;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// Síntese de Voz
function speakText(text) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[*#_`]/g, '');

    currentUtterance = new SpeechSynthesisUtterance(cleanText);
    currentUtterance.lang = userData ? userData.lang : 'pt-BR';
    currentUtterance.rate = 1.0;

    const avatar = document.getElementById('quatiAvatarHeader');

    currentUtterance.onstart = () => {
        isSpeaking = true;
        if (avatar) avatar.classList.add('quati-talking');
    };

    currentUtterance.onend = () => {
        isSpeaking = false;
        if (avatar) avatar.classList.remove('quati-talking');
    };

    currentUtterance.onerror = () => {
        isSpeaking = false;
        if (avatar) avatar.classList.remove('quati-talking');
    };

    window.speechSynthesis.speak(currentUtterance);
}

function speakTextFromElement(msgId) {
    const msgEl = document.getElementById(msgId);
    if (msgEl) {
        const text = msgEl.querySelector('.markdown-body').innerText;
        speakText(text);
    }
}

// Auxiliar para sanear HTML
function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}