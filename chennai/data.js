/* ============================================================================
   ATLAS · CHENNAI OFFICE STUDY · data layer

   Generated from the research files for this study and kept apart by kind,
   so a reader can always tell where a fact came from:

     SHEET    the client's revised shortlist (BFS_Atlas_2.xlsx): name, micro-market
              and address of each of the 18 properties, carried over as given.
     MAP      positions for every building, each with a precision class
              (building / street / locality), a note on how it was placed
              and a source. Checked by reverse geocoding.
     RESEARCH public sources for rail, talent, studios and the office market,
              each with a URL, a date and a confidence word.

   Micro-market groupings are Autopilot's, following the broker definitions
   noted on each zone; the sheet's own label is kept on every option.
   ============================================================================ */
"use strict";

window.CHN_META = {
 "title": "Chennai Office Study",
 "asOf": "2026-10-06",
 "center": [
  80.172,
  12.948
 ],
 "zoom": 10.7,
 "sheet": "BFS_Atlas_2.xlsx: the client's revised shortlist of 18 properties (name, micro-market, address)",
 "speed": {
  "kmh": 16,
  "factor": 1.3,
  "note": "TomTom Traffic Index 2025 rush-hour average for Chennai, 1.3x road factor assumed",
  "src": "https://www.tomtom.com/traffic-index/city/chennai/"
 },
 "nextSteps": [
  "Agree the priorities on Your priorities with the people who will sign, then shortlist the top three for site visits.",
  "Visit at shift change (around 8 to 9 pm) and time the drive from today's office and the walk from the nearest station; drive times here are estimates.",
  "Ask every landlord for the same five numbers: available floor plate, carpet efficiency, rent, CAM and escalation, so options compare like for like.",
  "Power and cooling: feeder or transformer capacity, 100% DG backup, UPS space and a machine room that can take render load; ask for 12 months of outage logs.",
  "Content security: confirm the floor allows the access control, CCTV and isolated network rooms that studio client audits (such as TPN) expect.",
  "Connectivity: two internet providers with separate building entries, and lead times for leased lines.",
  "Flood history: ask how the basement, access road and power room fared in December 2023.",
  "Night shifts: cab bays and a safe drop-off point; Tamil Nadu allows women on night shifts with written consent, transport and a POSH committee.",
  "Incentives: check whether the site's taluk is an 'A' or 'B' district under the Tamil Nadu AVGC-XR Policy 2026 before applying."
 ]
};

/* The current office: every option is read against it. */
window.CHN_EXISTING = {
 "id": "commerzone",
 "name": "KRC Commerzone",
 "label": "Current office",
 "locality": "Porur, Mount Poonamallee Road",
 "micro": "mpr",
 "lat": 13.029556,
 "lng": 80.169474,
 "precision": "building",
 "geoNote": "Place pin for Hitachi Energy, addressed 'Tower A, Commerzone, Mount Poonamallee Rd, Porur'. Basilic Fly Studio's own place listing (https://exa.ai/library/place/5vyjlz7jhy7) sits 31 m away at 13.029434, 80.169196, which is the generic campus pin. Both fall inside OSM way 1545061818 'Commerzone' (campus polygon, https://nominatim.openstreetmap.org/search?q=Commerzone+Chennai&format=json&limit=5). Which side of the campus Tower A occupies is not independently confirmed; error is at most the campus width (~250 m).",
 "geoSrc": "https://exa.ai/library/place/xz3g9zvc1r9",
 "src": "https://archives.nseindia.com/annual_reports/SME_AR_26099_BASILIC_2023_2024_0609202423340.pdf",
 "note": "Registered and corporate office at Tower A, KRC Commerzone, Porur (annual report 2023-24)."
};

/* The shortlist, in the sheet's order. */
window.CHN_OPTIONS = [
 {
  "id": "futura-tech-park",
  "n": 1,
  "name": "Futura Tech Park",
  "sheetName": "Futura Tech Park",
  "micro": "omr2",
  "sheetMicro": "Sholinganallur",
  "address": "No. 334, Rajiv Gandhi Salai (OMR), Ezhil Nagar, Elcot SEZ, Sholinganallur, Chennai 600119",
  "lat": 12.909663,
  "lng": 80.226899,
  "precision": "building",
  "geoNote": "Block A is the PayPal building (Cityinfo: Block A 'occupied by PayPal India Development Centre', https://properties.cityinfoservices.com/futura-tech-park-block-a-sholinganallur-chennai/qsw5qkn/pjd). Point is the centroid of OSM way 355100244 'PayPal, 334 Rajiv Gandhi Salai', inside OSM way 540617460 'Futura IT Park'. The Google-derived pin for the park (https://exa.ai/library/place/czs3d6wd331, 12.909114, 80.228220, plus code W65H+J7) is ~155 m east at the OMR frontage.",
  "geoSrc": "https://www.openstreetmap.org/way/355100244",
  "facts": [
   {
    "k": "Developer",
    "v": "X Office Parks (owner/operator)",
    "src": "https://x-officeparks.com/futura-tech-park/"
   },
   {
    "k": "Type",
    "v": "IT park campus (5 acres, multiple blocks)",
    "src": "https://x-officeparks.com/futura-tech-park/"
   },
   {
    "k": "Size",
    "v": "~650,000 sq ft campus (owner); Block A ~376,000 sq ft (Cityinfo)",
    "src": "https://x-officeparks.com/futura-tech-park/"
   },
   {
    "k": "Status",
    "v": "Operational",
    "src": "https://x-officeparks.com/futura-tech-park/"
   }
  ]
 },
 {
  "id": "asv-avantt",
  "n": 2,
  "name": "ASV Avantt",
  "sheetName": "ASV Avantt",
  "micro": "omr2",
  "sheetMicro": "Thoraipakkam",
  "address": "No. 193, Old Mahabalipuram Road, Thoraipakkam, Chennai 600097",
  "lat": 12.939563,
  "lng": 80.235422,
  "precision": "building",
  "geoNote": "Decoded from the Google plus code in the listing's address 'W6QP+R5F, OMR Service Rd, Gandhi Nagar, Thoraipakkam 600097' (code centre, ~3 m cell). Single source. Sits ~100 m east of the ASV Suntech Park place pin (12.939317, 80.234536, https://exa.ai/library/place/tzj7xfbpw2t), which Magicbricks names as the neighbouring hub. Not in OSM.",
  "geoSrc": "https://office.addressadvisors.com/properties/asv-avantt",
  "facts": [
   {
    "k": "Developer",
    "v": "ASV Constructions",
    "src": "https://asvgroup.in/business-scape/"
   },
   {
    "k": "Type",
    "v": "Standalone building (stilt + 4 floors)",
    "src": "https://properties.cityinfoservices.com/asv-avantt-thoraipakkam-chennai/9nzuml4/pjd"
   },
   {
    "k": "Size",
    "v": "~44,000 sq ft (developer); ~46,000 sq ft built-up (Cityinfo)",
    "src": "https://asvgroup.in/business-scape/"
   },
   {
    "k": "Status",
    "v": "Operational; completed 2017",
    "src": "https://properties.cityinfoservices.com/asv-avantt-thoraipakkam-chennai/9nzuml4/pjd"
   }
  ]
 },
 {
  "id": "casagrand-ecotech",
  "n": 3,
  "name": "Casagrand Ecotech",
  "sheetName": "Casagrand Ecotech",
  "micro": "omr2",
  "sheetMicro": "Sholinganallur",
  "address": "Wipro Street, Elcot SEZ, Sholinganallur, Chennai 600119",
  "lat": 12.906844,
  "lng": 80.225303,
  "precision": "building",
  "geoNote": "Casagrand Ecotech is Wipro's former CDC-2 campus at No. 475-A Wipro Street (Wipro's site list: 'CDC2 - Casagrand Biz, No. 475-A, Wipro Street', https://www.wipro.com/content/dam/nexus/en/corporate-sustainability/pdf/list-of-wipro-owned-and-leased-sites-global.pdf). Point is the Google-derived place pin 'Wipro Limited, 475 A, Wipro St'. OSM way 733490388 'Wipro CDC 2 Lawn Area with a Ampitheatre' is 40 m west, confirming the campus. Campus is 14 acres, so a pin is campus-level.",
  "geoSrc": "https://exa.ai/library/place/2dsh1vl43w9",
  "facts": [
   {
    "k": "Developer",
    "v": "Casagrand (Casagrand Bizpark Pvt Ltd bought the campus from Wipro in Sept 2023)",
    "src": "https://www.thehindubusinessline.com/info-tech/wipro-sells-14-acre-land-building-in-chennais-sholinganallur-to-casagrand-bizpark/article67345205.ece"
   },
   {
    "k": "Type",
    "v": "IT/ITES campus, 8 towers on 14.02 acres",
    "src": "https://www.casagrand.co.in/commercial/completed-projects-chennai-sholinganallur/casagrand-ecotech/"
   },
   {
    "k": "Size",
    "v": "~600,000 sq ft (0.6 msf)",
    "src": "https://www.casagrand.co.in/commercial/completed-projects-chennai-sholinganallur/casagrand-ecotech/"
   },
   {
    "k": "Status",
    "v": "Operational; original buildings 2003 (CBRE year built), revamped by Casagrand",
    "src": "https://www.cbre.co.in/properties/office-space-for-rent-chennai/details/IN-SMPL-189616/casagrand-ecotech-475a-wipro-street-chennai-tn-600119"
   }
  ]
 },
 {
  "id": "asv-bascon-futura",
  "n": 4,
  "name": "ASV Bascon Futura",
  "sheetName": "ASV Bascon Futura",
  "micro": "omr1",
  "sheetMicro": "Perungudi",
  "address": "Bethel Nagar Street, Industrial Estate, Perungudi, Chennai 600096",
  "lat": 12.956186,
  "lng": 80.246495,
  "precision": "street",
  "geoNote": "No pin found for the building (not in OSM, no place listing found). Placed at the centroid of OSM way 232405024 'Bethel Nagar street' (about 250 m long), the street in the address; JLL gives '117B, Bethel Nagar St' and RERA gives 'Plot 116 and 117A, Industrial Estate Main Road, Perungudi EEI estate'. Exact plot unconfirmed.",
  "geoSrc": "https://www.openstreetmap.org/way/232405024",
  "facts": [
   {
    "k": "Developer",
    "v": "ASV Constructions",
    "src": "https://asvgroup.in/business-scape/"
   },
   {
    "k": "Type",
    "v": "Standalone building (stilt + 4 floors, IT/ITES)",
    "src": "https://properties.cityinfoservices.com/asv-bascon-futura-perungudi-chennai/vxn6rhy/pjd"
   },
   {
    "k": "Size",
    "v": "~144,000 sq ft super built-up (~0.14 msf)",
    "src": "https://asvgroup.in/business-scape/"
   },
   {
    "k": "Status",
    "v": "Operational per listing",
    "src": "https://properties.cityinfoservices.com/asv-bascon-futura-perungudi-chennai/vxn6rhy/pjd"
   }
  ]
 },
 {
  "id": "sai-real-tech",
  "n": 5,
  "name": "Sai Real Tech Park",
  "sheetName": "Sai Real Tech Park",
  "micro": "vel",
  "sheetMicro": "Velachery",
  "address": "Velachery-Taramani 100 Ft Road, Velachery, Chennai 600042",
  "lat": 12.982574,
  "lng": 80.231348,
  "precision": "building",
  "geoNote": "Sai Real Tech Park is the TCS Velachery building at 165/1A (TCS GST registration: '165/1A, Sai Real Tech Park, Velachery Taramani 100 Ft Road', https://calculator.taxadda.com/gstin-details/TATA_CONSULTANCY_SERVICES_LIMITED-33AAACR4849R2ZR-rhiv1bp3e4m6fc9). Point is the centroid of OSM building way 263257940 'Tata Consultance Service, TCS, 165/1A'. Google place data for TCS at that address (https://opencorpdata.com/place/ChIJgxK9E4JdUjoRSu7Qjyc6r7c) gives 12.9825124, 80.2314518, ~10 m away.",
  "geoSrc": "https://www.openstreetmap.org/way/263257940",
  "facts": [
   {
    "k": "Developer",
    "v": "Real Value Promoters (built 2003-2005)",
    "src": "http://www.realvalue.in/the_real_value_timeline/"
   },
   {
    "k": "Type",
    "v": "IT building fully leased to a single tenant (TCS)",
    "src": "https://www.icra.in/Rating/ShowRationalReportFilePdf/137134"
   },
   {
    "k": "Size",
    "v": "~250,000 sq ft (owned by Adyar Gate Hotels Ltd)",
    "src": "https://www.icra.in/Rating/ShowRationalReportFilePdf/137134"
   },
   {
    "k": "Status",
    "v": "Operational; fully leased to TCS since 2005",
    "src": "https://www.icra.in/Rating/ShowRationalReportFilePdf/137134"
   }
  ],
  "flag": {
   "v": "Availability: the building has been leased in full to TCS since 2005 (ICRA). Confirm which floors are actually on offer.",
   "src": "https://www.icra.in/Rating/ShowRationalReportFilePdf/137134"
  }
 },
 {
  "id": "gateway-office-parks",
  "n": 6,
  "name": "Gateway Office Parks",
  "sheetName": "Gateway Office Parks",
  "micro": "gst",
  "sheetMicro": "Perungalathur",
  "address": "GST Road, New Perungalathur, Chennai 600063",
  "lat": 12.899667,
  "lng": 80.092366,
  "precision": "building",
  "geoNote": "OSM node 13011503001 'Gateway Office Parks'. Google-derived place pin (https://exa.ai/library/place/gxdkfh0xy3j, 12.900121, 80.091790) is ~80 m west on the GST Road frontage. Large multi-block campus, so the pin is campus-level, not a specific block.",
  "geoSrc": "https://www.openstreetmap.org/node/13011503001",
  "facts": [
   {
    "k": "Developer",
    "v": "X Office Parks (owner/operator)",
    "src": "https://x-officeparks.com/gateway-office-park-2/"
   },
   {
    "k": "Type",
    "v": "Office campus, predominantly SEZ, 31 acres",
    "src": "https://x-officeparks.com/gateway-office-park-2/"
   },
   {
    "k": "Size",
    "v": "4.7 msf master plan (2.1 msf SEZ operational when the page was written)",
    "src": "https://x-officeparks.com/gateway-office-park-2/"
   },
   {
    "k": "Status",
    "v": "Operational",
    "src": "https://exa.ai/library/place/gxdkfh0xy3j"
   }
  ]
 },
 {
  "id": "kar-towers",
  "n": 7,
  "name": "KAR Towers",
  "sheetName": "Kar Towers",
  "micro": "gst",
  "sheetMicro": "Pallavaram",
  "address": "GST Road, Abdul Kalam Nagar, Pallavaram, Chennai 600044",
  "lat": 12.963158,
  "lng": 80.146168,
  "precision": "building",
  "geoNote": "Google-derived place pin for Smoke Hub BBQ, whose address is 'Kar Towers, Grand Southern Trunk Rd, Periyar Nagar, Pallavaram 600044'. Door no. 158 GST Road from company registrations (https://qorpiq.com/company/lph-pharma-private-limited/U24231TN1995PTC033975). Not in OSM. Pin is a tenant pin, so it is on the building but may sit off its centre.",
  "geoSrc": "https://exa.ai/library/place/sbmddtz7797",
  "facts": [
   {
    "k": "Type",
    "v": "Standalone building (stilt + 6 floors)",
    "src": "https://properties.cityinfoservices.com/kar-tower-pallavaram-chennai/iqvxgfp/pjd"
   },
   {
    "k": "Size",
    "v": "~157,904 sq ft built-up",
    "src": "https://properties.cityinfoservices.com/kar-tower-pallavaram-chennai/iqvxgfp/pjd"
   },
   {
    "k": "Status",
    "v": "Operational (space listed as ready to move)",
    "src": "https://properties.cityinfoservices.com/kar-tower-for-rent-in-pallavaram-chennai/vm5d68z/prd"
   }
  ]
 },
 {
  "id": "fayola-towers",
  "n": 8,
  "name": "Fayola Towers",
  "sheetName": "Fayola Towers",
  "micro": "ptr",
  "sheetMicro": "Pallikaranai",
  "address": "200 Feet Radial Road, Pallikaranai, Chennai 600100",
  "lat": 12.947917,
  "lng": 80.20925,
  "precision": "building",
  "geoNote": "OSM node 3883257762 'Fayola Towers' (office). Agrees within ~15 m with the plus code W6X5+6P4 quoted in a listing address (https://office.addressadvisors.com/properties/fayola-towers). About 110 m east of the KRC Commerzone Pallikaranai pin, consistent with the shared 'Ganesh Avenue, Rose Avenue' address.",
  "geoSrc": "https://www.openstreetmap.org/node/3883257762",
  "facts": [
   {
    "k": "Developer",
    "v": "Cee Dee Yes",
    "src": "https://properties.cityinfoservices.com/fayola-tower-velachery-chennai/usw53di/pjd"
   },
   {
    "k": "Type",
    "v": "Standalone building (7 floors + basement)",
    "src": "https://properties.cityinfoservices.com/fayola-tower-velachery-chennai/usw53di/pjd"
   },
   {
    "k": "Size",
    "v": "~192,000 sq ft built-up",
    "src": "https://properties.cityinfoservices.com/fayola-tower-velachery-chennai/usw53di/pjd"
   },
   {
    "k": "Status",
    "v": "Operational; possession Dec 2006",
    "src": "https://www.magicbricks.com/fayola-towers-pallikaranai-chennai-pdpid-4d4235333139323639"
   }
  ]
 },
 {
  "id": "pacifica-tech-park",
  "n": 9,
  "name": "Pacifica Tech Park",
  "sheetName": "Pacifica Tech Park",
  "micro": "omr2",
  "sheetMicro": "Navalur",
  "address": "Rajiv Gandhi Salai (OMR), Navalur, Chennai 600130",
  "lat": 12.843555,
  "lng": 80.225067,
  "precision": "building",
  "geoNote": "Centroid of OSM building way 355088432 'Pacifica', Rajiv Gandhi Salai, Navalur. Google-derived pin 'Pacifica Tech Park' (https://exa.ai/library/place/11np63l3t70, 12.843822, 80.225226) is 35 m away; the 'Security Entrance' pin (https://exa.ai/library/place/38q6yw7f4wk) is on the OMR side at 12.844216, 80.226440.",
  "geoSrc": "https://www.openstreetmap.org/way/355088432",
  "facts": [
   {
    "k": "Developer",
    "v": "Pacifica Companies",
    "src": "https://pacificacompanies.co.in/project/tech-park/"
   },
   {
    "k": "Type",
    "v": "IT park, two towers on 7.29 acres",
    "src": "https://pacificacompanies.co.in/project/tech-park/"
   },
   {
    "k": "Size",
    "v": "~1.1 msf",
    "src": "https://pacificacompanies.co.in/project/tech-park/"
   },
   {
    "k": "Status",
    "v": "Operational; Block I completed 2007",
    "src": "https://properties.cityinfoservices.com/pacifica-tech-park-block-a-navallur-chennai/pixhak6/pjd"
   }
  ]
 },
 {
  "id": "brigade-vantage",
  "n": 10,
  "name": "Brigade Vantage",
  "sheetName": "Brigade Vantage",
  "micro": "omr1",
  "sheetMicro": "Perungudi",
  "address": "OMR Service Road, Perungudi, Chennai 600096",
  "lat": 12.966076,
  "lng": 80.248191,
  "precision": "building",
  "geoNote": "Centroid of OSM way 1548832004 'Brigade Vantage' (retail landuse polygon around the building). Google-derived pin (https://exa.ai/library/place/xhdxcd8qpk3, 12.966170, 80.248004) is ~20 m away.",
  "geoSrc": "https://www.openstreetmap.org/way/1548832004",
  "facts": [
   {
    "k": "Developer",
    "v": "Brigade Group",
    "src": "https://www.brigadegroup.com/retail/projects/chennai/brigade-vantage"
   },
   {
    "k": "Type",
    "v": "Standalone office + retail building (4 floors, 2 basement levels)",
    "src": "https://properties.cityinfoservices.com/brigade-vantage-perungudi-chennai/uge34og/pjd"
   },
   {
    "k": "Size",
    "v": "~180,000 sq ft built-up",
    "src": "https://properties.cityinfoservices.com/brigade-vantage-perungudi-chennai/uge34og/pjd"
   },
   {
    "k": "Status",
    "v": "Operational (IndiQube centre of ~67,000 sq ft inside)",
    "src": "https://myhq.in/managed-office/indiqube-brigade-vantage"
   }
  ]
 },
 {
  "id": "prince-infocity-2",
  "n": 11,
  "name": "Prince Infocity II",
  "sheetName": "Prince Infocity II",
  "micro": "omr1",
  "sheetMicro": "Perungudi",
  "address": "Rajiv Gandhi Salai (OMR), Perungudi, Chennai 600096",
  "lat": 12.968506,
  "lng": 80.248995,
  "precision": "building",
  "geoNote": "Google-derived place pin for 'Prince Infocity II', Rajiv Gandhi Salai 600096. Wikimapia object 10220604 (http://wikimapia.org/10220604/Prince-Infocity-II) gives 12d58m6s N 80d15m0s E (12.96833, 80.25000), about 110 m away, consistent. Building is not in OSM.",
  "geoSrc": "https://exa.ai/library/place/y0mw4ztbdnj",
  "facts": [
   {
    "k": "Developer",
    "v": "Prince Foundations (named as the listing's alias and website)",
    "src": "https://exa.ai/library/place/y0mw4ztbdnj"
   },
   {
    "k": "Type",
    "v": "Standalone Grade A office building",
    "src": "https://www.workthere.com/en-gb/spaces/regus-perungudi/"
   },
   {
    "k": "Status",
    "v": "Operational (Awfis centre on 13th floor)",
    "src": "https://myhq.in/managed-office/awfis-perungudi-4"
   }
  ]
 },
 {
  "id": "tvh-agnitio",
  "n": 12,
  "name": "TVH Agnitio Park",
  "sheetName": "TVH Agnitio Park",
  "micro": "omr1",
  "sheetMicro": "Perungudi",
  "address": "141, Rajiv Gandhi Salai (OMR), Nehru Nagar, Perungudi, Chennai 600096",
  "lat": 12.970183,
  "lng": 80.250348,
  "precision": "building",
  "geoNote": "OSM node 11226824437 'TVH Agnitio Park' on the OMR service road. Google-derived pin (https://exa.ai/library/place/jhyzkn3j8cj, 12.969935, 80.250644) is ~40 m away.",
  "geoSrc": "https://www.openstreetmap.org/node/11226824437",
  "facts": [
   {
    "k": "Developer",
    "v": "True Value Homes (TVH)",
    "src": "https://properties.cityinfoservices.com/tvh-agnitio-park-perungudi-chennai/cw3ts5o/pjd"
   },
   {
    "k": "Type",
    "v": "IT park building (12 floors)",
    "src": "https://properties.cityinfoservices.com/tvh-agnitio-park-perungudi-chennai/cw3ts5o/pjd"
   },
   {
    "k": "Size",
    "v": "~698,500 sq ft built-up per Cityinfo; JLL says 3.5 lakh sq ft",
    "src": "https://properties.cityinfoservices.com/tvh-agnitio-park-perungudi-chennai/cw3ts5o/pjd"
   },
   {
    "k": "Status",
    "v": "Operational",
    "src": "https://property.jll.co.in/listings/awfis-space-solutions-limited-tvh-agnitio-old-mahabalipuram-road"
   }
  ]
 },
 {
  "id": "chennai-one",
  "n": 13,
  "name": "Chennai One",
  "sheetName": "Chennai One",
  "micro": "ptr",
  "sheetMicro": "Thoraipakkam",
  "address": "Pallavaram-Thoraipakkam 200 Ft Road, Thoraipakkam, Chennai 600097",
  "lat": 12.947412,
  "lng": 80.231991,
  "precision": "building",
  "geoNote": "Centroid of OSM way 158846663 'Chennai One SEZ' (campus polygon). Google-derived place pin (https://exa.ai/library/place/rf0hqjssnlf, 12.947852, 80.232207) is ~55 m away.",
  "geoSrc": "https://www.openstreetmap.org/way/158846663",
  "facts": [
   {
    "k": "Developer",
    "v": "IG3 Infra Limited",
    "src": "https://chennai1.in/about-us/"
   },
   {
    "k": "Type",
    "v": "IT SEZ campus",
    "src": "https://chennai1.in/"
   },
   {
    "k": "Status",
    "v": "Operational",
    "src": "https://chennai1.in/"
   }
  ]
 },
 {
  "id": "asv-hussainy",
  "n": 14,
  "name": "ASV Hussainy Tech Park",
  "sheetName": "ASV Hussainy Tech Park",
  "micro": "mpr",
  "sheetMicro": "Mugalivakkam / Manapakkam",
  "address": "Mount Poonamallee High Road, Sabari Nagar, Mugalivakkam, Chennai 600089",
  "lat": 13.025947,
  "lng": 80.173422,
  "precision": "building",
  "geoNote": "Centroid of OSM way 122063529 'ASV Hussainy' on Mount Poonamallee Road, beside the Husainy Trust campus and the north edge of DLF IT Park. The streets of Sabari Nagar, named in the address, start about 300 m west (OSM ways 41497785 and 206836606). About 590 m east of today's office at Commerzone.",
  "geoSrc": "https://www.openstreetmap.org/way/122063529",
  "facts": [
   {
    "k": "Developer",
    "v": "ASV Constructions",
    "src": "https://asvgroup.in/business-scape/"
   },
   {
    "k": "Type",
    "v": "IT/ITES tech park with separate MLCP",
    "src": "https://asvgroup.in/business-scape/"
   },
   {
    "k": "Size",
    "v": "Phase 1 ~1 msf; a further ~4 msf planned",
    "src": "https://asvgroup.in/business-scape/"
   },
   {
    "k": "Status",
    "v": "Phase 1 built; floors listed 'ready for fit outs' (listing undated; Magicbricks still shows 'Ongoing')",
    "src": "https://properties.cityinfoservices.com/asv-hussainy-tech-park-for-rent-in-mount-poonamalle-high-road-chennai/gz6j4xj/prd"
   }
  ]
 },
 {
  "id": "fintech-tower",
  "n": 15,
  "name": "Fintech Tower",
  "sheetName": "Fintech Tower",
  "micro": "mpr",
  "sheetMicro": "Nandambakkam / Manapakkam",
  "address": "Mount Poonamallee Road, Nandambakkam, Chennai 600089",
  "lat": 13.016592,
  "lng": 80.188406,
  "precision": "building",
  "geoNote": "Centroid of OSM building way 1383486893 'Fintech Tower'. Google-derived pin 'TIDCO FINTECH TOWER' (https://exa.ai/library/place/jnyj2w8bf2n, 13.016615, 80.188321) is ~10 m away. Inside OSM way 1530042363 'Fintech City'.",
  "geoSrc": "https://www.openstreetmap.org/way/1383486893",
  "facts": [
   {
    "k": "Developer",
    "v": "TIDCO (Tamil Nadu Industrial Development Corporation)",
    "src": "https://tidco.com/fintech2.php"
   },
   {
    "k": "Type",
    "v": "Standalone multi-tenant office tower (2 basements, 3 podiums, 9 floors)",
    "src": "https://tidco.com/fintech2.php"
   },
   {
    "k": "Size",
    "v": "~556,000 sq ft built-up",
    "src": "https://www.newindianexpress.com/states/tamil-nadu/2026/Mar/02/tamil-nadu-cm-stalin-inaugurates-rs-249-crore-fintech-tower-in-nandambakkam"
   },
   {
    "k": "Status",
    "v": "Completed; inaugurated 2 March 2026",
    "src": "https://www.newindianexpress.com/states/tamil-nadu/2026/Mar/02/tamil-nadu-cm-stalin-inaugurates-rs-249-crore-fintech-tower-in-nandambakkam"
   }
  ],
  "flag": {
   "v": "Eligibility: TIDCO offers this tower to financial and fintech companies, and its first allotments went to fintech firms. Confirm a VFX studio can lease here before shortlisting it.",
   "src": "https://tidco.com/fintech2.php"
  }
 },
 {
  "id": "bhaggyam-yukti",
  "n": 16,
  "name": "Bhaggyam Yukti",
  "sheetName": "Bhaggyam Yukti",
  "micro": "omr1",
  "sheetMicro": "Perungudi",
  "address": "Industrial Estate, Perungudi, Chennai 600096",
  "lat": 12.954948,
  "lng": 80.246909,
  "precision": "building",
  "geoNote": "Google-derived place pin 'Bhaggyam Yukti, 87 Industrial Estate, Perungudi'. Not in OSM. ~145 m from the Bethel Nagar street point used for ASV Bascon Futura, consistent with both being in the Perungudi EEI industrial estate near WTC Chennai.",
  "geoSrc": "https://exa.ai/library/place/mp6gycwkm30",
  "facts": [
   {
    "k": "Developer",
    "v": "Bhaggyam Constructions",
    "src": "https://verified.realestate/rera/offline-buildings/TN-29-Building-0254-2023/1-ms-bhaggyam-constructions-pvt-ltd-bhaggyam-yukti"
   },
   {
    "k": "Type",
    "v": "Standalone IT/ITES building (stilt + 4 floors)",
    "src": "https://verified.realestate/rera/offline-buildings/TN-29-Building-0254-2023/1-ms-bhaggyam-constructions-pvt-ltd-bhaggyam-yukti"
   },
   {
    "k": "Size",
    "v": "~40,214 sq ft built-up",
    "src": "https://properties.cityinfoservices.com/bhaggyam-yukti-perungudi-chennai/3uhfaph/pjd"
   },
   {
    "k": "Status",
    "v": "Operational; first tenant moved in March 2026 (RERA completion date Dec 2026)",
    "src": "https://www.linkedin.com/posts/prabhasa-raya-0a1a1a92_chennairealestate-omr-commercialleasing-activity-7443664417864736768-m1v9"
   }
  ]
 },
 {
  "id": "cove-the-hub",
  "n": 17,
  "name": "Cove (The Hub)",
  "sheetName": "Cove - The Hub",
  "micro": "omr1",
  "sheetMicro": "Kandhanchavadi / Perungudi",
  "address": "Prince Infocity 1, Old Mahabalipuram Road, Kandhanchavadi, Perungudi, Chennai 600096",
  "lat": 12.968426,
  "lng": 80.248388,
  "precision": "building",
  "geoNote": "Place pin for Cove Offices OMR, 7th and 8th floor, Prince Infocity 1, 50 1st Street, Kandhanchavadi (address from coveoffices.com). About 65 m west of the Prince Infocity II pin, consistent with the two Prince buildings on neighbouring OMR plots. Not in OSM.",
  "geoSrc": "https://exa.ai/library/place/xgzv5v392yg",
  "facts": [
   {
    "k": "Type",
    "v": "Coworking and managed offices run by Cove Offices on the 7th and 8th floors of Prince Infocity 1",
    "src": "https://coveoffices.com/location/coworking-space-in-omr/"
   }
  ],
  "flag": {
   "v": "Format: a coworking and managed-office centre on two floors. Check it can give a dedicated, access-controlled studio floor.",
   "src": "https://coveoffices.com/location/coworking-space-in-omr/"
  }
 },
 {
  "id": "casagrand-paragon",
  "n": 18,
  "name": "Casagrand Paragon",
  "sheetName": "Casagrand Paragon",
  "micro": "ptr",
  "sheetMicro": "Pallavaram",
  "address": "200 Feet Radial Road, Raja Joseph Colony, Pallavaram, Chennai 600043",
  "lat": 12.955543,
  "lng": 80.153856,
  "precision": "locality",
  "geoNote": "No pin found for the building. Address No. 2 is at the western start of the Radial Road. Point is the centroid of OSM way 1557225143 'Pallavaram - Thoraipakkam Road' (first ~1 km east of the Pallavaram flyover). The developer brochure map labels Vels college, Embassy Splendid TechZone and Saravana Selvarathnam store as neighbours, all on this stretch (store at No. 9 Radial Rd, plus code X534+RJ, 12.95456, 80.15656). The true plot could be up to ~500 m from this point; do not show as a building pin.",
  "geoSrc": "https://www.openstreetmap.org/way/1557225143",
  "facts": [
   {
    "k": "Developer",
    "v": "Casagrand",
    "src": "https://www.casagrand.co.in/commercial/ongoing-projects-chennai-thoraipakkam/casagrand-the-paragon/"
   },
   {
    "k": "Type",
    "v": "Standalone IT/ITES tower (G+10) on 1.91 acres",
    "src": "https://www.casagrand.co.in/wp-content/uploads/2024/08/Paragon-brochure.pdf"
   },
   {
    "k": "Size",
    "v": "~360,000 sq ft leasable",
    "src": "https://www.casagrand.co.in/commercial/ongoing-projects-chennai-thoraipakkam/casagrand-the-paragon/"
   },
   {
    "k": "Status",
    "v": "Under construction (listed under Casagrand ongoing projects; a listing shows possession Dec 2027, RERA TN/29/Building/0403/2024)",
    "src": "https://housivity.com/office-space-for-sale-in-pallavaram-chennai-pid-680399d37725b855fdc0f275"
   }
  ],
  "flag": {
   "v": "Timing: under construction; a listing shows possession in Dec 2027 (RERA TN/29/Building/0403/2024).",
   "src": "https://housivity.com/office-space-for-sale-in-pallavaram-chennai-pid-680399d37725b855fdc0f275"
  }
 }
];

/* Micro-markets. Rent, vacancy and stock come from one source (Savills, Dec 2025)
   so they compare like for like; a newer figure is shown beside each where one exists. */
window.CHN_ZONES = [
 {
  "key": "omr1",
  "label": "OMR pre-toll",
  "name": "OMR pre-toll: Perungudi and Kandanchavadi",
  "color": "#a3502c",
  "shape": {
   "type": "band",
   "from": [
    80.2512,
    12.9722
   ],
   "to": [
    80.2458,
    12.9528
   ],
   "w": 0.9
  },
  "character": "Chennai's prime tech and GCC address: the deepest talent and amenities, the highest rents, tight vacancy and little new supply until 2028.",
  "rent": {
   "v": "INR 100-130 per sq ft a month quoted (Savills, OMR Zone 1)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "lo": 100,
   "hi": 130,
   "alt": {
    "v": "Newer: INR 80-125 for Perungudi and Taramani (Knight Frank, H1 2026)",
    "src": "https://content.knightfrank.com/research/3116/documents/en/india-real-estate-office-and-residential-market-h1-2026-12927.pdf"
   }
  },
  "vacancy": {
   "v": "8.0% (Savills, OMR Zone 1)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "alt": {
    "v": "8.95% for Suburban South (Cushman & Wakefield, Q2 2026)",
    "src": "https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q2/apac-and-gc/india---chennai---office---q2-2026---final.pdf"
   }
  },
  "stock": {
   "v": "26.1 msf Grade A and premium Grade B (Savills)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "alt": {
    "v": "A supply vacuum until 2028 (Mindspace REIT, Mar 2026)",
    "src": "https://www.mindspacereit.com/wp-content/uploads/2026/03/Mindspace-REIT-Press-Release.pdf"
   }
  },
  "pros": [
   "Deepest tech and GCC talent pool: OMR Zone 1 took about 40% of Chennai absorption in H1 2026 (CBRE, via The Hindu).",
   "MRTS at Perungudi and Taramani today; Phase 2 metro stations on OMR at Kandanchavadi and Perungudi, elevated section targeted for Mar 2027.",
   "Blue-chip neighbours such as Amazon and Workday help employer branding and recruiting."
  ],
  "cons": [
   "The most expensive micro-market on the list, with about 8% vacancy and little new supply: few contiguous 500-seat floors.",
   "Peak-hour gridlock on OMR while metro works continue; a 25-minute Thoraipakkam to Perungudi run took about 2 hours in a Sep 2026 traffic trial.",
   "Borders Pallikaranai marsh; about 45 cm of rain fell on OMR on 4 Dec 2023."
  ],
  "occupiers": {
   "v": "Amazon (8.3 lakh sq ft, WTC Perungudi), Workday GCC (1.94 lakh sq ft, Millenia Business Park), Fidelity, Siemens, Guidehouse, Tablespace",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf"
  },
  "sources": [
   "https://www.thehindu.com/real-estate/chennai-office-space-demand-stays-strong-as-gccs-drive-growth/article71422601.ece",
   "https://www.livechennai.com/detailnews.asp?catid=7&newsid=67408",
   "https://www.dlf.in/offices/chennai/downtown",
   "https://timesofindia.indiatimes.com/city/chennai/metros-elevated-corridors-to-be-completed-by-2027/articleshow/128043983.cms",
   "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "https://www.mindspacereit.com/wp-content/uploads/2026/03/Mindspace-REIT-Press-Release.pdf",
   "https://timesofindia.indiatimes.com/city/chennai/traffic-experiment-backfires-omr-chokes-police-rollback-changes/articleshow/134444574.cms",
   "https://www.thenewsminute.com/tamil-nadu/chennai-rains-why-does-the-citys-it-corridor-flood-after-heavy-rains",
   "https://chennaimetrorail.org/wp-content/uploads/2026/03/Contract-Signing-Grade-Separators-at-Perungudi-PR-25-09.03.2026-English.pdf"
  ]
 },
 {
  "key": "omr2",
  "label": "OMR post-toll",
  "name": "OMR post-toll: Thoraipakkam, Sholinganallur, Navalur",
  "color": "#a86a12",
  "shape": {
   "type": "band",
   "from": [
    80.2362,
    12.9425
   ],
   "to": [
    80.2244,
    12.8405
   ],
   "w": 1.0
  },
  "character": "Large-campus value belt with SEZ stock and a VFX peer (DNEG) on site: cheaper and roomier, but far from west Chennai and flood-exposed. Brokers class Thoraipakkam here, south of the old Perungudi toll.",
  "rent": {
   "v": "INR 55-69 per sq ft a month quoted (Savills, OMR Zone 2)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "lo": 55,
   "hi": 69,
   "alt": {
    "v": "Newer: INR 65.93 average for Peripheral South (Cushman & Wakefield, Q2 2026)",
    "src": "https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q2/apac-and-gc/india---chennai---office---q2-2026---final.pdf"
   }
  },
  "vacancy": {
   "v": "15.6% (Savills, OMR Zone 2)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "alt": {
    "v": "12.33% for Peripheral South (Cushman & Wakefield, Q2 2026)",
    "src": "https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q2/apac-and-gc/india---chennai---office---q2-2026---final.pdf"
   }
  },
  "stock": {
   "v": "12.5 msf (Savills, OMR Zone 2)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "alt": {
    "v": "14.4 msf with 1.5 msf more to 2028 (Cushman & Wakefield, Q2 2026)",
    "src": "https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q2/apac-and-gc/india---chennai---office---q2-2026---final.pdf"
   }
  },
  "pros": [
   "The lowest-cost OMR space, with 12 to 16% vacancy: leverage for a 500-seat block.",
   "VFX talent already here: DNEG opened its Chennai studio in Sholinganallur in 2017, sized for 500+ staff.",
   "Sholinganallur becomes the Corridor 3 and Corridor 5 metro interchange; elevated OMR line targeted for Mar 2027."
  ],
  "cons": [
   "The longest commute from today's office in Porur and from west Chennai.",
   "Sholinganallur, Semmancheri and Karapakkam stayed flooded for days after Cyclone Michaung (Dec 2023).",
   "No metro running yet, and road barricades for metro works expected for at least another year (Feb 2026)."
  ],
  "occupiers": {
   "v": "Wipro, HCL, Tech Mahindra, Cognizant and Sutherland in the ELCOT SEZ; TCS, PayPal, Nokia, Accenture; DNEG's VFX studio at Tek Meadows, Sholinganallur",
   "src": "https://elcot.tn.gov.in/itparks/"
  },
  "sources": [
   "https://content.knightfrank.com/research/3116/documents/en/india-real-estate-office-and-residential-market-h1-2026-12927.pdf",
   "https://www.animationxpress.com/latest-news/visual-effects-studio-double-negative-officially-opens-its-new-studio-in-chennai/",
   "https://chennaimetrorail.org/wp-content/uploads/2024/01/Phase-II-Route-Map.pdf",
   "https://timesofindia.indiatimes.com/city/chennai/metros-elevated-corridors-to-be-completed-by-2027/articleshow/128043983.cms",
   "https://www.thehindu.com/news/cities/chennai/72-hours-and-counting-many-parts-of-south-chennai-and-omr-still-inundated-as-resources-deplete-for-residents/article67611809.ece"
  ]
 },
 {
  "key": "ptr",
  "label": "Radial Road",
  "name": "200 Ft Radial Road (Pallavaram to Thoraipakkam)",
  "color": "#2f6f9f",
  "shape": {
   "type": "band",
   "from": [
    80.2338,
    12.9478
   ],
   "to": [
    80.1525,
    12.9552
   ],
   "w": 0.9
  },
  "character": "Chennai's newest institutional campus corridor: big modern floor plates and fresh availability at rents below OMR, all hanging off one congested road across the marsh.",
  "rent": {
   "v": "INR 75-85 per sq ft a month for Grade A quoted (Savills, PTR)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "lo": 75,
   "hi": 85,
   "alt": {
    "v": "Newer: INR 80-90 (Mindspace REIT, Mar 2026)",
    "src": "https://www.mindspacereit.com/wp-content/uploads/2026/03/Mindspace-REIT-Press-Release.pdf"
   }
  },
  "vacancy": {
   "v": "26.4% after about 2 msf completed in late 2025 (Savills, PTR)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium"
  },
  "stock": {
   "v": "10.7 msf (Savills, PTR)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "alt": {
    "v": "4 to 5 msf more over five years (JLL, via The Hindu, Sep 2026)",
    "src": "https://www.thehindu.com/real-estate/chennai-office-space-demand-stays-strong-as-gccs-drive-growth/article71422601.ece"
   }
  },
  "pros": [
   "The best odds of a contiguous 500-seat floor: about 26% vacancy and new towers delivering 2025 to 2027.",
   "Grade A campuses with institutional owners (Mindspace, Embassy) at rents below OMR Zone 1.",
   "Links OMR, Velachery, GST Road and the airport; Corridor 5 metro stations near the western end, targeted for Mar 2027."
  ],
  "cons": [
   "One arterial carrying about 1.25 lakh vehicles a day; the marsh section cannot be widened.",
   "Cut off by floods after Michaung (Dec 2023); a 2 km elevated replacement over the marsh means years of works.",
   "No metro on the corridor itself yet; potholes and unconnected drains reported in Aug 2026."
  ],
  "occupiers": {
   "v": "Shell (about 55% of leased area at Commerzone Pallikaranai), Walmart, Vestas, State Street (ITPC Radial Road), Cognizant for a US Bancorp GCC (6.5 lakh sq ft pre-lease, Embassy Splendid TechZone), WeWork, CoWrks",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/03/Mindspace-REIT-Press-Release.pdf"
  },
  "sources": [
   "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "https://www.mindspacereit.com/wp-content/uploads/2026/03/Mindspace-REIT-Press-Release.pdf",
   "https://chennaimetrorail.org/wp-content/uploads/2024/01/Phase-II-Route-Map.pdf",
   "https://timesofindia.indiatimes.com/city/chennai/metros-elevated-corridors-to-be-completed-by-2027/articleshow/128043983.cms",
   "https://www.thehindu.com/news/cities/chennai/bridge-to-replace-part-of-pallavaram-thoraipakkam-radial-road-on-pallikaranai-marshland/article71463911.ece",
   "https://www.thehindu.com/news/cities/chennai/plans-under-way-for-elevated-corridor-on-thoraipakkam-pallavaram-radial-road/article69061881.ece",
   "https://www.thehindu.com/news/cities/chennai/72-hours-and-counting-many-parts-of-south-chennai-and-omr-still-inundated-as-resources-deplete-for-residents/article67611809.ece",
   "https://timesofindia.indiatimes.com/city/chennai/highways-dept-in-slumber-as-craters-disrupt-commute-on-radial-road/articleshow/133126349.cms"
  ]
 },
 {
  "key": "gst",
  "label": "GST Road",
  "name": "GST Road: Pallavaram to Perungalathur",
  "color": "#4f7a2e",
  "shape": {
   "type": "band",
   "from": [
    80.1478,
    12.9655
   ],
   "to": [
    80.0905,
    12.8975
   ],
   "w": 0.9
  },
  "character": "The cheapest and emptiest Grade A belt, with suburban rail and the airport close by: strong value, but peripheral and prone to festival traffic and waterlogging.",
  "rent": {
   "v": "INR 55-60 per sq ft a month quoted (Savills, GST Road)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "lo": 55,
   "hi": 60,
   "alt": {
    "v": "Newer: INR 46-55 (JLL, via The Hindu, Sep 2026)",
    "src": "https://www.thehindu.com/real-estate/chennai-office-space-demand-stays-strong-as-gccs-drive-growth/article71422601.ece"
   }
  },
  "vacancy": {
   "v": "46.8% (Savills, GST Road)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "alt": {
    "v": "29.25% for Peripheral South-west (Cushman & Wakefield, Q2 2026)",
    "src": "https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q2/apac-and-gc/india---chennai---office---q2-2026---final.pdf"
   }
  },
  "stock": {
   "v": "4.8 msf (Savills, GST Road)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium"
  },
  "pros": [
   "The lowest rents on the list and very high vacancy: the strongest negotiating hand.",
   "Suburban rail spine (Pallavaram, Chromepet, Tambaram, Perungalathur) and quick airport access from the Pallavaram end.",
   "Large campuses such as Gateway Office Parks already run shift-based IT and BPO operations (Accenture, Sutherland)."
  ],
  "cons": [
   "Weekend and festival gridlock on the Pallavaram to Tambaram and Perungalathur stretches.",
   "Under an hour of rain flooded GST Road between Chromepet and Pallavaram in Apr 2026.",
   "Far from the city's tech-talent and film belts; the airport to Kilambakkam metro still awaits approval (Aug 2026)."
  ],
  "occupiers": {
   "v": "Accenture, Sutherland (Gateway Office Parks), Visteon, Hinduja Tech",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf"
  },
  "sources": [
   "https://www.thehindu.com/real-estate/chennai-office-space-demand-stays-strong-as-gccs-drive-growth/article71422601.ece",
   "https://x-officeparks.com/gateway-office-park-2/",
   "https://www.thehindu.com/news/cities/chennai/weekend-and-festival-jams-persist-on-two-stretches-of-gst-road/article67579417.ece",
   "https://timesofindia.indiatimes.com/city/chennai/rush-after-long-holiday-chokes-gst-road/articleshow/124323275.cms",
   "https://www.dtnext.in/news/chennai/rainwater-stagnates-on-gst-road-between-chromepet-pallavaram",
   "https://www.thehindu.com/news/cities/chennai/work-on-culverts-to-prevent-flooding-on-gst-road-in-pallavaram-and-chromepet-to-begin-soon/article69769537.ece",
   "https://www.thehindu.com/news/national/tamil-nadu/tamil-nadu-budget-2026-efforts-are-on-to-get-centres-approval-for-three-chennai-metro-rail-extension-projects/article71309298.ece"
  ]
 },
 {
  "key": "mpr",
  "label": "MP Road",
  "name": "Mount Poonamallee Road: Porur, Mugalivakkam, Manapakkam, Nandambakkam",
  "color": "#7a4a8c",
  "shape": {
   "type": "band",
   "from": [
    80.166,
    13.031
   ],
   "to": [
    80.1915,
    13.015
   ],
   "w": 0.8
  },
  "character": "Today's office is here: a maturing second IT corridor with blue-chip campuses, the metro arriving now, the film belt next door and the city's largest future supply.",
  "rent": {
   "v": "INR 75-88 per sq ft a month quoted (Savills, Mount Poonamallee Road)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "lo": 75,
   "hi": 88,
   "alt": {
    "v": "Newer: INR 75-100 (Knight Frank, H1 2026)",
    "src": "https://content.knightfrank.com/research/3116/documents/en/india-real-estate-office-and-residential-market-h1-2026-12927.pdf"
   }
  },
  "vacancy": {
   "v": "8.7% (Savills, Mount Poonamallee Road)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "alt": {
    "v": "8.17% for South-west (Cushman & Wakefield, Q2 2026); Commerzone Porur 100% committed",
    "src": "https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q2/apac-and-gc/india---chennai---office---q2-2026---final.pdf"
   }
  },
  "stock": {
   "v": "13.5 msf (Savills, Mount Poonamallee Road)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "medium",
   "alt": {
    "v": "6 to 8 msf more over five years, the most of any submarket (JLL, via The Hindu, Sep 2026)",
    "src": "https://www.thehindu.com/real-estate/chennai-office-space-demand-stays-strong-as-gccs-drive-growth/article71422601.ece"
   }
  },
  "pros": [
   "Least disruption: today's team keeps its commute pattern.",
   "The Poonamallee to Porur to Vadapalani metro opens on 11 Oct 2026; Corridor 5 stations at Ramapuram, Manapakkam and Trade Centre are under construction.",
   "Next to the film and post-production belt (Vadapalani, Saligramam), with the deepest future supply for expansion."
  ],
  "cons": [
   "Metro and drain works keep MP Road and Arcot Road slow: Porur to Vadapalani can take 40 minutes (Sep 2026).",
   "Flood pockets along the Manapakkam canal (Dec 2023, also 2015 and 2021).",
   "The best existing buildings are full (vacancy about 8%), so a 500-seat block may need new supply or a pre-commitment."
  ],
  "occupiers": {
   "v": "Citi, Barclays, Photon, ZF; LTIMindtree (L&T Innovation Campus); Hitachi Energy, HDFC, SMBC, Ramboll (Commerzone Porur); Apple GCC reported at DLF Cyber City (about 20,000 sq ft)",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf"
  },
  "sources": [
   "https://www.mindspacereit.com/portfolio/chennai-commerzone-porur",
   "https://timesofindia.indiatimes.com/city/chennai/chennai-metro-phase-2-stretch-to-open-on-oct-11-trains-will-not-be-driverless-until-mid-2027/articleshow/134600807.cms",
   "https://chennaimetrorail.org/wp-content/uploads/2024/01/Phase-II-Route-Map.pdf",
   "https://www.thehindu.com/features/metroplus/the-road-to-stardom/article7554330.ece",
   "https://www.dtnext.in/news/chennai/delay-in-re-laying-of-mount-poonamallee-road-leads-to-frequent-accidents",
   "https://timesofindia.indiatimes.com/city/chennai/traffic-on-chennais-arcot-road-worsens-amid-metro-construction-illegal-parking-and-drainage-work/articleshow/133893092.cms",
   "https://timesofindia.indiatimes.com/city/chennai/lack-of-retaining-wall-for-canal-caused-flooding-in-manapakkam-mugalivakkam/articleshow/106259011.cms"
  ]
 },
 {
  "key": "vel",
  "label": "Velachery",
  "name": "Velachery",
  "color": "#1f7a7a",
  "shape": {
   "type": "ellipse",
   "c": [
    80.23,
    12.9815
   ],
   "rx": 1.0,
   "ry": 0.8
  },
  "character": "Central-south retail and residential hub with rail links, but thin Grade A stock and the city's worst flood record. No broker publishes Velachery on its own; the figures below are a wider grouping.",
  "rent": {
   "v": "INR 65-100 per sq ft a month quoted (Savills 'SBD Others': Velachery, Arcot Road, Arumbakkam, Anna Nagar)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "low",
   "lo": 65,
   "hi": 100
  },
  "vacancy": {
   "v": "21.9% (same Savills grouping)",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "low"
  },
  "stock": {
   "v": "2.4 msf across that whole grouping",
   "asOf": "Dec 2025",
   "src": "https://www.mindspacereit.com/wp-content/uploads/2026/04/Industry-Report.pdf",
   "conf": "low"
  },
  "pros": [
   "Central to south Chennai, between Guindy, OMR and GST Road.",
   "Rail-served: Velachery MRTS now runs on to St. Thomas Mount (Mar 2026), an interchange with the metro and suburban lines.",
   "Strong retail and food around Phoenix MarketCity, useful for late shifts."
  ],
  "cons": [
   "The worst flood record in the study: the 2023 and 2024 floods lasted over a week in places.",
   "Thin Grade A stock, mostly standalone towers.",
   "A congested 100 Ft Road; trains on the new MRTS extension run about every 25 minutes."
  ],
  "occupiers": {
   "v": "Amura Health (1.39 lakh sq ft) and CorporatEdge (1.04 lakh sq ft) at One National Park, Velachery Road; RANE; WorkEZ Helix managed office (1.25 lakh sq ft) beside Phoenix MarketCity",
   "src": "https://assets.credai.app/public/knowledge_center_document/1768560671416_India_Office_Figures_Q4_2025.pdf"
  },
  "sources": [
   "https://chennaimetrorail.org/wp-content/uploads/2026/03/Contract-Signing-Grade-Separators-at-Perungudi-PR-25-09.03.2026-English.pdf",
   "https://www.thehindu.com/news/cities/chennai/mrts-train-services-begin-on-velachery-st-thomas-mount-extended-section/article70742263.ece",
   "https://timesofindia.indiatimes.com/city/chennai/mrts-extension-opens-after-2-decades-commuters-face-first-day-confusion/articleshow/129571076.cms",
   "https://workez.in/location/managed-office-space-chennai/velachery-helix",
   "https://citizenmatters.in/wetland-tour-pallikaranai-watershed-area-chennai-cmda-gcc/",
   "https://www.newindianexpress.com/cities/chennai/2026/Apr/17/south-chennai-it-corridors-growth-masks-civic-strain-as-residents-battle-floods-traffic-and-drainage-woes"
  ]
 }
];

/* Rail: open lines, and Chennai Metro Phase 2 under construction. */
window.CHN_TRANSIT = {
 "asOf": "2026-10-06",
 "lines": [
  {
   "key": "blue",
   "name": "Chennai Metro Blue Line (Corridor 1)",
   "mode": "metro",
   "status": "open",
   "color": "#3281C4",
   "note": "Wimco Nagar Depot to Chennai Airport, 32.65 km, 26 stations. Weekdays 05:00-23:00, peak (08-11, 17-20) every 6 min, 3 min Washermanpet-Alandur with short loops; 7 min off-peak, 15 min after 22:00 (CMRL timetable, Jul 2026). Colour hex is the Wikipedia line-template value, not an official CMRL brand code. Coordinates: CMRL-derived station points from the ChennaiGTFS repo.",
   "src": "https://en.wikipedia.org/wiki/Blue_Line_(Chennai_Metro)",
   "stations": [
    {
     "name": "Wimco Nagar Depot",
     "lat": 13.18428,
     "lng": 80.30911,
     "open": true,
     "opened": "2022-03",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Wimco Nagar",
     "lat": 13.17899,
     "lng": 80.30716,
     "open": true,
     "opened": "2021-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Tiruvottiyur",
     "lat": 13.17227,
     "lng": 80.30536,
     "open": true,
     "opened": "2021-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Tiruvottiyur Theradi",
     "lat": 13.15983,
     "lng": 80.30234,
     "open": true,
     "opened": "2022-03",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Kaladipet",
     "lat": 13.15105,
     "lng": 80.29941,
     "open": true,
     "opened": "2021-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Tollgate",
     "lat": 13.14352,
     "lng": 80.29632,
     "open": true,
     "opened": "2021-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "New Washermanpet",
     "lat": 13.13477,
     "lng": 80.29296,
     "open": true,
     "opened": "2021-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Tondiarpet",
     "lat": 13.12381,
     "lng": 80.2882,
     "open": true,
     "opened": "2021-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Sir Theagaraya College",
     "lat": 13.1166,
     "lng": 80.28513,
     "open": true,
     "opened": "2021-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Washermanpet",
     "lat": 13.10722,
     "lng": 80.28079,
     "open": true,
     "opened": "2019-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Mannadi",
     "lat": 13.09542,
     "lng": 80.28609,
     "open": true,
     "opened": "2019-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "High Court",
     "lat": 13.08707,
     "lng": 80.28503,
     "open": true,
     "opened": "2019-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Puratchi Thalaivar Dr. M.G. Ramachandran Central",
     "lat": 13.08143,
     "lng": 80.27291,
     "open": true,
     "opened": "2019-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Government Estate",
     "lat": 13.06956,
     "lng": 80.27284,
     "open": true,
     "opened": "2019-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "LIC",
     "lat": 13.06455,
     "lng": 80.2661,
     "open": true,
     "opened": "2019-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Thousand Lights",
     "lat": 13.05836,
     "lng": 80.25852,
     "open": true,
     "opened": "2019-02",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "AG-DMS",
     "lat": 13.04468,
     "lng": 80.24803,
     "open": true,
     "opened": "2018-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Teynampet",
     "lat": 13.03712,
     "lng": 80.24646,
     "open": true,
     "opened": "2018-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Nandanam",
     "lat": 13.03165,
     "lng": 80.24104,
     "open": true,
     "opened": "2018-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Saidapet",
     "lat": 13.0236,
     "lng": 80.22836,
     "open": true,
     "opened": "2018-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Little Mount",
     "lat": 13.01448,
     "lng": 80.22398,
     "open": true,
     "opened": "2016-09",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Guindy",
     "lat": 13.00917,
     "lng": 80.21303,
     "open": true,
     "opened": "2016-09",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Arignar Anna Alandur",
     "lat": 13.0042,
     "lng": 80.20157,
     "open": true,
     "opened": "2015-06",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Nanganallur Road (OTA)",
     "lat": 12.99997,
     "lng": 80.19416,
     "open": true,
     "opened": "2016-09",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Meenambakkam",
     "lat": 12.98775,
     "lng": 80.17659,
     "open": true,
     "opened": "2016-09",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Chennai Airport",
     "lat": 12.98098,
     "lng": 80.16425,
     "open": true,
     "opened": "2016-09",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    }
   ],
   "short": "Blue Line"
  },
  {
   "key": "green",
   "name": "Chennai Metro Green Line (Corridor 2)",
   "mode": "metro",
   "status": "open",
   "color": "#53B848",
   "note": "Chennai Central to St. Thomas Mount via Koyambedu, 22 km, 17 stations. Peak every 12 min end to end; Central-Alandur combined with Central-Airport inter-corridor trains at 6 min peak (CMRL timetable, Jul 2026). Colour hex from Wikipedia template.",
   "src": "https://en.wikipedia.org/wiki/Green_Line_(Chennai_Metro)",
   "stations": [
    {
     "name": "Puratchi Thalaivar Dr. M.G. Ramachandran Central",
     "lat": 13.08143,
     "lng": 80.27291,
     "open": true,
     "opened": "2018-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Egmore",
     "lat": 13.07897,
     "lng": 80.26095,
     "open": true,
     "opened": "2018-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Nehru Park",
     "lat": 13.07861,
     "lng": 80.25009,
     "open": true,
     "opened": "2017-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Kilpauk Medical College",
     "lat": 13.07746,
     "lng": 80.24263,
     "open": true,
     "opened": "2017-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Pachaiyappa's College",
     "lat": 13.07539,
     "lng": 80.23338,
     "open": true,
     "opened": "2017-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Shenoy Nagar",
     "lat": 13.07837,
     "lng": 80.22512,
     "open": true,
     "opened": "2017-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Anna Nagar East",
     "lat": 13.08455,
     "lng": 80.21957,
     "open": true,
     "opened": "2017-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Anna Nagar Tower",
     "lat": 13.08495,
     "lng": 80.2089,
     "open": true,
     "opened": "2017-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Thirumangalam",
     "lat": 13.08521,
     "lng": 80.20154,
     "open": true,
     "opened": "2017-05",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Koyambedu",
     "lat": 13.07336,
     "lng": 80.19487,
     "open": true,
     "opened": "2015-06",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Puratchi Thalaivi Dr. J. Jayalalithaa CMBT",
     "lat": 13.06848,
     "lng": 80.20395,
     "open": true,
     "opened": "2015-06",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Arumbakkam",
     "lat": 13.06201,
     "lng": 80.2117,
     "open": true,
     "opened": "2015-06",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Vadapalani",
     "lat": 13.0507,
     "lng": 80.21207,
     "open": true,
     "opened": "2015-06",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Ashok Nagar",
     "lat": 13.03549,
     "lng": 80.21106,
     "open": true,
     "opened": "2015-06",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Ekkattuthangal",
     "lat": 13.01652,
     "lng": 80.20528,
     "open": true,
     "opened": "2015-06",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Arignar Anna Alandur",
     "lat": 13.0042,
     "lng": 80.20157,
     "open": true,
     "opened": "2015-06",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "St. Thomas Mount (Parangimalai)",
     "lat": 12.99475,
     "lng": 80.19755,
     "open": true,
     "opened": "2016-10",
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    }
   ],
   "short": "Green Line"
  },
  {
   "key": "corridor4",
   "name": "Chennai Metro Phase 2 Corridor 4 (Yellow Line), Poonamallee Bypass to Lighthouse",
   "mode": "metro",
   "status": "construction",
   "color": "#FFDF00",
   "note": "NO Phase 2 stretch is open to passengers as of 6 Oct 2026. The first stretch, Poonamallee Bypass-Vadapalani (14.64 km, 17 stations of which 11 will open), is CMRS-cleared and scheduled for inauguration by the PM on 11 Oct 2026; six double-decker stations between Porur Junction and Vadapalani will be skipped initially. Trains run in ATO with two operators until driverless (UTO) operation from about mid-2027. Through fare to Airport, Egmore or Central Rs 50. East of Vadapalani the line goes underground to Lighthouse (26.1 km in total); only the western part is listed here. Approx positions were placed by inter-station distances in the CMRL DPR (Table 6.1, https://www.chennaimetrorail.org/wp-content/uploads/2025/07/Project-DPR-for-Chennai-Metro-Rail-Phase-II.pdf) along road polylines built from OSM and MTC stop points; typical error 300-700 m.",
   "src": "https://timesofindia.indiatimes.com/city/chennai/chennai-metro-phase-2-stretch-to-open-on-oct-11-trains-will-not-be-driverless-until-mid-2027/articleshow/134600807.cms",
   "stations": [
    {
     "name": "Poonamallee Bypass",
     "lat": 13.048,
     "lng": 80.0818,
     "open": false,
     "opened": null,
     "coordSrc": "https://en.wikipedia.org/wiki/Poonamallee_Bypass_metro_station",
     "approx": true,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026.",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Poonamallee Bus Stand (Poonamallee)",
     "lat": 13.05092,
     "lng": 80.09492,
     "open": false,
     "opened": null,
     "coordSrc": "nominatim osm node 13972488427",
     "approx": false,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026.",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Poonamallee Govt Hospital (Mullaithottam)",
     "lat": 13.04971,
     "lng": 80.102,
     "open": false,
     "opened": null,
     "coordSrc": "nominatim osm node 13972487793",
     "approx": false,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026.",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Karayanchavadi",
     "lat": 13.04679,
     "lng": 80.11039,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Poonamallee High Road, between Poonamallee GH and Iyyappanthangal (method in line note)",
     "approx": true,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026.",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Kumananchavadi",
     "lat": 13.04331,
     "lng": 80.11775,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Poonamallee High Road, between Poonamallee GH and Iyyappanthangal (method in line note)",
     "approx": true,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026.",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Kattupakkam",
     "lat": 13.04153,
     "lng": 80.12515,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Mount-Poonamallee Road, between Poonamallee GH and Iyyappanthangal (method in line note)",
     "approx": true,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026.",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Iyyappanthangal",
     "lat": 13.03818,
     "lng": 80.13499,
     "open": false,
     "opened": null,
     "coordSrc": "nominatim osm node 13972514096",
     "approx": false,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026.",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Thelliyaragaram (Ramachandra Hospital)",
     "lat": 13.03691,
     "lng": 80.14173,
     "open": false,
     "opened": null,
     "coordSrc": "https://en.wikipedia.org/wiki/Thelliyaragaram_metro_station",
     "approx": false,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026.",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Porur Bypass",
     "lat": 13.03628,
     "lng": 80.15017,
     "open": false,
     "opened": null,
     "coordSrc": "https://en.wikipedia.org/wiki/Porur_Bypass_metro_station",
     "approx": false,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026.",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Porur Junction",
     "lat": 13.03587,
     "lng": 80.15683,
     "open": false,
     "opened": null,
     "coordSrc": "https://en.wikipedia.org/wiki/Porur_Junction_metro_station",
     "approx": false,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026.",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Alapakkam",
     "lat": 13.03858,
     "lng": 80.16385,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Arcot Road, Porur Junction to Vadapalani (method in line note)",
     "approx": true,
     "detail": "Station still under construction; from 11 Oct 2026 trains run through without stopping. No firm opening date (The Hindu 26 Jul 2026 said about 3 months).",
     "target": "Trains pass from 11 Oct 2026; stop date not set",
     "eta": 2027,
     "through": "2026-10-11"
    },
    {
     "name": "Karambakkam",
     "lat": 13.04036,
     "lng": 80.17072,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Arcot Road, Porur Junction to Vadapalani (method in line note)",
     "approx": true,
     "detail": "Station still under construction; from 11 Oct 2026 trains run through without stopping. No firm opening date (The Hindu 26 Jul 2026 said about 3 months).",
     "target": "Trains pass from 11 Oct 2026; stop date not set",
     "eta": 2027,
     "through": "2026-10-11"
    },
    {
     "name": "Valasaravakkam",
     "lat": 13.04314,
     "lng": 80.18082,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Arcot Road, Porur Junction to Vadapalani (method in line note)",
     "approx": true,
     "detail": "Station still under construction; from 11 Oct 2026 trains run through without stopping. No firm opening date (The Hindu 26 Jul 2026 said about 3 months).",
     "target": "Trains pass from 11 Oct 2026; stop date not set",
     "eta": 2027,
     "through": "2026-10-11"
    },
    {
     "name": "Alwarthirunagar",
     "lat": 13.04592,
     "lng": 80.18905,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Arcot Road, Porur Junction to Vadapalani (method in line note)",
     "approx": true,
     "detail": "Station still under construction; from 11 Oct 2026 trains run through without stopping. No firm opening date (The Hindu 26 Jul 2026 said about 3 months).",
     "target": "Trains pass from 11 Oct 2026; stop date not set",
     "eta": 2027,
     "through": "2026-10-11"
    },
    {
     "name": "Avichi School (Virugambakkam South)",
     "lat": 13.04746,
     "lng": 80.19741,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Arcot Road, Porur Junction to Vadapalani (method in line note)",
     "approx": true,
     "detail": "Station still under construction; from 11 Oct 2026 trains run through without stopping. No firm opening date (The Hindu 26 Jul 2026 said about 3 months).",
     "target": "Trains pass from 11 Oct 2026; stop date not set",
     "eta": 2027,
     "through": "2026-10-11"
    },
    {
     "name": "Saligramam",
     "lat": 13.04935,
     "lng": 80.20605,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Arcot Road, Porur Junction to Vadapalani (method in line note)",
     "approx": true,
     "detail": "Station still under construction; from 11 Oct 2026 trains run through without stopping. No firm opening date (The Hindu 26 Jul 2026 said about 3 months).",
     "target": "Trains pass from 11 Oct 2026; stop date not set",
     "eta": 2027,
     "through": "2026-10-11"
    },
    {
     "name": "Vadapalani (Phase 2 platforms)",
     "lat": 13.0507,
     "lng": 80.21207,
     "open": false,
     "opened": null,
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt; Phase 1 Vadapalani used as proxy for adjacent Phase 2 station",
     "approx": true,
     "detail": "CMRS cleared (conditional Feb 2026, final May 2026); PM inauguration scheduled 11 Oct 2026, 15 trains at 10-min headway, fares Rs 10-40. Not yet open to passengers on 6 Oct 2026. Interchange with Green Line Vadapalani via skywalk (paid-to-paid link under construction).",
     "target": "Opens 11 Oct 2026",
     "eta": 2026,
     "opens": "2026-10-11"
    },
    {
     "name": "Kodambakkam Powerhouse",
     "lat": 13.05216,
     "lng": 80.22025,
     "open": false,
     "opened": null,
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/mtc/stops.txt (proxy: MTC stop 'Power House Kodambakkam')",
     "approx": true,
     "detail": "Not in the 11 Oct 2026 opening; CMRL said Powerhouse-Panagal Park short stretch targeted by Mar 2027 (TOI, 8 Feb 2026).",
     "target": "Target Mar 2027",
     "eta": 2027
    },
    {
     "name": "Kodambakkam (UG)",
     "lat": 13.05212,
     "lng": 80.23113,
     "open": false,
     "opened": null,
     "coordSrc": "nominatim osm node 14018223516",
     "approx": false,
     "detail": "Underground; CMRL said Powerhouse-Panagal Park short stretch targeted by Mar 2027 (TOI, 8 Feb 2026); rest of C4 east to Lighthouse by 2028.",
     "target": "Target Mar 2027",
     "eta": 2027
    },
    {
     "name": "Panagal Park (UG)",
     "lat": 13.04103,
     "lng": 80.23345,
     "open": false,
     "opened": null,
     "coordSrc": "nominatim osm node 14018223517",
     "approx": false,
     "detail": "Underground; CMRL said Powerhouse-Panagal Park short stretch targeted by Mar 2027 (TOI, 8 Feb 2026); rest of C4 east to Lighthouse by 2028.",
     "target": "Target Mar 2027",
     "eta": 2027
    }
   ],
   "short": "Phase 2 Corridor 4"
  },
  {
   "key": "corridor3",
   "name": "Chennai Metro Phase 2 Corridor 3 (Purple Line), Madhavaram to SIPCOT (OMR elevated section)",
   "mode": "metro",
   "status": "construction",
   "color": "#800080",
   "note": "45.8 km, 50 stations planned (CMRL). Listed here: the 19 elevated OMR stations Nehru Nagar to SIPCOT 2. North of Nehru Nagar the line is underground (Taramani, Thiruvanmiyur, Adyar ... Madhavaram), targeted with the rest of Phase 2 by end-2028. Station names follow current CMRL maps; DPR (2018) names given where they differ. All coordinates except Sholinganallur are placed by inter-station distances in the CMRL DPR (Table 6.1, https://www.chennaimetrorail.org/wp-content/uploads/2025/07/Project-DPR-for-Chennai-Metro-Rail-Phase-II.pdf) along an OMR polyline anchored at Sholinganallur; typical error 300-700 m, up to about 1 km for SIPCOT 1-2. DPR names Sri Ponniamman Temple and Sathyabama University were renamed Sholinganallur Lake II and Semmancheri I (CMRL MDB C3 EIA).",
   "src": "https://chennaimetrorail.org/wp-content/uploads/2026/07/Press-Release-16.07.2026-English.pdf",
   "stations": [
    {
     "name": "Nehru Nagar",
     "lat": 12.97163,
     "lng": 80.24871,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. Piling and all 582 U-girders done Nehru Nagar-Sholinganallur (CMRL, 16 Jul 2026); 10.5 km track laid Nehru Nagar-Karapakkam (TOI, 19 Aug 2026). CMRL aimed to finish OMR elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Kandanchavadi",
     "lat": 12.96332,
     "lng": 80.24645,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. Piling and all 582 U-girders done Nehru Nagar-Sholinganallur (CMRL, 16 Jul 2026); 10.5 km track laid Nehru Nagar-Karapakkam (TOI, 19 Aug 2026). CMRL aimed to finish OMR elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Perungudi",
     "lat": 12.95678,
     "lng": 80.24347,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. Piling and all 582 U-girders done Nehru Nagar-Sholinganallur (CMRL, 16 Jul 2026); 10.5 km track laid Nehru Nagar-Karapakkam (TOI, 19 Aug 2026). CMRL aimed to finish OMR elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Thoraipakkam (OMR-PTR junction)",
     "lat": 12.94817,
     "lng": 80.23945,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. Piling and all 582 U-girders done Nehru Nagar-Sholinganallur (CMRL, 16 Jul 2026); 10.5 km track laid Nehru Nagar-Karapakkam (TOI, 19 Aug 2026). CMRL aimed to finish OMR elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Mettukuppam",
     "lat": 12.94052,
     "lng": 80.23597,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. Piling and all 582 U-girders done Nehru Nagar-Sholinganallur (CMRL, 16 Jul 2026); 10.5 km track laid Nehru Nagar-Karapakkam (TOI, 19 Aug 2026). CMRL aimed to finish OMR elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "PTC Colony",
     "lat": 12.932,
     "lng": 80.23309,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. Piling and all 582 U-girders done Nehru Nagar-Sholinganallur (CMRL, 16 Jul 2026); 10.5 km track laid Nehru Nagar-Karapakkam (TOI, 19 Aug 2026). CMRL aimed to finish OMR elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Okkiyampet",
     "lat": 12.92463,
     "lng": 80.23078,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. Piling and all 582 U-girders done Nehru Nagar-Sholinganallur (CMRL, 16 Jul 2026); 10.5 km track laid Nehru Nagar-Karapakkam (TOI, 19 Aug 2026). CMRL aimed to finish OMR elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Karapakkam",
     "lat": 12.91685,
     "lng": 80.22981,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. Piling and all 582 U-girders done Nehru Nagar-Sholinganallur (CMRL, 16 Jul 2026); 10.5 km track laid Nehru Nagar-Karapakkam (TOI, 19 Aug 2026). CMRL aimed to finish OMR elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Okkiyam Thoraipakkam",
     "lat": 12.90965,
     "lng": 80.22883,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. Piling and all 582 U-girders done Nehru Nagar-Sholinganallur (CMRL, 16 Jul 2026); 10.5 km track laid Nehru Nagar-Karapakkam (TOI, 19 Aug 2026). CMRL aimed to finish OMR elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Sholinganallur (C3/C5 interchange)",
     "lat": 12.90096,
     "lng": 80.22796,
     "open": false,
     "opened": null,
     "coordSrc": "nominatim osm node 14018223515",
     "approx": false,
     "detail": "C3/C5 interchange (4 tracks, double-elevated with TNRDC flyover). Under construction; no firm opening date (Wikipedia lists Dec 2027, unconfirmed).",
     "target": "No firm date",
     "eta": null
    },
    {
     "name": "Sholinganallur Lake I",
     "lat": 12.89026,
     "lng": 80.22742,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction (Sholinganallur-SIPCOT package, slower than the northern OMR package). CMRL aimed to finish Nehru Nagar-Siruseri elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Sholinganallur Lake II",
     "lat": 12.88291,
     "lng": 80.22706,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction (Sholinganallur-SIPCOT package, slower than the northern OMR package). CMRL aimed to finish Nehru Nagar-Siruseri elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Semmancheri I",
     "lat": 12.87513,
     "lng": 80.22675,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction (Sholinganallur-SIPCOT package, slower than the northern OMR package). CMRL aimed to finish Nehru Nagar-Siruseri elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Semmancheri II",
     "lat": 12.86046,
     "lng": 80.22651,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction (Sholinganallur-SIPCOT package, slower than the northern OMR package). CMRL aimed to finish Nehru Nagar-Siruseri elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Gandhi Nagar",
     "lat": 12.85011,
     "lng": 80.22661,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction (Sholinganallur-SIPCOT package, slower than the northern OMR package). CMRL aimed to finish Nehru Nagar-Siruseri elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Navalur",
     "lat": 12.84354,
     "lng": 80.22702,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction (Sholinganallur-SIPCOT package, slower than the northern OMR package). CMRL aimed to finish Nehru Nagar-Siruseri elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Siruseri",
     "lat": 12.83379,
     "lng": 80.22883,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515 (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction (Sholinganallur-SIPCOT package, slower than the northern OMR package). CMRL aimed to finish Nehru Nagar-Siruseri elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "SIPCOT 1",
     "lat": 12.82425,
     "lng": 80.22934,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515; south of SIPCOT the polyline is extrapolated along OMR, error may reach 1 km (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction (Sholinganallur-SIPCOT package, slower than the northern OMR package). CMRL aimed to finish Nehru Nagar-Siruseri elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "SIPCOT 2",
     "lat": 12.81467,
     "lng": 80.22911,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along OMR, anchored at Sholinganallur OSM node 14018223515; south of SIPCOT the polyline is extrapolated along OMR, error may reach 1 km (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction (Sholinganallur-SIPCOT package, slower than the northern OMR package). CMRL aimed to finish Nehru Nagar-Siruseri elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    }
   ],
   "short": "Phase 2 Corridor 3 (OMR)"
  },
  {
   "key": "corridor5",
   "name": "Chennai Metro Phase 2 Corridor 5 (Red Line), Madhavaram to Sholinganallur (Koyambedu-Sholinganallur section)",
   "mode": "metro",
   "status": "construction",
   "color": "#FF0000",
   "note": "47 km, 48 stations planned (CMRL). Listed here: Koyambedu to Sholinganallur via the Porur double-decker, Mount-Poonamallee Road (Mugalivakkam, Ramapuram/DLF, Manapakkam, Chennai Trade Centre at Nandambakkam), Alandur, St. Thomas Mount, Madipakkam, Medavakkam and Perumbakkam. The section north of Koyambedu is omitted. Next likely opening is Koyambedu-CTC/Alandur (trials from Nov 2026, opening Q1 2027 at the earliest). Wikipedia lists no separate C5 stop at Porur Junction in the current plan. Approx positions placed by inter-station distances in the CMRL DPR (Table 6.1, https://www.chennaimetrorail.org/wp-content/uploads/2025/07/Project-DPR-for-Chennai-Metro-Rail-Phase-II.pdf) along road polylines; typical error 300-700 m. DPR-to-current name mapping (DLF IT SEZ to Ramapuram, Sathya Nagar to Manapakkam, Puzhuthivakkam to Ullagaram, Global Hospital to Classical Tamil Institute) is inferred from station order.",
   "src": "https://www.newindianexpress.com/cities/chennai/2026/Sep/03/chennai-metro-eyes-november-trial-on-koyambedu-trade-centre-line",
   "stations": [
    {
     "name": "Koyambedu",
     "lat": 13.07336,
     "lng": 80.19487,
     "open": false,
     "opened": null,
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt; Green Line Koyambedu used as proxy for adjacent C5 station",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026).",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Koyambedu Market",
     "lat": 13.06694,
     "lng": 80.19147,
     "open": false,
     "opened": null,
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/mtc/stops.txt (proxy: MTC stop 'Koyambedu Market' on Kaliamman Koil St side)",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026).",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Natesan Nagar",
     "lat": 13.0575,
     "lng": 80.1943,
     "open": false,
     "opened": null,
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/mtc/stops.txt (proxy: MTC stop 'Natesan Nagar')",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026).",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Virugambakkam",
     "lat": 13.05189,
     "lng": 80.19176,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along a straight line between the Natesan Nagar proxy and Alwarthirunagar (method in line note)",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026).",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Alwarthirunagar",
     "lat": 13.04592,
     "lng": 80.18905,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Arcot Road, Porur Junction to Vadapalani (method in line note)",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026). Double-decker section shared with Corridor 4.",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Valasaravakkam",
     "lat": 13.04314,
     "lng": 80.18082,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Arcot Road, Porur Junction to Vadapalani (method in line note)",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026). Double-decker section shared with Corridor 4.",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Karambakkam",
     "lat": 13.04036,
     "lng": 80.17072,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Arcot Road, Porur Junction to Vadapalani (method in line note)",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026). Double-decker section shared with Corridor 4.",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Alapakkam Junction",
     "lat": 13.03858,
     "lng": 80.16385,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Arcot Road, Porur Junction to Vadapalani (method in line note)",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026). Double-decker section shared with Corridor 4.",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Mugalivakkam",
     "lat": 13.03148,
     "lng": 80.16504,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Mount-Poonamallee Road / Butt Road, Porur Junction to Alandur (method in line note)",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026).",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Ramapuram",
     "lat": 13.02675,
     "lng": 80.17364,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Mount-Poonamallee Road / Butt Road, Porur Junction to Alandur (method in line note)",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026).",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Manapakkam",
     "lat": 13.02283,
     "lng": 80.18068,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Mount-Poonamallee Road / Butt Road, Porur Junction to Alandur (method in line note)",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026).",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Chennai Trade Centre (Nandambakkam)",
     "lat": 13.01767,
     "lng": 80.18836,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Mount-Poonamallee Road / Butt Road, Porur Junction to Alandur (method in line note)",
     "approx": true,
     "detail": "Koyambedu-Chennai Trade Centre (about 26 km of track incl. double-decker): trial runs targeted from Nov 2026 for about 4 months; CMRL considering opening through to Alandur; passenger opening unlikely before Q1 2027 (TNIE, 3 Sep 2026; The Hindu, 26 Jul 2026).",
     "target": "Trials Nov 2026; opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Butt Road",
     "lat": 13.01118,
     "lng": 80.19461,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Mount-Poonamallee Road / Butt Road, Porur Junction to Alandur (method in line note)",
     "approx": true,
     "detail": "CTC-Alandur 3.6 km link along Butt Road needed 45-60 more days of work (Sep 2026); Koyambedu-Alandur opening likely Q1 2027 (TNIE, 3 Sep 2026).",
     "target": "Opening likely Q1 2027",
     "eta": 2027
    },
    {
     "name": "Alandur",
     "lat": 13.0042,
     "lng": 80.20157,
     "open": false,
     "opened": null,
     "coordSrc": "https://raw.githubusercontent.com/ungalsoththu/ChennaiGTFS/main/data/cmrl/stops.txt; Phase 1 Alandur used as proxy",
     "approx": true,
     "detail": "CTC-Alandur 3.6 km link along Butt Road needed 45-60 more days of work (Sep 2026); Koyambedu-Alandur opening likely Q1 2027 (TNIE, 3 Sep 2026). Interchange with Blue and Green Lines.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "St. Thomas Mount",
     "lat": 12.99504,
     "lng": 80.19837,
     "open": false,
     "opened": null,
     "coordSrc": "nominatim osm node 5319202812 (existing metro station used as proxy)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced. Interchange with Green Line, MRTS and suburban rail.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Adambakkam",
     "lat": 12.98803,
     "lng": 80.19778,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Vanuvampet",
     "lat": 12.98213,
     "lng": 80.1956,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Ullagaram",
     "lat": 12.9752,
     "lng": 80.19262,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Madipakkam",
     "lat": 12.9677,
     "lng": 80.18943,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Kilkattalai",
     "lat": 12.96,
     "lng": 80.18775,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Echangadu",
     "lat": 12.95213,
     "lng": 80.18569,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Kovilambakkam",
     "lat": 12.94353,
     "lng": 80.18338,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Vellakkal",
     "lat": 12.93425,
     "lng": 80.18288,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Medavakkam I",
     "lat": 12.92423,
     "lng": 80.18361,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Medavakkam II",
     "lat": 12.91437,
     "lng": 80.19539,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Perumbakkam",
     "lat": 12.9091,
     "lng": 80.19816,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Classical Tamil Institute",
     "lat": 12.90597,
     "lng": 80.20581,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Elcot",
     "lat": 12.90606,
     "lng": 80.21662,
     "open": false,
     "opened": null,
     "coordSrc": "interpolated from CMRL DPR Table 6.1 chainage along Medavakkam Main Road / Perumbakkam Main Road, St Thomas Mount to Sholinganallur (method in line note)",
     "approx": true,
     "detail": "Elevated, under construction. All 513 piers done on Ullagaram-Elcot package (CMRL via Metro Rail News, 27 Aug 2026); CMRL aimed to finish CTC-Sholinganallur elevated civil works by Mar 2027 (TOI, 8 Feb 2026). No passenger opening date announced.",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    },
    {
     "name": "Sholinganallur (C3/C5 interchange)",
     "lat": 12.90096,
     "lng": 80.22796,
     "open": false,
     "opened": null,
     "coordSrc": "nominatim osm node 14018223515",
     "approx": false,
     "detail": "C3/C5 interchange (4 tracks, double-elevated with TNRDC flyover). Under construction; no firm opening date (Wikipedia lists Dec 2027, unconfirmed).",
     "target": "Works by Mar 2027; opening not announced",
     "eta": null
    }
   ],
   "short": "Phase 2 Corridor 5"
  },
  {
   "key": "mrts",
   "name": "Chennai MRTS (Chennai Beach to St. Thomas Mount)",
   "mode": "mrts",
   "status": "open",
   "color": "#FF9900",
   "note": "Southern Railway EMU line, about 23-25 km, 21 stations. Velachery-St. Thomas Mount extension opened 14 Mar 2026 with Puzhuthivakkam; Adambakkam built but not yet a halt. 43 pairs of services run Beach-St. Thomas Mount plus shuttles. Railway Board approved the draft MoU to hand MRTS to the Tamil Nadu govt/CMRL on 12 Aug 2026: assets and general O&M within 90 days of signing, Southern Railway keeps running trains during a 24-month transition. Colour hex from Wikipedia template.",
   "src": "https://www.thehindu.com/news/cities/chennai/mrts-train-services-begin-on-velachery-st-thomas-mount-extended-section/article70742263.ece",
   "stations": [
    {
     "name": "Chennai Beach",
     "lat": 13.09194,
     "lng": 80.29211,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm way 217653510",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Chennai Fort",
     "lat": 13.08308,
     "lng": 80.28267,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm way 217653511",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Chennai Park Town",
     "lat": 13.07959,
     "lng": 80.27629,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 2481258995",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Chintadripet",
     "lat": 13.0738,
     "lng": 80.27386,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755231",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Chepauk",
     "lat": 13.06193,
     "lng": 80.2806,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 2486239287",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Thiruvallikeni",
     "lat": 13.05594,
     "lng": 80.2806,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 2486239288",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Light House",
     "lat": 13.04554,
     "lng": 80.27699,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755232",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Mundakakanni Amman Koil",
     "lat": 13.04065,
     "lng": 80.26988,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755233",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Thirumayilai",
     "lat": 13.0354,
     "lng": 80.26751,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755234",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Mandaveli",
     "lat": 13.02809,
     "lng": 80.26062,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755235",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Greenways Road",
     "lat": 13.02158,
     "lng": 80.25273,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755236",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Kotturpuram",
     "lat": 13.01372,
     "lng": 80.24845,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5274913769",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Kasturba Nagar",
     "lat": 13.00538,
     "lng": 80.24786,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755237",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Indira Nagar",
     "lat": 12.99606,
     "lng": 80.24972,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755238",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Thiruvanmiyur",
     "lat": 12.98898,
     "lng": 80.25159,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755239",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Taramani",
     "lat": 12.97866,
     "lng": 80.24164,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755240",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Perungudi",
     "lat": 12.97606,
     "lng": 80.23219,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755241",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Velachery",
     "lat": 12.96762,
     "lng": 80.21951,
     "open": true,
     "opened": "2007-11",
     "coordSrc": "nominatim osm node 5311755242",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Puzhuthivakkam",
     "lat": 12.97716,
     "lng": 80.20542,
     "open": true,
     "opened": "2026-03",
     "coordSrc": "nominatim osm node 5311755243",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Adambakkam",
     "lat": 12.98238,
     "lng": 80.19689,
     "open": false,
     "opened": null,
     "coordSrc": "nominatim osm node 5311755244",
     "approx": false,
     "detail": "Built but trains do not halt: CCRS found excess platform-train gap on a curve. Railway says redesign to be completed by end-2026 after CRS approval (TOI, 28 Sep 2026).",
     "target": "Built; halt expected end-2026",
     "eta": 2026
    },
    {
     "name": "St. Thomas Mount (MRTS)",
     "lat": 12.99508,
     "lng": 80.19835,
     "open": true,
     "opened": "2026-03",
     "coordSrc": "nominatim osm way 422432453 (combined Metro + MRTS station building)",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    }
   ],
   "short": "MRTS"
  },
  {
   "key": "suburban",
   "name": "Chennai Suburban South Line (Chennai Beach to Tambaram / Chengalpattu)",
   "mode": "suburban",
   "status": "open",
   "color": "#6E6E6E",
   "note": "Southern Railway EMU line along GST Road; continues beyond Vandalur to Urapakkam, Guduvanchery and Chengalpattu (not listed). Interchanges: Guindy (Blue Line), St. Thomas Mount (Green Line, MRTS), Tirusulam (Airport metro), Egmore and Park (Central). No official line colour; grey chosen for mapping. Opening dates of these long-established stations not researched (null).",
   "src": "https://en.wikipedia.org/wiki/Chennai_Suburban_Railway",
   "stations": [
    {
     "name": "Chennai Beach",
     "lat": 13.09194,
     "lng": 80.29211,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm way 217653510",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Chennai Fort",
     "lat": 13.08308,
     "lng": 80.28267,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm way 217653511",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Chennai Park",
     "lat": 13.08075,
     "lng": 80.27309,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 2481258999",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Chennai Egmore",
     "lat": 13.07775,
     "lng": 80.26126,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5275790188",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Chetpet",
     "lat": 13.07434,
     "lng": 80.24242,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 248467412",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Nungambakkam",
     "lat": 13.06584,
     "lng": 80.23284,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311775881",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Kodambakkam",
     "lat": 13.05166,
     "lng": 80.23069,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 2481259002",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Mambalam",
     "lat": 13.03807,
     "lng": 80.22778,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 2481259006",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Saidapet",
     "lat": 13.02331,
     "lng": 80.22372,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 2481259029",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Guindy",
     "lat": 13.00867,
     "lng": 80.21261,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 3264712327",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "St. Thomas Mount",
     "lat": 12.99477,
     "lng": 80.19937,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 4221752111",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Pazhavanthangal",
     "lat": 12.99064,
     "lng": 80.18794,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 3187977875",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Meenambakkam",
     "lat": 12.9847,
     "lng": 80.17509,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 4885094689",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Tirusulam (Chennai Airport)",
     "lat": 12.98046,
     "lng": 80.16579,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 4885083053",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Pallavaram",
     "lat": 12.96757,
     "lng": 80.15205,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 4435694788",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Chromepet",
     "lat": 12.95219,
     "lng": 80.14117,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5273733276",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Tambaram Sanatorium",
     "lat": 12.93696,
     "lng": 80.1307,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311775880",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Tambaram",
     "lat": 12.92579,
     "lng": 80.11792,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5286945822",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Perungalathur",
     "lat": 12.90417,
     "lng": 80.09417,
     "open": true,
     "opened": null,
     "coordSrc": "https://en.wikipedia.org/wiki/Perungalathur_railway_station",
     "approx": true,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Vandalur",
     "lat": 12.89161,
     "lng": 80.08497,
     "open": true,
     "opened": null,
     "coordSrc": "nominatim osm node 5311775879",
     "approx": false,
     "detail": null,
     "target": null,
     "eta": null
    },
    {
     "name": "Kilambakkam (new halt for KCBT)",
     "lat": 12.8745,
     "lng": 80.0766,
     "open": false,
     "opened": null,
     "coordSrc": "https://en.wikipedia.org/wiki/Kilambakkam_railway_station",
     "approx": true,
     "detail": "New halt between Vandalur and Urapakkam serving KCBT; station works largely done but opening tied to CMDA skywalk; not open as of 4 Oct 2026, expected by end-2026 (Samayam Tamil, 4 Oct 2026; TNIE, 15 Aug 2026).",
     "target": "New halt expected end-2026",
     "eta": 2026
    }
   ],
   "short": "Suburban rail"
  }
 ],
 "anchors": [
  {
   "id": "airport",
   "name": "Chennai Airport (Terminal 1)",
   "lat": 12.98384,
   "lng": 80.16654,
   "src": "nominatim osm way 158081445"
  },
  {
   "id": "central",
   "name": "Chennai Central",
   "lat": 13.08242,
   "lng": 80.27596,
   "src": "nominatim osm node 2481969291"
  },
  {
   "id": "cmbt",
   "name": "Koyambedu CMBT",
   "lat": 13.066,
   "lng": 80.20563,
   "src": "nominatim osm way 31956728"
  },
  {
   "id": "guindy",
   "name": "Guindy",
   "lat": 13.00867,
   "lng": 80.21261,
   "src": "nominatim osm node 3264712327"
  },
  {
   "id": "kcbt",
   "name": "Kilambakkam bus terminus (KCBT)",
   "lat": 12.87225,
   "lng": 80.08151,
   "src": "nominatim osm relation 17477949"
  }
 ],
 "facts": [
  {
   "k": "No Phase 2 stretch open yet",
   "v": "As of 6 Oct 2026 no Chennai Metro Phase 2 section carries passengers; the 14.6 km Poonamallee Bypass-Vadapalani stretch is due to be inaugurated by PM Modi on 11 Oct 2026.",
   "asOf": "Oct 2026",
   "conf": "high",
   "src": "https://www.financialexpress.com/business/infrastructure-chennai-metro-phase-ii-pm-modi-to-inaugurate-14-6-km-poonamallee-vadapalani-stretch-4354590/"
  },
  {
   "k": "First Phase 2 stretch details",
   "v": "Poonamallee Bypass-Vadapalani: 11 of 17 stations open initially, 15 trains at 10-min intervals, fares Rs 10-40 (Rs 50 through to Airport/Egmore/Central), ATO with two operators until driverless running around mid-2027.",
   "asOf": "Sep 2026",
   "conf": "high",
   "src": "https://timesofindia.indiatimes.com/city/chennai/chennai-metro-phase-2-stretch-to-open-on-oct-11-trains-will-not-be-driverless-until-mid-2027/articleshow/134600807.cms"
  },
  {
   "k": "Next Phase 2 opening",
   "v": "Koyambedu-Chennai Trade Centre (Corridor 5, via Porur double-decker, Mugalivakkam, Ramapuram, Manapakkam) targets trial runs from Nov 2026 for about four months; extension to Alandur under consideration; opening unlikely before Q1 2027.",
   "asOf": "Sep 2026",
   "conf": "medium",
   "src": "https://www.newindianexpress.com/cities/chennai/2026/Sep/03/chennai-metro-eyes-november-trial-on-koyambedu-trade-centre-line"
  },
  {
   "k": "OMR metro (Corridor 3) progress",
   "v": "All 3,066 piles and 582 U-girders done Nehru Nagar-Sholinganallur (Jul 2026) and 10.5 km of track laid Nehru Nagar-Karapakkam (Aug 2026); CMRL had targeted completing the Nehru Nagar-Siruseri elevated section by Mar 2027, with no passenger date announced.",
   "asOf": "Aug 2026",
   "conf": "medium",
   "src": "https://timesofindia.indiatimes.com/city/chennai/snails-pace-over-half-of-cmrl-phase-ii-complete-ballastless-track-laying-at-67km/articleshow/133330979.cms"
  },
  {
   "k": "Phase 2 scope and cost",
   "v": "Phase 2 is 118.9 km with 128 stations in three corridors (C3 45.8 km, C4 26.1 km, C5 47.0 km), cost Rs 63,246 crore incl. IDC, completion proposed by end-2028.",
   "asOf": "Mar 2026",
   "conf": "high",
   "src": "https://chennaimetrorail.org/project-status/"
  },
  {
   "k": "Phase 2 physical progress",
   "v": "MoHUA told Parliament that Phase 2 was 54.62% physically complete; about 67 km of ballastless track had been laid by mid-Aug 2026.",
   "asOf": "Aug 2026",
   "conf": "high",
   "src": "https://indianexpress.com/article/india/chennai-metro-phase-2-54-percent-completion-airport-railway-station-connectivity-10820851/"
  },
  {
   "k": "Metro ridership (latest month)",
   "v": "Chennai Metro carried 1,00,26,601 passengers in Sep 2026 (about 3.34 lakh a day on average; peak day 11 Sep with 3,93,580), after 1.06 crore in Jul and 1.04 crore in Aug 2026.",
   "asOf": "Sep 2026",
   "conf": "high",
   "src": "https://chennaimetrorail.org/wp-content/uploads/2026/10/Press-Release-01.10.2026-English.pdf"
  },
  {
   "k": "Metro operating hours",
   "v": "Phase 1 metro runs about 05:00-23:00 daily; Blue Line every 6 min at weekday peaks (3 min Washermanpet-Alandur), Green Line every 12 min, 15-30 min after 22:00.",
   "asOf": "Jul 2026",
   "conf": "high",
   "src": "https://chennaimetrorail.org/wp-content/uploads/2026/07/first-and-last-train-timings_terminal_NP7P6_SL_WK_EP-NP7P6_SAT1-NP10P7_SUN1_1.pdf"
  },
  {
   "k": "MRTS extension opened",
   "v": "The Velachery-St. Thomas Mount MRTS extension opened on 14 Mar 2026, linking MRTS with suburban rail and metro at St. Thomas Mount; Puzhuthivakkam is open, Adambakkam still has no halts.",
   "asOf": "Mar 2026",
   "conf": "high",
   "src": "https://www.thehindu.com/news/cities/chennai/mrts-train-services-begin-on-velachery-st-thomas-mount-extended-section/article70742263.ece"
  },
  {
   "k": "Adambakkam MRTS halt",
   "v": "Seven months after opening, trains still skip Adambakkam because of a platform-gap defect; Southern Railway expects the redesign to be done by end-2026.",
   "asOf": "Sep 2026",
   "conf": "high",
   "src": "https://timesofindia.indiatimes.com/city/chennai/design-flaw-adambakkam-mrts-station-remains-shut-for-seven-months/articleshow/134548727.cms"
  },
  {
   "k": "MRTS takeover by CMRL",
   "v": "Railway Board approved (letter of 12 Aug 2026) the draft MoU to hand MRTS assets and O&M to Tamil Nadu/CMRL: handover within 90 days of signing, with Southern Railway running trains through a 24-month transition.",
   "asOf": "Aug 2026",
   "conf": "high",
   "src": "https://www.thehindu.com/news/cities/chennai/after-15-year-wait-railway-board-finally-approves-merger-of-mrts-with-chennai-metro-rail/article71359745.ece"
  },
  {
   "k": "KCBT Kilambakkam",
   "v": "Kalaignar Centenary Bus Terminus (88.52 acres, Rs 393.74 crore) opened 30 Dec 2023 on GST Road at Kilambakkam; south-bound SETC, TNSTC and omni buses moved there from Koyambedu CMBT, which kept Bengaluru-bound and ECR services.",
   "asOf": "Dec 2023",
   "conf": "high",
   "src": "https://timesofindia.indiatimes.com/city/chennai/chennais-kilambakkam-bus-terminus-opened-buses-on-only-these-two-routes-will-be-operated-from-cmbt-in-koyambedu/articleshow/106400517.cms"
  },
  {
   "k": "Kilambakkam rail halt and skywalk",
   "v": "The new suburban halt at Kilambakkam and the CMDA skywalk to KCBT were still incomplete in early Oct 2026, with completion now expected by end-2026.",
   "asOf": "Oct 2026",
   "conf": "medium",
   "src": "https://tamil.samayam.com/tamil-nadu/chennai/kilambakkam-skywalk-project-delays-and-challenges-for-commuters/articleshow/134670285.cms"
  },
  {
   "k": "MTC premium buses on OMR",
   "v": "In Mar 2026 MTC launched app-booked, seat-guaranteed AC electric premium buses on two IT-corridor routes, P570S Siruseri IT Park-Koyambedu CMBT and P91 Thiruvanmiyur-KCBT Kilambakkam, with fares of Rs 50-150 booked only through the Chennai One app.",
   "asOf": "Mar 2026",
   "conf": "high",
   "src": "https://economictimes.indiatimes.com/news/new-updates/chennai-mtc-launches-premium-buses-connecting-key-it-hubs-check-routes-fares-facilities-and-reservation-details/articleshow/129454636.cms"
  },
  {
   "k": "MTC e-buses for OMR",
   "v": "MTC's upgraded Perumbakkam depot began running 135 electric buses (55 AC) on 13 routes from Aug 2025, aimed at the IT corridor, including Siruseri-Airport, CMBT-Kilambakkam (570) and Kilambakkam-Sholinganallur (555S).",
   "asOf": "Aug 2025",
   "conf": "high",
   "src": "https://timesofindia.indiatimes.com/city/chennai/chennai-adds-135-e-buses-focuses-on-it-corridor/articleshow/123126788.cms"
  },
  {
   "k": "MTC route count on OMR",
   "v": "A commuter guide estimates about 450 MTC buses on 43+ routes serve OMR, with about 65% of MTC's AC Volvo fleet deployed there; this is not an official MTC figure.",
   "asOf": "Apr 2026",
   "conf": "low",
   "src": "https://spiritofchennai.com/busroutes/mtc-buses-omr/"
  },
  {
   "k": "OMR peak traffic",
   "v": "A TOI stopwatch test found the 9 km from SRP Tools to Sholinganallur took 42 minutes at peak, compared with about 10 minutes for the 5 km Madhya Kailash-Tidel Park stretch already cleared of metro works.",
   "asOf": "Jun 2026",
   "conf": "medium",
   "src": "https://timesofindia.indiatimes.com/city/chennai/traffic-bottlenecks-choke-omr-due-to-wrong-side-driving-illegal-parking/articleshow/131618677.cms"
  },
  {
   "k": "OMR flyovers",
   "v": "CMRL awarded a Rs 113.8 crore contract in Mar 2026 (18 months) to build grade separators at the Perungudi and SRP Tools junctions on OMR, on deposit terms for the State Highways Department alongside its OMR metro works.",
   "asOf": "Mar 2026",
   "conf": "high",
   "src": "https://chennaimetrorail.org/wp-content/uploads/2026/03/Contract-Signing-Grade-Separators-at-Perungudi-PR-25-09.03.2026-English.pdf"
  },
  {
   "k": "Airport-Kilambakkam metro",
   "v": "The proposed 15.46 km Airport-Kilambakkam metro extension (Rs 9,335 crore), meant to serve the GST Road suburbs and the Kilambakkam bus terminus, still awaits Union government approval.",
   "asOf": "Aug 2026",
   "conf": "high",
   "src": "https://timesofindia.indiatimes.com/city/chennai/tamil-nadu-seeks-centres-nod-for-three-chennai-metro-extensions/articleshow/132964333.cms"
  },
  {
   "k": "Night-shift transport rule",
   "v": "Under Tamil Nadu G.O. Ms No. 60 (Labour and Employment, 28 May 2019) under the Shops and Establishments Act, employers must provide transport to women employees working 8 pm-6 am, as noted in Tamil Nadu GST advance rulings.",
   "asOf": "Oct 2024",
   "conf": "medium",
   "src": "https://www.taxtmi.com/article/detailed?id=13047"
  }
 ],
 "asOfText": "6 Oct 2026"
};

/* Talent pool (institutes, residential belts), studios and IT parks. */
window.CHN_PLACES = [
 {
  "id": "icat-mylapore",
  "kind": "edu",
  "name": "ICAT Design & Media College (Image Group)",
  "sub": "Mylapore",
  "lat": 13.035797,
  "lng": 80.277691,
  "precision": "building",
  "note": "Image Group's degree college for animation, VFX and game art; the group started Image Creative Education, India's first professional multimedia institute, in 1996.",
  "src": "https://www.icat.ac.in/who-we-are.aspx"
 },
 {
  "id": "arena-vadapalani",
  "kind": "edu",
  "name": "Arena Animation Vadapalani",
  "sub": "Vadapalani",
  "lat": 13.048757,
  "lng": 80.208129,
  "precision": "building",
  "note": "Aptech's animation/VFX training brand on Arcot Road, opposite Forum Vijaya Mall, in the heart of the film belt.",
  "src": "https://arenavadapalani.com/contact/"
 },
 {
  "id": "zica-velachery",
  "kind": "edu",
  "name": "ZICA (formerly MAAC Velachery)",
  "sub": "Velachery",
  "lat": 12.978602,
  "lng": 80.225036,
  "precision": "building",
  "note": "Short-course VFX and 3D training centre in Velachery; ran as MAAC Velachery and now trades as Zee Institute of Creative Art under the same team.",
  "src": "https://maacvelachery.in/contact/"
 },
 {
  "id": "chennai-animation-college",
  "kind": "edu",
  "name": "Chennai Animation College",
  "sub": "Mugalivakkam, Porur",
  "lat": 13.020472,
  "lng": 80.158973,
  "precision": "building",
  "note": "Animation college on Mugalivakkam Main Road, roughly 1.5 km from BFS's current Commerzone office, so a natural local intern feeder.",
  "src": "https://exa.ai/library/place/b2w2j8dfbgk"
 },
 {
  "id": "mgr-film-institute",
  "kind": "edu",
  "name": "Tamil Nadu Govt M.G.R. Film and Television Institute",
  "sub": "Taramani",
  "lat": 12.993213,
  "lng": 80.246047,
  "precision": "building",
  "note": "State film school offering a 4-year BVA in Animation and Visual Effects (plus DI, editing, cinematography); very small intake per course.",
  "src": "https://cms.tn.gov.in/cms_migrated/document/announcements/tngmgrftvi_prospectus_2024_2025.pdf"
 },
 {
  "id": "loyola-viscom",
  "kind": "edu",
  "name": "Loyola College, Dept of Visual Communication",
  "sub": "Nungambakkam",
  "lat": 13.0617032,
  "lng": 80.2346118,
  "precision": "building",
  "note": "Started India's first Visual Communication degree in 1989 and runs a B.Sc Multimedia & Animation covering VFX; 350+ students in the department.",
  "src": "https://www.loyolacollege.edu/viscom/home"
 },
 {
  "id": "mcc-viscom",
  "kind": "edu",
  "name": "Madras Christian College, Visual Communication",
  "sub": "Tambaram",
  "lat": 12.9175673,
  "lng": 80.1222032,
  "precision": "building",
  "note": "Visual Communication department since 2002 covering 3D animation and video production; sits on GST Road between the Pallavaram and Perungalathur options.",
  "src": "https://mcc.edu.in/visual-communication/"
 },
 {
  "id": "fine-arts-egmore",
  "kind": "edu",
  "name": "Government College of Fine Arts",
  "sub": "Egmore / Periyamedu",
  "lat": 13.08028,
  "lng": 80.26583,
  "precision": "building",
  "note": "India's oldest art school (1850) with visual communication, painting and print-making degrees; a traditional source of drawing-strong artists.",
  "src": "https://en.wikipedia.org/wiki/Government_College_of_Fine_Arts,_Chennai"
 },
 {
  "id": "ceg-anna-university",
  "kind": "edu",
  "name": "College of Engineering, Guindy (Anna University)",
  "sub": "Guindy",
  "lat": 13.0136638,
  "lng": 80.236502,
  "precision": "building",
  "note": "Anna University's flagship engineering campus; a source of pipeline, TD and systems engineers rather than artists.",
  "src": "https://en.wikipedia.org/wiki/College_of_Engineering,_Guindy"
 },
 {
  "id": "sathyabama",
  "kind": "edu",
  "name": "Sathyabama Institute of Science and Technology",
  "sub": "Semmancheri, OMR",
  "lat": 12.8734977,
  "lng": 80.2198655,
  "precision": "building",
  "note": "Large OMR university (engineering plus a B.Sc Visual Communication with animation modules) about 3 km south of the Sholinganallur options.",
  "src": "https://www.sathyabama.ac.in/taxonomy/term/87"
 },
 {
  "id": "hindustan-padur",
  "kind": "edu",
  "name": "Hindustan Institute of Technology and Science",
  "sub": "Padur, OMR",
  "lat": 12.7992931,
  "lng": 80.2296313,
  "precision": "building",
  "note": "OMR university with B.Des Communication and Gaming Design and a BVA that includes VFX; its arts college signed an MoU with Spellbound VFX in Sept 2025.",
  "src": "https://hindustanuniv.ac.in/bachelor-of-visual-arts/"
 },
 {
  "id": "vit-chennai",
  "kind": "edu",
  "name": "VIT Chennai",
  "sub": "Vandalur-Kelambakkam Road",
  "lat": 12.8429461,
  "lng": 80.15541,
  "precision": "building",
  "note": "Large engineering campus (since 2010) between GST Road and OMR; competes with IT firms for the same software and pipeline graduates.",
  "src": "https://chennai.vit.ac.in/"
 },
 {
  "id": "srm-ktr",
  "kind": "edu",
  "name": "SRM Institute of Science and Technology, Kattankulathur",
  "sub": "Potheri, GST Road",
  "lat": 12.8234361,
  "lng": 80.0450412,
  "precision": "building",
  "note": "Very large campus on GST Road with engineering plus a Visual Communication department (animation studio, about 345 students).",
  "src": "https://www.srmist.edu.in/department/department-of-visual-communication/"
 },
 {
  "id": "srm-vadapalani",
  "kind": "edu",
  "name": "SRM IST Vadapalani campus",
  "sub": "Vadapalani",
  "lat": 13.0516365,
  "lng": 80.2109873,
  "precision": "street",
  "note": "SRM's city campus (engineering, science and humanities) on 100 Feet Road next to SIMS Hospital, inside the film belt; point is the adjacent hospital.",
  "src": "https://www.srmistvdp.edu.in/contact-us"
 },
 {
  "id": "vels-pallavaram",
  "kind": "edu",
  "name": "Vels University (VISTAS)",
  "sub": "Pallavaram",
  "lat": 12.957727,
  "lng": 80.1606459,
  "precision": "building",
  "note": "Runs B.Sc Animation, B.Sc Visual Effects and Game Design degrees plus diplomas; a VFX-specific degree feeder close to the Pallavaram option.",
  "src": "https://vistas.ac.in/eligibility-criteria-school-of-mass-communication/"
 },
 {
  "id": "res-vadapalani",
  "kind": "res",
  "name": "Vadapalani",
  "sub": "West-central Chennai",
  "lat": 13.0502979,
  "lng": 80.2118301,
  "precision": "locality",
  "note": "Still described as the hotbed of Tamil film post-production and a long-standing base for film technicians; the densest VFX/post cluster in the city.",
  "src": "https://www.thehindu.com/features/metroplus/the-road-to-stardom/article7554330.ece"
 },
 {
  "id": "res-saligramam",
  "kind": "res",
  "name": "Saligramam",
  "sub": "West-central Chennai",
  "lat": 13.0569892,
  "lng": 80.2037301,
  "precision": "locality",
  "note": "Prasad Studios and many post houses; BFS itself sat here (Shyamala Towers, Arcot Road) until FY2023, so long-tenured BFS staff likely live in this belt.",
  "src": "https://basilicflystudio.com/wp-content/uploads/2023/10/Annual-Report-2022-23.pdf"
 },
 {
  "id": "res-kodambakkam",
  "kind": "res",
  "name": "Kodambakkam",
  "sub": "West-central Chennai",
  "lat": 13.049207,
  "lng": 80.2242829,
  "precision": "locality",
  "note": "Namesake of 'Kollywood'; dense film-industry neighbourhood with a film directors' colony and studio-linked housing.",
  "src": "https://en.wikipedia.org/wiki/Kodambakkam"
 },
 {
  "id": "res-valasaravakkam",
  "kind": "res",
  "name": "Valasaravakkam",
  "sub": "West Chennai",
  "lat": 13.0422173,
  "lng": 80.1803891,
  "precision": "locality",
  "note": "Established family housing between the film belt and Porur, 3 to 6 km from the DLF and Porur IT parks; Lorven Studios is here.",
  "src": "https://propspedia.com/blog/valasaravakkam-property-guide-2026"
 },
 {
  "id": "res-porur",
  "kind": "res",
  "name": "Porur",
  "sub": "West Chennai",
  "lat": 13.032458,
  "lng": 80.1582861,
  "precision": "locality",
  "note": "BFS's current home turf; housing demand driven by DLF Cybercity and the Mount Poonamallee Road IT parks, at prices below comparable OMR addresses.",
  "src": "https://propspedia.com/blog/porur-west-chennai-property-guide-2026"
 },
 {
  "id": "res-kk-nagar",
  "kind": "res",
  "name": "K.K. Nagar",
  "sub": "West-central Chennai",
  "lat": 13.0407966,
  "lng": 80.2029798,
  "precision": "locality",
  "note": "Established middle-class neighbourhood next to Ashok Nagar and Vadapalani, about 2 km from Spellbound VFX in Ekkatuthangal.",
  "src": "https://spiritofchennai.com/realestate/chennai-apartment-prices-by-area/"
 },
 {
  "id": "res-ashok-nagar",
  "kind": "res",
  "name": "Ashok Nagar",
  "sub": "West-central Chennai",
  "lat": 13.0359275,
  "lng": 80.2145697,
  "precision": "locality",
  "note": "Older film-belt residential area; developers report families from Vadapalani, Virugambakkam and Ashok Nagar upgrading west towards Porur.",
  "src": "https://www.shriramproperties.com/blog/top-reasons-to-buy-a-home-near-porur-connectivity-it-hubs-and-growth"
 },
 {
  "id": "res-velachery",
  "kind": "res",
  "name": "Velachery",
  "sub": "South Chennai",
  "lat": 12.9801655,
  "lng": 80.2228506,
  "precision": "locality",
  "note": "Dense, well-served suburb on the MRTS line, popular with staff of Guindy and inner-OMR parks; 2BHK rents roughly Rs 26,000 to 35,000 a month.",
  "src": "https://spiritofchennai.com/realestate/chennai-apartment-prices-by-area/"
 },
 {
  "id": "res-medavakkam",
  "kind": "res",
  "name": "Medavakkam",
  "sub": "South Chennai",
  "lat": 12.9202141,
  "lng": 80.1872156,
  "precision": "locality",
  "note": "Sits between OMR and GST Road; the 2024 Medavakkam-Sholinganallur flyover cut peak commute to Sholinganallur to about 15 minutes and pushed rents up.",
  "src": "https://propspedia.com/blog/medavakkam-south-chennai-property-guide-2026"
 },
 {
  "id": "res-pallikaranai",
  "kind": "res",
  "name": "Pallikaranai",
  "sub": "South Chennai",
  "lat": 12.9304748,
  "lng": 80.2077692,
  "precision": "locality",
  "note": "Mid-budget housing beside the marshland, 12 to 15 minutes to Sholinganallur; 2BHK rents about Rs 15,000 to 20,000.",
  "src": "https://propspedia.com/blog/pallikaranai-property-guide-2026"
 },
 {
  "id": "res-sholinganallur",
  "kind": "res",
  "name": "Sholinganallur",
  "sub": "OMR",
  "lat": 12.8988445,
  "lng": 80.2279854,
  "precision": "locality",
  "note": "Deepest salaried IT tenant pool on OMR, with Perumbakkam as a cheaper feeder and Semmancheri just south; DNEG and Pixstone are here.",
  "src": "https://www.ghar.tv/intelligence/omr-old-mahabalipuram-road-chennai-residential-real-estate-market-2026/artgi291"
 },
 {
  "id": "res-tambaram-chromepet",
  "kind": "res",
  "name": "Tambaram / Chromepet",
  "sub": "GST Road",
  "lat": 12.9245279,
  "lng": 80.1150525,
  "precision": "locality",
  "note": "Affordable southern suburbs on GST Road and suburban rail (2BHK roughly Rs 15,000 to 26,000); MCC and Vels are nearby.",
  "src": "https://spiritofchennai.com/realestate/chennai-apartment-prices-by-area/"
 },
 {
  "id": "res-guduvanchery",
  "kind": "res",
  "name": "Guduvanchery",
  "sub": "GST Road (outer)",
  "lat": 12.8439952,
  "lng": 80.0608336,
  "precision": "locality",
  "note": "Cheapest organised housing on the south side (2BHK about Rs 13,000 to 18,000); near SRM Kattankulathur and Zoho's Estancia campus.",
  "src": "https://spiritofchennai.com/realestate/chennai-apartment-prices-by-area/"
 },
 {
  "id": "res-ambattur",
  "kind": "res",
  "name": "Ambattur",
  "sub": "North-west Chennai",
  "lat": 13.1055654,
  "lng": 80.1639586,
  "precision": "locality",
  "note": "North-west industrial and residential suburb; Phantom FX's main studio at Kosmo One anchors a separate VFX talent pocket far from OMR.",
  "src": "https://phantomfx.com/contact/index.html"
 },
 {
  "id": "phantom-fx",
  "kind": "studio",
  "name": "Phantom Digital Effects (PhantomFX)",
  "sub": "Kosmo One Tech Park, Ambattur",
  "lat": 13.0924289,
  "lng": 80.162595,
  "precision": "building",
  "note": "Listed Chennai peer and the closest like-for-like rival for compositors and roto/paint artists; main studio is in north-west Chennai.",
  "size": "Chennai facility 350+ artists in 25,000 sq ft (company site, undated); 650+ artists company-wide (QIP release, Jul 2025)",
  "src": "https://www.phantomfx.com/Infrastructure/index.html"
 },
 {
  "id": "dneg-chennai",
  "kind": "studio",
  "name": "DNEG Chennai",
  "sub": "Tek Meadows Tower A, Sholinganallur",
  "lat": 12.906621,
  "lng": 80.227024,
  "precision": "building",
  "note": "Global studio, opened 2017; the largest pool of Hollywood-trained comp, roto and paint artists on OMR.",
  "size": "Built to accommodate 500+ employees at opening (AnimationXpress, Oct 2017)",
  "src": "https://www.dneg.com/location/chennai"
 },
 {
  "id": "bot-vfx",
  "kind": "studio",
  "name": "BOT VFX",
  "sub": "Lebara Tower, Anna Salai, Teynampet",
  "lat": 13.049005,
  "lng": 80.250114,
  "precision": "building",
  "note": "Large roto, paint and matchmove outsourcing house in central Chennai; a direct competitor for junior prep talent.",
  "size": "756 employees in 2025 for the India entity incl. Hyderabad (EMIS)",
  "src": "https://botvfx.com/team/"
 },
 {
  "id": "prasad-efx",
  "kind": "studio",
  "name": "Prasad Corporation / EFX and Prasad Studios",
  "sub": "28 Arunachalam Road, Saligramam",
  "lat": 13.050857,
  "lng": 80.203982,
  "precision": "building",
  "note": "Post, restoration, roto and VFX house at the centre of the film belt; the L.V. Prasad Film & TV Academy shares the campus.",
  "size": "Prasad Film Labs cites 1,000+ team members (group-wide, all functions)",
  "src": "https://prasadcorp.com/contact-us/"
 },
 {
  "id": "knack-studios",
  "kind": "studio",
  "name": "Knack Studios",
  "sub": "Dr Radhakrishnan Salai, Mylapore",
  "lat": 13.044704,
  "lng": 80.268428,
  "precision": "building",
  "note": "VFX, DI and sound post house; signed an MoU with Guidance Tamil Nadu in Jan 2026 to add 250 VFX jobs in Chennai.",
  "size": "15,000 sq ft Chennai HQ (company site); +250 jobs planned (company LinkedIn, Jan 2026)",
  "src": "https://www.knackstudios.in/about-us"
 },
 {
  "id": "pixstone",
  "kind": "studio",
  "name": "PixStone Images",
  "sub": "TECCI Park, OMR, Sholinganallur",
  "lat": 12.9106746,
  "lng": 80.2274599,
  "precision": "building",
  "note": "TPN-certified roto, paint and comp outsourcing studio on OMR with sister studios in Hyderabad and Pune.",
  "size": "117 employees (Tracxn, Aug 2025)",
  "src": "https://www.pixstone.com/contact/"
 },
 {
  "id": "spellbound-vfx",
  "kind": "studio",
  "name": "Spellbound VFX",
  "sub": "The Lords Building, Ekkatuthangal",
  "lat": 13.022369,
  "lng": 80.206773,
  "precision": "building",
  "note": "Roto, paint, comp and matchmove vendor near Guindy; partnered with the DigiAura VFX academy and signed a 2025 MoU with Hindustan College of Arts & Science.",
  "src": "https://www.spellboundvfx.com/contact"
 },
 {
  "id": "lorven-studios",
  "kind": "studio",
  "name": "Lorven Studios",
  "sub": "Alwarthirunagar, Valasaravakkam",
  "lat": 13.0443224,
  "lng": 80.1879821,
  "precision": "locality",
  "note": "Kollywood VFX studio led by supervisor Hariharasuthan (200+ films) in the west Chennai belt near Porur; point is the locality centroid.",
  "src": "https://www.thelorvenstudios.com/contact"
 },
 {
  "id": "rpm-vfx",
  "kind": "studio",
  "name": "RPM VFX Studios",
  "sub": "Rajiv Gandhi Salai, Karapakkam",
  "lat": 12.9117073,
  "lng": 80.2277203,
  "precision": "locality",
  "note": "Roto, paint, matchmove and comp vendor on OMR (credits include The Rings of Power); point is the Karapakkam centroid.",
  "src": "https://www.rpmvfxstudios.com/"
 },
 {
  "id": "avm-studios",
  "kind": "studio",
  "name": "AVM Studios",
  "sub": "Arcot Road, Vadapalani",
  "lat": 13.046119,
  "lng": 80.204529,
  "precision": "building",
  "note": "Oldest working Kollywood studio (floors, dubbing, preview theatres); anchor of the Vadapalani film belt.",
  "src": "https://www.avm.in/about"
 },
 {
  "id": "tcs-siruseri",
  "kind": "it",
  "name": "TCS Siruseri campus (SIPCOT IT Park)",
  "sub": "Siruseri, OMR",
  "lat": 12.8295316,
  "lng": 80.2177253,
  "precision": "building",
  "note": "TCS's flagship 70-acre campus at the south end of the IT corridor.",
  "size": "About 23,500 professionals (Tata Consulting Engineers)",
  "src": "https://www.tataconsultingengineers.com/project/tcs-siruseri/"
 },
 {
  "id": "infosys-mwc",
  "kind": "it",
  "name": "Infosys, Mahindra World City",
  "sub": "GST Road, Chengalpattu",
  "lat": 12.7325477,
  "lng": 80.0060956,
  "precision": "building",
  "note": "Infosys's large SEZ campus far down GST Road; Infosys also keeps an older Sholinganallur campus.",
  "size": "16,000 seats with 15,000 more under construction (Infosys AR 2011; dated)",
  "src": "https://www.infosys.com/content/dam/infosys-web/en/investors/reports-filings/annual-report/annual/Documents/AR-2011/Theme-Pages/world_class_infrastructure.html"
 },
 {
  "id": "elcosez-sholinganallur",
  "kind": "it",
  "name": "ELCOT IT SEZ Sholinganallur",
  "sub": "Sholinganallur",
  "lat": 12.9062268,
  "lng": 80.2184576,
  "precision": "street",
  "note": "State IT SEZ hosting Wipro, HCL, Tech Mahindra, Cognizant and Sutherland; point is the HCL unit inside the SEZ.",
  "size": "About 74,115 jobs (TN IT dept policy note 2025-26)",
  "src": "https://cms.tn.gov.in/cms_migrated/document/docfiles/it_e_pn_2025_26.pdf"
 },
 {
  "id": "tidel-park",
  "kind": "it",
  "name": "TIDEL Park",
  "sub": "Taramani, OMR",
  "lat": 12.9896946,
  "lng": 80.2487258,
  "precision": "building",
  "note": "The original state IT park at the head of OMR.",
  "size": "1.28 million sq ft built up",
  "src": "https://en.wikipedia.org/wiki/TIDEL_Park"
 },
 {
  "id": "ramanujan-it-city",
  "kind": "it",
  "name": "Ramanujan IT City (Intellion Park)",
  "sub": "Taramani, OMR",
  "lat": 12.99083,
  "lng": 80.24694,
  "precision": "building",
  "note": "Tata-TIDCO IT SEZ next to TIDEL Park and Thiruvanmiyur MRTS.",
  "size": "4.6 million sq ft; about 47,000 IT professionals (TIDCO)",
  "src": "https://www.tidco.com/tril.php"
 },
 {
  "id": "itpc-taramani",
  "kind": "it",
  "name": "International Tech Park Chennai (CapitaLand)",
  "sub": "Taramani",
  "lat": 12.9839425,
  "lng": 80.2461198,
  "precision": "building",
  "note": "CapitaLand tech park on CSIR Road, Taramani; point is its Zenith building.",
  "size": "About 2 million sq ft; 25,000+ professionals (CapitaLand)",
  "src": "https://www.capitaland.com/en/find-a-property/global-property-listing/businesspark-industrial-logistics/international-techparkchennaitaramani.html"
 },
 {
  "id": "olympia-tech-park",
  "kind": "it",
  "name": "Olympia Tech Park",
  "sub": "Guindy",
  "lat": 13.0148782,
  "lng": 80.203512,
  "precision": "building",
  "note": "Large Guindy IT park on the Inner Ring Road near Kathipara, close to the film belt and Velachery.",
  "size": "About 1.8 million sq ft",
  "src": "https://en.wikipedia.org/wiki/Olympia_Tech_Park"
 },
 {
  "id": "chennai-one",
  "kind": "it",
  "name": "Chennai One IT SEZ",
  "sub": "Thoraipakkam (Radial Road)",
  "lat": 12.9488715,
  "lng": 80.2326543,
  "precision": "street",
  "note": "Big SEZ at the OMR end of the Pallavaram-Thoraipakkam Radial Road; TCS is the anchor tenant.",
  "size": "3.8 million sq ft; TCS occupies 60%+ (IG3 Infra)",
  "src": "https://www.ig3infra.com/chennai-one-it-sez.php"
 },
 {
  "id": "dlf-cybercity",
  "kind": "it",
  "name": "DLF Cybercity Chennai",
  "sub": "Manapakkam / Ramapuram, Mount Poonamallee Road",
  "lat": 13.0220803,
  "lng": 80.1753634,
  "precision": "building",
  "note": "Largest IT SEZ in south India, about 1 km from BFS's current office; the main IT rival for west-Chennai technical talent.",
  "size": "43 acres, about 8.4 million sq ft operational (DLF); 98% occupied",
  "src": "https://www.dlf.in/offices/chennai/dlfcybercitychennai"
 },
 {
  "id": "zoho-estancia",
  "kind": "it",
  "name": "Zoho Corporation (Estancia IT Park)",
  "sub": "Potheri / Guduvanchery, GST Road",
  "lat": 12.8299205,
  "lng": 80.050421,
  "precision": "building",
  "note": "Zoho's headquarters on outer GST Road; a large local employer competing for the same southern-suburb graduates.",
  "size": "About 17,500 EPFO-registered employees company-wide (TheCompanyCheck, Jan 2026)",
  "src": "https://www.zoho.com/contactus.html"
 }
];

/* City-level facts. */
window.CHN_FACTS = {
 "market": [
  {
   "k": "Leasing YTD 2026",
   "v": "Colliers puts Jan-Sep 2026 Chennai leasing at 6.0 msf, down 26% y-o-y, with Q3 at 2.0 msf; CBRE reports Q3 absorption of 1.9 msf against 0.7 msf of new supply.",
   "asOf": "Sep 2026",
   "conf": "medium",
   "src": "https://newindianewsservice.com/9-month-office-space-demand-at-54-4-msf-q3-2026-leasing-also-picks-up-by-7-on-qoq-basis-colliers-india/"
  },
  {
   "k": "City vacancy",
   "v": "C&W city-wide Grade A vacancy fell 53 bps q-o-q to 12.41%; other trackers report tighter figures (Knight Frank 8.5%, CRE Matrix 9.9%, JLL about 6.8%) because of different stock definitions.",
   "asOf": "Jun 2026",
   "conf": "high",
   "src": "https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q2/apac-and-gc/india---chennai---office---q2-2026---final.pdf"
  },
  {
   "k": "Average rent and growth",
   "v": "C&W stock-weighted Grade A rent is INR 87.6 per sq ft per month, up 3% q-o-q and 8% y-o-y; CBD averages INR 92.3. Knight Frank's average transacted rent is INR 74.5, up 7% y-o-y.",
   "asOf": "Jun 2026",
   "conf": "high",
   "src": "https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q2/apac-and-gc/india---chennai---office---q2-2026---final.pdf"
  },
  {
   "k": "Supply pipeline",
   "v": "C&W expects nearly 18 msf of mostly Grade A+ supply over the next three years and rents to keep rising; JLL sees about 10 msf in 2026-27, with MP Road (6-8 msf over five years) and Radial Road (4-5 msf) about two-thirds of future supply.",
   "asOf": "Jun 2026",
   "conf": "medium",
   "src": "https://assets.cushmanwakefield.com/-/media/cw/marketbeat-pdfs/2026/q2/apac-and-gc/india---chennai---office---q2-2026---final.pdf"
  },
  {
   "k": "Flood risk, south Chennai",
   "v": "Cyclone Michaung dropped 52-53 cm on Chennai over 2-4 Dec 2023; OMR (Thoraipakkam, Perungudi, Sholinganallur) got about 45 cm on 4 Dec, the 200 Ft Radial Road was cut off and parts of south Chennai stayed inundated for 72+ hours.",
   "asOf": "Dec 2023",
   "conf": "high",
   "src": "https://www.thehindu.com/news/cities/chennai/72-hours-and-counting-many-parts-of-south-chennai-and-omr-still-inundated-as-resources-deplete-for-residents/article67611809.ece"
  }
 ],
 "talent": [
  {
   "k": "Chennai share of India's VFX workforce",
   "v": "Joseph Bell's 2024 VFX World Atlas put Chennai at about 16% of India's VFX workforce in its study, second only to Mumbai (36%) and just ahead of Hyderabad (15%).",
   "asOf": "Oct 2024",
   "conf": "medium",
   "src": "https://topicroomsvfx.com/articles/joseph-bell-releases-visual-effects-world-atlas/",
   "note": "Atlas is built from studio and LinkedIn-type workforce data, not a census; no official Chennai headcount exists."
  },
  {
   "k": "Chennai talent pool growth",
   "v": "The 2026 VFX & Animation World Atlas names Chennai the fastest-growing talent pool among the world's top 10 hubs, up 10.8% in 12 months, while roto/paint roles grew 8.7% globally.",
   "asOf": "Aug 2026",
   "conf": "medium",
   "src": "https://www.awn.com/news/joseph-bell-releases-2026-visual-effects-animation-world-atlas"
  },
  {
   "k": "TN AVGC-XR Policy 2026",
   "v": "Notified 12 Mar 2026 for five years with ELCOT as nodal agency; studios with 80+ staff in 'A' districts (Chennai district, Pallavaram and Tambaram taluks, Avadi and Poonamallee taluks) or 40+ in 'B' districts can seek a case-by-case package covering payroll, capex, lease/rent, stamp duty and power, paid for up to three years.",
   "asOf": "Mar 2026",
   "conf": "high",
   "src": "https://elcot.tn.gov.in/sites/default/file/Tamil%20Nadu%20AVGC%20XR%20Policy%202026.pdf",
   "note": "Mega tier needs 120+ in A districts. Navalur and Padur sit in Thiruporur taluk, which the policy lists as 'B'. The new TVK government's 2026-27 IT policy note still cites the AVGC-XR Policy; no withdrawal found. Policy also earmarks CMRL Tower, Vadapalani for a large AVGC-XR hub."
  },
  {
   "k": "AVGC labour relaxations",
   "v": "The AVGC-XR policy exempts AVGC companies from the TN Shops and Establishments Act chapters on working hours and opening times and allows self-certified compliance, with women's night shifts allowed only with written consent and safe transport.",
   "asOf": "Mar 2026",
   "conf": "high",
   "src": "https://elcot.tn.gov.in/sites/default/file/Tamil%20Nadu%20AVGC%20XR%20Policy%202026.pdf"
  },
  {
   "k": "Women on night shifts (TN rules)",
   "v": "Under G.O.(D) No.207 of 8 May 2025, establishments with 10+ staff may run 24x7 until June 2028; women can work 8 pm to 6 am only with written consent, employer-provided transport and a functioning POSH committee, and work is capped at 10.5 hours a day and 57 a week including overtime.",
   "asOf": "May 2025",
   "conf": "high",
   "src": "https://www.stationeryprinting.tn.gov.in/extraordinary/2025/214_Ex_II_2_2025.pdf",
   "note": "G.O.(Rt.) No.231 of 24 Aug 2026 renewed the 365-day opening permission with the same women's safeguards."
  },
  {
   "k": "Junior and mid artist pay",
   "v": "Self-reported AmbitionBox data shows Chennai compositing artists at about Rs 3.0 to 7.2 lakh a year (3 to 7 years) and paint artists at about Rs 1.8 to 6.6 lakh (1 to 5 years); job ads put fresher roto near Rs 2 lakh a year and mid-level roto at Rs 35,000 to 65,000 a month.",
   "asOf": "2025",
   "conf": "low",
   "src": "https://www.ambitionbox.com/profile/compositing-artist-salary",
   "note": "Paint data: https://www.ambitionbox.com/profile/paint-artist-salary/chennai-location (only 7 salaries). Ads: VFX Pirates Vadapalani via placementindia.com; JustVFX via festybay.com. Treat as indicative only."
  },
  {
   "k": "Attrition",
   "v": "Not found from a solid source: the only public number is a management claim of about 8 to 9% annual attrition at Phantom FX relayed on an investor forum in 2023.",
   "asOf": "2023",
   "conf": "low",
   "src": "https://forum.valuepickr.com/t/phantom-digital-effects-limited/105008",
   "note": "Neither BFS nor Phantom publishes audited attrition; ask BFS HR for its own exit data by home location."
  },
  {
   "k": "GCC corridors competing for talent",
   "v": "In Sept 2026 the state announced a GCC Corridor programme with higher FSI for OMR, Mount Poonamallee Road and the Pallavaram-Thoraipakkam Radial Road, after GCCs took 55% of Chennai office leasing in Q1 2026.",
   "asOf": "Sep 2026",
   "conf": "high",
   "src": "https://www.dtnext.in/news/business/tns-3-corridor-formula-to-make-chennai-gcc-hub",
   "note": "All of BFS's candidate corridors are GCC target corridors, so competition for technical and support staff will rise there."
  }
 ],
 "transit": [
  {
   "k": "First Phase 2 stretch details",
   "v": "Poonamallee Bypass-Vadapalani: 11 of 17 stations open initially, 15 trains at 10-min intervals, fares Rs 10-40 (Rs 50 through to Airport/Egmore/Central), ATO with two operators until driverless running around mid-2027.",
   "asOf": "Sep 2026",
   "conf": "high",
   "src": "https://timesofindia.indiatimes.com/city/chennai/chennai-metro-phase-2-stretch-to-open-on-oct-11-trains-will-not-be-driverless-until-mid-2027/articleshow/134600807.cms"
  },
  {
   "k": "Next Phase 2 opening",
   "v": "Koyambedu-Chennai Trade Centre (Corridor 5, via Porur double-decker, Mugalivakkam, Ramapuram, Manapakkam) targets trial runs from Nov 2026 for about four months; extension to Alandur under consideration; opening unlikely before Q1 2027.",
   "asOf": "Sep 2026",
   "conf": "medium",
   "src": "https://www.newindianexpress.com/cities/chennai/2026/Sep/03/chennai-metro-eyes-november-trial-on-koyambedu-trade-centre-line"
  },
  {
   "k": "OMR metro (Corridor 3) progress",
   "v": "All 3,066 piles and 582 U-girders done Nehru Nagar-Sholinganallur (Jul 2026) and 10.5 km of track laid Nehru Nagar-Karapakkam (Aug 2026); CMRL had targeted completing the Nehru Nagar-Siruseri elevated section by Mar 2027, with no passenger date announced.",
   "asOf": "Aug 2026",
   "conf": "medium",
   "src": "https://timesofindia.indiatimes.com/city/chennai/snails-pace-over-half-of-cmrl-phase-ii-complete-ballastless-track-laying-at-67km/articleshow/133330979.cms"
  },
  {
   "k": "Metro operating hours",
   "v": "Phase 1 metro runs about 05:00-23:00 daily; Blue Line every 6 min at weekday peaks (3 min Washermanpet-Alandur), Green Line every 12 min, 15-30 min after 22:00.",
   "asOf": "Jul 2026",
   "conf": "high",
   "src": "https://chennaimetrorail.org/wp-content/uploads/2026/07/first-and-last-train-timings_terminal_NP7P6_SL_WK_EP-NP7P6_SAT1-NP10P7_SUN1_1.pdf"
  },
  {
   "k": "Metro ridership (latest month)",
   "v": "Chennai Metro carried 1,00,26,601 passengers in Sep 2026 (about 3.34 lakh a day on average; peak day 11 Sep with 3,93,580), after 1.06 crore in Jul and 1.04 crore in Aug 2026.",
   "asOf": "Sep 2026",
   "conf": "high",
   "src": "https://chennaimetrorail.org/wp-content/uploads/2026/10/Press-Release-01.10.2026-English.pdf"
  },
  {
   "k": "MRTS extension opened",
   "v": "The Velachery-St. Thomas Mount MRTS extension opened on 14 Mar 2026, linking MRTS with suburban rail and metro at St. Thomas Mount; Puzhuthivakkam is open, Adambakkam still has no halts.",
   "asOf": "Mar 2026",
   "conf": "high",
   "src": "https://www.thehindu.com/news/cities/chennai/mrts-train-services-begin-on-velachery-st-thomas-mount-extended-section/article70742263.ece"
  },
  {
   "k": "OMR peak traffic",
   "v": "A TOI stopwatch test found the 9 km from SRP Tools to Sholinganallur took 42 minutes at peak, compared with about 10 minutes for the 5 km Madhya Kailash-Tidel Park stretch already cleared of metro works.",
   "asOf": "Jun 2026",
   "conf": "medium",
   "src": "https://timesofindia.indiatimes.com/city/chennai/traffic-bottlenecks-choke-omr-due-to-wrong-side-driving-illegal-parking/articleshow/131618677.cms"
  },
  {
   "k": "MTC premium buses on OMR",
   "v": "In Mar 2026 MTC launched app-booked, seat-guaranteed AC electric premium buses on two IT-corridor routes, P570S Siruseri IT Park-Koyambedu CMBT and P91 Thiruvanmiyur-KCBT Kilambakkam, with fares of Rs 50-150 booked only through the Chennai One app.",
   "asOf": "Mar 2026",
   "conf": "high",
   "src": "https://economictimes.indiatimes.com/news/new-updates/chennai-mtc-launches-premium-buses-connecting-key-it-hubs-check-routes-fares-facilities-and-reservation-details/articleshow/129454636.cms"
  },
  {
   "k": "Airport-Kilambakkam metro",
   "v": "The proposed 15.46 km Airport-Kilambakkam metro extension (Rs 9,335 crore), meant to serve the GST Road suburbs and the Kilambakkam bus terminus, still awaits Union government approval.",
   "asOf": "Aug 2026",
   "conf": "high",
   "src": "https://timesofindia.indiatimes.com/city/chennai/tamil-nadu-seeks-centres-nod-for-three-chennai-metro-extensions/articleshow/132964333.cms"
  }
 ]
};
