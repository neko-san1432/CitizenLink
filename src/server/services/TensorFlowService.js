const tf = require('@tensorflow/tfjs');
const use = require('@tensorflow-models/universal-sentence-encoder');

/**
 * TensorFlowService
 * Wrapper for TensorFlow.js and Universal Sentence Encoder (USE).
 * Handles model loading, embedding generation, and extensive caching.
 */
class TensorFlowService {
    constructor() {
        this.model = null;
        this.modelLoadingPromise = null;
        this.anchorEmbeddings = null; // Cache for pre-computed anchor vectors
    }

    /**
     * Initialize the service and load the model.
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.model) return;
        if (this.modelLoadingPromise) return this.modelLoadingPromise;

        this.modelLoadingPromise = (async () => {
            try {
                console.log('[AI] 🚀 Loading Universal Sentence Encoder...');
                const start = Date.now();
                // Load the model (this will download ~100MB on first run)
                this.model = await use.load();
                console.log(`[AI] ✅ Model loaded in ${Date.now() - start}ms`);
            } catch (error) {
                console.error('[AI] ❌ Failed to load USE model:', error);
                throw error;
            }
        })();

        return this.modelLoadingPromise;
    }

    /**
     * Pre-compute embeddings for a set of anchor phrases.
     * @param {Object} categoryAnchors - Map of { category: [phrase1, phrase2, ...] }
     */
    async precomputeAnchors(categoryAnchors) {
        if (!this.model) await this.initialize();

        console.log('[AI] 🧮 Pre-computing anchor embeddings...');
        const start = Date.now();
        const embeddings = {};

        for (const [category, phrases] of Object.entries(categoryAnchors)) {
            if (!Array.isArray(phrases) || phrases.length === 0) continue;

            // Generate embedding for all phrases in this category
            const tensor = await this.model.embed(phrases);
            const vectors = await tensor.array();
            tensor.dispose(); // Free memory

            // Compute the mean vector (centroid) for the category
            // This allows O(C) comparison instead of O(N*C) where N=phrases
            const meanVector = this.computeMeanVector(vectors);

            embeddings[category] = {
                meanVector,
                phrases
            };
        }

        this.anchorEmbeddings = embeddings;
        console.log(`[AI] ✅ Anchors computed in ${Date.now() - start}ms`);
    }

    /**
     * Classify text against pre-computed anchors.
     * @param {string} text - The input text to classify.
     * @returns {Object} Best match { category, confidence, similarity }
     */
    async classify(text) {
        if (!this.model) await this.initialize();
        if (!this.anchorEmbeddings) {
            throw new Error('[AI] Anchors not computed. Call precomputeAnchors() first.');
        }

        // Embed the input text
        const tensor = await this.model.embed([text]);
        const inputVector = (await tensor.array())[0];
        tensor.dispose();

        let bestCategory = null;
        let maxSimilarity = -1;
        const allScores = {};

        // Compare against each category centroid
        for (const [category, data] of Object.entries(this.anchorEmbeddings)) {
            const similarity = this.cosineSimilarity(inputVector, data.meanVector);
            allScores[category] = similarity;

            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                bestCategory = category;
            }
        }

        return {
            category: bestCategory,
            confidence: maxSimilarity, // Use similarity as confidence score
            scores: allScores
        };
    }

    // --- Utility Functions ---

    computeMeanVector(vectors) {
        if (!vectors || vectors.length === 0) return null;
        const dim = vectors[0].length;
        const mean = new Array(dim).fill(0);

        for (const vec of vectors) {
            for (let i = 0; i < dim; i++) {
                mean[i] += vec[i];
            }
        }

        // Average
        for (let i = 0; i < dim; i++) {
            mean[i] /= vectors.length;
        }
        return mean;
    }

    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }
}

// Export singleton
module.exports = new TensorFlowService();
