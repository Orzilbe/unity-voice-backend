# Unity Voice Learning Platform - Backend API

A robust Express.js backend API for the Unity Voice Learning Platform, providing comprehensive learning management, user authentication, and AI-powered voice analysis capabilities.

## Features

- 🔐 **Authentication & Authorization**: JWT-based secure user management
- 📚 **Learning Management**: Tasks, topics, levels, and progress tracking
- 🎤 **Voice Processing**: Integration with Azure OpenAI for speech analysis
- 📊 **Analytics**: Comprehensive learning analytics and reporting
- 🗄️ **Database Management**: MySQL with Sequelize ORM
- 🛡️ **Security**: Helmet, CORS, input validation, and rate limiting
- 📝 **API Documentation**: RESTful API with comprehensive endpoints
- 🔧 **Diagnostics**: Built-in database and system health monitoring

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.21.2
- **Language**: TypeScript
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT (jsonwebtoken)
- **Security**: Helmet, CORS, bcryptjs
- **AI Integration**: OpenAI API
- **Validation**: express-validator
- **Development**: nodemon, ts-node

## Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- MySQL 8.0 or higher
- Azure OpenAI API access (optional, for AI features)

## Installation

1. **Clone and navigate to the project**:
   ```bash
   git clone <repository-url>
   cd unity-voice-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=8000
   NODE_ENV=development
   
   # Database Configuration
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=unity_voice_db
   MYSQL_SSL=false
   
   # Authentication
   JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
   JWT_EXPIRES_IN=24h
   
   # Azure OpenAI Configuration
   AZURE_OPENAI_API_KEY=your_azure_openai_api_key
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
   AZURE_OPENAI_API_VERSION=2024-02-15-preview
   AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name
   
   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000
   
   # Security
   BCRYPT_ROUNDS=12
   ```

4. **Database Setup**:
   ```bash
   # Create database
   mysql -u root -p -e "CREATE DATABASE unity_voice_db;"
   
   # Run migrations
   npm run migrate
   ```

## Development

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **API will be available at**:
   [http://localhost:8000](http://localhost:8000)

3. **Available Scripts**:
   ```bash
   npm run dev          # Start development server with hot reload
   npm run build        # Build TypeScript to JavaScript
   npm run start        # Start production server
   npm run lint         # Run ESLint
   npm run type-check   # Run TypeScript type checking
   npm run migrate      # Run database migrations
   npm run diagnose     # Run database diagnostics
   npm run db:test      # Test database connection
   ```

## Project Structure

```
unity-voice-backend/
├── src/
│   ├── controllers/           # Request handlers
│   ├── middleware/           # Express middleware
│   ├── models/              # Sequelize models
│   ├── routes/              # API route definitions
│   ├── services/            # Business logic services
│   ├── scripts/             # Utility scripts
│   ├── lib/                 # Shared libraries
│   ├── types/               # TypeScript type definitions
│   └── server.ts            # Application entry point
├── dist/                    # Compiled JavaScript (after build)
├── migrations/              # Database migration files
└── seeders/                # Database seed files
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/validate` - Token validation

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/stats` - Get user statistics

### Topics & Tasks
- `GET /api/topics` - Get all topics
- `GET /api/tasks` - Get user tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id/complete` - Mark task as complete
- `GET /api/tasks/:id` - Get specific task

### Learning Management
- `GET /api/user/level` - Get user level information
- `PUT /api/user-level/update` - Update user level
- `GET /api/words` - Get vocabulary words
- `POST /api/words/learned` - Mark words as learned

### Analytics & Reporting
- `GET /api/dashboard/user-stats` - User statistics
- `GET /api/dashboard/completion-rates` - Completion rates
- `GET /api/dashboard/topic-analysis` - Topic analysis
- `GET /api/dashboard/export` - Export learning data

### Voice & AI
- `POST /api/interactive-session` - Start interactive session
- `POST /api/analyze-conversation` - Analyze conversation
- `POST /api/conversation-complete` - Complete conversation

### System
- `GET /api/health` - Health check
- `GET /api/migrations` - Database migration status

## Database Schema

### Core Tables
- **Users**: User accounts and profiles
- **Topics**: Learning topics and categories
- **Tasks**: Individual learning tasks
- **UserInLevel**: User progress tracking
- **Posts**: User-generated content
- **Comments**: Task comments and feedback
- **Words**: Vocabulary database
- **WordInTask**: Word-task relationships

### Relationships
- Users have many Tasks, Posts, Comments
- Topics have many Tasks
- Tasks belong to Users and Topics
- Words can be associated with multiple Tasks

## Authentication & Security

### JWT Authentication
```javascript
// Protected route example
app.use('/api/protected', authenticateToken);

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  // ... token validation logic
}
```

### Security Features
- Password hashing with bcrypt
- JWT token expiration
- CORS configuration
- Input validation and sanitization
- SQL injection prevention
- Rate limiting (configurable)

## Deployment

### Production Environment

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Set production environment variables**:
   ```env
   NODE_ENV=production
   PORT=8000
   # ... other production variables
   ```

3. **Start production server**:
   ```bash
   npm start
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8000
CMD ["npm", "start"]
```

### Cloud Deployment Options

#### Heroku
```bash
# Install Heroku CLI and login
heroku create unity-voice-api
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_production_secret
# ... set other environment variables
git push heroku main
```

#### Railway
```bash
# Connect repository to Railway
# Set environment variables in Railway dashboard
# Deploy automatically on push
```

#### DigitalOcean App Platform
```yaml
# app.yaml
name: unity-voice-backend
services:
- name: api
  source_dir: /
  github:
    repo: your-username/unity-voice-backend
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
```

## Database Management

### Migrations
```bash
# Create new migration
npx sequelize-cli migration:generate --name add-new-feature

# Run migrations
npm run migrate

# Rollback migration
npx sequelize-cli db:migrate:undo
```

### Backup & Restore
```bash
# Backup database
mysqldump -u root -p unity_voice_db > backup.sql

# Restore database
mysql -u root -p unity_voice_db < backup.sql
```

## Monitoring & Diagnostics

### Health Checks
- `GET /api/health` - Basic health status
- `npm run diagnose` - Comprehensive system diagnostics
- `npm run db:test` - Database connection test

### Logging
```javascript
// Structured logging example
console.log(`[${new Date().toISOString()}] ${level}: ${message}`, metadata);
```

### Performance Monitoring
- Database query performance
- API response times
- Memory usage tracking
- Error rate monitoring

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### API Testing
```bash
# Using curl
curl -X GET http://localhost:8000/api/health

# Using Postman
# Import the provided Postman collection
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

### Development Guidelines
- Follow TypeScript strict mode
- Use ESLint configuration
- Write comprehensive tests
- Document API changes
- Follow semantic versioning

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   ```bash
   # Check MySQL service
   sudo systemctl status mysql
   
   # Test connection
   npm run db:test
   
   # Check environment variables
   echo $MYSQL_HOST $MYSQL_USER $MYSQL_DATABASE
   ```

2. **Port Already in Use**:
   ```bash
   # Find process using port 8000
   lsof -i :8000
   
   # Kill process
   kill -9 <PID>
   
   # Or use different port
   PORT=8001 npm run dev
   ```

3. **JWT Token Issues**:
   - Verify JWT_SECRET matches frontend
   - Check token expiration
   - Validate token format

### Performance Issues
- Monitor database query performance
- Check for N+1 query problems
- Optimize database indexes
- Use connection pooling

## API Documentation

### Swagger/OpenAPI
Access interactive API documentation at:
`http://localhost:8000/api-docs` (when implemented)

### Postman Collection
Import the provided Postman collection for easy API testing.

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue in the repository
- Contact the Unity Voice Team
- Check the API documentation

---

**Unity Voice Learning Platform Backend** - Powering intelligent language learning through robust API services. 