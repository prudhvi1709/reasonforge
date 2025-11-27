/**
 * UI Controller Module
 * Handles user interactions and application workflow
 */

import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import {
    llmConfig,
    prompts,
    loadPrompts,
    configureLLMProvider,
    getFilteredModels,
    callPlannerLLM,
    callJudgeLLM,
    callChatLLM
} from "./llm-service.js";
import { renderPlans, renderJudgeResults } from "./renderers.js";

// ============================================================
// STATE
// ============================================================

const appState = {
    problem: "",
    plannerJson: null,
    judgeJson: null,
    bestPlan: null,
    chatUnlocked: false,
    chatState: {
        systemPrompt: "",
        messages: [],
        contextMessage: ""
    }
};

// ============================================================
// DOM ELEMENTS
// ============================================================

const getElement = (id) => document.getElementById(id);

const elements = {
    problemInput: getElement("problemInput"),
    generateBtn: getElement("generateBtn"),
    loadingSpinner: getElement("loadingSpinner"),
    loadingText: getElement("loadingText"),
    alertContainer: getElement("alertContainer"),
    resultsSection: getElement("resultsSection"),
    plansContainer: getElement("plansContainer"),
    planCount: getElement("planCount"),
    judgeContainer: getElement("judgeContainer"),
    chatSection: getElement("chatSection"),
    chatStatus: getElement("chatStatus"),
    chatMessages: getElement("chatMessages"),
    chatInput: getElement("chatInput"),
    chatSendBtn: getElement("chatSendBtn"),
    settingsBtn: getElement("settingsBtn"),
    configureBtn: getElement("configureBtn"),
    providerBanner: getElement("providerBanner"),
    providerStatus: getElement("providerStatus"),
    plannerModelSelect: getElement("plannerModelSelect"),
    judgeModelSelect: getElement("judgeModelSelect")
};

// ============================================================
// UI UTILITIES
// ============================================================

const showAlert = (message, type = "danger") => {
    const iconMap = { danger: 'exclamation-triangle', success: 'check-circle', warning: 'exclamation-circle', info: 'info-circle' };
    const alertDiv = document.createElement('div');
    alertDiv.id = `alert-${Date.now()}`;
    
    render(html`
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            <i class="bi bi-${iconMap[type]} me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `, alertDiv);
    
    elements.alertContainer.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 10000);
};

const setLoading = (isLoading, text = "") => {
    elements.generateBtn.disabled = isLoading;
    elements.loadingSpinner.classList.toggle("d-none", !isLoading);
    elements.loadingText.classList.toggle("d-none", !isLoading);
    elements.loadingText.textContent = text;
};

const escapeHtml = (text) => {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
};

const formatChatContent = (content) => {
    let formatted = escapeHtml(content);
    formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-light border p-3 rounded mt-2"><code>$2</code></pre>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-light border px-2 py-1 rounded" style="color: #d63384;">$1</code>');
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
};

// ============================================================
// PROVIDER UI
// ============================================================

const updateProviderUI = () => {
    const isConfigured = !!llmConfig.baseUrl;
    const providerName = isConfigured ? new URL(llmConfig.baseUrl).hostname : '';
    
    elements.providerBanner.classList.toggle("alert-info", !isConfigured);
    elements.providerBanner.classList.toggle("alert-success", isConfigured);
    
    elements.providerStatus.innerHTML = isConfigured
        ? `<i class="bi bi-check-circle-fill me-2"></i>Connected to <strong>${providerName}</strong> • ${llmConfig.models.length} models available`
        : '<i class="bi bi-info-circle me-1"></i>Click "Settings" to configure your LLM provider';
    
    elements.configureBtn.innerHTML = isConfigured 
        ? '<i class="bi bi-gear me-1"></i>Change Provider'
        : '<i class="bi bi-plug me-1"></i>Configure Provider';
    
    elements.generateBtn.disabled = !isConfigured;
    elements.plannerModelSelect.disabled = !isConfigured;
    elements.judgeModelSelect.disabled = !isConfigured;
    
    if (isConfigured) populateModelSelectors();
};

const populateModelSelectors = () => {
    const sortedModels = getFilteredModels();
    const preferredModels = ['gpt-5-mini', 'gpt-5-nano', 'gpt-4.1-mini', 'gpt-4o-mini'];
    const autoSelect = sortedModels.find(m => preferredModels.some(p => m.toLowerCase().includes(p))) || sortedModels[0];

    // If already set in llmConfig (loaded from localStorage), use those values
    const plannerDefault = (llmConfig.plannerModel && sortedModels.includes(llmConfig.plannerModel)) 
        ? llmConfig.plannerModel 
        : autoSelect;
    const judgeDefault = (llmConfig.judgeModel && sortedModels.includes(llmConfig.judgeModel)) 
        ? llmConfig.judgeModel 
        : autoSelect;

    const populateSelect = (element, placeholder, defaultValue) => {
        element.innerHTML = `<option value="">${placeholder}</option>` + 
            sortedModels.map(m => `<option value="${m}">${m}</option>`).join('');
        element.value = defaultValue;
        element.disabled = false;
    };

    populateSelect(elements.plannerModelSelect, "Select Planner model...", plannerDefault);
    populateSelect(elements.judgeModelSelect, "Select Judge model...", judgeDefault);
    
    llmConfig.plannerModel = plannerDefault;
    llmConfig.judgeModel = judgeDefault;
};

// ============================================================
// CHAT
// ============================================================

const unlockChat = () => {
    appState.chatUnlocked = true;
    elements.chatSection.classList.remove("d-none");
    elements.chatStatus.textContent = "Active";
    elements.chatStatus.classList.replace("bg-secondary", "bg-primary");
    elements.chatInput.disabled = false;
    elements.chatSendBtn.disabled = false;

    render(html`
        <div class="text-center text-muted py-5">
            <i class="bi bi-chat-dots fs-1 d-block mb-3"></i>
            <p class="mb-0">Start a conversation to refine the selected plan</p>
        </div>
    `, elements.chatMessages);

    const synthesizedPlan = appState.judgeJson.synthesized_plan;
    const bestCandidateId = appState.judgeJson.best_candidate_id || appState.judgeJson.best_plan_id;
    const bestCandidate = appState.plannerJson.plans.find(p => p.id === bestCandidateId);
    
    appState.bestPlan = synthesizedPlan || bestCandidate;
    appState.chatState.systemPrompt = prompts.chat;
    
    const buildContext = (plan, isSynthesized) => {
        const base = `**Original Problem:**\n${appState.problem}\n\n${isSynthesized ? '**Judge\'s Synthesized Best Plan:**' : '**Selected Best Plan:**'}\n${JSON.stringify(plan, null, 2)}`;
        const evoInfo = isSynthesized ? `\n\n**Evolution Analysis:**\n- Crossover: ${appState.judgeJson.evolution_notes?.crossover_applied || 'N/A'}\n- Mutations: ${JSON.stringify(appState.judgeJson.evolution_notes?.mutations_applied || [])}\n- Why Better: ${appState.judgeJson.evolution_notes?.why_better || 'N/A'}\n\n**Base Candidate:** ${bestCandidateId}` : '';
        return `Here is the context for our conversation:\n\n${base}${evoInfo}\n\n**Revised Prompt:**\n${appState.judgeJson.revised_prompt}\n\nI'm ready to help you refine this plan, provide implementation details, or make adjustments based on your needs.`;
    };
    
    appState.chatState.contextMessage = buildContext(appState.bestPlan, !!synthesizedPlan);
};

const renderChatMessage = (role, content, isStreaming = false) => html`
    <div class="d-flex ${role === 'user' ? 'justify-content-end' : 'justify-content-start'} mb-3">
        <div class="p-3 rounded ${role === 'user' ? 'bg-primary text-white' : 'bg-light border'}" style="max-width: 80%;">
            <div class="small mb-2 ${role === 'user' ? 'opacity-75' : 'text-muted'}">
                <i class="bi bi-${role === 'user' ? 'person-fill' : 'robot'} me-1"></i>
                ${role === 'user' ? 'You' : 'Assistant'}
                ${isStreaming ? html`<span class="spinner-border spinner-border-sm ms-2"></span>` : ''}
            </div>
            <div>${unsafeHTML(formatChatContent(content))}</div>
        </div>
    </div>
`;

const sendChatMessage = async () => {
    const userMessage = elements.chatInput.value.trim();
    if (!userMessage || !appState.chatUnlocked) return;

    elements.chatInput.value = "";
    
    const userDiv = document.createElement('div');
    render(renderChatMessage('user', userMessage), userDiv);
    elements.chatMessages.appendChild(userDiv);
    appState.chatState.messages.push({ role: "user", content: userMessage });

    elements.chatInput.disabled = true;
    elements.chatSendBtn.disabled = true;

    const assistantMsgDiv = document.createElement('div');
    elements.chatMessages.appendChild(assistantMsgDiv);

    try {
        const conversation = [{ role: "system", content: appState.chatState.systemPrompt }];

        if (appState.chatState.messages.length === 1) {
            conversation.push(
                { role: "user", content: appState.chatState.contextMessage },
                { role: "assistant", content: "I understand the context. I'm ready to help you refine the selected plan. What would you like to discuss or modify?" }
            );
        }

        conversation.push(...appState.chatState.messages);

        const response = await callChatLLM(conversation, (streamingContent) => {
            render(renderChatMessage('assistant', streamingContent, true), assistantMsgDiv);
            elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        });

        render(renderChatMessage('assistant', response, false), assistantMsgDiv);
        appState.chatState.messages.push({ role: "assistant", content: response });
    } catch (error) {
        console.error("Chat error:", error);
        showAlert(`Chat error: ${error.message}`, "danger");
        if (assistantMsgDiv.parentNode) assistantMsgDiv.remove();
    } finally {
        elements.chatInput.disabled = false;
        elements.chatSendBtn.disabled = false;
        elements.chatInput.focus();
    }
};

// ============================================================
// MAIN WORKFLOW
// ============================================================

const generateAndEvaluate = async () => {
    const problem = elements.problemInput.value.trim();
    if (!problem) return showAlert("Please enter a problem statement.", "warning");
    if (!llmConfig.baseUrl) {
        showAlert("Please configure an LLM provider first.", "warning");
        await configureLLMProvider(true);
        return;
    }

    appState.problem = problem;

    try {
        elements.resultsSection.classList.remove("d-none");
        
        setLoading(true, "Generating plans with Planner LLM...");
        const plannerJson = await callPlannerLLM(problem, (partialData) => {
            if (partialData?.plans) {
                renderPlans(partialData, elements.plansContainer, elements.planCount);
            }
        });
        appState.plannerJson = plannerJson;
        renderPlans(plannerJson, elements.plansContainer, elements.planCount);

        setLoading(true, "Evaluating plans with Judge LLM...");
        const judgeJson = await callJudgeLLM(problem, plannerJson, (partialData) => {
            if (partialData?.plan_reviews) {
                renderJudgeResults(partialData, plannerJson, elements.judgeContainer);
            }
        });
        appState.judgeJson = judgeJson;
        renderJudgeResults(judgeJson, plannerJson, elements.judgeContainer);

        unlockChat();
        elements.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
        showAlert("Plans generated and evaluated successfully!", "success");
    } catch (error) {
        console.error("Error:", error);
        showAlert(`Error: ${error.message}`, "danger");
    } finally {
        setLoading(false);
    }
};

// ============================================================
// INITIALIZATION
// ============================================================

const init = async () => {
    console.log("ReasonForge initializing...");

    try {
        await loadPrompts();
        await configureLLMProvider(false);
        console.log("Loaded existing configuration");
    } catch (e) {
        console.log("No existing config found");
    }
    
    updateProviderUI();

    // Event listeners
    elements.generateBtn.addEventListener("click", generateAndEvaluate);
    elements.chatSendBtn.addEventListener("click", sendChatMessage);
    elements.chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    elements.settingsBtn.addEventListener("click", () => configureLLMProvider(true).then(updateProviderUI));
    elements.configureBtn.addEventListener("click", () => configureLLMProvider(true).then(updateProviderUI));
    elements.plannerModelSelect.addEventListener("change", (e) => {
        llmConfig.plannerModel = e.target.value;
        localStorage.setItem("reasonforge_model_selection", JSON.stringify({
            plannerModel: llmConfig.plannerModel,
            judgeModel: llmConfig.judgeModel
        }));
    });
    elements.judgeModelSelect.addEventListener("change", (e) => {
        llmConfig.judgeModel = e.target.value;
        localStorage.setItem("reasonforge_model_selection", JSON.stringify({
            plannerModel: llmConfig.plannerModel,
            judgeModel: llmConfig.judgeModel
        }));
    });
};

init();
