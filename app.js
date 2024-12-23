const express = require('express');
require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path'); 
const DB = require('./config/DB');
const Chat = require('./models/chatModel'); // Import Chat model here

const userRoutes = require('./routers/user');
const calibrationRoutes = require('./routers/calibration');
const notificationRoutes = require('./routers/notification');
const calibrationExceedRoutes = require('./routers/calibrationExceed');
const calibrationExceedValuesRoute = require('./routers/calibrationExceedValues');
const calculateAverageRoute = require('./routers/iotDataRouter');
const reportRoutes = require('./routers/report');
const paymentRoutes = require('./routers/payment');
const liveVideoRoutes = require('./routers/liveVideo');
const chatRoutes = require('./routers/chatRoutes');
const dailyDifferencesRoutes = require('./routers/differenceData') 
const iotDataAveragesRoutes = require('./routers/iotDataAveragesRoute')
const consumptionRoutes = require('./routers/consumptionRouter');
const predictionRoutes = require('./routers/predictionRouter');
const totalConsumptionSummaryRoutes = require('./routers/totalConsumptionSummaryRouter');
const totalPredictionSummaryRoutes = require('./routers/totalPredictionSummaryRouter');
const hourlyDataRoutes = require('./routers/hourlyData');
const primaryStationRoutes = require('./routers/primaryStationRoutes');
const billRoutes = require('./routers/billRoutes');


const { getAllDeviceCredentials } = require('./controllers/user');
const {initializeMqttClients} = require('./mqtt/mqtt-mosquitto');
const http = require('http');
const socketIO = require('socket.io');

const cron = require('node-cron');
const { deleteOldNotifications } = require('./controllers/notification');
const { scheduleAveragesCalculation } = require('./controllers/iotDataAverages');
const {setupCronJobTotalSummary} =require('./controllers/TotalConsumptionSummaryController');
const {setupCronJobPredictionSummary} = require('./controllers/TotalPredictionSummaryController');
const {scheduleExceedanceAveragesCalculation} = require('./controllers/averageExceedanceController');
const {  scheduleIotDataEmails,sendDataDaily } = require('./controllers/DataSend');
const {setupCronJob} = require('./controllers/saveHourlyData');
const {setupCronJobConsumption}= require('./controllers/consumption');
const {setupCronJobPrediction} = require('./controllers/PredictionOfConsumption');
const {scheduleDifferenceCalculation} = require('./controllers/differenceData')


const app = express();
const port = process.env.PORT || 5555;
const server = http.createServer(app);


const io = socketIO(server, {
    cors: {
        origin: '*', // Allow any origin
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    }
});
// Export io and server instances
module.exports = { io, server };

// Database connection
DB();

// Middleware
app.use(cors({
    origin: '*', // Allow any origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Allow CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Allow any origin
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});
  
app.get('/cors-test', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.send('CORS is working!');
});

// app.options('*', cors({
//     origin: (origin, callback) => {
//         if (!origin || allowedOrigins.includes(origin)) {
//             callback(null, true);
//         } else {
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
//     credentials: true,
// }));



app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(req.path, req.method);
    next();
});

// Routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api', userRoutes);
app.use('/api', calibrationRoutes);
app.use('/api', notificationRoutes);
app.use('/api', calibrationExceedRoutes);
app.use('/api', calibrationExceedValuesRoute);
app.use('/api', calculateAverageRoute);
app.use('/api', reportRoutes);
app.use('/api', paymentRoutes);
app.use('/api', liveVideoRoutes);
app.use('/api', chatRoutes);
app.use('/api', dailyDifferencesRoutes);
app.use('/api', iotDataAveragesRoutes);
app.use('/api', consumptionRoutes);
app.use('/api', predictionRoutes);  
app.use('/api', totalConsumptionSummaryRoutes);
app.use('/api', totalPredictionSummaryRoutes);
app.use('/api',hourlyDataRoutes);
app.use('/api', primaryStationRoutes);
app.use('/api', billRoutes);



// WebSockets for real-time chat
// WebSockets for real-time chat and energy data
io.on('connection', (socket) => {
    console.log('New client connected');

    // Join room based on user ID
    socket.on('joinRoom', ({ userId }) => {
        socket.join(userId);
        console.log(`User joined room: ${userId}`);
    });
       // Handle real-time stack data updates
       socket.on('sendStackData', (data) => {
        console.log('Stack data received:', data);
        const { userName, stackData } = data;

        // Emit stack data to the specific user room
        io.to(userName).emit('stackDataUpdate', {
            stackData, // Send the entire stack data array
            timestamp: new Date(),
        });
        console.log(`Real-time stack data emitted to ${userName}`);
    });
       // Handle real-time consumption data updates
       socket.on('consumptionDataUpdate', (data) => {
        if (data.userName === userName && data.stacks) {
            const updatedData = data.stacks.find(s => s.stackName === primaryStation);
            if (updatedData) {
                setEnergyData({
                    energyDailyConsumption: updatedData.energyDailyConsumption,
                    energyMonthlyConsumption: updatedData.energyMonthlyConsumption,
                    energyYearlyConsumption: updatedData.energyYearlyConsumption
                });
            }
        }
    });     
         // Handle real-time primary station updates
    socket.on('primaryStationUpdate', (data) => {
        const { userName, primaryStation } = data;
        if (userName && primaryStation) {
            io.to(userName).emit('primaryStationUpdate', {
                message: 'Primary station data updated',
                data: primaryStation,
                timestamp: new Date(),
            });
            console.log(`Real-time primary station update emitted to ${userName}`);
        }
    });

    // Listen for chat messages
    socket.on('chatMessage', async ({ from, to, message }) => {
        try {
            const chat = new Chat({ from, to, message });
            await chat.save();
            io.to(from).emit('newChatMessage', chat); // Emit to sender
            io.to(to).emit('newChatMessage', chat);   // Emit to recipient
        } catch (error) {
            console.error('Error sending chat message:', error);
        }
    });

    // Handle client disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the scheduling function when the server starts
scheduleAveragesCalculation();



// // Start the scheduling
// schedulePredictionCalculation();

//Start the TotalSummaryOfConsumption
setupCronJobTotalSummary();

//Start the TotalPedictionSummaryCalculation
// Start the TotalPredictionSummary Calculation
setupCronJobPredictionSummary();

//Start the Average of exceedence
scheduleExceedanceAveragesCalculation();

//Send data daily as CSV
scheduleIotDataEmails()

//Save hourly data of the energy and cumulatingFlow
setupCronJob()


// Save the conmpution data
setupCronJobConsumption()

//start the prediction 
setupCronJobPrediction()

// Start the scheduling process
scheduleDifferenceCalculation();

// Schedule the task to delete old notifications every day at midnight
cron.schedule('0 0 * * *', () => {
    deleteOldNotifications();
    // console.log('Old notifications deleted.');
});

// Schedule the calculation of inflow, final flow, energy
cron.schedule('59 23 * * *', async () => {
    await calculateAndSaveDailyDifferences();
    // console.log('Daily differences calculated and saved');
});

// // Place this inside your app.js for testing
// app.get('/test-email', async (req, res) => {
//     try {
//         const users = await User.find({});
//         users.forEach(user => {
//             sendDataDaily(user); // Assuming sendDataDaily can handle being called directly like this
//         });
//         res.send('Email test initiated.');
//     } catch (error) {
//         console.error('Failed to send test emails:', error);
//         res.status(500).send('Failed to initiate email test.');
//     }
// });
// Initialize all MQTT clients at server startup
server.listen(port, '0.0.0.0', async () => {
    console.log(`Server running on port ${port}`);

    // Initialize the MQTT client when the server starts
    try {
        await initializeMqttClients(io);
        console.log('MQTT clients initialized successfully');
    } catch (error) {
        console.error('Failed to initialize MQTT clients:', error);
    }
});
app.get('/cors-test', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.send('CORS is working!');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.use(express.static(path.join(__dirname, 'New_Ocems_App/build')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'New_Ocems_App/build', 'index.html'));
});

