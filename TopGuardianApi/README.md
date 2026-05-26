# TopGuardian API

A Node.js REST API for the TopGuardian safety management system, built with Express.js, SQLite, and JWT authentication.

## Features

- **JWT Authentication**: Secure login with JSON Web Tokens
- **OpenAPI Documentation**: Complete API documentation with Swagger UI
- **SQLite Database**: File-based database for easy deployment
- **RESTful Endpoints**: Full CRUD operations for all entities
- **Mock Data**: Pre-populated with sample data for testing

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token

### Companies
- `GET /companies` - Get companies for user
- `GET /companies/list` - Paginated company list
- `POST /companies` - Create company
- `PUT /companies/{id}` - Update company
- `DELETE /companies/{id}` - Delete company

### Users
- `GET /users/list` - Paginated user list
- `POST /users` - Create user
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user

### Employees
- `GET /employees` - Get employees for company
- `POST /employees` - Create employee
- `PUT /employees/{id}` - Update employee
- `DELETE /employees/{id}` - Delete employee

### Trainings
- `GET /trainings` - Paginated training list
- `GET /trainings/all` - All trainings
- `POST /trainings` - Create training
- `PUT /trainings/{id}` - Update training
- `DELETE /trainings/{id}` - Delete training

### Company Trainings
- `GET /trainings/company/{companyId}` - Get trainings for company
- `POST /trainings/company` - Assign training to company
- `PUT /trainings/company/{id}/complete` - Mark training as completed

### Employee Trainings
- `GET /trainings/employee/{employeeId}` - Get trainings for employee
- `POST /trainings/employee` - Assign training to employee
- `PUT /trainings/employee/{id}/complete` - Mark training as completed

### Planos (Floor Plans)
- `GET /planos` - Get planos for company
- `POST /planos` - Create plano
- `PUT /planos/{id}` - Update plano
- `GET /planos/{id}/download` - Download plano file
- `DELETE /planos/{id}` - Delete plano

### Checklists
- `GET /checklists/items` - Get checklist items
- `POST /checklists/items` - Create checklist item
- `PUT /checklists/items/{id}` - Update checklist item
- `DELETE /checklists/items/{id}` - Delete checklist item
- `GET /checklists/visits` - Get checklist visits for company
- `POST /checklists/visits` - Create checklist visit
- `PUT /checklists/visits/{id}` - Update checklist visit
- `DELETE /checklists/visits/{id}` - Delete checklist visit

### Risk Matrices
- `GET /risk-matrices` - Get risk matrices for company
- `POST /risk-matrices` - Create risk matrix
- `PUT /risk-matrices/{id}` - Update risk matrix
- `DELETE /risk-matrices/{id}` - Delete risk matrix

### Menu
- `GET /menu` - Get menu for company and user

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   Or for development:
   ```bash
   npm run dev
   ```

## Usage

The server will start on `http://localhost:3000`

### API Documentation

Access the OpenAPI documentation at: `http://localhost:3000/api-docs`

### Default User

A default user is created on first run:
- **Username**: ssandoval
- **Password**: 123
- **Role**: administrador

## Database

The API uses SQLite with a file-based database (`TopGuardian_Api.db`). The database is automatically created and populated with mock data on first run.

## Authentication

All endpoints except `/auth/login`, `/auth/refresh`, and `/health` require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Technologies

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite3** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Swagger/OpenAPI** - API documentation