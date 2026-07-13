# Textra Video Operational Dashboards

Live dashboards for Textra Video with real-time data from Zoho CRM and Xero.

## Features

- **Sales Dashboard**: Live pipeline from Zoho CRM with metrics and deal flow analysis
- **Finance Dashboard**: Cash position and P&L from Xero with runway calculations
- **OAuth2 Integration**: Secure authentication with Zoho CRM and Xero
- **Real-time Data**: Manual refresh button for latest data updates
- **Responsive Design**: Works on desktop, tablet, and mobile

## Tech Stack

- **Frontend**: Next.js 14, React 18, Chart.js
- **Backend**: Next.js API Routes
- **Deployment**: Vercel
- **Auth**: OAuth2 (Zoho CRM, Xero)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Zoho CRM OAuth credentials
- Xero OAuth credentials

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Required environment variables (see `.env.example`):

- `ZOHO_CLIENT_ID` - Zoho CRM OAuth Client ID
- `ZOHO_CLIENT_SECRET` - Zoho CRM OAuth Client Secret
- `ZOHO_REDIRECT_URI` - OAuth callback URL for Zoho
- `ZOHO_ORGANIZATION_ID` - Zoho Organization ID
- `XERO_CLIENT_ID` - Xero OAuth Client ID
- `XERO_CLIENT_SECRET` - Xero OAuth Client Secret
- `XERO_REDIRECT_URI` - OAuth callback URL for Xero
- `XERO_TENANT_ID` - Xero Tenant ID
- `NEXTAUTH_SECRET` - Secret for session encryption
- `NEXTAUTH_URL` - Application URL

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTextra-Video%2Ftextra-dashboards)

Or deploy manually:

```bash
npm install -g vercel
vercel
```

## Support

For issues or questions:
- Zoho CRM API: https://www.zoho.com/crm/help/developer/
- Xero API: https://developer.xero.com/documentation/
- Next.js Docs: https://nextjs.org/docs
