// ============================================================
// CONFIGURATION & DYNAMIC API HOSTING
// ============================================================

const API_URL =
    window.location.protocol.startsWith("http")
        ? ""
        : "http://localhost:8900";


// ============================================================
// DOM ELEMENTS
// ============================================================

const programmeOverlay = document.getElementById("programmeOverlay");
const onboardingStep1 = document.getElementById("onboardingStep1");
const onboardingStep2 = document.getElementById("onboardingStep2");
const onboardingStep1Btn = document.getElementById("onboardingStep1Btn");
const onboardingBackBtn = document.getElementById("onboardingBackBtn");
const topicCards = document.querySelectorAll(".topic-card");
const programmeCards = document.querySelectorAll(".programme-card");
const continueButton = document.getElementById("continueButton");
const sidebarProgramme = document.getElementById("sidebarProgramme");
const sidebarProgrammeDesc = document.getElementById("sidebarProgrammeDesc");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messages = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const typingContainer = document.getElementById("typingContainer");
const chatArea = document.getElementById("chatArea");
const newChatButton = document.getElementById("newChatButton");
const clearChat = document.getElementById("clearChat");
const changeProgramme = document.getElementById("changeProgramme");
const themeButton = document.getElementById("themeButton");
const topTheme = document.getElementById("topTheme");
const mobileMenu = document.getElementById("mobileMenu");
const sidebar = document.getElementById("sidebar");


// ============================================================
// STATE
// ============================================================

let selectedProgramme = null;
let selectedInterests = ["academic", "fee", "courses"];
let isLoading = false;

const PROGRAMME_NAMES = {
    "BCA": "Bachelor of Computer Applications",
    "BBA": "Bachelor of Business Administration",
    "B.com (H)": "Bachelor of Commerce (Honours)"
};


// ============================================================
// ONBOARDING & PREFERENCE MANAGEMENT
// ============================================================

function updateProgrammeDisplay(programme) {
    if (!programme) return;
    sidebarProgramme.textContent = programme;
    if (sidebarProgrammeDesc) {
        sidebarProgrammeDesc.textContent = PROGRAMME_NAMES[programme] || "Enrolled Student";
    }
}

function loadPreferences() {
    const savedProgramme = localStorage.getItem("collegeProgramme");
    const savedInterests = localStorage.getItem("collegeInterests");

    if (savedInterests) {
        try {
            selectedInterests = JSON.parse(savedInterests);
        } catch (e) {
            console.error("Error parsing saved interests:", e);
        }
    }

    // Reflect saved interests in topic cards UI
    topicCards.forEach(card => {
        const topic = card.dataset.topic;
        const isSelected = selectedInterests.includes(topic);
        card.classList.toggle("selected", isSelected);
        card.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });

    if (savedProgramme) {
        selectedProgramme = savedProgramme;
        updateProgrammeDisplay(savedProgramme);
        programmeOverlay.classList.add("hidden");
    } else {
        showOnboardingStep(1);
        programmeOverlay.classList.remove("hidden");
    }
}

function showOnboardingStep(stepNumber) {
    if (stepNumber === 1) {
        onboardingStep1.classList.remove("hidden");
        onboardingStep2.classList.add("hidden");
    } else {
        onboardingStep1.classList.add("hidden");
        onboardingStep2.classList.remove("hidden");
    }
}

// Step 1: Topic Multi-Selection
topicCards.forEach(card => {
    card.addEventListener("click", () => {
        const topic = card.dataset.topic;
        const isSelected = card.classList.toggle("selected");
        card.setAttribute("aria-pressed", isSelected ? "true" : "false");

        if (isSelected) {
            if (!selectedInterests.includes(topic)) {
                selectedInterests.push(topic);
            }
        } else {
            selectedInterests = selectedInterests.filter(t => t !== topic);
        }
    });
});

onboardingStep1Btn.addEventListener("click", () => {
    localStorage.setItem("collegeInterests", JSON.stringify(selectedInterests));
    showOnboardingStep(2);
});

onboardingBackBtn.addEventListener("click", () => {
    showOnboardingStep(1);
});

// Step 2: Programme Selection
function selectProgramme(programme) {
    selectedProgramme = programme;

    programmeCards.forEach(card => {
        const isSelected = card.dataset.programme === programme;
        card.classList.toggle("selected", isSelected);
        card.setAttribute("aria-checked", isSelected ? "true" : "false");
    });

    continueButton.disabled = false;
}

programmeCards.forEach(card => {
    card.addEventListener("click", () => {
        selectProgramme(card.dataset.programme);
    });
});

continueButton.addEventListener("click", () => {
    if (!selectedProgramme) return;

    localStorage.setItem("collegeProgramme", selectedProgramme);
    localStorage.setItem("collegeInterests", JSON.stringify(selectedInterests));
    updateProgrammeDisplay(selectedProgramme);
    programmeOverlay.classList.add("hidden");
    messageInput.focus();
});

changeProgramme.addEventListener("click", () => {
    showOnboardingStep(1);
    programmeOverlay.classList.remove("hidden");

    programmeCards.forEach(card => {
        const isSelected = card.dataset.programme === selectedProgramme;
        card.classList.toggle("selected", isSelected);
        card.setAttribute("aria-checked", isSelected ? "true" : "false");
    });

    continueButton.disabled = !selectedProgramme;
    sidebar.classList.remove("open");
});


// ============================================================
// SEND MESSAGE & API INTERACTION
// ============================================================

async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message || isLoading) return;

    if (!selectedProgramme) {
        showOnboardingStep(2);
        programmeOverlay.classList.remove("hidden");
        return;
    }

    // Hide welcome state
    if (welcome) {
        welcome.style.display = "none";
    }

    // Add user message to UI
    addMessage(message, "user");

    // Clear and resize input
    messageInput.value = "";
    autoResize();

    // Enable loading state & scroll
    setLoading(true);

    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                programme: selectedProgramme,
                message: message
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        addMessage(
            data.response || "I could not generate a response.",
            "assistant",
            data.source
        );

    } catch (error) {
        console.error("API ERROR:", error);
        addMessage(
            "I encountered an issue connecting to the AI assistant. Please make sure the backend server is running and try again.",
            "assistant",
            "System"
        );
    } finally {
        setLoading(false);
    }
}


// ============================================================
// ADD MESSAGE & RICH MARKDOWN RENDERING
// ============================================================

function addMessage(text, type, source = null) {
    const row = document.createElement("div");
    row.className = `message-row ${type}`;

    if (type === "assistant") {
        const avatar = document.createElement("div");
        avatar.className = "assistant-avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.innerHTML = `
            <div class="avatar-glow"></div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
        `;
        row.appendChild(avatar);
    }

    const content = document.createElement("div");
    content.className = "message-content";
    content.innerHTML = formatMarkdown(text);

    if (type === "assistant" && source && source !== "General") {
        const sourceElement = document.createElement("div");
        sourceElement.className = "message-source";
        sourceElement.innerHTML = `✦ ${escapeHTML(source)}`;
        content.appendChild(sourceElement);
    }

    row.appendChild(content);
    messages.appendChild(row);

    scrollToBottom();
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatMarkdown(text) {
    if (!text) return "";
    
    // First escape raw HTML for security
    let escaped = escapeHTML(text);

    // Split into lines for structured block processing
    const lines = escaped.split("\n");
    let result = [];
    let inList = false;
    let listType = ""; // 'ul' or 'ol'
    let i = 0;

    while (i < lines.length) {
        let line = lines[i].trim();

        if (!line) {
            if (inList) {
                result.push(`</${listType}>`);
                inList = false;
            }
            i++;
            continue;
        }

        // Markdown Table: | Col1 | Col2 | ... |
        if (line.startsWith("|") && line.endsWith("|")) {
            if (inList) {
                result.push(`</${listType}>`);
                inList = false;
            }

            // Check if next line is a separator like |---|---| or |:---|:---|
            if (i + 1 < lines.length && /^\|(\s*[-:]+\s*\|)+$/.test(lines[i + 1].trim())) {
                const headerCells = line.split("|").slice(1, -1).map(c => c.trim());
                let tableHtml = '<div class="table-container"><table><thead><tr>';
                headerCells.forEach(cell => {
                    const formatted = cell.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
                    tableHtml += `<th>${formatted}</th>`;
                });
                tableHtml += '</tr></thead><tbody>';

                i += 2; // skip header and separator

                while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
                    const rowCells = lines[i].trim().split("|").slice(1, -1).map(c => c.trim());
                    tableHtml += '<tr>';
                    rowCells.forEach(cell => {
                        const formatted = cell.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
                        tableHtml += `<td>${formatted}</td>`;
                    });
                    tableHtml += '</tr>';
                    i++;
                }
                tableHtml += '</tbody></table></div>';
                result.push(tableHtml);
                continue;
            }
        }

        // Bold formatting **text**
        line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

        // Headings
        const h1Match = line.match(/^#\s+(.*)$/);
        if (h1Match) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            result.push(`<h1 class="ai-h1">${h1Match[1]}</h1>`);
            i++;
            continue;
        }

        const h2Match = line.match(/^##\s+(.*)$/);
        if (h2Match) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            result.push(`<h2 class="ai-h2">${h2Match[1]}</h2>`);
            i++;
            continue;
        }

        const h3Match = line.match(/^###\s+(.*)$/);
        if (h3Match) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            result.push(`<h3 class="ai-h3">${h3Match[1]}</h3>`);
            i++;
            continue;
        }

        const h4Match = line.match(/^####\s+(.*)$/);
        if (h4Match) {
            if (inList) { result.push(`</${listType}>`); inList = false; }
            result.push(`<h4 class="ai-h4">${h4Match[1]}</h4>`);
            i++;
            continue;
        }

        // Bullet lists (- or * or •)
        const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
            if (!inList || listType !== "ul") {
                if (inList) result.push(`</${listType}>`);
                result.push("<ul>");
                inList = true;
                listType = "ul";
            }
            result.push(`<li>${bulletMatch[1]}</li>`);
            i++;
            continue;
        }

        // Numbered lists (1. 2.)
        const numberMatch = line.match(/^\d+\.\s+(.*)$/);
        if (numberMatch) {
            if (!inList || listType !== "ol") {
                if (inList) result.push(`</${listType}>`);
                result.push("<ol>");
                inList = true;
                listType = "ol";
            }
            result.push(`<li>${numberMatch[1]}</li>`);
            i++;
            continue;
        }

        // Regular paragraph line
        if (inList) {
            result.push(`</${listType}>`);
            inList = false;
        }
        result.push(`<p>${line}</p>`);
        i++;
    }

    if (inList) {
        result.push(`</${listType}>`);
    }

    return result.join("");
}


// ============================================================
// LOADING & TYPING INDICATOR
// ============================================================

function setLoading(loading) {
    isLoading = loading;
    typingContainer.classList.toggle("show", loading);
    sendButton.disabled = loading;
    messageInput.disabled = loading;

    if (loading) {
        scrollToBottom();
    } else {
        messageInput.focus();
    }
}


// ============================================================
// ACCURATE CHAT SCROLLING (PREVENTS COMPOSER OVERLAP)
// ============================================================

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatArea.scrollTo({
            top: chatArea.scrollHeight,
            behavior: "smooth"
        });
    });
}


// ============================================================
// INPUT AUTO-RESIZE & KEY LISTENERS
// ============================================================

function autoResize() {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 130) + "px";
}

messageInput.addEventListener("input", autoResize);

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener("click", sendMessage);


// ============================================================
// SUGGESTION CHIPS
// ============================================================

document.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
        messageInput.value = button.dataset.question;
        autoResize();
        messageInput.focus();
    });
});

document.querySelectorAll(".nav-item[data-suggestion]").forEach(button => {
    button.addEventListener("click", () => {
        messageInput.value = button.dataset.suggestion;
        autoResize();
        messageInput.focus();
        sidebar.classList.remove("open");
    });
});


// ============================================================
// CHAT CONTROLS (NEW CHAT & CLEAR)
// ============================================================

function resetChat() {
    messages.innerHTML = "";
    if (welcome) {
        welcome.style.display = "block";
    }
    messageInput.value = "";
    autoResize();
    sidebar.classList.remove("open");
    messageInput.focus();
}

newChatButton.addEventListener("click", resetChat);
clearChat.addEventListener("click", resetChat);


// ============================================================
// MOBILE MENU TOGGLE
// ============================================================

mobileMenu.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

// Close sidebar on outer click on mobile
document.addEventListener("click", (e) => {
    if (window.innerWidth <= 800) {
        if (!sidebar.contains(e.target) && !mobileMenu.contains(e.target) && sidebar.classList.contains("open")) {
            sidebar.classList.remove("open");
        }
    }
});


// ============================================================
// THEME SWITCHER
// ============================================================

function toggleTheme() {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    localStorage.setItem("collegeTheme", isLight ? "light" : "dark");
}

themeButton.addEventListener("click", toggleTheme);
topTheme.addEventListener("click", toggleTheme);

function loadTheme() {
    const savedTheme = localStorage.getItem("collegeTheme");
    if (savedTheme === "light") {
        document.body.classList.add("light");
    }
}


// ============================================================
// INITIALIZATION
// ============================================================

loadPreferences();
loadTheme();
autoResize();