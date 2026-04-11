import { DopplerSDK } from "@dopplerhq/node-sdk";

export interface BankSecrets {
  BANK_USERNAME: string;
  BANK_PASSWORD: string;
  BANK_URL: string;
  SMTP_USER: string;
  APP_PASSWORD: string;
  DESTINATION_EMAIL: string;
}

export async function getBankSecrets(bankName: string): Promise<BankSecrets> {
  const dopplerToken = process.env.DOPPLER_TOKEN;
  const configName = process.env.DOPPLER_CONFIG || "dev";

  if (!dopplerToken) {
    throw new Error("Missing DOPPLER_TOKEN environment variable.");
  }

  const doppler = new DopplerSDK({
    accessToken: dopplerToken,
  });

  try {
    console.log(`Fetching Doppler secrets for config: ${configName}...`);
    const { secrets } = await doppler.secrets.list("bank-scraper", configName);

    // 1. Get the shared/global secrets
    const getGlobal = (name: string) =>
      (secrets as any)[name]?.computed || (secrets as any)[name]?.raw || "";

    const smtpUser = getGlobal("SMTP_USER");
    const appPassword = getGlobal("APP_PASSWORD");

    // 2. Get the bank-specific JSON secret
    const bankSecretName = bankName.toUpperCase();
    const bankSecretRaw = (secrets as any)[bankSecretName]?.raw || "";

    if (!bankSecretRaw) {
      throw new Error(
        `Secret for bank ${bankSecretName} not found in config ${configName}.`,
      );
    }

    let bankData: any;
    try {
      bankData = JSON.parse(bankSecretRaw);
    } catch (e) {
      throw new Error(
        `Failed to parse JSON for bank secret ${bankSecretName}: ${(e as Error).message}`,
      );
    }

    return {
      BANK_USERNAME: bankData.BANK_USERNAME || "",
      BANK_PASSWORD: bankData.BANK_PASSWORD || "",
      BANK_URL: bankData.BANK_URL || "",
      DESTINATION_EMAIL: bankData.DESTINATION_EMAIL || "",
      SMTP_USER: smtpUser,
      APP_PASSWORD: appPassword,
    };
  } catch (error) {
    console.error(`Error retrieving Doppler configuration:`, error);
    throw error;
  }
}
