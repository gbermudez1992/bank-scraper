import { FicohsaScraper } from "./banks/ficohsa";
import { LafiseScraper } from "./banks/lafise";
import { BacScraper } from "./banks/bac";
import { BankScraper } from "./types";

export class ScraperFactory {
  static createScraper(
    bankName: string,
    url: string,
    username: string,
    password: string,
  ): BankScraper {
    const name = bankName.toLowerCase();
    switch (name) {
      case "ficohsa":
        return new FicohsaScraper(url, username, password);
      case "lafise":
        return new LafiseScraper(url, username, password);
      case "bac":
        return new BacScraper(url, username, password);
      default:
        throw new Error(`Unsupported bank: ${bankName}`);
    }
  }
}
