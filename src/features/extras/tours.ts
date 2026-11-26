import type { TourStep } from './Tour'

/** Guided-tour steps per screen (matched by path prefix; most specific first). */
export const TOURS: { path: RegExp; steps: TourStep[] }[] = [
  {
    path: /^\/$/,
    steps: [
      { target: 'sync', hi: 'यह हरा निशान बताता है कि सब सेव है। बिना इंटरनेट के भी काम करते रहें — सब फ़ोन में सुरक्षित रहता है।', en: 'This green badge means everything is saved. Keep working without internet — it is all safe on the phone.' },
      { target: 'tile-order', hi: 'नया ऑर्डर लेने के लिए यहाँ दबाएँ: ग्राहक चुनें → कपड़े और दर → तारीख़ और एडवांस।', en: 'Tap here to take a new order: customer → garments & rates → dates & advance.' },
      { target: 'tile-customers', hi: 'सभी ग्राहक, उनके नाप, ऑर्डर और बकाया यहाँ हैं। नाम हिंदी या अंग्रेज़ी में खोजें।', en: 'All customers with their measurements, orders and dues. Search in Hindi or English.' },
      { target: 'tile-payment', hi: 'किसी से पैसे मिलें तो यहाँ लिखें — बकाया अपने-आप घट जाएगा।', en: 'When someone pays, record it here — their balance updates automatically.' },
      { target: 'tile-summary', hi: 'दुकान का पूरा हिसाब: कितना बिल बना, कितने पैसे आए, कितना बाकी है।', en: 'The whole picture: billed, collected and still due.' },
      { target: 'home-deliveries', hi: 'आज किसे कपड़े देने हैं और कौन-से ऑर्डर देर से चल रहे हैं — यहाँ दिखता है।', en: 'Today’s deliveries and late orders show up here.' },
    ],
  },
  {
    path: /^\/orders\/new/,
    steps: [
      { target: 'wizard-steps', hi: 'ऑर्डर तीन छोटे कदमों में बनता है। अधूरा छोड़ दें तो भी लिखा हुआ बचा रहता है।', en: 'An order takes three short steps. If you stop midway, what you typed is kept.' },
      { target: 'wizard-total', hi: 'नीचे हमेशा कुल रकम दिखती है। "आगे" दबाकर अगला कदम।', en: 'The total is always shown at the bottom. Tap "Next" for the next step.' },
    ],
  },
  {
    path: /^\/customers$/,
    steps: [
      { target: 'customer-search', hi: 'नाम (हिंदी/अंग्रेज़ी), फ़ोन के कुछ अंक या मोहल्ला लिखें — ग्राहक मिल जाएगा।', en: 'Type a name (Hindi/English), part of the phone or the area to find a customer.' },
      { target: 'customer-add', hi: 'नया ग्राहक जोड़ने के लिए यहाँ दबाएँ। सिर्फ़ नाम ज़रूरी है।', en: 'Tap to add a new customer. Only the name is required.' },
    ],
  },
  {
    path: /^\/bills\/[^/]+$/,
    steps: [
      { target: 'bill-share', hi: 'बिल की फ़ोटो सीधे WhatsApp पर ग्राहक को भेजें। बिल पर UPI QR भी छपता है।', en: 'Send the bill photo straight to the customer on WhatsApp. It carries a UPI QR too.' },
      { target: 'bill-pay', hi: 'पैसे मिलें तो यहाँ दबाएँ।', en: 'Tap here when you receive the money.' },
    ],
  },
  {
    path: /^\/orders\/[^/]+$/,
    steps: [
      { target: 'order-next', hi: 'काम आगे बढ़े तो यह बड़ा बटन दबाएँ: मिला → कटिंग → सिलाई → ट्रायल → तैयार → दिया।', en: 'Tap this big button as work moves along: received → cutting → stitching → trial → ready → delivered.' },
      { target: 'order-bill', hi: 'कपड़े तैयार हों तो यहाँ से बिल बनाएँ।', en: 'Make the bill from here when the clothes are ready.' },
    ],
  },
]

export const tourFor = (path: string): TourStep[] => TOURS.find((t) => t.path.test(path))?.steps ?? []
