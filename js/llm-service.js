/**
 * LLM Service Module - API calls, streaming, configuration
 */
import { asyncLLM } from "asyncllm";
import { parse } from "partial-json";
import { openaiConfig } from "bootstrap-llm-provider";

const DEFAULT_BASE_URLS = [
    "https://api.openai.com/v1", "https://openrouter.ai/api/v1",
    "http://localhost:11434/v1", "https://api.groq.com/openai/v1",
    "https://api.together.xyz/v1", "https://api.mistral.ai/v1"
];

export const llmConfig = { baseUrl: null, apiKey: null, models: [], plannerModel: null, judgeModel: null, responseId: null };
export const prompts = { planner: "", judge: "", chat: "" };

const isOpenAIProvider = () => llmConfig.baseUrl?.includes("api.openai.com");

export async function loadPrompts() {
    const files = { planner: "prompts/planner.md", judge: "prompts/judge.md", chat: "prompts/chat.md" };
    await Promise.all(Object.entries(files).map(async ([key, path]) => {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`Failed to load ${path}`);
        prompts[key] = await res.text();
    }));
}

export async function configureLLMProvider(forceShow = false) {
    const config = await openaiConfig({
        storage: localStorage, key: "reasonforge_llm_config", show: forceShow,
        defaultBaseUrls: DEFAULT_BASE_URLS, title: "Configure LLM Provider",
        baseUrlLabel: "API Base URL (or enter your proxy)", apiKeyLabel: "API Key (if required)",
        buttonLabel: "Save & Connect",
        help: `<div class="alert alert-secondary small mb-3"><i class="bi bi-info-circle me-1"></i>Enter your provider's base URL. <strong>OpenRouter</strong> gives access to many models.</div>`
    });
    Object.assign(llmConfig, { baseUrl: config.baseUrl, apiKey: config.apiKey, models: config.models || [] });
    
    try {
        const saved = JSON.parse(localStorage.getItem("reasonforge_model_selection") || "{}");
        if (saved.plannerModel && llmConfig.models.includes(saved.plannerModel)) llmConfig.plannerModel = saved.plannerModel;
        if (saved.judgeModel && llmConfig.models.includes(saved.judgeModel)) llmConfig.judgeModel = saved.judgeModel;
    } catch {}
    return config;
}

export function getFilteredModels() {
    return llmConfig.models
        .filter(m => /^gpt-[45]/i.test(m))
        .sort((a, b) => (/^gpt-5/i.test(b) - /^gpt-5/i.test(a)) || a.localeCompare(b));
}

export const getSelectedModel = (role = 'planner') => 
    (role === 'judge' ? llmConfig.judgeModel : llmConfig.plannerModel) || "gpt-4.1-mini";

export const resetConversationState = () => { llmConfig.responseId = null; };
export const getAPIType = () => isOpenAIProvider() ? "OpenAI Responses API" : "Chat Completions API";

async function callLLM(messages, role = 'planner', onUpdate = null, expectJSON = false) {
    if (!llmConfig.baseUrl) throw new Error("LLM provider not configured");

    const headers = { "Content-Type": "application/json" };
    if (llmConfig.apiKey) headers.Authorization = `Bearer ${llmConfig.apiKey}`;

    const useResponsesAPI = isOpenAIProvider();
    const endpoint = `${llmConfig.baseUrl}/${useResponsesAPI ? 'responses' : 'chat/completions'}`;
    let fullContent = "", requestBody;

    if (useResponsesAPI) {
        // Stateful mode for follow-up chat messages
        if (role === 'chat' && llmConfig.responseId) {
            requestBody = {
                model: getSelectedModel(role),
                input: messages[messages.length - 1].content,
                previous_response_id: llmConfig.responseId,
                stream: true
            };
        } else {
            requestBody = {
                model: getSelectedModel(role),
                input: messages.map(m => ({ role: m.role, content: m.content })),
                stream: true
            };
        }
    } else {
        requestBody = { model: getSelectedModel(role), messages, stream: true };
        if (expectJSON) requestBody.response_format = { type: "json_object" };
    }

    for await (const { content, error, raw } of asyncLLM(endpoint, {
        method: "POST", headers, body: JSON.stringify(requestBody)
    })) {
        if (error) throw new Error(`LLM API error: ${error}`);
        if (content) {
            fullContent = content;
            if (useResponsesAPI && role === 'chat' && raw) {
                try { const p = JSON.parse(raw); if (p.id) llmConfig.responseId = p.id; } catch {}
            }
            if (onUpdate) {
                if (expectJSON) { try { onUpdate(parse(fullContent)); } catch {} }
                else onUpdate(fullContent);
            }
        }
    }
    return fullContent;
}

function parseJsonResponse(content, source) {
    let clean = content.trim().replace(/^```json?\n?/, '').replace(/```$/, '').trim();
    try { return JSON.parse(clean); }
    catch (e) { throw new Error(`${source} returned invalid JSON: ${e.message}`); }
}

export async function callPlannerLLM(problemText, onUpdate = null) {
    const messages = [
        { role: "system", content: prompts.planner },
        { role: "user", content: `Problem statement:\n\n${problemText}\n\nGenerate 3 distinct solution plans. Output ONLY JSON.` }
    ];
    return parseJsonResponse(await callLLM(messages, 'planner', onUpdate, true), "Planner");
}

export async function callJudgeLLM(problemText, plannerJson, onUpdate = null) {
    const messages = [
        { role: "system", content: prompts.judge },
        { role: "user", content: `**Problem:**\n${problemText}\n\n**Candidate Plans:**\n${JSON.stringify(plannerJson, null, 2)}\n\nEvaluate and synthesize. Output ONLY JSON.` }
    ];
    return parseJsonResponse(await callLLM(messages, 'judge', onUpdate, true), "Judge");
}

export const callChatLLM = (messages, onUpdate = null) => callLLM(messages, 'chat', onUpdate, false);
