// LGU News Management
document.addEventListener('DOMContentLoaded', async () => {
    console.log('LGU News Management initialized');
    
    // Check authentication
    const user = await checkAuth();
    if (!user) return;
    
    // Initialize news management
    initializeNewsManagement();
});

function initializeNewsManagement() {
    console.log('Initializing news management...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup button event listeners
    setupButtonEventListeners();
    
    // Load news articles
    loadNewsArticles();
}

function setupEventListeners() {
    // Add news button
    const addNewsBtn = document.getElementById('add-news-btn');
    if (addNewsBtn) {
        addNewsBtn.addEventListener('click', showAddNewsModal);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-news-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadNewsArticles);
    }
    
    // Filter functionality
    const priorityFilter = document.getElementById('priority-filter');
    const categoryFilter = document.getElementById('category-filter');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('news-search');
    
    if (priorityFilter) {
        priorityFilter.addEventListener('change', handleFilterChange);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', handleFilterChange);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', handleFilterChange);
    }
    if (searchInput) {
        searchInput.addEventListener('input', handleFilterChange);
    }
    
    // News action buttons (view, edit, delete)
    document.addEventListener('click', function(e) {
        console.log('Click detected on:', e.target);
        
        if (e.target.closest('[data-action="view-news-article"]')) {
            console.log('View button clicked');
            const articleId = e.target.closest('[data-action="view-news-article"]').getAttribute('data-article-id');
            console.log('Article ID:', articleId);
            viewNewsArticle(articleId);
        } else if (e.target.closest('[data-action="edit-news-article"]')) {
            console.log('Edit button clicked');
            const articleId = e.target.closest('[data-action="edit-news-article"]').getAttribute('data-article-id');
            console.log('Article ID:', articleId);
            editNewsArticle(articleId);
        } else if (e.target.closest('[data-action="delete-news-article"]')) {
            console.log('Delete button clicked');
            const articleId = e.target.closest('[data-action="delete-news-article"]').getAttribute('data-article-id');
            console.log('Article ID:', articleId);
            deleteNewsArticle(articleId);
        }
    });
    
    // Modal close button
    const modalClose = document.getElementById('news-modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeNewsModal);
    }
}

async function loadNewsArticles() {
    try {
        console.log('Loading news articles...');
        
        // Fetch real data from Supabase
        if (window.getNews) {
            let newsArticles = await window.getNews();
            console.log('Loaded news articles:', newsArticles);
            
            // Resolve signed URLs for images (24h) based on image_path
            if (Array.isArray(newsArticles) && newsArticles.length > 0) {
                const resolved = [];
                for (const art of newsArticles) {
                    if (art.image_path) {
                        const signed = await getSignedUrlForPath(art.image_path, 86400);
                        resolved.push({ ...art, image_signed_url: signed });
                    } else if (art.image_url) {
                        // Legacy: derive key from URL and sign
                        const derivedPath = deriveDbPathFromUrl(art.image_url);
                        const signed = derivedPath ? await getSignedUrlForPath(derivedPath, 86400) : null;
                        resolved.push({ ...art, image_path: derivedPath, image_signed_url: signed });
                    } else {
                        resolved.push(art);
                    }
                }
                newsArticles = resolved;
            }
            
            // Debug: Count articles with images
            const articlesWithImages = newsArticles.filter(article => article.image_path);
            console.log('🖼️ News articles image summary:', {
                totalArticles: newsArticles.length,
                articlesWithImages: articlesWithImages.length,
                articlesWithoutImages: newsArticles.length - articlesWithImages.length,
                imagePaths: articlesWithImages.map(article => ({
                    id: article.id,
                    title: article.title,
                    imagePath: article.image_path
                }))
            });
            
            displayNewsArticles(newsArticles);
        } else {
            console.error('getNews function not available');
            showToast('News system not available', 'error');
        }
        
    } catch (error) {
        console.error('Error loading news articles:', error);
        showToast('Error loading news articles', 'error');
    }
}

// Mock news data for demonstration
function getMockNewsData() {
    return [
        {
            id: 1,
            title: "Water Service Interruption",
            content: "Scheduled maintenance will interrupt water services in Zones 1-3. Residents are advised to store water for essential use.",
            category: "utilities",
            priority: "high",
            status: "published",
            publishDate: "2024-01-15T08:00:00",
            expiryDate: "2024-01-17T18:00:00",
            isUrgent: true
        },
        {
            id: 2,
            title: "Typhoon Preparedness Advisory",
            content: "Prepare emergency kits and follow LGU channels for updates. Stay informed about weather conditions.",
            category: "safety",
            priority: "critical",
            status: "published",
            publishDate: "2024-01-14T10:00:00",
            expiryDate: "2024-01-20T23:59:00",
            isUrgent: true
        },
        {
            id: 3,
            title: "Community Health Program",
            content: "Free health check-ups available at the community center every Saturday morning.",
            category: "announcement",
            priority: "medium",
            status: "published",
            publishDate: "2024-01-10T09:00:00",
            expiryDate: "2024-02-10T17:00:00",
            isUrgent: false
        },
        {
            id: 4,
            title: "Road Construction Update",
            content: "Main Street construction is progressing well. Expect minor delays during peak hours.",
            category: "update",
            priority: "low",
            status: "published",
            publishDate: "2024-01-12T14:00:00",
            expiryDate: "2024-01-25T18:00:00",
            isUrgent: false
        },
        {
            id: 5,
            title: "New Park Opening Ceremony",
            content: "Join us for the grand opening of the new community park this Saturday at 2 PM.",
            category: "event",
            priority: "medium",
            status: "draft",
            publishDate: "2024-01-20T14:00:00",
            expiryDate: "2024-01-20T18:00:00",
            isUrgent: false
        },
        {
            id: 6,
            title: "Power Outage Notice",
            content: "Scheduled power maintenance in the downtown area from 2 AM to 6 AM tomorrow.",
            category: "utilities",
            priority: "high",
            status: "published",
            publishDate: "2024-01-13T20:00:00",
            expiryDate: "2024-01-14T08:00:00",
            isUrgent: true
        }
    ];
}

// Display news articles in card format
function displayNewsArticles(newsArticles) {
    console.log('Displaying news articles:', newsArticles);
    const newsTableBody = document.getElementById('news-table-body');
    const noNews = document.getElementById('no-news');
    const newsTable = document.getElementById('news-table');
    
    if (!newsTableBody) {
        console.error('news-table-body not found');
        return;
    }
    
    if (!newsArticles || newsArticles.length === 0) {
        console.log('No news articles to display');
        showEmptyState();
        return;
    }
    
    // Clear existing content
    newsTableBody.innerHTML = '';
    
    // Create news table rows
    newsArticles.forEach(article => {
        const newsRow = createNewsTableRow(article);
        newsTableBody.appendChild(newsRow);
    });
    
    console.log('News articles displayed successfully');
    
    // Show table and hide empty state
    if (newsTable) newsTable.style.display = 'table';
    if (noNews) noNews.style.display = 'none';
}

// Create individual news table row
function createNewsTableRow(article) {
    console.log('Creating table row for article:', article);
    const row = document.createElement('tr');
    row.className = `news-row`;
    
    // Use correct field names from database schema
    const publishDate = article.published_at ? new Date(article.published_at).toLocaleDateString() : 
                       article.created_at ? new Date(article.created_at).toLocaleDateString() : 'N/A';
    const truncatedContent = article.content && article.content.length > 100 ? 
        article.content.substring(0, 100) + '...' : (article.content || 'No content');
    
    // Handle missing fields with defaults
    const priority = article.priority || 'medium';
    const status = article.status || 'draft';
    const category = article.category || 'general';
    
    row.innerHTML = `
        <td>
            <div class="news-title-cell">
                <div class="news-title">${article.title}</div>
                <div class="news-content-preview">${truncatedContent}</div>
        </div>
        </td>
        <td>
            <span class="news-category-badge">${category}</span>
        </td>
        <td>
            <span class="news-priority-badge priority-${priority}">${priority.toUpperCase()}</span>
        </td>
        <td>
            <span class="news-status-badge status-${status}">${status.toUpperCase()}</span>
        </td>
        <td>
            <div class="news-date-cell">
                <div class="news-publish-date">${publishDate}</div>
                <div class="news-expiry-date text-muted">Author: ${article.author || 'Unknown'}</div>
        </div>
        </td>
        <td>
            <div class="news-actions">
                <button class="btn btn-sm btn-outline-primary" data-action="view-news-article" data-article-id="${article.id}">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" data-action="edit-news-article" data-article-id="${article.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete-news-article" data-article-id="${article.id}">
                    <i class="fas fa-trash"></i>
                </button>
        </div>
        </td>
    `;
    
    return row;
}

function showEmptyState() {
    const newsTable = document.getElementById('news-table');
    const noNews = document.getElementById('no-news');
    
    if (newsTable) newsTable.style.display = 'none';
    if (noNews) noNews.style.display = 'block';
}

// View news article
async function viewNewsArticle(articleId) {
    try {
        console.log('Viewing news article:', articleId);
        
        // Check if supabaseManager exists
        if (!window.supabaseManager) {
            console.error('supabaseManager not available');
            showToast('News system not available', 'error');
            return;
        }
        
        console.log('Initializing Supabase...');
        const supabase = await window.supabaseManager.initialize();
        console.log('Supabase initialized, fetching article...');
        
        const { data: article, error } = await supabase
            .from('news_data')
            .select('*')
            .eq('id', articleId)
            .single();
        
        if (error) {
            console.error('Error fetching article:', error);
            showToast('Error loading article: ' + error.message, 'error');
            return;
        }
        
        if (!article) {
            console.error('Article not found');
            showToast('Article not found', 'error');
            return;
        }
        
        console.log('Article fetched successfully:', article);
        console.log('🖼️ Image data from DB (path/url):', {
            hasImagePath: !!article.image_path,
            imagePath: article.image_path || null,
            hasLegacyUrl: !!article.image_url,
            legacyUrl: article.image_url || null
        });
        
        // Create a 24h signed URL
        const articleWithValidImage = await attachSignedUrlIfNeeded(article);
        
        console.log('🖼️ Image after signing:', {
            hasSigned: !!articleWithValidImage.image_signed_url,
            signedUrl: articleWithValidImage.image_signed_url,
            imagePath: articleWithValidImage.image_path || null
        });
        
        console.log('Showing news view modal...');
        
        // Show article in a modal
        showNewsViewModal(articleWithValidImage);
    } catch (error) {
        console.error('Error viewing news article:', error);
        showToast('Error viewing article: ' + error.message, 'error');
    }
}

// Show news view modal
function showNewsViewModal(article) {
    console.log('showNewsViewModal called with article:', article);
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('news-view-modal');
    if (!modal) {
        console.log('Creating new view modal...');
        modal = document.createElement('div');
        modal.id = 'news-view-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">View News Article</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="news-view-content">
                        <!-- Content will be inserted here -->
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        console.log('View modal created and added to DOM');
    } else {
        console.log('Using existing view modal');
    }
    
    // Populate content
    const content = document.getElementById('news-view-content');
    
    // Debug: Count images being displayed
    const imageCount = article.image_url ? 1 : 0;
    console.log('🖼️ Displaying images in preview modal:', {
        totalImages: imageCount,
        hasImage: !!article.image_url,
        imageUrl: article.image_url,
        imageElement: article.image_url ? 'img tag will be created' : 'no img tag'
    });
    
    content.innerHTML = `
        <div class="news-view-article">
            <h3 class="news-view-title">${article.title || 'Untitled'}</h3>
            <div class="news-view-meta mb-3">
                <span class="badge bg-primary me-2">${article.category || 'General'}</span>
                <span class="badge bg-${article.status === 'published' ? 'success' : 'warning'} me-2">${(article.status || 'draft').toUpperCase()}</span>
                <small class="text-muted">By ${article.author || 'Unknown'} • ${article.published_at ? new Date(article.published_at).toLocaleDateString() : 'Not published'}</small>
            </div>
            ${article.image_signed_url ? `<img src="${article.image_signed_url}" class="img-fluid mb-3" alt="News image" onerror="this.style.display='none'">` : ''}
            <div class="news-view-content">
                ${article.content || 'No content available'}
            </div>
            ${article.tags && article.tags.length > 0 ? `
                <div class="news-view-tags mt-3">
                    <strong>Tags:</strong>
                    ${article.tags.map(tag => `<span class="badge bg-light text-dark me-1">${tag}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    // Show modal (without Bootstrap dependency)
    console.log('About to show modal...');
    
    // Remove any existing backdrop first
    const existingBackdrop = document.getElementById('news-view-backdrop');
    if (existingBackdrop) {
        existingBackdrop.remove();
    }
    
    // Ensure modal is properly positioned in body
    if (modal.parentNode && modal.parentNode !== document.body) {
        document.body.appendChild(modal);
    }
    
    // Create a separate backdrop element behind the modal
    const backdrop = document.createElement('div');
    backdrop.id = 'news-view-backdrop';
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.width = '100%';
    backdrop.style.height = '100%';
    backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    backdrop.style.zIndex = '1040';
    backdrop.style.pointerEvents = 'auto';
    document.body.appendChild(backdrop);
    
    // Show modal with higher z-index (above backdrop)
    modal.style.display = 'block';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.zIndex = '1050'; // High z-index for modal
    modal.style.padding = '0';
    modal.style.margin = '0';
    modal.style.backgroundColor = 'transparent'; // Modal container transparent; backdrop provides dim
    modal.style.pointerEvents = 'none'; // Let clicks fall through except dialog
    modal.classList.add('show');
    
    // Ensure modal dialog is centered and visible
    const modalDialog = modal.querySelector('.modal-dialog');
    if (modalDialog) {
        modalDialog.style.position = 'relative';
        modalDialog.style.zIndex = '1061';
        modalDialog.style.margin = '1.75rem auto';
        modalDialog.style.maxWidth = '500px';
        modalDialog.style.pointerEvents = 'auto'; // Re-enable pointer events for dialog
    }
    // Ensure modal content is fully opaque and readable
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.backgroundColor = '#fff';
        modalContent.style.color = 'inherit';
    }
    
    // Close modal when clicking backdrop
    backdrop.addEventListener('click', () => {
        closeViewModal();
    });
    
    // Close modal when clicking close button
    const closeBtn = modal.querySelector('.btn-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeViewModal);
    }
    
    console.log('Modal shown successfully');
    console.log('Modal parent:', modal.parentNode);
    console.log('Modal z-index:', modal.style.zIndex);
}

// Close view modal
function closeViewModal() {
    const modal = document.getElementById('news-view-modal');
    const backdrop = document.getElementById('news-view-backdrop');
    
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
    if (backdrop) {
        backdrop.remove();
    }
}

// Edit news article
async function editNewsArticle(articleId) {
    try {
        console.log('Editing news article:', articleId);
        
        // Fetch the article from Supabase
        if (window.supabaseManager) {
            const supabase = await window.supabaseManager.initialize();
            const { data: article, error } = await supabase
                .from('news_data')
                .select('*')
                .eq('id', articleId)
                .single();
            
            if (error) {
                console.error('Error fetching article:', error);
                showToast('Error loading article for editing', 'error');
                return;
            }
            
            if (!article) {
                showToast('Article not found', 'error');
                return;
            }
            
            console.log('🖼️ Image data for edit form:', {
                hasImage: !!article.image_url,
                imageUrl: article.image_url,
                imagePath: article.image_url ? article.image_url.split('/').pop() : 'No image'
            });
            
            // Populate the form with article data
            await populateNewsForm(article);
            
            // Show the edit modal
            showAddNewsModal();
        } else {
            showToast('News system not available', 'error');
        }
    } catch (error) {
        console.error('Error editing news article:', error);
        showToast('Error editing article', 'error');
    }
}

// Populate news form with existing data
async function populateNewsForm(article) {
    // Store the article ID for updating
    window.editingArticleId = article.id;
    
    // Populate form fields
    const titleInput = document.querySelector('#news-title');
    const contentInput = document.querySelector('#news-content');
    const categoryInput = document.querySelector('#news-category');
    const statusInput = document.querySelector('#news-status');
    const featuredInput = document.querySelector('#news-featured');
    const tagsInput = document.querySelector('#news-tags');
    
    if (titleInput) titleInput.value = article.title || '';
    if (contentInput) contentInput.value = article.content || '';
    if (categoryInput) categoryInput.value = article.category || '';
    if (statusInput) statusInput.value = article.status || 'draft';
    if (featuredInput) featuredInput.checked = article.featured || false;
    if (tagsInput) tagsInput.value = article.tags ? article.tags.join(', ') : '';
    
    // Handle existing image
    if (article.image_path) {
        await displayExistingImage(article.image_path);
    }
    
    // Update modal title
    const modalTitle = document.querySelector('#news-modal .modal-title');
    if (modalTitle) modalTitle.textContent = 'Edit News Article';
    
    // Update save button text
    const saveBtn = document.querySelector('[data-action="save-news"]');
    if (saveBtn) saveBtn.textContent = 'Update Article';
}

// Display existing image in edit form
async function displayExistingImage(imagePath) {
    console.log('🖼️ Displaying existing image in edit form (by path):', {
        imagePath,
        hasPath: !!imagePath
    });
    
    const previewContainer = document.getElementById('image-preview-container');
    if (!previewContainer) return;
    
    // Clear existing previews
    previewContainer.innerHTML = '';
    
    // Generate a fresh 24h signed URL
    const validImageUrl = await getSignedUrlForPath(imagePath, 86400);
    
    // Create preview for existing image
    const previewItem = document.createElement('div');
    previewItem.className = 'image-preview-item';
    previewItem.innerHTML = `
        <img src="${validImageUrl}" alt="Existing image" class="image-preview-thumbnail" onerror="this.style.display='none'">
        <button class="image-preview-remove" data-action="remove-image-preview">
            <i class="fas fa-times"></i>
        </button>
        <div class="image-preview-info">
            Existing image
        </div>
    `;
    
    previewContainer.appendChild(previewItem);
    
    console.log('🖼️ Existing image preview created:', {
        finalUrl: validImageUrl,
        urlChanged: imageUrl !== validImageUrl,
        previewElement: 'image-preview-item created'
    });
    
    // Store the valid image URL for reference
    window.existingImageUrl = validImageUrl;
    window.existingImagePath = imagePath;
}

// Update news article
async function updateNewsArticle(articleId, newsData) {
    try {
        if (window.supabaseManager) {
            const supabase = await window.supabaseManager.initialize();
            
            // Add updated_at timestamp
            const updateData = {
                ...newsData,
                updated_at: new Date().toISOString()
            };
            
            const { data, error } = await supabase
                .from('news_data')
                .update(updateData)
                .eq('id', articleId)
                .select()
                .single();
            
            if (error) {
                console.error('Error updating news article:', error);
                throw error;
            }
            
            return data;
        } else {
            throw new Error('Supabase manager not available');
        }
    } catch (error) {
        console.error('Error in updateNewsArticle:', error);
        throw error;
    }
}

function showNewsTable() {
    const newsTable = document.getElementById('news-table');
    const noNews = document.getElementById('no-news');
    
    if (newsTable) newsTable.style.display = 'table';
    if (noNews) noNews.style.display = 'none';
}

function showAddNewsModal() {
    const modal = document.getElementById('news-modal');
    if (modal) {
        modal.style.display = 'block';
        
        // Set default publish date to now
        const publishDateInput = document.getElementById('news-publish-date');
        if (publishDateInput) {
            const now = new Date();
            const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
            publishDateInput.value = localDateTime.toISOString().slice(0, 16);
        }
        
        // Initialize image upload functionality
        initializeImageUpload();
    }
}

function closeNewsModal() {
    const modal = document.getElementById('news-modal');
    if (modal) {
        modal.style.display = 'none';
    
    // Reset form
        const form = document.getElementById('news-form');
    if (form) {
        form.reset();
    }
        
        // Clear uploaded images
        uploadedImages = [];
        pendingImages = [];
        const previewContainer = document.getElementById('image-preview-container');
        if (previewContainer) {
            previewContainer.innerHTML = '';
        }
        
        // Reset editing state and image tracking
        window.editingArticleId = null;
        window.existingImageUrl = null;
        window.imageRemoved = false;
        
        // Reset modal title and button text
        const modalTitle = document.querySelector('#news-modal .modal-title');
        if (modalTitle) modalTitle.textContent = 'Create News Article';
        
        const saveBtn = document.querySelector('[data-action="save-news"]');
        if (saveBtn) saveBtn.textContent = 'Save Article';
    }
}

async function saveNews() {
    try {
        const form = document.getElementById('news-form');
        if (!form) return;
        
        const formData = new FormData(form);

        // Log user metadata if available
        try {
            if (window.supabaseManager) {
                const supabase = await window.supabaseManager.initialize();
                const { data: { user } } = await supabase.auth.getUser();
                console.log('👤 Current user (for upload/save):', {
                    id: user?.id,
                    email: user?.email,
                    role: user?.user_metadata?.role || user?.app_metadata?.role,
                    appMeta: user?.app_metadata,
                    userMeta: user?.user_metadata
                });
            }
        } catch (e) {
            console.warn('Could not fetch user for logging:', e);
        }
        
        // 1) If there are pending images, upload them now (all-or-nothing)
        const newlyUploadedThisSave = [];
        if (pendingImages && pendingImages.length > 0) {
            showToast('Uploading images...', 'info');
            console.log('🚀 Starting upload of pending images', { count: pendingImages.length });
            for (const item of pendingImages) {
                try {
                    console.log('⬆️ Uploading image', { name: item.name, size: item.size });
                    const result = await uploadSingleNewsImage(item.file);
                    uploadedImages.push(result);
                    newlyUploadedThisSave.push(result);
                    console.log('✅ Uploaded image', result);
                } catch (err) {
                    console.error('❌ Error uploading a pending image, aborting save:', err);
                    showToast('Image upload failed. Save cancelled.', 'error');
                    // Rollback any images uploaded in this attempt
                    try { await deleteUploadedImages(newlyUploadedThisSave); } catch (_) {}
                    // Clear pending object URLs and keep previews as removed by user action only
                    pendingImages.forEach(i => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
                    return; // Abort save entirely
                }
            }
            // Clear pending now that uploads succeeded
            pendingImages.forEach(i => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
            pendingImages = [];
            console.log('🧹 Cleared pending images after upload');
        }
        // Determine image URL - prioritize new uploads, fallback to existing
        let imageUrl = null;
        let imagePath = null;
        if (uploadedImages && uploadedImages.length > 0) {
            // New images uploaded
            imageUrl = uploadedImages[0].url; // legacy
            imagePath = uploadedImages[0].path;
        } else if (window.existingImageUrl && !window.imageRemoved) {
            // Keep existing image if no new uploads and not removed
            imageUrl = window.existingImageUrl; // signed URL for display
            imagePath = window.existingImagePath || null;
        }
        
        const newsData = {
            title: formData.get('title'),
            excerpt: formData.get('excerpt') || formData.get('title').substring(0, 100) + '...', // Create excerpt from title if not provided
            content: formData.get('content'),
            category: formData.get('category'),
            author: 'LGU Admin', // You might want to get this from user data
            read_time: '5 min', // You might want to calculate this based on content length
            status: formData.get('status'),
            featured: formData.get('featured') === 'on',
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()) : [],
            image_path: imagePath || null // Store path in DB
        };
        
        // Validate required fields
        if (!newsData.title || !newsData.category || !newsData.status || !newsData.content) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        console.log('Saving news article:', newsData);
        
        // Images are already uploaded, just get the URLs
        let imageUrls = [];
        if (uploadedImages && uploadedImages.length > 0) {
            imageUrls = uploadedImages.map(img => img.url);
            console.log('Using uploaded image URLs:', imageUrls);
        }
        
        // Save to Supabase (imageUrls are handled separately in storage)
        try {
            showToast('Saving news article...', 'info');
            
            let savedArticle;
            if (window.editingArticleId) {
                // Update existing article
                savedArticle = await updateNewsArticle(window.editingArticleId, newsData);
                console.log('News article updated:', savedArticle);
                showToast('News article updated successfully!', 'success');
            } else {
                // Create new article
                savedArticle = await window.createNewsArticle(newsData);
                console.log('News article saved:', savedArticle);
        showToast('News article saved successfully!', 'success');
            }
            
            // Clear editing state
            window.editingArticleId = null;
        
        // Close modal
        closeNewsModal();
        
        // Reload news articles
        loadNewsArticles();
        } catch (error) {
            console.error('Error saving to database, rolling back uploaded images:', error);
            // Try to remove any images uploaded in this save
            try {
                const toRemove = (typeof newlyUploadedThisSave !== 'undefined') ? newlyUploadedThisSave : [];
                await deleteUploadedImages(toRemove);
            } catch (_) {}
            showToast('Saving news failed. Any uploaded images were removed.', 'error');
        }
        
    } catch (error) {
        console.error('Error saving news article:', error);
        showToast('Error saving news article', 'error');
    }
}

// Handle filter changes
function handleFilterChange() {
    const priorityFilter = document.getElementById('priority-filter').value;
    const categoryFilter = document.getElementById('category-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const searchInput = document.getElementById('news-search').value.toLowerCase();
    
    const allNews = getMockNewsData();
    let filteredNews = allNews;
    
    // Apply filters
    if (priorityFilter) {
        filteredNews = filteredNews.filter(article => article.priority === priorityFilter);
    }
    
    if (categoryFilter) {
        filteredNews = filteredNews.filter(article => article.category === categoryFilter);
    }
    
    if (statusFilter) {
        filteredNews = filteredNews.filter(article => article.status === statusFilter);
    }
    
    if (searchInput) {
        filteredNews = filteredNews.filter(article => 
            article.title.toLowerCase().includes(searchInput) ||
            article.content.toLowerCase().includes(searchInput)
        );
    }
    
    displayNewsArticles(filteredNews);
}


// Toast notification function (if not already available)
function showToast(message, type = 'success') {
    // Check if a different global toast function exists (not this one)
    if (window.showToast && window.showToast !== showToast) {
        window.showToast(message, type);
    } else {
        // Fallback toast implementation
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast toast-${type} show`;
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        } else {
            // Final fallback
        alert(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Check auth function (avoid recursive self-calls)
async function checkAuth() {
    // If a different global checkAuth is available (e.g., from auth-check.js), use it
    if (window.checkAuth && window.checkAuth !== checkAuth) {
        return await window.checkAuth();
    }
    // Fallback auth check from sessionStorage
    const userData = sessionStorage.getItem('user');
    if (userData) {
        return JSON.parse(userData);
    }
    return null;
}

// Setup button event listeners
function setupButtonEventListeners() {
    // Use event delegation for dynamically created buttons
    document.addEventListener('click', (e) => {
        // Handle show add news modal button
        if (e.target.matches('#show-add-news-modal-btn') || e.target.closest('#show-add-news-modal-btn')) {
            showAddNewsModal();
        }
        
        // Handle image modal close
        if (e.target.matches('.image-modal-close') || e.target.matches('.image-modal')) {
            closeImageModal();
        }
        
        // Handle remove image preview button
        if (e.target.matches('[data-action="remove-image-preview"]') || e.target.closest('[data-action="remove-image-preview"]')) {
            const button = e.target.closest('[data-action="remove-image-preview"]');
            removeImagePreview(button);
        }
        
        // Handle close news modal button
        if (e.target.matches('[data-action="close-news-modal"]') || e.target.closest('[data-action="close-news-modal"]')) {
            closeNewsModal();
        }
        
        // Handle save news button
        if (e.target.matches('[data-action="save-news"]') || e.target.closest('[data-action="save-news"]')) {
            saveNews();
        }
        
        // Handle image preview clicks
        if (e.target.matches('.news-article-images img')) {
            openImageModal(e.target.src);
        }
    });
}

// Image upload functionality
let uploadedImages = [];
let pendingImages = [];

function initializeImageUpload() {
    const dropZone = document.getElementById('image-drop-zone');
    const fileInput = document.getElementById('news-images');
    const previewContainer = document.getElementById('image-preview-container');
    
    if (!dropZone || !fileInput || !previewContainer) return;
    
    // Clear previous uploads
    uploadedImages = [];
    pendingImages = [];
    previewContainer.innerHTML = '';
    
    // Click to browse
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File input change
    fileInput.addEventListener('change', async (e) => {
        await handleFiles(e.target.files);
    });
    
    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        await handleFiles(e.dataTransfer.files);
    });
}

async function handleFiles(files) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    
    for (const file of Array.from(files)) {
        // Validate file
        if (!allowedTypes.includes(file.type)) {
            showToast('Please select valid image files (JPG, PNG, GIF)', 'error');
            continue;
        }
        
        if (file.size > maxSize) {
            showToast('File size must be less than 5MB', 'error');
            continue;
        }
        
        try {
            // Defer upload: store locally and preview
            const previewUrl = URL.createObjectURL(file);
            pendingImages.push({ file, name: file.name, size: file.size, previewUrl });
            createImagePreview({ url: previewUrl, name: file.name, size: file.size, pending: true });
            showToast('Image added. It will upload on Save.', 'success');
        } catch (error) {
            console.error('Error handling file:', error);
            showToast('Error adding image: ' + error.message, 'error');
        }
    }
}

function createImagePreview(uploadResult) {
    const previewContainer = document.getElementById('image-preview-container');
    if (!previewContainer) return;
    
    const previewItem = document.createElement('div');
    previewItem.className = 'image-preview-item';
    previewItem.innerHTML = `
        <img src="${uploadResult.url}" alt="Preview" class="image-preview-thumbnail">
        <button class="image-preview-remove" data-action="remove-image-preview">
            <i class="fas fa-times"></i>
        </button>
        <div class="image-preview-info">
            ${uploadResult.pending ? 'Pending upload • ' : ''}${uploadResult.name} (${formatFileSize(uploadResult.size)})
        </div>
    `;
    
    previewContainer.appendChild(previewItem);
}

function removeImagePreview(button) {
    const previewItem = button.closest('.image-preview-item');
    const index = Array.from(previewItem.parentNode.children).indexOf(previewItem);
    
    // Check if this is an existing image
    const imageInfo = previewItem.querySelector('.image-preview-info');
    if (imageInfo && imageInfo.textContent.includes('Existing image')) {
        // Mark existing image as removed
        window.imageRemoved = true;
        window.existingImageUrl = null;
    } else {
        // Remove from pending or uploaded arrays based on availability
        if (pendingImages && pendingImages.length > 0 && index < pendingImages.length) {
            // Revoke object URL if present
            const item = pendingImages[index];
            if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            pendingImages.splice(index, 1);
        } else if (uploadedImages && uploadedImages.length > 0) {
            uploadedImages.splice(index, 1);
        }
    }
    
    // Remove from DOM
    previewItem.remove();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Image modal functionality
function openImageModal(imageSrc) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    
    if (modal && modalImage) {
        modalImage.src = imageSrc;
        modal.style.display = 'block';
    }
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Upload single news image to Supabase Storage
async function uploadSingleNewsImage(file) {
    if (!window.supabaseManager) {
        throw new Error('Supabase manager not available');
    }
    
    const supabase = await window.supabaseManager.initialize();
    try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('🧩 Upload context', {
            file: { name: file.name, size: file.size, type: file.type },
            user: { id: user?.id, email: user?.email, role: user?.user_metadata?.role || user?.app_metadata?.role }
        });
    } catch (_) {}
    
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `news_${timestamp}_${randomId}.${fileExtension}`;
    // Storage object key inside the bucket (no bucket prefix)
    const objectKey = `${fileName}`;
    // Path to store in DB (with bucket prefix as requested)
    const dbPath = `news-images/${objectKey}`;
    
    try {
        // First, try to upload using client-side auth
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('news-images')
            .upload(objectKey, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (uploadError) {
            console.error(`Upload error for ${file.name}:`, uploadError);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                console.error('🔐 RLS context', {
                    roleClaim: user?.user_metadata?.role || user?.app_metadata?.role,
                    bucket: 'news-images',
                    path: dbPath,
                    message: uploadError?.message,
                    status: uploadError?.statusCode || uploadError?.status
                });
            } catch (_) {}
            
            // If RLS policy fails, try server-side upload
            if (uploadError.message.includes('row-level security policy')) {
                console.log('RLS policy failed, trying server-side upload...');
                return await uploadViaServer(file, objectKey);
            }
            
            throw new Error(`Upload failed: ${uploadError.message}`);
        }
        
        // Get permanent public URL
        const { data: urlData } = supabase.storage
            .from('news-images')
            .getPublicUrl(objectKey);
        console.log('🖼️ Public URL:', urlData.publicUrl);
        await testImageUrl(urlData.publicUrl);
        return {
            url: urlData.publicUrl,
            path: dbPath,
            name: file.name,
            size: file.size,
            file: file // Keep original file for reference
        };
    } catch (error) {
        console.error(`Error uploading image ${file.name}:`, error);
        throw error;
    }
}

// Fallback: Upload via server using service role
async function uploadViaServer(file, objectKey) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', objectKey);
        
        const response = await fetch('/api/upload-news-image', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Server upload failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        return {
            url: result.url,
            path: `news-images/${result.path}`,
            name: file.name,
            size: file.size,
            file: file
        };
    } catch (error) {
        console.error('Server upload failed:', error);
        throw new Error('Both client and server upload failed');
    }
}

// Delete images helper (best-effort rollback)
async function deleteUploadedImages(items) {
    if (!items || items.length === 0) return;
    try {
        if (!window.supabaseManager) return;
        const supabase = await window.supabaseManager.initialize();
        for (const it of items) {
            if (!it?.path) continue;
            try {
                const { error } = await supabase.storage.from('news-images').remove([it.path]);
                if (error) {
                    console.warn('Could not delete uploaded image during rollback:', it.path, error);
                } else {
                    console.log('Rolled back uploaded image:', it.path);
                }
            } catch (e) {
                console.warn('Error during image rollback:', it.path, e);
            }
        }
    } catch (_) {}
}

// Check if a storage bucket is available/accessible from the client
async function checkBucketAvailability(bucketName) {
    try {
        if (!window.supabaseManager) {
            throw new Error('Supabase manager not available');
        }
        const supabase = await window.supabaseManager.initialize();
        // Try listing the root of the bucket with a tiny limit. If bucket doesn't exist
        // or RLS forbids listing, Supabase returns an error we can surface.
        const { data, error } = await supabase.storage
            .from(bucketName)
            .list('', { limit: 1 });
        if (error) {
            console.warn('Bucket check error:', { bucketName, error });
            return {
                available: false,
                bucket: bucketName,
                status: error.status || error.statusCode || null,
                message: error.message || 'Unknown error',
            };
        }
        return {
            available: true,
            bucket: bucketName,
            canList: Array.isArray(data),
            sampleCount: Array.isArray(data) ? data.length : 0,
        };
    } catch (e) {
        console.error('Bucket availability exception:', e);
        return { available: false, bucket: bucketName, message: e.message };
    }
}

// Upload news images to Supabase Storage (legacy function for multiple images)
async function uploadNewsImages(images) {
    if (!window.supabaseManager) {
        throw new Error('Supabase manager not available');
    }
    
    const supabase = await window.supabaseManager.initialize();
    
    const uploadPromises = images.map(async (file, index) => {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const fileExtension = file.name.split('.').pop();
        const fileName = `news_${timestamp}_${randomId}_${index}.${fileExtension}`;
        
        const filePath = `news-images/${fileName}`;
        
        try {
            // Upload to news-images bucket
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('news-images')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) {
                console.error(`Upload error for ${file.name}:`, uploadError);
                throw new Error(`Upload failed: ${uploadError.message}`);
            }
            
            // Get permanent public URL
            const { data: urlData } = supabase.storage
                .from('news-images')
                .getPublicUrl(filePath);
            
            return {
                url: urlData.publicUrl,
                path: filePath,
                name: file.name,
                size: file.size
            };
        } catch (error) {
            console.error(`Error uploading image ${file.name}:`, error);
            throw error;
        }
    });
    
    return await Promise.all(uploadPromises);
}

// Refresh image URL if it has expired
async function refreshImageUrl(imagePath) {
    try {
        if (!window.supabaseManager) {
            throw new Error('Supabase manager not available');
        }
        
        const supabase = await window.supabaseManager.initialize();
        
        // Generate a signed URL (24h)
        const { data, error } = await supabase.storage
            .from('news-images')
            .createSignedUrl(imagePath, 86400);
        if (error) throw error;
        return data?.signedUrl || null;
    } catch (error) {
        console.error('Error refreshing image URL:', error);
        return null;
    }
}

// Check if image URL is accessible and refresh if needed
async function ensureImageUrl(article) {
    // Deprecated: replaced by attachSignedUrlIfNeeded
    return article;
}

// Create signed URL for a given storage path
async function getSignedUrlForPath(imagePath, expiresInSeconds = 86400) {
    try {
        if (!window.supabaseManager) {
            throw new Error('Supabase manager not available');
        }
        const supabase = await window.supabaseManager.initialize();
        const { data, error } = await supabase.storage
            .from('news-images')
            .createSignedUrl(imagePath, expiresInSeconds);
        if (error) throw error;
        const url = data?.signedUrl || null;
        if (url) await testImageUrl(url);
        return url;
    } catch (error) {
        console.error('Error creating signed URL:', error);
        return null;
    }
}

// Attach signed URL to article if it has image_path
async function attachSignedUrlIfNeeded(article) {
    let path = article?.image_path || null;
    if (!path && article?.image_url) {
        path = deriveDbPathFromUrl(article.image_url);
    }
    if (!path) return article;
    const signed = await getSignedUrlForPath(path, 86400);
    return { ...article, image_path: path, image_signed_url: signed };
}

// Convert legacy public URL to DB path 'news-images/<key>'
function deriveDbPathFromUrl(url) {
    try {
        // Example public URL contains '/storage/v1/object/public/news-images/<key>'
        const parts = url.split('/news-images/');
        if (parts.length < 2) return null;
        let key = parts[1];
        // Normalize: remove leading 'news-images/' if present (double segment)
        if (key.startsWith('news-images/')) key = key.substring('news-images/'.length);
        return `news-images/${key}`;
    } catch {
        return null;
    }
}

// Extract object key from 'news-images/<key>' or return null
function getObjectKeyFromPath(dbPath) {
    if (typeof dbPath !== 'string') return null;
    return dbPath.startsWith('news-images/') ? dbPath.substring('news-images/'.length) : null;
}

// HEAD-check an image URL to verify accessibility and log result
async function testImageUrl(url) {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        console.log('🔎 Image URL test', { url, ok: res.ok, status: res.status });
        if (!res.ok) console.warn('⚠️ Image URL not accessible yet (may be propagating)', { url, status: res.status });
    } catch (e) {
        console.warn('⚠️ Image URL HEAD test failed', { url, error: e?.message });
    }
}

// Delete news article
async function deleteNewsArticle(articleId) {
    if (!articleId) return;
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this news article? This action cannot be undone.')) {
        return;
    }
    
    try {
        console.log('Deleting news article:', articleId);
        if (!window.supabaseManager) throw new Error('Supabase manager not available');
        const supabase = await window.supabaseManager.initialize();

        // 1) Fetch article to get image path/url
        const { data: article, error: fetchErr } = await supabase
            .from('news_data')
            .select('*')
            .eq('id', articleId)
            .single();
        if (fetchErr) {
            console.warn('Could not fetch article before delete:', fetchErr);
        }

        // 2) Delete image from storage if present
        try {
            let dbPath = article?.image_path || null;
            if (!dbPath && article?.image_url) {
                dbPath = deriveDbPathFromUrl(article.image_url);
            }
            if (dbPath) {
                const objectKey = getObjectKeyFromPath(dbPath); // strip 'news-images/'
                if (objectKey) {
                    const { error: rmErr } = await supabase.storage
                        .from('news-images')
                        .remove([objectKey]);
                    if (rmErr) {
                        console.warn('Storage remove failed:', { objectKey, rmErr });
                    } else {
                        console.log('Storage object removed:', objectKey);
                    }
                }
            }
        } catch (imgErr) {
            console.warn('Image deletion skipped/failed:', imgErr);
        }

        // 3) Delete the DB row (client-side). If RLS blocks, fallback to server.
        const { error: delErr } = await supabase
            .from('news_data')
            .delete()
            .eq('id', articleId);
        if (delErr) {
            console.warn('Client delete failed, maybe RLS. Error:', delErr);
            if ((delErr.message || '').toLowerCase().includes('row-level security')) {
                console.log('Trying server-side delete fallback...');
                const resp = await fetch(`/api/news/${articleId}`, { method: 'DELETE' });
                if (!resp.ok) {
                    const text = await resp.text().catch(() => '');
                    throw new Error(`Server delete failed: ${resp.status} ${text}`);
                }
            } else {
                throw delErr;
            }
        }

        showToast('News article deleted successfully!', 'success');
        // Reload news articles
        loadNewsArticles();
        
    } catch (error) {
        console.error('Error deleting news article:', error);
        showToast(`Error deleting article: ${error.message || 'Unknown error'}`, 'error');
    }
}
