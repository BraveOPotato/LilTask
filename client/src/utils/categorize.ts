const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '🥦 Produce':    ['apple','banana','orange','grape','lettuce','spinach','kale','tomato','onion','garlic','carrot','broccoli','pepper','potato','avocado','lemon','lime','berry','berries','mango','celery','cucumber','zucchini','mushroom','herbs','basil','cilantro','parsley'],
  '🥩 Meat & Fish':['chicken','beef','pork','fish','salmon','tuna','shrimp','turkey','lamb','steak','bacon','sausage','meat'],
  '🧀 Dairy':      ['milk','cheese','yogurt','butter','cream','egg','eggs','dairy'],
  '🍞 Bakery':     ['bread','bagel','muffin','cake','cookie','tortilla','bun','roll','pastry','croissant'],
  '🥫 Pantry':     ['pasta','rice','bean','beans','lentil','soup','can','canned','sauce','oil','vinegar','spice','flour','sugar','salt','cereal','oat','oats','jam','peanut'],
  '🧴 Household':  ['soap','shampoo','toothpaste','detergent','toilet','paper','towel','cleaner','bleach','trash','bag','bags','dishwasher'],
  '🥤 Drinks':     ['water','juice','coffee','tea','soda','wine','beer','drink','drinks','beverage'],
  '🧊 Frozen':     ['frozen','ice cream','pizza','fries'],
};

export function categorize(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(w => lower.includes(w))) return cat;
  }
  return '📋 Other';
}
