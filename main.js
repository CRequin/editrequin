// Replace with your deployed Apps Script Web App URL after setup
const STATS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyCe-5xUbwVB55AGmSVRJEhPb_h9MI2E2PQ-gVyewj8-X-0sWr6N8uiRoshQfGVpIa2ew/exec";

async function loadStats() {
  const countEl = document.getElementById("order-count");
  const amountEl = document.getElementById("fundraising-amount");

  try {
    const response = await fetch(STATS_ENDPOINT, { method: "GET", mode: "cors" });
    if (!response.ok) throw new Error("stats fetch failed");

    const data = await response.json();

    countEl.textContent = data.totalOrders.toLocaleString("ko-KR");
    amountEl.textContent =
      data.fundraisingAmount.toLocaleString("ko-KR") + "원";
  } catch {
    // Stats are cosmetic — fail silently
    countEl.textContent = "—";
    amountEl.textContent = "—";
  }
}

loadStats();
setInterval(loadStats, 5 * 60 * 1000);
