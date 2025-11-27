/**
 * Rendering Module - Pure lit-html templates
 */
import { html, render } from "lit-html";

const scoreBadge = (label, value, primary = false) => {
    const score = value ?? 0;
    const color = score >= 80 ? 'success' : score >= 60 ? 'info' : score >= 40 ? 'warning' : 'danger';
    return primary 
        ? html`<span class="badge bg-${color}">${label}: ${score}</span>`
        : html`<span class="badge bg-light text-dark border"><small>${label}: ${score}</small></span>`;
};

const listSection = (items, icon, title, ordered = false) => !items?.length ? '' : html`
    <div class="mb-3">
        <h6><i class="bi bi-${icon} me-2"></i>${title}</h6>
        ${ordered 
            ? html`<ol class="mb-0">${items.map(i => html`<li>${i}</li>`)}</ol>`
            : html`<ul class="text-muted mb-0">${items.map(i => html`<li>${i}</li>`)}</ul>`}
    </div>
`;

export const renderPlans = (plannerJson, container, countEl) => {
    const plans = plannerJson.plans || [];
    countEl.textContent = `${plans.length} plans`;
    
    render(html`${plans.map((plan, i) => html`
        <div class="card mb-3">
            <div class="card-header bg-light d-flex align-items-center justify-content-between">
                <div><span class="badge bg-primary me-2">${plan.id}</span><strong>${plan.title}</strong></div>
                <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="collapse" data-bs-target="#plan-${i}">
                    <i class="bi bi-chevron-${i === 0 ? 'up' : 'down'}"></i>
                </button>
            </div>
            <div class="card-body">
                <p class="text-muted mb-3">${plan.summary}</p>
                <div class="d-flex flex-wrap gap-2 mb-3">
                    ${scoreBadge("Correctness", plan.scores?.correctness)}
                    ${scoreBadge("Efficiency", plan.scores?.efficiency)}
                    ${scoreBadge("Complexity", plan.scores?.implementation_complexity)}
                    ${scoreBadge("Maintainability", plan.scores?.maintainability)}
                    ${scoreBadge("Overall", plan.scores?.overall, true)}
                </div>
                <div class="collapse ${i === 0 ? 'show' : ''}" id="plan-${i}">
                    <div class="border-top pt-3 mt-2">
                        ${listSection(plan.steps, 'list-ol', 'Steps', true)}
                        ${listSection(plan.assumptions, 'lightbulb', 'Assumptions')}
                        ${listSection(plan.tradeoffs, 'arrow-left-right', 'Trade-offs')}
                    </div>
                </div>
            </div>
        </div>
    `)}`, container);
};

const synthesizedPlan = (plan) => html`
    <div class="card border-success border-2 mb-4">
        <div class="card-header bg-success text-white"><h5 class="mb-0"><i class="bi bi-stars me-2"></i>Synthesized Best Plan</h5></div>
        <div class="card-body">
            <h6 class="text-success mb-2"><i class="bi bi-bookmark-star me-2"></i>${plan.title}</h6>
            <p class="mb-3"><strong>Summary:</strong> ${plan.summary}</p>
            ${plan.approach ? html`<div class="mb-3"><h6><i class="bi bi-compass me-2"></i>Approach</h6><p class="text-muted mb-0">${plan.approach}</p></div>` : ''}
            ${listSection(plan.steps, 'list-ol', 'Steps', true)}
            ${listSection(plan.key_decisions, 'signpost-split', 'Key Decisions')}
            ${listSection(plan.trade_offs_addressed, 'arrows-angle-contract', 'Trade-offs Resolved')}
            ${listSection(plan.expected_outcomes, 'check-circle', 'Expected Outcomes')}
            ${listSection(plan.implementation_notes, 'journal-code', 'Implementation Notes')}
        </div>
    </div>
`;

const evolutionNotes = (evo) => !evo ? '' : html`
    <div class="card border-primary mb-3">
        <div class="card-header bg-primary text-white"><i class="bi bi-diagram-3 me-2"></i>Evolution Analysis</div>
        <div class="card-body">
            ${evo.crossover_applied ? html`<div class="mb-3"><h6><i class="bi bi-shuffle me-2"></i>Crossover</h6><p class="text-muted mb-0">${evo.crossover_applied}</p></div>` : ''}
            ${listSection(evo.mutations_applied, 'gear-fill', 'Mutations')}
            ${evo.why_better ? html`<div class="mb-0"><h6><i class="bi bi-trophy me-2"></i>Why Better</h6><p class="text-muted mb-0">${evo.why_better}</p></div>` : ''}
        </div>
    </div>
`;

const planReview = (review, isBest) => {
    const vColor = { proceed: "success", iterate: "warning", drop: "danger" }[review.verdict] || "secondary";
    return html`
        <div class="card mb-3 ${isBest ? 'border-success' : ''}">
            <div class="card-header ${isBest ? 'bg-success text-white' : 'bg-light'} d-flex align-items-center justify-content-between">
                <div>${isBest ? html`<i class="bi bi-star-fill me-2"></i>` : ''}<strong>${review.plan_title}</strong>
                    <span class="badge bg-${vColor} ms-2">${review.verdict}</span></div>
                <span class="badge ${isBest ? 'bg-white text-success' : 'bg-white text-dark'}">Score: ${review.overall_score}</span>
            </div>
            <div class="card-body">
                ${review.feedback?.length ? html`<div class="mb-3">${review.feedback.map(fb => {
                    const qc = { high: "success", medium: "warning", low: "danger" }[fb.quality] || "secondary";
                    return html`<div class="d-flex align-items-start gap-2 mb-2">
                        <span class="badge bg-${qc}" title="${fb.reason}" data-bs-toggle="tooltip">${fb.quality}</span>
                        <span>${fb.snippet}</span>
                    </div>`;
                })}</div>` : ''}
                ${listSection(review.difficulties, 'exclamation-triangle', 'Difficulties')}
                ${listSection(review.suggested_mutations, 'gear', 'Suggested Mutations')}
            </div>
        </div>
    `;
};

export const renderJudgeResults = (judgeJson, plannerJson, container) => {
    const reviews = judgeJson.plan_reviews || [];
    const bestId = judgeJson.best_candidate_id || judgeJson.best_plan_id;

    render(html`
        ${judgeJson.synthesized_plan ? synthesizedPlan(judgeJson.synthesized_plan) : html`
            <div class="card border-success mb-3">
                <div class="card-header bg-success text-white"><i class="bi bi-trophy-fill me-2"></i>Best: ${bestId}</div>
                <div class="card-body"><p class="mb-0">${judgeJson.best_candidate_rationale || judgeJson.best_plan_rationale || ''}</p></div>
            </div>`}
        ${evolutionNotes(judgeJson.evolution_notes)}
        ${bestId ? html`<div class="alert alert-success mb-3"><i class="bi bi-info-circle-fill me-2"></i><strong>Base Candidate:</strong> ${bestId}</div>` : ''}
        <h6 class="mb-3"><i class="bi bi-clipboard-check me-2"></i>Plan Reviews</h6>
        ${reviews.map(r => planReview(r, r.plan_id === bestId))}
        ${judgeJson.revised_prompt ? html`
            <div class="card border-info mt-3">
                <div class="card-header bg-info text-white"><i class="bi bi-arrow-repeat me-2"></i>Revised Prompt</div>
                <div class="card-body"><pre class="bg-light p-3 rounded border mb-0" style="white-space: pre-wrap;">${judgeJson.revised_prompt}</pre></div>
            </div>` : ''}
    `, container);

    requestAnimationFrame(() => container.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        if (!bootstrap.Tooltip.getInstance(el)) new bootstrap.Tooltip(el);
    }));
};
