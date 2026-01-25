# PDF Regeneration Instructions

This document explains how to regenerate PDFs for books that have all images but no PDF generated.

## Overview

Based on our analysis, we found 4 books that have all their images (27+) but no PDF generated:

1. **Book ID:** `697457b968550d2148a86bce`
   - Title: "Luna and Riff's Thankful Playdate"
   - Status: `failed`
   - Pages with images: 27/27

2. **Book ID:** `6971bbe2774789616977097a`
   - Title: "Olivia and Pipsqueak's Jungle Kindness"
   - Status: `failed`
   - Pages with images: 27/27

3. **Book ID:** `696e2083ac9e4f18294320aa`
   - Title: "Luna and Ellie's Birthday Surprise"
   - Status: `failed`
   - Pages with images: 33/33

4. **Book ID:** `69730269d19d72eb53e10955`
   - Title: "Sophia and Ollie's Rainy Day Rescue"
   - Status: `teaser_ready`
   - Pages with images: 27/27

## Method 1: Individual Book Regeneration

To regenerate a PDF for a specific book:

1. Make sure your server is running on port 3001
2. Run the regeneration script with the book ID:

```bash
cd server
node regenerate_specific_pdf.js <bookId>
```

Example:
```bash
node regenerate_specific_pdf.js 697457b968550d2148a86bce
```

## Method 2: Manual API Call

You can also trigger PDF generation manually using curl or any HTTP client:

```bash
curl -X POST http://localhost:3001/api/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{"bookId": "697457b968550d2148a86bce"}'
```

## Method 3: Bulk Regeneration (Advanced)

For bulk regeneration, you can run the original regeneration script, but be aware it will take considerable time as it generates PDFs one by one:

```bash
node regenerate_failed_pdfs.js
```

## Notes

- The books have been marked in the database with `needsPDFRegeneration: true` flag
- After successful PDF generation, the flag is removed and the `pdfUrl` is updated
- The book status is updated to `pdf_ready` after successful PDF generation
- PDF generation is resource-intensive and may take several minutes per book
- The process launches a browser instance to render the PDF, so ensure sufficient resources are available