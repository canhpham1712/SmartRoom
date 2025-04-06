require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mqtt = require('mqtt');
const mysql = require('mysql2/promise');
const cors = require('cors');
// const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// Tạo server HTTP và Socket.IO
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 1. Kết nối MySQL (dùng pool)
let pool;
(async function initDB() {
  try {
    pool = await mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });
    console.log('Connected to MySQL');
  } catch (err) {
    console.error('DB connection error:', err);
  }
})();

// 2. Kết nối MQTT đến Adafruit
const ADA_USER = process.env.ADA_USERNAME;
const ADA_KEY  = process.env.ADA_KEY;
const mqttClient = mqtt.connect('mqtts://io.adafruit.com', {
  username: ADA_USER,
  password: ADA_KEY,
});

// Định nghĩa feed input
const FEED_TEMP  = `${ADA_USER}/feeds/temperature`;
const FEED_HUMID = `${ADA_USER}/feeds/humidity`;
const FEED_LIGHT = `${ADA_USER}/feeds/light-intensity`;
const FEED_IR    = `${ADA_USER}/feeds/infrared`;

// Định nghĩa feed output
const FEED_RGB     = `${ADA_USER}/feeds/4-led-rgb-light`;
const FEED_MINIFAN = `${ADA_USER}/feeds/mini-fan`;

mqttClient.on('connect', () => {
  console.log('Connected to Adafruit MQTT');
  mqttClient.subscribe(FEED_TEMP);
  mqttClient.subscribe(FEED_HUMID);
  mqttClient.subscribe(FEED_LIGHT);
  mqttClient.subscribe(FEED_IR);

  // Subscribe output
  mqttClient.subscribe(FEED_RGB);
  mqttClient.subscribe(FEED_MINIFAN);
});

// 3. Biến tạm lưu sensor
let tempValue  = null;
let humidValue = null;
let lightValue = null;
let irValue    = null;

// Timer debounce để lưu dữ liệu sau mỗi lượt cập nhật
let sensorTimer = null;

function scheduleSensorSave() {
  if (sensorTimer) clearTimeout(sensorTimer);
  sensorTimer = setTimeout(async () => {
    // Kiểm tra nếu tất cả các giá trị không null (hoặc có thể thêm kiểm tra hợp lệ)
    if (tempValue !== null && humidValue !== null && lightValue !== null && irValue !== null) {
      await saveSensorDataToDB();
    } else {
      console.log("Incomplete sensor data, skipping save:", { tempValue, humidValue, lightValue, irValue });
      // Nếu không đủ dữ liệu, bạn có thể quyết định lưu với giá trị mặc định (ví dụ: 0) hoặc bỏ qua.
    }
  }, 3000); 
}

/** Hàm lưu dữ liệu sensor vào DB */
async function saveSensorDataToDB() {
  try {
    const sensorTimestamp = new Date();

    // Tạo input_device
    const [result] = await pool.query(
      "INSERT INTO input_device (timestamps) VALUES (?)",
      [sensorTimestamp]
    );
    const inputId = result.insertId;

    // Lưu sensor con
    await pool.query(
      "INSERT INTO temp_sensor (input_device_id, temperature) VALUES (?, ?)",
      [inputId, tempValue]
    );
    await pool.query(
      "INSERT INTO humid_sensor (input_device_id, humidity) VALUES (?, ?)",
      [inputId, humidValue]
    );
    await pool.query(
      "INSERT INTO light_sensor (input_device_id, light_intensity) VALUES (?, ?)",
      [inputId, lightValue]
    );
    await pool.query(
      "INSERT INTO infrared_sensor (input_device_id, current_status) VALUES (?, ?)",
      [inputId, irValue]
    );

    console.log(`Sensor data saved (input_device_id = ${inputId})`);

    // Phát qua Socket.IO
    io.emit('newData', {
      input_device_id: inputId,
      timestamps: sensorTimestamp,
      temperature: tempValue,
      humidity: humidValue,
      light_intensity: lightValue,
      current_status: irValue
    });
  } catch (err) {
    console.error("Error saving sensor data: ", err);
  } finally {
    // Reset biến sau khi lưu
    tempValue  = null;
    humidValue = null;
    lightValue = null;
    irValue    = null;
  }
}

// 4. Lắng nghe MQTT
mqttClient.on('message', async (topic, message) => {
  const value = message.toString();

  // Xử lý input sensor
  if (topic === FEED_TEMP) {
    tempValue = parseFloat(value);
  } else if (topic === FEED_HUMID) {
    humidValue = parseFloat(value);
  } else if (topic === FEED_LIGHT) {
    lightValue = parseFloat(value);
  } else if (topic === FEED_IR) {
    irValue = (value === '1'); // chuyển "1"/"0" thành boolean
  }

  // Xử lý output: RGB
  else if (topic === FEED_RGB) {
    try {
      const sensorTimestamp = new Date();
      const rgbStatus = (value === '1') ? 1 : 0;
      const [resultRGB] = await pool.query(
        "INSERT INTO output_device (timestamps, type, status) VALUES (?, 'rgb_led', ?)",
        [sensorTimestamp, rgbStatus]
      );
      console.log(`rgb_led saved (id = ${resultRGB.insertId})`);
      io.emit('newOutputData', {
        timestamps: sensorTimestamp,
        type: 'rgb_led',
        status: rgbStatus
      });
    } catch (err) {
      console.error("Error saving rgb_led data: ", err);
    }
  }

  // Xử lý output: mini-fan
  else if (topic === FEED_MINIFAN) {
    try {
      const sensorTimestamp = new Date();
      const fanStatus = (value === '1') ? 1 : 0;
      const [resultFan] = await pool.query(
        "INSERT INTO output_device (timestamps, type, status) VALUES (?, 'minifan', ?)",
        [sensorTimestamp, fanStatus]
      );
      console.log(`minifan saved (id = ${resultFan.insertId})`);
      io.emit('newOutputData', {
        timestamps: sensorTimestamp,
        type: 'minifan',
        status: fanStatus
      });
    } catch (err) {
      console.error("Error saving minifan data: ", err);
    }
  }

  // Sau mỗi lần cập nhật sensor, sắp xếp lưu dữ liệu nếu đủ bộ
  scheduleSensorSave();
});

// 5. REST API: Lấy data mới nhất
app.get('/api/latest-data', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT i.id AS input_device_id, i.timestamps,
             t.temperature, h.humidity, l.light_intensity, ir.current_status
      FROM input_device i
      LEFT JOIN temp_sensor t ON i.id = t.input_device_id
      LEFT JOIN humid_sensor h ON i.id = h.input_device_id
      LEFT JOIN light_sensor l ON i.id = l.input_device_id
      LEFT JOIN infrared_sensor ir ON i.id = ir.input_device_id
      ORDER BY i.timestamps DESC
      LIMIT 1
    `);
    res.json(rows[0] || {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// API Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Kiểm tra trong MySQL; lưu ý bảng user có tên 'user' hay 'users'
  const query = "SELECT * FROM user WHERE username = ? AND password = ?";
  pool.query(query, [username, password])
    .then(([result]) => {
      if (result.length > 0) {
        return res.json({ success: true, message: "Login thành công" });
      } else {
        return res.json({ success: false, message: "Sai username hoặc password" });
      }
    })
    .catch(err => {
      console.error("Lỗi truy vấn MySQL: ", err);
      res.status(500).json({ message: "Lỗi server" });
    });
});

// 7. Socket.IO: Lắng nghe kết nối từ client
io.on('connection', (socket) => {
  console.log('Client connected: ' + socket.id);
});

// 8. Server listen
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 9. API Lấy dữ liệu trung bình theo giờ
app.get('/api/hourly-history', async (req, res) => {
  try {
    const { start, end } = req.query;
    let whereClause = '';
    let dateLabel   = '';

    if (start && end) {
      whereClause = `WHERE DATE(i.timestamps) BETWEEN '${start}' AND '${end}'`;
      dateLabel   = `${start} -> ${end}`;
    }

    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(i.timestamps, '%Y-%m-%d') AS date_label,
        DATE_FORMAT(i.timestamps, '%H')       AS hour_only,
        AVG(t.temperature) AS avg_temp,
        AVG(h.humidity)    AS avg_humid
      FROM input_device i
      JOIN temp_sensor  t ON i.id = t.input_device_id
      JOIN humid_sensor h ON i.id = h.input_device_id
      ${whereClause}
      GROUP BY DATE_FORMAT(i.timestamps, '%Y-%m-%d'), DATE_FORMAT(i.timestamps, '%H')
      ORDER BY date_label, hour_only
    `);

    if (!rows.length) {
      return res.json({
        dateLabel: dateLabel,
        hourLabels: [],
        tempArr: [],
        humidArr: []
      });
    }

    if (!start || !end) {
      dateLabel = rows[0].date_label || '';
    }

    const hourLabels = [];
    const tempArr    = [];
    const humidArr   = [];

    rows.forEach(r => {
      if (r.avg_temp == null || r.avg_humid == null) return;
      hourLabels.push(r.hour_only);
      tempArr.push(Number(r.avg_temp));
      humidArr.push(Number(r.avg_humid));
    });

    res.json({ dateLabel, hourLabels, tempArr, humidArr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
