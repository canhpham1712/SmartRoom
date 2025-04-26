require('dotenv').config();
const express   = require('express');
const http      = require('http');
const socketIO  = require('socket.io');
const mqtt      = require('mqtt');
const mysql     = require('mysql2/promise');
const cors      = require('cors');

const app    = express();
app.use(cors());
app.use(express.json());

// Tạo server HTTP và Socket.IO
const server = http.createServer(app);
const io     = socketIO(server, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

// 1. Kết nối MySQL (dùng pool)
let pool;
(async function initDB() {
  try {
    pool = await mysql.createPool({
      host:     process.env.DB_HOST,
      user:     process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });
    console.log('Connected to MySQL');
  } catch (err) {
    console.error('DB connection error:', err);
  }
})();

// 2. Kết nối MQTT đến Adafruit
const ADA_USER      = process.env.ADA_USERNAME;
const ADA_KEY       = process.env.ADA_KEY;
const mqttClient    = mqtt.connect('mqtts://io.adafruit.com', {
  username: ADA_USER,
  password: ADA_KEY,
});

// 3. Định nghĩa feed
// Sensor inputs
const FEED_TEMP     = `${ADA_USER}/feeds/temperature`;
const FEED_HUMID    = `${ADA_USER}/feeds/humidity`;
const FEED_LIGHT    = `${ADA_USER}/feeds/light-intensity`;
const FEED_IR       = `${ADA_USER}/feeds/infrared`;

// Outputs
const FEED_RGB      = `${ADA_USER}/feeds/4-led-rgb-light`;
const FEED_MINIFAN  = `${ADA_USER}/feeds/mini-fan`;
const FEED_AUTO     = `${ADA_USER}/feeds/automation`;

// Threshold feeds
const FEED_THRESHOLD_FAN   = `${ADA_USER}/feeds/fan-threshold`;
const FEED_THRESHOLD_LIGHT = `${ADA_USER}/feeds/light-threshold`;

mqttClient.on('connect', () => {
  console.log('Connected to Adafruit MQTT');
  // Subscribe tất cả các feed input & control
  [
    FEED_TEMP, FEED_HUMID, FEED_LIGHT, FEED_IR,
    FEED_RGB, FEED_MINIFAN, FEED_AUTO
  ].forEach(f => mqttClient.subscribe(f));
  // (Không bắt buộc) nếu bạn muốn log khi thresholds thay đổi:
  // mqttClient.subscribe(FEED_THRESHOLD_FAN);
  // mqttClient.subscribe(FEED_THRESHOLD_LIGHT);
});

// 4. Biến tạm lưu sensor
let tempValue=null, humidValue=null, lightValue=null, irValue=null;
// Timer debounce để lưu dữ liệu sau mỗi lượt cập nhật
let sensorTimer = null;
function scheduleSensorSave(){
  if(sensorTimer) clearTimeout(sensorTimer);
  sensorTimer = setTimeout(async ()=>{
    if (tempValue!=null && humidValue!=null && lightValue!=null && irValue!=null) {
      await saveSensorDataToDB();
    } else {
      console.log("Incomplete sensor data, skipping save:", {
        tempValue, humidValue, lightValue, irValue
      });
    }
  }, 3000);
}

/** Hàm lưu dữ liệu sensor vào DB */
async function saveSensorDataToDB(){
  try {
    const sensorTimestamp = new Date();
    const [r] = await pool.query(
      "INSERT INTO input_device (timestamps) VALUES (?)",
      [sensorTimestamp]
    );
    const inputId = r.insertId;
    await pool.query(
      "INSERT INTO temp_sensor      (input_device_id, temperature)     VALUES (?,?)",
      [inputId, tempValue]
    );
    await pool.query(
      "INSERT INTO humid_sensor     (input_device_id, humidity)        VALUES (?,?)",
      [inputId, humidValue]
    );
    await pool.query(
      "INSERT INTO light_sensor     (input_device_id, light_intensity) VALUES (?,?)",
      [inputId, lightValue]
    );
    await pool.query(
      "INSERT INTO infrared_sensor  (input_device_id, current_status)  VALUES (?,?)",
      [inputId, irValue]
    );
    console.log(`Sensor data saved (id=${inputId})`);
    io.emit('newData', {
      input_device_id: inputId,
      timestamps: sensorTimestamp,
      temperature: tempValue,
      humidity: humidValue,
      light_intensity: lightValue,
      current_status: irValue
    });
  } catch(err){
    console.error("Error saving sensor data:", err);
  } finally {
    tempValue = humidValue = lightValue = irValue = null;
  }
}

// 5. Lắng nghe MQTT
mqttClient.on('message', async (topic, message) => {
  const value = message.toString();
  console.log('[MQTT RX]', topic, value);

  // --- Input sensor ---
  if      (topic===FEED_TEMP)  tempValue  = parseFloat(value);
  else if (topic===FEED_HUMID) humidValue = parseFloat(value);
  else if (topic===FEED_LIGHT) lightValue = parseFloat(value);
  else if (topic===FEED_IR)    irValue    = (value==='1');

  // --- Output: RGB ---
  else if (topic===FEED_RGB){
    const status = (value==='1')?1:0;
    try {
      const [res] = await pool.query(
        "INSERT INTO output_device (timestamps,type,status) VALUES (?, 'rgb_led', ?)",
        [new Date(), status]
      );
      console.log(`rgb_led saved (id=${res.insertId})`);
      io.emit('newOutputData',{ type:'rgb_led', status });
    } catch(e){ console.error("Error saving rgb_led:",e); }
  }

  // --- Output: mini-fan ---
  else if (topic===FEED_MINIFAN){
    const status = (value==='1')?1:0;
    try {
      const [res] = await pool.query(
        "INSERT INTO output_device (timestamps,type,status) VALUES (?, 'minifan', ?)",
        [new Date(), status]
      );
      console.log(`minifan saved (id=${res.insertId})`);
      io.emit('newOutputData',{ type:'minifan', status });
    } catch(e){ console.error("Error saving minifan:",e); }
  }

  // --- Auto-control status ---
  else if (topic===FEED_AUTO){
    const status = (value==='1')?1:0;
    console.log(`automation status = ${status}`);
    io.emit('newOutputData',{ type:'auto', status });
  }

  // Sau mỗi message sensor đầu vào, thử save
  scheduleSensorSave();
});

// 6. REST API

// Lấy data mới nhất
app.get('/api/latest-data', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT i.id AS input_device_id, i.timestamps,
             t.temperature, h.humidity, l.light_intensity, ir.current_status
      FROM input_device i
      LEFT JOIN temp_sensor     t  ON i.id=t.input_device_id
      LEFT JOIN humid_sensor    h  ON i.id=h.input_device_id
      LEFT JOIN light_sensor    l  ON i.id=l.input_device_id
      LEFT JOIN infrared_sensor ir ON i.id=ir.input_device_id
      ORDER BY i.timestamps DESC
      LIMIT 1
    `);
    res.json(rows[0]||{});
  } catch(err){
    console.error(err);
    res.status(500).json({ error:"Server error" });
  }
});

// Login
app.post("/login", (req, res) => {
  const { username,password } = req.body;
  pool.query(
    "SELECT * FROM user WHERE username=? AND password=?",
    [username,password]
  ).then(([rows])=>{
    if (rows.length) res.json({ success:true, message:"Login thành công" });
    else             res.json({ success:false, message:"Sai username/password" });
  }).catch(err=>{
    console.error(err);
    res.status(500).json({ message:"Lỗi server" });
  });
});

// Lấy thresholds
let thresholds = { fan:30, light:200 };
app.get('/api/thresholds', (req, res) => {
  res.json(thresholds);
});

// Cập nhật thresholds & publish lên MQTT
app.post('/api/thresholds', (req, res) => {
  const { fan, light } = req.body;
  if (typeof fan==='number' && typeof light==='number') {
    thresholds = { fan, light };
    // Publish ngưỡng mới lên Adafruit MQTT
    mqttClient.publish(FEED_THRESHOLD_FAN,   fan.toString(),   { qos:1 });
    mqttClient.publish(FEED_THRESHOLD_LIGHT, light.toString(), { qos:1 });
    return res.json({ success:true });
  }
  res.status(400).json({ success:false, error:'Invalid values' });
});

// Điều khiển output & automation
app.post('/api/output/:device', (req, res) => {
  const { device } = req.params; // 'minifan'|'rgb_led'|'auto'|'automation'
  const { status } = req.body;   // 0|1
  let feed;
  if      (device==='minifan')    feed=FEED_MINIFAN;
  else if (device==='rgb_led')    feed=FEED_RGB;
  else if (device==='auto'||device==='automation') feed=FEED_AUTO;
  else return res.status(400).json({ error:'Invalid device' });

  console.log(`[API OUTPUT] ${device} → ${status}`);
  mqttClient.publish(feed, status.toString(), { qos:1 }, err=>{
    if(err){
      console.error('[MQTT] publish error:', err);
      return res.status(500).json({ error:'MQTT publish failed' });
    }
    res.json({ success:true });
  });
});

// 7. API: Lấy dữ liệu trung bình theo giờ (input sensors), có thể filter theo khoảng thời gian
app.get('/api/hourly-history', async (req, res) => {
  try {
    const { start, end } = req.query;       // start=YYYY-MM-DD, end=YYYY-MM-DD
    let where = '';
    let dateLabel = '';

    if (start && end) {                     // lọc theo khoảng
      where      = `WHERE DATE(i.timestamps) BETWEEN '${start}' AND '${end}'`;
      dateLabel  = `${start} -> ${end}`;
    }

    const [rows] = await pool.query(`
      SELECT 
        DATE_FORMAT(i.timestamps,'%Y-%m-%d') AS date_label,
        DATE_FORMAT(i.timestamps,'%H')       AS hour_only,
        AVG(t.temperature)   AS avg_temp,
        AVG(h.humidity)      AS avg_humid,
        AVG(l.light_intensity) AS avg_light             -- ← thêm đây
      FROM input_device i
      JOIN temp_sensor  t ON i.id = t.input_device_id
      JOIN humid_sensor h ON i.id = h.input_device_id
      JOIN light_sensor l ON i.id = l.input_device_id    -- ← thêm đây
      ${where}
      GROUP BY date_label, hour_only
      ORDER BY date_label, hour_only
    `);

    if (!rows.length) {
      return res.json({ 
        dateLabel, 
        hourLabels:[], 
        tempArr:[], 
        humidArr:[], 
        dateArr:[],
        lightArr:[]       // ← thêm đây
      });
    }

    if (!start || !end) dateLabel = rows[0].date_label;   // single-day mặc định

    /* ---------- build arrays ---------- */
    const hourLabels = [], tempArr = [], humidArr = [], dateArr = [], lightArr = []; // ← thêm lightArr

    rows.forEach(r => {
      if (r.avg_temp == null || r.avg_humid == null || r.avg_light == null) return;   // ← kiểm tra thêm avg_light
      hourLabels.push(r.hour_only);
      tempArr.push(Number(r.avg_temp));
      humidArr.push(Number(r.avg_humid));
      dateArr.push(r.date_label);            
      lightArr.push(Number(r.avg_light));    // ← thêm dòng này
    });

    res.json({ 
      dateLabel, 
      hourLabels, 
      tempArr, 
      humidArr, 
      dateArr, 
      lightArr       // ← trả về lightArr
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Socket.IO kết nối
io.on('connection', socket => {
  console.log('Client connected:', socket.id);
});

// Khởi động server
const PORT = process.env.PORT||3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));



// Lấy raw activity logs có phân trang
app.get('/api/activity', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1,  1);
    const limit = Math.max(parseInt(req.query.limit) || 20, 1);
    const offset = (page - 1) * limit;

    const { start, end, type, status, keyword } = req.query;

    let inputWhere = [];
    let outputWhere = [];

    if (start && end) {
      inputWhere.push(`i.timestamps BETWEEN '${start} 00:00:00' AND '${end} 23:59:59'`);
      outputWhere.push(`o.timestamps BETWEEN '${start} 00:00:00' AND '${end} 23:59:59'`);
    }

    if (keyword) {
      const likeKey = `%${keyword}%`;
      inputWhere.push(`(t.temperature LIKE '${likeKey}' OR h.humidity LIKE '${likeKey}' OR l.light_intensity LIKE '${likeKey}' OR ir.current_status LIKE '${likeKey}')`);
      outputWhere.push(`(o.type LIKE '${likeKey}')`);
    }

    if (type && type !== 'all') {
      if (type === 'sensor') {
        outputWhere.push('1=0'); // only sensor
      } else {
        inputWhere.push('1=0');  // only fan/light
        outputWhere.push(`o.type = '${type}'`);
      }
    }

    if (status && status !== 'all') {
      if (status === 'on') {
        outputWhere.push(`o.status = 1`);
        inputWhere.push('1=0');  // 🆕 Không lấy sensor khi lọc ON
      } else if (status === 'off') {
        outputWhere.push(`o.status = 0`);
        inputWhere.push('1=0');  // 🆕 Không lấy sensor khi lọc OFF
      } else if (status === 'detected') {
        inputWhere.push(`ir.current_status = 1`);
        outputWhere.push('1=0'); // 🆕 Không lấy output logs khi lọc detected
      } else if (status === 'none') {
        inputWhere.push(`ir.current_status = 0`);
        outputWhere.push('1=0'); // 🆕 Không lấy output logs khi lọc none
      }
    }

    const inputWhereClause = inputWhere.length ? 'WHERE ' + inputWhere.join(' AND ') : '';
    const outputWhereClause = outputWhere.length ? 'WHERE ' + outputWhere.join(' AND ') : '';

    // Query chính: gộp input và output
    const [rows] = await pool.query(`
      (
        SELECT 
          i.id AS log_id,
          i.timestamps,
          t.temperature, 
          h.humidity, 
          l.light_intensity, 
          ir.current_status,
          NULL AS type, 
          NULL AS status
        FROM input_device i
        LEFT JOIN temp_sensor t ON i.id = t.input_device_id
        LEFT JOIN humid_sensor h ON i.id = h.input_device_id
        LEFT JOIN light_sensor l ON i.id = l.input_device_id
        LEFT JOIN infrared_sensor ir ON i.id = ir.input_device_id
        ${inputWhereClause}
      )
      UNION ALL
      (
        SELECT 
          o.id AS log_id,
          o.timestamps,
          NULL AS temperature, 
          NULL AS humidity, 
          NULL AS light_intensity, 
          NULL AS current_status,
          o.type, 
          o.status
        FROM output_device o
        ${outputWhereClause}
      )
      ORDER BY timestamps DESC
      LIMIT ?, ?
    `, [offset, limit]);

    // Đếm tổng số bản ghi
    const [[{ total }]] = await pool.query(`
      SELECT SUM(cnt) AS total FROM (
        (SELECT COUNT(*) AS cnt FROM input_device i
          LEFT JOIN temp_sensor t ON i.id = t.input_device_id
          LEFT JOIN humid_sensor h ON i.id = h.input_device_id
          LEFT JOIN light_sensor l ON i.id = l.input_device_id
          LEFT JOIN infrared_sensor ir ON i.id = ir.input_device_id
          ${inputWhereClause})
        UNION ALL
        (SELECT COUNT(*) AS cnt FROM output_device o
          ${outputWhereClause})
      ) AS combined
    `);

    return res.json({
      data: rows,
      page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total,
    });

  } catch (err) {
    console.error("Error /api/activity:", err);
    res.status(500).json({ error: "Server error" });
  }
});



// index.js

app.get('/api/visualization', async (req, res) => {
  try {
    const { start, end, interval = 30 } = req.query;
    const params = [interval, interval];
    let where    = '';
    // Nếu user truyền start/end thì thêm WHERE, ngược lại để trống (lấy all)
    if (start && end) {
      where = 'WHERE i.timestamps BETWEEN ? AND ?';
      params.push(new Date(start), new Date(end));
    } else if (start) {
      where = 'WHERE i.timestamps >= ?';
      params.push(new Date(start));
    } else if (end) {
      where = 'WHERE i.timestamps <= ?';
      params.push(new Date(end));
    }
    // Cuối cùng để group by interval
    params.push(interval);

    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(FROM_UNIXTIME(bucket), '%Y-%m-%d %H:%i:%s') AS bucket_start,
        AVG(temperature)     AS avg_temp,
        AVG(humidity)        AS avg_humid,
        AVG(light_intensity) AS avg_light
      FROM (
        SELECT
          t.temperature,
          h.humidity,
          l.light_intensity,
          FLOOR(UNIX_TIMESTAMP(i.timestamps) / (? * 60)) * (? * 60) AS bucket
        FROM input_device i
        LEFT JOIN temp_sensor  t ON i.id = t.input_device_id
        LEFT JOIN humid_sensor h ON i.id = h.input_device_id
        LEFT JOIN light_sensor l ON i.id = l.input_device_id
        ${where}
      ) AS sub
      GROUP BY bucket
      ORDER BY bucket
    `, params);

    const data = rows.map(r => ({
      time:      r.bucket_start,
      avg_temp:  +r.avg_temp,
      avg_humid: +r.avg_humid,
      avg_light: +r.avg_light
    }));
    res.json({ data });
  } catch (err) {
    console.error("Error /api/visualization:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// API Active Time: Tính tổng thời gian fan và light bật
app.get('/api/active-time', async (req, res) => {
  try {
    const [fanRows] = await pool.query(`
      SELECT SUM(TIMESTAMPDIFF(SECOND, t1.timestamps, t2.timestamps)) / 3600 AS fan_hours
      FROM output_device t1
      JOIN output_device t2 ON t2.id = t1.id + 1
      WHERE t1.type = 'minifan' AND t1.status = 1
        AND t2.type = 'minifan' AND t2.status = 0
    `);

    const [lightRows] = await pool.query(`
      SELECT SUM(TIMESTAMPDIFF(SECOND, t1.timestamps, t2.timestamps)) / 3600 AS light_hours
      FROM output_device t1
      JOIN output_device t2 ON t2.id = t1.id + 1
      WHERE t1.type = 'rgb_led' AND t1.status = 1
        AND t2.type = 'rgb_led' AND t2.status = 0
    `);

    res.json({
      fan_hours: fanRows[0]?.fan_hours || 0,
      light_hours: lightRows[0]?.light_hours || 0
    });
  } catch (err) {
    console.error('Error in /api/active-time:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

