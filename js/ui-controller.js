/**
 * UI Controller Module - User interactions and workflow
 */
import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { llmConfig, prompts, defaultPrompts, loadPrompts, configureLLMProvider, getFilteredModels, 
         callPlannerLLM, callJudgeLLM, callChatLLM, resetConversationState, getAPIType,
         saveCustomPrompts, resetPromptToDefault } from "./llm-service.js";
import { renderPlans, renderJudgeResults, renderJudgeLoading } from "./renderers.js";
import { problemStatements } from "./config.js";
import { exportMarkdownReport, exportJSONData } from "./export-service.js";

const appState = {
    problem: "", plannerJson: null, judgeJson: null, bestPlan: null, chatUnlocked: false,
    chatState: { systemPrompt: "", messages: [], contextMessage: "" }
};

const $ = id => document.getElementById(id);
const el = {
    problemInput: $("problemInput"), generateBtn: $("generateBtn"), loadingSpinner: $("loadingSpinner"),
    loadingText: $("loadingText"), alertContainer: $("alertContainer"), resultsSection: $("resultsSection"),
    plansContainer: $("plansContainer"), planCount: $("planCount"), judgeContainer: $("judgeContainer"),
    chatSection: $("chatSection"), chatStatus: $("chatStatus"), chatMessages: $("chatMessages"),
    chatInput: $("chatInput"), chatSendBtn: $("chatSendBtn"), settingsBtn: $("settingsBtn"),
    configureBtn: $("configureBtn"), providerBanner: $("providerBanner"), providerStatus: $("providerStatus"),
    plannerModelSelect: $("plannerModelSelect"), judgeModelSelect: $("judgeModelSelect"),
    problemCardsContainer: $("problemCardsContainer"), advancedSettingsBtn: $("advancedSettingsBtn"),
    advancedSettingsModal: null,
    exportMarkdownBtn: $("exportMarkdownBtn"), exportJsonBtn: $("exportJsonBtn")
};

const showAlert = (msg, type = "danger") => {
    const icons = { danger: 'exclamation-triangle', success: 'check-circle', warning: 'exclamation-circle', info: 'info-circle' };
    const div = document.createElement('div');
    render(html`<div class="alert alert-${type} alert-dismissible fade show" role="alert">
        <i class="bi bi-${icons[type]} me-2"></i>${msg}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`, div);
    el.alertContainer.appendChild(div);
    setTimeout(() => div.remove(), 10000);
};

const setLoading = (loading, text = "") => {
    el.generateBtn.disabled = loading;
    el.loadingSpinner.classList.toggle("d-none", !loading);
    el.loadingText.classList.toggle("d-none", !loading);
    el.loadingText.textContent = text;
};

const escapeHtml = t => { const d = document.createElement("div"); d.textContent = t || ""; return d.innerHTML; };

const formatChat = c => escapeHtml(c)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="border p-3 rounded mt-2"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="border px-2 py-1 rounded" style="color:#d63384;">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

const updateProviderUI = () => {
    const ok = !!llmConfig.baseUrl;
    const host = ok ? new URL(llmConfig.baseUrl).hostname : '';
    el.providerBanner.classList.toggle("alert-info", !ok);
    el.providerBanner.classList.toggle("alert-success", ok);
    el.providerStatus.innerHTML = ok
        ? `<i class="bi bi-check-circle-fill me-2"></i>Connected to <strong>${host}</strong> • ${llmConfig.models.length} models • <em>${getAPIType()}</em>`
        : '<i class="bi bi-info-circle me-1"></i>Click "Settings" to configure';
    el.configureBtn.innerHTML = ok ? '<i class="bi bi-gear me-1"></i>Change Provider' : '<i class="bi bi-plug me-1"></i>Configure';
    el.generateBtn.disabled = el.plannerModelSelect.disabled = el.judgeModelSelect.disabled = !ok;
    if (ok) populateModelSelectors();
};

const populateModelSelectors = () => {
    const models = getFilteredModels();
    const preferred = ['gpt-5-mini', 'gpt-5-nano', 'gpt-4.1-mini', 'gpt-4o-mini'];
    const auto = models.find(m => preferred.some(p => m.toLowerCase().includes(p))) || models[0];
    const pDef = (llmConfig.plannerModel && models.includes(llmConfig.plannerModel)) ? llmConfig.plannerModel : auto;
    const jDef = (llmConfig.judgeModel && models.includes(llmConfig.judgeModel)) ? llmConfig.judgeModel : auto;
    
    const fill = (sel, ph, def) => {
        sel.innerHTML = `<option value="">${ph}</option>` + models.map(m => `<option value="${m}">${m}</option>`).join('');
        sel.value = def; sel.disabled = false;
    };
    fill(el.plannerModelSelect, "Select Planner...", pDef);
    fill(el.judgeModelSelect, "Select Judge...", jDef);
    llmConfig.plannerModel = pDef; llmConfig.judgeModel = jDef;
};

const unlockChat = () => {
    appState.chatUnlocked = true;
    el.chatSection.classList.remove("d-none");
    el.chatStatus.textContent = "Active";
    el.chatStatus.classList.replace("bg-secondary", "bg-primary");
    el.chatInput.disabled = el.chatSendBtn.disabled = false;

    render(html`<div class="text-center text-success py-5">
        <i class="bi bi-chat-dots-fill fs-1 d-block mb-3"></i>
        <p class="mb-0 fw-medium">Start a conversation to refine the selected plan</p>
    </div>`, el.chatMessages);

    const synth = appState.judgeJson.synthesized_plan;
    const bestId = appState.judgeJson.best_candidate_id || appState.judgeJson.best_plan_id;
    appState.bestPlan = synth || appState.plannerJson.plans.find(p => p.id === bestId);
    appState.chatState.systemPrompt = prompts.chat;

    const evo = synth ? `\n\n**Evolution:**\n- Crossover: ${appState.judgeJson.evolution_notes?.crossover_applied || 'N/A'}\n- Mutations: ${JSON.stringify(appState.judgeJson.evolution_notes?.mutations_applied || [])}\n- Why Better: ${appState.judgeJson.evolution_notes?.why_better || 'N/A'}` : '';
    appState.chatState.contextMessage = `**Problem:**\n${appState.problem}\n\n**${synth ? 'Synthesized' : 'Selected'} Plan:**\n${JSON.stringify(appState.bestPlan, null, 2)}${evo}\n\n**Revised Prompt:**\n${appState.judgeJson.revised_prompt}`;
};

const chatMsg = (role, content, streaming = false) => html`
    <div class="d-flex ${role === 'user' ? 'justify-content-end' : 'justify-content-start'} mb-3">
        <div class="p-3 rounded ${role === 'user' ? 'bg-primary text-white' : 'border'}" style="max-width:80%;">
            <div class="small mb-2 ${role === 'user' ? 'opacity-75' : 'text-muted'}">
                <i class="bi bi-${role === 'user' ? 'person-fill' : 'robot'} me-1"></i>${role === 'user' ? 'You' : 'Assistant'}
                ${streaming ? html`<span class="spinner-border spinner-border-sm ms-2"></span>` : ''}
            </div>
            <div>${unsafeHTML(formatChat(content))}</div>
        </div>
    </div>`;

const sendChat = async () => {
    const msg = el.chatInput.value.trim();
    if (!msg || !appState.chatUnlocked) return;
    el.chatInput.value = "";
    el.chatMessages.querySelector(".text-center")?.remove();

    const userDiv = document.createElement('div');
    render(chatMsg('user', msg), userDiv);
    el.chatMessages.appendChild(userDiv);
    appState.chatState.messages.push({ role: "user", content: msg });
    el.chatInput.disabled = el.chatSendBtn.disabled = true;

    const aDiv = document.createElement('div');
    el.chatMessages.appendChild(aDiv);

    try {
        const conv = [{ role: "system", content: appState.chatState.systemPrompt }];
        if (appState.chatState.messages.length === 1) {
            conv.push({ role: "user", content: appState.chatState.contextMessage },
                      { role: "assistant", content: "I understand. What would you like to discuss?" });
        }
        conv.push(...appState.chatState.messages);

        const resp = await callChatLLM(conv, c => {
            render(chatMsg('assistant', c, true), aDiv);
            el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
        });
        render(chatMsg('assistant', resp), aDiv);
        appState.chatState.messages.push({ role: "assistant", content: resp });
    } catch (e) {
        showAlert(`Chat error: ${e.message}`);
        aDiv.remove();
    } finally {
        el.chatInput.disabled = el.chatSendBtn.disabled = false;
        el.chatInput.focus();
    }
};

const generate = async () => {
    const problem = el.problemInput.value.trim();
    if (!problem) return showAlert("Please enter a problem statement.", "warning");
    if (!llmConfig.baseUrl) { showAlert("Configure provider first.", "warning"); await configureLLMProvider(true); return; }

    appState.problem = problem;
    resetConversationState();

    try {
        el.resultsSection.classList.remove("d-none");
        setLoading(true, "Generating plans...");
        appState.plannerJson = await callPlannerLLM(problem, d => d?.plans && renderPlans(d, el.plansContainer, el.planCount));
        renderPlans(appState.plannerJson, el.plansContainer, el.planCount);

        setLoading(true, "Evaluating plans...");
        renderJudgeLoading(el.judgeContainer);
        appState.judgeJson = await callJudgeLLM(problem, appState.plannerJson, d => d?.plan_reviews && renderJudgeResults(d, appState.plannerJson, el.judgeContainer));
        renderJudgeResults(appState.judgeJson, appState.plannerJson, el.judgeContainer);

        unlockChat();
        el.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
        showAlert("Plans generated and evaluated!", "success");
    } catch (e) {
        showAlert(`Error: ${e.message}`);
    } finally {
        setLoading(false);
    }
};

// Problem Cards Rendering
const renderProblemCards = () => {
    const cardTemplate = (problem) => html`
        <div class="col-md-4">
            <div class="card h-100 problem-card border shadow-sm" 
                 style="cursor: pointer; transition: all 0.2s ease;"
                 @click=${() => selectProblem(problem)}
                 @mouseenter=${(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                 @mouseleave=${(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                <div class="card-body">
                    <div class="d-flex align-items-center mb-3">
                        <div class="rounded-circle bg-${problem.color} bg-opacity-10 p-2 me-3">
                            <i class="bi bi-${problem.icon} text-${problem.color} fs-4"></i>
                        </div>
                        <h6 class="card-title mb-0 fw-bold">${problem.title}</h6>
                    </div>
                    <p class="card-text text-muted small mb-3">${problem.description}</p>
                    <div class="d-flex flex-wrap gap-1">
                        ${problem.tags.map(tag => html`
                            <span class="badge bg-${problem.color} bg-opacity-10 text-${problem.color} fw-normal">${tag}</span>
                        `)}
                    </div>
                </div>
                <div class="card-footer bg-transparent border-0 pt-0">
                    <small class="text-${problem.color}">
                        <i class="bi bi-arrow-right me-1"></i>Click to use this problem
                    </small>
                </div>
            </div>
        </div>
    `;
    
    render(html`${problemStatements.map(cardTemplate)}`, el.problemCardsContainer);
};

const selectProblem = (problem) => {
    el.problemInput.value = problem.problem;
    el.problemInput.scrollIntoView({ behavior: "smooth", block: "center" });
    
    // Auto-click generate button if provider is configured
    if (llmConfig.baseUrl) {
        generate();
    } else {
        el.problemInput.focus();
        showAlert(`Loaded "${problem.title}" problem. Configure provider first, then click Generate Plans!`, "warning");
    }
};

// Advanced Settings Modal
const initAdvancedSettingsModal = () => {
    el.advancedSettingsModal = new bootstrap.Modal(document.getElementById('advancedSettingsModal'));
    
    const plannerEditor = $("plannerPromptEditor");
    const judgeEditor = $("judgePromptEditor");
    const chatEditor = $("chatPromptEditor");
    
    // Open modal and populate editors
    el.advancedSettingsBtn.addEventListener("click", () => {
        plannerEditor.value = prompts.planner;
        judgeEditor.value = prompts.judge;
        chatEditor.value = prompts.chat;
        el.advancedSettingsModal.show();
    });
    
    // Save prompts
    $("savePromptsBtn").addEventListener("click", () => {
        saveCustomPrompts({
            planner: plannerEditor.value,
            judge: judgeEditor.value,
            chat: chatEditor.value
        });
        el.advancedSettingsModal.hide();
        showAlert("Prompts saved successfully!", "success");
    });
    
    // Reset buttons
    $("resetPlannerPrompt").addEventListener("click", () => {
        plannerEditor.value = resetPromptToDefault("planner");
        showAlert("Planner prompt reset to default", "info");
    });
    
    $("resetJudgePrompt").addEventListener("click", () => {
        judgeEditor.value = resetPromptToDefault("judge");
        showAlert("Judge prompt reset to default", "info");
    });
    
    $("resetChatPrompt").addEventListener("click", () => {
        chatEditor.value = resetPromptToDefault("chat");
        showAlert("Chat prompt reset to default", "info");
    });
};

const init = async () => {
    try { await loadPrompts(); await configureLLMProvider(false); } catch {}
    updateProviderUI();
    renderProblemCards();
    initAdvancedSettingsModal();

    const saveModels = () => localStorage.setItem("reasonforge_model_selection", 
        JSON.stringify({ plannerModel: llmConfig.plannerModel, judgeModel: llmConfig.judgeModel }));

    el.generateBtn.addEventListener("click", generate);
    el.chatSendBtn.addEventListener("click", sendChat);
    el.chatInput.addEventListener("keypress", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }});
    el.settingsBtn.addEventListener("click", () => configureLLMProvider(true).then(updateProviderUI));
    el.configureBtn.addEventListener("click", () => configureLLMProvider(true).then(updateProviderUI));
    el.plannerModelSelect.addEventListener("change", e => { llmConfig.plannerModel = e.target.value; saveModels(); });
    el.judgeModelSelect.addEventListener("change", e => { llmConfig.judgeModel = e.target.value; saveModels(); });
    
    // Export functionality
    el.exportMarkdownBtn.addEventListener("click", () => {
        try {
            const filename = exportMarkdownReport(appState, llmConfig);
            showAlert(`Report exported successfully as ${filename}`, "success");
        } catch (e) {
            showAlert(`Export failed: ${e.message}`, "danger");
        }
    });
    
    el.exportJsonBtn.addEventListener("click", () => {
        try {
            const filename = exportJSONData(appState, llmConfig);
            showAlert(`Data exported successfully as ${filename}`, "success");
        } catch (e) {
            showAlert(`Export failed: ${e.message}`, "danger");
        }
    });
};

init();
