import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ImageBackground } from "react-native";

// Nếu muốn format ngày giờ, có thể cài dayjs hoặc moment:
// npm install dayjs
// import dayjs from "dayjs";

const TimeDateOverlay = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Cập nhật thời gian mỗi giây (nếu muốn real-time)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tách ngày, giờ, phút...
  const day = currentTime.getDate();
  const month = currentTime.getMonth() + 1; // getMonth() trả về 0-11
  const year = currentTime.getFullYear();
  let hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  
  // Đổi sang 12h format (nếu muốn)
  hours = hours % 12;
  hours = hours || 12;

  // Tạo chuỗi ngày giờ
  const dateString = `${day < 10 ? "0" + day : day} ${
    month < 10 ? "0" + month : month
  } ${year}`;
  const timeString = `${hours < 10 ? "0" + hours : hours}:${
    minutes < 10 ? "0" + minutes : minutes
  } ${ampm}`;

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../assets/login-image.jpg")}
        style={styles.imageBackground}
        imageStyle={styles.imageStyle} // bo góc nếu cần
      >
        {/* Overlay Text ở góc trên/phải của ảnh */}
        <View style={styles.overlayContainer}>
          <Text style={styles.dateText}>{dateString}</Text>
          <Text style={styles.timeText}>{timeString}</Text>
        </View>
      </ImageBackground>
    </View>
  );
};

export default TimeDateOverlay;

const styles = StyleSheet.create({
  container: {
    // Ví dụ: width: "100%", height: 200
    // Tuỳ thuộc bạn muốn ảnh chiếm bao nhiêu
    width: "90%",
    height: 200,
    marginVertical: 20,
  },
  imageBackground: {
    flex: 1,
    justifyContent: "center", // Chỉ định vị trí con
  },
  imageStyle: {
    borderRadius: 15, // Bo góc ảnh
  },
  overlayContainer: {
    position: "absolute",
    top: 10,
    right: 10,
    alignItems: "flex-end", // Text căn phải
  },
  dateText: {
    fontSize: 16,
    color: "#FFF",
    marginBottom: 4,
    fontWeight: "600",
  },
  timeText: {
    fontSize: 16,
    color: "#FFF",
    fontWeight: "600",
  },
});
