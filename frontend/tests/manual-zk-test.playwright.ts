import { test } from "@playwright/test";

const NOTE = "0x0327ffa95e2c50b8000000000000000000000000000000000056bc75e2d63100000";

test.setTimeout(300_000); // 5 minutes

test("manual ZK proof test", async ({ page }) => {
  // Navigate to withdraw page
  await page.goto("http://localhost:3000/e2e/withdraw");

  // Wait for page to load
  await page.waitForLoadState("networkidle");

  console.log("\n📝 Filling in the note...");
  // Fill in the note
  const noteInput = page.locator('textarea[placeholder*="note"]');
  await noteInput.fill(NOTE);

  console.log("🔘 Clicking Generate Proof button...");
  // Click generate proof
  await page.getByRole("button", { name: /generate.*proof/i }).click();

  console.log("⏳ Waiting for proof generation (this may take 30+ seconds)...");
  // Wait for proof to be generated (up to 2 minutes)
  await page.waitForSelector('text=/proof.*generated/i', { timeout: 120_000 });

  console.log("✅ Proof generated successfully!");

  // Fill in recipient address
  console.log("📝 Filling in recipient address...");
  const recipientInput = page.locator('input[placeholder*="recipient" i], input[placeholder*="0x" i]').first();
  await recipientInput.fill("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

  // Keep the browser open for manual inspection
  console.log("\n🔍 Browser will stay open for 2 minutes for manual inspection...");
  console.log("You can now manually click the Withdraw button and verify the transaction succeeds.\n");

  await page.waitForTimeout(120_000); // Wait 2 minutes
});
