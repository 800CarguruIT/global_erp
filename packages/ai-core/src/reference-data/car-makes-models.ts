export type CarModel = {
  make: string;
  name: string;
  fromYear?: number;
  toYear?: number;
};

export type CarMake = {
  name: string;
  models: CarModel[];
};

/**
 * Rich global list of makes/models. Extend as needed; this is intentionally compact but covers
 * popular passenger and light commercial vehicles across regions.
 */
export const carMakes: CarMake[] = [
  {
    name: "Toyota",
    models: [
      { make: "Toyota", name: "Corolla" },
      { make: "Toyota", name: "Camry" },
      { make: "Toyota", name: "Land Cruiser" },
      { make: "Toyota", name: "Prado" },
      { make: "Toyota", name: "Hilux" },
      { make: "Toyota", name: "RAV4" },
      { make: "Toyota", name: "Yaris" },
      { make: "Toyota", name: "Supra" },
    ],
  },
  {
    name: "Nissan",
    models: [
      { make: "Nissan", name: "Altima" },
      { make: "Nissan", name: "Patrol" },
      { make: "Nissan", name: "X-Trail" },
      { make: "Nissan", name: "Navara" },
      { make: "Nissan", name: "Sunny" },
      { make: "Nissan", name: "Maxima" },
      { make: "Nissan", name: "Murano" },
      { make: "Nissan", name: "GT-R" },
    ],
  },
  {
    name: "Honda",
    models: [
      { make: "Honda", name: "Civic" },
      { make: "Honda", name: "Accord" },
      { make: "Honda", name: "CR-V" },
      { make: "Honda", name: "Pilot" },
      { make: "Honda", name: "HR-V" },
      { make: "Honda", name: "Odyssey" },
      { make: "Honda", name: "City" },
      { make: "Honda", name: "Ridgeline" },
    ],
  },
  {
    name: "Hyundai",
    models: [
      { make: "Hyundai", name: "Elantra" },
      { make: "Hyundai", name: "Sonata" },
      { make: "Hyundai", name: "Tucson" },
      { make: "Hyundai", name: "Santa Fe" },
      { make: "Hyundai", name: "Accent" },
      { make: "Hyundai", name: "Creta" },
      { make: "Hyundai", name: "Palisade" },
      { make: "Hyundai", name: "Staria" },
    ],
  },
  {
    name: "Kia",
    models: [
      { make: "Kia", name: "Sportage" },
      { make: "Kia", name: "Sorento" },
      { make: "Kia", name: "Cerato" },
      { make: "Kia", name: "Rio" },
      { make: "Kia", name: "Seltos" },
      { make: "Kia", name: "Telluride" },
      { make: "Kia", name: "K5" },
      { make: "Kia", name: "Carnival" },
    ],
  },
  {
    name: "Ford",
    models: [
      { make: "Ford", name: "F-150" },
      { make: "Ford", name: "Ranger" },
      { make: "Ford", name: "Explorer" },
      { make: "Ford", name: "Mustang" },
      { make: "Ford", name: "Escape" },
      { make: "Ford", name: "Edge" },
      { make: "Ford", name: "Bronco" },
      { make: "Ford", name: "Transit" },
    ],
  },
  {
    name: "Chevrolet",
    models: [
      { make: "Chevrolet", name: "Tahoe" },
      { make: "Chevrolet", name: "Suburban" },
      { make: "Chevrolet", name: "Silverado" },
      { make: "Chevrolet", name: "Camaro" },
      { make: "Chevrolet", name: "Traverse" },
      { make: "Chevrolet", name: "Malibu" },
      { make: "Chevrolet", name: "Blazer" },
      { make: "Chevrolet", name: "Trailblazer" },
    ],
  },
  {
    name: "Jeep",
    models: [
      { make: "Jeep", name: "Wrangler" },
      { make: "Jeep", name: "Grand Cherokee" },
      { make: "Jeep", name: "Cherokee" },
      { make: "Jeep", name: "Compass" },
      { make: "Jeep", name: "Renegade" },
      { make: "Jeep", name: "Gladiator" },
    ],
  },
  {
    name: "Mazda",
    models: [
      { make: "Mazda", name: "Mazda3" },
      { make: "Mazda", name: "Mazda6" },
      { make: "Mazda", name: "CX-3" },
      { make: "Mazda", name: "CX-5" },
      { make: "Mazda", name: "CX-9" },
      { make: "Mazda", name: "MX-5 Miata" },
      { make: "Mazda", name: "BT-50" },
    ],
  },
  {
    name: "Mitsubishi",
    models: [
      { make: "Mitsubishi", name: "Pajero" },
      { make: "Mitsubishi", name: "Lancer" },
      { make: "Mitsubishi", name: "Outlander" },
      { make: "Mitsubishi", name: "ASX" },
      { make: "Mitsubishi", name: "Eclipse Cross" },
      { make: "Mitsubishi", name: "Attrage" },
    ],
  },
  {
    name: "Volkswagen",
    models: [
      { make: "Volkswagen", name: "Golf" },
      { make: "Volkswagen", name: "Passat" },
      { make: "Volkswagen", name: "Tiguan" },
      { make: "Volkswagen", name: "Touareg" },
      { make: "Volkswagen", name: "Jetta" },
      { make: "Volkswagen", name: "Polo" },
      { make: "Volkswagen", name: "Atlas" },
    ],
  },
  {
    name: "BMW",
    models: [
      { make: "BMW", name: "1 Series" },
      { make: "BMW", name: "3 Series" },
      { make: "BMW", name: "5 Series" },
      { make: "BMW", name: "7 Series" },
      { make: "BMW", name: "X1" },
      { make: "BMW", name: "X3" },
      { make: "BMW", name: "X5" },
      { make: "BMW", name: "X7" },
    ],
  },
  {
    name: "Mercedes-Benz",
    models: [
      { make: "Mercedes-Benz", name: "A-Class" },
      { make: "Mercedes-Benz", name: "C-Class" },
      { make: "Mercedes-Benz", name: "E-Class" },
      { make: "Mercedes-Benz", name: "S-Class" },
      { make: "Mercedes-Benz", name: "GLC" },
      { make: "Mercedes-Benz", name: "GLE" },
      { make: "Mercedes-Benz", name: "GLS" },
      { make: "Mercedes-Benz", name: "G-Class" },
    ],
  },
  {
    name: "Audi",
    models: [
      { make: "Audi", name: "A3" },
      { make: "Audi", name: "A4" },
      { make: "Audi", name: "A6" },
      { make: "Audi", name: "A8" },
      { make: "Audi", name: "Q3" },
      { make: "Audi", name: "Q5" },
      { make: "Audi", name: "Q7" },
      { make: "Audi", name: "Q8" },
    ],
  },
  {
    name: "Lexus",
    models: [
      { make: "Lexus", name: "ES" },
      { make: "Lexus", name: "IS" },
      { make: "Lexus", name: "RX" },
      { make: "Lexus", name: "GX" },
      { make: "Lexus", name: "LX" },
      { make: "Lexus", name: "NX" },
      { make: "Lexus", name: "UX" },
    ],
  },
  {
    name: "Volvo",
    models: [
      { make: "Volvo", name: "S60" },
      { make: "Volvo", name: "S90" },
      { make: "Volvo", name: "XC40" },
      { make: "Volvo", name: "XC60" },
      { make: "Volvo", name: "XC90" },
      { make: "Volvo", name: "V60" },
    ],
  },
  {
    name: "Jaguar",
    models: [
      { make: "Jaguar", name: "XE" },
      { make: "Jaguar", name: "XF" },
      { make: "Jaguar", name: "XJ" },
      { make: "Jaguar", name: "E-PACE" },
      { make: "Jaguar", name: "F-PACE" },
      { make: "Jaguar", name: "I-PACE" },
    ],
  },
  {
    name: "Land Rover",
    models: [
      { make: "Land Rover", name: "Defender" },
      { make: "Land Rover", name: "Discovery" },
      { make: "Land Rover", name: "Range Rover" },
      { make: "Land Rover", name: "Range Rover Sport" },
      { make: "Land Rover", name: "Range Rover Evoque" },
    ],
  },
  {
    name: "Porsche",
    models: [
      { make: "Porsche", name: "911" },
      { make: "Porsche", name: "Cayenne" },
      { make: "Porsche", name: "Macan" },
      { make: "Porsche", name: "Panamera" },
      { make: "Porsche", name: "Taycan" },
    ],
  },
  {
    name: "Tesla",
    models: [
      { make: "Tesla", name: "Model S" },
      { make: "Tesla", name: "Model 3" },
      { make: "Tesla", name: "Model X" },
      { make: "Tesla", name: "Model Y" },
      { make: "Tesla", name: "Roadster" },
    ],
  },
  {
    name: "Renault",
    models: [
      { make: "Renault", name: "Clio" },
      { make: "Renault", name: "Megane" },
      { make: "Renault", name: "Captur" },
      { make: "Renault", name: "Duster" },
    ],
  },
  {
    name: "Peugeot",
    models: [
      { make: "Peugeot", name: "208" },
      { make: "Peugeot", name: "308" },
      { make: "Peugeot", name: "508" },
      { make: "Peugeot", name: "3008" },
      { make: "Peugeot", name: "5008" },
    ],
  },
  {
    name: "Citroën",
    models: [
      { make: "Citroën", name: "C3" },
      { make: "Citroën", name: "C4" },
      { make: "Citroën", name: "C5 Aircross" },
      { make: "Citroën", name: "Berlingo" },
    ],
  },
  {
    name: "Skoda",
    models: [
      { make: "Skoda", name: "Octavia" },
      { make: "Skoda", name: "Superb" },
      { make: "Skoda", name: "Kodiaq" },
      { make: "Skoda", name: "Karoq" },
    ],
  },
  {
    name: "Subaru",
    models: [
      { make: "Subaru", name: "Impreza" },
      { make: "Subaru", name: "Forester" },
      { make: "Subaru", name: "Outback" },
      { make: "Subaru", name: "WRX" },
    ],
  },
  {
    name: "Suzuki",
    models: [
      { make: "Suzuki", name: "Swift" },
      { make: "Suzuki", name: "Vitara" },
      { make: "Suzuki", name: "Jimny" },
      { make: "Suzuki", name: "Ciaz" },
    ],
  },
  {
    name: "Dodge",
    models: [
      { make: "Dodge", name: "Charger" },
      { make: "Dodge", name: "Challenger" },
      { make: "Dodge", name: "Durango" },
      { make: "Dodge", name: "RAM" },
    ],
  },
  {
    name: "GMC",
    models: [
      { make: "GMC", name: "Sierra" },
      { make: "GMC", name: "Yukon" },
      { make: "GMC", name: "Terrain" },
      { make: "GMC", name: "Acadia" },
    ],
  },
  {
    name: "Cadillac",
    models: [
      { make: "Cadillac", name: "Escalade" },
      { make: "Cadillac", name: "XT5" },
      { make: "Cadillac", name: "XT6" },
      { make: "Cadillac", name: "CT5" },
    ],
  },
  {
    name: "Infiniti",
    models: [
      { make: "Infiniti", name: "Q50" },
      { make: "Infiniti", name: "QX50" },
      { make: "Infiniti", name: "QX60" },
      { make: "Infiniti", name: "QX80" },
    ],
  },
  {
    name: "Genesis",
    models: [
      { make: "Genesis", name: "G70" },
      { make: "Genesis", name: "G80" },
      { make: "Genesis", name: "G90" },
      { make: "Genesis", name: "GV70" },
      { make: "Genesis", name: "GV80" },
    ],
  },
  {
    name: "Chery",
    models: [
      { make: "Chery", name: "Tiggo 4" },
      { make: "Chery", name: "Tiggo 7" },
      { make: "Chery", name: "Tiggo 8" },
      { make: "Chery", name: "Arrizo 6" },
    ],
  },
  {
    name: "Geely",
    models: [
      { make: "Geely", name: "Coolray" },
      { make: "Geely", name: "Azkarra" },
      { make: "Geely", name: "Tugella" },
      { make: "Geely", name: "Emgrand" },
    ],
  },
  {
    name: "Great Wall",
    models: [
      { make: "Great Wall", name: "Poer" },
      { make: "Great Wall", name: "Wingle" },
      { make: "Great Wall", name: "Tank 300" },
    ],
  },
  {
    name: "MG",
    models: [
      { make: "MG", name: "MG5" },
      { make: "MG", name: "MG6" },
      { make: "MG", name: "HS" },
      { make: "MG", name: "ZS" },
    ],
  },
  {
    name: "Fiat",
    models: [
      { make: "Fiat", name: "500" },
      { make: "Fiat", name: "Panda" },
      { make: "Fiat", name: "Tipo" },
    ],
  },
  {
    name: "Alfa Romeo",
    models: [
      { make: "Alfa Romeo", name: "Giulia" },
      { make: "Alfa Romeo", name: "Stelvio" },
      { make: "Alfa Romeo", name: "Tonale" },
    ],
  },
  {
    name: "Mini",
    models: [
      { make: "Mini", name: "Cooper" },
      { make: "Mini", name: "Clubman" },
      { make: "Mini", name: "Countryman" },
    ],
  },
  {
    name: "Rolls-Royce",
    models: [
      { make: "Rolls-Royce", name: "Ghost" },
      { make: "Rolls-Royce", name: "Phantom" },
      { make: "Rolls-Royce", name: "Cullinan" },
    ],
  },
  {
    name: "Bentley",
    models: [
      { make: "Bentley", name: "Continental GT" },
      { make: "Bentley", name: "Flying Spur" },
      { make: "Bentley", name: "Bentayga" },
    ],
  },
];
