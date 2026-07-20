export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  state?: string;
  district?: string;
  lat?: number;
  lng?: number;
  createdAt?: string;
  emailVerified?: boolean;
}

export interface SparePart {
  id: string;
  title: string;
  description: string;
  price: number;
  carBrand: string; // e.g. "Maruti Suzuki"
  carModel: string; // e.g. "Swift"
  category: string; // e.g. "Engine Components"
  partName?: string; // e.g. "Pistons"
  condition: "Brand New" | "Like New" | "Used (Good)" | "For Scrap/Spares";
  location: string; // e.g. "Mumbai" (fallback/legacy or formatted)
  state?: string;   // e.g. "Maharashtra"
  district?: string; // e.g. "Mumbai"
  lat?: number;
  lng?: number;
  contactName: string;
  contactPhone: string;
  whatsappPhone?: string;
  imageUrl: string;
  imageUrls?: string[];
  imagePublicIds?: string[];
  sellerId: string;
  sellerEmail: string;
  sold?: boolean;
  createdAt: number;
}

export const INDIAN_CAR_BRANDS: Record<string, string[]> = {
  "Maruti Suzuki": [
    "Swift", "Baleno", "Alto", "Brezza", "Dzire", "Ertiga", "WagonR", "Celerio", 
    "Ignis", "Fronx", "Grand Vitara", "Jimny", "XL6", "Ciaz", "S-Presso", "Eeco", 
    "Ritz", "SX4", "Zen", "Esteem"
  ],
  "Hyundai": [
    "i20", "Creta", "i10 Grand Nios", "Verna", "Venue", "Exter", "Alcazar", 
    "Tucson", "Santro", "Eon", "Elantra", "Santa Fe"
  ],
  "Tata": [
    "Nexon", "Punch", "Altroz", "Tiago", "Tigor", "Harrier", "Safari", "Curvv", 
    "Indica", "Indigo", "Sumo", "Bolt", "Zest"
  ],
  "Mahindra": [
    "Scorpio-N", "Scorpio Classic", "XUV700", "Thar", "Bolero", "Bolero Neo", 
    "XUV300", "XUV400", "XUV500", "TUV300", "Marazzo", "KUV100", "Xylo"
  ],
  "Toyota": [
    "Innova Crysta", "Innova Hycross", "Fortuner", "Glanza", "Urban Cruiser Taisor", 
    "Rumion", "Camry", "Hilux", "Etios", "Liva", "Corolla Altis", "Qualis"
  ],
  "Kia": [
    "Seltos", "Sonet", "Carens", "Carnival", "EV6"
  ],
  "Honda": [
    "City", "Amaze", "Elevate", "Jazz", "WR-V", "Brio", "Civic", "Accord", "CR-V"
  ],
  "Volkswagen": [
    "Virtus", "Taigun", "Tiguan", "Polo", "Vento", "Jetta"
  ],
  "Skoda": [
    "Slavia", "Kushaq", "Kodiaq", "Rapid", "Octavia", "Superb"
  ],
  "Renault": [
    "Kwid", "Triber", "Kiger", "Duster", "Lodgy", "Pulse"
  ],
  "Nissan": [
    "Magnite", "Sunny", "Micra", "Terrano"
  ],
  "MG (Morris Garages)": [
    "Hector", "Astor", "ZS EV", "Comet EV", "Gloster"
  ],
  "BMW": [
    "3 Series", "5 Series", "7 Series", "X1", "X3", "X5"
  ],
  "Mercedes-Benz": [
    "C-Class", "E-Class", "S-Class", "GLA", "GLC", "GLE"
  ],
  "Audi": [
    "A4", "A6", "A8", "Q3", "Q5", "Q7"
  ]
};

export const CAR_PART_CATEGORIES = [
  "Engine & Mechanical",
  "Body & Exterior",
  "Lights & Electricals",
  "Suspension & Brakes",
  "Interior & Wheels",
  "Wiring & Harnesses"
];

export const CAR_SPARE_PARTS_BY_CATEGORY: Record<string, string[]> = {
  "Engine & Mechanical": [
    "Engine Assembly", "Gearbox/Transmission", "Alternator", "Starter Motor", "Radiator", "AC Compressor", "Fuel Pump", "Turbocharger"
  ],
  "Body & Exterior": [
    "Doors", "Windshield Glass", "Bonnet", "Boot Lid", "Front Bumper", "Rear Bumper", "Grille", "Side Mirrors (ORVM)", "Fender"
  ],
  "Lights & Electricals": [
    "Headlights", "Taillights", "Fog Lights", "Indicators", "Horn", "Battery", "ECU (Engine Control Unit)"
  ],
  "Suspension & Brakes": [
    "Shock Absorbers", "Steering Rack", "Brake Calipers", "Brake Discs", "Axle", "Driveshaft", "Control Arms"
  ],
  "Interior & Wheels": [
    "Seats", "Dashboard Panel", "Steering Wheel", "Music System/Stereo", "Alloy Wheels", "Steel Rims", "Tyres"
  ],
  "Wiring & Harnesses": [
    "Main Wiring Harness", "Engine Harness", "Dashboard Wiring Loom", "Door Wiring Harness", "Battery Cables"
  ]
};

export const POPULAR_LOCATIONS = [
  "All India",
  "Mumbai",
  "Delhi NCR",
  "Bangalore",
  "Chennai",
  "Hyderabad",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Kochi"
];

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
}

export interface Chat {
  id: string;
  partId: string;
  partTitle: string;
  partImageUrl: string;
  partPrice: number;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  lastMessageText: string;
  lastMessageAt: number;
  lastSenderId?: string;
}

export interface SellerReview {
  id: string;
  sellerId: string;
  buyerId: string;
  buyerName: string;
  rating: number; // 1-5
  comment: string;
  partId?: string;
  partTitle?: string;
  createdAt: number;
}

export interface Notification {
  id: string; // `${chatId}_${recipientId}`
  chatId: string;
  recipientId: string;
  senderId: string;
  text: string;
  createdAt: number;
  read: boolean;
  partTitle: string;
  partPrice: number;
  partImageUrl: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
}

