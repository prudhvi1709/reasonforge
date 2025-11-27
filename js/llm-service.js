/**
 * LLM Service Module
 * Handles all LLM-related operations: configuration, API calls, streaming
 */

import { asyncLLM } from "asyncllm";
import { parse } from "partial-json";
import { openaiConfig } from "bootstrap-llm-provider";

// ============================================================
// CONFIGURATION & STATE
// ============================================================

const DEFAULT_BASE_URLS = [
    "https://api.openai.com/v1",
    "https://openrouter.ai/api/v1",
    "http://localhost:11434/v1",
    "https://api.groq.com/openai/v1",
    "https://api.together.xyz/v1",
    "https://api.mistral.ai/v1"
];

export const llmConfig = {
    baseUrl: null,
    apiKey: null,
    models: [],
    plannerModel: null,
    judgeModel: null
};

export const prompts = {
    planner: "",
    judge: "",
    chat: ""
};

// ============================================================
// PROMPT LOADING
// ============================================================

/**
 * Load all system prompts from markdown files
 */
export async function loadPrompts() {
    const promptFiles = {
        planner: "prompts/planner.md",
        judge: "prompts/judge.md",
        chat: "prompts/chat.md"
    };

    const loadPromises = Object.entries(promptFiles).map(async ([key, path]) => {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
            prompts[key] = await response.text();
        } catch (error) {
            console.error(`Error loading prompt ${key}:`, error);
            throw error;
        }
    });

    await Promise.all(loadPromises);
    console.log("All prompts loaded successfully");
}

// ============================================================
// PROVIDER CONFIGURATION
// ============================================================

/**
 * Check if provider is OpenAI
 */
function isOpenAIProvider() {
    return llmConfig.baseUrl && llmConfig.baseUrl.includes("api.openai.com");
}

/**
 * Configure LLM provider using bootstrap-llm-provider
 */
export async function configureLLMProvider(forceShow = false) {
    const config = await openaiConfig({
        storage: localStorage,
        key: "reasonforge_llm_config",
        show: forceShow,
        defaultBaseUrls: DEFAULT_BASE_URLS,
        title: "Configure LLM Provider",
        baseUrlLabel: "API Base URL (or enter your proxy)",
        apiKeyLabel: "API Key (if required)",
        buttonLabel: "Save & Connect",
        help: `
            <div class="alert alert-secondary small mb-3">
                <i class="bi bi-info-circle me-1"></i>
                Enter your provider's base URL or select from suggestions. 
                <strong>OpenRouter</strong> gives access to many models with a single API key.
                <strong>Custom proxies</strong> are supported - just enter the URL.
            </div>
        `
    });

    llmConfig.baseUrl = config.baseUrl;
    llmConfig.apiKey = config.apiKey;
    llmConfig.models = config.models || [];
    
    // Restore model selections from localStorage if available
    const savedModels = localStorage.getItem("reasonforge_model_selection");
    if (savedModels) {
        try {
            const { plannerModel, judgeModel } = JSON.parse(savedModels);
            if (plannerModel && llmConfig.models.includes(plannerModel)) {
                llmConfig.plannerModel = plannerModel;
            }
            if (judgeModel && llmConfig.models.includes(judgeModel)) {
                llmConfig.judgeModel = judgeModel;
            }
        } catch (e) {
            console.warn("Failed to restore model selections:", e);
        }
    }

    return config;
}

/**
 * Filter and sort models (gpt-4.* and gpt-5.* only)
 */
export function getFilteredModels() {
    const filtered = llmConfig.models.filter(model => {
        const lower = model.toLowerCase();
        return lower.startsWith('gpt-4') || lower.startsWith('gpt-5');
    });

    return filtered.sort((a, b) => {
        if (a.toLowerCase().startsWith('gpt-5') && !b.toLowerCase().startsWith('gpt-5')) return -1;
        if (!a.toLowerCase().startsWith('gpt-5') && b.toLowerCase().startsWith('gpt-5')) return 1;
        return a.localeCompare(b);
    });
}

/**
 * Get selected model for a role
 */
export function getSelectedModel(role = 'planner') {
    if (role === 'judge') {
        return llmConfig.judgeModel || "gpt-4.1-mini";
    }
    return llmConfig.plannerModel || "gpt-4.1-mini";
}

// ============================================================
// STREAMING API
// ============================================================

/**
 * Make streaming API call with asyncLLM
 */
async function callLLM(messages, role = 'planner', onUpdate = null, expectJSON = false) {
    if (!llmConfig.baseUrl) {
        throw new Error("LLM provider not configured. Please configure a provider first.");
    }

    const headers = {
        "Content-Type": "application/json"
    };

    if (llmConfig.apiKey) {
        headers["Authorization"] = `Bearer ${llmConfig.apiKey}`;
    }

    const endpoint = `${llmConfig.baseUrl}/chat/completions`;
    let fullContent = "";

    const requestBody = {
        model: getSelectedModel(role),
        messages: messages,
        stream: true
    };

    if (expectJSON) {
        requestBody.response_format = { type: "json_object" };
    }

    try {
        for await (const { content, error } of asyncLLM(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody)
        })) {
            if (error) throw new Error(`LLM API error: ${error}`);

            if (content) {
                fullContent = content;
                
                if (onUpdate) {
                    if (expectJSON) {
                        try {
                            const partialData = parse(fullContent);
                            onUpdate(partialData);
                        } catch (e) {
                            // Ignore parse errors during streaming
                        }
                    } else {
                        onUpdate(fullContent);
                    }
                }
            }
        }

        return fullContent;
    } catch (error) {
        throw new Error(`Streaming API call failed: ${error.message}`);
    }
}

/**
 * Parse JSON response from LLM
 */
function parseJsonResponse(content, source) {
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
    } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
    }
    if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
    }
    cleanContent = cleanContent.trim();

    try {
        return JSON.parse(cleanContent);
    } catch (e) {
        throw new Error(`${source} returned invalid JSON: ${e.message}\n\nRaw content:\n${content.substring(0, 500)}...`);
    }
}

// ============================================================
// LLM CALLS
// ============================================================

/**
 * Call Planner LLM with streaming
 */
export async function callPlannerLLM(problemText, onUpdate = null) {
    const messages = [
        { role: "system", content: prompts.planner },
        {
            role: "user",
            content: `Problem statement:\n\n${problemText}\n\nGenerate 3 distinct solution plans for this problem, following the Planner JSON schema described in your system message. Output ONLY the JSON object.`
        }
    ];

    const content = await callLLM(messages, 'planner', onUpdate, true);
    return parseJsonResponse(content, "Planner");
}

/**
 * Call Judge LLM with streaming
 */
export async function callJudgeLLM(problemText, plannerJson, onUpdate = null) {
    const messages = [
        { role: "system", content: prompts.judge },
        {
            role: "user",
            content: `You are given a problem and several candidate solution plans produced by another LLM.

**Problem:**
${problemText}

**Candidate Plans (JSON from Planner):**
${JSON.stringify(plannerJson, null, 2)}

Evaluate these plans, critique them in depth, apply the evolutionary reasoning workflow (survival of the fittest, crossover, mutation), and then select ONE best plan to proceed with.
Follow the Judge JSON schema exactly and output ONLY the JSON object.`
        }
    ];

    const content = await callLLM(messages, 'judge', onUpdate, true);
    return parseJsonResponse(content, "Judge");
}

/**
 * Call Chat LLM with streaming
 */
export async function callChatLLM(conversationMessages, onUpdate = null) {
    return await callLLM(conversationMessages, 'chat', onUpdate, false);
}

