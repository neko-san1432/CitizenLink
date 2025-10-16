const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use service role key to bypass RLS
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addSampleComplaints() {
  console.log('Adding sample complaint entries to the database...');
  
  const sampleComplaints = [
    {
      title: 'Broken Water Pipe on Main Street',
      descriptive_su: 'There is a broken water pipe on Main Street that is causing water to leak onto the road. This has been going on for 2 days and is creating a hazard for pedestrians and vehicles.',
      type: 'Infrastructure',
      status: 'in progress',
      priority: 'urgent',
      latitude: 6.7492,
      longitude: 125.3571,
      location_text: 'Main Street, Corner 5th Ave',
      submitted_at: new Date().toISOString(),
      primary_department: 'wst',
      submitted_by: '8c32ca0b-0203-4054-b5ff-72501c8e9d80'
    },
    {
      title: 'Clogged Drainage System',
      descriptive_su: 'The drainage system on Park Avenue is completely clogged with debris and garbage. Water is pooling on the street and causing flooding during rain.',
      type: 'Infrastructure',
      status: 'in progress',
      priority: 'high',
      latitude: 6.7500,
      longitude: 125.3580,
      location_text: 'Park Avenue, Block 3',
      submitted_at: new Date().toISOString(),
      primary_department: 'wst',
      submitted_by: '8c32ca0b-0203-4054-b5ff-72501c8e9d80'
    },
    {
      title: 'Street Light Out',
      descriptive_su: 'The street light near the market on Rizal Street has been out for a week. This area is very dark at night and poses a safety risk for pedestrians.',
      type: 'Infrastructure',
      status: 'pending review',
      priority: 'medium',
      latitude: 6.7480,
      longitude: 125.3560,
      location_text: 'Rizal Street, Near Market',
      submitted_at: new Date().toISOString(),
      primary_department: 'eng',
      submitted_by: '8c32ca0b-0203-4054-b5ff-72501c8e9d80'
    },
    {
      title: 'Garbage Collection Issue',
      descriptive_su: 'Garbage collection has been inconsistent in the Barangay Hall area. Bins are overflowing and garbage is scattered on the street.',
      type: 'Environmental',
      status: 'resolved',
      priority: 'low',
      latitude: 6.7510,
      longitude: 125.3590,
      location_text: 'Barangay Hall Area',
      submitted_at: new Date().toISOString(),
      primary_department: 'env',
      submitted_by: '8c32ca0b-0203-4054-b5ff-72501c8e9d80'
    },
    {
      title: 'Pothole on Highway',
      descriptive_su: 'There is a large pothole on the national highway at KM 5 that is damaging vehicles. It has been there for months and is getting worse.',
      type: 'Infrastructure',
      status: 'in progress',
      priority: 'high',
      latitude: 6.7470,
      longitude: 125.3550,
      location_text: 'National Highway, KM 5',
      submitted_at: new Date().toISOString(),
      primary_department: 'eng',
      submitted_by: '8c32ca0b-0203-4054-b5ff-72501c8e9d80'
    },
    {
      title: 'Noise Complaint',
      descriptive_su: 'There is excessive noise from construction work happening at night in the residential area. This is disturbing the sleep of residents.',
      type: 'Social',
      status: 'pending review',
      priority: 'low',
      latitude: 6.7520,
      longitude: 125.3600,
      location_text: 'Residential Area, Block 2',
      submitted_at: new Date().toISOString(),
      primary_department: 'soc',
      submitted_by: '8c32ca0b-0203-4054-b5ff-72501c8e9d80'
    },
    {
      title: 'Flooding in Low Area',
      descriptive_su: 'The low-lying area near the river floods every time it rains. This is affecting several houses and making the road impassable.',
      type: 'Environmental',
      status: 'in progress',
      priority: 'urgent',
      latitude: 6.7460,
      longitude: 125.3540,
      location_text: 'Low-lying Area, Near River',
      submitted_at: new Date().toISOString(),
      primary_department: 'env',
      submitted_by: '8c32ca0b-0203-4054-b5ff-72501c8e9d80'
    },
    {
      title: 'Traffic Light Malfunction',
      descriptive_su: 'The traffic light at the intersection of Main and 2nd Street is not working properly. It stays red for too long and causes traffic jams.',
      type: 'Infrastructure',
      status: 'resolved',
      priority: 'high',
      latitude: 6.7530,
      longitude: 125.3610,
      location_text: 'Intersection of Main and 2nd Street',
      submitted_at: new Date().toISOString(),
      primary_department: 'eng',
      submitted_by: '8c32ca0b-0203-4054-b5ff-72501c8e9d80'
    },
    {
      title: 'Sewer Backup',
      descriptive_su: 'There is a sewer backup in the commercial district causing foul odors and potential health hazards. Raw sewage is visible on the street.',
      type: 'Infrastructure',
      status: 'in progress',
      priority: 'urgent',
      latitude: 6.7450,
      longitude: 125.3530,
      location_text: 'Commercial District, Shop Area',
      submitted_at: new Date().toISOString(),
      primary_department: 'wst',
      submitted_by: '8c32ca0b-0203-4054-b5ff-72501c8e9d80'
    },
    {
      title: 'Street Vendor Issue',
      descriptive_su: 'Street vendors are blocking the sidewalk in the market area, making it difficult for pedestrians to pass. They are also creating traffic congestion.',
      type: 'Social',
      status: 'pending review',
      priority: 'medium',
      latitude: 6.7540,
      longitude: 125.3620,
      location_text: 'Market Area, Sidewalk',
      submitted_at: new Date().toISOString(),
      primary_department: 'soc',
      submitted_by: '8c32ca0b-0203-4054-b5ff-72501c8e9d80'
    }
  ];

  try {
    const { data, error } = await supabase
      .from('complaints')
      .insert(sampleComplaints);

    if (error) {
      console.error('Error inserting sample complaints:', error);
      return;
    }

    console.log(`✅ Successfully added ${sampleComplaints.length} sample complaints to the database`);
    
    // Verify the data
    const { count } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    
    console.log(`📊 Total complaints with coordinates now: ${count}`);
    console.log('🗺️ Now refresh your heatmap page to see the complaints!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

addSampleComplaints().catch(console.error);


