import React, { useState } from "react";
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import TimeDateOverlay from "../components/TimeDateOverlay";

const LoginScreen = () => {
  const navigation = useNavigation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const response = await fetch("http://192.168.15.120:3000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (data.success) {
        navigation.replace("Main");
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error logging in:", error);
      alert("Error logging in! Please try again.");
    }
  };

  return (
    <View style={styles.container}>  
      <View style={styles.circleContainer}>
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
      </View>

      <Text style={styles.title}>Welcome Back!</Text>

      <Image source={require("../assets/login-image.jpg")} style={styles.image} />

      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        placeholderTextColor="#999"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="Enter password"
        placeholderTextColor="#999"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 20,
  },
  circleContainer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  circle: {
    position: "absolute",
    backgroundColor: "#DFF6FF",
    borderRadius: 999,
  },
  circle1: {
    width: 120,
    height: 120,
    top: -40,
    left: -40,
  },
  circle2: {
    width: 160,
    height: 160,
    top: 20,
    left: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
    marginBottom: 20,
  },
  image: {
    width: "90%",
    height: 180,
    borderRadius: 15,
    marginBottom: 20,
  },
  input: {
    width: "90%",
    height: 50,
    backgroundColor: "#FFF",
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  button: {
    backgroundColor: "#50C2C9",
    paddingVertical: 14,
    width: "90%",
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
