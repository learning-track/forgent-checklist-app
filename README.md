# Forgent Checklist App

An AI-powered web application that helps companies quickly evaluate public tender documents by automatically analyzing uploaded documents and filling out customizable checklists with relevant information.

## Features

- **Document Upload**: Upload multiple PDF tender documents for analysis
- **Customizable Checklists**: Create and manage checklists with questions and conditions
- **AI-Powered Analysis**: Uses Anthropic API to extract information and evaluate conditions
- **Real-time Updates**: WebSocket-based real-time analysis progress
- **Modern UI**: React-based frontend with Tailwind CSS styling
- **Secure Authentication**: JWT-based authentication system

## Tech Stack

- **Backend**: FastAPI (Python), PostgreSQL, SQLAlchemy, Alembic
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **AI**: Anthropic API for document analysis
- **Database**: PostgreSQL
- **Real-time**: WebSockets

## Quick Start (Without Docker)

### Prerequisites

- Python 3.8+
- Node.js 16+
- PostgreSQL 12+

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your database URL and Anthropic API key
   ```

5. **Set up PostgreSQL database:**
   ```sql
   CREATE DATABASE forgent_checklist;
   ```

6. **Run database migrations:**
   ```bash
   alembic upgrade head
   ```

7. **Set up initial data:**
   ```bash
   python app/scripts/setup_initial_data.py
   ```

8. **Start the backend:**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Quick Start (With Docker)

### Prerequisites

- Docker and Docker Compose

### Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd forgent-checklist-app
   ```

2. **Set up environment variables:**
   ```bash
   # Create .env file in the root directory
   echo "ANTHROPIC_API_KEY=your_anthropic_api_key_here" > .env
   ```

3. **Start all services:**
   ```bash
   docker-compose up --build
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Solution Architecture

### Core Components

1. **Document Processing Pipeline**
   - PDF upload and storage
   - Text extraction using PyPDF2
   - Language detection and processing
   - AI-powered content analysis

2. **Checklist Management System**
   - Dynamic checklist creation
   - Question and condition definitions
   - Template-based checklist generation
   - Evaluation criteria management

3. **AI Analysis Engine**
   - Anthropic API integration for document analysis
   - Question answering from document content
   - Condition evaluation and scoring
   - Real-time analysis progress tracking

4. **Real-time Communication**
   - WebSocket connections for live updates
   - Progress tracking during analysis
   - User-specific notification system

### Key Features

- **Intelligent Document Analysis**: Extracts relevant information from complex tender documents
- **Conditional Logic**: Evaluates business conditions against document requirements
- **Scalable Architecture**: Microservices-based design with clear separation of concerns
- **User Experience**: Modern, responsive interface with real-time feedback
- **Data Security**: JWT authentication and secure file handling

### API Endpoints

- `/api/documents` - Document upload and management
- `/api/checklists` - Checklist CRUD operations
- `/api/analysis` - AI analysis and evaluation
- `/api/auth` - Authentication and user management
- `/ws/{user_id}` - WebSocket for real-time updates

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/database

# Security
SECRET_KEY=your-secret-key-change-in-production

# AI Service
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# CORS
ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

## Development

### Backend Development
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Database Migrations
```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```
