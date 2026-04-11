# Bank Scraper

A robust, automated expenditure scraper built with Node.js and TypeScript. It uses Puppeteer to navigate banking portals, extract transaction history, and send daily expenditure summaries via email.

## 🚀 Features

- **Automated Scraping**: Navigates complex banking UIs to extract "Movements of the Day".
- **Daily Summaries**: Filters transactions to provide a clean summary of "Yesterday's" expenses.
- **Email Notifications**: Automatically sends a polished HTML table summary via Gmail SMTP.
- **Secure Credentials**: Integrated with **Doppler** for secure, environment-based configuration and JSON-based secret storage.
- **Cloud Ready**: Designed to run as an **AWS Lambda** function using custom Chromium layers.

---

## 🛠️ Technology Stack

- **Logic**: Node.js, TypeScript
- **Browser Automation**: Puppeteer (Local), @sparticuz/chromium (AWS Lambda)
- **Deployment**: AWS SAM / CloudFormation
- **Secrets Management**: Doppler
- **Emailing**: Nodemailer (via Gmail SMTP + App Passwords)

---

## 💻 Local Development

### Prerequisites
- [Doppler CLI](https://docs.doppler.com/docs/install-cli) installed and authenticated (`doppler login`).
- Node.js (v20+ recommended).

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize Doppler for the project:
   ```bash
   doppler setup
   ```

### Running Locally
To run the scraper from your machine using your `dev` Doppler config:
```bash
doppler run -- npm start
```
*Note: This will use your local browser to perform the scraping. Ensure your `BANK_NAME` or `bankName` in the handler is set correctly.*

---

## 🔐 Secret Management (Doppler)

The project uses a **JSON-in-Config** structure in Doppler. Within your `dev` or `dev_aws` config:

1. **Bank Secret**: Create a secret named after the bank in uppercase (e.g., `FICOHSA`). Its value should be a JSON string:
   ```json
   {
     "BANK_USERNAME": "your_user",
     "BANK_PASSWORD": "your_password",
     "BANK_URL": "...",
     "DESTINATION_EMAIL": "..."
   }
   ```
2. **Global Secrets**: Shared configuration for all banks:
   - `SMTP_USER`: Your Gmail address.
   - `APP_PASSWORD`: Your Google App Password.

---

## ☁️ Deployment to AWS

### Prerequisites
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate permissions.
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).

### Steps
1. **Prepare the Stack**:
   The project includes a deployment script that handles bundling with `esbuild`, pulling dependencies, and packaging for CloudFormation.
   
2. **Run the Deploy Script**:
   ```bash
   bash scripts/deploy.sh
   ```
   *Note: Ensure your `DOPPLER_TOKEN` is available in your environment or passed to the script to allow the Lambda to fetch secrets at runtime.*

3. **Lambda Trigger**:
   The Lambda function accepts a `bankName` parameter in its event object:
   ```json
   { "bankName": "ficohsa" }
   ```

---

## 📂 Project Structure

- `src/index.ts`: Main entry point and AWS Lambda handler.
- `src/banks/`: Contains bank-specific scraping implementations.
- `src/secrets.ts`: Utility for fetching and parsing Doppler secrets.
- `infra/template.yaml`: SAM template for AWS infrastructure.
- `scripts/`: Automation scripts for deployment and maintenance.
