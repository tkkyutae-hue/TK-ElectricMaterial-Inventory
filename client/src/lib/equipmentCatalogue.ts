export const EQUIP_TYPE_CATALOGUE: Record<string, { sizes: string[]; brands: string[] }> = {
  "Air Compressor":    { sizes: ["20 Gal", "30 Gal", "60 Gal", "80 Gal", "120 Gal"],  brands: ["Ingersoll Rand", "DeWalt", "Makita", "Campbell Hausfeld"] },
  "Generator":         { sizes: ["3 kVA", "5 kVA", "7.5 kVA", "10 kVA", "20 kVA"],   brands: ["Honda", "Kohler", "Generac", "Kubota"] },
  "Forklift":          { sizes: ["3,000 lb", "5,000 lb", "8,000 lb", "10,000 lb"],    brands: ["Toyota", "Crown", "Hyster", "Yale"] },
  "Scissor Lift":      { sizes: ["19 ft", "26 ft", "32 ft", "40 ft"],                 brands: ["JLG", "Genie", "Skyjack"] },
  "Boom Lift":         { sizes: ["30 ft", "40 ft", "60 ft", "80 ft"],                 brands: ["JLG", "Genie", "Manitowoc"] },
  "Conduit Bender":    { sizes: ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"'],   brands: ["Greenlee", "Ideal", "Klein Tools"] },
  "Wire Puller":       { sizes: ['1/4" Rope', "1000 lb", "5000 lb"],                  brands: ["Greenlee", "Ideal", "Southwire"] },
  "Drill":             { sizes: ['1/2"', '3/4"', "SDS", "Rotary Hammer"],             brands: ["Milwaukee", "DeWalt", "Hilti", "Bosch"] },
  "Grinder":           { sizes: ['4-1/2"', '5"', '7"', '9"'],                         brands: ["Milwaukee", "DeWalt", "Metabo", "Makita"] },
  "Vacuum":            { sizes: ["5 Gal", "10 Gal", "16 Gal"],                        brands: ["DeWalt", "Ridgid", "Festool"] },
  "Power Distribution":{ sizes: ["60A", "100A", "200A", "400A"],                      brands: ["Lex Products", "Hubbell", "Meltric"] },
  "Cable Puller":      { sizes: ["1200 lb", "4000 lb", "8000 lb"],                    brands: ["Greenlee", "Condux", "DCD Design"] },
  "Other":             { sizes: [],                                                    brands: [] },
};

export const EQUIP_TYPES = Object.keys(EQUIP_TYPE_CATALOGUE);
