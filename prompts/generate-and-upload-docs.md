# Generate & Upload Documents to Content Server

## Workflow Template

Use this prompt with Claude Code to generate documents and upload them to OpenText Content Server. Replace the `{{placeholders}}` with your values.

---

### Prompt

```
Using the OTCS tools, find the "{{TARGET_FOLDER}}" folder in Content Server and browse its contents to understand the folder structure and naming conventions. Download 1-2 sample documents to understand the style and format.

Then use the PDF generation tools to create {{NUMBER_OF_DOCS}} new {{DOC_TYPE}} documents with these details:

{{#FOR EACH DOCUMENT}}
- Document {{N}}:
  - Counterparty/Subject: {{COUNTERPARTY_NAME}}
  - Key terms: {{KEY_TERMS}}
  - Value: {{CONTRACT_VALUE}}
  - Duration: {{DURATION}}
{{/FOR EACH}}

Upload each document to its own subfolder under "{{TARGET_FOLDER}}", named by {{FOLDER_NAMING_CONVENTION}}. Apply the "{{CATEGORY_NAME}}" category to each document with the appropriate metadata values.
```

---

## Parameters Reference

| Parameter | Description | Example |
|---|---|---|
| `TARGET_FOLDER` | Parent folder in Content Server | `Contracts` |
| `NUMBER_OF_DOCS` | How many documents to generate | `2` |
| `DOC_TYPE` | PDF generator document type | `contract`, `invoice`, `proposal`, `nda`, `purchase_order`, `sop`, `quote`, `offer_letter`, `legal_memo` |
| `COUNTERPARTY_NAME` | Name of the other party / subject | `Horizon Data Labs, Inc.` |
| `KEY_TERMS` | Summary of terms to include | `Data analytics services, $42K/mo, 99.5% SLA` |
| `CONTRACT_VALUE` | Total value or rate | `$756,000` |
| `DURATION` | Term length | `18 months` |
| `FOLDER_NAMING_CONVENTION` | How subfolders are named | `counterparty name`, `project name`, `date` |
| `CATEGORY_NAME` | OTCS category to apply | `Altius Contract` |

## Supported PDF Document Types

### Business Documents (`generate_business_document`)
- **contract** - Legal agreements with terms, conditions, signature blocks
- **invoice** - Invoices with line items, totals, payment terms
- **proposal** - Business proposals with scope, timeline, budget
- **sop** - Standard Operating Procedures with steps and responsibilities
- **legal_memo** - Legal memoranda with analysis and recommendations
- **quote** - Sales quotes with line items and validity period
- **purchase_order** - POs with vendor details and shipping
- **nda** - Non-disclosure agreements (mutual or unilateral)
- **offer_letter** - Employment offers with compensation and benefits

### Financial Documents (`generate_loan_document`)
- **paystub** - Employee pay stubs with earnings/deductions
- **w2** - W-2 tax forms
- **bank_statement** - Account statements with transactions
- **expense_report** - Expense reports with categories and approvals
- **incident_report** - IT/security incident reports

### Reports (`generate_report`)
- **analysis** - Analysis reports with sections, tables, charts
- **executive_brief** - 1-2 page executive summaries
- **comparison** - Side-by-side comparison matrices

## Available OTCS Category: Altius Contract (ID: 181942)

| Attribute | Key | Type |
|---|---|---|
| effective_date | `181942_2` | date |
| expiration_date | `181942_3` | date |
| counterparty | `181942_4` | string (max 32) |
| contract_value | `181942_5` | integer |
| contract_date | `181942_6` | date |

---

## Example: Quick Prompt

```
Find the Contracts folder in OTCS, sample existing docs for style. Generate 3 new NDAs for: (1) Apex Manufacturing - 2 year mutual NDA, (2) Solaris Energy - 1 year unilateral NDA, (3) Cascade Logistics - 3 year mutual NDA. Upload each to its own counterparty folder under Contracts and apply the Altius Contract category.
```
