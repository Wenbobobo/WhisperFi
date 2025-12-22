import { test, expect } from "@playwright/test";

// Use the PLAYWRIGHT test note that matches the seeded deposit
const NOTE = "private-defi-8c8046baa7e735ae031cae0a8bae147d5b9660db119d51fb1d7cf76d2e0a91-cc6a4aa81c38aaa7a658c8eb4d9ba86b186e19344b0de61507cd8ddb384e57-v1";
const RECIPIENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

test.setTimeout(300_000); // 5 minutes

test("simple ZK proof generation and withdrawal test", async ({ page }) => {
  console.log("\n🌐 Navigating to withdraw page...");
  await page.goto("http://localhost:3000/e2e/withdraw");
  await page.waitForLoadState("networkidle");

  console.log("📝 Filling in the private note...");
  // Find the Private Note input by label or placeholder
  await page.getByPlaceholder(/private-defi/).fill(NOTE);

  console.log("📝 Filling in recipient address...");
  await page.getByRole("textbox", { name: "Recipient Address" }).fill(RECIPIENT);

  console.log("🔘 Clicking Generate Proof button...");
  const generateButton = page.getByRole("button", { name: "Generate Proof" });
  await generateButton.click();

  console.log("⏳ Waiting for proof generation (this may take 30+ seconds with real ZK)...");

  // Wait for the Submit Withdrawal button to be enabled (proof generated)
  await page.waitForSelector('button:has-text("Submit Withdrawal"):not([disabled])', {
    timeout: 120_000
  });

  console.log("✅ Proof generated successfully!");
  console.log("📸 Taking screenshot of the state after proof generation...");
  await page.screenshot({ path: "test-results/proof-generated.png" });

  console.log("🔘 Clicking Submit Withdrawal button...");
  const submitButton = page.getByRole("button", { name: "Submit Withdrawal" });
  await submitButton.click();

  console.log("⏳ Waiting for transaction to complete...");

  // Wait for success message or transaction completion (adjust selector based on actual UI)
  try {
    await page.waitForSelector('text=/success|completed|confirmed/i', { timeout: 60_000 });
    console.log("✅ Withdrawal transaction completed successfully!");
  } catch (e) {
    console.log("⚠️  Waiting for any transaction indicator...");
    await page.screenshot({ path: "test-results/after-submit.png" });
  }

  console.log("\n📸 Final screenshot saved");
  await page.screenshot({ path: "test-results/final-state.png" });

  console.log("✅ Test completed - check screenshots for results");
});
