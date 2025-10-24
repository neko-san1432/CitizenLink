const express = require('express');
const Database = require('../config/database');

const router = express.Router();

// ============================================================================
// NEWS ROUTES
// ============================================================================

// GET /api/content/news - Get all published news
router.get('/news', async (req, res) => {
  try {
    const { limit = 10, offset = 0, category } = req.query;

    let query = Database.getClient()
      .from('news')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch news'
    });
  }
});

// GET /api/content/news/:id - Get single news article
router.get('/news/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await Database.getClient()
      .from('news')
      .select('*')
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'News article not found'
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching news article:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch news article'
    });
  }
});

// POST /api/content/news - Create news (admin only)
router.post('/news', async (req, res) => {
  try {
    const { title, content, excerpt, image_url, category, tags, status } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }

    const newsData = {
      title,
      content,
      excerpt,
      image_url,
      category,
      tags,
      status: status || 'draft',
      published_at: status === 'published' ? new Date().toISOString() : null,
      author_id: req.user?.id
    };

    const { data, error } = await Database.getClient()
      .from('news')
      .insert([newsData])
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error creating news:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create news'
    });
  }
});

// ============================================================================
// EVENTS ROUTES
// ============================================================================

// GET /api/content/events - Get upcoming events
router.get('/events', async (req, res) => {
  try {
    const { limit = 10, offset = 0, status = 'upcoming' } = req.query;

    const { data, error } = await Database.getClient()
      .from('events')
      .select('*')
      .in('status', status.split(','))
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch events'
    });
  }
});

// GET /api/content/events/:id - Get single event
router.get('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await Database.getClient()
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch event'
    });
  }
});

// POST /api/content/events - Create event (admin only)
router.post('/events', async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      event_date,
      end_date,
      image_url,
      organizer,
      category,
      tags,
      max_participants,
      registration_required
    } = req.body;

    if (!title || !description || !event_date) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and event date are required'
      });
    }

    const eventData = {
      title,
      description,
      location,
      event_date,
      end_date,
      image_url,
      organizer,
      category,
      tags,
      max_participants,
      registration_required,
      status: 'upcoming',
      created_by: req.user?.id
    };

    const { data, error } = await Database.getClient()
      .from('events')
      .insert([eventData])
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create event'
    });
  }
});

// ============================================================================
// NOTICES ROUTES
// ============================================================================

// GET /api/content/notices - Get active notices
router.get('/notices', async (req, res) => {
  try {
    const { limit = 10, offset = 0, priority } = req.query;

    let query = Database.getClient()
      .from('notices')
      .select('*')
      .eq('status', 'active')
      .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`)
      .order('priority', { ascending: false })
      .order('valid_from', { ascending: false })
      .range(offset, offset + limit - 1);

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error fetching notices:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch notices'
    });
  }
});

// GET /api/content/notices/:id - Get single notice
router.get('/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await Database.getClient()
      .from('notices')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Notice not found'
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching notice:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch notice'
    });
  }
});

// POST /api/content/notices - Create notice (admin only)
router.post('/notices', async (req, res) => {
  try {
    const {
      title,
      content,
      priority,
      type,
      target_audience,
      image_url,
      valid_from,
      valid_until
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }

    const noticeData = {
      title,
      content,
      priority: priority || 'normal',
      type,
      target_audience,
      image_url,
      valid_from: valid_from || new Date().toISOString(),
      valid_until,
      status: 'active',
      created_by: req.user?.id
    };

    const { data, error } = await Database.getClient()
      .from('notices')
      .insert([noticeData])
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error creating notice:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create notice'
    });
  }
});

module.exports = router;
