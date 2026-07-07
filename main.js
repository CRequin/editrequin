// Replace with your deployed Apps Script Web App URL after setup
const STATS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwRSIyoXfMWtBXw2XZG1a5LKzlrGYJxBbziDSZ5m81r4rgOtmgW14g_4K3BQVdIJimDdg/exec";

const TOTAL_GOAL = 300;

async function loadStats() {
  const countEl = document.getElementById("order-count");
  const amountEl = document.getElementById("fundraising-amount");
  const remainingEl = document.getElementById("order-remaining");

  try {
    const response = await fetch(STATS_ENDPOINT, { method: "GET", mode: "cors" });
    if (!response.ok) throw new Error("stats fetch failed");

    const data = await response.json();

    countEl.textContent = data.totalOrders.toLocaleString("ko-KR");
    amountEl.textContent =
      data.fundraisingAmount.toLocaleString("ko-KR") + "원";
    remainingEl.textContent = Math.max(0, TOTAL_GOAL - data.totalOrders).toLocaleString("ko-KR");
  } catch {
    // Stats are cosmetic — fail silently
    countEl.textContent = "—";
    amountEl.textContent = "—";
    remainingEl.textContent = "—";
  }
}

loadStats();
setInterval(loadStats, 5 * 60 * 1000);
