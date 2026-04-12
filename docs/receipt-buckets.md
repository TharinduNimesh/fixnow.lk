# Receipt Bucket Structure

Create a single private bucket for bank-transfer receipts, for example `request-receipts`.

Recommended object path structure:

`request-receipts/{tracking_id}/{receipt_id}.{ext}`

Examples:

`request-receipts/FN-8A3K2M/receipt-01.jpg`

`request-receipts/FN-6D6N5Q/receipt-02.pdf`

Notes:

- Keep the bucket private.
- Upload receipts only from the admin or authenticated server flow.
- Store the returned object path in `service_requests.receipt_path`.
- If you want versioning, keep the newest file as `receipt-latest.*` and preserve older uploads with timestamps.
- Do not expose raw bucket access publicly; serve signed URLs or proxy downloads through the backend.
