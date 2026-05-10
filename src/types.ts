import { Page } from "puppeteer";

export interface Movement {
  date: string;
  concept: string;
  currency: string;
  amount: string;
}

export interface SummaryItem {
  date: string;
  currency: string;
  totalAmount: number;
  transactionCount: number;
}

export interface MovementsSummary {
  rawMovements: Movement[];
}

export interface BankScraper {
  scrape(page: Page): Promise<MovementsSummary>;
}
