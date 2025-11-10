-- SQL Script to insert 50+ complaints without evidence
-- Randomly assigns users from 5 provided user IDs
-- All coordinates are within barangay boundaries
-- Latitude: 14 decimal places, Longitude: 15 decimal places for accuracy
-- NOTE: category and subcategory fields now use UUIDs from categories and subcategories tables
-- NOTE: All dates are in the past (before today) using NOW() - INTERVAL to ensure they're historical data

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
  workflow_status,
  priority,
  submitted_at,
  updated_at,
  last_activity_at
) VALUES
-- Complaint 1
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Damaged Road Surface on Main Street',
  'The road surface on Main Street near the intersection with Oak Avenue has significant potholes and cracks. This has been causing damage to vehicles and poses a safety hazard, especially during rainy weather when the potholes fill with water.',
  'Main Street, near Oak Avenue intersection',
  6.91674091078345,
  125.300521382243190,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  ARRAY['CEO', 'GSO'],
  'new',
  'medium',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 2
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Broken Streetlight on Park Road',
  'Streetlight number 23 on Park Road has been non-functional for over a week. The area becomes very dark at night, making it unsafe for pedestrians and residents. Please repair or replace the streetlight as soon as possible.',
  'Park Road, near Community Center',
  6.78890012665468,
  125.320355189705879,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'medium',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 3
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Garbage Collection Not Regular',
  'Garbage collection in our neighborhood has been inconsistent for the past two weeks. Trash bins are overflowing and creating unpleasant odors. Some residents have resorted to burning trash which is harmful to the environment.',
  'Barangay San Jose, Block 5',
  6.90837730742364,
  125.367802842440270,
  'c2b6abd4-7dc8-4b02-9f3f-71a5ed64bae8',
  '9e2d71b1-5731-4726-8867-1e807754bc60',
  'new',
  'high',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
),

-- Complaint 4
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Illegal Parking on Sidewalk',
  'Vehicles are consistently parking on the sidewalk along Market Street, blocking pedestrian access. This forces people to walk on the road which is dangerous, especially for children and elderly residents.',
  'Market Street, between 1st and 2nd Avenue',
  6.72898907766205,
  125.297117846264143,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  'new',
  'medium',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days'
),

-- Complaint 5
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Noisy Construction Work After Hours',
  'Construction work at the new building site on Industrial Avenue continues well past 10 PM, violating noise ordinances. The loud machinery and equipment are disturbing residents trying to sleep, especially those with young children.',
  'Industrial Avenue, near Residential Area',
  6.79936828457531,
  125.307604280699479,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  ARRAY['CPDC', 'GSO'],
  'new',
  'high',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),

-- Complaint 6
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Flooding During Heavy Rain',
  'The drainage system in our area is inadequate. Every time it rains heavily, the street floods and water enters some homes. The water takes hours to recede, causing damage to properties and disrupting daily activities.',
  'Barangay Poblacion, Zone 3',
  6.74899305316056,
  125.274518706195209,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  'new',
  'urgent',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days'
),

-- Complaint 7
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Stray Dogs Causing Nuisance',
  'A pack of stray dogs has been roaming our neighborhood for weeks. They are aggressive, rummaging through garbage, and have been chasing children. One resident was bitten last week. We need animal control intervention.',
  'Barangay Santa Maria, near Elementary School',
  6.96511637723751,
  125.382634248136043,
  '1b446065-62cc-41c4-aef8-9feadc0e30b3',
  'b4bd5a0e-d8a9-4074-9f00-f2327f8d72c2',
  'new',
  'high',
  NOW() - INTERVAL '9 days',
  NOW() - INTERVAL '9 days',
  NOW() - INTERVAL '9 days'
),

-- Complaint 8
(
  'eada69c6-24e6-479a-9e0f-10c82f49062e',
  'Uncollected Medical Waste',
  'Medical waste including used syringes and bandages has been left uncollected near the health center for several days. This poses serious health risks to the community, especially children who might come into contact with these items.',
  'Health Center, Barangay San Pedro',
  6.78417008923559,
  125.311090971458555,
  'c2b6abd4-7dc8-4b02-9f3f-71a5ed64bae8',
  '9e2d71b1-5731-4726-8867-1e807754bc60',
  'new',
  'urgent',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 9
(
  'eada69c6-24e6-479a-9e0f-10c82f49062e',
  'Damaged Playground Equipment',
  'The playground in the public park has broken swings and a damaged slide. The equipment is unsafe for children to use. We need these repaired or replaced to ensure children can play safely.',
  'Public Park, Central Plaza',
  6.97470989778990,
  125.303919781970762,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'medium',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days'
),

-- Complaint 10
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Water Supply Interruption',
  'Our area has been experiencing frequent water supply interruptions for the past month. Water service is cut off for several hours daily without prior notice, causing significant inconvenience to residents.',
  'Barangay San Juan, Subdivision Area',
  6.84639578933352,
  125.270039611461115,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  ARRAY['WST'],
  'new',
  'high',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 11
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Overgrown Vegetation Blocking Sidewalk',
  'Trees and bushes along the sidewalk on Garden Street have grown out of control, completely blocking pedestrian access. The vegetation also obstructs visibility for drivers, creating a safety hazard.',
  'Garden Street, from 3rd to 5th Avenue',
  6.88554999129474,
  125.361764055412834,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'f5561db7-82a3-4fbc-9063-c017205c31a4',
  'new',
  'low',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),

-- Complaint 12
(
  '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
  'Illegal Vendors Blocking Traffic',
  'Illegal vendors have set up stalls directly on the road during peak hours, causing severe traffic congestion. They refuse to move when asked and are creating safety hazards for both motorists and pedestrians.',
  'Highway Road, near Market Area',
  6.92636840213211,
  125.272842607298841,
  '711d7a42-f347-41ff-9a05-b6e6d273834b',
  'c6f3977e-411d-475c-b625-e63c67dd35e6',
  'new',
  'high',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
),

-- Complaint 13
(
  '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
  'Broken Public Restroom',
  'The public restroom in the town plaza has been out of order for weeks. The door is broken, there is no running water, and the facility is unsanitary. This is a major inconvenience for visitors and residents.',
  'Town Plaza, near Municipal Hall',
  6.92816551276158,
  125.390496942972888,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'medium',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days'
),

-- Complaint 14
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Loud Karaoke Until Late Night',
  'A nearby establishment operates a karaoke bar that plays extremely loud music until 2 AM on weekdays. The noise is unbearable and violates local noise ordinances. Residents cannot sleep and children cannot study.',
  'Commercial District, near Residential Zone',
  6.87957788564140,
  125.294693813578448,
  '1b446065-62cc-41c4-aef8-9feadc0e30b3',
  'b4bd5a0e-d8a9-4074-9f00-f2327f8d72c2',
  'new',
  'high',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),

-- Complaint 15
(
  'eada69c6-24e6-479a-9e0f-10c82f49062e',
  'Missing Road Signs',
  'Several important road signs are missing or damaged at the intersection of Main Street and Highway Road. This includes stop signs and directional signs, making navigation difficult and potentially dangerous for drivers unfamiliar with the area.',
  'Intersection of Main Street and Highway Road',
  6.80956483485797,
  125.296768367192612,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  ARRAY['CEO', 'CPDC'],
  'new',
  'medium',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 16
(
  'eada69c6-24e6-479a-9e0f-10c82f49062e',
  'Unmaintained Public Basketball Court',
  'The public basketball court in our barangay is in poor condition. The court surface is cracked, the hoops are damaged, and there are no proper lighting facilities. Young people who use this facility are at risk of injury.',
  'Barangay Sports Complex',
  6.74886377561906,
  125.350122000688387,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'low',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
),

-- Complaint 17
(
  'eada69c6-24e6-479a-9e0f-10c82f49062e',
  'Sewage Overflow in Street',
  'Raw sewage is overflowing from a manhole onto the street. The foul smell is unbearable and the health risk is significant. This has been ongoing for over a week and needs immediate attention.',
  'Residential Street, Barangay Poblacion',
  6.92663709705308,
  125.359606893153483,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'urgent',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),

-- Complaint 18
(
  '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
  'Abandoned Vehicle on Public Road',
  'An abandoned vehicle has been parked on the side of the road for more than a month. It is taking up valuable parking space and is an eyesore. The vehicle appears to be non-functional and should be removed.',
  'Residential Area, Street Corner',
  6.74692430470153,
  125.321716464566180,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  'new',
  'low',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days'
),

-- Complaint 19
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Inadequate Street Cleaning',
  'Our street is not being cleaned regularly. There is accumulated dirt, leaves, and debris on the sidewalks and gutters. This creates an unsanitary environment and can contribute to flooding during heavy rains.',
  'Barangay San Jose, Residential Zone',
  6.91263014843156,
  125.387728428048376,
  'c2b6abd4-7dc8-4b02-9f3f-71a5ed64bae8',
  '9e2d71b1-5731-4726-8867-1e807754bc60',
  'new',
  'medium',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
),

-- Complaint 20
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Unsafe Pedestrian Crossing',
  'The pedestrian crossing near the school lacks proper safety measures. There are no traffic lights, no speed bumps, and drivers do not yield to pedestrians. This is extremely dangerous for students crossing the road.',
  'Near Elementary School, Main Road',
  6.86403935452385,
  125.269866563579285,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  ARRAY['CEO', 'DEPED'],
  'new',
  'urgent',
  NOW() - INTERVAL '9 days',
  NOW() - INTERVAL '9 days',
  NOW() - INTERVAL '9 days'
),

-- Complaint 21
(
  'eada69c6-24e6-479a-9e0f-10c82f49062e',
  'Broken Fence Around Public Property',
  'The fence surrounding the public park has several broken sections. This allows unauthorized access and poses security risks. Children and pets can easily wander into restricted areas or onto busy roads.',
  'Public Park Perimeter',
  6.90293057868520,
  125.284934204794212,
  '1b446065-62cc-41c4-aef8-9feadc0e30b3',
  'b4bd5a0e-d8a9-4074-9f00-f2327f8d72c2',
  'new',
  'medium',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 22
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Insufficient Public Transportation',
  'Public transportation in our area is inadequate. Buses and jeepneys are infrequent, overcrowded, and often do not follow their scheduled routes. This makes it difficult for residents, especially workers and students, to commute.',
  'Barangay San Pedro, Transportation Hub',
  6.72732677129320,
  125.296083314679151,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  'new',
  'high',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
),

-- Complaint 23
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Unregulated Food Vendors',
  'Food vendors are operating without proper permits and hygiene standards. They set up near schools and sell food that may not be safe for consumption. There is no proper waste disposal, creating litter and health concerns.',
  'Near High School, Commercial Area',
  6.88192259163248,
  125.251396134932634,
  '5a0478c0-377b-417a-a5ff-82bc9d33a667',
  '7bd3a79e-2f63-46bd-933e-d836cf461962',
  'new',
  'high',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days'
),

-- Complaint 24
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Damaged Bridge Structure',
  'The small bridge connecting two barangays shows signs of structural damage. There are visible cracks and some sections appear unstable. This bridge is used daily by many residents and vehicles, posing a serious safety risk.',
  'Bridge connecting Barangay San Jose and San Pedro',
  6.96355602408527,
  125.255369070295245,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  'new',
  'urgent',
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days'
),

-- Complaint 25
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Lack of Street Lighting',
  'Several streets in our neighborhood have no street lighting at all. The area becomes pitch black at night, making it unsafe for residents to walk. There have been reports of criminal activities taking advantage of the darkness.',
  'Barangay Santa Maria, Residential Streets',
  6.92007115593484,
  125.289106474400697,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  ARRAY['GSO'],
  'new',
  'high',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 26
(
  '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
  'Uncollected Recyclable Materials',
  'The recycling program in our area is not functioning properly. Recyclable materials are being mixed with regular garbage instead of being collected separately. This defeats the purpose of the recycling initiative.',
  'Barangay Poblacion, Zone 2',
  6.95450287579768,
  125.315036677225635,
  'c2b6abd4-7dc8-4b02-9f3f-71a5ed64bae8',
  '9e2d71b1-5731-4726-8867-1e807754bc60',
  'new',
  'low',
  NOW() - INTERVAL '9 days',
  NOW() - INTERVAL '9 days',
  NOW() - INTERVAL '9 days'
),

-- Complaint 27
(
  '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
  'Damaged Public Library Books',
  'Many books in the public library are damaged, torn, or missing pages. The library lacks proper maintenance and new books. Students and researchers are unable to access the resources they need for their studies.',
  'Public Library, Municipal Building',
  6.79757213142240,
  125.266897229165494,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'low',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
),

-- Complaint 28
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Traffic Light Malfunction',
  'The traffic light at the busy intersection of Main Street and Park Avenue is malfunctioning. It either stays red for too long or changes too quickly, causing traffic congestion and near-accidents. This needs immediate repair.',
  'Intersection of Main Street and Park Avenue',
  6.87403443675785,
  125.368417105078990,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  'new',
  'urgent',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days'
),

-- Complaint 29
(
  '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
  'Unmaintained Public Cemetery',
  'The public cemetery is in a state of disrepair. Graves are overgrown with weeds, pathways are damaged, and there is no proper maintenance. Families visiting their loved ones find it difficult to access gravesites.',
  'Public Cemetery, Barangay San Juan',
  6.93962374964324,
  125.388423031836027,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'low',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '10 days'
),

-- Complaint 30
(
  'eada69c6-24e6-479a-9e0f-10c82f49062e',
  'Illegal Dumping Site',
  'An illegal dumping site has been created in an empty lot. People are dumping household waste, construction debris, and other garbage. This is creating environmental and health hazards, and attracting pests and stray animals.',
  'Empty Lot, Barangay San Pedro',
  6.92604881304900,
  125.316520303412489,
  'c2b6abd4-7dc8-4b02-9f3f-71a5ed64bae8',
  '9e2d71b1-5731-4726-8867-1e807754bc60',
  ARRAY['GSO', 'CHO'],
  'new',
  'high',
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days'
),

-- Complaint 31
(
  '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
  'Broken Water Fountain',
  'The decorative water fountain in the town plaza has been broken for months. The pump is not working, the basin is filled with stagnant water and algae, and it has become a breeding ground for mosquitoes.',
  'Town Plaza, Central Area',
  6.96869596102093,
  125.278153129013532,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'low',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 32
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Speeding Vehicles in Residential Area',
  'Vehicles are speeding through our residential neighborhood, ignoring speed limit signs. This is extremely dangerous for children playing and residents walking. We need speed bumps or increased traffic enforcement.',
  'Residential Subdivision, Barangay San Jose',
  6.83912345865078,
  125.388128208612159,
  '1b446065-62cc-41c4-aef8-9feadc0e30b3',
  'b4bd5a0e-d8a9-4074-9f00-f2327f8d72c2',
  'new',
  'high',
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days'
),

-- Complaint 33
(
  '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
  'Inadequate Fire Hydrant Access',
  'Fire hydrants in our area are either blocked by parked vehicles, overgrown vegetation, or are non-functional. In case of a fire emergency, firefighters would have difficulty accessing water sources.',
  'Barangay Poblacion, Various Locations',
  6.86529087728165,
  125.335583243705997,
  '5a0478c0-377b-417a-a5ff-82bc9d33a667',
  '6ac31bee-0623-4f6d-8be1-db6caac24896',
  'new',
  'urgent',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
),

-- Complaint 34
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Unmaintained Public Restroom',
  'The public restroom at the bus terminal is in deplorable condition. There is no running water, broken fixtures, and it is extremely unsanitary. Commuters and visitors are forced to use facilities elsewhere.',
  'Bus Terminal, Transportation Hub',
  6.77057785672102,
  125.255781871103096,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'medium',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 35
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Lack of Wheelchair Accessibility',
  'Public buildings and facilities lack proper wheelchair accessibility. There are no ramps, elevators are not functioning, and doorways are too narrow. This discriminates against persons with disabilities.',
  'Various Public Buildings',
  6.86695920179855,
  125.253482866134846,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  ARRAY['GSO', 'CSWDO'],
  'new',
  'medium',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
),

-- Complaint 36
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Unregulated Construction Noise',
  'Multiple construction projects are operating simultaneously without regard to noise regulations. The constant noise from heavy machinery, drilling, and hammering is disrupting daily life and affecting residents health and well-being.',
  'Commercial and Residential Development Areas',
  6.77405285168093,
  125.295685595907798,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  'new',
  'high',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
),

-- Complaint 37
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Damaged Sidewalk Tiles',
  'Many sidewalk tiles are broken, loose, or missing, creating tripping hazards for pedestrians. Elderly residents and people with mobility issues are particularly at risk. Some areas have become completely impassable.',
  'Main Commercial District, Sidewalks',
  6.79749281602914,
  125.283071960407284,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  'new',
  'medium',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days'
),

-- Complaint 38
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Insufficient Parking Spaces',
  'There are not enough parking spaces in the commercial district. Visitors and workers are forced to park illegally, blocking traffic and creating congestion. We need a public parking facility or more designated parking areas.',
  'Commercial District, Business Area',
  6.76558737486044,
  125.298447569464514,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  'new',
  'high',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
),

-- Complaint 39
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Unmaintained Public Garden',
  'The public garden that was once beautiful is now overgrown and neglected. Weeds have taken over, benches are broken, and the walking paths are damaged. This public space is no longer usable or enjoyable for residents.',
  'Public Garden, Park Area',
  6.74544567431625,
  125.294909645452506,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'low',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days'
),

-- Complaint 40
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Water Quality Concerns',
  'Residents are reporting that tap water has an unusual taste, odor, and sometimes appears discolored. There are concerns about water quality and safety. We need water quality testing and immediate action if contamination is found.',
  'Barangay San Pedro, Residential Areas',
  6.81551366323337,
  125.353536661530057,
  '5a0478c0-377b-417a-a5ff-82bc9d33a667',
  '7bd3a79e-2f63-46bd-933e-d836cf461962',
  ARRAY['WST', 'CHO'],
  'new',
  'urgent',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
),

-- Complaint 41
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Broken Public Benches',
  'Most public benches in parks and plazas are broken, missing slats, or have sharp edges that could injure users. Elderly residents who need to rest while walking have nowhere safe to sit.',
  'Various Parks and Public Spaces',
  6.84587938741675,
  125.311147172300593,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'low',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
),

-- Complaint 42
(
  'eada69c6-24e6-479a-9e0f-10c82f49062e',
  'Inadequate Street Drainage',
  'The street drainage system is clogged with debris and sediment. During even light rain, water accumulates on the streets and does not drain properly. This causes traffic problems and potential flooding.',
  'Barangay Santa Maria, Main Streets',
  6.84659811627030,
  125.317606470590434,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  'new',
  'high',
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days'
),

-- Complaint 43
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Lack of Public Trash Bins',
  'There are very few public trash bins in our area. People are forced to litter or carry their trash for long distances. This contributes to environmental pollution and makes the area look untidy.',
  'Barangay Poblacion, Public Areas',
  6.80233568936477,
  125.326657276967254,
  'c2b6abd4-7dc8-4b02-9f3f-71a5ed64bae8',
  '9e2d71b1-5731-4726-8867-1e807754bc60',
  'new',
  'medium',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),

-- Complaint 44
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Unsafe Playground Surface',
  'The playground surface is made of hard concrete with no safety padding. Children have been injured from falls. We need proper safety surfacing like rubber mats or sand to prevent serious injuries.',
  'Public Park Playground',
  6.89567239450752,
  125.341180317788883,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'high',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days'
),

-- Complaint 45
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Damaged Public Signage',
  'Many public signs including street name signs, directional signs, and information boards are damaged, faded, or missing. This makes navigation difficult for residents and visitors, especially those unfamiliar with the area.',
  'Throughout Municipality',
  6.77788198704354,
  125.265159196701489,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  'd655864c-82b8-4543-a437-88d1c9fa03a4',
  ARRAY['GSO', 'CPDC'],
  'new',
  'low',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days'
),

-- Complaint 46
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Inadequate Public Wi-Fi',
  'The public Wi-Fi service that was promised is either not available, has very weak signal, or frequently disconnects. This limits access to information and services for residents who cannot afford private internet connections.',
  'Public Areas and Municipal Buildings',
  6.81909814427194,
  125.344112834251817,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'low',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days',
  NOW() - INTERVAL '11 days'
),

-- Complaint 47
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Unmaintained Public Market',
  'The public market is in poor condition with damaged stalls, inadequate lighting, poor ventilation, and unsanitary conditions. Vendors and customers are working and shopping in uncomfortable and potentially unsafe conditions.',
  'Public Market, Commercial District',
  6.81943215079731,
  125.249084110904931,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'medium',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
),

-- Complaint 48
(
  '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
  'Insufficient Emergency Services',
  'Response times for emergency services including police, fire, and medical are too long. In emergency situations, every minute counts, and the current response time is unacceptable and potentially life-threatening.',
  'Throughout Municipality',
  6.79464153371716,
  125.351648014145141,
  '5a0478c0-377b-417a-a5ff-82bc9d33a667',
  '6ac31bee-0623-4f6d-8be1-db6caac24896',
  'new',
  'urgent',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),

-- Complaint 49
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Damaged Public Clock Tower',
  'The historic clock tower in the town plaza is damaged and the clock is not working. This is both a functional issue and a loss of cultural heritage. The tower needs restoration and the clock mechanism needs repair.',
  'Town Plaza, Historic Area',
  6.78937409127806,
  125.350287044209267,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'low',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
),

-- Complaint 50
(
  '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
  'Inadequate Public Transportation for Disabled',
  'Public transportation vehicles are not accessible for persons with disabilities. There are no ramps, no designated spaces for wheelchairs, and drivers are not trained to assist disabled passengers.',
  'Public Transportation Routes',
  6.82684156817538,
  125.278264548627405,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'medium',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days'
),

-- Complaint 51
(
  'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
  'Unregulated Pet Waste',
  'Pet owners are not cleaning up after their pets in public areas. Pet waste is left on sidewalks, parks, and playgrounds, creating health hazards and unpleasant conditions for residents.',
  'Public Parks and Sidewalks',
  6.88568404420670,
  125.293612453228960,
  '5a0478c0-377b-417a-a5ff-82bc9d33a667',
  '7bd3a79e-2f63-46bd-933e-d836cf461962',
  'new',
  'medium',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
),

-- Complaint 52
(
  'eada69c6-24e6-479a-9e0f-10c82f49062e',
  'Damaged Public Art Installation',
  'A public art installation that was installed to beautify the area is now damaged and vandalized. The artwork is defaced and some parts are missing. This reflects poorly on the community and wastes public funds.',
  'Town Plaza, Art District',
  6.74802678136237,
  125.355937980584358,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'low',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 53
(
  'eada69c6-24e6-479a-9e0f-10c82f49062e',
  'Insufficient Public Toilets During Events',
  'During public events and festivals, there are not enough public toilet facilities. Long queues form and some people are forced to use inappropriate locations, creating sanitation and health issues.',
  'Event Venues and Public Gathering Areas',
  6.97718808407433,
  125.380868286778593,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'medium',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 54
(
  '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
  'Unmaintained Public Fountains',
  'All public fountains in the municipality are not functioning. They are either broken, have no water supply, or are filled with stagnant water and debris. These features that were meant to beautify the area are now eyesores.',
  'Various Public Spaces',
  6.82317455144414,
  125.248363037480431,
  '4264bb34-b075-4b51-b0be-e6fe07a21bf9',
  '42bfdd34-20f2-4388-ac74-4f9495eaa432',
  'new',
  'low',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
),

-- Complaint 55
(
  'cc1813e0-7df7-4529-941c-660dc3180a78',
  'Inadequate Street Cleaning Equipment',
  'The street cleaning equipment is outdated and insufficient. Streets are not being cleaned effectively, leaving behind dirt, leaves, and debris. We need modern cleaning equipment and more frequent cleaning schedules.',
  'Throughout Municipality',
  6.95826995612537,
  125.328274098729224,
  'c2b6abd4-7dc8-4b02-9f3f-71a5ed64bae8',
  '9e2d71b1-5731-4726-8867-1e807754bc60',
  'new',
  'medium',
  NOW() - INTERVAL '9 days',
  NOW() - INTERVAL '9 days',
  NOW() - INTERVAL '9 days'
);
