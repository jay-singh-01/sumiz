import type { GarmentCategory, MeasurementField } from './schema'

// Starting master data for a Rajasthani tailoring shop. Every rate is a
// placeholder and everything is editable in the app ("दरें और कपड़े").

const F = (key: string, labelHi: string, labelEn: string, unit: MeasurementField['unit'] = 'inch'): MeasurementField => ({
  key,
  labelHi,
  labelEn,
  unit,
})

const f = {
  shoulder: F('shoulder', 'कंधा', 'Shoulder'),
  bust: F('bust', 'छाती', 'Bust / Chest'),
  waist: F('waist', 'कमर', 'Waist'),
  hip: F('hip', 'हिप', 'Hip'),
  length: F('length', 'लंबाई', 'Length'),
  frontLength: F('frontLength', 'आगे की लंबाई', 'Front length'),
  backLength: F('backLength', 'पीछे की लंबाई', 'Back length'),
  sleeveLength: F('sleeveLength', 'बाँह की लंबाई', 'Sleeve length'),
  sleeveRound: F('sleeveRound', 'बाँह की गोलाई', 'Sleeve round'),
  armhole: F('armhole', 'मुड्ढा (आर्महोल)', 'Armhole'),
  frontNeck: F('frontNeck', 'आगे गले की गहराई', 'Front neck depth'),
  backNeck: F('backNeck', 'पीछे गले की गहराई', 'Back neck depth'),
  neck: F('neck', 'गला', 'Neck'),
  kaliCount: F('kaliCount', 'कली (गिनती)', 'Kali / panel count', 'count'),
  flare: F('flare', 'घेर', 'Flare'),
  skirtLength: F('skirtLength', 'घाघरे की लंबाई', 'Skirt length'),
  bottomLength: F('bottomLength', 'सलवार/पजामे की लंबाई', 'Bottom length'),
  bottomRound: F('bottomRound', 'मोहरी', 'Bottom opening'),
  thigh: F('thigh', 'जांघ', 'Thigh'),
}

const blouse = [f.shoulder, f.bust, f.waist, f.frontLength, f.backLength, f.sleeveLength, f.sleeveRound, f.armhole, f.frontNeck, f.backNeck]
const kurti = [f.shoulder, f.bust, f.waist, f.hip, f.length, f.sleeveLength, f.sleeveRound, f.armhole, f.frontNeck, f.backNeck]
const bottoms = [f.waist, f.hip, f.length, f.thigh, f.bottomRound]

type Seed = [id: string, nameHi: string, nameEn: string, category: GarmentCategory, rate: number, days: number, icon: string, fields: MeasurementField[]]

export const SEED_GARMENTS: Seed[] = [
  ['rajputi-poshak', 'राजपूती पोशाक', 'Rajputi poshak', 'women', 2500, 10, '👑', [...kurti, f.skirtLength, f.kaliCount]],
  ['lehenga', 'लहंगा / घाघरा', 'Lehenga / Ghagra', 'women', 1500, 10, '💃', [f.waist, f.length, f.hip, f.kaliCount, f.flare]],
  ['odhni', 'ओढ़नी फ़िनिशिंग', 'Odhni finishing', 'women', 200, 3, '🧣', []],
  ['blouse-simple', 'ब्लाउज़ (सादा)', 'Blouse (simple)', 'women', 350, 5, '👚', blouse],
  ['blouse-designer', 'ब्लाउज़ (डिज़ाइनर)', 'Blouse (designer)', 'women', 700, 7, '✨', blouse],
  ['blouse-padded', 'ब्लाउज़ (पैडेड)', 'Blouse (padded)', 'women', 900, 7, '🎀', blouse],
  ['kurti', 'कुर्ती', 'Kurti', 'women', 400, 5, '👗', kurti],
  ['salwar-suit', 'सलवार सूट', 'Salwar suit', 'women', 600, 7, '🥻', [...kurti, f.bottomLength, f.bottomRound]],
  ['anarkali', 'अनारकली', 'Anarkali', 'women', 1200, 10, '🌸', [f.shoulder, f.bust, f.waist, f.length, f.sleeveLength, f.sleeveRound, f.armhole, f.frontNeck, f.backNeck, f.flare]],
  ['sharara', 'शरारा', 'Sharara', 'women', 700, 7, '🌺', bottoms],
  ['gharara', 'गरारा', 'Gharara', 'women', 800, 7, '🌼', bottoms],
  ['plazo', 'प्लाज़ो', 'Palazzo', 'women', 350, 4, '🩳', bottoms],
  ['fall-pico', 'साड़ी फ़ॉल-पीको', 'Saree fall-pico', 'women', 120, 2, '🪡', []],
  ['petticoat', 'पेटीकोट', 'Petticoat', 'women', 200, 3, '🩱', [f.waist, f.length, f.hip]],
  ['kurta-pajama', 'कुर्ता-पजामा', 'Kurta-pajama', 'men', 700, 7, '👔', [f.neck, f.shoulder, f.bust, f.waist, f.length, f.sleeveLength, f.bottomLength, f.bottomRound]],
  ['nehru-jacket', 'नेहरू जैकेट', 'Nehru jacket', 'men', 900, 7, '🧥', [f.neck, f.shoulder, f.bust, f.waist, f.hip, f.length]],
  ['kids-frock', 'बच्चों की फ़्रॉक', 'Kids’ frock', 'kids', 350, 5, '🎈', [f.shoulder, f.bust, f.waist, f.length, f.sleeveLength]],
  ['kids-lehenga', 'बच्चों का लहंगा', 'Kids’ lehenga', 'kids', 700, 7, '🪅', [f.shoulder, f.bust, f.waist, f.length]],
  ['alter-fitting', 'ऑल्टर — फ़िटिंग', 'Alteration — fitting', 'alteration', 100, 2, '✂️', []],
  ['alter-length', 'ऑल्टर — लंबाई', 'Alteration — length', 'alteration', 80, 2, '📏', []],
  ['alter-hemming', 'ऑल्टर — तुरपाई', 'Alteration — hemming', 'alteration', 60, 2, '🧵', []],
]

export const SEED_ADDONS: [id: string, nameHi: string, nameEn: string, rate: number][] = [
  ['gota-patti', 'गोटा-पत्ती', 'Gota-patti work', 400],
  ['aari', 'आरी वर्क', 'Aari work', 800],
  ['zari', 'ज़री वर्क', 'Zari work', 600],
  ['mirror', 'शीशा (मिरर) वर्क', 'Mirror (shisha) work', 500],
  ['latkan', 'लटकन', 'Latkan / tassels', 80],
  ['lining', 'अस्तर', 'Lining', 120],
  ['piping', 'पाइपिंग', 'Piping', 60],
  ['dori', 'डोरी', 'Dori', 40],
  ['padding', 'पैडिंग / कप', 'Padding / cups', 150],
  ['hook-zip', 'हुक / ज़िप बदलना', 'Hook / zip change', 50],
  ['fall-pico-addon', 'फ़ॉल-पीको', 'Fall-pico', 120],
  ['express', 'जल्दी डिलीवरी', 'Extra-fast delivery', 200],
]

