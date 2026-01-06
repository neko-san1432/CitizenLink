
-- SEED DATA FOR COMPLAINTS
INSERT INTO public.complaints (
    submitted_by,
    title,
    descriptive_su,
    location_text,
    latitude,
    longitude,
    category,
    subcategory,
    department_r,
    priority,
    workflow_status,
    status,
    submitted_at,
    updated_at
) VALUES
-- 1
('85fb7b44-ad98-4607-a12f-1273f65fb365', 'Deep Pothole on Rizal Avenue', 'A large pothole has developed near the intersection, causing traffic to slow down significantly.', 'Rizal Avenue cor. 5th Ave', 6.7534, 125.3556, 'Infrastructure', 'Road Maintenance', ARRAY['Engineering'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 2
('b813f696-4dd1-4e66-9cce-96dd804fd210', 'Uncollected Garbage for 3 Days', 'Trash has been piling up on the sidewalk. It is starting to smell and attract pests.', '123 Sampaguita St., Brgy. San Antonio', 6.7447, 125.3644, 'Sanitation', 'Garbage Collection', ARRAY['Sanitation'], 'high', 'new', 'pending', NOW(), NOW()),

-- 3
('48fdd03f-200b-4068-a429-d91b78fe34f4', 'Busted Streetlight causing darkness', 'The streetlight post #45 is not working, making the area dangerous at night.', 'Mabini St., near Elementary School', 6.7661, 125.3492, 'Public Safety', 'Lighting', ARRAY['Engineering', 'Barangay'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 4
('5cc7dd46-e9f5-47c1-8583-d17837f4d5b5', 'Noise Complaint - Late Night Karaoke', 'Neighbors are singing karaoke very loudly past 11 PM, disturbing peace.', 'Block 5, Lot 2, Greenville Subd.', 6.7890, 125.3767, 'Peace and Order', 'Noise Control', ARRAY['Barangay', 'Police'], 'low', 'new', 'pending', NOW(), NOW()),

-- 5
('1f2e055e-eb12-43ae-bf7b-507968989c28', 'Water Pipe Leak', 'Strong stream of water visible coming from the sidewalk pipe.', 'Corner of Taft and Pedro Gil', 6.7350, 125.3870, 'Utilities', 'Water Supply', ARRAY['Water District'], 'high', 'new', 'pending', NOW(), NOW()),

-- 6
('4698c616-daf4-48ff-acad-424ef982e573', 'Illegal Parking obstructing driveway', 'A white van is parked directly in front of my driveway, blocking exit.', '45 Kamuning Road', 6.7288, 125.3422, 'Traffic', 'Illegal Parking', ARRAY['Traffic Management'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 7
('ef7e9256-13fb-4c6d-a57b-9f25af5aa87e', 'Stray Dogs Chasing Pedestrians', 'Pack of aggressive stray dogs chasing people near the market.', 'Public Market Entrance', 6.7465, 125.3634, 'Animal Control', 'Stray Animals', ARRAY['City Vet'], 'high', 'new', 'pending', NOW(), NOW()),

-- 8
('431756dd-62d7-48ec-8395-8b813ea54d35', 'Clogged Drainage Causing Flood', 'Rainwater is not draining due to clogged canal with plastic waste.', 'Espana Blvd, near UST', 6.7567, 125.3512, 'Infrastructure', 'Drainage', ARRAY['Engineering'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 9
('cfbd32f8-fbb0-43c0-bc35-a8cfceb1a355', 'Fallen Tree Branch', 'A large branch fell on the sidewalk, blocking the path.', 'Quezon Memorial Circle', 6.7815, 125.3693, 'Environment', 'Maintenance', ARRAY['Parks and Rec'], 'low', 'new', 'pending', NOW(), NOW()),

-- 10
('eada69c6-24e6-479a-9e0f-10c82f49062e', 'Smoke Belching Bus', 'Bus with plate XYZ-123 is emitting thick black smoke.', 'EDSA Ayala Northbound', 6.7416, 125.3264, 'Environment', 'Pollution', ARRAY['LTO', 'Environment'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 11
('b120db0c-eb8b-4ea4-8d0e-09918f961816', 'Sidewalk Obstruction - Vendor', 'Makeshift stall completely blocking the sidewalk.', 'Aurora Blvd cor. Cubao', 6.7691, 125.3505, 'Public Order', 'Obstruction', ARRAY['Barangay', 'Dpos'], 'low', 'new', 'pending', NOW(), NOW()),

-- 12
('40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c', 'Open Manhole Cover', 'Manhole cover is missing, very dangerous for pedestrians.', 'Shaw Blvd near Crossing', 6.7515, 125.3526, 'Public Safety', 'Hazard', ARRAY['Engineering'], 'urgent', 'new', 'pending', NOW(), NOW()),

-- 13
('8a1315d0-bfa2-4b9d-ab54-221769d7a6d5', 'Overpriced Tricycle Fare', 'Driver demanded 100 pesos for a short distance ride.', 'Terminal at Main Mall', 6.7366, 125.3854, 'Transportation', 'Overpricing', ARRAY['Tricycle Regulatory'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 14
('145a504d-8187-498f-ba85-10daf09a20d6', 'Graffiti on Public School Wall', 'Vandals painted graffiti on the newly painted school wall.', 'Ramon Magsaysay High School', 6.7909, 125.3003, 'Public Order', 'Vandalism', ARRAY['Barangay', 'School Board'], 'low', 'new', 'pending', NOW(), NOW()),

-- 15
('8e6aa537-86bb-4097-bbd6-b0789f877b9e', 'Burning of Leaves/Garbage', 'Neighbor burning garbage in their backyard, smoke entering our house.', 'Emerald St., Village East', 6.7712, 125.3023, 'Environment', 'Air Pollution', ARRAY['Environment'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 16
('4f583ebb-fcca-4d72-9e64-c34e373ecbe1', 'Broken Traffic Light', 'Traffic light stuck on red for 15 minutes.', 'C5 Kalayaan Intersection', 6.7492, 125.3560, 'Traffic', 'Signal Malfunction', ARRAY['Traffic Management'], 'high', 'new', 'pending', NOW(), NOW()),

-- 17
('c54cdfb7-4ea6-4e96-bf9d-26989f8e5487', 'Low Water Pressure', 'Water pressure very low during peak hours for the past week.', 'Brgy. Plainview', 6.7739, 125.3336, 'Utilities', 'Water Supply', ARRAY['Water District'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 18
('002a2354-193a-4984-b811-9c01406c92b3', 'Construction Debris on Road', 'Construction truck spilled sand and gravel on the road.', 'Quirino Highway', 6.7176, 125.3428, 'Infrastructure', 'Road Hazard', ARRAY['Engineering'], 'high', 'new', 'pending', NOW(), NOW()),

-- 19
('6fda128c-3438-47aa-a5a5-40462aa66971', 'Double Parking on Narrow Street', 'Cars parked on both sides of the street making it impassable.', 'Scout Area Streets', 6.7366, 125.3345, 'Traffic', 'Illegal Parking', ARRAY['Traffic Management'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 20
('bf574708-5a85-4eaa-9b3a-5cadb3077e02', 'Unlit Pedestrian Crossing', 'Pedestrian crossing near church is too dark.', 'Redemptorist Road', 6.7323, 125.3915, 'Public Safety', 'Lighting', ARRAY['Engineering'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 21
('a3ffc696-3a78-43b7-8893-df3db91e0d9b', 'Dead Animal on Roadway', 'Large dead cat/dog on the middle of the street.', 'Service Road KM 14', 6.7965, 125.3337, 'Sanitation', 'Cleaning', ARRAY['Sanitation'], 'medium', 'new', 'pending', NOW(), NOW()),

-- 22
('f006e634-3298-4247-9439-5b11580026b4', 'Slippery Road due to Oil Spill', 'Oil spilled on the road near the gas station.', 'MacArthur Highway', 6.7644, 125.3785, 'Public Safety', 'Road Hazard', ARRAY['Fire Dept', 'Traffic Management'], 'urgent', 'new', 'pending', NOW(), NOW()),

-- 23
('00e67150-7b3a-4687-b37c-b37b2d6584d8', 'Aggressive Beggars', 'Group of people harassing passersby for money.', 'Footbridge near Mall', 6.7843, 125.3567, 'Social Services', 'Vagrancy', ARRAY['DSWD'], 'low', 'new', 'pending', NOW(), NOW()),

-- 24
('a84b1f04-a7ac-4151-ab86-cb80b1d955ba', 'Flooding due to clogged creek', 'Creek overflows easily even with light rain.', 'Maricaban Creek Area', 6.7385, 125.3094, 'Infrastructure', 'Flood Control', ARRAY['Engineering'], 'high', 'new', 'pending', NOW(), NOW()),

-- 25
('b56bfbf1-30f2-4df1-8b85-312f8a194bf7', 'Broken Traffic Sign', 'No Entry sign has been knocked down.', 'One way street in Brgy. Holy Spirit', 6.7766, 125.2827, 'Traffic', 'Signage', ARRAY['Traffic Management'], 'low', 'new', 'pending', NOW(), NOW());
