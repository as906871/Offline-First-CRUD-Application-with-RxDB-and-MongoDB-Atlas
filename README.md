# Offline-First CRUD App with RxDB + MongoDB Atlas

A modern offline-first web application that demonstrates real-time synchronization between a React frontend and MongoDB Atlas backend using RxDB for local storage and bi-directional replication.

## 🚀 Features

- **Offline-First Architecture**: Works seamlessly offline with local IndexedDB storage
- **Real-time Sync**: Automatic bi-directional synchronization with MongoDB Atlas
- **Live Updates**: Server-Sent Events (SSE) for real-time updates across clients
- **Conflict Resolution**: Handles data conflicts during synchronization
- **Reactive UI**: Real-time UI updates using RxDB observables
- **Business Management**: Create and manage businesses and their articles/inventory

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   React Client  │◄──►│   Express API    │◄──►│   MongoDB Atlas     │
│                 │    │                  │    │                     │
│ • RxDB (Local)  │    │ • REST Endpoints │    │ • Cloud Database    │
│ • IndexedDB     │    │ • Server-Sent    │    │ • Collections:      │
│ • Dexie Storage │    │   Events (SSE)   │    │   - businesses      │
│ • Reactive UI   │    │ • CORS Enabled   │    │   - articles        │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

## 📋 Prerequisites

- **Node.js**: Version 16 or higher
- **npm**: Version 7 or higher
- **MongoDB Atlas Account**: Free tier is sufficient
- **Modern Browser**: Chrome, Firefox, Safari, or Edge with IndexedDB support

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone git@github.com:as906871/Offline-First-CRUD-Application-with-RxDB-and-MongoDB-Atlas.git
```

### 3. MongoDB Atlas Setup

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Sign up for a free account
   - Create a new cluster (Free M0 tier is sufficient)

2. **Configure Database Access**
   - Go to "Database Access" in Atlas dashboard
   - Click "Add New Database User"
   - Create a user with "Read and write to any database" permissions
   - Note down the username and password

3. **Configure Network Access**
   - Go to "Network Access" in Atlas dashboard
   - Click "Add IP Address"
   - Add `0.0.0.0/0` to allow access from anywhere (for development only)
   - For production, restrict to specific IPs

4. **Get Connection String**
   - Go to "Database" → "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password

### 4. Server Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Create environment file
touch .env
```

**Configure `.env` file in server directory:**

```env
# MongoDB Atlas connection string
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority

# Database name
DB_NAME=business-app

# Server port
PORT=3001
```

**Install server dependencies:**

```bash
npm install express cors mongodb dotenv
```

### 5. Client Setup

```bash
# Navigate to client directory
cd ../client

# Install dependencies
npm install
```

**Install client dependencies:**

```bash
npm install react react-dom rxdb rxjs dexie
```

## 🚀 Running the Application

### Method 1: Start Both Services Manually

#### Terminal 1 - Start the Server

```bash
cd server
npm run dev
# or
node index.js
```


#### Terminal 2 - Start the Client

```bash
cd client
npm start
```

**Expected output:**
```
Compiled successfully!

You can now view the app in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.1.x:3000
```

**Debug Collections:**
```bash
curl http://localhost:3001/debug/collections
```

### 2. Frontend Testing

1. **Open the application** at `http://localhost:3000`
2. **Check the status** - Should show "Connected" in green
3. **Add a business** - Enter a business name and click "Add Business"
4. **Add articles** - Select a business and add inventory items
5. **Test offline** - Disconnect your internet and add more data
6. **Reconnect** - Data should sync automatically when connection is restored

### 3. Multi-Client Testing

1. **Open multiple tabs** of `http://localhost:3000`
2. **Add data in one tab** - Should appear in other tabs immediately
3. **Test different browsers** - Data should sync across all clients

## 🔧 How It Works

### Data Flow

1. **User Action** → React Component
2. **Local Insert** → RxDB (IndexedDB)
3. **Replication Push** → Express Server
4. **Database Update** → MongoDB Atlas
5. **SSE Notification** → All Connected Clients
6. **Replication Pull** → Other Clients Update

### Replication Process

```javascript
// Pull: Server → Client
GET /businesses/pull?updatedAt=2024-01-01T12:00:00Z&batchSize=50
Response: { documents: [...], checkpoint: {...} }

// Push: Client → Server
POST /businesses/push
Body: [{ operation: "INSERT", newDocumentState: {...} }]
Response: [] // conflicts array
```


### Development vs Production

**Current setup is for DEVELOPMENT only:**
- Network access allows all IPs (`0.0.0.0/0`)
- No authentication on API endpoints
- CORS allows all origins (`*`)

**For Production:**
1. **Restrict IP Access** in MongoDB Atlas
2. **Add Authentication** (JWT tokens, API keys)
3. **Configure CORS** for specific domains
4. **Use HTTPS** everywhere
5. **Add Rate Limiting**
6. **Validate Input Data**

## 📚 API Documentation

### Endpoints

#### Health Check
```
GET /health
Response: { status: "ok", timestamp: "...", database: "...", mongodb: "connected" }
```

#### Pull Data
```
GET /:collection/pull?updatedAt=<timestamp>&id=<id>&batchSize=<number>
Response: { documents: [...], checkpoint: { updatedAt: "...", id: "..." } }
```

#### Push Data
```
POST /:collection/push
Body: [{ operation: "INSERT|UPDATE|DELETE", newDocumentState: {...}, previousDocumentState: {...} }]
Response: [] // conflicts array
```

#### Live Updates (SSE)
```
GET /:collection/pullStream
Response: Server-Sent Events stream
```

## 🙏 Acknowledgments

- [RxDB](https://rxdb.info/) - Offline-first database
- [MongoDB Atlas](https://www.mongodb.com/atlas) - Cloud database
- [React](https://reactjs.org/) - Frontend framework
- [Express](https://expressjs.com/) - Backend framework
