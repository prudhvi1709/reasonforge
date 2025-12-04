/**
 * Export Service Module - Export reasoning artifacts to various formats
 */

/**
 * Format a timestamp for display
 */
const formatTimestamp = (date = new Date()) => {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

/**
 * Format a short timestamp for filenames
 */
const formatFilenameTimestamp = (date = new Date()) => {
    return date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
};

/**
 * Export application state to Markdown format
 */
export function exportToMarkdown(appState, llmConfig) {
    const timestamp = formatTimestamp();
    const plans = appState.plannerJson?.plans || [];
    const judgeJson = appState.judgeJson || {};
    const chatMessages = appState.chatState?.messages || [];
    
    let markdown = `# ReasonForge Analysis Report

**Generated:** ${timestamp}

---

## Problem Statement

${appState.problem || 'No problem statement provided'}

---

## Configuration

- **Planner Model:** ${llmConfig.plannerModel || 'Not specified'}
- **Judge Model:** ${llmConfig.judgeModel || 'Not specified'}
- **Provider:** ${llmConfig.baseUrl ? new URL(llmConfig.baseUrl).hostname : 'Not configured'}

---

## Candidate Plans

`;

    // Add each plan
    plans.forEach((plan, index) => {
        markdown += `### ${plan.id || `Plan ${index + 1}`}: ${plan.title || 'Untitled'}

**Summary:** ${plan.summary || 'No summary provided'}

**Scores:**
- Correctness: ${plan.scores?.correctness || 'N/A'}/100
- Efficiency: ${plan.scores?.efficiency || 'N/A'}/100
- Implementation Complexity: ${plan.scores?.implementation_complexity || 'N/A'}/100
- Maintainability: ${plan.scores?.maintainability || 'N/A'}/100
- **Overall: ${plan.scores?.overall || 'N/A'}/100**

`;

        // Steps
        if (plan.steps && plan.steps.length > 0) {
            markdown += `**Steps:**\n\n`;
            plan.steps.forEach((step, i) => {
                markdown += `${i + 1}. ${step}\n`;
            });
            markdown += '\n';
        }

        // Assumptions
        if (plan.assumptions && plan.assumptions.length > 0) {
            markdown += `**Assumptions:**\n\n`;
            plan.assumptions.forEach(assumption => {
                markdown += `- ${assumption}\n`;
            });
            markdown += '\n';
        }

        // Trade-offs
        if (plan.tradeoffs && plan.tradeoffs.length > 0) {
            markdown += `**Trade-offs:**\n\n`;
            plan.tradeoffs.forEach(tradeoff => {
                markdown += `- ${tradeoff}\n`;
            });
            markdown += '\n';
        }

        markdown += '---\n\n';
    });

    // Judge Evaluation Section
    markdown += `## Judge Evaluation

`;

    // Synthesized Best Plan
    const synthPlan = judgeJson.synthesized_plan;
    if (synthPlan && synthPlan.title) {
        markdown += `### 🌟 Synthesized Best Plan

#### ${synthPlan.title}

**Summary:** ${synthPlan.summary || 'No summary provided'}

`;

        if (synthPlan.approach) {
            markdown += `**Approach:**

${synthPlan.approach}

`;
        }

        if (synthPlan.steps && synthPlan.steps.length > 0) {
            markdown += `**Implementation Steps:**

`;
            synthPlan.steps.forEach((step, i) => {
                markdown += `${i + 1}. ${step}\n`;
            });
            markdown += '\n';
        }

        if (synthPlan.key_decisions && synthPlan.key_decisions.length > 0) {
            markdown += `**Key Decisions:**

`;
            synthPlan.key_decisions.forEach(decision => {
                markdown += `- ${decision}\n`;
            });
            markdown += '\n';
        }

        if (synthPlan.trade_offs_addressed && synthPlan.trade_offs_addressed.length > 0) {
            markdown += `**Trade-offs Resolved:**

`;
            synthPlan.trade_offs_addressed.forEach(tradeoff => {
                markdown += `- ${tradeoff}\n`;
            });
            markdown += '\n';
        }

        if (synthPlan.expected_outcomes && synthPlan.expected_outcomes.length > 0) {
            markdown += `**Expected Outcomes:**

`;
            synthPlan.expected_outcomes.forEach(outcome => {
                markdown += `- ${outcome}\n`;
            });
            markdown += '\n';
        }

        if (synthPlan.implementation_notes && synthPlan.implementation_notes.length > 0) {
            markdown += `**Implementation Notes:**

`;
            synthPlan.implementation_notes.forEach(note => {
                markdown += `- ${note}\n`;
            });
            markdown += '\n';
        }
    } else {
        const bestId = judgeJson.best_candidate_id || judgeJson.best_plan_id;
        if (bestId) {
            markdown += `### 🏆 Best Plan Selected: ${bestId}

**Rationale:** ${judgeJson.best_candidate_rationale || judgeJson.best_plan_rationale || 'No rationale provided'}

`;
        }
    }

    // Evolution Analysis
    const evoNotes = judgeJson.evolution_notes;
    if (evoNotes) {
        markdown += `### Evolution Analysis

`;
        if (evoNotes.crossover_applied) {
            markdown += `**Crossover Applied:**

${evoNotes.crossover_applied}

`;
        }

        if (evoNotes.mutations_applied && evoNotes.mutations_applied.length > 0) {
            markdown += `**Mutations Applied:**

`;
            evoNotes.mutations_applied.forEach(mutation => {
                markdown += `- ${mutation}\n`;
            });
            markdown += '\n';
        }

        if (evoNotes.why_better) {
            markdown += `**Why This Solution is Better:**

${evoNotes.why_better}

`;
        }
    }

    // Plan Reviews
    const reviews = judgeJson.plan_reviews || [];
    if (reviews.length > 0) {
        markdown += `### Plan Reviews

`;
        reviews.forEach(review => {
            const bestId = judgeJson.best_candidate_id || judgeJson.best_plan_id;
            const isBest = review.plan_id === bestId;
            
            markdown += `#### ${review.plan_title || review.plan_id} ${isBest ? '⭐' : ''}

- **Overall Score:** ${review.overall_score}/100
- **Verdict:** ${review.verdict?.toUpperCase() || 'N/A'}

`;

            if (review.feedback && review.feedback.length > 0) {
                markdown += `**Feedback:**

`;
                review.feedback.forEach(fb => {
                    markdown += `- [${fb.quality?.toUpperCase() || 'N/A'}] ${fb.snippet}`;
                    if (fb.reason) {
                        markdown += ` - _${fb.reason}_`;
                    }
                    markdown += '\n';
                });
                markdown += '\n';
            }

            if (review.difficulties && review.difficulties.length > 0) {
                markdown += `**Potential Difficulties:**

`;
                review.difficulties.forEach(diff => {
                    markdown += `- ${diff}\n`;
                });
                markdown += '\n';
            }

            if (review.suggested_mutations && review.suggested_mutations.length > 0) {
                markdown += `**Suggested Improvements:**

`;
                review.suggested_mutations.forEach(mut => {
                    markdown += `- ${mut}\n`;
                });
                markdown += '\n';
            }
        });
    }

    // Revised Prompt
    if (judgeJson.revised_prompt) {
        markdown += `### Revised Implementation Prompt

\`\`\`
${judgeJson.revised_prompt}
\`\`\`

`;
    }

    markdown += `---

`;

    // Chat History
    if (chatMessages.length > 0) {
        markdown += `## Refinement Chat

`;
        chatMessages.forEach((msg, index) => {
            const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
            markdown += `### ${role}

${msg.content}

`;
        });
    } else {
        markdown += `## Refinement Chat

_No chat messages yet_

`;
    }

    // Footer
    markdown += `---

_Generated by ReasonForge on ${timestamp}_
`;

    return markdown;
}

/**
 * Export application state to JSON format
 */
export function exportToJSON(appState, llmConfig) {
    const exportData = {
        metadata: {
            version: "1.0",
            exported_at: new Date().toISOString(),
            planner_model: llmConfig.plannerModel || null,
            judge_model: llmConfig.judgeModel || null,
            provider: llmConfig.baseUrl || null
        },
        problem: appState.problem || null,
        planner_json: appState.plannerJson || null,
        judge_json: appState.judgeJson || null,
        chat_history: (appState.chatState?.messages || []).map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date().toISOString()
        })),
        best_plan: appState.bestPlan || null
    };

    return JSON.stringify(exportData, null, 2);
}

/**
 * Download a file to the user's computer
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export and download Markdown report
 */
export function exportMarkdownReport(appState, llmConfig) {
    const markdown = exportToMarkdown(appState, llmConfig);
    const filename = `reasonforge-report-${formatFilenameTimestamp()}.md`;
    downloadFile(markdown, filename, 'text/markdown');
    return filename;
}

/**
 * Export and download JSON data
 */
export function exportJSONData(appState, llmConfig) {
    const json = exportToJSON(appState, llmConfig);
    const filename = `reasonforge-export-${formatFilenameTimestamp()}.json`;
    downloadFile(json, filename, 'application/json');
    return filename;
}

