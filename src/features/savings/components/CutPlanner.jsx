import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import { Card } from "../../../components/ui/Card.jsx";

const fmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TIPS = {
  "Groceries": ["Try meal prepping on Sundays to reduce impulse buys", "Switch to store-brand items for staples", "Use a grocery list and stick to it — avoid shopping hungry"],
  "Dining": ["Cook at home 2 extra nights a week", "Limit food delivery to once a week as a treat", "Bring lunch to work — saves ~$10-15/day"],
  "Transport": ["Combine errands into fewer trips", "Use public transit or carpool 2-3 days/week", "Walk or bike for trips under 2 miles"],
  "Subscriptions": ["Audit and cancel unused subscriptions", "Share family plans with friends or roommates", "Rotate streaming services monthly instead of paying for all"],
  "Utilities": ["Switch to LED bulbs and smart power strips", "Adjust thermostat by 2°F — saves ~5-10% on bills", "Use off-peak hours for laundry and dishwasher"],
  "Shopping": ["Implement a 48-hour rule before non-essential purchases", "Unsubscribe from store marketing emails", "Set a monthly 'fun money' budget and stick to it"],
  "Health": ["Ask your doctor about generic medication alternatives", "Use in-network providers and preventive care", "Compare pharmacy prices — they vary widely"],
  "Entertainment": ["Look for free local events and activities", "Host game nights instead of going out", "Use your library for books, movies, and more"],
  "Other": ["Review each 'Other' expense — some might be unnecessary", "Set up automatic transfers to savings on payday", "Track daily spending for a week to find hidden leaks"],
};

/**
 * Restyled from the legacy `Dashboard`'s "Interactive Cut Planner" +
 * "Savings Projection" chart (`App.jsx`) onto design tokens/`ChartTooltip`.
 * Deliberately not persisted — only the goal itself closes ADR-007
 * (`useSavingsData.js`'s docblock); category cut selections stay local,
 * scratch-work component state, same as before.
 */
export function CutPlanner({ catBreakdown, numMonths, savingsSuggestion }) {
  const [cutSelections, setCutSelections] = useState({});
  const [showPlan, setShowPlan] = useState(false);

  const cuttable = catBreakdown.filter((c) => c.name !== "Income" && c.name !== "Housing");
  const totalCutPerMonth = cuttable.reduce((sum, c) => {
    const sel = cutSelections[c.name];
    if (!sel?.selected) return sum;
    const monthlyAvg = c.value / numMonths;
    return sum + (monthlyAvg * (sel.percent || 25)) / 100;
  }, 0);
  const selectedCount = cuttable.filter((c) => cutSelections[c.name]?.selected).length;
  const newMonthlyExpense = savingsSuggestion.avgMonthlyExpense - totalCutPerMonth;
  const newSurplus = savingsSuggestion.avgMonthlyIncome - newMonthlyExpense;
  const planFeasible = newSurplus >= savingsSuggestion.monthly;
  const selectedCats = cuttable.filter((c) => cutSelections[c.name]?.selected);

  const effectiveMonthly = Math.max(0, Math.min(savingsSuggestion.monthly, savingsSuggestion.surplus + totalCutPerMonth));
  const projectionData = Array.from({ length: savingsSuggestion.monthsLeft + 1 }, (_, i) => ({
    month: `Mo ${i}`,
    "With Cuts": Math.round(effectiveMonthly * i),
    "No Changes": Math.round(Math.max(0, savingsSuggestion.surplus) * i),
    Goal: savingsSuggestion.target,
  }));

  return (
    <>
      <Card style={{ marginTop: "var(--space-5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: 0 }}>Where can you cut back?</h2>
          {selectedCount > 0 && (
            <span style={{
              font: "600 12px var(--font-numeral)", padding: "4px 12px", borderRadius: "var(--radius-sm)",
              background: planFeasible ? "var(--positive-soft)" : "var(--surface-alt)",
              color: planFeasible ? "var(--positive)" : "var(--primary)",
            }}>
              {planFeasible ? "Goal achievable!" : `Saving ${fmt(totalCutPerMonth)}/mo so far`}
            </span>
          )}
        </div>
        <p style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)", margin: "0 0 var(--space-5)" }}>
          Pick 2–3 categories you're willing to reduce. Adjust the slider to set how much you can cut from each.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
          {cuttable.map((c) => {
            const monthlyAvg = c.value / numMonths;
            const sel = cutSelections[c.name] || { selected: false, percent: 25 };
            const saving = (monthlyAvg * sel.percent) / 100;

            return (
              <div
                key={c.name}
                style={{
                  background: sel.selected ? "var(--positive-soft)" : "var(--surface-alt)",
                  borderLeft: `3px solid ${sel.selected ? "var(--positive)" : "var(--border-strong)"}`,
                  borderRadius: "var(--radius-sm)", padding: "var(--space-3) var(--space-4)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setCutSelections((prev) => ({ ...prev, [c.name]: { ...sel, selected: !sel.selected, percent: sel.percent || 25 } }));
                      setShowPlan(false);
                    }}
                    aria-pressed={sel.selected}
                    aria-label={`Include ${c.name} in cut plan`}
                    style={{
                      width: 20, height: 20, borderRadius: 4, flexShrink: 0, cursor: "pointer", padding: 0,
                      border: `2px solid ${sel.selected ? "var(--positive)" : "var(--border-strong)"}`,
                      background: sel.selected ? "var(--positive)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {sel.selected && <span style={{ color: "var(--on-primary)", fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)" }}>{c.name}</span>
                      <span style={{ font: "13px var(--font-numeral)", color: "var(--text-subtle)" }}>{fmt(monthlyAvg)}/mo</span>
                    </div>

                    {sel.selected && (
                      <div style={{ marginTop: "var(--space-2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                          <span style={{ font: "11px var(--font-numeral)", color: "var(--text-subtle)", minWidth: 30 }}>Cut</span>
                          <input
                            type="range" min="10" max="80" step="5"
                            value={sel.percent}
                            aria-label={`Cut percentage for ${c.name}`}
                            onChange={(e) => {
                              setCutSelections((prev) => ({ ...prev, [c.name]: { ...sel, percent: parseInt(e.target.value, 10) } }));
                              setShowPlan(false);
                            }}
                            style={{ flex: 1, accentColor: "var(--positive)", cursor: "pointer" }}
                          />
                          <span style={{ font: "700 14px var(--font-numeral)", color: "var(--positive)", minWidth: 40, textAlign: "right" }}>
                            {sel.percent}%
                          </span>
                        </div>
                        <div style={{ font: "var(--text-body-sm)", color: "var(--positive)", marginTop: 6, fontWeight: 500 }}>
                          Save {fmt(saving)}/mo → keep {fmt(monthlyAvg - saving)}/mo for {c.name.toLowerCase()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedCount > 0 && (
          <div>
            <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "var(--space-4) var(--space-5)", marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <span style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)" }}>Monthly savings from cuts</span>
                <span style={{ font: "600 15px var(--font-numeral)", color: "var(--positive)" }}>+{fmt(totalCutPerMonth)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <span style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)" }}>New monthly surplus</span>
                <span style={{ font: "13px var(--font-numeral)", color: newSurplus >= savingsSuggestion.monthly ? "var(--positive)" : "var(--primary)" }}>
                  {newSurplus >= 0 ? "+" : ""}{fmt(newSurplus)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPlan(true)}
              style={{
                width: "100%", padding: "var(--space-3) var(--space-5)", borderRadius: "var(--radius-sm)",
                background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)",
                border: "none", color: "var(--on-primary)", font: "600 14px var(--font-body)", cursor: "pointer",
              }}
            >
              Generate My Savings Plan
            </button>
          </div>
        )}

        {showPlan && selectedCount > 0 && (
          <div style={{ marginTop: "var(--space-5)", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            <div style={{ padding: "var(--space-4) var(--space-5)", background: planFeasible ? "var(--positive-soft)" : "var(--surface)" }}>
              <div style={{ font: "600 15px var(--font-headline)", color: "var(--text)", marginBottom: 4 }}>
                {planFeasible ? "Your plan is on track" : "Your Action Plan"}
              </div>
              <div style={{ font: "var(--text-body-sm)", color: "var(--text-subtle)" }}>
                {planFeasible
                  ? `By cutting ${fmt(totalCutPerMonth)}/mo across ${selectedCount} categories, you'll save ${fmt(savingsSuggestion.target)} in ${savingsSuggestion.monthsLeft} months.`
                  : `These cuts save ${fmt(totalCutPerMonth)}/mo. You'll need to find ${fmt(savingsSuggestion.monthly - Math.max(0, newSurplus))} more or adjust your timeline.`}
              </div>
            </div>
            {selectedCats.map((c) => {
              const sel = cutSelections[c.name];
              const monthlyAvg = c.value / numMonths;
              const saving = (monthlyAvg * sel.percent) / 100;
              const catTips = TIPS[c.name] || TIPS["Other"];
              return (
                <div key={c.name} style={{ padding: "var(--space-4) var(--space-5)", borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                    <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text)" }}>
                      {c.name} <span style={{ fontWeight: 400, color: "var(--text-subtle)" }}>({fmt(monthlyAvg)}/mo → {fmt(monthlyAvg - saving)}/mo)</span>
                    </span>
                    <span style={{ font: "600 13px var(--font-numeral)", color: "var(--positive)", background: "var(--positive-soft)", padding: "3px 8px", borderRadius: "var(--radius-sm)" }}>
                      -{fmt(saving)}/mo
                    </span>
                  </div>
                  {catTips.map((tip, ti) => (
                    <div key={ti} style={{ display: "flex", gap: "var(--space-2)", marginBottom: 6, font: "var(--text-body-sm)", color: "var(--text-subtle)" }}>
                      <span style={{ color: "var(--primary)", flexShrink: 0 }}>→</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card style={{ marginTop: "var(--space-5)" }}>
        <h2 style={{ font: "var(--text-heading-sm)", color: "var(--text)", margin: "0 0 var(--space-4)" }}>Savings Projection</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={projectionData}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "var(--text-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(savingsSuggestion.monthsLeft / 8))} />
            <YAxis tick={{ fill: "var(--text-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
            <ReferenceLine y={savingsSuggestion.target} stroke="var(--border-strong)" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="With Cuts" stroke="var(--positive)" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="No Changes" stroke="var(--border-strong)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}
