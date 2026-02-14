# AMALI City Buildings Management System

A multi-tenant web application for African cities to capture, manage, and analyze building data to improve governance and decision-making.

## Project Overview

This application enables cities across Africa to:
- Create city accounts and securely manage building records
- Capture comprehensive building data including location, occupancy, and infrastructure details
- Visualize city-wide building data through interactive dashboards
- Export data for external analysis and reporting
- Compare performance across cities (admin view)

**Live Application:** https://amali-city-buildings-project-vpr2.vercel.app/

## Features

### For City Users
- **City Account Management**: Simple email/password signup and login
- **Building Data Capture**: Structured forms to record building information
  - Building name and street address
  - GPS coordinates (latitude/longitude) with 3 capture methods:
    - Manual entry
    - Address autocomplete (OpenStreetMap Nominatim)
    - Device geolocation (GPS)
  - Classification (residential, commercial, public, industrial, mixed-use)
  - Number of occupants
  - Building condition (Excellent, Good, Fair, Poor, Dilapidated, Under Construction)
  - Compliance status (Compliant, Non-compliant, Under Review, Not Assessed)
  - Infrastructure availability (electricity, water, sewerage)
  - Year built, floors, floor area, ownership type
- **Interactive Dashboard**: 
  - Real-time statistics and insights
  - 10 filter criteria (classification, condition, compliance, utilities, age, search)
  - Decision support insights:
    - Priority buildings (poor condition + high occupancy)
    - Infrastructure gaps (missing utilities)
    - Aging infrastructure (>50 years old)
    - Compliance issues
    - Data quality gaps
  - Interactive map with building markers
  - Charts: classification pie chart, condition pie chart, compliance bar chart
- **Data Export**: Export city-specific building data to CSV (respects active filters)
- **Buildings Management**: View, edit, delete, and manage all city buildings

### For Admin Users
- **Cross-City Dashboard**: 
  - Aggregate statistics across all cities
  - City comparison bar charts (buildings, infrastructure scores, compliance rates)
  - Regional insights and recommendations
  - Filter by city and all other criteria
  - Interactive map showing all buildings across cities
- **Data Export**: Export data for all cities in a single CSV file
- **Building Management**: View and analyze buildings across all cities

## Technology Stack

### Frontend
- **Framework**: Next.js 16.1.6 (App Router)
- **Language**: TypeScript
- **UI**: React 19 with inline CSS
- **Charts**: Recharts 2.15
- **Maps**: React-Leaflet 5.0 with OpenStreetMap
- **Deployment**: Vercel

### Backend & Database
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email/password)
- **Security**: Row-Level Security (RLS) policies
- **APIs**: Supabase REST API (auto-generated)

### Key Dependencies
```json
{
  "next": "16.1.6",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "typescript": "^5",
  "recharts": "^2.15.0",
  "react-leaflet": "^5.0.0",
  "leaflet": "^1.9.4",
  "@supabase/supabase-js": "^2.45.0"
}
```

## Architecture

### System Design
```
┌─────────────────────────────────────┐
│         City Users & Admin          │
│          (Web Browser)              │
└──────────────┬──────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────┐
│         Next.js Frontend            │
│  • App Router (SSR + CSR)           │
│  • TypeScript                       │
│  • React-Leaflet Maps               │
│  • Recharts Visualizations          │
└──────────────┬──────────────────────┘
               │ REST API
┌──────────────▼──────────────────────┐
│       Supabase Backend              │
│  • PostgreSQL Database              │
│  • Authentication Service           │
│  • Row-Level Security (RLS)         │
│  • Auto-Generated REST API          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Vercel Deployment           │
│  • Automatic CI/CD from GitHub      │
│  • Global CDN                       │
│  • Automatic HTTPS                  │
└─────────────────────────────────────┘
```

### Multi-Tenancy Implementation

**Database-Level Security (Row-Level Security)**

Data separation is enforced at the database layer using PostgreSQL RLS policies:

**City User Policy:**
```sql
-- City users can only see their own city's buildings
CREATE POLICY "City users read own buildings" 
ON buildings FOR SELECT 
USING (
  city_id IN (
    SELECT city_id FROM profiles 
    WHERE user_id = auth.uid() AND role = 'city'
  )
);
```

**Admin User Policy:**
```sql
-- Admins can see all buildings across all cities
CREATE POLICY "Admins read all buildings" 
ON buildings FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

**Benefits:**
- Data isolation guaranteed at database level (not application layer)
- No risk of query errors exposing cross-city data
- Consistent enforcement across all queries
- Simplified application code - security is declarative

### Data Flow
1. User authenticates via Supabase Auth (email/password)
2. Profile lookup determines city association and role
3. Routing logic directs to appropriate dashboard (`/app` for city, `/admin` for admin)
4. RLS policies automatically filter database queries based on user role
5. Dashboards render filtered data with charts, maps, and insights
6. Export functions generate CSV from filtered datasets

## Data Model

### Database Schema

**cities**
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text NOT NULL
created_at      timestamp DEFAULT now()
```

**profiles**
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES auth.users NOT NULL
city_id         uuid REFERENCES cities
role            text NOT NULL CHECK (role IN ('city', 'admin'))
created_at      timestamp DEFAULT now()
```

**buildings** (18 attributes)
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
city_id             uuid REFERENCES cities NOT NULL
building_name       text NOT NULL
street_address      text NOT NULL
latitude            numeric
longitude           numeric
classification      text NOT NULL
occupants           integer
photo_url           text
-- Extended attributes
condition           text
year_built          integer CHECK (year_built >= 1800 AND year_built <= EXTRACT(YEAR FROM CURRENT_DATE) + 5)
floors              integer CHECK (floors > 0)
ownership_type      text
compliance_status   text
has_electricity     boolean DEFAULT false
has_water           boolean DEFAULT false
has_sewerage        boolean DEFAULT false
floor_area_sqm      numeric CHECK (floor_area_sqm > 0)
created_at          timestamp DEFAULT now()
updated_at          timestamp DEFAULT now()
```

### Relationships
- Each **building** belongs to one **city** (many-to-one)
- Each **user** has one **profile** (one-to-one)
- Each **profile** belongs to one **city** (many-to-one) OR is an admin (no city restriction)

### Indexes
```sql
-- Performance indexes for common queries
CREATE INDEX idx_buildings_city_id ON buildings(city_id);
CREATE INDEX idx_buildings_classification ON buildings(classification);
CREATE INDEX idx_buildings_condition ON buildings(condition);
CREATE INDEX idx_buildings_compliance ON buildings(compliance_status);
CREATE INDEX idx_buildings_year_built ON buildings(year_built);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
```

## Setup & Installation

### Prerequisites
- Node.js 18+ and npm
- Supabase account (free tier is sufficient)
- Git

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/ciheaturu/amali_city_buildings_project.git
cd amali_city_buildings_project
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create `.env.local` in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get these values from your Supabase project settings (Project Settings → API).

4. **Set up database**

Run the following SQL in your Supabase SQL Editor:
```sql
-- Create tables
CREATE TABLE cities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
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
  photo_url text,
  condition text,
  year_built integer CHECK (year_built >= 1800 AND year_built <= EXTRACT(YEAR FROM CURRENT_DATE) + 5),
  floors integer CHECK (floors > 0),
  ownership_type text,
  compliance_status text,
  has_electricity boolean DEFAULT false,
  has_water boolean DEFAULT false,
  has_sewerage boolean DEFAULT false,
  floor_area_sqm numeric CHECK (floor_area_sqm > 0),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cities (public read)
CREATE POLICY "Anyone can read cities" 
ON cities FOR SELECT 
USING (true);

-- RLS Policies for profiles (users can read their own profile)
CREATE POLICY "Users can read own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for buildings (city users see their city, admins see all)
CREATE POLICY "City users read own buildings" 
ON buildings FOR SELECT 
USING (
  city_id IN (
    SELECT city_id FROM profiles 
    WHERE user_id = auth.uid() AND role = 'city'
  )
);

CREATE POLICY "Admin users read all buildings" 
ON buildings FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "City users insert own buildings" 
ON buildings FOR INSERT 
WITH CHECK (
  city_id IN (
    SELECT city_id FROM profiles 
    WHERE user_id = auth.uid() AND role = 'city'
  )
);

CREATE POLICY "Admin users insert any building" 
ON buildings FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "City users update own buildings" 
ON buildings FOR UPDATE 
USING (
  city_id IN (
    SELECT city_id FROM profiles 
    WHERE user_id = auth.uid() AND role = 'city'
  )
);

CREATE POLICY "Admin users update any building" 
ON buildings FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "City users delete own buildings" 
ON buildings FOR DELETE 
USING (
  city_id IN (
    SELECT city_id FROM profiles 
    WHERE user_id = auth.uid() AND role = 'city'
  )
);

CREATE POLICY "Admin users delete any building" 
ON buildings FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert sample cities
INSERT INTO cities (name) VALUES
  ('Lagos'),
  ('Abuja'),
  ('Nairobi'),
  ('Accra'),
  ('Johannesburg'),
  ('Cape Town'),
  ('Dar es Salaam');

-- Create indexes for performance
CREATE INDEX idx_buildings_city_id ON buildings(city_id);
CREATE INDEX idx_buildings_classification ON buildings(classification);
CREATE INDEX idx_buildings_condition ON buildings(condition);
CREATE INDEX idx_buildings_compliance ON buildings(compliance_status);
CREATE INDEX idx_buildings_year_built ON buildings(year_built);
CREATE INDEX idx_buildings_ownership ON buildings(ownership_type);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
```

5. **Create an admin user**

After running the SQL above:
- Sign up for an account through the app UI
- Find the user's ID in the Supabase Authentication dashboard
- Run this SQL to make them an admin:
```sql
UPDATE profiles 
SET role = 'admin', city_id = NULL 
WHERE user_id = 'your-user-id-here';
```

6. **Run development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production
```bash
npm run build
npm start
```

### Deployment to Vercel

**Option 1: Deploy via GitHub (Recommended)**

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click "Deploy"

Vercel will automatically deploy on every push to the main branch.

**Option 2: Deploy via Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Usage Guide

### For City Users

1. **Sign Up**
   - Navigate to `/signup`
   - Select your city from dropdown
   - Enter email and password
   - Click "Create account"
   - You'll be redirected to your city dashboard

2. **Log In**
   - Go to `/login`
   - Enter credentials
   - Redirected to city home page (`/app`)

3. **Add Buildings**
   - Click "Add New Building" from home or buildings page
   - Fill in building details
   - Choose coordinate capture method:
     - **Manual:** Enter lat/lon directly
     - **Autocomplete:** Type address, select from dropdown, click "Fill coordinates"
     - **GPS:** Click "Use my location"
   - Select classification, condition, utilities, etc.
   - Click "Save building"

4. **Manage Buildings**
   - View list at `/app/buildings`
   - Click any building to edit
   - Delete buildings if needed
   - Search by name or address

5. **View Analytics**
   - Navigate to "Analytics Dashboard" (`/app/dashboard`)
   - View stats: total buildings, occupants, avg age, infrastructure score
   - Apply filters to analyze specific segments
   - Read decision support insights (priority buildings, infrastructure gaps)
   - Interact with the map

6. **Export Data**
   - Click "Export CSV" on dashboard or buildings page
   - CSV file downloads with all your city's buildings
   - Export respects active filters

### For Admin Users

1. **Access Admin Portal**
   - Log in with admin credentials
   - Redirected to `/admin`

2. **View Cross-City Data**
   - Click "Dashboard" to see admin analytics
   - View aggregate stats across all cities
   - Use city comparison bar charts
   - Filter by city or view all cities together
   - Read regional insights

3. **Manage Buildings**
   - Click "Buildings" to see all buildings across cities
   - Add buildings for any city
   - Edit or delete any building

4. **Export All Data**
   - Click "Export CSV" on admin dashboard
   - CSV includes data from all cities with city names

## Key Design Decisions & Trade-offs

### What Was Prioritized

1. **Security First**: Row-Level Security (RLS) policies ensure complete data separation between cities at the database level
2. **Usability**: Simple, intuitive forms and dashboards for users with limited technical capacity
3. **Decision Support**: Dashboards provide actionable insights (priority buildings, infrastructure gaps) rather than just visualizations
4. **Comprehensive Features**: Full CRUD operations, filtering, export, mapping
5. **Mobile Responsive**: Works on all devices
6. **Scalable Architecture**: Multi-tenant design supports unlimited cities

### Simplifications Made (MVP Focus)

1. **Photo Upload**: Not implemented (URLs supported instead)
   - **Rationale**: File upload infrastructure not critical for initial deployment
   - **Future**: Add using Supabase Storage

2. **Offline Support (PWA)**: Not implemented in final version
   - **Rationale**: Prioritized core functionality given time constraints
   - **Future**: Add service workers + IndexedDB

3. **Client-Side Aggregations**: All dashboard calculations happen in browser
   - **Rationale**: Instant filter updates, simpler code
   - **Limitation**: Won't scale past ~10,000 buildings
   - **Future**: Migrate to PostgreSQL views or Edge Functions

4. **Basic Geocoding**: Using free OpenStreetMap Nominatim
   - **Rationale**: No API costs, good enough for assessment
   - **Limitation**: Slower than Google Maps, rate-limited
   - **Future**: Upgrade to Mapbox or Google Maps API

5. **No Audit Trail**: No history of who edited what
   - **Rationale**: Simpler schema, faster development
   - **Future**: Add `building_history` table

### Production Enhancements

For a production system, I would add:

**Infrastructure & Scalability:**
- Pagination for large datasets (>1,000 buildings per city)
- Server-side aggregations using PostgreSQL views
- Redis caching for dashboard metrics
- Database query optimization and additional indexes
- CDN caching for static assets

**Features:**
- Photo uploads using Supabase Storage
- Progressive Web App (PWA) with offline support
- Automatic geocoding via premium API (Mapbox/Google)
- Bulk CSV import for migrating existing datasets
- Email notifications for compliance deadlines
- Audit logs for tracking changes

**Security & Compliance:**
- Two-factor authentication (2FA)
- Role-based permissions within cities (viewer, editor, admin)
- Data backup and disaster recovery procedures
- GDPR compliance features (data export, deletion)

**Analytics:**
- Predictive maintenance models
- Time-series tracking (building trends over time)
- Geospatial clustering and heat maps (PostGIS)
- AI-powered insights (anomaly detection)

**Integration:**
- REST API for third-party integrations
- Webhook support
- GIS platform integration (QGIS, ArcGIS)
- Property tax system integration
- Emergency services integration

**DevOps:**
- Automated testing (unit, integration, E2E)
- CI/CD pipeline with test coverage requirements
- Performance monitoring (Sentry, Vercel Analytics)
- Error tracking and alerting
- Scheduled backups

## Project Structure
```
amali_city_buildings_project/
├── app/
│   ├── app/                    # City user routes
│   │   ├── page.tsx           # City home page
│   │   ├── buildings/
│   │   │   ├── page.tsx       # Buildings list
│   │   │   ├── new/page.tsx   # Add building form
│   │   │   └── [id]/edit/page.tsx  # Edit building
│   │   └── dashboard/
│   │       ├── page.tsx       # City analytics dashboard
│   │       └── BuildingMap.tsx  # Map component
│   ├── admin/                  # Admin routes
│   │   ├── page.tsx           # Admin home
│   │   ├── buildings/
│   │   │   ├── page.tsx       # All buildings
│   │   │   ├── new/page.tsx   # Add building (any city)
│   │   │   └── [id]/edit/page.tsx  # Edit any building
│   │   └── dashboard/
│   │       ├── page.tsx       # Cross-city dashboard
│   │       └── BuildingMap.tsx  # Unified map
│   ├── login/page.tsx         # Login page
│   ├── signup/page.tsx        # Signup page
│   ├── page.tsx               # Landing page
│   └── layout.tsx             # Root layout
├── lib/
│   └── supabaseClient.ts      # Supabase client config
├── public/
│   └── (static assets)
├── .env.local                 # Environment variables (not in repo)
├── next.config.ts             # Next.js configuration
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── README.md                  # This file
```

## Testing

### Manual Testing Checklist

**City User Flow:**
- [ ] Sign up with new city account
- [ ] Log in with existing account
- [ ] Add building with manual coordinates
- [ ] Add building with address autocomplete
- [ ] Add building with GPS location
- [ ] Edit existing building
- [ ] Delete building
- [ ] View buildings list
- [ ] Filter buildings by classification, condition, etc.
- [ ] View dashboard analytics
- [ ] Export buildings to CSV
- [ ] Log out

**Admin Flow:**
- [ ] Log in as admin
- [ ] View cross-city dashboard
- [ ] Filter by specific city
- [ ] View city comparison charts
- [ ] Add building for any city
- [ ] Edit building from any city
- [ ] Export all cities' data to CSV
- [ ] View unified map with all cities

**Security Testing:**
- [ ] City user cannot access other cities' buildings
- [ ] City user cannot see admin routes
- [ ] Admin can access all cities' data
- [ ] RLS policies enforce data separation
- [ ] Unauthenticated users redirected to login

## Troubleshooting

### Common Issues

**Issue: "Failed to fetch" errors**
- Check Supabase connection in `.env.local`
- Verify RLS policies are enabled
- Check browser console for detailed errors

**Issue: Buildings not showing on map**
- Ensure latitude/longitude are valid numbers
- Check building has coordinates (not null)
- Verify Leaflet CSS is loaded

**Issue: Cannot sign up**
- Check Supabase Auth settings
- Verify city exists in database
- Check API routes are working

**Issue: Dashboard shows 0 buildings**
- Verify RLS policies are correct
- Check profile role and city_id
- Ensure buildings have correct city_id

**Issue: CSV export empty**
- Check filtered buildings array
- Verify export function is called
- Check browser download settings

## Contributing

This project was created for the AMALI Data Programme assessment. Contributions, issues, and feature requests are welcome for educational purposes.

## License

This project is part of the AMALI Data Programme assessment and is intended for evaluation purposes.

## Author

**Chima Iheaturu**
- GitHub: [@ciheaturu](https://github.com/ciheaturu)
- Project: AMALI Data Programme Case Assessment

## Acknowledgments

- **AMALI Data Programme** for the assessment opportunity
- **Supabase** for the backend infrastructure and excellent documentation
- **Vercel** for seamless deployment and hosting
- **OpenStreetMap** for free mapping tiles and geocoding
- **Recharts** for beautiful, responsive charts
- **React-Leaflet** for map integration

## Support

For questions about this implementation, contact the author through GitHub.

---

**Live Application:** https://amali-city-buildings-project-vpr2.vercel.app/

**GitHub Repository:** https://github.com/ciheaturu/amali_city_buildings_project/

**Last Updated:** February 2026
