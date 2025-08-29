# JD Sports AI Assistant

A comprehensive AI-powered call center and e-commerce platform built for JD Sports, featuring voice interactions, real-time call management, and integrated product catalog.

## Features

- **AI Voice Assistant**: Powered by VAPI for intelligent voice interactions
- **Call Center Management**: Real-time call handling with Twilio integration
- **E-commerce Integration**: Product catalog, cart functionality, and order management
- **Agent Dashboard**: Unified interface for call center agents
- **Customer Portal**: E-commerce layout for customer interactions
- **Real-time Analytics**: Live call monitoring and performance metrics
- **Knowledge Base**: AI-powered suggestions and customer support

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (Database, Auth, Edge Functions)
- **Voice Integration**: Twilio Voice SDK + VAPI
- **State Management**: TanStack Query + React Context
- **Routing**: React Router DOM

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Twilio account (for voice features)
- VAPI account (for AI voice assistant)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd vapi-aid
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with your configuration:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_TWILIO_ACCOUNT_SID=your_twilio_account_sid
VITE_TWILIO_AUTH_TOKEN=your_twilio_auth_token
VITE_VAPI_API_KEY=your_vapi_api_key
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:8080`

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── AgentDashboard.tsx
│   ├── EcommerceLayout.tsx
│   └── ...
├── contexts/           # React contexts
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
├── pages/              # Page components
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Deployment

The application can be deployed to any static hosting service that supports Vite builds:

1. Build the application:
```bash
npm run build
```

2. Deploy the `dist` folder to your hosting service

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is proprietary to JD Sports.
