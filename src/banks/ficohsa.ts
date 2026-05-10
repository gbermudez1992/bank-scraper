import { Page } from "puppeteer";
import { BankScraper, MovementsSummary, SummaryItem } from "../types";

const WAIT_TIME = 2000;

export class FicohsaScraper implements BankScraper {
  constructor(
    private url: string,
    private username: string,
    private password: string,
  ) {}

  async scrape(page: Page): Promise<MovementsSummary> {
    console.log(`Navigating to ${this.url}...`);
    await page.goto(this.url, { waitUntil: "networkidle2" });

    console.log("Checking for cookies popup...");
    try {
      await page.waitForSelector(
        "span.parma-content-header-text::-p-text(Uso de cookies y política de privacidad)",
        {
          timeout: 20000,
        },
      );

      console.log("Cookies popup detected. Looking for accept button...");
      const acceptBtnSelector = ".modalCookie icb-button";
      await page.waitForSelector(acceptBtnSelector, {
        visible: true,
        timeout: 5000,
      });
      console.log("Accept button found. Clicking natively...");
      await page.click(acceptBtnSelector);
      console.log("Cookies accepted.");
      await new Promise((r) => setTimeout(r, WAIT_TIME));
    } catch (e) {
      console.log("No cookies popup detected or timed out, proceeding...");
    }

    console.log("Waiting for username form to appear...");
    await page.waitForSelector("input#step01", { timeout: 30000 });

    console.log("Filling in username...");
    await page.type("input#step01", this.username);

    console.log('Clicking "Siguiente" button for username...');
    await this.clickVisibleButton(
      page,
      "icb-button a.ipswich-main-buttons-link.big",
    );
    await new Promise((r) => setTimeout(r, WAIT_TIME));

    console.log("Waiting for password form to appear...");
    await page.waitForSelector("input#step02", { timeout: 30000 });

    console.log("Filling in password...");
    await page.type("input#step02", this.password);

    console.log('Clicking "Siguiente" button to login...');
    await this.clickVisibleButton(
      page,
      "icb-button a.ipswich-main-buttons-link.big",
    );

    console.log(
      'Wait for "No" button in Registro de dispositivo de confianza popup...',
    );
    const noButtonSelector =
      "icb-button a.ipswich-main-buttons-link-simple span::-p-text(No)";
    try {
      await page.waitForSelector(noButtonSelector, {
        visible: true,
        timeout: 15000,
      });
      await new Promise((r) => setTimeout(r, WAIT_TIME));
      console.log("No button found. Clicking natively...");
      await page.click(noButtonSelector);
    } catch (e) {
      console.log(
        "Registro de dispositivo popup not found or timed out. Proceeding...",
      );
    }

    console.log(
      "Waiting for dashboard to load and 'Mis Productos' link to appear...",
    );
    const misProductosSelector =
      "a.leeds_list_item_link:has(i.stream-menu_mis_productos)";
    await page.waitForSelector(misProductosSelector, {
      visible: true,
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, WAIT_TIME));
    console.log("Found 'Mis Productos' link. Clicking natively...");
    await page.click(misProductosSelector);

    console.log("Waiting for 'icb-productrow' to load...");
    const productRowSelector = "icb-productrow";
    await page.waitForSelector(productRowSelector, {
      visible: true,
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, WAIT_TIME));

    console.log(
      "Found product rows. Finding the first visible one to click natively...",
    );
    await this.clickVisibleButton(page, productRowSelector);

    console.log("Waiting for 'Movimientos actuales' tab...");
    const movimientosTabSelector =
      "div.milan_tabs_tab::-p-text(Movimientos actuales)";
    await page.waitForSelector(movimientosTabSelector, {
      visible: true,
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, WAIT_TIME));

    console.log("Found 'Movimientos actuales' tab. Clicking natively...");
    await page.click(movimientosTabSelector);

    console.log("Waiting for movements to load...");
    await new Promise((r) => setTimeout(r, 10000));

    console.log("Extracting movements...");
    const movements = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll(
          "icb-myproducts icb-generic-detail-row .rivera_row",
        ),
      );

      return rows
        .map((row) => {
          const date =
            row
              .querySelector(".rivera_row_info_legend span.marmaris")
              ?.textContent?.trim() || "";
          const concept =
            row
              .querySelector(".rivera_row_info_title span.marmaris")
              ?.textContent?.trim() || "";
          const amountWrapper = row.querySelector(
            ".rivera_row_simple.mobileHighlighted icb-amount-formatter",
          );
          const currency =
            amountWrapper
              ?.querySelector(".currency-left-base")
              ?.textContent?.trim() || "";
          const amount =
            amountWrapper?.querySelector(".amount-base")?.textContent?.trim() ||
            "";
          return { date, concept, currency, amount };
        })
        .filter((m) => m.amount && m.currency);
    });

    const logoutSelector = "icb-logout a";
    console.log("Logging out...");
    await page.click(logoutSelector);

    const confirmLogoutSelector =
      "icb-modalpopup icb-button a.ipswich-main-buttons-link span::-p-text(Confirmar)";
    try {
      await page.waitForSelector(confirmLogoutSelector, {
        visible: true,
        timeout: 5000,
      });
      await new Promise((r) => setTimeout(r, WAIT_TIME));
      console.log("Confirm logout button found. Clicking natively...");
      await page.click(confirmLogoutSelector);
    } catch (e) {
      console.log(
        "Confirm logout button not found or timed out. Proceeding...",
      );
    }

    return { rawMovements: movements };
  }

  private async clickVisibleButton(page: Page, selector: string) {
    const elements = await page.$$(selector);
    for (const el of elements) {
      const isVisible = await el.evaluate((b) => {
        const rect = b.getBoundingClientRect();
        const style = window.getComputedStyle(b);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      });
      if (isVisible) {
        await el.click();
        return;
      }
    }
    throw new Error(`No visible element found for selector: ${selector}`);
  }
}
