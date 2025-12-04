/**
 * Configuration Module - Problem statements and app settings
 */

export const problemStatements = [
    {
        id: "supply-chain",
        title: "Supply Chain Optimization",
        icon: "truck",
        color: "primary",
        description: "Design a real-time supply chain optimization system that minimizes costs while meeting delivery SLAs across a global distribution network with 500+ warehouses.",
        tags: ["Optimization", "Logistics", "Real-time"],
        problem: `Design a real-time supply chain optimization system for a global e-commerce company with 500+ warehouses and 50,000+ daily shipments.

**Requirements:**
1. Minimize total logistics costs (shipping, warehousing, handling)
2. Meet delivery SLAs: 2-day delivery for 95% of orders, same-day for premium
3. Handle demand spikes (10x during sales events)
4. Optimize inventory placement across warehouses
5. Route selection considering: cost, time, carrier reliability, carbon footprint

**Constraints:**
- Decisions must be made in <100ms per order
- System must handle 1000+ orders/second during peak
- Must integrate with 50+ carrier APIs
- Inventory data may be 5-15 minutes stale

**Key Challenges:**
- Multi-objective optimization (cost vs speed vs sustainability)
- Real-time decision making with incomplete information
- Handling carrier capacity constraints dynamically
- Graceful degradation during partial system failures`
    },
    {
        id: "fraud-detection",
        title: "Real-time Fraud Detection",
        icon: "shield-exclamation",
        color: "danger",
        description: "Build a fraud detection system processing 10,000+ transactions/second with <50ms latency while maintaining <0.1% false positive rate.",
        tags: ["ML/AI", "Security", "Streaming"],
        problem: `Design a real-time fraud detection system for a payment processor handling 10,000+ transactions per second.

**Requirements:**
1. Detect fraudulent transactions with >99% recall
2. Maintain false positive rate <0.1% (to avoid blocking legitimate users)
3. Decision latency <50ms (p99)
4. Handle new fraud patterns without full model retraining
5. Provide explainable decisions for compliance

**Data Available:**
- Transaction details (amount, merchant, location, time)
- User behavior history (30-day rolling window)
- Device fingerprints and IP geolocation
- Merchant risk scores
- Network graph of user relationships

**Constraints:**
- Must comply with PCI-DSS and GDPR
- Cannot store raw card numbers
- Model updates must not cause service disruption
- Must handle 5x traffic spikes during holidays

**Key Challenges:**
- Balancing precision vs recall in adversarial environment
- Concept drift as fraud patterns evolve
- Cold start problem for new users
- Real-time feature computation at scale`
    },
    {
        id: "data-platform",
        title: "Enterprise Data Platform",
        icon: "database-gear",
        color: "success",
        description: "Architect a unified data platform serving 10,000+ analysts with sub-second query performance on petabyte-scale data.",
        tags: ["Data Engineering", "Architecture", "Scale"],
        problem: `Design a unified enterprise data platform for a Fortune 500 company with 10,000+ data consumers.

**Requirements:**
1. Ingest data from 200+ sources (databases, APIs, streaming, files)
2. Support both batch and real-time analytics
3. Query latency: <1s for 90% of analyst queries on 1PB+ data
4. Data freshness: <5 minutes for operational dashboards
5. Self-service data discovery and lineage tracking

**Users:**
- Data Scientists: Need raw data access, Python/R notebooks
- Business Analysts: SQL queries, BI tool integration
- ML Engineers: Feature stores, training pipelines
- Executives: Real-time dashboards, KPI alerts

**Constraints:**
- Budget: $2M/year infrastructure cost
- Team: 15 data engineers
- Must maintain SOC2 compliance
- Data residency requirements (EU data stays in EU)

**Key Challenges:**
- Balancing cost vs performance vs freshness
- Schema evolution without breaking downstream
- Access control at row/column level
- Query optimization across heterogeneous data`
    }
];

export const defaultPrompts = {
    planner: null,  // Will be loaded from file
    judge: null,
    chat: null
};

