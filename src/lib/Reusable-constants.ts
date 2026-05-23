// src/lib/Reusable-constants.ts

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL;

export const JWT_KEY = process.env.JWT_SECRET;

export const brands = [
  "Kurlon", "Sleepwell", "Wakefit", "The Sleep Company", "Sleepy Cat", "Duroflex", "Flo Mattress",
  "Specify in remarks"
];

export const dealerTypes = ["Dealer-Eurofoam", "Dealer-Non Eurofoam"];

export const units = ["KG"];

export const Zone = ["All Zone", "Lower Assam 1", "Lower Assam 2", "Central Assam", "Upper Assam",
  "Barak Valley", "North Bank 1", "North Bank 2", "Meghalaya", "Nagaland", "Tripura", "Other",
];

export const SO_AOP_TARGETS = {
  dealerVisits: 100,
  institutionVisits: 100,
  influencerVisits: 100
};

export const ORG_ROLES = [ //fixed
  'Admin', 'Manager', 'Assistant-Manager',  
  
];

export const JOB_ROLES = [ //can be multiple per ORG_ROLE
  'Admin', 'Manager', 'Assistant-Manager',
];