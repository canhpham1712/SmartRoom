import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { useNavigation } from '@react-navigation/native';

const WelcomeScreen = () => {
    const navigation = useNavigation();
  
    return (
      <View style={styles.container}>
        {/* Background circles */}
        <View style={styles.circleContainer}>
          <View style={[styles.circle, styles.circle1]} />
          <View style={[styles.circle, styles.circle2]} />
        </View>
  
        {/* Nội dung chính */}
        <Image source={require("../assets/welcome-image.png")} style={styles.image} />
        <Text style={styles.title}>The room’s control is in your hand</Text>
        <Text style={styles.description}>
          Have you heard about our IOT services? Be pleasure to be served!
          Here is one of the most convenient apps that we brought to you.
        </Text>
  
        {/* Nút Get Started */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Login")}>
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F9FAFB",
      paddingHorizontal: 20,
    },
  
    // 🎨 Vẽ nhiều hình tròn cho background
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
  
    // 📷 Hình ảnh
    image: {
      width: "90%",
      height: 200,
      borderRadius: 10,
      marginBottom: 20,
    },
  
    // 📝 Tiêu đề
    title: {
      fontSize: 19,
      fontWeight: "bold",
      textAlign: "center",
      color: "#333",
      marginBottom: 10,
    },
  
    // 📜 Mô tả
    description: {
      fontSize: 16,
      textAlign: "center",
      color: "#666",
      marginBottom: 20,
      paddingHorizontal: 19,
    },
  
    // 🔘 Nút Get Started
    buttonContainer: {
      position: "absolute",
      bottom: 40, 
      width: "100%",
      alignItems: "center",
    },
    button: {
      backgroundColor: "#50C2C9",
      paddingVertical: 14,
      paddingHorizontal: 40,
      borderRadius: 8,
      width: "90%",
      alignItems: 'center'
    },
    buttonText: {
      color: "white",
      fontSize: 20,
      fontWeight: "bold",
    },
  });
  
  export default WelcomeScreen;