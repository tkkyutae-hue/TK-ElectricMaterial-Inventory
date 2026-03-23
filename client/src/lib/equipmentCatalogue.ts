export const EQUIP_TYPE_CATALOGUE: Record<string, { sizes: string[]; brands: string[] }> = {
  "Air Compressor":    { sizes: ["20 gal", "30 gal", "60 gal", "80 gal"],            brands: ["DeWalt", "Ingersoll Rand", "Makita", "Sullair"] },
  "Generator":         { sizes: ["3,500W", "5,500W", "7,500W", "10,000W"],            brands: ["Honda", "Generac", "Kohler", "Caterpillar"] },
  "Forklift":          { sizes: ["3,000 lbs", "5,000 lbs", "8,000 lbs", "15,000 lbs"], brands: ["Toyota", "Caterpillar", "Hyster", "Crown"] },
  "Scissor Lift":      { sizes: ["19 ft", "26 ft", "32 ft", "40 ft"],                brands: ["JLG", "Genie", "Skyjack"] },
  "Boom Lift":         { sizes: ["45 ft", "60 ft", "80 ft"],                          brands: ["JLG", "Genie", "Skyjack"] },
  "Conduit Bender":    { sizes: ['1/2"', '3/4"', '1"', '1-1/4"', '2"'],              brands: ["Greenlee", "Klein Tools", "Ideal", "Southwire"] },
  "Wire Puller":       { sizes: ["1,000 lbs", "2,500 lbs", "5,000 lbs"],             brands: ["Greenlee", "Maxis", "Southwire"] },
  "Drill":             { sizes: ['1/2"', '3/4"', "SDS", "Hammer"],                   brands: ["DeWalt", "Milwaukee", "Makita", "Hilti"] },
  "Grinder":           { sizes: ['4.5"', '5"', '7"', '9"'],                           brands: ["DeWalt", "Milwaukee", "Makita", "Bosch"] },
  "Vacuum":            { sizes: ["5 gal", "10 gal", "16 gal", "55 gal"],             brands: ["DeWalt", "Milwaukee", "Ridgid", "Bosch"] },
  "Power Distribution":{ sizes: ["100A", "200A", "400A", "600A"],                    brands: ["Siemens", "Square D", "Eaton", "ABB"] },
  "Cable Puller":      { sizes: ["1,000 lbs", "2,500 lbs", "5,000 lbs"],             brands: ["Greenlee", "Maxis", "Southwire"] },
  "Other":             { sizes: [],                                                   brands: [] },
};

export const EQUIP_TYPES = Object.keys(EQUIP_TYPE_CATALOGUE);
