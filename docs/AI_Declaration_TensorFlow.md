# AI Declaration: TensorFlow Implementation

**Project:** Digos Reporting & Incident Management System (DRIMS) v2.0
**Context:** Academic Thesis Documentation

## 1. Introduction
This document serves as the formal declaration of the Artificial Intelligence (AI) and Machine Learning (ML) technologies utilized within the DRIMS platform. Specifically, it outlines the integration, scope, and parameters of the **TensorFlow** framework as it operates within the system's linguistic processing pipeline.

## 2. AI Technology Utilized
- **Framework:** TensorFlow.js (via `@tensorflow/tfjs-node` and pure `@tensorflow/tfjs` fallback)
- **Model:** Universal Sentence Encoder (USE)
- **Purpose:** Natural Language Processing (NLP), Semantic Text Embeddings, and Autonomous Category Classification.

## 3. Scope of AI Application
Within the DRIMS architecture, TensorFlow serves as the core cognitive engine for the **Semantic NLP Model**. Its application is strictly confined to the inference processing phase of unstructured civic complaints submitted by end-users.

The operational pipeline is defined as follows:
1. **Pre-Computation:** Initial tokenization and heuristic dictionary/keyword matching.
2. **TensorFlow Inference (Fallback Provider):** When textual descriptions exhibit linguistic ambiguity (e.g., misspellings, colloquialisms, or complex syntactic structures like "road is uneven"), the input is passed to the localized TensorFlow.js memory weights.
3. **Semantic Mapping:** The input string is converted into multidimensional semantic tensor tokenizations (embeddings).
4. **Cosine Similarity Evaluation:** The system calculates absolute distances between the input embeddings and predefined programmatic "anchors" (Taxonomy arrays).
5. **Categorization:** The mathematical proximity pairs the unstructured text to formal systemic categories (e.g., matching "puddle deep hole road" to *Hazardous Public Infrastructure*).

## 4. Academic Parameters and Bounding
As part of the stringent validation criteria required for this thesis:
- The TensorFlow model operates purely for **inference mapping** and does not actively rewrite, suppress, or autonomously delete core entity data. It strictly appends predictive classification metadata (`tensorflow_use`).
- Systemic actions such as duplicate suppression are calculated via a combinatorial algorithm integrating TensorFlow's Cosine Similarity with Haversine distance and temporal metrics, preventing unchecked AI autonomy.
- No generative AI models (such as GPT variants) are utilized in the persistent mutation of civic infrastructure records; all ML behavior is bounded by deterministic mathematical thresholds.

## 5. Attestation
I hereby declare that the usage of Artificial Intelligence, specifically the TensorFlow Universal Sentence Encoder, within the scope of this project is correctly documented, technically justifiable, and adheres to the ethical and architectural boundaries required by the academic parameters of this thesis. All automated decision-making processes facilitated by these algorithms have been explicitly logged, auditable, and subject to human-in-the-loop (HITL) review protocols via the LGU Triage mechanisms.
