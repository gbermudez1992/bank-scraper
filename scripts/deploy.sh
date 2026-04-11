#!/bin/bash
# automated AWS deployment script (CloudFormation version)
set -e

STACK_NAME="bank-scraper-stack"
REGION="us-east-1"
DIST_DIR="./dist"
ZIP_FILE="./function.zip"
TEMPLATE_FILE="infra/template.yaml"
PACKAGED_TEMPLATE="infra/packaged.yaml"

# Ensure we're in the project root
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Run this from the project root."
    exit 1
fi

echo "Cleaning up..."
rm -rf "$DIST_DIR" "$ZIP_FILE" "$PACKAGED_TEMPLATE"
mkdir -p "$DIST_DIR"

echo "Checking AWS CLI..."
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI not found. Please install it and run 'aws configure'."
    exit 1
fi

echo "Checking for failed stack state..."
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" == "ROLLBACK_COMPLETE" ]; then
    echo "Stack '$STACK_NAME' is in ROLLBACK_COMPLETE state. Deleting it before fresh deployment..."
    aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION"
    echo "Waiting for stack deletion to complete..."
    aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$REGION"
fi

echo "Identifying AWS Account..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
S3_BUCKET="bank-scraper-deployments-$ACCOUNT_ID"

echo "Ensuring S3 Bucket exists: $S3_BUCKET"
if ! aws s3 ls "s3://$S3_BUCKET" &> /dev/null; then
    echo "Creating S3 bucket..."
    aws s3 mb "s3://$S3_BUCKET" --region "$REGION"
fi

echo "Building and bundling for AWS Lambda..."
# Bundle code into a single index.js, externalizing browser deps
npx esbuild src/index.ts --bundle --minify --platform=node --target=node20 --outfile="$DIST_DIR/index.js" --external:puppeteer-core --external:@sparticuz/chromium

echo "Preparing production dependencies for the main function..."
mkdir -p "$DIST_DIR/node_modules"
cp package.json "$DIST_DIR/"
cd "$DIST_DIR"
npm install --omit=dev --no-audit --no-fund
rm package.json package-lock.json 2>/dev/null || true
cd ..

echo "Preparing Chromium Lambda Layer..."
LAYER_DIR="./layer/nodejs"
mkdir -p "$LAYER_DIR"
cp layer/package.json "$LAYER_DIR/"
cd "$LAYER_DIR"
npm install --omit=dev --no-audit --no-fund
cd ../..

echo "Packaging with CloudFormation (Uploading to S3)..."
# Note: 'aws cloudformation package' handles the zipping of the directory automatically
aws cloudformation package \
    --template-file "$TEMPLATE_FILE" \
    --s3-bucket "$S3_BUCKET" \
    --output-template-file "$PACKAGED_TEMPLATE" \
    --region "$REGION"

echo "Parsing .env for parameter overrides..."
if [ -f .env ]; then
    # Grab values from .env. We use a simple grep/sed to pull key values.
    B_NAME=$(grep '^BANK_NAME=' .env | cut -d '=' -f2)
    B_URL=$(grep '^BANK_URL=' .env | cut -d '=' -f2)
    B_USER=$(grep '^BANK_USERNAME=' .env | cut -d '=' -f2)
    B_PASS=$(grep '^BANK_PASSWORD=' .env | cut -d '=' -f2)
    S_EMAIL=$(grep '^SOURCE_EMAIL=' .env | cut -d '=' -f2)
    D_EMAIL=$(grep '^DESTINATION_EMAIL=' .env | cut -d '=' -f2)
    
    PARAM_OVERRIDES="BankName=$B_NAME BankUrl=$B_URL BankUsername=$B_USER BankPassword=$B_PASS SourceEmail=$S_EMAIL DestinationEmail=$D_EMAIL"
else
    echo "Warning: .env not found. Using template defaults."
    PARAM_OVERRIDES=""
fi

echo "Deploying CloudFormation stack: $STACK_NAME..."
aws cloudformation deploy \
    --template-file "$PACKAGED_TEMPLATE" \
    --stack-name "$STACK_NAME" \
    --capabilities CAPABILITY_IAM \
    --region "$REGION" \
    --parameter-overrides $PARAM_OVERRIDES

echo "Deployment complete! Function is live in the '$STACK_NAME' stack."
