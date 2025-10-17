# Content Management System - News, Events, and Notices

## Overview
This document describes the implementation of the Content Management System for CitizenLink, which includes News, Events, and Notices functionality using Supabase.

## Database Schema

### Tables Created
1. **news** - For news articles and updates
2. **events** - For upcoming events and activities
3. **notices** - For important announcements and alerts

### Setup Instructions

1. **Run the SQL Schema**
   ```bash
   # Execute the schema file in your Supabase SQL editor
   sql/content_management_schema.sql
   ```

2. **Verify Tables**
   - Check that all three tables are created
   - Verify indexes are in place
   - Confirm RLS policies are enabled

## API Endpoints

### News Endpoints

#### GET /api/content/news
Get all published news articles
```javascript
// Query parameters:
// - limit: number of items (default: 10)
// - offset: pagination offset (default: 0)
// - category: filter by category (optional)

fetch('/api/content/news?limit=5&category=announcements')
  .then(res => res.json())
  .then(data => console.log(data));
```

#### GET /api/content/news/:id
Get a single news article by ID

#### POST /api/content/news
Create a new news article (admin only)
```javascript
fetch('/api/content/news', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'New Community Program',
    content: 'Full article content here...',
    excerpt: 'Short summary...',
    image_url: 'https://example.com/image.jpg',
    category: 'community',
    tags: ['program', 'community'],
    status: 'published'
  })
});
```

### Events Endpoints

#### GET /api/content/events
Get upcoming events
```javascript
// Query parameters:
// - limit: number of items (default: 10)
// - offset: pagination offset (default: 0)
// - status: filter by status (default: 'upcoming')

fetch('/api/content/events?limit=5')
  .then(res => res.json())
  .then(data => console.log(data));
```

#### GET /api/content/events/:id
Get a single event by ID

#### POST /api/content/events
Create a new event (admin only)
```javascript
fetch('/api/content/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Community Clean-up Drive',
    description: 'Join us for a community clean-up...',
    location: 'City Plaza',
    event_date: '2025-11-01T09:00:00Z',
    end_date: '2025-11-01T12:00:00Z',
    image_url: 'https://example.com/event.jpg',
    organizer: 'City Government',
    category: 'environment',
    max_participants: 100,
    registration_required: true
  })
});
```

### Notices Endpoints

#### GET /api/content/notices
Get active notices
```javascript
// Query parameters:
// - limit: number of items (default: 10)
// - offset: pagination offset (default: 0)
// - priority: filter by priority (optional)

fetch('/api/content/notices?limit=5&priority=urgent')
  .then(res => res.json())
  .then(data => console.log(data));
```

#### GET /api/content/notices/:id
Get a single notice by ID

#### POST /api/content/notices
Create a new notice (admin only)
```javascript
fetch('/api/content/notices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Road Closure Advisory',
    content: 'Main street will be closed for repairs...',
    priority: 'high',
    type: 'advisory',
    target_audience: ['all'],
    valid_from: '2025-10-20T00:00:00Z',
    valid_until: '2025-10-25T23:59:59Z'
  })
});
```

## Frontend Widgets

### Using the Widgets

#### News Widget
```html
<!-- Add to your HTML -->
<div id="news-widget"></div>

<!-- Include CSS -->
<link rel="stylesheet" href="/css/content-widgets.css">

<!-- Include and initialize the widget -->
<script src="/js/components/newsWidget.js"></script>
<script>
  const newsWidget = new NewsWidget('news-widget', {
    limit: 5,
    showImages: true,
    showExcerpt: true
  });
  newsWidget.init();
</script>
```

#### Events Widget
```html
<!-- Add to your HTML -->
<div id="events-widget"></div>

<!-- Include CSS -->
<link rel="stylesheet" href="/css/content-widgets.css">

<!-- Include and initialize the widget -->
<script src="/js/components/eventsWidget.js"></script>
<script>
  const eventsWidget = new EventsWidget('events-widget', {
    limit: 5,
    showImages: true
  });
  eventsWidget.init();
</script>
```

#### Notices Widget
```html
<!-- Add to your HTML -->
<div id="notices-widget"></div>

<!-- Include CSS -->
<link rel="stylesheet" href="/css/content-widgets.css">

<!-- Include and initialize the widget -->
<script src="/js/components/noticesWidget.js"></script>
<script>
  const noticesWidget = new NoticesWidget('notices-widget', {
    limit: 5,
    showPriority: true
  });
  noticesWidget.init();
</script>
```

## Widget Options

### NewsWidget Options
- `limit` (number): Number of news items to display (default: 5)
- `showImages` (boolean): Show news images (default: true)
- `showExcerpt` (boolean): Show news excerpts (default: true)

### EventsWidget Options
- `limit` (number): Number of events to display (default: 5)
- `showImages` (boolean): Show event images (default: true)

### NoticesWidget Options
- `limit` (number): Number of notices to display (default: 5)
- `showPriority` (boolean): Show priority badges (default: true)

## Data Models

### News
```typescript
{
  id: uuid,
  title: string,
  content: text,
  excerpt: text (optional),
  image_url: text (optional),
  author_id: uuid (optional),
  category: string (optional),
  tags: string[],
  status: 'draft' | 'published' | 'archived',
  published_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp
}
```

### Events
```typescript
{
  id: uuid,
  title: string,
  description: text,
  location: string (optional),
  event_date: timestamp,
  end_date: timestamp (optional),
  image_url: text (optional),
  organizer: string (optional),
  category: string (optional),
  tags: string[],
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled',
  max_participants: number (optional),
  registration_required: boolean,
  created_by: uuid (optional),
  created_at: timestamp,
  updated_at: timestamp
}
```

### Notices
```typescript
{
  id: uuid,
  title: string,
  content: text,
  priority: 'low' | 'normal' | 'high' | 'urgent',
  type: string (optional),
  target_audience: string[],
  image_url: text (optional),
  valid_from: timestamp,
  valid_until: timestamp (optional),
  status: 'active' | 'expired' | 'archived',
  created_by: uuid (optional),
  created_at: timestamp,
  updated_at: timestamp
}
```

## Security

### Row Level Security (RLS)
- Public users can view published/active content
- Admin users can create, update, and delete content
- RLS policies are automatically enforced by Supabase

### Authentication
- Content creation/modification requires authentication
- Role-based access control via JWT claims
- Admin roles: `lgu_admin`, `super_admin`

## Next Steps

1. **Run the SQL schema** in Supabase
2. **Test the API endpoints** using Postman or curl
3. **Add widgets to your dashboard** pages
4. **Create sample content** for testing
5. **Customize styling** as needed

## Support

For issues or questions, refer to:
- Supabase documentation: https://supabase.com/docs
- Project repository issues
