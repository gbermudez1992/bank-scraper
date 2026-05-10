import * as dotenv from "dotenv";
import path from "path";
import * as fs from "fs";
import { ScraperFactory } from "./scraper-factory";
import { Handler } from "aws-lambda";
import { getBankSecrets, BankSecrets } from "./secrets";
import { Movement, MovementsSummary } from "./types";

// Local version uses puppeteer, Lambda version uses puppeteer-core + @sparticuz/chromium
let puppeteer: any;
let chromium: any;

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Load environment variables from .env (only for local)
if (!isLambda) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

const formatAmount = (amount: string) => {
  const numericAmount = parseFloat(amount.replace(/,/g, ""));
  return Number.isFinite(numericAmount)
    ? numericAmount.toFixed(2)
    : amount.trim();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

async function sendEmailNotification(
  result: MovementsSummary,
  secrets: BankSecrets,
  bankName: string,
) {
  const { SMTP_USER, APP_PASSWORD, DESTINATION_EMAIL } = secrets;

  if (!SMTP_USER || !DESTINATION_EMAIL) {
    console.warn(
      "Skipping email notification: SMTP_USER or DESTINATION_EMAIL not set.",
    );
    return;
  }

  const nodemailer = await import("nodemailer");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: APP_PASSWORD,
    },
  });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const day = String(yesterday.getDate()).padStart(2, "0");
  const month = String(yesterday.getMonth() + 1).padStart(2, "0");
  const year = yesterday.getFullYear();
  const yesterdayStr = `${day}/${month}/${year}`;
  const formattedDate = yesterday.toLocaleDateString("es-HN", {
    day: "2-digit",
    month: "2-digit",
  });

  const rowsByCurrency: Record<
    string,
    { movements: Movement[]; totalAmount: number; transactionsCount: number }
  > = {};

  result.rawMovements.forEach((s) => {
    if (s.date !== yesterdayStr) {
      return;
    }

    if (!rowsByCurrency[s.currency]) {
      rowsByCurrency[s.currency] = {
        movements: [],
        totalAmount: 0,
        transactionsCount: 0,
      };
    }

    rowsByCurrency[s.currency].movements.push(s);
    rowsByCurrency[s.currency].totalAmount += parseFloat(
      s.amount.replace(/,/g, ""),
    );
    rowsByCurrency[s.currency].transactionsCount++;
  });

  const tablesByCurrency = Object.entries(rowsByCurrency)
    .map(([currency, { movements, totalAmount }]) => {
      const movementRows = movements
        .map(
          (movement) => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(movement.date)}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(movement.concept)}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(movement.currency)}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatAmount(movement.amount)}</td>
            </tr>
          `,
        )
        .join("");

      return `
        <section style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0;">Moneda: ${escapeHtml(currency)}</h3>
          <table style="border-collapse: collapse; width: 100%; max-width: 800px;">
            <thead>
              <tr style="background-color: #f2f2f2;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Fecha</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Concepto</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Moneda</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${movementRows}
            </tbody>
            <tfoot>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;" colspan="3">Total:</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${currency} ${totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      `;
    })
    .join("");

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>Resumen de Gastos: ${bankName.toUpperCase()}</h2>
        <p>Consumo del día <strong>${formattedDate}</strong> para banco <strong>${bankName}</strong>:</p>
        ${tablesByCurrency}
        <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
          Este es un correo automático de tu Bank Scraper.
        </p>
      </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      to: DESTINATION_EMAIL,
      from: SMTP_USER,
      subject: `[Scraper] Resumen de gastos: ${bankName.toUpperCase()}`,
      text: `Consumo del día ${formattedDate} para banco ${bankName}. Revisa el adjunto para más detalles.`,
      html: htmlBody,
    });

    console.log(`Email notification sent successfully to ${DESTINATION_EMAIL}`);
  } catch (error) {
    console.error("Failed to send email notification:", error);
  }
}

export const handler: Handler = async (event, context) => {
  const bankName = event.bankName || process.env.BANK_NAME_DEFAULT || "ficohsa";
  console.log(`Starting scraper for bank: ${bankName}...`);

  let secrets: BankSecrets;

  if (isLambda) {
    console.log("Running in AWS Lambda environment. Fetching secrets...");
    // secrets = await getBankSecrets(bankName);
  } else {
    console.log("Running in LOCAL environment. Using environment variables...");
    // secrets = {
    //   BANK_USERNAME: process.env.BANK_USERNAME || "",
    //   BANK_PASSWORD: process.env.BANK_PASSWORD || "",
    //   BANK_URL: process.env.BANK_URL || "",
    //   SMTP_USER: process.env.SMTP_USER || "",
    //   APP_PASSWORD: process.env.APP_PASSWORD || "",
    //   DESTINATION_EMAIL: process.env.DESTINATION_EMAIL || "",
    // };
  }

  secrets = await getBankSecrets(bankName);

  if (!secrets.BANK_USERNAME || !secrets.BANK_PASSWORD) {
    throw new Error(`Missing credentials for bank: ${bankName}`);
  }

  let browser;

  if (isLambda) {
    const puppeteerModule = await import("puppeteer-core");
    const chromiumModule = await import("@sparticuz/chromium");

    puppeteer = puppeteerModule.default || puppeteerModule;
    chromium = chromiumModule.default || chromiumModule;

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    puppeteer = await import("puppeteer");
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
    });
  }

  const page = await browser.newPage();

  try {
    const scraper = ScraperFactory.createScraper(
      bankName,
      secrets.BANK_URL,
      secrets.BANK_USERNAME,
      secrets.BANK_PASSWORD,
    );

    const result = await scraper.scrape(page);

    console.log("Extraction complete!");
    console.table(result.rawMovements);

    if (result.rawMovements.length > 0) {
      await sendEmailNotification(result, secrets, bankName);
    } else {
      console.log(
        "No transactions found for yesterday. Skipping email notification.",
      );
    }

    if (isLambda) {
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } else {
      const outputPath = path.resolve(process.cwd(), "movements_summary.json");
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`Saved output successfully to: ${outputPath}`);
    }
  } catch (error) {
    console.error("Error during scraping:", error);
    if (isLambda) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: (error as Error).message,
          bankName,
        }),
      };
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed.");
    }
  }
};

// If running directly (local testing)
if (!isLambda && require.main === module) {
  // You can pass the bank name via BANK_NAME env or it defaults to 'ficohsa'
  handler({ bankName: process.env.BANK_NAME }, {} as any, () => {});
}
