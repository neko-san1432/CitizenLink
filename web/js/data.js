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
    'Public Building',
    'Traffic Control',
    'Drainage Problems'
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
    coordinates: [6.75200, 125.35800],
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
    coordinates: [6.74850, 125.35500],
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
    coordinates: [6.74000, 125.34000],
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
    coordinates: [6.75500, 125.36500],
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
    coordinates: [6.76000, 125.35000],
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
    coordinates: [6.73000, 125.34500],
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
    coordinates: [6.73800, 125.33800],
    timeline: [
      {
        date: '2025-01-28T16:45:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      }
    ]
  },
  {
    id: 'CP009',
    userId: 'citizen-user',
    title: 'Traffic Light Malfunction',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Traffic Control',
    description: 'The traffic light at the intersection of Main Street and Highway 26 is not working properly. It\'s causing traffic congestion and safety hazards.',
    location: 'Intersection of Main Street and Highway 26',
    urgency: 'high',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    assignedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-01-29T08:15:00',
    updatedAt: '2025-01-29T09:00:00',
    coordinates: [6.74500, 125.36000],
    timeline: [
      {
        date: '2025-01-29T08:15:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-01-29T09:00:00',
        action: 'Assigned to Public Works Department',
        actor: 'Admin User'
      }
    ]
  },
  {
    id: 'CP010',
    userId: 'other-user',
    title: 'Street Flooding',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Drainage Problems',
    description: 'Heavy rain caused flooding on Oak Street between 3rd and 4th Avenue. The drainage system seems to be blocked.',
    location: 'Oak Street between 3rd and 4th Avenue',
    urgency: 'medium',
    status: ComplaintStatus.PENDING,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-01-30T14:30:00',
    updatedAt: '2025-01-30T14:30:00',
    coordinates: [6.73500, 125.35000],
    timeline: [
      {
        date: '2025-01-30T14:30:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      }
    ]
  },
  {
    id: 'CP011',
    userId: 'citizen-user',
    title: 'Broken Park Bench',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Public Amenities',
    description: 'One of the park benches in Central Park is broken and unsafe to sit on. The wood is splintered and the metal frame is bent.',
    location: 'Central Park, near the fountain',
    urgency: 'low',
    status: ComplaintStatus.PENDING,
    suggestedUnit: GovernmentUnit.CITY_HALL,
    createdAt: '2025-02-01T09:20:00',
    updatedAt: '2025-02-01T09:20:00',
    coordinates: [6.75000, 125.34500],
    timeline: [
      {
        date: '2025-02-01T09:20:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      }
    ]
  },
  {
    id: 'CP012',
    userId: 'other-user',
    title: 'Loud Music from Bar',
    type: ComplaintType.NOISE,
    subcategory: 'Commercial Noise',
    description: 'The bar on Pine Street is playing extremely loud music until 2 AM, making it impossible to sleep. This has been happening every weekend.',
    location: 'Pine Street Bar, 123 Pine Street',
    urgency: 'high',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.POLICE,
    assignedUnit: GovernmentUnit.POLICE,
    createdAt: '2025-02-02T23:45:00',
    updatedAt: '2025-02-03T10:15:00',
    coordinates: [6.74800, 125.35200],
    timeline: [
      {
        date: '2025-02-02T23:45:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      },
      {
        date: '2025-02-03T10:15:00',
        action: 'Assigned to Police Department',
        actor: 'Admin User'
      },
      {
        date: '2025-02-03T14:30:00',
        action: 'Officer visited establishment, warning issued',
        actor: 'Police Department'
      }
    ]
  },
  {
    id: 'CP013',
    userId: 'citizen-user',
    title: 'Garbage Truck Spilled Waste',
    type: ComplaintType.SANITATION,
    subcategory: 'Garbage Collection',
    description: 'The garbage truck spilled waste all over Elm Street while collecting trash. The street is now dirty and smells terrible.',
    location: 'Elm Street between 2nd and 3rd Avenue',
    urgency: 'medium',
    status: ComplaintStatus.RESOLVED,
    suggestedUnit: GovernmentUnit.WASTE,
    assignedUnit: GovernmentUnit.WASTE,
    createdAt: '2025-02-03T07:30:00',
    updatedAt: '2025-02-03T08:00:00',
    resolvedAt: '2025-02-03T10:45:00',
    coordinates: [6.74200, 125.34800],
    timeline: [
      {
        date: '2025-02-03T07:30:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-02-03T08:00:00',
        action: 'Assigned to Waste Management',
        actor: 'Admin User'
      },
      {
        date: '2025-02-03T10:45:00',
        action: 'Street cleaned and sanitized',
        actor: 'Waste Management'
      }
    ]
  },
  {
    id: 'CP014',
    userId: 'other-user',
    title: 'Fire Hydrant Leaking',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Water Infrastructure',
    description: 'The fire hydrant on Maple Drive is leaking water continuously. This is wasting water and could cause damage to the road.',
    location: 'Maple Drive, near 5th Avenue',
    urgency: 'medium',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    assignedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-02-04T11:15:00',
    updatedAt: '2025-02-04T12:00:00',
    coordinates: [6.74500, 125.35500],
    timeline: [
      {
        date: '2025-02-04T11:15:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      },
      {
        date: '2025-02-04T12:00:00',
        action: 'Assigned to Public Works Department',
        actor: 'Admin User'
      },
      {
        date: '2025-02-04T15:30:00',
        action: 'Technician dispatched for repair',
        actor: 'Public Works Department'
      }
    ]
  },
  {
    id: 'CP015',
    userId: 'citizen-user',
    title: 'Stray Dogs in Neighborhood',
    type: ComplaintType.PUBLIC_SAFETY,
    subcategory: 'Animal Control',
    description: 'There are several stray dogs roaming around Oak Avenue that seem aggressive. They\'re scaring children and causing safety concerns.',
    location: 'Oak Avenue between 7th and 8th Street',
    urgency: 'high',
    status: ComplaintStatus.PENDING,
    suggestedUnit: GovernmentUnit.POLICE,
    createdAt: '2025-02-05T08:45:00',
    updatedAt: '2025-02-05T08:45:00',
    coordinates: [6.75500, 125.34000],
    timeline: [
      {
        date: '2025-02-05T08:45:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      }
    ]
  },
  {
    id: 'CP016',
    userId: 'other-user',
    title: 'Broken Street Sign',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Traffic Control',
    description: 'The stop sign at the intersection of Birch Street and 4th Avenue is bent and barely visible. This is a traffic safety hazard.',
    location: 'Intersection of Birch Street and 4th Avenue',
    urgency: 'high',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    assignedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-02-06T13:20:00',
    updatedAt: '2025-02-06T14:00:00',
    coordinates: [6.73800, 125.36500],
    timeline: [
      {
        date: '2025-02-06T13:20:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      },
      {
        date: '2025-02-06T14:00:00',
        action: 'Assigned to Public Works Department',
        actor: 'Admin User'
      },
      {
        date: '2025-02-06T16:45:00',
        action: 'Temporary stop sign installed',
        actor: 'Public Works Department'
      }
    ]
  },
  {
    id: 'CP017',
    userId: 'citizen-user',
    title: 'Overflowing Sewer',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Sewer Problems',
    description: 'The sewer on Cedar Avenue is overflowing and sewage is backing up into the street. This is a health hazard and needs immediate attention.',
    location: 'Cedar Avenue near 6th Street',
    urgency: 'emergency',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    assignedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-02-07T06:30:00',
    updatedAt: '2025-02-07T07:00:00',
    coordinates: [6.74850, 125.35500],
    timeline: [
      {
        date: '2025-02-07T06:30:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-02-07T07:00:00',
        action: 'Assigned to Public Works Department',
        actor: 'Admin User'
      },
      {
        date: '2025-02-07T08:15:00',
        action: 'Emergency crew dispatched',
        actor: 'Public Works Department'
      }
    ]
  },
  {
    id: 'CP018',
    userId: 'other-user',
    title: 'Abandoned Vehicle',
    type: ComplaintType.PUBLIC_SAFETY,
    subcategory: 'Abandoned Property',
    description: 'There\'s an abandoned car parked on Willow Lane that hasn\'t moved in over a month. It\'s taking up parking space and looks suspicious.',
    location: 'Willow Lane, near 3rd Street',
    urgency: 'low',
    status: ComplaintStatus.PENDING,
    suggestedUnit: GovernmentUnit.POLICE,
    createdAt: '2025-02-08T10:15:00',
    updatedAt: '2025-02-08T10:15:00',
    coordinates: [6.73000, 125.34500],
    timeline: [
      {
        date: '2025-02-08T10:15:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      }
    ]
  },
  {
    id: 'CP019',
    userId: 'citizen-user',
    title: 'Broken Playground Equipment',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Public Amenities',
    description: 'The swing set in Riverside Park is broken. One of the swings is hanging by only one chain, making it dangerous for children.',
    location: 'Riverside Park, near the river',
    urgency: 'high',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.CITY_HALL,
    assignedUnit: GovernmentUnit.CITY_HALL,
    createdAt: '2025-02-09T14:30:00',
    updatedAt: '2025-02-09T15:00:00',
    coordinates: [6.76000, 125.34000],
    timeline: [
      {
        date: '2025-02-09T14:30:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-02-09T15:00:00',
        action: 'Assigned to City Hall',
        actor: 'Admin User'
      },
      {
        date: '2025-02-09T16:30:00',
        action: 'Equipment marked as unsafe, repair scheduled',
        actor: 'City Hall'
      }
    ]
  },
  {
    id: 'CP020',
    userId: 'other-user',
    title: 'Street Vendor Without Permit',
    type: ComplaintType.PUBLIC_SAFETY,
    subcategory: 'Illegal Activity',
    description: 'There\'s a street vendor selling food on Main Street without a permit. The food safety is questionable and they\'re blocking pedestrian traffic.',
    location: 'Main Street, near the bus stop',
    urgency: 'medium',
    status: ComplaintStatus.PENDING,
    suggestedUnit: GovernmentUnit.POLICE,
    createdAt: '2025-02-10T12:00:00',
    updatedAt: '2025-02-10T12:00:00',
    coordinates: [6.75200, 125.35800],
    timeline: [
      {
        date: '2025-02-10T12:00:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      }
    ]
  },
  {
    id: 'CP021',
    userId: 'citizen-user',
    title: 'Broken Street Drain',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Drainage Problems',
    description: 'The street drain on Pine Street is clogged and water is pooling on the road after rain. This could cause flooding during heavy storms.',
    location: 'Pine Street between 1st and 2nd Avenue',
    urgency: 'medium',
    status: ComplaintStatus.PENDING,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-02-11T09:30:00',
    updatedAt: '2025-02-11T09:30:00',
    coordinates: [6.74800, 125.35200],
    timeline: [
      {
        date: '2025-02-11T09:30:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      }
    ]
  },
  {
    id: 'CP022',
    userId: 'other-user',
    title: 'Loud Construction at Night',
    type: ComplaintType.NOISE,
    subcategory: 'Construction Noise',
    description: 'Construction work is happening at the new building site on Oak Avenue during prohibited hours. The noise is disturbing residents trying to sleep.',
    location: 'New building site, Oak Avenue',
    urgency: 'high',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.POLICE,
    assignedUnit: GovernmentUnit.POLICE,
    createdAt: '2025-02-12T02:15:00',
    updatedAt: '2025-02-12T08:00:00',
    coordinates: [6.75500, 125.34000],
    timeline: [
      {
        date: '2025-02-12T02:15:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      },
      {
        date: '2025-02-12T08:00:00',
        action: 'Assigned to Police Department',
        actor: 'Admin User'
      },
      {
        date: '2025-02-12T10:30:00',
        action: 'Warning issued to construction company',
        actor: 'Police Department'
      }
    ]
  },
  {
    id: 'CP023',
    userId: 'citizen-user',
    title: 'Missing Manhole Cover',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Road Safety',
    description: 'A manhole cover is missing on Elm Street near the intersection with 4th Avenue. This is a serious safety hazard for vehicles and pedestrians.',
    location: 'Elm Street near 4th Avenue intersection',
    urgency: 'emergency',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    assignedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-02-13T07:45:00',
    updatedAt: '2025-02-13T08:00:00',
    coordinates: [6.74200, 125.34800],
    timeline: [
      {
        date: '2025-02-13T07:45:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-02-13T08:00:00',
        action: 'Assigned to Public Works Department',
        actor: 'Admin User'
      },
      {
        date: '2025-02-13T08:30:00',
        action: 'Emergency crew dispatched to secure area',
        actor: 'Public Works Department'
      }
    ]
  },
  {
    id: 'CP024',
    userId: 'other-user',
    title: 'Overflowing Trash Bins',
    type: ComplaintType.SANITATION,
    subcategory: 'Garbage Collection',
    description: 'The public trash bins in Central Park are overflowing and garbage is scattered around. This is creating an unsightly and unsanitary condition.',
    location: 'Central Park, near the fountain',
    urgency: 'medium',
    status: ComplaintStatus.PENDING,
    suggestedUnit: GovernmentUnit.WASTE,
    createdAt: '2025-02-14T11:20:00',
    updatedAt: '2025-02-14T11:20:00',
    coordinates: [6.75000, 125.34500],
    timeline: [
      {
        date: '2025-02-14T11:20:00',
        action: 'Complaint submitted',
        actor: 'Jane Smith'
      }
    ]
  },
  {
    id: 'CP025',
    userId: 'citizen-user',
    title: 'Broken Street Light',
    type: ComplaintType.INFRASTRUCTURE,
    subcategory: 'Street Lighting',
    description: 'The street light on my street has been out for over a week. It\'s very dark at night and makes walking unsafe.',
    location: 'My street, near my house',
    urgency: 'medium',
    status: ComplaintStatus.PENDING,
    suggestedUnit: GovernmentUnit.PUBLIC_WORKS,
    createdAt: '2025-02-15T18:30:00',
    updatedAt: '2025-02-15T18:30:00',
    coordinates: [6.74800, 125.35000],
    timeline: [
      {
        date: '2025-02-15T18:30:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      }
    ]
  },
  {
    id: 'CP026',
    userId: 'citizen-user',
    title: 'Loud Neighbors',
    type: ComplaintType.NOISE,
    subcategory: 'Residential Noise',
    description: 'My neighbors are playing very loud music late at night, making it impossible to sleep. This has been happening every weekend.',
    location: 'My neighborhood',
    urgency: 'high',
    status: ComplaintStatus.IN_PROGRESS,
    suggestedUnit: GovernmentUnit.POLICE,
    assignedUnit: GovernmentUnit.POLICE,
    createdAt: '2025-02-16T23:15:00',
    updatedAt: '2025-02-17T09:00:00',
    coordinates: [6.74500, 125.34800],
    timeline: [
      {
        date: '2025-02-16T23:15:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-02-17T09:00:00',
        action: 'Assigned to Police Department',
        actor: 'Admin User'
      },
      {
        date: '2025-02-17T14:30:00',
        action: 'Officer visited and issued warning',
        actor: 'Police Department'
      }
    ]
  },
  {
    id: 'CP027',
    userId: 'citizen-user',
    title: 'Garbage Not Collected',
    type: ComplaintType.SANITATION,
    subcategory: 'Garbage Collection',
    description: 'My garbage hasn\'t been collected for two weeks. The bins are overflowing and attracting pests.',
    location: 'My house',
    urgency: 'high',
    status: ComplaintStatus.RESOLVED,
    suggestedUnit: GovernmentUnit.WASTE,
    assignedUnit: GovernmentUnit.WASTE,
    createdAt: '2025-02-18T07:00:00',
    updatedAt: '2025-02-18T08:00:00',
    resolvedAt: '2025-02-18T10:30:00',
    coordinates: [6.74200, 125.34500],
    timeline: [
      {
        date: '2025-02-18T07:00:00',
        action: 'Complaint submitted',
        actor: 'John Citizen'
      },
      {
        date: '2025-02-18T08:00:00',
        action: 'Assigned to Waste Management',
        actor: 'Admin User'
      },
      {
        date: '2025-02-18T10:30:00',
        action: 'Garbage collected and area cleaned',
        actor: 'Waste Management'
      }
    ]
  }
];

// Initialize complaints in sessionStorage if not already present
function initializeComplaints() {
  if (!sessionStorage.getItem('complaints')) {
    console.log('Initializing complaints in sessionStorage...'); // Debug log
    sessionStorage.setItem('complaints', JSON.stringify(sampleComplaints));
    console.log('Complaints initialized:', sampleComplaints.length, 'complaints'); // Debug log
  } else {
    console.log('Complaints already exist in sessionStorage'); // Debug log
  }
}

// Get all complaints
function getComplaints() {
  initializeComplaints();
  const complaints = JSON.parse(sessionStorage.getItem('complaints')) || [];
  console.log('Retrieved complaints from sessionStorage:', complaints.length, 'complaints'); // Debug log
  return complaints;
}

// Refresh complaints data (useful for testing)
function refreshComplaints() {
  console.log('Refreshing complaints data...'); // Debug log
  sessionStorage.removeItem('complaints');
  initializeComplaints();
  return getComplaints();
}

// Make functions available globally
window.refreshComplaints = refreshComplaints;
window.getComplaints = getComplaints;
window.getComplaintById = getComplaintById;
window.getComplaintsByUserId = getComplaintsByUserId;
window.addComplaint = addComplaint;
window.updateComplaint = updateComplaint;
window.deleteComplaint = deleteComplaint;

// Test function to verify data is working
window.testComplaints = function() {
  console.log('Testing complaints data...'); // Debug log
  const complaints = getComplaints();
  console.log('Total complaints:', complaints.length); // Debug log
  console.log('First few complaints:', complaints.slice(0, 3)); // Debug log
  
  const citizenComplaints = getComplaintsByUserId('citizen-user');
  console.log('Citizen complaints:', citizenComplaints.length); // Debug log
  console.log('Citizen complaint IDs:', citizenComplaints.map(c => c.id)); // Debug log
  
  return complaints;
};

// Get complaint by ID
function getComplaintById(id) {
  const complaints = getComplaints();
  return complaints.find(complaint => complaint.id === id);
}

// Get complaints by user ID
function getComplaintsByUserId(userId) {
  const complaints = getComplaints();
  console.log('getComplaintsByUserId called with userId:', userId); // Debug log
  console.log('Total complaints available:', complaints.length); // Debug log
  
  const userComplaints = complaints.filter(complaint => complaint.userId === userId);
  console.log('Filtered complaints for user:', userComplaints.length); // Debug log
  console.log('User complaints found:', userComplaints); // Debug log
  
  return userComplaints;
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
  
  // Save to sessionStorage
  sessionStorage.setItem('complaints', JSON.stringify(complaints));
  
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
    sessionStorage.setItem('complaints', JSON.stringify(complaints));
    
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