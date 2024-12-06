# Nashos WMS

A warehouse management system built with Next.js 14, TypeScript, and Prisma.

## Development Setup

1. Install dependencies:

```bash
npm install
```

2. Generate SSL certificates for HTTPS development:

```bash
npm run generate-cert
```

3. Start the development server:

```bash
npm run dev:https
```

The application will be available at `https://localhost:3000`

## Features

- Barcode scanning for inventory management
- Location-based stock tracking
- Real-time stock updates
- Mobile-friendly interface

## Tech Stack

- Next.js 14
- TypeScript
- Prisma
- TailwindCSS
- HTML5-QRCode for barcode scanning
