let tf;
try {
  if (process.env.DISABLE_TF_NATIVE === "true") {
    throw new Error("Native backend disabled by configuration");
  }
  tf = require("@tensorflow/tfjs-node");
  console.log("[AI] 🚀 Using native TensorFlow backend (C++ bindings) for max performance");
} catch (e) {
  console.warn("[AI] ⚠️ Failed to load tfjs-node, falling back to vanilla tfjs (slower):", e.message);
  tf = require("@tensorflow/tfjs");
}

const use = require("@tensorflow-models/universal-sentence-encoder");
const fs = require("fs");
const path = require("path");
const CACHE_FILE = path.join(process.cwd(), "storage", "ai_cache", "tf_anchor_cache.json");

/**
 * TensorFlowService
 * Wrapper for TensorFlow.js and Universal Sentence Encoder (USE).
 * Handles model loading, embedding generation, and extensive caching.
 */
class TensorFlowService {
  constructor() {
    this.model = null;
    this.modelLoadingPromise = null;
    this.anchorMatrix = null; // Tensor [C, 512]
    this.anchorCategories = []; // Array of category names
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
        const cacheDir = path.join(process.cwd(), "storage", "ai_cache", "tf_model_cache");
        const modelJsonPath = path.join(cacheDir, "model.json");
        const weightsPath = path.join(cacheDir, "weights.bin");

        // Custom IO Handler provided *directly* to load/save
        const localHandler = {
          load: async () => {
            const modelJSON = JSON.parse(fs.readFileSync(modelJsonPath, "utf8"));
            const weightsData = fs.readFileSync(weightsPath);
            // Convert Buffer to ArrayBuffer
            const weightsArrayBuffer = weightsData.buffer.slice(weightsData.byteOffset, weightsData.byteOffset + weightsData.byteLength);

            return {
              modelTopology: modelJSON.modelTopology,
              weightSpecs: modelJSON.weightsManifest[0].weights,
              weightData: weightsArrayBuffer
            };
          },
          save: async (modelArtifacts) => {
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

            // 1. Save Weights
            const weightsBuffer = Buffer.from(modelArtifacts.weightData);
            fs.writeFileSync(weightsPath, weightsBuffer);

            // 2. Save Manifest
            const manifest = {
              modelTopology: modelArtifacts.modelTopology,
              format: modelArtifacts.format,
              generatedBy: modelArtifacts.generatedBy,
              convertedBy: modelArtifacts.convertedBy,
              weightsManifest: [{
                paths: ["./weights.bin"],
                weights: modelArtifacts.weightSpecs
              }]
            };
            fs.writeFileSync(modelJsonPath, JSON.stringify(manifest));

            return {
              modelArtifactsInfo: {
                dateSaved: new Date(),
                modelTopologyType: "JSON",
                modelTopologyBytes: JSON.stringify(manifest).length,
                weightSpecsBytes: JSON.stringify(modelArtifacts.weightSpecs).length,
                weightDataBytes: weightsBuffer.byteLength,
              }
            };
          }
        };

        console.log("[AI] 🚀 Loading Universal Sentence Encoder...");
        const start = Date.now();

        if (fs.existsSync(modelJsonPath) && fs.existsSync(weightsPath)) {
          console.log("[AI] 📦 Found local model cache (custom handler), loading from disk...");
          // Load graph model via custom handler
          this.model = await use.load({ modelUrl: localHandler });
        } else {
          console.log("[AI] 🌐 Downloading model from web (first run)...");
          this.model = await use.load();

          // Save using custom handler
          try {
            if (this.model && this.model.model) {
              // Use tf.io.withSaveHandler to wrap our custom save logic if needed,
              // but model.save() accepts an IOHandler object with save method.
              await this.model.model.save(localHandler);
              console.log(`[AI] 💾 Model saved to ${cacheDir} (via custom handler)`);
            }
          } catch (saveError) {
            console.warn("[AI] ⚠️ Failed to save model cache:", saveError.message);
          }
        }

        console.log(`[AI] ✅ Model loaded in ${Date.now() - start}ms`);
      } catch (error) {
        console.error("[AI] ❌ Failed to load USE model:", error);
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

    // 1. Generate Fingerprint (Hash) of current configuration
    const crypto = require("crypto");
    const currentHash = crypto.createHash("sha256")
      .update(JSON.stringify(categoryAnchors))
      .digest("hex");

    // [OPTIMIZATION] Load from file cache if available AND valid
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));

        // Smart Cache Check
        if (cacheData.hash === currentHash) {
          console.log("[AI] 📦 Cache fingerprint MATCH. Loading anchors from disk...");
          const cacheStart = Date.now();

          if (this.anchorMatrix) this.anchorMatrix.dispose();
          this.anchorCategories = cacheData.categories;
          this.anchorMatrix = tf.tensor2d(cacheData.vectors);

          console.log(`[AI] ⚡ Loaded cached anchors in ${Date.now() - cacheStart}ms`);
          return;
        }
        console.log("[AI] 🔄 Cache fingerprint MISMATCH (Config changed). Re-computing...");

      } catch (error) {
        console.warn("[AI] ⚠️ Failed to load cache, re-computing:", error.message);
      }
    }

    console.log("[AI] 🧮 Pre-computing anchor embeddings (Vectorized)...");
    const start = Date.now();

    // Cleanup old tensors if re-computing
    if (this.anchorMatrix) {
      this.anchorMatrix.dispose();
      this.anchorMatrix = null;
    }
    this.anchorCategories = [];

    const vectorsList = [];
    const categoriesList = [];

    for (const [category, phrases] of Object.entries(categoryAnchors)) {
      if (!Array.isArray(phrases) || phrases.length === 0) continue;

      const embeddings = await this.model.embed(phrases);
      const normalizedCentroid = tf.tidy(() => {
        const centroid = embeddings.mean(0);
        return centroid.div(centroid.norm());
      });

      vectorsList.push(normalizedCentroid);
      categoriesList.push(category);

      embeddings.dispose();
    }

    if (vectorsList.length > 0) {
      this.anchorMatrix = tf.stack(vectorsList);
      this.anchorCategories = categoriesList;
      tf.dispose(vectorsList);
    }

    console.log(`[AI] ✅ Anchors computed in ${Date.now() - start}ms (${this.anchorCategories.length} categories)`);

    // [OPTIMIZATION] Save to cache with Hash
    if (this.anchorMatrix) {
      try {
        const vectorsArray = await this.anchorMatrix.array();
        fs.writeFileSync(CACHE_FILE, JSON.stringify({
          hash: currentHash, // Save the fingerprint
          categories: this.anchorCategories,
          vectors: vectorsArray
        }));
        console.log(`[AI] 💾 Saved computed anchors to ${CACHE_FILE}`);
      } catch (e) {
        console.error("[AI] ⚠️ Failed to save anchor cache:", e.message);
      }
    }
  }

  /**
     * Classify text against pre-computed anchors using vectorized Matrix Multiplication.
     * @param {string} text - The input text to classify.
     * @returns {Object} Best match { category, confidence, similarity }
     */
  async classify(text) {
    try {
      if (!this.model) await this.initialize();
      if (!this.anchorMatrix) {
        // Auto-try to load anchors from cache if not computed
        await this.precomputeAnchors({});
        // If still empty, we can't classify
        if (!this.anchorMatrix) {
          // Check if cache file exists and try to load it without args?
          // precomputeAnchors handles cache loading.
          // But if categoryAnchors arg is empty, it might not load?
          // Let's just error or return default
          // Actually better: check if file exists, if so call precomputeAnchors({}) to triiger load
          // If it fails, throw.
          if (!this.anchorCategories || this.anchorCategories.length === 0) {
            throw new Error("[AI] Anchors not loaded and no cache available.");
          }
        }
      }

      // 1. Get Input Embedding [1, 512]
      const inputEmbedding = await this.model.embed([text]);

      // 2. Perform Matrix Multiplication
      const { maxIdx, maxScore, allScores } = tf.tidy(() => {
        const input = inputEmbedding.reshape([512]);
        const normalizedInput = input.div(input.norm());

        const scoresTensor = this.anchorMatrix.matMul(normalizedInput.expandDims(1)).flatten();

        return {
          maxIdx: scoresTensor.argMax().arraySync(),
          maxScore: scoresTensor.max().arraySync(),
          allScores: scoresTensor.arraySync()
        };
      });

      inputEmbedding.dispose();

      // 3. Map result back to category
      const bestCategory = this.anchorCategories[maxIdx];

      return {
        category: bestCategory,
        confidence: maxScore,
        similarity: maxScore,
        method: "tensorflow_use"
      };

    } catch (error) {
      console.error("Error in classify:", error);
      return { category: "Others", confidence: 0, method: "error" };
    }
  }
}


// Export singleton
module.exports = new TensorFlowService();
