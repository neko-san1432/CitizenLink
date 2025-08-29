document.addEventListener('DOMContentLoaded', async () => {
  // Get user and complaints
  const user = await checkAuth();
  if (!user) return;
  
  // Initialize insights with real data
  await initializeInsights();
  
  // Setup date range filter
  setupDateRangeFilter();
});

// Authentication function
async function checkAuth() {
  try {
    // Check if user is authenticated
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (!user.id) {
      return null;
    }
    
    // Check if user is LGU type
    if (user.type !== 'lgu' && user.role !== 'lgu' && user.role !== 'admin') {
      return null;
    }
    
    return { username: user.email, type: user.type || user.role };
  } catch (error) {
    console.error('Error checking auth:', error);
    return null;
  }
}

// Initialize insights with real data analysis
async function initializeInsights() {
  try {
    console.log('Initializing intelligent insights...');
    
    // Fetch real complaint data
    const complaints = await fetchComplaints();
    if (!complaints || complaints.length === 0) {
      showEmptyState();
      return;
    }
    
    // Analyze data and generate insights
    const insights = await analyzeComplaintData(complaints);
    
    // Initialize charts with real data
    initializeCharts(insights);
    
    // Generate and display intelligent recommendations
    generateIntelligentRecommendations(insights);
    
    // Update KPIs with real metrics
    updateKPIs(insights);
    
  } catch (error) {
    console.error('Error initializing insights:', error);
    showToast('Error loading insights data', 'error');
  }
}

// Fetch complaints from Supabase
async function fetchComplaints() {
  try {
    if (window.getComplaints) {
      const complaints = await window.getComplaints();
      console.log('📊 Fetched complaints from Supabase:', complaints);
      
      // Debug: Check data structure
      if (complaints && complaints.length > 0) {
        console.log('🔍 First complaint fields:', Object.keys(complaints[0]));
        console.log('🔍 Sample complaint data:', complaints[0]);
        
        // Check for resolution time data
        const resolvedComplaints = complaints.filter(c => c.status === 'resolved' || c.status === 'closed');
        console.log('✅ Resolved complaints:', resolvedComplaints.length);
        
        // Check for satisfaction data
        const satisfactionData = complaints.filter(c => c.satisfaction_score);
        console.log('⭐ Complaints with satisfaction scores:', satisfactionData.length);
        
        // Check for category data
        const categoryData = complaints.filter(c => c.type || c.category);
        console.log('🏷️ Complaints with category data:', categoryData.length);
      }
      
      return complaints;
    } else {
      console.log('⚠️ getComplaints function not available, using mock data');
      return getMockComplaints();
    }
  } catch (error) {
    console.error('❌ Error fetching complaints:', error);
    return getMockComplaints();
  }
}

// Intelligent data analysis using statistical methods
async function analyzeComplaintData(complaints) {
  console.log('Analyzing complaint data...', complaints.length, 'complaints');
  
  // Debug: Log first few complaints to see structure
  if (complaints.length > 0) {
    console.log('Sample complaint structure:', complaints[0]);
    console.log('Available fields:', Object.keys(complaints[0]));
    
    // Check for required fields
    const requiredFields = ['created_at', 'status'];
    const missingFields = requiredFields.filter(field => !complaints[0].hasOwnProperty(field));
    if (missingFields.length > 0) {
      console.warn('Missing required fields:', missingFields);
    }
  }
  
  try {
    const analysis = {
      trends: analyzeTrends(complaints),
      categories: analyzeCategories(complaints),
      resolution: analyzeResolutionTimes(complaints),
      locations: analyzeLocationPatterns(complaints),
      satisfaction: analyzeSatisfaction(complaints),
      anomalies: detectAnomalies(complaints)
    };
    
    console.log('Analysis complete:', analysis);
    return analysis;
  } catch (error) {
    console.error('Error during analysis:', error);
    // Return default structure if analysis fails
    return {
      trends: { labels: [], values: [] },
      categories: { topCategories: [], concerningCategories: [] },
      resolution: { avgResolutionTime: 0, categoryResolutionTimes: {} },
      locations: { problemAreas: [] },
      satisfaction: { avgSatisfaction: 0, lowSatisfactionCategories: [] },
      anomalies: []
    };
  }
}

// Analyze complaint trends over time
function analyzeTrends(complaints) {
  const monthlyData = {};
  const currentDate = new Date();
  
  complaints.forEach(complaint => {
    const complaintDate = new Date(complaint.created_at);
    const monthKey = `${complaintDate.getFullYear()}-${String(complaintDate.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = 0;
    }
    monthlyData[monthKey]++;
  });
  
  // Calculate trend direction and percentage change
  const months = Object.keys(monthlyData).sort();
  const recentMonths = months.slice(-3);
  const olderMonths = months.slice(-6, -3);
  
  let trendDirection = 'stable';
  let percentageChange = 0;
  
  if (recentMonths.length > 0 && olderMonths.length > 0) {
    const recentAvg = recentMonths.reduce((sum, month) => sum + monthlyData[month], 0) / recentMonths.length;
    const olderAvg = olderMonths.reduce((sum, month) => sum + monthlyData[month], 0) / olderMonths.length;
    
    if (olderAvg > 0) {
      percentageChange = ((recentAvg - olderAvg) / olderAvg) * 100;
      trendDirection = percentageChange > 5 ? 'increasing' : percentageChange < -5 ? 'decreasing' : 'stable';
    }
  }
  
  return {
    monthlyData,
    trendDirection,
    percentageChange: Math.abs(percentageChange),
    labels: months.map(month => {
      const [year, monthNum] = month.split('-');
      const date = new Date(parseInt(year), parseInt(monthNum) - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }),
    values: months.map(month => monthlyData[month])
  };
}

// Analyze complaint categories and identify hotspots
function analyzeCategories(complaints) {
  const categoryCounts = {};
  const subcategoryCounts = {};
  
  complaints.forEach(complaint => {
    // Count main categories - use 'type' field from database
    const category = complaint.type || complaint.category || 'Uncategorized';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    
    // Count subcategories
    const subcategory = complaint.subcategory || 'General';
    const key = `${category}:${subcategory}`;
    subcategoryCounts[key] = (subcategoryCounts[key] || 0) + 1;
  });
  
  // Find top categories and identify concerning trends
  const topCategories = Object.entries(categoryCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  const concerningCategories = Object.entries(categoryCounts)
    .filter(([,count]) => count > complaints.length * 0.1) // More than 10% of total
    .map(([category, count]) => ({
      category,
      count,
      percentage: (count / complaints.length * 100).toFixed(1)
    }));
  
  return {
    categoryCounts,
    subcategoryCounts,
    topCategories,
    concerningCategories,
    totalComplaints: complaints.length
  };
}

// Analyze resolution times and identify bottlenecks
function analyzeResolutionTimes(complaints) {
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved' || c.status === 'closed');
  const resolutionTimes = [];
  
  resolvedComplaints.forEach(complaint => {
    if (complaint.created_at && complaint.resolved_at) {
      const created = new Date(complaint.created_at);
      const resolved = new Date(complaint.resolved_at);
      const daysToResolve = (resolved - created) / (1000 * 60 * 60 * 24);
      resolutionTimes.push(daysToResolve);
    }
  });
  
  // Calculate statistics
  const avgResolutionTime = resolutionTimes.length > 0 
    ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length 
    : 0;
  
  const medianResolutionTime = resolutionTimes.length > 0
    ? resolutionTimes.sort((a, b) => a - b)[Math.floor(resolutionTimes.length / 2)]
    : 0;
  
  // Identify slow categories
  const categoryResolutionTimes = {};
  resolvedComplaints.forEach(complaint => {
    if (complaint.created_at && complaint.resolved_at) {
      const category = complaint.type || complaint.category || 'Uncategorized';
      if (!categoryResolutionTimes[category]) {
        categoryResolutionTimes[category] = [];
      }
      
      const created = new Date(complaint.created_at);
      const resolved = new Date(complaint.resolved_at);
      const daysToResolve = (resolved - created) / (1000 * 60 * 60 * 24);
      categoryResolutionTimes[category].push(daysToResolve);
    }
  });
  
  const slowCategories = Object.entries(categoryResolutionTimes)
    .map(([category, times]) => ({
      category,
      avgTime: times.reduce((sum, time) => sum + time, 0) / times.length
    }))
    .filter(item => item.avgTime > avgResolutionTime * 1.5) // 50% slower than average
    .sort((a, b) => b.avgTime - a.avgTime);
  
  return {
    avgResolutionTime: avgResolutionTime.toFixed(1),
    medianResolutionTime: medianResolutionTime.toFixed(1),
    categoryResolutionTimes,
    slowCategories,
    totalResolved: resolvedComplaints.length
  };
}

// Analyze location patterns and identify problem areas
function analyzeLocationPatterns(complaints) {
  const locationCounts = {};
  const locationCategories = {};
  
  complaints.forEach(complaint => {
    const location = complaint.location || 'Unknown Location';
    locationCounts[location] = (locationCounts[location] || 0) + 1;
    
    if (!locationCategories[location]) {
      locationCategories[location] = {};
    }
    
    // Use 'type' field for category, fallback to 'category'
    const category = complaint.type || complaint.category || 'Uncategorized';
    locationCategories[location][category] = (locationCategories[location][category] || 0) + 1;
  });
  
  // Find problem areas (locations with high complaint counts)
  const problemAreas = Object.entries(locationCounts)
    .filter(([,count]) => count > complaints.length * 0.05) // More than 5% of total
    .map(([location, count]) => ({
      location,
      count,
      percentage: (count / complaints.length * 100).toFixed(1),
      topCategory: Object.entries(locationCategories[location] || {})
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown'
    }))
    .sort((a, b) => b.count - a.count);
  
  return {
    locationCounts,
    locationCategories,
    problemAreas,
    totalLocations: Object.keys(locationCounts).length
  };
}

// Analyze satisfaction scores and identify improvement areas
function analyzeSatisfaction(complaints) {
  const satisfactionScores = complaints
    .filter(c => c.satisfaction_score)
    .map(c => parseFloat(c.satisfaction_score));
  
  const avgSatisfaction = satisfactionScores.length > 0
    ? satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length
    : 0;
  
  // Find categories with low satisfaction
  const categorySatisfaction = {};
  complaints.forEach(complaint => {
    if (complaint.satisfaction_score) {
      const category = complaint.type || complaint.category || 'Uncategorized';
      if (!categorySatisfaction[category]) {
        categorySatisfaction[category] = [];
      }
      categorySatisfaction[category].push(parseFloat(complaint.satisfaction_score));
    }
  });
  
  const lowSatisfactionCategories = Object.entries(categorySatisfaction)
    .map(([category, scores]) => ({
      category,
      avgScore: scores.reduce((sum, score) => sum + score, 0) / scores.length
    }))
    .filter(item => item.avgScore < avgSatisfaction * 0.8) // 20% below average
    .sort((a, b) => a.avgScore - b.avgScore);
  
  return {
    avgSatisfaction: avgSatisfaction.toFixed(1),
    totalSatisfactionScores: satisfactionScores.length,
    categorySatisfaction,
    lowSatisfactionCategories
  };
}

// Detect anomalies and unusual patterns
function detectAnomalies(complaints) {
  const anomalies = [];
  
  // Detect sudden spikes in complaints
  const dailyCounts = {};
  complaints.forEach(complaint => {
    const date = new Date(complaint.created_at).toDateString();
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
  });
  
  const dailyValues = Object.values(dailyCounts);
  const avgDaily = dailyValues.reduce((sum, count) => sum + count, 0) / dailyValues.length;
  const stdDev = Math.sqrt(dailyValues.reduce((sum, count) => sum + Math.pow(count - avgDaily, 2), 0) / dailyValues.length);
  
  Object.entries(dailyCounts).forEach(([date, count]) => {
    if (count > avgDaily + (stdDev * 2)) { // 2 standard deviations above mean
      anomalies.push({
        type: 'spike',
        date,
        count,
        normalRange: `${Math.round(avgDaily - stdDev)}-${Math.round(avgDaily + stdDev)}`,
        severity: count > avgDaily + (stdDev * 3) ? 'high' : 'medium'
      });
    }
  });
  
  // Detect unusual category combinations
  const categoryCombinations = {};
  complaints.forEach(complaint => {
    const location = complaint.location || 'Unknown';
    const category = complaint.type || complaint.category || 'Unknown';
    const key = `${location}:${category}`;
    categoryCombinations[key] = (categoryCombinations[key] || 0) + 1;
  });
  
  const avgCombinationCount = Object.values(categoryCombinations).reduce((sum, count) => sum + count, 0) / Object.values(categoryCombinations).length;
  
  Object.entries(categoryCombinations).forEach(([combination, count]) => {
    if (count > avgCombinationCount * 2) { // Twice the average
      const [location, category] = combination.split(':');
      anomalies.push({
        type: 'hotspot',
        location,
        category,
        count,
        normalRange: Math.round(avgCombinationCount),
        severity: count > avgCombinationCount * 3 ? 'high' : 'medium'
      });
    }
  });
  
  return anomalies;
}

// Initialize charts with real data
function initializeCharts(insights) {
  console.log('Initializing charts with insights:', insights);
  
  // Complaint trends chart
  const trendsCtx = document.getElementById('trends-chart');
  if (trendsCtx && insights.trends && insights.trends.labels && insights.trends.values) {
    console.log('Creating trends chart with data:', insights.trends);
    new Chart(trendsCtx.getContext('2d'), {
    type: 'line',
    data: {
        labels: insights.trends.labels,
      datasets: [{
        label: 'Complaints',
          data: insights.trends.values,
        fill: false,
        borderColor: '#3b82f6',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
            ticks: { precision: 0 }
        }
      }
    }
  });
  } else {
    console.warn('Trends chart data missing or invalid:', insights.trends);
  }
  
  // Resolution time chart
  const resolutionTimeCtx = document.getElementById('resolution-time-chart');
  if (resolutionTimeCtx && insights.resolution && insights.resolution.categoryResolutionTimes) {
    const categories = Object.keys(insights.resolution.categoryResolutionTimes);
    if (categories.length > 0) {
      const avgTimes = categories.map(cat => {
        const times = insights.resolution.categoryResolutionTimes[cat];
        return times.reduce((sum, time) => sum + time, 0) / times.length;
      });
      
      console.log('Creating resolution time chart with data:', { categories, avgTimes });
      new Chart(resolutionTimeCtx.getContext('2d'), {
    type: 'bar',
    data: {
          labels: categories,
      datasets: [{
        label: 'Average Days to Resolve',
            data: avgTimes.map(time => time.toFixed(1)),
        backgroundColor: '#10b981'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
              title: { display: true, text: 'Days' }
        }
      }
    }
  });
    } else {
      console.warn('No resolution time data available');
    }
  } else {
    console.warn('Resolution time chart data missing or invalid:', insights.resolution);
  }
  
  // Categories chart
  const categoriesCtx = document.getElementById('categories-chart');
  if (categoriesCtx && insights.categories && insights.categories.topCategories) {
    const topCategories = insights.categories.topCategories;
    if (topCategories.length > 0) {
      console.log('Creating categories chart with data:', topCategories);
      new Chart(categoriesCtx.getContext('2d'), {
    type: 'pie',
    data: {
          labels: topCategories.map(([category]) => category),
      datasets: [{
            data: topCategories.map(([,count]) => count),
        backgroundColor: [
              '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'
        ]
      }]
    },
    options: {
      responsive: true,
          maintainAspectRatio: false
        }
      });
    } else {
      console.warn('No category data available');
    }
  } else {
    console.warn('Categories chart data missing or invalid:', insights.categories);
  }
  
  // Satisfaction chart
  const satisfactionCtx = document.getElementById('satisfaction-chart');
  if (satisfactionCtx && insights.satisfaction && insights.satisfaction.lowSatisfactionCategories) {
    const lowSatisfaction = insights.satisfaction.lowSatisfactionCategories;
    if (lowSatisfaction.length > 0) {
      console.log('Creating satisfaction chart with data:', lowSatisfaction);
      new Chart(satisfactionCtx.getContext('2d'), {
        type: 'doughnut',
    data: {
          labels: lowSatisfaction.map(item => item.category),
      datasets: [{
            data: lowSatisfaction.map(item => item.avgScore),
            backgroundColor: [
              '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'
            ]
      }]
    },
    options: {
      responsive: true,
          maintainAspectRatio: false
        }
      });
    } else {
      console.warn('No satisfaction data available');
    }
  } else {
    console.warn('Satisfaction chart data missing or invalid:', insights.satisfaction);
  }
}

// Generate intelligent recommendations based on real data analysis
function generateIntelligentRecommendations(insights) {
  const recommendationsContainer = document.querySelector('.recommendations-list');
  if (!recommendationsContainer) return;
  
  recommendationsContainer.innerHTML = '';
  
  const recommendations = [];
  
  // Validate insights structure
  if (!insights || !insights.categories) {
    console.warn('Invalid insights structure for recommendations');
    return;
  }
  
  // 1. High-priority recommendations based on concerning categories
  if (insights.categories.concerningCategories && insights.categories.concerningCategories.length > 0) {
    insights.categories.concerningCategories.forEach(item => {
    recommendations.push({
      priority: 'high',
      title: `${item.category} Issue Management`,
      description: `Address the ${item.percentage}% of complaints in ${item.category} category. This represents a significant portion of total complaints and requires immediate attention.`,
      impact: 'High Impact',
      cost: 'Medium Cost',
      icon: 'fas fa-exclamation-circle',
      metrics: [
        { label: 'Complaint Volume', value: `${item.count} complaints` },
        { label: 'Percentage', value: `${item.percentage}% of total` }
      ]
    });
  });
  
  }
  
  // 2. Resolution time improvements
  if (insights.resolution && insights.resolution.slowCategories && insights.resolution.slowCategories.length > 0) {
    insights.resolution.slowCategories.forEach(item => {
    recommendations.push({
      priority: 'medium',
      title: `${item.category} Resolution Optimization`,
      description: `Improve response times for ${item.category} complaints. Current average resolution time is ${item.avgTime.toFixed(1)} days, which is significantly above the overall average.`,
      impact: 'Medium Impact',
      cost: 'Low Cost',
      icon: 'fas fa-clock',
      metrics: [
        { label: 'Current Avg Time', value: `${item.avgTime.toFixed(1)} days` },
        { label: 'Target', value: `${(item.avgTime * 0.7).toFixed(1)} days` }
      ]
    });
  });
  
  }
  
  // 3. Location-based recommendations
  if (insights.locations && insights.locations.problemAreas && insights.locations.problemAreas.length > 0) {
    insights.locations.problemAreas.slice(0, 3).forEach(item => {
    recommendations.push({
      priority: 'medium',
      title: `${item.location} Area Focus`,
      description: `Concentrate resources in ${item.location} area. ${item.percentage}% of complaints originate from this location, with ${item.topCategory} being the most common issue.`,
      impact: 'Medium Impact',
      cost: 'Medium Cost',
      icon: 'fas fa-map-marker-alt',
      metrics: [
        { label: 'Location', value: item.location },
        { label: 'Top Issue', value: item.topCategory }
      ]
    });
  });
  
  }
  
  // 4. Satisfaction improvements
  if (insights.satisfaction && insights.satisfaction.lowSatisfactionCategories && insights.satisfaction.lowSatisfactionCategories.length > 0) {
    insights.satisfaction.lowSatisfactionCategories.slice(0, 2).forEach(item => {
    recommendations.push({
      priority: 'low',
      title: `${item.category} Service Enhancement`,
      description: `Improve citizen satisfaction for ${item.category} services. Current average satisfaction score is ${item.avgScore}/5, below the overall average.`,
      impact: 'Low Impact',
      cost: 'Low Cost',
      icon: 'fas fa-star',
      metrics: [
        { label: 'Current Score', value: `${item.avgScore}/5` },
        { label: 'Target', value: '4.0/5' }
      ]
    });
  });
  
  }
  
  // 5. Anomaly-based recommendations
  if (insights.anomalies && insights.anomalies.length > 0) {
    insights.anomalies.slice(0, 2).forEach(anomaly => {
    if (anomaly.type === 'spike') {
      recommendations.push({
        priority: anomaly.severity === 'high' ? 'high' : 'medium',
        title: 'Unusual Complaint Spike',
        description: `Investigate the unusual spike of ${anomaly.count} complaints on ${anomaly.date}. This is significantly above the normal range of ${anomaly.normalRange} complaints per day.`,
        impact: anomaly.severity === 'high' ? 'High Impact' : 'Medium Impact',
        cost: 'Low Cost',
        icon: 'fas fa-chart-line',
        metrics: [
          { label: 'Spike Date', value: anomaly.date },
          { label: 'Normal Range', value: anomaly.normalRange }
        ]
      });
    } else if (anomaly.type === 'hotspot') {
      recommendations.push({
        priority: anomaly.severity === 'high' ? 'high' : 'medium',
        title: `${anomaly.location} ${anomaly.category} Hotspot`,
        description: `Address the concentrated ${anomaly.category} issues in ${anomaly.location}. This area has ${anomaly.count} complaints, well above the normal average of ${anomaly.normalRange}.`,
        impact: anomaly.severity === 'high' ? 'High Impact' : 'Medium Impact',
        cost: 'Medium Cost',
        icon: 'fas fa-fire',
        metrics: [
          { label: 'Location', value: anomaly.location },
          { label: 'Issue Type', value: anomaly.category }
        ]
      });
    }
  });
  
  // Display recommendations
  if (recommendations.length > 0) {
    recommendations.forEach(rec => {
      const recElement = createRecommendationElement(rec);
      recommendationsContainer.appendChild(recElement);
    });
  } else {
    // Show fallback message
    const fallbackDiv = document.createElement('div');
    fallbackDiv.className = 'recommendation-item';
    fallbackDiv.innerHTML = `
      <div class="recommendation-icon low">
        <i class="fas fa-info-circle"></i>
      </div>
      <div class="recommendation-content">
        <h4>No Specific Recommendations Available</h4>
        <p>Based on the current data, no specific recommendations can be generated. This could be due to insufficient data, all metrics being within normal ranges, or data structure issues.</p>
        <div class="recommendation-metrics">
          <span class="metric">
            <i class="fas fa-chart-line"></i>
            Low Impact
          </span>
          <span class="metric">
            <i class="fas fa-coins"></i>
            No Cost
          </span>
        </div>
      </div>
    `;
    recommendationsContainer.appendChild(fallbackDiv);
  }
}

// Create recommendation element
function createRecommendationElement(recommendation) {
  const div = document.createElement('div');
  div.className = 'recommendation-item';
  
  div.innerHTML = `
    <div class="recommendation-icon ${recommendation.priority}">
      <i class="${recommendation.icon}"></i>
    </div>
    <div class="recommendation-content">
      <h4>${recommendation.title}</h4>
      <p>${recommendation.description}</p>
      <div class="recommendation-metrics">
        <span class="metric">
          <i class="fas fa-chart-line"></i>
          ${recommendation.impact}
        </span>
        <span class="metric">
          <i class="fas fa-coins"></i>
          ${recommendation.cost}
        </span>
      </div>
      <div class="recommendation-details">
        ${recommendation.metrics.map(metric => `
          <span class="detail-metric">
            <strong>${metric.label}:</strong> ${metric.value}
          </span>
        `).join('')}
      </div>
    </div>
  `;
  
  return div;
}

// Update KPIs with real metrics
function updateKPIs(insights) {
  console.log('Updating KPIs with insights:', insights);
  
  // Update response time KPI
  const responseTimeElement = document.querySelector('.kpi-value');
  if (responseTimeElement && insights.resolution && insights.resolution.avgResolutionTime) {
    responseTimeElement.textContent = `${insights.resolution.avgResolutionTime} days`;
    console.log('Updated response time KPI:', insights.resolution.avgResolutionTime);
  } else {
    console.warn('Response time KPI data missing');
  }
  
  // Update resolution rate KPI
  const resolutionRateElement = document.querySelectorAll('.kpi-value')[1];
  if (resolutionRateElement && insights.resolution && insights.categories) {
    const resolutionRate = (insights.resolution.totalResolved / insights.categories.totalComplaints * 100).toFixed(0);
    resolutionRateElement.textContent = `${resolutionRate}%`;
    console.log('Updated resolution rate KPI:', resolutionRate);
  } else {
    console.warn('Resolution rate KPI data missing');
  }
  
  // Update satisfaction KPI
  const satisfactionElement = document.querySelectorAll('.kpi-value')[3];
  if (satisfactionElement && insights.satisfaction && insights.satisfaction.avgSatisfaction) {
    satisfactionElement.textContent = `${insights.satisfaction.avgSatisfaction}/5`;
    console.log('Updated satisfaction KPI:', insights.satisfaction.avgSatisfaction);
  } else {
    console.warn('Satisfaction KPI data missing');
  }
}

// Setup date range filter
function setupDateRangeFilter() {
  const dateRangeSelect = document.getElementById('date-range');
  if (dateRangeSelect) {
    dateRangeSelect.addEventListener('change', async (event) => {
      const selectedRange = event.target.value;
      console.log('Date range changed to:', selectedRange);
      
      // Reload insights with new date range
      await initializeInsights();
    });
  }
}

// Show empty state when no data
function showEmptyState() {
  const mainContent = document.querySelector('.dashboard-main');
  if (mainContent) {
    mainContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-content">
          <div class="empty-state-icon">
            <i class="fas fa-chart-bar"></i>
          </div>
          <h3>No Data Available</h3>
          <p class="empty-state-description">No complaint data found to generate insights. Start collecting complaints to see intelligent recommendations.</p>
        </div>
      </div>
    `;
  }
}

// Mock data fallback
function getMockComplaints() {
  return [
    {
      id: 1,
      type: 'infrastructure',
      subcategory: 'Road Damage',
      location: 'Downtown',
      status: 'resolved',
      created_at: '2024-01-15T10:00:00Z',
      resolved_at: '2024-01-19T14:00:00Z',
      satisfaction_score: '4.2'
    },
    {
      id: 2,
      type: 'sanitation',
      subcategory: 'Garbage Collection',
      location: 'North District',
      status: 'resolved',
      created_at: '2024-01-16T09:00:00Z',
      resolved_at: '2024-01-18T11:00:00Z',
      satisfaction_score: '3.8'
    },
    {
      id: 3,
      type: 'infrastructure',
      subcategory: 'Street Lighting',
      location: 'East Residential',
      status: 'resolved',
      created_at: '2024-01-10T08:00:00Z',
      resolved_at: '2024-01-12T16:00:00Z',
      satisfaction_score: '4.5'
    },
    {
      id: 4,
      type: 'utilities',
      subcategory: 'Water Supply',
      location: 'West District',
      status: 'in_progress',
      created_at: '2024-01-20T14:00:00Z',
      satisfaction_score: '2.8'
    },
    {
      id: 5,
      type: 'public_safety',
      subcategory: 'Traffic Safety',
      location: 'Downtown',
      status: 'resolved',
      created_at: '2024-01-05T09:00:00Z',
      resolved_at: '2024-01-08T11:00:00Z',
      satisfaction_score: '4.0'
    },
    {
      id: 6,
      type: 'noise',
      subcategory: 'Construction Noise',
      location: 'South District',
      status: 'pending',
      created_at: '2024-01-22T07:00:00Z',
      satisfaction_score: '1.5'
    },
    {
      id: 7,
      type: 'infrastructure',
      subcategory: 'Sidewalk Problems',
      location: 'Downtown',
      status: 'resolved',
      created_at: '2024-01-12T15:00:00Z',
      resolved_at: '2024-01-15T10:00:00Z',
      satisfaction_score: '3.9'
    },
    {
      id: 8,
      type: 'sanitation',
      subcategory: 'Illegal Dumping',
      location: 'North District',
      status: 'in_progress',
      created_at: '2024-01-18T12:00:00Z',
      satisfaction_score: '3.2'
    }
  ];
}

// Toast notification function
function showToast(message, type = 'success') {
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    alert(`${type.toUpperCase()}: ${message}`);
  }
}

// Test function to verify insights system
async function testInsightsSystem() {
  console.log('🧪 Testing insights system...');
  
  try {
    // Test with mock data
    const testComplaints = getMockComplaints();
    console.log('Test complaints:', testComplaints);
    
    // Test analysis (this is async)
    const testInsights = await analyzeComplaintData(testComplaints);
    console.log('Test insights:', testInsights);
    
    // Test chart initialization
    initializeCharts(testInsights);
    
    // Test recommendations
    generateIntelligentRecommendations(testInsights);
    
    // Test KPI updates
    updateKPIs(testInsights);
    
    console.log('✅ Insights system test complete!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Make test function globally available
if (typeof window !== 'undefined') {
  window.testInsightsSystem = testInsightsSystem;
  
  // Add debug function to inspect real complaint data
  window.debugComplaintData = async () => {
    console.log('🔍 Debugging complaint data structure...');
    
    try {
      if (window.getComplaints) {
        const complaints = await window.getComplaints();
        console.log('📊 Total complaints:', complaints.length);
        
        if (complaints && complaints.length > 0) {
          const sample = complaints[0];
          console.log('🔍 Sample complaint structure:', sample);
          console.log('🔍 Available fields:', Object.keys(sample));
          
          // Check specific fields
          const fieldChecks = [
            'created_at', 'resolved_at', 'status', 'type', 'category', 
            'subcategory', 'location', 'satisfaction_score'
          ];
          
          fieldChecks.forEach(field => {
            const hasField = sample.hasOwnProperty(field);
            const value = sample[field];
            console.log(`${hasField ? '✅' : '❌'} ${field}:`, value);
          });
          
          // Check for resolution time data
          const resolved = complaints.filter(c => c.status === 'resolved' || c.status === 'closed');
          const withDates = resolved.filter(c => c.created_at && c.resolved_at);
          console.log('📅 Resolved complaints:', resolved.length);
          console.log('📅 With both dates:', withDates.length);
          
          // Check for satisfaction data
          const withSatisfaction = complaints.filter(c => c.satisfaction_score);
          console.log('⭐ With satisfaction scores:', withSatisfaction.length);
          
          // Check for category data
          const withCategory = complaints.filter(c => c.type || c.category);
          console.log('🏷️ With category data:', withCategory.length);
          
          // Suggest fixes
          if (withDates.length === 0) {
            console.warn('⚠️ No complaints have both created_at and resolved_at dates');
            console.warn('💡 Add resolved_at timestamps when complaints are resolved');
          }
          
          if (withSatisfaction.length === 0) {
            console.warn('⚠️ No complaints have satisfaction scores');
            console.warn('💡 Add satisfaction_score field when complaints are resolved');
          }
          
          if (withCategory.length === 0) {
            console.warn('⚠️ No complaints have category/type data');
            console.warn('💡 Ensure complaints have type or category field');
          }
        }
      } else {
        console.log('⚠️ getComplaints function not available');
      }
    } catch (error) {
      console.error('❌ Debug failed:', error);
    }
  };
}

