import { useCallback, useState } from "react";
import * as Papa from "papaparse";
import { detectColumns, parseAmount, parseDate } from "../../../utils/csv.js";
import { parsePDF } from "../../../utils/pdf.js";

/**
 * CSV/PDF parsing + drag state for the `/upload` route (see
 * `pages/UploadPage.jsx`). Parsing logic itself now lives in `utils/csv.js`/
 * `utils/pdf.js` (Phase 10 final cleanup's extraction out of the legacy
 * `App.jsx`), imported here rather than duplicated.
 *
 * `onData(transactions, fileName, statementType)` is called once parsing
 * succeeds — `UploadPage.jsx` owns what happens next (POST to `/api/files`,
 * then navigate to `/dashboard`), this hook only owns getting from a raw
 * `File` to a clean transactions array.
 */
export function useFileUpload(onData) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const handleFile = useCallback((file) => {
    if (!file) return;
    setError(null);

    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum size is 10 MB — try exporting a smaller date range from your bank.");
      return;
    }

    setLoading(true);
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv" || ext === "tsv") {
      Papa.parse(file, {
        complete: (results) => {
          try {
            const rows = results.data.filter((r) => r.some((c) => c && c.trim()));
            if (rows.length < 2) throw new Error("File appears empty");
            const headers = rows[0];
            const { dateCol, descCol, amtCol, debitCol, creditCol } = detectColumns(headers);
            const transactions = [];
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r[dateCol] && !r[descCol]) continue;
              const date = parseDate(r[dateCol]);
              const desc = (r[descCol] || "").trim();
              let amount;
              if (amtCol !== -1) {
                amount = parseAmount(r[amtCol]);
              } else {
                const debit = debitCol !== -1 ? parseAmount(r[debitCol]) : 0;
                const credit = creditCol !== -1 ? parseAmount(r[creditCol]) : 0;
                amount = credit > 0 ? credit : -Math.abs(debit);
              }
              if (date && desc) {
                transactions.push({ date, desc, amount, originalCategory: null });
              }
            }
            if (transactions.length === 0) throw new Error("No transactions found in this file. Make sure you're exporting a statement CSV — not an account summary.");
            onData(transactions, file.name, "bank");
          } catch (e) {
            setError(e.message);
          }
          setLoading(false);
        },
        error: () => { setError("Unable to read this CSV. Try re-exporting it from your bank's website."); setLoading(false); },
      });
    } else if (ext === "pdf") {
      setLoadingMsg("Reading PDF...");
      parsePDF(file, (msg) => setLoadingMsg(msg)).then(({ txns, statementType }) => {
        if (txns.length === 0) {
          setError("No transactions found in PDF. This can happen with scanned/image-based PDFs. Try exporting a CSV from your bank's website instead.");
          setLoading(false);
          setLoadingMsg("");
          return;
        }
        onData(txns, file.name, statementType);
        setLoading(false);
        setLoadingMsg("");
      }).catch((e) => {
        setError("Failed to read PDF: " + (e.message || "Unknown error") + ". Try a CSV export from your bank instead.");
        setLoading(false);
        setLoadingMsg("");
      });
    } else {
      setError("Unsupported file type. Please upload a CSV or PDF file.");
      setLoading(false);
    }
  }, [onData]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  return { dragging, setDragging, error, loading, loadingMsg, handleFile, onDrop };
}
