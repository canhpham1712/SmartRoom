// src/screens/ThresholdScreen.js
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Slider from '@react-native-community/slider';

const API_URL = 'http://192.168.15.120:3000';

export default function ThresholdScreen() {
  const navigation = useNavigation();

  const [fanVal, setFanVal]     = useState(20);
  const [lightVal, setLightVal] = useState(50);
  const [dispFan, setDispFan]     = useState(20);
  const [dispLight, setDispLight] = useState(50);

  useEffect(() => {
    fetch(`${API_URL}/api/thresholds`)
      .then(r => r.json())
      .then(json => {
        const f = json.fan   ?? 20;
        const l = json.light ?? 50;
        setFanVal(f);     setDispFan(f);
        setLightVal(l);   setDispLight(l);
      })
      .catch(console.error);
  }, []);

  const save = () => {
    fetch(`${API_URL}/api/thresholds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fan: fanVal, light: lightVal }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) Alert.alert('Saved');
        else              Alert.alert('Error', json.error || 'Unknown');
      })
      .catch(() => Alert.alert('Error', 'Cannot save'));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Threshold</Text>
      </View>

      {/* rest giữ nguyên */}
      <Text style={styles.label}>
        Fan temp threshold: <Text style={styles.value}>{dispFan}°C</Text>
      </Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={40}
        step={1}
        defaultValue={fanVal}
        onValueChange={v => setDispFan(v)}
        onSlidingComplete={v => setFanVal(v)}
        minimumTrackTintColor="#50C2C9"
        maximumTrackTintColor="#ddd"
        thumbTintColor="#50C2C9"
      />

      <Text style={[styles.label, { marginTop: 30 }]}>
        Light lux threshold: <Text style={styles.value}>{dispLight}</Text>
      </Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={100}
        step={1}
        defaultValue={lightVal}
        onValueChange={v => setDispLight(v)}
        onSlidingComplete={v => setLightVal(v)}
        minimumTrackTintColor="#50C2C9"
        maximumTrackTintColor="#ddd"
        thumbTintColor="#50C2C9"
      />

      <View style={styles.buttonWrapper}>
        <Button title="Save" onPress={save} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 100,
    paddingTop: 55,
    backgroundColor: '#50C2C9',
    // không justifyContent: 'center', để dùng absolute positioning cho title
    paddingHorizontal: 16,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top:50 ,
    padding: 8,
  },
  backTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerTitle: {
    position: 'absolute',
    top:  52,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  label:         { fontSize: 16, marginTop: 24, marginHorizontal: 20 },
  value:         { fontWeight: '700', color: '#50C2C9' },
  slider:        { width: '90%', alignSelf: 'center', marginTop: 8 },
  buttonWrapper: { marginTop: 40, width: '90%', alignSelf: 'center' },
});
