/**
 * Rendering Module
 * Pure rendering functions using lit-html templates
 */

import { html, render } from "lit-html";

// ============================================================
// UTILITY RENDERERS
// ============================================================

const renderScoreBadge = (label, value, isPrimary = false) => {
    const score = value ?? 0;
    const colorMap = [[80, 'success'], [60, 'info'], [40, 'warning'], [0, 'danger']];
    const colorClass = `bg-${colorMap.find(([threshold]) => score >= threshold)?.[1] || 'secondary'}`;
    
    return isPrimary 
        ? html`<span class="badge ${colorClass}">${label}: ${score}</span>`
        : html`<span class="badge bg-light text-dark border"><small>${label}: ${score}</small></span>`;
};

const renderList = (items, icon, tag = 'ul') => {
    if (!items?.length) return '';
    const Tag = tag === 'ol' ? 'ol' : 'ul';
    return html`
        <div class="mb-3">
            <h6><i class="bi bi-${icon} me-2"></i></h6>
            ${tag === 'ol' 
                ? html`<ol class="mb-0">${items.map(i => html`<li>${i}</li>`)}</ol>`
                : html`<ul class="mb-0 ${tag === 'muted' ? 'text-muted' : ''}">${items.map(i => html`<li>${i}</li>`)}</ul>`
            }
        </div>
    `;
};

// ============================================================
// PLANS RENDERING
// ============================================================

export const renderPlans = (plannerJson, container, countElement) => {
    const plans = plannerJson.plans || [];
    countElement.textContent = `${plans.length} plans`;
    
    render(html`
        ${plans.map((plan, index) => {
            const collapseId = `plan-collapse-${index}`;
            return html`
                <div class="card mb-3">
                    <div class="card-header bg-light d-flex align-items-center justify-content-between">
                        <div>
                            <span class="badge bg-primary me-2">${plan.id}</span>
                            <strong>${plan.title}</strong>
                        </div>
                        <button class="btn btn-sm btn-outline-secondary" type="button" 
                                data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                            <i class="bi bi-chevron-${index === 0 ? 'up' : 'down'}"></i>
                        </button>
                    </div>
                    <div class="card-body">
                        <p class="text-muted mb-3">${plan.summary}</p>
                        <div class="d-flex flex-wrap gap-2 mb-3">
                            ${renderScoreBadge("Correctness", plan.scores?.correctness)}
                            ${renderScoreBadge("Efficiency", plan.scores?.efficiency)}
                            ${renderScoreBadge("Complexity", plan.scores?.implementation_complexity)}
                            ${renderScoreBadge("Maintainability", plan.scores?.maintainability)}
                            ${renderScoreBadge("Overall", plan.scores?.overall, true)}
                        </div>
                        <div class="collapse ${index === 0 ? 'show' : ''}" id="${collapseId}">
                            <div class="border-top pt-3 mt-2">
                                <h6><i class="bi bi-list-ol me-2"></i>Steps</h6>
                                <ol class="mb-3">${plan.steps?.map(s => html`<li>${s}</li>`) || ''}</ol>
                                <h6><i class="bi bi-lightbulb me-2"></i>Assumptions</h6>
                                <ul class="text-muted mb-3">${plan.assumptions?.map(a => html`<li>${a}</li>`) || ''}</ul>
                                <h6><i class="bi bi-arrow-left-right me-2"></i>Trade-offs</h6>
                                <ul class="text-muted mb-0">${plan.tradeoffs?.map(t => html`<li>${t}</li>`) || ''}</ul>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        })}
    `, container);
};

// ============================================================
// JUDGE RENDERING
// ============================================================

const renderSynthesizedPlan = (plan) => html`
    <div class="card border-success border-2 mb-4">
        <div class="card-header bg-success text-white">
            <h5 class="mb-0"><i class="bi bi-stars me-2"></i>Synthesized Best Plan</h5>
        </div>
        <div class="card-body">
            <h6 class="text-success mb-2"><i class="bi bi-bookmark-star me-2"></i>${plan.title}</h6>
            <p class="mb-3"><strong>Summary:</strong> ${plan.summary}</p>
            ${plan.approach ? html`<div class="mb-3"><h6><i class="bi bi-compass me-2"></i>Approach</h6><p class="text-muted mb-0">${plan.approach}</p></div>` : ''}
            ${plan.steps?.length ? html`<div class="mb-3"><h6><i class="bi bi-list-ol me-2"></i>Steps</h6><ol class="mb-0">${plan.steps.map(s => html`<li>${s}</li>`)}</ol></div>` : ''}
            ${plan.key_decisions?.length ? html`<div class="mb-3"><h6><i class="bi bi-signpost-split me-2"></i>Key Decisions</h6><ul class="mb-0">${plan.key_decisions.map(d => html`<li>${d}</li>`)}</ul></div>` : ''}
            ${plan.trade_offs_addressed?.length ? html`<div class="mb-3"><h6><i class="bi bi-arrows-angle-contract me-2"></i>Trade-offs Resolved</h6><ul class="text-muted mb-0">${plan.trade_offs_addressed.map(t => html`<li>${t}</li>`)}</ul></div>` : ''}
            ${plan.expected_outcomes?.length ? html`<div class="mb-3"><h6><i class="bi bi-check-circle me-2"></i>Expected Outcomes</h6><ul class="mb-0">${plan.expected_outcomes.map(o => html`<li>${o}</li>`)}</ul></div>` : ''}
            ${plan.implementation_notes?.length ? html`<div class="mb-0"><h6><i class="bi bi-journal-code me-2"></i>Implementation Notes</h6><ul class="text-muted mb-0">${plan.implementation_notes.map(n => html`<li>${n}</li>`)}</ul></div>` : ''}
        </div>
    </div>
`;

const renderEvolutionNotes = (evo) => !evo ? '' : html`
    <div class="card border-primary mb-3">
        <div class="card-header bg-primary text-white">
            <i class="bi bi-diagram-3 me-2"></i>Evolution Analysis
        </div>
        <div class="card-body">
            ${evo.crossover_applied ? html`<div class="mb-3"><h6><i class="bi bi-shuffle me-2"></i>Crossover</h6><p class="text-muted mb-0">${evo.crossover_applied}</p></div>` : ''}
            ${evo.mutations_applied?.length ? html`<div class="mb-3"><h6><i class="bi bi-gear-fill me-2"></i>Mutations</h6><ul class="text-muted mb-0">${evo.mutations_applied.map(m => html`<li>${m}</li>`)}</ul></div>` : ''}
            ${evo.why_better ? html`<div class="mb-0"><h6><i class="bi bi-trophy me-2"></i>Why Better</h6><p class="text-muted mb-0">${evo.why_better}</p></div>` : ''}
        </div>
    </div>
`;

const renderPlanReview = (review, isBest) => {
    const verdictColor = { proceed: "success", iterate: "warning", drop: "danger" }[review.verdict] || "secondary";
    
    return html`
        <div class="card mb-3 ${isBest ? 'border-success' : ''}">
            <div class="card-header ${isBest ? 'bg-success text-white' : 'bg-light'} d-flex align-items-center justify-content-between">
                <div>
                    ${isBest ? html`<i class="bi bi-star-fill me-2"></i>` : ''}
                    <strong>${review.plan_title}</strong>
                    <span class="badge bg-${verdictColor} ms-2">${review.verdict}</span>
                </div>
                <span class="badge ${isBest ? 'bg-white text-success' : 'bg-white text-dark'}">Score: ${review.overall_score}</span>
            </div>
            <div class="card-body">
                ${review.feedback?.length ? html`
                    <div class="mb-3">
                        ${review.feedback.map(fb => {
                            const qColor = { high: "success", medium: "warning", low: "danger" }[fb.quality] || "secondary";
                            return html`
                                <div class="d-flex align-items-start gap-2 mb-2">
                                    <span class="badge bg-${qColor}" title="${fb.reason}" data-bs-toggle="tooltip">${fb.quality}</span>
                                    <span>${fb.snippet}</span>
                                </div>
                            `;
                        })}
                    </div>
                ` : ''}
                ${review.difficulties?.length ? html`<h6><i class="bi bi-exclamation-triangle me-2"></i>Difficulties</h6><ul class="text-muted mb-3">${review.difficulties.map(d => html`<li>${d}</li>`)}</ul>` : ''}
                ${review.suggested_mutations?.length ? html`<h6><i class="bi bi-gear me-2"></i>Suggested Mutations</h6><ul class="text-muted mb-0">${review.suggested_mutations.map(m => html`<li>${m}</li>`)}</ul>` : ''}
            </div>
        </div>
    `;
};

export const renderJudgeResults = (judgeJson, plannerJson, container) => {
    const reviews = judgeJson.plan_reviews || [];
    const bestCandidateId = judgeJson.best_candidate_id || judgeJson.best_plan_id;
    const synthesizedPlan = judgeJson.synthesized_plan;

    render(html`
        ${synthesizedPlan ? renderSynthesizedPlan(synthesizedPlan) : html`
            <div class="card border-success mb-3">
                <div class="card-header bg-success text-white">
                    <i class="bi bi-trophy-fill me-2"></i>Best Candidate: ${bestCandidateId}
                </div>
                <div class="card-body">
                    <p class="mb-0">${judgeJson.best_candidate_rationale || judgeJson.best_plan_rationale || ''}</p>
                </div>
            </div>
        `}

        ${renderEvolutionNotes(judgeJson.evolution_notes)}
        
        ${bestCandidateId ? html`
            <div class="alert alert-success mb-3">
                <i class="bi bi-info-circle-fill me-2"></i><strong>Base Candidate:</strong> ${bestCandidateId}
            </div>
        ` : ''}

        <h6 class="mb-3"><i class="bi bi-clipboard-check me-2"></i>Plan Reviews</h6>
        ${reviews.map(review => renderPlanReview(review, review.plan_id === bestCandidateId))}

        ${judgeJson.revised_prompt ? html`
            <div class="card border-info mt-3">
                <div class="card-header bg-info text-white">
                    <i class="bi bi-arrow-repeat me-2"></i>Revised Prompt
                </div>
                <div class="card-body">
                    <pre class="bg-light p-3 rounded border mb-0" style="white-space: pre-wrap;">${judgeJson.revised_prompt}</pre>
                </div>
            </div>
        ` : ''}
    `, container);

    // Initialize tooltips (debounced to avoid crash)
    requestAnimationFrame(() => {
        container.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
            if (!bootstrap.Tooltip.getInstance(el)) {
                new bootstrap.Tooltip(el);
            }
        });
    });
};
