/* ============================================================================
   ATLAS · F1 SKYMARK, SECTOR 6, NOIDA · data layer

   One property at the centre, and what is around it. Kept apart by kind, so a
   reader can always tell where a fact came from:

     PROPERTY  the building and what is published about it: the developer's
               page, the operators' listings and Autopilot's own page. Where
               sources disagree (leasable area, floor, plot number) every
               figure is kept with its source and the disagreement is noted.
     MAP       positions, each read from a published record and never placed
               by eye. "building" is pinned to the building; "locality" means
               only the area is known. Every row carries its source.
     MODEL     the 3D twin, built in Blender from one photograph. See
               reconstruction/facade_parameters.json for every dimension, its
               source and its confidence.

   Distances are straight lines from the property's pin, never routed paths.
   The page computes them; none is stored here.
   ============================================================================ */
"use strict";

window.SKY_META = {
 "title": "F1 Skymark",
 "asOf": "2026-11-11",
 "center": [
  77.3189671,
  28.5913167
 ],
 "rings": [
  1,
  3,
  5
 ],
 "speed": {
  "kmh": 22,
  "factor": 1.3,
  "note": "Autopilot's working assumption for peak-hour driving on Noida's sector roads, not a published index"
 },
 "walk": {
  "m_per_min": 80,
  "factor": 1.3,
  "note": "80 m a minute on a path 1.3 times the straight line"
 },
 "method": "Every distance is a straight line from the property's pin, the shortest possible distance and never a road route. Walk and drive times are estimates from that line and say so.",
 "notes": [
  "Property pin comes from one listing (CoworkingCafe JSON-LD). No Google Maps, Wikimapia or OSM pin for the F-1 building itself was retrievable; Moovit's walking distance to Sector 15 metro (1,012 m) vs 1.17 km straight-line from this pin suggests it could be 100 to 200 m off.",
  "myHQ, Amadhi and Dexwork give the EFC address as 'F-39, Second Floor, Sector-6', while Sprint, CoworkingCafe and Autopilot use F-1 (3rd floor). Paytm itself was previously at F-1, so the 'opposite One97/Paytm' wording may refer to Paytm's other Sector 5/6 premises; the B-121 Sector 5 HQ is about 0.29 km from the pin, but 'opposite' is not verified.",
  "Paytm B-121 Sector 5 coordinate was decoded from the India Post DIGIPIN 39J-53L-37MP published on its Mappls page (decoder validated against India Post's Dak Bhawan example 39J-49L-L8T4). DIGIPIN cells are about 4 m.",
  "Zolo Aloha coordinate was decoded from the Plus Code H8WX+RQR in Zolo's published address (decoder validated against Rajnigandha Chowk, Atta Market and India Today pins). Its locality was resolved with the 7JWV prefix used by Noida codes.",
  "myHQ and Dexwork list Botanical Garden (3.4 km) as nearest metro for EFC; that looks wrong. Noida Sector 15 metro is about 1.0 to 1.2 km away.",
  "Developer page states 90,551 sq ft leasable; an Autopilot Offices post states 45,000 sq ft; architect states 125,000 sq ft built-up. The operator centres (Sprint/EFC) each quote 25,000 sq ft and 500 to 550 seats, so Sprint and EFC listings likely describe the same 3rd-floor centre.",
  "Vasundhara Enclave: the Wikipedia infobox coordinate (28.6178, 77.3296) sits about 2 km north of where findlatitudeandlongitude (28.6001, 77.3195) and housing.com (28.6011, 77.3179) place it; the latter pair was used.",
  "Atta Market has no single official pin; the coordinate is a business inside the market (Plus Code H8CG+FFQ), so precision is marked locality.",
  "IGI Airport T3 uses the Wikipedia coordinate of the IGI Airport Airport Express station, which is at Terminal 3. DND toll plaza uses the Wikimapia pin of the Noida toll plaza (toll collection stopped in 2016).",
  "Exa Places (exa.ai/library/place) records are Google-Maps-style business pins republished by Exa; treat them as building-level but not surveyed.",
  "Hotels category has only 4 verified entries; corp has 5. Adobe (I-1A Sector 25A) and Jubilant (1A Sector 16A) addresses were found but no published coordinate, so they were left out.",
  "Mayur Vihar uses the single Wikipedia coordinate for the whole neighbourhood; individual phase centroids were not retrieved."
 ]
};

window.SKY_PROPERTY = {
 "name": "F1 Skymark (Skymark F-1)",
 "address": "Plot No. F-01 (F-1), Sector 6, Noida, Uttar Pradesh 201301",
 "lat": 28.5913167,
 "lng": 77.3189671,
 "precision": "building",
 "geoSrc": "https://overturemaps.org",
 "geoNote": "Centre of the building's own footprint in Overture Maps (1,784 sq m, 59 m by 34 m), the footprint an earlier Autopilot study matched to the client's Street View panorama of the building. The listing pin used before was about 270 m north, on open ground. Every distance on this page is measured from this point.",
 "facts": [
  {
   "k": "Building",
   "v": "Skymark F-1: single G+4 tower with dedicated basements, total leasable area 90,551 sq ft, plot size 2,940 sq m, pitched for IT/ITeS; 'within stone throw distance from metro station and MLCP'",
   "src": "https://www.skymarkgroup.in/our-project-offices.html"
  },
  {
   "k": "Building (alternate figure)",
   "v": "Autopilot Offices post gives total leasable area 45,000 sq ft, G+4 commercial tower, 1000+ seats depending on layout, basement parking (conflicts with the developer's 90,551 sq ft)",
   "src": "https://www.linkedin.com/posts/autopilot0ffices_f1-skymark-activity-7437467291967086592-c4qI"
  },
  {
   "k": "Built-up area (architect)",
   "v": "Office building, plot F1 Sector 6 Noida, built-up area 125,000 sq ft",
   "src": "https://www.sanjivtandon.com/f-1-sec-6/"
  },
  {
   "k": "Operator: Sprint India",
   "v": "Sprint F1 Skymark, 3rd Floor, Sky Mark Building, F1-Sector 6; 25,000 sq ft, 550 workstations; launched 10 July 2025",
   "src": "https://www.prlog.org/13086834-sprint-india-expands-footprint-with-launch-of-premium-coworking-space-at-f1-skymark-noida.html"
  },
  {
   "k": "Operator: EFC",
   "v": "Listed as 'EFC - F1 Skymark Noida': 25,000 sq ft centre, about 500 seats, 1 floor, independent commercial tower",
   "src": "https://myhq.in/dedicated/coworking-space/sprint-efc-sector6"
  },
  {
   "k": "Operator: Autopilot Offices",
   "v": "Managed / built-to-suit offices at F1 Skymark for 50 to 1000 seat teams, seats from Rs 6,500 per month; Altruist Technologies moved in (Aug 2026)",
   "src": "https://landingpage.f1-skymark-noida.autopilotoffices.com/"
  },
  {
   "k": "Desk price",
   "v": "Dedicated desk Rs 7,000 per desk per month, quoted and negotiable (myHQ)",
   "src": "https://myhq.in/coworking-space/sprint-efc-sector6"
  },
  {
   "k": "Desk price (alternate)",
   "v": "Rs 7,500 per seat per month, security deposit Rs 22,500 per seat, lock-in 12 to 36 months",
   "src": "https://leaseinaday.com/properties/sprint-skymark/"
  },
  {
   "k": "Hours",
   "v": "9:30 am to 8:30 pm Monday to Saturday, closed Sunday (myHQ); CoworkingCafe lists 9:00 am to 7:00 pm Monday to Friday; Sprint advertises 24/7 access",
   "src": "https://myhq.in/dedicated/coworking-space/sprint-efc-sector6"
  },
  {
   "k": "Amenities",
   "v": "2 and 4 wheeler parking, wifi, printer, tea, coffee, water, separate washroom, pantry, meeting rooms, air conditioning, charging, power backup, fire extinguisher, security personnel, first aid kit",
   "src": "https://myhq.in/coworking-space/sprint-efc-sector6"
  },
  {
   "k": "Landmark",
   "v": "Opposite One97 / Paytm office (Sector 6)",
   "src": "https://landingpage.f1-skymark-noida.autopilotoffices.com/"
  },
  {
   "k": "Address variants",
   "v": "myHQ and Amadhi give 'F-39, Second Floor, Sector-6, Opp. One 97 and PayTM Office'; CoworkingCafe gives '3rd Floor, F-1, Noida sector 6'; Sprint gives '3rd Floor, Sky Mark Building, F1-Sector 6'",
   "src": "https://www.coworkingcafe.com/coworking-property/in/up/noida/efc-skymark/"
  },
  {
   "k": "Other tenants",
   "v": "Clovia (Purple Panda Fashions Ltd) corporate office, 4th Floor, F-1, Sector 6",
   "src": "http://www.purplepanda.in/pdf/Purple_Panda_Fashions_Limited_Annual_Report-2023-24.pdf"
  },
  {
   "k": "Other tenants",
   "v": "Care Health Insurance branch, 1st and 2nd Floor, Plot No. F1, Sector 6",
   "src": "https://www.myinsuranceclub.com/care/branches/noida"
  },
  {
   "k": "History",
   "v": "Building was earlier a Paytm office ('Paytm Office, F-1, Sector 6, Noida, nearest metro Noida Sector 15', 2019 interview venue; Moovit lists 'Paytm-F1 Sector 6 Noida')",
   "src": "https://careerforfreshers.com/jobs/walkin-interview-for-freshers-paytm-12th-september-2019-mba-2019-pass-outs-hr-recruiter/"
  },
  {
   "k": "Nearest metro",
   "v": "Noida Sector 15 (Blue Line), about 1,012 m, 13 min walk; New Ashok Nagar 2,354 m",
   "src": "https://moovitapp.com/index/en/public_transit-Paytm_F1_Sector_6_Noida_Paytm_Office-Delhi-site_249915616-3801"
  }
 ],
 "listingPin": {
  "lat": 28.593565,
  "lng": 77.3188016,
  "src": "https://www.coworkingcafe.com/coworking-property/in/up/noida/efc-skymark/",
  "note": "The pin a coworking listing gives; it falls on open ground about 270 m north of the building."
 }
};

window.SKY_MODEL = {
 "glb": "./exports/fm_skymark_atlas.glb",
 "blend": "./exports/fm_skymark_final.blend",
 "frontBearing": 146,
 "bearingConfirmed": true,
 "bearingNote": "The twin stands on the building's own footprint, its glass front and podium facing south-east (146 degrees) onto the street, the face with the angular frame along the road to the south-west.",
 "widthM": 27.7,
 "lengthM": 44.7,
 "heightM": 22.5,
 "floors": "G+4",
 "floorToFloorM": 4.1,
 "renders": [
  [
   "01_reference_camera.jpg",
   "From the photograph's viewpoint"
  ],
  [
   "06_context_close.jpg",
   "In its street, from the air"
  ],
  [
   "05_context_500m.jpg",
   "The 500 m around it"
  ],
  [
   "04_three_quarter.jpg",
   "Three-quarter view"
  ],
  [
   "02_front_elevation.jpg",
   "Front elevation"
  ],
  [
   "03_side_elevation.jpg",
   "Side elevation"
  ],
  [
   "00_reference_comparison.jpg",
   "Checked against the photograph's landmarks"
  ]
 ],
 "basis": "Built in Blender from one photograph and the published G+4 floor count: every pane, mullion, cladding panel and frame member is real geometry. Proportions follow the photograph; no length is surveyed. The 500 m around it is built from Overture Maps footprints and roads, with heights from the Copernicus surface model, the same way as the Andheri East world.",
 "report": "./reconstruction/validation_report.json",
 "params": "./reconstruction/facade_parameters.json",
 "contextGlb": "./exports/fm_skymark_context_500m.glb",
 "anchor": {
  "lat": 28.5913167,
  "lng": 77.3189671
 },
 "world": "/noida-skymark/world"
};

window.SKY_TRANSIT = {
 "asOf": "2026-11-11",
 "lines": [
  {
   "key": "blue",
   "name": "Delhi Metro Blue Line",
   "short": "Blue Line",
   "color": "#2b6cb0",
   "src": "https://en.wikipedia.org/wiki/Blue_Line_(Delhi_Metro)",
   "stations": [
    {
     "name": "Mayur Vihar Extension",
     "lat": 28.594211,
     "lng": 77.294664,
     "src": "https://en.wikipedia.org/wiki/Mayur_Vihar_Extension_metro_station"
    },
    {
     "name": "New Ashok Nagar",
     "lat": 28.58916,
     "lng": 77.302067,
     "src": "https://en.wikipedia.org/wiki/New_Ashok_Nagar_metro_station"
    },
    {
     "name": "Noida Sector 15",
     "lat": 28.585156,
     "lng": 77.31158,
     "src": "https://en.wikipedia.org/wiki/Noida_Sector_15_metro_station"
    },
    {
     "name": "Noida Sector 16",
     "lat": 28.578395,
     "lng": 77.317635,
     "src": "https://en.wikipedia.org/wiki/Noida_Sector_16_metro_station"
    },
    {
     "name": "Noida Sector 18",
     "lat": 28.5708129,
     "lng": 77.3261158,
     "src": "https://en.wikipedia.org/wiki/Noida_Sector_18_metro_station"
    },
    {
     "name": "Botanical Garden",
     "lat": 28.5642,
     "lng": 77.3348,
     "src": "https://en.wikipedia.org/wiki/Botanical_Garden_metro_station"
    },
    {
     "name": "Golf Course",
     "lat": 28.567181,
     "lng": 77.346029,
     "src": "https://en.wikipedia.org/wiki/Golf_Course_metro_station"
    },
    {
     "name": "Noida City Centre",
     "lat": 28.5747,
     "lng": 77.3561,
     "src": "https://en.wikipedia.org/wiki/Noida_City_Centre_metro_station"
    }
   ]
  },
  {
   "key": "magenta",
   "name": "Delhi Metro Magenta Line",
   "short": "Magenta Line",
   "color": "#b0306f",
   "src": "https://en.wikipedia.org/wiki/Magenta_Line_(Delhi_Metro)",
   "stations": [
    {
     "name": "Okhla Bird Sanctuary",
     "lat": 28.5528643,
     "lng": 77.3216486,
     "src": "https://en.wikipedia.org/wiki/Okhla_Bird_Sanctuary_metro_station"
    },
    {
     "name": "Botanical Garden (interchange)",
     "lat": 28.5642,
     "lng": 77.3348,
     "src": "https://en.wikipedia.org/wiki/Botanical_Garden_metro_station"
    }
   ]
  }
 ]
};

window.SKY_ANCHORS = [
 {
  "id": "anchor-igi-airport-t3",
  "name": "IGI Airport T3",
  "sub": "IGI Airport metro station (Airport Express, at Terminal 3)",
  "lat": 28.5571,
  "lng": 77.0867,
  "src": "https://en.wikipedia.org/wiki/IGI_Airport_metro_station"
 },
 {
  "id": "anchor-new-delhi-railway-station",
  "name": "New Delhi railway station",
  "sub": "NDLS, Indian Railways",
  "lat": 28.6428,
  "lng": 77.21908,
  "src": "https://en.wikipedia.org/wiki/New_Delhi_railway_station"
 },
 {
  "id": "anchor-connaught-place",
  "name": "Connaught Place",
  "sub": "Rajiv Chowk business district",
  "lat": 28.63278,
  "lng": 77.21972,
  "src": "https://en.wikipedia.org/wiki/Connaught_Place,_New_Delhi"
 },
 {
  "id": "anchor-anand-vihar-isbt",
  "name": "Anand Vihar ISBT",
  "sub": "Swami Vivekanand Inter State Bus Terminus",
  "lat": 28.64722,
  "lng": 77.31611,
  "src": "https://en.wikipedia.org/wiki/Anand_Vihar_ISBT"
 },
 {
  "id": "anchor-anand-vihar-terminal",
  "name": "Anand Vihar Terminal",
  "sub": "Railway station ANVT",
  "lat": 28.650775,
  "lng": 77.3152389,
  "src": "https://en.wikipedia.org/wiki/Anand_Vihar_Terminal_railway_station"
 },
 {
  "id": "anchor-dnd-flyway-noida-toll-plaza",
  "name": "DND Flyway, Noida toll plaza",
  "sub": "Noida end of the DND (toll-free since 2016)",
  "lat": 28.575833,
  "lng": 77.303611,
  "src": "http://wikimapia.org/225985/hi/%E0%A4%A1%E0%A5%80-%E0%A4%8F%E0%A4%A8-%E0%A4%A1%E0%A5%80-%E0%A4%9F%E0%A5%8B%E0%A4%B2-%E0%A4%AA%E0%A5%8D%E0%A4%B2%E0%A4%BE%E0%A4%9C%E0%A4%BE"
 },
 {
  "id": "anchor-film-city-noida",
  "name": "Film City Noida",
  "sub": "Sector 16A media hub",
  "lat": 28.568889,
  "lng": 77.316667,
  "src": "http://wikimapia.org/333907/Film-City-NOIDA"
 },
 {
  "id": "anchor-rajnigandha-chowk",
  "name": "Rajnigandha Chowk",
  "sub": "Junction of Sectors 3, 14, 17 and 19",
  "lat": 28.577222,
  "lng": 77.318611,
  "src": "http://wikimapia.org/162791/Rajnigandha-Chowk"
 },
 {
  "id": "anchor-mahamaya-flyover",
  "name": "Mahamaya Flyover",
  "sub": "Start of Noida-Greater Noida Expressway",
  "lat": 28.556111,
  "lng": 77.325278,
  "src": "https://wikimapia.org/9694193/Mahamaya-Flyover"
 },
 {
  "id": "anchor-akshardham",
  "name": "Akshardham",
  "sub": "Swaminarayan Akshardham, Pandav Nagar",
  "lat": 28.6125,
  "lng": 77.27722,
  "src": "https://en.wikipedia.org/wiki/Swaminarayan_Akshardham_(Delhi)"
 }
];

window.SKY_PLACES = [
 {
  "id": "corp-one97-communications-paytm-corporat",
  "kind": "corp",
  "name": "One97 Communications (Paytm) corporate office",
  "sub": "B-121, Sector 5; likely the 'opposite One97/Paytm' landmark",
  "lat": 28.591448,
  "lng": 77.320475,
  "precision": "building",
  "src": "https://www.mappls.com/of94cr"
 },
 {
  "id": "corp-hcl-corporation-hcltech-sector-3",
  "kind": "corp",
  "name": "HCL Corporation / HCLTech, Sector 3",
  "sub": "A-9, Block A, Sector 3 (HCLTech HQ address is A-10/11, Sector 3)",
  "lat": 28.579234,
  "lng": 77.317295,
  "precision": "building",
  "src": "https://exa.ai/library/place/php19vp8qc5"
 },
 {
  "id": "corp-tv-today-network-india-today-mediap",
  "kind": "corp",
  "name": "TV Today Network (India Today Mediaplex)",
  "sub": "FC-8, Film City, Sector 16A (back gate pin)",
  "lat": 28.569519,
  "lng": 77.317934,
  "precision": "building",
  "src": "https://exa.ai/library/place/b36mq240hh4"
 },
 {
  "id": "corp-express-trade-towers-network18-indi",
  "kind": "corp",
  "name": "Express Trade Towers (Network18, Indian Express)",
  "sub": "Plot 15-16, Film City, Sector 16A",
  "lat": 28.567906,
  "lng": 77.31551,
  "precision": "building",
  "src": "https://exa.ai/library/place/8pjp465z72n"
 },
 {
  "id": "corp-oil-india-limited-corporate-office",
  "kind": "corp",
  "name": "Oil India Limited corporate office",
  "sub": "Plot 19, Sector 16A (PSU)",
  "lat": 28.566164,
  "lng": 77.316519,
  "precision": "building",
  "src": "https://exa.ai/library/place/6dbt921l33g"
 },
 {
  "id": "cowork-amigo-coworking",
  "kind": "cowork",
  "name": "Amigo Coworking",
  "sub": "C-25, Udhyog Marg, Sector 8; desks from Rs 5,999",
  "lat": 28.5939169,
  "lng": 77.3244498,
  "precision": "building",
  "src": "https://www.coworkingcafe.com/coworking-property/in/up/noida/amigo-coworking/"
 },
 {
  "id": "cowork-91springboard-sector-1",
  "kind": "cowork",
  "name": "91Springboard Sector 1",
  "sub": "C-2, Block C, Sector 1",
  "lat": 28.589323,
  "lng": 77.314566,
  "precision": "building",
  "src": "https://www.coworkingcafe.com/coworking-property/in/dl/noida/91springboard-sector-1/"
 },
 {
  "id": "cowork-myworx-sector-1",
  "kind": "cowork",
  "name": "Myworx Sector 1",
  "sub": "Myworx Zone B-9, next to Sector 15 metro; 24/7",
  "lat": 28.5879927,
  "lng": 77.3137166,
  "precision": "building",
  "src": "https://www.coworkingcafe.com/coworking-property/in/up/noida/sector-1-next-to-sector-15-metro-station/"
 },
 {
  "id": "cowork-91springboard-sector-2",
  "kind": "cowork",
  "name": "91Springboard Sector 2",
  "sub": "Plot D-107, Sector 2",
  "lat": 28.5837454,
  "lng": 77.3164231,
  "precision": "building",
  "src": "https://www.coworkingcafe.com/coworking-property/in/up/noida/91springboard-sector-2-64/"
 },
 {
  "id": "cowork-myworx-sector-4",
  "kind": "cowork",
  "name": "Myworx Sector 4",
  "sub": "A-22, Sector 4; 24/7",
  "lat": 28.5839319,
  "lng": 77.3231094,
  "precision": "building",
  "src": "https://www.coworkingcafe.com/coworking-property/in/up/noida/sector-4-1/"
 },
 {
  "id": "cowork-awfis-majestic-omnia",
  "kind": "cowork",
  "name": "Awfis Majestic Omnia",
  "sub": "A-110, 3rd Floor, Sector 4; about 384 seats",
  "lat": 28.5821686,
  "lng": 77.3233414,
  "precision": "building",
  "src": "https://www.coworkingcafe.com/coworking-property/in/up/noida/majestic-omnia/"
 },
 {
  "id": "cowork-wework-berger-delhi-one",
  "kind": "cowork",
  "name": "WeWork Berger Delhi One",
  "sub": "C-001/A2, Sector 16B, 19-floor tower",
  "lat": 28.574136,
  "lng": 77.313606,
  "precision": "building",
  "src": "https://exa.ai/library/place/zwysh3r138c"
 },
 {
  "id": "edu-cambridge-school",
  "kind": "edu",
  "name": "Cambridge School",
  "sub": "Sector 27; CBSE",
  "lat": 28.572222,
  "lng": 77.328333,
  "precision": "building",
  "src": "https://wikimapia.org/346370/Cambridge-School-Sector-27-Noida"
 },
 {
  "id": "edu-apeejay-school",
  "kind": "edu",
  "name": "Apeejay School",
  "sub": "Film City, Sector 16A; CBSE, 16-acre campus",
  "lat": 28.570857,
  "lng": 77.313781,
  "precision": "building",
  "src": "https://exa.ai/library/place/bsqty1fw0vz"
 },
 {
  "id": "edu-delhi-public-school-noida",
  "kind": "edu",
  "name": "Delhi Public School Noida",
  "sub": "Sector 30; DPS Society core school",
  "lat": 28.574618,
  "lng": 77.335809,
  "precision": "building",
  "src": "https://exa.ai/library/place/flcj0vd06yv"
 },
 {
  "id": "edu-aaft-asian-academy-of-film-and-telev",
  "kind": "edu",
  "name": "AAFT (Asian Academy of Film and Television)",
  "sub": "FC-14/15, Film City, Sector 16A; also a studio complex at B-122 Sector 5",
  "lat": 28.569063,
  "lng": 77.315374,
  "precision": "building",
  "src": "https://exa.ai/library/place/0dy7vsknhvk"
 },
 {
  "id": "edu-ahlcon-international-school",
  "kind": "edu",
  "name": "Ahlcon International School",
  "sub": "Mayur Vihar Phase 1, Delhi",
  "lat": 28.61199,
  "lng": 77.288071,
  "precision": "building",
  "src": "https://exa.ai/library/place/43sr0rxssst"
 },
 {
  "id": "edu-government-pg-college-noida",
  "kind": "edu",
  "name": "Government PG College Noida",
  "sub": "I-1, Sector 39; CCS University affiliated",
  "lat": 28.572526,
  "lng": 77.354681,
  "precision": "building",
  "src": "https://exa.ai/library/place/f9ylzq5q64b"
 },
 {
  "id": "res-vasundhara-enclave-delhi",
  "kind": "res",
  "name": "Vasundhara Enclave, Delhi",
  "sub": "Group housing societies on the Delhi side",
  "lat": 28.600087,
  "lng": 77.31952,
  "precision": "locality",
  "src": "https://www.findlatitudeandlongitude.com/l/Vasundhara+Enclave%2C+New+Delhi%2C+Delhi%2C+India/1588917/"
 },
 {
  "id": "res-sector-14-noida",
  "kind": "res",
  "name": "Sector 14, Noida",
  "sub": "Residential, near DND / Rajnigandha",
  "lat": 28.5864671,
  "lng": 77.3075402,
  "precision": "locality",
  "src": "http://wikimapia.org/48548/Sector-14"
 },
 {
  "id": "res-sector-15-noida",
  "kind": "res",
  "name": "Sector 15, Noida",
  "sub": "Plotted residential sector next to Sector 15 metro",
  "lat": 28.581944,
  "lng": 77.31,
  "precision": "locality",
  "src": "http://wikimapia.org/12663890/Sector-15"
 },
 {
  "id": "res-sector-19-noida",
  "kind": "res",
  "name": "Sector 19, Noida",
  "sub": "Residential, next to Sector 18 market",
  "lat": 28.578333,
  "lng": 77.324444,
  "precision": "locality",
  "src": "http://wikimapia.org/6829725/Sector-19"
 },
 {
  "id": "res-new-kondli-delhi",
  "kind": "res",
  "name": "New Kondli, Delhi",
  "sub": "East Delhi neighbourhood",
  "lat": 28.606885,
  "lng": 77.3303818,
  "precision": "locality",
  "src": "http://wikimapia.org/110717/New-Kondli"
 },
 {
  "id": "res-sector-12-noida",
  "kind": "res",
  "name": "Sector 12, Noida",
  "sub": "Residential, Metro Hospital area",
  "lat": 28.595,
  "lng": 77.338333,
  "precision": "locality",
  "src": "http://wikimapia.org/562854/Sector-12"
 },
 {
  "id": "res-sector-26-noida",
  "kind": "res",
  "name": "Sector 26, Noida",
  "sub": "Residential, blocks A to E",
  "lat": 28.579167,
  "lng": 77.335,
  "precision": "locality",
  "src": "http://wikimapia.org/12996405/Sector-26"
 },
 {
  "id": "res-mayur-vihar-delhi",
  "kind": "res",
  "name": "Mayur Vihar, Delhi",
  "sub": "East Delhi residential area, three phases",
  "lat": 28.6077,
  "lng": 77.2992,
  "precision": "locality",
  "src": "https://en.wikipedia.org/wiki/Mayur_Vihar"
 },
 {
  "id": "pg-sector-15-boy-s-pg",
  "kind": "pg",
  "name": "Sector 15 Boy's PG",
  "sub": "C Block, Sector 15",
  "lat": 28.58401,
  "lng": 77.310286,
  "precision": "building",
  "src": "https://exa.ai/library/place/yq39j9ypvms"
 },
 {
  "id": "pg-mongia-s-boys-guesthouse",
  "kind": "pg",
  "name": "Mongia's Boys Guesthouse",
  "sub": "E-218, near Noida Public Library, E Block, Sector 15",
  "lat": 28.58086,
  "lng": 77.3084546,
  "precision": "building",
  "src": "https://getmypg.com/pg/mongias-boys-guesthouse-28-58086-77-3084546/"
 },
 {
  "id": "pg-pinkpg-in-noida-sector-15",
  "kind": "pg",
  "name": "Pinkpg.in Noida Sector 15",
  "sub": "E-226, near Metro Station Road, Sector 15",
  "lat": 28.5802493,
  "lng": 77.309131,
  "precision": "building",
  "src": "https://getmypg.com/pg/pinkpgin-noida-sector-15-28-5802493-77-309131/"
 },
 {
  "id": "pg-zolo-cosmopolis",
  "kind": "pg",
  "name": "Zolo Cosmopolis",
  "sub": "Zolo coliving, H.No. 620 opp. F-40, Sector 27 (Atta Market); from Rs 6,723",
  "lat": 28.572702,
  "lng": 77.326699,
  "precision": "building",
  "src": "https://exa.ai/library/place/69qyryxg41v"
 },
 {
  "id": "pg-zolo-aloha",
  "kind": "pg",
  "name": "Zolo Aloha",
  "sub": "Zolo coliving, near Rana Tower, Chaura, Sector 22; from Rs 6,074",
  "lat": 28.597113,
  "lng": 77.349391,
  "precision": "building",
  "src": "https://zolostays.com/pg-hostel-near-sector_22-in-noida-zolo_aloha-znd055"
 },
 {
  "id": "retail-atta-market",
  "kind": "retail",
  "name": "Atta Market",
  "sub": "Sector 27 street market and food hub (pin on a shop inside the market)",
  "lat": 28.571212,
  "lng": 77.326237,
  "precision": "locality",
  "src": "https://exa.ai/library/place/y6lzdmht1tq"
 },
 {
  "id": "retail-the-great-india-place",
  "kind": "retail",
  "name": "The Great India Place",
  "sub": "Plot A-2, Sector 38A, next to Sector 18 metro",
  "lat": 28.5684,
  "lng": 77.3258,
  "precision": "building",
  "src": "https://en.wikipedia.org/wiki/The_Great_India_Place"
 },
 {
  "id": "retail-centre-stage-mall",
  "kind": "retail",
  "name": "Centre Stage Mall",
  "sub": "Sector 18",
  "lat": 28.5677943,
  "lng": 77.3228703,
  "precision": "building",
  "src": "http://wikimapia.org/110739/Centre-Stage-Mall"
 },
 {
  "id": "retail-dlf-mall-of-india",
  "kind": "retail",
  "name": "DLF Mall of India",
  "sub": "Plot M-03, Sector 18; about 330 brands",
  "lat": 28.567341,
  "lng": 77.32113,
  "precision": "building",
  "src": "https://exa.ai/library/place/y9tlbw29994"
 },
 {
  "id": "retail-brahmaputra-market",
  "kind": "retail",
  "name": "Brahmaputra Market",
  "sub": "Sector 29 street food market",
  "lat": 28.570104,
  "lng": 77.332684,
  "precision": "building",
  "src": "https://exa.ai/library/place/80k8jrz6qjc"
 },
 {
  "id": "retail-gardens-galleria",
  "kind": "retail",
  "name": "Gardens Galleria",
  "sub": "Plot A-2, Sector 38A",
  "lat": 28.564783,
  "lng": 77.321791,
  "precision": "building",
  "src": "https://exa.ai/library/place/dztv6pyb3y4"
 },
 {
  "id": "retail-logix-city-centre",
  "kind": "retail",
  "name": "Logix City Centre",
  "sub": "BW-58, Sector 32, near Noida City Centre metro",
  "lat": 28.57399,
  "lng": 77.353591,
  "precision": "building",
  "src": "https://exa.ai/library/place/3gs5yg64bjr"
 },
 {
  "id": "hotel-holiday-inn-new-delhi-mayur-vihar-",
  "kind": "hotel",
  "name": "Holiday Inn New Delhi Mayur Vihar Noida",
  "sub": "13A Mayur Vihar District Centre (IHG)",
  "lat": 28.590348,
  "lng": 77.298357,
  "precision": "building",
  "src": "https://exa.ai/library/place/dmgcsfh6j0z"
 },
 {
  "id": "hotel-fortune-sector-27-itc",
  "kind": "hotel",
  "name": "Fortune Sector 27 (ITC)",
  "sub": "Plot 1A, Block I, Sector 27; 42 rooms",
  "lat": 28.577161,
  "lng": 77.328252,
  "precision": "building",
  "src": "https://exa.ai/library/place/fbbytx7hsm0"
 },
 {
  "id": "hotel-mosaic-hotel-noida",
  "kind": "hotel",
  "name": "Mosaic Hotel Noida",
  "sub": "C-1, Sector 18; 48 rooms",
  "lat": 28.571066,
  "lng": 77.325249,
  "precision": "building",
  "src": "https://exa.ai/library/place/psk6y76v03w"
 },
 {
  "id": "hotel-radisson-blu-mbd-hotel-noida",
  "kind": "hotel",
  "name": "Radisson Blu MBD Hotel Noida",
  "sub": "L-2, Sector 18; five-star",
  "lat": 28.568448,
  "lng": 77.32266,
  "precision": "building",
  "src": "https://exa.ai/library/place/8khfxmw9gs3"
 },
 {
  "id": "health-metro-hospitals-and-heart-institu",
  "kind": "health",
  "name": "Metro Hospitals and Heart Institute",
  "sub": "X-1, Sector 12 (multispeciality wing at L-94, Sector 11)",
  "lat": 28.597384,
  "lng": 77.337954,
  "precision": "building",
  "src": "https://exa.ai/library/place/x76vg3vrwlg"
 },
 {
  "id": "health-kailash-hospital-and-heart-instit",
  "kind": "health",
  "name": "Kailash Hospital and Heart Institute",
  "sub": "H-33, Sector 27",
  "lat": 28.577663,
  "lng": 77.331651,
  "precision": "building",
  "src": "https://exa.ai/library/place/rm5j9hgy9qq"
 },
 {
  "id": "health-max-hospital-sector-19",
  "kind": "health",
  "name": "Max Hospital, Sector 19",
  "sub": "Wikimapia label 'Max Hospital, Sec 19'; current facility type and status not verified",
  "lat": 28.5741674,
  "lng": 77.3229253,
  "precision": "building",
  "src": "http://wikimapia.org/108740/Max-Hospital-Sec-19"
 },
 {
  "id": "health-post-graduate-institute-of-child-",
  "kind": "health",
  "name": "Post Graduate Institute of Child Health",
  "sub": "Sector 30, government paediatric institute",
  "lat": 28.576972,
  "lng": 77.337688,
  "precision": "building",
  "src": "https://exa.ai/library/place/w2vvs5k5t56"
 },
 {
  "id": "health-esic-model-hospital",
  "kind": "health",
  "name": "ESIC Model Hospital",
  "sub": "A-3, Tulsi Marg, Sector 24",
  "lat": 28.59142,
  "lng": 77.347285,
  "precision": "building",
  "src": "https://exa.ai/library/place/f4tsblzwxc0"
 },
 {
  "id": "health-max-super-speciality-hospital-pat",
  "kind": "health",
  "name": "Max Super Speciality Hospital, Patparganj",
  "sub": "108A, I.P. Extension, Delhi",
  "lat": 28.632938,
  "lng": 77.309003,
  "precision": "building",
  "src": "https://exa.ai/library/place/x8vxwlxf227"
 }
];

