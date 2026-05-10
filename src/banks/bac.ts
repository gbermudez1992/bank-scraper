import { Page } from "puppeteer";
import { BankScraper, MovementsSummary } from "../types";

const WAIT_TIME = 2000;

export class BacScraper implements BankScraper {
  constructor(
    private url: string,
    private username: string,
    private password: string,
  ) {}

  async scrape(page: Page): Promise<MovementsSummary> {
    console.log(`Navigating to ${this.url}...`);
    await page.goto(this.url, { waitUntil: "networkidle2" });

    console.log("Waiting for login form...");
    await page.waitForSelector("#productId", { timeout: 30000 });

    console.log("Filling in username...");
    await page.type("#productId", this.username);

    console.log("Filling in password...");
    await page.type("#pass", this.password);

    console.log('Clicking "Confirmar" to login...');
    await page.click("#confirm");

    /* 
      TODO: Once on the dashboard:
      1. Navigate to "Cuentas" or "Tarjetas"
      2. Extract transactions for "Yesterday"
    */
    console.log("Waiting for dashboard to load (TODO: identify dashboard selector)...");
    // Placeholder: wait for some common dashboard element or timeout
    await new Promise((r) => setTimeout(r, 5000));

    return { summary: [], rawMovements: [] };
  }
}
