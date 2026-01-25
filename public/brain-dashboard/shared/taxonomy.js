(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('fs'), require('path'));
    } else {
        root.CitizenLinkTaxonomy = factory(null, null);
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
                const configUrl = resolved.configUrl || DEFAULT_CONFIG_URL;
                let configResponse = null;
                try {
                    configResponse = await fetch(configUrl, { cache: 'no-store' });
                } catch (_e) {
                    configResponse = null;
                }

                if (configResponse && configResponse.ok) {
                    const config = await configResponse.json();
                    if (config && typeof config === 'object') {
                        root.CitizenLinkBrainConfig = config;
                        if (config.taxonomy) {
                            taxonomy = config.taxonomy;
                        }
                    }
                }

                if (!taxonomy) {
                    const url = resolved.url || DEFAULT_TAXONOMY_URL;
                    const response = await fetch(url, { cache: 'no-store' });
                    if (!response.ok) throw new Error(`Failed to load taxonomy: HTTP ${response.status}`);
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
        getSubcategories,
        isValidParent,
        isValidSubcategory
    };
});
