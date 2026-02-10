# AMALI City Buildings Management System

A multi-tenant web application for African cities to capture, manage, and analyze building data to improve governance and decision-making.

## Project Overview

This application enables cities across Africa to:
- Create city accounts and securely manage building records
- Capture comprehensive building data including location, occupancy, and infrastructure details
- Visualize city-wide building data through interactive dashboards
- Export data for external analysis and reporting
- Compare performance across cities (admin view)

**Live Application:** [https://amali-city-buildings-project-vpr2.vercel.app/]

## Features

### For City Users
- **City Account Management**: Simple email/password signup and login
- **Building Data Capture**: Structured forms to record building information
  - Building name and street address
  - GPS coordinates (latitude/longitude)
  - Classification (residential, commercial, public, industrial, mixed-use)
  - Number of occupants
  - Building condition and compliance status
  - Infrastructure availability (electricity, water, sewerage)
  - Year built, floors, ownership type, and more
- **Interactive Dashboard**: 
  - Real-time statistics and insights
  - Filterable building data by classification, condition, compliance, utilities, age
  - Decision support insights (priority buildings, infrastructure gaps, aging infrastructure)
  - Interactive map with building markers
  - Charts showing building distribution by type, condition, and compliance
- **Data Export**: Export city-specific building data to CSV
- **Buildings Management**: View, search, and manage all city buildings

### For Admin Users
- **Cross-City Dashboard**: 
  - Aggregate statistics across all cities
  - City comparison charts (buildings, infrastructure scores, compliance rates)
  - Regional insights and recommendations
  - Filter by city and other criteria
  - Interactive map showing all buildings across cities
- **Data Export**: Export data for all cities in a single CSV file
- **Building Management**: View and analyze buildings across all cities

## Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router, React 19)
- **Language**: TypeScript
- **Styling**: Inline CSS (for rapid development)
- **Charts**: Recharts
- **Maps**: React-Leaflet with OpenStreetMap
- **Deployment**: Vercel

### Backend & Database
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email/password)
- **APIs**: Next.js API Routes
- **Storage**: Supabase (for user data and building records)

### Key Dependencies
```json
{
  "next": "16.1.6",
  "react": "^19.0.0",
  "recharts": "^2.15.0",
  "react-leaflet": "^5.0.0",
  "leaflet": "^1.9.4",
  "@supabase/supabase-js": "^2.x"
}
```

## Architecture

### System Design
```
┌─────────────────┐
│   City Users    │
│  (Web Browser)  │
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │
    ┌────▼────┐      ┌──────▼──────┐
    │  Next.js │      │   Admin     │
    │   App    │      │   Portal    │
    └────┬────┘      └──────┬──────┘
         │                  │
         └──────────┬───────┘
                    │
         ┌──────────▼──────────┐
         │   Supabase Backend  │
         │  - PostgreSQL DB    │
         │  - Auth Service     │
         │  - Row Level Sec.   │
         └─────────────────────┘
```

### Multi-Tenancy Implementation
- **Database Level**: Each building record links to a `city_id`
- **Authentication**: Supabase Auth with email/password
- **Authorization**: 
  - User profiles table links users to cities with role assignment
  - Row Level Security (RLS) policies enforce data separation
  - City users only query/modify buildings where `city_id` matches their profile
  - Admin users have full access across all cities

### Data Flow
1. User authenticates via Supabase Auth
2. Profile lookup determines city association and role
3. Routing logic directs to appropriate dashboard (`/app` or `/admin`)
4. Data queries automatically filter by city (for city users) or show all (for admin)
5. Dashboards render filtered data with charts and maps
6. Export functions generate CSV from filtered datasets

## Data Model

### Core Entities

**cities**
```sql
- id (uuid, primary key)
- name (text)
- created_at (timestamp)
```

**profiles**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key → auth.users)
- city_id (uuid, foreign key → cities)
- role (text: 'city' | 'admin')
- created_at (timestamp)
```

**buildings**
```sql
- id (uuid, primary key)
- city_id (uuid, foreign key → cities)
- building_name (text)
- street_address (text)
- latitude (numeric)
- longitude (numeric)
- classification (text)
- occupants (integer)
- condition (text)
- year_built (integer)
- floors (integer)
- ownership_type (text)
- compliance_status (text)
- has_electricity (boolean)
- has_water (boolean)
- has_sewerage (boolean)
- floor_area_sqm (numeric)
- created_at (timestamp)
- updated_at (timestamp)
```

### Database Indexes
- `buildings.city_id` (for fast city-specific queries)
- `buildings.classification` (for filtering)
- `buildings.condition` (for analytics)
- `profiles.user_id` (for authentication lookups)

## Setup & Installation

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Git

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/ciheaturu/amali_city_buildings_project.git
cd city-buildings-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

4. **Set up database**

Run in Supabase SQL Editor:
```sql
-- Create tables
CREATE TABLE cities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  city_id uuid REFERENCES cities,
  role text NOT NULL CHECK (role IN ('city', 'admin')),
  created_at timestamp DEFAULT now()
);

CREATE TABLE buildings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id uuid REFERENCES cities NOT NULL,
  building_name text NOT NULL,
  street_address text NOT NULL,
  latitude numeric,
  longitude numeric,
  classification text NOT NULL,
  occupants integer,
  condition text,
  year_built integer,
  floors integer,
  ownership_type text,
  compliance_status text,
  has_electricity boolean DEFAULT false,
  has_water boolean DEFAULT false,
  has_sewerage boolean DEFAULT false,
  floor_area_sqm numeric,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Enable RLS
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can read cities" ON cities FOR SELECT USING (true);

CREATE POLICY "Users can read own profile" ON profiles 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "City users can read own buildings" ON buildings
  FOR SELECT USING (
    city_id IN (
      SELECT city_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin users can read all buildings" ON buildings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Insert sample cities
INSERT INTO cities (name) VALUES
  ('Lagos'),
  ('Abuja'),
  ('Port Harcourt'),
  ('Kano'),
  ('Ibadan');
```

5. **Run development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deployment

**Deploy to Vercel:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Then deploy to production
vercel --prod
```

## Usage Guide

### For City Users

1. **Sign Up**
   - Navigate to `/signup`
   - Select your city from dropdown
   - Enter email and password
   - Click "Create account"

2. **Log In**
   - Go to `/login`
   - Enter credentials
   - Redirected to city dashboard

3. **Add Buildings**
   - Click "Add New Building" from dashboard
   - Fill in building details
   - Save record

4. **View Analytics**
   - Navigate to "Analytics Dashboard"
   - Apply filters to analyze specific building segments
   - View charts, stats, and map
   - Read decision support insights

5. **Export Data**
   - Click "Export CSV" on dashboard or buildings page
   - CSV file downloads with all city buildings

### For Admin Users

1. **Access Admin Dashboard**
   - Log in with admin credentials
   - Redirected to `/admin`
   - Choose "Dashboard" for analytics

2. **View Cross-City Data**
   - Filter by city or view all cities
   - Compare cities using bar charts
   - View regional insights and recommendations

3. **Export All Data**
   - Click "Export CSV" on admin dashboard
   - CSV includes data from all cities

## Key Design Decisions & Trade-offs

### What Was Prioritized
1. **Data Security**: RLS policies ensure complete data separation between cities
2. **Usability**: Simple, intuitive forms and dashboards for low-tech users
3. **Decision Support**: Dashboards provide actionable insights, not just visualizations
4. **Scalability**: Multi-tenant architecture supports unlimited cities
5. **Mobile Responsive**: Works on all devices

### Simplifications Made
1. **Authentication**: Email/password only (no OAuth) for simplicity
2. **Photo Upload**: Not implemented (optional in requirements)
3. **Offline Support**: Not implemented (would require PWA + service workers)
4. **Geocoding**: Manual lat/long entry (auto-geocoding not implemented)
5. **Advanced Analytics**: Basic charts only; no predictive analytics

### Production Enhancements
For a production system, I would add:
- **Photo uploads** using Supabase Storage
- **Automatic geocoding** via Google Maps or Mapbox API
- **PWA capabilities** for offline data capture
- **Role-based permissions** (e.g., viewer, editor, admin within cities)
- **Audit logs** for tracking changes
- **Data validation** and error handling improvements
- **Performance optimization** (pagination, lazy loading, caching)
- **Automated testing** (unit, integration, E2E)
- **Email notifications** for new buildings, compliance issues
- **Advanced analytics** (trends, forecasting, AI-powered insights)

## License

This project was created as part of the AMALI Data Programme assessment.

## Author

**Chima Iheaturu**
- GitHub: [@ciheaturu](https://github.com/ciheaturu)

## Acknowledgments

- AMALI Data Programme for the assessment opportunity
- Supabase for the backend infrastructure
- Vercel for hosting
- OpenStreetMap for mapping tiles
