// Generates six months of realistic-looking sample transactions for the
// dashboard's "Try with sample data" demo — client-side only, never
// persisted server-side. Extracted from App.jsx (Phase 10 final cleanup).

export function generateSampleData() {
  const txns = [];
  const now = new Date();
  const merchants = [
    { desc: "WHOLE FOODS MARKET", min: -40, max: -150 },
    { desc: "STARBUCKS COFFEE", min: -4, max: -12 },
    { desc: "UBER TRIP", min: -8, max: -35 },
    { desc: "NETFLIX SUBSCRIPTION", min: -15.99, max: -15.99 },
    { desc: "SPOTIFY PREMIUM", min: -9.99, max: -9.99 },
    { desc: "RENT PAYMENT", min: -1800, max: -1800 },
    { desc: "COMCAST INTERNET", min: -79.99, max: -79.99 },
    { desc: "SHELL GAS STATION", min: -30, max: -65 },
    { desc: "AMAZON.COM", min: -15, max: -200 },
    { desc: "CHIPOTLE MEXICAN GRILL", min: -10, max: -18 },
    { desc: "CVS PHARMACY", min: -8, max: -45 },
    { desc: "PAYROLL DIRECT DEPOSIT", min: 3200, max: 3200 },
    { desc: "TARGET STORE", min: -20, max: -120 },
    { desc: "DOORDASH DELIVERY", min: -15, max: -45 },
    { desc: "GYM MEMBERSHIP", min: -49.99, max: -49.99 },
    { desc: "ELECTRIC COMPANY", min: -90, max: -160 },
    { desc: "MOVIE THEATER", min: -12, max: -25 },
    { desc: "BEST BUY ELECTRONICS", min: -30, max: -300 },
  ];

  for (let m = 5; m >= 0; m--) {
    const baseDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
    // Payroll on 1st and 15th
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 1), desc: "PAYROLL DIRECT DEPOSIT", amount: 3200 });
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 15), desc: "PAYROLL DIRECT DEPOSIT", amount: 3200 });
    // Rent on 1st
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 1), desc: "RENT PAYMENT", amount: -1800 });
    // Subscriptions
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 5), desc: "NETFLIX SUBSCRIPTION", amount: -15.99 });
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 8), desc: "SPOTIFY PREMIUM", amount: -9.99 });
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 10), desc: "GYM MEMBERSHIP", amount: -49.99 });
    txns.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 12), desc: "COMCAST INTERNET", amount: -79.99 });
    // Random transactions
    const numRandom = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i < numRandom; i++) {
      const day = 1 + Math.floor(Math.random() * daysInMonth);
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      if (merchant.desc.includes("PAYROLL") || merchant.desc.includes("RENT") || merchant.desc.includes("NETFLIX") || merchant.desc.includes("SPOTIFY") || merchant.desc.includes("GYM") || merchant.desc.includes("COMCAST")) continue;
      const amount = merchant.min === merchant.max ? merchant.min : merchant.min + Math.random() * (merchant.max - merchant.min);
      txns.push({
        date: new Date(baseDate.getFullYear(), baseDate.getMonth(), Math.min(day, daysInMonth)),
        desc: merchant.desc,
        amount: Math.round(amount * 100) / 100,
      });
    }
  }
  txns.sort((a, b) => b.date - a.date);
  return txns;
}
