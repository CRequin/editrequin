// Replace with your deployed Apps Script Web App URL after setup
const STATS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwWnsuzrXCxNyUAluxFv8oxVymV8O2VFGx31ffdky7AykV832lTMFEX1USyyY6JJfL9Hg/exec";

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
