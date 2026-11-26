/** Festival greeting messages (Hindi, warm and short). {name} and {shop} are filled in. */
export const FESTIVALS = ['diwali', 'teej', 'rakhi', 'holi', 'gangaur', 'karwa', 'newyear', 'eid'] as const
export type Festival = (typeof FESTIVALS)[number] | 'birthday' | 'anniversary'

export const GREETING_TEXT: Record<Festival, string> = {
  diwali: 'नमस्ते {name} जी 🪔 आपको और आपके परिवार को दीवाली की ढेर सारी शुभकामनाएँ! सुख, समृद्धि और खुशियाँ बनी रहें। — {shop}',
  teej: 'नमस्ते {name} जी 🌿 हरियाली तीज की हार्दिक शुभकामनाएँ! सावन की बहार आपके जीवन में खुशियाँ लाए। — {shop}',
  rakhi: 'नमस्ते {name} जी 🧵 रक्षाबंधन की हार्दिक शुभकामनाएँ! भाई-बहन का प्यार सदा बना रहे। — {shop}',
  holi: 'नमस्ते {name} जी 🌈 होली की रंग-बिरंगी शुभकामनाएँ! आपका जीवन खुशियों के रंगों से भरा रहे। — {shop}',
  gangaur: 'नमस्ते {name} जी 🌸 गणगौर की हार्दिक शुभकामनाएँ! गौरी माँ का आशीर्वाद सदा बना रहे। — {shop}',
  karwa: 'नमस्ते {name} जी 🌙 करवा चौथ की हार्दिक शुभकामनाएँ! आपका सुहाग सदा सलामत रहे। — {shop}',
  newyear: 'नमस्ते {name} जी 🎉 नए साल की हार्दिक शुभकामनाएँ! यह साल आपके लिए ढेर सारी खुशियाँ लाए। — {shop}',
  eid: 'नमस्ते {name} जी 🌙 ईद मुबारक! आपके घर खुशियाँ और बरकत बनी रहे। — {shop}',
  birthday: 'नमस्ते {name} जी 🎂 जन्मदिन की बहुत-बहुत बधाई! आपका हर दिन खुशियों से भरा रहे। — {shop}',
  anniversary: 'नमस्ते {name} जी 💐 शादी की सालगिरह की हार्दिक बधाई! आपकी जोड़ी सदा सलामत रहे। — {shop}',
}

/** True when an ISO birthday/anniversary (any year) falls on today's month and day. */
export const isToday = (iso: string, today: Date) => !!iso && iso.slice(5) === `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
