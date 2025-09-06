// Searchable Select Component for Complaint Types and Subcategories

// Comprehensive complaint types with detailed subcategories
const complaintTypes = {
  'infrastructure': {
    title: 'Infrastructure & Public Works',
    description: 'Roads, bridges, buildings, and public facilities',
    subcategories: {
      'road_damage': { title: 'Road Damage & Maintenance', description: 'Potholes, cracks, road surface issues', tags: ['potholes', 'cracks', 'asphalt', 'repair'] },
      'bridge_issues': { title: 'Bridge & Overpass Problems', description: 'Structural issues, safety concerns', tags: ['bridge', 'overpass', 'structural', 'safety'] },
      'sidewalk_problems': { title: 'Sidewalk & Pedestrian Paths', description: 'Uneven surfaces, accessibility issues', tags: ['sidewalk', 'pedestrian', 'accessibility', 'walkway'] },
      'street_lighting': { title: 'Street Lighting', description: 'Non-working lights, insufficient lighting', tags: ['lighting', 'streetlights', 'dark', 'illumination'] },
      'traffic_signs': { title: 'Traffic Signs & Signals', description: 'Missing, damaged, or unclear signage', tags: ['signs', 'traffic', 'signals', 'markings'] },
      'drainage_issues': { title: 'Drainage & Flooding', description: 'Blocked drains, flooding problems', tags: ['drainage', 'flooding', 'drains', 'water'] },
      'public_buildings': { title: 'Public Buildings & Facilities', description: 'City hall, libraries, community centers', tags: ['buildings', 'facilities', 'public', 'maintenance'] },
      'parks_recreation': { title: 'Parks & Recreation', description: 'Playgrounds, sports facilities, green spaces', tags: ['parks', 'recreation', 'playground', 'sports'] }
    }
  },
  'public_safety': {
    title: 'Public Safety & Security',
    description: 'Police, fire, emergency services, and safety concerns',
    subcategories: {
      'traffic_violations': { title: 'Traffic Violations', description: 'Speeding, reckless driving, traffic rule violations', tags: ['traffic', 'speeding', 'violations', 'driving'] },
      'parking_issues': { title: 'Parking Problems', description: 'Illegal parking, disabled parking abuse', tags: ['parking', 'illegal', 'disabled', 'violations'] },
      'emergency_response': { title: 'Emergency Response', description: 'Slow response times, emergency service issues', tags: ['emergency', 'response', 'ambulance', 'fire'] },
      'crime_reports': { title: 'Crime & Security', description: 'Theft, vandalism, suspicious activities', tags: ['crime', 'theft', 'vandalism', 'security'] },
      'safety_hazards': { title: 'Safety Hazards', description: 'Dangerous conditions, safety risks', tags: ['safety', 'hazards', 'dangerous', 'risks'] },
      'missing_persons': { title: 'Missing Persons', description: 'Report missing individuals', tags: ['missing', 'persons', 'lost', 'search'] },
      'fire_safety': { title: 'Fire Safety', description: 'Fire hazards, fire safety violations', tags: ['fire', 'safety', 'hazards', 'prevention'] },
      'neighborhood_watch': { title: 'Neighborhood Watch', description: 'Community safety, neighborhood concerns', tags: ['neighborhood', 'community', 'watch', 'safety'] }
    }
  },
  'sanitation': {
    title: 'Sanitation & Waste Management',
    description: 'Garbage, recycling, cleaning, and waste issues',
    subcategories: {
      'garbage_collection': { title: 'Garbage Collection', description: 'Missed pickups, collection schedule issues', tags: ['garbage', 'collection', 'pickup', 'trash'] },
      'recycling_issues': { title: 'Recycling Programs', description: 'Recycling collection, sorting problems', tags: ['recycling', 'environment', 'waste', 'green'] },
      'illegal_dumping': { title: 'Illegal Dumping', description: 'Unauthorized waste disposal, dumping sites', tags: ['dumping', 'illegal', 'waste', 'disposal'] },
      'street_cleaning': { title: 'Street Cleaning', description: 'Dirty streets, cleaning schedule issues', tags: ['cleaning', 'streets', 'dirty', 'maintenance'] },
      'public_restrooms': { title: 'Public Restrooms', description: 'Restroom maintenance, cleanliness issues', tags: ['restrooms', 'bathrooms', 'cleanliness', 'maintenance'] },
      'waste_management': { title: 'Waste Management', description: 'Overall waste management system issues', tags: ['waste', 'management', 'system', 'process'] },
      'littering': { title: 'Littering & Cleanliness', description: 'Litter problems, public space cleanliness', tags: ['littering', 'cleanliness', 'litter', 'public'] },
      'composting': { title: 'Composting Programs', description: 'Composting facilities, organic waste', tags: ['composting', 'organic', 'waste', 'environment'] }
    }
  },
  'utilities': {
    title: 'Utilities & Services',
    description: 'Water, electricity, internet, and utility services',
    subcategories: {
      'water_supply': { title: 'Water Supply', description: 'Water pressure, quality, supply issues', tags: ['water', 'supply', 'pressure', 'quality'] },
      'electricity': { title: 'Electricity & Power', description: 'Power outages, electrical issues', tags: ['electricity', 'power', 'outages', 'electrical'] },
      'internet_telecom': { title: 'Internet & Telecommunications', description: 'Internet connectivity, phone services', tags: ['internet', 'telecom', 'connectivity', 'phone'] },
      'gas_supply': { title: 'Gas Supply', description: 'Natural gas, propane supply issues', tags: ['gas', 'supply', 'natural', 'propane'] },
      'sewer_issues': { title: 'Sewer & Wastewater', description: 'Sewer problems, wastewater treatment', tags: ['sewer', 'wastewater', 'drainage', 'treatment'] },
      'service_interruptions': { title: 'Service Interruptions', description: 'Unexpected service outages, disruptions', tags: ['interruptions', 'outages', 'disruptions', 'service'] },
      'billing_issues': { title: 'Billing & Payments', description: 'Utility bill problems, payment issues', tags: ['billing', 'payments', 'bills', 'charges'] },
      'meter_issues': { title: 'Meter Problems', description: 'Water, gas, or electric meter issues', tags: ['meters', 'reading', 'accuracy', 'maintenance'] }
    }
  },
  'environment': {
    title: 'Environment & Nature',
    description: 'Environmental concerns, pollution, and natural resources',
    subcategories: {
      'air_quality': { title: 'Air Quality', description: 'Pollution, air quality concerns', tags: ['air', 'quality', 'pollution', 'smog'] },
      'water_pollution': { title: 'Water Pollution', description: 'Contaminated water sources, pollution', tags: ['water', 'pollution', 'contamination', 'quality'] },
      'noise_pollution': { title: 'Noise Pollution', description: 'Excessive noise, noise complaints', tags: ['noise', 'pollution', 'loud', 'disturbance'] },
      'tree_vegetation': { title: 'Trees & Vegetation', description: 'Tree maintenance, landscaping issues', tags: ['trees', 'vegetation', 'landscaping', 'maintenance'] },
      'wildlife_concerns': { title: 'Wildlife & Animals', description: 'Wildlife issues, animal control', tags: ['wildlife', 'animals', 'control', 'nature'] },
      'climate_issues': { title: 'Climate & Weather', description: 'Climate-related concerns, weather impacts', tags: ['climate', 'weather', 'environment', 'impact'] },
      'recycling_programs': { title: 'Recycling Programs', description: 'Recycling initiatives, environmental programs', tags: ['recycling', 'programs', 'environment', 'green'] },
      'conservation': { title: 'Conservation & Protection', description: 'Environmental conservation, protection efforts', tags: ['conservation', 'protection', 'environment', 'sustainability'] }
    }
  },
  'health': {
    title: 'Health & Medical',
    description: 'Public health, medical services, and health concerns',
    subcategories: {
      'public_health': { title: 'Public Health', description: 'Community health issues, disease prevention', tags: ['health', 'public', 'disease', 'prevention'] },
      'medical_services': { title: 'Medical Services', description: 'Healthcare access, medical facility issues', tags: ['medical', 'healthcare', 'services', 'facilities'] },
      'food_safety': { title: 'Food Safety', description: 'Restaurant inspections, food safety concerns', tags: ['food', 'safety', 'restaurants', 'inspection'] },
      'mental_health': { title: 'Mental Health', description: 'Mental health services, support programs', tags: ['mental', 'health', 'support', 'services'] },
      'emergency_medical': { title: 'Emergency Medical', description: 'Emergency medical services, ambulance response', tags: ['emergency', 'medical', 'ambulance', 'response'] },
      'health_education': { title: 'Health Education', description: 'Health awareness, education programs', tags: ['education', 'health', 'awareness', 'programs'] },
      'sanitation_health': { title: 'Sanitation & Health', description: 'Sanitation-related health concerns', tags: ['sanitation', 'health', 'hygiene', 'cleanliness'] },
      'vaccination': { title: 'Vaccination Programs', description: 'Vaccination clinics, immunization programs', tags: ['vaccination', 'immunization', 'clinics', 'programs'] }
    }
  },
  'transportation': {
    title: 'Transportation & Traffic',
    description: 'Public transit, traffic management, and transportation issues',
    subcategories: {
      'public_transit': { title: 'Public Transit', description: 'Buses, trains, public transportation services', tags: ['transit', 'buses', 'trains', 'public'] },
      'traffic_management': { title: 'Traffic Management', description: 'Traffic flow, congestion, traffic control', tags: ['traffic', 'management', 'congestion', 'flow'] },
      'parking_management': { title: 'Parking Management', description: 'Parking facilities, parking enforcement', tags: ['parking', 'management', 'facilities', 'enforcement'] },
      'road_safety': { title: 'Road Safety', description: 'Traffic safety, accident prevention', tags: ['safety', 'roads', 'accidents', 'prevention'] },
      'pedestrian_safety': { title: 'Pedestrian Safety', description: 'Crosswalks, pedestrian facilities, safety', tags: ['pedestrian', 'safety', 'crosswalks', 'walking'] },
      'cycling_infrastructure': { title: 'Cycling Infrastructure', description: 'Bike lanes, cycling facilities, bike safety', tags: ['cycling', 'bikes', 'lanes', 'infrastructure'] },
      'accessibility': { title: 'Accessibility', description: 'Accessible transportation, mobility services', tags: ['accessibility', 'mobility', 'disabled', 'transport'] },
      'transportation_planning': { title: 'Transportation Planning', description: 'Transportation policy, planning issues', tags: ['planning', 'transportation', 'policy', 'development'] }
    }
  },
  'social_services': {
    title: 'Social Services & Welfare',
    description: 'Social programs, welfare services, and community support',
    subcategories: {
      'elderly_services': { title: 'Elderly Services', description: 'Senior citizen programs, elderly care', tags: ['elderly', 'seniors', 'care', 'services'] },
      'youth_programs': { title: 'Youth Programs', description: 'Youth services, after-school programs', tags: ['youth', 'programs', 'children', 'education'] },
      'housing_assistance': { title: 'Housing Assistance', description: 'Housing programs, affordable housing', tags: ['housing', 'assistance', 'affordable', 'programs'] },
      'food_assistance': { title: 'Food Assistance', description: 'Food banks, meal programs, nutrition support', tags: ['food', 'assistance', 'nutrition', 'programs'] },
      'employment_services': { title: 'Employment Services', description: 'Job placement, employment programs', tags: ['employment', 'jobs', 'placement', 'services'] },
      'disability_services': { title: 'Disability Services', description: 'Services for people with disabilities', tags: ['disability', 'services', 'accessibility', 'support'] },
      'family_services': { title: 'Family Services', description: 'Family support, child welfare services', tags: ['family', 'services', 'children', 'welfare'] },
      'community_development': { title: 'Community Development', description: 'Community programs, neighborhood development', tags: ['community', 'development', 'programs', 'neighborhood'] }
    }
  },
  'other': {
    title: 'Other Issues',
    description: 'General complaints, suggestions, and other concerns',
    subcategories: {
      'general_complaint': { title: 'General Complaint', description: 'General issues not covered by other categories', tags: ['general', 'complaint', 'other', 'issues'] },
      'service_request': { title: 'Service Request', description: 'Request for specific services or information', tags: ['service', 'request', 'information', 'help'] },
      'feedback': { title: 'Feedback & Suggestions', description: 'Feedback on city services, improvement suggestions', tags: ['feedback', 'suggestions', 'improvement', 'services'] },
      'information_request': { title: 'Information Request', description: 'Request for public information or records', tags: ['information', 'request', 'records', 'public'] },
      'complaint_about_service': { title: 'Complaint About Service', description: 'Complaints about city services or staff', tags: ['complaint', 'service', 'staff', 'city'] },
      'suggestion': { title: 'Suggestion', description: 'Suggestions for city improvements or new services', tags: ['suggestion', 'improvement', 'new', 'services'] }
    }
  }
};

// Searchable Select Class
class SearchableSelect {
  constructor(inputId, dropdownId, options, onSelect) {
    this.input = document.getElementById(inputId);
    this.dropdown = document.getElementById(dropdownId);
    this.options = options;
    this.onSelect = onSelect;
    this.filteredOptions = [];
    this.selectedIndex = -1;
    this.isOpen = false;
    
    this.init();
  }
  
  init() {
    this.input.addEventListener('input', (e) => this.handleInput(e));
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.input.addEventListener('focus', () => this.showDropdown());
    this.input.addEventListener('blur', () => this.hideDropdown());
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
        this.hideDropdown();
      }
    });
  }
  
  handleInput(e) {
    const query = e.target.value.toLowerCase();
    this.filterOptions(query);
    this.showDropdown();
  }
  
  handleKeydown(e) {
    if (!this.isOpen) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredOptions.length - 1);
        this.updateHighlight();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateHighlight();
        break;
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectOption(this.filteredOptions[this.selectedIndex]);
        }
        break;
      case 'Escape':
        this.hideDropdown();
        break;
    }
  }
  
  filterOptions(query) {
    this.filteredOptions = [];
    
    for (const [key, option] of Object.entries(this.options)) {
      const searchText = `${option.title} ${option.description} ${option.tags.join(' ')}`.toLowerCase();
      if (searchText.includes(query)) {
        this.filteredOptions.push({ key, ...option });
      }
    }
    
    this.selectedIndex = -1;
    this.renderOptions();
  }
  
  renderOptions() {
    this.dropdown.innerHTML = '';
    
    if (this.filteredOptions.length === 0) {
      this.dropdown.innerHTML = '<div class="searchable-select-option">No options found</div>';
      return;
    }
    
    this.filteredOptions.forEach((option, index) => {
      const optionElement = document.createElement('div');
      optionElement.className = 'searchable-select-option';
      optionElement.innerHTML = `
        <div class="option-title">${option.title}</div>
        <div class="option-description">${option.description}</div>
        <div class="option-tags">
          ${option.tags.map(tag => `<span class="option-tag">${tag}</span>`).join('')}
        </div>
      `;
      
      optionElement.addEventListener('click', () => this.selectOption(option));
      this.dropdown.appendChild(optionElement);
    });
  }
  
  updateHighlight() {
    const options = this.dropdown.querySelectorAll('.searchable-select-option');
    options.forEach((option, index) => {
      option.classList.toggle('highlighted', index === this.selectedIndex);
    });
  }
  
  selectOption(option) {
    this.input.value = option.title;
    this.hideDropdown();
    if (this.onSelect) {
      this.onSelect(option);
    }
  }
  
  showDropdown() {
    this.isOpen = true;
    this.dropdown.style.display = 'block';
  }
  
  hideDropdown() {
    this.isOpen = false;
    this.dropdown.style.display = 'none';
  }
}

// Initialize searchable selects when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Get all complaint types for the main select
  const complaintTypeOptions = {};
  for (const [key, type] of Object.entries(complaintTypes)) {
    complaintTypeOptions[key] = {
      title: type.title,
      description: type.description,
      tags: Object.values(type.subcategories).flatMap(sub => sub.tags)
    };
  }
  
  // Initialize complaint type select
  const complaintTypeSelect = new SearchableSelect(
    'complaint-type',
    'complaint-type-dropdown',
    complaintTypeOptions,
    (option) => {
      // Update subcategory options when type is selected
      updateSubcategoryOptions(option.key);
    }
  );
  
  // Initialize subcategory select
  const subcategorySelect = new SearchableSelect(
    'complaint-subcategory',
    'complaint-subcategory-dropdown',
    {},
    (option) => {
      // Handle subcategory selection
      console.log('Selected subcategory:', option);
    }
  );
  
  // Function to update subcategory options based on selected type
  function updateSubcategoryOptions(typeKey) {
    if (complaintTypes[typeKey]) {
      subcategorySelect.options = complaintTypes[typeKey].subcategories;
      subcategorySelect.input.value = '';
      subcategorySelect.hideDropdown();
    }
  }
  
  // Make functions globally available
  window.complaintTypes = complaintTypes;
  window.updateSubcategoryOptions = updateSubcategoryOptions;
});
