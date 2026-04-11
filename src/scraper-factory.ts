import { FicohsaScraper } from "./banks/ficohsa";
import { BankScraper } from "./types";

export class ScraperFactory {
  static createScraper(
    bankName: string,
    url: string,
    username: string,
    password: string
  ): BankScraper {
    const name = bankName.toLowerCase();
    switch (name) {
      case "ficohsa":
        return new FicohsaScraper(url, username, password);
      default:
        throw new Error(`Unsupported bank: ${bankName}`);
    }
  }
}
