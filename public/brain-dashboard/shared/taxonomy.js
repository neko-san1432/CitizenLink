(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('fs'), require('path'));
    } else {
        root.DRIMSTaxonomy = factory(null, null);
    }
})(typeof self !== 'undefined' ? self : this, function (fs, path) {
    'use strict';

    const DEFAULT_TAXONOMY_URL = '/categories_subcategories.json';
    const DEFAULT_TAXONOMY_FILE = 'categories_subcategories.json';
    const DEFAULT_CONFIG_URL = '/brain-config.json';

    let cachedTaxonomy = null;
    let cachedPromise = null;

    function isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function normalizeWhitespace(value) {
        if (!isNonEmptyString(value)) return '';
        return value.trim().replace(/\s+/g, ' ');
    }

    function resolveAliases(label, taxonomy) {
        if (!isNonEmptyString(label) || !taxonomy) return normalizeWhitespace(label);

        const aliases = taxonomy.label_aliases || {};
        let current = normalizeWhitespace(label);
        const visited = new Set();

        while (isNonEmptyString(current) && aliases[current] && !visited.has(current)) {
            visited.add(current);
            current = normalizeWhitespace(aliases[current]);
        }

        return current;
    }

    function getParents(taxonomy) {
        return taxonomy?.categories ? Object.keys(taxonomy.categories) : [];
    }

    function isValidParent(parent, taxonomy) {
        if (!isNonEmptyString(parent) || !taxonomy?.categories) return false;
        return Object.prototype.hasOwnProperty.call(taxonomy.categories, parent);
    }

    function getSubcategories(parent, taxonomy) {
        if (!isValidParent(parent, taxonomy)) return [];
        const subcats = taxonomy.categories[parent]?.subcategories;
        return Array.isArray(subcats) ? subcats.slice() : [];
    }

    function isValidSubcategory(subcategory, taxonomy) {
        if (!isNonEmptyString(subcategory) || !taxonomy?.subcategory_mapping) return false;
        return Object.prototype.hasOwnProperty.call(taxonomy.subcategory_mapping, subcategory);
    }

    function getParentForLabel(label, taxonomy) {
        const normalized = resolveAliases(label, taxonomy);

        if (isValidParent(normalized, taxonomy)) return normalized;
        if (isValidSubcategory(normalized, taxonomy)) return taxonomy.subcategory_mapping[normalized];

        return 'Others';
    }

    function normalizeLabel(label, taxonomy) {
        const normalized = resolveAliases(label, taxonomy);
        if (isValidParent(normalized, taxonomy) || isValidSubcategory(normalized, taxonomy) || normalized === 'Others') {
            return normalized;
        }
        return 'Others';
    }

    function normalizeCategoryPair(category, subcategory, taxonomy) {
        const rawCategory = normalizeWhitespace(category);
        const rawSubcategory = normalizeWhitespace(subcategory);

        const normalizedSub = rawSubcategory ? normalizeLabel(rawSubcategory, taxonomy) : '';
        const normalizedCat = rawCategory ? normalizeLabel(rawCategory, taxonomy) : '';

        if (normalizedSub && normalizedSub !== 'Others' && isValidSubcategory(normalizedSub, taxonomy)) {
            return {
                category: getParentForLabel(normalizedSub, taxonomy),
                subcategory: normalizedSub
            };
        }

        if (normalizedCat && normalizedCat !== 'Others') {
            if (isValidSubcategory(normalizedCat, taxonomy)) {
                return {
                    category: getParentForLabel(normalizedCat, taxonomy),
                    subcategory: normalizedCat
                };
            }
            if (isValidParent(normalizedCat, taxonomy)) {
                return {
                    category: normalizedCat,
                    subcategory: rawSubcategory ? normalizeLabel(rawSubcategory, taxonomy) : null
                };
            }
        }

        return { category: 'Others', subcategory: null };
    }

    async function fetchJsonWithTimeout(url, timeoutMs) {
        const ms = Number(timeoutMs);
        if (!Number.isFinite(ms) || ms <= 0) {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        }

        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), ms);
        try {
            const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } finally {
            clearTimeout(t);
        }
    }

    async function loadTaxonomy(options = {}) {
        if (cachedTaxonomy) return cachedTaxonomy;
        if (cachedPromise) return cachedPromise;

        const resolved = { ...options };

        cachedPromise = (async () => {
            let taxonomy;

            if (fs && path) {
                const filePath = resolved.filePath || path.join(process.cwd(), DEFAULT_TAXONOMY_FILE);
                taxonomy = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } else {
                if (!resolved.skipConfig) {
                    const configUrl = resolved.configUrl || DEFAULT_CONFIG_URL;
                    const configTimeoutMs = resolved.configTimeoutMs === undefined ? 1500 : resolved.configTimeoutMs;
                    try {
                        const config = await fetchJsonWithTimeout(configUrl, configTimeoutMs);
                        if (config && typeof config === 'object') {
                            root.DRIMSBrainConfig = config;
                            if (config.taxonomy && typeof config.taxonomy === 'object') {
                                taxonomy = config.taxonomy;
                            }
                        }
                    } catch (_e) { }
                }

                if (!taxonomy) {
                    const possiblePaths = resolved.url ? [resolved.url] : [
                        DEFAULT_TAXONOMY_URL,
                        '/data/categories_subcategories.json',
                        'categories_subcategories.json',
                        '../categories_subcategories.json'
                    ];

                    let response = null;
                    for (const path of possiblePaths) {
                        try {
                            const res = await fetch(path, { cache: 'no-store' });
                            if (res.ok) {
                                response = res;
                                break;
                            }
                        } catch (e) {
                            // continue
                        }
                    }

                    if (!response) throw new Error('Failed to load taxonomy from any path');
                    taxonomy = await response.json();
                }
            }

            cachedTaxonomy = taxonomy;
            return taxonomy;
        })();

        return cachedPromise;
    }

    function setTaxonomyForTesting(taxonomy) {
        cachedTaxonomy = taxonomy;
        cachedPromise = null;
    }

    return {
        loadTaxonomy,
        setTaxonomyForTesting,
        normalizeLabel,
        normalizeCategoryPair,
        getParentForLabel,
        getParents,
        getCategories: getParents,
        getSubcategories,
        isValidParent,
        isValidSubcategory
    };
});
