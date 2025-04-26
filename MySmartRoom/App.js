import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LogBox } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import WelcomeScreen from "./src/WelcomeScreen";
import LoginScreen from "./src/LogInScreen";
import HomeScreen from "./src/HomeScreen";
import ThresholdScreen from "./src/ThresholdScreen";
import ActivityLogScreen from "./src/ActivityLogScreen";
import VisualizationScreen from "./src/VisualizationScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

LogBox.ignoreLogs([
  "Support for defaultProps will be removed from function components",
]);

const MainTabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        switch (route.name) {
          case 'Home':
            iconName = focused ? 'home' : 'home-outline';
            break;
          case 'Threshold':
            iconName = focused ? 'thermometer' : 'thermometer-outline';
            break;
          case 'ActivityLog':
            iconName = focused ? 'time' : 'time-outline';
            break;
          case 'Visualization':
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
            break;
          default:
            iconName = 'ellipse';
        }
        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#50C2C9',
      tabBarInactiveTintColor: 'gray',
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Threshold" component={ThresholdScreen} />
    <Tab.Screen name="ActivityLog" component={ActivityLogScreen} options={{ title: 'Activity Log' }} />
    <Tab.Screen name="Visualization" component={VisualizationScreen} options={{ title: 'Visualization' }} />
  </Tab.Navigator>
);

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
