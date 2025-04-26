import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRoute, useNavigation } from "@react-navigation/native";
import io from 'socket.io-client';

const SOCKET_SERVER_URL = "http://192.168.15.120:3000"; // Điều chỉnh nếu cần

const HomeScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const user = route.params?.user || { username: "User" };

  // Sensor data
  const [sensorData, setSensorData] = useState({
    temperature: "Loading...",
    humidity: "Loading...",
    light_intensity: "Loading...",
    current_status: "Loading...",
  });

  // Output/control states
  const [isAutoOn, setIsAutoOn]   = useState(false);
  const [isFanOn, setIsFanOn]     = useState(false);
  const [isLightOn, setIsLightOn] = useState(false);

  const handleLogout = () => navigation.replace("Login");

  // Gửi lệnh lên server → publish MQTT
  const toggleDevice = async (device, val) => {
    // Cập nhật UI ngay
    if (device === 'auto')    setIsAutoOn(val);
    if (device === 'minifan') setIsFanOn(val);
    if (device === 'rgb_led') setIsLightOn(val);

    try {
      console.log(`Toggling ${device} → ${val}`);
      await fetch(`${SOCKET_SERVER_URL}/api/output/${device}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: val ? 1 : 0 }),
      });
    } catch (err) {
      console.error('Error toggling', device, err);
    }
  };

  useEffect(() => {
    // 1. Fetch latest sensor + output states
    const fetchLatest = async () => {
      try {
        const res = await fetch(`${SOCKET_SERVER_URL}/api/latest-data`);
        const data = await res.json();
        if (data) {
          setSensorData({
            temperature: data.temperature + "°C",
            humidity: data.humidity + "%",
            light_intensity: data.light_intensity + "cd",
            current_status: data.current_status ? "Detected" : "Not Detected",
          });
          // Nếu server trả thêm auto/minifan/rgb status trong API thì set ở đây
          // ví dụ: setIsAutoOn(data.auto === 1);
          // setIsFanOn(data.fan_status === 1);
          // setIsLightOn(data.light_status === 1);
        }
      } catch (e) {
        console.error("Error fetching latest data:", e);
      }
    };
    fetchLatest();

    // 2. Socket.IO real‑time
    const socket = io(SOCKET_SERVER_URL);
    socket.on("connect", () => console.log("Socket connected"));

    socket.on("newData", data => {
      setSensorData({
        temperature: data.temperature + "°C",
        humidity: data.humidity + "%",
        light_intensity: data.light_intensity + "cd",
        current_status: data.current_status ? "Detected" : "Not Detected",
      });
    });

    socket.on("newOutputData", data => {
      switch(data.type) {
        case "auto":
          setIsAutoOn(data.status === 1);
          break;
        case "minifan":
          setIsFanOn(data.status === 1);
          break;
        case "rgb_led":
          setIsLightOn(data.status === 1);
          break;
      }
    });

    return () => socket.disconnect();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.circleContainer}>
          <View style={[styles.circle, styles.circle1]} />
          <View style={[styles.circle, styles.circle2]} />
        </View>
        <View style={styles.headerContent}>
          <Image source={require("../assets/avatar-image.png")} style={styles.avatar}/>
          <Text style={styles.greeting}>Hello, {user.username}</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sensor info */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>{sensorData.temperature}</Text>
            <Text style={styles.infoLabel}>Temperature</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>{sensorData.humidity}</Text>
            <Text style={styles.infoLabel}>Humidity</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>{sensorData.light_intensity}</Text>
            <Text style={styles.infoLabel}>Light Intensity</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>{sensorData.current_status}</Text>
            <Text style={styles.infoLabel}>Infrared</Text>
          </View>
        </View>
      </View>

      {/* Control switches */}
      <View style={styles.switchContainer}>
        {/* Auto */}
        <View style={styles.switchItem}>
          <Text style={styles.switchLabel}>Auto</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#50C2C9" }}
            thumbColor={isAutoOn ? "#fff" : "#f4f3f4"}
            onValueChange={val => toggleDevice('auto', val)}
            value={isAutoOn}
          />
          <Text style={styles.switchStatus}>{isAutoOn ? "On" : "Off"}</Text>
        </View>

        {/* Fan */}
        <View style={styles.switchItem}>
          <Text style={styles.switchLabel}>Fan</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#50C2C9" }}
            thumbColor={isFanOn ? "#fff" : "#f4f3f4"}
            onValueChange={val => toggleDevice('minifan', val)}
            value={isFanOn}
          />
          <Text style={styles.switchStatus}>{isFanOn ? "On" : "Off"}</Text>
        </View>

        {/* Light */}
        <View style={styles.switchItem}>
          <Text style={styles.switchLabel}>Light</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#50C2C9" }}
            thumbColor={isLightOn ? "#fff" : "#f4f3f4"}
            onValueChange={val => toggleDevice('rgb_led', val)}
            value={isLightOn}
          />
          <Text style={styles.switchStatus}>{isLightOn ? "On" : "Off"}</Text>
        </View>
      </View>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:"#F0F0F0" },
  header: {
    backgroundColor:"#50C2C9",
    paddingTop:60, paddingBottom:30, paddingHorizontal:20,
    borderBottomLeftRadius:30, borderBottomRightRadius:30
  },
  headerContent: { flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  avatar: { width:60, height:60, borderRadius:30, borderWidth:2, borderColor:"#fff" },
  greeting: { fontSize:18, color:"#fff", fontWeight:"600" },
  logout:   { color:"#fff", fontWeight:"500" },
  circleContainer:{ position:"absolute", top:0, left:0 },
  circle:{ position:"absolute", backgroundColor:"#A0E4E9", borderRadius:999 },
  circle1:{ width:80, height:80, top:-30, left:-30 },
  circle2:{ width:120, height:120, top:30, left:50 },
  infoCard:{
    marginTop:-20, marginHorizontal:20,
    backgroundColor:"#fff", borderRadius:15, padding:20,
    shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.1, shadowRadius:3, elevation:3
  },
  infoRow:{ flexDirection:"row", justifyContent:"space-between", marginBottom:15 },
  infoItem:{
    width:"48%", backgroundColor:"#F9FAFB", borderRadius:10,
    paddingVertical:15, alignItems:"center",
    shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:2, elevation:1
  },
  infoValue:{ fontSize:18, fontWeight:"bold", color:"#333", marginBottom:5 },
  infoLabel:{ fontSize:13, color:"#666" },
  switchContainer:{ flexDirection:"row", justifyContent:"space-around", marginTop:20, marginHorizontal:20 },
  switchItem:{
    width:100, backgroundColor:"#fff", borderRadius:10,
    alignItems:"center", paddingVertical:15,
    shadowColor:"#000", shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:2, elevation:1
  },
  switchLabel:{ marginBottom:8, fontSize:14, fontWeight:"500", color:"#333" },
  switchStatus:{ marginTop:8, fontSize:12, fontWeight:"600", color:"#50C2C9" },
});
