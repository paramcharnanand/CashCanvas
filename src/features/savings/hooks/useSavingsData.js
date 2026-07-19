import { useEffect, useState, useCallback } from "react";
import _ from "lodash";
import { apiFetch } from "../../../api.js";
import { categorize } from "../../../App.jsx";

const emptyGoal = { name: "", amount: "", deadline: "" };

/**
 * Fetches the most recent uploaded statement (same "separate route, no
 * shared state with `LegacyWorkspace`" pattern as every other Phase 8.6–8.8
 * hook) to derive `catBreakdown`/`monthlyData`/`totalIncome`/`totalExpenses`
 * — the same pure computation `App.jsx`'s `Dashboard` already does, ported
 * unchanged — plus the persisted savings goal itself (`GET/PUT /api/savings`,
 * Phase 8.9, closes ADR-007: "savings goal" was unsaved client-side React
 * state until this phase).
 *
 * Only the goal (name/amount/deadline) is persisted, matching the migration
 * plan's stated scope exactly ("now actually persisted, closing ADR-007") —
 * the Cut Planner's category selections/percentages stay local component
 * state, same as before, since nothing in the plan calls for persisting
 * planner scratch-work itself.
 */
export function useSavingsData() {
  const [transactions, setTransactions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingsGoal, setSavingsGoal] = useState(emptyGoal);
  const [goalSaved, setGoalSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiFetch("/api/files").then((r) => r.json()),
      apiFetch("/api/merchant-rules").then((r) => r.json()).catch(() => []),
      apiFetch("/api/categories").then((r) => r.json()).catch(() => []),
      apiFetch("/api/savings").then((r) => r.json()).catch(() => null),
    ]).then(async ([files, rulesData, catsData, goal]) => {
      if (cancelled) return;
      if (goal) {
        setSavingsGoal({ name: goal.name, amount: String(goal.amount), deadline: goal.deadline });
        setGoalSaved(true);
      }

      if (!Array.isArray(files) || files.length === 0) {
        setTransactions([]);
        return;
      }
      const merchantRules = new Map(
        Array.isArray(rulesData) ? rulesData.map((r) => [r.merchantName, r.category]) : []
      );
      const customCats = {};
      if (Array.isArray(catsData)) {
        catsData.forEach((c) => { customCats[c.categoryName] = c.keywords || []; });
      }

      const latest = files[0];
      const res = await apiFetch(`/api/files/${latest._id}`);
      const data = await res.json();
      if (cancelled || !data.transactions) {
        setTransactions([]);
        return;
      }
      const txns = data.transactions.map((t, i) => {
        const date = typeof t.date === "string" ? new Date(t.date) : t.date;
        return { ...t, id: i, date, category: categorize(t.desc, customCats, merchantRules) };
      });
      setTransactions(txns);
    }).catch(() => {
      if (!cancelled) setTransactions([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const expenses = (transactions ?? []).filter((t) => t.amount < 0);
  const income = (transactions ?? []).filter((t) => t.amount > 0);
  const totalExpenses = Math.abs(_.sumBy(expenses, "amount"));
  const totalIncome = _.sumBy(income, "amount");

  const catBreakdown = _.groupBy(expenses, "category");
  const breakdown = Object.entries(catBreakdown)
    .map(([name, txns]) => ({ name, value: Math.abs(_.sumBy(txns, "amount")), count: txns.length }))
    .sort((a, b) => b.value - a.value);

  const byMonth = _.groupBy(transactions ?? [], (t) => `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`);
  const monthlyData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month]) => month); // only .length is needed by savingsSuggestion below

  const savingsSuggestion = (() => {
    if (!savingsGoal.amount || !savingsGoal.deadline) return null;
    const target = parseFloat(savingsGoal.amount);
    const deadline = new Date(savingsGoal.deadline);
    const today = new Date();
    const monthsLeft = Math.max(1, (deadline.getFullYear() - today.getFullYear()) * 12 + deadline.getMonth() - today.getMonth());
    const monthly = target / monthsLeft;
    const avgMonthlyIncome = totalIncome / Math.max(1, monthlyData.length);
    const avgMonthlyExpense = totalExpenses / Math.max(1, monthlyData.length);
    const surplus = avgMonthlyIncome - avgMonthlyExpense;
    const feasible = surplus >= monthly;
    return { target, monthsLeft, monthly, avgMonthlyIncome, avgMonthlyExpense, surplus, feasible, goalName: savingsGoal.name };
  })();

  const saveGoal = useCallback((goal) => {
    return apiFetch("/api/savings", {
      method: "PUT",
      body: JSON.stringify({ name: goal.name, amount: parseFloat(goal.amount), deadline: goal.deadline }),
    }).then((r) => {
      if (r.ok) setGoalSaved(true);
      return r;
    });
  }, []);

  const deleteGoal = useCallback(() => {
    setSavingsGoal(emptyGoal);
    setGoalSaved(false);
    return apiFetch("/api/savings", { method: "DELETE" });
  }, []);

  return {
    transactions,
    loading,
    savingsGoal,
    setSavingsGoal,
    goalSaved,
    saveGoal,
    deleteGoal,
    savingsSuggestion,
    catBreakdown: breakdown,
    numMonths: Math.max(1, monthlyData.length),
  };
}
