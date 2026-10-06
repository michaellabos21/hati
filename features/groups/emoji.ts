const RULES: [RegExp, string][] = [
  [/boracay|beach|dagat|island|isla|palawan|siargao|trip|travel|bakasyon|outing/i, '🏝️'],
  [/research|project|thesis|school|class|org|group ?work|study/i, '🎓'],
  [/apartment|condo|dorm|bahay|house|boarding|rent|upa|roommate/i, '🏠'],
  [/birthday|party|debut|kasal|wedding|reunion|christmas|pasko|event/i, '🎉'],
  [/food|kain|dinner|lunch|samgyup|inuman|coffee|kape|barkada|tropa/i, '🍜'],
  [/office|work|team|trabaho/i, '💼'],
];

/** A friendly emoji for a group, picked from its name. */
export function groupEmoji(name: string): string {
  for (const [pattern, emoji] of RULES) {
    if (pattern.test(name)) return emoji;
  }
  return '🧾';
}

const EXPENSE_RULES: [RegExp, string][] = [
  [
    /grab|taxi|angkas|joyride|jeep|bus|pamasahe|fare|gas|toll|parking|van|ferry|flight|ticket/i,
    '🚕',
  ],
  [/hotel|airbnb|resort|room|stay|rent|upa|hostel/i, '🏨'],
  [/dinner|lunch|breakfast|food|kain|pizza|jollibee|samgyup|merienda|snack|ulam|rice/i, '🍕'],
  [/coffee|kape|milk ?tea|drinks|inuman|beer|alak/i, '🧋'],
  [/grocer|palengke|market|sm|puregold|supplies/i, '🛒'],
  [/kuryente|electric|meralco|tubig|water|wifi|internet|bill|load/i, '💡'],
  [/fee|entrance|island hopping|tour|activity/i, '🎟️'],
  [/print|photocopy|materials|school|book/i, '📚'],
];

/** A friendly emoji for an expense, picked from its description. */
export function expenseEmoji(description: string): string {
  for (const [pattern, emoji] of EXPENSE_RULES) {
    if (pattern.test(description)) return emoji;
  }
  return '🧾';
}
