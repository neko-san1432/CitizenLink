// Complaint status enum
const ComplaintStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved'
};

// Complaint type enum
const ComplaintType = {
  INFRASTRUCTURE: 'infrastructure',
  PUBLIC_SAFETY: 'public_safety',
  SANITATION: 'sanitation',
  UTILITIES: 'utilities',
  NOISE: 'noise',
  OTHER: 'other'
};

// Government unit enum
const GovernmentUnit = {
  CITY_HALL: 'city_hall',
  POLICE: 'police',
  FIRE: 'fire',
  PUBLIC_WORKS: 'public_works',
  WASTE: 'waste',
  HEALTH: 'health'
};

// Subcategories by complaint type
const subcategories = {
  [ComplaintType.INFRASTRUCTURE]: [
    'Road Damage', 
    'Bridge Issues', 
    'Sidewalk Problems', 
    'Street Lighting', 
    'Public Building'
  ],
  [ComplaintType.PUBLIC_SAFETY]: [
    'Crime Report', 
    'Traffic Violation', 
    'Suspicious Activity', 
    'Abandoned Vehicle', 
    'Public Disturbance'
  ],
  [ComplaintType.SANITATION]: [
    'Garbage Collection', 
    'Illegal Dumping', 
    'Sewage Issues', 
    'Public Restroom', 
    'Pest Control'
  ],
  [ComplaintType.UTILITIES]: [
    'Water Supply', 
    'Electricity Issues', 
    'Gas Leaks', 
    'Internet/Telecom', 
    'Drainage Problems'
  ],
  [ComplaintType.NOISE]: [
    'Construction Noise', 
    'Traffic Noise', 
    'Loud Music', 
    'Industrial Noise', 
    'Nighttime Disturbance'
  ],
  [ComplaintType.OTHER]: [
    'General Inquiry', 
    'Feedback', 
    'Suggestion', 
    'Commendation', 
    'Other'
  ]
};

// Government unit names
const governmentUnitNames = {
  [GovernmentUnit.CITY_HALL]: 'City Hall',
  [GovernmentUnit.POLICE]: 'Police Department (PNP)',
  [GovernmentUnit.FIRE]: 'Fire Department (BFP)',
  [GovernmentUnit.PUBLIC_WORKS]: 'Public Works (DPWH)',
  [GovernmentUnit.WASTE]: 'Waste Management',
  [GovernmentUnit.HEALTH]: 'Health Department'
};

// Sample complaints data
const sampleComplaints = [
  {
    id: 'CP001',
    userId: 'citizen-user',
    title: 'Pothole on Main Street',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Road Damage',
    description: 'There is a large pothole on Main Street near the intersection with Oak Avenue. It\'s causing damage to vehicles and is a safety hazard.',
    location: '123 Main Street, near Oak Avenue intersection',
    urgency: 'high',
    status: ComplaintStatus.RESOLVED,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    assignedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-01-05T10:30:00',
    updatedAt: '2025-01-08T14:15:00',
    resolvedAt: '2025-01-15T09:45:00',
    timeline: [
      {
        date: '2025-01-05T10:30:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-01-08T14:15:00',
        action: 'Assigned to Public Works Department',
        actor: 'Admin User'
      },
      {
        date: '2025-01-10T11:20:00',
        action: 'Inspection completed',
        actor: 'Public Works Department'
      },
      {
        date: '2025-01-15T09:45:00',
        action: 'Pothole repaired',
        actor: 'Public Works Department'
      }
    ]
  },
  {
    id: 'CP002',
    userId: 'citizen-user',
    title: 'Streetlight Out',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Street Lighting',
    description: 'The streetlight at the corner of Pine Street and Elm Road has been out for over a week, making the area very dark and unsafe at night.',
    location: 'Corner of Pine Street and Elm Road',
    urgency: 'medium',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    assignedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-01-10T18:45:00',
    updatedAt: '2025-01-12T09:30:00',
    timeline: [
      {
        date: '2025-01-10T18:45:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-01-12T09:30:00',
        action: 'Assigned to Public Works Department',
        actor: 'Admin User'
      },
      {
        date: '2025-01-14T13:15:00',
        action: 'Inspection scheduled for tomorrow',
        actor: 'Public Works Department'
      }
    ]
  },
  {
    id: 'CP003',
    userId: 'citizen-user',
    title: 'Missed Garbage Collection',
    type: ComplaintType.SANITATION,
    subcategory: 'Garbage Collection',
    description: 'Our garbage hasn\'t been collected for two weeks on Cedar Avenue. The bins are overflowing and causing a health hazard.',
    location: '456 Cedar Avenue',
    urgency: 'high',
    status: ComplaintStatus.RESOLVED,
    suggestedUnit: GovernmentUnit.WASTE,
    assignedUnit: GovernmentUnit.WASTE,
    createdAt: '2025-01-15T08:20:00',
    updatedAt: '2025-01-15T10:45:00',
    resolvedAt: '2025-01-16T14:30:00',
    timeline: [
      {
        date: '2025-01-15T08:20:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-01-15T10:45:00',
        action: 'Assigned to Waste Management',
        actor: 'Admin User'
      },
      {
        date: '2025-01-16T14:30:00',
        action: 'Garbage collected',
        actor: 'Waste Management'
      }
    ]
  },
  {
    id: 'CP004',
    userId: 'citizen-user',
    title: 'Noise Complaint - Construction',
    type: ComplaintType.NOISE,
    subcategory: 'Construction Noise',
    description: 'Construction at 789 Maple Drive is starting at 5:30 AM, well before the allowed hours. The noise is waking up the entire neighborhood.',
    location: '789 Maple Drive',
    urgency: 'medium',
    status: ComplaintStatus.PENDING,
    suggestedUnit: GovernmentUnit.CITY_HALL,
    createdAt: '2025-01-20T06:15:00',
    updatedAt: '2025-01-20T06:15:00',
    timeline: [
      {
        date: '2025-01-20T06:15:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      }
    ]
  },
  {
    id: 'CP005',
    userId: 'other-user',
    title: 'Water Main Break',
    type: ComplaintType.UTILITIES,
    subcategory: 'Water Supply',
    description: 'There is a major water main break on Birch Street. Water is flooding the road and several homes are without water service.',
    location: '200 Block of Birch Street',
    urgency: 'emergency',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    assignedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-01-22T15:30:00',
    updatedAt: '2025-01-22T15:45:00',
    timeline: [
      {
        date: '2025-01-22T15:30:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      },
      {
        date: '2025-01-22T15:45:00',
        action: 'Assigned to Public Works Department',
        actor: 'Admin User'
      },
      {
        date: '2025-01-22T16:00:00',
        action: 'Emergency response team dispatched',
        actor: 'Public Works Department'
      }
    ]
  },
  {
    id: 'CP006',
    userId: 'other-user',
    title: 'Suspicious Activity',
    type: ComplaintType.PUBLIC_SAFETY,
    subcategory: 'Suspicious Activity',
    description: 'There have been suspicious individuals loitering around Oak Elementary School after hours for the past few nights.',
    location: 'Oak Elementary School, 300 School Road',
    urgency: 'high',
    status: ComplaintStatus.RESOLVED,
    suggestedUnit: GovernmentUnit.POLICE,
    assignedUnit: GovernmentUnit.POLICE,
    createdAt: '2025-01-18T22:10:00',
    updatedAt: '2025-01-19T00:30:00',
    resolvedAt: '2025-01-21T10:15:00',
    timeline: [
      {
        date: '2025-01-18T22:10:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      },
      {
        date: '2025-01-19T00:30:00',
        action: 'Assigned to Police Department',
        actor: 'Admin User'
      },
      {
        date: '2025-01-19T01:15:00',
        action: 'Officers dispatched to location',
        actor: 'Police Department'
      },
      {
        date: '2025-01-21T10:15:00',
        action: 'Increased patrols implemented, no further suspicious activity reported',
        actor: 'Police Department'
      }
    ]
  },
  {
    id: 'CP007',
    userId: 'citizen-user',
    title: 'Illegal Dumping',
    type: ComplaintType.SANITATION,
    subcategory: 'Illegal Dumping',
    description: 'Someone has been dumping construction waste in the vacant lot at the end of Willow Lane. There\'s a large pile of debris that\'s growing daily.',
    location: 'Vacant lot at the end of Willow Lane',
    urgency: 'medium',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.WASTE,
    assignedUnit: GovernmentUnit.WASTE,
    createdAt: '2025-01-25T14:20:00',
    updatedAt: '2025-01-26T09:10:00',
    timeline: [
      {
        date: '2025-01-25T14:20:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-01-26T09:10:00',
        action: 'Assigned to Waste Management',
        actor: 'Admin User'
      },
      {
        date: '2025-01-27T11:30:00',
        action: 'Investigation initiated',
        actor: 'Waste Management'
      }
    ]
  },
  {
    id: 'CP008',
    userId: 'other-user',
    title: 'Broken Sidewalk',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Sidewalk Problems',
    description: 'The sidewalk on Cherry Street between 5th and 6th Avenue is severely cracked and uneven, creating a tripping hazard for pedestrians.',
    location: 'Cherry Street between 5th and 6th Avenue',
    urgency: 'medium',
    status: ComplaintStatus.PENDING,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-01-28T16:45:00',
    updatedAt: '2025-01-28T16:45:00',
    timeline: [
      {
        date: '2025-01-28T16:45:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      }
    ]
  }
];

// Initialize complaints in localStorage if not already present
function initializeComplaints() {
  if (!localStorage.getItem('complaints')) {
    localStorage.setItem('complaints', JSON.stringify(sampleComplaints));
  }
}

// Get all complaints
function getComplaints() {
  initializeComplaints();
  return JSON.parse(localStorage.getItem('complaints')) || [];
}

// Get complaint by ID
function getComplaintById(id) {
  const complaints = getComplaints();
  return complaints.find(complaint => complaint.id === id);
}

// Get complaints by user ID
function getComplaintsByUserId(userId) {
  const complaints = getComplaints();
  return complaints.filter(complaint => complaint.userId === userId);
}

// Add new complaint
function addComplaint(complaint) {
  const complaints = getComplaints();
  
  // Generate a new ID
  const newId = `CP${String(complaints.length + 1).padStart(3, '0')}`;
  
  // Create new complaint object
  const newComplaint = {
    ...complaint,
    id: newId,
    status: ComplaintStatus.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [
      {
        date: new Date().toISOString(),
        action: 'Complaint submitted',
        actor: complaint.userName || 'Citizen'
      }
    ]
  };
  
  // Add to complaints array
  complaints.push(newComplaint);
  
  // Save to localStorage
  localStorage.setItem('complaints', JSON.stringify(complaints));
  
  return newComplaint;
}

// Update complaint
function updateComplaint(id, updates) {
  const complaints = getComplaints();
  const index = complaints.findIndex(complaint => complaint.id === id);
  
  if (index !== -1) {
    // Update the complaint
    const updatedComplaint = {
      ...complaints[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Add timeline entry if status changed
    if (updates.status && updates.status !== complaints[index].status) {
      const timelineEntry = {
        date: new Date().toISOString(),
        action: getStatusChangeAction(updates.status, updates.assignedUnit),
        actor: updates.actor || 'Admin User'
      };
      
      updatedComplaint.timeline = [...updatedComplaint.timeline, timelineEntry];
      
      // Set resolvedAt if status is RESOLVED
      if (updates.status === ComplaintStatus.RESOLVED) {
        updatedComplaint.resolvedAt = new Date().toISOString();
      }
    }
    
    // Add timeline entry if assigned unit changed
    if (updates.assignedUnit && updates.assignedUnit !== complaints[index].assignedUnit) {
      const timelineEntry = {
        date: new Date().toISOString(),
        action: `Assigned to ${governmentUnitNames[updates.assignedUnit]}`,
        actor: updates.actor || 'Admin User'
      };
      
      // Avoid duplicate entries
      if (!updatedComplaint.timeline.some(entry => 
        entry.action === timelineEntry.action && 
        new Date(entry.date).toDateString() === new Date(timelineEntry.date).toDateString()
      )) {
        updatedComplaint.timeline = [...updatedComplaint.timeline, timelineEntry];
      }
    }
    
    complaints[index] = updatedComplaint;
    localStorage.setItem('complaints', JSON.stringify(complaints));
    
    return updatedComplaint;
  }
  
  return null;
}

// Helper function to get status change action text
function getStatusChangeAction(status, assignedUnit) {
  switch (status) {
    case ComplaintStatus.IN_PROGRESS:
      return `Complaint processing started${assignedUnit ? ` by ${governmentUnitNames[assignedUnit]}` : ''}`;
    case ComplaintStatus.RESOLVED:
      return `Complaint resolved${assignedUnit ? ` by ${governmentUnitNames[assignedUnit]}` : ''}`;
    default:
      return `Status changed to ${status}`;
  }
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Format date and time for display
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Calculate time difference in hours
function getHoursDifference(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  return Math.round(diffMs / (1000 * 60 * 60));
}